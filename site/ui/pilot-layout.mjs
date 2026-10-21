import { $, state } from "./context.mjs?v=dev";

const frame = $("flight-canvas").parentElement;
const missionHost = frame.parentElement;
const dataLayout = document.querySelector(".layout-grid");
const button = $("pilot-fullscreen");
let expanded = false;

// Measure only the controls above the flight box. Everything below it stays in normal page flow.
export function updatePilotLayout() {
  if (state.view !== "pilot") {
    if (frame.parentElement !== missionHost) missionHost.prepend(frame);
    return;
  }
  if (frame.parentElement === missionHost) dataLayout.before(frame);
  if (expanded) return;
  const top = frame.getBoundingClientRect().top + window.scrollY;
  frame.style.setProperty("--pilot-height", `${Math.max(260, window.innerHeight - top - 8)}px`);
}

function setExpanded(value) {
  expanded = value;
  document.body.classList.toggle("pilot-expanded", value);
  button.textContent = value ? "\u2199" : "\u26f6";
  button.title = value ? "Exit Pilot fullscreen" : "Enter Pilot fullscreen";
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(value));
  if (!value) updatePilotLayout();
}

export function closePilotFullscreen() {
  setExpanded(false);
  if (document.fullscreenElement === frame) document.exitFullscreen().catch(() => {});
}

button.addEventListener("click", async () => {
  if (expanded) { closePilotFullscreen(); return; }
  // Embedded browsers can deny the native API; the same button still expands within the tab.
  setExpanded(true);
  try { await frame.requestFullscreen(); } catch { /* in-tab expansion remains available */ }
});
document.addEventListener("fullscreenchange", () => setExpanded(document.fullscreenElement === frame));
window.addEventListener("keydown", event => {
  if (event.key === "Escape" && expanded && !document.fullscreenElement) closePilotFullscreen();
});
window.addEventListener("resize", updatePilotLayout);
const topControls = new ResizeObserver(updatePilotLayout);
document.querySelectorAll(".topbar, .flight-bar, .section-nav, #weather-strip, #plan-strip").forEach(element => topControls.observe(element));
