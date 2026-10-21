import * as THREE from '/vendor/three/three.module.min.js';
import {buildResearchModel} from '/vehicle-research.mjs?v=dev';
export function dragonflyModel(part='all'){
  const root=new THREE.Group();let target=root;
  const metal=new THREE.MeshStandardMaterial({color:0x909b9e,metalness:.58,roughness:.4});
  const deck=new THREE.MeshStandardMaterial({color:0x343e43,metalness:.38,roughness:.55});
  const gold=new THREE.MeshStandardMaterial({color:0xc79e47,metalness:.55,roughness:.42});
  function mesh(geometry,material,position,parent=target){const object=new THREE.Mesh(geometry,material);object.position.set(...position);parent.add(object);return object;}
  function strut(from,to,radius=.026,material=metal){const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),direction=b.clone().sub(a);const object=mesh(new THREE.CylinderGeometry(radius,radius,direction.length(),10),material,a.add(b).multiplyScalar(.5).toArray());object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return object;}
  const built=buildResearchModel({group:root,mesh,strut,metal,deck,gold,upAxis:new THREE.Vector3(0,1,0),setTarget:group=>{target=group||root;}});
  for(const name of ['airflow','sample-flow'])if(built.subsystems[name])built.subsystems[name].visible=false;
  if(part==='all')return root;
  const selected=built.subsystems[part];if(!selected)throw new Error('Dragonfly component is unavailable');
  root.updateMatrixWorld(true);const transform=selected.matrixWorld.clone();selected.removeFromParent();selected.applyMatrix4(transform);selected.visible=true;return selected;
}
