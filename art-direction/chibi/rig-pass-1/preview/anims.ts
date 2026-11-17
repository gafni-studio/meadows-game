// Hero clips for rig pass 1: idle, run (jog) and the 2-hit basic attack.
// Keyframes follow style/hero-poses.jpg (idle, run) and style/hero-swings.jpg
// rows 1-2 (side slash, overhead smash). Angles in degrees, positive =
// clockwise on screen (a hanging limb swings back, the torso leans forward).
// Offsets in rig px (the hero is ~350 px tall at sheet scale). Feet are
// placed with leg IK, so they stay planted or follow a foot path.
import type { Bone, Pose } from './rig';

const TAU = Math.PI * 2;
const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
  out: (t: number) => 1 - (1 - t) ** 3,
  in: (t: number) => t * t * t,
  // overshoot, then settle: weight at the end of a fast move
  back: (t: number) => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};
type Ease = keyof typeof ease;

// ---------- the sword as a direction ----------
// yaw 0 = in the picture plane; 90 = pointing at the camera (foreshortened).
// tilt = screen angle from straight up, positive = forward.
export interface Blade { a: number; yaw?: number }

function aim(p: Pose, bl: Blade, layer: 'back' | 'mid' | 'front' = 'mid') {
  const a = p.a;
  a.hand_f = bl.a - (a.hips ?? 0) - (a.torso ?? 0) - (a.shoulder_f ?? 0) - (a.elbow_f ?? 0);
  p.sword = { len: Math.max(0.25, Math.cos((bl.yaw ?? 0) * Math.PI / 180)), layer };
  return p;
}

// ---------- idle: breathing and a slow weight shift (hero-poses r1 f1) ----------
export function idle(t: number): Pose {
  const br = Math.sin(t * TAU / 2.4);
  const sway = Math.sin(t * TAU / 4.8 + 0.6);
  const p: Pose = {
    hipY: 6 + br * 1.4, hipX: sway * 1.2,
    sy: 1 + br * 0.007, sx: 1 - br * 0.005,
    feet: { f: [12, 0], b: [-12, 0] },
    a: {
      torso: 2 + br * 1.2, head: -1 - br * 0.8,
      shoulder_f: -30 + Math.sin(t * TAU / 2.4 - 0.5) * 2, elbow_f: -42 - br * 2,
      shoulder_b: -12 + Math.sin(t * TAU / 2.4 - 0.9) * 1.5, elbow_b: -40,
    },
  };
  return aim(p, { a: 30 + br * 1.5 });
}

// ---------- run: a steady jog, both legs on one foot path half a cycle apart ----------
export const RUN_CYCLE = 0.52;
const STRIDE = 96;           // rig px a foot travels while planted
const STANCE = 0.46;         // fraction of the cycle a foot is down
/** Ground speed that keeps a planted foot still. */
export const RUN_SPEED = STRIDE / (STANCE * RUN_CYCLE);

function footPath(u: number): [number, number] {
  u = ((u % 1) + 1) % 1;
  const c = 6;
  if (u < STANCE) return [c + STRIDE / 2 - STRIDE * (u / STANCE), 0];
  const s = (u - STANCE) / (1 - STANCE);
  const x = c - STRIDE / 2 + STRIDE * (s * s * (3 - 2 * s));
  return [x, -30 * Math.sin(Math.PI * s ** 0.8)];   // heel lifts, foot reaches, lands
}

export function run(t: number): Pose {
  const u = t / RUN_CYCLE;
  const ph = u * TAU;
  const bob = Math.cos(2 * TAU * (u - STANCE / 2));   // lowest mid-stance, twice a cycle
  const p: Pose = {
    hipY: 17 + 2.5 * bob, hipX: 4,
    sy: 1 + 0.006 * (1 - bob) / 2, sx: 1,
    feet: { f: footPath(u), b: footPath(u + 0.5) },
    a: {
      hips: 3, torso: 12 + 1.2 * Math.sin(2 * ph - 0.8), head: -6 - Math.sin(2 * ph - 1.4),
      // arms counter-swing the legs (front foot forward at u = 0); the sword
      // arm carries, so it swings less
      shoulder_f: -22 + 14 * Math.cos(ph), elbow_f: -60 - 8 * Math.max(0, Math.cos(ph)),
      shoulder_b: -4 - 30 * Math.cos(ph), elbow_b: -78 - 10 * Math.max(0, -Math.cos(ph)),
    },
  };
  return aim(p, { a: 64 + 6 * Math.cos(ph) });
}

// ---------- basic attack: side slash, overhead smash, short pause ----------
interface Key { t: number; e: Ease; p: Pose; bl: Blade; layer?: 'back' | 'mid' | 'front' }
const STAND: Pose = { hipY: 6, feet: { f: [12, 0], b: [-12, 0] }, a: { torso: 2, head: -1, shoulder_f: -30, elbow_f: -42, shoulder_b: -12, elbow_b: -40 } };
const key = (t: number, e: Ease, bl: Blade, p: Pose, layer?: Key['layer']): Key => ({ t, e, bl, p, layer });

/** When each hit lands (s into the combo) and the slash arc it draws. */
export const HITS = [
  { t: 0.20, arc: 'side' as const },
  { t: 0.68, arc: 'smash' as const },
];
export const COMBO_LEN = 1.16;     // then idle for the pause
export const COMBO_PAUSE = 0.44;
export const COMBO_LOOP = COMBO_LEN + COMBO_PAUSE;

const KEYS: Key[] = [
  key(0.00, 'inOut', { a: 30 }, STAND),
  // hit 1 wind-up (swings r1 f1): sink, blade low by the back hip, tip
  // forward and down, turned toward the camera; the front foot steps out
  key(0.12, 'inOut', { a: 116, yaw: 55 }, { hipY: 22, hipX: -4, sy: 0.975, sx: 1.02, feet: { f: [28, 0], b: [-26, 0] },
    a: { torso: -2, head: 2, shoulder_f: 34, elbow_f: -54, shoulder_b: -26, elbow_b: -64 } }),
  // hit 1 strike (r1 f2): shoulders whip round, the arm shoots out at
  // shoulder height and the blade comes round flat to point ahead
  key(0.20, 'out', { a: 84, yaw: 0 }, { hipY: 26, hipX: 14, sy: 1.02, sx: 0.985, feet: { f: [42, 0], b: [-36, 0] },
    a: { torso: 18, head: -10, shoulder_f: -92, elbow_f: -8, shoulder_b: 22, elbow_b: -50 } }),
  // follow-through (r1 f3): full reach, a little overshoot
  key(0.30, 'back', { a: 90 }, { hipY: 27, hipX: 18, sy: 0.985, sx: 1.01, feet: { f: [42, 0], b: [-36, 0] },
    a: { torso: 20, head: -11, shoulder_f: -88, elbow_f: -2, shoulder_b: 26, elbow_b: -52 } }),
  key(0.38, 'inOut', { a: 92 }, { hipY: 26, hipX: 16, feet: { f: [42, 0], b: [-36, 0] },
    a: { torso: 18, head: -10, shoulder_f: -84, elbow_f: -6, shoulder_b: 24, elbow_b: -54 } }),
  // hit 2 wind-up (r2 f1): rise and lean back, sword high over the head,
  // tip back; the back fist comes forward at the waist
  key(0.52, 'inOut', { a: -22 }, { hipY: 18, hipX: 4, sy: 1.02, sx: 0.985, feet: { f: [42, 0], b: [-36, 0] },
    a: { torso: -7, head: 3, shoulder_f: -196, elbow_f: -34, shoulder_b: -30, elbow_b: -70 } }),
  key(0.60, 'inOut', { a: -30 }, { hipY: 17, hipX: 2, sy: 1.025, sx: 0.98, feet: { f: [42, 0], b: [-36, 0] },
    a: { torso: -9, head: 4, shoulder_f: -204, elbow_f: -38, shoulder_b: -32, elbow_b: -72 } }),
  // hit 2 strike (r2 f2): drive down into a deep lunge, the front foot
  // stamps forward, the blade chops down to point forward-low
  key(0.68, 'out', { a: 114 }, { hipY: 32, hipX: 22, sy: 0.96, sx: 1.035, feet: { f: [58, 0], b: [-42, 0] },
    a: { torso: 22, head: -12, shoulder_f: -74, elbow_f: -6, shoulder_b: 18, elbow_b: -46 } }),
  // settle (r2 f3)
  key(0.80, 'back', { a: 108 }, { hipY: 30, hipX: 20, sy: 0.99, sx: 1.01, feet: { f: [58, 0], b: [-42, 0] },
    a: { torso: 19, head: -10, shoulder_f: -70, elbow_f: -12, shoulder_b: 14, elbow_b: -48 } }),
  key(0.92, 'inOut', { a: 104 }, { hipY: 29, hipX: 18, feet: { f: [58, 0], b: [-42, 0] },
    a: { torso: 18, head: -10, shoulder_f: -66, elbow_f: -16, shoulder_b: 12, elbow_b: -46 } }),
  // recover: step back into the stance
  key(COMBO_LEN, 'inOut', { a: 30 }, STAND),
];
const BONES: Bone[] = ['hips', 'torso', 'head', 'shoulder_f', 'elbow_f', 'shoulder_b', 'elbow_b'];

function lerpPose(a: Key, b: Key, u: number, raw: number): Pose {
  const m = (x: number | undefined, y: number | undefined, d: number) => (x ?? d) + ((y ?? d) - (x ?? d)) * u;
  const ff = (k: Key, s: 'f' | 'b') => k.p.feet?.[s] ?? [0, 0];
  const v2 = (s: 'f' | 'b'): [number, number] => {
    const [ax, ay] = ff(a, s), [bx, by] = ff(b, s);
    if (Math.abs(bx - ax) <= 3) return [m(ax, bx, 0), m(ay, by, 0)];
    // a foot that moves between keys steps on an arc, never slides. When both
    // feet move, the front one goes first and the back one follows, so the
    // hero never hops with both feet off the ground.
    const both = Math.abs(ff(b, 'f')[0] - ff(a, 'f')[0]) > 3 && Math.abs(ff(b, 'b')[0] - ff(a, 'b')[0]) > 3;
    const [w0, w1] = !both ? [0, 1] : s === 'f' ? [0, 0.55] : [0.45, 1];
    const k = Math.min(1, Math.max(0, (raw - w0) / (w1 - w0)));
    const kk = ease.inOut(k);
    const lift = -Math.min(14, Math.abs(bx - ax) * 0.5) * Math.sin(Math.PI * k);
    return [ax + (bx - ax) * kk, ay + (by - ay) * kk + lift];
  };
  const p: Pose = {
    hipX: m(a.p.hipX, b.p.hipX, 0), hipY: m(a.p.hipY, b.p.hipY, 0),
    sx: m(a.p.sx, b.p.sx, 1), sy: m(a.p.sy, b.p.sy, 1), a: {},
    feet: { f: v2('f'), b: v2('b') },
  };
  for (const n of BONES) p.a[n] = m(a.p.a[n], b.p.a[n], 0);
  return aim(p, { a: m(a.bl.a, b.bl.a, 0), yaw: m(a.bl.yaw, b.bl.yaw, 0) }, b.layer ?? a.layer);
}

/** Attack pose at t seconds into the loop (combo, then the pause in idle). */
export function combo(t: number): Pose {
  if (t >= COMBO_LEN) return idle(t - COMBO_LEN);
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const raw = Math.min(1, (t - a.t) / (b.t - a.t));
  return lerpPose(a, b, ease[b.e](raw), raw);
}
