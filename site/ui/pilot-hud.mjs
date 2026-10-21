// Pilot-view systems strip; reads the same live values as the Mission panels.
import { model } from "../flight-model.mjs?v=dev";
import { flightEndurance, linkStatus } from "../mission-systems.mjs?v=dev";
import { weatherPhase } from "../weather.mjs?v=dev";
import { $, state } from "./context.mjs?v=dev";

// The Pilot view's systems strip reads the same live values as the Mission view panels.
export function updatePilotHud() {
  if (state.view !== "pilot") return;
  const endurance = flightEndurance(state, model.batteryEnergyKwh);
  $("hud-battery").textContent = `${state.battery.toFixed(0)}% / ${state.batteryC.toFixed(0)} C`;
  $("hud-bay").textContent = `${state.coreC.toFixed(0)} C`;
  $("hud-endurance").textContent = state.altitude > 0.001 ? `${endurance.minutes.toFixed(1)} min` : "Landed";
  $("hud-link").textContent = linkStatus(state).label.replace(" / ", ": ");
  const weather = state.weather;
  $("hud-weather").textContent = `${state.wind.toFixed(1)} m/s / ${weatherPhase(state)}${weather.event?.kind === "training" ? " (stress)" : ""}`;
  const plan = state.plan;
  $("hud-plan").textContent = plan.status === "draft" ? (plan.waypoints.length ? `${plan.waypoints.length} waypoints` : "None")
    : plan.status === "executing" ? `${plan.phase} (${plan.leg + 1}/${plan.waypoints.length})` : plan.status;
}
