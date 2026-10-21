// Environmental threats for the invasion game: seeded weather fronts, eruptions, lightning and
// solar flares, each announced before it starts. Only the swarm suffers; the locals are used to
// their own weather. Zones the swarm holds give shelter (half weather damage, no flare stun).
// Effects are gameplay multipliers, not physics. No DOM; covered by tests/invasion-battle.test.mjs.
import { nextRandom, randomRange } from "./random.mjs?v=dev";

// warnS: notice before it starts. durationS / gapS: [min, max] seconds. speed, sight, range:
// multipliers while active. damage: health per second outside shelter. wind: push in m/s.
export const hazardTypes = Object.freeze({
  methaneRain: {
    id: "methaneRain", name: "Methane rain", kind: "weather", warnS: 15, durationS: [25, 40], gapS: [50, 90],
    speed: 0.85, sight: 0.75, damage: 0, advice: "Drones slow down a little and see less.",
  },
  gusts: {
    id: "gusts", name: "Gust front", kind: "weather", warnS: 10, durationS: [12, 20], gapS: [40, 80],
    speed: 0.92, wind: 7, damage: 0, advice: "Wind pushes drones off their spots.",
  },
  dustStorm: {
    id: "dustStorm", name: "Dust storm", kind: "weather", warnS: 15, durationS: [25, 45], gapS: [55, 95],
    speed: 0.8, sight: 0.45, range: 0.7, damage: 0.35, wind: 5,
    advice: "Sand wears drones down and shortens their range. Zones you hold give shelter.",
  },
  acidRain: {
    id: "acidRain", name: "Acid rain", kind: "weather", warnS: 15, durationS: [20, 35], gapS: [50, 90],
    sight: 0.8, damage: 0.9, advice: "Corrodes drones. Zones you hold halve the damage.",
  },
  blizzard: {
    id: "blizzard", name: "Blizzard", kind: "weather", warnS: 15, durationS: [25, 45], gapS: [55, 95],
    speed: 0.6, sight: 0.5, damage: 0.3, wind: 6, advice: "Icing slows drones and wears them down.",
  },
  ashCloud: {
    id: "ashCloud", name: "Ash cloud", kind: "weather", warnS: 12, durationS: [20, 35], gapS: [50, 90],
    speed: 0.9, sight: 0.55, damage: 0.25, advice: "Ash clogs rotors and hides the ground.",
  },
  eruption: {
    id: "eruption", name: "Eruption", kind: "eruption", warnS: 8, durationS: [12, 18], gapS: [35, 65],
    radius: 55, damage: 15, advice: "A vent is about to blow: move drones out of the red circle.",
  },
  lightning: {
    id: "lightning", name: "Lightning storm", kind: "storm", warnS: 12, durationS: [20, 30], gapS: [40, 75],
    speed: 0.95, sight: 0.8, strikeEveryS: 3.5, strikeWarnS: 1.8, radius: 10, strikeDamage: 24,
    advice: "Bolts hit where drones bunch up; each spot glows before it lands. Zones you hold halve the damage.",
  },
  solarFlare: {
    id: "solarFlare", name: "Solar flare", kind: "flare", warnS: 15, durationS: [8, 12], gapS: [60, 100],
    advice: "Drones outside your zones are stunned: no firing, no capturing, barely moving.",
  },
});

export const neutralEffects = () => ({ speed: 1, sight: 1, range: 1, damage: 0, wind: { x: 0, z: 0 }, stun: false, zones: [] });

export function createHazardState(holder, planet) {
  const types = (planet.hazards || []).filter(type => hazardTypes[type]);
  // Practice and low-threat planets get calmer skies: longer gaps and gentler damage.
  const calm = planet.practice ? 1.4 : 1;
  const severity = planet.practice ? 0.5 : 0.7 + 0.15 * (planet.threat || 0);
  const next = {};
  // Nothing happens in the first minute, while the first pods are still landing.
  types.forEach((type, index) => {
    const [low] = hazardTypes[type].gapS;
    next[type] = Math.max(60, low * 0.7 * calm) + index * 20 + randomRange(holder, 0, 15);
  });
  return { types, next, events: [], effects: neutralEffects(), calm, severity, serial: 0 };
}

// A spot that threatens the swarm: near a random drone. clearOfBeacon keeps it away from the
// Hive beacon (no vent opens under the landing zone); with no drone to aim at, it falls at a
// random spot of the map.
function threatPoint(b, spread, clearOfBeacon = false) {
  const beacon = b.zones.find(zone => zone.kind === "beachhead");
  const clear = (p) => !clearOfBeacon || !beacon || Math.hypot(p.x - beacon.x, p.z - beacon.z) > beacon.radius + 70;
  const drones = b.units.filter(u => u.alive && u.side === "swarm" && !u.structure && clear(u));
  const angle = nextRandom(b) * Math.PI * 2, distance = nextRandom(b) * spread;
  if (drones.length) {
    const base = drones[Math.floor(nextRandom(b) * drones.length) % drones.length];
    return { x: base.x + Math.cos(angle) * distance, z: base.z + Math.sin(angle) * distance };
  }
  const { centerX, centerZ, half } = b.map;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const point = { x: centerX + randomRange(b, -0.8, 0.8) * half, z: centerZ + randomRange(b, -0.8, 0.8) * half };
    if (clear(point)) return point;
  }
  return { x: centerX, z: centerZ };
}

function startEvent(b, type) {
  const h = b.hazards, def = hazardTypes[type];
  const activeAt = b.time + def.warnS;
  const event = {
    id: ++h.serial, type, name: def.name, kind: def.kind, phase: "warning",
    startedAt: b.time, activeAt, endsAt: activeAt + randomRange(b, ...def.durationS),
    windAngle: nextRandom(b) * Math.PI * 2, nextStrike: activeAt,
  };
  if (def.kind === "eruption") Object.assign(event, threatPoint(b, 30, true), { radius: def.radius });
  h.events.push(event);
  b.stats.hazardEvents += 1;
  b.log.push({ t: b.time, tone: "warn", text: `${def.name} in ${def.warnS} s. ${def.advice}` });
  b.events.push({ kind: "hazard-warning", type, id: event.id, x: event.x, z: event.z });
}

export function stepHazards(b, dt) {
  const h = b.hazards;
  if (!h) return;
  for (const type of h.types) {
    if (!h.events.some(event => event.type === type) && b.time >= h.next[type]) startEvent(b, type);
  }
  for (const event of h.events) {
    if (event.phase === "warning" && b.time >= event.activeAt) {
      event.phase = "active";
      b.events.push({ kind: "hazard-start", type: event.type, id: event.id, x: event.x, z: event.z });
    }
    if (event.phase === "active" && b.time >= event.endsAt) {
      event.phase = "over";
      const [low, high] = hazardTypes[event.type].gapS;
      h.next[event.type] = b.time + randomRange(b, low, high) * h.calm;
      b.log.push({ t: b.time, tone: "info", text: `${event.name} has passed.` });
      b.events.push({ kind: "hazard-end", type: event.type, id: event.id });
    }
    // Lightning: each bolt is aimed at the swarm and marked before it lands.
    if (event.phase === "active" && event.kind === "storm" && b.time >= event.nextStrike) {
      const def = hazardTypes[event.type];
      b.strikes.push({ ...threatPoint(b, 10), radius: def.radius, damage: def.strikeDamage * h.severity, markedAt: b.time, hitAt: b.time + def.strikeWarnS, source: "lightning", hit: false });
      event.nextStrike = b.time + def.strikeEveryS * randomRange(b, 0.7, 1.3);
    }
  }
  h.events = h.events.filter(event => event.phase !== "over");
  const effects = neutralEffects();
  for (const event of h.events) {
    if (event.phase !== "active") continue;
    const def = hazardTypes[event.type];
    effects.speed *= def.speed ?? 1;
    effects.sight *= def.sight ?? 1;
    effects.range *= def.range ?? 1;
    if (def.kind === "weather") effects.damage += (def.damage || 0) * h.severity;
    if (def.wind) { effects.wind.x += Math.cos(event.windAngle) * def.wind; effects.wind.z += Math.sin(event.windAngle) * def.wind; }
    if (def.kind === "flare") effects.stun = true;
    if (def.kind === "eruption") effects.zones.push({ x: event.x, z: event.z, radius: event.radius, damage: def.damage * h.severity });
  }
  h.effects = effects;
}

// The most pressing hazard for the status strip: an active one first, then the next warning.
export function hazardAdvisory(b) {
  const events = b.hazards?.events || [];
  const active = events.find(event => event.phase === "active");
  if (active) return { tone: "active", type: active.type, text: `${active.name}: ${Math.ceil(active.endsAt - b.time)} s left` };
  const warning = events.find(event => event.phase === "warning");
  if (warning) return { tone: "warning", type: warning.type, text: `${warning.name} in ${Math.ceil(warning.activeAt - b.time)} s` };
  return null;
}
