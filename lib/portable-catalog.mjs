import fs from 'node:fs/promises';
import path from 'node:path';

// A new clone can browse the committed showcase without the original device.
// Existing local catalogs are kept by the caller, so imports are never replaced.
export async function bootstrapPortableCatalog(store,directory){
  let data;
  try{data=JSON.parse(await fs.readFile(path.join(directory,'showcase/studio/public-data.json'),'utf8'));}
  catch(error){if(error.code==='ENOENT')return;throw error;}
  for(const project of data.projects){
    const old=store.state.projects.find(p=>p.id===project.id);
    if(old)Object.assign(old,project);else store.state.projects.push(project);
  }
  for(const entry of data.assets){
    const asset={...entry};delete asset.batchId;
    if(asset.url?.startsWith('/public-assets/')){
      const segments=asset.url.slice('/public-assets/'.length).split('/').map(decodeURIComponent);
      if(segments.some(s=>!s||s==='.'||s==='..'||s.includes('\\')||s.includes('/')))throw Error('Invalid portable asset path');
      asset.root=path.join(directory,'showcase/public-assets',segments.shift());
      asset.relative=segments.join('/');asset.snapshot=false;
    }else if(asset.kind==='source'){
      delete asset.relative;asset.available=false;
      asset.status='Native source remains in the owner’s private library; import your own source files locally';
    }
    const old=store.state.assets.find(a=>a.id===asset.id);
    if(old)Object.assign(old,asset);else store.state.assets.push(asset);
  }
  await fs.mkdir(path.join(directory,'.runtime/thumbnails'),{recursive:true});
  await fs.cp(path.join(directory,'showcase/thumbnails'),path.join(directory,'.runtime/thumbnails'),{recursive:true});
  await store.persist();
}
