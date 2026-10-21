import * as THREE from "./vendor/three/three.module.min.js";

// Part 01: DrACO Sample Acquisition Drills (SAD), one beside each side of the body above the
// skids. Drawn from Zacny et al., DrACO, LPSC 2022, fig. 2 (Phase B CAD): a gold drill-head
// housing with two black actuators, percussion on top and rotation on the front, and a gold
// column showing the percussion spring; the head rides a Z-stage rail driven by a motor at the
// top through a lead screw to a lower bracket; below the head a swivel with an angled pneumatic
// port; a hollow bit with a side opening and a slotted cutting crown (openings exclude particles
// over 1.5 mm). Published [PUB]: two redundant rotary-percussive drills with separate rotation
// and percussion actuators, material taken from up to 6 cm deep, suctioned through the hollow bit.
// Placement: beside the body just aft of the forward leg (APL payload cutaway; NASA printable
// model, assembly step 3; DragonCam fig. 3); these put it about 0.34-0.45 m forward of center, and
// the model keeps 0.43 m [EST]. Overall height, about 0.7 m from motor top to stowed bit tip,
// follows DragonCam fig. 3; part sizes are proportioned from LPSC fig. 2 [EST]. Colors follow
// the CAD (gold housing, red rail). The carriage slides down the rail while drilling; only the
// bit turns.
export const drillAsset = Object.freeze({
  revision: "drills-2026-10-13",
  lateralM: 0.54, foreAftM: -0.43,
  stowedY: -0.72, // carriage origin when stowed
  bitTipBelowOrigin: 0.058, // stowed bit tip at -0.778, 7.2 cm above the skid contact plane
  maxDepthM: 0.06,
  bodyOuterX: 0.43,
  rail: Object.freeze({ top: -0.28, bottom: -0.76 }),
  // Where the transfer hose attaches: the outer pneumatic-port fitting, carriage-local
  // (inboard offset, height above the carriage origin, fore-aft offset).
  portLocal: Object.freeze([0.072, 0.118, 0]),
});

export function buildDrill({ parent, mesh, side }) {
  const inb = -side; // toward the body
  const name = side < 0 ? "port" : "starboard";
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89b3c, roughness: 0.42, metalness: 0.65 });
  const black = new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.5, metalness: 0.35 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xc5cacd, roughness: 0.3, metalness: 0.8 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x8a9095, roughness: 0.45, metalness: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0xa3261e, roughness: 0.5, metalness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x7f9aa0, roughness: 0.35, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.8, metalness: 0.1 });

  const drill = new THREE.Group();
  drill.name = `drill-${name}`;
  drill.position.set(side * drillAsset.lateralM, 0, drillAsset.foreAftM);
  parent.add(drill);
  const layer = (target, n, inspectionLayer) => {
    const g = new THREE.Group(); g.name = `drill-${name}-${n}`; g.userData.inspectionLayer = inspectionLayer; target.add(g); return g;
  };
  const box = (s, at, m, t, n) => { const p = mesh(new THREE.BoxGeometry(...s), m, at, t); p.name = n; return p; };
  const cyl = (r, h, at, m, t, n, sides = 20) => { const p = mesh(new THREE.CylinderGeometry(r, r, h, sides), m, at, t); p.name = n; return p; };

  // Fixed parts: Z-stage rail, lead screw, Z motor, lower bracket, mounts to the body side.
  const stage = layer(drill, "z-stage", "mounts");
  const railX = inb * 0.075, railMid = (drillAsset.rail.top + drillAsset.rail.bottom) / 2, railLen = drillAsset.rail.top - drillAsset.rail.bottom;
  box([0.03, railLen, 0.016], [railX, railMid, 0.02], red, stage, "drill-z-rail");
  cyl(0.004, railLen, [railX, railMid, 0.045], steel, stage, "drill-lead-screw", 10);
  cyl(0.0225, 0.065, [railX, drillAsset.rail.top + 0.045, 0.045], silver, stage, "drill-z-motor");
  cyl(0.02, 0.022, [railX, drillAsset.rail.top + 0.003, 0.045], grey, stage, "drill-z-gearhead");
  box([0.05, 0.01, 0.08], [railX, drillAsset.rail.bottom - 0.005, 0.03], grey, stage, "drill-lower-bracket");
  // Brackets from the rail back to the body side [EST].
  const span = drillAsset.lateralM - Math.abs(railX) - drillAsset.bodyOuterX; // body side to rail center
  for (const y of [drillAsset.rail.top - 0.02, drillAsset.rail.bottom + 0.06]) {
    box([span, 0.012, 0.09], [inb * (drillAsset.lateralM - drillAsset.bodyOuterX - span / 2), y, 0.02], grey, stage, "drill-body-mount");
  }

  // Moving carriage: everything that rides the rail; the bit turns inside it.
  const carriage = new THREE.Group();
  carriage.name = side < 0 ? "drill-feed-port" : "drill-feed-starboard";
  carriage.position.y = drillAsset.stowedY;
  drill.add(carriage);
  const head = layer(carriage, "head", "equipment-casings");
  const port = layer(carriage, "pneumatic-port", "interfaces");
  const leads = layer(carriage, "motor-leads", "harnesses");
  const bit = new THREE.Group();
  bit.name = `drill-${name}-bit`;
  bit.userData.inspectionLayer = "equipment-casings";
  carriage.add(bit);
  carriage.userData.bit = bit;

  // Gold drill-head housing with bolt bosses, an upper block and the percussion column.
  box([0.10, 0.13, 0.10], [0, 0.2, 0], gold, head, "drill-head-housing");
  box([0.07, 0.04, 0.07], [0, 0.285, 0], gold, head, "drill-head-upper");
  for (const x of [-0.045, 0.045]) for (const z of [-0.045, 0.045]) cyl(0.008, 0.012, [x, 0.271, z], gold, head, "drill-head-boss", 10);
  cyl(0.017, 0.11, [inb * 0.015, 0.355, 0.02], gold, head, "drill-percussion-column");
  box([0.006, 0.07, 0.004], [inb * 0.015, 0.355, 0.0035], dark, head, "drill-spring-slot");
  const coil = new THREE.CatmullRomCurve3(Array.from({ length: 41 }, (_, i) => {
    const a = i / 40 * Math.PI * 14;
    return new THREE.Vector3(inb * 0.015 + Math.cos(a) * 0.009, 0.322 + i / 40 * 0.066, 0.02 + Math.sin(a) * 0.009);
  }));
  mesh(new THREE.TubeGeometry(coil, 80, 0.0015, 4, false), silver, [0, 0, 0], head).name = "drill-percussion-spring";
  // Actuators: percussion on top, rotation on the front face; silver bands at their bases.
  cyl(0.024, 0.15, [side * 0.02, 0.38, -0.025], black, head, "drill-percussion-actuator");
  cyl(0.025, 0.018, [side * 0.02, 0.31, -0.025], silver, head, "drill-actuator-band");
  cyl(0.022, 0.14, [0, 0.245, -0.072], black, head, "drill-rotation-actuator");
  cyl(0.023, 0.018, [0, 0.18, -0.072], silver, head, "drill-actuator-band");
  // Carriage bracket and lead-screw nut on the rail side.
  box([0.008, 0.1, 0.05], [inb * 0.055, 0.19, 0.02], grey, head, "drill-carriage-bracket");
  box([0.022, 0.03, 0.022], [railX, 0.19, 0.045], grey, head, "drill-lead-nut");
  for (const y of [0.16, 0.22]) cyl(0.004, 0.012, [inb * 0.06, y, 0.035], silver, head, "drill-carriage-bolt", 6).rotation.z = Math.PI / 2;

  // Swivel and its angled pneumatic port (the transfer line attaches here).
  cyl(0.025, 0.02, [0, 0.13, 0], silver, head, "drill-bearing-collar");
  cyl(0.035, 0.035, [0, 0.1, 0], silver, port, "drill-swivel");
  for (const k of [0, 1]) {
    const f = cyl(0.008, 0.022, [inb * (0.045 + k * 0.02), 0.11 + k * 0.012, 0], silver, port, "drill-port-fitting", 6);
    f.rotation.z = inb * (Math.PI / 2 - 0.6);
  }

  // Hollow bit: side opening and a slotted crown with teeth; it turns while the carriage feeds.
  const tip = -drillAsset.bitTipBelowOrigin;
  cyl(0.015, 0.14, [0, tip + 0.015 + 0.07, 0], silver, bit, "drill-bit-tube");
  const hole = cyl(0.007, 0.004, [0, 0.04, -0.0145], dark, bit, "drill-bit-opening", 12);
  hole.rotation.x = Math.PI / 2; hole.scale.set(1, 1, 1.6);
  cyl(0.017, 0.015, [0, tip + 0.0075, 0], grey, bit, "drill-bit-crown");
  for (let i = 0; i < 8; i += 1) {
    const a = i * Math.PI / 4;
    const t = box([0.005, 0.008, 0.005], [Math.cos(a) * 0.016, tip + 0.002, Math.sin(a) * 0.016], silver, bit, "drill-bit-tooth");
    t.rotation.y = -a;
    if (i % 2) box([0.002, 0.009, 0.006], [Math.cos(a + 0.4) * 0.0172, tip + 0.009, Math.sin(a + 0.4) * 0.0172], dark, bit, "drill-bit-slot").rotation.y = -(a + 0.4);
  }

  // Motor leads run up toward the rail top [EST].
  for (const [x, y, z] of [[side * 0.02, 0.455, -0.025], [0, 0.315, -0.072]]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, y, z), new THREE.Vector3(x + inb * 0.02, y + 0.03, z + 0.03), new THREE.Vector3(railX, y + 0.05, 0.03)]);
    mesh(new THREE.TubeGeometry(curve, 10, 0.003, 6, false), black, [0, 0, 0], leads).name = "drill-motor-lead";
  }
  return { drill, carriage, bit, stage, head, port, leads };
}
