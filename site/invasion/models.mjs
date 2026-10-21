// 3D models for the invasion game. The swarm drones, defenders and settlement buildings are
// simple invented shapes [EST] merged into one vertex-colored geometry per type, so a whole
// swarm draws as a few instanced meshes. The Dragonfly is the simulator's research model
// (vehicle-research.mjs, NASA/APL 2023 layout) with its interior removed and its static parts
// merged by material.
import * as THREE from "../vendor/three/three.module.min.js";
import { buildResearchModel } from "../vehicle-research.mjs?v=dev";

const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler();

// Collects primitives with a color each and merges them into one geometry (position, normal, color).
class Parts {
  constructor() { this.list = []; }
  add(geometry, color, { at = [0, 0, 0], rotate = [0, 0, 0], scale = [1, 1, 1] } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    quaternion.setFromEuler(euler.set(...rotate));
    g.applyMatrix4(matrix.compose(new THREE.Vector3(...at), quaternion, new THREE.Vector3(...scale)));
    const c = new THREE.Color(color);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.list.push(g);
    return this;
  }
  // A box between two points (arms, legs, struts).
  beam(from, to, thickness, color) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const length = a.distanceTo(b);
    const g = new THREE.BoxGeometry(thickness, thickness, length);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    return this.add(g, color, { at: mid.toArray(), rotate: [e.x, e.y, e.z] });
  }
  build() { return mergeGeometries(this.list, ["position", "normal", "color"]); }
}

function mergeGeometries(list, names) {
  const total = list.reduce((sum, g) => sum + g.attributes.position.count, 0);
  const merged = new THREE.BufferGeometry();
  for (const name of names) {
    const size = name === "uv" ? 2 : 3;
    const array = new Float32Array(total * size);
    let offset = 0;
    for (const g of list) {
      const attribute = g.attributes[name];
      if (attribute) array.set(attribute.array.subarray(0, attribute.count * size), offset);
      offset += g.attributes.position.count * size;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  merged.computeBoundingSphere();
  return merged;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, n = 12) => new THREE.CylinderGeometry(r1, r2, h, n);
const ball = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const cone = (r, h, n = 12) => new THREE.ConeGeometry(r, h, n);

// ---- Swarm drones (meters before `scale`; +z is forward) ----
// body: merged frame; glow: lights tinted with the squad color; rotors: disc centers and radius.
const hull = 0x2b3238, panel = 0x4a5560, glass = 0x10161b, motor = 0x5d646b, accent = 0xb7c2c9;

function scoutHullGeometry() {
  // Original gameplay design [EST]: three hard-edged rings form a tapered, chamfered shell.
  const outline = [[-.11, -.24], [.11, -.24], [.17, -.13], [.17, .15], [.10, .26], [-.10, .26], [-.17, .15], [-.17, -.13]];
  const rings = [[-.06, .86], [.025, 1], [.06, .82]].map(([y, scale]) => outline.map(([x, z]) => [x * scale, y, z * scale]));
  const positions = [];
  const tri = (a, b, c) => positions.push(...a, ...b, ...c);
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length;
    tri([0, -.06, 0], rings[0][i], rings[0][next]);
    tri([0, .06, 0], rings[2][next], rings[2][i]);
    for (let r = 0; r < 2; r++) {
      tri(rings[r][i], rings[r + 1][i], rings[r + 1][next]);
      tri(rings[r][i], rings[r + 1][next], rings[r][next]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function scoutModel() {
  const p = new Parts()
    .add(scoutHullGeometry(), hull)
    .add(box(.24, .022, .25), panel, { at: [0, .066, -.065] })
    .add(box(.16, .055, .13), panel, { at: [0, .061, .16], rotate: [-.12, 0, 0] })
    .add(new THREE.CylinderGeometry(.069, .077, .065, 12, 1, true), motor, { at: [0, .055, .244], rotate: [Math.PI / 2, 0, 0] })
    .add(new THREE.RingGeometry(.049, .069, 12), motor, { at: [0, .055, .2765] })
    .add(cyl(.049, .049, .006, 12), glass, { at: [0, .055, .268], rotate: [Math.PI / 2, 0, 0] })
    .add(box(.014, .006, .18), accent, { at: [-.09, .080, -.065] });
  for (const z of [-.15, -.11, -.07]) p.add(box(.105, .006, .012), glass, { at: [.025, .080, z] });
  const rotors = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    p.beam([0, 0, 0], [x * 0.34, 0.02, z * 0.34], 0.045, hull);
    p.add(cyl(0.05, 0.05, 0.08), motor, { at: [x * 0.34, 0.04, z * 0.34] });
    p.add(cyl(.045, .05, .018, 8), panel, { at: [x * .34, .073, z * .34] });
    rotors.push([x * 0.34, 0.09, z * 0.34, 0.21]);
  }
  const glow = new Parts().add(box(0.05, 0.03, 0.05), 0xffffff, { at: [0.34, -0.01, 0.34] }).add(box(0.05, 0.03, 0.05), 0xffffff, { at: [-0.34, -0.01, 0.34] })
    .add(box(0.2, 0.02, 0.03), 0xffffff, { at: [0, 0.0, 0.27] });
  return { body: p.build(), glow: glow.build(), rotors, scale: 4.2 };
}

function linkModel() {
  const p = new Parts()
    .add(cyl(0.34, 0.3, 0.14, 6), hull)
    .add(ball(0.2, 12, 6), panel, { at: [0, 0.07, 0], scale: [1, 0.55, 1] })
    .add(cyl(0.02, 0.02, 0.22, 6), accent, { at: [0, 0.22, 0] })
    .add(cyl(0.16, 0.06, 0.05, 16), accent, { at: [0, 0.34, 0], rotate: [0.5, 0, 0] });
  const rotors = [];
  for (let i = 0; i < 6; i += 1) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6, x = Math.cos(a) * 0.55, z = Math.sin(a) * 0.55;
    p.beam([0, 0, 0], [x, 0.02, z], 0.04, hull);
    p.add(cyl(0.045, 0.045, 0.07), motor, { at: [x, 0.04, z] });
    rotors.push([x, 0.085, z, 0.17]);
  }
  const glow = new Parts().add(new THREE.TorusGeometry(0.36, 0.025, 6, 24), 0xffffff, { rotate: [Math.PI / 2, 0, 0] })
    .add(ball(0.04), 0xffffff, { at: [0, 0.37, 0] });
  return { body: p.build(), glow: glow.build(), rotors, scale: 4.2 };
}

function strikerModel() {
  const p = new Parts()
    .add(box(0.5, 0.2, 0.8), hull)
    .add(box(0.36, 0.14, 0.3), hull, { at: [0, -0.02, 0.5], scale: [1, 1, 1] })
    .add(ball(0.14), glass, { at: [0, 0.08, 0.42], scale: [1, 0.6, 1.4] })
    .add(box(0.4, 0.04, 0.5), panel, { at: [0, 0.12, -0.1] });
  for (const side of [-1, 1]) {
    p.add(cyl(0.06, 0.06, 0.5, 8), motor, { at: [side * 0.3, -0.14, 0.25], rotate: [Math.PI / 2, 0, 0] });
    p.add(cyl(0.025, 0.025, 0.3, 6), accent, { at: [side * 0.3, -0.14, 0.62], rotate: [Math.PI / 2, 0, 0] });
  }
  const rotors = [];
  for (let i = 0; i < 6; i += 1) {
    const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 0.72, z = Math.sin(a) * 0.72;
    p.beam([0, 0.02, 0], [x, 0.06, z], 0.05, hull);
    p.add(cyl(0.06, 0.06, 0.09), motor, { at: [x, 0.08, z] });
    rotors.push([x, 0.14, z, 0.24]);
  }
  const glow = new Parts().add(box(0.3, 0.03, 0.03), 0xffffff, { at: [0, 0.02, 0.66] }).add(box(0.06, 0.03, 0.3), 0xffffff, { at: [0, 0.15, -0.3] });
  return { body: p.build(), glow: glow.build(), rotors, scale: 4.6 };
}

function breacherModel() {
  const p = new Parts()
    .add(box(0.8, 0.32, 0.8), hull)
    .add(box(0.6, 0.12, 0.6), panel, { at: [0, 0.2, 0] })
    .add(cyl(0.24, 0.3, 0.42, 10), 0x6b4f2a, { at: [0, -0.34, 0] })
    .add(cone(0.24, 0.22, 10), 0x8a6a3a, { at: [0, -0.66, 0], rotate: [Math.PI, 0, 0] });
  const rotors = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    p.beam([0, 0.05, 0], [x * 0.62, 0.1, z * 0.62], 0.07, hull);
    p.add(cyl(0.08, 0.08, 0.26), motor, { at: [x * 0.62, 0.14, z * 0.62] });
    rotors.push([x * 0.62, 0.3, z * 0.62, 0.3], [x * 0.62, 0.0, z * 0.62, 0.3]);
  }
  const glow = new Parts().add(box(0.5, 0.03, 0.03), 0xffffff, { at: [0, 0.05, 0.41] }).add(new THREE.TorusGeometry(0.27, 0.02, 6, 20), 0xffffff, { at: [0, -0.2, 0], rotate: [Math.PI / 2, 0, 0] });
  return { body: p.build(), glow: glow.build(), rotors, scale: 4.6 };
}

export function droneModels() {
  return { scout: scoutModel(), link: linkModel(), striker: strikerModel(), breacher: breacherModel() };
}

// ---- Defenders ----
// Local fighters: a stylized figure, colored by society level; interceptors are small deltas.
export const societyColors = ["#888888", "#8a5a34", "#5f7d3a", "#6c727a", "#34506e", "#d9dce6"];

export function figureModel() {
  return new Parts()
    .add(cyl(0.22, 0.28, 0.9, 8), 0xffffff, { at: [0, 0.45, 0] })
    .add(ball(0.2, 10, 6), 0xf0d0b0, { at: [0, 1.08, 0] })
    .add(box(0.08, 0.08, 0.7), 0x3a3a3a, { at: [0.25, 0.7, 0.2], rotate: [-0.5, 0, 0] })
    .build();
}

export function interceptorModel() {
  const wing = new THREE.Shape();
  wing.moveTo(0, 0.6); wing.lineTo(0.55, -0.35); wing.lineTo(0, -0.2); wing.lineTo(-0.55, -0.35); wing.closePath();
  const wingGeometry = new THREE.ExtrudeGeometry(wing, { depth: 0.06, bevelEnabled: false });
  return new Parts()
    .add(wingGeometry, 0xd0d4dc, { rotate: [-Math.PI / 2, 0, 0], at: [0, 0, 0] })
    .add(cyl(0.08, 0.12, 0.9, 8), 0x9a2a2a, { rotate: [Math.PI / 2, 0, 0], at: [0, 0.04, -0.05] })
    .add(box(0.04, 0.25, 0.25), 0x9a2a2a, { at: [0, 0.15, -0.3] })
    .build();
}

// Structures (meters, real-ish sizes). glow parts get the owner's color.
export function structureModels() {
  const wood = 0x7a5532, roof = 0x5a3b22, steel = 0x5f6a70, dark = 0x2d3438, olive = 0x4f5a3a, white = 0xd8dde2;
  const tower = new Parts();
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) tower.beam([x * 1.4, 0, z * 1.4], [x * 0.9, 7, z * 0.9], 0.25, wood);
  tower.add(box(2.6, 0.3, 2.6), wood, { at: [0, 7, 0] }).add(box(2.6, 1, 0.15), wood, { at: [0, 7.6, 1.25] }).add(box(2.6, 1, 0.15), wood, { at: [0, 7.6, -1.25] })
    .add(cone(2.2, 1.6, 4), roof, { at: [0, 9.2, 0], rotate: [0, Math.PI / 4, 0] });
  const flak = new Parts().add(cyl(2.2, 2.6, 1.2, 12), olive, { at: [0, 0.6, 0] }).add(box(1.8, 1.2, 1.6), olive, { at: [0, 1.8, 0] })
    .add(cyl(0.15, 0.15, 3.2, 6), dark, { at: [0.4, 3.0, 0.9], rotate: [0.9, 0, 0] }).add(cyl(0.15, 0.15, 3.2, 6), dark, { at: [-0.4, 3.0, 0.9], rotate: [0.9, 0, 0] });
  const radar = new Parts().add(box(0.5, 10, 0.5), steel, { at: [0, 5, 0] }).add(box(2.2, 0.4, 2.2), dark, { at: [0, 0.2, 0] })
    .add(cyl(2.2, 0.4, 0.5, 16), white, { at: [0, 10.6, 0.3], rotate: [-1.1, 0, 0] });
  const sam = new Parts().add(box(4, 1, 3), olive, { at: [0, 0.5, 0] }).add(box(2.6, 1.4, 2.4), dark, { at: [0, 1.9, -0.2], rotate: [-0.5, 0, 0] });
  for (const [x, y] of [[-0.6, 0.35], [0.6, 0.35], [-0.6, -0.35], [0.6, -0.35]]) sam.add(cyl(0.28, 0.28, 0.3, 8), white, { at: [x, 2.3 + y * 0.9, 0.95 + y * 0.45], rotate: [1.07, 0, 0] });
  const jammer = new Parts().add(cyl(0.3, 0.5, 9, 8), steel, { at: [0, 4.5, 0] }).add(box(2, 0.6, 2), dark, { at: [0, 0.3, 0] });
  for (const y of [4, 6, 8]) jammer.add(new THREE.TorusGeometry(1.1 - y * 0.06, 0.12, 6, 18), dark, { at: [0, y, 0], rotate: [Math.PI / 2, 0, 0] });
  const laser = new Parts().add(ball(2.2, 16, 8), white, { at: [0, 0, 0], scale: [1, 0.8, 1] }).add(box(1.4, 1.2, 1.8), steel, { at: [0, 2.1, 0] })
    .add(cyl(0.22, 0.3, 3.4, 8), dark, { at: [0, 2.5, 1.9], rotate: [Math.PI / 2 - 0.3, 0, 0] });
  const shield = new Parts().add(cyl(0.6, 1.4, 11, 6), white, { at: [0, 5.5, 0] }).add(cyl(2.4, 2.8, 0.8, 6), steel, { at: [0, 0.4, 0] });
  const glows = {
    watchtower: new Parts().add(box(0.5, 0.5, 0.5), 0xffffff, { at: [0, 8.2, 0] }),
    flak: new Parts().add(box(0.6, 0.2, 0.2), 0xffffff, { at: [0, 2.45, 0.8] }),
    radar: new Parts().add(ball(0.3), 0xffffff, { at: [0, 10.2, 0] }),
    sam: new Parts().add(box(0.3, 0.3, 0.3), 0xffffff, { at: [1.6, 1.2, 1.4] }),
    jammer: new Parts().add(ball(0.5), 0xffffff, { at: [0, 9.4, 0] }),
    laser: new Parts().add(ball(0.32), 0xffffff, { at: [0, 3.0, 3.5] }),
    shield: new Parts().add(new THREE.OctahedronGeometry(1.2), 0xffffff, { at: [0, 12.2, 0] }),
  };
  const bodies = { watchtower: tower, flak, radar, sam, jammer, laser, shield };
  return Object.fromEntries(Object.entries(bodies).map(([type, parts]) => [type, { body: parts.build(), glow: glows[type].build() }]));
}

// Settlement buildings by society level: a body and a roof, sized per instance.
export function buildingModels() {
  return {
    body: new Parts().add(box(1, 1, 1), 0xffffff, { at: [0, 0.5, 0] }).build(),
    roof: new Parts().add(cone(0.75, 0.6, 4), 0xffffff, { at: [0, 0.3, 0], rotate: [0, Math.PI / 4, 0] }).build(),
    hut: new Parts().add(cyl(0.5, 0.55, 0.8, 10), 0xffffff, { at: [0, 0.4, 0] }).add(cone(0.65, 0.7, 10), 0xc8b08a, { at: [0, 1.15, 0] }).build(),
  };
}

// ---- The Dragonfly ----
// Builds the research model once, drops the interior (Internal/Thermal layers only) and merges
// the static exterior by material; rotor groups stay separate so they can spin.
export function dragonflyTemplate() {
  const group = new THREE.Group();
  let target = group;
  const metal = new THREE.MeshStandardMaterial({ color: 0x909b9e, metalness: 0.58, roughness: 0.4 });
  const deck = new THREE.MeshStandardMaterial({ color: 0x343e43, metalness: 0.38, roughness: 0.55 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc79e47, metalness: 0.55, roughness: 0.42 });
  const mesh = (geometry, material, position, parent = target) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(...position);
    parent.add(part);
    return part;
  };
  const strut = (from, to, radius = 0.026, material = metal) => {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const part = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 10), material, start.add(end).multiplyScalar(0.5).toArray());
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return part;
  };
  const built = buildResearchModel({
    group, mesh, strut, metal, deck, gold, upAxis: new THREE.Vector3(0, 1, 0),
    setTarget: (next) => { target = next || group; },
  });
  built.researchAntenna.pose(0);
  for (const sub of Object.values(built.subsystems)) {
    if (sub.userData.layer === "interior" || sub.userData.layer === "diagram") sub.parent?.remove(sub);
  }
  const rotors = built.researchRotors.map(({ rotor, direction }) => { rotor.userData.spin = direction; return rotor; });
  compact(group, new Set(rotors));
  return group;
}

function compact(root, keep) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map(), remove = [];
  const kept = (object) => { for (let o = object; o; o = o.parent) if (keep.has(o)) return true; return false; };
  const shown = (object) => { for (let o = object; o && o !== root; o = o.parent) if (!o.visible) return false; return true; };
  root.traverse((object) => {
    if (object === root || kept(object)) return;
    if (!shown(object)) { remove.push(object); return; }
    if (!object.isMesh || Array.isArray(object.material)) return;
    const g = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    let list = buckets.get(object.material);
    if (!list) buckets.set(object.material, list = []);
    list.push(g);
    remove.push(object);
  });
  for (const object of remove) object.parent?.remove(object);
  // Empty groups left behind are harmless; merged meshes go straight under the root.
  for (const [material, list] of buckets) {
    const merged = new THREE.Mesh(mergeGeometries(list, ["position", "normal", "uv"]), material);
    root.add(merged);
  }
}
