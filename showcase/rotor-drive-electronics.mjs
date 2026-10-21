import * as THREE from "./vendor/three/three.module.min.js";

// [PUB] ICES-2023-389 pp. 5/7: two RDE boxes with internal fans.
// [EST] All visual details below. The CAPS 2024 test photo does not resolve flight
// casing geometry. This is a provisional enclosure illustration, not a photo replica.
export const rdeAsset = Object.freeze({
  revision: "rde-provisional-2026-10-15",
  confidence: "EST",
  unitCount: 2,
  centers: Object.freeze([Object.freeze([-0.16, -0.55]), Object.freeze([0.16, -0.55])]),
  widthM: 0.24, depthM: 0.26, bottomY: -0.266, topY: -0.09, floorY: -0.284,
  fanRadiusM: 0.031,
});

export function buildRotorDriveElectronics({ parent, mesh }) {
  const assembly = new THREE.Group();
  assembly.name = "rde-provisional-assemblies";
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: rdeAsset.revision, dimensionConfidence: "EST" });
  const layers = {};
  for (const [key, category] of Object.entries({
    mounts: "mounts", casings: "equipment-casings", covers: "equipment-covers",
    cooling: "interfaces", connectors: "interfaces",
  })) {
    const g = new THREE.Group(); g.name = `rde-${key}`;
    g.userData.inspectionLayer = category; assembly.add(g); layers[key] = g;
  }
  const silver = new THREE.MeshStandardMaterial({ color: 0xb4bec3, metalness: 0.6, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x343d43, metalness: 0.4, roughness: 0.53 });
  const fastener = new THREE.MeshStandardMaterial({ color: 0x747c82, metalness: 0.7, roughness: 0.32 });
  const box = (size, at, material, target, name) => {
    const o = mesh(new THREE.BoxGeometry(...size), material, at, target); o.name = name; return o;
  };
  const { widthM: w, depthM: d, bottomY: bottom, topY: top, floorY, fanRadiusM: r } = rdeAsset;
  const h = top - bottom, cy = (top + bottom) / 2, skin = 0.003;
  rdeAsset.centers.forEach(([x, z], i) => {
    const prefix = `rde-${i + 1}`;
    // Separate cover and hollow casing; hiding a cover never reveals invented boards.
    box([w, skin, d], [x, bottom + skin / 2, z], silver, layers.casings, `${prefix}-floor`);
    box([w, skin, d], [x, top + skin / 2, z], silver, layers.covers, `${prefix}-lid`);
    for (const side of [-1, 1]) {
      box([skin, h, d], [x + side * (w - skin) / 2, cy, z], silver, layers.casings, `${prefix}-side`);
      for (const dz of [-0.09, 0.09]) {
        box([0.026, bottom - floorY, 0.036], [x + side * 0.102, (bottom + floorY) / 2, z + dz], dark, layers.mounts, `${prefix}-foot`);
        const bolt = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.002, 6), fastener,
          [x + side * 0.104, top + skin + 0.001, z + dz], layers.covers);
        bolt.name = `${prefix}-lid-fastener`;
      }
    }
    // Real openings, not painted-on dark discs. Number/size/location are illustrative.
    for (const end of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, bottom); shape.lineTo(w / 2, bottom);
      shape.lineTo(w / 2, top); shape.lineTo(-w / 2, top); shape.closePath();
      for (const fx of [-0.061, 0.061]) {
        const hole = new THREE.Path(); hole.absarc(fx, cy, r + 0.002, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
      const panel = new THREE.ExtrudeGeometry(shape, { depth: skin, bevelEnabled: false, curveSegments: 24 });
      mesh(panel, silver, [x, 0, z + end * d / 2 - skin / 2], layers.casings).name = `${prefix}-vent-panel`;
      for (const fx of [-0.061, 0.061]) {
        const ring = mesh(new THREE.TorusGeometry(r + 0.002, 0.002, 6, 32), fastener,
          [x + fx, cy, z + end * (d / 2 + 0.002)], layers.cooling);
        ring.name = `${prefix}-vent-rim`;
        for (const offset of [-0.014, 0, 0.014]) {
          const length = 2 * Math.sqrt(r * r - offset * offset);
          box([length, 0.002, 0.002], [x + fx, cy + offset, z + end * (d / 2 + 0.002)], dark, layers.cooling, `${prefix}-guard`);
        }
        // A static internal impeller signifies published forced cooling, not a new fan solver.
        if (end === -1) {
          const hub = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 16), dark,
            [x + fx, cy, z - d / 2 + 0.014], layers.cooling);
          hub.rotation.x = Math.PI / 2; hub.name = `${prefix}-fan-hub`;
          for (let k = 0; k < 5; k++) {
            const a = k * Math.PI * 2 / 5;
            const blade = box([0.012, 0.024, 0.002], [x + fx + Math.sin(a) * 0.017,
              cy + Math.cos(a) * 0.017, z - d / 2 + 0.014], dark, layers.cooling, `${prefix}-fan-blade`);
            blade.rotation.z = -a; blade.rotation.y = 0.35;
          }
        }
      }
    }
    // Connector blanks only: no claimed flight pinout, channel allocation or cable route.
    for (const dx of [-0.06, 0.06]) {
      box([0.036, 0.014, 0.006], [x + dx, bottom + 0.022, z - d / 2 - 0.004], dark, layers.connectors, `${prefix}-connector-blank`);
    }
  });
  return { assembly, ...layers };
}
