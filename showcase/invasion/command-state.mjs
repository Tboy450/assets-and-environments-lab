// Optional command UI metadata. It can restore intent, never issue an order or purchase.
import { droneOrder } from './units.mjs?v=dev';

export const COMMAND_STATE_VERSION = 1;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function restoreCommandState(value,battle){
  const empty={version:COMMAND_STATE_VERSION,selected:[],payload:null,dropPanelOpen:false};
  if(!object(value)||value.version!==COMMAND_STATE_VERSION)return empty;
  const active=new Set(battle.units.filter(u=>u.alive&&u.side==='swarm'&&!u.structure).map(u=>u.squad));
  for(const pod of battle.pods)if(!pod.released)active.add(pod.squad);
  const existing=new Set(battle.squads.map(s=>s.id));
  const selected=Array.isArray(value.selected)&&value.selected.length<=5000
    ?[...new Set(value.selected.filter(id=>Number.isSafeInteger(id)&&existing.has(id)&&active.has(id)))]:[];
  let payload=null;
  if(object(value.payload)){
    payload={};
    for(const type of droneOrder){
      const count=value.payload[type];
      if(battle.unlocks.includes(type)&&Object.hasOwn(value.payload,type)&&Number.isInteger(count)&&count>=0&&count<=44)payload[type]=count;
    }
  }
  return {version:COMMAND_STATE_VERSION,selected,payload,dropPanelOpen:value.dropPanelOpen===true};
}

export function commandCheckpoint(mission){
  return restoreCommandState({version:COMMAND_STATE_VERSION,
    selected:mission.selected?Array.from(mission.selected):[],
    payload:mission.payload,dropPanelOpen:mission.dropPanelOpen},mission.battle);
}
