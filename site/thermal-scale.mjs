// Shared absolute-temperature colors. Range selection only changes the legend's window.
export const thermalRanges = Object.freeze({
  full: Object.freeze({ min: -180, max: 40, label: "Whole lander" }),
  inside: Object.freeze({ min: -30, max: 40, label: "Inside" }),
});

// The landed battery's 10 +/- 10 C reference band and 35 C upper limit inform the
// equipment colors [PUB]. These are not qualification limits for all thermal zones.
const stops = [
  [-180, [43, 26, 110]], [-30, [31, 95, 214]], [0, [95, 211, 90]],
  [20, [95, 211, 90]], [30, [242, 227, 58]], [35, [217, 52, 43]], [40, [217, 52, 43]],
];

// A temperature has the same color in every view, regardless of the legend range.
export function thermalRgb(celsius) {
  const t = Math.min(stops.at(-1)[0], Math.max(stops[0][0], celsius));
  for (let i = 1; i < stops.length; i += 1) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      const u = (t - t0) / (t1 - t0);
      return c0.map((value, k) => Math.round(value + (c1[k] - value) * u));
    }
  }
  return stops.at(-1)[1];
}

export const thermalCss = celsius => `rgb(${thermalRgb(celsius).join(", ")})`;
export function thermalGradientCss(range = thermalRanges.full) {
  const values = [range.min, ...stops.map(([c]) => c).filter(c => c > range.min && c < range.max), range.max];
  return `linear-gradient(90deg, ${values.map(c => `${thermalCss(c)} ${(c - range.min) / (range.max - range.min) * 100}%`).join(", ")})`;
}
