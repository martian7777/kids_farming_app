// =============================================================
//  audio.js — Kid-friendly retro synth sound effects (Tone.js)
//  Lazily starts the audio context on first user gesture.
// =============================================================
import * as Tone from 'tone';
import { store } from './state.js';

let ready = false;
let synth, pluck, noise, noiseEnv, engineOsc, engineGain;

async function ensure() {
  if (ready) return;
  await Tone.start();

  const master = new Tone.Volume(-6).toDestination();

  // Bright square-ish lead for melodic blips
  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.12, sustain: 0.05, release: 0.18 },
  }).connect(master);

  // Plucky "kalimba" for soft taps
  pluck = new Tone.PluckSynth({ attackNoise: 1, dampening: 2200, resonance: 0.85 }).connect(master);

  // Noise burst for digging / watering splashes
  noise = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0 },
  }).connect(new Tone.Filter(1200, 'lowpass').connect(master));

  // Looping engine drone (used while riding a vehicle)
  engineGain = new Tone.Gain(0).connect(master);
  engineOsc = new Tone.Oscillator({ type: 'sawtooth', frequency: 70 }).connect(
    new Tone.Filter(400, 'lowpass').connect(engineGain)
  );
  engineOsc.start();

  ready = true;
}

const muted = () => store.state.muted;

function note(n, dur = '16n', time = undefined) {
  if (!ready || muted()) return;
  try { synth.triggerAttackRelease(n, dur, time); } catch (_) {}
}

export const audio = {
  init: ensure,

  resume: ensure,

  till() {
    if (muted() || !ready) return;
    try { noise.triggerAttackRelease('8n'); } catch (_) {}
    note('C3', '16n');
  },

  plant() {
    if (muted() || !ready) return;
    try { pluck.triggerAttackRelease('E4'); } catch (_) {}
  },

  water() {
    if (muted() || !ready) return;
    try { noise.triggerAttackRelease('16n'); } catch (_) {}
    note('A4', '32n');
    note('C5', '32n', Tone.now() + 0.06);
  },

  harvest() {
    if (muted() || !ready) return;
    const now = Tone.now();
    ['C5', 'E5', 'G5'].forEach((n, i) => note(n, '16n', now + i * 0.07));
  },

  coin() { note('E6', '32n'); note('B6', '32n', (ready ? Tone.now() : 0) + 0.05); },

  levelUp() {
    if (muted() || !ready) return;
    const now = Tone.now();
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => note(n, '16n', now + i * 0.09));
  },

  correct() {
    if (muted() || !ready) return;
    const now = Tone.now();
    ['G4', 'C5', 'E5'].forEach((n, i) => note(n, '16n', now + i * 0.08));
  },

  wrong() {
    if (muted() || !ready) return;
    const now = Tone.now();
    note('A3', '8n', now);
    note('F3', '8n', now + 0.12);
  },

  click() { note('A4', '32n'); },

  sleep() {
    if (muted() || !ready) return;
    const now = Tone.now();
    ['C4', 'A3', 'F3'].forEach((n, i) => note(n, '8n', now + i * 0.15));
  },

  // Engine drone control
  engine(on, intensity = 0.5) {
    if (!ready) return;
    if (muted()) { engineGain.gain.rampTo(0, 0.1); return; }
    engineGain.gain.rampTo(on ? 0.06 : 0, 0.2);
    if (on) engineOsc.frequency.rampTo(60 + intensity * 60, 0.2);
  },
};
