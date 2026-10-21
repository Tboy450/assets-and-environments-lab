// Training geography and engineering limits, not an actual Dragonfly landing-site map. The
// landscape follows the published description of the landing area, Ahmakiq Undae (see
// titan-terrain.mjs); the sites below are illustrative and sit in one interdune corridor.
// Dragonfly lands among equatorial dunes and interdunes, far from Titan's polar seas. Methane
// rainstorms have darkened large areas of low-latitude ground [PUB], so the scene shows a
// rain-darkened interdune (safe to land on) around a small transient methane puddle (no landing).
export const surveySite = Object.freeze({ x: 145, z: -90, radius: 12, name: "Dry outcrop" });
export const pools = Object.freeze([{ x: 210, z: -110, rx: 11, rz: 7.5, depth: 0.35 }]);
export const dampGround = Object.freeze({ x: 205, z: -105, rx: 78, rz: 52 });
// Landing sites for autonomous flights. Base and the outcrop start scouted; the others are
// candidate interdune sites (chosen for low local relief) that must be scouted from the air
// before a later flight may land there (leapfrog scouting [PUB]).
export const candidateSites = Object.freeze([
  { id: "base", name: "Base", x: 0, z: 0, scouted: true },
  { id: "outcrop", name: "Dry outcrop", x: 145, z: -90, scouted: true },
  { id: "damp", name: "Rain-darkened site", x: 250, z: -100, scouted: false },
  { id: "a", name: "Site A", x: 219, z: -219, scouted: false },
  { id: "b", name: "Site B", x: -270, z: 0, scouted: false },
  { id: "c", name: "Site C", x: 529, z: -444, scouted: false },
  { id: "d", name: "Site D", x: 834, z: -389, scouted: false },
  { id: "e", name: "Site E", x: 1352, z: 362, scouted: false },
  { id: "f", name: "Site F", x: 1710, z: -622, scouted: false },
].map(Object.freeze));
export function poolRadius(x, z, pool) {
  const u = (x - pool.x) / pool.rx, v = (z - pool.z) / pool.rz;
  const angle = Math.atan2(v, u);
  return Math.hypot(u, v) / (1 + 0.09 * Math.sin(angle * 3) + 0.05 * Math.cos(angle * 5));
}
export const overLiquid = (x, z) => pools.some(p => poolRadius(x, z, p) < 1);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const systemsModel = Object.freeze({
  rtgElectricW: 90, rtgThermalW: 1800, ambientC: -179.15,
  coreCapacity: 60000, batteryCapacity: 30000, titanDaySeconds: 15.95 * 86400,
  externalHCalm: 4, externalHWindy: 10.5, externalHFlight: 75,
  coldDuctArea: 0.8, internalConductance: 12,
  foamThickness: 0.0762, foamConductivity: 0.01, foamArea: 20,
  gasMassFlow: 0.052, gasCp: 1050, generatorLossUA: 5.5,
  trimMaximum: 0.4, trimStep: 0.02, controllerPeriod: 600,
  // ICES-2020: eight rotor motors preheat at ~90 W for 5 min before flight (60 Wh). The 30 min
  // cool-down before another preheat is needed is a demo assumption.
  preheatWh: 8 * 90 * 5 / 60, motorCoolSeconds: 1800,
  // Operations plan (APL): one ~30 min flight; battery gains ~10 C per 30 min in flight (ICES-2020).
  plannedFlightSeconds: 1800, batteryRisePerSecond: 10 / 1800, batteryLimitC: 35, reservePercent: 15,
  // Phase-change buffer: 7.5 kg of wax melting at 22.5 C limits battery heating in flight [PUB,
  // ICES-2023]. The wax is not published; 200 kJ/kg is mid-range for paraffins (150-250) [EST].
  pcmMassKg: 7.5, pcmMeltC: 22.5, pcmLatentJPerKg: 200000,
  // Direct-to-Earth X-band. ~5 mJ per bit per AU is the 2018 concept figure (Lorenz); the
  // 200 W DC draw for the 100 W RF amplifier and the 9.5 AU range are demo assumptions.
  downlinkW: 200, downlinkJoulesPerBitAu: 0.005, earthRangeAu: 9.5, downlinkMinBattery: 30,
  maxSurfaceWind: 1.6,
  // The high-gain antenna rides a motorized arm that is raised for Earth pointing and stowed for
  // flight [PUB]. The 6 s travel time is a demo assumption.
  antennaTravelSeconds: 6,
  // The simulator's landing profile descends at up to 1.3 m/s; "land now" must allow for that.
  landingDescentRate: 1.3, landNowMarginMinutes: 1.5, landNowFloorMinutes: 3,
});

// Titan local solar time at the landing site. The simulation starts at local noon.
export const titanLocalHour = (state) => (12 + state.elapsed / systemsModel.titanDaySeconds * 24) % 24;
// Seen from Titan, Earth stays within ~6 deg of the Sun, so Earth is up when the Sun is.
export const titanDaylight = (state) => { const hour = titanLocalHour(state); return hour >= 6 && hour < 18; };

export function linkStatus(state) {
  if (state.altitude > 0.001) return { available: false, label: "Antenna stowed / flight" };
  if (state.hibernating) return { available: false, label: "Hibernating" };
  if (!titanDaylight(state)) return { available: false, label: "Earth below horizon / night" };
  if (state.battery <= systemsModel.downlinkMinBattery) return { available: false, label: "Held: battery reserve" };
  if (state.downlinkActive) return { available: true, label: state.antennaDeploy < 1 ? "Raising antenna" : "Downlink in progress" };
  if (state.antennaDeploy > 0) return { available: true, label: "Stowing antenna" };
  return { available: true, label: (state.dataStoredBits ?? 1) > 0 ? "Earth in view / ready" : "Earth in view / nothing to send" };
}

export function toggleDownlink(state) {
  state.downlinkActive = !state.downlinkActive && linkStatus(state).available && (state.dataStoredBits ?? 1) > 0;
  return state.downlinkActive;
}

// Battery plus its wax buffer as one enthalpy: below the melting point only the temperature
// changes; at 22.5 C heat melts (or refreezes) wax at constant temperature; once all the wax is
// melted the temperature rises again.
export function batteryAfterHeat(celsius, melt, joules) {
  const capacity = systemsModel.batteryCapacity, meltC = systemsModel.pcmMeltC;
  const latent = systemsModel.pcmMassKg * systemsModel.pcmLatentJPerKg;
  const fraction = celsius < meltC ? 0 : celsius > meltC ? 1 : Math.min(1, Math.max(0, melt));
  const solidAtMelt = capacity * meltC, liquidAtMelt = solidAtMelt + latent;
  const enthalpy = capacity * celsius + fraction * latent + joules;
  if (enthalpy < solidAtMelt) return { c: enthalpy / capacity, melt: 0 };
  if (enthalpy <= liquidAtMelt) return { c: meltC, melt: (enthalpy - solidAtMelt) / latent };
  return { c: (enthalpy - latent) / capacity, melt: 1 };
}

// Battery temperature after a flight of the given length at the documented heating rate
// (+10 C per 30 min without the wax, ICES-2020), including the wax buffer.
export function batteryAfterFlight(state, seconds) {
  const joules = systemsModel.batteryCapacity * systemsModel.batteryRisePerSecond * seconds;
  return batteryAfterHeat(state.batteryC, state.pcmMelt ?? 0, joules);
}

// Minutes of flight left before the battery reserve or the 35 C battery limit, whichever is first.
export function flightEndurance(state, batteryEnergyKwh) {
  const usableWh = Math.max(0, state.battery - systemsModel.reservePercent) / 100 * batteryEnergyKwh * 1000;
  const energyMin = usableWh / Math.max(1, state.power - state.generatedW) * 60;
  // Heat the battery can still absorb before 35 C, including any unmelted wax.
  const heatingW = systemsModel.batteryCapacity * systemsModel.batteryRisePerSecond;
  const limit = batteryAfterHeat(systemsModel.batteryLimitC, 1, 0);
  const now = systemsModel.batteryCapacity * state.batteryC + (state.batteryC < systemsModel.pcmMeltC ? 0 : state.batteryC > systemsModel.pcmMeltC ? 1 : (state.pcmMelt ?? 0)) * systemsModel.pcmMassKg * systemsModel.pcmLatentJPerKg;
  const room = systemsModel.batteryCapacity * limit.c + systemsModel.pcmMassKg * systemsModel.pcmLatentJPerKg - now;
  const thermalMin = Math.max(0, room) / heatingW / 60;
  const minutes = Math.min(energyMin, thermalMin);
  return { energyMin, thermalMin, minutes, limit: energyMin <= thermalMin ? "battery reserve" : "battery temperature" };
}

// Minutes of flight left below which the lander must start down now: the time to descend from the
// current height plus a margin, and never less than three minutes.
export function landNowThreshold(state) {
  const descentMinutes = Math.max(0, state.altitude) / systemsModel.landingDescentRate / 60;
  return Math.max(systemsModel.landNowFloorMinutes, descentMinutes + systemsModel.landNowMarginMinutes);
}

export function landNowNeeded(state, batteryEnergyKwh) {
  const endurance = flightEndurance(state, batteryEnergyKwh);
  return { needed: state.altitude > 0.001 && endurance.minutes < landNowThreshold(state), endurance };
}

export function operationsAdvisory(state, batteryEnergyKwh) {
  if (state.altitude <= 0.001) return "";
  const { needed, endurance } = landNowNeeded(state, batteryEnergyKwh);
  if (needed) return `Land now: ${endurance.limit} limit in ${Math.max(0, endurance.minutes).toFixed(1)} min`;
  if (state.flightSeconds > systemsModel.plannedFlightSeconds) return "Land now: planned 30 min flight exceeded";
  if (!titanDaylight(state)) return "Night flight: outside daylight operations plan";
  if ((state.dayLog?.flights || 0) > 1) return "Extra flight: the plan is one flight per Titan day";
  return "";
}

export function surfaceHeatTransfer(wind, speed, circulation) {
  // Published surface convection envelope; interpolation and duct dimensions are demo assumptions.
  const exposure = Math.hypot(Math.max(0, wind), Math.max(0, speed));
  const h = exposure <= 1.6
    ? systemsModel.externalHCalm + (systemsModel.externalHWindy - systemsModel.externalHCalm) * Math.sqrt(exposure / 1.6)
    : systemsModel.externalHWindy + (systemsModel.externalHFlight - systemsModel.externalHWindy) * clamp((exposure - 1.6) / 8.4, 0, 1);
  const externalUA = h * systemsModel.coldDuctArea;
  const internalUA = systemsModel.internalConductance * clamp(circulation, 0, 1);
  // Internal gas transport and external heat rejection act as series resistances.
  const ductUA = internalUA * externalUA / (internalUA + externalUA);
  return { h, ductUA };
}

export function liquidExchangerStudy(hotC, coldC, hotCapacityRate, coldCapacityRate, effectiveness) {
  const values = [hotC, coldC, hotCapacityRate, coldCapacityRate, effectiveness];
  if (!values.every(Number.isFinite) || hotC < coldC || hotC <= -273.15 || coldC <= -273.15 || hotCapacityRate <= 0 || coldCapacityRate <= 0 || effectiveness < 0 || effectiveness > 1) return null;
  // Steady, single-phase energy balance. Effectiveness is an assumption, not a geometry prediction.
  const heatW = effectiveness * Math.min(hotCapacityRate, coldCapacityRate) * (hotC - coldC);
  return { heatW, hotOutletC: hotC - heatW / hotCapacityRate, coldOutletC: coldC + heatW / coldCapacityRate };
}

export function createSystemsState() {
  return {
    coreC: 12, batteryC: 10, trim: 0.04, thermalAuto: true, fan: 1,
    rdeC: 12, twtaC: 12, noseElectronicsC: 12, pcmMelt: 0,
    trimClock: 0, trimIntegral: 0, effectiveTrim: 0, trimFlightLocked: false,
    fault: "none", fanIntegrity: 1, insulationIntegrity: 1,
    generatedW: 90, arrivalElectricW: 90, rtgHeatW: 1800, netBatteryW: 0, heatInW: 0, heatOutW: 0,
    convectionH: 4, ductUA: 0, foamUA: 0, gasFlow: 0, warmGasC: 12,
    generatorToBayW: 0, generatorRejectedW: 0, coldDuctW: 0, chargingBlocked: false,
    elapsed: 0, restSeconds: 0, restNotice: "", hibernating: false, guard: "",
    motorsCold: true, motorCoolClock: 0, preheatWh: 0, preheats: 0, flightSeconds: 0,
    downlinkActive: false, downlinkW: 0, dataReturnedBits: 0, antennaDeploy: 0,
    scoutedSites: candidateSites.filter(site => site.scouted).map(site => site.id), scoutLog: [],
    mission: { phase: "idle", sampleSeconds: 0, samples: 0, guidance: false, message: "Survey the edge of a rain-darkened interdune from dry ground." },
  };
}

export function missionTarget(state) {
  return ["return", "complete"].includes(state.mission.phase) ? { x: 0, z: 0, radius: 12, name: "Base" } : surveySite;
}

export function targetDistance(state) {
  const target = missionTarget(state);
  return Math.hypot(target.x - state.positionX, target.z - state.positionZ);
}

export function flightRestriction(state) {
  if (state.battery <= 15) return "Battery reserve: land and recharge";
  if (state.coreC < -20 || state.coreC > 55 || state.batteryC < 0 || state.batteryC >= 35) return "Temperature outside flight band";
  if (state.fanIntegrity < 0.5) return "Restricted circulation: service thermal loop";
  return "";
}

export function landed(state) {
  return state.altitude <= 0.001 && Math.abs(state.verticalSpeed) < 0.2 && state.speed < 0.3;
}

export function missionAction(state) {
  const m = state.mission;
  if (m.phase === "idle" || m.phase === "complete") {
    state.mission = { phase: "outbound", sampleSeconds: 0, samples: 0, guidance: false, message: "Reach the dry outcrop, land, and collect a sample." };
    return;
  }
  if (state.hold) { m.message = "Resume the simulation before issuing a mission command."; return; }
  if (m.phase === "sample") {
    if (!landed(state) || targetDistance(state) > surveySite.radius || overLiquid(state.positionX, state.positionZ)) {
      m.message = "Sampling requires a stationary touchdown inside the dry target."; return;
    }
    if (flightRestriction(state)) { m.message = "Restore energy and thermal margins before sampling."; return; }
    if (state.hibernating) { m.message = "Wake the lander before sampling."; return; }
    if (state.science.sampling) { m.message = "A sample is already being analyzed."; return; }
    if (state.battery <= systemsModel.reservePercent + 5) { m.message = "Battery too low for DrACO and DraMS."; return; }
    m.phase = "sampling";
    m.sampleSeconds = 0;
    state.auto = false; state.throttle = 0; state.altitudeHold = null;
    state.pitchCmd = 0; state.rollCmd = 0; state.yawCmd = 0;
    m.message = "DrACO / DraMS sample acquisition";
    return;
  }
  if (m.phase === "sampling") return;
  const blocked = flightRestriction(state);
  if (blocked) { m.message = blocked; return; }
  state.restSeconds = 0;
  state.hibernating = false;
  state.auto = false;
  if (state.plan && ["uplinking", "executing"].includes(state.plan.status)) {
    state.plan.status = "aborted"; state.plan.message = "Flight plan stopped for the guided survey";
  }
  m.guidance = !m.guidance;
  m.message = m.guidance ? `Guided approach to ${missionTarget(state).name}` : "Manual flight";
}

export function guidanceTarget(state, dt) {
  const target = missionTarget(state), distance = targetDistance(state);
  const bearing = (Math.atan2(target.x - state.positionX, -(target.z - state.positionZ)) * 180 / Math.PI + 360) % 360;
  const error = ((bearing - state.heading + 540) % 360) - 180;
  state.heading = (state.heading + clamp(error, -24 * dt, 24 * dt) + 360) % 360;
  const altitude = distance > 18 ? 18 : 0;
  const speed = distance < 3 || state.altitude < 3 && distance > 18 ? 0 : Math.min(5, distance * 0.18) * Math.max(0, Math.cos(error * Math.PI / 180));
  return { altitude, speed };
}

export function stepSystems(state, dt, batteryEnergyKwh) {
  state.elapsed += dt;
  state.fanIntegrity = state.fault === "fan" ? 0.35 : 1;
  state.insulationIntegrity = state.fault === "insulation" ? 0.45 : 1;
  const circulation = state.fan * state.fanIntegrity;
  const years = state.elapsed / (365.25 * 86400);
  state.generatedW = state.arrivalElectricW * 0.975 ** years;
  state.rtgHeatW = systemsModel.rtgThermalW * 2 ** (-years / 87.7);
  if (state.hibernating) state.power = 45 + 15 * state.fan ** 3;
  else state.power += 15 * state.fan ** 3 + (state.sciencePowerW || 0);
  // Motor preheat is charged once when the rotors lift off cold; its 5 minutes are time-compressed.
  if (state.altitude > 0.001) {
    if (state.motorsCold) {
      state.battery = Math.max(0, state.battery - systemsModel.preheatWh / (batteryEnergyKwh * 10));
      state.preheatWh += systemsModel.preheatWh; state.preheats += 1; state.motorsCold = false;
    }
    state.motorCoolClock = 0;
    state.flightSeconds += dt;
  } else {
    state.motorCoolClock += dt;
    if (state.motorCoolClock >= systemsModel.motorCoolSeconds) state.motorsCold = true;
    if (state.motorCoolClock > 1) state.flightSeconds = 0;
  }
  const link = linkStatus(state);
  if (state.downlinkActive && !link.available) state.downlinkActive = false;
  const travel = dt / systemsModel.antennaTravelSeconds;
  state.antennaDeploy = clamp(state.antennaDeploy + (state.downlinkActive ? travel : -travel), 0, 1);
  // The radio transmits only once the antenna is fully raised and pointed.
  state.downlinkW = state.downlinkActive && state.antennaDeploy >= 1 ? systemsModel.downlinkW : 0;
  state.power += state.downlinkW;
  // The radio sends what the instruments have stored, then the session ends.
  const stored = state.dataStoredBits ?? Infinity;
  const sent = Math.min(stored, state.downlinkW * dt / (systemsModel.downlinkJoulesPerBitAu * systemsModel.earthRangeAu));
  if (Number.isFinite(stored)) state.dataStoredBits = stored - sent;
  state.dataReturnedBits += sent;
  if (state.downlinkW > 0 && state.dataStoredBits <= 0) {
    state.downlinkActive = false;
    state.mission.message = "Downlink complete: all stored data returned to Earth.";
  }
  state.netBatteryW = state.generatedW - state.power;
  state.chargingBlocked = state.netBatteryW > 0 && (state.batteryC < 0 || state.batteryC >= 35);
  if (state.chargingBlocked) state.netBatteryW = 0;
  state.battery = clamp(state.battery + state.netBatteryW * dt / (batteryEnergyKwh * 36000), 0, 100);

  const delta = Math.max(0, state.coreC - systemsModel.ambientC);
  const transfer = surfaceHeatTransfer(state.wind, state.speed, circulation);
  state.convectionH = transfer.h;
  state.ductUA = transfer.ductUA;
  const foamResistance = systemsModel.foamThickness * state.insulationIntegrity / (systemsModel.foamConductivity * systemsModel.foamArea);
  state.foamUA = 1 / (foamResistance + 1 / (transfer.h * systemsModel.foamArea));
  state.gasFlow = systemsModel.gasMassFlow * circulation;
  const gasCapacityRate = state.gasFlow * systemsModel.gasCp;
  // Quasi-steady source gas balances all RTG heat between the bay and an external loss path.
  // The loss-path UA and heat capacities are assumptions, not flight geometry or fin-root temperatures.
  const generatorUA = systemsModel.generatorLossUA * (transfer.h / systemsModel.externalHCalm) ** 0.1;
  state.warmGasC = (state.rtgHeatW + gasCapacityRate * state.coreC + generatorUA * systemsModel.ambientC) / (gasCapacityRate + generatorUA);
  state.generatorToBayW = gasCapacityRate * (state.warmGasC - state.coreC);
  state.generatorRejectedW = generatorUA * (state.warmGasC - systemsModel.ambientC);
  // [EST] Extended science profiles deposit a specified fraction of instrument load into
  // the shared bay. Exclude that load from the generic term to avoid double counting.
  state.heatInW = state.generatorToBayW + Math.min(600, Math.max(0, state.power - (state.sciencePowerW || 0)) * 0.025)
    + (state.scienceHeatW ?? (state.sciencePowerW || 0) * 0.025);
  const batteryExchange = 8 * (state.coreC - state.batteryC);
  const closedDuctUA = 36 / 194.15;
  const fullTrimW = transfer.ductUA * delta;
  state.trimFlightLocked = state.altitude > 0.001;
  state.trimClock -= dt;
  if (state.thermalAuto && !state.trimFlightLocked && state.trimClock <= 0) {
    const error = state.batteryC - 10;
    state.trimIntegral = clamp(state.trimIntegral + error * 0.0003, -0.06, 0.06);
    const balance = state.heatInW - (state.foamUA + closedDuctUA) * delta - batteryExchange;
    const command = systemsModel.trimMaximum * (balance + 10 * error + 30 * (state.coreC - 12)) / Math.max(1, fullTrimW) + state.trimIntegral;
    state.trim = Math.round(clamp(command, 0, systemsModel.trimMaximum) / systemsModel.trimStep) * systemsModel.trimStep;
    state.trimClock = systemsModel.controllerPeriod;
  }
  state.trim = Math.round(clamp(state.trim, 0, systemsModel.trimMaximum) / systemsModel.trimStep) * systemsModel.trimStep;
  state.effectiveTrim = state.trimFlightLocked ? 0 : state.trim;
  state.coldDuctW = closedDuctUA * delta + fullTrimW * state.effectiveTrim / systemsModel.trimMaximum;
  state.heatOutW = state.foamUA * delta + state.coldDuctW;
  state.coreC += (state.heatInW - state.heatOutW - batteryExchange) * dt / systemsModel.coreCapacity;
  const batteryHeatJ = (batteryExchange + Math.abs(state.netBatteryW) * 0.035 - 0.08 * (state.batteryC - systemsModel.ambientC)) * dt;
  const battery = batteryAfterHeat(state.batteryC, state.pcmMelt ?? 0, batteryHeatJ);
  state.batteryC = battery.c;
  state.pcmMelt = battery.melt;
  stepDisplayNodes(state, dt);
  state.guard = flightRestriction(state);

  const m = state.mission;
  if (m.phase === "idle" || m.phase === "complete") return;
  const atTarget = landed(state) && targetDistance(state) <= missionTarget(state).radius && !overLiquid(state.positionX, state.positionZ);
  if (m.phase === "outbound" && atTarget) {
    m.phase = "sample"; m.guidance = false; state.throttle = 0;
    m.message = "Dry outcrop reached. Sample acquisition ready.";
  } else if (m.phase === "return" && atTarget) {
    m.phase = "complete"; m.guidance = false; state.throttle = 0;
    m.message = "Survey complete: one sample returned to base.";
  }
}

// Display-only thermal nodes for boxes the published models single out (ICES-2023-389 figs 3-4
// and text): the two rotorcraft drive electronics (RDEs) heat up considerably in flight; the
// TWTA under the top deck is warm while on; the lidar and IMU boxes at the base of the nose warm
// in flight. Each relaxes toward the bay air temperature; heat inputs and time constants are
// estimates calibrated so a ~30 min flight ends near the published ~300 K for the RDEs. They do
// not feed back into the lander heat balance above.
function relax(value, target, seconds, dt) {
  return target + (value - target) * Math.exp(-dt / seconds);
}
function stepDisplayNodes(state, dt) {
  const flying = state.altitude > 0.001;
  state.rdeC = relax(state.rdeC ?? state.coreC, state.coreC + (flying ? 0.002 * state.power : 0), 1200, dt);
  state.twtaC = relax(state.twtaC ?? state.coreC, state.coreC + (flying || state.downlinkW > 0 ? 18 : 0), 900, dt);
  state.noseElectronicsC = relax(state.noseElectronicsC ?? state.coreC, state.coreC + (flying ? 9 : 0), 900, dt);
}

// Temperature (C) of every thermal zone the vehicle model is tagged with, with where it comes from.
// "modeled" values come from the simulator's heat balance; "estimate" values are placed relative to
// it from the published thermal-model figures; "published" values are documented set points.
export function thermalZoneTemps(state) {
  const ambient = systemsModel.ambientC;
  const inside = state.coreC - ambient;
  const foamLeakW = (state.foamUA || 0) * inside;
  const surface = ambient + foamLeakW / (Math.max(1, state.convectionH || 4) * systemsModel.foamArea);
  const motorsWarm = !state.motorsCold || state.altitude > 0.001;
  const coldDuctAir = state.coreC - (state.coldDuctW || 0) / Math.max(1, (state.gasFlow || 0.001) * systemsModel.gasCp);
  return {
    "equipment-bay": { c: state.coreC, source: "modeled bay air" },
    battery: { c: state.batteryC, source: "modeled battery" },
    rde: { c: state.rdeC ?? state.coreC, source: "estimate (ICES-2023 fig. 4)" },
    twta: { c: state.twtaC ?? state.coreC, source: "estimate (warm when on)" },
    "nose-electronics": { c: state.noseElectronicsC ?? state.coreC, source: "estimate (warms in flight)" },
    "warm-duct": { c: state.warmGasC ?? state.coreC, source: "modeled MMRTG gas" },
    mmrtg: { c: state.warmGasC ?? state.coreC, source: "modeled MMRTG gas (fin roots not modeled)" },
    "trim-device": { c: Math.max(ambient, Math.min(state.coreC, coldDuctAir)), source: "modeled cold-duct air" },
    "insulated-shell": { c: surface, source: "modeled foam outer surface" },
    "cold-attic": { c: ambient + 0.25 * inside, source: "estimate (ICES-2023 fig. 3)" },
    "nose-cameras": { c: ambient + 0.45 * inside, source: "estimate (ICES-2023 fig. 3)" },
    "cold-actuators": { c: state.downlinkActive ? -40 : ambient + 0.18 * inside, source: state.downlinkActive ? "published preheat before use" : "estimate (ICES-2023 fig. 3)" },
    motors: { c: motorsWarm ? -65 : ambient, source: motorsWarm ? "published preheat target" : "Titan air" },
    "external-sensors": { c: ambient, source: "Titan air" },
    "exterior-structure": { c: ambient, source: "Titan air" },
    rotors: { c: ambient, source: "Titan air" },
    drills: { c: ambient, source: "Titan air" },
    antennas: { c: ambient, source: "Titan air" },
  };
}

export function startRest(state, hours) {
  if (!landed(state) || state.hold || state.mission.phase === "sampling" || state.science?.sampling || overLiquid(state.positionX, state.positionZ)) return false;
  if (state.plan && ["uplinking", "executing"].includes(state.plan.status)) return false;
  state.auto = false; state.mission.guidance = false; state.throttle = 0; state.altitudeHold = null;
  state.pitchCmd = 0; state.rollCmd = 0; state.yawCmd = 0; state.downlinkActive = false;
  state.restSeconds = Math.max(0, hours * 3600);
  state.restNotice = "";
  state.hibernating = true;
  return true;
}
