// Original procedural starter assets for this local lab, separate from imported artwork.
import * as THREE from '/vendor/three/three.module.min.js';
export function sampleModel(name){
  const root=new THREE.Group();const teal=new THREE.MeshStandardMaterial({color:0x539d91,metalness:.4,roughness:.45}),dark=new THREE.MeshStandardMaterial({color:0x233642,metalness:.5,roughness:.5}),gold=new THREE.MeshStandardMaterial({color:0xe8b96a,metalness:.6,roughness:.3});
  const box=(size,at,mat=teal)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...at);root.add(m);return m;};
  if(name==='outpost'){
    box([11,.5,8],[0,0,0],dark);box([5,3,4],[-1,1.7,0]);box([5.6,.25,4.6],[-1,3.35,0],gold);box([2,1.5,2],[3,1,0],dark);
    for(const x of [-2.4,-.8,.8])box([.8,.75,.08],[x,2,2.05],gold);
    box([.2,6,.2],[-4,3,2],gold);const dish=new THREE.Mesh(new THREE.ConeGeometry(1,.5,32,1,true),teal);dish.rotation.z=Math.PI*.65;dish.position.set(-4,5.6,2);root.add(dish);
  }else if(name==='hover-scout'){
    box([3,.8,2],[0,1,0]);box([1,.4,.6],[0,1,-1.2],gold);
    for(const x of [-2,2])for(const z of [-1.5,1.5]){box([.25,.2,3],[x*.65,1,z*.5],dark);const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.1,8,36),gold);ring.rotation.x=Math.PI/2;ring.position.set(x,1,z);root.add(ring);box([1.7,.05,.12],[x,1,z],dark);}
    box([.2,1.5,2.5],[-1,.1,0],dark);box([.2,1.5,2.5],[1,.1,0],dark);
  }else{
    box([10,.4,10],[0,0,0],dark);for(let i=0;i<7;i++){const a=i*Math.PI*2/7,r=3;box([1.1,1.5+i*.6,1.1],[Math.cos(a)*r,.95+i*.3,Math.sin(a)*r],i%2?teal:gold);}
    const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(1.15,1),new THREE.MeshStandardMaterial({color:0x92e6d5,emissive:0x163f35,metalness:.6,roughness:.25}));orb.position.y=3;root.add(orb);
  }
  return root;
}
