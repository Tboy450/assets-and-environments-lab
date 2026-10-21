// Entry point: loads the panels (each wires its own controls) and runs the frame loop.
import { smoothCameraPose } from "./flight-camera.mjs?v=dev";
import { advanceRest, stepFlight } from "./flight-model.mjs?v=dev";
import { planActive } from "./flight-plan.mjs?v=dev";
import { canAccelerateScience } from "./science.mjs?v=dev";
import { canAccelerateOperations } from "./operations.mjs?v=dev";
import { state } from "./ui/context.mjs?v=dev";
import "./ui/persistence.mjs?v=dev";
import { drawFlight } from "./ui/flight-view.mjs?v=dev";
import { drawChart } from "./ui/chart.mjs?v=dev";
import { updateReadouts, updateTrack } from "./ui/readouts.mjs?v=dev";
import { updateLayerPanel } from "./ui/layers-panel.mjs?v=dev";
import "./ui/vehicle-references.mjs?v=dev";
import { updatePilotHud } from "./ui/pilot-hud.mjs?v=dev";
import { updateExpeditionPanel } from "./ui/expedition-panel.mjs?v=dev";
import "./ui/science-panel.mjs?v=dev";
import { updateOperationsPanel } from "./ui/operations-panel.mjs?v=dev";
import { updatePlanPanel, updatePlanStrip } from "./ui/plan-panel.mjs?v=dev";
import "./ui/controls.mjs?v=dev";
import { stepArrival } from "./ui/arrival.mjs?v=dev";
import { updateSound } from "./ui/sound.mjs?v=dev";
import { finishNight, sleepStepSeconds, updateDayLog } from "./titan-day.mjs?v=dev";
import { updateDayStrip } from "./ui/day-strip.mjs?v=dev";
import { updateBackdropPicker } from "./ui/mission-backdrop.mjs?v=dev";

let readoutTime = 0;
let planPanelTime = 0;
// The next frame is requested first, so an error while drawing one frame can never stop the loop,
// and at most one frame is ever pending.
let frameRequested = false;
function scheduleFrame() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame((time) => { frameRequested = false; tick(time); });
}

function tick(now) {
  scheduleFrame();
  const dt = Math.min(0.05, (now - state.lastTick) / 1000);
  state.lastTick = now;
  // Accelerated science uses ordinary physics steps, including heat, energy and weather.
  if (!planActive(state) && !state.downlinkActive && !canAccelerateScience(state) && !canAccelerateOperations(state)) state.timeWarp = 1;
  if (state.edl) {
    stepArrival(dt);
  } else if (state.restSeconds > 0 && !state.hold) {
    advanceRest(state, state.wakeAtMorning ? sleepStepSeconds : undefined);
  } else for (let step = 0; step < state.timeWarp; step += 1) {
    stepFlight(state, dt);
    if (!planActive(state) && !state.downlinkActive && !canAccelerateScience(state) && !canAccelerateOperations(state)) { state.timeWarp = 1; break; }
  }
  if (!state.edl) { updateDayLog(state); finishNight(state); }
  smoothCameraPose(state, dt);
  if (state.edl) {
    // The arrival sequence flies its own slow orbit around the descending vehicle.
    Object.assign(state.renderPose, { azimuth: state.edl.cameraAzimuth, elevation: state.edl.cameraElevation });
  }
  if (now - readoutTime > 100) {
    updateReadouts();
    updateTrack();
    updatePlanStrip();
    updateLayerPanel();
    updateDayStrip();
    updateBackdropPicker();
    updatePilotHud();
    updateExpeditionPanel();
    updateOperationsPanel();
    document.querySelectorAll("[data-warp]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.warp) === state.timeWarp)));
    if (now - planPanelTime > 300) { updatePlanPanel(); planPanelTime = now; }
    drawChart();
    readoutTime = now;
  }
  drawFlight();
  updateSound();
}



if (["localhost", "127.0.0.1"].includes(location.hostname)) window.dragonflyTick = tick;
state.lastTick = performance.now();
scheduleFrame();
