// The campaign galaxy: a spiral of stars with the campaign planets on a route through it.
// Draws onto a 2D canvas; the star field is drawn once per size and cached.
import { planets, isPlanetUnlocked } from "./campaign.mjs?v=dev";

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const gaussian = (rand) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());

export function drawStarfield(ctx, width, height, { arms = 2, count = 2600, center = [0.55, 0.5] } = {}) {
  const rand = seeded(9157);
  const background = ctx.createRadialGradient(width * center[0], height * center[1], 0, width * center[0], height * center[1], Math.max(width, height) * 0.8);
  background.addColorStop(0, "#1a1430");
  background.addColorStop(0.45, "#0b0c1c");
  background.addColorStop(1, "#04050c");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const cx = width * center[0], cy = height * center[1], scale = Math.min(width, height) * 0.48;
  // Background stars.
  for (let i = 0; i < 700; i += 1) {
    ctx.fillStyle = `rgba(220, 225, 255, ${0.15 + rand() * 0.5})`;
    ctx.fillRect(rand() * width, rand() * height, 1, 1);
  }
  // Spiral arms: logarithmic spirals with scatter that grows outward.
  for (let i = 0; i < count; i += 1) {
    const arm = i % arms;
    const t = rand() ** 0.8;
    const angle = t * 3.4 * Math.PI + arm * (2 * Math.PI / arms);
    const r = (0.08 + t * 0.95) * scale;
    const spread = (0.05 + t * 0.14) * scale;
    const x = cx + Math.cos(angle) * r * 1.25 + gaussian(rand) * spread;
    const y = cy + Math.sin(angle) * r * 0.72 + gaussian(rand) * spread * 0.6;
    const warm = rand() < 0.3;
    const alpha = 0.25 + rand() * 0.6;
    ctx.fillStyle = warm ? `rgba(255, 210, 170, ${alpha})` : `rgba(180, 200, 255, ${alpha})`;
    const size = rand() < 0.06 ? 2 : 1;
    ctx.fillRect(x, y, size, size);
  }
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.35);
  core.addColorStop(0, "rgba(255, 236, 200, 0.85)");
  core.addColorStop(0.25, "rgba(255, 190, 140, 0.35)");
  core.addColorStop(1, "rgba(120, 90, 160, 0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(cx, cy, scale * 0.42, scale * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Draws the campaign map. Returns the planets' screen positions for tapping.
// area: the part of the canvas the planets are spread over ({ x, y, width, height }), so a side
// panel never covers one; the star field still fills the whole canvas.
export function drawGalaxy(ctx, width, height, progress, { selected = null, time = 0, cache = null, area = null } = {}) {
  if (cache) ctx.drawImage(cache, 0, 0, width, height); else drawStarfield(ctx, width, height);
  const box = area || { x: 0, y: 0, width, height };
  const spots = planets.map(planet => ({ planet, x: box.x + planet.galaxy.x * box.width, y: box.y + planet.galaxy.y * box.height }));
  // The invasion route, in campaign order.
  for (let i = 1; i < spots.length; i += 1) {
    const a = spots[i - 1], b = spots[i];
    const done = progress.captured[a.planet.id];
    ctx.save();
    ctx.strokeStyle = done ? "rgba(124, 231, 255, 0.75)" : "rgba(200, 200, 220, 0.3)";
    ctx.lineWidth = done ? 2.5 : 1.5;
    if (!done) ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 30, b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
  const radius = Math.max(10, Math.min(box.width, box.height) * 0.024);
  for (const { planet, x, y } of spots) {
    const open = isPlanetUnlocked(progress, planet);
    const captured = !!progress.captured[planet.id];
    const next = open && !captured;
    if (next) {
      const pulse = (time * 0.8) % 1;
      ctx.strokeStyle = `rgba(255, 180, 87, ${0.8 * (1 - pulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius * (1.3 + pulse * 1.4), 0, Math.PI * 2);
      ctx.stroke();
    }
    const shade = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
    shade.addColorStop(0, "#ffffff");
    shade.addColorStop(0.25, planet.color);
    shade.addColorStop(1, "#05060c");
    ctx.globalAlpha = open ? 1 : 0.45;
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (captured) {
      ctx.strokeStyle = "#7ce7ff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (selected === planet.id) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.textAlign = "center";
    ctx.font = `600 ${Math.max(12, radius * 0.95)}px system-ui, sans-serif`;
    ctx.fillStyle = open ? "#f1f4ff" : "rgba(220, 220, 235, 0.55)";
    ctx.fillText(planet.name, x, y + radius + 18);
    ctx.font = `${Math.max(11, radius * 0.8)}px system-ui, sans-serif`;
    const stars = progress.stars[planet.id] || 0;
    const caption = captured ? "★".repeat(stars) + "☆".repeat(3 - stars) : open ? (planet.practice ? "Practice" : "Next target") : "Locked";
    ctx.fillStyle = captured ? "#ffd479" : open ? "#ffb457" : "rgba(200, 200, 215, 0.5)";
    ctx.fillText(caption, x, y + radius + 34);
  }
  return spots.map(({ planet, x, y }) => ({ id: planet.id, x, y, r: radius + 16 }));
}
