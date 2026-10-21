import * as THREE from "./vendor/three/three.module.min.js";

// Part 15: the lander battery. Published: an 11.5 kWh lithium-ion pack built by APL "using large,
// high-energy-density cells made by GS Yuasa" (Aerospace America, Sept. 2022); a 134 Ah battery
// (APL spacecraft page); a 24-cell battery system, attached to the bottom deck for cruise, with
// fans that push heat into the lander air in flight and passive heat pipes "in three orthogonal
// directions" to hold cell-to-cell gradients under 5 C (ICES-2022-256); aluminum fin extrusions
// between the cell stacks (ICES-2020-160 p. 4); kept isothermal by heat pipes, with 7.5 kg of
// phase-change wax melting at 22.5 C as a buffer for flights (ICES-2023-389 p. 5).
// The cell: GS Yuasa's LSE134 is a 134 Ah, 496 Wh space cell, 130 x 50 x 271 mm (height without
// terminals), 3.53 kg, in a champagne anodized aluminum case with two terminals on top (GS Yuasa
// LSE Gen III datasheet); 24 of them make 11.9 kWh nameplate. No source names the cell model, so
// it is an inference from 134 Ah, GS Yuasa and 24 cells [EST]. APL's 9-cell thermal test module is
// exactly three of these cells across and three deep, standing upright. Its look follows the real
// test photos (ICES-2022 figs. 10, 11, 13): a cream-white lower section with ribbed walls around
// the cells, a flange, and a bare aluminum upper housing over the bus bars with the 2 in fans on its
// ends and round connectors (one large four-pin) on its long face; small black 1 in fans on the
// lower walls. The paper's CAD figures (figs. 2-6) are used only for the internal arrangement
// (cells, bus straps, heat pipes, base). It is a sub-scale test article, not flight hardware, so
// the flight pack's real enclosure may differ [EST]. Placement: the TFAWS 2023 plan view shows a large ribbed block across the bay just
// forward of the aft arm roots (z 0.35-0.77, about 0.64 m wide). The 4 x 6 cell arrangement,
// enclosure size, fan layout, heat-pipe routes, connectors and harness are [EST]. The phase-change
// wax is not drawn: where it sits is not published.
const floorY = -0.284;
export const batteryAsset = Object.freeze({
  revision: "battery-2026-10-15",
  publishedKwh: 11.5,
  publishedAh: 134,
  cellCount: 24,
  cell: Object.freeze({ model: "GS Yuasa LSE134 (inferred)", widthM: 0.13, thicknessM: 0.05, heightM: 0.271, massKg: 3.53, wh: 496 }),
  columns: 4, rows: 6, columnPitchM: 0.142, rowPitchM: 0.056,
  // Enclosure: across the bay (x), fore-aft (z), on pads above the floor so it clears the duct.
  center: Object.freeze([0, 0.565]),
  // Lower ribbed section up to the flange at the cell tops; upper housing to the lid.
  enclosure: Object.freeze({ widthM: 0.62, depthM: 0.40, bottom: -0.27, split: 0.006, top: 0.064 }),
  floorY,
  padTop: -0.28,
  testModuleM: Object.freeze([0.40, 0.24, 0.50]),
});

export function buildBattery({ parent, mesh }) {
  const A = batteryAsset, [cx, cz] = A.center, E = A.enclosure, C = A.cell;
  const assembly = new THREE.Group();
  assembly.name = "battery-assembly";
  assembly.position.set(cx, 0, cz);
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: A.revision, dimensionConfidence: "PUB+EST" });
  const group = (name, inspectionLayer) => {
    const g = new THREE.Group(); g.name = name; g.userData.inspectionLayer = inspectionLayer;
    assembly.add(g); return g;
  };
  const mounts = group("battery-mounts", "mounts");
  const covers = group("battery-enclosure", "equipment-covers");
  const cells = group("battery-cells", "equipment-casings");
  const bus = group("battery-bus-bars", "harnesses");
  const ports = group("battery-connectors", "interfaces");
  const cream = new THREE.MeshStandardMaterial({ color: 0xd6ceb5, roughness: 0.7, metalness: 0.1 });
  const creamRib = new THREE.MeshStandardMaterial({ color: 0xf0ebdc, roughness: 0.5, metalness: 0.15 });
  const bare = new THREE.MeshStandardMaterial({ color: 0xd4d8db, roughness: 0.35, metalness: 0.65 });
  const plate = new THREE.MeshStandardMaterial({ color: 0xc4c8cb, roughness: 0.45, metalness: 0.6 });
  const anodized = new THREE.MeshStandardMaterial({ color: 0xcfc197, roughness: 0.35, metalness: 0.6 });
  const fin = new THREE.MeshStandardMaterial({ color: 0xb8bdc2, roughness: 0.45, metalness: 0.7 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xc7773a, roughness: 0.32, metalness: 0.85 });
  const insulator = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc6cbce, roughness: 0.3, metalness: 0.8 });
  const fanBlack = new THREE.MeshStandardMaterial({ color: 0x2a2e31, roughness: 0.6, metalness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd2a640, roughness: 0.3, metalness: 0.85 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x3a3f42, roughness: 0.8, metalness: 0.05 });
  const lacing = new THREE.MeshStandardMaterial({ color: 0xe9e4cf, roughness: 0.8, metalness: 0.05 });
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
    const part = mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), material, [0, 0, 0], target);
    part.name = name; return part;
  };
  const W = E.widthM, D = E.depthM, lowH = E.split - E.bottom, lowMid = (E.split + E.bottom) / 2;
  const flangeT = 0.006, upBottom = E.split + flangeT / 2, upH = E.top - upBottom, upMid = (E.top + upBottom) / 2;

  // ---- Base: flanged base plate on four corner pads (the warm duct runs under the middle).
  box([W + 0.04, E.bottom - A.padTop, D + 0.04], [0, (A.padTop + E.bottom) / 2, 0], plate, mounts, "battery-base-plate");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box([0.05, A.padTop - floorY, 0.05], [sx * (W / 2 - 0.01), (floorY + A.padTop) / 2, sz * (D / 2 - 0.01)], plate, mounts, "battery-mounting-pad");
  for (let i = 0; i < 8; i += 1) for (const s of [-1, 1]) {
    rod(0.005, 0.004, [-W / 2 + 0.02 + i * (W - 0.04) / 7, E.bottom + 0.002, s * (D / 2 + 0.012)], steel, mounts, null, "battery-base-bolt", 6);
  }

  // ---- Lower section: cream-white walls with a frame of posts and rails standing out from
  // recessed panels, as in the test photos.
  for (const s of [-1, 1]) {
    box([W, lowH, 0.004], [0, lowMid, s * (D / 2 - 0.002)], cream, covers, "battery-wall-long");
    box([0.004, lowH, D - 0.008], [s * (W / 2 - 0.002), lowMid, 0], cream, covers, "battery-wall-end");
    for (let i = 0; i <= 4; i += 1) box([0.014, lowH, 0.012], [-W / 2 + 0.007 + i * (W - 0.014) / 4, lowMid, s * (D / 2 + 0.006)], creamRib, covers, "battery-wall-rib");
    for (const y of [E.bottom + 0.007, lowMid, E.split - 0.007]) box([W, 0.014, 0.012], [0, y, s * (D / 2 + 0.006)], creamRib, covers, "battery-wall-rib");
    for (let i = 0; i <= 2; i += 1) box([0.012, lowH, 0.014], [s * (W / 2 + 0.006), lowMid, -D / 2 + 0.007 + i * (D - 0.014) / 2], creamRib, covers, "battery-wall-rib");
    for (const y of [E.bottom + 0.007, lowMid, E.split - 0.007]) box([0.012, 0.014, D], [s * (W / 2 + 0.006), y, 0], creamRib, covers, "battery-wall-rib");
  }
  // ---- Flange and upper housing: a bare aluminum box over the terminals and bus bars, on a
  // flange that stands out around the lower section. The lid is see-through in Internal so the
  // cells show (an inspection aid).
  box([W + 0.024, flangeT, D + 0.024], [0, E.split, 0], plate, covers, "battery-flange");
  for (let i = 0; i < 8; i += 1) for (const s of [-1, 1]) {
    rod(0.0035, 0.003, [-W / 2 + 0.02 + i * (W - 0.04) / 7, E.split + flangeT / 2 + 0.0015, s * (D / 2 + 0.008)], steel, covers, null, "battery-flange-bolt", 6);
  }
  for (const s of [-1, 1]) {
    box([W, upH, 0.004], [0, upMid, s * (D / 2 - 0.002)], bare, covers, "battery-housing-long");
    box([0.004, upH, D - 0.008], [s * (W / 2 - 0.002), upMid, 0], bare, covers, "battery-housing-end");
  }
  const lid = box([W + 0.006, 0.003, D + 0.006], [0, E.top + 0.0015, 0], bare, covers, "battery-lid");
  lid.userData.shell = true;
  for (let i = 0; i < 6; i += 1) for (const s of [-1, 1]) {
    rod(0.0035, 0.002, [-W / 2 + 0.03 + i * (W - 0.06) / 5, E.top + 0.004, s * (D / 2 - 0.008)], steel, covers, null, "battery-lid-bolt", 6);
  }
  // Fans: three 2 in fans on each end of the upper housing and 1 in fans on the lower walls,
  // two per wall (the test module carries six and eight). Positions on the flight pack [EST].
  const fan = (x, y, z, size, axis, name) => {
    const n = axis === "x" ? [Math.sign(x), 0, 0] : [0, 0, Math.sign(z)];
    box(axis === "x" ? [0.012, size, size] : [size, size, 0.012], [x, y, z], fanBlack, covers, name);
    rod(size * 0.42, 0.004, [x + n[0] * 0.0062, y, z + n[2] * 0.0062], steel, covers, axis, `${name}-guard`, 16);
    rod(size * 0.16, 0.006, [x + n[0] * 0.0068, y, z + n[2] * 0.0068], fanBlack, covers, axis, `${name}-hub`, 12);
  };
  for (const side of [-1, 1]) {
    for (const z of [-0.12, 0, 0.12]) fan(side * (W / 2 + 0.006), upMid, z, 0.051, "x", "battery-fan-2in");
    for (const z of [-0.1, 0.1]) fan(side * (W / 2 + 0.014), E.bottom + 0.07, z, 0.025, "x", "battery-fan-1in");
    for (const x of [-0.16, 0.16]) fan(x, E.bottom + 0.07, side * (D / 2 + 0.014), 0.025, "z", "battery-fan-1in");
  }

  // ---- Cells: 24 prismatic cells, four across and six deep, standing upright, with aluminum fin
  // plates between the rows and copper heat pipes along x, y and z.
  const cellShape = new THREE.Shape(), hw = C.widthM / 2, ht = C.thicknessM / 2, cr = 0.012;
  cellShape.moveTo(-hw + cr, -ht);
  cellShape.lineTo(hw - cr, -ht); cellShape.quadraticCurveTo(hw, -ht, hw, -ht + cr);
  cellShape.lineTo(hw, ht - cr); cellShape.quadraticCurveTo(hw, ht, hw - cr, ht);
  cellShape.lineTo(-hw + cr, ht); cellShape.quadraticCurveTo(-hw, ht, -hw, ht - cr);
  cellShape.lineTo(-hw, -ht + cr); cellShape.quadraticCurveTo(-hw, -ht, -hw + cr, -ht);
  const cellGeometry = new THREE.ExtrudeGeometry(cellShape, { depth: C.heightM, bevelEnabled: false, curveSegments: 4 });
  cellGeometry.rotateX(-Math.PI / 2);
  const cellBottom = E.bottom + 0.004, cellTop = cellBottom + C.heightM;
  const xs = Array.from({ length: A.columns }, (_, i) => (i - (A.columns - 1) / 2) * A.columnPitchM);
  const zs = Array.from({ length: A.rows }, (_, j) => (j - (A.rows - 1) / 2) * A.rowPitchM);
  zs.forEach((z, j) => xs.forEach((x, i) => {
    const cell = mesh(cellGeometry, anodized, [x, cellBottom, z], cells);
    cell.name = `battery-cell-${j * A.columns + i + 1}`;
    for (const t of [-1, 1]) {
      rod(0.0075, 0.008, [x + t * 0.038, cellTop + 0.004, z], insulator, cells, null, "battery-cell-terminal-cap", 10);
      rod(0.0035, 0.006, [x + t * 0.038, cellTop + 0.011, z], steel, cells, null, "battery-cell-terminal", 8);
    }
  }));
  const blockX = A.columns * A.columnPitchM, blockZ = A.rows * A.rowPitchM;
  for (let j = 0; j <= A.rows; j += 1) {
    box([blockX, C.heightM * 0.92, 0.004], [0, cellBottom + C.heightM * 0.46, (j - A.rows / 2) * A.rowPitchM], fin, cells, "battery-fin-plate");
  }
  for (const s of [-1, 1]) {
    for (const y of [-0.21, -0.14, -0.07]) rod(0.005, blockX, [0, y, s * (blockZ / 2 + 0.009)], copper, cells, "x", "battery-heat-pipe-x");
    for (const z of [-0.12, 0, 0.12]) rod(0.005, C.heightM * 0.85, [s * (blockX / 2 + 0.01), cellBottom + C.heightM / 2, z], copper, cells, null, "battery-heat-pipe-y");
    for (const y of [cellBottom + 0.03, cellTop - 0.03]) rod(0.005, blockZ, [s * (blockX / 2 + 0.01), y, 0], copper, cells, "z", "battery-heat-pipe-z");
  }

  // ---- Bus bars: copper straps joining the cells in series, row by row (snake pattern), and two
  // main leads to the power connector on the upper housing's forward face.
  const busY = cellTop + 0.016;
  zs.forEach((z, j) => {
    for (let i = 0; i < A.columns - 1; i += 1) {
      const a = xs[i] + 0.038, b = xs[i + 1] - 0.038;
      box([b - a + 0.014, 0.003, 0.014], [(a + b) / 2, busY, z], copper, bus, "battery-bus-bar");
    }
    if (j < A.rows - 1) {
      const x = j % 2 === 0 ? xs.at(-1) + 0.038 : xs[0] - 0.038;
      box([0.014, 0.003, A.rowPitchM + 0.014], [x, busY + 0.004, z + A.rowPitchM / 2], copper, bus, "battery-bus-link");
    }
  });
  const front = -D / 2;
  const connY = upMid;
  for (const [dx, name] of [[-0.008, "battery-main-lead-negative"], [0.008, "battery-main-lead-positive"]]) {
    tube([[xs[0] + 0.038 + dx, busY + 0.004, zs[0]], [-0.2 + dx, busY + 0.006, front + 0.03], [-0.2 + dx, connY, front + 0.012]], 0.004, copper, bus, name);
  }

  // ---- Upper housing's forward face, as on the test module: one large four-pin power connector
  // and two smaller round connectors, on the port half; cables down the face and forward along the
  // floor toward the power units (route and end tie [EST]).
  const plugs = [[-0.2, 0.022, "battery-power-connector"], [-0.12, 0.012, "battery-signal-connector"], [-0.07, 0.012, "battery-signal-connector"]];
  for (const [x, r, name] of plugs) {
    box([r * 2.5, r * 2.5, 0.004], [x, connY, front - 0.002], plate, ports, `${name}-flange`);
    rod(r, 0.02, [x, connY, front - 0.012], name.includes("power") ? steel : gold, ports, "z", name, 20);
  }
  for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(0.004, 0.003, [-0.2 + px * 0.008, connY + py * 0.008, front - 0.023], fanBlack, ports, "z", "battery-power-connector-socket", 8);
  for (const [x, r] of [[-0.2, 0.011], [-0.12, 0.006], [-0.07, 0.006]]) {
    tube([[x, connY, front - 0.024], [x, connY - 0.03, front - 0.034], [x, -0.12, front - 0.03], [x * 1.05, -0.25, front - 0.034], [x * 1.08, -0.262, front - 0.07]], r, jacket, bus, "battery-cable");
  }
  rod(0.016, 0.01, [-0.2 * 1.08, -0.262, front - 0.062], lacing, bus, "z", "battery-harness-tie", 12);
  return { assembly, mounts, covers, cells, bus, ports, lid };
}
