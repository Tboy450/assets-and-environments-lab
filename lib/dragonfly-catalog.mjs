import fs from 'node:fs/promises';
import path from 'node:path';
export async function registerDragonfly(store,directory){
  let source;try{source=await fs.readFile(path.join(directory,'site','vehicle-research.mjs'),'utf8');}catch(error){if(error.code==='ENOENT')return;throw error;}
  if(!store.state.projects.some(p=>p.id==='dragonfly'))store.state.projects.push({id:'dragonfly',name:'Dragonfly',description:'Explore the rotorcraft and its individual systems. Independent educational model snapshot.'});
  const parts=new Map([['all','Complete Dragonfly rotorcraft']]);
  for(const match of source.matchAll(/subsystem\("([\w-]+)"/g))if(!['airflow','sample-flow'].includes(match[1]))parts.set(match[1],match[1].replaceAll('-',' '));
  for(const match of source.matchAll(/interiorPart\("([\w-]+)",\s*"[^"]*",\s*"([^"]*)",\s*"([^"]*)"/g))parts.set(match[1],match[2]);
  for(const [part,name] of parts){
    const id='dragonfly-'+part;if(store.state.assets.some(a=>a.id===id))continue;
    store.state.assets.push({id,projectId:'dragonfly',name,filename:part==='all'?'Dragonfly rotorcraft':part,kind:'dragonfly',dragonflyPart:part,format:'procedural 3D',previewUrl:'/studio/view.html?asset='+id,creator:'Independent Dragonfly project model',license:'Educational reconstruction; source credits and estimation limits retained',source:'',status:'Copied model snapshot · illustrative geometry, not flight CAD',notes:'Built from the independent model code already copied into this lab. NASA/APL reference media retain their owners’ rights.'});
  }
  await store.persist();
  if(!store.state.projects.some(p=>p.id==='starter-samples'))store.state.projects.push({id:'starter-samples',name:'Starter samples',description:'Three original procedural samples made for exploring this lab.'});
  for(const [sample,name] of [['outpost','Moonlight outpost'],['hover-scout','Hover scout'],['crystal-court','Crystal court']]){
    const id='sample-'+sample;if(!store.state.assets.some(a=>a.id===id))store.state.assets.push({id,projectId:'starter-samples',name,filename:name+' (original sample)',kind:'sample',sample,format:'procedural 3D',creator:'Original local lab sample',license:'Original procedural sample for this project',notes:'An original starter asset. It is not a depiction of any imported source file.',status:'Original sample'});
  }
  await store.persist();
}
