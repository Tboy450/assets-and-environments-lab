// Local, operator-authorized training queue. Not Dragonfly flight software or a duty cycle.
import { landed, linkStatus, overLiquid, toggleDownlink } from "./mission-systems.mjs?v=dev";
import { canSampleHere, cancelSample, selectScienceProgram, startSample } from "./science.mjs?v=dev";
import { sciencePrograms } from "./science-programs.mjs?v=dev";
import { weatherPhase } from "./weather.mjs?v=dev";

export const operationLimit = 12;
export const operationKinds = Object.freeze({ demo: "Quick sample", ldms: "LDMS sample", gcms: "GCMS sample", downlink: "Downlink stored data", recharge: "Recharge" });
export const createOperations = () => ({ items: [], index: 0, status: "idle", active: null, anchor: null, message: "No operations queued" });
const sampleKind = kind => Object.hasOwn(sciencePrograms, kind);
export const operationLabel = item => item.kind === "recharge" ? `Recharge to ${item.target}%` : operationKinds[item.kind];

export function addOperation(state, kind, target = 80) {
  const q = state.operations;
  if (q.status === "running" || q.items.length >= operationLimit || !Object.hasOwn(operationKinds, kind)) return false;
  if (kind === "recharge" && (!Number.isFinite(target) || target < 20 || target > 100)) return false;
  q.items.push({ kind, target: kind === "recharge" ? target : null, status: "pending" });
  if (q.status === "complete") q.status = "idle";
  q.message = "Ready for operator review";
  return true;
}

export function editOperation(state, index, direction = null) {
  const q = state.operations;
  if (q.status === "running" || !Number.isInteger(index) || index < q.index || index >= q.items.length) return false;
  if (direction === null) q.items.splice(index, 1);
  else {
    const next = index + direction;
    if (![1, -1].includes(direction) || next < q.index || next >= q.items.length) return false;
    [q.items[index], q.items[next]] = [q.items[next], q.items[index]];
  }
  return true;
}

function stationaryReason(state) {
  if (state.edl) return "Finish arrival first";
  if (!landed(state) || state.auto || state.mission.guidance || state.throttle > 0.5 || (state.altitudeHold ?? 0) > 0 || ["uplinking", "executing"].includes(state.plan?.status)) return "Land and stop flight commands first";
  if (overLiquid(state.positionX, state.positionZ)) return "A dry landing is required";
  return "";
}
function thermalReason(state) {
  if (state.fault === "fan" || state.fanIntegrity < 0.5) return "Inspect restricted circulation";
  if (state.coreC < -20 || state.coreC > 40 || state.batteryC < 5 || state.batteryC >= 35) return "Restore safe thermal margins in Diagnostics";
  return "";
}

export function runOperations(state) {
  const q = state.operations;
  if (q.status === "running") return false;
  let reason = stationaryReason(state);
  if (!reason && state.hold) reason = "Resume the simulation first";
  if (!reason && (state.science.sampling || state.mission.phase === "sampling" || state.downlinkActive || state.hibernating || state.restSeconds > 0)) reason = "Finish or stop the current manual operation first";
  if (!reason && q.index >= q.items.length) reason = "Add an operation first";
  if (!reason && q.anchor && Math.hypot(state.positionX - q.anchor.x, state.positionZ - q.anchor.z) > 1) reason = "Queue belongs to another landing site; clear it to plan here";
  if (reason) { q.message = reason; return false; }
  q.anchor ??= { x: state.positionX, z: state.positionZ };
  q.status = "running";
  q.message = "Checking next operation";
  return true;
}

// Stop only the operation this queue owns; manual jobs outside the queue are untouched.
export function pauseOperations(state, reason = "Paused by operator; unfinished sample restarts on resume") {
  const q = state.operations;
  if (q?.status !== "running") return false;
  if (q.active?.kind === "sample" && state.science.sampling) cancelSample(state);
  if (q.active?.kind === "downlink") state.downlinkActive = false;
  if (q.active?.kind === "recharge") state.hibernating = false;
  q.active = null;
  if (q.items[q.index]) q.items[q.index].status = "pending";
  q.status = "paused";
  q.message = reason;
  state.timeWarp = 1;
  return true;
}

export function clearOperations(state) {
  pauseOperations(state);
  state.operations = createOperations();
}

function completeOperation(state) {
  const q = state.operations;
  if (q.active?.kind === "downlink") state.downlinkActive = false;
  if (q.active?.kind === "recharge") state.hibernating = false;
  q.items[q.index].status = "done";
  q.index++;
  q.active = null;
  q.message = q.index === q.items.length ? "Queue complete" : "Checking next operation";
  if (q.index === q.items.length) { q.status = "complete"; state.timeWarp = 1; }
}

export function canAccelerateOperations(state) {
  return state.operations?.status === "running" && !!state.operations.active && !stationaryReason(state) && state.restSeconds <= 0;
}

// Called before and after the normal physics step; it never advances time or charges energy.
export function stepOperations(state) {
  const q = state.operations;
  if (!q || q.status !== "running" || state.hold) return;
  // A result earned in the just-finished physics step stays complete even if that same
  // step crosses a guard. Never retry an already-produced sample after a warning.
  if ((q.active?.kind === "sample" && state.science.samples.length > q.active.sampleIndex)
    || (q.active?.kind === "downlink" && state.dataReturnedBits >= q.active.endBits)
    || (q.active?.kind === "recharge" && state.battery >= q.items[q.index].target)) {
    completeOperation(state); return;
  }
  const moved = q.anchor && Math.hypot(state.positionX - q.anchor.x, state.positionZ - q.anchor.z) > 1;
  const warning = weatherPhase(state) === "warning";
  if (warning) state.timeWarp = 1;
  const interrupted = stationaryReason(state) || (moved ? "Lander moved from the queued site" : "")
    || (state.restSeconds > 0 ? "Manual rest took control" : "") || thermalReason(state)
    || (warning && (q.active?.kind === "recharge" || state.weather?.event?.kind === "training") ? "Weather advisory: review conditions before resuming" : "");
  if (interrupted) { pauseOperations(state, interrupted); return; }
  const item = q.items[q.index];
  if (!item) { q.status = "complete"; q.message = "Queue complete"; state.timeWarp = 1; return; }
  const active = q.active;
  if (active) {
    if (active.kind === "sample") {
      if (state.science.samples.length > active.sampleIndex) completeOperation(state);
      else if (!state.science.sampling) pauseOperations(state, "Sample interrupted; review and resume to collect a fresh sample");
    } else if (active.kind === "downlink") {
      if (state.dataReturnedBits >= active.endBits) completeOperation(state);
      else if (!state.downlinkActive) pauseOperations(state, `Downlink stopped: ${linkStatus(state).label}. Resume when ready`);
    } else {
      if (state.battery >= item.target) completeOperation(state);
      else if (!state.hibernating || state.science.sampling || state.downlinkActive) pauseOperations(state, "Recharge interrupted by another operation");
      else if (state.chargingBlocked || state.generatedW <= 45 + 15 * state.fan ** 3) pauseOperations(state, "No net charging available; inspect power and temperature");
    }
    return;
  }
  if (state.science.sampling || state.mission.phase === "sampling" || state.downlinkActive || state.hibernating) {
    pauseOperations(state, "Manual operation took control; resume the queue when finished"); return;
  }
  if (sampleKind(item.kind)) {
    const blocked = canSampleHere(state);
    if (blocked) { pauseOperations(state, blocked); return; }
    selectScienceProgram(state, item.kind);
    startSample(state);
    q.active = { kind: "sample", sampleIndex: state.science.samples.length };
  } else if (item.kind === "downlink") {
    const endBits = state.dataReturnedBits + state.dataStoredBits;
    if (state.dataStoredBits <= 0) { completeOperation(state); return; }
    const link = linkStatus(state);
    if (!link.available) { pauseOperations(state, `Waiting: ${link.label}. Resume when ready`); return; }
    toggleDownlink(state);
    q.active = { kind: "downlink", endBits };
  } else {
    if (state.battery >= item.target) { completeOperation(state); return; }
    state.hibernating = true;
    q.active = { kind: "recharge" };
  }
  item.status = "running";
  q.message = operationLabel(item);
}

// Checkpoints keep the plan, not unattended execution or a partly analyzed sample.
export function savedOperations(q) {
  return {
    items: q.items.map(item => ({ ...item, status: item.status === "running" ? "pending" : item.status })),
    index: q.index, status: q.status === "running" ? "paused" : q.status, active: null,
    anchor: q.anchor ? { ...q.anchor } : null,
    message: q.status === "running" ? "Restored queue; review and resume unfinished work" : q.message,
  };
}
export function validOperations(q) {
  if (!q || !Array.isArray(q.items) || q.items.length > operationLimit || !Number.isInteger(q.index) || q.index < 0 || q.index > q.items.length || !["idle", "paused", "complete"].includes(q.status) || q.active !== null || typeof q.message !== "string" || q.message.length > 300) return false;
  if (q.anchor !== null && (!q.anchor || !Number.isFinite(q.anchor.x) || !Number.isFinite(q.anchor.z))) return false;
  if (q.status === "complete" && q.index !== q.items.length) return false;
  return q.items.every((item, index) => item && Object.hasOwn(operationKinds, item.kind)
    && item.status === (index < q.index ? "done" : "pending")
    && (item.kind === "recharge" ? Number.isFinite(item.target) && item.target >= 20 && item.target <= 100 : item.target === null));
}
