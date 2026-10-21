import * as THREE from "./vendor/three/three.module.min.js";
import { drillAsset } from "./drills.mjs?v=dev";

// Parts 02 and 24: DrACO's Pneumatic Transport System (Zacny et al., LPSC 2022, fig. 1 and the
// cross-strapped schematic; Honeybee KISS slides 21-22; NASA "Playing Lacrosse on Titan";
// ICES-2023-389 p. 7). Published [PUB]: material is suctioned through the hollow bit and carried
// in Titan air through transfer tubes; either drill can feed either the LDMS or GCMS cups using
// either of two centrifugal blowers (impellers designed for Titan air); flow diverters route the
// air; the blower exhausts outside; the hose is flexible and can be routed around obstacles; the
// blower is exposed to Titan and sits behind the port forward arm.
// Flow drawn here, as in fig. 1: each drill's swivel port -> flexible hose -> transfer tube along
// the body to the nose and up into the cold attic -> flow-diverter manifold on the carousel's
// sample inlet (where the cup elevators sit) -> return tube down the port side -> blower inlet
// diverter -> forward and aft blowers -> exhaust down and outward.
// Routes, tube size (about 13 mm), clamps and component sizes are [EST]; APL's payload cutaway
// (a published visualization) was used only to cross-check that the tubes run along the lower
// body side and up the front of the attic.
const TUBE = 0.0065, HOSE = 0.0075;
export const dracoPlumbingAsset = Object.freeze({
  revision: "draco-plumbing-2026-10-14",
  tubeOuterDiameterM: 2 * TUBE,
  hoseAnchors: Object.freeze([Object.freeze([-0.40, -0.40, -0.52]), Object.freeze([0.40, -0.40, -0.52])]),
  manifold: Object.freeze([-0.20, 0.415, -1.40]),
  blowerCenters: Object.freeze([Object.freeze([-0.475, -0.245, -0.64]), Object.freeze([-0.475, -0.245, -0.555])]),
  blowerDiverter: Object.freeze([-0.462, -0.175, -0.5975]),
});

const v = p => new THREE.Vector3(...p);
const curve = pts => new THREE.CatmullRomCurve3(pts.map(v), false, "centripetal");

// Stowed position of a drill's hose attach point.
function portWorld(side, feed = 0) {
  const [inboard, up, fore] = drillAsset.portLocal;
  return [side * (drillAsset.lateralM - inboard), drillAsset.stowedY - feed + up, drillAsset.foreAftM + fore];
}

// Intake route for one drill, from the hose anchor under the body edge to the manifold.
function intakeRoute(side) {
  const [ax, ay, az] = dracoPlumbingAsset.hoseAnchors[side < 0 ? 0 : 1];
  const riserZ = side < 0 ? -1.55 : -1.57;
  const top = side < 0
    ? [[-0.43, 0.43, -1.55], [-0.26, 0.43, -1.53], [-0.215, 0.42, -1.46], [-0.215, 0.415, -1.43]]
    : [[0.43, 0.47, -1.57], [0.0, 0.47, -1.57], [-0.17, 0.46, -1.51], [-0.185, 0.43, -1.45], [-0.185, 0.425, -1.43]];
  return [
    [ax, ay, az], [ax, ay, az - 0.2], [ax, ay, -1.1], [ax, ay, -1.4],
    [side * 0.445, -0.37, -1.5], [side * 0.445, -0.3, riserZ], [side * 0.445, 0.1, riserZ], [side * 0.445, 0.38, riserZ],
    ...top,
  ];
}

// Slack hose from the hose anchor down to the drill's port; follows the carriage when drilling.
function hosePoints(side, feed) {
  const anchor = dracoPlumbingAsset.hoseAnchors[side < 0 ? 0 : 1];
  const port = portWorld(side, feed);
  const sag = Math.min(0.03, 0.03 * (1 - feed / 0.13));
  return [anchor, [side * 0.43, -0.47 - feed * 0.4, -0.52], [side * 0.455, port[1] - sag, -0.48], port];
}

export function buildSampleLines({ parent, mesh, carouselInlet }) {
  const lines = new THREE.Group();
  lines.name = "draco-sample-lines";
  parent.add(lines);
  Object.assign(parent.userData, { assetRevision: dracoPlumbingAsset.revision, dimensionConfidence: "EST" });
  const layer = (name, inspectionLayer) => {
    const g = new THREE.Group(); g.name = name; g.userData.inspectionLayer = inspectionLayer; lines.add(g); return g;
  };
  const tubes = layer("draco-transfer-tubes", "harnesses");
  const hoses = layer("draco-flexible-hoses", "harnesses");
  const diverters = layer("draco-carousel-flow-diverter", "interfaces");
  const clamps = layer("draco-tube-clamps", "mounts");
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c0c4, roughness: 0.3, metalness: 0.85 });
  const hoseMat = new THREE.MeshStandardMaterial({ color: 0x3b4044, roughness: 0.7, metalness: 0.2 });
  const valve = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.38, metalness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2023, roughness: 0.55, metalness: 0.35 });
  const tube = (pts, r, mat, target, name, segs = 64) => {
    const part = mesh(new THREE.TubeGeometry(curve(pts), segs, r, 8, false), mat, [0, 0, 0], target);
    part.name = name; return part;
  };
  const clamp = (at, toward, name = "draco-tube-clamp") => {
    // A band round the tube and a short tab to the structure.
    // Oriented with explicit math (Object3D.lookAt would depend on the parents' world transform).
    const t = new THREE.Vector3(...toward), dir = t.clone().normalize();
    const band = mesh(new THREE.TorusGeometry(TUBE + 0.002, 0.0018, 6, 14), valve, at, clamps);
    band.name = name;
    band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const mid = new THREE.Vector3(...at).addScaledVector(t, 0.5);
    const tab = mesh(new THREE.BoxGeometry(0.012, 0.003, t.length()), valve, mid.toArray(), clamps);
    tab.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); tab.name = "draco-clamp-tab";
  };

  const paths = [];
  const hoseParts = [];
  for (const side of [-1, 1]) {
    const route = intakeRoute(side);
    tube(route, TUBE, steel, tubes, `draco-intake-tube-${side < 0 ? "port" : "starboard"}`, 96);
    // Clamps under the body edge and on the nose riser.
    for (const z of [-0.64, -1.0, -1.32]) clamp([side * 0.40, -0.40, z], [side * -0.012, 0.042, 0]);
    clamp([side * 0.445, 0.05, side < 0 ? -1.55 : -1.57], [side * -0.012, 0, 0]);
    const hose = mesh(new THREE.TubeGeometry(curve(hosePoints(side, 0)), 24, HOSE, 8, false), hoseMat, [0, 0, 0], hoses);
    hose.name = `draco-flexible-hose-${side < 0 ? "port" : "starboard"}`;
    let lastFeed = 0;
    hoseParts.push({
      mesh: hose,
      setFeed(feed) {
        if (Math.abs(feed - lastFeed) < 1e-4) return;
        lastFeed = feed;
        hose.geometry.dispose();
        hose.geometry = new THREE.TubeGeometry(curve(hosePoints(side, feed)), 24, HOSE, 8, false);
      },
    });
    // Particle path for the sampling animation: drill port, hose, tube, manifold, carousel inlet.
    paths.push(curve([...hosePoints(side, 0).reverse(), ...route.slice(1), carouselInlet ? carouselInlet.toArray() : dracoPlumbingAsset.manifold]));
  }

  // Flow-diverter manifold on the carousel's sample inlet: both intake tubes in, the return out.
  const [mx, my, mz] = dracoPlumbingAsset.manifold;
  mesh(new THREE.BoxGeometry(0.07, 0.04, 0.06), valve, [mx, my, mz], diverters).name = "draco-flow-diverter-manifold";
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 16), dark, [mx, my + 0.035, mz], diverters).name = "draco-flow-diverter-actuator";
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 16), valve, [mx, my - 0.022, mz + 0.008], diverters).name = "draco-manifold-inlet-stub";
  for (const x of [-0.015, 0.015]) mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12), steel, [mx + x, my, mz - 0.033], diverters).rotation.x = Math.PI / 2;

  // Return tube from the manifold down the port side and aft to the blowers' inlet diverter.
  const [bx, by, bz] = dracoPlumbingAsset.blowerDiverter;
  const ret = [
    [mx - 0.035, my, mz], [-0.30, 0.41, -1.40], [-0.42, 0.40, -1.43], [-0.448, 0.36, -1.44], [-0.448, 0.0, -1.44],
    [-0.448, -0.15, -1.44], [-0.448, -0.2, -1.39], [-0.448, -0.2, -1.0], [-0.448, -0.2, -0.72], [bx, -0.19, bz - 0.075], [bx, by, bz - 0.056],
  ];
  tube(ret, TUBE, steel, tubes, "draco-return-tube", 96);
  for (const z of [-1.2, -0.95]) clamp([-0.448, -0.2, z], [0.012, 0, 0]);
  clamp([-0.448, -0.05, -1.44], [0.012, 0, 0]);

  return { lines, tubes, hoses, diverters, clamps, paths, hoseParts, returnRoute: ret };
}

export function buildBlowers({ parent, mesh }) {
  const group = new THREE.Group();
  group.name = "draco-blowers";
  parent.add(group);
  Object.assign(parent.userData, { assetRevision: dracoPlumbingAsset.revision, dimensionConfidence: "EST" });
  const layer = (name, inspectionLayer) => {
    const g = new THREE.Group(); g.name = name; g.userData.inspectionLayer = inspectionLayer; group.add(g); return g;
  };
  const casings = layer("draco-blower-casings", "equipment-casings");
  const ports = layer("draco-blower-ports", "interfaces");
  const mounts = layer("draco-blower-mounts", "mounts");
  const alum = new THREE.MeshStandardMaterial({ color: 0xc9cfd2, roughness: 0.35, metalness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272a, roughness: 0.5, metalness: 0.4 });
  const valve = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.38, metalness: 0.75 });
  const R = 0.038;

  // Inlet flow diverter: selects the forward or aft blower (the schematic's upper diverters).
  const [dx, dy, dz] = dracoPlumbingAsset.blowerDiverter;
  mesh(new THREE.BoxGeometry(0.03, 0.025, 0.11), valve, [dx, dy, dz], ports).name = "draco-blower-flow-diverter";
  mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 12), dark, [dx, dy + 0.0225, dz], ports).name = "draco-blower-diverter-actuator";

  for (const [i, c] of dracoPlumbingAsset.blowerCenters.entries()) {
    const [x, y, z] = c;
    const name = i === 0 ? "forward" : "aft";
    // Volute: a flat scroll housing with a bulge toward the outlet, the motor below it.
    mesh(new THREE.CylinderGeometry(R, R, 0.03, 32), alum, [x, y, z], casings).name = `draco-${name}-blower-volute`;
    mesh(new THREE.CylinderGeometry(R * 0.75, R * 0.75, 0.03, 24), alum, [x - 0.012, y, z + 0.012], casings).name = "draco-blower-scroll";
    mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.004, 32), dark, [x, y + 0.015, z], casings).name = "draco-blower-cover-seam";
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.045, 20), dark, [x, y - 0.0375, z], casings).name = `draco-${name}-blower-motor`;
    // Axial inlet on top, fed from the diverter.
    mesh(new THREE.CylinderGeometry(0.009, 0.011, dy - 0.0125 - (y + 0.015), 14), valve, [x, (dy - 0.0125 + y + 0.015) / 2, z], ports).name = `draco-${name}-blower-inlet`;
    // Tangential exhaust, pointing down and outboard, with a flared mouth.
    const start = new THREE.Vector3(x - R * 0.8, y, z + 0.02), end = new THREE.Vector3(x - R - 0.025, y - 0.028, z + 0.03);
    const dir = end.clone().sub(start);
    const pipe = mesh(new THREE.CylinderGeometry(0.009, 0.009, dir.length(), 14), alum, start.clone().lerp(end, 0.5).toArray(), ports);
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); pipe.name = `draco-${name}-blower-exhaust`;
    const mouth = mesh(new THREE.CylinderGeometry(0.014, 0.009, 0.012, 16, 1, true), alum, end.toArray(), ports);
    mouth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); mouth.name = "draco-blower-exhaust-mouth";
    mouth.material = alum.clone(); mouth.material.side = THREE.DoubleSide;
    // Bracket from the volute's inboard face to the body side (port side, x < 0).
    const inner = x + R, body = -0.43;
    mesh(new THREE.BoxGeometry(Math.abs(body - inner) + 0.002, 0.05, 0.05), valve, [(inner + body) / 2, y, z], mounts).name = "draco-blower-bracket";
  }
  return { group, casings, ports, mounts };
}
