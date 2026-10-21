// Mode roles [PUB]: NASA DraMS development (LPSC 2021) and ICES-2024-103.
// All durations, loads, deposited-heat fractions and data sizes here are [EST] training
// profiles, not flight procedures. The demo preserves the original 30 s / 160 W job.
const stage = (id, label, part, start, end, watts) => Object.freeze({ id, label, part, start, end, watts });
const profile = (id, label, heatFraction, stages) => Object.freeze({
  id, label, heatFraction, stages: Object.freeze(stages), seconds: stages.at(-1).end,
  energyWh: stages.reduce((sum, s) => sum + (s.end - s.start) * s.watts / 3600, 0), dataMbit: 40,
});
const acquisition = () => [
  stage("drill", "Drilling", "drills", 0, 120, 160),
  stage("transfer", "Pneumatic transfer", "sample-lines", 120, 180, 160),
  stage("carousel", "Positioning cup", "sample-carousel", 180, 210, 60),
];
export const sciencePrograms = Object.freeze({
  demo: profile("demo", "Quick demo", 0.025, [
    stage("drill", "Drilling", "drills", 0, 10, 160),
    stage("transfer", "Pneumatic transfer", "sample-lines", 10, 18, 160),
    stage("carousel", "Positioning cup", "sample-carousel", 18, 22, 160),
    stage("analysis", "DraMS analysis", "drams", 22, 30, 160),
  ]),
  ldms: profile("ldms", "LDMS training", 0.8, [
    ...acquisition(),
    stage("analysis", "Laser-desorption analysis", "drams", 210, 540, 180),
    stage("cooldown", "Cooldown / securing", "drams", 540, 600, 40),
  ]),
  gcms: profile("gcms", "GCMS training", 0.8, [
    ...acquisition(),
    stage("condition", "Oven / gas preparation", "drams", 210, 510, 360),
    stage("analysis", "GC separation / analysis", "drams", 510, 1500, 320),
    stage("cooldown", "Cooldown / securing", "drams", 1500, 1800, 40),
  ]),
});
export const scienceProgram = id => Object.hasOwn(sciencePrograms, id) ? sciencePrograms[id] : sciencePrograms.demo;
export const currentScienceProgram = s => scienceProgram(s?.jobProgram ?? s?.programId);

// Exact energy over stage boundaries; big steps cannot charge a whole interval at one load.
export function scienceEnergyBetween(program, start, end) {
  return program.stages.reduce((sum, s) => sum + Math.max(0, Math.min(end, s.end) - Math.max(start, s.start)) * s.watts, 0);
}

export function validScienceExtension(s) {
  if (!s || typeof s !== "object") return false;
  for (const key of ["programId", "jobProgram"]) {
    if (s[key] !== undefined && s[key] !== null && !Object.hasOwn(sciencePrograms, s[key])) return false;
  }
  if (s.jobEnergyWh !== undefined && (!Number.isFinite(s.jobEnergyWh) || s.jobEnergyWh < 0)) return false;
  if (s.sampleOrigin != null && !["x", "z", "time"].every(k => Number.isFinite(s.sampleOrigin[k]))) return false;
  if (!Array.isArray(s.samples)) return false;
  for (const sample of s.samples) {
    if (!sample || typeof sample !== "object") return false;
    if (sample.programId !== undefined && !Object.hasOwn(sciencePrograms, sample.programId)) return false;
    for (const key of ["energyWh", "durationSeconds", "collectedAt", "dataMbit"]) {
      if (sample[key] !== undefined && (!Number.isFinite(sample[key]) || sample[key] < 0)) return false;
    }
    if (sample.durationSeconds !== undefined && !Number.isFinite(sample.energyWh)) return false;
  }
  return true;
}
