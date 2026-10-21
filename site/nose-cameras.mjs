import * as THREE from "./vendor/three/three.module.min.js";
import { mountEcam } from "./ecam.mjs?v=dev";

// Part 04: the nose cameras (Clark et al., DragonCam paper, 2026). Published [PUB]: the
// Forward WAC and two Side Cameras are ECAM-P50s with 5.8 mm lenses, the Forward MAC an ECAM-P50
// with a 12.6 mm lens, and two redundant NavCams for terrain-relative navigation connect
// directly to the spacecraft; nine Dragonfly cameras in all, each behind a window. Figs. 2-3
// (2026 CAD) put these six in the nose on a vertical camera panel just behind the nose cap:
// the Forward MAC and the Side Cameras high, the remaining two units low at the chin, one
// angled forward-down and one pointing straight down.
// Which low unit is which is not labeled clearly: the NavCams are drawn pointing down at the
// terrain (their navigation role) and the Forward WAC angled forward-down [EST, reasoned].
// The hood marks the Forward MAC (see ecam.mjs) [EST]. Positions are read from figs. 2-3,
// scaled from the nose tip to the MMRTG end; pointing angles, panel size, windows and harness
// are [EST]. The 2026 CAD's chin is fuller than this model's nose, so the low cameras stand
// out of the older nose shell until it is redrawn.
export const noseCamerasAsset = Object.freeze({
  revision: "nose-cameras-2026-10-13",
  panelZ: -1.665,
  cameras: Object.freeze([
    Object.freeze({ name: "forward-mac", kind: "medium", position: [-0.1, -0.04, -1.72], look: [0, 0, -1], up: [0, 1, 0] }),
    Object.freeze({ name: "port-side-camera", kind: "wide", position: [-0.12, 0.08, -1.71], look: [-1, -0.27, 0], up: [0, 0, -1] }),
    Object.freeze({ name: "starboard-side-camera", kind: "wide", position: [0.12, 0.0, -1.71], look: [1, -0.27, 0], up: [0, 0, -1] }),
    Object.freeze({ name: "forward-wac", kind: "wide", position: [0, -0.21, -1.83], look: [0, -1, -1], up: [0, 1, 0] }),
    Object.freeze({ name: "navcam-a", kind: "navcam", position: [-0.085, -0.27, -1.745], look: [0, -1, 0], up: [0, 0, 1] }),
    Object.freeze({ name: "navcam-b", kind: "navcam", position: [0.085, -0.27, -1.745], look: [0, -1, 0], up: [0, 0, 1] }),
  ].map(Object.freeze)),
  windowThicknessM: 0.003,
});

export function buildNoseCameras({ parent, mesh }) {
  const assembly = new THREE.Group();
  assembly.name = "nose-cameras-assembly";
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: noseCamerasAsset.revision, dimensionConfidence: "PUB+EST" });
  const plate = new THREE.MeshStandardMaterial({ color: 0xb4bcc0, roughness: 0.42, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd6e6, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.55 });
  const cavity = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const flex = new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.6, metalness: 0.1 });

  // Camera panel: the vertical plate in figs. 2-3 that the nose cameras bolt to [EST size].
  const panel = new THREE.Group();
  panel.name = "nose-camera-panel";
  panel.userData.inspectionLayer = "mounts";
  assembly.add(panel);
  const z = noseCamerasAsset.panelZ;
  mesh(new THREE.BoxGeometry(0.40, 0.44, 0.004), plate, [0, -0.11, z + 0.002], panel).name = "nose-camera-panel-plate";
  for (const x of [-0.19, 0.19]) for (const y of [-0.31, 0.09]) {
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.006, 6), plate, [x, y, z - 0.001], panel).rotation.x = Math.PI / 2;
  }

  const cameras = noseCamerasAsset.cameras.map(c => {
    const p = new THREE.Vector3(...c.position);
    const look = new THREE.Vector3(...c.look).normalize();
    const parts = mountEcam({ mesh, parent: assembly, name: c.name, kind: c.kind,
      position: c.position, target: p.clone().add(look).toArray(), up: new THREE.Vector3(...c.up) });
    // Window just ahead of the lens (the nose cover's camera window) with a short dark cavity [EST].
    const front = parts.size.length - 0.055 + 0.012;
    const pane = mesh(new THREE.CylinderGeometry(0.026, 0.026, noseCamerasAsset.windowThicknessM, 24), glass, [0, 0, front], parts.window);
    pane.rotation.x = Math.PI / 2; pane.name = "camera-window";
    const tube = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 20, 1, true), cavity, [0, 0, front - 0.006], parts.cavity);
    tube.rotation.x = Math.PI / 2; tube.name = "foam-cavity";
    // Harness: from the connector back to the camera panel [EST].
    const start = c.kind === "navcam" ? new THREE.Vector3(0, -0.012, -0.07) : new THREE.Vector3(0, 0.041, -0.062);
    const world = start.clone().applyQuaternion(parts.group.quaternion).add(parts.group.position);
    const end = new THREE.Vector3(world.x, world.y, z - 0.003).sub(parts.group.position).applyQuaternion(parts.group.quaternion.clone().invert());
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.01, 0));
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start, mid, end]), 10, 0.003, 6, false), flex, [0, 0, 0], parts.harness).name = "camera-harness";
    parts.role = c.name;
    return parts;
  });
  return { assembly, panel, cameras };
}
