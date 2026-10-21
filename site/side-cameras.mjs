import * as THREE from "./vendor/three/three.module.min.js";
import { mountEcam } from "./ecam.mjs?v=dev";

// Part 23: the DragonCam cameras on the lower body (Clark et al., "Optomechanical design of the
// DragonCam Microscopic Camera", 2026, figs. 1-3, 5, 12 and table 1):
// - the Microscopic Camera on the port side, aft of the drill, imaging the drill site about one
//   meter away (986 mm nominal) at 52 degrees to the surface normal [PUB];
// - APL's LED array co-aligned with it for night and UV-fluorescence imaging (365 nm UV and
//   bands to 935 nm are published; the emitter layout is [EST]);
// - a Down Camera on each side (ECAM-P50, 5.8 mm lens) [PUB], mid-body per figs. 2-3 [EST];
// - each camera sits in a cavity in the foam and looks through a 3 mm window [PUB]. The
//   Microscopic Camera is thicker than the 7.62 cm average foam, so the foam must be locally
//   thicker there; the camera is drawn feet-in against the structure panel, bulging outward,
//   without a drawn foam blister [EST].
// DragonCam fig. 3, scaled from the nose tip to the MMRTG end, puts the drill about 0.36 m
// forward of center; this model's (not yet redrawn) drill is at 0.43 m. The Microscopic Camera
// is placed from the model's drill site, so it moves with the drill when part 01 is redrawn.
// Camera bodies follow ecam.mjs. Brackets and harness stubs [EST].
const drillSite = [-0.54, -0.85, -0.43]; // port drill bit at the ground (skid contact plane)
// The cameras sit in the foam outside the bay wall: brackets bolt to the wall's outer face (|x| about
// 0.362) and the harness passes through it [EST]. Nothing reaches into the bay.
const tilt = 52 * Math.PI / 180, workingDistance = 0.986, lateral = 0.13, wallOuter = 0.362;

function microscopePose() {
  const ux = lateral / workingDistance;
  const horizontal = Math.sqrt(Math.sin(tilt) ** 2 - ux ** 2);
  const up = [ux, Math.cos(tilt), horizontal]; // from the drill site toward the camera: inboard, up, aft
  return drillSite.map((v, i) => v + up[i] * workingDistance);
}

export const sideCamerasAsset = Object.freeze({
  revision: "side-cameras-2026-10-13",
  drillSite: Object.freeze(drillSite),
  microscope: Object.freeze({ position: Object.freeze(microscopePose()), workingDistanceM: workingDistance, tiltDeg: 52, volumeMm: Object.freeze([105, 155, 90]), massKg: 1.04 }),
  ledOffset: Object.freeze([-0.004, -0.046, 0.052]),
  downCameras: Object.freeze([Object.freeze([-0.397, -0.2845, 0.16]), Object.freeze([0.397, -0.2845, 0.16])]),
  wallOuterX: wallOuter,
  windowThicknessM: 0.003,
  outerBottomY: -0.36, outerSideX: 0.43,
});

export function buildSideCameras({ parent, mesh }) {
  const assembly = new THREE.Group();
  assembly.name = "side-cameras-assembly";
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: sideCamerasAsset.revision, dimensionConfidence: "PUB+EST" });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd6e6, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.55 });
  const cavity = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.95, metalness: 0 });
  const bracketMat = new THREE.MeshStandardMaterial({ color: 0xa9b1b5, roughness: 0.4, metalness: 0.7 });
  const flex = new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.6, metalness: 0.1 });
  const ledBase = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.55, metalness: 0.35 });
  const ledColors = [0x7a3cff, 0x3a6dff, 0x3fd06a, 0xffb02e, 0xe0302a, 0x7a1010];
  const cameras = [];
  // Each camera's "up" (its connector side) points outboard, so its feet bolt to the inner panel.
  const outboard = side => new THREE.Vector3(side, 0, 0);

  function camera(name, kind, position, target, up) {
    const parts = mountEcam({ mesh, parent: assembly, name, kind, position, target, up });
    cameras.push(parts);
    return parts;
  }
  // Window: a 3 mm pane where the view leaves the foam, with a dark cavity back to the lens.
  function windowFor(parts, lensFront, radius, exitDistance) {
    const pane = mesh(new THREE.CylinderGeometry(radius, radius, sideCamerasAsset.windowThicknessM, 24), glass, [0, 0, lensFront + exitDistance], parts.window);
    pane.rotation.x = Math.PI / 2; pane.name = "camera-window";
    const tube = mesh(new THREE.CylinderGeometry(radius + 0.004, radius + 0.004, exitDistance, 20, 1, true), cavity, [0, 0, lensFront + exitDistance / 2], parts.cavity);
    tube.rotation.x = Math.PI / 2; tube.name = "foam-cavity";
    tube.material.side = THREE.DoubleSide;
  }
  // Distance along the view ray from a point to where it leaves the body's outer foam surface.
  function exitAlong(parts, from) {
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(parts.group.quaternion);
    const start = new THREE.Vector3(0, 0, from).applyQuaternion(parts.group.quaternion).add(parts.group.position);
    const hits = [];
    if (dir.y < 0) hits.push((sideCamerasAsset.outerBottomY + 0.0015 - start.y) / dir.y);
    if (Math.abs(dir.x) > 1e-6) hits.push((Math.sign(dir.x) * (sideCamerasAsset.outerSideX - 0.0015) - start.x) / dir.x);
    return Math.max(0.004, Math.min(...hits.filter(t => t > 0)));
  }
  function stub(parts, from, toX) {
    // Harness stub from the connector, round the back of the housing, to a feedthrough on the
    // inner face of the foam [EST].
    const a = new THREE.Vector3(...from);
    const behind = a.clone().add(new THREE.Vector3(0, 0.006, -0.035));
    const world = behind.clone().applyQuaternion(parts.group.quaternion).add(parts.group.position);
    const end = new THREE.Vector3(toX, world.y, world.z).sub(parts.group.position).applyQuaternion(parts.group.quaternion.clone().invert());
    const curve = new THREE.CatmullRomCurve3([a, behind, end]);
    mesh(new THREE.TubeGeometry(curve, 12, 0.003, 6, false), flex, [0, 0, 0], parts.harness).name = "camera-harness";
    const feed = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 10), bracketMat, end.toArray(), parts.connectors);
    feed.name = "camera-feedthrough";
    feed.quaternion.copy(parts.group.quaternion.clone().invert()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
    feed.position.add(new THREE.Vector3(Math.sign(toX) * 0.003, 0, 0).applyQuaternion(parts.group.quaternion.clone().invert()));
  }

  // Microscopic Camera aimed at the drill site.
  const mi = camera("microscopic-camera", "microscope", sideCamerasAsset.microscope.position, drillSite, outboard(-1));
  const miLens = 0.085;
  windowFor(mi, miLens, 0.03, exitAlong(mi, miLens));
  mesh(new THREE.BoxGeometry(0.08, 0.003, 0.06), bracketMat, [0, -0.045 - 0.0015, -0.04], mi.mounts).name = "camera-bracket";
  stub(mi, [0, 0.045 + 0.01, -0.058], -wallOuter);

  // LED array beside it, aimed at the same spot.
  const ledPos = sideCamerasAsset.microscope.position.map((v, i) => v + sideCamerasAsset.ledOffset[i]);
  const led = camera("led-array", null, ledPos, drillSite, outboard(-1));
  mesh(new THREE.BoxGeometry(0.05, 0.036, 0.016), ledBase, [0, 0, -0.008], led.casing).name = "led-array-body";
  ledColors.forEach((color, i) => {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0 });
    const x = -0.016 + (i % 3) * 0.016, y = i < 3 ? 0.008 : -0.008;
    const e = mesh(new THREE.SphereGeometry(0.0045, 10, 8), m, [x, y, 0.001], led.casing);
    e.scale.z = 0.6; e.name = i === 0 ? "led-uv-365nm" : "led-emitter";
  });
  windowFor(led, 0.003, 0.024, exitAlong(led, 0.003));
  mesh(new THREE.BoxGeometry(0.06, 0.003, 0.03), bracketMat, [0, -0.0195, -0.012], led.mounts).name = "camera-bracket";
  stub(led, [0, 0.018, -0.016], -wallOuter);

  // Down cameras, looking straight down through the bottom foam, nose up the image.
  for (const [i, position] of sideCamerasAsset.downCameras.entries()) {
    const side = Math.sign(position[0]);
    const down = camera(i === 0 ? "port-down-camera" : "starboard-down-camera", "wide", position,
      [position[0], position[1] - 1, position[2]], outboard(side));
    windowFor(down, 0.044, 0.02, exitAlong(down, 0.044));
    mesh(new THREE.BoxGeometry(0.08, 0.003, 0.04), bracketMat, [0, -0.031 - 0.0015, -0.03], down.mounts).name = "camera-bracket";
    stub(down, [0, 0.031 + 0.01, -0.043], side * wallOuter);
  }
  return { assembly, cameras };
}
