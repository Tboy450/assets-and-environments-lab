import http from 'node:http';
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StudioStore, contained } from './lib/store.mjs';
import { scanSources } from './lib/sources.mjs';
import { registerDragonfly } from './lib/dragonfly-catalog.mjs';
import { pickerDirectory,nativeImport } from './lib/native-picker.mjs';
import { assetCatalog } from './site/invasion/environments/asset-viewer.mjs';
import {inCollection} from './site/studio/collections.mjs';
import {registerTerrainArchive} from './lib/terrain-catalog.mjs';
import {bootstrapPortableCatalog} from './lib/portable-catalog.mjs';

const base=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
Object.assign(mime,{'.gif':'image/gif','.flac':'audio/flac','.mp4':'video/mp4','.webm':'video/webm','.ttf':'font/ttf','.otf':'font/otf'});
export function seedAssets(){
  const environments=[['alien','Alien arcology'],['metropolis','Metropolis'],['citadel','Tidal citadel'],['cyberpunk','Skyway megacity'],['drone','Phototextured city']].map(([key,name])=>({id:'swarmfall-world-'+key,projectId:'swarmfall',name,filename:key,kind:'environment',previewUrl:'/invasion/environments/?scene='+key,creator:'See retained lab credits',license:'Mixed originals/licensed derivatives; see lab credits',source:'',status:'Copied visual lab; not a playable city battle'}));
  return [...environments,...assetCatalog.map(a=>({id:'swarmfall-'+a.id,projectId:'swarmfall',name:a.name,filename:a.drone||path.basename(a.url),kind:'bundled',previewUrl:'/invasion/environments/?asset='+a.id,creator:a.creator,license:a.license,source:a.source,status:'Copied inspection asset — owner review still required'}))];
}
async function jsonBody(req){let text='';for await(const part of req){text+=part;if(Buffer.byteLength(text)>1024*1024)throw new Error('JSON request too large');}return JSON.parse(text||'{}');}
const reply=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function sendFile(req,res,file,attachment=false){
  const stat=await fs.stat(file);if(!stat.isFile())throw new Error('Not a file');
  const type=mime[path.extname(file).toLowerCase()]||'application/octet-stream';
  const headers={'Content-Type':type,'Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'};
  if(attachment||!mime[path.extname(file).toLowerCase()])headers['Content-Disposition']="attachment; filename*=UTF-8''"+encodeURIComponent(path.basename(file));
  res.writeHead(200,headers);if(req.method==='HEAD')res.end();else await pipeline(createReadStream(file),res);
}
export async function createStudioServer({directory=base,linkedCatalog=null,sourceConfig={},chooseNative=null}={}){
  let fresh=false;try{await fs.access(path.join(directory,'data/catalog.json'));}catch(error){if(error.code==='ENOENT')fresh=true;else throw error;}
  const store=await new StudioStore(directory,{linkedCatalog}).init(seedAssets());
  if(fresh)await bootstrapPortableCatalog(store,directory);
  await registerDragonfly(store,directory);
  await registerTerrainArchive(store,directory);
  const thumbnails=path.join(directory,'.runtime','thumbnails');await fs.mkdir(thumbnails,{recursive:true});
  store.thumbnails=new Set((await fs.readdir(thumbnails)).filter(name=>name.endsWith('.png')).map(name=>name.slice(0,-4)));
  const site=path.join(directory,'site');
  const server=http.createServer(async(req,res)=>{
    try{
      const allowedHosts=[`127.0.0.1:${req.socket.localPort}`,`localhost:${req.socket.localPort}`];
      if(!allowedHosts.includes(req.headers.host))return reply(res,403,{error:'This studio is local to this device'});
      if(req.headers.origin&&!allowedHosts.some(host=>req.headers.origin==='http://'+host))return reply(res,403,{error:'Only the local studio may modify its library'});
      const url=new URL(req.url,'http://127.0.0.1');const pathname=url.pathname;
      const thumbnail=pathname.match(/^\/(api\/thumbnails|thumbnails)\/([^/]+?)(?:\.png)?$/);
      if(thumbnail){
        const assetId=decodeURIComponent(thumbnail[2]);store.asset(assetId);
        if(!/^[a-zA-Z0-9_-]+$/.test(assetId))throw new Error('Invalid thumbnail identifier');
        const file=path.join(thumbnails,assetId+'.png');
        if(req.method==='POST'&&thumbnail[1]==='api/thumbnails'){
          const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>1024*1024)throw new Error('Thumbnail too large');chunks.push(chunk);}
          const data=Buffer.concat(chunks);if(!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Use a PNG thumbnail');
          await fs.writeFile(file,data);store.thumbnails.add(assetId);return reply(res,201,{url:'/thumbnails/'+assetId+'.png'});
        }
        if(['GET','HEAD'].includes(req.method))return await sendFile(req,res,file);
      }
      if(pathname==='/api/info'&&req.method==='GET')return reply(res,200,{name:'Asset & Environment Studio',localOnly:true,library:path.join(directory,'library'),inbox:path.join(directory,'library','inbox'),sourceCommit:'7ab195e50426ebd77fed3ad134d5838008fc980c',linkedCatalogAvailable:!!linkedCatalog});
      if(pathname==='/api/projects'&&req.method==='GET')return reply(res,200,store.state.projects);
      if(pathname==='/api/picker/info'&&req.method==='GET')return reply(res,200,{available:process.platform==='win32',folder:await pickerDirectory(store,sourceConfig,url.searchParams.get('project')||'all-local')});
      if(pathname==='/api/picker/import'&&req.method==='POST'){
        if(store.picking)return reply(res,409,{error:'The file picker is already open'});
        const body=await jsonBody(req);store.picking=true;
        try{return reply(res,200,await nativeImport(store,sourceConfig,body.projectId,body,chooseNative));}finally{store.picking=false;}
      }
      if(pathname==='/api/sources'&&req.method==='GET')return reply(res,200,store.state.sourceReports||{sources:[]});
      if(pathname==='/api/sources/scan'&&req.method==='POST'){
        if(store.scanning)return reply(res,409,{error:'A source scan is already running'});
        store.scanning=true;try{return reply(res,200,await scanSources(store,sourceConfig));}finally{store.scanning=false;}
      }
      if(pathname==='/api/projects'&&req.method==='POST'){const body=await jsonBody(req);return reply(res,201,await store.createProject(body.name));}
      if(pathname.startsWith('/api/projects/')&&req.method==='GET'){
        const projectId=decodeURIComponent(pathname.slice('/api/projects/'.length));return reply(res,200,store.project(projectId));
      }
      if(pathname==='/api/assets'&&req.method==='GET'){
        const projectId=url.searchParams.get('project');return reply(res,200,store.state.assets.filter(a=>inCollection(a,projectId)).map(a=>store.publicAsset(a)));
      }
      if(pathname.startsWith('/api/assets/')&&req.method==='GET')return reply(res,200,store.publicAsset(store.asset(decodeURIComponent(pathname.slice('/api/assets/'.length)))));
      if(pathname==='/api/batches'&&req.method==='POST'){
        const body=await jsonBody(req);return reply(res,201,await store.createBatch(body.projectId,body.name,body));
      }
      const upload=pathname.match(/^\/api\/batches\/([^/]+)\/files$/);
      if(upload&&req.method==='POST'){
        const result=await store.receiveFile(upload[1],url.searchParams.get('path'),req);return reply(res,201,{...result,asset:result.asset?store.publicAsset(result.asset):null});
      }
      if(pathname==='/api/inbox/scan'&&req.method==='POST'){const body=await jsonBody(req);return reply(res,200,await store.scanInbox(body.projectId));}
      const download=pathname.match(/^\/asset-files\/([^/]+)\/(.+)$/);
      if(download&&['GET','HEAD'].includes(req.method)){
        const target=await store.resolveFile(decodeURIComponent(download[1]),decodeURIComponent(download[2]));
        return await sendFile(req,res,target,url.searchParams.has('download'));
      }
      if(!['GET','HEAD'].includes(req.method))return reply(res,405,{error:'Method not supported'});
      const target=path.resolve(site,'.'+decodeURIComponent(pathname.endsWith('/')?pathname+'index.html':pathname));
      if(!contained(site,target))return reply(res,403,{error:'Path outside the studio'});
      const real=await fs.realpath(target);if(!contained(await fs.realpath(site),real))return reply(res,403,{error:'Path outside the studio'});
      await sendFile(req,res,real);
    }catch(error){if(res.headersSent){res.destroy();return;}reply(res,error.code==='ENOENT'?404:400,{error:error.message});}
  });
  return {server,store};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let linkedCatalog=null;
  try{const config=JSON.parse(await fs.readFile(path.join(base,'studio.config.json'),'utf8'));linkedCatalog=config.linkedCatalog??linkedCatalog;}catch(error){if(error.code!=='ENOENT')throw error;}
  let sourceConfig={};try{sourceConfig=JSON.parse(await fs.readFile(path.join(base,'sources.local.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  let config={};try{config=JSON.parse(await fs.readFile(path.join(base,'studio.config.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const port=Number(process.env.ASSET_STUDIO_PORT||config.port||4194);
  if(linkedCatalog)linkedCatalog=path.resolve(base,linkedCatalog);
  const {server,store}=await createStudioServer({linkedCatalog,sourceConfig});
  await scanSources(store,sourceConfig);
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`Asset & Environment Studio: http://127.0.0.1:${port}/\nLocal copy only. Swarmfall's public lab is unchanged.`));
}
