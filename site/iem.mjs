import * as THREE from "./vendor/three/three.module.min.js";

// Part 12: Integrated Electronics Module (IEM), Dragonfly's core avionics box (command and data
// handling, guidance and navigation, communications). Drawn from NASA/APL's March 2026 photos at
// full resolution (engineering model on the harness; IEM and PSU testing):
// - a black top heat sink whose fins run parallel to the connector face, with rows of fasteners
//   through it, and a copper ground strap bolted at one top corner;
// - a silver face plate fastened all round its edge, with black connector windows in two rows
//   across the cards; every connector mated to a silver-wrapped, white-labeled harness that
//   drops down; a few strips of yellow tape;
// - mounted with its back to a vertical wall panel of the lander structure, beside a PSU.
// No size is published. Scale [EST]: the mated plugs match Micro-D connectors (Glenair
// MIL-DTL-83513 table: 37-way 37.8 mm long, about 8 mm wide), giving a face about 28 cm wide;
// the engineering-model photo shows the face about as tall as it is wide. Window layout,
// connector counts, depth and the wall it is on (port, with the PSU on its left as seen from
// inside, as photographed) are [EST]. Red handling handles are not drawn.
export const iemAsset = Object.freeze({
  revision: "iem-2026-10-13b",
  widthM: 0.28, heightM: 0.28, depthM: 0.22,
  // Back against the port wall (cavity edge about x -0.36), on the bay floor [EST].
  position: Object.freeze([-0.244, -0.284, -0.17]),
  // The connector face (local -z) turns inboard, toward +x [EST].
  yaw: -Math.PI / 2,
  bounds: Object.freeze({ min: [-0.365, -0.285, -0.36], max: [-0.03, 0.02, 0.0] }),
});

// Micro-D (MIL-DTL-83513) overall flange length by contact count, from Glenair's table [PUB].
const microD = { 15: 0.0238, 25: 0.0302, 37: 0.0378, 51: 0.0365 };

export function buildIem({ parent, mesh }) {
  const { widthM: W, heightM: H, depthM: D, position, yaw } = iemAsset;
  const assembly = new THREE.Group();
  assembly.name = "iem-assembly";
  assembly.position.fromArray(position);
  assembly.rotation.y = yaw;
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: iemAsset.revision, dimensionConfidence: "EST" });
  const group = (name, inspectionLayer) => {
    const g = new THREE.Group(); g.name = name; g.userData.inspectionLayer = inspectionLayer;
    assembly.add(g); return g;
  };
  const chassis = group("iem-chassis", "equipment-casings");
  const mounts = group("iem-mounts", "mounts");
  const connectors = group("iem-connectors", "interfaces");
  const harness = group("iem-harness", "harnesses");
  const black = new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.6, metalness: 0.3 });
  const plate = new THREE.MeshStandardMaterial({ color: 0xc4c9cc, roughness: 0.32, metalness: 0.72 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.75, metalness: 0.2 });
  const shell = new THREE.MeshStandardMaterial({ color: 0x8e969b, roughness: 0.38, metalness: 0.8 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb4bbbf, roughness: 0.35, metalness: 0.75 });
  const wrap = new THREE.MeshStandardMaterial({ color: 0xcfd3d5, roughness: 0.28, metalness: 0.82 });
  const tag = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.8, metalness: 0 });
  const kapton = new THREE.MeshStandardMaterial({ color: 0xd19a2e, roughness: 0.45, metalness: 0.2 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xc0703f, roughness: 0.35, metalness: 0.85 });
  const box = (size, at, material, target, name) => {
    const part = mesh(new THREE.BoxGeometry(...size), material, at, target);
    part.name = name; return part;
  };
  const screw = (at, axis, target, name, r = 0.0022) => {
    const part = mesh(new THREE.CylinderGeometry(r, r, 0.003, 8), steel, at, target);
    if (axis === "z") part.rotation.x = Math.PI / 2;
    part.name = name; return part;
  };
  const tube = (points, radius, material, target, name) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, "centripetal");
    const part = mesh(new THREE.TubeGeometry(curve, 20, radius, 6, false), material, [0, 0, 0], target);
    part.name = name; return part;
  };
  const finH = 0.012, bodyH = H - finH, face = -D / 2;

  // Body and the black top heat sink: fins parallel to the face, spaced front to back, with
  // rows of fasteners between them.
  box([W, bodyH, D], [0, bodyH / 2, 0], black, chassis, "iem-chassis-body");
  const finCount = Math.floor((D - 0.01) / 0.0075);
  for (let i = 0; i < finCount; i += 1) {
    const z = -D / 2 + 0.008 + i * (D - 0.016) / (finCount - 1);
    box([W - 0.008, finH, 0.0022], [0, bodyH + finH / 2, z], black, chassis, "iem-top-fin");
  }
  for (let r = 0; r < 4; r += 1) for (let c = 0; c < 7; c += 1) {
    screw([-W / 2 + 0.03 + c * (W - 0.06) / 6, bodyH + finH * 0.45, -D / 2 + 0.03 + r * (D - 0.06) / 3], "y", chassis, "iem-top-fastener", 0.0018);
  }

  // Face plate: slightly larger than the body, fastened round its edge.
  const PW = W + 0.012, PH = bodyH + 0.006;
  box([PW, PH, 0.004], [0, PH / 2, face - 0.002], plate, chassis, "iem-face-plate");
  for (let i = 0; i <= 12; i += 1) {
    const x = -PW / 2 + 0.008 + i * (PW - 0.016) / 12;
    screw([x, PH - 0.007, face - 0.005], "z", chassis, "iem-face-screw");
    screw([x, 0.007, face - 0.005], "z", chassis, "iem-face-screw");
  }
  for (let i = 1; i < 10; i += 1) for (const x of [-PW / 2 + 0.007, PW / 2 - 0.007]) screw([x, i * PH / 10, face - 0.005], "z", chassis, "iem-face-screw");

  // Connector windows: eight card columns, an upper and a lower row. Each entry is the window's
  // height (as a fraction of its row) and the Micro-D sizes it holds, top to bottom [EST layout].
  const columns = 8, colW = (PW - 0.03) / columns;
  const rows = [
    { top: PH - 0.02, h: (PH - 0.05) / 2 },
    { top: (PH - 0.05) / 2 + 0.012, h: (PH - 0.05) / 2 },
  ];
  const layout = [
    [[0.9, [37, 37]], [0.8, [51, 25]]],
    [[0.75, [25, 25]], [0.7, [37]]],
    [[0.9, [51, 37]], [0.85, [37, 37]]],
    [[0.6, [37]], [0.8, [25, 25]]],
    [[0.9, [37, 51]], [0.5, [15]]],
    [[0.7, [25, 15]], [0.85, [51, 37]]],
    [[0.9, [37, 37]], [0, []]],
    [[0.55, [51]], [0.75, [25, 25]]],
  ];
  const plugs = [];
  layout.forEach((cells, c) => {
    const x = PW / 2 - 0.015 - colW * (c + 0.5); // column 1 at the viewer's left (+x)
    cells.forEach(([fill, sizes], r) => {
      if (!fill) return;
      const wh = rows[r].h * fill, wy = rows[r].top - wh / 2;
      box([colW * 0.62, wh, 0.0015], [x, wy, face - 0.0045], windowMat, chassis, "iem-connector-window");
      sizes.forEach((size, k) => {
        const len = microD[size], y = wy + wh / 2 - (k + 0.5) * wh / sizes.length;
        box([0.0079, len, 0.006], [x, y, face - 0.007], shell, connectors, `iem-micro-d-${size}`);
        plugs.push([x, y, len]);
      });
    });
  });
  // Yellow tape strips on the face, as photographed.
  for (const [x, y, h] of [[PW / 2 - 0.05, PH * 0.42, 0.03], [-0.02, PH * 0.47, 0.025], [-PW / 2 + 0.06, PH * 0.4, 0.02]]) {
    box([0.012, h, 0.001], [x, y, face - 0.0045], kapton, chassis, "iem-face-tape");
  }

  // Copper ground strap: bolted on top at one corner and bent down the side to the wall [EST].
  box([0.03, 0.002, 0.022], [-W / 2 + 0.035, H + 0.001, -D / 2 + 0.03], copper, mounts, "iem-ground-strap-lug");
  box([0.016, 0.002, 0.03], [-W / 2 + 0.035, H + 0.002, -D / 2 + 0.055], copper, mounts, "iem-ground-strap");
  tube([[-W / 2 + 0.035, H + 0.003, -D / 2 + 0.07], [-W / 2 + 0.035, H + 0.012, D / 2 - 0.02], [-W / 2 + 0.035, H - 0.01, D / 2 + 0.006]], 0.0035, copper, mounts, "iem-ground-strap-braid");
  // Back mounting to the wall panel: a bolted flange frame round the rear [EST].
  box([W + 0.02, bodyH + 0.01, 0.004], [0, (bodyH + 0.01) / 2, D / 2 + 0.002], black, mounts, "iem-wall-flange");
  for (const x of [-W / 2 - 0.005, W / 2 + 0.005]) for (const y of [0.02, bodyH / 2, bodyH - 0.01]) screw([x, y, D / 2 + 0.005], "z", mounts, "iem-wall-bolt", 0.003);

  // Harness: a backshell and white label on every plug; cables drop in front of the face and
  // gather at one end into a trunk (silver-wrapped, as photographed) [EST routes].
  const z0 = face - 0.024;
  plugs.forEach(([x, y, len], i) => {
    box([0.011, len + 0.004, 0.014], [x, y, face - 0.017], wrap, harness, "iem-harness-backshell");
    box([0.012, 0.016, 0.003], [x, y - len / 2 - 0.012, z0 + 0.004], tag, harness, "iem-harness-label");
    const run = -PW / 2 - 0.015 - (i % 5) * 0.005;
    tube([[x, y - len / 2, z0 + 0.006], [x, y - len / 2 - 0.03, z0 - 0.004], [x, 0.018, z0 - 0.016], [(x + run) / 2, 0.011, z0 - 0.022], [run, 0.011, z0 - 0.024 + (i % 3) * 0.004]],
      0.0045, wrap, harness, "iem-harness-cable");
  });
  for (const k of [0, 1, 2]) box([0.016, 0.014, 0.012], [-PW / 2 - 0.026, 0.01, z0 - 0.024 + k * 0.007], kapton, harness, "iem-harness-tie");
  return { assembly, chassis, mounts, connectors, harness };
}
