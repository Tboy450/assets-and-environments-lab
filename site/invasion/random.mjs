// Seeded random numbers for the invasion game. The generator state is a plain number on the
// holder object, so a battle stays reproducible in tests and never shares state between missions.
export function nextRandom(holder) {
  holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0;
  let t = holder.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randomRange = (holder, low, high) => low + (high - low) * nextRandom(holder);
export const randomPick = (holder, list) => list[Math.floor(nextRandom(holder) * list.length) % list.length];
