// Rotor downwash at the ground: how strongly the rotor wash stirs up sand under the vehicle.
// Hover induced velocity v = sqrt(W / (2 rho A)) with W = 875 kg x 1.352 m/s2 = 1,183 N,
// rho = 5.44 kg/m3 and A = 4 coaxial stations x pi x 0.675^2 = 5.73 m2 gives about 4.4 m/s
// [CALC from PUB inputs]. The wash scales with rotor speed (thrust ~ rpm^2, wash ~ rpm), fades
// with height above ground (about 6 m here) and is swept behind the vehicle in forward flight.
// Sand starts moving above about 1 m/s of wash at the surface; Titan's threshold wind is of
// that order [PUB, Burr et al. 2015, ~50% above earlier predictions]. Reach and scaling [EST].
import { model } from "./flight-model.mjs?v=dev";

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (u) => { const t = clamp01(u); return t * t * (3 - 2 * t); };
export const hoverRpm = 780;
export const washReachM = 6;
export const sandThresholdMps = 1;
export const hoverWashMps = Math.sqrt(model.massKg * model.titanG
  / (2 * model.rhoTitan * model.rotorStations * Math.PI * (model.rotorDiameterM / 2) ** 2));

// How readily each kind of ground gives up dust.
export const dustiness = Object.freeze({ dune: 1.3, sand: 1, outcrop: 0.4, damp: 0.2, liquid: 0 });

// Wash speed at the surface (m/s) and dust strength (0-1) for the given ground kind.
export function downwashAtGround(state, ground = "sand") {
  const rpms = state.rotorRpm || [];
  const rpm = rpms.length ? rpms.reduce((sum, value) => sum + value, 0) / rpms.length : 0;
  const height = Math.max(0, state.altitude || 0);
  const reach = 1 - smooth(height / washReachM);
  // Climbing hard (accelerating up) pushes more air down; forward speed sweeps the wash behind.
  const climbBoost = 1 + Math.max(0, state.verticalSpeed || 0) * 0.08;
  const sweep = 1 / (1 + Math.max(0, state.speed || 0) / 6);
  const washMps = hoverWashMps * (rpm / hoverRpm) * reach * climbBoost * sweep;
  const strength = clamp01((washMps - sandThresholdMps) / 3) * (dustiness[ground] ?? 1);
  return { washMps, strength: Math.min(1.3, strength) };
}
