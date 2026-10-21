import * as THREE from "./vendor/three/three.module.min.js";

// Malin Space Science Systems ECAM camera heads as drawn in the DragonCam paper (Clark et al.,
// 2026, figs. 1 and 5): a housing of stacked front, middle and back sections, two orange side
// panels, bolted mounting feet, a connector with its harness on top, and a stepped black lens
// with an orange front ring. Real lens parts are black anodized (prototype photo, fig. 23); the
// CAD's pale green is a false color. Local frame: the lens looks along +z, the housing sits
// behind z = 0, y is up.
//
// "wide": ECAM-P50 with a 5.8 mm lens (Down, Side and Forward WAC cameras). Its size is not
// published; it is proportioned against the Microscopic Camera in fig. 1 [EST].
// "medium": ECAM-P50 with the 12.6 mm lens (Forward MAC). In fig. 1 the bodies and barrels look
// alike from every angle; one lens alone carries a black flared hood. The MAC is the only camera
// with a different lens, so the hood is drawn on it: an inference, not stated in the paper [EST].
// "navcam": the redundant Navigation Cameras, which MSSS builds but which connect directly to the
// spacecraft. Fig. 1 draws them with a wider pale-yellow ribbed top plate (their mounting
// interface, bolted at the corners) instead of feet [EST size, same body as the P50].
// "microscope": ECAM-L50 with the custom focus mechanism. Its instrument volume, 105 x 155 x 90
// mm, and mass, 1,040 g, are published (table 1) [PUB]; the split between housing, lens and
// motor is [EST].
export const ecamSizes = Object.freeze({
  wide: Object.freeze({ housing: [0.062, 0.062, 0.055], lensLength: 0.044, lensRadius: 0.019, glassRadius: 0.015 }),
  medium: Object.freeze({ housing: [0.062, 0.062, 0.055], lensLength: 0.044, lensRadius: 0.019, glassRadius: 0.015, hood: true }),
  navcam: Object.freeze({ housing: [0.062, 0.062, 0.055], lensLength: 0.044, lensRadius: 0.019, glassRadius: 0.015, topPlate: true }),
  microscope: Object.freeze({ housing: [0.085, 0.09, 0.07], lensLength: 0.085, lensRadius: 0.033, glassRadius: 0.025 }),
});

// Place a camera group at `position` with its lens (+z) aimed at `target` and its top (+y)
// toward `up`, with one sub-group per inspection layer; draws an ECAM head when `kind` is given.
const aim = new THREE.Matrix4();
export function mountEcam({ mesh, parent, name, kind, position, target, up }) {
  const group = new THREE.Group();
  group.name = name;
  group.position.fromArray(position);
  aim.lookAt(new THREE.Vector3(...target), group.position, up);
  group.quaternion.setFromRotationMatrix(aim);
  parent.add(group);
  const layer = (n, inspectionLayer) => {
    const l = new THREE.Group(); l.name = `${name}-${n}`; l.userData.inspectionLayer = inspectionLayer; group.add(l); return l;
  };
  const parts = { group, casing: layer("casing", "equipment-casings"), mounts: layer("mounts", "mounts"),
    connectors: layer("connectors", "interfaces"), harness: layer("harness", "harnesses"),
    window: layer("window", "equipment-covers"), cavity: layer("cavity", "insulation") };
  parts.size = kind ? buildEcamHead({ mesh, kind, ...parts }) : null;
  return parts;
}

export function buildEcamHead({ mesh, kind, casing, mounts, connectors, harness }) {
  const size = ecamSizes[kind];
  const [W, H, D] = size.housing;
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.55, metalness: 0.35 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x3a3f43, roughness: 0.6, metalness: 0.3 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xd9752a, roughness: 0.5, metalness: 0.2 });
  const lensBlack = new THREE.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.4, metalness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fd3e3, roughness: 0.08, metalness: 0.2 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb0b7bb, roughness: 0.35, metalness: 0.75 });
  const flex = new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.6, metalness: 0.1 });
  const box = (s, at, m, t, name) => { const p = mesh(new THREE.BoxGeometry(...s), m, at, t); p.name = name; return p; };
  const disc = (r, len, z, m, t, name, y = 0, sides = 24) => {
    const p = mesh(new THREE.CylinderGeometry(r, r, len, sides), m, [0, y, z], t);
    p.rotation.x = Math.PI / 2; p.name = name; return p;
  };

  // Housing: front, middle and back sections with seams between them (fig. 5).
  const sections = kind === "microscope" ? [0.026, 0.022, 0.022] : [0.02, 0.018, 0.017];
  let z = 0;
  sections.forEach((d, i) => {
    box([W, H, d - 0.001], [0, 0, z - d / 2], black, casing, `ecam-${["front", "middle", "back"][i]}-housing`);
    z -= d;
  });
  box([W - 0.004, H - 0.004, D - 0.002], [0, 0, -D / 2], seam, casing, "ecam-housing-core");
  for (const k of [0, 1]) box([0.002, H * 0.8, sections[2 - k] * 0.85], [W / 2 + 0.001, 0, -D + 0.002 + k * 0.022 + sections[2] / 2], orange, casing, "ecam-side-panel");
  if (size.topPlate) {
    // NavCam: pale-yellow ribbed top plate, wider than the body, bolted at its corners.
    const yellow = new THREE.MeshStandardMaterial({ color: 0xe8e2a0, roughness: 0.5, metalness: 0.2 });
    box([W + 0.016, 0.006, D + 0.008], [0, H / 2 + 0.003, -D / 2], yellow, mounts, "navcam-top-plate");
    for (const x of [-W / 6, W / 6]) box([0.003, 0.0015, D + 0.008], [x, H / 2 + 0.0067, -D / 2], seam, mounts, "navcam-plate-groove");
    for (const x of [-1, 1]) for (const zz of [0.002, -D + 0.002]) {
      mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0065, 6), steel, [x * (W / 2 + 0.004), H / 2 + 0.003, zz - 0.004], mounts).name = "navcam-plate-bolt";
    }
    box([0.018, 0.012, 0.008], [0, 0, -D - 0.004], steel, connectors, "ecam-connector");
    box([0.012, 0.03, 0.003], [0, -0.012, -D - 0.0095], flex, harness, "ecam-flex-lead");
  } else {
    // Feet with bolts at the base.
    for (const side of [-1, 1]) {
      box([0.012, 0.005, D * 0.5], [side * (W / 2 + 0.006), -H / 2 + 0.0025, -D * 0.6], black, mounts, "ecam-foot");
      mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 6), steel, [side * (W / 2 + 0.006), -H / 2 + 0.006, -D * 0.6], mounts).name = "ecam-foot-bolt";
    }
    // Connector on top at the back, with the flex harness leaving it.
    box([0.018, 0.008, 0.012], [0, H / 2 + 0.004, -D + 0.012], steel, connectors, "ecam-connector");
    box([0.012, 0.003, 0.03], [0, H / 2 + 0.0095, -D - 0.008], flex, harness, "ecam-flex-lead");
  }

  // Lens: stepped black barrel with a ring of screws, orange front ring and the glass.
  const L = size.lensLength, R = size.lensRadius;
  disc(R * 0.95, L * 0.28, L * 0.14, lensBlack, casing, "ecam-lens-rear");
  disc(R * 0.8, L * 0.44, L * 0.5, lensBlack, casing, "ecam-lens-middle");
  for (let i = 0; i < 6; i += 1) {
    const a = i * Math.PI / 3;
    const s = mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.002, 6), steel, [Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, L * 0.5], casing);
    s.rotation.z = a + Math.PI / 2; s.name = "ecam-lens-screw";
  }
  disc(R, L * 0.24, L * 0.84, lensBlack, casing, "ecam-lens-front");
  disc(R * 1.02, L * 0.06, L * 0.97, orange, casing, "ecam-lens-front-ring");
  disc(size.glassRadius, 0.002, L + 0.001, glass, casing, "ecam-lens-glass");
  if (size.hood) {
    const hood = mesh(new THREE.CylinderGeometry(R * 1.5, R * 1.04, 0.016, 28, 1, true), lensBlack, [0, 0, L + 0.008], casing);
    hood.rotation.x = Math.PI / 2; hood.name = "ecam-lens-hood";
    hood.material = lensBlack.clone(); hood.material.side = THREE.DoubleSide;
  }
  if (kind === "microscope") {
    // Focus-mechanism stepper motor under the lens and its blue flex lead (fig. 5) [EST size].
    const motor = disc(0.011, 0.05, L * 0.45, lensBlack, casing, "ecam-focus-motor", -R * 0.75, 16);
    motor.position.x = R * 0.85;
    const lead = new THREE.MeshStandardMaterial({ color: 0x2f5fd0, roughness: 0.6, metalness: 0.1 });
    box([0.014, 0.002, 0.03], [0, -R - 0.024, 0.005], lead, harness, "ecam-focus-flex");
  }
  return { length: D + L + (size.hood ? 0.016 : 0), width: W, height: H };
}
