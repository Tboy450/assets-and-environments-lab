// Draws the Mission and Pilot views into the flight canvas (3D renderer or 2D fallback).
import { model } from "../flight-model.mjs?v=dev";
import { $, chaseRenderer, clamp, flightCanvas, state } from "./context.mjs?v=dev";
import { backdropInk, drawMissionBackdrop, drawMissionBackdropOverlay, isCleanroomPortrait } from "./mission-backdrop.mjs?v=dev";
import { layoutPartLabels } from "./part-label-layout.mjs?v=dev";
import { missionVehicleState } from "../vehicle-presentation.mjs?v=dev";
import { inspectionTarget } from "../vehicle-inspector.mjs?v=dev";

const flightCtx = flightCanvas.getContext("2d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const titanMountainImage = new Image();
titanMountainImage.decoding = "async";
titanMountainImage.src = "./assets/titan-mountain-reference.jpg";

export function resizeCanvas(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return rect;
}

export function drawFlight() {
  const rect = resizeCanvas(flightCanvas, flightCtx);
  const w = rect.width;
  const h = rect.height;
  // A hidden or collapsed view has no size; drawing it would throw.
  if (w < 2 || h < 2) return;
  const ctx = flightCtx;
  ctx.clearRect(0, 0, w, h);

  if (state.view === "pilot") {
    drawPilotFlight(ctx, w, h);
    return;
  }

  // One backdrop per layer (see mission-backdrop.mjs; the earlier one is archived).
  drawMissionBackdrop(ctx, w, h);
  drawVehicle(ctx, w, h);
  drawHud(ctx, w, h);
}

function drawPilotFlight(ctx, w, h) {
  if (chaseRenderer) {
    chaseRenderer.draw(ctx, w, h, state);
    return;
  }
  const horizon = h * 0.31 + state.pitch * 18;
  drawTitanEnvironment(ctx, w, h, horizon);

  const shadowWidth = Math.min(w * 0.21, 260) * (1 - Math.min(state.altitude, 60) / 170);
  ctx.save();
  ctx.fillStyle = "rgba(38, 16, 5, 0.32)";
  ctx.filter = "blur(7px)";
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.58, shadowWidth, shadowWidth * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawRotorWash(ctx, w, h);
  drawChaseVehicle(ctx, w, h);
  drawTitanHaze(ctx, w, h, horizon);
}

function hashUnit(value) {
  const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function drawTitanEnvironment(ctx, w, h, horizon) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#e2a04e");
  sky.addColorStop(0.28, "#d28438");
  sky.addColorStop(0.62, "#a64d20");
  sky.addColorStop(1, "#6d270e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  if (titanMountainImage.complete && titanMountainImage.naturalWidth > 0) {
    const sourceW = titanMountainImage.naturalWidth;
    const sourceH = titanMountainImage.naturalHeight;
    const targetH = Math.min(h * 0.61, horizon + h * 0.24);
    const sourceAspect = sourceW / sourceH;
    const targetAspect = w / targetH;
    let sx = 0;
    let sy = 0;
    let sw = sourceW;
    let sh = sourceH;

    if (targetAspect > sourceAspect) {
      sh = sourceW / targetAspect;
      sy = Math.max(0, Math.min(sourceH - sh, sourceH * 0.08));
    } else {
      sw = sourceH * targetAspect;
      sx = (sourceW - sw) / 2;
    }

    ctx.save();
    ctx.globalAlpha = 0.86;
    ctx.filter = "saturate(0.78) contrast(1.08) brightness(0.88)";
    ctx.drawImage(titanMountainImage, sx, sy, sw, sh, 0, 0, w, targetH);
    ctx.restore();

    const mountainHaze = ctx.createLinearGradient(0, 0, 0, targetH);
    mountainHaze.addColorStop(0, "rgba(230, 159, 69, 0.24)");
    mountainHaze.addColorStop(0.52, "rgba(190, 91, 30, 0.12)");
    mountainHaze.addColorStop(1, "rgba(113, 42, 14, 0.46)");
    ctx.fillStyle = mountainHaze;
    ctx.fillRect(0, 0, w, targetH);
  }

  const ridgeColors = ["rgba(105, 43, 19, 0.18)", "rgba(126, 50, 19, 0.3)", "rgba(145, 57, 18, 0.5)"];
  for (let ridge = 0; ridge < 3; ridge += 1) {
    const baseY = horizon + 4 + ridge * 18;
    ctx.fillStyle = ridgeColors[ridge];
    ctx.beginPath();
    ctx.moveTo(0, baseY + 16);
    ctx.bezierCurveTo(w * 0.16, baseY - 22 - ridge * 3, w * 0.3, baseY + 18, w * 0.46, baseY - 6);
    ctx.bezierCurveTo(w * 0.62, baseY - 30, w * 0.78, baseY + 18, w, baseY - 10);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  }

  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, "rgba(126, 53, 19, 0.18)");
  ground.addColorStop(0.35, "#8b3512");
  ground.addColorStop(1, "#57200c");
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon + 32, w, h - horizon - 32);

  const travel = state.missionTime * Math.max(0.45, state.speed) * 0.0045;
  for (let i = 0; i < 150; i += 1) {
    const depth = (hashUnit(i * 8.17) + travel) % 1;
    const perspective = depth * depth;
    const y = horizon + 38 + perspective * (h - horizon - 28);
    const drift = Math.sin(state.heading * Math.PI / 180) * perspective * 90;
    const x = ((hashUnit(i * 19.31 + 4) * (w + 120) + drift) % (w + 120)) - 60;
    const size = 0.8 + perspective * (8 + hashUnit(i * 3.9) * 12);
    const warm = Math.floor(72 + hashUnit(i * 5.6) * 42);

    ctx.fillStyle = `rgba(35, 12, 4, ${0.15 + perspective * 0.42})`;
    ctx.beginPath();
    ctx.ellipse(x + size * 0.3, y + size * 0.32, size * 0.86, size * 0.28, -0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgb(${warm + 55}, ${warm}, ${Math.max(18, warm - 44)})`;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.74, y + size * 0.12);
    ctx.lineTo(x - size * 0.34, y - size * 0.52);
    ctx.lineTo(x + size * 0.36, y - size * 0.42);
    ctx.lineTo(x + size * 0.72, y + size * 0.02);
    ctx.lineTo(x + size * 0.28, y + size * 0.34);
    ctx.lineTo(x - size * 0.45, y + size * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 194, 102, ${0.08 + perspective * 0.24})`;
    ctx.lineWidth = Math.max(0.6, perspective * 1.4);
    ctx.beginPath();
    ctx.moveTo(x - size * 0.28, y - size * 0.35);
    ctx.lineTo(x + size * 0.31, y - size * 0.26);
    ctx.stroke();
  }
}

function drawRotorWash(ctx, w, h) {
  const phase = state.missionTime * 2.4;
  ctx.save();
  ctx.strokeStyle = "rgba(231, 159, 82, 0.13)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    const radius = 26 + ((phase * 12 + i * 23) % 90);
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.57, radius * 1.8, radius * 0.24, 0, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTitanHaze(ctx, w, h, horizon) {
  const cloud = state.edl ? 0 : state.weather?.haze || 0;
  if (cloud) {
    ctx.fillStyle = `rgba(89, 66, 47, ${cloud * 0.5})`;
    ctx.fillRect(0, 0, w, h);
  }
  const haze = ctx.createLinearGradient(0, 0, 0, h);
  haze.addColorStop(0, "rgba(255, 205, 106, 0.17)");
  haze.addColorStop(Math.max(0.2, horizon / h), "rgba(235, 145, 61, 0.14)");
  haze.addColorStop(0.72, "rgba(126, 49, 16, 0.03)");
  haze.addColorStop(1, "rgba(63, 22, 6, 0.12)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  for (let i = 0; i < 34; i += 1) {
    const x = (hashUnit(i * 5.13) * w + state.missionTime * state.wind * (2 + hashUnit(i) * 4)) % w;
    const y = horizon * 0.45 + hashUnit(i * 11.7) * Math.max(40, h - horizon * 0.35);
    const radius = 0.6 + hashUnit(i * 3.4) * 2.2;
    ctx.fillStyle = `rgba(255, 197, 112, ${0.04 + hashUnit(i * 4.7) * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawChaseVehicle(ctx, w, h) {
  if (chaseRenderer) {
    chaseRenderer.draw(ctx, w, h, state);
    return;
  }
  drawChaseVehicleFallback(ctx, w, h);
}

function drawChaseVehicleFallback(ctx, w, h) {
  const size = clamp(Math.min(w, h) * 0.245, 96, 202);
  const cx = w / 2;
  const cy = h * 0.37;
  const fixedYaw = clamp(Math.sin(((state.heading - 84) * Math.PI) / 180) * 0.34 + state.yaw * 0.42, -0.58, 0.58);
  const fixedPitch = clamp(state.pitch * 0.5, -0.42, 0.42);
  const viewYaw = state.cameraMode === "free" ? clamp(state.cameraYaw + fixedYaw * 0.25, -1.15, 1.15) : fixedYaw;
  const viewPitch = state.cameraMode === "free" ? clamp(state.cameraPitch + fixedPitch * 0.35, -0.58, 0.58) : fixedPitch;
  const bank = -state.roll * 0.14 + viewYaw * 0.025;
  const lift = Math.sin(state.missionTime * 1.8) * 2.4;

  ctx.save();
  ctx.translate(cx + viewYaw * size * 0.08, cy + lift - viewPitch * size * 0.07);
  ctx.rotate(bank);
  ctx.transform(1, viewYaw * 0.045, viewYaw * 0.24, 0.86 + viewPitch * 0.13, 0, 0);

  // Rear three-quarter chase view: the nose points toward the horizon.
  const stations = [
    [-0.9, -0.38],
    [0.9, -0.38],
    [-1.02, 0.23],
    [1.02, 0.23],
  ];

  // Far rotor stacks sit behind the fuselage in this camera angle.
  stations.slice(0, 2).forEach(([x, y], index) => {
    drawCoaxialRotor(ctx, x * size, y * size, size * 0.42, state.missionTime * (index ? -8 : 8), index);
  });

  ctx.strokeStyle = "rgba(104, 109, 108, 0.98)";
  ctx.lineWidth = Math.max(5, size * 0.052);
  ctx.lineCap = "round";
  stations.forEach(([x, y], index) => {
    ctx.beginPath();
    ctx.moveTo(Math.sign(x) * size * 0.38, index < 2 ? -size * 0.25 : size * 0.14);
    ctx.lineTo(x * size, y * size);
    ctx.stroke();
  });

  // Long fore-aft skids and their splayed supports.
  ctx.strokeStyle = "rgba(72, 77, 77, 0.98)";
  ctx.lineWidth = Math.max(3, size * 0.027);
  ctx.beginPath();
  ctx.moveTo(-size * 0.34, -size * 0.18);
  ctx.lineTo(-size * 0.57, size * 0.39);
  ctx.moveTo(-size * 0.42, size * 0.28);
  ctx.lineTo(-size * 0.66, size * 0.64);
  ctx.moveTo(size * 0.34, -size * 0.18);
  ctx.lineTo(size * 0.57, size * 0.39);
  ctx.moveTo(size * 0.42, size * 0.28);
  ctx.lineTo(size * 0.66, size * 0.64);
  ctx.moveTo(-size * 0.62, size * 0.06);
  ctx.lineTo(-size * 0.69, size * 0.67);
  ctx.moveTo(size * 0.62, size * 0.06);
  ctx.lineTo(size * 0.69, size * 0.67);
  ctx.stroke();

  // Long equipment deck, similar to the exposed flight-structure photographs.
  const metal = ctx.createLinearGradient(-size * 0.5, -size * 0.65, size * 0.5, size * 0.55);
  metal.addColorStop(0, "#87908f");
  metal.addColorStop(0.34, "#596264");
  metal.addColorStop(0.7, "#6e7776");
  metal.addColorStop(1, "#343d3f");
  ctx.fillStyle = metal;
  ctx.strokeStyle = "rgba(38, 43, 44, 0.86)";
  ctx.lineWidth = Math.max(1.5, size * 0.012);
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, -size * 0.48);
  ctx.lineTo(size * 0.45, -size * 0.48);
  ctx.lineTo(size * 0.5, size * 0.38);
  ctx.lineTo(size * 0.45, size * 0.56);
  ctx.lineTo(-size * 0.45, size * 0.56);
  ctx.lineTo(-size * 0.5, size * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Only the forward third is enclosed by the curved insulated cab.
  const shell = ctx.createLinearGradient(0, -size * 0.78, 0, size * 0.08);
  shell.addColorStop(0, "#f0f1ed");
  shell.addColorStop(0.48, "#a9b0ae");
  shell.addColorStop(1, "#747d7d");
  ctx.fillStyle = shell;
  ctx.strokeStyle = "rgba(55, 61, 61, 0.9)";
  ctx.lineWidth = Math.max(1.5, size * 0.014);
  ctx.beginPath();
  ctx.moveTo(-size * 0.46, -size * 0.18);
  ctx.bezierCurveTo(-size * 0.5, -size * 0.36, -size * 0.34, -size * 0.54, -size * 0.19, -size * 0.57);
  ctx.quadraticCurveTo(0, -size * 0.63, size * 0.19, -size * 0.57);
  ctx.bezierCurveTo(size * 0.34, -size * 0.54, size * 0.5, -size * 0.36, size * 0.46, -size * 0.18);
  ctx.quadraticCurveTo(0, -size * 0.09, -size * 0.46, -size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(244, 247, 240, 0.42)";
  ctx.lineWidth = Math.max(1, size * 0.01);
  ctx.beginPath();
  ctx.moveTo(-size * 0.23, -size * 0.53);
  ctx.quadraticCurveTo(0, -size * 0.6, size * 0.23, -size * 0.53);
  ctx.stroke();

  // Gold blanket rails and access-panel edges from the integration article.
  ctx.strokeStyle = "#d1a02d";
  ctx.lineWidth = Math.max(2, size * 0.018);
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, -size * 0.17);
  ctx.lineTo(-size * 0.42, size * 0.39);
  ctx.lineTo(-size * 0.34, size * 0.52);
  ctx.lineTo(size * 0.34, size * 0.52);
  ctx.lineTo(size * 0.42, size * 0.39);
  ctx.lineTo(size * 0.45, -size * 0.17);
  ctx.stroke();

  ctx.strokeStyle = "rgba(27, 33, 34, 0.62)";
  ctx.lineWidth = 1;
  for (const y of [-0.05, 0.14, 0.33]) {
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, size * y);
    ctx.lineTo(size * 0.42, size * y);
    ctx.stroke();
  }

  for (const x of [-0.26, 0, 0.26]) {
    ctx.fillStyle = "#131a1d";
    ctx.fillRect(size * (x - 0.075), size * 0.2, size * 0.15, size * 0.1);
    ctx.strokeStyle = "#d1a02d";
    ctx.strokeRect(size * (x - 0.075), size * 0.2, size * 0.15, size * 0.1);
  }

  // Large top-mounted high-gain antenna and its short pedestal.
  ctx.strokeStyle = "#656d6d";
  ctx.lineWidth = Math.max(3, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(size * 0.08, size * 0.42);
  ctx.lineTo(size * 0.08, size * 0.24);
  ctx.stroke();
  ctx.fillStyle = "#b8bdb8";
  ctx.strokeStyle = "#616968";
  ctx.lineWidth = Math.max(1.5, size * 0.012);
  ctx.beginPath();
  ctx.ellipse(size * 0.08, size * 0.22, size * 0.19, size * 0.058, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Rear stabilizer fins and sensor housings.
  ctx.fillStyle = "#847046";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * size * 0.39, size * 0.32);
    ctx.lineTo(side * size * 0.57, size * 0.16);
    ctx.lineTo(side * size * 0.43, size * 0.48);
    ctx.closePath();
    ctx.fill();
  }

  // Twin helicopter-style landing rails with two braced mounts per side.
  ctx.strokeStyle = "rgba(61, 67, 67, 0.98)";
  ctx.lineWidth = Math.max(3.2, size * 0.03);
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * size * 0.61, -size * 0.11);
    ctx.quadraticCurveTo(side * size * 0.68, -size * 0.04, side * size * 0.67, size * 0.13);
    ctx.lineTo(side * size * 0.7, size * 0.68);
    ctx.quadraticCurveTo(side * size * 0.68, size * 0.75, side * size * 0.59, size * 0.73);
    ctx.stroke();

    ctx.lineWidth = Math.max(2.4, size * 0.022);
    ctx.beginPath();
    ctx.moveTo(side * size * 0.39, size * 0.02);
    ctx.lineTo(side * size * 0.66, size * 0.22);
    ctx.moveTo(side * size * 0.41, size * 0.38);
    ctx.lineTo(side * size * 0.69, size * 0.55);
    ctx.stroke();
    ctx.lineWidth = Math.max(3.2, size * 0.03);
  }

  // Near rotor stacks overlap the airframe, making all four stations legible.
  stations.slice(2).forEach(([x, y], index) => {
    drawCoaxialRotor(ctx, x * size, y * size, size * 0.45, state.missionTime * (index ? -8 : 8), index + 2);
  });
  ctx.restore();
}

function drawCoaxialRotor(ctx, x, y, radius, spin, index) {
  ctx.save();
  ctx.translate(x, y);

  ctx.strokeStyle = "rgba(62, 66, 66, 0.98)";
  ctx.lineWidth = Math.max(2.5, radius * 0.07);
  ctx.beginPath();
  ctx.moveTo(0, -radius * 0.34);
  ctx.lineTo(0, radius * 0.35);
  ctx.stroke();

  // Each mast carries two counter-rotating three-blade rotors.
  for (let layer = 0; layer < 2; layer += 1) {
    const layerY = layer === 0 ? -radius * 0.23 : radius * 0.13;
    ctx.save();
    ctx.translate(0, layerY);
    ctx.scale(1, 0.23);
    const phase = spin * 0.18 * (layer === 0 ? 1 : -1) + index * 0.7 + layer * 0.48;
    const blade = radius * 0.98;
    const root = radius * 0.14;
    const rootWidth = radius * 0.25;
    const tipWidth = radius * 0.04;

    // Long tapered blades are repeated in tight trailing positions to show RPM.
    for (let ghost = 8; ghost >= 0; ghost -= 1) {
      ctx.save();
      ctx.rotate(phase - ghost * 0.085 * (layer === 0 ? 1 : -1));
      ctx.fillStyle = layer === 0
        ? `rgba(220, 208, 170, ${0.42 - ghost * 0.038})`
        : `rgba(143, 159, 155, ${0.37 - ghost * 0.033})`;
      for (let bladeIndex = 0; bladeIndex < model.bladesPerRotor; bladeIndex++) {
        ctx.beginPath();
        ctx.moveTo(root, -rootWidth);
        ctx.lineTo(blade, -tipWidth);
        ctx.lineTo(blade, tipWidth);
        ctx.lineTo(root, rootWidth * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.rotate(Math.PI * 2 / model.bladesPerRotor);
      }
      ctx.restore();
    }
    ctx.restore();

    ctx.fillStyle = layer === 0 ? "#d4d3c6" : "#8c9896";
    ctx.strokeStyle = "#3d4444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, layerY, Math.max(3.5, radius * 0.085), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Numbered callouts for the Internal and Thermal layers; nudged apart so none overlap.
export let partMarkers = [];
// Numbers stay on their parts' fixed anchors (part-label-layout.mjs); a crowded number moves to a
// nearby free spot with a leader line and keeps it while it stays free.
const labelMemory = new Map();
function drawPartMarkers(ctx, labels) {
  const width = ctx.canvas.width / (window.devicePixelRatio || 1), height = ctx.canvas.height / (window.devicePixelRatio || 1);
  // Keep clear of the ALT/V/S/SPD and ROLL/PITCH/WIND readouts (drawHud).
  const avoid = [{ x: 14, y: 84, w: 150, h: 66 }, { x: width - 184, y: 58, w: 170, h: 66 }];
  // Phones draw slightly smaller circles and pack them closer.
  const compact = width < 500, scale = compact ? 0.86 : 1, radius = compact ? 8 : 9;
  partMarkers = layoutPartLabels(labels, { width, height, selected: state.selectedPart, memory: labelMemory, now: performance.now(), avoid, scale });
  ctx.save();
  ctx.font = compact ? "800 10px Inter, Arial, sans-serif" : "800 11px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const marker of partMarkers) {
    if (!marker.drawn || !marker.displaced) continue;
    // Leader from the part's anchor to its displaced number.
    const dx = marker.x - marker.anchorX, dy = marker.y - marker.anchorY, d = Math.hypot(dx, dy);
    ctx.beginPath();
    ctx.moveTo(marker.anchorX, marker.anchorY);
    ctx.lineTo(marker.x - dx / d * radius, marker.y - dy / d * radius);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(223, 239, 255, 0.85)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(marker.anchorX, marker.anchorY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(223, 239, 255, 0.95)";
    ctx.fill();
  }
  for (const marker of partMarkers) {
    if (!marker.drawn) continue;
    const selected = marker.name === state.selectedPart;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, selected ? radius + 3 : radius, 0, Math.PI * 2);
    ctx.fillStyle = selected ? "#7ce7ff" : "rgba(223, 239, 255, 0.92)";
    ctx.fill();
    if (selected) { ctx.lineWidth = 2; ctx.strokeStyle = "#06121a"; ctx.stroke(); }
    ctx.fillStyle = "#06121a";
    ctx.fillText(String(marker.index), marker.x, marker.y + 0.5);
  }
  if (partMarkers.some(marker => marker.mock)) {
    // The original model's interior is invented; say so on the diagram itself.
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "800 13px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(255, 180, 87, 0.95)";
    ctx.fillText("MOCK-UP: original demo model, not the real layout", 14, ctx.canvas.height / (window.devicePixelRatio || 1) - 58);
  }
  ctx.restore();
}

function drawVehicle(ctx, w, h) {
  const displayState = missionVehicleState(state, isCleanroomPortrait());
  if (chaseRenderer) {
    const layered = state.missionLayer !== "exterior";
    const labels = chaseRenderer.drawMission(ctx, w, h, displayState, {
      layer: state.missionLayer, parked: isCleanroomPortrait(), inspector: state.inspector,
      focusPart: inspectionTarget(state), now: state.lastTick, reduceMotion: reducedMotion.matches,
    });
    drawMissionBackdropOverlay(ctx, w, h, labels);
    if (layered) drawPartMarkers(ctx, labels);
    else partMarkers = [];
    return;
  }
  const scale = Math.min(w, h) / 6.1;
  const cx = w / 2;
  const cy = h / 2 + 6;
  const rotorRadius = (model.rotorDiameterM / 2) * scale;
  const xOffset = (3.85 / 2 - model.rotorDiameterM / 2) * scale;
  const yOffset = xOffset * 1.16;
  const t = displayState.missionTime;
  const loadBase = clamp(0.44 + displayState.throttle * 0.55, 0.25, 1.0);
  const rotorCenters = [
    [-xOffset, -yOffset],
    [xOffset, -yOffset],
    [-xOffset, yOffset],
    [xOffset, yOffset],
  ];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(isCleanroomPortrait() ? Math.PI / 2 : ((displayState.heading - 84) * Math.PI) / 180);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = "rgba(154, 171, 176, 0.88)";
  ctx.lineWidth = 5;
  rotorCenters.forEach(([x, y], index) => {
    ctx.beginPath();
    ctx.moveTo(index < 2 ? Math.sign(x) * 0.32 * scale : Math.sign(x) * 0.38 * scale, index < 2 ? -0.48 * scale : 0.52 * scale);
    ctx.lineTo(x, y);
    ctx.stroke();
  });

  rotorCenters.forEach(([x, y], index) => {
    const load = clamp(loadBase + Math.sin(t * 3 + index) * 0.06 + Math.abs(displayState.roll) * 0.12, 0.2, 1);
    drawRotor(ctx, x, y, rotorRadius, t, index, load);
  });

  ctx.globalAlpha = 1;

  // Skid rails remain visible in the top-down engineering view.
  ctx.strokeStyle = "rgba(121, 139, 143, 0.8)";
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.68 * scale, -0.72 * scale);
    ctx.lineTo(side * 0.68 * scale, 0.78 * scale);
    ctx.moveTo(side * 0.47 * scale, -0.5 * scale);
    ctx.lineTo(side * 0.68 * scale, -0.62 * scale);
    ctx.moveTo(side * 0.47 * scale, 0.5 * scale);
    ctx.lineTo(side * 0.68 * scale, 0.62 * scale);
    ctx.stroke();
  }

  const metal = ctx.createLinearGradient(-0.5 * scale, -0.9 * scale, 0.55 * scale, 0.9 * scale);
  metal.addColorStop(0, "#d2dada");
  metal.addColorStop(0.42, "#738085");
  metal.addColorStop(0.72, "#aeb8b8");
  metal.addColorStop(1, "#4f5a5d");
  ctx.fillStyle = metal;
  ctx.strokeStyle = "#d1a02d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-0.48 * scale, -0.92 * scale);
  ctx.lineTo(0.48 * scale, -0.92 * scale);
  ctx.lineTo(0.52 * scale, 0.72 * scale);
  ctx.lineTo(0.4 * scale, 0.9 * scale);
  ctx.lineTo(-0.4 * scale, 0.9 * scale);
  ctx.lineTo(-0.52 * scale, 0.72 * scale);
  ctx.lineTo(-0.52 * scale, -0.56 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const cabMetal = ctx.createLinearGradient(-0.45 * scale, -1.02 * scale, 0.45 * scale, -0.3 * scale);
  cabMetal.addColorStop(0, "#eef0ed");
  cabMetal.addColorStop(0.52, "#a5afae");
  cabMetal.addColorStop(1, "#687477");
  ctx.fillStyle = cabMetal;
  ctx.strokeStyle = "rgba(43, 53, 55, 0.86)";
  ctx.beginPath();
  ctx.moveTo(-0.48 * scale, -0.42 * scale);
  ctx.lineTo(-0.48 * scale, -0.76 * scale);
  ctx.quadraticCurveTo(-0.34 * scale, -1.03 * scale, 0, -1.06 * scale);
  ctx.quadraticCurveTo(0.34 * scale, -1.03 * scale, 0.48 * scale, -0.76 * scale);
  ctx.lineTo(0.48 * scale, -0.42 * scale);
  ctx.quadraticCurveTo(0, -0.3 * scale, -0.48 * scale, -0.42 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(23, 31, 34, 0.52)";
  ctx.lineWidth = 1;
  for (const y of [-0.28, 0.08, 0.44, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(-0.47 * scale, y * scale);
    ctx.lineTo(0.47 * scale, y * scale);
    ctx.stroke();
  }

  for (const x of [-0.3, 0, 0.3]) {
    ctx.fillStyle = "#182126";
    ctx.fillRect((x - 0.09) * scale, 0.36 * scale, 0.18 * scale, 0.16 * scale);
    ctx.strokeStyle = "#d1a02d";
    ctx.strokeRect((x - 0.09) * scale, 0.36 * scale, 0.18 * scale, 0.16 * scale);
  }

  // High-gain antenna reads as a large circular dish from above.
  ctx.fillStyle = "rgba(209, 215, 211, 0.92)";
  ctx.strokeStyle = "rgba(66, 75, 76, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0.08 * scale, 0.04 * scale, 0.25 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.08 * scale, 0.04 * scale);
  ctx.lineTo(0.24 * scale, 0.04 * scale);
  ctx.moveTo(0.08 * scale, -0.12 * scale);
  ctx.lineTo(0.08 * scale, 0.2 * scale);
  ctx.stroke();

  ctx.fillStyle = "#263034";
  for (const x of [-0.31, 0.31]) {
    ctx.beginPath();
    ctx.arc(x * scale, -0.63 * scale, 0.055 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#87764c";
  ctx.beginPath();
  ctx.moveTo(-0.47 * scale, 0.52 * scale);
  ctx.lineTo(-0.72 * scale, 0.78 * scale);
  ctx.lineTo(-0.46 * scale, 0.86 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  ctx.save();
  ctx.translate(28, h - 42);
  ctx.strokeStyle = "rgba(223, 239, 255, 0.75)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(scale, 0);
  ctx.stroke();
  ctx.fillStyle = "rgba(223, 239, 255, 0.86)";
  ctx.font = "700 12px Inter, Arial";
  ctx.fillText("1 m scale", 0, -8);
  ctx.restore();
}

function drawRotor(ctx, x, y, r, t, index, load) {
  const hue = load > 0.72 ? "#80f2ae" : load > 0.45 ? "#7ce7ff" : "#ffb457";
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(223, 239, 255, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = hue;
  ctx.lineWidth = 3;
  for (let ring = 0; ring < 2; ring += 1) {
    const phase = t * (3.4 + ring * 0.9) * (index % 2 ? -1 : 1) + index;
    const bladeRadius = r - ring * 7;
    ctx.save();
    ctx.rotate(phase);
    ctx.beginPath();
    ctx.moveTo(-bladeRadius, 0);
    ctx.lineTo(bladeRadius, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(7, 17, 27, 0.92)";
  ctx.strokeStyle = "rgba(223, 239, 255, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(223, 239, 255, 0.88)";
  ctx.font = "700 11px Inter, Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${index * 2 + 1}/${index * 2 + 2}`, 0, -r - 9);
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawHud(ctx, w, h) {
  ctx.save();
  // Readout colors follow the backdrop (dark on light grounds, yellow in the yellow modes), with a
  // contrasting halo.
  const colors = backdropInk();
  ctx.shadowColor = colors.halo;
  ctx.shadowBlur = 4;
  ctx.font = "700 12px SFMono-Regular, Consolas, monospace";
  ctx.fillStyle = colors.text;
  if (isCleanroomPortrait()) {
    ctx.fillText("PARKED", 24, 100);
    ctx.fillText("ROTORS STOPPED", 24, 120);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = "rgba(124, 231, 255, 0.55)";
  ctx.lineWidth = 1;
  const centerX = w / 2;
  const centerY = h / 2 + 20;
  // The crosshair would sit on top of the part callouts in the Internal and Thermal layers.
  if (state.missionLayer === "exterior") {
    ctx.beginPath();
    ctx.moveTo(centerX - 36, centerY);
    ctx.lineTo(centerX - 10, centerY);
    ctx.moveTo(centerX + 10, centerY);
    ctx.lineTo(centerX + 36, centerY);
    ctx.moveTo(centerX, centerY - 36);
    ctx.lineTo(centerX, centerY - 10);
    ctx.moveTo(centerX, centerY + 10);
    ctx.lineTo(centerX, centerY + 36);
    ctx.stroke();
  }

  // Left column starts below the "Vehicle / North up" overlay so ALT is never hidden.
  const readout = (text, x, y) => {
    if (colors.outline) {
      ctx.strokeStyle = colors.outline;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.strokeText(text, x, y);
    }
    ctx.fillText(text, x, y);
  };
  readout(`ALT ${state.altitude.toFixed(1)} m`, 24, 100);
  readout(`V/S ${state.verticalSpeed.toFixed(2)} m/s`, 24, 120);
  readout(`SPD ${state.speed.toFixed(1)} m/s`, 24, 140);
  ctx.textAlign = "right";
  readout(`ROLL ${(state.roll * 22).toFixed(1)} deg`, w - 24, 74);
  readout(`PITCH ${(state.pitch * 18).toFixed(1)} deg`, w - 24, 94);
  readout(`WIND ${state.wind.toFixed(1)} m/s`, w - 24, 114);
  ctx.restore();
}
