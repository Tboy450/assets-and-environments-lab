// Entry, descent and landing (EDL) opening sequence. Altitudes and times since entry interface
// come from the Dragonfly EDL concept of operations (SciTech 2025 EDL overview, fig. 1, and
// RESEARCH-COMPENDIUM.md §2.4) [PUB]. The sequence is time-compressed from about 2.5 hours to
// under a minute; the powered descent after release and the final touchdown are illustrative.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (u) => u * u * (3 - 2 * u);
// Eases from one value to the next over a short window, so camera framing never jumps.
const ease = (time, start, duration, from, to) => from + (to - from) * smooth(clamp((time - start) / duration, 0, 1));

export const edlEvents = Object.freeze([
  { t: 0, altitudeM: 1270e3, sinceEntryS: 0, title: "Entry interface", detail: "The 4.5 m, 60-degree aeroshell (2,309 kg) meets Titan's atmosphere at 1,270 km, spinning at 2 rpm for stability." },
  { t: 6, altitudeM: 245e3, sinceEntryS: 234, title: "Peak heating", detail: "The heat shield sees about 280 W/cm2 at 245 km." },
  { t: 7.5, altitudeM: 220e3, sinceEntryS: 246, title: "Peak deceleration", detail: "About 10 g as the thick atmosphere slows the capsule." },
  { t: 10, altitudeM: 143e3, sinceEntryS: 383, title: "Drogue parachute", detail: "An 8.25 m disk-gap-band drogue opens at Mach 1.5. The descent under it lasts about 108 minutes." },
  { t: 17, altitudeM: 4800, sinceEntryS: 114 * 60, title: "Main parachute", detail: "The 16.7 m ringslot main parachute deploys at 4.8 km." },
  { t: 20, altitudeM: 4400, sinceEntryS: 116 * 60, title: "Heat shield separation", detail: "Released 120 s after the main parachute, at 4.4 km." },
  { t: 25, altitudeM: 2500, sinceEntryS: 128 * 60, title: "Thermal loop reconfigured", detail: "The EDL thermal loop switches over for the lander's own operations." },
  { t: 28.5, altitudeM: 2100, sinceEntryS: 130 * 60, title: "Lander pose", detail: "The lander is lowered below the backshell so its rotors sit in the airflow." },
  { t: 31.5, altitudeM: 2000, sinceEntryS: 131 * 60, title: "Despin", detail: "The rotors spin up and cancel the vehicle's spin for optical navigation." },
  { t: 34.5, altitudeM: 1800, sinceEntryS: 132 * 60, title: "Lidar ground lock", detail: "The lidar altimeter locks onto the ground at 1.8 km." },
  { t: 40, altitudeM: 1000, sinceEntryS: 137 * 60, title: "Lander separation", detail: "Released at 1,000 m (800-1,000 m window) while descending at 2.9 m/s." },
  { t: 41, altitudeM: 990, sinceEntryS: 137 * 60 + 1, title: "Powered flight", detail: "One second after release the lander flies itself away from the backshell and parachute." },
  { t: 58, altitudeM: 0, sinceEntryS: 150 * 60, title: "Touchdown", detail: "Autonomous landing at the first site, about two and a half hours after entry." },
]);

export const edlDuration = 60;
// Above this height the ground is lost in haze, so the scene holds here while the readout continues.
export const edlRenderCeiling = 4200;

function segment(t) {
  for (let i = 0; i < edlEvents.length - 1; i += 1) {
    if (t < edlEvents[i + 1].t) return i;
  }
  return edlEvents.length - 2;
}

// Everything the scene and overlay need at intro time t (seconds).
export function edlStateAt(t) {
  const time = clamp(t, 0, edlDuration);
  const index = segment(time);
  const a = edlEvents[index], b = edlEvents[index + 1];
  const u = clamp((time - a.t) / (b.t - a.t), 0, 1);
  let altitudeM;
  if (b.altitudeM > 0) altitudeM = Math.exp(Math.log(a.altitudeM) + (Math.log(b.altitudeM) - Math.log(a.altitudeM)) * u);
  else altitudeM = a.altitudeM * (1 - u) ** 2; // powered descent eases to a gentle touchdown
  const sinceEntryS = a.sinceEntryS + (b.sinceEntryS - a.sinceEntryS) * u;
  const current = edlEvents[time >= edlEvents.at(-1).t ? edlEvents.length - 1 : index];
  const at = (title) => edlEvents.find(event => event.title === title).t;
  const drogue = at("Drogue parachute"), main = at("Main parachute"), shield = at("Heat shield separation");
  const pose = at("Lander pose"), despin = at("Despin"), release = at("Lander separation"), touchdown = at("Touchdown");
  return {
    t: time, done: t >= edlDuration, altitudeM, sinceEntryS,
    renderAltitudeM: Math.min(altitudeM, edlRenderCeiling),
    title: current.title, detail: current.detail, eventIndex: edlEvents.indexOf(current),
    heatShield: time < shield,
    heatShieldDrop: Math.max(0, time - shield),
    glow: time > 3 && time < 9.5 ? Math.sin((time - 3) / 6.5 * Math.PI) : 0,
    chute: time < drogue ? "none" : time < main ? "drogue" : "main",
    chuteOpen: time < drogue ? 0 : time < main ? smooth(clamp((time - drogue) / 0.8, 0, 1)) : smooth(clamp((time - main) / 1.2, 0, 1)),
    pose: smooth(clamp((time - pose) / 2, 0, 1)),
    rotorSpin: time < despin ? 0 : time < touchdown ? smooth(clamp((time - despin) / 3, 0, 1)) : 1 - smooth(clamp((time - touchdown) / 2, 0, 1)),
    // The capsule spins at 2 rpm during entry and is despun by the rotors after the pose.
    spinRate: 1 - smooth(clamp((time - despin) / 2.5, 0, 1)),
    released: time >= release,
    separation: Math.max(0, time - release),
    space: clamp((Math.log10(Math.max(1, altitudeM)) - 4.7) / 1.2, 0, 1),
    // Framing: wide enough to keep the whole capsule-and-parachute assembly on a phone screen
    // (the main parachute rig is ~40 m tall), then closing in on the lander within ~3 s of release.
    cameraDistance: time < main ? ease(time, drogue, 1.5, 30, 120)
      : time < release ? ease(time, main, 1.5, 120, 190)
        : time < release + 3 ? ease(time, release, 3, 190, 16) : ease(time, release + 3, 10, 16, 12),
    lookUp: time < main ? ease(time, drogue, 1.5, 0.5, 8) : time < release ? ease(time, main, 1.5, 8, 18) : ease(time, release, 2.5, 18, 0),
    // A slow orbit around the vehicle. Under the main parachute it swings round to look north
    // across the dunes (see titan-terrain.mjs), and back before release so the lander is lit
    // from the side for the close-up.
    cameraAzimuth: 0.7 + time * 0.035 - 1.1 * (ease(time, main + 1, 7, 0, 1) - ease(time, release - 3, 6, 0, 1)),
    // Low under the drogue so the canopy stands against the sky; above the main, looking down past
    // the canopy so the ground emerges from the haze below as the capsule descends.
    cameraElevation: time < drogue ? 0.25 : time < main ? -0.08
      : time < release ? ease(time, main + 1, 8, -0.08, 0.42) : ease(time, release, 3, 0.42, 0.18),
    // Visual speed cue for haze streaks and passing haze layers: hypersonic entry, then the drogue,
    // then the slow main parachute and powered flight.
    speedCue: time < drogue ? 1 : time < main ? ease(time, drogue, 1, 1, 0.45) : ease(time, main, 2, 0.45, 0.12),
    // The drogue is cut away as it pulls out the main; the heat shield tumbles as it falls.
    drogueAway: time >= main ? time - main : -1,
    touchdownDust: time >= touchdown - 2 ? clamp((time - (touchdown - 2)) / 2, 0, 1) : 0,
    // Most recent pyrotechnic event (mortar fire, main deploy, heat shield and lander release) and
    // its age in seconds, for a brief puff; null once it has faded.
    pyro: [[release, "release"], [shield, "shield"], [main, "main"], [drogue, "drogue"]]
      .filter(([at]) => time >= at && time - at < 1.5).map(([at, kind]) => ({ kind, age: time - at }))[0] || null,
  };
}

export function formatSinceEntry(seconds) {
  const s = Math.floor(seconds);
  if (s < 3600) return `E+${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  return `E+${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60).toString().padStart(2, "0")} min`;
}

export function formatAltitude(meters) {
  return meters >= 10000 ? `${(meters / 1000).toFixed(0)} km` : meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}
