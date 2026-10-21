// Original, deterministic visual studies [EST]. These are not campaign city/navigation data.
import * as THREE from "../../vendor/three/three.module.min.js";
import { createCityFoundation } from "./history/contour-v2.mjs?v=dev";

export const worldInfo = {
  cyberpunk: { title:"Skyway megacity",description:"The complete Cyberpunk City architecture on contoured coastal land, with individual footings, access roads and ocean shoreline. Explore the layered streets and elevated infrastructure.",span:"2 km normalized source-city span",credit:"cyberpunk City by carlcapu333, BlendSwap 21664 (legacy 91935), CC-BY 3.0. Converted by Codex; new PBR materials, scale and batching. Coastal foundation, ramps, terrain and water are original visual additions; source scene preserved.",sky:[0x1c3450,0xa0b5bc],ground:0x40525c,sun:0xffdfba,views:{vista:[[1600,1000,1750],[0,220,0]],district:[[500,320,560],[0,200,0]],street:[[160,100,200],[0,100,0]]} },
  drone: { title:"Phototextured city",description:"The complete drone City Blender scene with packed photographic facades, roof detail and connected streets. Compare its aerial coverage and close-view texture quality against the modular metropolis.",span:"2 km normalized source-city span",credit:"drone City by Voxelatio, BlendSwap 27360, CC0. Blender-to-glTF conversion, texture cap at 1024 px, normalized scale and render batching by Codex. Animation omitted; original scene retained.",sky:[0x648ca5,0xcbd3cd],ground:0x697773,sun:0xffe9c9,views:{vista:[[1550,950,1650],[0,100,0]],district:[[460,250,500],[0,80,0]],street:[[100,35,160],[0,40,0]]} },
  alien: { title: "Alien arcology", description: "A radial off-world city: ceramic towers, suspended transit rings and luminous canals. Follow the bridges into its monumental central district.", span: "2.4 km city diameter", credit: "Original procedural architecture by Codex. No proprietary game geometry or paid assets. Space/alien source scenes remain separately preserved for future conversion.", sky: [0x101c39,0x889fa8], ground: 0x253e49, sun:0xf6d5b4, views: { vista:[[1540,940,1680],[0,190,0]], district:[[520,270,610],[0,180,0]], street:[[205,28,235],[0,95,0]] } },
  metropolis: { title: "Metropolis", description: "A broad city of connected avenues, textured brick districts, a riverside promenade and a tall financial core. Inspect both the skyline and the imported street-level architecture.", span: "2.2 × 2.2 km urban grid", credit: "Selected Downtown City MegaKit Standard buildings by Quaternius (CC0), with reduced texture resolution. Original district layout, roads, skyline and waterfront.", sky:[0x537f9b,0xd0d6c3], ground:0x778277,sun:0xffebce,views:{vista:[[1320,800,1450],[0,75,0]],district:[[270,115,350],[0,40,0]],street:[[70,7,125],[70,15,-90]]} },
  citadel: { title:"Tidal citadel",description:"A fantasy city built above an alien sea: layered stone terraces, sweeping green spires, inhabited lower districts, hanging bridges and waterfalls.",span:"1.8 km island & bridge district",credit:"Selected Fantasy Town Kit pieces by Kenney (CC0). Original citadel, curved roofs, terraces, bridges, cliffs and planetary setting; a stylized study, not a Synty or Skyrim asset.",sky:[0x284f68,0xc1ced2],ground:0x4b6564,sun:0xffdfb0,views:{vista:[[1210,780,1380],[0,120,0]],district:[[410,265,500],[0,175,0]],street:[[170,113,270],[0,190,0]]} }
};

const materials = new Map(), geometries = new Map();
const dummy = new THREE.Object3D();
export function rng(seed=521){let s=seed;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};}
function mat(color,metalness=0,roughness=.7,glow=0){const key=[color,metalness,roughness,glow].join('/');if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,metalness,roughness,emissive:glow?color:0,emissiveIntensity:glow}));return materials.get(key);}
const box=()=>geo('box',()=>new THREE.BoxGeometry(1,1,1));
const cyl=(segments=32)=>geo('cyl'+segments,()=>new THREE.CylinderGeometry(1,1,1,segments));
const cone=()=>geo('cone',()=>new THREE.ConeGeometry(1,1,32));
function geo(key,create){if(!geometries.has(key))geometries.set(key,create());return geometries.get(key);}
function lathe(key,points){return geo(key,()=>new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),32));}
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

// Batch shared meshes and imported primitives. Geometry/material transforms are preserved.
export class Batches {
  constructor(group){this.group=group;this.batches=new Map();this.instances=0;this.protected=false;}
  add(g,m,x,y,z,sx=1,sy=sx,sz=sx,ry=0,rx=0,rz=0,local=null){dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();const matrix=dummy.matrix.clone();if(local)matrix.multiply(local);const key=g.uuid+'/'+m.uuid+'/'+this.protected;if(!this.batches.has(key))this.batches.set(key,{g,m,matrices:[],protected:this.protected});this.batches.get(key).matrices.push(matrix);this.instances++;}
  model(root,x,y,z,scale=1,rotation=0){root.traverse(o=>{if(o.isMesh){this.add(o.geometry,o.material,x,y,z,scale,scale,scale,rotation,0,0,o.matrixWorld);}});}
  finish(){for(const {g,m,matrices,protected:keep} of this.batches.values()){const mesh=new THREE.InstancedMesh(g,m,matrices.length);matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.userData.damageProtected=keep;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.group.add(mesh);}return this.instances;}
}

function mesh(group,g,m,x,y,z,sx=1,sy=sx,sz=sx,ry=0,rx=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.set(rx,ry,0);o.receiveShadow=true;o.castShadow=true;group.add(o);return o;}
function ring(batch,r,width,y,material,x=0,z=0){batch.add(geo(`ring${r}/${width}`,()=>new THREE.RingGeometry(r-width/2,r+width/2,128)),material,x,y,z,1,1,1,0,-Math.PI/2);}
function tube(group,points,radius,material,segments=48){return mesh(group,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,radius,6,false),material,0,0,0);}
function archBridge(group,batch,a,b,y,width=10,stone=mat(0x9daaad)){const mid=a.clone().lerp(b,.5);mid.y=y+28;const points=[V(a.x,y,a.z),mid,V(b.x,y,b.z)];tube(group,points,width/2,stone);for(const side of [-1,1]){const normal=V(b.z-a.z,0,a.x-b.x).normalize().multiplyScalar(width*.48);tube(group,points.map(p=>p.clone().add(normal).add(V(0,4,0))),.45,mat(0xc6d8cf,.4));}for(let i=1;i<6;i++){const p=a.clone().lerp(b,i/6);const h=y+Math.sin(i/6*Math.PI)*28;batch.add(cyl(12),stone,p.x,h*.5,p.z,2,h,2);}}
function terrain(group,batch,type){const random=rng(31);const water=type==='citadel';const floor=mesh(group,cyl(128),mat(water?0x386a7c:worldInfo[type].ground,.12,water?.3:.94),0,-10,0,3400,14,3400);floor.userData.damageProtected=true;batch.protected=true;for(let i=0;i<65;i++){const a=random()*Math.PI*2,r=1700+random()*1600,h=70+random()*400;batch.add(geo('rock',()=>new THREE.IcosahedronGeometry(1,1)),mat(type==='alien'?0x3c4c61:0x71807b),Math.cos(a)*r,h*.25-15,Math.sin(a)*r,80+random()*220,h,80+random()*150,random()*6);}batch.protected=false;}
function beacon(batch,x,y,z,color=0x91f6cf){batch.add(cyl(12),mat(0x293d4a,.5),x,y+8,z,.5,16,.5);batch.add(geo('beacon',()=>new THREE.SphereGeometry(1,10,8)),mat(color,.1,.3,1.5),x,y+16,z,1.4);}
function landing(batch,x,y,z,r=22){ring(batch,r,1,y+.2,mat(0xb1efbe,.1,.6,.5),x,z);batch.add(box(),mat(0xb1efbe,.1,.6,.5),x,y+.25,z,16,.15,2);batch.add(box(),mat(0xb1efbe,.1,.6,.5),x,y+.25,z,2,.15,16);}

function alien(group,batch){const random=rng(611),ceramic=mat(0x9cafba,.35,.4),dark=mat(0x223849,.6,.35),accent=mat(0x8ae6cf,.4,.3,.6),gold=mat(0xb89466,.6,.4);terrain(group,batch,'alien');
  for(const [r,w] of [[170,70],[320,35],[490,80],[660,42],[840,100],[1070,25]]){ring(batch,r,w,0,mat(0x415766,.25));ring(batch,r-w/2,4,.3,accent);}
  const body=lathe('alien-body',[[.86,0],[1,.04],[.9,.16],[.55,.48],[.4,.75],[.7,.86],[.45,.94],[.12,1]]),core=lathe('alien-core',[[.4,0],[.65,.1],[.32,.65],[.2,.95],[0,1.04]]);
  function tower(x,z,height,radius,base=0){batch.add(body,ceramic,x,base,z,radius,height,radius);batch.add(core,dark,x,base,z,radius*1.08,height*1.1,radius*1.08);for(const f of [.17,.56,.86]){batch.add(geo('torus',()=>new THREE.TorusGeometry(1,.025,6,48)),accent,x,base+height*f,z,radius*(f===.17?.9:f===.56?.5:.68),radius*(f===.17?.9:f===.56?.5:.68),radius*(f===.17?.9:f===.56?.5:.68),0,Math.PI/2);}for(let k=0;k<6;k++){const a=k*Math.PI/3;batch.add(cone(),gold,x+Math.cos(a)*radius*.6,base+height*.91,z+Math.sin(a)*radius*.6,radius*.13,height*.38,radius*.13);}beacon(batch,x,base+height*1.1,z);}
  for(const [r,n] of [[260,12],[440,20],[650,28],[900,36]])for(let i=0;i<n;i++){const a=i/n*Math.PI*2+(r===440?.08:0),h=80+random()*185;tower(Math.cos(a)*r,Math.sin(a)*r,h,22+random()*17);}
  batch.add(cyl(96),dark,0,14,0,145,28,145);tower(0,0,490,92,28);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;const x=Math.cos(a)*125,z=Math.sin(a)*125;tower(x,z,195,28,0);tube(group,[V(x,85,z),V(x*.6,260,z*.6),V(0,410,0)],6,ceramic,32);}
  for(const [r,h] of [[320,72],[580,102]]){ring(batch,r,14,h,dark);ring(batch,r+6,1,h+2,accent);ring(batch,r-6,1,h+2,accent);for(let i=0;i<20;i++){const a=i/20*Math.PI*2;batch.add(cyl(12),ceramic,Math.cos(a)*r,h*.5,Math.sin(a)*r,3,h,3);}}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;archBridge(group,batch,V(Math.cos(a)*180,0,Math.sin(a)*180),V(Math.cos(a)*580,0,Math.sin(a)*580),72,10,dark);for(let j=0;j<8;j++){const r=180+j*95;beacon(batch,Math.cos(a)*r,0,Math.sin(a)*r);}}
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;batch.add(cyl(24),dark,Math.cos(a)*1100,5,Math.sin(a)*1100,45,10,45);landing(batch,Math.cos(a)*1100,10,Math.sin(a)*1100);}
  return {moving:[],target:V(0,160,0)};
}

function windowMaterial(){if(materials.has('windows'))return materials.get('windows');const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const c=canvas.getContext('2d'),random=rng(111);c.fillStyle='#496170';c.fillRect(0,0,256,512);for(let y=0;y<24;y++)for(let x=0;x<6;x++){c.fillStyle=random()>.75?'#a5b4b3':'#203c4b';c.fillRect(x*42+5,y*21+3,31,14);c.fillStyle='#7994a0';c.fillRect(x*42+5,y*21+3,31,1);c.fillStyle='#324955';c.fillRect(x*42+20,y*21+3,1,14);}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.MeshStandardMaterial({color:0xcbd9df,map:texture,roughness:.5,metalness:.35});materials.set('windows',m);return m;}
function metropolis(group,batch,assets){const random=rng(134),road=mat(0x333e44),curb=mat(0xb0b5ac),lines=mat(0xd5d3b7),windows=windowMaterial();terrain(group,batch,'metropolis');
  mesh(group,box(),mat(0x596b60),0,-.6,0,2240,1,2240);
  for(let i=-8;i<=8;i++){const v=i*140-70;batch.add(box(),road,v,.05,0,24,.2,2240);batch.add(box(),road,0,.06,v,2240,.2,24);for(let j=-32;j<=32;j++){batch.add(box(),lines,v,.18,j*34,1,.04,10);batch.add(box(),lines,j*34,.19,v,10,.04,1);}}
  const imported=[assets.Building_Large_2,assets.Building_Medium_2_001,assets.Building_Small_1];let nearCount=0;
  for(let ix=-7;ix<=7;ix++)for(let iz=-7;iz<=7;iz++){
    const x=ix*140,z=iz*140;if(Math.abs(ix)<=1&&Math.abs(iz)<=1)continue;
    batch.add(box(),curb,x,.25,z,112,.5,112);
    for(const dx of [-27,27])for(const dz of [-26,26]){const bx=x+dx,bz=z+dz,h=22+random()*48+(Math.abs(ix)<4&&Math.abs(iz)<4?random()*150:0);const near=Math.abs(ix)<=3&&iz>=-1&&iz<=3;
      if(near&&nearCount<76){const model=imported[Math.floor(random()*3)];batch.model(model,bx,.5,bz,1.65,Math.floor(random()*4)*Math.PI/2);nearCount++;if(assets.Prop_ACUnit)batch.model(assets.Prop_ACUnit,bx,h,bz,1.5);}
      else {batch.add(box(),windows,bx,h/2+.5,bz,27+random()*12,h,29+random()*9);batch.add(box(),mat(0x83979f,.4),bx,h+1.6,bz,29,3,30);if(h>95){batch.add(box(),windows,bx,h+18,bz,20,34,21);batch.add(cone(),mat(0x667f8c,.5),bx,h+43,bz,13,18,13);}}
    }
  }
  // Central civic park and two distinct landmark silhouettes, leaving streets open.
  batch.add(box(),mat(0x637c58),0,.2,0,340,.4,340);ring(batch,78,10,.6,curb);mesh(group,cyl(64),mat(0x457f8f,.5,.2),0,.8,0,62,1,62);for(let i=0;i<40;i++){const a=i/40*Math.PI*2;tree(batch,Math.cos(a)*140,.6,Math.sin(a)*140,8+random()*5);}
  batch.add(cyl(32),mat(0x4c7284,.6,.3),0,110,-240,39,220,39);batch.add(cyl(32),mat(0xa9b8b8,.5),0,230,-240,31,20,31);batch.add(cone(),mat(0x4c7284,.5),0,263,-240,31,48,31);batch.add(cyl(8),mat(0xb8cdd2,.6),0,310,-240,1,50,1);
  for(const s of [-1,1]){batch.add(box(),windows,s*110,117,-250,40,234,45);batch.add(box(),mat(0xb5c1bf,.5),s*110,240,-250,44,12,48);}archBridge(group,batch,V(-110,0,-250),V(110,0,-250),180,12,mat(0xa3b4b9,.5));
  // Waterfront edge beyond the street grid, piers and tree-lined public space.
  mesh(group,box(),mat(0x477c90,.35,.22),1330,-1,0,350,2,2600);for(let i=-10;i<=10;i++){batch.add(box(),curb,1145,1,i*110,30,2,90);tree(batch,1145,2,i*110,10);if(i%3===0)batch.add(box(),mat(0x657b7e),1240,2,i*110,180,4,18);}
  for(let i=0;i<70;i++){const x=(Math.floor(random()*15)-7)*140+random()*80-40,z=(Math.floor(random()*15)-7)*140+55;tree(batch,x,.5,z,7+random()*4);}
  landing(batch,0,1,135,20);return {moving:[],target:V(0,55,0),importedBuildings:nearCount};
}

function tree(batch,x,y,z,height){batch.add(cyl(8),mat(0x6a6250),x,y+height*.3,z,.7,height*.6,.7);batch.add(geo('leaves',()=>new THREE.IcosahedronGeometry(1,1)),mat(0x59765a),x,y+height*.8,z,height*.4,height*.55,height*.4);}
function citadel(group,batch,assets){const random=rng(572),stone=mat(0xbdc9c2,.15),roof=mat(0x397a7b,.45,.4),gold=mat(0xc6b67d,.6),dark=mat(0x687d7a),glow=mat(0x99e8dc,.3,.25,.4);terrain(group,batch,'citadel');
  const cliff=geo('cliff',()=>new THREE.CylinderGeometry(1,.76,1,64,5));batch.protected=true;for(const [r,y,h] of [[680,20,75],[490,65,105],[310,118,155],[130,185,210]]){batch.add(cliff,dark,0,y,0,r,h,r);batch.add(cyl(96),stone,0,y+h/2,0,r+5,5,r+5);ring(batch,r-5,5,y+h/2+3,gold);for(let i=0;i<36;i++){const a=i/36*Math.PI*2;batch.add(box(),stone,Math.cos(a)*r,y+h*.1,Math.sin(a)*r,5,h*.8,10,a);}}batch.protected=false;
  const spire=lathe('sweeping-roof',[[1,0],[.9,.08],[.6,.16],[.45,.35],[.2,.72],[.03,1]]),column=lathe('citadel-tower',[[1,0],[.9,.12],[.7,.18],[.7,.87],[1,.94],[1,1]]);
  function turret(x,y,z,h,r){batch.add(column,stone,x,y,z,r,h,r);batch.add(spire,roof,x,y+h,z,r*1.5,h*.7,r*1.5);batch.add(cone(),gold,x,y+h*1.75,z,r*.11,h*.15,r*.11);for(let i=0;i<7;i++){const a=i/7*Math.PI*2;batch.add(box(),glow,x+Math.cos(a)*r*.72,y+h*.7,z+Math.sin(a)*r*.72,r*.3,h*.22,.4,-a);}}
  turret(0,292,0,160,42);for(let i=0;i<8;i++){const a=i/8*Math.PI*2;turret(Math.cos(a)*106,292,Math.sin(a)*106,70+(i%2)*35,17);const a2=a+.3;turret(Math.cos(a2)*270,198,Math.sin(a2)*270,60,15);}
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2;turret(Math.cos(a)*470,120,Math.sin(a)*470,30+random()*35,12);}
  function house(x,y,z,angle){const s=4;for(let side=0;side<4;side++){const a=angle+side*Math.PI/2;for(const offset of [-2,2]){const px=x+Math.sin(a)*4+Math.cos(a)*offset,pz=z+Math.cos(a)*4-Math.sin(a)*offset;batch.model(assets['wall-wood-window-shutters'],px,y,pz,s,a);batch.model(assets['wall-wood-window-shutters'],px,y+4,pz,s,a);}}batch.add(spire,roof,x,y+8,z,7,9,7,angle+Math.PI/4);}
  for(const [r,n,y] of [[580,65,60],[390,42,120],[215,24,198]]){for(let i=0;i<n;i++){const a=i/n*Math.PI*2;house(Math.cos(a)*r,y,Math.sin(a)*r,-a);if(i%4===0)tree(batch,Math.cos(a)*(r-24),y,Math.sin(a)*(r-24),9);}}
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2+.2;archBridge(group,batch,V(Math.cos(a)*480,0,Math.sin(a)*480),V(Math.cos(a)*910,0,Math.sin(a)*910),112,14,stone);batch.protected=true;batch.add(cliff,dark,Math.cos(a)*960,5,Math.sin(a)*960,105,180,105);batch.add(cyl(48),stone,Math.cos(a)*960,97,Math.sin(a)*960,110,5,110);batch.protected=false;turret(Math.cos(a)*960,100,Math.sin(a)*960,75,22);}
  const moving=[];for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.4;const x=Math.cos(a)*487,z=Math.sin(a)*487;const waterfall=new THREE.MeshStandardMaterial({color:0xa1d8e3,emissive:0x347c91,emissiveIntensity:.2,transparent:true,opacity:.65,roughness:.3,side:THREE.DoubleSide});const w=mesh(group,new THREE.PlaneGeometry(16,120,3,12),waterfall,x,61,z,1,1,1,-a);w.castShadow=false;moving.push(w);batch.add(cyl(24),mat(0xa1d8e3,.1,.4),x,1,z,25,.3,25);}
  for(const waterfall of moving)waterfall.userData.damageProtected=true;
  batch.protected=true;for(let i=0;i<60;i++){const a=random()*Math.PI*2,r=700+random()*400;batch.add(geo('rock',()=>new THREE.IcosahedronGeometry(1,1)),dark,Math.cos(a)*r,-25,Math.sin(a)*r,40+random()*40,45+random()*70,35+random()*40);}batch.protected=false;
  landing(batch,0,121,370,18);return {moving,target:V(0,170,0)};
}

export function buildWorld(type, assets) {
  const group = new THREE.Group();
  if (type === 'cyberpunk' || type === 'drone') {
    group.add(assets.SourceCity);
    let animate;
    if (type === 'cyberpunk' && !assets.FlatFoundation) {
      const anchors=['contour-v2','blender'].includes(assets.FoundationVersion)?assets.SourceLegacyAnchors:assets.SourceAnchors;
      const foundation = (assets.FoundationBuilder || createCityFoundation)(assets.SourceFootprint, anchors);
      group.add(foundation);
      if(assets.SourceSupport)group.add(assets.SourceSupport);
      animate = foundation.userData.animate;
    } else {
      const floor = mesh(group, cyl(128), mat(worldInfo[type].ground, .1, .9), 0, -4, 0, 2600, 6, 2600);
      floor.castShadow = false;
    }
    return { group, moving: [], target: V(0, assets.SourceHeight * .3, 0), instanceCount: assets.SourceDraws, source: true, animate };
  }
  const batch = new Batches(group);
  const result = type === 'metropolis' ? metropolis(group, batch, assets) : type === 'citadel' ? citadel(group, batch, assets) : alien(group, batch);
  result.instanceCount = batch.finish();
  return { group, ...result };
}
