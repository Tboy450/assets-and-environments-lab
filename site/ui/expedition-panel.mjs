import { atExpeditionSite, beginExpedition, expeditionSites, expeditionStages, prepareExpeditionRoute, sampleRemainingBits, sampleReturned } from "../expedition.mjs?v=dev";
import { planActive } from "../flight-plan.mjs?v=dev";
import { landed, linkStatus, toggleDownlink } from "../mission-systems.mjs?v=dev";
import { canSampleHere, startSample } from "../science.mjs?v=dev";
import { currentScienceProgram } from "../science-programs.mjs?v=dev";
import { $, formatTime, state } from "./context.mjs?v=dev";
import { openPlanPanel } from "./plan-panel.mjs?v=dev";

function action() {
  const e = state.expedition, stage = expeditionStages[e.step];
  if (e.status === "complete") return { kind: "notebook", label: "View debrief" };
  if (state.edl) return { label: "Arrival in progress", blocked: "Skip or finish the arrival to begin." };
  if (state.hold) return { label: "Simulation paused", blocked: "Use Pause to resume." };
  if (planActive(state)) return { label: "Flight in progress", blocked: "The expedition continues after landing. Use 5x or 20x to speed up the flight." };
  if (!landed(state)) return { label: "Land to continue", blocked: "Use Land, or fly back manually. Expedition progress is kept." };
  if (state.hibernating) return { kind: "wake", label: "Wake lander" };
  if (state.science.sampling || state.mission.phase === "sampling") return { label: "Analyzing sample", blocked: "Keep the lander stationary while DrACO and DraMS work." };
  if (e.status === "idle") return { kind: "begin", label: "Begin expedition" };
  if (stage.kind === "downlink") {
    if (state.downlinkActive) return { label: "Sending science data", blocked: "Keep the link running until all three sample records are returned. Use 100x to accelerate the downlink." };
    const link = linkStatus(state);
    return { kind: "downlink", label: "Downlink science", blocked: link.available ? "" : `${link.label}. Use Diagnostics to recharge or wait for daylight.` };
  }
  if (stage.kind === "sample" && atExpeditionSite(state, stage.siteId)) {
    return { kind: "sample", label: "Collect site sample", blocked: canSampleHere(state) };
  }
  return { kind: "route", label: stage.kind === "scout" ? "Prepare scouting route" : "Prepare flight to site" };
}

function showNotebook() {
  $("expedition-notebook").open = true;
  updateExpeditionPanel();
  $("expedition-notebook").scrollIntoView({ behavior: "auto", block: "nearest" });
}

let notebookKey = "";
function updateNotebook() {
  const e = state.expedition;
  const key = JSON.stringify([e.notebook, e.status, Math.floor(state.dataReturnedBits / 1e6), Math.floor(e.energyWh), Math.floor(state.elapsed)]);
  if (key === notebookKey) return;
  notebookKey = key;
  $("expedition-records").replaceChildren(...expeditionSites.map(site => {
    const record = e.notebook.find(sample => sample.siteId === site.id);
    const article = document.createElement("article");
    const title = document.createElement("h3");
    title.textContent = site.label;
    const status = document.createElement("p");
    status.textContent = record
      ? `${sampleReturned(state, record) ? "Returned to Earth" : `${(sampleRemainingBits(state, record) / 1e6).toFixed(1)} Mbit of sample still onboard`} | MET ${formatTime(record.time)} | E ${record.x.toFixed(0)} / N ${(-record.z).toFixed(0)} m`
      : `${state.scoutedSites.includes(site.id) ? "Scouted" : "Not yet scouted"} / no expedition sample`;
    const result = document.createElement("p");
    result.textContent = record ? `Illustrative composition: ice ${record.ice}% / organics ${record.organics}%. ${record.result}` : site.question;
    article.append(title, status, result);
    return article;
  }));
  const finished = e.status === "complete";
  const elapsed = e.status === "idle" ? 0 : (e.finishedAt ?? state.elapsed) - e.startedAt;
  const energy = e.energyWh + (e.status === "active" ? state.preheatWh - e.startPreheatWh : 0);
  $("expedition-summary").textContent = `${finished ? "Expedition complete" : "Expedition so far"}: ${e.notebook.length}/3 sites sampled, ${e.notebook.filter(sample => sampleReturned(state, sample)).length}/3 records returned. `
    + `Elapsed ${formatTime(elapsed)}; flight ${formatTime(e.flightSeconds)}; battery energy used ${energy.toFixed(0)} Wh (net draw, including preheat); peak battery ${e.peakBatteryC.toFixed(1)} C.`;
  $("expedition-comparison").textContent = e.notebook.length === 3
    ? "Comparison: the illustrative outcrop is ice-rich, while both sands are organic-rich. The damp sample represents methane wetting, not a polar lake. These invented compositions do not establish the presence of life. Next question: would another outcrop show the same contrast?"
    : "Collect all three site samples to compare the dry sand, methane-wetted sand and ice-rich ground. Results are illustrative examples, not measurements from Titan.";
}

export function updateExpeditionPanel() {
  const e = state.expedition, stage = expeditionStages[e.step], next = action();
  $("expedition-title").textContent = e.status === "idle" ? "First expedition" : e.status === "complete" ? "First expedition complete" : stage.title;
  $("expedition-step").textContent = e.status === "idle" ? "3 sites / 1 science story" : e.status === "complete" ? "All science returned" : `Step ${e.step + 1} / ${expeditionStages.length}`;
  $("expedition-why").textContent = e.status === "idle" ? "Compare dry organic sand, rain-darkened ground and an ice-rich outcrop. Scout, sample and send the evidence home. Free flight remains available." : e.status === "complete" ? "Your site-linked notebook and debrief are saved with the last landed checkpoint. Continue exploring in free flight." : stage.why;
  $("expedition-hint").textContent = next.blocked || (next.kind === "route"
    ? "Prepares a suggested route. Review GO/NO-GO in Plan flight, then uplink. Recharge in Diagnostics if the margins are low."
    : next.kind === "sample" ? `${currentScienceProgram(state.science).label}: ${formatTime(currentScienceProgram(state.science).seconds)} simulated time (estimated). The site record stays onboard until downlinked.`
    : "Progress is saved on the ground. You can also fly and sample manually.");
  $("expedition-action").textContent = next.label;
  $("expedition-action").disabled = !!next.blocked;
  $("expedition-action").title = next.blocked || next.label;
  $("expedition-downlink-speed").hidden = !state.downlinkActive || e.status !== "active";
  $("expedition-notebook-count").textContent = `${e.notebook.length} / 3 sites`;
  if ($("expedition-notebook").open) updateNotebook();
}

$("expedition-action").addEventListener("click", () => {
  const next = action();
  if (next.blocked) return;
  let error = "";
  if (next.kind === "begin") error = beginExpedition(state);
  else if (next.kind === "route") {
    error = prepareExpeditionRoute(state);
    if (!error) openPlanPanel();
  } else if (next.kind === "sample") error = startSample(state);
  else if (next.kind === "downlink") {
    if (!toggleDownlink(state)) error = `Downlink unavailable: ${linkStatus(state).label}`;
  } else if (next.kind === "wake") {
    state.restSeconds = 0; state.restNotice = ""; state.hibernating = false;
  } else if (next.kind === "notebook") showNotebook();
  $("expedition-feedback").textContent = error;
  updateExpeditionPanel();
});
$("expedition-notebook").addEventListener("toggle", () => { if ($("expedition-notebook").open) updateNotebook(); });
