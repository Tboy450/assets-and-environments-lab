// Autonomous flight planning. Dragonfly is not flown in real time: one-way light time is
// 67-92 min, so flights are planned on Earth, uplinked and flown by the lander itself [PUB].
// It scouts new sites from the air and lands only at sites it has already checked
// ("leapfrog" scouting [PUB]). Rates, radii and the compressed uplink are demo choices [EST].
import { systemsModel, candidateSites, overLiquid, titanDaylight, flightRestriction, landed, landNowNeeded, batteryAfterFlight } from "./mission-systems.mjs?v=dev";
import { weatherAdvisory, weatherFlightIssue } from "./weather.mjs?v=dev";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const planModel = Object.freeze({
  maxWaypoints: 6,
  altitudeOptions: Object.freeze([
    Object.freeze({ value: 40, label: "40 m hop" }),
    Object.freeze({ value: 150, label: "150 m scouting" }),
    Object.freeze({ value: 400, label: "400 m cruise (nominal)" }),
  ]),
  defaultAltitude: 150,
  cruiseSpeed: 10, climbRate: 2.5, descentRate: 1.3,
  arrivalRadius: 8, landingCircle: 10,
  uplinkSeconds: 8,
  scoutRadius: 60, scoutMinAltitude: 20,
});

export function createPlan() {
  return {
    waypoints: [], altitude: planModel.defaultAltitude, status: "draft",
    uplinkRemaining: 0, leg: 0, phase: "", message: "", landNow: false,
    start: null, estimate: null, report: null, scouted: [],
  };
}

export const planActive = (state) => ["uplinking", "executing"].includes(state.plan?.status);
export const siteById = (id) => candidateSites.find(site => site.id === id);
export const isScouted = (state, id) => state.scoutedSites.includes(id);

// A scouted site whose safe landing circle contains the point, if any.
export function scoutedSiteAt(state, x, z) {
  return candidateSites.find(site => isScouted(state, site.id) && Math.hypot(site.x - x, site.z - z) <= planModel.landingCircle) || null;
}

function editable(plan) {
  if (planActive({ plan })) return false;
  if (plan.status !== "draft") { plan.status = "draft"; plan.waypoints = []; plan.report = null; plan.message = ""; }
  return true;
}

export function addWaypoint(state, x, z, siteId = null) {
  const plan = state.plan;
  if (!editable(plan) || plan.waypoints.length >= planModel.maxWaypoints) return false;
  const site = siteId ? siteById(siteId) : null;
  plan.waypoints.push(site ? { x: site.x, z: site.z, siteId } : { x, z, siteId: null });
  return true;
}

export function undoWaypoint(state) {
  if (editable(state.plan)) state.plan.waypoints.pop();
}

export function clearPlan(state) {
  if (editable(state.plan)) state.plan.waypoints = [];
}

function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, length2 = dx * dx + dz * dz;
  const t = length2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / length2, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

// Energy, time and heat estimate plus the GO / NO-GO checks.
// powerAt(speed, verticalSpeed) returns electrical flight power in watts.
export function estimatePlan(state, powerAt, batteryEnergyKwh) {
  const plan = state.plan, points = plan.waypoints;
  const issues = [];
  const noGo = (text) => issues.push({ level: "no-go", text });
  const caution = (text) => issues.push({ level: "caution", text });
  let distance = 0, x = state.positionX, z = state.positionZ;
  const scouts = [];
  for (const point of points) {
    distance += Math.hypot(point.x - x, point.z - z);
    if (plan.altitude >= planModel.scoutMinAltitude) {
      for (const site of candidateSites) {
        if (!isScouted(state, site.id) && !scouts.includes(site.name) && distanceToSegment(site.x, site.z, x, z, point.x, point.z) <= planModel.scoutRadius) scouts.push(site.name);
      }
    }
    x = point.x; z = point.z;
  }
  const climbSeconds = plan.altitude / planModel.climbRate;
  const cruiseSeconds = distance / planModel.cruiseSpeed;
  const descentSeconds = plan.altitude / planModel.descentRate;
  const timeSeconds = climbSeconds + cruiseSeconds + descentSeconds;
  const preheatWh = state.motorsCold ? systemsModel.preheatWh : 0;
  const flightWh = (powerAt(0, planModel.climbRate) * climbSeconds + powerAt(planModel.cruiseSpeed, 0) * cruiseSeconds
    + powerAt(1, -planModel.descentRate) * descentSeconds - state.generatedW * timeSeconds) / 3600;
  const energyWh = preheatWh + flightWh;
  const endBattery = state.battery - energyWh / (batteryEnergyKwh * 10);
  const endBatteryC = batteryAfterFlight(state, timeSeconds).c;

  if (!points.length) noGo("Add at least one waypoint. The last waypoint is the landing site.");
  if (!landed(state)) noGo("Plans start from a landed, stationary vehicle.");
  const blocked = flightRestriction(state);
  if (blocked) noGo(blocked);
  if (!titanDaylight(state)) noGo("Titan night: flights are planned for daylight.");
  if (points.length) {
    const last = points.at(-1);
    if (overLiquid(last.x, last.z)) noGo("The landing point is over liquid.");
    else if (!scoutedSiteAt(state, last.x, last.z)) noGo("Land only at a scouted site (green). Fly over a new site to scout it first.");
  }
  if (endBattery < systemsModel.reservePercent) noGo(`Battery would end at ${endBattery.toFixed(0)}%, below the ${systemsModel.reservePercent}% reserve.`);
  if (endBatteryC >= systemsModel.batteryLimitC) noGo(`Battery would reach ${endBatteryC.toFixed(0)} C (limit ${systemsModel.batteryLimitC} C).`);
  if (timeSeconds > systemsModel.plannedFlightSeconds) noGo(`Flight time ${(timeSeconds / 60).toFixed(0)} min exceeds the ~30 min longest flights.`);
  const weatherBlocked = weatherFlightIssue(state);
  if (weatherBlocked) noGo(weatherBlocked);
  else if (weatherAdvisory(state)) caution(weatherAdvisory(state));
  if (state.wind > systemsModel.maxSurfaceWind) caution("Wind is above the 1.6 m/s design maximum.");
  if (endBattery >= systemsModel.reservePercent && endBattery < systemsModel.reservePercent + 10) caution("Thin energy margin at landing.");
  return {
    distance, timeSeconds, climbSeconds, cruiseSeconds, descentSeconds, energyWh, endBattery, endBatteryC,
    scouts, issues, go: !issues.some(issue => issue.level === "no-go"),
  };
}

export function uplinkPlan(state, estimate) {
  const plan = state.plan;
  if (!estimate?.go || planActive(state)) return false;
  Object.assign(plan, {
    status: "uplinking", uplinkRemaining: planModel.uplinkSeconds, leg: 0, phase: "uplink",
    landNow: false, estimate, report: null, scouted: [], message: "Plan uplinked: in transit to Titan",
  });
  state.auto = false; state.mission.guidance = false; state.altitudeHold = null;
  state.pitchCmd = 0; state.rollCmd = 0; state.yawCmd = 0; state.downlinkActive = false;
  state.restSeconds = 0; state.hibernating = false;
  return true;
}

export function abortPlan(state, reason) {
  const plan = state.plan;
  if (!planActive(state)) return;
  plan.status = "aborted";
  plan.message = reason;
  plan.phase = "";
}

// Called every step before the flight branches: counts down the uplink and starts the flight.
export function stepPlan(state, dt) {
  const plan = state.plan;
  if (plan.status !== "uplinking") return;
  plan.uplinkRemaining -= dt;
  if (plan.uplinkRemaining > 0) return;
  plan.status = "executing";
  plan.phase = "climb";
  plan.message = "Autonomous flight: climbing";
  plan.start = { time: state.missionTime, battery: state.battery, batteryC: state.batteryC, preheatWh: state.preheatWh };
  plan.maxBatteryC = state.batteryC;
}

function turnToward(state, x, z, dt, rate = 18) {
  const bearing = (Math.atan2(x - state.positionX, -(z - state.positionZ)) * 180 / Math.PI + 360) % 360;
  const error = ((bearing - state.heading + 540) % 360) - 180;
  state.heading = (state.heading + clamp(error, -rate * dt, rate * dt) + 360) % 360;
  return error;
}

function finishPlan(state, batteryEnergyKwh) {
  const plan = state.plan;
  plan.status = "complete";
  plan.phase = "landed";
  const usedPercent = plan.start.battery - state.battery;
  plan.report = {
    timeSeconds: state.missionTime - plan.start.time,
    energyWh: usedPercent * batteryEnergyKwh * 10,
    endBattery: state.battery,
    maxBatteryC: plan.maxBatteryC,
    scouted: [...plan.scouted],
    landNow: plan.landNow,
    site: scoutedSiteAt(state, state.positionX, state.positionZ)?.name || "unscouted ground",
  };
  plan.message = plan.landNow ? "Landed early (land-now fault response)" : `Landed at ${plan.report.site}`;
}

// Autopilot targets for the executing plan: vertical speed, forward speed and a mode label.
export function planGuidance(state, dt, batteryEnergyKwh) {
  const plan = state.plan;
  plan.maxBatteryC = Math.max(plan.maxBatteryC ?? state.batteryC, state.batteryC);
  const target = plan.waypoints[plan.leg];
  const last = plan.leg === plan.waypoints.length - 1;
  // Fault response: land now when energy or battery temperature will not last much longer than
  // the descent from the current height [PUB response; EST margin].
  if (!plan.landNow && plan.phase !== "descent" && landNowNeeded(state, batteryEnergyKwh).needed) {
    plan.landNow = true;
    plan.phase = "descent";
    plan.message = "Land now: energy or battery temperature limit";
  }
  const distance = Math.hypot(target.x - state.positionX, target.z - state.positionZ);
  if (plan.phase === "climb") {
    turnToward(state, target.x, target.z, dt);
    const remaining = plan.altitude - state.altitude;
    if (remaining <= 2) { plan.phase = "cruise"; plan.message = "Autonomous flight: cruise"; }
    const speed = state.altitude > 10 ? planModel.cruiseSpeed * 0.5 * clamp(state.altitude / plan.altitude, 0, 1) : 0;
    return { climb: clamp(remaining * 0.8, 0.4, planModel.climbRate), speed, mode: "Autonomous climb" };
  }
  if (plan.phase === "cruise") {
    const error = turnToward(state, target.x, target.z, dt);
    if (distance <= planModel.arrivalRadius) {
      if (last) { plan.phase = "descent"; plan.message = "Autonomous flight: descending to land"; }
      else { plan.leg += 1; plan.message = `Autonomous flight: waypoint ${plan.leg + 1} of ${plan.waypoints.length}`; }
    }
    const cap = last ? distance * 0.25 : Math.max(4, distance * 0.25);
    const speed = Math.min(planModel.cruiseSpeed, cap) * Math.max(0, Math.cos(error * Math.PI / 180));
    return { climb: clamp((plan.altitude - state.altitude) * 0.6, -planModel.descentRate, planModel.climbRate), speed, mode: "Autonomous cruise" };
  }
  // Descent: hold over the landing point (or the current spot for a land-now response).
  if (!plan.landNow && distance > 0.5) turnToward(state, target.x, target.z, dt, 30);
  const speed = plan.landNow ? 0 : Math.min(2, distance * 0.3);
  if (state.altitude <= 0.001 && Math.abs(state.verticalSpeed) < 0.05) finishPlan(state, batteryEnergyKwh);
  return { climb: -planModel.descentRate, speed, mode: plan.landNow ? "Land now" : "Autonomous descent" };
}

// Any flight above the scouting altitude images candidate sites it passes near (DragonCam/lidar).
export function updateScouting(state) {
  if (state.altitude < planModel.scoutMinAltitude) return;
  for (const site of candidateSites) {
    if (isScouted(state, site.id)) continue;
    if (Math.hypot(site.x - state.positionX, site.z - state.positionZ) <= planModel.scoutRadius) {
      state.scoutedSites.push(site.id);
      state.scoutLog.push({ id: site.id, name: site.name, time: state.missionTime });
      if (planActive(state)) state.plan.scouted.push(site.name);
      state.mission.message = `${site.name} scouted: safe to land on a later flight.`;
    }
  }
}
