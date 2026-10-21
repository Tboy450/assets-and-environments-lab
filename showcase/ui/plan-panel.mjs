// Flight Plan dialog, plan status strip and time-speed buttons.
import { estimateFlightPlan, model } from "../flight-model.mjs?v=dev";
import { abortPlan, addWaypoint, clearPlan, isScouted, planActive, planModel, undoWaypoint, uplinkPlan } from "../flight-plan.mjs?v=dev";
import { candidateSites, dampGround, pools } from "../mission-systems.mjs?v=dev";
import { terrainHeight } from "../titan-terrain.mjs?v=dev";
import { $, formatTime, state } from "./context.mjs?v=dev";

// ---- Flight planning (autonomous flights, leapfrog scouting) ----
const planMap = $("plan-map");
const svgNS = "http://www.w3.org/2000/svg";
let planZoomAll = true;
let planProjection = { cx: 0, cz: 0, scale: 1 };
let terrainKey = "", terrainTiles = [];

function planBounds() {
  const points = [{ x: state.positionX, z: state.positionZ }, ...state.plan.waypoints];
  if (planZoomAll) points.push(...candidateSites);
  else points.push({ x: state.positionX - 250, z: state.positionZ - 250 }, { x: state.positionX + 250, z: state.positionZ + 250 });
  const xs = points.map(p => p.x), zs = points.map(p => p.z);
  const half = Math.max(150, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 * 1.15);
  return { cx: (Math.max(...xs) + Math.min(...xs)) / 2, cz: (Math.max(...zs) + Math.min(...zs)) / 2, scale: 200 / half };
}
const toMap = (p, proj) => [200 + (p.x - proj.cx) * proj.scale, 200 + (p.z - proj.cz) * proj.scale];
const fromMap = (mx, my, proj) => ({ x: proj.cx + (mx - 200) / proj.scale, z: proj.cz + (my - 200) / proj.scale });

function svg(tag, attributes, text) {
  const node = document.createElementNS(svgNS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function niceDistance(meters) {
  const power = 10 ** Math.floor(Math.log10(meters));
  return [5, 2, 1].map(k => k * power).find(v => v <= meters) || power;
}

function renderPlanMap() {
  const proj = planProjection = planBounds();
  const nodes = [];
  const key = `${proj.cx},${proj.cz},${proj.scale}`;
  if (key !== terrainKey) {
    terrainKey = key;
    terrainTiles = [];
    for (let y = 0; y < 400; y += 16) for (let x = 0; x < 400; x += 16) {
      const point = fromMap(x + 8, y + 8, proj);
      const relief = Math.min(1, terrainHeight(point.x, point.z, 16 / proj.scale) / 70);
      terrainTiles.push({ x, y, width: 16, height: 16, fill: `rgb(${Math.round(37 + relief * 70)}, ${Math.round(35 + relief * 48)}, ${Math.round(29 + relief * 24)})` });
    }
  }
  nodes.push(...terrainTiles.map(tile => svg("rect", tile)));
  const [dx, dy] = toMap(dampGround, proj);
  nodes.push(svg("ellipse", { cx: dx, cy: dy, rx: dampGround.rx * proj.scale, ry: dampGround.rz * proj.scale, fill: "rgba(90, 110, 130, 0.2)", stroke: "rgba(150, 175, 200, 0.35)", "stroke-dasharray": "3 3" }));
  for (const pool of pools) {
    const [px, py] = toMap(pool, proj);
    nodes.push(svg("ellipse", { cx: px, cy: py, rx: Math.max(1.5, pool.rx * proj.scale), ry: Math.max(1, pool.rz * proj.scale), fill: "rgba(40, 60, 70, 0.9)" }));
  }
  for (const site of candidateSites) {
    const [x, y] = toMap(site, proj);
    const scouted = isScouted(state, site.id), color = scouted ? "#80f2ae" : "#ffb457";
    if (!scouted) nodes.push(svg("circle", { cx: x, cy: y, r: planModel.scoutRadius * proj.scale, fill: "none", stroke: color, "stroke-opacity": 0.4, "stroke-dasharray": "2 3" }));
    nodes.push(svg("circle", { cx: x, cy: y, r: Math.max(5, planModel.landingCircle * proj.scale), fill: scouted ? "rgba(128, 242, 174, 0.2)" : "rgba(255, 180, 87, 0.14)", stroke: color, "stroke-width": 1.5 }));
    const labelLeft = x > 330;
    nodes.push(svg("text", { x: labelLeft ? x - 8 : x + 8, y: y - 8, fill: color, "font-size": 11, "text-anchor": labelLeft ? "end" : "start" }, site.name));
  }
  const route = [{ x: state.positionX, z: state.positionZ }, ...state.plan.waypoints]
    .map(p => toMap(p, proj).map(n => n.toFixed(1)).join(",")).join(" ");
  nodes.push(svg("polyline", { points: route, fill: "none", stroke: "#7ce7ff", "stroke-width": 2, "stroke-dasharray": planActive(state) ? "none" : "6 4" }));
  state.plan.waypoints.forEach((point, index) => {
    const [x, y] = toMap(point, proj);
    nodes.push(svg("circle", { cx: x, cy: y, r: 9, fill: "#0b1419", stroke: index === state.plan.waypoints.length - 1 ? "#80f2ae" : "#7ce7ff", "stroke-width": 2 }));
    nodes.push(svg("text", { x, y: y + 4, fill: "#dfefff", "font-size": 10, "text-anchor": "middle" }, String(index + 1)));
  });
  const [vx, vy] = toMap({ x: state.positionX, z: state.positionZ }, proj);
  nodes.push(svg("path", { d: "M0 -9L6 7L0 3L-6 7Z", transform: `translate(${vx.toFixed(1)} ${vy.toFixed(1)}) rotate(${state.heading.toFixed(0)})`, fill: "#ffb457" }));
  const bar = niceDistance(90 / proj.scale);
  nodes.push(svg("path", { d: `M16 382v6h${(bar * proj.scale).toFixed(1)}v-6`, fill: "none", stroke: "#dfefff" }));
  nodes.push(svg("text", { x: 16, y: 376, fill: "#dfefff", "font-size": 11 }, `${bar} m`));
  nodes.push(svg("text", { x: 200, y: 16, fill: "#dfefff", "font-size": 12, "text-anchor": "middle" }, "N"));
  planMap.replaceChildren(...nodes);
}

function planSummary(report) {
  return `${report.landNow ? "Land-now response: landed" : "Landed"} at ${report.site} after ${formatTime(report.timeSeconds)}. `
    + `Energy used ${report.energyWh.toFixed(0)} Wh; battery ${report.endBattery.toFixed(1)}%, peak ${report.maxBatteryC.toFixed(1)} C. `
    + `Scouted: ${report.scouted.join(", ") || "none"}.`;
}

export function updatePlanPanel() {
  if (!$("plan-dialog").open) return;
  renderPlanMap();
  const plan = state.plan, active = planActive(state);
  const estimate = active && plan.estimate ? plan.estimate : estimateFlightPlan(state);
  const planned = plan.waypoints.length > 0;
  $("plan-distance").textContent = planned ? `${estimate.distance.toFixed(0)} m` : "--";
  $("plan-time").textContent = planned ? formatTime(estimate.timeSeconds) : "--";
  $("plan-energy").textContent = planned ? `${estimate.energyWh.toFixed(0)} Wh` : "--";
  $("plan-battery").textContent = plan.waypoints.length ? `${estimate.endBattery.toFixed(1)}%` : "--";
  $("plan-battery-temp").textContent = plan.waypoints.length ? `${estimate.endBatteryC.toFixed(1)} C` : "--";
  $("plan-scouts").textContent = estimate.scouts.join(", ") || "none";
  const verdict = $("plan-verdict");
  verdict.textContent = active ? plan.message : plan.status === "complete" ? "Flight complete" : estimate.go ? "GO: ready to uplink" : "NO-GO";
  verdict.classList.toggle("go", active || plan.status === "complete" || estimate.go);
  $("plan-issues").replaceChildren(...(active ? [] : estimate.issues).map(issue => {
    const item = document.createElement("li");
    item.className = issue.level;
    item.textContent = issue.text;
    return item;
  }));
  $("plan-uplink").disabled = active || !estimate.go;
  $("plan-uplink").textContent = plan.status === "uplinking" ? "Uplink in transit" : plan.status === "executing" ? "Flying the plan" : "Uplink plan";
  ["plan-undo", "plan-clear", "plan-altitude"].forEach(id => { $(id).disabled = active; });
  $("plan-report").hidden = !plan.report;
  if (plan.report) $("plan-report").textContent = `${planSummary(plan.report)} Estimate was ${plan.estimate.energyWh.toFixed(0)} Wh over ${formatTime(plan.estimate.timeSeconds)}.`;
}

export function updatePlanStrip() {
  const plan = state.plan;
  $("plan-strip").hidden = plan.status === "draft";
  if (plan.status === "draft") return;
  const active = planActive(state);
  $("plan-strip").dataset.active = String(active);
  let status = plan.message;
  if (plan.status === "uplinking") status = `Signal in transit: arrives in ${Math.ceil(plan.uplinkRemaining)} s (really 73-90 min one way)`;
  else if (plan.status === "executing") {
    let remaining = 0, x = state.positionX, z = state.positionZ;
    for (const point of plan.waypoints.slice(plan.leg)) { remaining += Math.hypot(point.x - x, point.z - z); x = point.x; z = point.z; }
    const eta = (plan.phase === "climb" ? (plan.altitude - state.altitude) / planModel.climbRate : 0)
      + (plan.phase === "descent" ? 0 : remaining / planModel.cruiseSpeed) + state.altitude / planModel.descentRate;
    status = `${plan.message} / ${state.altitude.toFixed(0)} m / landing in about ${formatTime(eta)}`;
  } else if (plan.report) status = planSummary(plan.report);
  $("plan-strip-title").textContent = active ? "Autonomous flight" : plan.status === "complete" ? "Flight complete" : "Flight plan stopped";
  $("plan-strip-status").textContent = status;
  document.querySelector("#plan-strip .warp-switch").hidden = !active;
  $("plan-abort").hidden = !active;
  $("plan-dismiss").hidden = active;
}

planModel.altitudeOptions.forEach(option => $("plan-altitude").append(new Option(option.label, option.value)));
export function openPlanPanel() {
  $("plan-altitude").value = state.plan.altitude;
  $("plan-dialog").showModal();
  updatePlanPanel();
}
$("plan-button").addEventListener("click", openPlanPanel);
$("close-plan").addEventListener("click", () => $("plan-dialog").close());
planMap.addEventListener("click", (event) => {
  if (planActive(state)) return;
  const point = planMap.createSVGPoint();
  point.x = event.clientX; point.y = event.clientY;
  const mapPoint = point.matrixTransform(planMap.getScreenCTM().inverse());
  const site = candidateSites.find(candidate => {
    const [x, y] = toMap(candidate, planProjection);
    return Math.hypot(x - mapPoint.x, y - mapPoint.y) <= 14;
  });
  const world = fromMap(mapPoint.x, mapPoint.y, planProjection);
  addWaypoint(state, world.x, world.z, site ? site.id : null);
  updatePlanPanel();
});
$("plan-undo").addEventListener("click", () => { undoWaypoint(state); updatePlanPanel(); });
$("plan-clear").addEventListener("click", () => { clearPlan(state); updatePlanPanel(); });
$("plan-zoom").addEventListener("click", () => {
  planZoomAll = !planZoomAll;
  $("plan-zoom").textContent = planZoomAll ? "Zoom: all sites" : "Zoom: local";
  updatePlanPanel();
});
$("plan-altitude").addEventListener("change", (event) => {
  if (!planActive(state)) state.plan.altitude = Number(event.target.value);
  updatePlanPanel();
});
$("plan-uplink").addEventListener("click", () => {
  if (uplinkPlan(state, estimateFlightPlan(state))) {
    state.timeWarp = 1;
    $("plan-dialog").close();
    updatePlanStrip();
  }
});
$("plan-abort").addEventListener("click", () => {
  abortPlan(state, "Plan stopped by the operator: holding position");
  state.altitudeHold = state.altitude > 0.5 ? state.altitude : null;
  state.pitchCmd = 0; state.rollCmd = 0; state.yawCmd = 0;
  state.throttle = model.hoverThrottle;
  updatePlanStrip();
});
$("plan-dismiss").addEventListener("click", () => {
  Object.assign(state.plan, { status: "draft", waypoints: [], report: null, message: "" });
  updatePlanStrip();
});
document.querySelectorAll("[data-warp]").forEach(button => {
  button.addEventListener("click", () => { state.timeWarp = Number(button.dataset.warp); updatePlanStrip(); });
});
