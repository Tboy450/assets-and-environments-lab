import * as THREE from "./vendor/three/three.module.min.js";

// Part 11: the two Power Switching Units (PSUs), which control the flow of power to Dragonfly's
// instruments and systems. NASA reports "the IEM and both PSUs" passed their first power checks
// in March 2026, so there are two units [PUB]. The face is mapped from NASA/APL's testing photo
// at full resolution (Ed Whitman, 6720 x 4480): eight vertical slices crossed by a full-width
// rib and a shorter lower rib, a black top band, screw posts at the tops of the slice dividers,
// large connectors stacked two-high on the two left slices, a cluster of small connectors next
// to them, four large connectors along the lower right (one an uncapped silver port), and an
// empty upper right. Black top and black side covers. In the photo the connectors wear pink
// test caps; here they are mated to the harness.
// Scale [EST]: the large connectors match 25-way D-subs (shell B, about 53 mm long; TE listing)
// and the medium ones 9-way (shell E, about 31 mm). Two 53 mm flanges stacked between the ribs
// need a face about 21.5 cm tall; the photo's proportions then give about 20 cm wide. Depth,
// harness routes and the second unit's look (drawn the same; only one is photographed) are
// [EST]. Placement: the photo shows the IEM and a PSU side by side on one wall panel, the PSU on
// the IEM's left as seen from inside; PSU 1 is drawn there on the port wall [EST]. Where PSU 2
// sits is not shown; it is drawn on the starboard wall [EST]. Red handling handles not drawn.
export const powerUnitsAsset = Object.freeze({
  revision: "power-units-2026-10-13b",
  unitCount: 2,
  widthM: 0.20, heightM: 0.24, depthM: 0.19,
  positions: Object.freeze([Object.freeze([-0.264, -0.284, 0.16]), Object.freeze([0.264, -0.284, -0.15])]),
  // Each connector face (local -z) turns inboard [EST].
  yaws: Object.freeze([-Math.PI / 2, Math.PI / 2]),
  bounds: Object.freeze({ min: [-0.36, -0.285, -0.31], max: [0.36, -0.04, 0.31] }),
});

// D-sub (MIL-DTL-24308) overall flange length by shell, and flange width [PUB, standard sizes].
const dsub = { E: 0.0308, A: 0.0391, B: 0.0530 }, dsubWidth = 0.0125;

// Face map from the photo: u across the face from the viewer's left (0) to right (1), v down
// the silver face from its top (0) to bottom (1); kind and size as photographed [EST].
const faceMap = [
  { u: 0.054, v: 0.135, kind: "dsub", size: "B" },
  { u: 0.054, v: 0.53, kind: "dsub", size: "B" },
  { u: 0.155, v: 0.14, kind: "dsub", size: "B" },
  { u: 0.155, v: 0.53, kind: "dsub", size: "B" },
  { u: 0.27, v: 0.1, kind: "dsub", size: "E" },
  { u: 0.27, v: 0.305, kind: "small" },
  { u: 0.37, v: 0.115, kind: "small" },
  { u: 0.37, v: 0.25, kind: "dark" },
  { u: 0.37, v: 0.48, kind: "dark" },
  { u: 0.37, v: 0.595, kind: "small" },
  { u: 0.505, v: 0.585, kind: "dsub", size: "B" },
  { u: 0.624, v: 0.615, kind: "dsub", size: "B" },
  { u: 0.774, v: 0.64, kind: "port" },
  { u: 0.914, v: 0.675, kind: "dsub", size: "B" },
];
const dividers = [0.107, 0.219, 0.333, 0.452, 0.570, 0.699, 0.849];

export function buildPowerUnits({ parent, mesh }) {
  const { widthM: W, heightM: H, depthM: D, positions, yaws } = powerUnitsAsset;
  const assembly = new THREE.Group();
  assembly.name = "power-units-assembly";
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: powerUnitsAsset.revision, dimensionConfidence: "EST" });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2023, roughness: 0.55, metalness: 0.35 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xc6cbce, roughness: 0.3, metalness: 0.72 });
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x5c6367, roughness: 0.5, metalness: 0.5 });
  const shell = new THREE.MeshStandardMaterial({ color: 0x9aa2a6, roughness: 0.35, metalness: 0.8 });
  const insert = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.7, metalness: 0.2 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb0b7bb, roughness: 0.35, metalness: 0.75 });
  const wrap = new THREE.MeshStandardMaterial({ color: 0xcfd3d5, roughness: 0.28, metalness: 0.82 });
  const kapton = new THREE.MeshStandardMaterial({ color: 0xd19a2e, roughness: 0.45, metalness: 0.2 });
  const box = (size, at, material, target, name) => {
    const part = mesh(new THREE.BoxGeometry(...size), material, at, target);
    part.name = name; return part;
  };
  const tube = (points, radius, material, target, name) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, "centripetal");
    const part = mesh(new THREE.TubeGeometry(curve, 20, radius, 6, false), material, [0, 0, 0], target);
    part.name = name; return part;
  };
  const face = -D / 2, band = 0.02, faceH = H - band - 0.006;
  const at = (u, v) => [W / 2 - u * W, faceH - v * faceH + 0.006]; // +x is the viewer's left
  const units = positions.map((position, n) => {
    const unit = new THREE.Group();
    unit.name = `psu-${n + 1}`;
    unit.position.fromArray(position);
    unit.rotation.y = yaws[n];
    assembly.add(unit);
    const layer = (name, inspectionLayer) => {
      const g = new THREE.Group(); g.name = `psu-${n + 1}-${name}`; g.userData.inspectionLayer = inspectionLayer;
      unit.add(g); return g;
    };
    const casing = layer("casing", "equipment-casings");
    const mounts = layer("mounts", "mounts");
    const connectors = layer("connectors", "interfaces");
    const harness = layer("harness", "harnesses");

    // Black body, top and the black band across the top of the face; silver slice faces below.
    box([W, H, D], [0, H / 2, 0], dark, casing, "psu-chassis");
    box([W + 0.002, band, 0.006], [0, H - band / 2, face - 0.003], dark, casing, "psu-top-band");
    box([W - 0.002, faceH, 0.003], [0, 0.006 + faceH / 2, face - 0.0015], silver, casing, "psu-slice-faces");
    for (const u of dividers) {
      const [x] = at(u, 0);
      box([0.0016, faceH, 0.004], [x, 0.006 + faceH / 2, face - 0.002], seamMat, casing, "psu-slice-divider");
    }
    // Ribs: one across the face, one over the left part [from the photo].
    box([W, 0.006, 0.008], [0, at(0, 0.385)[1], face - 0.004], silver, casing, "psu-face-rib");
    box([W * 0.46, 0.006, 0.008], [W / 2 - W * 0.23, at(0, 0.67)[1], face - 0.004], silver, casing, "psu-face-rib");
    // Screw posts at the tops of the middle dividers.
    for (const u of dividers.slice(3)) {
      const [x, y] = at(u, 0.12);
      const post = mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.012, 8), steel, [x, y, face - 0.006], casing);
      post.rotation.x = Math.PI / 2; post.name = "psu-screw-post";
    }

    // Connectors from the face map.
    const plugs = [];
    for (const c of faceMap) {
      const [x, y] = at(c.u, c.v);
      if (c.kind === "dsub") {
        const len = dsub[c.size];
        box([dsubWidth, len, 0.003], [x, y, face - 0.0045], shell, connectors, `psu-dsub-${c.size}-flange`);
        box([dsubWidth * 0.62, len * 0.72, 0.006], [x, y, face - 0.009], shell, connectors, `psu-dsub-${c.size}`);
        plugs.push([x, y, len * 0.72, 0.014]);
      } else if (c.kind === "port") {
        box([0.012, 0.02, 0.012], [x, y, face - 0.009], steel, connectors, "psu-uncapped-port");
      } else {
        box([0.009, 0.016, 0.006], [x, y, face - 0.006], c.kind === "dark" ? insert : shell, connectors, `psu-${c.kind}-connector`);
        plugs.push([x, y, 0.016, 0.01]);
      }
    }
    // Side flanges with bolts, for the wall/deck mounting [EST].
    for (const side of [-1, 1]) {
      box([0.014, 0.005, D], [side * (W / 2 + 0.007), 0.0025, 0], dark, mounts, "psu-mounting-flange");
      for (const z of [-D * 0.38, D * 0.38]) mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 6), steel, [side * (W / 2 + 0.007), 0.007, z], mounts).name = "psu-mount-bolt";
    }
    // Mated backshells; cables drop in front of the face and gather toward the free end [EST].
    const toward = n === 0 ? -1 : 1;
    const z0 = face - 0.024;
    plugs.forEach(([x, y, len, thick], i) => {
      box([thick, len + 0.006, 0.014], [x, y, face - 0.018], wrap, harness, "psu-harness-backshell");
      const run = toward * (W / 2 + 0.02 + (i % 4) * 0.005);
      tube([[x, y - len / 2, z0 + 0.004], [x, y - len / 2 - 0.02, z0 - 0.006], [x, 0.018, z0 - 0.016], [(x + run) / 2, 0.011, z0 - 0.022], [run, 0.011, z0 - 0.024 + (i % 3) * 0.004]],
        0.0045, wrap, harness, "psu-harness-cable");
    });
    for (const k of [0, 1]) box([0.012, 0.014, 0.012], [toward * (W / 2 + 0.028), 0.01, z0 - 0.022 + k * 0.008], kapton, harness, "psu-harness-tie");
    return { unit, casing, mounts, connectors, harness };
  });
  return { assembly, units };
}
