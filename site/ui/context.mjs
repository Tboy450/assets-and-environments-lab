// Shared live state, page helpers and the 3D renderer used by every panel.
import { createChaseRenderer } from "../chase-vehicle.mjs?v=dev";
import { createFlightState, deriveFlight } from "../flight-model.mjs?v=dev";
import { createInspector } from "../vehicle-inspector.mjs?v=dev";

export const state = {
  ...createFlightState({ weatherSeed: crypto.getRandomValues(new Uint32Array(1))[0] }),
  view: "mission",
  cameraMode: "fixed",
  cameraYaw: 0,
  cameraPitch: 0.10,
  throttleSpring: readThrottlePreference(),
  vehicleModel: readVehicleModelPreference(),
  missionLayer: "exterior", thermalRange: "full", selectedPart: null,
  inspector: createInspector(),
  lastTick: performance.now(),
};

// Local development only: expose the live state for inspection from the browser console.
if (["localhost", "127.0.0.1"].includes(location.hostname)) window.dragonflyState = state;

// The research-based vehicle model is the default; the original demo model stays available to compare.
function readVehicleModelPreference() {
  try { return localStorage.getItem("dragonfly-vehicle-model") === "original" ? "original" : "research"; } catch { return "research"; }
}

// Throttle stays where the pilot leaves it unless the optional spring-to-hover mode is chosen.
function readThrottlePreference() {
  try { return localStorage.getItem("dragonfly-throttle-spring") === "1"; } catch { return false; }
}

export const $ = (id) => document.getElementById(id);
export const flightCanvas = $("flight-canvas");

export let chaseRenderer;
try {
  chaseRenderer = createChaseRenderer();
} catch (error) {
  console.warn("3D rendering unavailable; using the fixed flight view.", error);
  $("free-camera-button").disabled = true;
  $("free-camera-button").title = "Free camera requires WebGL 2";
}
if (["localhost", "127.0.0.1"].includes(location.hostname)) window.dragonflyRenderer = chaseRenderer;

export const derived = () => deriveFlight(state);
// In automatic modes the sticks mirror the aircraft; in manual they show the pilot's command.
const manualControl = () => !state.auto && !state.mission.guidance;
export const stickYaw = () => manualControl() ? state.yawCmd : state.yaw;
export const stickPitch = () => manualControl() ? state.pitchCmd : state.pitch;
export const stickRoll = () => manualControl() ? state.rollCmd : state.roll;

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor(s % 86400 / 3600).toString().padStart(2, "0")}:${Math.floor(s % 3600 / 60).toString().padStart(2, "0")}`;
  if (s >= 3600) return `${Math.floor(s / 3600)}:${Math.floor(s % 3600 / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const minutes = Math.floor(s / 60).toString().padStart(2, "0");
  const rest = (s % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
