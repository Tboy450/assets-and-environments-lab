// Optional soundscape (off by default): rotor chop and motor whine, wind, and the arrival's
// entry roar, parachute flutter and separation thumps. Levels come from ../sound-mix.mjs.
// Browsers only start audio after a click or tap, so nothing plays until the owner turns it on.
import { soundMix } from "../sound-mix.mjs?v=dev";
import { $, state } from "./context.mjs?v=dev";

const PREF_KEY = "dragonfly-sound";
let enabled = false;
try { enabled = localStorage.getItem(PREF_KEY) === "on"; } catch { /* storage may be unavailable */ }
let audio = null;
let lastThump = null;

function noiseBuffer(ctx, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function noiseSource(ctx, buffer) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start();
  return source;
}

function buildAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  const ctx = new Context();
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  const noise = noiseBuffer(ctx);
  const gain = (value = 0) => { const node = ctx.createGain(); node.gain.value = value; return node; };
  const filter = (type, frequency, q = 0.7) => { const node = ctx.createBiquadFilter(); node.type = type; node.frequency.value = frequency; node.Q.value = q; return node; };

  // Rotor chop: band-passed noise pulsed at the blade-pass frequency, plus its low tone.
  const chopFilter = filter("bandpass", 320, 0.9);
  const chopPulse = gain(0.5);
  const rotorGain = gain();
  noiseSource(ctx, noise).connect(chopFilter).connect(chopPulse).connect(rotorGain).connect(master);
  const bladePass = ctx.createOscillator();
  bladePass.frequency.value = 35;
  const pulseDepth = gain(0.5);
  bladePass.connect(pulseDepth).connect(chopPulse.gain);
  const tone = ctx.createOscillator();
  tone.type = "sawtooth";
  tone.frequency.value = 35;
  const toneFilter = filter("lowpass", 420);
  const toneLevel = gain(0.35);
  tone.connect(toneFilter).connect(toneLevel).connect(rotorGain);
  bladePass.start();
  tone.start();
  // Motor whine.
  const motor = ctx.createOscillator();
  motor.type = "triangle";
  const motorGain = gain();
  motor.connect(motorGain).connect(master);
  motor.start();
  // Wind.
  const windFilter = filter("lowpass", 400);
  const windGain = gain();
  noiseSource(ctx, noise).connect(windFilter).connect(windGain).connect(master);
  // Entry roar.
  const roarFilter = filter("lowpass", 520);
  const roarGain = gain();
  noiseSource(ctx, noise).connect(roarFilter).connect(roarGain).connect(master);
  // Parachute flutter: noise pulsed by a slow oscillator.
  const flutterFilter = filter("bandpass", 180, 1.2);
  const flutterPulse = gain(0.5);
  const flutterGain = gain();
  noiseSource(ctx, noise).connect(flutterFilter).connect(flutterPulse).connect(flutterGain).connect(master);
  const flutterRate = ctx.createOscillator();
  flutterRate.frequency.value = 9;
  const flutterDepth = gain(0.5);
  flutterRate.connect(flutterDepth).connect(flutterPulse.gain);
  flutterRate.start();
  // Sand hiss from the rotor wash near the ground.
  const dustFilter = filter("bandpass", 2600, 0.6);
  const dustGain = gain();
  noiseSource(ctx, noise).connect(dustFilter).connect(dustGain).connect(master);

  // delay: seconds for the sound to reach the camera through Titan's air (see sound-mix.mjs).
  function thump(kind, delay = 0) {
    const now = ctx.currentTime + delay;
    const strength = kind === "drogue" || kind === "main" ? 0.9 : 0.55;
    const body = ctx.createOscillator();
    body.frequency.setValueAtTime(90, now);
    body.frequency.exponentialRampToValueAtTime(38, now + 0.35);
    const bodyGain = gain(0);
    bodyGain.gain.setValueAtTime(strength, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    body.connect(bodyGain).connect(master);
    body.start(now);
    body.stop(now + 0.55);
    const crack = ctx.createBufferSource();
    crack.buffer = noise;
    const crackGain = gain(0);
    crackGain.gain.setValueAtTime(strength * 0.5, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    crack.connect(filter("lowpass", 1600)).connect(crackGain).connect(master);
    crack.start(now);
    crack.stop(now + 0.2);
  }

  return {
    ctx,
    update(mix) {
      const at = ctx.currentTime, ease = 0.08;
      const hz = Math.max(1, mix.rotorHz);
      bladePass.frequency.setTargetAtTime(hz, at, ease);
      tone.frequency.setTargetAtTime(hz, at, ease);
      rotorGain.gain.setTargetAtTime(mix.rotorGain, at, ease);
      motor.frequency.setTargetAtTime(Math.max(1, mix.motorHz), at, ease);
      motorGain.gain.setTargetAtTime(mix.motorGain, at, ease);
      windFilter.frequency.setTargetAtTime(mix.windCutoffHz, at, 0.3);
      windGain.gain.setTargetAtTime(mix.windGain, at, 0.3);
      roarGain.gain.setTargetAtTime(mix.roarGain, at, 0.15);
      flutterRate.frequency.setTargetAtTime(mix.flutterHz, at, 0.2);
      flutterGain.gain.setTargetAtTime(mix.flutterGain, at, 0.2);
      dustGain.gain.setTargetAtTime(mix.dustGain, at, 0.2);
    },
    thump,
  };
}

function showButton() {
  const button = $("sound-toggle");
  button.textContent = enabled ? "♪ On" : "♪ Off";
  button.setAttribute("aria-label", enabled ? "Sound on" : "Sound off");
  button.setAttribute("aria-pressed", String(enabled));
}

function start() {
  if (!audio) audio = buildAudio();
  if (audio && audio.ctx.state !== "running" && document.visibilityState === "visible") audio.ctx.resume();
}

$("sound-toggle").addEventListener("click", () => {
  enabled = !enabled;
  try { localStorage.setItem(PREF_KEY, enabled ? "on" : "off"); } catch { /* optional */ }
  if (enabled) start(); else audio?.ctx.suspend();
  showButton();
});
// A remembered "on" can only start after the next click or tap anywhere on the page.
const resumeOnGesture = () => { if (enabled) start(); };
window.addEventListener("pointerdown", resumeOnGesture);
window.addEventListener("keydown", resumeOnGesture);
document.addEventListener("visibilitychange", () => {
  if (!audio) return;
  if (document.visibilityState === "hidden") audio.ctx.suspend();
  else if (enabled) audio.ctx.resume();
});
showButton();

// Local debugging only, like the other dragonfly* hooks.
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  window.dragonflySound = () => audio && { state: audio.ctx.state, time: audio.ctx.currentTime, mix: soundMix(state) };
}

// Called every frame from app.js.
export function updateSound() {
  if (!enabled || !audio || audio.ctx.state !== "running") return;
  const mix = soundMix(state);
  audio.update(mix);
  if (mix.thump && mix.thump !== lastThump) audio.thump(mix.thump, mix.thumpDelayS);
  lastThump = mix.thump;
}
