import * as THREE from "./vendor/three/three.module.min.js";
import { aftBulkheadAsset } from "./aft-bulkhead.mjs?v=dev";

// Parts 17, 18 and 19: the Titan-surface air loop. Published layout [PUB]:
// - TFAWS 2023 (Holtzman and Castano, APL) slide 4: fan and ducting at the MMRTG; warm ducted
//   flow forward under the floor; open flow into the body under the nose and back aft through
//   the bay to the MMRTG; a cold duct along the belly, outside the foam, between gas diverter
//   valves "located fore and aft of the Lander ducting", next to the leg/arm attachments.
//   Slide 3 plan view: the ducting on the centerline and the "Fans" (two, side by side) at the
//   MMRTG end. Slide 7: Fan-A and Fan-B, Divert1 and Divert2. Slide 8: trim opens in 2% steps
//   up to 40% of the airflow; fan allocation 15 W.
// - TFAWS 2024 (Lin, APL), full-scale test module: a "cold duct trim device" with an aft and a
//   front diverter flap; heat rejection rose with flap angle up to 23.7 degrees.
// - ICES-2023-389 p. 2-3: air enters the body below the nose; the hottest ducting is around the
//   fan, where air comes straight out of the MMRTG. (Its side "chimney" trim device is an
//   earlier concept; that drawing is archived in archive/thermal-loop-2026-10-14.)
// Sizes [CALC from the slide 3 plan view, scaled to this model's arm roots]: duct about 0.14 m
// wide, from z -1.18 to +0.93, widening to the fans; fans about 0.13 m, near z +1.2. Duct height,
// cold-duct section, housing shapes, flap hinge sides and the actuators are [EST].
export const thermalLoopAsset = Object.freeze({
  revision: "thermal-loop-2026-10-15b",
  // y lowered 7.5 mm on Oct 15 so the duct and its joint flanges sit fully under the bay floor
  // (y -0.284), inside the foam; the first position is archived (archive/warm-duct-v1-2026-10-15).
  duct: Object.freeze({ width: 0.14, height: 0.045, y: -0.3125, front: -1.175, back: 0.93 }),
  // Fans moved 12 cm forward on Oct 15 to clear the canted aft bulkhead (part 16); first position
  // z 1.16, archived in archive/fans-v1-2026-10-15.
  fans: Object.freeze({ diameter: 0.115, centers: Object.freeze([Object.freeze([-0.068, -0.19, 1.04]), Object.freeze([0.068, -0.19, 1.04])]) }),
  coldDuct: Object.freeze({ width: 0.14, height: 0.035, y: -0.3775, front: -0.56, back: 0.6 }),
  diverters: Object.freeze({ front: -0.61, aft: 0.67 }),
  maxFlapDeg: 24,
  bellyY: -0.36,
});

// A box whose +z end is scaled to (w1, h1) and -z end to (w0, h0): a rectangular taper.
function taperGeometry(w0, h0, w1, h1, length) {
  const g = new THREE.BoxGeometry(1, 1, length);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const back = p.getZ(i) > 0;
    p.setX(i, p.getX(i) * (back ? w1 : w0));
    p.setY(i, p.getY(i) * (back ? h1 : h0));
  }
  g.computeVertexNormals();
  return g;
}
// A taper running straight along z from z0 to z1 whose end rises from y0 to y1 (end faces stay
// upright), for duct sections that climb while running fore-aft.
function taperAlongZ(mesh, z0, z1, y0, y1, w0, h0, w1, h1, material, target) {
  const length = Math.abs(z1 - z0), g = taperGeometry(w0, h0, w1, h1, length);
  const p = g.attributes.position, up = y1 - y0; // the +z end is the z1 end, rotated or not
  for (let i = 0; i < p.count; i += 1) p.setY(i, p.getY(i) + (p.getZ(i) > 0 ? up / 2 : -up / 2));
  g.computeVertexNormals();
  const part = mesh(g, material, [0, (y0 + y1) / 2, (z0 + z1) / 2], target);
  if (z1 < z0) part.rotation.y = Math.PI;
  return part;
}
// Place a taper between two points (centers of its two ends), its width staying along x.
function taperBetween(mesh, a, b, w0, h0, w1, h1, material, target) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const part = mesh(taperGeometry(w0, h0, w1, h1, A.distanceTo(B)), material, A.clone().lerp(B, 0.5).toArray(), target);
  // Local +z along A->B, local +x kept as close to the vehicle's x as possible (no roll).
  const z = B.clone().sub(A).normalize();
  const x = new THREE.Vector3(1, 0, 0).addScaledVector(z, -z.x).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  part.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return part;
}

export function buildWarmDuct({ parent, mesh }) {
  const { width: W, height: H, y, front, back } = thermalLoopAsset.duct;
  const group = new THREE.Group(); group.name = "warm-duct"; group.userData.inspectionLayer = "equipment-casings";
  parent.add(group);
  Object.assign(parent.userData, { assetRevision: thermalLoopAsset.revision, dimensionConfidence: "CALC+EST" });
  const duct = new THREE.MeshStandardMaterial({ color: 0xd8c27a, roughness: 0.5, metalness: 0.35 }); // plan-view ducting color
  const transition = new THREE.MeshStandardMaterial({ color: 0x9a3b2c, roughness: 0.5, metalness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb4bbbf, roughness: 0.35, metalness: 0.75 });
  // Main run under the floor, with flange rings at its joints.
  const run = mesh(new THREE.BoxGeometry(W, H, back - front), duct, [0, y, (front + back) / 2], group);
  run.name = "warm-duct-run";
  for (let z = front + 0.3; z < back; z += 0.42) mesh(new THREE.BoxGeometry(W + 0.012, H + 0.012, 0.012), steel, [0, y, z], group).name = "warm-duct-flange";
  // Nose end: the duct turns up and opens into the body below the nose.
  const elbow = taperBetween(mesh, [0, y, front], [0, -0.215, front - 0.12], W, H, W, 0.07, transition, group);
  elbow.name = "warm-duct-nose-outlet";
  const grille = mesh(new THREE.BoxGeometry(W + 0.006, 0.006, 0.075), steel, [0, -0.18, front - 0.15], group);
  grille.rotation.x = 0.55; grille.name = "warm-duct-outlet-grille";
  // Aft end: the flared transition up to the two fans.
  const [, fy, fz] = thermalLoopAsset.fans.centers[0];
  const diffuser = taperAlongZ(mesh, back, fz - 0.045, y, fy, W, H, 0.27, 0.13, transition, group);
  diffuser.name = "warm-duct-fan-transition";
  return { group };
}

export function buildFans({ parent, mesh }) {
  const group = new THREE.Group(); group.name = "circulation-fans"; parent.add(group);
  Object.assign(parent.userData, { assetRevision: thermalLoopAsset.revision, dimensionConfidence: "CALC+EST" });
  const layer = (name, inspectionLayer) => { const g = new THREE.Group(); g.name = name; g.userData.inspectionLayer = inspectionLayer; group.add(g); return g; };
  const casings = layer("fan-housings", "equipment-casings");
  const rotors = layer("fan-rotors", "equipment-casings");
  const adapters = layer("fan-mmrtg-adapter", "interfaces");
  const housing = new THREE.MeshStandardMaterial({ color: 0x6f3f9a, roughness: 0.45, metalness: 0.45 }); // plan-view fan color
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.5, metalness: 0.4 });
  const blade = new THREE.MeshStandardMaterial({ color: 0xb9bfc3, roughness: 0.3, metalness: 0.8 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.4, metalness: 0.65 });
  const D = thermalLoopAsset.fans.diameter, fanRotors = [];
  thermalLoopAsset.fans.centers.forEach(([x, y, z], i) => {
    const name = i === 0 ? "fan-a" : "fan-b";
    // Square housing with a round bore, flanges front and back.
    mesh(new THREE.BoxGeometry(D + 0.016, D + 0.016, 0.07), housing, [x, y, z], casings).name = `${name}-housing`;
    for (const dz of [-0.035, 0.035]) mesh(new THREE.BoxGeometry(D + 0.026, D + 0.026, 0.006), housing, [x, y, z + dz], casings).name = `${name}-flange`;
    // Rotor: hub with the motor behind it and seven blades, visible through the bore.
    const rotor = new THREE.Group(); rotor.name = `${name}-rotor`; rotor.position.set(x, y, z - 0.036); rotors.add(rotor);
    const hub = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16), dark, [0, 0, 0], rotor); hub.rotation.x = Math.PI / 2;
    for (let k = 0; k < 7; k += 1) {
      const b = mesh(new THREE.BoxGeometry(0.008, D * 0.36, 0.003), blade, [0, 0, 0], rotor);
      b.rotation.z = k * Math.PI * 2 / 7; b.position.set(Math.sin(-b.rotation.z) * D * 0.25, Math.cos(b.rotation.z) * D * 0.25, 0);
      b.rotation.y = 0.5; b.name = "fan-blade";
    }
    const motor = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 16), dark, [x, y, z + 0.005], casings); motor.rotation.x = Math.PI / 2; motor.name = `${name}-motor`;
    fanRotors.push(rotor);
  });
  // Adapter collar from the fans aft to the forward face of the canted aft bulkhead (part 16),
  // behind the MMRTG interface: the grey part in the plan view. How the air crosses the bulkhead
  // to the MMRTG's housing is not published [EST].
  const [, y0, z0] = thermalLoopAsset.fans.centers[0];
  const B = aftBulkheadAsset, start = new THREE.Vector3(0, y0 + 0.015, z0 + 0.038);
  const depth = new THREE.Vector3(...B.normal).dot(start.clone().sub(new THREE.Vector3(...B.interfaceCenter)));
  const end = start.clone().addScaledVector(new THREE.Vector3(...B.normal), -depth - B.plate.thickness - 0.002);
  const adapter = taperBetween(mesh, start.toArray(), end.toArray(), 0.27, 0.13, 0.25, 0.12, grey, adapters);
  adapter.name = "fan-mmrtg-adapter-duct";
  return { group, casings, rotors: fanRotors, adapters };
}

export function buildTrimDevice({ parent, mesh }) {
  const group = new THREE.Group(); group.name = "trim-device"; parent.add(group);
  Object.assign(parent.userData, { assetRevision: thermalLoopAsset.revision, dimensionConfidence: "PUB+EST" });
  const layer = (name, inspectionLayer) => { const g = new THREE.Group(); g.name = name; g.userData.inspectionLayer = inspectionLayer; group.add(g); return g; };
  const ductLayer = layer("cold-duct", "equipment-casings");
  const housings = layer("diverter-housings", "insulation");
  const valves = layer("diverter-flaps", "interfaces");
  const actuators = layer("diverter-actuators", "equipment-casings");
  const alum = new THREE.MeshStandardMaterial({ color: 0xc3c9cd, roughness: 0.35, metalness: 0.8 });
  const foam = new THREE.MeshStandardMaterial({ color: 0xdcd3c1, roughness: 0.85, metalness: 0.04 });
  const flapMat = new THREE.MeshStandardMaterial({ color: 0xc8ccc8, roughness: 0.4, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272a, roughness: 0.5, metalness: 0.4 });
  const { width: W, height: H, y, front, back } = thermalLoopAsset.coldDuct;
  // Cold duct: an aluminum channel along the belly, outside the foam, exposed to Titan, with ribs.
  mesh(new THREE.BoxGeometry(W, H, back - front), alum, [0, y, (front + back) / 2], ductLayer).name = "cold-duct-channel";
  for (let z = front + 0.1; z < back; z += 0.1) mesh(new THREE.BoxGeometry(W + 0.008, 0.006, 0.008), alum, [0, y - H / 2 - 0.003, z], ductLayer).name = "cold-duct-rib";
  const flaps = [];
  for (const [end, zc] of Object.entries(thermalLoopAsset.diverters)) {
    const dir = end === "aft" ? 1 : -1;
    // Foam-covered wedge housing below the belly around each diverter (as in the 2024 test module).
    const housing = taperBetween(mesh, [0, -0.375, zc - dir * 0.09], [0, -0.395, zc + dir * 0.06], 0.18, 0.04, 0.2, 0.07, foam, housings);
    housing.name = `${end}-diverter-housing`;
    // Diverter flap in the warm-duct floor, hinged across the duct; opens with the trim setting.
    const hinge = new THREE.Group();
    hinge.name = `trim-flap-${end}`;
    hinge.position.set(0, thermalLoopAsset.duct.y - thermalLoopAsset.duct.height / 2, zc + dir * 0.045);
    valves.add(hinge);
    mesh(new THREE.BoxGeometry(W - 0.012, 0.006, 0.09), flapMat, [0, 0, -dir * 0.045], hinge).name = `${end}-diverter-flap`;
    flaps.push({ hinge, dir });
    // Short riser from the warm-duct opening down to the cold duct.
    mesh(new THREE.BoxGeometry(W, 0.05, 0.08), alum, [0, -0.35, zc], ductLayer).name = `${end}-diverter-riser`;
    // Actuator on the side of the riser [EST].
    const act = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 14), dark, [W / 2 + 0.02, -0.36, zc], actuators);
    act.rotation.x = Math.PI / 2; act.name = `${end}-diverter-actuator`;
  }
  return { group, flaps, ductLayer, housings, valves, actuators };
}

// Air-loop paths for the flow arrows, following the parts above.
export function airLoopPaths() {
  const d = thermalLoopAsset.duct, c = thermalLoopAsset.coldDuct, v = thermalLoopAsset.diverters;
  const [, fy, fz] = thermalLoopAsset.fans.centers[0];
  // Through the tilted MMRTG (aft-bulkhead.mjs), out its base and down the adapter to the fans.
  const [, my, mz] = aftBulkheadAsset.mmrtgCenter, [, iy, iz] = aftBulkheadAsset.interfaceCenter;
  const main = new THREE.CatmullRomCurve3([
    [0, my, mz], [0, -0.16, 1.14], [0, fy, fz], [0, -0.27, 0.97], [0, d.y, 0.85], [0, d.y, 0], [0, d.y, -1.1],
    [0, -0.24, -1.27], [0, -0.12, -1.36], [0, -0.02, -1.25], [0.05, -0.02, -0.5], [0.05, 0.04, 0.3], [0, 0.03, 0.92], [0, iy + 0.06, iz - 0.04],
  ].map(p => new THREE.Vector3(...p)), true, "catmullrom", 0.2);
  const bypass = new THREE.CatmullRomCurve3([
    [0, d.y, v.aft + 0.1], [0, -0.33, v.aft], [0, c.y, c.back], [0, c.y, 0], [0, c.y, c.front], [0, -0.33, v.front], [0, d.y, v.front - 0.1],
  ].map(p => new THREE.Vector3(...p)), false, "catmullrom", 0.3);
  return { main, bypass };
}
