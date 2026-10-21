import { createSystemsState, guidanceTarget, stepSystems, flightRestriction, overLiquid } from "./mission-systems.mjs?v=dev";
import { createPlan, stepPlan, planGuidance, updateScouting, abortPlan, estimatePlan } from "./flight-plan.mjs?v=dev";
import { createScienceState, stepScience } from "./science.mjs?v=dev";
import { createExpeditionState, stepExpedition } from "./expedition.mjs?v=dev";
import { createWeatherState, stepWeather, weatherAdvisory, weatherPhase } from "./weather.mjs?v=dev";
import { createOperations, pauseOperations, stepOperations } from "./operations.mjs?v=dev";
// Environmental values: APL's TFAWS 2024 report. Performance values are demo assumptions.
export const model = Object.freeze({
  massKg: 875, titanG: 1.352, earthG: 9.80665,
  rhoTitan: 5.44, rhoEarth: 1.225, pressureKpa: 146, temperatureK: 94,
  rotorCount: 8, rotorStations: 4, bladesPerRotor: 3, rotorDiameterM: 1.35,
  figureOfMerit: 0.75, inducedLossFactor: 1.15, batteryEnergyKwh: 11.5,
  dragAreaM2: 0.65,
  pitchRadians: Math.PI / 10, rollRadians: 22 * Math.PI / 180,
  // Handling assumptions. The throttle is a climb-rate command: 50% holds altitude.
  hoverThrottle: 0.5, climbPerThrottle: 12, maxClimb: 3, maxDescent: -2.5,
  // ~3,000 N maximum thrust against ~1,183 N Titan weight leaves limited upward margin, and
  // Titan's 1.35 m/s2 gravity arrests a climb slowly. Both limits are rounded demo values.
  maxClimbAccel: 1.8, maxSinkAccel: 1.2, maxHorizontalAccel: 1.0,
  // Fictional opt-in reverse-thrust pulse, not a capability of Dragonfly's fixed-pitch rotors.
  reverseBrakeAccel: 0.2, reverseBrakeRpm: 160, reverseBrakePowerW: 50, reverseBrakeMinAltitude: 1, reverseBrakeMaxSink: 0.6,
  takeoffAltitude: 40, cruiseFloor: 20, cruiseSpeed: 10, liquidClearance: 2,
});

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const follow = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
// First-order response with a rate limit, so a changed command never produces a jump.
const approach = (value, target, rate, maxRate, dt) =>
  value + clamp((target - value) * (1 - Math.exp(-rate * dt)), -maxRate * dt, maxRate * dt);

export const throttleForClimb = (climb) => clamp(model.hoverThrottle + climb / model.climbPerThrottle, 0, 1);
export const climbForThrottle = (throttle) =>
  clamp((throttle - model.hoverThrottle) * model.climbPerThrottle, model.maxDescent, model.maxClimb);
// Touchdown profile: descend at up to 1.3 m/s, easing to 0.35 m/s at contact.
const landingClimb = (altitude) => -Math.min(1.3, 0.35 + 0.25 * Math.max(0, altitude));
const IDLE_THROTTLE = 0.18;

export function createFlightState({ weatherSeed = 450 } = {}) {
  return {
    ...createSystemsState(),
    ...createScienceState(),
    operations: createOperations(),
    mode: "Preflight", auto: true, hold: false, missionTime: 0, autoClock: 0,
    altitude: 0, verticalSpeed: 0, speed: 0, throttle: model.hoverThrottle, altitudeHold: null,
    reverseBrakeEnabled: false, reverseBrakeActive: false,
    yaw: 0, pitch: 0, roll: 0, yawCmd: 0, pitchCmd: 0, rollCmd: 0,
    heading: 84, positionX: 0, positionZ: 0,
    battery: 96, power: 0, wind: 0.8, payloadDelta: 0,
    distance: 0, chart: [], track: [{ x: 0, z: 0 }], sampleTime: -1,
    rotorRpm: Array(8).fill(0), rotorPhase: Array(8).fill(0),
    plan: createPlan(), timeWarp: 1, expedition: createExpeditionState(), weather: createWeatherState(weatherSeed),
  };
}

export function deriveFlight(state) {
  const mass = model.massKg + state.payloadDelta;
  // Coaxial pairs share one swept area; eight rotors do not make eight independent disks.
  const totalArea = Math.PI * (model.rotorDiameterM / 2) ** 2 * model.rotorStations;
  const scaleHeight = model.pressureKpa * 1000 / (model.rhoTitan * model.titanG);
  const pressureKpa = model.pressureKpa * Math.exp(-Math.max(0, state.altitude) / scaleHeight);
  const density = model.rhoTitan * pressureKpa / model.pressureKpa;
  const titanWeight = mass * model.titanG;
  const earthWeight = mass * model.earthG;
  const inducedTitan = Math.sqrt(titanWeight / (2 * density * totalArea));
  const idealTitan = titanWeight * inducedTitan;
  // Ground-relative flight-path proxy, not the rotor-shaft inflow measured in the tunnel.
  const descentSpeed = Math.max(0, -state.verticalSpeed);
  const descentRatio = descentSpeed / inducedTitan;
  const descentAngleDeg = Math.atan2(descentSpeed, Math.max(0, state.speed)) * 180 / Math.PI;
  const steepDescentCaution = state.altitude > 0.1 && descentAngleDeg > 60 && descentRatio > 0.75 && descentRatio < 1.25;
  return {
    mass, totalArea, titanWeight, pressureKpa, density, inducedTitan, idealTitan,
    descentRatio, descentAngleDeg, steepDescentCaution,
    realisticTitan: idealTitan * model.inducedLossFactor / model.figureOfMerit,
    idealEarth: earthWeight * Math.sqrt(earthWeight / (2 * model.rhoEarth * totalArea)),
    diskLoading: titanWeight / totalArea,
  };
}

export function profileAt(t) {
  const phase = t % 180;
  if (phase < 22) return {
    mode: "Takeoff", altitude: lerp(0, 46, phase / 22), verticalSpeed: 2.1,
    speed: lerp(0, 4, phase / 22), pitch: 0.12, roll: Math.sin(t * 0.9) * 0.06,
  };
  if (phase < 55) return {
    mode: "Hover", altitude: 46 + Math.sin(t * 0.7) * 0.9, verticalSpeed: Math.cos(t * 0.7) * 0.63,
    speed: 1.3 + Math.sin(t * 0.4) * 0.5, pitch: 0.03, roll: Math.sin(t * 0.5) * 0.08,
  };
  if (phase < 122) return {
    mode: "Traverse", altitude: 48 + Math.sin(t * 0.28) * 2.2, verticalSpeed: Math.cos(t * 0.28) * 0.62,
    speed: 10 + Math.sin(t * 0.35) * 1.2,
    pitch: 0.3 + Math.sin(t * 0.23) * 0.08, roll: Math.sin(t * 0.42) * 0.2,
  };
  if (phase < 158) return {
    mode: "Descent", altitude: lerp(48, 1.5, (phase - 122) / 36), verticalSpeed: -46.5 / 36,
    speed: lerp(7, 1.5, (phase - 122) / 36), pitch: 0.08, roll: Math.sin(t * 0.5) * 0.1,
  };
  return { mode: "Surface", altitude: 0, verticalSpeed: 0, speed: 0, pitch: 0, roll: 0 };
}

export function flightPower(state) {
  const d = deriveFlight(state), speed = Math.max(0, state.speed);
  const ratio = speed / d.inducedTitan;
  // Forward inflow reduces induced power; profile and parasite terms restore the high-speed rise.
  const inflow = Math.sqrt(2 / (Math.sqrt(ratio ** 4 + 4) + ratio ** 2));
  const induced = d.idealTitan * model.inducedLossFactor * inflow;
  const profile = (d.realisticTitan - d.idealTitan * model.inducedLossFactor) * (1 + 3 * (speed / 55) ** 2);
  const parasite = 0.5 * d.density * model.dragAreaM2 * speed ** 3;
  const climb = d.titanWeight * Math.max(0, state.verticalSpeed);
  return (induced + profile + parasite + climb) * (1 + state.wind * 0.025);
}

// Flight-plan estimate using this vehicle's power curve at half the planned altitude.
export function estimateFlightPlan(state) {
  const powerAt = (speed, verticalSpeed) => flightPower({ ...state, speed, verticalSpeed, altitude: state.plan.altitude / 2 });
  return estimatePlan(state, powerAt, model.batteryEnergyKwh);
}

// One vertical model for every mode: altitude and climb rate stay continuous across mode changes.
function stepVertical(state, climbTarget, dt, allowReverseBrake = false) {
  let target = climbTarget;
  // Liquid is a no-landing zone in this training scenario, not a buoyancy simulation.
  if (!state.hibernating && overLiquid(state.positionX, state.positionZ)) {
    target = Math.max(target, (model.liquidClearance - state.altitude) * 1.5);
  }
  if (target < 0) target = Math.max(target, landingClimb(state.altitude));
  if (state.altitude <= 0 && target <= 0) {
    state.altitude = 0;
    state.verticalSpeed = 0;
    return target;
  }
  const change = (target - state.verticalSpeed) * (1 - Math.exp(-2.5 * dt));
  state.verticalSpeed += clamp(change, -model.maxSinkAccel * dt, model.maxClimbAccel * dt);
  if (allowReverseBrake && state.throttle === 0 && target < 0 && state.verticalSpeed > -model.reverseBrakeMaxSink
    && state.altitude > model.reverseBrakeMinAltitude && !overLiquid(state.positionX, state.positionZ)) {
    // Fictional [EST]: continue gently through the apex into a shallow descent, then release.
    // Normal landing flare remains in control below the clearance gate.
    state.verticalSpeed -= Math.min(state.verticalSpeed + model.reverseBrakeMaxSink, model.reverseBrakeAccel * dt);
    state.reverseBrakeActive = true;
  }
  state.altitude = Math.max(0, state.altitude + state.verticalSpeed * dt);
  if (state.altitude === 0 && state.verticalSpeed < 0) state.verticalSpeed = 0;
  return target;
}

function stepAttitude(state, pitch, roll, yaw, dt) {
  state.pitch = approach(state.pitch, pitch, 4, 0.9, dt);
  state.roll = approach(state.roll, roll, 4, 1.0, dt);
  state.yaw = approach(state.yaw, yaw, 5, 3, dt);
}

function stepSpeed(state, target, rate, dt) {
  state.speed = Math.max(0, approach(state.speed, Math.max(0, target), rate, model.maxHorizontalAccel, dt));
}

function showThrottle(state, climbTarget, landedIdle, dt) {
  const target = landedIdle ? IDLE_THROTTLE : throttleForClimb(climbTarget);
  state.throttle = follow(state.throttle, target, 4, dt);
}

// True when a command or the throttle is asking a landed aircraft to lift off.
function wantsLiftoff(state) {
  if (state.altitude > 0) return false;
  if (state.mission.guidance || state.auto || state.plan.status === "executing") return true;
  if (state.altitudeHold !== null) return state.altitudeHold > 0;
  return climbForThrottle(state.throttle) > 0.05;
}

export function stepFlight(state, dt) {
  if (state.hold || dt <= 0) return;
  state.reverseBrakeActive = false;
  stepWeather(state, dt);
  stepOperations(state);
  state.missionTime += dt;
  stepPlan(state, dt);
  const restricted = flightRestriction(state);
  // The antenna arm must be stowed before liftoff; a flight command ends the downlink and waits.
  const stowing = !state.hibernating && !restricted && state.antennaDeploy > 0 && wantsLiftoff(state);
  if (stowing) state.downlinkActive = false;
  if (state.hibernating) {
    state.altitude = 0; state.verticalSpeed = 0; state.speed = 0; state.throttle = 0;
    state.pitchCmd = 0; state.rollCmd = 0; state.yawCmd = 0; state.altitudeHold = null;
    stepAttitude(state, 0, 0, 0, dt);
    state.mode = "Hibernation";
  } else if (stowing) {
    state.altitude = 0; state.verticalSpeed = 0;
    stepAttitude(state, 0, 0, 0, dt);
    if (state.auto) state.autoClock = 0;
    state.mode = "Stowing antenna";
  } else if (restricted) {
    abortPlan(state, `Flight plan stopped: ${restricted}`);
    state.auto = false; state.mission.guidance = false; state.altitudeHold = null;
    state.pitchCmd = 0; state.rollCmd = 0; state.yawCmd = 0;
    stepSpeed(state, 0, 2, dt);
    if (state.battery > 0) {
      stepVertical(state, state.altitude > 0 ? -0.7 : 0, dt);
    } else if (state.altitude > 0) {
      state.verticalSpeed += (-model.titanG - 0.04 * state.verticalSpeed * Math.abs(state.verticalSpeed)) * dt;
      state.altitude = Math.max(0, state.altitude + state.verticalSpeed * dt);
      if (state.altitude === 0) state.verticalSpeed = 0;
    }
    state.throttle = state.altitude > 0 && state.battery > 0 ? throttleForClimb(-0.7) : 0;
    stepAttitude(state, 0, 0, 0, dt);
    state.mode = state.altitude > 0 ? "Safety descent" : "Flight inhibited";
  } else if (state.plan.status === "executing") {
    state.altitudeHold = null;
    const target = planGuidance(state, dt, model.batteryEnergyKwh);
    const applied = stepVertical(state, target.climb, dt);
    stepSpeed(state, target.speed, 1.5, dt);
    stepAttitude(state, state.speed / 25, 0, 0, dt);
    showThrottle(state, applied, state.altitude === 0 && target.climb <= 0, dt);
    if (state.plan.status === "complete") state.throttle = IDLE_THROTTLE;
    state.mode = target.mode;
  } else if (state.mission.guidance) {
    state.altitudeHold = null;
    const target = guidanceTarget(state, dt);
    const climb = target.altitude === 0 ? landingClimb(state.altitude) : clamp((target.altitude - state.altitude) * 0.8, -0.8, 1.2);
    const applied = stepVertical(state, climb, dt);
    stepSpeed(state, target.speed, 1.5, dt);
    stepAttitude(state, state.speed / 25, 0, 0, dt);
    showThrottle(state, applied, state.altitude === 0 && target.altitude === 0, dt);
    state.mode = "Guided survey";
  } else if (state.auto) {
    state.altitudeHold = null;
    state.autoClock += dt;
    const target = profileAt(state.autoClock);
    state.mode = target.mode;
    const surface = target.mode === "Surface";
    const climb = surface || target.altitude < 0.5 && target.verticalSpeed <= 0
      ? landingClimb(state.altitude)
      : clamp(target.verticalSpeed + (target.altitude - state.altitude) * 1.2, -1.6, 2.4);
    const applied = stepVertical(state, climb, dt);
    stepSpeed(state, target.speed + (surface ? 0 : state.wind * 0.12), 1.5, dt);
    stepAttitude(state, target.pitch, target.roll, surface ? 0 : Math.sin(state.autoClock * 0.22) * 0.17, dt);
    showThrottle(state, applied, surface && state.altitude === 0, dt);
  } else {
    let climb;
    if (state.altitudeHold !== null) {
      climb = state.altitudeHold <= 0 ? landingClimb(state.altitude)
        : clamp((state.altitudeHold - state.altitude) * 0.6, -1.3, 2.2);
    } else climb = climbForThrottle(state.throttle);
    const applied = stepVertical(state, climb, dt,
      state.reverseBrakeEnabled && state.altitudeHold === null && state.plan.status !== "uplinking" && !state.edl);
    if (state.altitudeHold !== null) {
      const touchedDown = state.altitudeHold <= 0 && state.altitude === 0;
      showThrottle(state, applied, touchedDown, dt);
      if (touchedDown) {
        // Touchdown: release the hold and bring the throttle to idle so the rotors spin down.
        state.altitudeHold = null;
        state.throttle = IDLE_THROTTLE;
      }
    }
    stepAttitude(state, state.pitchCmd, state.rollCmd, state.yawCmd, dt);
    // Forward speed follows body pitch; pulling back or levelling brakes gradually.
    stepSpeed(state, state.altitude > 0 ? clamp(state.pitch * 37.5, 0, 16) : 0, 1 / 3, dt);
    const hold = state.altitudeHold;
    state.mode = state.altitude < 0.05 ? "Surface"
      : hold === 0 ? "Landing"
      : state.speed > 5 ? "Traverse"
      : hold !== null ? (Math.abs(hold - state.altitude) > 0.5 ? (hold > state.altitude ? "Climb" : "Descent") : "Hover")
      : "Manual";
  }
  if (!state.hibernating && overLiquid(state.positionX, state.positionZ) && state.altitude < model.liquidClearance - 0.05) {
    state.mode = "Liquid avoidance";
    state.mission.message = "Methane puddle below: landing inhibited. Move to firm ground.";
  }
  // Skids on the ground: residual forward motion bleeds off quickly instead of stopping in one frame.
  if (state.altitude === 0) state.speed = Math.max(0, approach(state.speed, 0, 6, 4, dt));
  state.heading = (state.heading + state.yaw * 22 * dt + 360) % 360;
  const bearing = state.heading * Math.PI / 180;
  state.positionX += Math.sin(bearing) * state.speed * dt;
  state.positionZ -= Math.cos(bearing) * state.speed * dt;
  state.distance += state.speed * dt;
  updateScouting(state);

  const stopped = state.altitude === 0 && state.throttle < 0.3;
  const baseRpm = state.reverseBrakeActive ? model.reverseBrakeRpm : stopped ? 0 : 780 * Math.sqrt(state.throttle * 2);
  // Order matches the 3D model: left front/rear then right front/rear, lower/upper.
  state.rotorRpm.forEach((rpm, i) => {
    const side = i < 4 ? -1 : 1;
    const front = Math.floor(i / 2) % 2 === 0 ? -1 : 1;
    const spin = i % 2 === 0 ? 1 : -1;
    const mix = 1 + front * state.pitch * 0.07 - side * state.roll * 0.08 + spin * state.yaw * 0.04;
    state.rotorRpm[i] = follow(rpm, baseRpm * mix, 4, dt);
    state.rotorPhase[i] = (state.rotorPhase[i] + state.rotorRpm[i] * Math.PI / 30 * dt * spin * (state.reverseBrakeActive ? -1 : 1)) % (Math.PI * 2);
  });
  state.power = (stopped ? 100 : flightPower(state)) + (state.reverseBrakeActive ? model.reverseBrakePowerW : 0);
  stepScience(state, dt);
  stepSystems(state, dt, model.batteryEnergyKwh);
  stepExpedition(state, dt);
  stepOperations(state);
  if (state.sampleTime < 0 || state.missionTime - state.sampleTime >= 0.5 - 1e-9) {
    state.sampleTime = state.missionTime;
    state.chart.push({ time: state.missionTime, altitude: state.altitude, powerKw: state.power / 1000, speed: state.speed });
    if (state.chart.length > 180) state.chart.shift();
    const last = state.track.at(-1);
    if (Math.hypot(last.x - state.positionX, last.z - state.positionZ) >= 1) {
      state.track.push({ x: state.positionX, z: state.positionZ });
      if (state.track.length > 600) state.track.shift();
    }
  }
}

// Hand control to the pilot without changing what the aircraft is currently doing.
export function takeManualControl(state) {
  pauseOperations(state, "Pilot took manual control; review the queue before resuming");
  abortPlan(state, "Flight plan stopped: pilot took manual control");
  if (state.auto || state.mission.guidance) {
    state.throttle = throttleForClimb(state.verticalSpeed);
    state.pitchCmd = 0; state.rollCmd = 0; state.yawCmd = 0;
  }
  state.auto = false;
  state.mission.guidance = false;
  state.restSeconds = 0;
  state.hibernating = false;
}

export function commandFlight(state, mode) {
  if (mode === "hold") { state.hold = !state.hold; return; }
  pauseOperations(state, "Flight command took control; review the queue before resuming");
  abortPlan(state, "Flight plan stopped by a flight command");
  state.restSeconds = 0;
  state.hibernating = false;
  state.mission.guidance = false;
  state.hold = false;
  state.auto = mode === "auto";
  state.rollCmd = 0; state.yawCmd = 0;
  if (mode === "auto") {
    // Resume the demonstration profile from the phase that matches the aircraft, not the mission clock.
    state.autoClock = state.altitude < 0.5 ? 0 : 22;
    state.altitudeHold = null;
    return;
  }
  if (mode === "takeoff") {
    state.altitudeHold = Math.max(state.altitude, model.takeoffAltitude);
    state.throttle = 0.68; state.pitchCmd = 0;
  }
  if (mode === "cruise") {
    state.altitudeHold = Math.max(state.altitude, model.cruiseFloor);
    state.throttle = state.altitudeHold > state.altitude + 1 ? 0.6 : model.hoverThrottle;
    state.pitchCmd = model.cruiseSpeed / 37.5;
  }
  if (mode === "land") {
    state.altitudeHold = 0;
    state.throttle = 0.39; state.pitchCmd = 0;
  }
}

export function advanceRest(state, seconds = 600) {
  if (state.hold || !state.hibernating) return;
  let remaining = Math.min(seconds, state.restSeconds);
  while (remaining > 0) {
    const dt = Math.min(1, remaining);
    const phase = weatherPhase(state);
    stepFlight(state, dt);
    state.restSeconds -= dt;
    remaining -= dt;
    if (phase !== "warning" && weatherPhase(state) === "warning") {
      state.restSeconds = 0;
      state.restNotice = `Accelerated time stopped: ${weatherAdvisory(state)}`;
      break;
    }
    // A low charge is a reason to recharge, not a reason to interrupt recharge.
    if (state.coreC > 40 || state.batteryC < 5 || state.batteryC > 35 || state.fanIntegrity < 0.5) {
      state.restSeconds = 0;
      state.restNotice = "Accelerated time stopped: thermal inspection required.";
      break;
    }
  }
}
