// A static showcase: no native archives, import service, device paths, catalog history or secrets.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),target=path.join(base,'public-site','dist');
// Rebuild only this generated output directory so excluded imports cannot linger.
if(path.dirname(target)!==path.join(base,'public-site')||path.basename(target)!=='dist')throw Error('Unexpected showcase output path');
try{if((await fs.lstat(target)).isSymbolicLink())throw Error('Showcase output cannot be a link');}catch(error){if(error.code!=='ENOENT')throw error;}
await fs.rm(target,{recursive:true,force:true});
await fs.mkdir(target,{recursive:true});
await fs.cp(path.join(base,'site'),target,{recursive:true});
const state=JSON.parse(await fs.readFile(path.join(base,'data','catalog.json'),'utf8'));
const approved=new Set(JSON.parse(await fs.readFile(path.join(base,'provenance','public-showcase-allowlist.json'),'utf8')).assetIds);
state.assets=state.assets.filter(asset=>approved.has(asset.id));
const mimeAssets=new Set(['.glb','.gltf','.bin','.png','.jpg','.jpeg','.webp','.gif','.wav','.mp3','.ogg','.mp4','.webm']);
const roots=new Map();
for(const a of state.assets){if(!a.root||/tools\/blender-portable\//.test(a.relative||''))continue;if(!mimeAssets.has(path.extname(a.relative||'').toLowerCase()))continue;const key=a.sourceId||a.batchId||'inbox';roots.set(key,a.batchId?path.join(base,'library','imports',a.batchId):a.root);}
async function copyMedia(root,out){
  await fs.mkdir(out,{recursive:true});
  for(const entry of await fs.readdir(root,{withFileTypes:true})){
    if(entry.isSymbolicLink()||['tools','.git','.venv','node_modules','__pycache__'].includes(entry.name))continue;
    const input=path.join(root,entry.name),output=path.join(out,entry.name);
    if(entry.isDirectory())await copyMedia(input,output);
    else if(mimeAssets.has(path.extname(entry.name).toLowerCase()))await fs.copyFile(input,output);
  }
}
for(const [key,root] of roots)await copyMedia(root,path.join(target,'public-assets',key));
// Keep showcase files below 25 MiB. Split a large GLB's buffer
// views into ordinary glTF sidecars without changing any geometry or textures.
const webCopies=new Map();
async function splitLargeModels(folder){
  for(const entry of await fs.readdir(folder,{withFileTypes:true})){
    const file=path.join(folder,entry.name);
    if(entry.isDirectory()){await splitLargeModels(file);continue;}
    if(!entry.name.endsWith('.glb')||(await fs.stat(file)).size<=24*1024*1024)continue;
    const bytes=await fs.readFile(file),jsonLength=bytes.readUInt32LE(12);
    if(bytes.readUInt32LE(0)!==0x46546c67)throw Error('Invalid GLB: '+entry.name);
    const model=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
    const binaryStart=20+jsonLength+8,stem=path.basename(file,'.glb');
    model.buffers=[];
    for(const [index,view] of model.bufferViews.entries()){
      if(view.byteLength>24*1024*1024)throw Error('Model buffer needs further optimization: '+entry.name);
      const filename=stem+'-buffer-'+index+'.bin';
      const start=binaryStart+(view.byteOffset||0);
      await fs.writeFile(path.join(folder,filename),bytes.subarray(start,start+view.byteLength));
      model.buffers.push({uri:filename,byteLength:view.byteLength});
      view.buffer=index;view.byteOffset=0;
    }
    const output=path.join(folder,stem+'.gltf');
    await fs.writeFile(output,JSON.stringify(model));
    webCopies.set('/'+path.relative(target,file).split(path.sep).map(encodeURIComponent).join('/'),'/'+path.relative(target,output).split(path.sep).map(encodeURIComponent).join('/'));
    await fs.unlink(file);
  }
}
await splitLargeModels(target);
const thumbDir=path.join(base,'.runtime','thumbnails');await fs.mkdir(path.join(target,'thumbnails'),{recursive:true});
const thumbNames=new Set((await fs.readdir(thumbDir)).filter(name=>name.endsWith('.png')&&approved.has(name.slice(0,-4))));
for(const name of thumbNames)await fs.copyFile(path.join(thumbDir,name),path.join(target,'thumbnails',name));
const assets=state.assets.filter(a=>!/tools\/blender-portable\//.test(a.relative||'')).map(a=>{
  const key=a.sourceId||a.batchId||'inbox',media=roots.has(key)&&mimeAssets.has(path.extname(a.relative||'').toLowerCase());
  const url=media?'/public-assets/'+key+'/'+a.relative.split('/').map(encodeURIComponent).join('/'):null,animated=media&&/\.gif$/i.test(a.relative);
  // An animated GIF is its own preview; a still PNG capture would hide the animation.
  return {id:a.id,projectId:a.projectId,name:a.name,filename:a.filename,kind:a.kind,format:a.format,dragonflyPart:a.dragonflyPart,sample:a.sample,terrain:a.terrain,worldType:a.worldType,previewUrl:a.previewUrl,url,relative:media?a.relative:undefined,sourceId:a.sourceId,batchId:a.batchId,creator:a.creator,license:a.license,source:a.source,notes:a.notes,available:a.available,bytes:a.bytes,thumbnailUrl:thumbNames.has(a.id+'.png')?'/thumbnails/'+a.id+'.png':animated?url:null,status:a.kind==='source'?'Native source retained in the local library':animated?'Animated effect · original GIF':'Interactive showcase preview'};
});
// List only collections with at least one public entry, so private-only or test collections stay local.
const publicProjects=new Set(assets.map(a=>a.projectId));
const projects=state.projects.filter(p=>p.id==='all-local'||publicProjects.has(p.id)).map(({id,name,description,repository,playUrl})=>({id,name:id==='all-local'?'All collections':name,description,repository,playUrl}));
for(const asset of assets)if(webCopies.has(asset.url)){asset.url=webCopies.get(asset.url);asset.webOptimized=true;asset.status='Web preview copy · original retained in the local library';}
const manifest=JSON.stringify({projects,assets},null,2)+'\n';
if(/\b[A-Z]:[\\/]|127\.0\.0\.1|\\Users\\/i.test(manifest))throw new Error('Device path or local URL found in public catalog');
await fs.writeFile(path.join(target,'studio','public-data.json'),manifest);
async function publicHtml(folder){for(const entry of await fs.readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())await publicHtml(file);else if(entry.name.endsWith('.html')){let html=await fs.readFile(file,'utf8');html=html.replace('</head>','<script>globalThis.ASSET_PUBLIC=true;</script><style>#manage-open,#dropzone,.toolbar>button,.source-panel,#location{display:none!important}.local-badge{font-size:9px}</style></head>').replaceAll('YOUR LOCAL LAB','PUBLIC SHOWCASE').replaceAll('LOCAL DEVICE · INDEPENDENT COPY','PUBLIC SHOWCASE');await fs.writeFile(file,html);}}}
await publicHtml(target);
// The retained branding module needs the static catalog instead of a local API.
const brand=path.join(target,'invasion','environments','studio-brand.mjs');let branding=await fs.readFile(brand,'utf8');branding=branding.replace("const response=await fetch('/api/projects/'+encodeURIComponent(projectId));if(response.ok)project=await response.json();", "const data=await(await fetch('/studio/public-data.json')).json();project=data.projects.find(p=>p.id===projectId)||project;").replaceAll('LOCAL COPY','PUBLIC SHOWCASE').replaceAll('Independent local copy','Independent showcase');await fs.writeFile(brand,branding);
const gallery=path.join(target,'studio','library.mjs');await fs.writeFile(gallery,(await fs.readFile(gallery,'utf8')).replaceAll('Asset archive and connected project folders · local to this device.','Public asset showcase · originals retained in the local library.').replace("link('Original',asset.url", "link(asset.webOptimized?'Web copy':'Original',asset.url"));
const explorer=path.join(target,'studio','explorer.mjs');await fs.writeFile(explorer,(await fs.readFile(explorer,'utf8')).replace("el('a','Download original')","el('a',selected.webOptimized?'Download web copy':'Download original')"));
const hosting=JSON.parse(await fs.readFile(path.join(base,'public-site','.openai','hosting.json'),'utf8'));hosting.static={directory:'dist'};await fs.writeFile(path.join(base,'public-site','.openai','hosting.json'),JSON.stringify(hosting,null,2)+'\n');
await fs.writeFile(path.join(base,'public-site','README.md'),'# Asset Explorer public showcase\n\nStatic public showcase with Explorer and Grid layouts. No native archives, device paths or import service are included. Source/license notices are retained.\n');
let files=0,bytes=0,largest=0;async function verify(folder){for(const e of await fs.readdir(folder,{withFileTypes:true})){const file=path.join(folder,e.name);if(e.isDirectory())await verify(file);else{if(/\.(blend\d*|hip(nc|lc)?|hda(nc|lc)?|zip|7z|bgeo|vdb)$/i.test(e.name))throw new Error('Native source leaked into showcase: '+file);if(/\.(html|mjs|js|css|json|md|txt|xml)$/i.test(e.name)&&/\b[A-Z]:[\\/]Users[\\/]|[\\/]Users[\\/][^\\/\s]+[\\/](OneDrive|Documents|Downloads|Desktop)\b/i.test(await fs.readFile(file,'utf8')))throw new Error('Device path found in public file: '+path.relative(target,file));const s=await fs.stat(file);files++;bytes+=s.size;largest=Math.max(largest,s.size);}}}await verify(target);
console.log(JSON.stringify({files,bytes,largest,assets:assets.length,thumbnails:thumbNames.size,nativeFilesExcluded:true,devicePathsExcluded:true}));
