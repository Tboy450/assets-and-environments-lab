import * as THREE from "../../vendor/three/three.module.min.js?v=dev";

const urban = (id, name, file, description) => ({id, name, category:'Urban architecture',
  url:`./assets/downtown/${file}.gltf`, description, creator:'Quaternius', license:'CC0 1.0',
  source:'https://quaternius.itch.io/downtown-city-megakit'});
const fantasy = (id, name, file) => ({id, name, category:'Fantasy architecture',
  url:`./assets/fantasy/${file}.glb`, description:'An individual Fantasy Town Kit piece. Orbit to inspect its shape, material and connection edges.',
  creator:'Kenney', license:'CC0 1.0', source:'https://kenney.nl/assets/fantasy-town-kit'});
const drone = (id, name, description) => ({id:`drone-${id}`, name, drone:id, category:'Swarmfall drones',
  description, creator:'Swarmfall', license:'Original game asset', source:'https://github.com/Tboy450/dragonfly-titan-gcs-demo'});

export const assetCatalog = Object.freeze([
  drone('scout','Scout drone','The light reconnaissance drone. Compare its original hull with the first hull/sensor polish pass; art review is still pending.'),
  drone('link','Link drone','The control-path drone used to capture zones and turn defenses.'),
  drone('striker','Striker drone','The assault drone used in the Swarmfall campaign.'),
  drone('breacher','Breacher drone','The heavy structure-attack drone, shown separately from a battle.'),
  urban('building-large','Large downtown building','Building_Large_2','Textured urban building from Downtown City MegaKit Standard.'),
  urban('building-medium','Medium downtown building','Building_Medium_2_001','A complete medium-height building for urban districts.'),
  urban('building-small','Small downtown building','Building_Small_1','A smaller complete building for street-level composition.'),
  urban('air-conditioning','Rooftop air conditioner','Prop_ACUnit','A reusable rooftop detail from the urban kit.'),
  urban('planter','Street planter','Prop_Planter_Single','A small street and plaza dressing asset.'),
  fantasy('timber-wall','Timber wall','wall-wood'),
  fantasy('timber-door','Timber doorway','wall-wood-door'),
  fantasy('timber-window','Timber shuttered window','wall-wood-window-shutters'),
  fantasy('roof-high','High roof','roof-high'),
  fantasy('roof-gable','High gable roof','roof-high-gable'),
  fantasy('roof-point','Pointed roof','roof-high-point'),
  fantasy('fountain','Detailed round fountain','fountain-round-detail'),
  fantasy('banner','Green banner','banner-green'),
  fantasy('tree','Fantasy tree','tree-high'),
].map(Object.freeze));

export const assetById = id => assetCatalog.find(asset => asset.id === id) || null;

// Fit to an inspection stand; this does not claim verified physical dimensions.
export function createAssetDisplay(root, entry) {
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const span=Math.max(size.x,size.y,size.z);
  if(!Number.isFinite(span)||span<=0)throw new Error('Asset has no finite visible geometry');
  const normalized=new THREE.Group(),scale=100/span;
  normalized.name='Inspection asset';normalized.scale.setScalar(scale);
  normalized.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);normalized.add(root);
  const group=new THREE.Group();group.add(normalized);
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(82,85,2,96),new THREE.MeshStandardMaterial({color:0x253d4a,roughness:.85,metalness:.2}));
  floor.position.y=-1;floor.receiveShadow=true;floor.userData.damageProtected=true;group.add(floor);
  const grid=new THREE.GridHelper(160,16,0x6f9b9f,0x3d5c68);grid.position.y=.05;grid.material.transparent=true;grid.material.opacity=.45;group.add(grid);
  root.traverse(object=>{if(object.isMesh){object.castShadow=object.receiveShadow=true;}});
  group.userData.asset={id:entry.id,sourceSize:size.toArray(),displayScale:scale};
  return {group,moving:[],target:new THREE.Vector3(0,size.y*scale*.45,0),asset:true};
}

export async function loadAssetDisplay(entry, loader, { scoutVersion = 'polished' } = {}) {
  let root;
  if(entry.drone){
    let model;
    if(entry.drone==='scout'&&scoutVersion==='original'){
      const {originalScoutModel}=await import('./history/scout-original.mjs?v=dev');
      model=originalScoutModel();
    }else{
      const {droneModels}=await import('../models.mjs?v=dev'),models=droneModels();
      model=models[entry.drone];
      for(const other of Object.values(models))if(other!==model){other.body.dispose();other.glow.dispose();}
    }
    root=new THREE.Group();
    root.add(new THREE.Mesh(model.body,new THREE.MeshStandardMaterial({vertexColors:true,metalness:.45,roughness:.45})),
      new THREE.Mesh(model.glow,new THREE.MeshBasicMaterial({vertexColors:true})));
    const material=new THREE.MeshStandardMaterial({color:0x93b6c7,transparent:true,opacity:.23,side:THREE.DoubleSide});
    for(const [x,y,z,r] of model.rotors){const disc=new THREE.Mesh(new THREE.CircleGeometry(r,24).rotateX(-Math.PI/2),material);disc.position.set(x,y,z);root.add(disc);}
  }else root=(await loader.loadAsync(entry.url)).scene;
  const display=createAssetDisplay(root,entry);
  if(entry.drone==='scout')display.group.userData.asset.version=scoutVersion==='original'?'original':'polished';
  return display;
}
