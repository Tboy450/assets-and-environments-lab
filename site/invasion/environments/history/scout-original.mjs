// Historical Scout geometry extracted unchanged from 4728169 for lab comparison only.
// Source and restore tag: archive/scout-polish-2026-10-19. No game-state access.
import * as THREE from "../../../vendor/three/three.module.min.js?v=dev";

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

export function originalScoutModel() {
  const p = new Parts()
    .add(box(0.34, 0.12, 0.52), hull)
    .add(ball(0.12), glass, { at: [0, 0.07, 0.16], scale: [1, 0.6, 1.3] })
    .add(box(0.3, 0.03, 0.3), panel, { at: [0, 0.075, -0.08] });
  const rotors = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    p.beam([0, 0, 0], [x * 0.34, 0.02, z * 0.34], 0.045, hull);
    p.add(cyl(0.05, 0.05, 0.08), motor, { at: [x * 0.34, 0.04, z * 0.34] });
    rotors.push([x * 0.34, 0.09, z * 0.34, 0.21]);
  }
  const glow = new Parts().add(box(0.05, 0.03, 0.05), 0xffffff, { at: [0.34, -0.01, 0.34] }).add(box(0.05, 0.03, 0.05), 0xffffff, { at: [-0.34, -0.01, 0.34] })
    .add(box(0.2, 0.02, 0.03), 0xffffff, { at: [0, 0.0, 0.27] });
  return { body: p.build(), glow: glow.build(), rotors, scale: 4.2 };
}
