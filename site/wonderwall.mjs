import * as THREE from "./vendor/three/three.module.min.js";

// NASA SciTech 2024 figs. 2/11 and SVS 15003 establish the shaped attic interface.
// All detail geometry is [EST]. ICES-2023's ~5 cm is instrument separation, NOT wall thickness.
export const wonderwallAsset = Object.freeze({
  revision: "wonderwall-2026-10-12",
  position: Object.freeze([0.095, 0.08, -1.26]),
  coreThicknessM: 0.022,
  aperture: Object.freeze([-0.02, 0.245, 0.046]),
  outline: Object.freeze([[-0.30, 0], [0.31, 0], [0.31, 0.35], [0.25, 0.40],
    [-0.10, 0.40], [-0.23, 0.32], [-0.30, 0.17]].map(Object.freeze)),
});

export function buildWonderwall({ parent, mesh }) {
  const wall = new THREE.Group();
  wall.name = "wonderwall-interface";
  wall.position.fromArray(wonderwallAsset.position);
  parent.add(wall);
  Object.assign(parent.userData, { assetRevision: wonderwallAsset.revision, dimensionConfidence: "EST" });
  const layer = (name, category, thermalZone) => {
    const group = new THREE.Group();
    group.name = name;
    group.userData = { inspectionLayer: category, subsystem: "wonderwall", thermalZone };
    wall.add(group);
    return group;
  };
  // Independent groups allow future peel-away controls without translating installed hardware.
  // These presentation layers are not an asserted flight material stack or ply schedule.
  const insulation = layer("wonderwall-insulation", "insulation", "cold-attic");
  const coldFace = layer("wonderwall-cold-face", "interface-faces", "cold-attic");
  const warmFace = layer("wonderwall-warm-face", "interface-faces", "equipment-bay");
  const mounts = layer("wonderwall-mounts", "mounts", "equipment-bay");
  const core = new THREE.MeshStandardMaterial({ color: 0xc4c5ad, roughness: 0.92, metalness: 0 });
  const facing = new THREE.MeshStandardMaterial({ color: 0xdbdbca, roughness: 0.67, metalness: 0.08 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xadb6bb, roughness: 0.43, metalness: 0.57 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x626865, roughness: 0.73, metalness: 0.16 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xba852f, roughness: 0.49, metalness: 0.3 });

  function panel(thickness, material, x, target, name) {
    const shape = new THREE.Shape();
    wonderwallAsset.outline.forEach(([u, y], i) => i ? shape.lineTo(u, y) : shape.moveTo(u, y));
    shape.closePath();
    const [u, y, r] = wonderwallAsset.aperture;
    const opening = new THREE.Path();
    opening.absarc(u, y, r, 0, Math.PI * 2, true);
    shape.holes.push(opening);
    const slot = new THREE.Path();
    slot.moveTo(0.07, 0.20); slot.lineTo(0.07, 0.29); slot.lineTo(0.091, 0.29);
    slot.lineTo(0.091, 0.20); slot.closePath();
    shape.holes.push(slot);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 32 });
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(thickness / 2, 0, 0);
    mesh(geometry, material, [x, 0, 0], target).name = name;
  }
  panel(wonderwallAsset.coreThicknessM, core, 0, insulation, "wonderwall-estimated-core");
  panel(0.0014, facing, -0.0118, coldFace, "wonderwall-cold-facing");
  panel(0.0014, metal, 0.0118, warmFace, "wonderwall-warm-facing");

  function rib(from, to, radius, material, target) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
    const part = mesh(new THREE.CylinderGeometry(radius, radius, d.length(), 6), material,
      a.add(b).multiplyScalar(0.5).toArray(), target);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
  // Perimeter and sparse stiffeners follow the photographic silhouette, not a structural model.
  for (const [i, [u, y]] of wonderwallAsset.outline.entries()) {
    const [nextU, nextY] = wonderwallAsset.outline[(i + 1) % wonderwallAsset.outline.length];
    rib([0.015, y, u], [0.015, nextY, nextU], 0.004, metal, warmFace);
    rib([-0.013, y, u], [-0.013, nextY, nextU], 0.0014, dark, coldFace);
  }
  for (const u of [-0.16, 0.13, 0.27]) rib([0.016, 0.012, u], [0.016, u < 0 ? 0.345 : 0.35, u], 0.0035, metal, warmFace);
  rib([0.016, 0.125, -0.265], [0.016, 0.125, 0.29], 0.0035, metal, warmFace);
  const [u, y, r] = wonderwallAsset.aperture;
  for (const [x, target] of [[-0.014, coldFace], [0.016, warmFace]]) {
    const collar = mesh(new THREE.RingGeometry(r, r + 0.012, 48), metal, [x, y, u], target);
    collar.material = metal.clone();
    collar.material.side = THREE.DoubleSide;
    collar.rotation.y = Math.PI / 2;
    collar.name = x < 0 ? "wonderwall-cold-interface-rim" : "wonderwall-warm-interface-rim";
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const fastener = mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.003, 6), dark,
        [x + Math.sign(x) * 0.001, y + Math.sin(a) * (r + 0.007), u + Math.cos(a) * (r + 0.007)], target);
      fastener.rotation.z = Math.PI / 2;
    }
  }
  // Photographic amber accents are appearance references, not identified flight material.
  mesh(new THREE.BoxGeometry(0.001, 0.082, 0.09), amber, [-0.013, 0.06, -0.02], coldFace);
  for (const u of [-0.23, 0.03, 0.25]) {
    mesh(new THREE.BoxGeometry(0.033, 0.008, 0.029), metal, [0.027, 0, u], mounts);
    mesh(new THREE.BoxGeometry(0.008, 0.03, 0.029), metal, [0.016, 0.013, u], mounts);
    mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.004, 6), dark, [0.031, 0.006, u], mounts);
  }
  return { wall, insulation, coldFace, warmFace, mounts };
}
