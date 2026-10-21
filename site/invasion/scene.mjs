// The invasion's 3D view: a planet's ground, sky and liquid, its settlements and zones, the
// swarm and defenders as instanced meshes, shots, explosions, hazards and the drop pods.
// Titan reuses the simulator's terrain (titan-terrain.mjs); every pod reuses the arrival
// hardware (aeroshell, heat shield, parachutes) from arrival-hardware.mjs and edl.mjs, with
// the descent squeezed into the game's ten-second drop. Reads battle state; never changes it.
import * as THREE from "../vendor/three/three.module.min.js";
import { createTitanTerrain } from "../titan-terrain.mjs?v=dev";
import { createArrivalHardware } from "../arrival-hardware.mjs?v=dev";
import { edlStateAt } from "../edl.mjs?v=dev";
import { dropDurationS, droneTypes } from "./units.mjs?v=dev";
import { droneModels, figureModel, interceptorModel, structureModels, buildingModels, dragonflyTemplate, societyColors } from "./models.mjs?v=dev";

export const swarmColor = "#7ce7ff";
export const nativeColor = "#ff8a4a";
const swarmTint = new THREE.Color(swarmColor), nativeTint = new THREE.Color(nativeColor);
// NASA's Dragonfly is 3.85 m across; drawn 2.4 times that to match the enlarged swarm.
const dragonflyScale = 2.4;

// Invented looks for the invented worlds [EST]; Titan keeps the simulator's own sky and ground.
export const biomeLooks = {
  titan: { sun: 0xffc98c, sky: 0xe3a65e, ground: 0x4d3522, hemi: 2.4, sunI: 1.1 },
  desert: { top: "#c4733f", bottom: "#f3c98f", fog: "#e8b47c", density: 0.0010, low: "#c78a4f", high: "#e8b57a", steep: "#9a5d36", rock: "#a9744a", sun: 0xfff0d8, sky: 0xffe2b8, ground: 0x7a4a2a, hemi: 1.9, sunI: 2.2 },
  jungle: { top: "#4f7d55", bottom: "#b9dca3", fog: "#93b884", density: 0.0016, low: "#38512a", high: "#6f8f3a", steep: "#4c4130", liquid: { color: "#3c4a26", rough: 0.25 }, rock: "#5a5040", sun: 0xf2ffd8, sky: 0xd8f0c0, ground: 0x2c3a1c, hemi: 1.8, sunI: 1.7 },
  ice: { top: "#8db7d8", bottom: "#eaf5ff", fog: "#d5e7f5", density: 0.0012, low: "#dbe9f3", high: "#ffffff", steep: "#7f9cb3", liquid: { color: "#bcdff0", rough: 0.12, metal: 0.2 }, rock: "#8aa3b6", sun: 0xffffff, sky: 0xe6f2ff, ground: 0x7a8ea0, hemi: 1.7, sunI: 1.9 },
  volcanic: { top: "#1c0b08", bottom: "#7a3420", fog: "#5a2a1a", density: 0.0012, low: "#4a3c33", high: "#6a5a4e", steep: "#2c2420", liquid: { color: "#ff5a1a", lava: true }, rock: "#3d342e", sun: 0xffc0a0, sky: 0xd07050, ground: 0x3a2018, hemi: 2.1, sunI: 1.8 },
  storm: { top: "#26303e", bottom: "#6d7c90", fog: "#56647a", density: 0.0013, low: "#b9a97e", high: "#4b7448", steep: "#5c5c5c", liquid: { color: "#1c3a58", rough: 0.15, metal: 0.3 }, rock: "#5e5e60", sun: 0xdfe8ff, sky: 0xa8b8d0, ground: 0x2c3440, hemi: 1.6, sunI: 1.3 },
  city: { top: "#2b1f4a", bottom: "#c4a6ec", fog: "#8a74b0", density: 0.0011, low: "#565663", high: "#6f6f7c", steep: "#43434e", rock: "#55556a", sun: 0xffe8f8, sky: 0xd8c8ff, ground: 0x3a3048, hemi: 1.8, sunI: 1.8 },
};

// Weather particles while a hazard is active [EST look]: color, fall speed m/s, size, haze factor.
const weatherLooks = {
  methaneRain: { color: "#c9a57a", fall: 26, size: 1.1, haze: 1.3 },
  acidRain: { color: "#b8ff6a", fall: 30, size: 1.2, haze: 1.3 },
  blizzard: { color: "#ffffff", fall: 6, size: 2.2, haze: 2.4 },
  dustStorm: { color: "#d9a066", fall: -0.5, size: 3, haze: 2.6 },
  ashCloud: { color: "#3a3330", fall: 2, size: 2.4, haze: 2.1 },
  lightning: { color: "#a8c0e0", fall: 34, size: 1.2, haze: 1.4 },
  gusts: { color: "#d8c8a8", fall: 0, size: 1.2, haze: 1.1 },
};

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function canvasTexture(size, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const glowTexture = () => canvasTexture(64, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.6)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});

// A ring laid on the ground (each vertex follows the terrain). frac runs 0-1 around it, so the
// shader can draw only part of it (capture progress).
function drapedRing(cx, cz, radius, width, heightAt, lift = 0.6, segments = 128) {
  const positions = [], fracs = [], indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = i / segments * Math.PI * 2 - Math.PI / 2;
    for (const r of [radius - width, radius]) {
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      positions.push(x, heightAt(x, z) + lift, z);
      fracs.push(i / segments);
    }
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("frac", new THREE.Float32BufferAttribute(fracs, 1));
  g.setIndex(indices);
  return g;
}

function ringMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, progress: { value: 1 }, opacity: { value: opacity } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: "attribute float frac; varying float vFrac; void main() { vFrac = frac; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 color; uniform float progress; uniform float opacity; varying float vFrac;
      void main() { if (vFrac > progress) discard; gl_FragColor = vec4(color, opacity);
      #include <colorspace_fragment>
      }`,
  });
}

function instanced(geometry, material, capacity) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  return mesh;
}

export function createInvasionScene(canvas, options = {}) {
  const renderer = options.renderer || new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 9000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 2);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-300, 500, -200);
  scene.add(hemi, sun, sun.target);

  // ---- Shared unit meshes (built once) ----
  const unitGroup = new THREE.Group();
  scene.add(unitGroup);
  const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.45 });
  const glowMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  const discTexture = canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(220,230,235,0.05)"); g.addColorStop(0.7, "rgba(220,230,235,0.35)"); g.addColorStop(1, "rgba(220,230,235,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const discMaterial = new THREE.MeshBasicMaterial({ map: discTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const discGeometry = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  const models = droneModels();
  const droneMeshes = {};
  for (const [type, model] of Object.entries(models)) {
    const capacity = 200;
    droneMeshes[type] = {
      model,
      body: instanced(model.body, bodyMaterial, capacity),
      glow: instanced(model.glow, glowMaterial, capacity),
      discs: instanced(discGeometry, discMaterial, capacity * model.rotors.length),
    };
    unitGroup.add(droneMeshes[type].body, droneMeshes[type].glow, droneMeshes[type].discs);
  }
  const figures = instanced(figureModel(), bodyMaterial, 160);
  const interceptors = instanced(interceptorModel(), bodyMaterial, 120);
  unitGroup.add(figures, interceptors);
  const structureMeshes = {};
  for (const [type, model] of Object.entries(structureModels())) {
    structureMeshes[type] = { body: instanced(model.body, bodyMaterial, 60), glow: instanced(model.glow, glowMaterial, 60) };
    unitGroup.add(structureMeshes[type].body, structureMeshes[type].glow);
  }
  // The Dragonfly: the research model is built on first use (it is large), then cloned.
  let dragonflyBase = null;
  const dragonflies = [];
  function dragonflyClone() {
    if (!dragonflyBase) {
      dragonflyBase = dragonflyTemplate();
      dragonflyBase.traverse((part) => { if (part.isMesh && part.material.transparent) part.material.opacity = 0.28; });
    }
    const clone = dragonflyBase.clone();
    clone.userData.rotors = [];
    clone.traverse((part) => { if (part.userData.spin) clone.userData.rotors.push(part); });
    return clone;
  }

  // ---- Effects ----
  const effectGroup = new THREE.Group();
  scene.add(effectGroup);
  const maxShots = 700;
  const shotPositions = new Float32Array(maxShots * 6), shotColors = new Float32Array(maxShots * 6);
  const shotGeometry = new THREE.BufferGeometry();
  shotGeometry.setAttribute("position", new THREE.BufferAttribute(shotPositions, 3).setUsage(THREE.DynamicDrawUsage));
  shotGeometry.setAttribute("color", new THREE.BufferAttribute(shotColors, 3).setUsage(THREE.DynamicDrawUsage));
  const shotLines = new THREE.LineSegments(shotGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, toneMapped: false }));
  shotLines.frustumCulled = false;
  effectGroup.add(shotLines);
  let shots = [];
  const glow = glowTexture();
  const sparkMaterial = new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const smokeMaterial = new THREE.SpriteMaterial({ map: glow, color: 0x2a2624, depthWrite: false, transparent: true });
  const blasts = Array.from({ length: 60 }, (_, i) => {
    const sprite = new THREE.Sprite((i % 3 === 2 ? smokeMaterial : sparkMaterial).clone());
    sprite.visible = false;
    effectGroup.add(sprite);
    return { sprite, t: 0, life: 0, size: 1, smoke: i % 3 === 2 };
  });
  let blastIndex = 0;
  function blast(x, y, z, size, color = 0xffa040, life = 0.7, smoke = false) {
    for (let tries = 0; tries < blasts.length; tries += 1) {
      const slot = blasts[blastIndex = (blastIndex + 1) % blasts.length];
      if (slot.smoke !== smoke) continue;
      slot.sprite.position.set(x, y, z);
      slot.sprite.material.color.set(smoke ? 0x2a2624 : color);
      Object.assign(slot, { t: 0, life, size });
      slot.sprite.visible = true;
      return;
    }
  }
  // Marked circles (artillery, lightning, eruptions) and order pings, drawn over the ground.
  const markerGeometry = new THREE.RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2);
  const markers = Array.from({ length: 24 }, () => {
    const mesh = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    mesh.renderOrder = 5;
    mesh.visible = false;
    effectGroup.add(mesh);
    return mesh;
  });
  const pings = [];
  const bolts = [];
  const boltMaterial = new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, toneMapped: false });
  let flash = 0;

  // Weather particles in a box that follows the camera's focus.
  const weatherCount = 2400;
  const weatherSeeds = new Float32Array(weatherCount * 3);
  const weatherRand = seeded(77);
  for (let i = 0; i < weatherSeeds.length; i += 1) weatherSeeds[i] = weatherRand();
  const weatherPositions = new Float32Array(weatherCount * 3);
  const weatherGeometry = new THREE.BufferGeometry();
  weatherGeometry.setAttribute("position", new THREE.BufferAttribute(weatherPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const weatherMaterial = new THREE.PointsMaterial({ size: 0.5, map: glowTexture(), transparent: true, depthWrite: false, opacity: 0 });
  const weather = new THREE.Points(weatherGeometry, weatherMaterial);
  weather.frustumCulled = false;
  effectGroup.add(weather);
  // Lava fountain sprites for eruptions.
  const lava = Array.from({ length: 40 }, () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff6a20, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sprite.visible = false;
    effectGroup.add(sprite);
    return { sprite, phase: Math.random(), angle: Math.random() * Math.PI * 2, spread: Math.random() };
  });

  // ---- Drop pods: the simulator's arrival hardware around a cluster of drones ----
  const upAxis = new THREE.Vector3(0, 1, 0);
  const podSlots = [];
  function createPodSlot() {
    const craft = new THREE.Group();
    craft.name = "drop-payload";
    const cluster = new THREE.Group();
    const scout = models.scout;
    for (let i = 0; i < 3; i += 1) {
      const a = i / 3 * Math.PI * 2, r = 1.4;
      const drone = new THREE.Mesh(scout.body, bodyMaterial);
      drone.scale.setScalar(1.3);
      drone.position.set(Math.cos(a) * r, (i % 2) * 0.35 - 0.2, Math.sin(a) * r);
      cluster.add(drone);
    }
    craft.add(cluster);
    scene.add(craft);
    craft.visible = false;
    const hardware = createArrivalHardware(scene, craft, upAxis);
    hardware.group.name = "drop-hardware";
    const slot = { craft, cluster, hardware, pod: null, dragonfly: null };
    podSlots.push(slot);
    return slot;
  }

  // ---- Planet ----
  let world = null, titan = null, terrain = null, look = biomeLooks.desert;
  const zoneVisuals = new Map();
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 2; skyCanvas.height = 256;
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  let baseFog = 0.001;

  function paintSky(top, bottom) {
    const ctx = skyCanvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, top); gradient.addColorStop(0.6, bottom); gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 2, 256);
    skyTexture.needsUpdate = true;
  }

  function unload() {
    for (const slot of podSlots) {
      slot.craft.removeFromParent();
      slot.hardware.group.removeFromParent();
      const geometries = new Set(), materials = new Set(), textures = new Set();
      slot.hardware.group.traverse(part => {
        if (part.geometry) geometries.add(part.geometry);
        for (const material of Array.isArray(part.material) ? part.material : part.material ? [part.material] : []) {
          materials.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
      });
      for (const resource of [...textures, ...materials, ...geometries]) resource.dispose();
    }
    podSlots.length = 0;
    if (world) {
      scene.remove(world);
      world.traverse((part) => {
        if (part.isMesh || part.isInstancedMesh) {
          if (!part.userData.shared) part.geometry?.dispose();
          if (part.userData.ownMaterial) part.material.dispose();
        }
      });
    }
    world = null;
    if (titan) titan.group.visible = false;
    zoneVisuals.clear();
    for (const d of dragonflies) d.parent?.remove(d);
    dragonflies.length = 0;
    shots = [];
  }

  function load(planet, planetTerrain, battle) {
    unload();
    terrain = planetTerrain;
    look = biomeLooks[planet.biome] || biomeLooks.desert;
    world = new THREE.Group();
    world.name = `planet-${planet.id}`;
    scene.add(world);
    const { centerX, centerZ, half } = battle.map;
    const rand = seeded(planet.seed || 1);
    hemi.color.set(look.sky); hemi.groundColor.set(look.ground); hemi.intensity = look.hemi;
    sun.color.set(look.sun); sun.intensity = look.sunI;
    if (planet.biome === "titan") {
      if (!titan) {
        const background = scene.background, fog = scene.fog;
        titan = createTitanTerrain(scene, renderer);
        titan.background = scene.background; titan.fog = scene.fog;
        scene.background = background; scene.fog = fog;
      }
      titan.group.visible = true;
      scene.background = titan.background;
      scene.fog = titan.fog;
      titan.setDaylight(1);
      titan.setWeather(null);
      titan.setHazeAltitude(0);
      titan.updateSites([]);
      // The simulator's survey ring and site circles belong to its own missions.
      titan.group.traverse((part) => { if (part.name === "survey-marker" || part.name.startsWith("site-")) part.visible = false; });
      titan.update(centerX, centerZ);
      baseFog = scene.fog.density;
    } else {
      paintSky(look.top, look.bottom);
      scene.background = skyTexture;
      scene.fog = new THREE.FogExp2(new THREE.Color(look.fog), look.density);
      baseFog = look.density;
      world.add(groundMesh(planet, battle));
      if (look.liquid) world.add(liquidMesh(battle));
    }
    decorate(planet, battle, rand);
    for (const zone of battle.zones) buildZone(zone, battle, planet);
  }

  function groundMesh(planet, battle) {
    const { centerX, centerZ, half } = battle.map;
    const size = half * 3.6, segments = 220;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments).rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    let low = Infinity, high = -Infinity;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i) + centerX, z = position.getZ(i) + centerZ;
      const y = terrain.heightAt(x, z);
      position.setXYZ(i, x, y, z);
      low = Math.min(low, y); high = Math.max(high, y);
    }
    geometry.computeVertexNormals();
    const normal = geometry.attributes.normal;
    const colors = new Float32Array(position.count * 3);
    const lowC = new THREE.Color(look.low), highC = new THREE.Color(look.high), steepC = new THREE.Color(look.steep);
    const sand = new THREE.Color("#c9b98a"), c = new THREE.Color();
    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i);
      c.copy(lowC).lerp(highC, Math.min(1, Math.max(0, (y - low) / Math.max(1, high - low))));
      const slope = 1 - normal.getY(i);
      c.lerp(steepC, Math.min(1, Math.max(0, (slope - 0.08) / 0.25)));
      if (terrain.liquid !== null && !terrain.solidLiquid && y < terrain.liquid + 1.6 && planet.biome !== "volcanic") c.lerp(sand, 0.6);
      const x = position.getX(i), z = position.getZ(i);
      const v = 0.92 + 0.16 * (Math.sin(x * 0.37 + z * 0.11) * Math.sin(z * 0.29 - x * 0.07) * 0.5 + 0.5);
      colors[i * 3] = c.r * v; colors[i * 3 + 1] = c.g * v; colors[i * 3 + 2] = c.b * v;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    mesh.userData.ownMaterial = true;
    mesh.name = "planet-ground";
    return mesh;
  }

  function liquidMesh(battle) {
    const { centerX, centerZ, half } = battle.map;
    const spec = look.liquid;
    const material = spec.lava
      ? new THREE.MeshBasicMaterial({ color: spec.color, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: spec.color, roughness: spec.rough ?? 0.2, metalness: spec.metal ?? 0.1, transparent: !terrain.solidLiquid, opacity: terrain.solidLiquid ? 1 : 0.88 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(half * 4.2, half * 4.2).rotateX(-Math.PI / 2), material);
    mesh.position.set(centerX, terrain.liquid, centerZ);
    mesh.userData.ownMaterial = true;
    mesh.name = "planet-liquid";
    return mesh;
  }

  // Rocks, trees, ice spikes or a skyline, kept clear of the zones.
  function decorate(planet, battle, rand) {
    const { centerX, centerZ, half } = battle.map;
    const clear = (x, z, margin) => battle.zones.every(zone => Math.hypot(zone.x - x, zone.z - z) > zone.radius + margin);
    const dry = (x, z) => terrain.liquid === null || terrain.solidLiquid || terrain.heightAt(x, z) > terrain.liquid + 0.5;
    const place = (count, margin, spread = 1.5) => {
      const spots = [];
      for (let i = 0; i < count * 3 && spots.length < count; i += 1) {
        const x = centerX + (rand() * 2 - 1) * half * spread, z = centerZ + (rand() * 2 - 1) * half * spread;
        if (clear(x, z, margin) && dry(x, z)) spots.push([x, z]);
      }
      return spots;
    };
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    const scatter = (geometry, material, spots, pose) => {
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, spots.length));
      mesh.count = spots.length;
      spots.forEach(([x, z], i) => {
        pose(dummy, x, z, color);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.userData.ownMaterial = true;
      world.add(mesh);
      return mesh;
    };
    const ground = (x, z) => terrain.heightAt(x, z);
    const rockColor = new THREE.Color(look.rock || "#777");
    if (planet.biome === "titan") return;
    if (planet.biome === "jungle" || planet.biome === "storm") {
      const trunk = new THREE.CylinderGeometry(0.25, 0.4, 1, 6).translate(0, 0.5, 0);
      const crown = new THREE.SphereGeometry(1, 8, 6).translate(0, 0, 0);
      const spots = place(planet.biome === "jungle" ? 900 : 350, 6);
      const heights = spots.map(() => 6 + rand() * 10);
      scatter(trunk, new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }), spots, (d, x, z, c) => {
        const h = heights[spots.findIndex(s => s[0] === x && s[1] === z)] || 8;
        d.position.set(x, ground(x, z), z); d.rotation.set(0, 0, 0); d.scale.set(1, h, 1); c.set(0xffffff);
      });
      scatter(crown, new THREE.MeshStandardMaterial({ roughness: 0.9 }), spots, (d, x, z, c) => {
        const h = heights[spots.findIndex(s => s[0] === x && s[1] === z)] || 8;
        d.position.set(x, ground(x, z) + h, z); d.scale.set(2.4 + h * 0.18, 1.4 + h * 0.1, 2.4 + h * 0.18);
        c.setHSL(planet.biome === "jungle" ? 0.26 + rand() * 0.08 : 0.3, 0.45, 0.22 + rand() * 0.12);
      });
    }
    if (planet.biome === "city") {
      const block = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const spots = place(420, 16, 1.6);
      scatter(block, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.4 }), spots, (d, x, z, c) => {
        const tall = 8 + rand() ** 2 * 40;
        d.position.set(x, ground(x, z) - 0.5, z); d.rotation.set(0, Math.round(rand() * 4) * Math.PI / 2, 0);
        d.scale.set(8 + rand() * 14, tall, 8 + rand() * 14);
        c.setHSL(0.72 + rand() * 0.08, 0.15, 0.3 + rand() * 0.25);
      });
    }
    if (planet.biome === "ice") {
      const spike = new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0);
      scatter(spike, new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }), place(260, 8), (d, x, z, c) => {
        d.position.set(x, ground(x, z) - 0.3, z); d.rotation.set((rand() - 0.5) * 0.4, rand() * 6, (rand() - 0.5) * 0.4);
        const h = 3 + rand() * 9; d.scale.set(h * 0.25, h, h * 0.25); c.setHSL(0.55, 0.5, 0.75 + rand() * 0.15);
      });
    }
    const rock = new THREE.IcosahedronGeometry(1, 0);
    scatter(rock, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), place(planet.biome === "city" ? 80 : 420, 3), (d, x, z, c) => {
      const s = 0.4 + rand() ** 3 * 4;
      d.position.set(x, ground(x, z) + s * 0.2, z); d.rotation.set(rand() * 3, rand() * 3, rand() * 3); d.scale.set(s * 1.3, s * 0.7, s);
      c.copy(rockColor).multiplyScalar(0.75 + rand() * 0.5);
    });
  }

  const buildings = buildingModels();
  function buildZone(zone, battle, planet) {
    const group = new THREE.Group();
    group.name = `zone-${zone.id}`;
    world.add(group);
    const at = (x, z) => terrain.heightAt(x, z);
    const base = new THREE.Mesh(drapedRing(zone.x, zone.z, zone.radius, 2.2, at), ringMaterial("#ffffff", 0.35));
    const control = new THREE.Mesh(drapedRing(zone.x, zone.z, zone.radius - 2.6, 1.6, at, 0.7), ringMaterial(swarmColor, 0.85));
    for (const ring of [base, control]) { ring.userData.ownMaterial = true; ring.renderOrder = 2; group.add(ring); }
    const y = at(zone.x, zone.z);
    const rand = seeded(zone.x * 31 + zone.z * 7 + 3);
    let beacon = null;
    if (zone.kind === "beachhead") {
      beacon = new THREE.Group();
      const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 22, 6), new THREE.MeshStandardMaterial({ color: 0x1d2328, metalness: 0.6, roughness: 0.35 }));
      spire.position.y = 11;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.35, 8, 32), new THREE.MeshBasicMaterial({ color: swarmColor, toneMapped: false }));
      halo.rotation.x = Math.PI / 2; halo.position.y = 16;
      for (const part of [spire, halo]) part.userData.ownMaterial = true;
      beacon.add(spire, halo);
      beacon.userData.halo = halo;
    } else if (zone.kind === "beacon") {
      beacon = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 9, 8), new THREE.MeshStandardMaterial({ color: 0x9aa4aa, metalness: 0.5, roughness: 0.4 }));
      pole.position.y = 4.5;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      lamp.position.y = 9.5;
      for (const part of [pole, lamp]) part.userData.ownMaterial = true;
      beacon.add(pole, lamp);
      beacon.userData.lamp = lamp;
    } else if (zone.kind === "relic") {
      // NASA's Dragonfly, parked on its skids where the simulator's missions begin.
      beacon = dragonflyClone();
      beacon.scale.setScalar(dragonflyScale);
      beacon.rotation.y = 0.6;
      beacon.position.y = 0.86 * dragonflyScale;
    } else if (zone.kind === "mine") {
      beacon = new THREE.Group();
      const crystal = new THREE.OctahedronGeometry(1, 0);
      for (let i = 0; i < 7; i += 1) {
        const shard = new THREE.Mesh(crystal, new THREE.MeshStandardMaterial({ color: 0xffc860, emissive: 0xb06010, emissiveIntensity: 0.8, roughness: 0.3 }));
        shard.userData.ownMaterial = true;
        const a = i / 7 * Math.PI * 2, r = i === 0 ? 0 : 3.5;
        shard.position.set(Math.cos(a) * r, 1.5 + rand() * 1.5, Math.sin(a) * r);
        shard.scale.set(1.2, 2.5 + rand() * 2, 1.2);
        shard.rotation.set(rand() * 0.5, rand() * 3, rand() * 0.5);
        beacon.add(shard);
      }
    }
    if (beacon) { beacon.position.x = zone.x; beacon.position.z = zone.z; beacon.position.y += y; group.add(beacon); }
    if (battle.tier > 0 && zone.kind !== "beachhead") houses(zone, battle, group, rand);
    zoneVisuals.set(zone.id, { base, control, beacon });
  }

  function houses(zone, battle, group, rand) {
    const count = zone.kind === "capital" ? 24 : zone.kind === "mine" ? 5 : 13;
    const tier = battle.tier;
    const structures = battle.units.filter(u => u.structure);
    const spots = [];
    for (let i = 0; i < count * 6 && spots.length < count; i += 1) {
      const a = rand() * Math.PI * 2, r = zone.radius * (0.35 + rand() * 0.95);
      const x = zone.x + Math.cos(a) * r, z = zone.z + Math.sin(a) * r;
      if (structures.some(s => Math.hypot(s.x - x, s.z - z) < 7) || spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 6)) continue;
      if (terrain.liquid !== null && !terrain.solidLiquid && terrain.heightAt(x, z) < terrain.liquid + 0.3) continue;
      spots.push([x, z]);
    }
    const color = new THREE.Color(societyColors[tier]);
    const dummy = new THREE.Object3D();
    const huts = tier === 1;
    const body = new THREE.InstancedMesh(huts ? buildings.hut : buildings.body, bodyMaterial, Math.max(1, spots.length));
    const roof = huts ? null : new THREE.InstancedMesh(buildings.roof, bodyMaterial, Math.max(1, spots.length));
    body.userData.shared = true;
    if (roof) roof.userData.shared = true;
    spots.forEach(([x, z], i) => {
      const y = terrain.heightAt(x, z);
      const w = huts ? 3 + rand() * 2 : 4 + rand() * 5, d = huts ? w : 4 + rand() * 5;
      const h = huts ? w : tier === 2 ? 3 + rand() * 2 : tier === 3 ? 5 + rand() * 6 : tier === 4 ? 8 + rand() * 14 : 10 + rand() * 20;
      dummy.position.set(x, y - 0.2, z);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(w, huts ? w : h, d);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      body.setColorAt(i, new THREE.Color().copy(color).multiplyScalar(0.75 + rand() * 0.4));
      if (roof) {
        dummy.position.y = y - 0.2 + h;
        dummy.scale.set(w * 1.05, tier >= 4 ? 0.3 : 2.4, d * 1.05);
        dummy.updateMatrix();
        roof.setMatrixAt(i, dummy.matrix);
        roof.setColorAt(i, new THREE.Color(tier >= 4 ? "#9fb3c8" : "#7a3b2a").multiplyScalar(0.8 + rand() * 0.3));
      }
    });
    body.count = spots.length;
    group.add(body);
    if (roof) { roof.count = spots.length; group.add(roof); }
  }

  // ---- Per frame ----
  const dummy = new THREE.Object3D(), tint = new THREE.Color(), point = new THREE.Vector3();
  const squadColors = new Map();

  function unitHeight(unit) { return terrain.heightAt(unit.x, unit.z); }

  function placeDrone(unit, scale, time) {
    const bob = Math.sin(time * 2.1 + unit.id * 1.7) * 0.25 * Math.min(1, unit.alt / 5);
    dummy.position.set(unit.x, unitHeight(unit) + unit.alt + bob + 0.6, unit.z);
    const speed = Math.hypot(unit.vx, unit.vz);
    dummy.rotation.set(Math.min(0.35, speed * 0.02), unit.heading, 0, "YXZ");
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
  }

  function updateUnits(b, time) {
    for (const squad of b.squads) if (!squadColors.has(squad.id)) squadColors.set(squad.id, new THREE.Color(squad.color));
    const counts = {};
    for (const mesh of Object.values(droneMeshes)) { mesh.body.count = 0; mesh.glow.count = 0; mesh.discs.count = 0; }
    for (const mesh of Object.values(structureMeshes)) { mesh.body.count = 0; mesh.glow.count = 0; }
    figures.count = 0; interceptors.count = 0;
    let dragonflyIndex = 0;
    for (const unit of b.units) {
      if (unit.side === "swarm" && !unit.structure) {
        if (unit.type === "dragonfly") {
          let clone = dragonflies[dragonflyIndex];
          if (!clone) { clone = dragonflyClone(); dragonflies.push(clone); world.add(clone); }
          if (clone.parent !== world) world.add(clone);
          clone.visible = true;
          clone.position.set(unit.x, unitHeight(unit) + unit.alt + 0.86 * dragonflyScale, unit.z);
          clone.rotation.set(0, unit.heading + Math.PI, 0);
          clone.scale.setScalar(dragonflyScale);
          const spin = unit.alt > 0.3 || !unit.landed ? 1 : Math.max(0, unit.alt / 0.3);
          clone.userData.rotors.forEach((rotor, i) => { rotor.rotation.y += rotor.userData.spin * 0.6 * spin + (i === 0 ? 0 : 0); });
          dragonflyIndex += 1;
          continue;
        }
        const mesh = droneMeshes[unit.type];
        if (!mesh) continue;
        const index = mesh.body.count;
        placeDrone(unit, mesh.model.scale, time);
        mesh.body.setMatrixAt(index, dummy.matrix);
        mesh.glow.setMatrixAt(index, dummy.matrix);
        mesh.glow.setColorAt(index, squadColors.get(unit.squad) || swarmTint);
        mesh.body.count += 1; mesh.glow.count += 1;
        const parent = dummy.matrix.clone();
        for (const [x, y, z, r] of mesh.model.rotors) {
          point.set(x, y, z).applyMatrix4(parent);
          dummy.position.copy(point);
          dummy.scale.setScalar(r * mesh.model.scale);
          dummy.updateMatrix();
          mesh.discs.setMatrixAt(mesh.discs.count, dummy.matrix);
          mesh.discs.count += 1;
        }
        counts[unit.type] = (counts[unit.type] || 0) + 1;
      } else if (unit.structure) {
        const mesh = structureMeshes[unit.type];
        if (!mesh) continue;
        const index = mesh.body.count;
        dummy.position.set(unit.x, unitHeight(unit) - 0.1, unit.z);
        dummy.rotation.set(0, unit.heading, 0);
        dummy.scale.setScalar(1.4);
        dummy.updateMatrix();
        mesh.body.setMatrixAt(index, dummy.matrix);
        mesh.glow.setMatrixAt(index, dummy.matrix);
        mesh.body.setColorAt(index, unit.converted ? tint.setRGB(0.7, 0.95, 1) : tint.setRGB(1, 1, 1));
        mesh.glow.setColorAt(index, unit.side === "swarm" ? swarmTint : nativeTint);
        mesh.body.count += 1; mesh.glow.count += 1;
      } else if (unit.type === "interceptor") {
        const index = interceptors.count;
        placeDrone(unit, 4, time);
        interceptors.setMatrixAt(index, dummy.matrix);
        interceptors.setColorAt(index, tint.setRGB(1, 1, 1));
        interceptors.count += 1;
      } else {
        const index = figures.count;
        const step = Math.hypot(unit.vx, unit.vz) > 0.5 ? Math.abs(Math.sin(time * 9 + unit.id)) * 0.25 : 0;
        dummy.position.set(unit.x, unitHeight(unit) + step, unit.z);
        dummy.rotation.set(0, unit.heading, 0);
        dummy.scale.setScalar(3);
        dummy.updateMatrix();
        figures.setMatrixAt(index, dummy.matrix);
        figures.setColorAt(index, tint.set(societyColors[b.tier] || "#888"));
        figures.count += 1;
      }
    }
    for (let i = dragonflyIndex; i < dragonflies.length; i += 1) dragonflies[i].visible = false;
    const flag = (mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    for (const mesh of Object.values(droneMeshes)) { flag(mesh.body); flag(mesh.glow); flag(mesh.discs); }
    for (const mesh of Object.values(structureMeshes)) { flag(mesh.body); flag(mesh.glow); }
    flag(figures); flag(interceptors);
  }

  function updateZones(b, time) {
    for (const zone of b.zones) {
      const visual = zoneVisuals.get(zone.id);
      if (!visual) continue;
      const owned = zone.captured;
      visual.base.material.uniforms.color.value.set(owned ? swarmColor : zone.kind === "beacon" || zone.kind === "relic" || b.tier === 0 ? "#e8e2d0" : nativeColor);
      visual.base.material.uniforms.opacity.value = zone.contested ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(time * 8)) : owned ? 0.55 : 0.35;
      visual.control.material.uniforms.progress.value = owned ? 0 : zone.control / 100;
      visual.control.visible = !owned && zone.control > 0;
      if (visual.beacon?.userData.lamp) visual.beacon.userData.lamp.material.color.set(owned ? swarmColor : "#ffffff");
      if (visual.beacon?.userData.halo) visual.beacon.userData.halo.rotation.z = time * 0.8;
    }
  }

  // Shots: a short tracer racing to the target, a laser beam, a slow missile or an arcing spear.
  const shotStyle = {
    tracer: { life: 0.16, length: 0.3 }, laser: { life: 0.22, length: 1 }, missile: { life: 0.55, length: 0.12 },
    spear: { life: 0.45, length: 0.15, arc: true }, flak: { life: 0.2, length: 0.3 }, charge: { life: 0.3, length: 0.2 },
  };
  function unitPoint(unit, out) {
    const lift = unit.structure ? 4 : unit.side === "native" && !unit.alt ? 2 : 0.6;
    return out.set(unit.x, unitHeight(unit) + unit.alt + lift, unit.z);
  }
  function consume(b, events) {
    const index = new Map(b.units.map(u => [u.id, u]));
    const gone = new Map(events.filter(e => e.kind === "destroyed").map(e => [e.id, e]));
    for (const e of events) {
      if (e.kind === "shot" && shots.length < maxShots) {
        const from = index.get(e.from), to = index.get(e.to) || gone.get(e.to);
        if (!from || !to) continue;
        const a = unitPoint(from, new THREE.Vector3());
        const target = to.side ? to : null;
        const bpt = target ? unitPoint(target, new THREE.Vector3()) : new THREE.Vector3(to.x, terrain.heightAt(to.x, to.z) + (to.alt || 0), to.z);
        const style = shotStyle[e.fx] || shotStyle.tracer;
        const color = e.fx === "laser" ? (e.side === "swarm" ? swarmTint : new THREE.Color("#ff3355")) : e.side === "swarm" ? swarmTint : e.fx === "spear" ? new THREE.Color("#c8a070") : nativeTint;
        shots.push({ a, b: bpt, t: 0, ...style, color });
        if (e.fx === "flak") blast(bpt.x + (Math.random() - 0.5) * 6, bpt.y + (Math.random() - 0.5) * 4, bpt.z + (Math.random() - 0.5) * 6, 3, 0xffd0a0, 0.35);
        if (e.fx === "charge") blast(bpt.x, bpt.y, bpt.z, 5, 0xffb060, 0.5);
      } else if (e.kind === "destroyed") {
        const y = terrain.heightAt(e.x, e.z) + (e.alt || 0) + (e.structure ? 4 : 1);
        blast(e.x, y, e.z, e.structure ? 16 : e.side === "swarm" ? 6 : 4, e.side === "swarm" ? 0x9fe8ff : 0xffa040, e.structure ? 1.1 : 0.7);
        blast(e.x, y + 1, e.z, e.structure ? 18 : 6, 0, e.structure ? 2.5 : 1.2, true);
      } else if (e.kind === "strike") {
        const y = terrain.heightAt(e.x, e.z);
        if (e.source === "lightning") {
          const pts = [];
          let x = e.x, z = e.z;
          for (let i = 0; i <= 14; i += 1) {
            pts.push(new THREE.Vector3(x, y + 280 * (1 - i / 14), z));
            x = e.x + (Math.random() - 0.5) * 14 * (1 - i / 14); z = e.z + (Math.random() - 0.5) * 14 * (1 - i / 14);
          }
          pts[pts.length - 1].set(e.x, y, e.z);
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), boltMaterial);
          effectGroup.add(line);
          bolts.push({ line, t: 0 });
          flash = 1;
          blast(e.x, y + 2, e.z, 14, 0xd8e8ff, 0.4);
        } else {
          blast(e.x, y + 3, e.z, 26, 0xff8a30, 1.0);
          blast(e.x, y + 4, e.z, 30, 0, 2.2, true);
        }
      } else if (e.kind === "order") {
        pings.push({ x: e.x, z: e.z, t: 0, color: e.order === "attack" ? "#ff5a4a" : e.order === "capture" ? swarmColor : "#ffffff" });
      } else if (e.kind === "captured") {
        const y = terrain.heightAt(e.x, e.z);
        blast(e.x, y + 6, e.z, 40, 0x7ce7ff, 1.2);
      }
    }
  }

  function updateEffects(b, dt, time) {
    let n = 0;
    shots = shots.filter(s => (s.t += dt) < s.life);
    for (const s of shots) {
      const u = s.t / s.life;
      const head = Math.min(1, u * (1 + s.length)), tail = Math.max(0, head - s.length);
      const ax = s.a.x + (s.b.x - s.a.x) * tail, ay = s.a.y + (s.b.y - s.a.y) * tail, az = s.a.z + (s.b.z - s.a.z) * tail;
      const bx = s.a.x + (s.b.x - s.a.x) * head, by = s.a.y + (s.b.y - s.a.y) * head, bz = s.a.z + (s.b.z - s.a.z) * head;
      const arc = s.arc ? 4 : 0;
      shotPositions.set([ax, ay + arc * Math.sin(tail * Math.PI), az, bx, by + arc * Math.sin(head * Math.PI), bz], n * 6);
      const fade = s.length === 1 ? 1 - u : 1;
      shotColors.set([s.color.r * fade, s.color.g * fade, s.color.b * fade, s.color.r * fade, s.color.g * fade, s.color.b * fade], n * 6);
      n += 1;
    }
    shotGeometry.setDrawRange(0, n * 2);
    shotGeometry.attributes.position.needsUpdate = true;
    shotGeometry.attributes.color.needsUpdate = true;
    for (const slot of blasts) {
      if (!slot.sprite.visible) continue;
      slot.t += dt;
      const u = slot.t / slot.life;
      if (u >= 1) { slot.sprite.visible = false; continue; }
      const s = slot.size * (slot.smoke ? 0.5 + u : 0.4 + u * 0.8);
      slot.sprite.scale.set(s, s, 1);
      slot.sprite.material.opacity = slot.smoke ? 0.5 * (1 - u) : (1 - u) ** 1.5;
      if (slot.smoke) slot.sprite.position.y += dt * 3;
    }
    // Marked circles: strikes about to land, eruptions, and order pings.
    let m = 0;
    const mark = (x, z, radius, color, opacity) => {
      if (m >= markers.length) return;
      const mesh = markers[m++];
      mesh.visible = true;
      mesh.position.set(x, terrain.heightAt(x, z) + 1, z);
      mesh.scale.setScalar(radius);
      mesh.material.color.set(color);
      mesh.material.opacity = opacity;
    };
    for (const strike of b.strikes) {
      if (strike.hit) continue;
      const u = Math.min(1, (b.time - strike.markedAt) / Math.max(0.1, strike.hitAt - strike.markedAt));
      mark(strike.x, strike.z, strike.radius, strike.source === "lightning" ? "#cfe0ff" : "#ff4a3a", 0.35 + 0.5 * Math.abs(Math.sin(time * (6 + u * 14))));
    }
    const erupting = [];
    for (const event of b.hazards.events) {
      if (event.kind !== "eruption") continue;
      mark(event.x, event.z, event.radius, "#ff3a1a", event.phase === "warning" ? 0.4 + 0.4 * Math.abs(Math.sin(time * 5)) : 0.85);
      if (event.phase === "active") erupting.push(event);
    }
    pings.splice(0, pings.length, ...pings.filter(p => (p.t += dt) < 0.7));
    for (const p of pings) mark(p.x, p.z, 3 + p.t * 14, p.color, 0.9 * (1 - p.t / 0.7));
    for (; m < markers.length; m += 1) markers[m].visible = false;
    lava.forEach((drop, i) => {
      const event = erupting[i % Math.max(1, erupting.length)];
      drop.sprite.visible = !!event;
      if (!event) return;
      const u = (time * 0.6 + drop.phase) % 1;
      const r = drop.spread * event.radius * 0.5 * u;
      drop.sprite.position.set(event.x + Math.cos(drop.angle) * r, terrain.heightAt(event.x, event.z) + 40 * u - 45 * u * u + 2, event.z + Math.sin(drop.angle) * r);
      const s = 4 + 6 * (1 - u);
      drop.sprite.scale.set(s, s, 1);
      drop.sprite.material.opacity = 1 - u * 0.7;
    });
    for (const bolt of bolts) bolt.t += dt;
    for (const bolt of bolts.filter(x => x.t > 0.3)) { effectGroup.remove(bolt.line); bolt.line.geometry.dispose(); }
    bolts.splice(0, bolts.length, ...bolts.filter(x => x.t <= 0.3));
    for (const bolt of bolts) bolt.line.material.opacity = 1 - bolt.t / 0.3;
    flash = Math.max(0, flash - dt * 4);
  }

  function updateWeather(b, focus, time) {
    const events = b.hazards.events.filter(e => weatherLooks[e.type]);
    let style = null, amount = 0;
    for (const e of events) {
      const level = e.phase === "active" ? 1 : Math.max(0, 1 - (e.activeAt - b.time) / 4);
      if (level > amount) { amount = level; style = weatherLooks[e.type]; }
    }
    const flare = b.hazards.events.find(e => e.type === "solarFlare");
    const flareLevel = flare ? (flare.phase === "active" ? 1 : Math.max(0, 1 - (flare.activeAt - b.time) / 3) * 0.4) : 0;
    if (scene.fog) scene.fog.density = baseFog * (1 + (style ? (style.haze - 1) * amount : 0));
    hemi.intensity = look.hemi * (1 + flash * 1.5 + flareLevel * 0.8);
    sun.intensity = look.sunI * (style ? 1 - 0.45 * amount : 1) * (1 + flareLevel);
    if (titan) titan.setWeather(b.planetId === "titan" && style ? { haze: amount * 0.5, wetness: amount * 0.6 } : null);
    weather.visible = !!style && amount > 0.02;
    if (!weather.visible) return;
    weatherMaterial.color.set(style.color);
    weatherMaterial.size = style.size;
    weatherMaterial.opacity = 0.75 * amount;
    const wind = b.hazards.effects.wind;
    const span = 260, height = 140;
    const ground = terrain.heightAt(focus.x, focus.z);
    for (let i = 0; i < weatherCount; i += 1) {
      const sx = weatherSeeds[i * 3], sy = weatherSeeds[i * 3 + 1], sz = weatherSeeds[i * 3 + 2];
      const fall = ((sy * height - time * (style.fall + sy * 4)) % height + height) % height;
      const drift = time * (wind.x * 2 + (style.fall <= 0 ? 12 : 0));
      weatherPositions[i * 3] = focus.x + ((((sx * span + drift) % span) + span) % span) - span / 2;
      weatherPositions[i * 3 + 1] = ground + fall;
      weatherPositions[i * 3 + 2] = focus.z + ((((sz * span + time * wind.z * 2) % span) + span) % span) - span / 2;
    }
    weatherGeometry.attributes.position.needsUpdate = true;
  }

  function updatePods(b) {
    for (const slot of podSlots) {
      const pod = slot.pod && b.pods.find(p => p.id === slot.pod);
      if (!pod) slot.pod = null;
    }
    for (const pod of b.pods) {
      if (podSlots.some(s => s.pod === pod.id)) continue;
      const free = podSlots.find(s => !s.pod) || createPodSlot();
      free.pod = pod.id;
      const types = Object.entries(pod.payload).flatMap(([type, n]) => Array(n).fill(type));
      // Legacy giant pods remain loadable; new pods show the actual 1–3 payload bodies.
      free.cluster.children.forEach((mesh, i) => {
        mesh.visible = i < types.length && types[i] !== "dragonfly";
        mesh.geometry = (models[types[i]] || models.scout).body;
      });
      if (types.includes("dragonfly") && !free.dragonfly) {
        free.dragonfly = dragonflyClone();
        free.dragonfly.scale.setScalar(dragonflyScale);
        free.craft.add(free.dragonfly);
      }
      if (free.dragonfly) free.dragonfly.visible = types.includes("dragonfly");
    }
    for (const slot of podSlots) {
      const pod = slot.pod && b.pods.find(p => p.id === slot.pod);
      if (!pod || pod.t < 0) { slot.hardware.pose(null); slot.craft.visible = false; continue; }
      const u = Math.min(1, pod.t / dropDurationS);
      const edlT = pod.t <= dropDurationS ? u * 41 : 41 + (pod.t - dropDurationS) * 1.5;
      const altitude = pod.t <= dropDurationS ? 30 + 620 * (1 - u) ** 2 : 30;
      const e = { ...edlStateAt(edlT), altitudeM: altitude, renderAltitudeM: altitude, speedCue: 0 };
      slot.craft.position.set(pod.x, terrain.heightAt(pod.x, pod.z) + altitude, pod.z);
      slot.craft.rotation.set(0, e.t * 0.2, 0);
      slot.hardware.pose(e, camera.position);
      if (pod.released) slot.craft.visible = false;
    }
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  // view: { focus: {x, z}, distance, yaw, pitch }
  function setCamera(view) {
    const ground = terrain ? terrain.heightAt(view.focus.x, view.focus.z) : 0;
    const horizontal = Math.cos(view.pitch) * view.distance;
    camera.position.set(view.focus.x + Math.sin(view.yaw) * horizontal, ground + Math.sin(view.pitch) * view.distance, view.focus.z + Math.cos(view.yaw) * horizontal);
    if (terrain) camera.position.y = Math.max(camera.position.y, terrain.heightAt(camera.position.x, camera.position.z) + 4);
    camera.lookAt(view.focus.x, ground, view.focus.z);
    camera.updateMatrixWorld();
    sun.position.set(view.focus.x - 300, ground + 500, view.focus.z - 200);
    sun.target.position.set(view.focus.x, ground, view.focus.z);
    if (titan?.group.visible) titan.update(view.focus.x, view.focus.z);
  }

  function frame(b, view, events, dt, time) {
    setCamera(view);
    consume(b, events);
    updateUnits(b, time);
    updateZones(b, time);
    updateEffects(b, dt, time);
    updateWeather(b, view.focus, time);
    updatePods(b);
    renderer.render(scene, camera);
  }

  // Where a screen point (normalized -1..1) meets the ground, by marching along the view ray.
  const raycaster = new THREE.Raycaster();
  function pickGround(ndcX, ndcY) {
    if (!terrain) return null;
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const { origin, direction } = raycaster.ray;
    let previous = 0;
    for (let t = 2; t < 6000; t += Math.max(2, t * 0.01)) {
      const x = origin.x + direction.x * t, y = origin.y + direction.y * t, z = origin.z + direction.z * t;
      if (y <= terrain.heightAt(x, z)) {
        let low = previous, high = t;
        for (let i = 0; i < 10; i += 1) {
          const mid = (low + high) / 2;
          const mx = origin.x + direction.x * mid, my = origin.y + direction.y * mid, mz = origin.z + direction.z * mid;
          if (my <= terrain.heightAt(mx, mz)) high = mid; else low = mid;
        }
        return { x: origin.x + direction.x * high, z: origin.z + direction.z * high };
      }
      previous = t;
    }
    return null;
  }

  const projected = new THREE.Vector3();
  // Screen position (CSS px) of a world point; visible is false behind the camera.
  function project(x, y, z, width, height) {
    projected.set(x, y, z).project(camera);
    return { x: (projected.x + 1) / 2 * width, y: (1 - projected.y) / 2 * height, visible: projected.z < 1 && projected.z > -1 };
  }

  const unitTop = (unit) => terrain.heightAt(unit.x, unit.z) + unit.alt + (unit.structure ? 15 : unit.side === "swarm" ? 4 : 6.5);

  return { renderer, scene, camera, load, unload, frame, resize, setCamera, pickGround, project, unitTop, heightAt: (x, z) => terrain?.heightAt(x, z) ?? 0 };
}
