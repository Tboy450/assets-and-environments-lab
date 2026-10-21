import * as THREE from '/vendor/three/three.module.min.js';
// Reuse preserved height functions rather than inventing replacement landscapes.
export async function terrainModel(options){
  const titan=options.family==='titan';
  let heightAt,liquid=null;
  if(titan){
    const names=['mountain-basin-map','copilot-dune-terrain','sparse-mountains-and-parked-room'];
    const url=options.version==='current'?'/titan-terrain.mjs?v=dev':names.includes(options.version)?'/studio/terrain-sources/'+options.version+'.mjs?v=dev':null;
    if(!url)throw Error('Unknown terrain snapshot');
    heightAt=(await import(url)).terrainHeight;
  }else{
    const {createPlanetTerrain}=await import('/invasion/planet-terrain.mjs?v=dev');
    const terrain=createPlanetTerrain({biome:options.biome,seed:47,map:{half:420}});
    heightAt=(x,z)=>terrain.heightAt(x,z)*4;liquid=terrain.liquid===null?null:terrain.liquid*4;
  }
  const span=titan?8000:840,geometry=new THREE.PlaneGeometry(span,span,128,128);
  geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position,colors=[],color=new THREE.Color();
  let low=Infinity,high=-Infinity;
  for(let i=0;i<positions.count;i++){const h=heightAt(positions.getX(i),positions.getZ(i));if(!Number.isFinite(h))throw Error('Non-finite terrain sample');positions.setY(i,h);low=Math.min(low,h);high=Math.max(high,h);}
  const hues={desert:.1,jungle:.29,ice:.56,volcanic:.025,storm:.58,city:.51};
  for(let i=0;i<positions.count;i++){const t=(positions.getY(i)-low)/Math.max(1,high-low);color.setHSL(titan?.1:hues[options.biome]??.15,titan?.3:.42,.2+t*.43);colors.push(color.r,color.g,color.b);}
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const group=new THREE.Group();group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,side:THREE.DoubleSide})));
  if(liquid!==null){const water=new THREE.Mesh(new THREE.PlaneGeometry(span,span),new THREE.MeshStandardMaterial({color:options.biome==='volcanic'?0xeb6c23:0x357d9a,roughness:.3}));water.rotation.x=-Math.PI/2;water.position.y=liquid;group.add(water);}
  return group;
}
