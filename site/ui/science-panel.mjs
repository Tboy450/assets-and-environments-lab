// Science Payload panel: instrument states, sampling, science log and data store.
import { landed, systemsModel } from "../mission-systems.mjs?v=dev";
import { canSampleHere, gnsUncertainty, groundTypeAt, scienceModel, startSample, samplingSequence, selectScienceProgram, cancelSample, canAccelerateScience, sampleTransmission } from "../science.mjs?v=dev";
import { scienceProgram } from "../science-programs.mjs?v=dev";
import { $, formatTime, state } from "./context.mjs?v=dev";

let stagesKey = "", recordCount = -1;

// ---- Science payload ----
export function updateScience(d) {
  const s = state.science;
  const job = samplingSequence(state);
  const program = job.program;
  const ground = landed(state) ? groundTypeAt(state.positionX, state.positionZ) : null;
  $("drams-state").textContent = s.sampling ? job.index >= 3 ? job.label : "Awaiting sample cup" : s.samples.length ? `${s.samples.length} sample${s.samples.length === 1 ? "" : "s"} analyzed` : "Ready";
  $("draco-state").textContent = s.sampling ? job.index >= 3 ? "Stowed / sample delivered" : job.label : ground ? "Ready to drill" : "Stowed";
  $("science-program").disabled = s.sampling || state.mission.phase === "sampling";
  $("science-program").value = s.programId ?? "demo";
  $("sample-cancel").hidden = !s.sampling;
  $("science-warp").hidden = !canAccelerateScience(state) || program.id === "demo";
  $("science-budget").textContent = `${program.label}: ${formatTime(program.seconds)} simulation time; ${program.energyWh.toFixed(1)} Wh instrument energy; up to ${Math.max(...program.stages.map(stage => stage.watts))} W stage load; ${program.dataMbit} Mbit result. All estimated. Vehicle housekeeping and radio loads are additional.`;
  const stageText = `${job.label}${job.active && state.hold ? " / paused" : ""}`;
  if ($("sampling-stage").textContent !== stageText) $("sampling-stage").textContent = stageText;
  $("sampling-clock").textContent = program.id === "demo" ? `${Math.floor(job.elapsed)} / ${job.duration} s` : `${formatTime(job.elapsed)} / ${formatTime(job.duration)}`;
  $("sampling-meter").max = job.duration;
  $("sampling-meter").value = job.elapsed;
  if (stagesKey !== program.id) {
    stagesKey = program.id;
    const short = { drill: "Drill", transfer: "Transfer", carousel: "Position cup", condition: "Prepare", analysis: "Analyze", cooldown: "Cooldown" };
    $("sampling-stages").replaceChildren(...job.stages.map(stage => {
      const item = document.createElement("li"); item.dataset.stage = stage.id; item.textContent = short[stage.id]; return item;
    }));
  }
  document.querySelectorAll("#sampling-stages li").forEach((item, index) => {
    item.dataset.done = String(job.complete || (job.active && index < job.index));
    if (job.active && index === job.index) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  $("vehicle-sample-status").hidden = !job.active || state.vehicleModel === "original";
  $("vehicle-sample-status").textContent = `${stageText} / ${formatTime(job.elapsed)} of ${formatTime(job.duration)}. Illustrative training sequence.`;
  $("dragns-state").textContent = ground ? `${ground.name}: ice ~${ground.ice}% / organics ~${ground.organics}% (+/-${gnsUncertainty(state).toFixed(0)}%)` : "Standby (counts when landed)";
  $("camera-state").textContent = state.altitude > 5 ? `Imaging: ${s.cameraFrames} frames` : `Hazcam / ${s.cameraFrames} frames`;
  $("dragmet-state").textContent = `94 K / ${d.pressureKpa.toFixed(1)} kPa / ${state.wind.toFixed(1)} m/s / CH4 ~${scienceModel.methaneHumidityPercent}% / ${s.seismicEvents} quakes`;
  const blocked = canSampleHere(state);
  $("sample-here").disabled = !!blocked;
  $("sample-here").title = blocked || `Start ${program.label.toLowerCase()} (estimated ${program.energyWh.toFixed(1)} Wh instrument budget)`;
  $("science-readiness").textContent = job.active ? `${state.hold ? "Paused" : "Running"} / ${(s.jobEnergyWh ?? 0).toFixed(1)} Wh used (instrument)` : blocked || (job.complete ? "Sample recorded / ready for next run" : "Ready for a new sample");
  const recordSelect = $("science-record");
  if (recordCount !== s.samples.length) {
    recordCount = s.samples.length;
    recordSelect.replaceChildren(...s.samples.map((sample, index) => {
      const option = document.createElement("option"); option.value = index;
      option.textContent = `${index + 1}. ${scienceProgram(sample.programId).label} / ${sample.siteId ?? "local site"}`; return option;
    }));
    if (recordCount) recordSelect.value = String(recordCount - 1);
  }
  recordSelect.disabled = !recordCount;
  $("science-record-count").textContent = String(recordCount);
  const record = s.samples[Number(recordSelect.value)];
  $("science-result").textContent = record ? `Illustrative result (${record.ground}): ${record.result}` : "No samples analyzed yet.";
  $("science-interpretation").textContent = record?.interpretation ?? (record ? "Legacy illustrative record; analysis mode was not recorded." : "");
  $("science-record-meta").textContent = record ? `Site ${record.siteId ?? "local"}; X ${Number.isFinite(record.x) ? record.x.toFixed(1) : "--"} m / Z ${Number.isFinite(record.z) ? record.z.toFixed(1) : "--"} m. Completed at ${formatTime(record.time)} simulation time. ${record.durationSeconds != null ? `${formatTime(record.durationSeconds)} run / ${record.energyWh.toFixed(1)} Wh instrument energy.` : "Legacy timing/budget unavailable."}` : "";
  $("science-record-transmission").textContent = record ? sampleTransmission(state, record) : "";
  const log = $("science-log");
  const text = s.log.map(entry => entry.text).join("|");
  if (log.dataset.text !== text) {
    log.dataset.text = text;
    log.replaceChildren(...s.log.slice(0, 5).map(entry => { const item = document.createElement("li"); item.textContent = entry.text; return item; }));
  }
  $("data-stored").textContent = `${(state.dataStoredBits / 1e6).toFixed(1)} Mbit`;
  const rate = systemsModel.downlinkW / (systemsModel.downlinkJoulesPerBitAu * systemsModel.earthRangeAu);
  $("data-eta").textContent = state.dataStoredBits > 0 ? formatTime(state.dataStoredBits / rate) : "--";
  $("downlink-warp").hidden = !state.downlinkActive;
}
$("sample-here").addEventListener("click", () => { startSample(state); });
$("science-program").addEventListener("change", event => { selectScienceProgram(state, event.target.value); });
$("sample-cancel").addEventListener("click", () => { cancelSample(state); });
