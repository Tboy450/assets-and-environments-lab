// First expedition: an illustrative science exercise, not a real mission operations plan.
import { candidateSites, landed } from "./mission-systems.mjs?v=dev";
import { createPlan, addWaypoint, planActive } from "./flight-plan.mjs?v=dev";
import { scienceModel } from "./science.mjs?v=dev";

export const expeditionSites = Object.freeze([
  Object.freeze({ id: "base", label: "Base: dry organic sand", question: "Establish a dry-sand baseline for comparison." }),
  Object.freeze({ id: "damp", label: "Rain-darkened interdune", question: "Compare methane-wetted sand with the dry baseline." }),
  Object.freeze({ id: "outcrop", label: "Ice-rich outcrop", question: "Look for differences between exposed water ice and organic sand." }),
]);

export const expeditionStages = Object.freeze([
  { id: "baseline", siteId: "base", kind: "sample", title: "Collect the baseline", why: expeditionSites[0].question },
  { id: "scout", siteId: "damp", kind: "scout", title: "Scout, then return", why: "Image the rain-darkened site from above, then land at base. A later flight can land at the newly scouted site." },
  { id: "damp", siteId: "damp", kind: "sample", title: "Sample the rain-darkened site", why: expeditionSites[1].question },
  { id: "outcrop", siteId: "outcrop", kind: "sample", title: "Sample the ice-rich outcrop", why: expeditionSites[2].question },
  { id: "return", siteId: "base", kind: "return", title: "Return to base", why: "Finish the traverse on known ground. Check battery and temperature margins before uplinking each flight." },
  { id: "downlink", siteId: "base", kind: "downlink", title: "Send the evidence home", why: "Samples are not returned science until their data has been downlinked. Stay landed, awake and in daylight." },
].map(Object.freeze));

export function createExpeditionState() {
  return {
    status: "idle", step: 0, startedAt: 0, finishedAt: null, nextSampleIndex: 0,
    notebook: [], energyWh: 0, startPreheatWh: 0, flightSeconds: 0, peakBatteryC: 0,
  };
}

export const expeditionSite = id => candidateSites.find(site => site.id === id);
export const atExpeditionSite = (state, id) => {
  const site = expeditionSite(id);
  return !!site && landed(state) && Math.hypot(state.positionX - site.x, state.positionZ - site.z) <= 10;
};
export const sampleReturned = (state, sample) => state.dataReturnedBits >= sample.downlinkEndBits;
export const sampleRemainingBits = (state, sample) =>
  Math.max(0, Math.min(scienceModel.sampleMbit * 1e6, sample.downlinkEndBits - state.dataReturnedBits));

export function beginExpedition(state) {
  if (state.expedition.status !== "idle") return "The expedition has already begun.";
  if (state.edl || state.hold || !landed(state) || planActive(state) || state.science.sampling || state.mission.phase === "sampling") {
    return "Finish the current activity and land, then resume the simulation to begin.";
  }
  state.expedition = {
    ...createExpeditionState(), status: "active", startedAt: state.elapsed,
    nextSampleIndex: state.science.samples.length, startPreheatWh: state.preheatWh, peakBatteryC: state.batteryC,
  };
  state.auto = false;
  state.mission.guidance = false;
  state.throttle = 0.18;
  state.altitudeHold = null;
  state.pitchCmd = 0; state.rollCmd = 0; state.yawCmd = 0;
  return "";
}

// Makes a draft only: the ordinary GO/NO-GO estimator and explicit uplink still apply.
export function prepareExpeditionRoute(state) {
  const e = state.expedition, stage = expeditionStages[e.step];
  if (e.status !== "active" || !stage || stage.kind === "downlink") return "No expedition flight is needed.";
  if (state.edl || state.hold || !landed(state) || planActive(state) || state.science.sampling || state.mission.phase === "sampling") {
    return "Land and finish the current activity before preparing a flight.";
  }
  if (stage.kind !== "scout" && !state.scoutedSites.includes(stage.siteId)) return "Scout this site before planning a landing.";
  state.plan = createPlan();
  state.plan.altitude = 40;
  if (stage.kind === "scout") {
    if (!state.scoutedSites.includes("damp")) addWaypoint(state, 0, 0, "damp");
    addWaypoint(state, 0, 0, "base");
  } else {
    addWaypoint(state, 0, 0, stage.siteId);
  }
  return "";
}

export function stepExpedition(state, dt) {
  const e = state.expedition;
  if (e.status !== "active") return;
  e.energyWh += Math.max(0, state.power - state.generatedW) * dt / 3600;
  if (state.altitude > 0.001) e.flightSeconds += dt;
  e.peakBatteryC = Math.max(e.peakBatteryC, state.batteryC);
  for (const sample of state.science.samples.slice(e.nextSampleIndex)) {
    if (expeditionSites.some(site => site.id === sample.siteId) && !e.notebook.some(entry => entry.siteId === sample.siteId)) {
      e.notebook.push({ ...sample });
    }
  }
  e.nextSampleIndex = state.science.samples.length;
  while (e.step < expeditionStages.length) {
    const stage = expeditionStages[e.step];
    const done = stage.kind === "sample" ? e.notebook.some(sample => sample.siteId === stage.siteId)
      : stage.kind === "scout" ? state.scoutedSites.includes("damp") && atExpeditionSite(state, "base")
      : stage.kind === "return" ? atExpeditionSite(state, "base")
      : e.notebook.length === expeditionSites.length && e.notebook.every(sample => sampleReturned(state, sample));
    if (!done || planActive(state)) break;
    e.step += 1;
  }
  if (e.step === expeditionStages.length) {
    e.status = "complete";
    e.finishedAt = state.elapsed;
    e.energyWh += state.preheatWh - e.startPreheatWh;
  }
}

// Only the new optional save field is checked here; older saves simply start an expedition fresh.
export function validExpedition(e) {
  return !!e && ["idle", "active", "complete"].includes(e.status)
    && Number.isInteger(e.step) && e.step >= 0 && e.step <= expeditionStages.length
    && (e.status === "complete" ? e.step === expeditionStages.length : e.step < expeditionStages.length)
    && ["startedAt", "nextSampleIndex", "energyWh", "startPreheatWh", "flightSeconds", "peakBatteryC"].every(key => Number.isFinite(e[key]))
    && (e.finishedAt === null || Number.isFinite(e.finishedAt))
    && Number.isInteger(e.nextSampleIndex) && e.nextSampleIndex >= 0
    && Array.isArray(e.notebook) && e.notebook.length <= expeditionSites.length
    && new Set(e.notebook.map(sample => sample?.siteId)).size === e.notebook.length
    && e.notebook.every(sample => sample && expeditionSites.some(site => site.id === sample.siteId)
      && ["time", "x", "z", "ice", "organics", "downlinkEndBits"].every(key => Number.isFinite(sample[key]))
      && typeof sample.ground === "string" && typeof sample.result === "string");
}
