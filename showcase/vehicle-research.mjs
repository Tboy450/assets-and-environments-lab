// NASA/APL design: 2023 thermal layout, refined against the 2024 CAD visualization
// and NASA's 2026 printable-model assembly guide. Detail dimensions remain [EST].
// Built into a group supplied by chase-vehicle.mjs, using its shared part helpers.
import * as THREE from "./vendor/three/three.module.min.js";
import { model } from "./flight-model.mjs?v=dev";
import { samplingSequence } from "./science.mjs?v=dev";
import { buildSampleCarousel } from "./sample-carousel.mjs?v=dev";
import { buildWonderwall } from "./wonderwall.mjs?v=dev";
import { buildDramsAssembly, dramsAsset } from "./drams-assembly.mjs?v=dev";
import { buildFrontierRadio } from "./frontier-radio.mjs?v=dev";
import { buildTwta } from "./twta.mjs?v=dev";
import { buildHgaGimbal, hgaAsset } from "./hga-gimbal.mjs?v=dev";
import { buildBattery } from "./battery.mjs?v=dev";
import { buildNoseSensors } from "./nose-sensors.mjs?v=dev";
import { buildAftBulkhead, aftBulkheadAsset, aftFaceZ, poseMmrtg } from "./aft-bulkhead.mjs?v=dev";
import { buildRotorHead, buildHubPlate, rotorHeadAsset } from "./rotor-heads.mjs?v=dev";
import { buildRotorDriveElectronics } from "./rotor-drive-electronics.mjs?v=dev";
import { buildIem } from "./iem.mjs?v=dev";
import { buildPowerUnits } from "./power-units.mjs?v=dev";
import { buildSideCameras } from "./side-cameras.mjs?v=dev";
import { buildNoseCameras } from "./nose-cameras.mjs?v=dev";
import { buildNoseBulkhead } from "./nose-bulkhead.mjs?v=dev";
import { buildNoseElectronics } from "./nose-electronics.mjs?v=dev";
import { buildDrill, drillAsset } from "./drills.mjs?v=dev";
import { buildSampleLines, buildBlowers } from "./draco-plumbing.mjs?v=dev";
import { buildFans, buildWarmDuct, buildTrimDevice, airLoopPaths, thermalLoopAsset } from "./thermal-loop.mjs?v=dev";

export function buildResearchModel(kit) {
  const { group: researchModel, mesh, strut, metal, deck, gold, upAxis } = kit;
  let buildTarget = researchModel;
  const setBuild = (group) => { buildTarget = group; kit.setTarget(group); };
  // ---- Research model: NASA/APL 2023 lander overview (TFAWS 2023 slide 3; ICES-2020-160 and
  // ICES-2023-389 figure 1). Published: 3.85 x 3.85 x 1.75 m envelope; eight 1.35 m three-blade
  // rotors in four coaxial pairs on side arms, disks R/2 apart; long fuselage with a raised
  // "attic" behind the nose; MMRTG (64 cm across the fins, 66 cm long) at the tail between two
  // stabilizing fins; 0.874 m HGA disc on top plus LGA and MGA; two skids on legs. Body-side
  // drill/feed placement follows the later CAD/print references. Detail dimensions are [EST].
  setBuild(researchModel);
  const researchRotors = [];
  const drillFeeds = [], transferPaths = [];
  const foam = new THREE.MeshStandardMaterial({ color: 0xdcd3c1, metalness: 0.04, roughness: 0.82 });
  const foamSeam = new THREE.MeshStandardMaterial({ color: 0xaea593, metalness: 0.05, roughness: 0.9 });
  const finMaterial = new THREE.MeshStandardMaterial({ color: 0xb39a48, metalness: 0.35, roughness: 0.5 });
  const rtgMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3135, metalness: 0.55, roughness: 0.45 });
  const armMaterial = new THREE.MeshStandardMaterial({ color: 0xc9ccc6, metalness: 0.35, roughness: 0.5 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x0b1318, metalness: 0.6, roughness: 0.15 });

  // Rotor blade: tapered and twisted, with a thin cambered section and a rounded tip, built out
  // to 0.70 units (scaled to the 1.35 m rotor). Chord, twist and thickness are estimated from the
  // 2023 drawings and typical rotor practice [EST]. The leading edge faces -z, the direction a
  // blade moves when its rotor's phase increases; rotors turning the other way mirror it.
  function bladeGeometry() {
    const stations = 22, around = 12, rootR = 0.07, tipR = 0.70;
    const positions = [], indices = [];
    for (let i = 0; i <= stations; i += 1) {
      const s = i / stations;
      const r = rootR + (tipR - rootR) * s;
      let chord = 0.115 - 0.04 * Math.min(1, s / 0.86);
      if (s > 0.86) chord *= 0.12 + 0.88 * Math.sqrt(Math.max(0, 1 - ((s - 0.86) / 0.14) ** 2));
      if (s < 0.08) chord *= 0.55 + 0.45 * (s / 0.08); // slim root cuff into the hub
      const pitch = (17 - 12 * s) * Math.PI / 180;
      const thickness = chord * (0.12 - 0.05 * s);
      const camber = chord * 0.035;
      for (let j = 0; j < around; j += 1) {
        const a = j / around * Math.PI * 2;
        const x = Math.cos(a) * 0.5; // +0.5 trailing edge, -0.5 leading edge
        const y = Math.sin(a) * 0.5 * thickness * (1 - 0.35 * x) + camber * (1 - 4 * x * x);
        const z = (x + 0.25) * chord; // quarter-chord line on the blade axis
        positions.push(r, y * Math.cos(pitch) - z * Math.sin(pitch), z * Math.cos(pitch) + y * Math.sin(pitch));
      }
    }
    for (let i = 0; i < stations; i += 1) {
      for (let j = 0; j < around; j += 1) {
        const a = i * around + j, b = i * around + (j + 1) % around, c = a + around, d = b + around;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  const researchBlade = bladeGeometry();
  // Each rotor is machined in one piece from aluminum (APL; "Revolutionary Rotors" video), so the
  // blades read as bright machined metal.
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xd6d9dc, metalness: 0.5, roughness: 0.33, side: THREE.DoubleSide });
  // Spinning rotors read as a faint disc, denser toward the tips; opacity follows rotor speed.
  const discCanvas = document.createElement("canvas");
  discCanvas.width = discCanvas.height = 256;
  const discPaint = discCanvas.getContext("2d");
  const discShade = discPaint.createRadialGradient(128, 128, 12, 128, 128, 128);
  discShade.addColorStop(0, "rgba(220, 214, 196, 0)");
  discShade.addColorStop(0.2, "rgba(220, 214, 196, 0.35)");
  discShade.addColorStop(0.8, "rgba(226, 220, 204, 0.6)");
  discShade.addColorStop(0.95, "rgba(236, 230, 214, 0.85)");
  discShade.addColorStop(1, "rgba(236, 230, 214, 0)");
  discPaint.fillStyle = discShade;
  discPaint.fillRect(0, 0, 256, 256);
  const discTexture = new THREE.CanvasTexture(discCanvas);
  discTexture.colorSpace = THREE.SRGBColorSpace;
  const rotorDiscMaterial = new THREE.MeshBasicMaterial({ map: discTexture, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const rotorDiscGeometry = new THREE.RingGeometry(0.06, 0.70, 64, 1);
  rotorDiscGeometry.rotateX(-Math.PI / 2);

  function taper(from, to, radiusFrom, radiusTo, material) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const part = mesh(new THREE.CylinderGeometry(radiusTo, radiusFrom, direction.length(), 14), material, start.clone().add(end).multiplyScalar(0.5).toArray());
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return part;
  }

  // A side profile (z forward-negative, y up) extruded across the width with rounded edges.
  function profileBody(points, width, material, bevel = 0.05) {
    const outline = points instanceof THREE.Shape ? points : new THREE.Shape();
    if (Array.isArray(points)) points.forEach(([z, y], index) => (index ? outline.lineTo(z, y) : outline.moveTo(z, y)));
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 18,
    });
    geometry.rotateY(-Math.PI / 2);
    geometry.translate((width - 2 * bevel) / 2, 0, 0);
    return mesh(geometry, material, [0, 0, 0]);
  }

  // Each subsystem owns a thermal zone so all views share the same geometry and readings.
  const subsystems = {};
  function subsystem(name, thermalZone) {
    if (!subsystems[name]) {
      const group = new THREE.Group();
      group.name = name;
      group.userData = { subsystem: name, thermalZone };
      researchModel.add(group);
      subsystems[name] = group;
    }
    setBuild(subsystems[name]);
  }

  // Proportions are measured from the TFAWS 2023 top view (slide 3, rendered at 260 dpi):
  // nose to MMRTG end = 1,260 px = 3.85 m, so 327 px/m (the MMRTG's 203 px = 0.62 m checks
  // against its published 64 cm). Model z = (px - 690) / 327, model x = (py - 355) / 327, with the
  // origin at the rotor-hub center. Use the same mapping to place interior parts from that
  // drawing so the internal layer fits this exterior: fuselage 0.86 m wide from z -1.93 to +1.28,
  // arm roots at z -0.75 / +0.84, rotor hubs at z -/+0.98 and x -/+1.25, skids at x -/+0.75.
  // Fuselage: long, with the underside tapering up at the nose and tail.
  subsystem("fuselage", "insulated-shell");
  // The aft end follows the canted aft bulkhead (aft-bulkhead.mjs, part 16): the foam face leans
  // forward toward the top, parallel to the bulkhead the MMRTG bolts to. The first profile ended in
  // a near-vertical face at z 1.24 (archived in archive/aft-bulkhead-2026-10-15).
  profileBody([[-1.90, -0.05], [-1.78, -0.27], [-1.48, -0.36], [aftFaceZ(-0.36), -0.36], [aftFaceZ(0.10), 0.10], [-1.83, 0.10]], 0.86, foam);
  // The rounded forward cover transitions to a low, flat equipment deck. Its silhouette
  // follows APL's CAD movie and NASA Assembly Guide pp1-3; this is procedural geometry [EST].
  subsystem("attic", "insulated-shell");
  const atticShape = new THREE.Shape();
  atticShape.moveTo(-1.87, 0.04);
  atticShape.bezierCurveTo(-1.90, 0.25, -1.63, 0.51, -1.39, 0.55);
  atticShape.quadraticCurveTo(-1.10, 0.59, -0.80, 0.56);
  atticShape.quadraticCurveTo(-0.73, 0.55, -0.73, 0.49);
  atticShape.lineTo(-0.73, 0.04);
  profileBody(atticShape, 0.87, foam, 0.055).name = "forward-attic-cover";
  subsystem("fuselage", "insulated-shell");
  for (const z of [-0.45, 0.2, 0.84]) mesh(new THREE.BoxGeometry(0.875, 0.5, 0.018), foamSeam, [0, -0.13, z]);
  subsystem("navigation-sensors", "external-sensors");
  for (const x of [-0.22, 0, 0.22]) {
    mesh(new THREE.BoxGeometry(0.108, 0.10, 0.048), armMaterial, [x, -0.11, -1.93]);
    mesh(new THREE.BoxGeometry(0.083, 0.075, 0.016), deck, [x, -0.11, -1.96]);
    const camera = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.018, 16), lens, [x, -0.11, -1.974]);
    camera.rotation.x = Math.PI / 2;
  }
  for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), lens, [side * 0.3, -0.38, -1.78]);
  // Instrument booms: front left and rear right.
  subsystem("instrument-booms", "external-sensors");
  strut([-0.44, -0.08, -1.62], [-0.76, -0.03, -1.9], 0.012, metal);
  mesh(new THREE.SphereGeometry(0.03, 12, 8), gold, [-0.76, -0.03, -1.9]);
  strut([0.43, 0.1, 1.08], [0.64, 0.36, 1.3], 0.012, metal);
  mesh(new THREE.SphereGeometry(0.03, 12, 8), metal, [0.64, 0.36, 1.3]);

  // MMRTG at the tail: core cylinder with eight radial fins, bolted to the canted aft bulkhead and
  // pointing aft and up about 25 degrees (aft-bulkhead.mjs; NASA/APL 2026 photos, APL 2024 CAD).
  // It was level at (0, 0.05, 1.6) before October 15.
  subsystem("mmrtg", "mmrtg");
  const generator = poseMmrtg(new THREE.Group());
  buildTarget.add(generator);
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.66, 24), rtgMaterial, [0, 0, 0], generator).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i += 1) {
    const angle = i / 8 * Math.PI * 2;
    const rib = mesh(new THREE.BoxGeometry(0.02, 0.12, 0.62), rtgMaterial, [Math.cos(angle) * 0.26, Math.sin(angle) * 0.26, 0], generator);
    rib.rotation.z = angle - Math.PI / 2;
  }
  mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 24), metal, [0, 0, -0.34], generator).rotation.x = Math.PI / 2;

  // Two tall stabilizing fins flank the MMRTG and splay outward toward the rear.
  const finOutline = new THREE.Shape();
  finOutline.moveTo(0, -0.22);
  finOutline.lineTo(0.72, -0.22);
  finOutline.lineTo(0.76, 0.62);
  finOutline.quadraticCurveTo(0.74, 0.88, 0.5, 0.88);
  finOutline.lineTo(0.22, 0.86);
  finOutline.closePath();
  const finGeometry = new THREE.ExtrudeGeometry(finOutline, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2, curveSegments: 10 });
  finGeometry.rotateY(-Math.PI / 2);
  subsystem("fins", "exterior-structure");
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * 0.39, 0, 1.2);
    hinge.rotation.set(0, side * 0.14, side * -0.05);
    buildTarget.add(hinge);
    mesh(finGeometry, finMaterial, [side * 0.0125, 0, 0], hinge);
    if (side > 0) {
      mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), gold, [0.06, 0.5, 0.3], hinge).rotation.z = Math.PI / 2; // MGA
    }
  }
  // Low-gain antenna on a boss just ahead of the MMRTG (moved 9 cm forward from z 1.02 on Oct 15
  // so it stays ahead of the tilted MMRTG; position [EST]).
  subsystem("antennas", "antennas");
  mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.12, 16), foam, [0, 0.2, 0.93]);
  mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.08, 10), armMaterial, [0, 0.3, 0.93]);
  mesh(new THREE.SphereGeometry(0.025, 10, 6), armMaterial, [0, 0.35, 0.93]);

  // Flat runners and shaped legs, as in NASA's Assembly Guide pp1-2. The dimensions of
  // these details are estimated; the footprint and ground-contact height stay unchanged.
  const armRoots = [-0.75, 0.84];
  for (const side of [-1, 1]) {
    subsystem("landing-gear", "exterior-structure");
    const skidX = side * 0.75;
    const runner = profileBody([[-1.46, -0.73], [-1.28, -0.85], [1.02, -0.85], [1.17, -0.76],
      [1.15, -0.715], [1.0, -0.785], [-1.27, -0.785], [-1.44, -0.69]], 0.14, armMaterial, 0.009);
    runner.position.x = skidX;
    runner.name = side < 0 ? "port-skid" : "starboard-skid";
    for (const z of armRoots) {
      const legShape = new THREE.Shape();
      [[0.39, -0.28], [0.51, -0.34], [0.59, -0.50], [0.57, -0.56], [0.76, -0.78],
        [0.66, -0.78], [0.50, -0.58], [0.51, -0.51], [0.44, -0.39], [0.37, -0.36]]
        .forEach(([x, y], i) => i ? legShape.lineTo(side * x, y) : legShape.moveTo(side * x, y));
      legShape.closePath();
      mesh(new THREE.ExtrudeGeometry(legShape, { depth: 0.08, bevelEnabled: true,
        bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), metal, [0, 0, z - 0.04]);
      mesh(new THREE.BoxGeometry(0.12, 0.035, 0.16), gold, [skidX, -0.76, z]);
    }
    // DrACO's vertical drill/feed assemblies mount beside the body, above the runners.
    // APL payload cutaway + NASA Assembly Guide p2; two redundant drills are described
    // by NASA's "Playing Lacrosse on Titan". Stowed bit and tube routing are [EST].
    // DrACO Sample Acquisition Drills: see drills.mjs (LPSC 2022 fig. 2; placement from the APL
    // cutaway, NASA printable model and DragonCam fig. 3).
    subsystem("drills", "drills");
    drillFeeds.push(buildDrill({ parent: buildTarget, mesh, side }).carriage);
  }
  // DrACO pneumatic transport: hoses, transfer tubes, carousel flow diverter and return line
  // (draco-plumbing.mjs; LPSC 2022 fig. 1 and schematic). The blowers are built with part 24.
  subsystem("sample-lines", "drills");
  const sampleLines = buildSampleLines({ parent: buildTarget, mesh });
  transferPaths.push(...sampleLines.paths);

  // High-gain antenna: a flat 0.874 m radial-line slot disc, stowed flat on top for flight. Its
  // slotted face is orange Kapton over the slot plate (NASA's June 2026 test-chamber photo; APL's
  // July 2026 arm photo). Read from the full-resolution photo: perpendicular slot pairs on one
  // continuous spiral about 2.7 cm per turn (about 16 turns), each pair turned by half its angle
  // around the disc (theta = phi/2 + 45 degrees to the radius, the classic circularly polarized
  // radial-line-slot layout), so pairs read as L and T shapes on one axis and diagonals on the
  // other, with a herringbone near the rim; slots grow from about 0.9 to 1.7 cm toward the edge; a
  // ring of seven round spots around the feed and a few more scattered (fasteners under the Kapton,
  // [EST]). The two slots of a pair sit side by side along the spiral, which makes the herringbone.
  // Slot count and exact spacing are measured on the photo, not published. It rides the
  // gimbal's arm (hga-gimbal.mjs, part 10), which raises it and points it at Earth.
  const slotCanvas = document.createElement("canvas");
  slotCanvas.width = slotCanvas.height = 1024;
  const slots = slotCanvas.getContext("2d");
  const pxPerM = 512 / 0.437, pitch = 0.027 * pxPerM;
  slots.fillStyle = "#cf7d22";
  slots.fillRect(0, 0, 1024, 1024);
  slots.fillStyle = "#b8691a";
  for (let ring = 0; ring < 6; ring += 1) {
    slots.globalAlpha = 0.08;
    slots.beginPath();
    slots.arc(512, 512, 120 + ring * 70, 0, Math.PI * 2);
    slots.arc(512, 512, 150 + ring * 70, 0, Math.PI * 2, true);
    slots.fill();
  }
  slots.globalAlpha = 1;
  slots.fillStyle = "#93501a";
  // Companion maps drawn with the same slots: roughness (glossy Kapton, matte slots, so the pattern
  // glints as the view turns) and bump (slots slightly recessed).
  const surfaceMap = (background, mark) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const g = canvas.getContext("2d");
    g.fillStyle = background;
    g.fillRect(0, 0, 1024, 1024);
    g.fillStyle = mark;
    return g;
  };
  const roughness = surfaceMap("#5a5a5a", "#e6e6e6"), bump = surfaceMap("#ffffff", "#3c3c3c");
  const slot = (x, y, angle, length) => {
    for (const g of [slots, roughness, bump]) {
      g.save();
      g.translate(x, y);
      g.rotate(angle);
      g.fillRect(-length / 2, -1.9, length, 3.8);
      g.restore();
    }
  };
  for (let phi = 0, r = 0.052 * pxPerM; r < 0.428 * pxPerM; ) {
    const t = (r / pxPerM - 0.05) / 0.38, length = (0.009 + 0.008 * t) * pxPerM, spacing = (0.026 + 0.008 * t) * pxPerM;
    const tilt = phi / 2 + Math.PI / 4;
    for (const [along, out, extra] of [[0, 0, 0], [spacing / 2, pitch / 4, Math.PI / 2]]) {
      const a = phi + along / r, rr = r + out;
      slot(512 + Math.cos(a) * rr, 512 + Math.sin(a) * rr, a + tilt + extra, length);
    }
    phi += spacing / r;
    r = 0.052 * pxPerM + pitch * phi / (Math.PI * 2);
  }
  slots.fillStyle = "#a05c22";
  const spot = (a, rM, size) => { slots.beginPath(); slots.arc(512 + Math.cos(a) * rM * pxPerM, 512 + Math.sin(a) * rM * pxPerM, size, 0, Math.PI * 2); slots.fill(); };
  for (let k = 0; k < 7; k += 1) spot(k / 7 * Math.PI * 2 + 0.3, 0.043, 13);
  for (let k = 0; k < 18; k += 1) spot(k * 2.4, 0.11 + (k % 6) * 0.055, 6);
  const slotTexture = new THREE.CanvasTexture(slotCanvas);
  slotTexture.colorSpace = THREE.SRGBColorSpace;
  const roughnessTexture = new THREE.CanvasTexture(roughness.canvas), bumpTexture = new THREE.CanvasTexture(bump.canvas);
  // Anisotropic filtering keeps the slots sharp at grazing angles (three.js clamps to the GPU limit).
  for (const texture of [slotTexture, roughnessTexture, bumpTexture]) texture.anisotropy = 16;
  const slotFace = new THREE.MeshStandardMaterial({ map: slotTexture, roughnessMap: roughnessTexture, bumpMap: bumpTexture, bumpScale: 0.6, metalness: 0.4, roughness: 1 });
  const dishEdge = new THREE.MeshStandardMaterial({ color: 0xd99a3a, metalness: 0.6, roughness: 0.4 });
  subsystem("high-gain-antenna", "antennas");
  const hgaHead = new THREE.Group();
  hgaHead.name = "hga-dish-head";
  buildTarget.add(hgaHead);
  const dishR = hgaAsset.dishDiameterM / 2;
  mesh(new THREE.CylinderGeometry(dishR, dishR, hgaAsset.dishThicknessM, 64), [dishEdge, slotFace, metal], [0, 0, 0], hgaHead).name = "hga-dish";
  // Launch-lock pin under the dish's aft rim, seated in the lock's cup when stowed.
  const pinLocal = [hgaAsset.launchLock[0], -hgaAsset.dishThicknessM / 2 - 0.01, hgaAsset.launchLock[1] - hgaAsset.stowedDishCenter[2]];
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10), metal, pinLocal, hgaHead).name = "hga-launch-lock-pin";
  let hgaGimbal = null;
  const earthLocal = new THREE.Vector3();
  const researchAntenna = { head: hgaHead, pose: (deployed) => hgaGimbal?.pose(deployed, kit.earthLocal ? kit.earthLocal(earthLocal) : null) };

  // Arms run out from the arm roots, angled slightly toward the ends, to the rotor heads, where a
  // coaxial motor stack (rotor-heads.mjs, from the "Revolutionary Rotors" video and NASA/APL's
  // May 2026 lander-frame photo) carries the upper and lower rotors, 0.36 m apart (about R/2).
  // The first heads (white pods, gold hubs, spinner domes) are archived in
  // archive/rotor-heads-2026-10-15.
  const researchBladeScale = model.rotorDiameterM / 2 / 0.70;
  for (const x of [-1.25, 1.25]) {
    const side = Math.sign(x);
    for (const [index, z] of [-0.98, 0.98].entries()) {
      const root = [side * 0.42, 0.02, armRoots[index]];
      const hub = [x, 0.02, z];
      const fairingEnd = root.map((value, axis) => value + (hub[axis] - value) * 0.22);
      subsystem("arms", "exterior-structure");
      mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.075, 20), foamSeam, [side * 0.46, 0.01, armRoots[index]]).rotation.z = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.085, 20), metal, [side * 0.50, 0.01, armRoots[index]]).rotation.z = Math.PI / 2;
      taper(root, fairingEnd, 0.1, 0.065, armMaterial);
      strut(fairingEnd, hub, 0.036, armMaterial);
      subsystem("motors", "motors");
      buildRotorHead({ parent: buildTarget, mesh, x, z, armRoot: root });
      for (let layer = 0; layer < 2; layer += 1) {
        const y = rotorHeadAsset.rotorY[layer];
        subsystem("rotors", "rotors");
        const rotor = new THREE.Group();
        rotor.position.set(x, y, z);
        rotor.scale.setScalar(researchBladeScale);
        buildTarget.add(rotor);
        const direction = layer === 0 ? 1 : -1;
        for (let blade = 0; blade < model.bladesPerRotor; blade += 1) {
          const solid = mesh(researchBlade, bladeMaterial, [0, 0, 0], rotor);
          solid.rotation.y = blade * Math.PI * 2 / model.bladesPerRotor;
          solid.scale.z = direction; // the leading edge leads in this rotor's direction of turn
        }
        // The rotor's bolted hub plate (one piece with the blades), and the blur disc.
        buildHubPlate({ parent: rotor, mesh, scale: researchBladeScale, material: bladeMaterial });
        mesh(rotorDiscGeometry, rotorDiscMaterial, [0, 0, 0], rotor);
        researchRotors.push({ rotor, direction, phase: researchRotors.length * 0.63 });
      }
    }
  }
  // ---- Interior (shown by the Mission view's Internal and Thermal layers) ----
  // Placement follows the published descriptions and figures, in the same coordinates as the
  // exterior above. Inside the 7.62 cm foam the cavity is about x -/+0.36, y -0.33 to +0.07,
  // and up to y +0.5 under the attic. Sources: ICES-2023-389 (text p2-p7; fig. 3 hot
  // hibernation and fig. 4 end of a leapfrog flight, nose to the left) and TFAWS 2023 slide 3
  // (top view: centerline ducting, fans at the tail). Parts the papers name but do not locate
  // exactly are placed where those figures show them; unnamed boxes are not drawn.
  const labeledParts = [];
  function interiorPart(name, thermalZone, label, source, color, layer = "interior") {
    subsystem(name, thermalZone);
    const group = subsystems[name];
    group.userData.layer = layer;
    group.userData.label = label;
    group.userData.source = source;
    group.userData.color = color;
    labeledParts.push(group);
    return new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6 });
  }
  interiorPart("drills", "drills", "DrACO drill and feed assemblies", "NASA Assembly Guide p2; APL payload cutaway; dimensions illustrative", 0xa9b9b9, "exterior");
  interiorPart("sample-lines", "drills", "DrACO sample-transfer lines: hoses, tubes, flow diverter and return to the blowers", "LPSC 2022 fig. 1 and schematic; NASA Playing Lacrosse on Titan; routes estimated", 0xa9b9b9, "exterior");
  interiorPart("nose-bulkhead", "equipment-bay", "Nose bulkhead (provisional structural panel)", "NASA/APL 2026 structure photos: finish/joints only; ICES-2023 fig. 3: layout; nose face, dimensions and mounting detail unresolved", 0x9aa6ad);
  buildNoseBulkhead({ parent: buildTarget, mesh });
  interiorPart("nose-cameras-inside", "nose-cameras", "Nose cameras: Forward MAC, Forward WAC, two Side Cameras, two NavCams (no active airflow)", "DragonCam paper (Clark et al. 2026) figs. 1-3; ICES-2023 p7; positions and pointing estimated", 0x3d4a52);
  buildNoseCameras({ parent: buildTarget, mesh });
  interiorPart("nose-electronics", "nose-electronics", "Ocellus outer-structure / MIMU family approximations", "NASA MSS2023 p6; Optics2023 p13; related SQRLi hardware; Honeywell June2026; NASA/APL Uranus pp184-185. Estimated structure, exact flight variant/install unconfirmed", 0x5f8fa3);
  buildNoseElectronics({ parent: buildTarget, mesh });
  interiorPart("sample-carousel", "cold-attic", "Cold attic: DrACO sample carousel", "NASA SVS 15003; SciTech 2024 figs. 1-2; 0.36 m drum and placement estimated", 0x7fb3c9);
  const carousel = buildSampleCarousel({ parent: buildTarget, mesh });
  // Only the illustrative flow endpoint changes; the older transfer-line asset is queued separately.
  for (const path of transferPaths) {
    path.points[path.points.length - 1].copy(carousel.inletWorld);
    path.updateArcLengths();
  }
  const sampleMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0x6ef1da, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
  const cupMarker = mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 16), sampleMarkerMaterial, [0, 0, 0], carousel.carrier);
  cupMarker.name = "sample-cup-marker";
  cupMarker.rotation.x = Math.PI / 2;
  cupMarker.renderOrder = 6;
  interiorPart("wonderwall", "cold-attic", "Wonderwall: warm/cold attic interface", "ICES-2023 p7; SciTech 2024 figs. 2, 11; detailed shape and layers estimated", 0xe6e0d0);
  buildWonderwall({ parent: buildTarget, mesh });
  interiorPart("drams", "equipment-bay", "Warm attic: DraMS instrument assembly", "NASA SVS 15003; SciTech 2024 figs. 1-2; casing dimensions and internals estimated", 0xb58a4a);
  buildDramsAssembly({ parent: buildTarget, mesh });
  const analysisMarker = mesh(new THREE.TorusGeometry(0.064, 0.006, 6, 24), sampleMarkerMaterial, dramsAsset.analysisAnchor);
  analysisMarker.name = "sample-analysis-marker";
  analysisMarker.rotation.y = Math.PI / 2;
  analysisMarker.renderOrder = 6;
  interiorPart("rde", "rde", "Rotor drive electronics: provisional enclosure illustration", "ICES-2023 pp5/7: two boxes with internal fans; dimensions, finish, vents and placement estimated; not a flight-hardware replica", 0xa34d4d);
  buildRotorDriveElectronics({ parent: buildTarget, mesh });
  // The durable id stays "hga-actuators"; the part is the whole gimbal: drive, actuators, arm, locks.
  interiorPart("hga-actuators", "cold-actuators", "HGA gimbal: azimuth and elevation actuators, motorized arm and stow locks", "ICES-2023 p2, figs. 1, 3; ICES-2020 p5; APL arm photo, Jul 2026; sizes, arm length and lock positions estimated", 0x4f7fd1, "exterior");
  hgaGimbal = buildHgaGimbal({ parent: buildTarget, mesh, head: hgaHead });
  interiorPart("power-units", "equipment-bay", "Two power switching units (PSUs)", "NASA/APL testing photo, Mar 2026 (two units published); face mapped from the photo, size from standard D-sub sizes, placement estimated", 0x4f9a8f);
  buildPowerUnits({ parent: buildTarget, mesh });
  interiorPart("iem", "equipment-bay", "Integrated electronics module (IEM)", "NASA/APL integration photos, Mar 2026; size from standard Micro-D sizes in the photos, placement estimated", 0x579cae);
  buildIem({ parent: buildTarget, mesh });
  interiorPart("frontier-radio", "equipment-bay", "Frontier X-band radio", "APL photo on NASA's Dragonfly pages; APL papers: 4 x 6 in slices, 2.1 kg; stack width and placement estimated", 0x609a73);
  buildFrontierRadio({ parent: buildTarget, mesh });
  interiorPart("twta", "twta", "100 W X-band TWTA: tube and power conditioner under the top deck", "NASA Dragonfly spacecraft page; ICES-2020 p5; ICES-2023 p7; look and size from published flight TWTAs (NASA/TM-2010-216262, DESCANSO MRO, Stellant); placement estimated", 0xc0643c);
  buildTwta({ parent: buildTarget, mesh });
  interiorPart("battery", "battery", "Battery: 11.5 kWh, 24 cells (GS Yuasa), heat pipes, fans and a phase-change buffer", "Aerospace America 2022; APL; ICES-2022-256 figs. 2-6; ICES-2020 p4; ICES-2023 p5; TFAWS 2023 plan view; cell model, layout and size estimated", 0x6f7d58);
  buildBattery({ parent: buildTarget, mesh });
  interiorPart("aft-bulkhead", "equipment-bay", "Aft bulkhead: canted gold end bulkhead with the MMRTG interface", "NASA/APL photos, Apr and Jun 2026; APL 2024 CAD (cross-reference); tilt measured on the June photo; sizes and pocket layout estimated", 0x9aa6ad);
  buildAftBulkhead({ parent: buildTarget, mesh });
  // Titan air loop (thermal-loop.mjs; TFAWS 2023 slides 3-4 and 7-8, TFAWS 2024, ICES-2023).
  interiorPart("fan", "warm-duct", "Circulation fans A and B: MMRTG-warmed air into the duct, 0.052 kg/s, 15 W allocation", "TFAWS 2023 slides 3, 4, 7, 8; TFAWS 2024 slide 14; ICES-2023 p6; sizes estimated", 0xd9823f);
  const fans = buildFans({ parent: buildTarget, mesh });
  interiorPart("underfloor-duct", "warm-duct", "Under-floor warm duct: fans to the nose, opening into the body below the nose", "TFAWS 2023 slides 3-4; ICES-2023 p2-p3; width from the slide 3 plan view", 0xc9794a);
  buildWarmDuct({ parent: buildTarget, mesh });
  // The durable id stays "trim-chimneys"; the device drawn is the later cold bypass duct.
  interiorPart("trim-chimneys", "trim-device", "Trim device: cold bypass duct under the belly with fore and aft diverter flaps", "TFAWS 2023 slides 4, 7, 8; TFAWS 2024 slides 6-16; section and flap details estimated", 0xb04a9a, "exterior");
  const trimDevice = buildTrimDevice({ parent: buildTarget, mesh });
  let material = interiorPart("battery-sensor", "battery", "Battery temperature sensor: an input to the thermal controller", "TFAWS 2023 (controller inputs); placement illustrative", 0x9fe870);
  mesh(new THREE.SphereGeometry(0.022, 12, 8), material, [0.2, 0.02, 0.72]);
  material = interiorPart("mmrtg-sensor", "mmrtg", "MMRTG fin-root temperature sensor: the other controller input", "TFAWS 2023 (controller inputs); placement illustrative", 0x9fe870, "exterior");
  // Kept on the MMRTG's top fin root when the MMRTG was tilted (part 16); still a placeholder.
  mesh(new THREE.SphereGeometry(0.022, 12, 8), material, new THREE.Vector3(0, 0.22, 0).applyEuler(generator.rotation).add(generator.position).toArray());
  // Externally mounted items described in the same paper, visible in every layer.
  interiorPart("nose-sensors", "external-sensors", "DraGMet: EFIELD / METHAN", "IPM 2025 pp184-187: EFIELD engineering-model photo; METHAN published design and CAPS 2024 slide42 diagram. Exact installation estimated; METHAN NOT photo-matched", 0x6b7278, "exterior");
  buildNoseSensors({ parent: buildTarget, mesh });
  interiorPart("side-cameras", "cold-actuators", "DragonCam lower cameras: Microscopic Camera, LED array, two Down Cameras (in foam cavities)", "DragonCam paper (Clark et al. 2026) figs. 1-3, 5, 12, table 1; brackets and down-camera position estimated", 0xbfb8aa, "exterior");
  buildSideCameras({ parent: buildTarget, mesh });
  interiorPart("drill-blower", "drills", "DrACO blowers: forward and aft centrifugal blowers behind the port forward arm", "LPSC 2022 fig. 1 and schematic; ICES-2023 p5, p7; sizes and layout estimated", 0x8c8f93, "exterior");
  buildBlowers({ parent: buildTarget, mesh });

  // Circulation loop (ICES-2023 p2-p3): MMRTG -> fan -> under-floor duct forward -> into the body
  // below the nose -> aft through the bay -> back into the MMRTG. Arrows move along it at a speed
  // that follows the fan's flow, colored from MMRTG-warm to bay-cool. A share of the flow set by
  // the diverter flaps runs through the exposed cold duct under the belly and comes back cold.
  // The archived first version is in archive/airflow-arrows-v1.
  // Paths follow the fans, warm duct and cold bypass duct (thermal-loop.mjs).
  const { main: airPath, bypass: bypassPath } = airLoopPaths();
  subsystem("airflow", "warm-duct");
  subsystems.airflow.userData.layer = "interior";
  const arrowGeometry = new THREE.ConeGeometry(0.028, 0.08, 8);
  const mainArrows = new THREE.InstancedMesh(arrowGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff }), 40);
  mainArrows.name = "warm-loop-arrows";
  const bypassMax = 20;
  const bypassArrows = new THREE.InstancedMesh(new THREE.ConeGeometry(0.034, 0.095, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), bypassMax);
  bypassArrows.name = "cold-duct-arrows";
  // Drawn over the parts, as on a flow diagram, so the paths through boxes and chimneys show.
  for (const arrows of [mainArrows, bypassArrows]) {
    arrows.frustumCulled = false;
    arrows.material.depthTest = false;
    arrows.renderOrder = 5;
    buildTarget.add(arrows);
  }
  const warm = new THREE.Color(0xff6a2a), bay = new THREE.Color(0xffc45a), cold = new THREE.Color(0x58a8ff);
  const arrowColor = new THREE.Color(), arrowMatrix = new THREE.Matrix4(), arrowQuaternion = new THREE.Quaternion();
  const arrowPoint = new THREE.Vector3(), arrowTangent = new THREE.Vector3(), arrowScale = new THREE.Vector3(1, 1, 1);
  function placeArrow(arrows, index, curve, u) {
    curve.getPointAt(u, arrowPoint);
    curve.getTangentAt(u, arrowTangent);
    arrowQuaternion.setFromUnitVectors(upAxis, arrowTangent);
    arrows.setMatrixAt(index, arrowMatrix.compose(arrowPoint, arrowQuaternion, arrowScale));
  }
  let lastTime = null, mainPhase = 0, bypassPhase = 0, fanPhase = 0;
  // state: gasFlow (kg/s; design 0.052) and effectiveTrim (0-0.4) from mission-systems.mjs. Arrows
  // are slowed for viewing: one lap of the loop takes about 12 s at full flow.
  function poseAirflow(time, state = {}) {
    const dt = lastTime === null ? 0 : Math.min(0.5, Math.max(0, time - lastTime));
    lastTime = time;
    const flow = Math.max(0, (state.gasFlow ?? 0.052) / 0.052);
    const trim = Math.max(0, Math.min(1, (state.effectiveTrim ?? 0) / 0.4));
    mainPhase = (mainPhase + dt * 0.08 * flow) % 1;
    bypassPhase = (bypassPhase + dt * 0.14 * flow) % 1;
    mainArrows.visible = flow > 0.02;
    for (let index = 0; index < mainArrows.count; index += 1) {
      const u = (index / mainArrows.count + mainPhase) % 1;
      placeArrow(mainArrows, index, airPath, u);
      // Warmest leaving the MMRTG, cooling as it gives up heat on the way round.
      mainArrows.setColorAt(index, arrowColor.copy(warm).lerp(bay, Math.min(1, u * 1.4)));
    }
    mainArrows.instanceMatrix.needsUpdate = true;
    mainArrows.instanceColor.needsUpdate = true;
    // Bypass: more arrows the further the flaps are open; they turn cold in the exposed duct.
    const count = flow > 0.02 ? Math.round(bypassMax * trim) : 0;
    bypassArrows.count = count;
    bypassArrows.visible = count > 0;
    for (let k = 0; k < count; k += 1) {
      const u = (k / count + bypassPhase) % 1;
      placeArrow(bypassArrows, k, bypassPath, u);
      bypassArrows.setColorAt(k, arrowColor.copy(warm).lerp(cold, Math.min(1, Math.max(0, (u - 0.15) / 0.3))));
    }
    bypassArrows.instanceMatrix.needsUpdate = true;
    if (bypassArrows.instanceColor) bypassArrows.instanceColor.needsUpdate = true;
    // Diverter flaps open with the trim setting; fan rotors turn with the flow (slowed for viewing).
    const angle = trim * thermalLoopAsset.maxFlapDeg * Math.PI / 180;
    for (const { hinge, dir } of trimDevice.flaps) hinge.rotation.x = dir * angle;
    fanPhase = (fanPhase + dt * 6 * flow) % (Math.PI * 2);
    fans.rotors.forEach((rotor, i) => { rotor.rotation.z = (i ? -1 : 1) * fanPhase; });
    return { flow, trim, bypassArrows: count, flapDegrees: trim * thermalLoopAsset.maxFlapDeg };
  }
  subsystem("sample-flow", "drills");
  subsystems["sample-flow"].userData.layer = "diagram";
  const sampleParticles = Array.from({ length: 8 }, (_, index) => {
    const particle = mesh(new THREE.SphereGeometry(0.022, 8, 6), sampleMarkerMaterial, [0, 0, 0]);
    particle.name = `sample-flow-${index}`;
    particle.renderOrder = 6;
    return particle;
  });
  function poseSampling(state, layer = "exterior") {
    const job = samplingSequence(state);
    // One redundant drill is illustrated; this is not a commanded flight-hardware port choice.
    drillFeeds.forEach((feed, index) => {
      // The carriage slides down the Z-stage; only the bit turns.
      feed.position.y = drillAsset.stowedY - (index === 0 ? job.drillFeed : 0);
      feed.userData.bit.rotation.y = index === 0 ? job.drillAngle : 0;
      sampleLines.hoseParts[index].setFeed(index === 0 ? job.drillFeed : 0);
    });
    carousel.carrier.rotation.y = job.carouselAngle;
    const diagram = layer === "internal";
    subsystems["sample-flow"].visible = diagram && job.id === "transfer";
    sampleParticles.forEach((particle, index) => {
      const u = ((job.elapsed - 10) / 2 + index / sampleParticles.length) % 1;
      particle.position.copy(transferPaths[0].getPointAt((u + 1) % 1));
    });
    cupMarker.visible = diagram && job.active && job.index >= 1;
    // Keep the receiving cup at the tube outlet before moving it toward analysis.
    const receivingAngle = -(state.science?.samples.length ?? 0) * Math.PI / 2;
    const inlet = carousel.inletWorld.clone().sub(carousel.assembly.position);
    cupMarker.position.copy(inlet.applyAxisAngle(upAxis, receivingAngle));
    analysisMarker.visible = diagram && job.id === "analysis";
    analysisMarker.scale.setScalar(1 + 0.12 * Math.sin(job.elapsed * Math.PI * 2));
    return job;
  }
  poseSampling({});
  kit.setTarget(null);
  return { researchRotors, researchAntenna, subsystems, labeledParts, poseAirflow, poseSampling, rotorDiscMaterial };
}
