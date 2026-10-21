import * as THREE from "./vendor/three/three.module.min.js";

// Part 10: the high-gain antenna (HGA) gimbal: azimuth and elevation actuators, the motorized arm
// and the stow locks. Published: the HGA is an 87.4 cm radial line slot disc on a motorized arm
// that raises it when the lander is stationary and lowers it into a locking mechanism before each
// flight (APL, July 2026); it is attached to the top deck on a gimbal (NASA, June 2026). The
// assembly, "including actuators for movement in azimuth and elevation", sits under tan foam
// forward of the stowed dish, with a launch lock under the dish and flight locks on either side of
// it (ICES-2023-389 p. 2, fig. 1); the actuators are tied to Titan and run cold, drawn in fig. 3 as
// a stacked turntable under a hooded drum. The gimbal's internal portion is under the deck; the
// part above the deck is under a 5 cm Rohacell dome that lets the dish move in azimuth and
// elevation, and the gimbal-to-dish attachment is thermally isolated (ICES-2020-160 p. 5). The
// look follows APL's photo of the flight arm: a gold actuator drum, the arm, a gray truss pedestal
// under the dish center with a flexible feed line, gold hardware under the deck. Sizes, the 0.6 m
// arm and the hinge at z -0.55 (both measured on ICES-2023 fig. 1 against the dish's 87.4 cm),
// lock positions, colors and the azimuth limit near the attic are [EST].
const deckY = 0.07, foamTop = 0.10;
export const hgaAsset = Object.freeze({
  revision: "hga-gimbal-2026-10-14",
  deckY, foamTop,
  dishDiameterM: 0.874,
  dishThicknessM: 0.03,
  // Elevation axis (across the body) and the azimuth axis through it.
  hinge: Object.freeze([0, 0.185, -0.55]),
  armLengthM: 0.6,
  // Dish center relative to the hinge with the arm stowed (aft along +z).
  headLocal: Object.freeze([0, 0.065, 0.6]),
  stowedDishCenter: Object.freeze([0, 0.25, 0.05]),
  turntableRadiusM: 0.15,
  domeRadiusM: 0.115,
  // Under-deck rotary joint flange, where the TWTA waveguide comes in.
  rotaryJoint: Object.freeze([0, -0.033, -0.55]),
  launchLock: Object.freeze([0, 0.44]),
  flightLockAngleDeg: 65,
  flightLockRadiusM: 0.38,
  // The deployed dish must stay out of the attic: behind its aft wall or above its top.
  attic: Object.freeze({ aftZ: -0.73, halfWidth: 0.445, top: 0.6 }),
});

const yAxis = new THREE.Vector3(0, 1, 0), xAxis = new THREE.Vector3(1, 0, 0);
const qAz = new THREE.Quaternion(), qEl = new THREE.Quaternion(), tmp = new THREE.Vector3(), aim = new THREE.Vector3();

// Dish center and orientation in the model frame for azimuth phi (arm direction, 0 = aft) and
// elevation theta (0 = stowed flat).
export function dishTransform(phi, theta, position = new THREE.Vector3(), quaternion = new THREE.Quaternion()) {
  qAz.setFromAxisAngle(yAxis, phi);
  qEl.setFromAxisAngle(xAxis, -theta);
  quaternion.copy(qAz).multiply(qEl);
  position.fromArray(hgaAsset.headLocal).applyQuaternion(quaternion).add(tmp.fromArray(hgaAsset.hinge));
  return { position, quaternion };
}

// Points on the dish rim (and its center) in the model frame.
export function dishPoints(phi, theta, count = 32) {
  const { position, quaternion } = dishTransform(phi, theta);
  const r = hgaAsset.dishDiameterM / 2, points = [position.clone()];
  for (let i = 0; i < count; i += 1) {
    const a = i / count * Math.PI * 2;
    for (const y of [-hgaAsset.dishThicknessM / 2, hgaAsset.dishThicknessM / 2]) {
      points.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).applyQuaternion(quaternion).add(position));
    }
  }
  return points;
}

export function clearsAttic(phi, theta) {
  const { aftZ, halfWidth, top } = hgaAsset.attic;
  return dishPoints(phi, theta).every(p => p.z > aftZ || Math.abs(p.x) > halfWidth || p.y > top);
}

// Gimbal angles that point the dish face at a direction given in the model frame. The dish faces
// back over the hinge, so the arm points away from the target; azimuths that would swing the
// dish into the attic are pulled back toward aft (the flight range is not published).
export function gimbalAngles(target) {
  const t = aim.copy(target).normalize();
  const theta = t.y > 0 ? Math.acos(Math.min(1, t.y)) : Math.PI / 2;
  const horizontal = Math.hypot(t.x, t.z);
  const wanted = horizontal > 1e-6 ? Math.atan2(-t.x, -t.z) : 0;
  let phi = wanted;
  for (let k = 1; k <= 48 && !clearsAttic(phi, theta); k += 1) phi = wanted * (1 - k / 48);
  return { theta, phi, limited: Math.abs(phi - wanted) > 1e-9 };
}

export function buildHgaGimbal({ parent, mesh, head }) {
  const { hinge, headLocal } = hgaAsset;
  const assembly = new THREE.Group();
  assembly.name = "hga-gimbal-assembly";
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: hgaAsset.revision, dimensionConfidence: "PUB+EST" });
  const group = (name, inspectionLayer, target = assembly) => {
    const g = new THREE.Group(); g.name = name; if (inspectionLayer) g.userData.inspectionLayer = inspectionLayer;
    target.add(g); return g;
  };
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.32, metalness: 0.85 });
  const alodine = new THREE.MeshStandardMaterial({ color: 0xbfa65e, roughness: 0.45, metalness: 0.7 });
  const aluminum = new THREE.MeshStandardMaterial({ color: 0xb8bdc2, roughness: 0.4, metalness: 0.7 });
  const truss = new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.5, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x33383c, roughness: 0.55, metalness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc6cbce, roughness: 0.3, metalness: 0.8 });
  const corrugated = new THREE.MeshStandardMaterial({ color: 0xd5d9db, roughness: 0.35, metalness: 0.85 });
  const isolator = new THREE.MeshStandardMaterial({ color: 0xb9b27c, roughness: 0.7, metalness: 0.05 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x3a3f42, roughness: 0.8, metalness: 0.05 });
  const lacing = new THREE.MeshStandardMaterial({ color: 0xe9e4cf, roughness: 0.8, metalness: 0.05 });
  const rohacell = new THREE.MeshStandardMaterial({ color: 0xd8c79c, roughness: 0.92, metalness: 0 });
  const box = (size, at, material, target, name) => {
    const part = mesh(new THREE.BoxGeometry(...size), material, at, target);
    part.name = name; return part;
  };
  const rod = (r, length, at, material, target, axis, name, sides = 16) => {
    const part = mesh(new THREE.CylinderGeometry(r, r, length, sides), material, at, target);
    if (axis === "x") part.rotation.z = Math.PI / 2;
    if (axis === "z") part.rotation.x = Math.PI / 2;
    part.name = name; return part;
  };
  const bar = (a, b, r, material, target, name) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const part = mesh(new THREE.CylinderGeometry(r, r, from.distanceTo(to), 8), material, from.clone().add(to).multiplyScalar(0.5).toArray(), target);
    part.quaternion.setFromUnitVectors(yAxis, to.clone().sub(from).normalize());
    part.name = name; return part;
  };
  const tube = (points, radius, material, target, name, sides = 8) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, "centripetal");
    const part = mesh(new THREE.TubeGeometry(curve, 32, radius, sides, false), material, [0, 0, 0], target);
    part.name = name; return part;
  };
  const [hx, , hz] = hinge;

  // ---- Fixed: the internal portion under the deck (azimuth bearing, drive, rotary joint) and the
  // collar through the deck foam.
  const drive = group("hga-under-deck-drive", "equipment-casings");
  const mounts = group("hga-mounts", "mounts");
  const ports = group("hga-interfaces", "interfaces");
  const harness = group("hga-harnesses", "harnesses");
  rod(0.15, 0.008, [hx, deckY - 0.004, hz], alodine, mounts, null, "hga-stator-flange", 32);
  for (let i = 0; i < 12; i += 1) {
    const a = i / 12 * Math.PI * 2;
    rod(0.005, 0.004, [hx + Math.cos(a) * 0.137, deckY - 0.01, hz + Math.sin(a) * 0.137], steel, mounts, null, "hga-stator-bolt", 6);
  }
  rod(0.12, 0.042, [hx, 0.041, hz], gold, drive, null, "hga-azimuth-bearing-housing", 32);
  rod(0.085, foamTop - deckY, [hx, (deckY + foamTop) / 2, hz], gold, drive, null, "hga-deck-collar", 24);
  rod(0.034, 0.05, [hx - 0.09, -0.005, hz], dark, drive, null, "hga-azimuth-motor", 16);
  rod(0.026, 0.022, [hx - 0.09, -0.041, hz], gold, drive, null, "hga-azimuth-motor-cap", 16);
  rod(0.028, 0.05, [hx, -0.005, hz], steel, ports, null, "hga-rotary-joint", 16);
  box([0.048, 0.006, 0.048], hgaAsset.rotaryJoint, steel, ports, "hga-rotary-joint-flange");
  box([0.018, 0.026, 0.03], [hx - 0.135, 0.01, hz], dark, ports, "hga-drive-connector");
  const motorHarness = tube([[hx - 0.144, 0.01, hz], [hx - 0.19, 0.01, hz - 0.02], [hx - 0.26, 0.04, hz - 0.06], [hx - 0.3, 0.06, hz - 0.08]], 0.006, jacket, harness, "hga-drive-harness");
  rod(0.008, 0.006, [hx - 0.3, 0.06, hz - 0.08], lacing, harness, "x", "hga-harness-tie", 10);

  // ---- Stow locks on the deck under the dish: a launch lock at the aft rim with a cup for the
  // pin under the dish, and a flight lock on either side of it.
  const [lx, lz] = hgaAsset.launchLock, dishUnder = hgaAsset.stowedDishCenter[1] - hgaAsset.dishThicknessM / 2;
  box([0.08, 0.008, 0.08], [lx, foamTop + 0.004, lz], aluminum, mounts, "hga-launch-lock-base");
  rod(0.02, dishUnder - 0.02 - foamTop - 0.008, [lx, (foamTop + 0.008 + dishUnder - 0.02) / 2, lz], aluminum, mounts, null, "hga-launch-lock-post");
  const cup = mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.02, 16, 1, true), dark, [lx, dishUnder - 0.01, lz], mounts);
  cup.name = "hga-launch-lock-cup";
  for (const side of [-1, 1]) {
    const a = side * THREE.MathUtils.degToRad(hgaAsset.flightLockAngleDeg), r = hgaAsset.flightLockRadiusM;
    const lock = new THREE.Group();
    lock.name = "hga-flight-lock";
    lock.position.set(Math.sin(a) * r, 0, hgaAsset.stowedDishCenter[2] + Math.cos(a) * r);
    lock.rotation.y = a;
    mounts.add(lock);
    box([0.1, 0.008, 0.05], [0, foamTop + 0.004, 0], aluminum, lock, "hga-flight-lock-base");
    box([0.07, dishUnder - 0.027 - foamTop - 0.008, 0.026], [0, (foamTop + 0.008 + dishUnder - 0.027) / 2, 0], aluminum, lock, "hga-flight-lock-body");
    box([0.08, 0.02, 0.04], [0, dishUnder - 0.017, 0], dark, lock, "hga-flight-lock-jaw");
  }

  // ---- Azimuth stage (turns about the vertical axis): turntable rings, yoke, elevation drum and
  // motor, cable wrap, and the foam dome over everything above the deck.
  const azimuth = group("hga-azimuth-stage", null);
  azimuth.position.set(hx, foamTop, hz);
  const azCasings = group("hga-azimuth-casings", "equipment-casings", azimuth);
  const dome = group("hga-foam-dome", "insulation", azimuth);
  rod(0.15, 0.012, [0, 0.006, 0], alodine, azCasings, null, "hga-turntable-lower-ring", 32);
  rod(0.13, 0.012, [0, 0.018, 0], gold, azCasings, null, "hga-turntable-upper-ring", 32);
  rod(0.11, 0.006, [0, 0.027, 0], alodine, azCasings, null, "hga-turntable-plate", 32);
  const axisY = hinge[1] - foamTop;
  for (const side of [-1, 1]) box([0.012, 0.1, 0.11], [side * 0.095, 0.08, 0], gold, azCasings, "hga-yoke-cheek");
  rod(0.055, 0.17, [0, axisY, 0], gold, azCasings, "x", "hga-elevation-actuator", 24);
  for (const side of [-1, 1]) rod(0.058, 0.006, [side * 0.088, axisY, 0], alodine, azCasings, "x", "hga-elevation-actuator-cap", 24);
  rod(0.032, 0.06, [0.13, axisY, 0], dark, azCasings, "x", "hga-elevation-motor", 16);
  const wrap = mesh(new THREE.TorusGeometry(0.05, 0.009, 8, 16, Math.PI / 2), gold, [0.115, axisY - 0.05, -0.05], azCasings);
  wrap.rotation.y = Math.PI / 2;
  wrap.name = "hga-cable-wrap";
  const foam = mesh(new THREE.CapsuleGeometry(hgaAsset.domeRadiusM, 0.13, 6, 20), rohacell, [0, axisY, 0], dome);
  foam.rotation.z = Math.PI / 2;
  foam.name = "hga-rohacell-dome";
  foam.userData.shell = true;

  // ---- Elevation stage (raises the arm about the drum axis): arm, pedestal, thermal isolator,
  // connector bracket and the flexible feed line up to the dish center.
  const elevation = group("hga-elevation-stage", null, azimuth);
  elevation.position.set(0, axisY, 0);
  const arm = group("hga-arm", "equipment-casings", elevation);
  const feed = group("hga-feed", "interfaces", elevation);
  const L = hgaAsset.armLengthM, armY = -0.03, under = headLocal[1] - hgaAsset.dishThicknessM / 2;
  box([0.13, 0.035, 0.05], [0, armY, 0.075], gold, arm, "hga-arm-root-fitting");
  for (const side of [-1, 1]) rod(0.011, L - 0.125, [side * 0.045, armY, (0.1 + L - 0.025) / 2], aluminum, arm, "z", "hga-arm-tube", 12);
  box([0.09, 0.01, 0.012], [0, armY, 0.34], aluminum, arm, "hga-arm-brace");
  box([0.12, 0.03, 0.05], [0, armY, L], dark, arm, "hga-arm-end-fitting");
  const pedTop = under - 0.008;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bar([sx * 0.05, armY + 0.015, L + sz * 0.02], [sx * 0.03, pedTop, L + sz * 0.03], 0.006, truss, arm, "hga-pedestal-leg");
    bar([sx * 0.05, armY + 0.015, L + sz * 0.02], [-sx * 0.03, pedTop, L + sz * 0.03], 0.004, truss, arm, "hga-pedestal-brace");
  }
  rod(0.055, 0.008, [0, pedTop - 0.004, L], truss, arm, null, "hga-pedestal-ring", 24);
  rod(0.06, 0.008, [0, under - 0.004, L], isolator, arm, null, "hga-thermal-isolator", 24);
  box([0.04, 0.02, 0.03], [0.05, armY + 0.03, L - 0.045], dark, feed, "hga-connector-bracket");
  for (const dz of [-0.008, 0.008]) rod(0.004, 0.012, [0.05, armY + 0.046, L - 0.045 + dz], gold, feed, null, "hga-bracket-connector", 10);
  tube([[0.025, armY + 0.012, 0.1], [0.025, armY + 0.016, 0.35], [0.022, armY + 0.02, L - 0.07], [0.008, armY + 0.05, L - 0.02], [0, under - 0.01, L]], 0.006, corrugated, feed, "hga-flexible-feed", 10);

  let state = { theta: 0, phi: 0, limited: false };
  const position = new THREE.Vector3(), quaternion = new THREE.Quaternion();
  const smooth = t => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
  // deployed 0..1: the arm rises first, then the azimuth stage turns (stowing runs it backwards).
  function pose(deployed, target) {
    const solved = target ? gimbalAngles(target) : { theta: 0, phi: 0, limited: false };
    const theta = solved.theta * smooth(deployed * 2), phi = solved.phi * smooth(deployed * 2 - 1);
    azimuth.rotation.y = phi;
    elevation.rotation.x = -theta;
    if (head) {
      dishTransform(phi, theta, position, quaternion);
      head.position.copy(position);
      head.quaternion.copy(quaternion);
    }
    state = { theta, phi, limited: solved.limited };
    return state;
  }
  pose(0);
  return { assembly, drive, mounts, ports, harness, azimuth, elevation, azCasings, dome, arm, feed, motorHarness, pose, get state() { return state; } };
}
