// Procedural sound effects via the Web Audio API — no external assets needed.
// Lazy AudioContext (created on first user gesture so browsers allow it).

let ctx = null;
let master = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Resume audio on the first key press (user gesture).
export function unlockAudio() { ensure(); }

function tone(opts) {
  const c = ensure();
  if (!c) return;
  const { from, to, dur, type = "square", vol = 0.3, delay = 0, attack = 0.005 } = opts;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(opts) {
  const c = ensure();
  if (!c) return;
  const { dur, vol = 0.3, delay = 0, filterFreq = 1000, type = "lowpass" } = opts;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = filterFreq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(gain).connect(master);
  src.start(t0);
}

const sfx = {
  jump() { tone({ from: 420, to: 760, dur: 0.18, type: "square", vol: 0.25 }); },
  coin() {
    tone({ from: 880, dur: 0.06, type: "square", vol: 0.22 });
    tone({ from: 1320, dur: 0.12, type: "square", vol: 0.22, delay: 0.06 });
  },
  star() {
    tone({ from: 660, dur: 0.07, type: "triangle", vol: 0.28 });
    tone({ from: 880, dur: 0.07, type: "triangle", vol: 0.28, delay: 0.07 });
    tone({ from: 1175, dur: 0.12, type: "triangle", vol: 0.28, delay: 0.14 });
  },
  roll() {
    noise({ dur: 0.25, vol: 0.12, filterFreq: 600 });
  },
  spike() {
    noise({ dur: 0.3, vol: 0.4, filterFreq: 1800, type: "highpass" });
    tone({ from: 200, to: 80, dur: 0.25, type: "sawtooth", vol: 0.25 });
  },
  hole() {
    tone({ from: 300, to: 60, dur: 0.5, type: "sawtooth", vol: 0.3 });
  },
  spring() {
    tone({ from: 300, to: 900, dur: 0.12, type: "square", vol: 0.3 });
    tone({ from: 900, to: 1400, dur: 0.1, type: "square", vol: 0.25, delay: 0.12 });
  },
  hitEggman() {
    tone({ from: 220, to: 660, dur: 0.12, type: "square", vol: 0.28 });
    noise({ dur: 0.15, vol: 0.25, filterFreq: 2200, type: "highpass", delay: 0.02 });
  },
  explosion() {
    // deep low boom
    tone({ from: 140, to: 38, dur: 0.6, type: "sine", vol: 0.4 });
    noise({ dur: 0.5, vol: 0.45, filterFreq: 700, type: "lowpass" });
    // sharp crack
    noise({ dur: 0.1, vol: 0.3, filterFreq: 3500, type: "highpass", delay: 0.02 });
    // aftershock
    tone({ from: 70, to: 30, dur: 0.4, type: "triangle", vol: 0.18, delay: 0.05 });
  },
  die() {
    tone({ from: 400, to: 50, dur: 0.7, type: "sawtooth", vol: 0.35 });
    tone({ from: 300, to: 50, dur: 0.6, type: "square", vol: 0.2, delay: 0.1 });
  },
  gameover() {
    const notes = [440, 392, 349, 294];
    notes.forEach((f, i) => tone({ from: f, dur: 0.3, type: "triangle", vol: 0.3, delay: i * 0.22 }));
  },
};

export default sfx;