// Drone, defender and society types for the invasion game. Every number here is a gameplay
// choice, not physics; the Dragonfly simulator's flight model is not used for the swarm.

// Weapons pick their targets by class: "ground" (troops on foot), "structure" (towers, guns,
// masts) and "air" (drones, including another swarm's). Each unit fires the strongest weapon
// that can reach its target, so drones can carry different arms for defenders, structures and
// rival drones (a later versus mode). damage is per second; range in m; splash hits neighbors
// for 40%. fx is only how the shot looks on screen.
const weapon = (id, name, hits, damage, range, extra = {}) => Object.freeze({ id, name, hits, damage, range, fx: "tracer", ...extra });
// range: the longest weapon reach, used for approach distances and range rings.
const withRange = (def) => Object.freeze({ ...def, weapons: def.weapons || [], range: Math.max(0, ...(def.weapons || []).map(w => w.range)) });

// speed m/s, capture = control points per second in a zone, sight m, cruise = flying height m.
export const droneTypes = Object.freeze({
  scout: withRange({
    id: "scout", name: "Scout", role: "Fast and cheap: spots, harasses and captures",
    cost: 8, slots: 1, hp: 24, speed: 22, capture: 1, sight: 150, cruise: 22,
    weapons: [weapon("needle", "Needle gun", ["ground", "structure", "air"], 2.5, 45)],
  }),
  link: withRange({
    id: "link", name: "Link", role: "Takes control quietly, even under fire, and calms the public",
    cost: 22, slots: 2, hp: 34, speed: 13, capture: 3.2, hack: true, calm: 0.08, sight: 120, cruise: 17,
  }),
  striker: withRange({
    id: "striker", name: "Striker", role: "Gunship that knocks out defenders",
    cost: 20, slots: 2, hp: 70, speed: 15, capture: 0.4, sight: 130, cruise: 28,
    weapons: [
      weapon("rotary", "Rotary cannon", ["ground", "structure"], 9, 75),
      weapon("flechette", "Flechette pods", ["air"], 6, 60, { fx: "missile" }),
    ],
  }),
  breacher: withRange({
    id: "breacher", name: "Breacher", role: "Slow siege drone: heavy damage to structures",
    cost: 34, slots: 3, hp: 95, speed: 9, capture: 0.4, sight: 110, cruise: 15,
    weapons: [
      weapon("charge", "Demolition charges", ["structure"], 34, 42, { fx: "charge" }),
      weapon("point", "Point-defense gun", ["ground", "air"], 5, 40),
    ],
  }),
  dragonfly: withRange({
    id: "dragonfly", name: "Dragonfly", role: "The recovered Titan lander: armored, captures fast, lands to drill matter",
    cost: 60, slots: 6, hp: 220, speed: 10, capture: 5, harvest: 1.2, sight: 160, cruise: 20, limit: 3,
  }),
});

export const droneOrder = Object.freeze(["scout", "link", "striker", "breacher", "dragonfly"]);
export const startingDrones = Object.freeze(["scout", "link"]);
export const basePodSlots = 12;
export const dropCooldownS = 6;
// Seconds from the pod leaving orbit to the drones being released above the ground.
export const dropDurationS = 10;

// Defenders. Structures stand in a zone; mobile units guard their home zone and raid when the
// public is alarmed. aura: radar boosts nearby defenders' damage, jammers stop captures and slow
// drones, shield pylons reduce damage to nearby structures.
export const defenderTypes = Object.freeze({
  spearman: withRange({ id: "spearman", name: "Spear thrower", mobile: true, hp: 18, speed: 4.5, sight: 90,
    weapons: [weapon("spear", "Spears", ["air", "structure"], 1.6, 28, { fx: "spear" })] }),
  rifleman: withRange({ id: "rifleman", name: "Rifle militia", mobile: true, hp: 28, speed: 5, sight: 110,
    weapons: [weapon("rifle", "Rifles", ["air", "structure", "ground"], 3.2, 55)] }),
  trooper: withRange({ id: "trooper", name: "Trooper", mobile: true, hp: 45, speed: 6, sight: 130,
    weapons: [weapon("carbine", "Carbines", ["air", "structure", "ground"], 4.5, 70)] }),
  interceptor: withRange({ id: "interceptor", name: "Interceptor drone", mobile: true, air: true, hp: 55, speed: 19, sight: 160, cruise: 30,
    weapons: [weapon("autocannon", "Autocannon", ["air", "structure", "ground"], 7, 60)] }),
  watchtower: withRange({ id: "watchtower", name: "Watchtower", structure: true, hp: 120, sight: 120,
    weapons: [weapon("bolt", "Bolt thrower", ["air", "ground"], 3.5, 70, { fx: "spear" })] }),
  flak: withRange({ id: "flak", name: "Flak gun", structure: true, hp: 230, sight: 150,
    weapons: [weapon("flak", "Flak", ["air"], 8, 110, { splash: 6, fx: "flak" })] }),
  radar: withRange({ id: "radar", name: "Radar mast", structure: true, hp: 130, aura: { boost: 0.3, radius: 160 }, sight: 220 }),
  sam: withRange({ id: "sam", name: "Missile battery", structure: true, hp: 260, sight: 200,
    weapons: [weapon("sam", "Missiles", ["air"], 10, 150, { fx: "missile" })] }),
  jammer: withRange({ id: "jammer", name: "Signal jammer", structure: true, hp: 150, aura: { jam: true, radius: 95 }, sight: 120 }),
  laser: withRange({ id: "laser", name: "Laser turret", structure: true, hp: 380, sight: 200,
    weapons: [weapon("laser", "Laser", ["air", "ground", "structure"], 15, 140, { fx: "laser" })] }),
  shield: withRange({ id: "shield", name: "Shield pylon", structure: true, hp: 480, aura: { armor: 0.65, radius: 120 }, sight: 120 }),
});

export function targetClass(unit) {
  if (unit.structure) return "structure";
  return droneTypes[unit.type] || defenderTypes[unit.type]?.air ? "air" : "ground";
}

// How close a unit must get to hit this target with any of its weapons (0 when none can).
export function reachFor(def, target) {
  const kind = targetClass(target);
  return def.weapons.reduce((reach, w) => (w.hits.includes(kind) ? Math.max(reach, w.range) : reach), 0);
}

// The strongest weapon that can hit this target from distance d (m); rangeScale shortens reach
// in dust and similar hazards. Returns null when nothing reaches.
export function weaponFor(def, target, d, rangeScale = 1) {
  let best = null;
  const kind = targetClass(target);
  for (const w of def.weapons) {
    if (!w.hits.includes(kind) || d > w.range * rangeScale) continue;
    if (!best || w.damage > best.damage) best = w;
  }
  return best;
}

// Society level of a planet: who lives there, how they fight back and how quickly the public
// raises the alarm. resistance scales capture speed; strikes enables artillery at high alarm.
export const societies = Object.freeze([
  { tier: 0, name: "Uninhabited", militia: null, structures: [], alarmGain: 0, resistance: 1, strikes: false,
    description: "No one lives here. A safe place to practice drops, moves and captures." },
  { tier: 1, name: "Tribal", militia: "spearman", structures: ["watchtower"], alarmGain: 0.7, resistance: 0.9, strikes: false,
    description: "Scattered villages with spears and lookout towers." },
  { tier: 2, name: "Agrarian", militia: "rifleman", structures: ["watchtower"], alarmGain: 0.85, resistance: 0.8, strikes: false,
    description: "Farming towns with rifles, towers and a quick temper." },
  { tier: 3, name: "Industrial", militia: "trooper", structures: ["flak", "watchtower", "radar"], alarmGain: 1, resistance: 0.7, strikes: true,
    description: "Factories, flak guns and radar. Artillery answers a full alarm." },
  { tier: 4, name: "Networked", militia: "trooper", structures: ["sam", "flak", "jammer", "radar"], alarmGain: 1.2, resistance: 0.6, strikes: true,
    description: "Missile batteries and signal jammers that stop captures." },
  { tier: 5, name: "Spacefaring", militia: "interceptor", structures: ["laser", "sam", "shield", "jammer"], alarmGain: 1.4, resistance: 0.5, strikes: true,
    description: "Laser turrets, shield pylons and interceptor drones of their own." },
]);

export const threatNames = Object.freeze(["None", "Low", "Guarded", "Elevated", "High", "Severe"]);

export function payloadSlots(payload) {
  return Object.entries(payload || {}).reduce((sum, [type, count]) => sum + (droneTypes[type]?.slots || 0) * Math.max(0, count | 0), 0);
}

export function payloadCost(payload) {
  return Object.entries(payload || {}).reduce((sum, [type, count]) => sum + (droneTypes[type]?.cost || 0) * Math.max(0, count | 0), 0);
}

export function payloadCount(payload) {
  return Object.values(payload || {}).reduce((sum, count) => sum + Math.max(0, count | 0), 0);
}
