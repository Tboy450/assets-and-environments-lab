// Art prototypes [EST]: deterministic broken geometry, never edits the intact source.
// Battle damage, collision, salvage and persistence are separate integration work.
import * as THREE from "../../vendor/three/three.module.min.js?v=dev";
import { bakeSourceGeometry } from './source-geometry.mjs?v=dev';

export const damageStages = Object.freeze({
  intact: { label: 'Intact', coverage: 0, remaining: 1 },
  damaged: { label: 'Damaged', coverage: .38, remaining: .76 },
  heavy: { label: 'Major destruction', coverage: .73, remaining: .43 },
  ruins: { label: 'Ruins', coverage: .96, remaining: .15 },
});
const hash = (x, z, salt = 0) => {
  const n = Math.sin(x * .1271 + z * .3117 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
};
const sizeOf = part => part.box.getSize(new THREE.Vector3());
const centerOf = part => part.box.getCenter(new THREE.Vector3());

export function damagePart(geometry, material, matrix = new THREE.Matrix4(), id = '') {
  geometry.computeBoundingBox();
  return { geometry, material, matrix: matrix.clone(), id, box: geometry.boundingBox.clone().applyMatrix4(matrix) };
}

export function collectDamageParts(root) {
  root.updateMatrixWorld(true);
  const parts = [], originals = new Set(), instance = new THREE.Matrix4();
  root.traverse(object => {
    if (!object.isMesh || object.userData.damageProtected || !object.visible) return;
    if (Array.isArray(object.material)) throw new Error('Damage preview expects single-material primitives');
    originals.add(object);
    for (let i = 0; i < (object.isInstancedMesh ? object.count : 1); i++) {
      let matrix = object.matrixWorld;
      if (object.isInstancedMesh) {
        object.getMatrixAt(i, instance);
        matrix = new THREE.Matrix4().multiplyMatrices(object.matrixWorld, instance);
      }
      parts.push(damagePart(object.geometry, object.material, matrix, `${object.name || object.id}/${i}`));
    }
  });
  return { parts, originals };
}

// Join concentric bodies/cores/roofs into one structural column. A single fracture
// height then removes roof ornaments too, rather than leaving them floating.
export function damageAnchors(parts) {
  const candidates = parts.filter(part => {
    const s = sizeOf(part), c = centerOf(part);
    // Narrow finials/antennae belong to a host column, not independent buildings.
    return s.y >= 7 && Math.min(s.x, s.z) >= 10 && Math.max(s.x, s.z) < 900
      && s.y >= Math.max(s.x, s.z) * .40 && Math.hypot(c.x, c.z) < 1500;
  }).sort((a, b) => {
    const s = sizeOf(a), t = sizeOf(b);
    return t.x * t.z * t.y - s.x * s.z * s.y;
  });
  const anchors = [];
  for (const part of candidates) {
    const c = centerOf(part), s = sizeOf(part);
    const parent = anchors.find(a => Math.abs(c.x - a.x) < Math.max(5, a.width * .65)
      && Math.abs(c.z - a.z) < Math.max(5, a.depth * .65)
      && s.x <= a.width * 1.55 && s.z <= a.depth * 1.55
      && part.box.min.y <= a.top + Math.max(a.height, s.y) * .8
      && part.box.max.y >= a.bottom - 2);
    if (parent) {
      parent.bottom = Math.min(parent.bottom, part.box.min.y);
      parent.top = Math.max(parent.top, part.box.max.y);
      parent.height = parent.top - parent.bottom;
      parent.width = Math.max(parent.width, s.x); parent.depth = Math.max(parent.depth, s.z);
    } else anchors.push({ id: part.id, x: c.x, z: c.z, bottom: part.box.min.y,
      top: part.box.max.y, height: s.y, width: s.x, depth: s.z });
  }
  // Include small crowns in their host's total height without allowing them to
  // become independently surviving columns when the main tower is destroyed.
  for (const part of parts) {
    const s = sizeOf(part);if (Math.min(s.x, s.z) >= 10) continue;
    const c = centerOf(part);
    const host = anchors.filter(a => Math.abs(c.x - a.x) < a.width * .65
      && Math.abs(c.z - a.z) < a.depth * .65 && part.box.min.y >= a.bottom
      && part.box.min.y <= a.top + a.height * .8)
      .sort((a, b) => Math.hypot(c.x - a.x, c.z - a.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
    if (host) {host.top = Math.max(host.top, part.box.max.y);host.height = host.top - host.bottom;}
  }
  return anchors;
}

function anchorFor(part, anchors) {
  const c = centerOf(part);
  let best = null, distance = Infinity;
  for (const a of anchors) {
    const dx = Math.abs(c.x - a.x), dz = Math.abs(c.z - a.z);
    if (dx > a.width * .64 + 5 || dz > a.depth * .64 + 5
      || part.box.max.y < a.bottom + 1 || part.box.min.y > a.top + a.height * .65) continue;
    const d = dx / (a.width + 1) + dz / (a.depth + 1) + Math.abs(part.box.min.y - a.bottom) / (a.height + 1) * .12;
    if (d < distance) { best = a; distance = d; }
  }
  return best;
}

export function fractureHeight(anchor, x, z, stage) {
  const variation = (hash(anchor.x, anchor.z, 3) - .5) * .12;
  const jagged = Math.sin((x - anchor.x) * .19 + 1.7) * .035
    + Math.sin((z - anchor.z) * .23 - .6) * .035;
  const slope = ((x - anchor.x) / (anchor.width + 1) - (z - anchor.z) / (anchor.depth + 1)) * .08;
  return anchor.bottom + anchor.height * Math.max(.04, damageStages[stage].remaining + variation + jagged + slope);
}

// Polygon clipping preserves partial triangles, UVs and normals along the fracture.
// Merely dropping whole triangles leaves oversized holes on simple box facades.
export function clipAtFracture(geometry, anchor, stage) {
  const input = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = input.attributes.position, n = input.attributes.normal, uv = input.attributes.uv;
  const positions = [], normals = [], uvs = [], cuts = [];
  const vertex = i => ({ p: [p.getX(i), p.getY(i), p.getZ(i)],
    n: n ? [n.getX(i), n.getY(i), n.getZ(i)] : [0, 1, 0],
    uv: uv ? [uv.getX(i), uv.getY(i)] : [0, 0] });
  const distance = v => v.p[1] - fractureHeight(anchor, v.p[0], v.p[2], stage);
  for (let i = 0; i < p.count; i += 3) {
    const triangle = [vertex(i), vertex(i + 1), vertex(i + 2)], polygon = [];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3], da = distance(a), db = distance(b);
      if (da <= 0) polygon.push(a);
      if ((da <= 0) !== (db <= 0)) {
        const t = da / (da - db), v = {};
        for (const key of ['p', 'n', 'uv']) v[key] = a[key].map((value, k) => value + (b[key][k] - value) * t);
        polygon.push(v); cuts.push(v.p);
      }
    }
    for (let j = 1; j < polygon.length - 1; j++) for (const v of [polygon[0], polygon[j], polygon[j + 1]]) {
      positions.push(...v.p); normals.push(...v.n); uvs.push(...v.uv);
    }
  }
  const output = new THREE.BufferGeometry();
  output.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  output.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  output.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (input !== geometry) input.dispose();
  return { geometry: output, cuts };
}

function hull(points) {
  const sorted = [...new Map(points.map(p => [`${p[0].toFixed(3)},${p[2].toFixed(3)}`, p])).values()]
    .sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
  const half = values => { const h = []; for (const p of values) { while (h.length > 1 && cross(h.at(-2), h.at(-1), p) <= 0) h.pop(); h.push(p); } return h; };
  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
}

function capGeometry(points) {
  const edge = hull(points);
  if (edge.length < 3) return null;
  const center = edge.reduce((sum, p) => sum.map((v, k) => v + p[k] / edge.length), [0, 0, 0]);
  const positions = [];
  for (let i = 0; i < edge.length; i++) positions.push(...center, ...edge[(i + 1) % edge.length], ...edge[i]);
  const g = new THREE.BufferGeometry();g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  return g;
}

function join(geometries) {
  const out = new THREE.BufferGeometry();
  for (const [name, width] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    const length = geometries.reduce((sum, g) => sum + g.attributes.position.count * width, 0);
    const data = new Float32Array(length);let offset = 0;
    for (const g of geometries) {
      const a = g.attributes[name];if (a) data.set(a.array, offset);
      offset += g.attributes.position.count * width;
    }
    out.setAttribute(name, new THREE.BufferAttribute(data, width));
  }
  for (const g of geometries) g.dispose();
  out.computeBoundingSphere();return out;
}

export function createCityDamageVariant(parts, stage, { type = 'alien' } = {}) {
  if (!damageStages[stage] || stage === 'intact') throw new Error('Choose a damaged city stage');
  const anchors = damageAnchors(parts), preset = damageStages[stage], active = new Set();
  // Same impact distribution at every stage: later versions expand the destruction.
  for (const a of anchors) {
    a.rank = hash(Math.round(a.x / 8), Math.round(a.z / 8), 11) * .76
      + Math.min(1, Math.hypot(a.x - 180, a.z + 120) / 1550) * .24;
    if (a.rank < preset.coverage) active.add(a);
  }
  const group = new THREE.Group(), batches = new Map(), capParts = [];
  group.name = `${type} — ${preset.label}`;
  let cutComponents = 0, intactTriangles = 0, standingTriangles = 0;
  function add(material, geometry) {
    if (!geometry.attributes.position.count) { geometry.dispose(); return; }
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(geometry);standingTriangles += geometry.attributes.position.count / 3;
  }
  for (const part of parts) {
    const baked = bakeSourceGeometry({ geometry: part.geometry, matrixWorld: part.matrix });
    intactTriangles += baked.attributes.position.count / 3;
    const anchor = anchorFor(part, anchors);
    if (!anchor || !active.has(anchor)) { add(part.material, baked);continue; }
    const result = clipAtFracture(baked, anchor, stage);
    (anchor.cuts ||= []).push(...result.cuts);
    if (result.geometry.attributes.position.count < baked.attributes.position.count || result.cuts.length) cutComponents++;
    // Thin rings, rails and long bridges have disconnected section loops; spanning
    // those with one convex cap would draw a solid sheet across open air.
    const extent = sizeOf(part);
    if (extent.y > 3 && extent.y > Math.max(extent.x, extent.z) * .55
      && extent.x < anchor.width * 1.8 && extent.z < anchor.depth * 1.8) {
      const cap = capGeometry(result.cuts);if (cap) capParts.push(cap);
    }
    baked.dispose();add(part.material, result.geometry);
  }
  const tint = stage === 'damaged' ? .91 : stage === 'heavy' ? .77 : .62;
  for (const [source, geometries] of batches) {
    const material = source.clone();material.color?.multiplyScalar(tint);
    material.roughness = Math.max(.8, material.roughness || 0);
    if (material.emissiveIntensity !== undefined) material.emissiveIntensity *= stage === 'damaged' ? .35 : .05;
    // Exposed interior walls need visible back faces after roofs are opened.
    material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(join(geometries), material);mesh.castShadow = mesh.receiveShadow = true;group.add(mesh);
  }
  const cutColor = type === 'citadel' ? 0x76766b : type === 'alien' ? 0x68777d : 0x6a6760;
  if (capParts.length) {
    const caps = new THREE.Mesh(join(capParts), new THREE.MeshStandardMaterial({ color: cutColor, roughness: 1, side: THREE.DoubleSide }));
    caps.name = 'Exposed broken floors and wall sections';caps.castShadow = caps.receiveShadow = true;group.add(caps);
  }
  addRubble(group, [...active], stage, type);
  // Real facade/fracture intersections, in world space. Effects must not invent ground
  // heights under skyways or place a fire at a removed building's former roof height.
  group.userData.effectSources = [...active].filter(a => a.cuts?.length).map(a => {
    const seed = hash(a.x, a.z, 43), point = a.cuts[Math.floor(seed * a.cuts.length)];
    return { id: a.id, position: [point[0], point[1] + .25, point[2]],
      scale: Math.max(1.4, Math.min(12, Math.min(a.width, a.depth) * .12)), seed };
  });
  group.userData.damage = { stage, anchors: anchors.length, affected: active.size, cutComponents,
    intactTriangles, standingTriangles, visualPrototype: true };
  return group;
}

function addRubble(group, anchors, stage, type) {
  const index = ['damaged', 'heavy', 'ruins'].indexOf(stage), count = [9, 18, 28][index];
  const stone = type === 'citadel' ? 0x9b9c89 : type === 'alien' ? 0x8298a2 : 0x777b7c;
  const palette = [stone, 0x393e42, type === 'citadel' ? 0x39736d : type === 'alien' ? 0x395563 : 0x657581];
  const shapes = [new THREE.DodecahedronGeometry(1, 0), new THREE.BoxGeometry(1, 1, 1),
    type === 'alien' ? new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, 0, Math.PI * .8) : new THREE.TetrahedronGeometry(1)];
  const pools = shapes.map((g, i) => new THREE.InstancedMesh(g,
    new THREE.MeshStandardMaterial({ color: palette[i], roughness: .97, metalness: i === 1 ? .3 : .05, side: THREE.DoubleSide }), Math.max(1, anchors.length * count)));
  const used = [0, 0, 0], object = new THREE.Object3D();
  const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(.14, .22, 1, 5),
    new THREE.MeshStandardMaterial({ color: 0x333d41, metalness: .65, roughness: .85 }), Math.max(1, anchors.length * 7));
  let barCount = 0;
  for (const a of anchors) {
    const seed = hash(a.x, a.z, 19), footprint = Math.max(4, Math.min(a.width, a.depth));
    const unit = Math.min(15, Math.max(2, footprint * .10));
    for (let i = 0; i < count; i++) {
      const r = hash(a.x + i * 17, a.z, 4), angle = hash(a.x, a.z + i * 23, 5) * Math.PI * 2;
      const reach = footprint * (.25 + index * .09) * Math.sqrt(r), shape = i % 3;
      const scale = unit * (.5 + hash(i, seed, 8) * 1.3), h = scale * (shape === 1 ? .35 : .6);
      object.position.set(a.x + Math.cos(angle) * reach, a.bottom + h * .65 + i % 3 * unit * .23, a.z + Math.sin(angle) * reach);
      object.rotation.set(hash(i, seed, 1) * .6, angle, (hash(i, seed, 2) - .5) * .8);
      object.scale.set(scale * (shape === 1 ? 2.6 : 1), h, scale * (shape === 2 ? .35 : .9));
      object.updateMatrix();pools[shape].setMatrixAt(used[shape]++, object.matrix);
    }
    const height = Math.min(12, a.height * .10);
    for (let i = 0; i < 7 && a.cuts?.length; i++) {
      const cut = a.cuts[Math.floor(hash(i, seed, 17) * a.cuts.length)], [x, y, z] = cut;
      object.position.set(x, y + height * .36, z);
      object.rotation.set((hash(i, seed, 2) - .5) * .6, 0, (hash(i, seed, 3) - .5) * .6);
      object.scale.set(1, height, 1);object.updateMatrix();bars.setMatrixAt(barCount++, object.matrix);
    }
  }
  pools.forEach((mesh, i) => { mesh.count = used[i];mesh.name = 'Settled facade and roof rubble';mesh.castShadow = mesh.receiveShadow = true;mesh.computeBoundingSphere();group.add(mesh); });
  bars.count = barCount;bars.name = 'Exposed bent structural rods';bars.castShadow = true;bars.computeBoundingSphere();group.add(bars);
}

export function disposeCityDamageVariant(group) {
  group.traverse(object => { if (object.isMesh) { object.geometry.dispose();object.material.dispose(); } });
  group.removeFromParent();
}
