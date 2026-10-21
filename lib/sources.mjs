// Index only the explicitly configured asset folders. Never execute or modify their contents.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assetExtensions, cleanRelative, contained, previewKind} from './store.mjs';

const skip=new Set(['.git','.venv','venv','node_modules','__pycache__','.codex','.agents','android-signing','.local_backups','.buildozer']);
const digest=value=>createHash('sha256').update(value).digest('hex').slice(0,24);
export async function scanSources(store,config){
  for(const project of config.projects||[]){
    const existing=store.state.projects.find(p=>p.id===project.id);
    if(existing)Object.assign(existing,project);else store.state.projects.push({...project});
  }
  const reports=[];
  for(const source of config.sources||[]){
    store.project(source.projectId);
    const report={id:source.id,name:source.name,projectId:source.projectId,added:0,updated:0,missing:0,files:0,bytes:0,errors:[]};
    const seen=new Set();
    try{
      const root=await fs.realpath(path.resolve(store.base,source.root));
      const visit=async directory=>{
        for(const entry of await fs.readdir(directory,{withFileTypes:true})){
          if(entry.isSymbolicLink()||skip.has(entry.name)||entry.name.startsWith('.')||source.excludeDirectories?.includes(entry.name))continue;
          const target=path.join(directory,entry.name);
          if(entry.isDirectory()){await visit(target);continue;}
          if(!entry.isFile())continue;
          const relative=path.relative(root,target).split(path.sep).join('/');
          const ext=path.extname(entry.name).toLowerCase();
          if(source.files?!source.files.includes(relative):!assetExtensions.has(ext))continue;
          if(source.extensions&&!source.extensions.includes(ext))continue;
          cleanRelative(relative);
          const real=await fs.realpath(target);if(!contained(root,real))continue;
          const stat=await fs.stat(real),id='device-'+digest(source.id+'\0'+relative);
          const existing=store.state.assets.find(a=>a.id===id);
          const value={id,projectId:source.projectId,name:path.parse(entry.name).name,filename:entry.name,relative,root,sourceId:source.id,collection:source.name,kind:previewKind(entry.name),format:entry.name.endsWith('.bgeo.sc')?'bgeo.sc':ext.slice(1),bytes:stat.size,modified:stat.mtime.toISOString(),linked:true,available:true,creator:source.creator||'',license:source.license||'Unreviewed — retain original project credits',source:source.url||'',notes:source.notes||'',status:'Read-only local source · visual/reuse review pending'};
          if(config.snapshotCreated)value.snapshot=true;
          if(value.snapshot)value.status='Independent local snapshot · source review pending';
          if(existing){const {creator,license,notes}=existing;Object.assign(existing,value,{creator,license,notes});report.updated++;}else{store.state.assets.push(value);report.added++;}
          seen.add(id);report.files++;report.bytes+=stat.size;
        }
      };
      await visit(root);
      for(const asset of store.state.assets.filter(a=>a.sourceId===source.id&&!seen.has(a.id))){asset.available=false;asset.status='Missing/offline source — retained catalog record';report.missing++;}
    }catch(error){report.errors.push(error.code==='ENOENT'?'Folder not available':error.message);}
    reports.push(report);
  }
  store.state.sourceReports={scannedAt:new Date().toISOString(),sources:reports};
  await store.persist();return store.state.sourceReports;
}
