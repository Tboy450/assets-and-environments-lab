// Experimental high-contact envelope [EST], REJECTED as a gallery default.
// It can bury architecture; retained for diagnosis. Gallery uses history/contour-v2.
// This is rendering geometry; it does not establish collision or real structural engineering.
import * as THREE from "../../vendor/three/three.module.min.js";

export function convexHull(points) {
  const sorted = [...new Map(points.filter(p => p.every(Number.isFinite)).map(p => [p.join(','), p])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = values => {
    const result = [];
    for (const p of values) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export function lowFootprint(root, height) {
  root.updateMatrixWorld(true);
  const points = [], v = new THREE.Vector3();
  root.traverse(object => {
    if (!object.isMesh) return;
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      v.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      if (v.y <= height * .23 + 1) points.push([Math.round(v.x), Math.round(v.z)]);
    }
  });
  return convexHull(points);
}


const SEA_LEVEL = -38;
const terrainNoise = (x,z) => Math.sin(x*.0031)*Math.cos(z*.0037)*.6 + Math.sin(x*.008+z*.006)*.22;

// Structural masses only: shallow skyway spans and small facade ornaments do not
// pull the terrain up. Stacked masses already supported across their base are omitted.
export function structuralContacts(parts) {
  // In this source scene NurbsPath meshes are the elevated transit network,
  // not buildings; their tall curved bounds would bury the skyline in hills.
  const masses = parts.filter(a => !/^(NurbsPath|Sphere)/i.test(a.name || '') && a.width >= 18 && a.depth >= 18 &&
    a.height >= 40 && a.height >= Math.max(a.width,a.depth)*.45 &&
    [a.x,a.z,a.bottom,a.top,a.width,a.depth,a.height].every(Number.isFinite));
  const roots = masses.filter(a => !masses.some(b => b !== a && b.bottom < a.bottom-5 &&
    b.top >= a.bottom-5 && Math.abs(a.x-b.x)+a.width/2 <= b.width/2+2 &&
    Math.abs(a.z-b.z)+a.depth/2 <= b.depth/2+2));
  const unique = new Map();
  for (const a of roots) {
    const key=[a.x,a.z,a.bottom,a.width,a.depth].map(v=>Math.round(v*10)).join(',');
    unique.set(key,a);
  }
  return [...unique.values()];
}

// Smooth terrain fitted to individual structural contact points, not one raised platform.
export function createCityFoundation(footprint, suppliedAnchors = []) {
  if (footprint.length < 3) throw new Error('City foundation needs a non-degenerate footprint');
  const anchors = suppliedAnchors.length ? suppliedAnchors : footprint.map(([x,z]) => ({x,z,bottom:0,width:60,depth:60}));
  const group = new THREE.Group();group.name = 'Skyway contoured coastal terrain';
  function heightAt(x,z) {
    const mainland = THREE.MathUtils.smoothstep(-z-x*.22,-1200,900)*65;
    const natural = -100 + terrainNoise(x,z)*24 + mainland;
    let height = natural;
    for (const a of anchors) {
      // A 30 m shoulder keeps triangulated terrain flush at the whole base edge,
      // including wide blocks. The full source elevation is retained at every base.
      const dx = Math.max(0,Math.abs(x-a.x)-a.width*.5-30), dz = Math.max(0,Math.abs(z-a.z)-a.depth*.5-30);
      const distance = Math.hypot(dx,dz);
      const influence = Math.exp(-Math.pow(distance/240,2));
      height = Math.max(height,THREE.MathUtils.lerp(natural,a.bottom-3,influence));
    }
    return height;
  }
  const groundGeometry = new THREE.PlaneGeometry(7200,7200,480,480).rotateX(-Math.PI/2);
  const positions = groundGeometry.attributes.position, colors = [], color = new THREE.Color();
  const dry = new THREE.Color(0x64796d), rock = new THREE.Color(0x4b5e62), sand = new THREE.Color(0x939b87);
  for (let i=0;i<positions.count;i++) {
    const x=positions.getX(i),z=positions.getZ(i),height=heightAt(x,z);positions.setY(i,height);
    color.copy(rock).lerp(dry,THREE.MathUtils.smoothstep(height,-22,45));
    color.lerp(sand,Math.max(0,1-Math.abs(height-SEA_LEVEL)/10)*.6);
    color.multiplyScalar(.94+terrainNoise(x,z)*.06);colors.push(color.r,color.g,color.b);
  }
  groundGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));ground.receiveShadow=true;ground.name='Ground fitted to architecture';group.add(ground);
  // Small individual pads seat the original source pillars. No continuous plinth is used.
  const concrete = new THREE.MeshStandardMaterial({color:0x7c8d89,roughness:.85,metalness:.1});
  const dummy = new THREE.Object3D(), pads = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),concrete,anchors.length);
  anchors.forEach((a,i)=>{dummy.position.set(a.x,a.bottom-1.5,a.z);dummy.rotation.set(0,0,0);dummy.scale.set(a.width+5,3,a.depth+5);dummy.updateMatrix();pads.setMatrixAt(i,dummy.matrix);});pads.receiveShadow=pads.castShadow=true;pads.name='Individual foundation pads';group.add(pads);
  const size=128,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size*Math.PI*2,v=y/size*Math.PI*2,i=(y*size+x)*4;pixels[i]=128+Math.round(Math.cos(u*3+v*2)*26+Math.sin(u*7-v*4)*12);pixels[i+1]=128+Math.round(Math.sin(v*3+u*2)*26+Math.cos(v*6-u*5)*12);pixels[i+2]=248;pixels[i+3]=255;}
  const normal = new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.repeat.set(90,90);normal.minFilter=THREE.LinearMipmapLinearFilter;normal.magFilter=THREE.LinearFilter;normal.generateMipmaps=true;normal.needsUpdate=true;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(12000,12000).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x315f70,metalness:.18,roughness:.42,normalMap:normal,normalScale:new THREE.Vector2(.16,.16)}));water.position.y=SEA_LEVEL;water.name='Coastal ocean';water.receiveShadow=true;group.add(water);
  const roadMaterial = new THREE.MeshStandardMaterial({color:0x3c4d50,roughness:.8,side:THREE.DoubleSide});
  const railMaterial = new THREE.MeshStandardMaterial({color:0xa2b4ad,metalness:.5,roughness:.45});
  const roadStarts = [anchors.reduce((a,b)=>a.x<b.x?a:b),anchors.reduce((a,b)=>a.x>b.x?a:b),anchors.reduce((a,b)=>a.z<b.z?a:b),anchors.reduce((a,b)=>a.z>b.z?a:b)];
  roadStarts.forEach((a,index)=>{
    const direction = [new THREE.Vector3(-1,0,0),new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,-1),new THREE.Vector3(0,0,1)][index];
    const side = new THREE.Vector3(-direction.z,0,direction.x), vertices=[],indices=[],rails=[[],[]];
    for(let i=0;i<=44;i++){
      const t=i/44,point=new THREE.Vector3(a.x,0,a.z).addScaledVector(direction,t*680).addScaledVector(side,Math.sin(t*Math.PI)*75);
      const groundHeight=heightAt(point.x,point.z);point.y=Math.max(groundHeight+1,SEA_LEVEL+5);
      for(let s=0;s<2;s++){const edge=point.clone().addScaledVector(side,s?7:-7);vertices.push(edge.x,edge.y,edge.z);rails[s].push(edge.clone().add(new THREE.Vector3(0,1.6,0)));}
      if(i<44)indices.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);
      if(groundHeight<SEA_LEVEL+3&&i%6===0){const h=point.y-groundHeight+5,pier=new THREE.Mesh(new THREE.CylinderGeometry(2,3,h,8),concrete);pier.position.set(point.x,groundHeight+h/2-4,point.z);pier.castShadow=pier.receiveShadow=true;group.add(pier);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();const road=new THREE.Mesh(geometry,roadMaterial);road.receiveShadow=road.castShadow=true;group.add(road);
    for(const points of rails){const rail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),56,.6,5,false),railMaterial);rail.castShadow=true;group.add(rail);}
  });
  group.userData={fittedFootprint:footprint,deckElevation:0,groundElevation:-100,seaElevation:SEA_LEVEL,accessRamps:4,architectureFootings:anchors.length,heightAt,animate:elapsed=>normal.offset.set(elapsed*.003,elapsed*.0015)};
  return group;
}
