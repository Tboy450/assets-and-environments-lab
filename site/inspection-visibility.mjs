// Presentation masks for existing geometry; no construction layers or hidden internals are invented.
export const globalInspectionLayers = Object.freeze([
  { id: "body-shell", label: "Body shell" },
  { id: "attic-shell", label: "Attic shell" },
  { id: "insulation", label: "Insulating foam" },
  { id: "partitions", label: "Compartment panels" },
  { id: "flow-markers", label: "Flow markers" },
]);
export const partInspectionLayers = Object.freeze([
  { id: "equipment-casings", label: "Casings" },
  { id: "equipment-covers", label: "Covers" },
  { id: "mounts", label: "Mounts" },
  { id: "interfaces", label: "Interfaces" },
  { id: "harnesses", label: "Harnesses / lines" },
]);
export const visibilityDefaults = Object.freeze({
  hiddenLayers: Object.freeze([]), hiddenPartLayers: Object.freeze({}),
});
export const inspectionLayerVisible = (i, id, part = null) =>
  !(part ? i.hiddenPartLayers?.[part] : i.hiddenLayers)?.includes(id);
export function setInspectionLayer(i, id, visible, part = null) {
  if (!(part ? partInspectionLayers : globalInspectionLayers).some(layer => layer.id === id)) return;
  const previous = (part ? i.hiddenPartLayers?.[part] : i.hiddenLayers) ?? [];
  const next = previous.filter(value => value !== id);
  if (!visible) next.push(id);
  if (!part) { i.hiddenLayers = next; return; }
  const parts = { ...i.hiddenPartLayers };
  if (next.length) parts[part] = next; else delete parts[part];
  i.hiddenPartLayers = parts;
}
export const restoreInspectionLayers = i => Object.assign(i, visibilityDefaults);
export const hiddenInspectionCount = i => (i.hiddenLayers?.length ?? 0)
  + Object.values(i.hiddenPartLayers ?? {}).reduce((sum, layers) => sum + layers.length, 0);

export function visibleInspectionHardware(group) {
  let visible = false;
  group.traverseVisible(object => { if (object.isMesh) visible = true; });
  return visible;
}

export function createInspectionVisibility(subsystems) {
  const global = new Map(globalInspectionLayers.map(({ id }) => [id, []]));
  const parts = new Map();
  const add = (id, object) => { if (object) global.get(id).push(object); };
  add("body-shell", subsystems.fuselage);
  add("attic-shell", subsystems.attic);
  for (const name of ["nose-bulkhead", "aft-bulkhead"]) add("partitions", subsystems[name]);
  for (const name of ["airflow", "sample-flow"]) add("flow-markers", subsystems[name]);
  for (const [name, group] of Object.entries(subsystems)) {
    const layers = new Map(partInspectionLayers.map(({ id }) => [id, []]));
    group.traverse(object => {
      const category = object.userData.inspectionLayer;
      if (category === "insulation") add("insulation", object);
      if (category === "interface-faces") add("partitions", object);
      if (layers.has(category)) layers.get(category).push(object);
    });
    parts.set(name, layers);
  }
  return {
    available: (id, part = null) => !!(part ? parts.get(part)?.get(id) : global.get(id))?.length,
    apply(inspector, previous) {
      const hide = object => {
        if (!previous.has(object)) previous.set(object, object.visible);
        object.visible = false;
      };
      for (const id of inspector.hiddenLayers ?? []) for (const object of global.get(id) ?? []) hide(object);
      for (const [part, ids] of Object.entries(inspector.hiddenPartLayers ?? {})) {
        for (const id of ids) for (const object of parts.get(part)?.get(id) ?? []) hide(object);
      }
    },
  };
}
