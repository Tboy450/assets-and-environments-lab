// Saves progress in this browser and restores it on the next visit (see ../save-game.mjs).
import { SAVE_KEY, canSave, restoreState, snapshotState } from "../save-game.mjs?v=dev";
import { $, state } from "./context.mjs?v=dev";

let lastLanded = null;
let resetting = false;

function writeSave() {
  if (resetting) return;
  if (canSave(state)) lastLanded = snapshotState(state);
  if (!lastLanded) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(lastLanded)); } catch { /* storage may be unavailable */ }
}

export function restoreSavedMission() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch { saved = null; }
  if (!restoreState(state, saved)) return false;
  lastLanded = saved;
  const when = new Date(saved.savedAt);
  state.mission.message = `Welcome back: mission restored from ${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
  return true;
}

export const restored = restoreSavedMission();

// Keep the latest landed snapshot; write it every few seconds and whenever the page is left.
setInterval(writeSave, 5000);
window.addEventListener("pagehide", writeSave);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") writeSave(); });

// Start over: clear the saved mission and play the arrival (landing) sequence again.
function startOver() {
  resetting = true;
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem("dragonfly-arrival-seen");
  } catch { /* ignore */ }
  location.reload();
}

// The first tap asks for a second tap on the same button (within 4 s) instead of showing a
// browser popup, because some in-app browsers block popups and the button would do nothing.
const confirmWindowMs = 4000;
function tapTwiceToStartOver(button) {
  const label = button.textContent;
  const icon = button.hasAttribute("data-reset-icon");
  const title = button.title;
  const ariaLabel = button.getAttribute("aria-label");
  let armedUntil = 0, timer = 0;
  button.addEventListener("click", () => {
    if (performance.now() < armedUntil) { startOver(); return; }
    armedUntil = performance.now() + confirmWindowMs;
    button.textContent = icon ? "?" : "Sure? Tap again";
    if (icon) {
      button.title = "Tap again to reset the mission";
      button.setAttribute("aria-label", "Confirm mission reset: tap again");
    }
    button.classList.add("confirming");
    clearTimeout(timer);
    timer = setTimeout(() => {
      armedUntil = 0;
      button.textContent = label;
      if (icon) {
        button.title = title;
        button.setAttribute("aria-label", ariaLabel);
      }
      button.classList.remove("confirming");
    }, confirmWindowMs);
  });
}
tapTwiceToStartOver($("start-over"));
tapTwiceToStartOver($("new-mission"));
