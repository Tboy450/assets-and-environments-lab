// Collections are views of the same catalog entries; files keep their provenance.
export function inCollection(asset,projectId){
  if(!projectId||projectId==='all-local'||asset.projectId===projectId)return true;
  return projectId==='blender'&&asset.projectId==='shared'&&
    (asset.kind==='model'||/^(blend\d*|fbx|obj)$/.test(asset.format||''));
}
