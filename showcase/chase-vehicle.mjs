import * as THREE from "./vendor/three/three.module.min.js";
import { inspectionGroups, inspectionModified, inspectionSubassemblies, inspectionSubassembly } from "./vehicle-inspector.mjs?v=dev";
import { createInspectionVisibility, visibleInspectionHardware } from "./inspection-visibility.mjs?v=dev";
import { cameraPose } from "./flight-camera.mjs?v=dev";
import { createTitanTerrain, terrainHeight } from "./titan-terrain.mjs?v=dev";
import { model } from "./flight-model.mjs?v=dev";
import { missionTarget, systemsModel, thermalZoneTemps } from "./mission-systems.mjs?v=dev";
import { thermalRgb } from "./thermal-scale.mjs?v=dev";
import { buildResearchModel } from "./vehicle-research.mjs?v=dev";
import { createArrivalHardware } from "./arrival-hardware.mjs?v=dev";
import { createDownwashDust } from "./downwash-dust.mjs?v=dev";

// options.renderer lets tests drive the full scene without a GPU.
export function createChaseRenderer(options = {}) {
  const renderer = options.renderer || new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 12000);
  const missionCamera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 30);
  const landscape = createTitanTerrain(scene, renderer);
  // Rotor-wash dust near the ground (a child of the landscape, so the Mission diagram hides it).
  const downwashDust = createDownwashDust(landscape.group, landscape.heightAt);
  const craft = new THREE.Group();
  scene.add(craft);
  // Titan: surface light is ~1/1,000 of Earth's, mostly haze-scattered and red/orange, so the sky
  // dome dominates and direct sunlight casts only faint shadows. Colors and intensities are an
  // artistic rendering of that (kept bright enough to read on a phone), not a radiometric model.
  const titanSky = new THREE.Color(0xe3a65e), titanGround = new THREE.Color(0x4d3522);
  const neutralSky = new THREE.Color(0xfff3de), neutralGround = new THREE.Color(0x645045);
  const titanSun = new THREE.Color(0xffc98c), neutralSun = new THREE.Color(0xffeed6);
  const ambient = new THREE.HemisphereLight(titanSky, titanGround, 2.2);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(titanSun, 1);
  sun.position.set(-4, 7, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 260 });
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xdbe8f3, 0);
  fill.position.set(4, 2, 5);
  scene.add(fill);

  const metal = new THREE.MeshStandardMaterial({ color: 0x909b9e, metalness: 0.58, roughness: 0.4 });
  const shell = new THREE.MeshStandardMaterial({ color: 0xd1d6d2, metalness: 0.42, roughness: 0.38 });
  const deck = new THREE.MeshStandardMaterial({ color: 0x343e43, metalness: 0.38, roughness: 0.55 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc79e47, metalness: 0.55, roughness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101c23, metalness: 0.25, roughness: 0.3 });
  const rotors = [];
  // Two switchable vehicle models share the same flight state, rotor speeds and antenna pose:
  // the original demo model and one built from the 2023 NASA/APL lander overview drawings.
  const classicModel = new THREE.Group();
  classicModel.name = "original-model";
  const researchModel = new THREE.Group();
  researchModel.name = "research-model";
  craft.add(classicModel, researchModel);
  let buildTarget = classicModel;

  function mesh(geometry, material, position, parent = buildTarget) {
    const part = new THREE.Mesh(geometry, material);
    part.castShadow = !material.transparent;
    part.receiveShadow = true;
    part.position.set(...position);
    parent.add(part);
    return part;
  }

  function box(width, height, length, position, material = metal) {
    return mesh(new THREE.BoxGeometry(width, height, length), material, position);
  }

  function strut(from, to, radius = 0.026, material = metal) {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const part = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 10), material, start.add(end).multiplyScalar(0.5).toArray());
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return part;
  }

  // The raised rounded enclosure occupies only the forward third of the deck.
  box(1.03, 0.32, 2.2, [0, 0, 0], metal).userData.classicShell = true;
  box(1.01, 0.04, 1.42, [0, 0.18, 0.38], deck).userData.classicShell = true;
  const cabProfile = new THREE.Shape();
  cabProfile.moveTo(-0.53, -0.13);
  cabProfile.lineTo(-0.53, 0.36);
  cabProfile.quadraticCurveTo(-0.53, 0.77, 0, 0.77);
  cabProfile.quadraticCurveTo(0.53, 0.77, 0.53, 0.36);
  cabProfile.lineTo(0.53, -0.13);
  cabProfile.closePath();
  const cab = new THREE.ExtrudeGeometry(cabProfile, {
    depth: 0.56, bevelEnabled: true, bevelThickness: 0.09,
    bevelSize: 0.075, bevelSegments: 4, steps: 1, curveSegments: 16,
  });
  mesh(cab, shell, [0, 0, -1.06]).userData.classicShell = true;
  for (const side of [-1, 1]) {
    box(0.025, 0.036, 2.12, [side * 0.52, 0.17, 0], gold);
    box(0.025, 0.025, 2.1, [side * 0.52, -0.16, 0], gold);
    for (const z of [-0.2, 0.27, 0.76]) {
      box(0.015, 0.23, 0.012, [side * 0.526, 0, z], dark);
      box(0.016, 0.07, 0.16, [side * 0.536, 0.02, z + 0.12], gold);
      for (const y of [-0.105, 0.12]) {
        mesh(new THREE.SphereGeometry(0.012, 6, 4), shell, [side * 0.539, y, z + 0.04]);
      }
    }
    const sensor = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 20), dark, [side * 0.31, 0.06, -1.164]);
    sensor.rotation.x = Math.PI / 2;
    box(0.17, 0.045, 0.27, [side * 0.26, 0.22, 0.75], deck);

    const skidX = side * 0.77;
    strut([skidX, -0.71, -1.24], [skidX, -0.83, -1.07], 0.041);
    strut([skidX, -0.83, -1.07], [skidX, -0.83, 1.17], 0.041);
    strut([skidX, -0.83, 1.17], [skidX, -0.73, 1.31], 0.041);
    for (const z of [-0.65, 0.7]) {
      strut([side * 0.43, -0.12, z], [skidX, -0.81, z + 0.07], 0.034);
    }
  }
  strut([-0.76, -0.66, 0.55], [0.76, -0.66, 0.55], 0.025);
  box(0.23, 0.15, 0.21, [0, -0.26, -0.25], dark);
  // Seen from Titan, Earth stays within ~6 deg of the Sun, so a raised dish aims along the sunlight.
  const earthDirection = new THREE.Vector3(-65, 115, -45).normalize();
  const upAxis = new THREE.Vector3(0, 1, 0), aimLocal = new THREE.Vector3();
  const aimQuaternion = new THREE.Quaternion(), stowedQuaternion = new THREE.Quaternion(), craftInverse = new THREE.Quaternion();
  // High-gain antenna on its motorized arm: stowed low for flight, raised and aimed for downlink.
  function buildAntenna(position, stowedLength, raise, radius = 0.035) {
    const base = new THREE.Group();
    base.position.set(...position);
    buildTarget.add(base);
    const arm = mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), metal, [0, stowedLength / 2, 0], base);
    const head = new THREE.Group();
    base.add(head);
    const pose = (deployed) => {
      const t = deployed * deployed * (3 - 2 * deployed);
      const length = stowedLength + raise * t;
      arm.scale.y = Math.max(0.001, length);
      arm.position.y = length / 2;
      head.position.y = length;
      craftInverse.copy(craft.quaternion).invert();
      aimLocal.copy(earthDirection).applyQuaternion(craftInverse);
      aimQuaternion.setFromUnitVectors(upAxis, aimLocal);
      head.quaternion.slerpQuaternions(stowedQuaternion, aimQuaternion, t);
    };
    return { head, pose };
  }
  const classicAntenna = buildAntenna([0.06, 0.18, 0.35], 0.28, 0.62);
  const dish = mesh(new THREE.SphereGeometry(0.32, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), shell, [0, 0, 0], classicAntenna.head);
  dish.scale.y = 0.23;
  const dishRim = mesh(new THREE.TorusGeometry(0.32, 0.014, 8, 32), metal, [0, 0, 0], classicAntenna.head);
  dishRim.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), gold, [0, 0.1, 0], classicAntenna.head);
  dish.userData.classicShell = true;
  dishRim.userData.classicShell = true;

  const blade = new THREE.Shape();
  blade.moveTo(0.07, -0.055);
  blade.lineTo(0.69, -0.025);
  blade.lineTo(0.70, 0.02);
  blade.lineTo(0.17, 0.115);
  blade.closePath();
  const bladeGeometry = new THREE.ShapeGeometry(blade);
  bladeGeometry.rotateX(-Math.PI / 2);
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xb6bdb6, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide });
  const trails = Array.from({ length: 6 }, (_, index) => new THREE.MeshBasicMaterial({
    color: 0xd9d1b5, transparent: true, opacity: 0.10 * (1 - index / 7),
    depthWrite: false, side: THREE.DoubleSide,
  }));
  for (const x of [-1.24, 1.24]) {
    for (const z of [-0.76, 0.81]) {
      strut([Math.sign(x) * 0.45, 0.08, z * 0.8], [x, 0.32, z], 0.042);
      strut([Math.sign(x) * 0.42, -0.08, z * 0.45], [x, 0.26, z], 0.02);
      strut([x, 0.12, z], [x, 0.77, z], 0.045);
      for (let layer = 0; layer < 2; layer += 1) {
        const y = layer === 0 ? 0.22 : 0.70;
        mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 16), metal, [x, y, z]);
        const rotor = new THREE.Group();
        rotor.position.set(x, y, z);
        buildTarget.add(rotor);
        const direction = layer === 0 ? 1 : -1;
        for (let half = 0; half < model.bladesPerRotor; half += 1) {
          const solid = mesh(bladeGeometry, bladeMaterial, [0, 0, 0], rotor);
          solid.rotation.y = half * Math.PI * 2 / model.bladesPerRotor;
          trails.forEach((material, index) => {
            const ghost = mesh(bladeGeometry, material, [0, 0, 0], rotor);
            ghost.rotation.y = half * Math.PI * 2 / model.bladesPerRotor - direction * (index + 1) * 0.13;
          });
        }
        rotors.push({ rotor, direction, phase: rotors.length * 0.63 });
      }
    }
  }

  // ---- Mock-up interior for the ORIGINAL demo model (Internal and Thermal layers) ----
  // This model is not based on the real Dragonfly design, so its interior is a labeled mock-up:
  // plausible boxes sized to fit its own body (x -/+0.46, y -0.14 to +0.14) and front cab. The
  // parts reuse the simulator's thermal zones so the thermal colors still respond live.
  const mockParts = [];
  const mockSource = "Mock-up for the original demo model; not based on the real Dragonfly design";
  function mockPart(name, thermalZone, label, color) {
    const group = new THREE.Group();
    group.name = `mock-${name}`;
    group.userData = { subsystem: group.name, thermalZone, label: `Mock-up: ${label}`, source: mockSource, color, mock: true };
    classicModel.add(group);
    mockParts.push(group);
    buildTarget = group;
    return new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6 });
  }
  let mockMaterial = mockPart("battery", "battery", "battery pack", 0x6f7d58);
  mesh(new THREE.BoxGeometry(0.7, 0.2, 0.5), mockMaterial, [0, -0.02, 0.55]);
  mockMaterial = mockPart("electronics", "equipment-bay", "flight computers and power boxes", 0x4f9a8f);
  for (const [x, z] of [[-0.25, -0.15], [0.25, -0.15], [0, 0.1]]) mesh(new THREE.BoxGeometry(0.2, 0.18, 0.22), mockMaterial, [x, -0.03, z]);
  mockMaterial = mockPart("drive-electronics", "rde", "rotor drive electronics", 0xa34d4d);
  for (const x of [-0.3, 0.3]) mesh(new THREE.BoxGeometry(0.16, 0.16, 0.2), mockMaterial, [x, -0.03, 0.15]);
  mockMaterial = mockPart("science", "equipment-bay", "science instruments in the front cab", 0xb58a4a);
  for (const x of [-0.18, 0.18]) mesh(new THREE.BoxGeometry(0.25, 0.2, 0.25), mockMaterial, [x, 0.3, -0.8]);
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16), mockMaterial, [0, 0.5, -0.78]);
  mockMaterial = mockPart("cold-store", "cold-attic", "cold sample store", 0x7fb3c9);
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20), mockMaterial, [0, 0.2, -0.98]);
  mockMaterial = mockPart("heat-source", "mmrtg", "heat source (this model has no MMRTG)", 0xd9823f);
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 20), mockMaterial, [0, -0.02, 0.93]).rotation.x = Math.PI / 2;
  mockMaterial = mockPart("air-duct", "warm-duct", "warm-air duct along the floor", 0xc9794a);
  mesh(new THREE.BoxGeometry(0.12, 0.03, 1.9), mockMaterial, [0, -0.125, 0]);
  buildTarget = classicModel;

  // Research model (NASA/APL 2023 design) and its interior: see vehicle-research.mjs.
  const { researchRotors, researchAntenna, subsystems, labeledParts, poseAirflow, poseSampling, rotorDiscMaterial } = buildResearchModel({
    group: researchModel, mesh, strut, metal, deck, gold, buildAntenna, upAxis,
    setTarget: (group) => { buildTarget = group || classicModel; },
    // Earth's direction in the craft frame, for pointing the research model's antenna gimbal.
    earthLocal: (out) => out.copy(earthDirection).applyQuaternion(craftInverse.copy(craft.quaternion).invert()),
  });
  buildTarget = classicModel;

  // ---- Mission-view layers: exterior, internal (see-through shell) and thermal (live colors) ----
  const shellNames = new Set(["fuselage", "attic", "high-gain-antenna"]);
  const inspectionLayers = createInspectionVisibility(subsystems);
  const ghostShell = new THREE.MeshStandardMaterial({ color: 0xd8e3ea, transparent: true, opacity: 0.13, depthWrite: false, roughness: 0.9 });
  const thermalMaterials = new Map();
  function ownerOf(part) {
    if (part.userData.owner === undefined) {
      let owner = part.parent;
      while (owner && !owner.userData.subsystem) owner = owner.parent;
      part.userData.owner = owner || null;
    }
    return part.userData.owner;
  }
  function thermalMaterial(key, celsius, shell) {
    let material = thermalMaterials.get(key);
    if (!material) {
      material = new THREE.MeshLambertMaterial(shell ? { transparent: true, opacity: 0.22, depthWrite: false } : {});
      thermalMaterials.set(key, material);
    }
    const [r, g, b] = thermalRgb(celsius);
    material.color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    return material;
  }
  let appliedLayer = "";
  // which: "research" (NASA 2023 design) or "original" (demo model with a labeled mock-up interior).
  function applyLayer(layer, state, which = "research") {
    const key = `${layer}|${which}`;
    if (key === appliedLayer && layer !== "thermal") return;
    appliedLayer = key;
    const zones = layer === "thermal" ? thermalZoneTemps(state) : null;
    const models = [
      [researchModel, which === "research", (part, owner) => !!part.userData.shell || (!!owner && shellNames.has(owner.name))],
      [classicModel, which === "original", (part) => !!part.userData.classicShell],
    ];
    for (const [root, active, isShell] of models) {
      root.traverse((part) => {
        if (!part.isMesh) return;
        if (!part.userData.baseMaterial) part.userData.baseMaterial = part.material;
        const base = part.userData.baseMaterial;
        if (layer === "exterior" || !active || (!Array.isArray(base) && base.transparent)) { part.material = base; return; }
        const owner = ownerOf(part);
        const shell = isShell(part, owner);
        if (layer === "internal") { part.material = shell ? ghostShell : base; return; }
        const zone = owner?.userData.thermalZone || "exterior-structure";
        part.material = thermalMaterial(`${zone}|${shell}`, zones[zone]?.c ?? systemsModel.ambientC, shell);
      });
    }
    for (const group of Object.values(subsystems)) {
      if (group.userData.layer === "interior") group.visible = layer !== "exterior" && which === "research";
    }
    for (const group of mockParts) group.visible = layer !== "exterior" && which === "original";
    subsystems.airflow.visible = layer === "internal" && which === "research";
  }
  applyLayer("exterior");
  const labelBox = new THREE.Box3(), labelPoint = new THREE.Vector3();
  // Each labeled part gets one fixed anchor in the craft's frame, on its own hardware: the middle of
  // the part if that falls on a mesh, else the middle of its largest mesh (so a pair of units, or a
  // part with separated pieces, is numbered on a real piece rather than empty space between them).
  // Computed once, so the number stays pinned to the same spot as the view or the part moves.
  const meshBox = new THREE.Box3(), craftInverse4 = new THREE.Matrix4();
  function labelAnchor(group) {
    craft.updateMatrixWorld(true);
    labelBox.setFromObject(group);
    const center = labelBox.getCenter(new THREE.Vector3());
    let onMesh = false, largest = null, largestVolume = -1;
    group.traverse((part) => {
      if (!part.isMesh) return;
      meshBox.setFromObject(part);
      if (meshBox.isEmpty()) return;
      if (meshBox.clone().expandByScalar(0.02).containsPoint(center)) onMesh = true;
      const size = meshBox.getSize(labelPoint);
      const volume = Math.max(size.x, 0.01) * Math.max(size.y, 0.01) * Math.max(size.z, 0.01);
      if (volume > largestVolume) { largestVolume = volume; largest = meshBox.getCenter(new THREE.Vector3()); }
    });
    const anchor = onMesh || !largest ? center : largest;
    return anchor.applyMatrix4(craftInverse4.copy(craft.matrixWorld).invert());
  }

  // Arrival-sequence hardware: see arrival-hardware.mjs.
  const { group: edlGroup, pose: poseArrival } = createArrivalHardware(scene, craft, upAxis);

  let width = 0;
  let height = 0;
  let renderView = "";
  const inspectionCenter = new THREE.Vector3(0, -0.15, 0);
  let inspectionHeight = null, inspectionTime = null, inspectionReset = -1;
  // Where each model's skids touch the ground (craft frame: x right, -z forward), for slopes.
  const skidFootprints = {
    research: { halfWidth: 0.75, front: -1.3, rear: 1.02 },
    original: { halfWidth: 0.77, front: -1.07, rear: 1.17 },
  };

  function setAttitude(state) {
    craft.rotation.set(-state.pitch * model.pitchRadians, -state.heading * Math.PI / 180, -state.roll * model.rollRadians, "YXZ");
    craft.updateMatrix();
    const research = state.vehicleModel !== "original";
    researchModel.visible = research;
    classicModel.visible = !research;
    (research ? researchAntenna : classicAntenna).pose(state.antennaDeploy || 0);
    (research ? researchRotors : rotors).forEach(({ rotor, phase }, index) => {
      rotor.rotation.y = (state.rotorPhase?.[index] || 0) + phase;
    });
    const blur = Math.min(1, (state.rotorRpm?.[0] || 0) / 700);
    trails.forEach((material, index) => { material.opacity = 0.10 * (1 - index / 7) * blur; });
    rotorDiscMaterial.opacity = 0.3 * Math.max(0, blur - 0.15) / 0.85;
    poseSampling(state);
  }
  return {
    models: { original: classicModel, research: researchModel },
    subsystems, mockParts, downwashDust, inspectionLayers,
    // view.layer: "exterior" (default), "internal" or "thermal".
    // Returns the on-screen position of each labeled part for the layer's callouts.
    drawMission(ctx, w, h, state, view = {}) {
      const layer = view.layer || "exterior";
      if (w !== width || h !== height || renderView !== "mission") {
        renderer.setSize(w, h, false);
        width = w;
        height = h;
        renderView = "mission";
      }
      const background = scene.background, fog = scene.fog;
      scene.background = null;
      scene.fog = null;
      // The mission view is a neutral engineering portrait of the vehicle, not a Titan scene.
      ambient.color.copy(neutralSky); ambient.groundColor.copy(neutralGround); sun.color.copy(neutralSun);
      ambient.intensity = 2.5;
      sun.intensity = 3.2;
      fill.intensity = 1.4;
      landscape.group.visible = false;
      edlGroup.visible = false;
      craft.visible = true;
      renderer.shadowMap.enabled = false;
      craft.position.set(0, 0, 0);
      setAttitude(state);
      sun.position.set(-4, 7, -3);
      sun.target.position.set(0, 0, 0);
      const layered = layer !== "exterior";
      const which = state.vehicleModel === "original" ? "original" : "research";
      if (layered) {
        // Fixed three-quarter view with the nose to the left, like the published thermal figures.
        researchModel.visible = which === "research";
        classicModel.visible = which === "original";
        craft.rotation.set(0, Math.PI / 2, 0);
        craft.updateMatrixWorld(true);
        poseAirflow(state.missionTime || 0, state);
        trails.forEach((material) => { material.opacity = 0; }); // no rotor blur over the diagram
        rotorDiscMaterial.opacity = 0;
      }
      applyLayer(layer, state, which);
      poseSampling(state, which === "research" ? layer : "exterior");
      // The original model's rotors sit on tall posts, so its layered views are framed wider.
      const layeredScale = which === "original" ? 1.25 : 1;
      let halfHeight = layered ? Math.max(1.75, 2.35 * h / w) * layeredScale : Math.max(3.4, 3.0 * h / w);
      const inspector = layered && which === "research" ? view.inspector : null;
      const focusName = inspector && subsystems[view.focusPart] ? view.focusPart : null;
      const subassembly = focusName ? inspectionSubassembly(subsystems[focusName], inspector) : null;
      const modified = inspector && inspectionModified(inspector, focusName);
      const visibility = new Map();
      if (inspector) {
        craft.updateMatrixWorld(true);
        const center = new THREE.Vector3(0, -0.15, 0);
        const groups = inspectionGroups(focusName);
        if (focusName) {
          const bounds = new THREE.Box3();
          if (subassembly) bounds.setFromObject(subassembly);
          else for (const name of groups) if (subsystems[name]) bounds.union(new THREE.Box3().setFromObject(subsystems[name]));
          bounds.getCenter(center);
          // A bounding sphere keeps the entire selected assembly framed at every orbit angle.
          const radius = Math.max(0.22, bounds.getSize(new THREE.Vector3()).length() / 2);
          halfHeight = radius * 1.35 * Math.max(1, h / w);
        }
        halfHeight /= inspector.zoom;
        const now = view.now ?? 0;
        const dt = inspectionTime === null ? 0 : Math.max(0, Math.min(0.1, (now - inspectionTime) / 1000));
        inspectionTime = now;
        if (inspectionHeight === null || inspectionReset !== inspector.resetSerial || view.reduceMotion) {
          inspectionCenter.copy(center);
          inspectionHeight = halfHeight;
        } else {
          const amount = 1 - Math.exp(-dt * 10);
          inspectionCenter.lerp(center, amount);
          inspectionHeight += (halfHeight - inspectionHeight) * amount;
        }
        inspectionReset = inspector.resetSerial;
        halfHeight = inspectionHeight;
        if (focusName && inspector.isolate) {
          for (const group of Object.values(subsystems)) {
            visibility.set(group, group.visible);
            group.visible = group.visible && groups.includes(group.name);
          }
          if (subassembly) for (const child of inspectionSubassemblies(subsystems[focusName])) {
            visibility.set(child, child.visible);
            child.visible = child.visible && child === subassembly;
          }
        }
      } else { inspectionHeight = null; inspectionTime = null; }
      Object.assign(missionCamera, { left: -halfHeight * w / h, right: halfHeight * w / h, top: halfHeight, bottom: -halfHeight });
      if (layered) missionCamera.position.set(1.6, 5.2, 7.2);
      else missionCamera.position.set(0, 8, 3.5);
      missionCamera.lookAt(0, layered ? (which === "original" ? 0.1 : -0.15) : 0, 0);
      if (inspector) {
        const horizontal = Math.cos(inspector.elevation) * 9.12;
        missionCamera.position.set(Math.sin(inspector.azimuth) * horizontal, Math.sin(inspector.elevation) * 9.12, Math.cos(inspector.azimuth) * horizontal).add(inspectionCenter);
        missionCamera.lookAt(inspectionCenter);
      }
      missionCamera.updateProjectionMatrix();
      if (inspector) inspectionLayers.apply(inspector, visibility);
      try {
        renderer.render(scene, missionCamera);
        if (view.parked && !layered) {
          // Contact shadows use the same projected skid endpoints as the vehicle, so the
          // parked portrait sits on the floor at any aspect ratio instead of floating.
          craft.updateMatrixWorld(true);
          const foot = skidFootprints[which], y = which === "research" ? -0.86 : -0.95;
          const point = new THREE.Vector3();
          ctx.save();
          ctx.strokeStyle = "rgba(30, 38, 43, 0.36)";
          ctx.lineWidth = Math.max(2, h / (halfHeight * 2) * 0.1);
          ctx.lineCap = "round";
          ctx.shadowColor = "rgba(20, 30, 35, 0.5)";
          ctx.shadowBlur = 7;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            for (const [index, z] of [foot.front, foot.rear].entries()) {
              point.set(side * foot.halfWidth, y, z).applyMatrix4(craft.matrixWorld).project(missionCamera);
              const x = (point.x + 1) * w / 2, sy = (1 - point.y) * h / 2;
              if (index === 0) ctx.moveTo(x, sy); else ctx.lineTo(x, sy);
            }
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.drawImage(renderer.domElement, 0, 0, w, h);
        const labels = [];
        if (modified || (inspector && (inspectionCenter.distanceTo(new THREE.Vector3(0, -0.15, 0)) > 0.01))) labels.inspection = true;
        if (layered) {
          craft.updateMatrixWorld(true);
          for (const group of which === "research" ? labeledParts : mockParts) {
            group.userData.labelAnchor ??= labelAnchor(group);
            const anchor = group.name === focusName && subassembly?.userData.labelAnchor
              ? subassembly.userData.labelAnchor : group.userData.labelAnchor;
            labelPoint.copy(anchor).applyMatrix4(craft.matrixWorld).project(missionCamera);
            labels.push({
              name: group.name, label: group.userData.label, source: group.userData.source,
              zone: group.userData.thermalZone, color: group.userData.color, mock: !!group.userData.mock,
              x: (labelPoint.x + 1) / 2 * w, y: (1 - labelPoint.y) / 2 * h, depth: labelPoint.z,
              onCanvas: visibleInspectionHardware(group) && (!focusName || group.name === focusName) && labelPoint.z >= -1 && labelPoint.z <= 1,
            });
          }
          if (which === "research" && !labels.inspection) {
            // Published envelope dimensions for the blueprint backdrop, as on-screen line ends
            // (craft frame: x right, y up, -z forward; skids at y -0.86, top at +0.88).
            const screen = (x, y, z) => {
              labelPoint.set(x, y, z).applyMatrix4(craft.matrixWorld).project(missionCamera);
              return { x: (labelPoint.x + 1) / 2 * w, y: (1 - labelPoint.y) / 2 * h };
            };
            labels.dimensions = [
              { text: "3.85 m", a: screen(0, -1.2, -1.93), b: screen(0, -1.2, 1.93),
                extensions: [[screen(0, -0.9, -1.93), screen(0, -1.28, -1.93)], [screen(0, -0.9, 1.93), screen(0, -1.28, 1.93)]] },
              { text: "1.75 m", a: screen(0, -0.86, -2.25), b: screen(0, 0.88, -2.25),
                extensions: [[screen(0, -0.86, -1.95), screen(0, -0.86, -2.33)], [screen(0, 0.88, -1.95), screen(0, 0.88, -2.33)]] },
              { text: "3.85 m", a: screen(-1.925, -0.86, 2.25), b: screen(1.925, -0.86, 2.25),
                extensions: [[screen(-1.925, -0.86, 0.98), screen(-1.925, -0.86, 2.33)], [screen(1.925, -0.86, 0.98), screen(1.925, -0.86, 2.33)]] },
            ];
          }
        }
        return labels;
      } finally {
        landscape.group.visible = true;
        for (const [group, visible] of visibility) group.visible = visible;
        applyLayer("exterior");
        ambient.color.copy(titanSky); ambient.groundColor.copy(titanGround); sun.color.copy(titanSun);
        fill.intensity = 0;
        scene.background = background;
        scene.fog = fog;
        renderer.shadowMap.enabled = true;
      }
    },
    draw(ctx, w, h, state) {
      const framing = state.edl ? "arrival" : "pilot";
      if (w !== width || h !== height || renderView !== framing) {
        renderView = framing;
        width = w;
        height = h;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Pilot: center the aircraft above the stick deck. Arrival: the deck is hidden, so center
        // the scene in the space above the caption strip along the bottom.
        const flightBottom = h - (w <= 720 ? 235 : Math.min(300, h * 0.4));
        const centerY = framing === "arrival" ? h * 0.42 : (58 + Math.max(138, flightBottom)) / 2;
        camera.setViewOffset(w, h, 0, h / 2 - centerY, w, h);
        camera.updateProjectionMatrix();
      }
      setAttitude(state);
      const pose = state.renderPose || cameraPose(state);
      const x = state.positionX || 0;
      const z = state.positionZ || 0;
      landscape.update(x, z);
      landscape.updateSites(state.scoutedSites || []);
      const target = missionTarget(state);
      const marker = landscape.group.getObjectByName("survey-marker");
      marker.visible = state.mission.phase !== "idle";
      marker.position.set(target.x, landscape.heightAt(target.x, target.z) + 0.08, target.z);
      const sunlight = Math.max(0, Math.cos((state.elapsed || 0) / systemsModel.titanDaySeconds * Math.PI * 2));
      const lightLevel = sunlight * (1 - (state.edl ? 0 : state.weather?.haze || 0) * 0.3);
      // Day: bright orange sky dome, weak direct beam. Night: faint, dim sky (kept visible for play).
      ambient.intensity = 0.35 + lightLevel * 1.85;
      sun.intensity = 0.02 + lightLevel * 0.95;
      landscape.setDaylight(lightLevel, state.edl?.space || 0);
      landscape.setWeather(state.edl ? null : state.weather);
      const altitude = Math.max(0, state.altitude || 0);
      landscape.setHazeAltitude(state.edl ? altitude : 0);
      // Near the ground the vehicle settles onto its skids: the rendered ground under the four skid
      // ends gives a plane, and the vehicle tilts to match it (fully on the ground, fading out by
      // 3 m up). Aloft, follow the smooth analytic terrain so mesh re-centering never shifts it.
      const foot = state.vehicleModel === "original" ? skidFootprints.original : skidFootprints.research;
      const yaw = craft.rotation.y, cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
      const footHeight = (side, along) => landscape.heightAt(x + side * cosYaw + along * sinYaw, z - side * sinYaw + along * cosYaw);
      const left = -foot.halfWidth, right = foot.halfWidth;
      const frontY = (footHeight(left, foot.front) + footHeight(right, foot.front)) / 2;
      const rearY = (footHeight(left, foot.rear) + footHeight(right, foot.rear)) / 2;
      const leftY = (footHeight(left, foot.front) + footHeight(left, foot.rear)) / 2;
      const rightY = (footHeight(right, foot.front) + footHeight(right, foot.rear)) / 2;
      const length = foot.rear - foot.front;
      const meshGround = frontY + (rearY - frontY) * -foot.front / length; // the plane under the craft origin
      const groundY = meshGround + (terrainHeight(x, z) - meshGround) * Math.min(1, altitude / 8);
      const settle = 1 - Math.min(1, altitude / 3);
      craft.rotation.x += Math.atan2(frontY - rearY, length) * settle;
      craft.rotation.z += Math.atan2(rightY - leftY, 2 * foot.halfWidth) * settle;
      craft.position.set(x, groundY + altitude + 0.86, z);
      sun.position.set(x - 65, groundY + 115, z - 45);
      sun.target.position.set(x, groundY, z);
      const availableHeight = w <= 720 ? Math.max(100, h - 293) : h;
      const baseDistance = Math.max(11.7, 6.4 / camera.aspect, h / availableHeight * 5.5);
      // During the arrival sequence the camera pulls back to frame the aeroshell and parachutes.
      // The free camera's zoom (flight-camera.mjs) scales the distance; the arrival sequence keeps its own.
      const distance = state.edl ? Math.max(baseDistance, state.edl.cameraDistance) : baseDistance * (pose.zoom ?? 1);
      const lookAt = craft.position.clone();
      if (state.edl) lookAt.y += state.edl.lookUp;
      if (state.edl?.pyro) {
        // A brief jolt when a mortar fires or a parachute snatches open.
        const { age, kind } = state.edl.pyro;
        const jolt = (1 - age / 1.5) ** 2 * distance * (kind === "drogue" || kind === "main" ? 0.005 : 0.002);
        lookAt.x += Math.sin(age * 47) * jolt;
        lookAt.y += Math.sin(age * 39 + 1) * jolt;
      }
      camera.position.set(
        x + Math.sin(pose.azimuth) * Math.cos(pose.elevation) * distance,
        lookAt.y + Math.sin(pose.elevation) * distance,
        z + Math.cos(pose.azimuth) * Math.cos(pose.elevation) * distance,
      );
      camera.position.y = Math.max(camera.position.y, landscape.heightAt(camera.position.x, camera.position.z) + 0.3);
      camera.lookAt(lookAt);
      landscape.setSkyDome(state.edl ? camera.position : null);
      poseArrival(state.edl, camera.position);
      downwashDust.update(state, craft.position, camera.position);
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, 0, 0, w, h);
    },
  };
}
