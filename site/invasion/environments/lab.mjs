import { applyProjectBrand } from './studio-brand.mjs?v=dev';
import * as THREE from "../../vendor/three/three.module.min.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { worldInfo, buildWorld, rng } from "./worlds.mjs?v=dev";
import { lowFootprint, structuralContacts } from "./foundation.mjs?v=dev";
import { bakeSourceGeometry } from "./source-geometry.mjs?v=dev";
import { damagePart, damageAnchors, collectDamageParts, createCityDamageVariant, disposeCityDamageVariant, damageStages } from './city-damage.mjs?v=dev';
import { createCityAftermath } from './aftermath.mjs?v=dev';
import { assetCatalog, assetById, loadAssetDisplay } from './asset-viewer.mjs?v=dev';

const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),requested=query.get('scene');
const assetEntry=query.has('asset')?(assetById(query.get('asset'))||assetCatalog[0]):null;
const scoutComparison=assetEntry?.drone==='scout',scoutVersion=query.get('scout')==='original'?'original':'polished';
const type=Object.hasOwn(worldInfo,requested)?requested:'alien',info=assetEntry?{
  title:assetEntry.name+(scoutComparison?` · ${scoutVersion==='original'?'Original':'Polish pass'}`:''),description:assetEntry.description,credit:`${assetEntry.creator} · ${assetEntry.license}. ${assetEntry.description}`,
  span:'Individual asset · fit-to-view scale',sky:[0x182c3b,0x748995],ground:0x223642,sun:0xffe9ce,
  views:{vista:[[170,110,180],[0,35,0]],district:[[100,65,110],[0,35,0]],street:[[55,30,60],[0,30,0]]}
}:worldInfo[type];
$('title').textContent=info.title;$('description').textContent=info.description;$('credits').textContent=info.credit;
if(!assetEntry)document.querySelector(`[data-scene="${type}"]`).classList.add('active');
document.title=`${info.title} · Swarmfall Asset & Environment Lab`;
const studioProject=await applyProjectBrand(query.get('project')||'swarmfall');
document.querySelector(`[data-mode="${assetEntry?'assets':'environments'}"]`).setAttribute('aria-current','page');
$('asset-browser').hidden=!assetEntry;document.querySelector('.tests').hidden=!!assetEntry;$('damage-preview').hidden=!!assetEntry;
if(assetEntry){
  $('scout-versions').hidden=!scoutComparison;
  if(scoutComparison)for(const link of $('scout-versions').querySelectorAll('[data-scout-version]')){
    const url=new URL(location.href);url.searchParams.set('scout',link.dataset.scoutVersion);link.href=url;
    if(link.dataset.scoutVersion===scoutVersion)link.setAttribute('aria-current','page');
  }
  $('lab-eyebrow').textContent='REUSABLE ASSETS';$('asset-license').textContent=`${assetEntry.creator} · ${assetEntry.license}`;
  $('asset-source').href=assetEntry.source;$('tour').textContent='Turntable';
  document.querySelector('[data-view="district"]').textContent='Detail';document.querySelector('[data-view="street"]').textContent='Close';
  $('world').setAttribute('aria-label','Interactive 3D asset. Drag to orbit and scroll to zoom.');
  for(const category of new Set(assetCatalog.map(asset=>asset.category))){
    const group=document.createElement('optgroup');group.label=category;
    for(const asset of assetCatalog.filter(asset=>asset.category===category)){const option=document.createElement('option');option.value=asset.id;option.textContent=asset.name;group.append(option);}
    $('asset-choice').append(group);
  }
  $('asset-choice').value=assetEntry.id;$('asset-choice').addEventListener('change',()=>{const url=new URL(location.href);url.search='';url.searchParams.set('asset',$('asset-choice').value);url.searchParams.set('project',studioProject.id);location.assign(url);});
}
const canvas=$('world'),scene=new THREE.Scene();let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){$('loading-text').textContent='This preview needs WebGL 2. Try a browser with hardware acceleration enabled.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.4,12000),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.065;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=12;controls.maxDistance=4500;controls.screenSpacePanning=true;
const hemi=new THREE.HemisphereLight(0xc5e4ef,info.ground,2.2);scene.add(hemi);
const sun=new THREE.DirectionalLight(info.sun,3.2);sun.position.set(500,900,300);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-750,right:750,top:750,bottom:-750,near:10,far:2000});sun.shadow.normalBias=1.5;sun.shadow.bias=-.00015;scene.add(sun);
if(assetEntry)Object.assign(sun.shadow.camera,{left:-135,right:135,top:135,bottom:-135});
const fill=new THREE.DirectionalLight(0x8eaedc,.6);fill.position.set(-500,300,-500);scene.add(fill);
scene.fog=new THREE.FogExp2(info.sky[1],.00019);
const skyUniforms={top:{value:new THREE.Color(info.sky[0])},bottom:{value:new THREE.Color(info.sky[1])}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(7000,32,20),new THREE.ShaderMaterial({uniforms:skyUniforms,side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vPosition;uniform vec3 top;uniform vec3 bottom;void main(){float h=clamp(normalize(vPosition).y*.8+.18,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.7)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));sky.frustumCulled=false;scene.add(sky);
// Planetary context uses original geometry. No raster generation or franchise imagery.
if(!assetEntry&&type!=='metropolis'){const moon=new THREE.Mesh(new THREE.SphereGeometry(290,48,32),new THREE.MeshStandardMaterial({color:0xb8c6c1,roughness:1,fog:false}));moon.position.set(-2200,1900,-3600);scene.add(moon);const ring=new THREE.Mesh(new THREE.RingGeometry(390,620,96),new THREE.MeshBasicMaterial({color:0xb2c9c7,side:THREE.DoubleSide,transparent:true,opacity:.33,fog:false}));ring.position.copy(moon.position);ring.rotation.set(1.02,.25,.3);scene.add(ring);const random=rng(471),positions=[];for(let i=0;i<900;i++){const a=random()*Math.PI*2,h=.2+random()*.8,r=6300;positions.push(Math.cos(a)*r*Math.sqrt(1-h*h),h*r,Math.sin(a)*r*Math.sqrt(1-h*h));}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xdce9ff,size:4,transparent:true,opacity:.4,fog:false})));}

const manager=new THREE.LoadingManager();manager.onProgress=(_,loaded,total)=>{$('loading-text').textContent=`Loading source assets · ${loaded}/${total}`;};
const loader=new GLTFLoader(manager),assets={};
async function loadSource(name){
  const {scene:root}=await loader.loadAsync(`./assets/source-scenes/${name}.glb`);root.updateMatrixWorld(true);
  const batches=new Map(), sourceBounds=[];
  root.traverse(object=>{if(!object.isMesh)return;object.geometry.computeBoundingBox();sourceBounds.push({name:object.name,box:object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld)});const g=bakeSourceGeometry(object);if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));const material=object.material;if(Array.isArray(material))throw new Error('Unexpected multi-material source primitive');if(!batches.has(material.uuid))batches.set(material.uuid,{material,geometries:[]});batches.get(material.uuid).geometries.push(g);});
  const merged=new THREE.Group();for(const {material,geometries} of batches.values()){const geometry=mergeGeometries(geometries,false);if(!geometry)throw new Error('Source geometry could not be batched');const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;merged.add(mesh);}
  const bounds=new THREE.Box3().setFromObject(merged),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=2000/Math.max(size.x,size.z);merged.scale.setScalar(scale);merged.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);assets.SourceHeight=size.y*scale;assets.SourceCity=merged;assets.SourceDraws=merged.children.length;assets.SourceFootprint=lowFootprint(merged,assets.SourceHeight);
  const normalization=new THREE.Matrix4().makeScale(scale,scale,scale).setPosition(merged.position);
  assets.SourceDamageParts=[];
  for(const {material,geometries} of batches.values())for(const geometry of geometries){
    assets.SourceDamageParts.push(damagePart(geometry,material,normalization,`source-${assets.SourceDamageParts.length}`));
  }
  const sourceParts=sourceBounds.map(({name,box})=>{
    const size=box.getSize(new THREE.Vector3()).multiplyScalar(scale),middle=box.getCenter(new THREE.Vector3());
    return {name,x:(middle.x-center.x)*scale,z:(middle.z-center.z)*scale,
      bottom:(box.min.y-bounds.min.y)*scale,top:(box.max.y-bounds.min.y)*scale,
      width:size.x,depth:size.z,height:size.y};
  });
  assets.SourceAnchors=structuralContacts(sourceParts);
  const legacy=new Map();
  for(const a of sourceParts)if(a.bottom>=-1&&a.bottom<Math.min(180,assets.SourceHeight*.25)&&a.width>=18&&a.depth>=18&&a.width<350&&a.depth<350&&a.height>Math.max(40,a.width*.5,a.depth*.5)){
    const key=Math.round(a.x/15)+','+Math.round(a.z/15),previous=legacy.get(key);
    if(!previous||a.bottom<previous.bottom)legacy.set(key,a);
  }
  assets.SourceLegacyAnchors=[...legacy.values()].sort((a,b)=>b.width*b.depth-a.width*a.depth).slice(0,100);

  const h=assets.SourceHeight;info.views.vista=[[1550,Math.max(800,h*1.2),1700],[0,h*.3,0]];info.views.district=[[500,Math.max(220,h*.65),560],[0,h*.3,0]];info.views.street=[[160,Math.max(35,h*.4),210],[0,h*.3,0]];document.querySelector('[data-view="street"]').textContent='Close view';
  if(name==='cyberpunk'){
    info.views.vista=[[2100,Math.max(1250,h*1.35),2300],[0,h*.22,0]];
    info.views.foundation=[[1800,600,1900],[0,h*.25,0]];
    info.views.rear=[[-2100,1100,-2300],[0,h*.3,0]];
    info.views.bases=[[1700,360,1600],[180,175,160]];
    document.querySelector('[data-view="foundation"]').hidden=false;
    document.querySelector('[data-view="rear"]').hidden=false;
    document.querySelector('[data-view="bases"]').hidden=false;
  }

}
async function load(name,folder){const path=`./assets/${folder}/${name}.${folder==='downtown'?'gltf':'glb'}`;const loaded=await loader.loadAsync(path);const root=loaded.scene;root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3());root.position.set(-center.x,-bounds.min.y,-center.z);root.updateMatrixWorld(true);root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.map)m.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}}});assets[name]=root;}
assets.FlatFoundation = new URLSearchParams(location.search).get('foundation') === 'flat';
assets.FoundationVersion = new URLSearchParams(location.search).get('foundation') || 'houdini';
if(!assetEntry&&type==='cyberpunk'&&['platform-v1','contour-v2'].includes(assets.FoundationVersion)){
  assets.FoundationBuilder=(await import(`./history/${assets.FoundationVersion}.mjs?v=dev`)).createCityFoundation;
}
if(!assetEntry&&type==='cyberpunk'&&assets.FoundationVersion==='houdini'){
  const {createHoudiniCoast}=await import('./houdini-coast.mjs');
  assets.FoundationBuilder=(footprint,anchors)=>createHoudiniCoast(footprint,anchors,assets.SourceTerrain);
}
if (!assetEntry && type === 'cyberpunk') {
  const variant = $('variant'), link = document.createElement('a');
  variant.hidden = false;
  link.href = assets.FlatFoundation ? '?scene=cyberpunk' : '?scene=cyberpunk&foundation=flat';
  link.textContent = assets.FlatFoundation ? 'Show coastal foundation' : 'Compare original flat-ground version';
  variant.append(link);
  for(const [version,label] of [['houdini','Houdini fitted coastal terrain'],['platform-v1','First raised-platform pass'],['contour-v2','Second low-coast pass'],['blender','Blender underside-fitted supports']]){
    const comparison=document.createElement('a');comparison.href=`?scene=cyberpunk&foundation=${version}`;comparison.textContent=label;variant.append(document.createElement('br'),comparison);
  }
  if(assets.FoundationVersion==='contour-v2')$('description').textContent='The preferred second foundation pass: low coastal land and ocean around the complete Cyberpunk City scene. Foundation fitting remains in progress; some elevated bases still need shaped support.';
  if(assets.FoundationVersion==='platform-v1')$('description').textContent='Preserved first raised-platform experiment. Re-rendered with current controls; the original platform geometry is unchanged.';
  if(assets.FoundationVersion==='blender')$('description').textContent='The second low coast with Blender-built structural foundations fitted to actual building undersides. Terrain stays low; elevated architecture receives solid support. This is a visual prototype for inspection.';
  if(assets.FoundationVersion==='houdini')$('description').textContent='A connected coastal landscape fitted in Houdini to the city’s actual bases. Sloping districts meet the lower coast and ocean; elevated skyways remain open. Inspect the fit from the Foundation view.';
  if (assets.FlatFoundation) $('description').textContent = 'Original source-city test on a flat ground disc, retained for comparison with the new coastal foundation.';
}
let world;
try{
  if(!assetEntry&&type==='metropolis')await Promise.all(['Building_Large_2','Building_Medium_2_001','Building_Small_1','Prop_ACUnit','Prop_Planter_Single'].map(n=>load(n,'downtown')));
  if(!assetEntry&&type==='citadel')await load('wall-wood-window-shutters','fantasy');
  if(!assetEntry&&(type==='cyberpunk'||type==='drone'))await loadSource(type);
  if(!assetEntry&&type==='cyberpunk'&&assets.FoundationVersion==='blender'){
    assets.SourceSupport=(await loader.loadAsync('./assets/source-scenes/skyway-foundation.glb')).scene;
    assets.SourceSupport.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  }
  if(!assetEntry&&type==='cyberpunk'&&assets.FoundationVersion==='houdini'){
    assets.SourceTerrain=(await loader.loadAsync('./assets/source-scenes/skyway-houdini-coast.glb')).scene;
    assets.SourceTerrain.traverse(o=>{if(o.isMesh){o.geometry.computeVertexNormals();o.receiveShadow=true;}});
  }
  $('loading-text').textContent=assetEntry?'Preparing asset inspection…':'Composing the district…';world=assetEntry?await loadAssetDisplay(assetEntry,loader,{scoutVersion}):buildWorld(type,assets);scene.add(world.group);
  $('loading').classList.add('hidden');
  $('status').textContent=assetEntry?`${info.span} · ${assetEntry.license}`:`${info.span} · ${world.source?'complete imported scene':type==='metropolis'?world.importedBuildings+' imported buildings':'original city composition'}`;
  document.body.dataset.ready='true';
}catch(error){console.error(error);$('loading-text').textContent='A source asset could not load. Reload this page to retry.';$('status').textContent='Environment could not load';throw error;}

let damageSource=assetEntry?.drone?null:world.source?{parts:assets.SourceDamageParts,originals:new Set([assets.SourceCity])}
  :collectDamageParts(assetEntry?world.group.getObjectByName('Inspection asset'):world.group);
if(assetEntry&&damageSource&&!damageAnchors(damageSource.parts).length)damageSource=null;
$('damage-preview').hidden=!damageSource;
if(assetEntry)$('asset-damage-note').textContent=damageSource?'Destruction and smoke/fire previews are available below.':'Intact model preview.';
const damageStyle=assetEntry?(assetEntry.category.startsWith('Fantasy')?'citadel':'metropolis'):type;
const effectsMode=['all','smoke','fire','off'].includes(query.get('effects'))?query.get('effects'):'all';
const effectsState={smoke:['all','smoke'].includes(effectsMode),fire:['all','fire'].includes(effectsMode),
  paused:query.get('motion')==='paused'||matchMedia('(prefers-reduced-motion: reduce)').matches};
let damageVariant=null,aftermath=null,damageBusy=false;

function syncPreviewLinks(stage){
  const mode=effectsState.smoke?(effectsState.fire?'all':'smoke'):(effectsState.fire?'fire':'off');
  for(const link of document.querySelectorAll('[data-scene]')){
    const url=new URL(link.href);
    if(stage==='intact')url.searchParams.delete('damage');else url.searchParams.set('damage',stage);
    if(mode==='all')url.searchParams.delete('effects');else url.searchParams.set('effects',mode);
    if(effectsState.paused)url.searchParams.set('motion','paused');else url.searchParams.delete('motion');
    link.href=url;
  }
}
function syncEffectsUI(){
  $('effect-smoke').setAttribute('aria-pressed',String(effectsState.smoke));
  $('effect-fire').setAttribute('aria-pressed',String(effectsState.fire));
  $('effect-pause').setAttribute('aria-pressed',String(effectsState.paused));
  $('effect-pause').textContent=effectsState.paused?'Animate effects':'Pause effects';
  const sites=aftermath?.stats.sites||0;
  $('effect-note').textContent=!sites?'Choose a damaged stage to see smoke and fire on broken architecture.'
    :!effectsState.smoke&&!effectsState.fire?'Smoke and fire are hidden; the destruction model is unchanged.'
    :`${sites} fracture hotspots · ${effectsState.paused?'frozen for inspection':'animated smoke/fire study'}. Visual preview only.`;
}
function updateEffects(){
  aftermath?.setOptions({...effectsState,quality:$('quality').value});
  const mode=effectsState.smoke?(effectsState.fire?'all':'smoke'):(effectsState.fire?'fire':'off');
  const url=new URL(location.href);
  if(mode==='all')url.searchParams.delete('effects');else url.searchParams.set('effects',mode);
  if(effectsState.paused)url.searchParams.set('motion','paused');else url.searchParams.delete('motion');
  history.replaceState(null,'',url);syncPreviewLinks(document.body.dataset.damage||'intact');syncEffectsUI();
}
$('effect-smoke').addEventListener('click',()=>{effectsState.smoke=!effectsState.smoke;updateEffects();});
$('effect-fire').addEventListener('click',()=>{effectsState.fire=!effectsState.fire;updateEffects();});
$('effect-pause').addEventListener('click',()=>{effectsState.paused=!effectsState.paused;updateEffects();});
syncEffectsUI();
async function setDamage(stage){
  if(!damageSource||damageBusy||!Object.hasOwn(damageStages,stage))return;
  damageBusy=true;document.body.dataset.damageBusy='true';
  const buttons=[...document.querySelectorAll('[data-damage]')];buttons.forEach(button=>button.disabled=true);
  $('damage-note').textContent=stage==='intact'?'Restoring intact architecture…':'Building fractured walls, exposed floors and settled rubble…';
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  let next=null,nextEffects=null;
  try{
    // Build before hiding/releasing the current version, so a failed variant leaves it usable.
    next=stage==='intact'?null:createCityDamageVariant(damageSource.parts,stage,{type:damageStyle});
    nextEffects=createCityAftermath(next?.userData.effectSources||[],stage,{...effectsState,quality:$('quality').value});
    aftermath?.dispose();
    if(damageVariant)disposeCityDamageVariant(damageVariant);
    damageVariant=next;aftermath=nextEffects;if(next)scene.add(next);scene.add(aftermath.group);
    for(const object of damageSource.originals)object.visible=stage==='intact';
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.damage===stage)));
    const stats=next?.userData.damage;
    $('damage-note').textContent=stats?`${damageStages[stage].label} · ${stats.affected}/${stats.anchors} structural groups hit. Broken geometry study; game damage comes later.`:'Intact architecture. Terrain, water and all original assets are retained.';
    const url=new URL(location.href);if(stage==='intact')url.searchParams.delete('damage');else url.searchParams.set('damage',stage);
    history.replaceState(null,'',url);document.body.dataset.damage=stage;
    syncPreviewLinks(stage);syncEffectsUI();
  }catch(error){
    if(nextEffects&&nextEffects!==aftermath)nextEffects.dispose();
    if(next&&next!==damageVariant)disposeCityDamageVariant(next);
    console.error(error);$('damage-note').textContent='This damage version could not build. The previous view is retained.';
  }
  finally{damageBusy=false;document.body.dataset.damageBusy='false';buttons.forEach(button=>button.disabled=false);}
}
document.querySelectorAll('[data-damage]').forEach(button=>button.addEventListener('click',()=>setDamage(button.dataset.damage)));
document.querySelectorAll('[data-scene]').forEach(link=>{
  const damage=new URLSearchParams(location.search).get('damage');
  if(damage&&Object.hasOwn(damageStages,damage))link.href+=`&damage=${damage}`;
});

let pilot=false,tour=false,dusk=false,currentView='vista',yaw=0,pitch=0;const keys=new Set();let dragging=null;
function syncAngles(){const direction=camera.getWorldDirection(new THREE.Vector3());yaw=Math.atan2(-direction.x,-direction.z);pitch=Math.asin(direction.y);}
function view(name){currentView=name;const [position,target]=info.views[name];camera.position.fromArray(position);controls.target.fromArray(target);camera.lookAt(controls.target);syncAngles();tour=false;$('tour').setAttribute('aria-pressed','false');document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));controls.update();}
view(new URLSearchParams(location.search).get('view') in info.views?new URLSearchParams(location.search).get('view'):'vista');
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
$('pilot').addEventListener('click',()=>{pilot=!pilot;controls.enabled=!pilot;document.body.classList.toggle('pilot',pilot);$('pilot').setAttribute('aria-pressed',String(pilot));$('pilot').textContent=pilot?'Orbit view':'Pilot view';syncAngles();keys.clear();tour=false;$('tour').setAttribute('aria-pressed','false');if(!pilot){controls.target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(180));controls.update();}$('help').innerHTML=pilot?'WASD / arrows fly · Q/E down/up · Shift boosts.<br>Drag to look · use the view buttons to reset.':'Drag to orbit · scroll to zoom · right-drag to pan.<br>Choose Pilot view to fly through the environment.';});
$('pilot').addEventListener('click',()=>{if(pilot){canvas.tabIndex=0;canvas.focus({preventScroll:true});}});
$('tour').addEventListener('click',()=>{const next=!tour;if(pilot)$('pilot').click();tour=next;$('tour').setAttribute('aria-pressed',String(tour));});
$('light').addEventListener('click',()=>{dusk=!dusk;$('light').setAttribute('aria-pressed',String(dusk));$('light').textContent=dusk?'Daylight':'Dusk';sun.intensity=dusk?.6:3.2;hemi.intensity=dusk?1:2.2;skyUniforms.top.value.set(dusk?0x111c38:info.sky[0]);skyUniforms.bottom.value.set(dusk?0x7b7792:info.sky[1]);scene.fog.color.set(dusk?0x77768c:info.sky[1]);});
$('quality').addEventListener('change',()=>{const high=$('quality').value==='high';renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.6:1));renderer.shadowMap.enabled=high;renderer.setSize(innerWidth,innerHeight);aftermath?.setOptions({quality:$('quality').value});syncEffectsUI();});
$('menu').addEventListener('click',()=>{document.body.classList.toggle('panel-hidden');$('menu').setAttribute('aria-expanded',String(!document.body.classList.contains('panel-hidden')));});
if(innerWidth<760){document.body.classList.add('panel-hidden');$('menu').setAttribute('aria-expanded','false');}
const movementKeys=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
addEventListener('keydown',e=>{if(pilot&&movementKeys.includes(e.code)&&!['SELECT','BUTTON','INPUT'].includes(document.activeElement.tagName)){keys.add(e.code);e.preventDefault();}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();dragging=null;});
canvas.addEventListener('pointerdown',e=>{if(!pilot)return;dragging={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);document.body.classList.add('dragging');});canvas.addEventListener('pointermove',e=>{if(!pilot||!dragging||e.pointerId!==dragging.id)return;yaw-=(e.clientX-dragging.x)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-dragging.y)*.004,-1.48,1.48);dragging.x=e.clientX;dragging.y=e.clientY;});for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,()=>{dragging=null;document.body.classList.remove('dragging');});
document.querySelectorAll('[data-move]').forEach(button=>{button.addEventListener('pointerdown',e=>{keys.add(button.dataset.move);button.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.move));});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let last=performance.now(),frames=0,since=last,tourTime=0;const direction=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.06);last=now;if(document.hidden){keys.clear();return;}if(tour){tourTime+=dt*.055;const radius=assetEntry?190:1650;camera.position.set(Math.cos(tourTime)*radius,assetEntry?90:680+Math.sin(tourTime*.6)*130,Math.sin(tourTime)*radius);controls.target.copy(world.target);camera.lookAt(world.target);}else if(pilot){camera.rotation.set(pitch,yaw,0,'YXZ');camera.getWorldDirection(direction);right.crossVectors(direction,up).normalize();const speed=dt*(keys.has('ShiftLeft')||keys.has('ShiftRight')?240:65);if(keys.has('KeyW')||keys.has('ArrowUp'))camera.position.addScaledVector(direction,speed);if(keys.has('KeyS')||keys.has('ArrowDown'))camera.position.addScaledVector(direction,-speed);if(keys.has('KeyA')||keys.has('ArrowLeft'))camera.position.addScaledVector(right,-speed);if(keys.has('KeyD')||keys.has('ArrowRight'))camera.position.addScaledVector(right,speed);if(keys.has('KeyE'))camera.position.y+=speed;if(keys.has('KeyQ'))camera.position.y-=speed;camera.position.y=THREE.MathUtils.clamp(camera.position.y,2,3000);camera.position.x=THREE.MathUtils.clamp(camera.position.x,-3200,3200);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-3200,3200);}else controls.update();world.animate?.(now/1000);for(const w of world.moving){w.material.opacity=.58+Math.sin(now*.003+w.position.x)*.08;}aftermath?.update(dt);renderer.render(scene,camera);globalThis.assetStudioCapture?.(renderer.domElement);frames++;if(now-since>1100){$('metrics').textContent=`${Math.round(frames*1000/(now-since))} FPS · ${(renderer.info.render.triangles/1000000).toFixed(2)}M triangles · ${renderer.info.render.calls} draws`;frames=0;since=now;}}
requestAnimationFrame(frame);
if(damageSource)await setDamage(new URLSearchParams(location.search).get('damage')||'intact');
