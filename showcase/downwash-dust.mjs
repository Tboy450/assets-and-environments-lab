// Dust raised by the rotor wash near the ground (strength from downwash.mjs). Soft sprites roll
// outward from under the rotors, rise a little, grow and fade; they stay where they were raised
// as the vehicle moves on. The arrival sequence keeps its own touchdown dust (arrival-hardware).
// Look, counts and speeds are artistic [EST].
import * as THREE from "./vendor/three/three.module.min.js";
import { downwashAtGround } from "./downwash.mjs?v=dev";
import { groundTypeAt } from "./science.mjs?v=dev";
import { terrainSand } from "./titan-terrain.mjs?v=dev";

const TAU = Math.PI * 2;

function dustTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(204, 168, 126, 0.9)");
  gradient.addColorStop(0.55, "rgba(188, 150, 110, 0.45)");
  gradient.addColorStop(1, "rgba(176, 138, 100, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function groundKindAt(x, z) {
  const type = groundTypeAt(x, z);
  if (!type) return "liquid";
  if (type.name.includes("rain-dampened")) return "damp";
  if (type.name.includes("outcrop")) return "outcrop";
  return terrainSand(x, z) > 0.5 ? "dune" : "sand";
}

// parent: the landscape group (hidden in the Mission diagram); heightAt: rendered ground height.
export function createDownwashDust(parent, heightAt) {
  const group = new THREE.Group();
  group.name = "downwash-dust";
  parent.add(group);
  const base = new THREE.SpriteMaterial({ map: dustTexture(), transparent: true, opacity: 0, depthWrite: false });
  const particles = Array.from({ length: 48 }, () => {
    const sprite = new THREE.Sprite(base.clone());
    sprite.visible = false;
    group.add(sprite);
    return { sprite, alive: false, x: 0, z: 0, vx: 0, vz: 0, rise: 0, climb: 0, age: 0, life: 1, size0: 1, size1: 3, peak: 0.4 };
  });
  let lastTime = null, spawnDebt = 0, seed = 1;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const sandTone = new THREE.Color(1, 1, 1), duneTone = new THREE.Color(0.72, 0.6, 0.5);

  function spawn(origin, strength, kind) {
    const particle = particles.find(item => !item.alive);
    if (!particle) return;
    const angle = random() * TAU, start = 1.0 + random() * 1.2, speed = (2.5 + random() * 2.5) * (0.6 + 0.4 * Math.min(1, strength));
    Object.assign(particle, {
      alive: true, age: 0, life: 1.8 + random() * 1.4,
      x: origin.x + Math.cos(angle) * start, z: origin.z + Math.sin(angle) * start,
      vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed,
      rise: 0, climb: 0.3 + random() * 0.6,
      size0: 0.8 + random() * 0.6, size1: 3.2 + random() * 1.8,
      peak: (0.32 + random() * 0.2) * Math.min(1, strength),
    });
    particle.sprite.material.color.copy(kind === "dune" ? duneTone : sandTone);
  }

  // Called once per rendered frame after the vehicle and camera are placed.
  function update(state, origin, eye) {
    const now = state.missionTime || 0;
    const elapsed = lastTime === null ? 0 : now - lastTime;
    const dt = Math.max(0, elapsed);
    lastTime = now;
    if (elapsed < 0 || state.edl) spawnDebt = 0;
    // Age existing dust through the full gap while Mission view or accelerated rest was active.
    for (const particle of particles) {
      if (!particle.alive) continue;
      particle.age += dt;
      if (particle.age >= particle.life || elapsed < 0 || state.edl) { particle.alive = false; continue; }
      const drag = Math.exp(-0.9 * dt);
      particle.x += particle.vx * (1 - drag) / 0.9;
      particle.z += particle.vz * (1 - drag) / 0.9;
      particle.vx *= drag; particle.vz *= drag;
      const riseDrag = Math.exp(-0.5 * dt);
      particle.rise += particle.climb * (1 - riseDrag) / 0.5;
      particle.climb *= riseDrag;
    }
    const kind = groundKindAt(origin.x, origin.z);
    const { strength } = state.edl ? { strength: 0 } : downwashAtGround(state, kind);
    // Emit only a recent frame's dust, never backfill the whole gap at the current position.
    spawnDebt += strength * 36 * Math.min(0.1, dt);
    while (spawnDebt >= 1) { spawn(origin, strength, kind); spawnDebt -= 1; }
    for (const particle of particles) {
      const { sprite } = particle;
      if (!particle.alive) { sprite.visible = false; continue; }
      const u = particle.age / particle.life;
      const size = particle.size0 + (particle.size1 - particle.size0) * Math.sqrt(u);
      sprite.position.set(particle.x, heightAt(particle.x, particle.z) + size * 0.45 + particle.rise, particle.z);
      sprite.scale.set(size * 1.4, size, 1);
      // Keep dust between the camera and the vehicle thin so the vehicle stays visible.
      const front = eye && (particle.x - origin.x) * (eye.x - origin.x) + (particle.z - origin.z) * (eye.z - origin.z) > 0;
      sprite.material.opacity = particle.peak * Math.sin(Math.PI * u) * (front ? 0.4 : 1);
      sprite.visible = true;
    }
  }

  return { group, update, activeCount: () => particles.filter(item => item.alive).length };
}
