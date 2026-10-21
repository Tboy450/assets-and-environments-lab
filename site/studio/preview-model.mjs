import {GLTFLoader} from '/vendor/three/addons/loaders/GLTFLoader.js';
import {LoadingManager} from '/vendor/three/three.module.min.js';
import {assetCatalog,loadAssetDisplay,createAssetDisplay} from '/invasion/environments/asset-viewer.mjs?v=dev';
export async function previewModel(asset){
  const manager=new LoadingManager();manager.setURLModifier(value=>{if(value.startsWith('data:')||value.startsWith('blob:'))return value;const url=new URL(value,location.href);if(url.origin!==location.origin)throw new Error('Include model dependencies locally');return url.href;});
  const loader=new GLTFLoader(manager);
  if(asset.kind==='bundled'){
    const entry=assetCatalog.find(row=>'swarmfall-'+row.id===asset.id);if(!entry)throw new Error('Bundled model is unavailable');
    const fixed={...entry,url:entry.url?new URL(entry.url,location.origin+'/invasion/environments/').href:null};
    return loadAssetDisplay(fixed,loader);
  }
  let root;
  if(asset.kind==='terrain'){const {terrainModel}=await import('./terrain-model.mjs');root=await terrainModel(asset.terrain);}
  else if(asset.kind==='dragonfly'){const {dragonflyModel}=await import('./dragonfly-model.mjs');root=dragonflyModel(asset.dragonflyPart);}
  else if(asset.kind==='sample'){const {sampleModel}=await import('./samples.mjs');root=sampleModel(asset.sample);}
  else root=(await loader.loadAsync(asset.url)).scene;
  return createAssetDisplay(root,asset);
}
