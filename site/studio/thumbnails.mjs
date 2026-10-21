import * as THREE from '/vendor/three/three.module.min.js';
import {previewModel} from './preview-model.mjs';
let generation=0;
function dispose(group){const geometries=new Set(),materials=new Set(),textures=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const g of geometries)g.dispose();for(const t of textures)t.dispose();}
export async function thumbnailQueue(assets,onThumbnail){
  const current=++generation,queue=assets.filter(a=>!a.thumbnailUrl&&['model','bundled','dragonfly','sample','terrain'].includes(a.kind)&&a.available!==false&&(!a.bytes||a.bytes<20*1024**2)).slice(0,48);
  if(!queue.length)return;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setSize(320,240);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x10252e);scene.add(new THREE.HemisphereLight(0xc5e4ef,0x223642,2.3));const sun=new THREE.DirectionalLight(0xffe9ce,3.2);sun.position.set(100,200,120);scene.add(sun);const camera=new THREE.PerspectiveCamera(42,4/3,.1,4000);
  try{for(const asset of queue){
    if(current!==generation)break;
    await new Promise(resolve=>setTimeout(resolve,100));let display;
    try{display=await previewModel(asset);if(current!==generation){dispose(display.group);break;}scene.add(display.group);camera.position.copy(display.target).add(new THREE.Vector3(180,115,185));camera.lookAt(display.target);renderer.render(scene,camera);
      const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));if(!blob)continue;
      const response=await fetch('/api/thumbnails/'+encodeURIComponent(asset.id),{method:'POST',headers:{'Content-Type':'image/png'},body:blob});if(response.ok){const {url}=await response.json();asset.thumbnailUrl=url;onThumbnail(asset);}
    }catch(error){console.warn('Thumbnail pending: '+asset.filename,error.message);}finally{if(display){scene.remove(display.group);dispose(display.group);}}
  }}finally{renderer.dispose();renderer.forceContextLoss();}
}
