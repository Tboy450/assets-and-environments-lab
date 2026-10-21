// What the optional soundscape should sound like for the current state: levels (0-1) and
// frequencies (Hz). Pure, so it can be tested without audio; ui/sound.mjs turns it into sound.
// Rotor blade-pass frequency = rpm / 60 x 3 blades (35 Hz at 700 rpm). The motor whine assumes
// 7 pole pairs. Levels, filters and the arrival sounds are artistic [EST].
//
// Titan's air and sound:
// - Speed of sound ~194 m/s at the surface (Huygens Surface Science Package, 2005) [PUB], 0.57 x
//   Earth's 343 m/s, so sound arrives ~1.8 x later: the arrival's separation thumps are heard
//   distance / 194 m/s after they are seen.
// - Air 4.4 x denser than Earth's [PUB]: a vibrating part radiates ~2.5 x the sound pressure
//   (impedance rho c: 5.44 x 194 vs 1.225 x 343), about +8 dB [CALC]; levels here stay artistic.
//   Wind noise follows dynamic pressure (rho v^2), so wind of a given speed is noisier.
// - Pitches set by rotation (rotor chop, motor whine) are the same as on Earth; pitches set by
//   air resonance (voices, pipes) would drop to 0.57 x, but none are simulated.
import { downwashAtGround } from "./downwash.mjs?v=dev";
import { model } from "./flight-model.mjs?v=dev";

const clamp01 = (value) => Math.min(1, Math.max(0, value));
export const bladesPerRotor = 3;
export const titanSoundSpeed = 194;
export const earthSoundSpeed = 343;
// Wind of v m/s on Titan pushes like v x sqrt(rho ratio) on Earth (same dynamic pressure).
const windDensityFactor = Math.sqrt(model.rhoTitan / model.rhoEarth);

export function soundMix(state) {
  const rpms = state.rotorRpm || [];
  const rpm = rpms.length ? rpms.reduce((sum, value) => sum + value, 0) / rpms.length : 0;
  const spin = clamp01(rpm / 700);
  const e = state.edl;
  // Wind: the ambient wind plus the air the vehicle moves through, weighted by Titan's density.
  const airflow = Math.abs(state.wind || 0) + Math.abs(state.speed || 0) * 0.6 + Math.abs(state.verticalSpeed || 0) * 0.5;
  const windiness = clamp01(airflow * windDensityFactor / 25);
  const drogue = e?.chute === "drogue" ? e.chuteOpen : 0, main = e?.chute === "main" && !e.released ? e.chuteOpen : 0;
  // The listener is the camera: tens to ~190 m from the capsule in the arrival, ~12 m in flight.
  const listenerM = e ? e.cameraDistance : 12;
  return {
    rotorHz: rpm / 60 * bladesPerRotor,
    motorHz: rpm / 60 * 7,
    rotorGain: 0.22 * spin ** 1.5,
    motorGain: 0.03 * spin,
    windGain: 0.015 + 0.11 * windiness,
    windCutoffHz: 250 + 1100 * windiness,
    // Sand hiss from the rotor wash near the ground.
    dustGain: e ? 0 : 0.07 * Math.min(1, downwashAtGround(state).strength),
    // Arrival: the roar of entry heating, canopy flutter, and a thump for each pyrotechnic event.
    roarGain: e ? 0.4 * (e.glow || 0) + 0.12 * (e.speedCue || 0) * (e.t < 10 ? 1 : 0) : 0,
    flutterGain: 0.16 * drogue + 0.07 * main,
    flutterHz: drogue ? 9 : 4.5,
    thump: e?.pyro && e.pyro.age < 0.15 ? e.pyro.kind : null,
    thumpDelayS: listenerM / titanSoundSpeed,
  };
}
