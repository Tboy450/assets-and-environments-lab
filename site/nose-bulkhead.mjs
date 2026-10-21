import * as THREE from "./vendor/three/three.module.min.js";

// Part 03, provisional. NASA/APL's 2026 structure photos establish silver panel faces,
// perimeter joints/fasteners and local yellow tape; ICES-2023 fig. 3 locates the nose
// partition. They do NOT resolve its complete face, layup or apertures. Preserve the
// old envelope; all detail sizes/layout below are [EST], not recovered flight CAD.
export const noseBulkheadAsset = Object.freeze({
  revision: "nose-bulkhead-provisional-2026-10-19",
  position: Object.freeze([0, -0.13, -1.56]),
  widthM: 0.70, heightM: 0.40, depthM: 0.020,
  faceM: 0.003, edgeM: 0.018, cornerM: 0.012,
  labelAnchor: Object.freeze([0, 0.060, -1.571]),
  status: "provisional-photo-informed-panel",
});

export function buildNoseBulkhead({ parent, mesh }) {
  const A = noseBulkheadAsset;
  const assembly = new THREE.Group();
  assembly.name = "nose-bulkhead-assembly";
  assembly.position.fromArray(A.position);
  parent.add(assembly);
  Object.assign(parent.userData, {
    assetRevision: A.revision, dimensionConfidence: "EST", partialRebuild: true,
    appearanceEvidence: "Real structure photos inform finish/joints only; complete nose face unresolved",
    labelAnchor: new THREE.Vector3(...A.labelAnchor),
  });
  const layer = (name, inspectionLayer) => {
    const g = new THREE.Group(); g.name = `nose-bulkhead-${name}`;
    g.userData.inspectionLayer = inspectionLayer; assembly.add(g); return g;
  };
  const frame = layer("perimeter", "equipment-casings");
  const face = layer("face", "equipment-covers");
  const mounts = layer("mounts", "mounts");
  const silver = new THREE.MeshStandardMaterial({ color: 0xbcc2c5, metalness: 0.72, roughness: 0.38 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x949fa5, metalness: 0.7, roughness: 0.42 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x656e75, metalness: 0.8, roughness: 0.33 });
  const tape = new THREE.MeshStandardMaterial({ color: 0xc7a23f, metalness: 0.08, roughness: 0.62 });
  const box = (name, size, at, material, group) => {
    const p = mesh(new THREE.BoxGeometry(...size), material, at, group); p.name = name; return p;
  };
  // Inspection removes the face representation, not a verified flight access hatch.
  // Do not fill the hidden volume with an invented honeycomb pitch or material stack.
  const W = A.widthM, H = A.heightM, E = A.edgeM;
  const profile = new THREE.Shape(), C = A.cornerM;
  const outline = [[-W/2+C,-H/2],[W/2-C,-H/2],[W/2,-H/2+C],[W/2,H/2-C],
    [W/2-C,H/2],[-W/2+C,H/2],[-W/2,H/2-C],[-W/2,-H/2+C]];
  outline.forEach(([x,y],i) => i ? profile.lineTo(x,y) : profile.moveTo(x,y)); profile.closePath();
  const panel = mesh(new THREE.ExtrudeGeometry(profile, { depth: A.faceM, bevelEnabled: false }),
    silver, [0,0,-A.depthM/2], face); panel.name = "nose-bulkhead-face-sheet";
  for (const x of [-1,1]) box(`nose-bulkhead-side-return-${x}`, [E,H-2*C,A.depthM-A.faceM],
    [x*(W-E)/2,0,A.faceM/2], edge, frame);
  for (const y of [-1,1]) box(`nose-bulkhead-end-return-${y}`, [W-2*E,E,A.depthM-A.faceM],
    [0,y*(H-E)/2,A.faceM/2], edge, frame);
  // A small, explicitly estimated joint pattern, not a replica of as-built hole counts.
  const screw = (x,y) => {
    const head = mesh(new THREE.CylinderGeometry(0.0028,0.0028,0.0015,8), steel,
      [x,y,-A.depthM/2-0.00075], face); head.rotation.x = Math.PI/2;
    head.name = "nose-bulkhead-face-fastener";
  };
  for (const x of [-0.30,-0.20,-0.10,0,0.10,0.20,0.30]) for (const y of [-0.189,0.189]) screw(x,y);
  for (const x of [-0.339,0.339]) for (const y of [-0.12,0,0.12]) screw(x,y);
  for (const x of [-0.325,0.325]) for (const y of [-0.14,0.14]) {
    box("nose-bulkhead-mount-foot", [0.032,0.038,0.008], [x,y,0.014], silver,mounts);
    const bolt = mesh(new THREE.CylinderGeometry(0.003,0.003,0.002,6), steel,[x,y,0.019],mounts);
    bolt.rotation.x=Math.PI/2; bolt.name="nose-bulkhead-mount-fastener";
  }
  for (const x of [-0.25,0.25]) box("nose-bulkhead-identification-tape",[0.024,0.011,0.0003],
    [x,0.187,-0.0102],tape,face);
  return { assembly, frame, face, mounts };
}
