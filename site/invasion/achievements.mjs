// Achievements: long-term goals across the whole campaign, saved with the progress. Mission
// objectives (stars) live in battle.mjs; these are separate and never change a planet's stars.
import { planets } from "./campaign.mjs?v=dev";

// check(context): context = { totals, mission, planet, unlocks, captured } from achievementContext().
export const achievements = Object.freeze([
  { id: "planetfall", name: "Planetfall", text: "Land your first drop pod.", check: c => c.totals.drops >= 1 },
  { id: "foothold", name: "Foothold", text: "Capture your first zone.", check: c => c.totals.zonesCaptured >= 1 },
  { id: "dragon-tamer", name: "Dragon Tamer", text: "Recover NASA's Dragonfly lander on Titan.", check: c => c.unlocks.has("dragonfly") },
  { id: "swarm-lord", name: "Swarm Lord", text: "Have 40 drones in the field at once.", check: c => (c.mission?.stats.maxAlive || 0) >= 40 },
  { id: "silent-takeover", name: "Silent Takeover", text: "Win an inhabited planet with the alarm never above 30.", check: c => won(c) && c.planet.society > 0 && c.mission.stats.alarmPeak <= 30 },
  { id: "flawless", name: "No Drone Left Behind", text: "Win a planet without losing a drone.", check: c => won(c) && c.mission.stats.dronesLost === 0 },
  { id: "storm-chaser", name: "Storm Chaser", text: "Ride out 6 hazards in one mission.", check: c => (c.mission?.stats.hazardEvents || 0) >= 6 },
  { id: "demolition", name: "Demolition Swarm", text: "Destroy 25 defenses in total.", check: c => c.totals.defensesDestroyed >= 25 },
  { id: "harvester", name: "Harvester", text: "Gather 1,000 matter from zones, salvage and drilling.", check: c => c.totals.matterHarvested >= 1000 },
  { id: "perfectionist", name: "Perfectionist", text: "Earn three stars on an inhabited planet.", check: c => won(c) && c.planet.society > 0 && c.mission.stars === 3 },
  { id: "blitz", name: "Blitz", text: "Win an inhabited planet in under 5 minutes.", check: c => won(c) && c.planet.society > 0 && c.mission.time < 300 },
  { id: "hive-ascendant", name: "Hive Ascendant", text: "Conquer every planet in the campaign.", check: c => planets.every(p => c.captured[p.id]) },
]);

const won = (c) => c.mission?.outcome === "won";

// progress: saved campaign progress. mission: missionResult() of the mission being played or
// just finished, or null. addMission: true while the mission is still running (its stats are
// not in the saved totals yet), false once applyMissionResult has folded them in.
export function achievementContext(progress, planet, mission = null, addMission = false) {
  const totals = { ...progress.stats };
  if (mission && addMission) for (const key of Object.keys(totals)) totals[key] += mission.stats?.[key] || 0;
  const unlocks = new Set([...progress.unlocks, ...(mission?.recovered || [])]);
  const captured = { ...progress.captured };
  if (won({ mission })) captured[planet.id] = true;
  return { totals, mission, planet, unlocks, captured };
}

export function newAchievements(progress, context) {
  return achievements.filter(a => !progress.achievements[a.id] && a.check(context));
}

// Returns a copy of progress with these achievements recorded at time `now` (ms).
export function recordAchievements(progress, earned, now = Date.now()) {
  if (!earned.length) return progress;
  const next = structuredClone(progress);
  for (const a of earned) next.achievements[a.id] = now;
  return next;
}
