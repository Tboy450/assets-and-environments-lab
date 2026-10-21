// Titan-inspired training weather [EST]. Cassini observed methane clouds/rain and inferred
// equatorial dust storms; it did not establish these local forecasts, rates or durations.
// Keep ambient temperature fixed. Wind changes the existing convection/heat balance instead.
export const weatherModel = Object.freeze({
  quietMinSeconds: 600, quietMaxSeconds: 1200, rainChance: 0.12,
  normalMaxWind: 1.6, trainingMaxWind: 4.5, drySeconds: 7200,
});
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

function random(w) {
  w.seed = (Math.imul(1664525, w.seed) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}
function schedule(w) {
  w.waitSeconds = weatherModel.quietMinSeconds + random(w) * (weatherModel.quietMaxSeconds - weatherModel.quietMinSeconds);
}
export function createWeatherState(seed = 450) {
  const w = {
    version: 1, seed: seed >>> 0, mode: "natural", clock: 0, baseWind: 0.8, lastWind: 0.8,
    waitSeconds: 0, event: null, intensity: 0, haze: 0, rain: 0, wetness: 0, log: [],
  };
  schedule(w);
  return w;
}
function eventPhase(event) {
  if (!event) return "quiet";
  const { seconds, warning, rise, peak } = event;
  return seconds < warning ? "warning" : seconds < warning + rise ? "building"
    : seconds < warning + rise + peak ? "peak" : "recovery";
}
export const weatherPhase = state => eventPhase(state.weather?.event);
const eventName = kind => kind === "gust" ? "Gust event" : kind === "rain" ? "Methane-rain scenario" : "Strong methane-storm training";

function beginEvent(w, kind) {
  const training = kind === "training";
  w.waitSeconds = 0;
  w.event = {
    kind, seconds: 0, warning: training ? 120 : 60,
    rise: training ? 180 : 90, peak: training ? 180 : 120, recovery: training ? 240 : 180,
    peakWind: training ? weatherModel.trainingMaxWind : 1.1 + random(w) * 0.5,
    gustPhase: random(w) * Math.PI * 2,
  };
  w.log.unshift({ clock: w.clock, kind });
  w.log.length = Math.min(w.log.length, 6);
}
function outputs(state) {
  const w = state.weather, event = w.event;
  let intensity = 0;
  if (event) {
    const t = event.seconds - event.warning;
    intensity = t < 0 ? 0 : t < event.rise ? smooth(t / event.rise)
      : t < event.rise + event.peak ? 1 : 1 - smooth((t - event.rise - event.peak) / event.recovery);
  }
  w.intensity = intensity;
  w.haze = intensity * (event?.kind === "gust" ? 0.12 : event?.kind === "rain" ? 0.5 : 1);
  w.rain = event && event.kind !== "gust" ? intensity : 0;
  const gust = event ? 0.88 + 0.12 * Math.sin(event.seconds / 9 + event.gustPhase) : 1;
  state.wind = w.baseWind + (event ? Math.max(0, event.peakWind - w.baseWind) * intensity * gust : 0);
  w.lastWind = state.wind;
}
export function setWeatherMode(state, mode) {
  const w = state.weather;
  w.mode = mode;
  w.event = null;
  w.baseWind = mode === "natural" ? clamp(state.wind, 0, 1) : state.wind;
  schedule(w);
  outputs(state);
}
export function setFixedWind(state, wind) {
  state.wind = wind;
  setWeatherMode(state, "fixed");
}
export function startStormTraining(state) {
  if (state.edl || state.hold) return "Finish arrival and resume the simulation first.";
  if (state.weather.event) return "Wait for the current weather event to finish, or select Fixed wind to end it.";
  state.weather.baseWind = clamp(state.wind, 0, 1);
  state.weather.mode = "natural";
  beginEvent(state.weather, "training");
  outputs(state);
  return "";
}
export function stepWeather(state, dt) {
  if (state.hold || state.edl || dt <= 0) return;
  const w = state.weather;
  // Preserve direct wind edits by console/test clients as the existing fixed-wind behavior.
  if (state.wind !== w.lastWind) setFixedWind(state, state.wind);
  let remaining = dt;
  while (remaining > 0) {
    const step = Math.min(1, remaining);
    remaining -= step;
    w.clock += step;
    w.wetness *= Math.exp(-step / weatherModel.drySeconds);
    if (w.mode === "natural") {
      if (!w.event) {
        w.waitSeconds -= step;
        if (w.waitSeconds <= 0) beginEvent(w, random(w) < weatherModel.rainChance ? "rain" : "gust");
      } else {
        w.event.seconds += step;
        const e = w.event;
        if (e.seconds >= e.warning + e.rise + e.peak + e.recovery) {
          w.event = null;
          schedule(w);
        }
      }
    }
    outputs(state);
    w.wetness = clamp(w.wetness + w.rain * step / 600, 0, 1);
  }
}
export function weatherAdvisory(state, compact = false) {
  const w = state.weather, event = w?.event;
  if (!event) return "";
  const phase = eventPhase(event);
  if (compact) {
    const name = event.kind === "training" ? "Storm training" : event.kind === "rain" ? "Methane rain" : "Gusts";
    return phase === "warning"
      ? `${name} in ${Math.ceil(event.warning - event.seconds)} s (compressed scenario)${event.kind === "training" ? "; land before strong winds" : ""}.`
      : `${name} / ${phase}: ${state.wind.toFixed(1)} m/s${event.kind === "training" ? " / above-envelope stress" : ""}.`;
  }
  if (phase === "warning") return `Weather advisory: ${eventName(event.kind)} in ${Math.ceil(event.warning - event.seconds)} s (compressed training forecast)${event.kind === "training" ? "; land before strong winds" : ""}.`;
  return `${eventName(event.kind)} / ${phase}: ${state.wind.toFixed(1)} m/s${event.kind === "training" ? "; above-envelope stress scenario, prepare to land" : ""}.`;
}
export function weatherFlightIssue(state) {
  if (state.weather?.event?.kind === "training") return "Strong storm training active or approaching: wait for recovery before uplinking a new flight.";
  return "";
}
export function validWeather(w) {
  if (!w || w.version !== 1 || !["natural", "fixed"].includes(w.mode)
    || !Number.isInteger(w.seed) || w.seed < 0 || w.seed > 0xffffffff) return false;
  if (!["clock", "waitSeconds", "baseWind", "lastWind", "intensity", "haze", "rain", "wetness"].every(key => Number.isFinite(w[key]) && w[key] >= 0)) return false;
  if (w.baseWind > 5 || w.lastWind > 5 || ["intensity", "haze", "rain", "wetness"].some(key => w[key] > 1)) return false;
  if (w.mode === "natural" && w.baseWind > 1) return false;
  if (!Array.isArray(w.log) || w.log.length > 6 || !w.log.every(e => e && Number.isFinite(e.clock) && e.clock >= 0 && ["gust", "rain", "training"].includes(e.kind))) return false;
  const e = w.event;
  return e === null || w.mode === "natural" && e && ["gust", "rain", "training"].includes(e.kind)
    && ["seconds", "warning", "rise", "peak", "recovery", "peakWind", "gustPhase"].every(key => Number.isFinite(e[key]) && e[key] >= 0)
    && e.warning > 0 && e.rise > 0 && e.peak > 0 && e.recovery > 0
    && e.peakWind <= (e.kind === "training" ? weatherModel.trainingMaxWind : weatherModel.normalMaxWind)
    && e.seconds < e.warning + e.rise + e.peak + e.recovery;
}
