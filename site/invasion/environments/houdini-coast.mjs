import { createCityFoundation as createPreferredCoast } from './history/contour-v2.mjs';

// Evaluated Houdini geometry replaces the old ground and per-building supports.
export function createHoudiniCoast(footprint, anchors, terrain) {
  if (!terrain) throw new Error('Houdini coastal terrain is missing');
  const group = createPreferredCoast(footprint, anchors);
  const water = group.getObjectByName('Coastal ocean');
  for (const child of [...group.children]) if (child !== water) group.remove(child);
  group.add(terrain);
  group.name = 'Houdini fitted coastal landscape';
  group.userData = {authoringTool:'Houdini 22.0.466 Apprentice',seaElevation:group.userData.seaElevation,animate:group.userData.animate};
  return group;
}
