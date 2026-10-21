import * as THREE from "./vendor/three/three.module.min.js";

// Rotor heads: the coaxial motor stack at each arm end and the hub plate of each rotor. Drawn from
// real footage and photos: APL/NASA's "Revolutionary Rotors" video (January 2026) of the full-scale
// wind-tunnel model with flight-like rotors at NASA Langley's Transonic Dynamics Tunnel, NASA's
// photos of that test, and NASA/APL's May 2026 photo of the flight lander frame hanging for a
// ground vibration test (arms and rotor heads with mass simulators in place of blades).
// What they show: at each arm end a central collar, where the arm tube clamps on, between an upper
// and a lower motor drum of machined aluminum (a labeled top ring, a fine groove, a band of small
// radial holes, screws set in notches at the rotor-side edge, and a spoked face with dark windows
// toward the rotor); each three-blade rotor is one machined piece whose flat hub plate bolts to that
// face. Sizes are scaled from the video: the drums are about a third of a blade's length across,
// so about 0.24 m against the published 1.35 m rotor [EST]; heights, hole counts and the collar are
// read from the frames [EST]. Test instrumentation (strain gauges, tape, labels) is not drawn.
export const rotorHeadAsset = Object.freeze({
  revision: "rotor-heads-2026-10-15",
  motorRadiusM: 0.12,
  // Drum spans (y, model frame) and the rotor planes they sit between.
  lowerDrum: Object.freeze([-0.135, -0.035]),
  upperDrum: Object.freeze([0.075, 0.175]),
  column: Object.freeze({ radiusM: 0.058, bottom: -0.035, top: 0.075 }),
  rotorY: Object.freeze([-0.16, 0.2]),
  hubPlateRadiusM: 0.115,
  hubPlateThicknessM: 0.008,
  spokes: 6,
  boltHoles: 16,
});

const machined = new THREE.MeshStandardMaterial({ color: 0xe1e4e6, metalness: 0.45, roughness: 0.34 });
const darkInside = new THREE.MeshStandardMaterial({ color: 0x272a2d, metalness: 0.35, roughness: 0.6 });
const fastener = new THREE.MeshStandardMaterial({ color: 0x8e9398, metalness: 0.5, roughness: 0.4 });
const collarMetal = new THREE.MeshStandardMaterial({ color: 0xcdd1d4, metalness: 0.45, roughness: 0.4 });

// One drum as a turned profile from the rotor-side face (t = 0) to the collar side (t = 1).
function drumGeometry(height, radius) {
  const r = radius, h = height;
  const profile = [
    [0.085, 0], [r - 0.008, 0], [r, 0.006], [r, 0.42 * h], [r + 0.0012, 0.43 * h], [r + 0.0012, 0.45 * h], [r, 0.46 * h],
    [r, 0.9 * h], [r - 0.008, h], [0.058, h],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(profile, 56);
}

export function buildRotorHead({ parent, mesh, x, z, armRoot }) {
  const A = rotorHeadAsset, R = A.motorRadiusM;
  const head = new THREE.Group();
  head.name = "rotor-head";
  head.position.set(x, 0, z);
  parent.add(head);
  const add = (geometry, material, at, name) => { const m = mesh(geometry, material, at, head); m.name = name; return m; };

  // Central collar where the arm clamps on.
  const C = A.column;
  add(new THREE.CylinderGeometry(C.radiusM, C.radiusM, C.top - C.bottom, 28), collarMetal, [0, (C.top + C.bottom) / 2, 0], "rotor-head-collar");
  for (const y of [C.bottom + 0.008, C.top - 0.008]) add(new THREE.CylinderGeometry(C.radiusM + 0.006, C.radiusM + 0.006, 0.012, 28), machined, [0, y, 0], "rotor-head-collar-ring");
  // Arm clamp: a split block facing the arm, with two bolts across the split.
  const toward = new THREE.Vector3(armRoot[0] - x, 0, armRoot[2] - z).normalize();
  const yaw = Math.atan2(toward.x, toward.z);
  const clamp = new THREE.Group();
  clamp.name = "rotor-head-arm-clamp";
  clamp.position.set(0, 0.02, 0);
  clamp.rotation.y = yaw;
  head.add(clamp);
  mesh(new THREE.BoxGeometry(0.085, 0.075, 0.06), collarMetal, [0, 0, C.radiusM + 0.022], clamp).name = "rotor-head-clamp-block";
  mesh(new THREE.BoxGeometry(0.087, 0.004, 0.062), darkInside, [0, 0, C.radiusM + 0.022], clamp).name = "rotor-head-clamp-split";
  for (const dx of [-0.03, 0.03]) {
    const bolt = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.082, 8), fastener, [dx, 0, C.radiusM + 0.022], clamp);
    bolt.name = "rotor-head-clamp-bolt";
  }

  // Upper and lower drums, each with its spoked face toward its rotor.
  for (const [span, faceDown, label] of [[A.lowerDrum, true, "lower"], [A.upperDrum, false, "upper"]]) {
    const [y0, y1] = span, h = y1 - y0, face = faceDown ? y0 : y1, sign = faceDown ? 1 : -1;
    const drum = add(drumGeometry(h, R), machined, [0, face, 0], `rotor-motor-${label}`);
    if (!faceDown) drum.scale.y = -1;
    // Spoked face: dark windows behind six spokes and a center boss.
    add(new THREE.CylinderGeometry(0.087, 0.087, 0.002, 40), darkInside, [0, face + sign * 0.006, 0], `rotor-motor-${label}-windows`);
    for (let k = 0; k < A.spokes; k += 1) {
      const spoke = add(new THREE.BoxGeometry(0.058, 0.006, 0.016), machined, [0, face + sign * 0.003, 0], `rotor-motor-${label}-spoke`);
      const a = k / A.spokes * Math.PI * 2;
      spoke.position.x = Math.cos(a) * 0.058; spoke.position.z = Math.sin(a) * 0.058;
      spoke.rotation.y = -a;
    }
    add(new THREE.CylinderGeometry(0.034, 0.034, 0.006, 24), machined, [0, face + sign * 0.003, 0], `rotor-motor-${label}-boss`);
    // Band of small radial holes, and screws in notches at the rotor-side edge.
    for (let k = 0; k < A.boltHoles; k += 1) {
      const a = k / A.boltHoles * Math.PI * 2;
      const hole = add(new THREE.CylinderGeometry(0.0032, 0.0032, 0.003, 8), darkInside, [Math.cos(a) * (R + 0.0005), face + sign * 0.27 * h, Math.sin(a) * (R + 0.0005)], `rotor-motor-${label}-hole`);
      hole.rotation.z = Math.PI / 2; hole.rotation.y = -a;
    }
    for (let k = 0; k < 5; k += 1) {
      const a = (k + 0.5) / 5 * Math.PI * 2;
      add(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 8), fastener, [Math.cos(a) * (R - 0.006), face + sign * 0.006, Math.sin(a) * (R - 0.006)], `rotor-motor-${label}-screw`);
    }
    // Shaft spacer from the spoked face to the rotor's hub plate.
    const rotorY = faceDown ? A.rotorY[0] : A.rotorY[1];
    const gapTop = Math.max(face, rotorY), gapBottom = Math.min(face, rotorY);
    add(new THREE.CylinderGeometry(0.03, 0.03, gapTop - gapBottom, 20), machined, [0, (gapTop + gapBottom) / 2, 0], `rotor-shaft-${label}`);
  }
  return head;
}

// The rotor's flat hub plate with its bolt circle, built in the rotor group (scaled with the rotor).
export function buildHubPlate({ parent, mesh, scale, material }) {
  const A = rotorHeadAsset, r = A.hubPlateRadiusM / scale, t = A.hubPlateThicknessM / scale;
  const plate = mesh(new THREE.CylinderGeometry(r, r, t, 36), material, [0, 0, 0], parent);
  plate.name = "rotor-hub-plate";
  for (let k = 0; k < 6; k += 1) {
    const a = k / 6 * Math.PI * 2 + Math.PI / 6;
    for (const s of [-1, 1]) {
      const bolt = mesh(new THREE.CylinderGeometry(0.006 / scale, 0.006 / scale, 0.004 / scale, 6), fastener, [Math.cos(a) * 0.075 / scale, s * (t / 2 + 0.002 / scale), Math.sin(a) * 0.075 / scale], parent);
      bolt.name = "rotor-hub-bolt";
    }
  }
  return plate;
}
