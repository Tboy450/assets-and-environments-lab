// Read/inspect first. Protected originals are backed up before any replacement/migration.
// No DOM, file downloads or implicit writes during loading.
import { SAVE_KEY, PROGRESS_VERSION, createProgress, validProgress } from './campaign.mjs?v=dev';
import { droneTypes } from './units.mjs?v=dev';
import { MISSION_SAVE_VERSION, validMissionCheckpoint } from './mission-save.mjs?v=dev';
import { saveCampaignEnvelope } from './progress-store.mjs?v=dev';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nonnegative=v=>Number.isFinite(v)&&v>=0;
const versions=[1,PROGRESS_VERSION],missionVersions=[1,2,MISSION_SAVE_VERSION];
export const recoveryBackupPrefix=SAVE_KEY+'-recovery-';

function campaignShape(raw){
  const records=['captured','stars','bestTime','achievements','stats'];
  return object(raw)&&records.every(k=>object(raw[k]))&&nonnegative(raw.matter)
    &&Number.isInteger(raw.podSlots)&&raw.podSlots>=12&&raw.podSlots<=44
    &&Array.isArray(raw.unlocks)&&raw.unlocks.length>0&&raw.unlocks.every(t=>typeof t==='string'&&Object.hasOwn(droneTypes,t))
    &&Object.values(raw.captured).every(v=>typeof v==='boolean')
    &&Object.values(raw.stars).every(v=>Number.isInteger(v)&&v>=0&&v<=3)
    &&Object.values(raw.bestTime).every(nonnegative)&&Object.values(raw.achievements).every(nonnegative)
    &&Object.keys(createProgress().stats).every(k=>nonnegative(raw.stats[k]))
    &&(raw.version!==PROGRESS_VERSION||object(raw.settledMissions));
}

export function inspectCampaignSave(raw){
  const base={raw,progress:createProgress(),activeMission:null,status:'ready',issue:null,needsBackup:false};
  if(raw===null)return {...base,status:'empty'};
  const fail=(kind,message,progress=null)=>({...base,progress:progress||base.progress,status:'recovery',needsBackup:true,
    issue:{kind,message,canKeepCampaign:!!progress}});
  let parsed;
  try{if(typeof raw!=='string')throw new Error();parsed=JSON.parse(raw);}catch{
    return fail('invalid-json','The saved file could not be read. Its original contents are protected. Download a copy before choosing how to continue.');
  }
  if(!object(parsed)||!versions.includes(parsed.version))
    return fail('unsupported-progress','This campaign save uses a format this build cannot open. The original is protected; use its original or a compatible newer build, or download a copy before starting fresh.');
  const progress=validProgress(parsed);
  if(!campaignShape(parsed))
    return fail('damaged-progress','Some campaign data is incomplete or damaged. You can download the original and recover the readable campaign data, or keep it untouched.',progress);
  const state={...base,progress,needsBackup:parsed.version!==PROGRESS_VERSION};
  if(parsed.activeMission===null||parsed.activeMission===undefined)return state;
  if(!object(parsed.activeMission)||!missionVersions.includes(parsed.activeMission.version))
    return fail('unsupported-mission','The campaign can be read, but its saved battle uses an unsupported format. Download the original or recover the campaign without that battle.',progress);
  const activeMission=validMissionCheckpoint(parsed.activeMission);
  if(!activeMission)return fail('damaged-mission','The campaign can be read, but its saved battle contains incomplete or inconsistent data. Download the original or recover the campaign without that battle.',progress);
  if(Object.hasOwn(progress.settledMissions,activeMission.battle.missionId))
    return {...state,needsBackup:true}; // Already awarded: never replay a finished mission.
  return {...state,activeMission,needsBackup:state.needsBackup||parsed.activeMission.version!==MISSION_SAVE_VERSION};
}

export function readCampaignSave(storageAccess){
  try{return inspectCampaignSave(storageAccess().getItem(SAVE_KEY));}catch{
    return {raw:null,progress:createProgress(),activeMission:null,status:'unavailable',needsBackup:false,
      issue:{kind:'unavailable',canKeepCampaign:false,message:'Browser storage is unavailable. Your saved data could not be read. Retry access, or play a temporary campaign without saving.'}};
  }
}

function backupOriginal(storage,raw){
  let hash=2166136261;
  for(let i=0;i<raw.length;i++)hash=Math.imul(hash^raw.charCodeAt(i),16777619)>>>0;
  // Verify contents, not just the hash: collisions get another key; no backup is overwritten.
  for(let i=0;i<100;i++){
    const key=recoveryBackupPrefix+hash.toString(16)+'-'+raw.length+(i?'-'+i:'');
    const existing=storage.getItem(key);
    if(existing===raw)return key;
    if(existing!==null)continue;
    storage.setItem(key,raw);
    if(storage.getItem(key)!==raw)throw new Error('Backup was not retained');
    return key;
  }
  throw new Error('No free backup key');
}

export function writeCampaignSave(storageAccess,progress,activeMission,state,{resolve=false}={}){
  if(!state||state.status==='recovery'&&!resolve)return {ok:false,reason:'protected'};
  if(state.status==='unavailable')return {ok:false,reason:'unavailable'};
  let raw,candidate,storage,backupKey=null;
  try{
    raw=JSON.stringify({...progress,activeMission});candidate=inspectCampaignSave(raw);
    if(candidate.status!=='ready')return {ok:false,reason:'invalid'};
    storage=storageAccess();
    if(storage.getItem(SAVE_KEY)!==state.raw)return {ok:false,reason:'changed'};
  }catch{return {ok:false,reason:'unavailable'};}
  if(state.needsBackup&&state.raw!==null){
    try{backupKey=backupOriginal(storage,state.raw);}catch{return {ok:false,reason:'backup'};}
  }
  // Recheck after the backup, before the single campaign/checkpoint write.
  try{if(storage.getItem(SAVE_KEY)!==state.raw)return {ok:false,reason:'changed'};}catch{return {ok:false,reason:'unavailable'};}
  if(!saveCampaignEnvelope(storage,progress,activeMission))return {ok:false,reason:'write',backupKey};
  return {ok:true,state:{...candidate,needsBackup:false},backupKey};
}

export function recoveryFailureMessage(reason){
  return ({protected:'The original save is protected. Review its recovery options first.',
    backup:'A backup could not be stored. The original was not replaced. Download a copy, free browser storage and retry.',
    changed:'The saved file changed in another tab. It was not overwritten. Download this session before reloading saved data.',
    unavailable:'Browser storage could not be accessed. Keep this page open and retry.',
    invalid:'The current session could not be saved safely. Download it before leaving.',
    write:'The new save could not be written. The previous saved file is retained; keep this page open and retry.'})[reason]||'The save could not be updated.';
}

export function listRecoveryBackups(storageAccess){
  try{
    const storage=storageAccess(),copies=[];
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);
      if(key?.startsWith(recoveryBackupPrefix)){
        const raw=storage.getItem(key);if(raw!==null)copies.push({key,raw});
      }
    }
    return copies.sort((a,b)=>a.key.localeCompare(b.key));
  }catch{return [];}
}
