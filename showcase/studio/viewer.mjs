import * as THREE from '/vendor/three/three.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createAssetDisplay } from '/invasion/environments/asset-viewer.mjs?v=dev';
import {api} from './api-client.mjs';
const $=id=>document.getElementById(id),assetId=new URLSearchParams(location.search).get('asset');
try{
  const asset=await api('/api/assets/'+encodeURIComponent(assetId)),project=await api('/api/projects/'+encodeURIComponent(asset.projectId));
  $('project-brand').textContent=project.name;$('project-brand').href='/?project='+encodeURIComponent(project.id);$('asset-label').textContent=asset.filename;document.title=project.name+' · '+asset.filename+' · Asset Studio';
  const status=text=>$('view-status').textContent=text;
  if(asset.kind==='image'){$('image-preview').hidden=false;$('image-preview').src=asset.url;status(asset.filename+' · '+asset.license);}
  else if(asset.kind==='audio'||asset.kind==='video'){
    const media=document.createElement(asset.kind==='audio'?'audio':'video');media.controls=true;media.preload='metadata';media.src=asset.url;media.className='media-preview';document.body.append(media);status(asset.filename+' · '+asset.license);
  }
  else if(!['model','dragonfly','sample','terrain'].includes(asset.kind)){
    $('native').hidden=false;$('native-title').textContent=asset.name;
    const modelSource=/^(blend\d*|hip(lc|nc)?|hda(lc|nc)?|fbx|obj|usd[acz]?|abc|bgeo(\.sc)?|vdb)$/.test(asset.format||'');
    $('native-description').textContent='Original '+asset.format+' source retained. '+(asset.relative||asset.filename)+'. '+(asset.notes||'')+(modelSource?' Export standard GLB/glTF from Blender or Houdini for an interactive model preview.':'');
    $('license').textContent=[asset.creator,asset.license,asset.status].filter(Boolean).join(' · ');$('download').hidden=!asset.url;if(asset.url)$('download').href=asset.url+'?download=1';status(asset.url?'Source stored; browser preview not created yet.':'Native source retained in the local library.');
  }else{
    const canvas=$('viewport');canvas.hidden=false;
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x091a25);
    scene.add(new THREE.HemisphereLight(0xc5e4ef,0x223642,2.2));const sun=new THREE.DirectionalLight(0xffe9ce,3.2);sun.position.set(100,200,120);scene.add(sun);
    const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.05,3000),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=10;controls.maxDistance=650;
    const manager=new THREE.LoadingManager();manager.setURLModifier(value=>{
      if(value.startsWith('data:')||value.startsWith('blob:'))return value;
      const url=new URL(value,location.href);if(url.origin!==location.origin)throw new Error('Remote model dependencies are disabled. Include local textures with Import folder.');return url.href;
    });
    status('Loading '+asset.filename+'…');
    let modelRoot;
    if(asset.kind==='terrain'){const {terrainModel}=await import('./terrain-model.mjs');modelRoot=await terrainModel(asset.terrain);}
    else if(asset.kind==='dragonfly'){const {dragonflyModel}=await import('./dragonfly-model.mjs');modelRoot=dragonflyModel(asset.dragonflyPart);}
    else if(asset.kind==='sample'){const {sampleModel}=await import('./samples.mjs');modelRoot=sampleModel(asset.sample);}
    else modelRoot=(await new GLTFLoader(manager).loadAsync(asset.url)).scene;
    const display=createAssetDisplay(modelRoot,asset);scene.add(display.group);
    const fit=()=>{controls.target.copy(display.target);camera.position.copy(display.target).add(new THREE.Vector3(170,105,175));controls.update();};fit();
    for(const button of ['fit','rotate','quality'])$(button).hidden=false;
    $('fit').onclick=fit;$('rotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('rotate').setAttribute('aria-pressed',String(controls.autoRotate));};
    $('quality').onclick=()=>{const light=$('quality').getAttribute('aria-pressed')!=='true';$('quality').setAttribute('aria-pressed',String(light));renderer.setPixelRatio(Math.min(devicePixelRatio,light?1:1.6));renderer.setSize(innerWidth,innerHeight);};
    const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};addEventListener('resize',resize);
    let frameId,previous=performance.now();const frame=now=>{frameId=requestAnimationFrame(frame);const dt=Math.min(.1,(now-previous)/1000);previous=now;if(document.hidden)return;controls.update(dt);renderer.render(scene,camera);globalThis.assetStudioCapture?.(renderer.domElement);};frameId=requestAnimationFrame(frame);
    addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);removeEventListener('resize',resize);controls.dispose();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}for(const geometry of geometries)geometry.dispose();for(const texture of textures)texture.dispose();renderer.dispose();},{once:true});
    status('Drag to orbit · scroll to zoom · right-drag to pan · '+asset.filename+' · '+asset.license+'. Inspection scale is illustrative; original file is retained.');
  }
}catch(error){$('view-status').textContent='Preview unavailable: '+error.message+'. Standard GLB/glTF with local dependencies is supported; some compressed extensions need a later decoder setup.';console.error(error);}
