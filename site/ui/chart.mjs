// Flight profile chart (altitude, power, speed).
import { $, clamp, state } from "./context.mjs?v=dev";
import { resizeCanvas } from "./flight-view.mjs?v=dev";

const chartCanvas = $("chart-canvas");

const chartCtx = chartCanvas.getContext("2d");

export function drawChart() {
  const rect = resizeCanvas(chartCanvas, chartCtx);
  const w = rect.width;
  const h = rect.height;
  if (w < 2 || h < 2) return;
  const ctx = chartCtx;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
  ctx.fillRect(0, 0, w, h);

  const compactLegend = w < 340;
  const pad = { left: 42, right: 18, top: 14, bottom: compactLegend ? 42 : 24 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const data = state.chart.length > 1 ? state.chart : [{ time: 0, altitude: 0, powerKw: 0, speed: 0 }];
  const first = data[0].time;
  const last = Math.max(first + 1, data[data.length - 1].time);

  ctx.strokeStyle = "rgba(151, 184, 209, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  const xFor = (point) => pad.left + ((point.time - first) / (last - first)) * plotW;
  const drawLine = (key, max, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    data.forEach((point, index) => {
      const x = xFor(point);
      const y = pad.top + plotH - clamp(point[key] / max, 0, 1) * plotH;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  // The altitude scale grows for scouting and cruise flights (up to ~400 m) instead of clipping.
  const altitudeScale = Math.max(65, Math.ceil(Math.max(...data.map(point => point.altitude)) * 1.1 / 50) * 50);
  drawLine("altitude", altitudeScale, "#7ce7ff");
  drawLine("powerKw", 24, "#ffb457");
  drawLine("speed", 16, "#80f2ae");

  ctx.fillStyle = "rgba(223, 239, 255, 0.78)";
  ctx.font = "700 12px Inter, Arial";
  ctx.fillText(`altitude (0-${altitudeScale} m)`, pad.left, h - (compactLegend ? 24 : 7));
  ctx.fillStyle = "#ffb457";
  ctx.fillText("power", pad.left + (compactLegend ? 0 : 142), h - 7);
  ctx.fillStyle = "#80f2ae";
  ctx.fillText("speed", pad.left + (compactLegend ? 72 : 198), h - 7);
}
