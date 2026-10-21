// Part-number layout for the Mission view's Internal and Thermal layers.
// Each number sits on its part's fixed 3D anchor (a point on the part's own hardware, projected
// each frame), so it turns with the vehicle instead of floating. When two numbers would overlap,
// the farther one moves to a nearby free spot around its anchor and a short leader line points back
// to the anchor. Once a spot is chosen it is kept while it stays free, and a number only returns to
// its anchor when there is clear room, so numbers do not chain, flip or jump as the view rotates.
// The offset eases over a few frames; the anchor itself is never smoothed (it stays pinned).
// The first version pushed colliding numbers straight down the screen in 14 px steps; it is
// archived in archive/part-labels-2026-10-15.

const GAP = 21;          // minimum distance between number centers (circles are 18 px across)
const RETURN_GAP = 30;   // clear room needed before a displaced number returns to its anchor
const MEMORY_MS = 600;   // how long a number's chosen spot is remembered between frames
const EASE_RATE = 10;    // per second
const ring = (radius, count, start = -Math.PI / 4) => Array.from({ length: count }, (_, k) => {
  const a = start + k / count * Math.PI * 2;
  return [Math.round(Math.cos(a) * radius), Math.round(Math.sin(a) * radius)];
});
// Nearest spots first: the anchor, then rings of 8, 10 and 12 directions.
export const labelOffsets = Object.freeze([[0, 0], ...ring(24, 8), ...ring(40, 10, -Math.PI / 2), ...ring(56, 12)]);

const inside = (x, y, width, height, margin) => x > margin && x < width - margin && y > margin && y < height - margin;
const inRect = (x, y, r, pad) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

// labels: [{ name, x, y, depth?, onCanvas? }] in their fixed numbering order (x, y are the
// projected anchor). Returns markers in the same order with index (1-based), anchorX/anchorY,
// display x/y, drawn and displaced. memory (a Map) carries spots and easing between frames.
// scale shrinks the spacing and spots on phones, where the circles are drawn smaller.
export function layoutPartLabels(labels, { width, height, selected = null, memory = new Map(), now = 0, margin = 14, avoid = [], scale = 1 }) {
  const markers = labels.map((label, i) => ({
    ...label, index: i + 1, anchorX: label.x, anchorY: label.y, drawn: false, displaced: false,
  }));
  const free = (x, y, placed, gap) => inside(x, y, width, height, margin)
    && !avoid.some(r => inRect(x, y, r, 10))
    && placed.every(p => Math.hypot(p.x - x, p.y - y) >= gap);
  const visible = markers.filter(m => m.onCanvas !== false && inside(m.anchorX, m.anchorY, width, height, margin));
  // The selected part keeps its anchor; the rest are placed nearest first, ties by number.
  visible.sort((a, b) => (b.name === selected) - (a.name === selected) || (a.depth ?? 0) - (b.depth ?? 0) || a.index - b.index);
  const placed = [];
  for (const m of visible) {
    const past = memory.get(m.name);
    const recent = past && now - past.t < MEMORY_MS;
    const tryOrder = [];
    const gap = GAP * scale, returnGap = RETURN_GAP * scale;
    if (recent && (past.offset[0] || past.offset[1])) {
      tryOrder.push([[0, 0], returnGap], [past.offset, gap]);
    } else {
      tryOrder.push([[0, 0], gap]);
    }
    // When it has to move, a number takes the free spot nearest its last one, so it slides a
    // little instead of hopping across its part.
    const from = recent ? past.offset : [0, 0];
    const rest = labelOffsets.slice(1).map(o => [o.map(v => Math.round(v * scale)), 0]);
    for (const r of rest) r[1] = Math.hypot(r[0][0] - from[0], r[0][1] - from[1]) + Math.hypot(r[0][0], r[0][1]) * 0.25;
    rest.sort((a, b) => a[1] - b[1]);
    for (const [offset] of rest) tryOrder.push([offset, gap]);
    let chosen = m.name === selected ? [0, 0] : null;
    for (const [offset, gap] of chosen ? [] : tryOrder) {
      if (free(m.anchorX + offset[0], m.anchorY + offset[1], placed, gap)) { chosen = offset; break; }
    }
    chosen ??= [0, 0];  // nowhere free: stay on the anchor rather than wander
    const dt = recent ? Math.min(0.1, (now - past.t) / 1000) : 0;
    const k = recent ? 1 - Math.exp(-EASE_RATE * dt) : 1;
    const shown = recent ? past.shown.map((v, i) => v + (chosen[i] - v) * k) : [...chosen];
    memory.set(m.name, { offset: chosen, shown, t: now });
    placed.push({ x: m.anchorX + chosen[0], y: m.anchorY + chosen[1] });
    m.x = m.anchorX + shown[0];
    m.y = m.anchorY + shown[1];
    m.drawn = true;
    m.displaced = Math.hypot(shown[0], shown[1]) > 4;
  }
  for (const [name, entry] of memory) if (now - entry.t > MEMORY_MS * 4) memory.delete(name);
  return markers;
}
