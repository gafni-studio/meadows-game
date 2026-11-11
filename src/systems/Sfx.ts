/** Tiny synthesized sound effects (WebAudio, no audio files). Silent if audio is unavailable or blocked. */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'triangle') {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export function playSfx(kind: 'levelup' | 'pickup' | 'train') {
  if (kind === 'levelup') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, 0.08));
  else if (kind === 'train') [392, 523, 784].forEach((f, i) => tone(f, i * 0.07, 0.3, 0.07, 'square'));
  else tone(880, 0, 0.08, 0.04, 'sine');
}
