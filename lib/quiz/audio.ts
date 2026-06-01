// Minimal Web Audio sound effects (no external lib). Client-only.
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctx;
  } catch { return null; }
}

function beep(freq: number, durationMs: number, startMs = 0, type: OscillatorType = 'sine', gain = 0.15) {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(a.destination);
  const t = a.currentTime + startMs / 1000;
  osc.start(t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
  osc.stop(t + durationMs / 1000);
}

export const quizSound = {
  click: () => beep(660, 80, 0, 'sine', 0.08),
  correct: () => { beep(523, 120); beep(659, 120, 110); beep(784, 180, 220); },
  wrong: () => beep(180, 300, 0, 'sawtooth', 0.12),
  complete: () => { beep(523, 140); beep(659, 140, 130); beep(784, 140, 260); beep(1046, 260, 390); },
  tick: () => beep(880, 60, 0, 'square', 0.06),
};
