// Collections are views of the same catalog entries; files keep their provenance.
export function inCollection(asset,projectId){
  if(!projectId||projectId==='all-local'||asset.projectId===projectId)return true;
  return projectId==='blender'&&asset.projectId==='shared'&&
    (asset.kind==='model'||/^(blend\d*|fbx|obj)$/.test(asset.format||''));
}
// Swarmfall bundles byte-identical copies of a few archived kit models under friendlier names.
// "All collections" lists each file once and keeps the archived original, which carries the download
// and license; the Swarmfall collection still shows its own named copies.
export function collectionAssets(assets,projectId){
  const listed=assets.filter(a=>inCollection(a,projectId));
  if(projectId!=='all-local')return listed; // An unfiltered fetch keeps every entry for per-collection views.
  const archived=new Set(listed.filter(a=>a.projectId==='shared'&&a.kind==='model').map(a=>(a.filename||'').toLowerCase()));
  return listed.filter(a=>!(a.projectId==='swarmfall'&&a.kind==='bundled'&&archived.has((a.filename||'').toLowerCase())));
}
