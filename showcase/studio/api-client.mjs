let manifest;
import {inCollection} from './collections.mjs';
export async function api(url,options){
  if(globalThis.ASSET_PUBLIC){
    if(options?.method&&options.method!=='GET')throw new Error('Adding files is available in the local lab');
    manifest??=fetch('/studio/public-data.json').then(r=>{if(!r.ok)throw new Error('The showcase catalog could not load');return r.json();});
    const data=await manifest,u=new URL(url,location.origin);
    if(u.pathname==='/api/projects')return data.projects;
    if(u.pathname.startsWith('/api/projects/'))return data.projects.find(p=>p.id===decodeURIComponent(u.pathname.slice(14)));
    if(u.pathname==='/api/assets'){const project=u.searchParams.get('project');return data.assets.filter(a=>inCollection(a,project));}
    if(u.pathname.startsWith('/api/assets/')){const asset=data.assets.find(a=>a.id===decodeURIComponent(u.pathname.slice(12)));if(!asset)throw new Error('Asset not found');return asset;}
    if(u.pathname==='/api/sources')return {sources:[]};
    if(u.pathname==='/api/info')return {inbox:'Available in the local lab'};
    throw new Error('This tool is available in the local lab');
  }
  const response=await fetch(url,options),data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data;
}
