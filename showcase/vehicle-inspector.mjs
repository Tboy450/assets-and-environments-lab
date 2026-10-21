// Mission-only viewing controls. None of these fields affect flight, science or saved missions.
import { samplingSequence } from "./science.mjs?v=dev";
import { visibilityDefaults } from "./inspection-visibility.mjs?v=dev";

export const inspectionDefaults = Object.freeze({
  azimuth: Math.atan2(1.6, 7.2), elevation: Math.atan2(5.35, Math.hypot(1.6, 7.2)),
  zoom: 1, rotate: false, focusPart: null, subassembly: null, isolate: false, followSampling: false,
  ...visibilityDefaults,
});
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const createInspector = () => ({ ...inspectionDefaults, resetSerial: 0 });
export const inspectionAvailable = state => state.view === "mission" && state.missionLayer !== "exterior" && state.vehicleModel !== "original";
export function inspectionTarget(state) {
  const i = state.inspector;
  if (!i) return null;
  const job = samplingSequence(state);
  return i.followSampling && job.active ? job.part : i.focusPart;
}
export function resetInspector(i) {
  const serial = i.resetSerial + 1;
  Object.assign(i, inspectionDefaults, { resetSerial: serial });
}
export function rotateInspector(i, dx, dy, width, height) {
  if (![dx, dy, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
  i.azimuth = ((i.azimuth - dx / width * Math.PI * 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  i.elevation = clamp(i.elevation + dy / height * Math.PI, -1.35, 1.35);
}
export function zoomInspector(i, factor) {
  if (Number.isFinite(factor) && factor > 0) i.zoom = clamp(i.zoom * factor, 0.6, 3);
}
export function focusInspector(state, name) {
  state.selectedPart = name;
  state.inspector.focusPart = name;
  state.inspector.followSampling = false;
  state.inspector.zoom = 1;
  state.inspector.subassembly = null;
  if (!name) state.inspector.isolate = false;
}
export function inspectionSubassemblies(group) {
  const result = [];
  group?.traverse(child => { if (child.userData.inspectionLabel) result.push(child); });
  return result;
}
export function inspectionSubassembly(group, inspector) {
  return inspectionSubassemblies(group).find(child => child.name === inspector?.subassembly) ?? null;
}
export function selectInspectionSubassembly(state, group, name) {
  if (!group || inspectionTarget(state) !== group.name) return;
  const child = inspectionSubassemblies(group).find(child => child.name === name);
  if (name && !child) return;
  state.inspector.subassembly = child?.name ?? null;
  state.inspector.zoom = 1;
  state.inspector.resetSerial += 1;
}
export function inspectionGroups(name) {
  const related = {
    "sample-lines": ["drills", "sample-lines", "sample-flow", "sample-carousel", "drill-blower"],
    drams: ["drams"],
    battery: ["battery", "battery-sensor"],
    "hga-actuators": ["hga-actuators", "high-gain-antenna"],
    "aft-bulkhead": ["aft-bulkhead", "mmrtg", "fan"],
  };
  return related[name] ?? (name ? [name] : []);
}

export function inspectionModified(i, target) {
  return !!target || Math.abs(i.zoom - 1) > 1e-6
    || Math.abs(i.azimuth - inspectionDefaults.azimuth) > 1e-6
    || Math.abs(i.elevation - inspectionDefaults.elevation) > 1e-6;
}
