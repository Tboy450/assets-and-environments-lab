import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

export const assetExtensions = new Set(['.blend','.blend1','.blend2','.glb','.gltf','.obj','.fbx','.stl','.ply','.usd','.usda','.usdc','.usdz','.abc','.hip','.hiplc','.hipnc','.hda','.hdalc','.hdanc','.bgeo','.sc','.vdb','.zip','.7z','.rar','.png','.jpg','.jpeg','.webp','.gif','.svg','.exr','.hdr','.wav','.mp3','.ogg','.flac','.mp4','.webm','.ttf','.otf']);
const supportExtensions = new Set(['.bin','.mtl','.txt','.md','.json','.license','.tga','.bmp','.tif','.tiff']);
export function cleanRelative(value) {
  if(typeof value!=='string'||!value||value.length>1200||path.isAbsolute(value))throw new Error('Choose a relative asset filename');
  const parts=value.replaceAll('\\','/').split('/');
  if(parts.some(s=>!s||s==='.'||s==='..'||s.length>255||/[<>:"|?*\x00-\x1f]/.test(s)||/[. ]$/.test(s)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)))throw new Error('Invalid asset path');
  return parts.join('/');
}
export function contained(root,target){const relative=path.relative(root,target);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,20);
const id=()=>randomUUID();
const exists=async file=>{try{await fs.access(file);return true;}catch{return false;}};
async function atomicRename(from,to){
  for(let attempt=0;;attempt++){
    try{return await fs.rename(from,to);}catch(error){
      if(process.platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=5)throw error;
      await new Promise(resolve=>setTimeout(resolve,25*2**attempt));
    }
  }
}
export const previewKind=file=>/\.(glb|gltf)$/i.test(file)?'model':/\.(png|jpe?g|webp|gif)$/i.test(file)?'image':/\.(wav|mp3|ogg|flac)$/i.test(file)?'audio':/\.(mp4|webm)$/i.test(file)?'video':'source';

export class StudioStore {
  constructor(base,{linkedCatalog=null}={}){
    this.base=path.resolve(base);this.linkedCatalog=linkedCatalog;this.queue=Promise.resolve();this.uploading=new Set();
    this.file=path.join(this.base,'data','catalog.json');
  }
  async init(seed=[]){
    await fs.mkdir(path.join(this.base,'data','history'),{recursive:true});
    await fs.mkdir(path.join(this.base,'library','inbox'),{recursive:true});
    if(await exists(this.file)){
      this.state=JSON.parse(await fs.readFile(this.file,'utf8'));
      if(this.state.version!==1||!Array.isArray(this.state.projects)||!Array.isArray(this.state.assets)||!Array.isArray(this.state.batches))throw new Error('Catalog version unsupported; original file retained');
    }else this.state={version:1,projects:[{id:'swarmfall',name:'Swarmfall',description:'Independent local snapshot; original public lab is unchanged.'},{id:'shared',name:'Shared Asset Library',description:'Reusable local sources and imports across projects.'}],assets:seed,batches:[]};
    await this.linkOriginalLibrary();await this.persist();return this;
  }
  async persist(){
    const text=JSON.stringify(this.state,null,2)+'\n';
    const operation=this.queue.then(async()=>{
      const stamp=Date.now()+'-'+id();
      if(await exists(this.file))await fs.copyFile(this.file,path.join(this.base,'data','history',`catalog-${stamp}.json`));
      const temporary=this.file+'.'+stamp+'.tmp';await fs.writeFile(temporary,text,{flag:'wx'});await atomicRename(temporary,this.file);
    });
    this.queue=operation.catch(()=>{});return operation;
  }
  project(projectId){const result=this.state.projects.find(p=>p.id===projectId);if(!result)throw new Error('Project not found');return result;}
  async createProject(name){
    name=String(name??'').trim();if(!name||name.length>100)throw new Error('Use a project name of 1–100 characters');
    const project={id:'project-'+id(),name,description:'Local project asset collection'};this.state.projects.push(project);await this.persist();return project;
  }
  async createBatch(projectId,name,notes={}){
    this.project(projectId);
    const batch={id:id(),projectId,name:String(name||'Imported files').slice(0,150),created:new Date().toISOString(),files:[],creator:String(notes.creator||'').slice(0,300),license:String(notes.license||'Unreviewed — retain source/license notes').slice(0,500),source:String(notes.source||'').slice(0,2000)};
    await fs.mkdir(path.join(this.base,'library','imports',batch.id),{recursive:true});this.state.batches.push(batch);await this.persist();return batch;
  }
  async receiveFile(batchId,relative,readable,{maxBytes=8*1024**3}={}){
    const batch=this.state.batches.find(b=>b.id===batchId);if(!batch)throw new Error('Import batch not found');
    relative=cleanRelative(relative);const ext=path.extname(relative).toLowerCase();
    if(!assetExtensions.has(ext)&&!supportExtensions.has(ext))throw new Error('Unsupported file type; native models, archives, textures and license notes are accepted');
    const key=batch.id+'/'+relative;if(this.uploading.has(key))throw new Error('This file is already uploading');this.uploading.add(key);
    const root=path.join(this.base,'library','imports',batch.id),target=path.join(root,...relative.split('/'));
    let temporary;
    try{
      if(await exists(target))throw new Error('File already exists; import into a new batch to keep both versions');
      await fs.mkdir(path.dirname(target),{recursive:true});
      temporary=target+'.partial-'+id();let bytes=0;const digest=createHash('sha256');
      const meter=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;if(bytes>maxBytes)return done(new Error('File exceeds the import limit'));digest.update(chunk);done(null,chunk);}});
      await pipeline(readable,meter,createWriteStream(temporary,{flags:'wx'}));
      await fs.rename(temporary,target);batch.files.push(relative);
      let asset=null;
      if(assetExtensions.has(ext)){
        asset={id:'asset-'+id(),projectId:batch.projectId,batchId:batch.id,name:path.parse(relative).name,filename:path.basename(relative),relative,root,kind:previewKind(relative),format:ext.slice(1),bytes,sha256:digest.digest('hex'),creator:batch.creator,license:batch.license,source:batch.source,status:previewKind(relative)==='source'?'Native/source file retained; preview export needed':'Imported — visual review pending'};
        this.state.assets.push(asset);
      }
      await this.persist();return {asset,bytes,relative};
    }finally{this.uploading.delete(key);} // Interrupted .partial files are retained for recovery.
  }
  async linkOriginalLibrary(){
    if(this.state.assets.some(a=>a.snapshot&&a.id.startsWith('linked-')))return 0;
    if(!this.linkedCatalog||!await exists(this.linkedCatalog))return 0;
    const receipt=JSON.parse(await fs.readFile(this.linkedCatalog,'utf8')),root=path.dirname(this.linkedCatalog);let added=0;
    for(const row of receipt.assets||[]){
      const relative=cleanRelative(row.file),target=path.resolve(root,relative);
      if(!contained(root,target)||!await exists(target))continue;
      const assetId='linked-'+hash(target);if(this.state.assets.some(a=>a.id===assetId))continue;
      const info=await fs.stat(target);
      this.state.assets.push({id:assetId,projectId:'shared',name:row.title||path.parse(relative).name,filename:path.basename(relative),relative,root,kind:previewKind(relative),format:path.extname(relative).slice(1),bytes:info.size,creator:row.creator||'',license:row.license||'Unreviewed',source:row.source||'',sha256:row.sha256||null,status:'Read-only source link; catalog checksum receipt copied, not rehashed',linked:true});added++;
    }
    return added;
  }
  async scanInbox(projectId='shared'){
    this.project(projectId);const root=path.join(this.base,'library','inbox');let added=0;
    const walk=async directory=>{for(const entry of await fs.readdir(directory,{withFileTypes:true})){
      if(entry.isSymbolicLink())continue;const target=path.join(directory,entry.name);
      if(entry.isDirectory()){await walk(target);continue;}
      if(!entry.isFile()||!assetExtensions.has(path.extname(entry.name).toLowerCase()))continue;
      const relative=path.relative(root,target).split(path.sep).join('/');cleanRelative(relative);
      const assetId='inbox-'+hash(target);if(this.state.assets.some(a=>a.id===assetId))continue;
      const info=await fs.stat(target);
      this.state.assets.push({id:assetId,projectId,name:path.parse(entry.name).name,filename:entry.name,relative,root,inbox:true,kind:previewKind(relative),format:path.extname(relative).slice(1),bytes:info.size,license:'Unreviewed — add license/source notes before sharing',creator:'',source:'',status:'Inbox source retained; preview/reuse review pending',linked:true});added++;
    }};await walk(root);await this.persist();return {added};
  }
  asset(assetId){const asset=this.state.assets.find(a=>a.id===assetId);if(!asset)throw new Error('Asset not found');return asset;}
  publicAsset(asset){const {root,originalRoot,...safe}=asset;return {...safe,thumbnailUrl:this.thumbnails?.has(asset.id)?`/thumbnails/${encodeURIComponent(asset.id)}.png`:null,url:asset.relative?`/asset-files/${encodeURIComponent(asset.id)}/${asset.relative.split('/').map(encodeURIComponent).join('/')}`:null};}
  async resolveFile(assetId,relative){
    const asset=this.asset(assetId);if(!asset.root)throw new Error('This item is a bundled preview');
    if(asset.available===false)throw new Error('Source is currently missing or offline; rescan after reconnecting it');
    const snapshotRoot=asset.snapshot&&asset.root?path.join(this.base,'library','snapshots','2026-10-19',asset.sourceId||'asset-archive'):null;
    const sourceRoot=asset.batchId?path.join(this.base,'library','imports',asset.batchId):asset.inbox?path.join(this.base,'library','inbox'):snapshotRoot||path.resolve(this.base,asset.root);
    relative=cleanRelative(relative);const root=await fs.realpath(sourceRoot),target=await fs.realpath(path.join(root,...relative.split('/')));
    if(!contained(root,target))throw new Error('Asset path leaves its source folder');return target;
  }
}
