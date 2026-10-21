import * as THREE from "./vendor/three/three.module.min.js";

// Seese et al., IPM 2025 pp. 186-187, figs. 1-2: two fixed EFIELD assemblies [PUB].
// Photo for appearance; fig. 1/text for location only. Engineering model, not final flight CAD.
// Carbon-fiber tube 30 cm; two-piece gold-plated aluminum electrode 5 cm diameter [PUB].
// Exact mounting coordinates, preamp size, stalk diameter and brackets/harness are [EST].
export const noseSensorsAsset = Object.freeze({
  revision: "nose-sensors-2026-10-18",
  stalkLengthM: 0.30, electrodeDiameterM: 0.05, stalkRadiusM: 0.0055,
  preamp: Object.freeze({ width: 0.085, height: 0.026, depth: 0.10 }),
  probes: Object.freeze([
    Object.freeze({ name: "efield-front", side: 1, mount: Object.freeze([0.45, 0.32, -1.64]), direction: Object.freeze([0.45, 0.45, -0.77]) }),
    Object.freeze({ name: "efield-rear", side: -1, mount: Object.freeze([-0.45, -0.22, 0.94]), direction: Object.freeze([-0.75, -0.20, 0.63]) }),
  ]),
  // Lorenz et al., IPM 2025 pp. 184-185: cold filtered mirror cell, fiber-fed from warm DPU [PUB].
  // Owner-approved design approximation, not a hardware-photo match. All dimensions/poses [EST].
  methan: Object.freeze({ position: Object.freeze([0.505, -0.10, -1.67]),
    size: Object.freeze([0.062, 0.10, 0.105]), skinX: 0.435, filterCount: 2 }),
});

export function buildNoseSensors({ parent, mesh }) {
  const A = noseSensorsAsset, assembly = new THREE.Group();
  assembly.name = "dragmet-external-sensors"; parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: A.revision, dimensionConfidence: "PUB+EST", partialRebuild: false,
    appearanceEvidence: "EFIELD engineering-model photo; METHAN approved design estimate, not photo-matched" });
  parent.userData.labelAnchor = new THREE.Vector3(...A.probes[0].mount);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd6b050, metalness: 0.88, roughness: 0.25 });
  const aluminum = new THREE.MeshStandardMaterial({ color: 0xc0c1b6, metalness: 0.7, roughness: 0.4 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x242a29, metalness: 0.18, roughness: 0.43 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xad693c, metalness: 0.72, roughness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe6e5d4, metalness: 0.05, roughness: 0.65 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x333b3b, metalness: 0.55, roughness: 0.5 });
  const layer = (target, name, category) => {
    const group = new THREE.Group(); group.name = name; group.userData.inspectionLayer = category;
    target.add(group); return group;
  };
  const box = (target, name, size, position, material) => {
    const object = mesh(new THREE.BoxGeometry(...size), material, position, target); object.name = name; return object;
  };
  const probes = A.probes.map(p => {
    const group = new THREE.Group(); group.name = p.name; assembly.add(group);
    group.userData.inspectionLabel = p.side > 0 ? "Front EFIELD" : "Rear EFIELD";
    group.userData.labelAnchor = new THREE.Vector3(...p.mount);
    const casings = layer(group, `${p.name}-casings`, "equipment-casings");
    const covers = layer(group, `${p.name}-covers`, "equipment-covers");
    const mounts = layer(group, `${p.name}-mounts`, "mounts");
    const interfaces = layer(group, `${p.name}-interfaces`, "interfaces");
    const harness = layer(group, `${p.name}-harness`, "harnesses");
    const caseFrame = (target, suffix) => {
      const frame = new THREE.Group(); frame.name = `${p.name}-${suffix}`;
      frame.position.fromArray(p.mount); frame.rotation.z = -p.side * Math.PI / 2; target.add(frame); return frame;
    };
    const caseBody = caseFrame(casings, "preamp-body"), lid = caseFrame(covers, "preamp-lid");
    const feet = caseFrame(mounts, "preamp-mounts"), ports = caseFrame(interfaces, "preamp-ports");
    const wire = caseFrame(harness, "preamp-harness");
    const { width: W, height: H, depth: D } = A.preamp, wall = 0.002;
    // Enclosure only: no inferred circuit boards or test-stand hardware inside.
    box(caseBody, `${p.name}-floor`, [W, wall, D], [0, -H / 2 + wall / 2, 0], gold);
    for (const side of [-1, 1]) {
      box(caseBody, `${p.name}-wall-x`, [wall, H - wall, D], [side * (W - wall) / 2, 0, 0], gold);
      box(caseBody, `${p.name}-wall-z`, [W, H - wall, wall], [0, 0, side * (D - wall) / 2], gold);
    }
    box(lid, `${p.name}-cover`, [W, wall, D], [0, H / 2, 0], aluminum);
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      box(feet, `${p.name}-mount-tab`, [0.016, 0.004, 0.018], [x * W / 2, -H / 2, z * (D / 2 - 0.012)], gold);
      const screw = mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.003, 8), dark,
        [x * (W / 2 - 0.006), H / 2 + 0.002, z * (D / 2 - 0.007)], lid);
      screw.name = `${p.name}-lid-fastener`;
    }
    // TEMP and MICRO are co-mounted on the preamp in fig. 2; their envelopes are estimates.
    box(ports, `${p.name}-temp-socket`, [0.012, 0.009, 0.014], [-0.022, H / 2 + 0.005, 0.023], gold);
    const temp = mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.035, 10), white, [-0.022, H / 2 + 0.027, 0.023], ports);
    temp.name = `${p.name}-atmosphere-temperature-probe`;
    const mic = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.009, 12), aluminum, [0.023, H / 2 + 0.006, 0.018], ports);
    mic.name = `${p.name}-microphone-housing`;
    const opening = mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.0007, 10), dark, [0.023, H / 2 + 0.011, 0.018], ports);
    opening.name = `${p.name}-microphone-aperture`;
    box(wire, `${p.name}-harness-gland`, [0.016, 0.014, 0.012], [0.022, -H / 2 - 0.007, -0.022], aluminum);
    const cable = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.018, 8), dark, [0.022, -H / 2 - 0.023, -0.022], wire);
    cable.name = `${p.name}-body-harness-stub`;

    const stalkFrame = new THREE.Group(); stalkFrame.name = `${p.name}-stalk-frame`;
    stalkFrame.position.fromArray(p.mount).add(new THREE.Vector3(p.side * 0.019, p.side > 0 ? 0.024 : -0.015, p.side > 0 ? -0.025 : 0.028));
    stalkFrame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...p.direction).normalize());
    casings.add(stalkFrame);
    const socket = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 12), gold,
      [p.mount[0] + p.side * 0.016, stalkFrame.position.y, stalkFrame.position.z], interfaces);
    socket.rotation.z = -p.side * Math.PI / 2; socket.name = `${p.name}-guard-feedthrough`;
    const tube = mesh(new THREE.CylinderGeometry(A.stalkRadiusM, A.stalkRadiusM, A.stalkLengthM, 16), carbon, [0, 0, A.stalkLengthM / 2], stalkFrame);
    tube.rotation.x = Math.PI / 2; tube.name = `${p.name}-carbon-stalk`;
    const boot = mesh(new THREE.CylinderGeometry(0.0075, 0.009, 0.034, 12), copper, [0, 0, 0.017], stalkFrame);
    boot.rotation.x = Math.PI / 2; boot.name = `${p.name}-guard-boot`;
    const r = A.electrodeDiameterM / 2, ballZ = A.stalkLengthM + r;
    const ball = mesh(new THREE.SphereGeometry(r, 32, 20), gold, [0, 0, ballZ], stalkFrame);
    ball.name = `${p.name}-electrode-ball`;
    const seam = mesh(new THREE.TorusGeometry(r, 0.00025, 5, 48), copper, [0, 0, ballZ], stalkFrame);
    seam.name = `${p.name}-electrode-equator`;
    return { group, casings, covers, mounts, interfaces, harness, stalkFrame, tube, ball };
  });
  const methan = new THREE.Group(); methan.name = "methan"; assembly.add(methan);
  Object.assign(methan.userData, { approximation: true, geometryBasis: "published-design-estimate",
    inspectionLabel: "METHAN (design estimate)" });
  methan.userData.labelAnchor = new THREE.Vector3(...A.methan.position);
  const methanLayers = Object.fromEntries([
    ["casings", "equipment-casings"], ["covers", "equipment-covers"], ["mounts", "mounts"],
    ["interfaces", "interfaces"], ["harness", "harnesses"],
  ].map(([key, category]) => {
    const g = layer(methan, `methan-${key}`, category); g.position.fromArray(A.methan.position); return [key, g];
  }));
  const { casings, covers, mounts, interfaces, harness } = methanLayers;
  const [W, H, D] = A.methan.size, edge = 0.006, cut = 0.012;
  const housing = new THREE.MeshStandardMaterial({ color: 0xa3adb0, metalness: 0.62, roughness: 0.46 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x343c3c, metalness: 0.1, roughness: 0.78 });
  // Chamfered outline follows the diagram; its sizes and filtered-cover arrangement are estimates.
  const outline = (d, h, c) => {
    const shape = new THREE.Shape();
    const points = [[-d + c, -h], [d - c, -h], [d, -h + c], [d, h - c],
      [d - c, h], [-d + c, h], [-d, h - c], [-d, -h + c]];
    points.forEach(([u, v], i) => i ? shape.lineTo(u, v) : shape.moveTo(u, v));
    shape.closePath(); return shape;
  };
  const ring = depth => {
    const shape = outline(D / 2, H / 2, cut);
    shape.holes.push(outline(D / 2 - edge, H / 2 - edge, cut - edge / 2));
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 })
      .translate(0, 0, -depth / 2).rotateY(Math.PI / 2);
  };
  mesh(ring(W), housing, [0, 0, 0], casings).name = "methan-chamfered-cell-frame";
  // Fine neutral stippling is an illustrative porous-felt finish, not a measured pore pattern.
  const data = new Uint8Array(64 * 64 * 4);
  for (let n = 0; n < 64 * 64; n++) {
    let hash = Math.imul(n ^ 913, 0x7feb352d);
    hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
    const gray = 105 + ((hash ^ (hash >>> 16)) >>> 0) % 55;
    data.set([gray, gray, gray, 255], n * 4);
  }
  const texture = new THREE.DataTexture(data, 64, 64); texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
  const felt = new THREE.MeshStandardMaterial({ color: 0xaeb3b4, map: texture, roughness: 0.93, metalness: 0.22, side: THREE.DoubleSide });
  for (const sign of [-1, 1]) {
    const x = sign * (W / 2 + 0.0015), name = sign > 0 ? "outboard" : "inboard";
    const face = new THREE.ShapeGeometry(outline(D / 2 - edge, H / 2 - edge, cut - edge / 2));
    const positions = face.getAttribute("position"), uv = face.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (positions.getX(i) + D / 2) / D, (positions.getY(i) + H / 2) / H);
    face.rotateY(Math.PI / 2);
    mesh(face, felt, [x, 0, 0], covers).name = `methan-${name}-metal-felt`;
    mesh(ring(0.003), aluminum, [x, 0, 0], covers).name = `methan-${name}-filter-rim`;
    for (const y of [-0.027, 0, 0.027]) box(covers, `methan-${name}-filter-guard`, [0.0015, 0.0015, D - edge * 2], [x + sign * 0.002, y, 0], aluminum);
    for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const bolt = mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.0025, 10), dark,
        [x + sign * 0.003, y * (H / 2 - 0.0085), z * (D / 2 - 0.0085)], covers);
      bolt.rotation.z = Math.PI / 2; bolt.name = "methan-cover-fastener";
    }
  }
  const skin = A.methan.skinX - A.methan.position[0], back = -W / 2;
  for (const y of [-1, 1]) {
    box(mounts, "methan-skin-tab", [0.004, 0.018, 0.095], [skin + 0.002, y * 0.057, 0], housing);
    box(mounts, "methan-support", [back - skin, 0.006, 0.095], [(back + skin) / 2, y * 0.049, 0], housing);
    for (const z of [-0.034, 0.034]) {
      const bolt = mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 10), dark, [skin + 0.005, y * 0.057, z], mounts);
      bolt.rotation.z = Math.PI / 2; bolt.name = "methan-mount-fastener";
    }
  }
  const port = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.009, 12), copper, [back - 0.004, -0.020, 0], interfaces);
  port.rotation.z = Math.PI / 2; port.name = "methan-fiber-feedthrough";
  const route = new THREE.CatmullRomCurve3([
    [back - 0.008, -0.020, 0], [back - 0.018, -0.023, 0], [skin + 0.004, -0.039, 0.008], [skin - 0.009, -0.040, 0.008],
  ].map(p => new THREE.Vector3(...p)));
  const fiber = mesh(new THREE.TubeGeometry(route, 24, 0.0015, 8, false), jacket, [0, 0, 0], harness);
  fiber.name = "methan-optical-fiber-bundle";
  fiber.userData.role = "Short jacketed fiber entry through skin; warm DPU routing and internal fiber count unmodeled";
  return { assembly, probes, methan, methanLayers };
}
