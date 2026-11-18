// All sound is synthesised with the Web Audio API, so the game stays a single set of static files
// with no audio assets to load. A note is a pair of detuned oscillators through a short gain
// envelope; the ambient pad is a slow low triangle chord that runs under play. The context is made
// on the first user gesture, as browsers require, and every call guards against a missing context.
let context = null;
let master = null;
let padNodes = null;

function ensure() {
  if (context) return true;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return false;
  context = new Audio();
  master = context.createGain();
  master.gain.value = 0.5;
  master.connect(context.destination);
  return true;
}

/** One plucked tone: a frequency, a length in seconds and a peak level, plus an optional glide. */
function note(freq, seconds, level, slideTo) {
  if (!ensure()) return;
  const now = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + seconds);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(level, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + seconds + 0.02);
}

export const sound = {
  /** Beam fires: a short high tick. */
  shoot() {
    note(880, 0.06, 0.12);
  },
  /** A match: pitch climbs a semitone with the combo, capped so it stays musical. */
  match(combo) {
    const step = Math.min(combo, 12);
    note(440 * Math.pow(2, step / 12), 0.12, 0.2);
    note(660 * Math.pow(2, step / 12), 0.16, 0.08);
  },
  /** A wrong-colour split: a low descending buzz. */
  split() {
    note(220, 0.14, 0.16, 140);
  },
  /** A shard reaches the edge: a dull thud. */
  hit() {
    note(120, 0.22, 0.25, 70);
  },
  /** Gold bonus: a bright major arpeggio. */
  gold() {
    note(660, 0.08, 0.16);
    note(880, 0.08, 0.16);
    note(1100, 0.12, 0.18);
  },
  /** Colour switch: a tiny rising blip. */
  switchc() {
    note(520, 0.05, 0.1);
  },
  /** Game over: a descending three-note figure. */
  over() {
    note(440, 0.18, 0.2);
    note(330, 0.18, 0.2);
    note(220, 0.4, 0.22);
  },
  /** Start the quiet ambient pad for the whole play session. Idempotent. */
  startAmbient() {
    if (!ensure() || padNodes) return;
    const gain = context.createGain();
    gain.gain.value = 0.035;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const freqs = [55, 82.4, 110];
    for (const freq of freqs) {
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() * 6) - 3;
      osc.connect(filter);
      osc.start();
    }
    filter.connect(gain).connect(master);
    padNodes = { gain };
  },
};