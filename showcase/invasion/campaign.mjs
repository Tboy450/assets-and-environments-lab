// The invasion campaign: planets in the order they are invaded, what each one rewards, and the
// player's saved progress between missions. No DOM; covered by tests/invasion-campaign.test.mjs.
import { droneOrder, droneTypes, startingDrones, basePodSlots } from "./units.mjs?v=dev";
import { objectiveText } from './objective-rules.mjs?v=dev';
import { validMissionId } from "./mission-id.mjs?v=dev";

// galaxy: position on the campaign map (0-1 across, 0-1 down). society: index into societies
// (units.mjs). threat 0-5 scales defender numbers, strength and reinforcements. zones: fixed
// layout (Titan) or zoneCount generated from seed. required: zones to hold for the win.
// objectives: optional goals; each met one adds a star to the win's first star.
// supply: the least matter the Hive provides for an attempt, so a lost mission can always be
// retried (a bigger saved bank is used instead when there is one).
export const planets = Object.freeze([
  {
    id: "titan", order: 1, name: "Titan", subtitle: "Saturn's largest moon", practice: true, supply: 160,
    society: 0, threat: 0, biome: "titan", hazards: ["methaneRain", "gusts"], color: "#d99a4e",
    galaxy: { x: 0.13, y: 0.7 },
    description: "Practice ground. The Ahmakiq Undae dunes from the Dragonfly simulator: nobody lives here, so learn to drop, move and capture. NASA's Dragonfly lander is parked at its first landing site.",
    map: { centerX: 0, centerZ: -100, half: 420 },
    zones: [
      { id: "beachhead", name: "Hive beacon", kind: "beachhead", x: -250, z: 180 },
      { id: "outcrop", name: "Dry outcrop", kind: "beacon", x: 145, z: -90 },
      { id: "site-a", name: "Site A", kind: "beacon", x: 219, z: -235 },
      { id: "site-b", name: "Site B", kind: "beacon", x: -270, z: -40 },
      { id: "relic", name: "Dragonfly landing site", kind: "relic", x: 0, z: 0, special: "dragonfly" },
    ],
    required: 3, seed: 450,
    reward: { matter: 120, unlock: "striker" },
    objectives: [
      { id: "dragonfly", kind: "captureZone", zone: "relic", text: "Recover the Dragonfly lander (unlocks it)" },
      { id: "no-losses", kind: "maxLosses", value: 0, text: "Lose no drones" },
    ],
  },
  {
    id: "kepra", order: 2, name: "Kepra", subtitle: "Desert world", supply: 220,
    society: 1, threat: 1, biome: "desert", hazards: ["dustStorm"], color: "#e0b070",
    galaxy: { x: 0.26, y: 0.5 },
    description: "Wind-carved dunes and mesas. Tribal villages keep watch from wooden towers and throw spears at anything that flies low.",
    map: { centerX: 0, centerZ: 0, half: 420 }, zoneCount: 4, required: 3, seed: 1201,
    reward: { matter: 150, podSlots: 4 },
    objectives: [
      { id: "calm", kind: "alarmBelow", value: 50, text: "Keep the alarm under 50" },
      { id: "fast", kind: "timeUnder", value: 600, text: "Win within 10 minutes" },
    ],
  },
  {
    id: "velm", order: 3, name: "Velm", subtitle: "Swamp jungle", supply: 300,
    society: 2, threat: 2, biome: "jungle", hazards: ["acidRain"], color: "#5fae6a",
    galaxy: { x: 0.37, y: 0.76 },
    description: "Steaming swamps under a green sky. Farming towns answer drones with rifles, and the rain eats through rotor housings.",
    map: { centerX: 0, centerZ: 0, half: 440 }, zoneCount: 5, required: 4, seed: 2207,
    reward: { matter: 180, unlock: "breacher" },
    objectives: [
      { id: "towers", kind: "destroyType", type: "watchtower", text: objectiveText({kind:'destroyType',type:'watchtower'}) },
      { id: "losses", kind: "maxLosses", value: 12, text: "Lose 12 drones or fewer" },
    ],
  },
  {
    id: "corvan", order: 4, name: "Corvan", subtitle: "Ice world", supply: 380,
    society: 3, threat: 3, biome: "ice", hazards: ["blizzard"], color: "#bfe3f2",
    galaxy: { x: 0.5, y: 0.6 },
    description: "Frozen ridges and factory towns. Flak and radar cover the passes, and a full alarm brings artillery.",
    map: { centerX: 0, centerZ: 0, half: 460 }, zoneCount: 5, required: 4, seed: 3109,
    reward: { matter: 220, podSlots: 4 },
    objectives: [
      { id: "no-artillery", kind: "alarmBelow", value: 70, text: "Never let the alarm reach 70 (no artillery)" },
      { id: "weather", kind: "noHazardLosses", text: "Lose no drones to the blizzard" },
    ],
  },
  {
    id: "ashfall", order: 5, name: "Ashfall", subtitle: "Volcanic world", supply: 460,
    society: 3, threat: 4, biome: "volcanic", hazards: ["eruption", "ashCloud"], color: "#e0553a",
    galaxy: { x: 0.6, y: 0.36 },
    description: "Basalt plains between active cones. Eruptions are announced a few seconds before they blow; move the swarm.",
    map: { centerX: 0, centerZ: 0, half: 460 }, zoneCount: 6, required: 4, seed: 4441,
    reward: { matter: 260 },
    objectives: [
      { id: "weather", kind: "noHazardLosses", text: "Lose no drones to eruptions or ash" },
      { id: "fast", kind: "timeUnder", value: 900, text: "Win within 15 minutes" },
    ],
  },
  {
    id: "halcyon", order: 6, name: "Halcyon", subtitle: "Storm ocean", supply: 520,
    society: 4, threat: 4, biome: "storm", hazards: ["lightning", "gusts"], color: "#4a7fd0",
    galaxy: { x: 0.74, y: 0.56 },
    description: "Island cities under endless thunderstorms. Missile batteries and jammers guard every harbor.",
    map: { centerX: 0, centerZ: 0, half: 480 }, zoneCount: 6, required: 5, seed: 5003,
    reward: { matter: 300, podSlots: 4 },
    objectives: [
      { id: "jammers", kind: "destroyType", type: "jammer", text: objectiveText({kind:'destroyType',type:'jammer'}) },
      { id: "losses", kind: "maxLosses", value: 25, text: "Lose 25 drones or fewer" },
    ],
  },
  {
    id: "aurex", order: 7, name: "Aurex", subtitle: "City world", supply: 720,
    society: 5, threat: 5, biome: "city", hazards: ["solarFlare"], color: "#b58cf0",
    galaxy: { x: 0.86, y: 0.3 },
    description: "A spacefaring capital: laser turrets, shield pylons and interceptors. Solar flares knock out drones outside your zones.",
    map: { centerX: 0, centerZ: 0, half: 500 }, zoneCount: 7, required: 5, seed: 6421,
    reward: { matter: 400 },
    objectives: [
      { id: "calm", kind: "alarmBelow", value: 80, text: "Keep the alarm under 80" },
      { id: "losses", kind: "maxLosses", value: 40, text: "Lose 40 drones or fewer" },
    ],
  },
].map(Object.freeze));

export const planetById = (id) => planets.find(planet => planet.id === id) || null;

export const PROGRESS_VERSION = 2;
export const SAVE_KEY = "drone-invasion-progress";
export const startingMatter = 160;
const statNames = ["drops", "dronesDropped", "dronesLost", "zonesCaptured", "defensesDestroyed", "matterHarvested", "hazardEvents", "missionsPlayed", "missionsWon"];

export function createProgress() {
  return {
    version: PROGRESS_VERSION,
    matter: startingMatter,
    captured: {},
    stars: {},
    bestTime: {},
    unlocks: [...startingDrones],
    podSlots: basePodSlots,
    achievements: {},
    settledMissions: {},
    stats: Object.fromEntries(statNames.map(name => [name, 0])),
  };
}

export function isPlanetUnlocked(progress, planet) {
  if (planet.order === 1) return true;
  const previous = planets.find(p => p.order === planet.order - 1);
  return !!(previous && progress.captured[previous.id]);
}

// The first unlocked planet not yet captured (the last planet once the campaign is done).
export function nextPlanet(progress) {
  return planets.find(planet => isPlanetUnlocked(progress, planet) && !progress.captured[planet.id]) || planets.at(-1);
}

export const availableDrones = (progress) => droneOrder.filter(type => progress.unlocks.includes(type));

// Matter available at the start of an attempt on this planet.
export const missionMatter = (progress, planet) => Math.max(progress.matter, planet.supply || 0);

// result: { outcome: "won" | "lost" | "retreated", matter, stars, time, stats, recovered: [unlock ids] }
// Returns the new progress (the old one is not changed) and plain-language notes for the debrief.
export function applyMissionResult(progress, planet, result) {
  const next = structuredClone(progress);
  next.version = PROGRESS_VERSION;
  next.settledMissions ||= {};
  if (result.missionId && !validMissionId(result.missionId)) throw new TypeError("Invalid mission settlement identity.");
  if (result.missionId && Object.hasOwn(next.settledMissions, result.missionId))
    return { progress: next, notes: ["This mission result was already settled; no rewards or statistics were added again."] };
  const notes = [];
  next.matter = Math.max(0, Math.round(result.matter || 0));
  for (const name of statNames) next.stats[name] += Math.max(0, Math.round(result.stats?.[name] || 0));
  next.stats.missionsPlayed += 1;
  for (const unlock of result.recovered || []) {
    if (droneTypes[unlock] && !next.unlocks.includes(unlock)) {
      next.unlocks.push(unlock);
      notes.push(`${droneTypes[unlock].name} unlocked for every drop.`);
    }
  }
  if (result.outcome === "won") {
    next.stats.missionsWon += 1;
    const first = !next.captured[planet.id];
    next.captured[planet.id] = true;
    const matter = first ? planet.reward.matter : Math.round(planet.reward.matter * 0.3);
    next.matter += matter;
    notes.push(`${first ? "Conquest" : "Replay"} reward: +${matter} matter.`);
    if (first && planet.reward.unlock && !next.unlocks.includes(planet.reward.unlock)) {
      next.unlocks.push(planet.reward.unlock);
      notes.push(`${droneTypes[planet.reward.unlock].name} drones unlocked.`);
    }
    if (first && planet.reward.podSlots) {
      next.podSlots += planet.reward.podSlots;
      notes.push(`Drop pods now carry ${next.podSlots} slots.`);
    }
    next.stars[planet.id] = Math.max(next.stars[planet.id] || 0, result.stars || 1);
    const best = next.bestTime[planet.id];
    next.bestTime[planet.id] = best === undefined ? Math.round(result.time) : Math.min(best, Math.round(result.time));
    const following = planets.find(p => p.order === planet.order + 1);
    if (first && following) notes.push(`${following.name} is open for invasion.`);
  }
  if (result.outcome !== "won" && next.matter < (planet.supply || 0)) {
    notes.push(`The Hive will resupply you to ${planet.supply} matter for the next attempt.`);
  }
  if (result.missionId) Object.defineProperty(next.settledMissions, result.missionId, {
    value: { planetId: planet.id, outcome: result.outcome }, enumerable: true, writable: true, configurable: true,
  });
  return { progress: next, notes };
}

// Saved progress is checked field by field; anything unknown or malformed falls back to a
// fresh campaign value, so an old or edited save can never break the game.
export function validProgress(raw) {
  if (!raw || typeof raw !== "object" || ![1, PROGRESS_VERSION].includes(raw.version)) return null;
  const clean = createProgress();
  const count = (value, max = 1e7) => (Number.isFinite(value) && value >= 0 ? Math.min(max, Math.round(value)) : 0);
  clean.matter = count(raw.matter);
  for (const planet of planets) {
    if (raw.captured?.[planet.id] === true) clean.captured[planet.id] = true;
    const stars = raw.stars?.[planet.id];
    if (Number.isInteger(stars) && stars >= 1 && stars <= 3) clean.stars[planet.id] = stars;
    const best = raw.bestTime?.[planet.id];
    if (Number.isFinite(best) && best > 0) clean.bestTime[planet.id] = Math.round(best);
  }
  if (Array.isArray(raw.unlocks)) {
    for (const unlock of raw.unlocks) if (typeof unlock === 'string' && Object.hasOwn(droneTypes, unlock) && !clean.unlocks.includes(unlock)) clean.unlocks.push(unlock);
  }
  clean.podSlots = Math.max(basePodSlots, Math.min(basePodSlots + 32, count(raw.podSlots)));
  if (raw.achievements && typeof raw.achievements === "object") {
    for (const [id, at] of Object.entries(raw.achievements)) if (/^[a-z0-9-]{1,40}$/.test(id) && Number.isFinite(at)) clean.achievements[id] = at;
  }
  for (const name of statNames) clean.stats[name] = count(raw.stats?.[name]);
  if (raw.settledMissions && typeof raw.settledMissions === "object" && !Array.isArray(raw.settledMissions)) {
    for (const [id, entry] of Object.entries(raw.settledMissions)) {
      if (validMissionId(id) && planetById(entry?.planetId) && ["won", "lost", "retreated"].includes(entry?.outcome))
        Object.defineProperty(clean.settledMissions, id, { value: { planetId: entry.planetId, outcome: entry.outcome }, enumerable: true, writable: true, configurable: true });
    }
  }
  return clean;
}
