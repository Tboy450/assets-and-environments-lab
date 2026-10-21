// Original procedural VFX [EST]. Smoke/fire are visual lab studies, not gameplay damage.
// Three instanced billboard draws, bounded by quality; no downloaded imagery or generated art.
import * as THREE from '../../vendor/three/three.module.min.js?v=dev';

export const aftermathStages = Object.freeze({
  intact: Object.freeze({ sites: 0, heat: 0, smoke: 0, fireSize: 0 }),
  damaged: Object.freeze({ sites: 18, heat: .85, smoke: .58, fireSize: 1 }),
  heavy: Object.freeze({ sites: 36, heat: 1.15, smoke: .92, fireSize: 1.3 }),
  ruins: Object.freeze({ sites: 28, heat: .38, smoke: .7, fireSize: .58 }),
});
export const aftermathBudgets = Object.freeze({
  high: Object.freeze({ sites: 36, smoke: 9, fire: 5, embers: 12, lights: 2 }),
  low: Object.freeze({ sites: 12, smoke: 5, fire: 3, embers: 4, lights: 0 }),
});

export function selectAftermathSites(sources, limit) {
  if (!Number.isInteger(limit) || limit < 0) throw new Error('Choose a finite effects budget');
  return sources.filter(s => s && Array.isArray(s.position) && s.position.length === 3
    && s.position.every(n => Number.isFinite(n) && Math.abs(n) < 1e7)
    && Number.isFinite(s.scale) && s.scale > 0 && Number.isFinite(s.seed))
    .slice().sort((a, b) => a.seed - b.seed || a.position[0] - b.position[0] || a.position[2] - b.position[2])
    .slice(0, limit).map(s => ({ ...s, position: [...s.position], scale: Math.min(s.scale, 16) }));
}

const vertexShader = `
attribute vec3 effectOrigin;
attribute float effectScale;
attribute float effectPhase;
attribute float effectSeed;
uniform float uTime;
uniform float uSize;
uniform vec2 uWind;
varying vec2 vUv;
varying float vAge;
varying float vSeed;
#include <fog_pars_vertex>
void main(){
  vUv=uv;vSeed=effectSeed;
  vec3 center=effectOrigin;
  float size=effectScale;
  vec2 dimensions;
  #if EFFECT_KIND == 0
    float age=fract(uTime/(6.0+effectSeed*4.0)+effectPhase);
    vAge=age;
    center.y+=size*(1.3+age*11.0);
    center.xz+=uWind*size*age*age*9.0;
    center.x+=sin(age*6.0+effectSeed*30.0)*size*.5;
    center.z+=cos(age*5.0+effectSeed*20.0)*size*.5;
    dimensions=vec2(1.8,2.1)*size*(.55+age*2.4);
  #elif EFFECT_KIND == 1
    float age=fract(uTime*(.65+effectSeed*.3)+effectPhase);
    vAge=age;
    size*=uSize;
    center.y+=size*(.9+age*2.0);
    center.x+=sin(uTime*1.8+effectSeed*30.0+age*5.0)*size*.18;
    center.xz+=uWind*size*age*.55;
    dimensions=vec2(1.7,3.2)*size*(1.0-age*.5);
  #else
    float age=fract(uTime/(1.6+effectSeed*2.0)+effectPhase);
    vAge=age;
    center.y+=size*(.6+age*8.0);
    center.xz+=vec2(sin(effectSeed*80.0),cos(effectSeed*70.0))*size*age*2.3;
    center.xz+=uWind*size*age*age*7.0;
    dimensions=vec2(.06,.15)*size*(1.0-age*.6);
  #endif
  vec4 mvPosition=modelViewMatrix*vec4(center,1.0);
  mvPosition.xy+=position.xy*dimensions;
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;

const fragmentShader = `
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
varying float vAge;
varying float vSeed;
#include <fog_pars_fragment>
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float cloud(vec2 p){return noise(p)*.57+noise(p*2.07+4.1)*.28+noise(p*4.13+9.2)*.15;}
void main(){
  vec2 p=vUv*2.0-1.0;
  float alpha;vec3 color;
  #if EFFECT_KIND == 0
    float n=cloud(p*2.1+vec2(vSeed*35.0-uTime*.055,uTime*.08));
    float edge=length(p*vec2(.95,.9))+(n-.5)*.55;
    float density=1.0-smoothstep(.28,1.05,edge);
    alpha=density*(.7+n*.3)*smoothstep(0.0,.14,vAge)*(1.0-smoothstep(.62,1.0,vAge))*.42*uStrength;
    color=mix(vec3(.075,.082,.09),vec3(.32,.31,.29),n*.7+vUv.y*.2);
  #elif EFFECT_KIND == 1
    float n=cloud(vec2(p.x*2.4+vSeed*20.0,vUv.y*3.2-uTime*1.6));
    float width=mix(.95,.10,vUv.y);
    float bend=(n-.5)*.75*vUv.y;
    float flame=1.0-smoothstep(width*.25,width,abs(p.x+bend));
    flame*=smoothstep(0.0,.14,vUv.y)*(1.0-smoothstep(.58,1.0,vUv.y));
    alpha=flame*(.58+n*.42)*(1.0-smoothstep(.76,1.0,vAge))*.85*uStrength;
    float hot=clamp((1.0-vUv.y)*1.2-abs(p.x)*.7+n*.2,0.0,1.0);
    color=mix(vec3(2.2,.18,.012),vec3(3.8,2.1,.55),hot);
  #else
    alpha=(1.0-smoothstep(.1,1.0,length(p)))*(1.0-vAge)*uStrength;
    color=vec3(3.0,.7,.07);
  #endif
  if(alpha<.008)discard;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #if EFFECT_KIND == 0
    #include <fog_fragment>
  #else
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFade=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
      #else
        float fogFade=smoothstep(fogNear,fogFar,vFogDepth);
      #endif
      gl_FragColor.a*=1.0-fogFade;
    #endif
  #endif
}`;

function createLayer(sites, perSite, kind, preset) {
  const count=sites.length*perSite,origins=new Float32Array(count*3),scales=new Float32Array(count),phases=new Float32Array(count),seeds=new Float32Array(count);
  let index=0;
  for(const site of sites)for(let i=0;i<perSite;i++){
    origins.set(site.position,index*3);scales[index]=site.scale;
    phases[index]=(i+.23)/perSite;
    seeds[index]=(site.seed+i*.61803398875)%1;index++;
  }
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
  geometry.setIndex([0,1,2,0,2,3]);geometry.instanceCount=count;
  geometry.setAttribute('effectOrigin',new THREE.InstancedBufferAttribute(origins,3));
  geometry.setAttribute('effectScale',new THREE.InstancedBufferAttribute(scales,1));
  geometry.setAttribute('effectPhase',new THREE.InstancedBufferAttribute(phases,1));
  geometry.setAttribute('effectSeed',new THREE.InstancedBufferAttribute(seeds,1));
  const material=new THREE.ShaderMaterial({
    defines:{EFFECT_KIND:kind},uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{
      uTime:{value:0},uWind:{value:new THREE.Vector2(.65,.23)},uSize:{value:preset.fireSize},
      uStrength:{value:kind===0?preset.smoke:preset.heat},
    }]),vertexShader,fragmentShader,transparent:true,depthWrite:false,fog:true,
    blending:kind===0?THREE.NormalBlending:THREE.AdditiveBlending,
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=['Drifting aftermath smoke','Animated fracture flames','Rising aftermath embers'][kind];
  mesh.frustumCulled=false;mesh.renderOrder=kind===0?2:1;
  return mesh;
}

export function createCityAftermath(sources, stage, options={}) {
  if(!Object.hasOwn(aftermathStages,stage))throw new Error('Unknown aftermath stage');
  const preset=aftermathStages[stage],group=new THREE.Group();group.name='City smoke, fire and embers';
  let quality=options.quality==='low'?'low':'high',smoke=options.smoke!==false,fire=options.fire!==false,
    paused=!!options.paused,clock=17.25,disposed=false,layers=[],lights=[],sites=[];
  function clear(){
    for(const mesh of layers){mesh.geometry.dispose();mesh.material.dispose();mesh.removeFromParent();}
    for(const light of lights)light.removeFromParent();layers=[];lights=[];
  }
  function build(){
    clear();const budget=aftermathBudgets[quality];
    sites=selectAftermathSites(sources,Math.min(budget.sites,preset.sites));
    if(!sites.length)return;
    layers=[createLayer(sites,budget.smoke,0,preset),createLayer(sites,budget.fire,1,preset),createLayer(sites,budget.embers,2,preset)];
    group.add(...layers);
    for(const site of sites.slice(0,budget.lights)){
      const light=new THREE.PointLight(0xff8d38,0,site.scale*8,2);
      light.position.fromArray(site.position);light.position.y+=site.scale;
      light.userData.aftermathPower=site.scale*site.scale*9*preset.heat;light.userData.seed=site.seed;
      lights.push(light);group.add(light);
    }
  }
  function sync(){
    group.visible=sites.length>0&&(smoke||fire);
    layers.forEach((mesh,i)=>{mesh.visible=i===0?smoke:fire;mesh.material.uniforms.uTime.value=clock;});
    for(const light of lights){light.visible=fire;light.intensity=fire?light.userData.aftermathPower*(.9+.1*Math.sin(clock*4+light.userData.seed*30)):0;}
  }
  build();sync();
  return {
    group,
    get stats(){return {stage,quality,sites:sites.length,instances:layers.reduce((n,m)=>n+m.geometry.instanceCount,0),
      draws:layers.filter(m=>m.visible&&group.visible).length,lights:lights.filter(l=>l.visible).length,paused,clock,disposed};},
    update(dt){if(disposed)return;if(!paused&&Number.isFinite(dt)&&dt>0)clock+=Math.min(dt,.1);sync();},
    setOptions(next){
      if(disposed)return;
      if(typeof next.smoke==='boolean')smoke=next.smoke;
      if(typeof next.fire==='boolean')fire=next.fire;
      if(typeof next.paused==='boolean')paused=next.paused;
      if(next.quality&&quality!==(next.quality==='low'?'low':'high')){quality=next.quality==='low'?'low':'high';build();}
      sync();
    },
    dispose(){if(disposed)return;clear();sites=[];group.visible=false;group.removeFromParent();disposed=true;},
  };
}
