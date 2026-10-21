import * as THREE from "./vendor/three/three.module.min.js";
import { hgaAsset } from "./hga-gimbal.mjs?v=dev";

// Part 14: the 100 W X-band traveling-wave tube amplifier (TWTA). Published for Dragonfly: a
// 100-watt TWTA with the Frontier X-band radio (NASA's Dragonfly spacecraft page), "mounted
// directly to the lander interior top deck", dissipating heat to the wall by conduction and with
// a leg of the cruise fluid loop serving the top deck (ICES-2020-160 p5), "located on the
// underside of the top deck" and on in flight (ICES-2023-389 p7). NASA's page and ICES-2023 name
// one TWTA; ICES-2020 says "TWTAs". One is drawn [EST].
// Dragonfly's TWTA itself is not pictured or sized in any source found, so the look follows
// published flight TWTAs of the same kind: a conduction-cooled tube (TWT) on a flanged
// baseplate and a separate electronic power conditioner (EPC) joined by a braided high-voltage
// umbilical (NASA/TM-2010-216262 fig. 1, LRO TWTA by L-3; Stellant's space TWT and TWTA
// photos). Sizes are scaled from published units [EST]: the LRO tube is 37 x 9 x 9 cm at
// 1.5 kg and its EPC 20 x 7 x 11 cm at 1.3 kg; MRO's two 100 W X-band tubes total 1.9 kg and
// their EPCs 3.0 kg (DESCANSO MRO table 2-1); Stellant lists its conduction-cooled X-band tube
// (40-160 W, 7.0-8.5 GHz) at 895 g. Port layout, labels, screws, cable routes and the place
// under the starboard deck above the radio are [EST]. The output waveguide runs forward under the
// deck to the rotary joint under the high-gain antenna gimbal (hga-gimbal.mjs); the route is
// [EST]. The first version stopped at the deck (archive/twta-waveguide-v1-2026-10-14).
const deckY = 0.07; // underside of the top deck (cavity top in the fit rules)
const timM = 0.001, plateM = 0.006;
export const twtaAsset = Object.freeze({
  revision: "twta-2026-10-14b",
  deckY,
  publishedRfW: 100,
  // Tube: length along the body (z), collector end forward; baseplate up against the deck.
  tube: Object.freeze({ lengthM: 0.33, widthM: 0.075, heightM: 0.075, x: 0.115, front: -0.05, back: 0.28, plateWidthM: 0.091 }),
  // EPC beside it, outboard, hung by corner ears; its high-voltage end aft beside the gun end.
  epc: Object.freeze({ lengthM: 0.21, widthM: 0.075, heightM: 0.11, x: 0.255, front: 0.07, back: 0.28 }),
  // Reference masses of the published units the sizes are scaled from (kg).
  referenceMassKg: Object.freeze({ lroTube: 1.5, lroEpc: 1.3, mroXTubeEach: 0.95, mroXEpcEach: 1.5, stellantXTube: 0.895 }),
  // WR-112 (X-band) waveguide, outer section and flange, standard sizes.
  waveguide: Object.freeze({ broadM: 0.0318, narrowM: 0.0159, flangeM: 0.048 }),
  // The radio connector the input coax is drawn to (Frontier J31, an SMA); not published [EST].
  inputTarget: Object.freeze([0.1303, -0.21, 0.238]),
  // Output waveguide route: forward from the collector end, down under the deck clear of the
  // power unit, forward and inboard to the antenna gimbal's rotary joint [EST].
  waveguideRoute: Object.freeze([
    [0.115, 0.0255, -0.062], [0.115, 0.0255, -0.385], [0.115, -0.05, -0.385],
    [0.115, -0.05, hgaAsset.rotaryJoint[2]], [hgaAsset.rotaryJoint[0], -0.05, hgaAsset.rotaryJoint[2]],
    [hgaAsset.rotaryJoint[0], hgaAsset.rotaryJoint[1] - 0.003, hgaAsset.rotaryJoint[2]],
  ].map(p => Object.freeze(p))),
});

export function buildTwta({ parent, mesh }) {
  const { tube: T, epc: E, waveguide: WG, inputTarget } = twtaAsset;
  const assembly = new THREE.Group();
  assembly.name = "twta-assembly";
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: twtaAsset.revision, dimensionConfidence: "PUB+EST" });
  const group = (name, inspectionLayer) => {
    const g = new THREE.Group(); g.name = name; g.userData.inspectionLayer = inspectionLayer;
    assembly.add(g); return g;
  };
  const casings = group("twta-casings", "equipment-casings");
  const mounts = group("twta-mounts", "mounts");
  const ports = group("twta-interfaces", "interfaces");
  const cables = group("twta-harnesses", "harnesses");
  const anodized = new THREE.MeshStandardMaterial({ color: 0x24282b, roughness: 0.55, metalness: 0.3 });
  const endCap = new THREE.MeshStandardMaterial({ color: 0x1a1d1f, roughness: 0.6, metalness: 0.3 });
  const plate = new THREE.MeshStandardMaterial({ color: 0xc3c7c9, roughness: 0.35, metalness: 0.75 });
  const alodine = new THREE.MeshStandardMaterial({ color: 0xc9a85a, roughness: 0.4, metalness: 0.7 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xc98a52, roughness: 0.3, metalness: 0.85 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd2a640, roughness: 0.3, metalness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9bfc3, roughness: 0.32, metalness: 0.75 });
  const staked = new THREE.MeshStandardMaterial({ color: 0x8e3a2c, roughness: 0.55, metalness: 0.2 });
  const label = new THREE.MeshStandardMaterial({ color: 0xe8e5da, roughness: 0.7, metalness: 0.05 });
  const tim = new THREE.MeshStandardMaterial({ color: 0x8d8f86, roughness: 0.9, metalness: 0.05 });
  const braid = new THREE.MeshStandardMaterial({ color: 0xcfd3d4, roughness: 0.45, metalness: 0.7 });
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
  const tube = (points, radius, material, target, name, sides = 8) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, "centripetal");
    const part = mesh(new THREE.TubeGeometry(curve, 32, radius, sides, false), material, [0, 0, 0], target);
    part.name = name; return part;
  };

  // ---- Tube (TWT): long black package on a wider silver baseplate with bolted ears along both
  // sides (as in the LRO photo), bolted up to the deck through a thermal pad.
  const tz = (T.front + T.back) / 2, plateY = deckY - timM - plateM / 2;
  const tubeTop = deckY - timM - plateM, tubeFace = tubeTop - T.heightM;
  box([T.plateWidthM + 0.004, timM, T.lengthM], [T.x, deckY - timM / 2, tz], tim, mounts, "twta-tube-thermal-pad");
  box([T.plateWidthM, plateM, T.lengthM], [T.x, plateY, tz], plate, mounts, "twta-tube-baseplate");
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i += 1) {
      const z = T.front + 0.022 + i * (T.lengthM - 0.044) / 7;
      box([0.012, plateM, 0.016], [T.x + side * (T.plateWidthM / 2 + 0.006), plateY, z], plate, mounts, "twta-tube-mounting-ear");
      rod(0.0034, 0.004, [T.x + side * (T.plateWidthM / 2 + 0.006), plateY - plateM / 2 - 0.002, z], steel, mounts, "y", "twta-tube-mount-bolt", 6);
    }
  }
  box([T.widthM, T.heightM, T.lengthM - 0.008], [T.x, tubeTop - T.heightM / 2, tz], anodized, casings, "twta-tube-body");
  for (const [z, name] of [[T.front + 0.002, "twta-tube-collector-end"], [T.back - 0.002, "twta-tube-gun-end"]]) {
    box([T.widthM - 0.003, T.heightM - 0.003, 0.004], [T.x, tubeTop - T.heightM / 2, z], endCap, casings, name);
  }
  // The face (pointing down, away from the deck) laid out as on the LRO tube: red staked screws
  // at the corners, beside the input port and by the test point; maker's label and high-voltage
  // warning at the gun end, an input tag, the part-number label mid-length and the long
  // beryllia warning toward the collector. Two more labels on the inboard side.
  const inZ = T.back - 0.085;
  const faceScrews = [[-1, T.front + 0.008], [1, T.front + 0.008], [-1, T.back - 0.008], [1, T.back - 0.008]];
  for (const [side, z] of faceScrews) rod(0.0026, 0.002, [T.x + side * (T.widthM / 2 - 0.006), tubeFace - 0.001, z], staked, casings, "y", "twta-tube-cover-screw", 8);
  for (const side of [-1, 1]) {
    rod(0.0026, 0.002, [T.x + side * 0.018, tubeFace - 0.001, inZ], staked, casings, "y", "twta-tube-cover-screw", 8);
    rod(0.0026, 0.002, [T.x + side * 0.02, tubeFace - 0.001, tz + 0.03], staked, casings, "y", "twta-tube-cover-screw", 8);
  }
  rod(0.004, 0.0012, [T.x, tubeFace - 0.0006, tz + 0.03], endCap, casings, "y", "twta-tube-test-point", 12);
  const faceLabel = (sx, sz, z, name, dx = 0) => box([sx, 0.0008, sz], [T.x + dx, tubeFace - 0.0004, z], label, casings, name);
  faceLabel(0.018, 0.03, T.back - 0.024, "twta-tube-maker-label");
  faceLabel(0.03, 0.013, T.back - 0.052, "twta-tube-high-voltage-label");
  faceLabel(0.012, 0.016, inZ - 0.026, "twta-tube-rf-input-tag", 0.01);
  faceLabel(0.028, 0.042, tz - 0.012, "twta-tube-part-label");
  faceLabel(0.022, 0.075, T.front + 0.052, "twta-tube-beryllia-warning-label");
  const sideLabel = (sy, sz, z, name) => box([0.0008, sy, sz], [T.x - T.widthM / 2 - 0.0004, tubeTop - T.heightM * 0.6, z], label, casings, name);
  sideLabel(0.012, 0.03, T.back - 0.05, "twta-tube-side-high-voltage-label");
  sideLabel(0.012, 0.085, tz, "twta-tube-side-warning-label");

  // RF input: SMA on a small square flange, about a quarter of the way from the gun end.
  box([0.022, 0.003, 0.022], [T.x, tubeFace - 0.0015, inZ], gold, ports, "twta-rf-input-flange");
  rod(0.0028, 0.009, [T.x, tubeFace - 0.0075, inZ], gold, ports, "y", "twta-rf-input-sma");
  rod(0.0045, 0.01, [T.x, tubeFace - 0.017, inZ], steel, ports, "y", "twta-rf-input-plug", 6);
  // RF output: WR-112 waveguide flange on the collector end, then runs with mitered corners
  // forward under the deck to the antenna gimbal's rotary joint, with flanges and deck hangers.
  const outY = tubeTop - T.heightM / 2;
  for (const [z, name] of [[T.front - 0.003, "twta-rf-output-flange"], [T.front - 0.009, "twta-waveguide-mating-flange"]]) {
    box([WG.flangeM, WG.flangeM, 0.006], [T.x, outY, z], copper, ports, name);
  }
  const route = twtaAsset.waveguideRoute;
  for (let i = 1; i < route.length; i += 1) {
    const [a, b] = [route[i - 1], route[i]], axis = [0, 1, 2].find(k => Math.abs(b[k] - a[k]) > 1e-9);
    const length = Math.abs(b[axis] - a[axis]), mid = a.map((v, k) => (v + b[k]) / 2);
    const size = axis === 2 ? [WG.narrowM, WG.broadM, length] : axis === 1 ? [WG.narrowM, length, WG.broadM] : [length, WG.broadM, WG.narrowM];
    box(size, mid, copper, ports, "twta-waveguide-run");
    if (i < route.length - 1) box([WG.broadM, WG.broadM, WG.broadM], b, copper, ports, "twta-waveguide-mitered-bend");
  }
  for (const [y, z] of [[outY, -0.22], [route[2][1], -0.47]]) box([WG.flangeM, WG.flangeM, 0.006], [T.x, y, z], copper, ports, "twta-waveguide-flange");
  box([WG.flangeM, 0.006, WG.flangeM], [route.at(-1)[0], route.at(-1)[1] - 0.003, route.at(-1)[2]], copper, ports, "twta-waveguide-joint-flange");
  for (const z of [-0.16, -0.3]) box([0.03, deckY - (outY + WG.broadM / 2), 0.006], [T.x, (deckY + outY + WG.broadM / 2) / 2, z], steel, mounts, "twta-waveguide-hanger");

  // ---- EPC: black box hung by four corner ears through its own thermal pad; staked screws,
  // labels, the bus connector on the face and the high-voltage gland at the aft end.
  const ez = (E.front + E.back) / 2, epcFace = deckY - timM - E.heightM;
  box([E.widthM, timM, E.lengthM], [E.x, deckY - timM / 2, ez], tim, mounts, "twta-epc-thermal-pad");
  box([E.widthM, E.heightM, E.lengthM], [E.x, deckY - timM - E.heightM / 2, ez], anodized, casings, "twta-epc-body");
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    const at = [E.x + side * (E.widthM / 2 + 0.007), deckY - timM - plateM / 2, ez + end * (E.lengthM / 2 - 0.02)];
    box([0.014, plateM, 0.016], at, alodine, mounts, "twta-epc-mounting-ear");
    rod(0.0034, 0.004, [at[0], at[1] - plateM / 2 - 0.002, at[2]], steel, mounts, "y", "twta-epc-mount-bolt", 6);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i += 1) {
      const z = E.front + 0.012 + i * (E.lengthM - 0.024) / 5;
      rod(0.0026, 0.002, [E.x + side * (E.widthM / 2 + 0.001), epcFace + 0.008, z], staked, casings, "x", "twta-epc-cover-screw", 8);
      rod(0.0026, 0.002, [E.x + side * (E.widthM / 2 + 0.001), deckY - 0.012, z], staked, casings, "x", "twta-epc-cover-screw", 8);
      rod(0.0026, 0.002, [E.x + side * (E.widthM / 2 - 0.007), epcFace - 0.001, z], staked, casings, "y", "twta-epc-cover-screw", 8);
    }
  }
  box([0.0008, 0.03, 0.06], [E.x - E.widthM / 2 - 0.0004, epcFace + 0.06, ez - 0.03], label, casings, "twta-epc-label");
  box([0.0008, 0.022, 0.05], [E.x + E.widthM / 2 + 0.0004, epcFace + 0.06, ez + 0.02], label, casings, "twta-epc-warning-label");
  box([0.03, 0.0008, 0.04], [E.x - 0.012, epcFace - 0.0004, ez + 0.055], label, casings, "twta-epc-face-label");
  const busZ = ez - 0.05;
  box([0.016, 0.004, 0.058], [E.x + 0.01, epcFace - 0.002, busZ], gold, ports, "twta-epc-bus-connector");
  box([0.009, 0.0012, 0.046], [E.x + 0.01, epcFace - 0.0046, busZ], endCap, ports, "twta-epc-bus-connector-insert");
  box([0.02, 0.012, 0.062], [E.x + 0.01, epcFace - 0.0112, busZ], jacket, ports, "twta-epc-bus-backshell");
  box([0.022, 0.022, 0.003], [E.x - 0.012, deckY - timM - 0.045, E.back + 0.0015], steel, ports, "twta-epc-hv-gland-flange");
  for (const dx of [-0.008, 0.008]) for (const dy of [-0.008, 0.008]) rod(0.0016, 0.002, [E.x - 0.012 + dx, deckY - timM - 0.045 + dy, E.back + 0.004], staked, ports, "z", "twta-epc-hv-flange-screw", 6);
  rod(0.0065, 0.008, [E.x - 0.012, deckY - timM - 0.045, E.back + 0.007], gold, ports, "z", "twta-epc-hv-gland");
  rod(0.0065, 0.008, [T.x, outY + 0.008, T.back + 0.004], gold, ports, "z", "twta-tube-hv-gland");

  // ---- Cables. High-voltage umbilical (braided, as photographed) looping aft from the EPC to
  // the gun end; input coax down to the radio; EPC bus harness outboard to the starboard wall
  // and forward toward the power units (end left at a tie; the route is [EST]).
  const hvStart = [E.x - 0.012, deckY - timM - 0.045, E.back + 0.011], hvEnd = [T.x, outY + 0.008, T.back + 0.008];
  const umbilical = tube([hvStart, [hvStart[0], hvStart[1] - 0.004, E.back + 0.035], [E.x - 0.04, hvStart[1] - 0.012, E.back + 0.058], [T.x + 0.04, hvEnd[1] - 0.025, T.back + 0.058], [T.x, hvEnd[1] - 0.006, T.back + 0.035], hvEnd], 0.0045, braid, cables, "twta-hv-umbilical", 10);
  const [ix, iy, iz] = inputTarget;
  const coax = tube([[T.x, tubeFace - 0.022, inZ], [T.x - 0.003, tubeFace - 0.06, inZ + 0.002], [T.x - 0.006, -0.14, iz - 0.002], [T.x - 0.006, iy + 0.016, iz], [T.x, iy, iz], [ix - 0.0095, iy, iz]], 0.0018, jacket, cables, "twta-rf-input-coax");
  rod(0.0045, 0.0095, [ix - 0.00475, iy, iz], steel, cables, "x", "twta-rf-input-coax-plug", 6);
  const wallX = 0.348, busY = epcFace - 0.021;
  const bus = tube([[E.x + 0.01, epcFace - 0.0112, busZ - 0.035], [E.x + 0.013, busY, busZ - 0.055], [wallX - 0.018, busY, busZ - 0.075], [wallX, busY + 0.007, busZ - 0.1], [wallX, busY + 0.01, -0.01]], 0.0065, jacket, cables, "twta-epc-bus-harness");
  for (const z of [0.015, -0.004]) rod(0.0085, 0.006, [wallX, busY + 0.01, z], lacing, cables, "z", "twta-harness-tie", 10);
  return { assembly, casings, mounts, ports, cables, umbilical, coax, bus };
}
