// Identity is supplied by the UI; battle stepping itself stays deterministic.
export const validMissionId = id => typeof id === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(id);

// Repeated migration of the same old checkpoint must produce the same settlement identity.
export function legacyMissionId(battle) {
  let hash = 14695981039346656037n;
  for (const character of JSON.stringify(battle)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(character.charCodeAt(0))) * 1099511628211n);
  }
  return `legacy-${battle.planetId}-${hash.toString(16)}`;
}
