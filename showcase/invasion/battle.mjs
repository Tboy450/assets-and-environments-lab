// One planet invasion: zones to take, the swarm and its drop pods, the planet's defenders, the
// public alarm and the environmental hazards. Plain data and pure steps (no DOM, no three.js),
// so a whole mission can run in a test. All numbers are gameplay choices.
//
// Two ways to take a zone:
//   damage  - destroy its defenses (salvage pays matter, but every kill raises the alarm), then
//             any drone captures quickly;
//   control - Link drones capture even under fire (slower) and calm the public; defenses still
//             standing when the zone falls switch sides and fire for the swarm.
import {
  droneTypes, defenderTypes, societies, droneOrder, dropCooldownS, dropDurationS,
  payloadSlots, payloadCost, payloadCount, weaponFor, reachFor,
} from "./units.mjs?v=dev";
import { nextRandom, randomRange, randomPick } from "./random.mjs?v=dev";
import { createHazardState, stepHazards } from "./hazards.mjs?v=dev";
import { validPayload, packDropPods, planDropLandings, podStaggerS } from "./drop-waves.mjs?v=dev";
import { objectiveText } from './objective-rules.mjs?v=dev';

const zoneRadius = { beachhead: 50, beacon: 42, relic: 40, settlement: 46, mine: 40, capital: 60 };
// Matter per second while the swarm holds the zone.
const zoneValue = { beachhead: 0, beacon: 0.6, relic: 0.3, settlement: 0.5, mine: 1.4, capital: 1 };
const squadColors = ["#7ce7ff", "#ffb457", "#9dff8a", "#ff7ab8", "#c6a6ff", "#ffe066", "#6fffd2", "#ff9466"];
const syllables = ["ka", "ro", "vel", "tan", "mi", "shu", "or", "ze", "li", "dra", "no", "pe", "qua", "ith", "mar", "sol"];
// Spacing between drones in a formation (m); drones are drawn about 4 m across.
const separation = 7;
const healPerS = 1.5;
const salvageMatter = 6;

export const flatTerrain = Object.freeze({ heightAt: () => 0, isLand: () => true });
export const defOf = (unit) => droneTypes[unit.type] || defenderTypes[unit.type];
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const isDrone = (unit) => unit.alive && unit.side === "swarm" && !unit.structure;

// options: seed, unlocks, podSlots, matter (the campaign bank), terrain ({ heightAt, isLand, setPads? }).
export function createBattle(planet, options = {}) {
  const { seed = planet.seed ?? 1, unlocks = ["scout", "link"], podSlots = 12, matter = 160, terrain = flatTerrain } = options;
  const society = societies[planet.society] || societies[0];
  const b = {
    planetId: planet.id, practice: !!planet.practice, threat: planet.threat || 0, tier: society.tier,
    rngState: seed >>> 0, time: 0, paused: false, outcome: null, endTime: null,
    // UI injects a unique attempt ID. Deterministic simulations/tests can supply their own.
    missionId: options.missionId || `simulation-${planet.id}-${seed >>> 0}`,
    victoryAvailable: false, victoryAvailableAt: null, victoryChoiceMade: false,
    map: { centerX: 0, centerZ: 0, half: 420, ...planet.map },
    matter, unlocks: [...unlocks], podSlots, required: planet.required, objectives: planet.objectives || [],
    alarm: 0, alarmStage: 0, zones: [], units: [], squads: [], pods: [], strikes: [],
    events: [], log: [], nextId: 1, lastDropAt: -Infinity,
    reinforceIn: 40, strikeIn: 20, specials: [], refund: 0,
    stats: {
      drops: 0, podsLaunched: 0, dronesDropped: 0, dronesLost: 0, hazardLosses: 0, zonesCaptured: 0, defensesDestroyed: 0,
      militiaDefeated: 0, matterHarvested: 0, hazardEvents: 0, maxAlive: 0, alarmPeak: 0, damageDealt: 0,
    },
    hazards: null,
    // Troops on foot stay on land; drones and interceptors fly over liquid.
    isLand: terrain.isLand,
    heightAt: terrain.heightAt,
    canDropAt: terrain.canDropAt,
  };
  placeZones(b, planet, terrain);
  terrain.setPads?.(b.zones);
  garrison(b, planet, society);
  b.hazards = createHazardState(b, planet);
  b.log.push({ t: 0, tone: "info", text: planet.practice
    ? "Practice planet: call a drop on the Hive beacon, then send drones to the beacons."
    : `${society.name} society, threat ${planet.threat}. Call a drop on the Hive beacon to begin.` });
  return b;
}

function zoneName(b, kind) {
  const word = randomPick(b, syllables) + randomPick(b, syllables) + (nextRandom(b) < 0.4 ? randomPick(b, syllables) : "");
  const name = word[0].toUpperCase() + word.slice(1);
  return kind === "mine" ? `${name} Deposit` : kind === "capital" ? `${name} Citadel` : name;
}

function makeZone(b, spec) {
  const kind = spec.kind;
  const owned = kind === "beachhead";
  return {
    id: spec.id, name: spec.name, kind, x: spec.x, z: spec.z, special: spec.special || null,
    radius: spec.radius || zoneRadius[kind] || 45, value: zoneValue[kind] ?? 0.5,
    control: owned ? 100 : 0, captured: owned, contested: false,
    population: kind === "beachhead" || b.tier === 0 ? 0 : Math.round((kind === "capital" ? 9000 : kind === "mine" ? 600 : 2400) * (0.6 + nextRandom(b) * 0.8) * (1 + b.tier)),
  };
}

function placeZones(b, planet, terrain) {
  if (planet.zones) {
    b.zones = planet.zones.map(spec => makeZone(b, spec));
    return;
  }
  const { centerX, centerZ, half } = b.map;
  const zones = [makeZone(b, { id: "beachhead", name: "Hive beacon", kind: "beachhead", x: centerX - half * 0.68, z: centerZ + half * 0.68 })];
  const count = planet.zoneCount || 4;
  const kinds = Array.from({ length: count }, (_, index) => index === 0 && b.tier >= 3 ? "capital" : index === 1 ? "mine" : "settlement");
  const dry = (x, z, r) => terrain.isLand(x, z) && [0, 1, 2, 3, 4, 5].every(i => terrain.isLand(x + Math.cos(i * 1.05) * r * 0.7, z + Math.sin(i * 1.05) * r * 0.7));
  let minimum = 175;
  for (const kind of kinds) {
    const r = zoneRadius[kind];
    let placed = null;
    for (let attempt = 0; attempt < 600 && !placed; attempt += 1) {
      if (attempt % 60 === 59) minimum *= 0.94;
      const x = centerX + randomRange(b, -0.82, 0.82) * half, z = centerZ + randomRange(b, -0.82, 0.82) * half;
      // The Hive beacon keeps a wider berth so long-range defenses cannot reach fresh drops.
      if (zones.some(zone => Math.hypot(zone.x - x, zone.z - z) < (zone.kind === "beachhead" ? Math.max(minimum, 240) : minimum))) continue;
      if (attempt < 500 && !dry(x, z, r)) continue;
      placed = { x, z };
    }
    if (!placed) placed = { x: centerX + randomRange(b, -0.5, 0.5) * half, z: centerZ + randomRange(b, -0.5, 0.5) * half };
    zones.push(makeZone(b, { id: `zone-${zones.length}`, name: zoneName(b, kind), kind, ...placed }));
  }
  b.zones = zones;
}

// Defender strength grows with the planet's threat level.
const strength = (b) => ({ hp: 1 + 0.1 * Math.max(0, b.threat - 1), damage: 1 + 0.08 * Math.max(0, b.threat - 1) });

function spawnUnit(b, side, type, x, z, extra = {}) {
  const def = side === "swarm" && droneTypes[type] ? droneTypes[type] : defenderTypes[type] || droneTypes[type];
  const scale = side === "native" ? strength(b) : { hp: 1, damage: 1 };
  const unit = {
    id: b.nextId++, side, type, x, z, alt: extra.alt ?? (def.cruise || 0), vx: 0, vz: 0,
    hp: def.hp * scale.hp, maxHp: def.hp * scale.hp, damageScale: scale.damage,
    squad: extra.squad ?? null, order: extra.order ?? { kind: "hold", x, z }, slot: extra.slot ?? { dx: 0, dz: 0 },
    home: extra.home ?? null, raid: null, target: null, fireIn: nextRandom(b) * 0.4,
    alive: true, landed: false, structure: !!def.structure, converted: false, heading: nextRandom(b) * Math.PI * 2,
  };
  b.units.push(unit);
  return unit;
}

function garrison(b, planet, society) {
  if (b.tier === 0) return;
  const wanted = (planet.objectives || []).filter(o => o.kind === "destroyType").map(o => o.type);
  const types = society.structures;
  for (const zone of b.zones) {
    if (zone.kind === "beachhead") continue;
    const base = Math.max(1, Math.round(1 + (b.threat - 1) * 0.6));
    const count = zone.kind === "capital" ? base + 2 : zone.kind === "mine" ? Math.max(1, base - 1) : base;
    const offset = Math.floor(nextRandom(b) * types.length);
    for (let i = 0; i < count; i += 1) {
      const type = i === 0 ? types[0] : types[(i + offset) % types.length];
      const angle = i / count * Math.PI * 2 + nextRandom(b) * 0.8, r = zone.radius * randomRange(b, 0.3, 0.72);
      spawnUnit(b, "native", type, zone.x + Math.cos(angle) * r, zone.z + Math.sin(angle) * r, { home: zone.id });
    }
    const militia = zone.kind === "capital" ? 2 + b.threat : zone.kind === "mine" ? 1 : 1 + Math.floor(b.threat / 2);
    for (let i = 0; i < militia; i += 1) {
      const angle = nextRandom(b) * Math.PI * 2, r = zone.radius * nextRandom(b) * 0.8;
      spawnUnit(b, "native", society.militia, zone.x + Math.cos(angle) * r, zone.z + Math.sin(angle) * r, { home: zone.id });
    }
  }
  // An objective that asks for every structure of a type always has at least one to find.
  for (const type of wanted) {
    if (b.units.some(u => u.type === type)) continue;
    const swap = b.units.find(u => u.structure && u.type !== types[0]) || b.units.find(u => u.structure);
    if (swap) {
      const def = defenderTypes[type], scale = strength(b);
      Object.assign(swap, { type, hp: def.hp * scale.hp, maxHp: def.hp * scale.hp });
    }
  }
}

// ---- Queries ----
export const unitById = (b, id) => b.units.find(u => u.id === id) || null;
export const zoneById = (b, id) => b.zones.find(z => z.id === id) || null;
export const zoneAt = (b, x, z, scale = 1) => b.zones.find(zone => (zone.x - x) ** 2 + (zone.z - z) ** 2 <= (zone.radius * scale) ** 2) || null;
const inBeachhead = (b, unit) => b.zones.some(zone => zone.kind === "beachhead" && dist2(zone, unit) <= (zone.radius * 1.4) ** 2);
const heldZoneAt = (b, unit) => b.zones.find(zone => zone.captured && dist2(zone, unit) <= zone.radius ** 2) || null;
export const cheapestDrone = (b) => Math.min(...b.unlocks.map(type => droneTypes[type]?.cost ?? Infinity));

// ---- Drops ----
export function dropZoneAt(b, x, z) {
  return b.zones.find(zone => zone.captured && (zone.x - x) ** 2 + (zone.z - z) ** 2 <= (zone.radius * 1.6) ** 2) || null;
}

export function dropReadyIn(b) {
  return Math.max(0, dropCooldownS - (b.time - b.lastDropAt));
}

// Checks a drop without making it. Returns { ok: true } or { ok: false, reason }.
export function checkDrop(b, { x, z, payload }) {
  const fail = (reason) => ({ ok: false, reason });
  if (b.outcome) return fail("The mission is over.");
  if (!validPayload(payload)) return fail("Choose valid whole-number drone counts.");
  const count = payloadCount(payload);
  if (!count) return fail("Choose at least one drone for the wave.");
  for (const [type, n] of Object.entries(payload)) {
    if (n > 0 && !b.unlocks.includes(type)) return fail(`${droneTypes[type]?.name || type} drones are still locked.`);
  }
  if (payloadSlots(payload) > b.podSlots) return fail(`A wave holds ${b.podSlots} slots.`);
  if (payloadCost(payload) > b.matter + 1e-9) return fail("Not enough matter for this wave.");
  for (const type of droneOrder) {
    const limit = droneTypes[type].limit;
    if (!limit || !(payload[type] > 0)) continue;
    const fielded = b.units.filter(u => u.alive && u.type === type && u.side === "swarm").length
      + b.pods.filter(p => !p.released).reduce((sum, p) => sum + (p.payload[type] || 0), 0);
    if (fielded + payload[type] > limit) return fail(`At most ${limit} ${droneTypes[type].name} drones in the field.`);
  }
  const wait = dropReadyIn(b);
  if (wait > 0) return fail(`Pod bay recharging: ${Math.ceil(wait)} s.`);
  const payloads = packDropPods(payload);
  if (x === undefined && z === undefined) return { ok: true, payloads };
  if (!Number.isFinite(x) || !Number.isFinite(z)) return fail("Choose a valid landing point.");
  const zone = dropZoneAt(b, x, z);
  if (!zone) return fail("Pods can only land in a zone you hold.");
  return { ...planDropLandings(b, zone, x, z, payloads.length), payloads };
}

export function requestDrop(b, request) {
  if (!Number.isFinite(request.x) || !Number.isFinite(request.z)) return { ok: false, reason: "Choose a valid landing point." };
  const check = checkDrop(b, request);
  if (!check.ok) return check;
  const payload = Object.fromEntries(Object.entries(request.payload).filter(([, n]) => n > 0).map(([type, n]) => [type, n | 0]));
  b.matter -= payloadCost(payload);
  b.lastDropAt = b.time;
  const squad = { id: b.squads.length + 1, name: `Squad ${b.squads.length + 1}`, color: squadColors[b.squads.length % squadColors.length] };
  b.squads.push(squad);
  const waveId = b.nextId++;
  let slotStart = 0;
  const pods = check.payloads.map((payload, waveIndex) => {
    const stagger = waveIndex * podStaggerS;
    const pod = { id: b.nextId++, waveId, waveIndex, waveCount: check.payloads.length, slotStart,
      ...check.landings[waveIndex], t: -stagger, stagger, payload, squad: squad.id, released: false, launchedAt: b.time };
    slotStart += payloadCount(payload);
    b.pods.push(pod);
    b.events.push({ kind: "drop", pod: pod.id, waveId, x: pod.x, z: pod.z });
    return pod;
  });
  b.stats.drops += 1;
  b.stats.podsLaunched = (b.stats.podsLaunched || 0) + pods.length;
  b.log.push({ t: b.time, tone: "info", text: `${squad.name} launched: ${payloadCount(payload)} drones in ${pods.length} pod${pods.length === 1 ? "" : "s"}, landing in ${(dropDurationS + pods.at(-1).stagger).toFixed(1)} s.` });
  return { ok: true, pod: pods[0], pods, waveId, squad };
}

// Golden-angle spiral: spot i of a disc formation.
export function formationSlot(index, spacing = separation) {
  const r = spacing * Math.sqrt(index), angle = index * 2.39996323;
  return { dx: Math.cos(angle) * r, dz: Math.sin(angle) * r };
}

function releasePod(b, pod) {
  pod.released = true;
  let index = 0;
  const squad = b.squads.find(s => s.id === pod.squad);
  for (const type of droneOrder) {
    for (let n = 0; n < (pod.payload[type] || 0); n += 1) {
      const slot = pod.pendingSlots?.[index] || formationSlot((pod.slotStart || 0) + index);
      const local = formationSlot(index, 4);
      const x = pod.x + local.dx, z = pod.z + local.dz;
      const order = squad?.order && squad.order.kind !== "hold" ? { ...squad.order } : { kind: "hold", x: x - slot.dx, z: z - slot.dz };
      spawnUnit(b, "swarm", type, x, z, {
        alt: 32, squad: pod.squad, slot, order,
      });
      index += 1;
    }
  }
  b.stats.dronesDropped += index;
  b.events.push({ kind: "release", pod: pod.id, x: pod.x, z: pod.z });
  const remaining = b.pods.filter(p => p.squad === pod.squad && !p.released).length;
  b.log.push({ t: b.time, tone: "good", text: `${squad?.name || "Squad"}: pod ${(pod.waveIndex || 0) + 1}/${pod.waveCount || 1} down, ${index} drones${remaining ? ` · ${remaining} pods inbound` : " · wave complete"}.` });
}

function stepPods(b, dt) {
  for (const pod of b.pods) {
    pod.t += dt;
    if (!pod.released && pod.t >= dropDurationS) releasePod(b, pod);
  }
  // Released pods stay a few seconds so the empty backshell can drift away on screen.
  b.pods = b.pods.filter(pod => pod.t < dropDurationS + 6);
}

// ---- Orders ----
function squadDrones(b, squadIds) {
  const wanted = new Set(squadIds);
  return b.units.filter(u => isDrone(u) && wanted.has(u.squad)).sort((a, c) => a.id - c.id);
}

// order: { kind: "move" | "capture" | "attack" | "hold", x, z, target, zone }
export function orderSquads(b, squadIds, order) {
  const drones = squadDrones(b, squadIds);
  const pending = b.pods.filter(p => !p.released && squadIds.includes(p.squad));
  const total = drones.length + pending.reduce((n, p) => n + payloadCount(p.payload), 0);
  if (!total) return 0;
  const zone = order.zone ? zoneById(b, order.zone) : null;
  const spacing = zone ? Math.min(separation, zone.radius * 0.75 / Math.sqrt(total)) : separation;
  // pace: the group travels at its slowest drone's speed so it arrives together.
  const pace = Math.min(...drones.map(unit => droneTypes[unit.type].speed), ...pending.flatMap(p => Object.keys(p.payload).map(t => droneTypes[t].speed)));
  for (const squad of b.squads) if (squadIds.includes(squad.id)) squad.order = { ...order, pace };
  drones.forEach((unit, index) => {
    unit.order = { ...order, pace };
    unit.slot = order.kind === "attack" ? formationSlot(index, 5) : formationSlot(index, spacing);
    unit.landed = false;
  });
  let index = drones.length;
  for (const pod of pending) pod.pendingSlots = Array.from({ length: payloadCount(pod.payload) }, () => formationSlot(index++, order.kind === "attack" ? 5 : spacing));
  b.events.push({ kind: "order", order: order.kind, x: order.x, z: order.z, target: order.target ?? null });
  return total;
}

// One tap or click on the map: attack a defender near the point, capture a zone the swarm does
// not hold, or otherwise move there. Returns the order given (or null with no drones).
export function orderAt(b, squadIds, x, z) {
  let enemy = null, best = Infinity;
  for (const unit of b.units) {
    if (!unit.alive || unit.side !== "native") continue;
    const d = Math.hypot(unit.x - x, unit.z - z), reach = unit.structure ? 16 : 12;
    if (d < reach && d < best) { best = d; enemy = unit; }
  }
  let order;
  if (enemy) order = { kind: "attack", target: enemy.id, x: enemy.x, z: enemy.z };
  else {
    const zone = zoneAt(b, x, z);
    order = zone && !zone.captured ? { kind: "capture", zone: zone.id, x: zone.x, z: zone.z } : { kind: "move", x, z };
  }
  return orderSquads(b, squadIds, order) ? order : null;
}

export function orderHold(b, squadIds) {
  for (const squad of b.squads) if (squadIds.includes(squad.id)) squad.order = { kind: "hold" };
  for (const pod of b.pods) if (!pod.released && squadIds.includes(pod.squad)) delete pod.pendingSlots;
  for (const unit of squadDrones(b, squadIds)) {
    unit.order = { kind: "hold", x: unit.x, z: unit.z };
    unit.slot = { dx: 0, dz: 0 };
  }
}

// ---- Simulation ----
function collectAuras(b) {
  const auras = { boost: [], jam: [], armor: [] };
  for (const unit of b.units) {
    if (!unit.alive || !unit.structure) continue;
    const aura = defenderTypes[unit.type]?.aura;
    if (!aura) continue;
    const entry = { x: unit.x, z: unit.z, r2: aura.radius ** 2, side: unit.side, ...aura };
    if (aura.boost) auras.boost.push(entry);
    if (aura.jam) auras.jam.push(entry);
    if (aura.armor) auras.armor.push(entry);
  }
  return auras;
}

// Jammers and radar work for whichever side holds them (a hacked jammer stops the locals).
const inAura = (list, unit, side) => list.some(a => a.side === side && dist2(a, unit) <= a.r2);
const auraBoost = (list, unit) => list.reduce((best, a) => (a.side === unit.side && dist2(a, unit) <= a.r2 ? Math.max(best, a.boost) : best), 0);
const enemySide = (side) => (side === "swarm" ? "native" : "swarm");

function stunned(b, unit) {
  return unit.side === "swarm" && b.hazards.effects.stun && !heldZoneAt(b, unit);
}

function buildGrid(units, cell) {
  const grid = new Map();
  for (const unit of units) {
    const key = `${Math.floor(unit.x / cell)},${Math.floor(unit.z / cell)}`;
    let list = grid.get(key);
    if (!list) grid.set(key, list = []);
    list.push(unit);
  }
  return grid;
}

function nearestEnemy(unit, enemies, reach) {
  let best = null, bestD = reach * reach;
  for (const other of enemies) {
    if (!other.alive) continue;
    const d = dist2(unit, other);
    if (d <= bestD) { bestD = d; best = other; }
  }
  return best;
}

function moveUnits(b, dt, auras, swarm, natives) {
  const effects = b.hazards.effects;
  const grid = buildGrid(swarm, 8);
  const huntable = swarm.filter(drone => !inBeachhead(b, drone));
  const { centerX, centerZ, half } = b.map;
  for (const unit of b.units) {
    if (!unit.alive || unit.structure) continue;
    const def = defOf(unit);
    let tx = unit.x, tz = unit.z, speed = def.speed, arrive = 8;
    if (unit.side === "swarm") {
      const jammed = inAura(auras.jam, unit, "native");
      speed *= effects.speed * (stunned(b, unit) ? 0.3 : 1) * (jammed ? 0.6 : 1);
      const order = unit.order;
      let destination = order;
      if (order.kind === "attack") {
        let target = unitById(b, order.target);
        // Attack-move: when the target falls, go on to the nearest defender near that spot.
        if (!target?.alive) {
          target = nearestEnemy(order, natives, 110);
          if (target) order.target = target.id;
        }
        if (target?.alive) {
          order.x = target.x; order.z = target.z;
          const reach = Math.max(6, reachFor(def, target) * effects.range * 0.8);
          destination = { x: target.x, z: target.z, radius: reach };
          if (Math.sqrt(dist2(unit, target)) > reach) { tx = target.x + unit.slot.dx; tz = target.z + unit.slot.dz; arrive = 2; }
        } else {
          unit.order = { kind: "hold", x: unit.x, z: unit.z };
          unit.slot = { dx: 0, dz: 0 };
        }
      } else { tx = order.x + unit.slot.dx; tz = order.z + unit.slot.dz; }
      if (order.pace && Math.sqrt(dist2(unit, destination)) > (destination.radius || 0) + 50) speed = Math.min(speed, order.pace * effects.speed);
      // The Dragonfly lands to drill matter when it has arrived in a held zone with no locals near.
      if (def.harvest) {
        const settled = Math.hypot(tx - unit.x, tz - unit.z) < 3 && order.kind !== "attack";
        unit.landed = settled && !!heldZoneAt(b, unit) && !natives.some(n => n.alive && dist2(n, unit) < 70 * 70);
      }
    } else {
      // Locals: engage drones in sight near home, raid captured zones when alarmed, else guard home.
      const home = unit.home ? zoneById(b, unit.home) : null;
      if (unit.raid && !zoneById(b, unit.raid)?.captured) unit.raid = null;
      // Locals never chase drones onto the Hive beacon, so a new drop always lands safely.
      const target = nearestEnemy(unit, huntable, def.sight);
      const leashOk = !home || unit.raid || !target || Math.sqrt(dist2(home, target)) < 280;
      if (target && leashOk) {
        unit.target = target.id;
        if (Math.sqrt(dist2(unit, target)) > def.range * 0.85) { tx = target.x; tz = target.z; arrive = 2; }
      } else if (unit.raid) {
        const zone = zoneById(b, unit.raid);
        tx = zone.x + unit.slot.dx; tz = zone.z + unit.slot.dz;
      } else if (home && Math.sqrt(dist2(unit, home)) > home.radius * 0.7) {
        tx = home.x + unit.slot.dx; tz = home.z + unit.slot.dz;
      }
    }
    const dx = tx - unit.x, dz = tz - unit.z, d = Math.hypot(dx, dz);
    let wantX = 0, wantZ = 0;
    if (d > 0.4) { const s = speed * Math.min(1, d / arrive); wantX = dx / d * s; wantZ = dz / d * s; }
    if (unit.side === "swarm") {
      // Keep a little space between drones so a squad spreads instead of stacking.
      const cx = Math.floor(unit.x / 8), cz = Math.floor(unit.z / 8);
      for (let gx = cx - 1; gx <= cx + 1; gx += 1) for (let gz = cz - 1; gz <= cz + 1; gz += 1) {
        for (const other of grid.get(`${gx},${gz}`) || []) {
          if (other === unit) continue;
          const ox = unit.x - other.x, oz = unit.z - other.z, od = Math.hypot(ox, oz);
          if (od < separation && od > 1e-6) { const push = (separation - od) * 1.6 / od; wantX += ox * push; wantZ += oz * push; }
        }
      }
      if (!unit.landed) { wantX += effects.wind.x; wantZ += effects.wind.z; }
    }
    const blend = Math.min(1, dt * 3);
    unit.vx += (wantX - unit.vx) * blend;
    unit.vz += (wantZ - unit.vz) * blend;
    let nx = Math.min(centerX + half, Math.max(centerX - half, unit.x + unit.vx * dt));
    let nz = Math.min(centerZ + half, Math.max(centerZ - half, unit.z + unit.vz * dt));
    if (unit.side === "native" && !def.air && !b.isLand(nx, nz)) {
      // At the shore: slide along it if one direction is still dry, otherwise stop.
      if (b.isLand(nx, unit.z)) nz = unit.z;
      else if (b.isLand(unit.x, nz)) nx = unit.x;
      else { nx = unit.x; nz = unit.z; unit.vx = 0; unit.vz = 0; }
    }
    unit.x = nx;
    unit.z = nz;
    if (unit.vx * unit.vx + unit.vz * unit.vz > 0.5) unit.heading = Math.atan2(unit.vx, unit.vz);
    const cruise = unit.landed ? 0 : def.cruise || 0;
    unit.alt += (cruise - unit.alt) * Math.min(1, dt * 1.2);
  }
}

function hurt(b, target, amount, cause) {
  if (!target.alive || !(amount > 0)) return;
  target.hp -= amount;
  if (cause?.side === "swarm" && target.side === "native") {
    b.stats.damageDealt += amount;
    b.alarm += amount * 0.0025 * alarmGain(b);
  }
  if (target.hp <= 0) kill(b, target, cause);
}

const alarmGain = (b) => societies[b.tier]?.alarmGain ?? 0;

function kill(b, unit, cause) {
  unit.alive = false;
  unit.hp = 0;
  b.events.push({ kind: "destroyed", id: unit.id, side: unit.side, type: unit.type, structure: unit.structure, x: unit.x, z: unit.z, alt: unit.alt });
  if (unit.side === "swarm") {
    if (!unit.structure) {
      b.stats.dronesLost += 1;
      if (cause === "hazard") b.stats.hazardLosses += 1;
    }
    return;
  }
  if (unit.structure) {
    b.stats.defensesDestroyed += 1;
    b.alarm += 5 * alarmGain(b);
    b.matter += salvageMatter;
    b.stats.matterHarvested += salvageMatter;
    b.log.push({ t: b.time, tone: "good", text: `${defenderTypes[unit.type].name} destroyed (+${salvageMatter} matter salvage).` });
  } else {
    b.stats.militiaDefeated += 1;
    b.alarm += 0.8 * alarmGain(b);
  }
}

function fight(b, dt, auras, swarm, natives) {
  const effects = b.hazards.effects;
  for (const unit of b.units) {
    if (!unit.alive) continue;
    const def = defOf(unit);
    if (!def.weapons.length || stunned(b, unit)) continue;
    const enemies = unit.side === "swarm" ? natives : swarm;
    const rangeScale = unit.side === "swarm" ? effects.range : 1;
    const armed = (other) => other?.alive && other.side !== unit.side && weaponFor(def, other, Math.sqrt(dist2(unit, other)), rangeScale);
    let target = null;
    if (unit.side === "swarm" && unit.order?.kind === "attack") {
      const ordered = unitById(b, unit.order.target);
      if (armed(ordered)) target = ordered;
    }
    if (!target && unit.target) {
      const previous = unitById(b, unit.target);
      if (armed(previous)) target = previous;
    }
    if (!target) {
      let bestD = Infinity;
      for (const other of enemies) {
        const d = dist2(unit, other);
        if (d < bestD && armed(other)) { bestD = d; target = other; }
      }
    }
    unit.target = target ? target.id : null;
    if (!target) continue;
    const w = weaponFor(def, target, Math.sqrt(dist2(unit, target)), rangeScale);
    let damage = w.damage * unit.damageScale * dt;
    if (unit.side === "native") damage *= (1 + auraBoost(auras.boost, unit)) * (1 + b.alarm / 200);
    if (target.structure && inAura(auras.armor, target, target.side)) damage *= 1 - 0.65;
    hurt(b, target, damage, unit);
    if (w.splash) {
      for (const other of enemies) {
        if (other !== target && other.alive && dist2(other, target) <= w.splash ** 2) hurt(b, other, damage * 0.4, unit);
      }
    }
    unit.fireIn -= dt;
    if (unit.fireIn <= 0) {
      unit.fireIn = 0.35 + nextRandom(b) * 0.25;
      b.events.push({ kind: "shot", from: unit.id, to: target.id, side: unit.side, weapon: w.id, fx: w.fx });
    }
  }
}

function resolveStrikes(b, swarm) {
  for (const strike of b.strikes) {
    if (strike.hit || b.time < strike.hitAt) continue;
    strike.hit = true;
    for (const unit of swarm) {
      if (!unit.alive || dist2(unit, strike) > strike.radius ** 2) continue;
      // Held zones have lightning rods; artillery hits everywhere.
      const lightning = strike.source === "lightning";
      hurt(b, unit, strike.damage * (lightning && heldZoneAt(b, unit) ? 0.5 : 1), lightning ? "hazard" : "strike");
    }
    b.events.push({ kind: "strike", source: strike.source, x: strike.x, z: strike.z, radius: strike.radius });
  }
  b.strikes = b.strikes.filter(strike => !strike.hit || b.time - strike.hitAt < 1.5);
}

function hazardDamage(b, dt, swarm) {
  const effects = b.hazards.effects;
  for (const unit of swarm) {
    if (!unit.alive) continue;
    let damage = effects.damage * (heldZoneAt(b, unit) || unit.landed ? 0.5 : 1);
    for (const zone of effects.zones) if (dist2(unit, zone) <= zone.radius ** 2) damage += zone.damage;
    hurt(b, unit, damage * dt, "hazard");
  }
}

function captureZone(b, zone) {
  zone.captured = true;
  zone.control = 100;
  b.stats.zonesCaptured += 1;
  b.alarm += 4 * alarmGain(b);
  let converted = 0;
  for (const unit of b.units) {
    if (unit.alive && unit.structure && unit.side === "native" && dist2(unit, zone) <= (zone.radius + 4) ** 2) {
      unit.side = "swarm";
      unit.converted = true;
      unit.target = null;
      converted += 1;
    }
  }
  b.events.push({ kind: "captured", zone: zone.id, x: zone.x, z: zone.z });
  b.log.push({ t: b.time, tone: "good", text: `${zone.name} captured.${converted ? ` ${converted} defense${converted > 1 ? "s" : ""} now fire for the swarm.` : ""}` });
  if (zone.special && !b.specials.includes(zone.special)) {
    b.specials.push(zone.special);
    if (droneTypes[zone.special] && !b.unlocks.includes(zone.special)) b.unlocks.push(zone.special);
    b.events.push({ kind: "recovered", unlock: zone.special, zone: zone.id });
    b.log.push({ t: b.time, tone: "good", text: `${droneTypes[zone.special]?.name || zone.special} recovered: it is in your drop menu now and in every later mission.` });
  }
}

function loseZone(b, zone) {
  zone.captured = false;
  zone.control = 0;
  for (const unit of b.units) {
    if (unit.alive && unit.converted && unit.side === "swarm" && dist2(unit, zone) <= (zone.radius + 4) ** 2) {
      unit.side = "native";
      unit.converted = false;
      unit.target = null;
    }
  }
  b.events.push({ kind: "lost", zone: zone.id, x: zone.x, z: zone.z });
  b.log.push({ t: b.time, tone: "bad", text: `${zone.name} was retaken by the locals.` });
}

function captureZones(b, dt, auras) {
  const resistance = societies[b.tier]?.resistance ?? 1;
  for (const zone of b.zones) {
    if (zone.kind === "beachhead") continue;
    let power = 0, hack = 0, drones = 0, locals = 0, defenses = 0;
    const r2 = zone.radius ** 2;
    for (const unit of b.units) {
      if (!unit.alive || dist2(unit, zone) > r2) continue;
      if (unit.side === "swarm" && !unit.structure) {
        drones += 1;
        if (stunned(b, unit) || inAura(auras.jam, unit, "native")) continue;
        const def = droneTypes[unit.type];
        power += def.capture;
        if (def.hack) hack += def.capture;
      } else if (unit.side === "native") {
        if (unit.structure) defenses += 1; else locals += 1;
      }
    }
    zone.contested = drones > 0 && (locals > 0 || defenses > 0);
    zone.drones = drones;
    if (!zone.captured) {
      if (drones > 0) {
        let rate = defenses > 0 ? hack * 0.4 : power;
        if (locals > 0) rate *= 0.5;
        rate *= resistance * (zone.kind === "capital" ? 0.7 : 1);
        zone.control = Math.min(100, zone.control + rate * dt);
        if (zone.control >= 100) captureZone(b, zone);
      } else if (locals > 0 || (b.tier > 0 && defenses > 0)) {
        zone.control = Math.max(0, zone.control - 0.5 * dt);
      }
    } else if (locals > 0 && drones === 0) {
      zone.control -= 1.5 * locals * dt;
      if (zone.control <= 0) loseZone(b, zone);
    } else if (drones > 0 && zone.control < 100) {
      zone.control = Math.min(100, zone.control + Math.max(1, power) * dt);
    }
  }
}

function economy(b, dt, swarm) {
  for (const zone of b.zones) {
    if (!zone.captured || !zone.value) continue;
    // Richer, more developed worlds yield more matter per zone.
    const income = zone.value * (1 + 0.15 * b.threat) * dt;
    b.matter += income;
    b.stats.matterHarvested += income;
  }
  for (const unit of swarm) {
    if (!unit.alive) continue;
    const def = droneTypes[unit.type];
    if (def?.harvest && unit.landed && unit.alt < 0.5) {
      b.matter += def.harvest * dt;
      b.stats.matterHarvested += def.harvest * dt;
    }
    if (unit.hp < unit.maxHp && heldZoneAt(b, unit)) unit.hp = Math.min(unit.maxHp, unit.hp + healPerS * dt);
  }
}

const alarmStages = [
  { at: 25, text: "The public is uneasy: militia are gathering." },
  { at: 50, text: "The public is alarmed: militia now raid the zones you hold." },
  { at: 75, text: "Panic: defenses hit harder and every town sends fighters." },
];

function stepAlarm(b, dt, swarm) {
  if (b.tier === 0) { b.alarm = 0; return; }
  const gain = alarmGain(b);
  let seen = 0, calm = 0;
  for (const unit of swarm) {
    if (!unit.alive) continue;
    if (b.zones.some(zone => !zone.captured && zone.kind !== "beachhead" && dist2(unit, zone) < 110 * 110)) seen += 1;
    const def = droneTypes[unit.type];
    if (def?.calm && b.zones.some(zone => zone.kind !== "beachhead" && dist2(unit, zone) <= zone.radius ** 2)) calm += def.calm;
  }
  b.alarm += (Math.min(seen, 40) * 0.012 * gain - calm - 0.35) * dt;
  b.alarm = Math.max(0, Math.min(100, b.alarm));
  b.stats.alarmPeak = Math.max(b.stats.alarmPeak, b.alarm);
  const stage = alarmStages.filter(s => b.alarm >= s.at).length;
  if (stage > b.alarmStage) {
    b.log.push({ t: b.time, tone: "bad", text: alarmStages[stage - 1].text });
    b.events.push({ kind: "alarm", stage });
  }
  b.alarmStage = stage;
}

function reinforce(b, dt) {
  const society = societies[b.tier];
  if (!society?.militia) return;
  b.reinforceIn -= dt;
  if (b.reinforceIn > 0) return;
  b.reinforceIn = (70 - 52 * b.alarm / 100) / (0.6 + 0.2 * b.threat);
  const sources = b.zones.filter(zone => !zone.captured && ["settlement", "capital", "mine"].includes(zone.kind));
  if (!sources.length) return;
  const fielded = b.units.filter(u => u.alive && u.side === "native" && !u.structure).length;
  const room = 12 + b.threat * 4 - fielded;
  const count = Math.min(room, 1 + Math.floor(b.alarm / 35));
  const held = b.zones.filter(zone => zone.captured && zone.kind !== "beachhead");
  for (let i = 0; i < count; i += 1) {
    const zone = randomPick(b, sources);
    const angle = nextRandom(b) * Math.PI * 2;
    const unit = spawnUnit(b, "native", society.militia, zone.x + Math.cos(angle) * zone.radius * 0.5, zone.z + Math.sin(angle) * zone.radius * 0.5, { home: zone.id });
    unit.slot = formationSlot(i + 1, 5);
    if (b.alarm >= 50 && held.length) {
      unit.raid = held.reduce((best, z) => (dist2(z, unit) < dist2(best, unit) ? z : best)).id;
    }
  }
  if (count > 0 && b.alarm >= 50 && held.length) b.log.push({ t: b.time, tone: "bad", text: `${count} militia are marching on your zones.` });
}

function artillery(b, dt, swarm) {
  if (!societies[b.tier]?.strikes || b.alarm < 70) return;
  b.strikeIn -= dt;
  if (b.strikeIn > 0) return;
  b.strikeIn = randomRange(b, 16, 26) * (1.2 - b.alarm / 250);
  const targets = swarm.filter(u => u.alive);
  if (!targets.length) return;
  const target = randomPick(b, targets);
  b.strikes.push({
    x: target.x + randomRange(b, -6, 6), z: target.z + randomRange(b, -6, 6), radius: 22,
    damage: 30 + 4 * b.threat, markedAt: b.time, hitAt: b.time + 4, source: "artillery", hit: false,
  });
  b.log.push({ t: b.time, tone: "bad", text: "Artillery incoming: move out of the marked circle!" });
  b.events.push({ kind: "artillery", x: target.x, z: target.z });
}

// Surviving drones return to the Hive and half their cost goes back into matter.
function recallSwarm(b) {
  let refund = 0;
  for (const unit of b.units) if (isDrone(unit)) refund += droneTypes[unit.type].cost * 0.5;
  // Unreleased cargo is cancelled, not lost or released after the mission ends.
  for (const pod of b.pods) if (!pod.released) refund += payloadCost(pod.payload);
  b.pods = b.pods.filter(pod => pod.released);
  b.refund = Math.round(refund);
  b.matter += b.refund;
}

function checkOutcome(b) {
  const held = b.zones.filter(zone => zone.captured && zone.kind !== "beachhead").length;
  if (held >= b.required && !b.victoryAvailable) {
    b.victoryAvailable = true;
    b.victoryAvailableAt = b.time;
    b.log.push({ t: b.time, tone: "good", text: "Victory available: leave now or continue capturing. Stars and time goals finalize when you leave." });
    b.events.push({ kind: "victoryAvailable" });
  }
  const alive = b.units.some(isDrone);
  if (!alive && !b.pods.some(pod => !pod.released) && b.matter < cheapestDrone(b)) {
    b.outcome = "lost";
    b.endTime = b.time;
    b.log.push({ t: b.time, tone: "bad", text: "The swarm is gone and the Hive has no matter left for another pod." });
    b.events.push({ kind: "outcome", outcome: "lost" });
  }
}

export function continueCapturing(b) {
  if (!b.victoryAvailable || b.outcome) return false;
  b.victoryChoiceMade = true;
  return true;
}

export function extractVictory(b) {
  if (!b.victoryAvailable || b.outcome) return false;
  b.victoryChoiceMade = true;
  b.outcome = "won";
  b.endTime = b.time;
  recallSwarm(b);
  b.log.push({ t: b.time, tone: "good", text: "Victory claimed. Surviving drones recalled; unreleased cargo cancelled and refunded." });
  b.events.push({ kind: "outcome", outcome: "won" });
  return true;
}

export function retreat(b) {
  if (b.outcome) return;
  if (b.victoryAvailable) return extractVictory(b);
  b.outcome = "retreated";
  b.endTime = b.time;
  recallSwarm(b);
  b.events.push({ kind: "outcome", outcome: "retreated" });
}

export function stepBattle(b, dt) {
  if (b.outcome || b.paused || !(dt > 0)) return;
  dt = Math.min(dt, 0.1);
  b.time += dt;
  stepHazards(b, dt);
  stepPods(b, dt);
  const swarm = b.units.filter(isDrone);
  const natives = b.units.filter(u => u.alive && u.side === "native");
  const auras = collectAuras(b);
  moveUnits(b, dt, auras, swarm, natives);
  // Converted structures fight for the swarm, so targets are gathered per side, not per drone.
  const swarmSide = b.units.filter(u => u.alive && u.side === "swarm");
  fight(b, dt, auras, swarmSide, natives);
  resolveStrikes(b, swarm);
  hazardDamage(b, dt, swarm);
  captureZones(b, dt, auras);
  economy(b, dt, swarm);
  stepAlarm(b, dt, swarm);
  reinforce(b, dt);
  artillery(b, dt, swarm);
  b.units = b.units.filter(u => u.alive);
  b.stats.maxAlive = Math.max(b.stats.maxAlive, b.units.filter(isDrone).length);
  if (b.events.length > 600) b.events.splice(0, b.events.length - 600);
  if (b.log.length > 40) b.log.splice(0, b.log.length - 40);
  checkOutcome(b);
}

// ---- Summaries for the page and the campaign ----
export function battleSummary(b) {
  const zones = b.zones.filter(zone => zone.kind !== "beachhead");
  const drones = b.units.filter(isDrone);
  const byType = Object.fromEntries(droneOrder.map(type => [type, 0]));
  for (const unit of drones) byType[unit.type] += 1;
  return {
    held: zones.filter(zone => zone.captured).length, total: zones.length, required: b.required,
    control: zones.length ? zones.reduce((sum, zone) => sum + zone.control, 0) / zones.length : 0,
    drones: drones.length, byType, inbound: b.pods.filter(pod => !pod.released).reduce((sum, pod) => sum + payloadCount(pod.payload), 0),
    defenders: b.units.filter(u => u.side === "native").length,
    defenses: b.units.filter(u => u.side === "native" && u.structure).length,
    alarm: b.alarm, matter: b.matter, time: b.time, dropReadyIn: dropReadyIn(b),
    inboundPods: b.pods.filter(pod => !pod.released).length,
    squads: b.squads.map(squad => ({ ...squad, size: drones.filter(u => u.squad === squad.id).length,
      inbound: b.pods.some(pod => !pod.released && pod.squad === squad.id),
      inboundPods: b.pods.filter(p => !p.released && p.squad === squad.id).length,
      inboundDrones: b.pods.filter(p => !p.released && p.squad === squad.id).reduce((n, p) => n + payloadCount(p.payload), 0) })),
  };
}

export const publicMood = (alarm) => (alarm < 10 ? "Calm" : alarm < 25 ? "Watchful" : alarm < 50 ? "Uneasy" : alarm < 75 ? "Alarmed" : "Panic");

export function objectiveStatus(b) {
  const held = b.zones.filter(zone => zone.captured && zone.kind !== "beachhead").length;
  const won = b.outcome === "won";
  const list = [{ id: "primary", primary: true, text: b.victoryAvailable ? "Victory available — leave or keep capturing" : `Hold ${b.required} zones`, progress: `${held}/${b.required}`, done: won || b.victoryAvailable || held >= b.required, failed: false }];
  for (const objective of b.objectives) {
    const entry = { id: objective.id, text: objectiveText(objective), done: false, failed: false, progress: "" };
    if (objective.kind === "captureZone") {
      const zone = zoneById(b, objective.zone);
      entry.done = !!(zone?.captured || (zone?.special && b.specials.includes(zone.special)));
    } else if (objective.kind === "maxLosses") {
      entry.failed = b.stats.dronesLost > objective.value;
      entry.done = won && !entry.failed;
      entry.progress = `${b.stats.dronesLost} lost`;
    } else if (objective.kind === "alarmBelow") {
      entry.failed = b.stats.alarmPeak >= objective.value;
      entry.done = won && !entry.failed;
      entry.progress = `peak ${Math.round(b.stats.alarmPeak)}`;
    } else if (objective.kind === "timeUnder") {
      entry.failed = (b.endTime ?? b.time) > objective.value;
      entry.done = won && !entry.failed;
      entry.progress = `${Math.floor(objective.value / 60)} min limit`;
    } else if (objective.kind === "destroyType") {
      const left = b.units.filter(u => u.alive && u.side === "native" && u.type === objective.type).length;
      entry.done = left === 0;
      entry.progress = `${left} hostile remaining`;
    } else if (objective.kind === "noHazardLosses") {
      entry.failed = b.stats.hazardLosses > 0;
      entry.done = won && !entry.failed;
      entry.progress = `${b.stats.hazardLosses} lost to hazards`;
    }
    list.push(entry);
  }
  return list;
}

export function starsEarned(b) {
  if (b.outcome !== "won") return 0;
  return Math.min(3, 1 + objectiveStatus(b).filter(o => !o.primary && o.done).length);
}

// What the campaign needs once the mission ends (campaign.mjs applyMissionResult).
export function missionResult(b) {
  return {
    missionId: b.missionId,
    outcome: b.outcome || "retreated", matter: b.matter, stars: starsEarned(b), time: b.endTime ?? b.time,
    stats: { ...b.stats }, recovered: b.specials.filter(special => droneTypes[special]),
  };
}
