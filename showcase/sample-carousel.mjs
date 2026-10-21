import * as THREE from "./vendor/three/three.module.min.js";

// [EST] Photo/figure-based reconstruction, not flight CAD or a dimensioned drawing.
// NASA SVS 15003 (March 2026 photos); Barfknecht et al., SciTech 2024, figs. 1, 2, 6, 9.
// A roughly half-width cold zone in fig. 2, against the existing 0.72 m inner attic,
// gives a nominal 0.36 m drum. Positions and small details remain provisional.
export const carouselAsset = Object.freeze({
  revision: "carousel-2026-10-12",
  diameterM: 0.36,
  position: Object.freeze([-0.13, 0.08, -1.30]),
  inlet: Object.freeze([-0.07, 0.305, -0.092]),
  confidence: "Photo-referenced; dimensions and installed placement estimated",
});

export function buildSampleCarousel({ parent, mesh }) {
  const assembly = new THREE.Group();
  assembly.name = "sample-carousel-housing";
  assembly.position.fromArray(carouselAsset.position);
  assembly.userData.assetRevision = carouselAsset.revision;
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: carouselAsset.revision, dimensionConfidence: "EST" });
  const titanium = new THREE.MeshStandardMaterial({ color: 0xaeb4bc, metalness: 0.65, roughness: 0.38 });
  const aluminum = new THREE.MeshStandardMaterial({ color: 0xdce1df, metalness: 0.42, roughness: 0.48 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x343b41, metalness: 0.48, roughness: 0.45 });
  // Amber appearance follows the photos; the wrap's precise material is not asserted.
  const amber = new THREE.MeshStandardMaterial({ color: 0xac611b, metalness: 0.38, roughness: 0.38 });
  const tape = new THREE.MeshStandardMaterial({ color: 0xdb9c33, metalness: 0.5, roughness: 0.42 });
  const cylinder = (r, h, y, mat, target = assembly, x = 0, z = 0) =>
    mesh(new THREE.CylinderGeometry(r, r, h, 48), mat, [x, y, z], target);
  const bar = (from, to, r, mat, target = assembly) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
    const part = mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), mat, a.add(b).multiplyScalar(0.5).toArray(), target);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return part;
  };
  const ring = (r, thickness, y, mat) => {
    const part = mesh(new THREE.TorusGeometry(r, thickness, 6, 64), mat, [0, y, 0], assembly);
    part.rotation.x = Math.PI / 2;
    return part;
  };

  cylinder(0.188, 0.013, 0, titanium).name = "carousel-baseplate";
  cylinder(0.174, 0.108, 0.061, amber).name = "carousel-isolator-wrap";
  cylinder(0.18, 0.096, 0.165, titanium).name = "carousel-cover";
  cylinder(0.18, 0.009, 0.218, aluminum).name = "carousel-sealed-lid";
  for (const y of [0.011, 0.113, 0.216]) ring(0.184, 0.004, y, titanium);
  // Peripheral ribs, wrap seams and rim fasteners; their spacing/count is illustrative.
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const x = Math.sin(angle), z = Math.cos(angle);
    bar([x * 0.18, 0.018, z * 0.18], [x * 0.18, 0.105, z * 0.18], 0.0026, titanium);
    const seam = mesh(new THREE.BoxGeometry(0.006, 0.09, 0.0015), tape, [x * 0.175, 0.06, z * 0.175], assembly);
    seam.rotation.y = angle;
    cylinder(0.0032, 0.005, 0.225, titanium, assembly, x * 0.174, z * 0.174);
    const patch = mesh(new THREE.BoxGeometry(0.012, 0.02, 0.002), tape, [x * 0.181, 0.13, z * 0.181], assembly);
    patch.rotation.y = angle;
  }

  const ports = [
    { x: -0.07, z: -0.092, r: 0.018, h: 0.078, name: "carousel-sample-inlet" },
    { x: 0.065, z: -0.075, r: 0.032, h: 0.056, name: "carousel-analysis-interface-wide" },
    { x: 0.097, z: 0.07, r: 0.022, h: 0.115, name: "carousel-analysis-interface-tall" },
  ];
  for (const { x, z, r, h, name } of ports) {
    cylinder(r + 0.006, 0.01, 0.23, titanium, assembly, x, z);
    cylinder(r, h, 0.23 + h / 2, titanium, assembly, x, z).name = name;
    cylinder(r + 0.002, 0.008, 0.23 + h * 0.7, tape, assembly, x, z);
    cylinder(r + 0.003, 0.006, 0.23 + h, aluminum, assembly, x, z);
    cylinder(r * 0.65, 0.002, 0.234 + h, dark, assembly, x, z);
  }

  // Dense pyramid fin field, instanced to keep the detailed close-up affordable on phones.
  // Exterior fins only: a sealed opaque lid hides internal fins/cups until a future cutaway.
  const positions = [];
  for (let x = -0.153; x <= 0.154; x += 0.013) for (let z = -0.153; z <= 0.154; z += 0.013) {
    if (Math.hypot(x, z) > 0.165 || Math.abs(z + 0.126) < 0.014) continue;
    if (ports.some(p => Math.hypot(x - p.x, z - p.z) < p.r + 0.014)) continue;
    positions.push([x, 0.252, z]);
  }
  const fins = new THREE.InstancedMesh(new THREE.ConeGeometry(0.0045, 0.061, 4), aluminum, positions.length);
  fins.name = "carousel-cooling-fins";
  const transform = new THREE.Matrix4();
  positions.forEach((position, i) => fins.setMatrixAt(i, transform.makeTranslation(...position)));
  fins.instanceMatrix.needsUpdate = true;
  fins.castShadow = fins.receiveShadow = true;
  assembly.add(fins);

  // The small top cross-link is visible in the integration photos. The large rectangular
  // handling frame, dolly, lift handles and temporary test harnesses are deliberately omitted.
  bar([-0.186, 0.256, -0.126], [0.186, 0.256, -0.126], 0.006, titanium);
  for (const side of [-1, 1]) {
    const x = side * 0.172;
    bar([x, 0.011, -0.06], [x, 0.25, -0.126], 0.004, titanium);
    const bearing = cylinder(0.018, 0.013, 0.256, titanium, assembly, side * 0.186, -0.126);
    bearing.rotation.z = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.034, 0.012, 0.045), titanium, [x, -0.008, -0.06], assembly);
  }

  const drives = new THREE.Group();
  drives.name = "carousel-warm-drives";
  // Keep the same selectable assembly, but use bay temperature for warm-side actuators.
  drives.userData = { subsystem: "sample-carousel", thermalZone: "equipment-bay" };
  assembly.add(drives);
  for (const [x, z] of [[-0.103, -0.086], [0.103, -0.086], [0, 0.104]]) {
    cylinder(0.025, 0.042, -0.03, dark, drives, x, z);
    cylinder(0.022, 0.096, -0.092, titanium, drives, x, z);
    cylinder(0.023, 0.01, -0.14, dark, drives, x, z);
    mesh(new THREE.BoxGeometry(0.016, 0.019, 0.014), dark, [x + 0.024, -0.059, z], drives);
  }
  cylinder(0.037, 0.055, -0.038, dark, drives);

  // Symbolic indexing pivot beneath the cover, not a claim about cup inventory or gearing.
  const carrier = new THREE.Group();
  carrier.name = "sample-carousel-carrier";
  assembly.add(carrier);
  cylinder(0.13, 0.006, 0.10, dark, carrier);
  return { assembly, carrier, inletWorld: new THREE.Vector3(...carouselAsset.inlet).add(assembly.position) };
}
