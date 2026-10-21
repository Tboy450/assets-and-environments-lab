import * as THREE from "./vendor/three/three.module.min.js";
import { wonderwallAsset } from "./wonderwall.mjs?v=dev";

// [EST] Enclosure-level reconstruction, not flight CAD. NASA SVS 15003 and SciTech
// 2024 figs. 1/2/11 constrain the warm-side layout; hidden internals remain unmodeled.
const [wallX, wallY, wallZ] = wonderwallAsset.position;
const [portZ, portY] = wonderwallAsset.aperture;
export const dramsAsset = Object.freeze({
  revision: "drams-2026-10-12",
  interfaceCenter: Object.freeze([wallX, wallY + portY, wallZ + portZ]),
  interfaceRadiusM: 0.024,
  bodyBounds: Object.freeze({ min: [0.15, 0.08, -1.54], max: [0.35, 0.45, -0.96] }),
  analysisAnchor: Object.freeze([0.348, wallY + portY, wallZ + portZ]),
});

export function buildDramsAssembly({ parent, mesh }) {
  const assembly = new THREE.Group();
  assembly.name = "drams-instrument-assembly";
  parent.add(assembly);
  Object.assign(parent.userData, { assetRevision: dramsAsset.revision, dimensionConfidence: "EST" });
  const group = (name, inspectionLayer) => {
    const g = new THREE.Group(); g.name = name; g.userData.inspectionLayer = inspectionLayer;
    assembly.add(g); return g;
  };
  const frame = group("drams-mounting-frame", "mounts");
  const cases = group("drams-instrument-casings", "equipment-casings");
  const covers = group("drams-service-covers", "equipment-covers");
  const interfaces = group("drams-warm-interface", "interfaces");
  const plumbing = group("drams-local-lines", "harnesses");
  const silver = new THREE.MeshStandardMaterial({ color: 0xbac1c4, roughness: 0.4, metalness: 0.6 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xd7d8c8, roughness: 0.6, metalness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x343b40, roughness: 0.45, metalness: 0.5 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xc08a34, roughness: 0.47, metalness: 0.42 });
  const box = (size, position, material, target, name) => {
    const part = mesh(new THREE.BoxGeometry(...size), material, position, target);
    part.name = name; return part;
  };
  const cylinderX = (r, length, position, material, target, name) => {
    const part = mesh(new THREE.CylinderGeometry(r, r, length, 40), material, position, target);
    part.rotation.z = Math.PI / 2; part.name = name; return part;
  };
  const tube = (points, radius, material, name) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, "centripetal");
    const part = mesh(new THREE.TubeGeometry(curve, 20, radius, 6, false), material, [0,0,0], plumbing);
    part.name = name;
  };

  box([0.19, 0.008, 0.55], [0.249, 0.086, -1.255], silver, frame, "drams-baseplate");
  for (const x of [0.159, 0.339]) {
    for (const z of [-1.51, -0.997]) box([0.008, 0.30, 0.009], [x, 0.238, z], silver, frame, "drams-frame-upright");
    box([0.008, 0.008, 0.52], [x, 0.39, -1.25], silver, frame, "drams-upper-rail");
  }

  // Instrument bodies are enclosed, not decorative exposed electronics. The removable
  // lids are separate meshes; no invented circuit boards appear when a future view hides them.
  function enclosure(name, center, size, material) {
    const [x,y,z]=center, [w,h,d]=size, t=0.003;
    box([w,t,d],[x,y-h/2+t/2,z],material,cases,`${name}-floor`);
    for(const side of [-1,1]) {
      box([t,h,d],[x+side*(w-t)/2,y,z],material,cases,`${name}-side`);
      box([w-2*t,h,t],[x,y,z+side*(d-t)/2],material,cases,`${name}-end`);
    }
    box([w,t,d],[x,y+h/2+t/2,z],material,covers,`${name}-lid`);
    for(const dx of [-w*0.35,w*0.35])for(const dz of [-d*0.35,d*0.35])
      mesh(new THREE.CylinderGeometry(0.002,0.002,0.0016,6),dark,[x+dx,y+h/2+t+0.0008,z+dz],covers);
  }
  enclosure("drams-electronics",[0.248,0.155,-1.28],[0.168,0.125,0.26],pale);
  enclosure("drams-laser-enclosure",[0.248,0.221,-1.457],[0.156,0.085,0.071],silver);
  enclosure("drams-gc-enclosure",[0.248,0.251,-1.038],[0.16,0.19,0.112],amber);

  const [,cy,cz]=dramsAsset.interfaceCenter;
  cylinderX(0.086,0.15,[0.259,cy,cz],silver,cases,"drams-analyzer-housing");
  for(const x of [0.182,0.335]) {
    cylinderX(0.094,0.007,[x,cy,cz],silver,covers,"drams-analyzer-end-flange");
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      cylinderX(0.0026,0.003,[x+(x<0.2?-0.005:0.005),cy+Math.sin(a)*0.087,cz+Math.cos(a)*0.087],dark,covers,"drams-flange-fastener");
    }
  }
  cylinderX(0.065,0.003,[0.340,cy,cz],pale,covers,"drams-analyzer-end-cover");
  for(const z of [cz-0.04,cz+0.04])box([0.12,0.014,0.009],[0.258,0.225,z],silver,frame,"drams-analyzer-cradle");

  // Coaxial interface fits THROUGH the existing opening. Its radius is deliberately less
  // than the aperture; the local metal parts do not bridge through the insulation mesh.
  cylinderX(dramsAsset.interfaceRadiusM,0.098,[0.127,cy,cz],silver,interfaces,"drams-interface-neck");
  cylinderX(0.038,0.006,[0.121,cy,cz],dark,interfaces,"drams-interface-flange");
  cylinderX(0.034,0.006,[0.117,cy,cz],amber,interfaces,"drams-interface-seal-illustration");

  // Short schematic routes terminate on enclosures. Temporary clean-room test harnesses
  // and large ground-support plumbing from the photographs are not copied into the lander.
  tube([[0.23,0.263,-1.453],[0.22,0.302,-1.447],[0.17,0.346,-1.375],[0.163,cy,cz]],0.003,silver,"drams-laser-interface-route");
  tube([[0.278,0.349,-1.038],[0.279,0.385,-1.12],[0.296,0.385,-1.21],[0.297,0.393,cz]],0.0025,silver,"drams-gc-transfer-route");
  tube([[0.32,0.189,-1.30],[0.332,0.21,-1.37],[0.32,0.228,-1.457]],0.0028,dark,"drams-local-harness");
  for(const z of [-1.31,-1.27,-1.23]) cylinderX(0.005,0.007,[0.336,0.166,z],amber,cases,"drams-connector");

  // Fan casing is diagrammatic: ICES-2023 establishes a DraMS cooling fan, not its CAD.
  cylinderX(0.025,0.016,[0.333,0.13,-1.077],dark,cases,"drams-fan-housing");
  for(const y of [0.117,0.13,0.143])box([0.002,0.002,0.039],[0.342,y,-1.077],silver,covers,"drams-fan-grille");
  return { assembly, frame, cases, covers, interfaces, plumbing };
}
