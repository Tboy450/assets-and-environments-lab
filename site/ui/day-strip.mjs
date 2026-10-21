// Titan day strip (Mission view): day number, local time, day/night bar, today's checklist and
// "Sleep until morning". The cycle itself is in ../titan-day.mjs.
import { landed, overLiquid, titanLocalHour } from "../mission-systems.mjs?v=dev";
import { dayPhase, dayProgress, sleepUntilMorning, titanDayNumber } from "../titan-day.mjs?v=dev";
import { $, state } from "./context.mjs?v=dev";

function clock(state) {
  const hour = titanLocalHour(state);
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function task(id, done, text) {
  const item = $(id);
  item.textContent = `${done ? "✓" : "○"} ${text}`;
  item.classList.toggle("done", !!done);
}

export function updateDayStrip() {
  const log = state.dayLog || { flights: 0 };
  const phase = dayPhase(state);
  $("day-title").textContent = `Titan day ${titanDayNumber(state)}`;
  $("day-time").textContent = `${clock(state)} local / ${phase}${phase === "Night" ? " (Earth below horizon)" : " (Earth in view)"}`;
  $("day-marker").style.left = `${(dayProgress(state) * 100).toFixed(1)}%`;
  task("day-task-downlink", log.downlinked, "Send data home");
  task("day-task-flight", log.flights > 0, log.flights > 1 ? `${log.flights} flights (plan: 1)` : "One flight");
  $("day-task-flight").classList.toggle("over", log.flights > 1);
  task("day-task-science", log.sampled, "Sample science");
  const sleeping = state.wakeAtMorning && state.hibernating;
  const sampling = state.mission.phase === "sampling" || state.science?.sampling;
  const canSleep = !state.edl && landed(state) && !overLiquid(state.positionX, state.positionZ) && !state.hold && !sampling && state.restSeconds === 0;
  const button = $("day-sleep");
  button.disabled = sleeping || !canSleep;
  button.textContent = sleeping ? `Sleeping: morning in ${Math.max(0, state.restSeconds / 3600).toFixed(0)} h` : "Sleep until morning";
}

$("day-sleep").addEventListener("click", () => { if (sleepUntilMorning(state)) updateDayStrip(); });
