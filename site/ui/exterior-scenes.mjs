// Photo-based Mission backdrops. Sources and image adaptations: assets/exterior/README.md.
function photo(file) {
  const image = new Image();
  image.decoding = "async";
  image.src = new URL(`../assets/exterior/${file}?v=dev`, import.meta.url).href;
  return image;
}
const dunes = photo("titan-dunes.jpg");
const saturn = photo("saturn-cassini.jpg");
const titan = photo("titan-halo.jpg");
const ready = image => image.complete && image.naturalWidth > 0;

export function exteriorAssetKey(kind) {
  return kind === "titan" ? Number(ready(dunes))
    : kind === "saturn" ? `${Number(ready(saturn))}:${Number(ready(titan))}` : "static";
}

export function paintTitan(c, w, h) {
  c.fillStyle = "#ad773f";
  c.fillRect(0, 0, w, h);
  if (!ready(dunes)) return;
  // Aspect-preserving crop keeps the distant dune crest and lit foreground in portrait views.
  const scale = Math.max(w / dunes.naturalWidth, h / dunes.naturalHeight);
  const sw = w / scale, sh = h / scale;
  const sx = (dunes.naturalWidth - sw) * 0.47;
  c.drawImage(dunes, sx, 0, sw, sh, 0, 0, w, h);
}

export function paintSaturn(c, w, h) {
  c.fillStyle = "#020305";
  c.fillRect(0, 0, w, h);
  const portrait = w < h;
  // Reserve the top corners for telemetry and the middle for the live vehicle.
  const sw = Math.min(w * (portrait ? 0.51 : 0.36), h * 0.39);
  const sh = sw * 0.75;
  const sx = (w - sw) / 2;
  const sy = portrait ? 55 : 10;
  const td = Math.min(w * 0.20, h * 0.19);
  const tx = Math.max(18, w * 0.15 - td / 2);
  const ty = Math.max(sy + sh + 24, h - td - 78);
  let seed = 23;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Restrained illustrative star field, wholly inside the canvas and clear of the photo bounds.
  for (let i = 0; i < Math.min(650, w * h / 900); i += 1) {
    const x = 8 + random() * (w - 16), y = 8 + random() * (h - 16);
    if ((x > sx - 5 && x < sx + sw + 5 && y > sy - 5 && y < sy + sh + 5)
      || (x > tx - 4 && x < tx + td + 4 && y > ty - 4 && y < ty + td + 4)) continue;
    const bright = random();
    c.fillStyle = bright > 0.94 ? "rgba(221,233,255,0.85)" : `rgba(185,197,216,${0.15 + bright * 0.42})`;
    const radius = bright > 0.94 ? 0.9 : 0.35 + bright * 0.3;
    c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
  }
  // Screen blending only lifts the nearly black photographic background to the space tone.
  c.save();
  c.globalCompositeOperation = "screen";
  if (ready(saturn)) c.drawImage(saturn, sx, sy, sw, sh);
  if (ready(titan)) c.drawImage(titan, tx, ty, td, td);
  c.restore();
}
