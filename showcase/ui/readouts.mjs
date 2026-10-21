// Status strip, telemetry, rotor tiles, diagnostics values and the local track map.
import { deriveFlight, model } from "../flight-model.mjs?v=dev";
import { dampGround, flightEndurance, landed, linkStatus, liquidExchangerStudy, missionTarget, operationsAdvisory, overLiquid, pools, systemsModel, targetDistance, titanDaylight, titanLocalHour } from "../mission-systems.mjs?v=dev";
import { $, clamp, derived, formatTime, state, stickPitch, stickRoll, stickYaw } from "./context.mjs?v=dev";
import { updateScience } from "./science-panel.mjs?v=dev";
import { weatherAdvisory, weatherPhase } from "../weather.mjs?v=dev";
import { currentScienceProgram } from "../science-programs.mjs?v=dev";

const rotorGrid = $("rotor-grid");
const pilotRotorGrid = $("pilot-rotor-grid");

const rotorTiles = Array.from({ length: model.rotorCount }, (_, index) => {
  const tile = document.createElement("div");
  tile.className = "rotor-tile";
  tile.innerHTML = `
    <header><span>R${index + 1}</span><span class="rotor-load">50%</span></header>
    <strong class="rotor-rpm">0000 rpm</strong>
    <div class="rotor-bar"><i></i></div>
  `;
  rotorGrid.appendChild(tile);
  return tile;
});

const pilotRotorTiles = Array.from({ length: model.rotorCount }, () => {
  const tile = document.createElement("b");
  tile.textContent = "000";
  pilotRotorGrid.appendChild(tile);
  return tile;
});


export function updateReadouts() {
  const d = derived();
  $("mode-value").textContent = state.hold ? "Paused" : state.mode;
  $("met-value").textContent = formatTime(state.missionTime);
  $("altitude-value").textContent = `${state.altitude.toFixed(1)} m`;
  $("speed-value").textContent = `${state.speed.toFixed(1)} m/s`;
  $("power-value").textContent = `${(state.power / 1000).toFixed(1)} kW`;
  $("battery-value").textContent = `${state.battery.toFixed(1)}%`;
  $("heading-value").textContent = `${Math.round(state.heading).toString().padStart(3, "0")} deg`;
  $("disk-area").textContent = `${d.totalArea.toFixed(2)} m2`;
  $("weight-value").textContent = `${Math.round(d.titanWeight).toLocaleString()} N`;
  $("density-value").textContent = `${d.density.toFixed(3)} kg/m3`;
  $("pressure-value").textContent = `${d.pressureKpa.toFixed(1)} kPa`;
  $("disk-loading-value").textContent = `${d.diskLoading.toFixed(1)} N/m2`;
  $("mass-value").textContent = `${d.mass} kg`;
  $("vertical-speed-value").textContent = `${state.verticalSpeed.toFixed(1)} m/s`;
  $("north-value").textContent = `${(-state.positionZ).toFixed(0)} m`;
  $("east-value").textContent = `${state.positionX.toFixed(0)} m`;
  $("distance-value").textContent = `${state.distance.toFixed(0)} m`;
  $("pilot-navigation").textContent = `N ${(-state.positionZ).toFixed(0)} / E ${state.positionX.toFixed(0)} m`;
  document.querySelectorAll('[data-command="hold"]').forEach((button) => {
    button.textContent = state.hold ? "Resume" : "Pause";
    button.setAttribute("aria-pressed", String(state.hold));
  });
  document.querySelectorAll('[data-command="auto"]').forEach((button) => {
    button.classList.toggle("primary", state.auto);
    button.setAttribute("aria-pressed", String(state.auto));
  });
  $("induced-value").textContent = `${d.inducedTitan.toFixed(2)} m/s`;
  $("ideal-power-value").textContent = `${(d.idealTitan / 1000).toFixed(2)} kW`;
  $("hover-power-value").textContent = `${(d.realisticTitan / 1000).toFixed(2)} kW`;
  $("earth-power-value").textContent = `${Math.round(d.idealEarth / 1000)} kW`;
  const stressWind = state.wind > systemsModel.maxSurfaceWind;
  $("wind-output").textContent = `${state.wind.toFixed(1)} m/s${stressWind ? " / stress" : ""}`;
  $("wind-note").textContent = stressWind ? "Stress test: above the 1.6 m/s design maximum; Titan surface winds are typically under 1 m/s" : "Within the 1.6 m/s design maximum";
  if (document.activeElement !== $("wind-slider")) $("wind-slider").value = state.wind;
  $("weather-mode").value = state.weather.mode;
  const weather = state.weather, advisory = weatherAdvisory(state), phase = weatherPhase(state);
  $("weather-strip").hidden = !advisory || !!state.edl;
  $("weather-title").textContent = phase === "warning" ? "Weather advisory" : weather.event?.kind === "training" ? "Storm training / stress" : "Changing weather";
  $("weather-strip-status").textContent = weatherAdvisory(state, state.view === "pilot");
  $("weather-status").textContent = advisory || (weather.mode === "fixed" ? "Fixed wind / automatic events off" : "Quiet / occasional gusts and rarer methane-rain scenarios");
  $("weather-wetness").textContent = `${Math.round(weather.wetness * 100)}% additional wetting / illustrative`;
  $("weather-recent").textContent = weather.log.length ? weather.log.map(entry => `${entry.kind === "training" ? "Strong storm training" : entry.kind === "rain" ? "Methane rain" : "Gust"} at ${formatTime(entry.clock)}`).join("; ") : "No events yet";
  $("weather-training").disabled = !!weather.event || !!state.edl || state.hold;
  $("payload-output").textContent = `${state.payloadDelta > 0 ? "+" : ""}${state.payloadDelta} kg`;
  const leftText = `THR ${Math.round(state.throttle * 100)}% / YAW ${Math.round(stickYaw() * 100)}%`;
  const rightText = `PIT ${Math.round(stickPitch() * 100)}% / ROL ${Math.round(stickRoll() * 100)}%`;
  $("left-stick-readout").textContent = leftText;
  $("right-stick-readout").textContent = rightText;

  positionStick($("left-stick"), stickYaw(), state.throttle * 2 - 1);
  positionStick($("right-stick"), stickRoll(), stickPitch());
  document.querySelectorAll("[data-reverse-brake]").forEach(button => {
    const active = state.reverseBrakeActive && !state.hold && !state.edl;
    button.setAttribute("aria-pressed", String(state.reverseBrakeEnabled));
    button.textContent = `Reverse (sim): ${!state.reverseBrakeEnabled ? "off" : active ? "down thrust" : "armed"}`;
  });

  rotorTiles.forEach((tile, index) => {
    const rpm = Math.round(state.rotorRpm[index]);
    const load = clamp((rpm / 1150) ** 2, 0, 1);
    tile.querySelector(".rotor-load").textContent = `${Math.round(load * 100)}%`;
    tile.querySelector(".rotor-rpm").textContent = `${rpm.toString().padStart(4, "0")} rpm`;
    tile.querySelector(".rotor-bar i").style.width = `${Math.round(load * 100)}%`;
    pilotRotorTiles[index].textContent = `${rpm}`;
  });

  $("pilot-left-readout").textContent = leftText;
  $("pilot-right-readout").textContent = rightText;
  $("attitude-readout").textContent = `P ${state.pitch >= 0 ? "+" : ""}${(state.pitch * 18).toFixed(1)} / R ${state.roll >= 0 ? "+" : ""}${(state.roll * 22).toFixed(1)}`;
  $("attitude-horizon").style.transform = `translateY(${state.pitch * 24}px) rotate(${-state.roll * 22}deg)`;
  $("pilot-rotor-summary").textContent = state.wind > 3.8 ? "8 / 8 gust margin" : "8 / 8 nominal";
  positionStick($("pilot-left-stick"), stickYaw(), state.throttle * 2 - 1);
  positionStick($("pilot-right-stick"), stickRoll(), stickPitch());

  const link = linkStatus(state);
  $("link-value").textContent = link.label;
  $("downlink-power").textContent = `${Math.round(state.downlinkW)} W`;
  $("data-returned").textContent = `${(state.dataReturnedBits / 1e6).toFixed(1)} Mbit`;
  $("downlink-toggle").textContent = state.downlinkActive ? "Stop downlink" : "Start downlink";
  $("downlink-toggle").disabled = !state.downlinkActive && !link.available;
  updateScience(d);
  $("rotor-summary").textContent = state.wind > 3.8 ? "8 nominal, gust margin" : "8 nominal";
  updateSystemsReadouts();
}

function updateSystemsReadouts() {
  const m = state.mission;
  const envelope = deriveFlight(state);
  const labels = { idle: "Begin survey", outbound: "Fly to outcrop", sample: "Collect sample", sampling: "Acquiring sample", return: "Return to base", complete: "New survey" };
  $("objective-title").textContent = m.phase === "complete" ? "Survey complete" : "Interdune survey";
  $("objective-status").textContent = m.message;
  $("objective-distance").textContent = `${targetDistance(state).toFixed(0)} m / ${missionTarget(state).name}`;
  $("mission-action").textContent = m.guidance ? "Manual control" : labels[m.phase];
  $("mission-action").disabled = m.phase === "sampling";
  const alert = state.guard || operationsAdvisory(state, model.batteryEnergyKwh) || (state.batteryC > 30 ? "Battery nearing 35 C limit" : state.coreC > 40 ? "Equipment bay warming" : state.batteryC < 5 ? "Battery cooling" : envelope.steepDescentCaution ? "Steep-descent caution / VRS proxy" : "Systems nominal");
  $("vehicle-alert").textContent = alert;
  $("vehicle-alert").classList.toggle("warning", alert !== "Systems nominal");
  $("systems-warning").textContent = alert;
  $("descent-ratio").textContent = `${envelope.descentRatio.toFixed(2)} x hover inflow`;
  $("descent-angle").textContent = `${envelope.descentAngleDeg.toFixed(0)} deg`;
  $("descent-caution").textContent = envelope.steepDescentCaution ? "Caution: steep powered descent" : "No proxy trigger";
  $("core-temp").textContent = `${state.coreC.toFixed(1)} C`;
  $("battery-temp").textContent = `${state.batteryC.toFixed(1)} C`;
  $("pcm-melt").textContent = `${Math.round((state.pcmMelt || 0) * 100)}% melted`;
  $("heat-in").textContent = `${Math.round(state.heatInW)} W`;
  $("heat-out").textContent = `${Math.round(state.heatOutW)} W`;
  $("convection-h").textContent = `${state.convectionH.toFixed(1)} W/m2/K`;
  $("duct-ua").textContent = `${state.ductUA.toFixed(2)} W/K`;
  $("foam-ua").textContent = `${state.foamUA.toFixed(2)} W/K`;
  $("gas-flow").textContent = `${state.gasFlow.toFixed(3)} kg/s`;
  $("warm-gas").textContent = `${state.warmGasC.toFixed(1)} C`;
  $("rtg-heat").textContent = `${state.rtgHeatW.toFixed(0)} W`;
  $("rtg-rejected").textContent = `${state.generatorRejectedW.toFixed(0)} W`;
  $("trim-state").textContent = state.trimFlightLocked ? "Closed during flight" : state.thermalAuto ? `Auto / next update ${Math.max(0, state.trimClock).toFixed(0)} s` : "Manual / 2% increments";
  $("fan-integrity").textContent = `${Math.round(state.fanIntegrity * 100)}%`;
  $("insulation-integrity").textContent = `${Math.round(state.insulationIntegrity * 100)}%`;
  $("trim-output").textContent = `${Math.round(state.trim * 100)}%`;
  if (state.thermalAuto) $("trim-control").value = state.trim * 100;
  $("fan-output").textContent = `${Math.round(state.fan * 100)}%`;
  $("electric-load").textContent = `${Math.round(state.power)} W`;
  $("rtg-output").textContent = `${state.generatedW.toFixed(1)} W`;
  $("net-power").textContent = state.chargingBlocked ? "Charging inhibited: battery temperature" : `${state.netBatteryW >= 0 ? "+" : ""}${Math.round(state.netBatteryW)} W ${state.netBatteryW >= 0 ? "charging" : "discharging"}`;
  $("stored-energy").textContent = `${(state.battery / 100 * model.batteryEnergyKwh).toFixed(2)} kWh`;
  const minutes = Math.max(0, state.battery - 15) / 100 * model.batteryEnergyKwh * 60000 / Math.max(1, -state.netBatteryW);
  const duration = minutes >= 1440 ? `${(minutes / 1440).toFixed(1)} days` : minutes >= 60 ? `${(minutes / 60).toFixed(1)} h` : `${minutes.toFixed(0)} min`;
  $("reserve-time").textContent = state.chargingBlocked ? "Charging inhibited" : state.netBatteryW < 0 ? `${duration} at current load` : state.battery >= 100 ? "Fully charged" : "Charging";
  const hour = titanLocalHour(state);
  $("solar-time").textContent = `${Math.floor(hour).toString().padStart(2, "0")}:${Math.floor(hour % 1 * 60).toString().padStart(2, "0")} / ${titanDaylight(state) ? "Day" : "Night"}`;
  const endurance = flightEndurance(state, model.batteryEnergyKwh);
  $("flight-endurance").textContent = state.altitude > 0.001 ? `${endurance.minutes.toFixed(1)} min / ${endurance.limit}` : "Landed";
  $("flight-elapsed").textContent = `${Math.floor(state.flightSeconds / 60)}:${Math.floor(state.flightSeconds % 60).toString().padStart(2, "0")}`;
  $("motor-preheat").textContent = state.motorsCold ? `Cold / ${systemsModel.preheatWh} Wh at next takeoff` : `Warm / ${state.preheats} preheat${state.preheats === 1 ? "" : "s"}, ${Math.round(state.preheatWh)} Wh used`;
  $("surface-elapsed").textContent = `${(state.elapsed / 3600).toFixed(2)} h`;
  $("systems-objective").textContent = m.phase;
  const sampleDuration = currentScienceProgram(state.science).seconds;
  $("sample-progress").textContent = `${Math.min(sampleDuration, m.sampleSeconds).toFixed(0)} / ${sampleDuration} s`;
  $("sample-count").textContent = m.samples;
  const sampling = m.phase === "sampling" || state.science.sampling;
  const canRest = landed(state) && !overLiquid(state.positionX, state.positionZ) && !state.hold && !sampling && state.restSeconds === 0;
  $("rest-hour").disabled = !canRest;
  $("rest-night").disabled = !canRest;
  $("rest-stop").disabled = !state.hibernating;
  $("rest-status").textContent = sampling ? "Sample analysis in progress / hibernation unavailable" : state.restNotice || (state.restSeconds > 0 ? `${(state.restSeconds / 3600).toFixed(1)} h remaining / accelerated surface time` : state.hibernating ? "Hibernating / real-time monitoring" : "Hibernation available after dry-ground landing.");
}

function updateExchangerStudy() {
  const ids = ["hx-hot", "hx-cold", "hx-hot-rate", "hx-cold-rate", "hx-effectiveness"];
  const inputs = ids.map(id => $(id));
  const result = inputs.every(input => input.value !== "" && input.checkValidity())
    ? liquidExchangerStudy(...inputs.map(input => Number(input.value))) : null;
  $("hx-result").textContent = result
    ? `${result.heatW.toFixed(1)} W transferred | Tube outlet ${result.hotOutletC.toFixed(1)} C | Shell outlet ${result.coldOutletC.toFixed(1)} C`
    : "Enter valid single-phase assumptions; hot inlet must not be colder than cold inlet.";
}
$("hx-study").addEventListener("input", updateExchangerStudy);
updateExchangerStudy();

export function updateTrack() {
  const target = missionTarget(state);
  const points = [...state.track, { x: state.positionX, z: state.positionZ }];
  const extent = Math.max(50, ...[...points, target].map((p) => Math.max(Math.abs(p.x - state.positionX), Math.abs(p.z - state.positionZ))));
  const scale = 68 / extent;
  const project = (p) => `${(160 + (p.x - state.positionX) * scale).toFixed(1)},${(90 + (p.z - state.positionZ) * scale).toFixed(1)}`;
  $("flight-track").setAttribute("points", points.map(project).join(" "));
  $("track-craft").setAttribute("transform", `translate(160 90) rotate(${state.heading})`);
  $("track-scale").textContent = `${(40 / scale).toFixed(0)} m`;
  const [tx, ty] = project(target).split(",").map(Number);
  $("track-target").setAttribute("cx", tx);
  $("track-target").setAttribute("cy", ty);
  $("track-target-label").setAttribute("x", tx + 10);
  $("track-target-label").setAttribute("y", ty);
  $("track-target-label").textContent = target.name;
  const [dx, dy] = project(dampGround).split(",").map(Number);
  Object.entries({ cx: dx, cy: dy, rx: dampGround.rx * scale, ry: dampGround.rz * scale }).forEach(([k, v]) => $("track-damp").setAttribute(k, v));
  const [px, py] = project(pools[0]).split(",").map(Number);
  Object.entries({ cx: px, cy: py, rx: pools[0].rx * scale, ry: pools[0].rz * scale }).forEach(([k, v]) => $("track-puddle").setAttribute(k, v));
}


function positionStick(element, x, y) {
  element.style.left = `${50 + clamp(x, -1, 1) * 34}%`;
  element.style.top = `${50 - clamp(y, -1, 1) * 34}%`;
  element.style.transform = "translate(-50%, -50%)";
}
