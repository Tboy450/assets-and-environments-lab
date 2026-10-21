import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createReadStream} from 'node:fs';
const run=promisify(execFile);
export async function pickerDirectory(store,config,projectId){
  store.project(projectId);
  let saved={};try{saved=JSON.parse(await fs.readFile(path.join(store.base,'data','picker-folders.json'),'utf8'));}catch{}
  const source=config.sources?.find(s=>s.projectId===projectId);
  const choices=[saved[projectId],source&&path.resolve(store.base,source.root),path.join(store.base,'library','snapshots','2026-10-19','asset-archive'),path.join(store.base,'library','inbox')];
  for(const folder of choices.filter(Boolean))try{if((await fs.stat(folder)).isDirectory())return folder;}catch{}
  return store.base;
}
export async function nativeImport(store,config,projectId,notes={},choose=null){
  const initial=await pickerDirectory(store,config,projectId);
  if(!choose&&process.platform!=='win32')throw new Error('Use Browser picker on this device');
  const script=choose?null:await fs.readFile(path.join(store.base,'scripts','choose-assets.ps1'),'utf8');
  const files=choose?await choose(initial):JSON.parse((await run('powershell.exe',['-NoProfile','-STA','-Command',script],{windowsHide:true,env:{...process.env,ASSET_STUDIO_PICKER_INITIAL:initial},timeout:15*60*1000,maxBuffer:1024*1024})).stdout.trim()||'[]');
  if(!Array.isArray(files)||!files.length)return {cancelled:true,imported:0};
  const destination=projectId==='all-local'?'shared':projectId;
  const batch=await store.createBatch(destination,'Windows file selection',notes);
  let imported=0;const errors=[];
  for(const file of files){try{const stat=await fs.stat(file);if(!stat.isFile())throw new Error('Not a regular file');await store.receiveFile(batch.id,path.basename(file),createReadStream(file));imported++;}catch(error){errors.push(path.basename(file)+': '+error.message);}}
  let saved={};const settings=path.join(store.base,'data','picker-folders.json');try{saved=JSON.parse(await fs.readFile(settings,'utf8'));}catch{}
  saved[projectId]=path.dirname(files[0]);await fs.writeFile(settings,JSON.stringify(saved,null,2)+'\n');
  return {imported,errors,batchId:batch.id};
}
