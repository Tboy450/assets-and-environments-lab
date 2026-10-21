// Ground shape for each campaign planet. Titan reuses the simulator's Ahmakiq Undae terrain
// (titan-terrain.mjs) unchanged; the other worlds are invented landscapes [EST] built from the
// same value-noise approach. Pure functions (three.js is only pulled in by titan-terrain.mjs).
import { terrainHeight } from "../titan-terrain.mjs?v=dev";
import { overLiquid } from "../mission-systems.mjs?v=dev";

function hash(x, z, seed) {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let u = x - ix, v = z - iz;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  const a = hash(ix, iz, seed) * (1 - u) + hash(ix + 1, iz, seed) * u;
  const b = hash(ix, iz + 1, seed) * (1 - u) + hash(ix + 1, iz + 1, seed) * u;
  return a * (1 - v) + b * v;
}

// Fractal noise, roughly 0-1.
function fbm(x, z, seed, octaves = 4) {
  let sum = 0, amplitude = 0.5, frequency = 1, total = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * noise(x * frequency, z * frequency, seed + i * 17);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / total;
}

const smooth = (edge0, edge1, value) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

// liquid: level of standing liquid (m) or null; solidLiquid: frozen, so it counts as ground.
const biomes = {
  desert: {
    liquid: null,
    height(x, z, s) {
      const along = x * Math.cos(0.5) + z * Math.sin(0.5);
      const dunes = 7 * (0.5 + 0.5 * Math.sin(along / 26 + 4 * noise(x / 220, z / 220, s))) ** 2;
      const mesa = smooth(0.63, 0.67, noise(x / 260, z / 260, s + 3)) * 24;
      return 8 * fbm(x / 180, z / 180, s) + dunes * (1 - mesa / 24) + mesa + 0.4 * noise(x / 6, z / 6, s);
    },
  },
  jungle: {
    liquid: 0.6,
    height(x, z, s, base) {
      const river = Math.abs(noise(x / 300, z / 300, s + 5) * 2 - 1);
      return 3 + 18 * fbm(x / 220, z / 220, s) - 10 * (1 - smooth(0, 0.12, river)) + base(x, z, 10);
    },
  },
  ice: {
    liquid: 2, solidLiquid: true,
    height(x, z, s) {
      const ridge = 1 - Math.abs(noise(x / 240, z / 240, s) * 2 - 1);
      return 34 * ridge ** 2.2 + 6 * fbm(x / 90, z / 90, s + 2) + 0.3 * noise(x / 5, z / 5, s);
    },
  },
  volcanic: {
    liquid: 1.2,
    height(x, z, s, base, cones) {
      let h = 2.5 + 6 * fbm(x / 140, z / 140, s) - 4 * (1 - smooth(0.05, 0.2, Math.abs(noise(x / 200, z / 200, s + 9) * 2 - 1)));
      for (const cone of cones) {
        const r = Math.hypot(x - cone.x, z - cone.z) / cone.r;
        if (r < 1) h += cone.h * (1 - r) ** 1.6 - (r < 0.18 ? cone.h * 0.35 * (1 - r / 0.18) : 0);
      }
      return h + base(x, z, 8) + 0.5 * noise(x / 4, z / 4, s);
    },
  },
  storm: {
    liquid: 0,
    height(x, z, s, base) {
      return 30 * (fbm(x / 240, z / 240, s) - 0.53) + 4 * fbm(x / 60, z / 60, s + 4) + base(x, z, 16);
    },
  },
  city: {
    liquid: null,
    height(x, z, s) {
      return Math.floor(fbm(x / 420, z / 420, s) * 3.2) * 4 + 1.2 * fbm(x / 200, z / 200, s + 1);
    },
  },
};

export function createPlanetTerrain(planet) {
  if (planet.biome === "titan") {
    return { biome: "titan", liquid: null, heightAt: (x, z) => terrainHeight(x, z), isLand: (x, z) => !overLiquid(x, z), setPads() {} };
  }
  const biome = biomes[planet.biome] || biomes.desert;
  const seed = (planet.seed || 1) % 997;
  const { centerX = 0, centerZ = 0, half = 420 } = planet.map || {};
  // A rise under the Hive beacon so the first drop never lands in liquid.
  const beach = { x: centerX - half * 0.68, z: centerZ + half * 0.68 };
  const base = (x, z, lift) => lift * Math.exp(-((x - beach.x) ** 2 + (z - beach.z) ** 2) / (150 * 150));
  const cones = [0, 1, 2].map(i => ({
    x: centerX + (hash(i, 1, seed) * 1.6 - 0.8) * half, z: centerZ + (hash(i, 2, seed) * 1.6 - 0.8) * half,
    r: 140 + hash(i, 3, seed) * 80, h: 45 + hash(i, 4, seed) * 35,
  }));
  const raw = (x, z) => biome.height(x, z, seed, base, cones);
  let pads = [];
  const liquid = biome.liquid;
  const terrain = {
    biome: planet.biome, liquid, solidLiquid: !!biome.solidLiquid, cones: planet.biome === "volcanic" ? cones : [],
    raw,
    isLand: (x, z) => liquid === null || biome.solidLiquid || terrain.heightAt(x, z) > liquid + 0.8,
    // Zones get a level pad above any liquid, blended into the surrounding ground.
    setPads(zones) {
      pads = zones.map(zone => {
        const r = zone.radius * 0.8;
        return { x: zone.x, z: zone.z, r, h: Math.max(raw(zone.x, zone.z), liquid === null ? -Infinity : liquid + 1.5) };
      });
    },
    heightAt(x, z) {
      let h = raw(x, z);
      for (const pad of pads) {
        const d = Math.hypot(x - pad.x, z - pad.z);
        if (d < pad.r + 24) {
          const blend = smooth(pad.r, pad.r + 24, d);
          h = pad.h * (1 - blend) + h * blend;
        }
      }
      return h;
    },
  };
  return terrain;
}
