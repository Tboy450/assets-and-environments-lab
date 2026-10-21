// Flight buttons, sticks, keyboard, camera modes, view switch and the other form controls.
import { enterFreeCamera, orbitCamera, zoomCamera } from "../flight-camera.mjs?v=dev";
import { commandFlight, model, takeManualControl } from "../flight-model.mjs?v=dev";
import { missionAction, startRest, toggleDownlink } from "../mission-systems.mjs?v=dev";
import { setFixedWind, setWeatherMode, startStormTraining } from "../weather.mjs?v=dev";
import { samplingSequence } from "../science.mjs?v=dev";
import { focusInspector, inspectionAvailable } from "../vehicle-inspector.mjs?v=dev";
import { closePilotFullscreen, updatePilotLayout } from "./pilot-layout.mjs?v=dev";
import { $, chaseRenderer, clamp, flightCanvas, state } from "./context.mjs?v=dev";
import { updateReadouts } from "./readouts.mjs?v=dev";
import { updateLayerPanel } from "./layers-panel.mjs?v=dev";

function setMode(mode) {
  commandFlight(state, mode);
}


function bindPilotStick(nubId, kind) {
  const nub = $(nubId);
  const pad = nub.closest(".pilot-stick-box, .stick-box");
  let activePointer = null;
  let origin = null;

  // Inputs are relative to where the finger lands, so a touch never snaps the sticks.
  const applyPointer = (event) => {
    const rect = pad.getBoundingClientRect();
    const travel = Math.max(1, rect.width * 0.34);
    const x = (event.clientX - origin.x) / travel;
    const y = (event.clientY - origin.y) / travel;
    if (kind === "left") {
      state.yawCmd = clamp(origin.yaw + x, -1, 1);
      // Moving the throttle hands altitude back to the pilot; steering alone keeps a button's hold.
      if (Math.abs(y) > 0.02) {
        state.altitudeHold = null;
        state.throttle = clamp(origin.throttle - y / 2, 0, 1);
      }
    } else {
      state.rollCmd = clamp(origin.roll + x, -1, 1);
      state.pitchCmd = clamp(origin.pitch - y, -1, 1);
    }
  };

  pad.addEventListener("pointerdown", (event) => {
    if (activePointer !== null) return;
    activePointer = event.pointerId;
    pad.setPointerCapture(event.pointerId);
    takeManualControl(state);
    // Grabbing a stick changes nothing until the finger moves, wherever it lands on the pad.
    origin = { x: event.clientX, y: event.clientY, throttle: state.throttle, yaw: state.yawCmd, pitch: state.pitchCmd, roll: state.rollCmd };
  });

  pad.addEventListener("pointermove", (event) => {
    if (event.pointerId === activePointer) applyPointer(event);
  });

  const release = (event) => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    if (kind === "left") {
      state.yawCmd = 0;
      if (state.throttleSpring) {
        state.throttle = model.hoverThrottle;
        state.altitudeHold = null;
      }
    } else {
      state.pitchCmd = 0;
      state.rollCmd = 0;
    }
  };

  pad.addEventListener("pointerup", release);
  pad.addEventListener("pointercancel", release);
  pad.addEventListener("lostpointercapture", release);
}

function setThrottleSpring(enabled) {
  state.throttleSpring = enabled;
  try { localStorage.setItem("dragonfly-throttle-spring", enabled ? "1" : "0"); } catch { /* preference is optional */ }
  document.querySelectorAll("[data-throttle-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "Throttle: centering" : "Throttle: sticky";
  });
}

function setCameraMode(mode) {
  if (mode === "free" && !chaseRenderer) return;
  if (mode === "free" && state.cameraMode !== "free") enterFreeCamera(state);
  state.cameraMode = mode;
  document.body.classList.toggle("free-camera", mode === "free");
  const fixedButton = $("fixed-camera-button");
  const freeButton = $("free-camera-button");
  fixedButton.classList.toggle("active", mode === "fixed");
  freeButton.classList.toggle("active", mode === "free");
  fixedButton.setAttribute("aria-pressed", String(mode === "fixed"));
  freeButton.setAttribute("aria-pressed", String(mode === "free"));
}

function bindFreeCamera() {
  let activePointer = null;
  let lastX = 0;
  let lastY = 0;
  // Two fingers on the canvas pinch-zoom; one finger (or the mouse) orbits.
  const touches = new Map();
  let pinchSpan = 0;
  const span = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const freeView = () => state.view === "pilot" && state.cameraMode === "free";

  flightCanvas.addEventListener("pointerdown", (event) => {
    if (!freeView()) return;
    if (event.pointerType === "touch") {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) { activePointer = null; pinchSpan = span(); return; }
    }
    if (activePointer !== null || touches.size > 1) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    activePointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    flightCanvas.setPointerCapture(event.pointerId);
  });

  flightCanvas.addEventListener("pointermove", (event) => {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2 && freeView()) {
      const now = span();
      if (pinchSpan > 0 && now > 0) zoomCamera(state, pinchSpan / now);
      pinchSpan = now;
      return;
    }
    if (event.pointerId !== activePointer || !freeView()) return;
    const rect = flightCanvas.getBoundingClientRect();
    orbitCamera(state, event.clientX - lastX, event.clientY - lastY, rect.width, rect.height);
    lastX = event.clientX;
    lastY = event.clientY;
  });

  flightCanvas.addEventListener("wheel", (event) => {
    if (!freeView()) return;
    event.preventDefault();
    zoomCamera(state, Math.exp(Math.max(-200, Math.min(200, event.deltaY)) * 0.0015));
  }, { passive: false });

  const release = (event) => {
    touches.delete(event.pointerId);
    if (touches.size < 2) pinchSpan = 0;
    if (event.pointerId === activePointer) activePointer = null;
  };

  flightCanvas.addEventListener("pointerup", release);
  flightCanvas.addEventListener("pointercancel", release);
  flightCanvas.addEventListener("lostpointercapture", release);
}

export function setView(view) {
  if (view !== "pilot") closePilotFullscreen();
  state.view = view;
  document.body.classList.toggle("pilot-view", view === "pilot");
  const missionButton = $("mission-view-button");
  const pilotButton = $("pilot-view-button");
  missionButton.classList.toggle("active", view === "mission");
  pilotButton.classList.toggle("active", view === "pilot");
  missionButton.setAttribute("aria-pressed", String(view === "mission"));
  pilotButton.setAttribute("aria-pressed", String(view === "pilot"));
  updatePilotLayout();
}


$("wind-slider").addEventListener("input", (event) => {
  setFixedWind(state, Number(event.target.value));
});
$("weather-mode").addEventListener("change", event => {
  setWeatherMode(state, event.target.value);
  $("weather-feedback").textContent = "";
});
$("weather-training").addEventListener("click", () => {
  $("weather-feedback").textContent = startStormTraining(state);
});

$("payload-slider").addEventListener("input", (event) => {
  state.payloadDelta = Number(event.target.value);
});

$("mission-action").addEventListener("click", () => { missionAction(state); updateReadouts(); });
$("systems-button").addEventListener("click", () => $("systems-dialog").showModal());
$("close-systems").addEventListener("click", () => $("systems-dialog").close());
$("thermal-auto").addEventListener("change", (event) => {
  state.thermalAuto = event.target.checked;
  state.trimClock = 0;
  $("trim-control").disabled = state.thermalAuto;
});
$("trim-control").addEventListener("input", (event) => { state.trim = Number(event.target.value) / 100; });
$("fan-control").addEventListener("input", (event) => { state.fan = Number(event.target.value) / 100; });
$("rtg-scenario").addEventListener("change", event => { state.arrivalElectricW = Number(event.target.value); });
$("fault-control").addEventListener("change", (event) => { state.fault = event.target.value; });
$("rest-hour").addEventListener("click", () => startRest(state, 1));
$("rest-night").addEventListener("click", () => startRest(state, 192));
$("downlink-toggle").addEventListener("click", () => { toggleDownlink(state); });
$("rest-stop").addEventListener("click", () => { state.restSeconds = 0; state.restNotice = ""; state.hibernating = false; });

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.command));
});
$("mission-view-button").addEventListener("click", () => setView("mission"));
$("pilot-view-button").addEventListener("click", () => setView("pilot"));
$("inspect-sample").addEventListener("click", () => {
  state.vehicleModel = "research";
  state.missionLayer = "internal";
  state.selectedPart = samplingSequence(state).part;
  focusInspector(state, state.selectedPart);
  setView("mission");
  updateReadouts();
  updateLayerPanel();
  $("component-temperatures").open = true;
  flightCanvas.scrollIntoView({ block: "center" });
  document.querySelector('[data-layer="internal"]').focus({ preventScroll: true });
});
$("fixed-camera-button").addEventListener("click", () => setCameraMode("fixed"));
$("free-camera-button").addEventListener("click", () => setCameraMode("free"));
$("zoom-in-button").addEventListener("click", () => zoomCamera(state, 1 / 1.35));
$("zoom-out-button").addEventListener("click", () => zoomCamera(state, 1.35));
bindPilotStick("pilot-left-stick", "left");
bindPilotStick("pilot-right-stick", "right");
bindPilotStick("left-stick", "left");
bindPilotStick("right-stick", "right");
bindFreeCamera();

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target === flightCanvas && inspectionAvailable(state)) return;
  if ($("systems-dialog").open || $("plan-dialog").open) return;
  if (event.target.matches("input, select, textarea, button, a, summary, video") || event.target.closest("#vehicle-references") || event.target.isContentEditable) return;
  const step = event.shiftKey ? 0.08 : 0.04;
  const keys = ["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  takeManualControl(state);
  if (event.key === "w" || event.key === "s" || event.key === " ") state.altitudeHold = null;
  if (event.key === "w") state.throttle = clamp(state.throttle + step, 0, 1);
  if (event.key === "s") state.throttle = clamp(state.throttle - step, 0, 1);
  if (event.key === "a") state.yawCmd = clamp(state.yawCmd - step, -1, 1);
  if (event.key === "d") state.yawCmd = clamp(state.yawCmd + step, -1, 1);
  if (event.key === "ArrowUp") state.pitchCmd = clamp(state.pitchCmd + step, -1, 1);
  if (event.key === "ArrowDown") state.pitchCmd = clamp(state.pitchCmd - step, -1, 1);
  if (event.key === "ArrowLeft") state.rollCmd = clamp(state.rollCmd - step, -1, 1);
  if (event.key === "ArrowRight") state.rollCmd = clamp(state.rollCmd + step, -1, 1);
  if (event.key === " ") {
    // Level off: centre the attitude sticks and set the throttle to hold altitude.
    state.pitchCmd = 0;
    state.rollCmd = 0;
    state.yawCmd = 0;
    state.throttle = model.hoverThrottle;
  }
});

document.querySelectorAll("[data-throttle-mode]").forEach((button) => {
  button.addEventListener("click", () => setThrottleSpring(!state.throttleSpring));
});
setThrottleSpring(state.throttleSpring);
document.querySelectorAll("[data-reverse-brake]").forEach(button => {
  button.addEventListener("click", () => {
    state.reverseBrakeEnabled = !state.reverseBrakeEnabled;
    if (!state.reverseBrakeEnabled) state.reverseBrakeActive = false;
    updateReadouts();
  });
});

function setVehicleModel(choice) {
  state.vehicleModel = choice;
  try { localStorage.setItem("dragonfly-vehicle-model", choice); } catch { /* preference is optional */ }
  $("model-toggle").textContent = choice === "research" ? "Model: NASA / APL" : "Model: original";
  $("model-toggle").setAttribute("aria-pressed", String(choice === "research"));
}
$("model-toggle").addEventListener("click", () => setVehicleModel(state.vehicleModel === "research" ? "original" : "research"));
setVehicleModel(state.vehicleModel);
if (!chaseRenderer) $("model-toggle").hidden = true;
