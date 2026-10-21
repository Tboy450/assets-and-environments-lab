import * as THREE from "./vendor/three/three.module.min.js";
import { pools, poolRadius, surveySite, dampGround, candidateSites } from "./mission-systems.mjs?v=dev";

function hash(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let u = x - ix, v = z - iz;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  const a = hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u;
  const b = hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u;
  return a * (1 - v) + b * v;
}

// Landing area: Ahmakiq Undae (IAU name, Sept 2026), "dunes and interdune areas to the south of
// Selk Crater, extending to the edge of a range of hills or mountains" [PUB, NASA Dragonfly blog
// 2026-09-02]. Titan's equatorial dunes are linear, ~100 m high, 1-2 km wide, hundreds of km
// long, running roughly west-east, made of dark hydrocarbon sand [PUB, JPL]. The layout here is
// illustrative [EST]: the mission area lies in a ~2 km wide interdune corridor between two dunes
// (crests ~1.5-1.8 km north and south of the base, trending 8 degrees north of east), with hills
// beyond the northern dune, toward Selk. The previous mountain-basin map is archived in
// archive/mountain-basin-map. Coordinates: x is east, -z is north.
const duneTrend = 8 * Math.PI / 180, duneCos = Math.cos(duneTrend), duneSin = Math.sin(duneTrend);
const duneSpacing = 3200, duneCrestNorth = 1450, duneHalfWidth = 600;
const hillsStart = 2700, hillsFull = 3600;

// [EST] Sparse landmarks, not mapped Titan peaks. Compact footprints leave the base and
// surveyed flight corridor untouched; only two summits are pointed, not every mesh vertex.
export const mountainLandmarks = Object.freeze([
  { x: -1100, z: -2450, height: 370, rx: 690, rz: 570, angle: 0.4, pointed: true },
  { x: 2650, z: -1100, height: 260, rx: 610, rz: 760, angle: -0.6, pointed: false },
  { x: -2300, z: 700, height: 290, rx: 700, rz: 590, angle: 0.8, pointed: false },
  { x: 1550, z: 2600, height: 330, rx: 660, rz: 540, angle: -0.3, pointed: true },
].map(Object.freeze));

export function mountainRelief(x, z, cell = 0) {
  let relief = 0;
  for (const peak of mountainLandmarks) {
    const dx = x - peak.x, dz = z - peak.z;
    if (Math.abs(dx) > peak.rx + peak.rz || Math.abs(dz) > peak.rx + peak.rz) continue;
    const c = Math.cos(peak.angle), s = Math.sin(peak.angle);
    const u = (dx * c + dz * s) / peak.rx, v = (-dx * s + dz * c) / peak.rz;
    const r = Math.hypot(u, v);
    if (r >= 1) continue;
    const direction = Math.atan2(v, u);
    // Broad unequal spurs stay resolvable at distance, with a smooth toe into the dunes.
    const spurs = 1 + 0.16 * Math.sin(direction * 3 + 0.7) * r + 0.09 * Math.cos(direction * 5) * r;
    const rounding = peak.pointed ? Math.max(0.018, (cell > 20 ? cell * 0.28 : 0) / Math.min(peak.rx, peak.rz)) : 0.24;
    const radius = (Math.sqrt(r * r + rounding * rounding) - rounding)
      / (Math.sqrt(1 + rounding * rounding) - rounding);
    relief += peak.height * (1 - radius) ** 1.65 * (1 + radius * 0.65) * spurs;
  }
  return relief;
}

function duneAxes(x, z) {
  const north = -z;
  return { along: x * duneCos + north * duneSin, across: -x * duneSin + north * duneCos };
}

// Dune height (m) and sand cover (0-1) at a point, ignoring the hills.
function duneAt(along, across) {
  const meander = 120 * Math.sin(along / 2300 + 0.6) + 120 * (noise(along / 1400 + 3, 5.5) - 0.5);
  const offset = across - meander - duneCrestNorth;
  const k = Math.round(offset / duneSpacing);
  const halfWidth = duneHalfWidth * (0.85 + 0.3 * noise(along / 2100 - k * 2.2, k + 0.5));
  const u = Math.abs(offset - k * duneSpacing) / halfWidth;
  if (u >= 1) return { height: 0, sand: 0 };
  const crest = 75 + 45 * noise(along / 1800 + k * 7.3, k * 3.1);
  // Rounded toe, gentle flanks (~8 degrees) and a defined crest.
  return { height: crest * (1 - u) ** 1.35 * (1 + 0.35 * u), sand: smoothUnit((1 - u) / 0.3) };
}

// Sand cover for ground shading: 1 on dunes, 0 on interdunes and hills.
export function terrainSand(x, z) {
  const { along, across } = duneAxes(x, z);
  return duneAt(along, across).sand * (1 - smoothUnit((across - hillsStart) / (hillsFull - hillsStart)))
    * (1 - smoothUnit(mountainRelief(x, z) / 35));
}

// Far-terrain level of detail. The rendered mesh gets coarser away from its center (up to ~80 m
// between vertices at the edge). Detail finer than the spacing can show would alias into
// spikes, and single vertices landing on a sharp ridge crest would stand up as saw teeth. So
// where the spacing (cell, m) is coarse, fine noise layers fade to their average and the hills'
// ridge shape is averaged over the cell (center and four corners), which keeps their size.
// Spacings up to 20 m (everywhere the vehicle can be, since the mesh recenters every 400 m)
// keep the full detail.
const smoothUnit = (value) => { const u = Math.max(0, Math.min(1, value)); return u * u * (3 - 2 * u); };
const farDetail = (cell) => smoothUnit((cell - 20) / 12);
function layer(value, wavelength, cell, far) {
  if (far === 0) return value;
  const keep = 1 - (1 - Math.max(0, Math.min(1, (wavelength / 3 - cell) / (wavelength / 6)))) * far;
  return 0.5 + (value - 0.5) * keep;
}

// Hills toward Selk (the photo-textured ridges of the archived map, beyond the northern dune).
function hillsAt(x, z, cell, far) {
  const wx = x + 92 * (noise(x / 410 + 12, z / 410 - 8) - 0.5);
  const wz = z + 80 * (noise(x / 470 - 5, z / 470 + 17) - 0.5);
  const ridgeAt = (dx, dz) => {
    const px = wx + dx, pz = wz + dz;
    return (1 - Math.abs(noise((px * 0.91 + pz * 0.41) / 290 + 7, (pz * 0.91 - px * 0.41) / 290 - 3) * 2 - 1)) ** 3;
  };
  let ridge = ridgeAt(0, 0);
  if (far > 0) {
    const step = cell * 0.5;
    const corners = ridgeAt(step, step) + ridgeAt(-step, step) + ridgeAt(step, -step) + ridgeAt(-step, -step);
    ridge += ((ridge + corners) / 5 - ridge) * far;
  }
  const relief = ridge * (100 + noise(x / 700, z / 700) * 220);
  const gullies = layer(noise(x / 74, z / 74), 74, cell, far) * 24 + layer(noise(x / 25, z / 25), 25, cell, far) * 7;
  return (relief + gullies) * 0.34;
}

function baseHeight(x, z, cell = 0) {
  const far = farDetail(cell);
  const { along, across } = duneAxes(x, z);
  // Interdune floor: broad gentle swells, low hummocks and gravelly roughness.
  let height = noise(x / 380 + 4, z / 380 - 2) * 3 + layer(noise(x / 74, z / 74), 74, cell, far) * 1.6
    + layer(noise(x / 42, z / 42), 42, cell, far) * 1.3 + layer(noise(x / 9, z / 9), 9, cell, far) * 0.13;
  const hills = smoothUnit((across - hillsStart) / (hillsFull - hillsStart));
  height += duneAt(along, across).height * (1 - hills);
  if (hills > 0) height += hillsAt(x, z, cell, far) * hills;
  height += mountainRelief(x, z, cell);
  return height;
}

// Each puddle's surface sits just below the lowest ground around it, so liquid never floats above its banks.
export const poolLevels = pools.map((pool) => {
  let lowest = Infinity;
  for (let i = 0; i < 72; i++) {
    const angle = i / 72 * Math.PI * 2;
    for (const ring of [1, 1.2, 1.45]) {
      const r = ring * (1 + 0.09 * Math.sin(angle * 3) + 0.05 * Math.cos(angle * 5));
      lowest = Math.min(lowest, baseHeight(pool.x + Math.cos(angle) * pool.rx * r, pool.z - Math.sin(angle) * pool.rz * r));
    }
  }
  return lowest - 0.06;
});

export const outcropLevel = baseHeight(surveySite.x, surveySite.z) + 0.8;

// Candidate landing sites were chosen for low relief; each gets a level 10 m safe landing circle.
const landingPads = candidateSites.filter(site => site.id !== "outcrop")
  .map(site => ({ x: site.x, z: site.z, height: baseHeight(site.x, site.z) }));

// cell: mesh spacing at this point in m (0 = full detail); see the level-of-detail note above.
export function terrainHeight(x, z, cell = 0) {
  let height = baseHeight(x, z, cell);
  for (const pad of landingPads) {
    const distance = Math.hypot(x - pad.x, z - pad.z);
    if (distance < 24) {
      const blend = Math.max(0, Math.min(1, (distance - 10) / 14));
      height = pad.height * (1 - blend) + height * blend;
    }
  }
  pools.forEach((pool, index) => {
    const radius = poolRadius(x, z, pool);
    if (radius < 1.4) {
      const blend = Math.max(0, Math.min(1, (radius - 0.72) / 0.68));
      height = (poolLevels[index] - pool.depth) * (1 - blend) + height * blend;
    }
  });
  // A small surveyed patch of slightly raised dry ground provides a reproducible landing target.
  const pad = Math.max(0, Math.min(1, (Math.hypot(x - surveySite.x, z - surveySite.z) - 14) / 12));
  return height * pad + outcropLevel * (1 - pad);
}

// Sample the same triangle split used by PlaneGeometry, including its slope.
export function sampleTerrainSurface(x, z, positions, segments) {
  const stride = segments + 1;
  function cell(value, axis, step) {
    let low = 0, high = segments;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (positions[middle * step * 3 + axis] <= value) low = middle;
      else high = middle;
    }
    return low;
  }
  const column = cell(x, 0, 1), row = cell(z, 2, stride);
  const a = (row * stride + column) * 3;
  const b = a + stride * 3, d = a + 3, c = b + 3;
  const dx = positions[d] - positions[a], dz = positions[b + 2] - positions[a + 2];
  const u = Math.max(0, Math.min(1, (x - positions[a]) / dx));
  const v = Math.max(0, Math.min(1, (z - positions[a + 2]) / dz));
  const [h00, h10, h01, h11] = [positions[a + 1], positions[d + 1], positions[b + 1], positions[c + 1]];
  const lower = u + v <= 1;
  const height = lower ? h00 + (h10 - h00) * u + (h01 - h00) * v
    : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  const sx = lower ? (h10 - h00) / dx : (h11 - h01) / dx;
  const sz = lower ? (h01 - h00) / dz : (h11 - h10) / dz;
  const length = Math.hypot(sx, 1, sz);
  return { height, normal: [-sx / length, 1 / length, -sz / length] };
}

// Haze density for the scene fog. Near the ground it is fixed (see createTitanTerrain). During the
// arrival, higher up, it thins so the ground below slowly emerges from the haze, but never so far
// that the edge of the terrain mesh (~4.9 km out) shows through: at the edge it keeps contrast
// under ~3% (FogExp2 contrast = exp(-(density * distance)^2)).
export const hazeDensity = 0.00055;
export const terrainReachM = 4870;
export function arrivalHazeDensity(altitudeM) {
  const u = Math.min(1, Math.max(0, (altitudeM - 400) / 800));
  const blend = u * u * (3 - 2 * u);
  return hazeDensity * (1 - blend) + 1.9 / Math.hypot(altitudeM, terrainReachM) * blend;
}

export function createTitanTerrain(scene, renderer) {
  const group = new THREE.Group();
  group.name = "titan-landscape";
  scene.add(group);
  // Haze: brighter orange at the horizon, deeper amber overhead. Visibility near the surface is
  // ~10 km [PUB]; the fog here is denser (~3.6 km for 2% contrast) so the 4.9 km terrain edge stays hidden.
  const horizonColor = new THREE.Color(0xc9955a), zenithColor = new THREE.Color(0x8a5a30);
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 2; skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext("2d");
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTexture;
  scene.fog = new THREE.FogExp2(horizonColor.clone(), hazeDensity);
  // Arrival only: a sky dome shaded by view direction. The flat background is fixed to the screen,
  // so when the camera looks steeply down its darker top band would outline the fogged far terrain;
  // the dome keeps the horizon level and seamless with the haze at any camera angle.
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, space: { value: 0 } },
    side: THREE.BackSide, depthTest: false, depthWrite: false,
    vertexShader: "varying vec3 vDirection; void main() { vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    // High up (space near 1) the dark sky reaches down almost to the hazy limb below.
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform float space; varying vec3 vDirection;
      void main() { gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.25 * space, 0.5 - 0.4 * space, vDirection.y)), 1.0);
      #include <colorspace_fragment>
      }`,
  }));
  skyDome.name = "arrival-sky";
  skyDome.renderOrder = -1;
  skyDome.frustumCulled = false;
  skyDome.visible = false;
  group.add(skyDome);
  // space (0-1) darkens the sky toward black overhead for the high-altitude arrival phases.
  const spaceZenith = new THREE.Color(0x0a0706), spaceHorizon = new THREE.Color(0x8c5424);
  function setDaylight(level, space = 0) {
    const scale = 0.12 + level * 0.88;
    const top = zenithColor.clone().multiplyScalar(scale).lerp(spaceZenith, space);
    const bottom = horizonColor.clone().multiplyScalar(scale).lerp(spaceHorizon, space * 0.6);
    const gradient = skyCtx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, `#${top.getHexString()}`);
    gradient.addColorStop(0.62, `#${bottom.getHexString()}`);
    gradient.addColorStop(1, `#${bottom.getHexString()}`);
    skyCtx.fillStyle = gradient;
    skyCtx.fillRect(0, 0, 2, 256);
    skyTexture.needsUpdate = true;
    scene.fog.color.copy(bottom);
    skyDome.material.uniforms.top.value.copy(top);
    skyDome.material.uniforms.bottom.value.copy(bottom);
    skyDome.material.uniforms.space.value = space;
  }
  let daylight = "";
  setDaylight(1);

  // Resolved from this module, so pages in subfolders (the invasion game) find the same image.
  const reference = new THREE.TextureLoader().load(new URL("./assets/titan-mountain-reference.jpg", import.meta.url).href);
  reference.colorSpace = THREE.SRGBColorSpace;
  reference.wrapS = reference.wrapT = THREE.ClampToEdgeWrapping;
  reference.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // Rain wetness (0-1) from the weather model darkens and glosses the damp interdune further.
  const rainWetness = { value: 0 };
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xa99576, map: reference, roughness: 1, metalness: 0,
  });
  // Both the reference texture and fine ground detail are anchored to world coordinates.
  groundMaterial.onBeforeCompile = (shader) => {
    // Per-vertex sand cover (1 on dunes) from terrainSand().
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
      attribute float sand;
      varying float vSand;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
      vSand = sand;`);
    shader.uniforms.rainWetness = rainWetness;
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `
      #include <common>
      uniform float rainWetness;
      varying float vSand;
      float terrainHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float terrainNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(terrainHash(i), terrainHash(i + vec2(1.0, 0.0)), f.x),
          mix(terrainHash(i + vec2(0.0, 1.0)), terrainHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      vec3 terrainPatch(sampler2D terrainMap, vec2 cell, vec2 p) {
        float angle = terrainHash(cell + 2.1) * 6.2831853;
        mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 offset = vec2(terrainHash(cell + 9.2), terrainHash(cell - 6.7)) - 0.5;
        vec2 uv = vec2(0.5) + rotation * (p - cell) * 0.20 + offset * 0.16;
        uv.y = 0.12 + uv.y * 0.76;
        return texture2D(terrainMap, uv).rgb;
      }
    `).replace("#include <map_fragment>", `
      vec2 groundPoint = vMapUv * 1100.0;
      vec2 patchPoint = groundPoint / 185.0;
      patchPoint += vec2(terrainNoise(patchPoint * 0.7), terrainNoise(patchPoint * 0.7 + 27.0)) * 0.45;
      vec2 cell = floor(patchPoint), blend = fract(patchPoint);
      blend = blend * blend * (3.0 - 2.0 * blend);
      vec3 referenceColor = mix(
        mix(terrainPatch(map, cell, patchPoint), terrainPatch(map, cell + vec2(1.0, 0.0), patchPoint), blend.x),
        mix(terrainPatch(map, cell + vec2(0.0, 1.0), patchPoint), terrainPatch(map, cell + vec2(1.0), patchPoint), blend.x), blend.y);
      float grains = terrainNoise(groundPoint * 2.5);
      float gravel = terrainNoise(groundPoint * 0.23);
      float detail = 0.82 + 0.24 * gravel + 0.18 * grains;
      // Dunes: dark hydrocarbon sand, smoother than the interdune, faintly streaked along their length.
      float duneAlong = groundPoint.x * ${duneCos.toFixed(5)} - groundPoint.y * ${duneSin.toFixed(5)};
      float duneAcross = -groundPoint.x * ${duneSin.toFixed(5)} - groundPoint.y * ${duneCos.toFixed(5)};
      float streak = terrainNoise(vec2(duneAlong * 0.003, duneAcross * 0.045));
      float ripples = terrainNoise(vec2(duneAlong * 0.05, duneAcross * 1.6));
      vec3 duneSand = vec3(0.24, 0.11, 0.045) * (0.8 + 0.22 * streak + 0.12 * ripples + 0.08 * grains);
      diffuseColor.rgb *= mix(referenceColor * detail, duneSand, vSand);
      // The ice-rich outcrop reads as paler, greyer ground.
      float outcrop = 1.0 - smoothstep(14.0, 26.0, distance(groundPoint, vec2(${surveySite.x.toFixed(1)}, ${surveySite.z.toFixed(1)})));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58, 0.57, 0.49) * detail, outcrop * 0.65);
      // Rain-darkened interdune: damp ground is darker and slightly glossier, with a ragged edge.
      vec2 dampOffset = (groundPoint - vec2(${dampGround.x.toFixed(1)}, ${dampGround.z.toFixed(1)})) / vec2(${dampGround.rx.toFixed(1)}, ${dampGround.rz.toFixed(1)});
      float dampEdge = length(dampOffset) + (terrainNoise(groundPoint * 0.045) - 0.5) * 0.34 + (terrainNoise(groundPoint * 0.2) - 0.5) * 0.08;
      float damp = 1.0 - smoothstep(0.72, 1.0, dampEdge);
      damp *= smoothstep(${(surveySite.radius + 2).toFixed(1)}, ${(surveySite.radius + 10).toFixed(1)}, distance(groundPoint, vec2(${surveySite.x.toFixed(1)}, ${surveySite.z.toFixed(1)})));
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.42, 0.43, 0.5), damp);
      diffuseColor.rgb *= 1.0 - damp * rainWetness * 0.25;
    `).replace("#include <roughnessmap_fragment>", `
      #include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.55 - rainWetness * 0.15, damp);
    `);
  };

  const segments = 240;
  const geometry = new THREE.PlaneGeometry(1, 1, segments, segments);
  const vertices = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const sandCover = new THREE.BufferAttribute(new Float32Array(vertices.count), 1);
  geometry.setAttribute("sand", sandCover);
  const terrain = new THREE.Mesh(geometry, groundMaterial);
  terrain.name = "titan-ground";
  terrain.receiveShadow = true;
  group.add(terrain);
  const liquidMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3230, roughness: 0.18, metalness: 0.25, side: THREE.DoubleSide });
  pools.forEach((pool, index) => {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 96; i++) {
      const a = i / 96 * Math.PI * 2;
      const r = 1 + 0.09 * Math.sin(a * 3) + 0.05 * Math.cos(a * 5);
      const x = Math.cos(a) * pool.rx * r, y = -Math.sin(a) * pool.rz * r;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), liquidMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(pool.x, poolLevels[index], pool.z);
    water.name = "methane-puddle";
    group.add(water);
  });
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x80f2ae, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
  const targetRing = new THREE.Mesh(new THREE.RingGeometry(10.95, 11.0, 96), markerMaterial);
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.set(surveySite.x, outcropLevel + 0.04, surveySite.z);
  targetRing.name = "survey-marker";
  group.add(targetRing);
  // Safe landing circles (10 m) at the candidate sites: green once scouted, amber before.
  const scoutedMaterial = new THREE.MeshBasicMaterial({ color: 0x80f2ae, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const candidateMaterial = new THREE.MeshBasicMaterial({ color: 0xffb457, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const siteRingGeometry = new THREE.RingGeometry(9.8, 10.2, 72);
  const siteRings = candidateSites.map((site) => {
    const ring = new THREE.Mesh(siteRingGeometry, candidateMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 1;
    ring.name = `site-${site.id}`;
    group.add(ring);
    return { ring, site };
  });
  let terrainX = NaN, terrainZ = NaN;
  let weatherHaze = 1;
  // Grid coordinate t (-1 to 1) to world position, and the distance between neighboring vertices there.
  const gridAt = (anchor, t) => anchor + t * 70 + Math.sign(t) * t * t * (terrainReachM - 70);
  const spacing = (t) => (70 + 2 * (terrainReachM - 70) * Math.abs(t)) * 2 / segments;
  // The mesh recenters in 400 m steps. The next mesh is built a few rows per frame into a spare
  // buffer and swapped in when complete, so crossing into a new square never stalls a frame.
  // A jump (start-up, restored mission, arrival) rebuilds at once instead.
  const rowsPerFrame = 8;
  const spare = new Float32Array(vertices.array.length), spareSand = new Float32Array(vertices.count);
  let build = null;

  function moveTerrain(x, z) {
    const anchorX = Math.round(x / 400) * 400;
    const anchorZ = Math.round(z / 400) * 400;
    if (anchorX === terrainX && anchorZ === terrainZ) { build = null; return false; }
    if (!build || build.anchorX !== anchorX || build.anchorZ !== anchorZ) build = { anchorX, anchorZ, row: 0 };
    const jumped = !(Math.max(Math.abs(x - terrainX), Math.abs(z - terrainZ)) < 320);
    const end = jumped ? segments + 1 : Math.min(segments + 1, build.row + rowsPerFrame);
    for (; build.row < end; build.row += 1) {
      const v = build.row / segments * 2 - 1;
      const worldZ = gridAt(anchorZ, v);
      for (let column = 0; column <= segments; column += 1) {
        const u = column / segments * 2 - 1;
        const worldX = gridAt(anchorX, u);
        const index = (build.row * (segments + 1) + column) * 3;
        spare[index] = worldX;
        spare[index + 1] = terrainHeight(worldX, worldZ, Math.max(spacing(u), spacing(v)));
        spare[index + 2] = worldZ;
        spareSand[index / 3] = terrainSand(worldX, worldZ);
      }
    }
    if (build.row <= segments) return false;
    build = null;
    terrainX = anchorX;
    terrainZ = anchorZ;
    vertices.array.set(spare);
    sandCover.array.set(spareSand);
    sandCover.needsUpdate = true;
    for (let index = 0; index < uv.count; index += 1) uv.setXY(index, vertices.getX(index) / 1100, vertices.getZ(index) / 1100);
    vertices.needsUpdate = true;
    uv.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return true;
  }

  const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x9a8c73, roughness: 1 });
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 1089);
  rocks.name = "titan-rocks";
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);
  const transform = new THREE.Object3D();
  const rockColor = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const twist = new THREE.Quaternion();
  const surfaceAt = (x, z) => sampleTerrainSurface(x, z, vertices.array, segments);
  let rockX = NaN, rockZ = NaN;
  function moveRocks(x, z, force = false) {
    const cellX = Math.floor(x / 8), cellZ = Math.floor(z / 8);
    if (!force && cellX === rockX && cellZ === rockZ) return;
    rockX = cellX;
    rockZ = cellZ;
    let index = 0;
    for (let row = -16; row <= 16; row += 1) {
      for (let column = -16; column <= 16; column += 1) {
        const gx = cellX + column, gz = cellZ + row;
        const worldX = (gx + hash(gx + 51, gz)) * 8;
        const worldZ = (gz + hash(gx, gz + 29)) * 8;
        // Icy pebbles lie on the interdune; dune sand buries them.
        const size = (0.08 + hash(gx + 4, gz + 7) ** 3 * 0.52) * (1 - smoothUnit((terrainSand(worldX, worldZ) - 0.1) / 0.5));
        const surface = surfaceAt(worldX, worldZ);
        normal.set(...surface.normal);
        transform.position.set(worldX, surface.height, worldZ).addScaledVector(normal, size * 0.12);
        transform.quaternion.setFromUnitVectors(up, normal);
        twist.setFromAxisAngle(up, hash(gz, gx) * Math.PI * 2);
        transform.quaternion.multiply(twist);
        transform.scale.set(size * 1.3, size * 0.55, size);
        transform.updateMatrix();
        rocks.setMatrixAt(index, transform.matrix);
        rockColor.setHSL(0.1, 0.14, 0.38 + hash(gx + 2, gz + 3) * 0.24);
        rocks.setColorAt(index, rockColor);
        index += 1;
      }
    }
    rocks.instanceMatrix.needsUpdate = true;
    rocks.instanceColor.needsUpdate = true;
    rocks.computeBoundingSphere();
  }

  moveTerrain(0, 0);
  moveRocks(0, 0);
  return {
    group,
    updateSites(scoutedIds) {
      for (const { ring, site } of siteRings) {
        ring.material = scoutedIds.includes(site.id) ? scoutedMaterial : candidateMaterial;
        ring.position.set(site.x, surfaceAt(site.x, site.z).height + 0.1, site.z);
      }
    },
    setDaylight(level, space = 0) {
      const rounded = Math.round(level * 50) / 50, roundedSpace = Math.round(space * 50) / 50;
      const key = `${rounded}/${roundedSpace}`;
      if (key !== daylight) { daylight = key; setDaylight(rounded, roundedSpace); }
    },
    heightAt: (x, z) => surfaceAt(x, z).height,
    // Weather (weather.mjs): storms thicken the haze; rain wets the damp interdune.
    setWeather(weather = null) {
      weatherHaze = 1 + (weather?.haze || 0) * 2.5;
      rainWetness.value = weather?.wetness || 0;
    },
    // Arrival only: thin the haze with altitude (0 restores the normal surface haze).
    setHazeAltitude(altitudeM = 0) { scene.fog.density = arrivalHazeDensity(altitudeM) * weatherHaze; },
    // Arrival only: center the sky dome on the camera (null hides it and restores the flat sky).
    setSkyDome(eye) {
      skyDome.visible = !!eye;
      if (eye) skyDome.position.copy(eye);
    },
    update(x, z) {
      const changed = moveTerrain(x, z);
      moveRocks(x, z, changed);
    },
  };
}
