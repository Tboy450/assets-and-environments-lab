// Historical save key "destroyType" has always counted conversion as well as destruction.
// Preserve that contract while describing the hostile-defense goal consistently everywhere.
import { defenderTypes } from './units.mjs?v=dev';

export function objectiveText(objective){
  if(objective.kind==='destroyType'&&Object.hasOwn(defenderTypes,objective.type))
    return `Neutralize every ${defenderTypes[objective.type].name.toLowerCase()} (destroy or capture)`;
  return objective.text;
}
