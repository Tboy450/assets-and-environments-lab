import fs from 'node:fs/promises';
import path from 'node:path';
export async function registerTerrainArchive(store,directory){
  let samples;try{samples=JSON.parse(await fs.readFile(path.join(directory,'site/studio/terrain-manifest.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return;throw error;}
  for(const sample of samples){
    const value={...sample,filename:sample.name,format:sample.kind==='terrain'?'terrain study':'environment study',browseCategory:'worlds',creator:'Retained project terrain and world-layout sources',license:'Original source notices and estimation limits retained; inherited third-party assets retain their licenses',status:'Archived terrain study · inspection preview'};
    const existing=store.state.assets.find(a=>a.id===sample.id);if(existing)Object.assign(existing,value);else store.state.assets.push(value);
  }
  await store.persist();
}
