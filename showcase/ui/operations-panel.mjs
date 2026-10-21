import { addOperation, canAccelerateOperations, clearOperations, editOperation, operationLabel, operationLimit, pauseOperations, runOperations } from "../operations.mjs?v=dev";
import { $, formatTime, state } from "./context.mjs?v=dev";
import { model } from "../flight-model.mjs?v=dev";

let listKey = "";
export function updateOperationsPanel() {
  const q = state.operations, running = q.status === "running";
  $("operations-count").textContent = `${q.index} / ${q.items.length}`;
  let message = `${running && state.hold ? "Simulation paused" : q.status}: ${q.message}`;
  if (!q.items.length) message = "No operations queued";
  if (q.active?.kind === "recharge") {
    const remainingWh = Math.max(0, q.items[q.index].target - state.battery) * model.batteryEnergyKwh * 10;
    message += ` / ${state.battery.toFixed(1)}% / ${Math.max(0, state.netBatteryW).toFixed(0)} W net`;
    if (state.netBatteryW > 0) message += ` / ~${formatTime(remainingWh / state.netBatteryW * 3600)} remaining (est.)`;
  }
  const status = $("operations-status");
  if (status.textContent !== message) status.textContent = message;
  $("operations-run").disabled = running || q.index >= q.items.length;
  $("operations-run").lastChild.textContent = q.status === "paused" ? "Resume queue" : "Run queue";
  $("operations-pause").disabled = !running;
  $("operations-clear").disabled = !q.items.length;
  $("operation-add").disabled = running || q.items.length >= operationLimit;
  $("operation-kind").disabled = running;
  $("operation-target").disabled = running;
  $("operation-target-label").hidden = $("operation-kind").value !== "recharge";
  $("operations-warp").hidden = !canAccelerateOperations(state);
  const key = JSON.stringify([q.items, q.index, running]);
  if (listKey === key) return;
  listKey = key;
  $("operations-list").replaceChildren(...q.items.map((item, index) => {
    const row = document.createElement("li");
    const title = document.createElement("strong"); title.textContent = operationLabel(item);
    const status = document.createElement("span"); status.textContent = item.status;
    const actions = document.createElement("div"); actions.className = "operations-item-actions";
    for (const [label, direction] of [["Earlier", -1], ["Later", 1], ["Remove", null]]) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = label;
      button.setAttribute("aria-label", `${label}: operation ${index + 1}, ${operationLabel(item)}`);
      button.disabled = running || index < q.index || (direction === -1 && index === q.index) || (direction === 1 && index === q.items.length - 1);
      button.addEventListener("click", () => { editOperation(state, index, direction); updateOperationsPanel(); });
      actions.append(button);
    }
    row.dataset.status = item.status; row.append(title, status, actions); return row;
  }));
}
$("operation-kind").addEventListener("change", updateOperationsPanel);
$("operation-add").addEventListener("click", () => { addOperation(state, $("operation-kind").value, Number($("operation-target").value)); updateOperationsPanel(); });
$("operations-run").addEventListener("click", () => { runOperations(state); updateOperationsPanel(); });
$("operations-pause").addEventListener("click", () => { pauseOperations(state); updateOperationsPanel(); });
$("operations-clear").addEventListener("click", () => { clearOperations(state); updateOperationsPanel(); });

// Capture before existing button handlers so their explicit manual action wins.
for (const id of ["sample-here", "sample-cancel", "downlink-toggle", "rest-stop", "rest-hour", "rest-night", "day-sleep", "mission-action", "expedition-action", "plan-uplink"]) {
  $(id).addEventListener("click", event => {
    if (id === "expedition-action" && state.expedition.status === "complete") return;
    const alreadyStops = (id === "downlink-toggle" && state.operations.active?.kind === "downlink" && state.downlinkActive)
      || (id === "expedition-action" && state.operations.active?.kind === "recharge" && state.hibernating);
    if (pauseOperations(state, "Manual operation took control; review before resuming") && alreadyStops) event.stopImmediatePropagation();
  }, { capture: true });
}
$("science-program").addEventListener("change", () => { pauseOperations(state, "Analysis selection changed; review before resuming"); }, { capture: true });
