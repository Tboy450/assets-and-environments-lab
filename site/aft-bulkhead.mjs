import * as THREE from "./vendor/three/three.module.min.js";

// Part 16: the aft bulkhead and the MMRTG's mounting angle. Drawn from real photos of the flight
// structure: NASA/APL's April 2026 top-deck fit check shows the aft end of the lander body as a
// gold-colored machined bulkhead: a pocketed rib frame around its edge, a large circular
// interface crossed by a grid of ribs where the MMRTG mounts, lightening pockets around that circle
// and rows of fastener holes. NASA/APL's June 2026 photo of the frame going onto the vibration table
// shows that bulkhead canted, with an MMRTG-sized test cylinder bolted to it. NASA/APL's July 9
// article explicitly captions the structure as inverted on the vibration table. Turned upright, it agrees
// with APL's 2024 CAD (cross-reference only): the MMRTG points aft and UP. The tilt, about 25
// degrees, is measured on the June photo, which is nearly side-on (the oblique CAD reads less); the
// MMRTG's axis meets the bulkhead in its upper half. Sizes, coating, exact angle and pocket layout
// are [EST]. The MMRTG's aft-most point stays at the TFAWS 2023 plan view's 1.93 m.
const tilt = THREE.MathUtils.degToRad(25);
const n = Object.freeze([0, Math.sin(tilt), Math.cos(tilt)]);       // MMRTG axis, plate normal (aft, up)
const u = Object.freeze([0, Math.cos(tilt), -Math.sin(tilt)]);      // up along the plate
const at = (p, s, d = n) => p.map((v, i) => v + s * d[i]);
// Interface center on the bulkhead's aft face (model frame: x across, y up, z aft).
const interfaceCenter = Object.freeze([0, -0.1, 1.106]);
const foamM = 0.09;               // bulkhead face to the outside of the foam
const mmrtgBase = Object.freeze(at(interfaceCenter, foamM));
const mmrtgCenter = Object.freeze(at(mmrtgBase, 0.34));
export const aftBulkheadAsset = Object.freeze({
  revision: "aft-bulkhead-2026-10-15",
  tiltDeg: 25,
  normal: n, up: u,
  interfaceCenter, mmrtgBase, mmrtgCenter,
  // Plate extent along its own up direction from the interface center, and across.
  plate: Object.freeze({ width: 0.7, top: 0.198, bottom: -0.242, thickness: 0.012, rimDepth: 0.045 }),
  interfaceRadius: 0.12,
  ringRadius: 0.14,
  foamM,
  // Outside of the foam at the aft end: a plane through mmrtgBase with this normal.
  foamFace: Object.freeze({ point: mmrtgBase, normal: n }),
});

// The body's aft foam face height-for-height: z of the face at a given y.
export function aftFaceZ(y) {
  const [, by, bz] = aftBulkheadAsset.foamFace.point;
  return bz - (y - by) * Math.tan(tilt);
}

// MMRTG pose: its group sits at mmrtgCenter, rotated so its local +z (the cylinder axis, base at
// local -z) points along the normal.
export function poseMmrtg(group) {
  group.position.fromArray(aftBulkheadAsset.mmrtgCenter);
  group.rotation.set(-tilt, 0, 0);
  return group;
}

export function buildAftBulkhead({ parent, mesh }) {
  const A = aftBulkheadAsset, P = A.plate;
  const assembly = new THREE.Group();
  assembly.name = "aft-bulkhead-assembly";
  assembly.position.fromArray(A.interfaceCenter);
  assembly.rotation.set(-tilt, 0, 0);   // local x across, local y up the plate, local z aft
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: A.revision, dimensionConfidence: "PUB+EST" });
  const group = (name, inspectionLayer) => {
    const g = new THREE.Group(); g.name = name; g.userData.inspectionLayer = inspectionLayer;
    assembly.add(g); return g;
  };
  const plates = group("aft-bulkhead-plate", "equipment-casings");
  const interfaces = group("aft-bulkhead-mmrtg-interface", "interfaces");
  const fasteners = group("aft-bulkhead-fasteners", "mounts");
  const gold = new THREE.MeshStandardMaterial({ color: 0xd2ac52, metalness: 0.7, roughness: 0.36 });
  const goldShade = new THREE.MeshStandardMaterial({ color: 0xa8873a, metalness: 0.65, roughness: 0.45 });
  const pocket = new THREE.MeshStandardMaterial({ color: 0x5a4a22, metalness: 0.4, roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.75, roughness: 0.35 });
  const label = new THREE.MeshStandardMaterial({ color: 0xe8c23a, metalness: 0.1, roughness: 0.6 });
  const box = (size, pos, material, target, name) => { const m = mesh(new THREE.BoxGeometry(...size), material, pos, target); m.name = name; return m; };
  const W = P.width, H = P.top - P.bottom, cy = (P.top + P.bottom) / 2, T = P.thickness;

  // Face plate, with the rim frame standing forward (into the body) around its edge and ribs
  // across the rim every few centimeters (the pocketed edge in the photos).
  box([W, H, T], [0, cy, -T / 2], gold, plates, "aft-bulkhead-face");
  for (const s of [-1, 1]) {
    box([0.012, H, P.rimDepth], [s * (W / 2 - 0.006), cy, -T - P.rimDepth / 2], gold, plates, "aft-bulkhead-rim");
    box([W, 0.012, P.rimDepth], [0, s > 0 ? P.top - 0.006 : P.bottom + 0.006, -T - P.rimDepth / 2], gold, plates, "aft-bulkhead-rim");
  }
  for (let y = P.bottom + 0.04; y < P.top - 0.02; y += 0.042) {
    for (const s of [-1, 1]) box([0.05, 0.006, P.rimDepth], [s * (W / 2 - 0.03), y, -T - P.rimDepth / 2], goldShade, plates, "aft-bulkhead-rim-rib");
  }
  for (let x = -W / 2 + 0.05; x < W / 2 - 0.03; x += 0.045) {
    for (const y of [P.top - 0.03, P.bottom + 0.03]) {
      box([0.006, 0.05, P.rimDepth], [x, y, -T - P.rimDepth / 2], goldShade, plates, "aft-bulkhead-rim-rib");
    }
  }

  // MMRTG interface: a raised ring around a recessed disc crossed by a grid of ribs.
  const ring = mesh(new THREE.CylinderGeometry(A.ringRadius, A.ringRadius, 0.014, 48, 1, true), gold, [0, 0, 0.007], interfaces);
  ring.rotation.x = Math.PI / 2; ring.name = "aft-bulkhead-interface-ring";
  const lip = mesh(new THREE.RingGeometry(A.interfaceRadius, A.ringRadius, 48), gold, [0, 0, 0.0141], interfaces);
  lip.name = "aft-bulkhead-interface-lip";
  const recess = mesh(new THREE.CircleGeometry(A.interfaceRadius, 48), goldShade, [0, 0, 0.001], interfaces);
  recess.name = "aft-bulkhead-interface-recess";
  for (const d of [-0.045, 0.045]) {
    box([0.008, 2 * Math.sqrt(A.interfaceRadius ** 2 - d * d), 0.012], [d, 0, 0.007], gold, interfaces, "aft-bulkhead-interface-rib");
    box([2 * Math.sqrt(A.interfaceRadius ** 2 - d * d), 0.008, 0.012], [0, d, 0.007], gold, interfaces, "aft-bulkhead-interface-rib");
  }
  for (const [x, y] of [[0.07, -0.085], [-0.06, 0.09]]) {
    const hole = mesh(new THREE.CircleGeometry(0.008, 12), pocket, [x, y, 0.0015], interfaces); hole.name = "aft-bulkhead-interface-hole";
  }

  // Lightening pockets around the circle: three above, a tall one each side, two small ones low.
  const pockets = [
    [-0.115, 0.172, 0.07, 0.045], [0, 0.175, 0.075, 0.042], [0.115, 0.172, 0.07, 0.045],
    [-0.205, 0.04, 0.06, 0.13], [0.205, 0.04, 0.06, 0.13],
    [-0.19, -0.085, 0.05, 0.045], [0.19, -0.085, 0.05, 0.045],
  ];
  for (const [x, y, w, h] of pockets) box([w, h, 0.003], [x, y, 0.0005], pocket, plates, "aft-bulkhead-pocket");
  // The fans' adapter collar meets the plate's forward face behind the interface; how the air
  // passes through the bulkhead to the MMRTG's housing is not published, so no opening is drawn.

  // Fastener holes in pairs over the face, and two yellow labels (as photographed).
  for (const [x, y] of [[-0.3, 0.15], [-0.3, 0.02], [-0.3, -0.12], [0.3, 0.15], [0.3, 0.02], [0.3, -0.12], [-0.12, -0.2], [0.12, -0.2], [0, -0.215], [-0.25, -0.21], [0.25, -0.21]]) {
    for (const dx of [-0.008, 0.008]) {
      const h = mesh(new THREE.CircleGeometry(0.0035, 8), steel, [x + dx, y, 0.0012], fasteners); h.name = "aft-bulkhead-fastener";
    }
  }
  box([0.03, 0.02, 0.002], [-0.03, 0.185, 0.002], label, fasteners, "aft-bulkhead-label");
  box([0.03, 0.02, 0.002], [0.215, -0.02, 0.002], label, fasteners, "aft-bulkhead-label");
  return { assembly, plates, interfaces, fasteners };
}
