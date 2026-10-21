// Arrival at Titan opening sequence (timeline in ../edl.mjs).
import { edlDuration, edlStateAt, formatAltitude, formatSinceEntry } from "../edl.mjs?v=dev";
import { abortPlan } from "../flight-plan.mjs?v=dev";
import { $, chaseRenderer, state } from "./context.mjs?v=dev";
import { setView } from "./controls.mjs?v=dev";
import { restored } from "./persistence.mjs?v=dev";

// ---- Arrival at Titan: entry, descent and landing opening sequence (timeline in edl.mjs) ----
let arrivalReturnView = "mission";

function startArrival() {
  if (!chaseRenderer) return;
  arrivalReturnView = state.edl ? arrivalReturnView : state.view;
  abortPlan(state, "Flight plan stopped for the arrival sequence");
  Object.assign(state, {
    auto: false, altitudeHold: null, positionX: 0, positionZ: 0, heading: 84, speed: 0, verticalSpeed: 0,
    pitch: 0, roll: 0, yaw: 0, hold: false, restSeconds: 0, hibernating: false, downlinkActive: false, antennaDeploy: 0,
    edlTime: 0, edl: edlStateAt(0),
  });
  state.mission.guidance = false;
  setView("pilot");
  document.body.classList.add("arrival");
  $("arrival-overlay").hidden = false;
}

function finishArrival() {
  state.edl = null;
  document.body.classList.remove("arrival");
  $("arrival-overlay").hidden = true;
  Object.assign(state, { altitude: 0, verticalSpeed: 0, speed: 0, throttle: 0.18, pitch: 0, roll: 0, yaw: 0, auto: false, altitudeHold: null, mode: "Surface" });
  state.mission.message = "Landed at base, in an interdune of Ahmakiq Undae. Begin the First expedition, try the optional quick survey, or plan a flight.";
  try { localStorage.setItem("dragonfly-arrival-seen", "1"); } catch { /* optional */ }
  setView(arrivalReturnView);
}

export function stepArrival(dt) {
  state.edlTime += dt;
  const e = state.edl = edlStateAt(state.edlTime);
  const underCanopy = e.chute !== "none" && !e.released;
  state.altitude = e.renderAltitudeM;
  state.verticalSpeed = 0;
  state.speed = 0;
  // Entry spin is 2 rpm (12 deg/s), shown at a third of that speed; the rotors despin it.
  state.heading = (state.heading + e.spinRate * 4 * dt + 360) % 360;
  state.pitch = underCanopy ? Math.sin(state.edlTime * 0.9) * 0.08 : 0;
  state.roll = underCanopy ? Math.cos(state.edlTime * 0.7) * 0.06 : 0;
  const rpm = 700 * e.rotorSpin;
  state.rotorRpm = state.rotorRpm.map(() => rpm);
  state.rotorPhase = state.rotorPhase.map((phase, index) => (phase + rpm * Math.PI / 30 * dt * (index % 2 === 0 ? 1 : -1)) % (Math.PI * 2));
  state.mode = e.title;
  $("arrival-title").textContent = e.title;
  $("arrival-detail").textContent = e.detail;
  $("arrival-altitude").textContent = formatAltitude(e.altitudeM);
  $("arrival-time").textContent = formatSinceEntry(e.sinceEntryS);
  $("arrival-progress").style.width = `${(e.t / edlDuration * 100).toFixed(1)}%`;
  if (e.done) finishArrival();
}

$("arrival-skip").addEventListener("click", finishArrival);
$("arrival-replay").addEventListener("click", () => { window.scrollTo(0, 0); startArrival(); });
let arrivalSeen = false;
try { arrivalSeen = localStorage.getItem("dragonfly-arrival-seen") === "1"; } catch { arrivalSeen = true; }
// A restored mission resumes where it was; the arrival only plays on a fresh first visit.
if (!arrivalSeen && !restored) startArrival();
