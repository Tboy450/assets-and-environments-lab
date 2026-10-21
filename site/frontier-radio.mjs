import * as THREE from "./vendor/three/three.module.min.js";

// Part 13: APL Frontier software-defined radio, enclosure level. The look follows the APL photo
// on NASA's Dragonfly pages (black anodized stack of four slices, labeled connectors J11-J32,
// bolted feet, semi-rigid coax on top). Size: Frontier is built from "four or more 4 x 6 inch
// packaged slices" [PUB, O'Neill et al., SSC16-VII-2, 2016], so the side face is 4 x 6 inches.
// In the photo the connector face is about as wide as it is tall, so the four slices stack to
// about 4 inches [EST]: about 1,570 cm3, inside the 2,050 cm3 and 2.1 kg that APL publishes for
// Frontier [PUB, iCubeSat 2019 table; eoPortal], which may describe a larger configuration or
// include connectors and feet. The slice split, connector positions, feet and coax routes are
// read from the photo [EST]. Placement on the starboard bay floor with the connector face
// pointing inboard is [EST]. Whether Dragonfly carries a second, redundant unit is not
// published; one is drawn.
const inch = 0.0254;
const heightM = 4 * inch, lengthM = 6 * inch;
// Slice thicknesses across the stack, from the photo's connector-face proportions [EST].
const slicesM = Object.freeze([0.025, 0.029, 0.022, 0.0256]);
const widthM = Math.round(slicesM.reduce((sum, t) => sum + t, 0) * 1e4) / 1e4;
export const frontierRadioAsset = Object.freeze({
  revision: "frontier-radio-2026-10-13",
  heightM, lengthM, widthM, slicesM,
  publishedMassKg: 2.1,
  publishedVolumeCm3: 2050,
  // Base center on the bay floor (outer bottom -0.36 m plus 7.62 cm foam) [CALC/EST].
  position: Object.freeze([0.22, -0.284, 0.2]),
  // The connector face (local -z) turns inboard toward the centerline harness run [EST].
  yaw: Math.PI / 2,
  bounds: Object.freeze({ min: [0.12, -0.285, 0.14], max: [0.32, -0.15, 0.26] }),
});

export function buildFrontierRadio({ parent, mesh }) {
  const { slicesM, position, yaw } = frontierRadioAsset;
  const assembly = new THREE.Group();
  assembly.name = "frontier-radio-assembly";
  assembly.position.fromArray(position);
  assembly.rotation.y = yaw;
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: frontierRadioAsset.revision, dimensionConfidence: "PUB+EST" });
  const group = (name, inspectionLayer) => {
    const g = new THREE.Group(); g.name = name; g.userData.inspectionLayer = inspectionLayer;
    assembly.add(g); return g;
  };
  const slices = group("frontier-radio-slices", "equipment-casings");
  const mounts = group("frontier-radio-mounts", "mounts");
  const connectors = group("frontier-radio-connectors", "interfaces");
  const lines = group("frontier-radio-rf-lines", "harnesses");
  const anodized = new THREE.MeshStandardMaterial({ color: 0x2b3033, roughness: 0.52, metalness: 0.35 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x0e1012, roughness: 0.8, metalness: 0.2 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9bfc3, roughness: 0.32, metalness: 0.75 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd2a640, roughness: 0.3, metalness: 0.85 });
  const label = new THREE.MeshStandardMaterial({ color: 0xe6e3d8, roughness: 0.7, metalness: 0.05 });
  const staking = new THREE.MeshStandardMaterial({ color: 0x4f9a45, roughness: 0.6, metalness: 0.05 });
  const foil = new THREE.MeshStandardMaterial({ color: 0xd9dcde, roughness: 0.25, metalness: 0.85 });
  const W = widthM, H = heightM, L = lengthM, face = -L / 2;
  const box = (size, at, material, target, name) => {
    const part = mesh(new THREE.BoxGeometry(...size), material, at, target);
    part.name = name; return part;
  };
  const rod = (r, length, at, material, target, axis, name, sides = 12) => {
    const part = mesh(new THREE.CylinderGeometry(r, r, length, sides), material, at, target);
    if (axis === "x") part.rotation.z = Math.PI / 2;
    if (axis === "z") part.rotation.x = Math.PI / 2;
    part.name = name; return part;
  };
  const tube = (points, radius, material, target, name) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, "centripetal");
    const part = mesh(new THREE.TubeGeometry(curve, 24, radius, 6, false), material, [0, 0, 0], target);
    part.name = name; return part;
  };

  // Slices: a dark core shows through as the seams between the anodized slice packages.
  box([W - 0.002, H - 0.002, L - 0.002], [0, H / 2, 0], seam, slices, "frontier-radio-core");
  // Seen from in front of the connector face (local -z), the viewer's left is local +x, so
  // slice 1 (J11/J12) starts at +x to match the photo.
  const centers = [];
  let x = W / 2;
  slicesM.forEach((t, i) => {
    centers.push(x - t / 2);
    box([t - 0.0012, H, L], [x - t / 2, H / 2, 0], anodized, slices, `frontier-radio-slice-${i + 1}`);
    x -= t;
  });
  // Staked screws on both end covers and at the connector-face corners.
  for (const side of [-1, 1]) {
    for (const y of [0.012, H - 0.012]) for (const z of [-L / 2 + 0.012, 0, L / 2 - 0.012]) {
      rod(0.0028, 0.002, [side * (W / 2 + 0.001), y, z], staking, slices, "x", "frontier-radio-cover-screw", 8);
    }
    for (const y of [0.01, H - 0.008]) rod(0.0026, 0.004, [side * (W / 2 - 0.006), y, face - 0.002], steel, slices, "z", "frontier-radio-face-screw", 8);
  }

  // Feet: a bolted flange across the bottom of each end, one hole per slice, with ribs at the seams.
  for (const end of [-1, 1]) {
    const zf = end * (L / 2 + 0.007);
    box([W, 0.006, 0.014], [0, 0.003, zf], anodized, mounts, "frontier-radio-foot-flange");
    let seamX = W / 2;
    for (let i = 0; i <= slicesM.length; i += 1) {
      box([0.003, 0.02, 0.014], [Math.max(-W / 2 + 0.0015, Math.min(W / 2 - 0.0015, seamX)), 0.01, zf], anodized, mounts, "frontier-radio-foot-rib");
      seamX -= slicesM[i] ?? 0;
    }
    for (const cx of centers) rod(0.0032, 0.004, [cx, 0.007, zf + end * 0.001], steel, mounts, "y", "frontier-radio-mount-bolt", 6);
  }

  // Connector face (photo labels). D-subs: steel shell with a dark insert.
  const dsub = (cx, cy, name) => {
    box([0.012, 0.024, 0.005], [cx, cy, face - 0.0025], steel, connectors, name);
    box([0.0075, 0.018, 0.0012], [cx, cy, face - 0.0056], seam, connectors, `${name}-insert`);
  };
  const plate = (cx, cy, name) => {
    box([0.008, 0.016, 0.0012], [cx, cy, face - 0.0006], label, connectors, name);
    rod(0.0032, 0.004, [cx, cy, face - 0.003], seam, connectors, "z", `${name}-receptacle`, 10);
  };
  const sma = (cx, cy, name, adapter = false) => {
    rod(0.0042, 0.0015, [cx, cy, face - 0.0008], staking, connectors, "z", `${name}-staking`, 10);
    rod(0.0038, 0.003, [cx, cy, face - 0.003], steel, connectors, "z", `${name}-nut`, 6);
    rod(0.0024, 0.009, [cx, cy, face - 0.009], gold, connectors, "z", name, 10);
    if (adapter) box([0.006, 0.012, 0.007], [cx, cy - 0.004, face - 0.016], steel, connectors, `${name}-adapter`);
  };
  const [s1, s2, s3, s4] = centers;
  dsub(s1, 0.068, "frontier-radio-J11");
  plate(s1, 0.032, "frontier-radio-J12");
  plate(s2 + 0.0085, 0.072, "frontier-radio-J23");
  dsub(s2 - 0.0065, 0.068, "frontier-radio-J21");
  plate(s2 + 0.0085, 0.034, "frontier-radio-J24");
  dsub(s2 - 0.0065, 0.032, "frontier-radio-J22");
  sma(s3, 0.074, "frontier-radio-J51", true);
  sma(s4, 0.074, "frontier-radio-J31");
  rod(0.0038, 0.003, [s4, 0.042, face - 0.003], steel, connectors, "z", "frontier-radio-J32-nut", 6);
  rod(0.0044, 0.009, [s4 - 0.002, 0.042, face - 0.009], gold, connectors, "z", "frontier-radio-J32-cap", 12);
  tube([[s4 - 0.004, 0.039, face - 0.012], [s4 - 0.012, 0.03, face - 0.014], [s4 - 0.012, 0.016, face - 0.01], [s4 - 0.006, 0.008, face - 0.004]], 0.0007, gold, connectors, "frontier-radio-J32-cap-chain");

  // Top: SMA bulkheads joined by semi-rigid coax, one bundle wrapped in foil (as photographed).
  const topY = H;
  const bulkheads = [[s1, -0.035], [s3, -0.05], [s2, 0.012], [s4, -0.004], [s1, 0.045], [s2, 0.058]];
  for (const [bx, bz] of bulkheads) {
    rod(0.0042, 0.0015, [bx, topY + 0.0008, bz], staking, connectors, "y", "frontier-radio-top-staking", 10);
    rod(0.0036, 0.004, [bx, topY + 0.003, bz], steel, connectors, "y", "frontier-radio-top-bulkhead", 6);
  }
  const lift = (p, h) => [p[0], topY + h, p[1]];
  const route = (a, b, h) => [lift(a, 0.005), lift(a, h), lift([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], h + 0.004), lift(b, h), lift(b, 0.005)];
  tube(route(bulkheads[0], bulkheads[1], 0.014), 0.0016, steel, lines, "frontier-radio-semirigid-coax");
  tube(route(bulkheads[2], bulkheads[3], 0.011), 0.0016, steel, lines, "frontier-radio-semirigid-coax");
  tube(route(bulkheads[4], bulkheads[5], 0.016), 0.0042, foil, lines, "frontier-radio-wrapped-coax");
  return { assembly, slices, mounts, connectors, lines };
}
