// Aeroshell, heat shield, parachutes, bridles and descent effects for the arrival sequence
// (timeline in edl.mjs). Published: 4.5 m, 60-degree sphere-cone aeroshell; 8.25 m disk-gap-band
// drogue; 16.7 m ringslot main; heat shield released on the main; lander lowered on a bridle and
// released at ~1 km [PUB, SciTech 2025 EDL overview]. Proportions of the heat-shield nose, backshell,
// canopies and lines, all colors and textures, and the motion effects are artistic [EST].
import * as THREE from "./vendor/three/three.module.min.js";

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, value));

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Deterministic pseudo-random numbers, so textures and effects look the same every visit.
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function speckle(ctx, w, h, count, colors, seed) {
  const rand = seeded(seed);
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 0.6 + rand() * 2.2, 0, TAU);
    ctx.fill();
  }
}

// A soft round blob: glows, haze wisps, smoke and dust all use one of these.
function blobTexture(stops) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [at, color] of stops) gradient.addColorStop(at, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}

// Hidden sprites; each gets its own material copy so opacity and color can vary per sprite.
function sprites(parent, count, material) {
  return Array.from({ length: count }, () => {
    const sprite = new THREE.Sprite(material.clone());
    sprite.visible = false;
    parent.add(sprite);
    return sprite;
  });
}

export function createArrivalHardware(scene, craft, upAxis) {
  const edlGroup = new THREE.Group();
  edlGroup.visible = false;
  scene.add(edlGroup);

  // ---- Materials and textures ----
  // Heat shield: dark ablative tiles with char mottling (u runs around, v from nose to shoulder).
  const shieldTexture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#2a201a";
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 900, ["#3a2c22", "#1c1511", "#46362a"], 7);
    ctx.strokeStyle = "rgba(10, 8, 6, 0.7)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 24; i += 1) { ctx.beginPath(); ctx.moveTo(i / 24 * w, h * 0.18); ctx.lineTo(i / 24 * w, h); ctx.stroke(); }
    for (const v of [0.18, 0.42, 0.66, 0.88]) { ctx.beginPath(); ctx.moveTo(0, v * h); ctx.lineTo(w, v * h); ctx.stroke(); }
  });
  const shieldMaterial = new THREE.MeshStandardMaterial({
    map: shieldTexture, roughness: 0.92, metalness: 0.05, side: THREE.DoubleSide,
    emissive: new THREE.Color(0xff6a1f), emissiveMap: shieldTexture, emissiveIntensity: 0,
  });
  // Backshell: light cork-like thermal protection with panel seams and access panels.
  const backshellTexture = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#cdb99b";
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 2600, ["#bca786", "#d8c6aa", "#b39d7c"], 3);
    ctx.strokeStyle = "rgba(90, 72, 50, 0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i += 1) { ctx.beginPath(); ctx.moveTo(i / 12 * w, 0); ctx.lineTo(i / 12 * w, h); ctx.stroke(); }
    for (const v of [0.3, 0.62]) { ctx.beginPath(); ctx.moveTo(0, v * h); ctx.lineTo(w, v * h); ctx.stroke(); }
    ctx.fillStyle = "rgba(120, 100, 76, 0.45)";
    for (const [x, y] of [[0.07, 0.4], [0.34, 0.12], [0.58, 0.44], [0.83, 0.16]]) ctx.fillRect(x * w, y * h, 0.07 * w, 0.14 * h);
  });
  const backshellMaterial = new THREE.MeshStandardMaterial({ map: backshellTexture, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide });
  const hardwareMaterial = new THREE.MeshStandardMaterial({ color: 0x8e9396, roughness: 0.45, metalness: 0.6 });
  // Canopies: alternating orange and white gores; the ringslot main has open slot rings.
  const goreTexture = (slots) => canvasTexture(512, 512, (ctx, w, h) => {
    const gores = 24;
    for (let i = 0; i < gores; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? "#e8612a" : "#f1e9d8";
      ctx.fillRect(i / gores * w, 0, w / gores + 1, h);
    }
    ctx.strokeStyle = "rgba(60, 40, 30, 0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= gores; i += 1) { ctx.beginPath(); ctx.moveTo(i / gores * w, 0); ctx.lineTo(i / gores * w, h); ctx.stroke(); }
    for (const v of slots) ctx.clearRect(0, v * h, w, h * 0.028);
  });
  const drogueMaterial = new THREE.MeshStandardMaterial({ map: goreTexture([]), roughness: 0.9, side: THREE.DoubleSide, transparent: true });
  const mainMaterial = new THREE.MeshStandardMaterial({ map: goreTexture([0.22, 0.36, 0.5, 0.64, 0.78]), roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 });
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xa89c86 });
  const drogueLineMaterial = new THREE.MeshBasicMaterial({ color: 0xa89c86, transparent: true });
  const unitLine = new THREE.CylinderGeometry(1, 1, 1, 5);
  function line(parent, radius = 0.015, material = lineMaterial) {
    const part = new THREE.Mesh(unitLine, material);
    part.scale.set(radius, 1, radius);
    parent.add(part);
    return part;
  }
  const lineAxis = new THREE.Vector3();
  function stretch(part, from, to, radius = 0.015) {
    lineAxis.subVectors(to, from);
    part.position.addVectors(from, to).multiplyScalar(0.5);
    part.scale.set(radius, Math.max(0.001, lineAxis.length()), radius);
    part.quaternion.setFromUnitVectors(upAxis, lineAxis.normalize());
  }

  // ---- Backshell assembly: backshell, parachutes and lines move together; origin = backshell rim ----
  const backshellAssembly = new THREE.Group();
  edlGroup.add(backshellAssembly);
  const backshellProfile = [[2.25, 0], [2.2, 0.1], [1.9, 0.62], [1.45, 1.32], [1.18, 1.72], [0.98, 1.9], [0.001, 1.9]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  backshellAssembly.add(new THREE.Mesh(new THREE.LatheGeometry(backshellProfile, 64), backshellMaterial));
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(2.24, 0.045, 8, 64), hardwareMaterial);
  rimRing.rotation.x = Math.PI / 2;
  backshellAssembly.add(rimRing);
  // Parachute mortar canister on top, and four thruster pods on the cone.
  const mortar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.46, 24), hardwareMaterial);
  mortar.position.y = 2.13;
  backshellAssembly.add(mortar);
  for (let i = 0; i < 4; i += 1) {
    const angle = i / 4 * TAU + Math.PI / 4;
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.16), hardwareMaterial);
    pod.position.set(Math.cos(angle) * 1.66, 0.95, Math.sin(angle) * 1.66);
    pod.rotation.y = -angle;
    backshellAssembly.add(pod);
  }
  const mortarTop = new THREE.Vector3(0, 2.36, 0);

  // Canopy with its lines, built around the confluence point where the lines meet the riser.
  function parachute({ canopyRadius, opening, band, confluence, riserHeight, material, lines, linesMaterial = lineMaterial }) {
    const group = new THREE.Group();
    group.position.y = confluence;
    backshellAssembly.add(group);
    const canopy = new THREE.Group();
    canopy.position.y = riserHeight - confluence;
    group.add(canopy);
    // Crown vent: a small hole at the top of the canopy.
    canopy.add(new THREE.Mesh(new THREE.SphereGeometry(canopyRadius, 48, 18, 0, TAU, 0.035 * Math.PI, opening - 0.035 * Math.PI), material));
    let skirtY = canopyRadius * Math.cos(opening), skirtR = canopyRadius * Math.sin(opening);
    if (band) {
      // Disk-gap-band: a gap below the disk, then a short cylindrical band.
      const bandMesh = new THREE.Mesh(new THREE.CylinderGeometry(band.radius, band.radius * 1.03, band.height, 48, 1, true), material);
      bandMesh.position.y = skirtY - band.gap - band.height / 2;
      canopy.add(bandMesh);
      skirtY = bandMesh.position.y - band.height / 2;
      skirtR = band.radius * 1.03;
    }
    const lineParts = Array.from({ length: lines }, () => line(group, 0.011, linesMaterial));
    const riser = line(backshellAssembly, 0.03, linesMaterial);
    return { group, canopy, lineParts, riser, skirtY, skirtR, confluence };
  }
  const drogue = parachute({ canopyRadius: 3.6, opening: Math.PI * 0.33, band: { radius: 3.05, height: 1.1, gap: 0.45 }, confluence: 6, riserHeight: 14, material: drogueMaterial, lines: 20, linesMaterial: drogueLineMaterial });
  const main = parachute({ canopyRadius: 8.8, opening: Math.PI * 0.38, confluence: 9, riserHeight: 26, material: mainMaterial, lines: 24 });

  const skirtPoint = new THREE.Vector3(), confluencePoint = new THREE.Vector3(), riserStart = new THREE.Vector3();
  // Poses one parachute: inflation (a slim "bag" blooming open with a small overshoot), gentle
  // breathing, pendulum sway, and its lines stretched from the confluence to the skirt.
  function poseParachute(chute, open, t, visible) {
    chute.group.visible = visible;
    chute.riser.visible = visible;
    if (!visible) return;
    const bloom = Math.min(1.08, open + 0.12 * Math.sin(Math.min(1, open) * Math.PI));
    const breath = 1 + 0.03 * Math.sin(t * 3.9) * open;
    const radial = Math.max(0.06, bloom * breath);
    chute.canopy.scale.set(radial, 1.6 - 0.6 * Math.min(1, open), radial);
    chute.group.rotation.set(0.05 * Math.sin(t * 1.3) * open, 0, 0.05 * Math.sin(t * 1.05 + 1) * open);
    const skirtY = chute.canopy.position.y + chute.skirtY * chute.canopy.scale.y;
    chute.lineParts.forEach((part, index) => {
      const angle = index / chute.lineParts.length * TAU;
      skirtPoint.set(Math.cos(angle) * chute.skirtR * radial, skirtY, Math.sin(angle) * chute.skirtR * radial);
      stretch(part, confluencePoint.set(0, 0, 0), skirtPoint, 0.011);
    });
    stretch(chute.riser, riserStart.copy(mortarTop), confluencePoint.set(0, chute.confluence, 0), 0.03);
  }

  // ---- Heat shield: separate so it can drop and tumble away ----
  const shieldProfile = [];
  const noseRadius = 1.1, apex = -1.25;
  for (let i = 0; i <= 8; i += 1) {
    const a = i / 8 * (Math.PI / 6);
    shieldProfile.push(new THREE.Vector2(noseRadius * Math.sin(a) + (i === 0 ? 0.001 : 0), apex + noseRadius * (1 - Math.cos(a))));
  }
  shieldProfile.push(new THREE.Vector2(2.18, -0.16), new THREE.Vector2(2.23, -0.11), new THREE.Vector2(2.25, -0.05), new THREE.Vector2(2.25, 0));
  const heatShield = new THREE.Mesh(new THREE.LatheGeometry(shieldProfile, 64), shieldMaterial);
  edlGroup.add(heatShield);

  // ---- Entry plasma: shock-layer glow ahead of the shield, a glowing wake behind, sparks, light ----
  const glowTexture = blobTexture([[0, "rgba(255, 236, 190, 1)"], [0.35, "rgba(255, 150, 60, 0.75)"], [1, "rgba(255, 90, 20, 0)"]]);
  const additiveSprite = new THREE.SpriteMaterial({ map: glowTexture, color: 0xffb070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const [plasma] = sprites(edlGroup, 1, additiveSprite);
  plasma.scale.set(9, 9, 1);
  const wake = sprites(edlGroup, 8, additiveSprite);
  const wakeHot = new THREE.Color(0xffd9a0), wakeCool = new THREE.Color(0xc2401a);
  // Ablation sparks shed from the shield shoulder and swept up into the wake.
  const sparkCount = 90;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new THREE.PointsMaterial({ map: glowTexture, color: 0xffc27a, size: 0.55, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  edlGroup.add(sparks);
  const sparkRand = seeded(11);
  const sparkSeeds = Array.from({ length: sparkCount }, () => ({ angle: sparkRand() * TAU, phase: sparkRand(), spread: 0.5 + sparkRand(), rate: 0.9 + sparkRand() * 0.8 }));
  const plasmaLight = new THREE.PointLight(0xff8a3a, 0, 40, 2);
  edlGroup.add(plasmaLight);

  // ---- Descent cues: faint streaks rushing past, and haze wisps drifting up past the capsule ----
  const streakMaterial = new THREE.MeshBasicMaterial({ color: 0xffe0b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const streakCount = 110;
  const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 1, 0.04), streakMaterial, streakCount);
  streaks.frustumCulled = false;
  edlGroup.add(streaks);
  const streakRand = seeded(5);
  const streakSeeds = Array.from({ length: streakCount }, () => {
    const angle = streakRand() * TAU, radius = 8 + streakRand() * 70;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, phase: streakRand(), length: 0.5 + streakRand() };
  });
  const streakMatrix = new THREE.Matrix4(), streakScale = new THREE.Vector3(), streakPosition = new THREE.Vector3(), identity = new THREE.Quaternion();
  const hazeTexture = blobTexture([[0, "rgba(246, 206, 150, 0.85)"], [0.5, "rgba(236, 188, 128, 0.42)"], [1, "rgba(226, 172, 110, 0)"]]);
  const wisps = sprites(edlGroup, 16, new THREE.SpriteMaterial({ map: hazeTexture, transparent: true, opacity: 0, depthWrite: false }));
  const wispRand = seeded(19);
  const wispSeeds = wisps.map(() => {
    const angle = wispRand() * TAU, radius = 35 + wispRand() * 190;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, phase: wispRand(), size: 50 + wispRand() * 110, aspect: 0.45 + wispRand() * 0.3 };
  });
  const wispSpan = 520;

  // ---- Puffs: pyrotechnic smoke at each separation event, and dust from the rotor downwash ----
  const smokeTexture = blobTexture([[0, "rgba(236, 226, 210, 0.9)"], [0.55, "rgba(214, 200, 180, 0.45)"], [1, "rgba(200, 186, 166, 0)"]]);
  const pyroPuffs = sprites(edlGroup, 8, new THREE.SpriteMaterial({ map: smokeTexture, transparent: true, opacity: 0, depthWrite: false }));
  const dustTexture = blobTexture([[0, "rgba(196, 158, 116, 0.95)"], [0.55, "rgba(180, 140, 100, 0.5)"], [1, "rgba(170, 130, 92, 0)"]]);
  const dustPuffs = sprites(edlGroup, 16, new THREE.SpriteMaterial({ map: dustTexture, transparent: true, opacity: 0, depthWrite: false }));

  const bridles = [0, 1, 2].map(() => line(edlGroup, 0.014));
  const lineStart = new THREE.Vector3(), lineEnd = new THREE.Vector3(), puffBase = new THREE.Vector3();

  // e: edlStateAt() output (or null when the sequence is not playing); eye: camera position.
  function poseArrival(e, eye) {
    edlGroup.visible = !!e;
    // The lander is enclosed in the aeroshell until it is lowered out for the pose.
    craft.visible = !e || e.pose > 0.01;
    if (!e) return;
    const t = e.t;
    const lander = craft.position;

    // Backshell: posed, the lander hangs below it; released, it drifts up and away with the main.
    const rise = 4.5 * e.pose + (e.released ? e.separation * 2.6 : 0);
    const drift = e.released ? e.separation * 3.4 : 0;
    backshellAssembly.visible = e.separation < 14;
    backshellAssembly.position.set(lander.x - drift, lander.y - 0.3 + rise, lander.z + drift * 0.4);
    backshellAssembly.rotation.y = craft.rotation.y;
    // Under a canopy the whole assembly swings a little.
    const swing = e.chute === "none" ? 0 : 0.035;
    const snatch = e.pyro && (e.pyro.kind === "drogue" || e.pyro.kind === "main") ? 0.12 * (1 - e.pyro.age / 1.5) ** 2 * Math.sin(e.pyro.age * 7) : 0;
    backshellAssembly.rotation.x = swing * Math.sin(t * 0.9) + snatch;
    backshellAssembly.rotation.z = swing * Math.cos(t * 0.75);
    backshellAssembly.updateMatrixWorld();

    // Parachutes: the drogue opens, then is cut away (flying up, off and fading) as it pulls out the main.
    const drogueAway = e.drogueAway ?? -1;
    poseParachute(drogue, e.chute === "drogue" ? e.chuteOpen : 1, t, e.chute === "drogue" || (drogueAway >= 0 && drogueAway < 2.5));
    drogueMaterial.opacity = drogueLineMaterial.opacity = drogueAway >= 0 ? clamp01(1 - drogueAway / 2.5) : 1;
    if (drogueAway >= 0) {
      drogue.group.position.set(-drogueAway * 6, drogue.confluence + drogueAway * 14 + drogueAway ** 2 * 3, drogueAway * 3);
      drogue.group.rotation.z += drogueAway * 0.5;
      drogue.riser.visible = false;
    } else drogue.group.position.set(0, drogue.confluence, 0);
    poseParachute(main, e.chute === "main" ? e.chuteOpen : 0, t, e.chute === "main");

    // Heat shield: attached until separation, then it drops away, drifting and tumbling.
    const fall = 0.5 * 5 * e.heatShieldDrop ** 2;
    heatShield.visible = e.heatShieldDrop < 6;
    heatShield.position.set(lander.x + e.heatShieldDrop * 1.2, lander.y - 0.3 - fall, lander.z - e.heatShieldDrop * 0.6);
    heatShield.rotation.set(e.heatShieldDrop * 0.9, craft.rotation.y, e.heatShieldDrop * 0.4);

    // Entry plasma: flickering glow ahead of the shield, a tapering wake above, sparks, warm light.
    const flicker = 0.85 + 0.15 * Math.sin(t * 37) * Math.sin(t * 23 + 1);
    const glow = e.glow * flicker;
    const hot = glow > 0.01;
    plasma.visible = hot;
    plasma.position.set(lander.x, lander.y - 2.2, lander.z);
    plasma.material.opacity = 0.9 * glow;
    wake.forEach((sprite, index) => {
      sprite.visible = hot;
      if (!hot) return;
      const u = index / (wake.length - 1);
      const jitter = 0.3 * Math.sin(t * 17 + index * 2.1) * u;
      sprite.position.set(lander.x + jitter, lander.y + 1.5 + u * u * 40, lander.z + jitter * 0.6);
      const size = 7.5 * (1 - u * 0.55) * (0.95 + 0.1 * Math.sin(t * 29 + index));
      sprite.scale.set(size, size * 1.3, 1);
      sprite.material.color.copy(wakeHot).lerp(wakeCool, u);
      sprite.material.opacity = 0.6 * (1 - u) ** 1.5 * glow;
    });
    sparks.visible = glow > 0.05;
    sparkMaterial.opacity = Math.min(1, glow * 1.3);
    if (sparks.visible) {
      sparkSeeds.forEach((seed, index) => {
        const life = (t * seed.rate + seed.phase) % 1;
        const radius = 2.2 + life * 3 * seed.spread;
        sparkPositions[index * 3] = lander.x + Math.cos(seed.angle) * radius;
        sparkPositions[index * 3 + 1] = lander.y - 0.2 + life * 30;
        sparkPositions[index * 3 + 2] = lander.z + Math.sin(seed.angle) * radius;
      });
      sparkGeometry.attributes.position.needsUpdate = true;
    }
    shieldMaterial.emissiveIntensity = 1.6 * glow;
    plasmaLight.position.set(lander.x, lander.y - 2.5, lander.z);
    plasmaLight.intensity = 60 * glow;

    // Streaks rush upward past the capsule, faster and longer the faster it falls.
    const cue = e.speedCue ?? 0;
    streaks.visible = cue > 0.5 && e.altitudeM > 1500;
    streakMaterial.opacity = 0.32 * clamp01((cue - 0.5) * 2);
    if (streaks.visible) {
      const length = 1 + cue * 6, travel = t * (20 + cue * 140);
      streakSeeds.forEach((seed, index) => {
        const y = ((seed.phase * 160 + travel) % 160) - 80;
        streakPosition.set(lander.x + seed.x, lander.y + y, lander.z + seed.z);
        streakMatrix.compose(streakPosition, identity, streakScale.set(1, length * seed.length, 1));
        streaks.setMatrixAt(index, streakMatrix);
      });
      streaks.instanceMatrix.needsUpdate = true;
    }
    // Haze wisps drift up past the capsule as it sinks through the haze; they thin out near the
    // ground and fade before they reach the camera, so they never smear across the view.
    const wispAmount = clamp01((e.altitudeM - 1300) / 1500);
    const wispTravel = t * (10 + cue * 90);
    wisps.forEach((sprite, index) => {
      const seed = wispSeeds[index];
      const u = ((seed.phase * wispSpan + wispTravel) % wispSpan) / wispSpan;
      sprite.position.set(lander.x + seed.x, lander.y + (u - 0.5) * wispSpan, lander.z + seed.z);
      sprite.scale.set(seed.size, seed.size * seed.aspect, 1);
      const nearEye = eye ? clamp01((sprite.position.distanceTo(eye) - seed.size * 0.6) / 60) : 1;
      sprite.material.opacity = 0.45 * wispAmount * Math.sin(u * Math.PI) * nearEye;
      sprite.visible = sprite.material.opacity > 0.005;
    });

    // Pyrotechnic smoke: mortar fire (drogue, main), heat shield release, and lander release.
    const pyro = e.pyro;
    pyroPuffs.forEach((sprite, index) => {
      sprite.visible = !!pyro;
      if (!pyro) return;
      const angle = index / pyroPuffs.length * TAU + index * 0.7;
      const age = pyro.age;
      let spread, rise;
      if (pyro.kind === "drogue" || pyro.kind === "main") {
        puffBase.copy(mortarTop).applyMatrix4(backshellAssembly.matrixWorld);
        spread = 0.6; rise = 3;
      } else if (pyro.kind === "shield") {
        puffBase.set(lander.x + Math.cos(angle) * 2.2, lander.y - 0.3, lander.z + Math.sin(angle) * 2.2);
        spread = 2.4; rise = -0.4;
      } else {
        puffBase.set(lander.x + Math.cos(angle) * 0.5, lander.y + 0.4, lander.z + Math.sin(angle) * 0.5);
        spread = 1.2; rise = 0.6;
      }
      sprite.position.set(puffBase.x + Math.cos(angle) * spread * age, puffBase.y + rise * age, puffBase.z + Math.sin(angle) * spread * age);
      const size = 0.9 + age * 2.6;
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = 0.55 * (1 - age / 1.5) ** 2;
    });

    // Bridles while the lander hangs below the backshell.
    const hanging = e.pose > 0.02 && !e.released;
    bridles.forEach((bridle, index) => {
      bridle.visible = hanging;
      if (!hanging) return;
      const angle = index / 3 * TAU + craft.rotation.y;
      lineStart.set(backshellAssembly.position.x + Math.cos(angle) * 0.9, backshellAssembly.position.y, backshellAssembly.position.z + Math.sin(angle) * 0.9);
      lineEnd.set(lander.x + Math.cos(angle) * 0.2, lander.y + 0.2, lander.z + Math.sin(angle) * 0.2);
      stretch(bridle, lineStart, lineEnd, 0.014);
    });

    // Dust kicked up by the rotor downwash, rolling outward just before and after touchdown.
    const dust = e.touchdownDust ?? 0;
    const dustLevel = 0.5 * clamp01(dust * 2) * (0.35 + 0.65 * (e.rotorSpin ?? 1));
    const groundY = lander.y - 0.86 - e.renderAltitudeM;
    dustPuffs.forEach((sprite, index) => {
      sprite.visible = dustLevel > 0.01;
      if (!sprite.visible) return;
      const angle = index / dustPuffs.length * TAU + (index % 3) * 0.35;
      const radius = 1.5 + dust * (4.5 + (index % 4));
      const size = 1.1 + dust * (1.6 + (index % 3) * 0.5);
      // Centered high enough that the billboard does not cut a hard line into the ground.
      sprite.position.set(lander.x + Math.cos(angle) * radius, groundY + size * 0.5, lander.z + Math.sin(angle) * radius);
      sprite.scale.set(size * 1.5, size, 1);
      // Puffs between the camera and the lander are kept thin so the lander stays in view.
      const front = eye ? (sprite.position.x - lander.x) * (eye.x - lander.x) + (sprite.position.z - lander.z) * (eye.z - lander.z) > 0 : false;
      sprite.material.opacity = dustLevel * (front ? 0.35 : 1) * (0.7 + 0.3 * Math.sin(t * 3 + index));
    });
  }

  return { group: edlGroup, pose: poseArrival };
}
