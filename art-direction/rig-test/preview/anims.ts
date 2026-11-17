// Hero poses for the rig test (polish 1): idle, run, 2-hit combo.
// Angles in degrees, positive = clockwise on screen (a hanging limb swings
// back, a raised torso leans forward). Offsets in base px (hero ~1000 px).
// Feet are placed with IK (`feet`), so they stay planted or follow a path.
import type { Bone, Pose } from './rig';

const TAU = Math.PI * 2;
const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
  out: (t: number) => 1 - (1 - t) ** 3,
  in: (t: number) => t * t * t,
  // overshoots then settles: weight at the end of a fast move
  back: (t: number) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};
type Ease = keyof typeof ease;

// ---------- the sword as a 3D direction ----------
// yaw: 0 = pointing forward, 180 = back, 90 = at the camera (in front of the
// body); tilt: up from horizontal. A flat swing turns yaw, so the blade
// foreshortens as it comes round: that is what makes a side slash read in 2D.
export interface Blade { yaw: number; tilt: number }
/** A blade in the picture plane, by screen angle (0 = up, 90 = forward). */
const planar = (a: number): Blade => a >= 0 ? { yaw: 0, tilt: 90 - a } : { yaw: 180, tilt: 90 + a };

function aim(p: Pose, bl: Blade) {
  const y = bl.yaw * Math.PI / 180, t = bl.tilt * Math.PI / 180;
  const x = Math.cos(y) * Math.cos(t), up = Math.sin(t), z = Math.sin(y) * Math.cos(t);
  const world = Math.atan2(x, up) * 180 / Math.PI;
  const a = p.a;
  a.hand_f = world - (a.pelvis ?? 0) - (a.torso ?? 0) - (a.shoulder_f ?? 0) - (a.elbow_f ?? 0);
  p.sword = { len: Math.max(0.16, Math.hypot(x, up)), front: z > 0.05 };
  return p;
}

// ---------- idle: breathing, weight shifts, a lazy sword ----------
export function idle(t: number): Pose {
  const br = Math.sin(t * TAU / 2.6);            // breath
  const sway = Math.sin(t * TAU / 5.2 + 0.6);   // slow weight shift
  const p: Pose = {
    hipY: 7 + br * 3, hipX: sway * 4,
    sy: 1 + br * 0.008, sx: 1 - br * 0.006,
    feet: { f: [0, 0], b: [0, 0] },               // planted: knees take the bob
    a: {
      pelvis: 1 + sway * 0.6, torso: 0.8 + br * 1.4,
      neck: -br * 1.0, head: -0.5 + Math.sin(t * TAU / 2.6 - 0.7) * 1.4,
      shoulder_f: -3 + Math.sin(t * TAU / 2.6 - 0.5) * 2.2, elbow_f: -16 - br * 2,
      shoulder_b: -4 + Math.sin(t * TAU / 2.6 - 0.9) * 2, elbow_b: -10,
    },
  };
  return aim(p, planar(128 + br * 2));
}

// ---------- run: low bounce, both legs on one foot path half a cycle apart ----------
export const RUN_CYCLE = 0.62;
const STRIDE = 230;          // base px the foot travels while on the ground
const STANCE = 0.42;         // fraction of the cycle a foot is down
/** Ground speed that keeps a planted foot still (scrolling ground uses it). */
export const RUN_SPEED = STRIDE / (STANCE * RUN_CYCLE);

function footPath(u: number): [number, number] {
  u = ((u % 1) + 1) % 1;
  const c = 14;                                   // stride centre, a little ahead
  if (u < STANCE) return [c + STRIDE / 2 - STRIDE * (u / STANCE), 0];
  const s = (u - STANCE) / (1 - STANCE);
  const x = c - STRIDE / 2 + STRIDE * (s * s * (3 - 2 * s));
  // lift early (heel kicks up behind), reach and lower to land
  return [x, -78 * Math.sin(Math.PI * s ** 0.75)];
}

export function run(t: number): Pose {
  const u = t / RUN_CYCLE;
  const ph = u * TAU;
  // body lowest at mid-stance of either foot, highest in the float: small
  const bob = Math.cos(2 * TAU * (u - STANCE / 2));
  const land = Math.max(0, Math.cos(2 * TAU * (u - 0.04))) ** 6;
  const p: Pose = {
    hipY: 44 + 7 * bob, hipX: 6,
    sy: 1 - 0.022 * land + 0.008 * (1 - bob), sx: 1 + 0.018 * land,
    feet: { f: footPath(u), b: footPath(u + 0.5) },
    a: {
      pelvis: 5 + 1.5 * Math.sin(2 * ph), torso: 6 + 1.5 * Math.sin(2 * ph - 0.8),
      neck: -4 - Math.sin(2 * ph - 1.2), head: -2 - Math.sin(2 * ph - 1.6),
      // arms counter-swing the legs (front foot is forward at u = 0)
      shoulder_f: 6 + 22 * Math.cos(ph), elbow_f: -58 - 10 * Math.max(0, Math.cos(ph)),
      shoulder_b: -6 - 30 * Math.cos(ph), elbow_b: -64 - 14 * Math.max(0, -Math.cos(ph)),
    },
  };
  return aim(p, planar(64 + 8 * Math.cos(ph)));
}

// ---------- 2-hit combo: horizontal side slash, rising backhand, pause ----------
interface Key { t: number; e: Ease; p: Pose; bl: Blade }
const IDLE_KEY: Pose = { hipY: 7, feet: { f: [0, 0], b: [0, 0] }, a: { pelvis: 1, torso: 0.8, shoulder_f: -3, elbow_f: -16, shoulder_b: -4, elbow_b: -10 } };
const key = (t: number, e: Ease, bl: Blade, p: Pose): Key => ({ t, e, bl, p });

export const HITS = [
  // when each hit lands (s) and the slash arc it draws
  { t: 0.27, arc: 'side' as const },
  { t: 0.62, arc: 'rise' as const },
];
export const COMBO_LEN = 1.08;   // then idle for the pause
export const COMBO_PAUSE = 0.62;

const KEYS: Key[] = [
  key(0.00, 'inOut', planar(128), IDLE_KEY),
  // hit 1 wind-up: sink, turn the shoulders away, draw the blade back at
  // chest height (elbow bent, hand by the back hip), back arm forward
  key(0.17, 'inOut', { yaw: 172, tilt: 14 }, { hipY: 20, hipX: -10, sy: 0.97, sx: 1.02, feet: { f: [0, 0], b: [0, 0] },
    a: { pelvis: -3, torso: -9, neck: 5, head: 2, shoulder_f: 58, elbow_f: -72, shoulder_b: -36, elbow_b: -40 } }),
  key(0.21, 'inOut', { yaw: 176, tilt: 16 }, { hipY: 22, hipX: -12, sy: 0.965, sx: 1.025, feet: { f: [0, 0], b: [0, 0] },
    a: { pelvis: -4, torso: -10, neck: 5, head: 2, shoulder_f: 62, elbow_f: -76, shoulder_b: -38, elbow_b: -42 } }),
  // hit 1 strike: step in, shoulders whip round, blade sweeps flat across
  // the front (yaw 176 -> -30: it foreshortens as it comes round)
  key(0.27, 'out', { yaw: 20, tilt: 4 }, { hipY: 16, hipX: 30, sy: 1.03, sx: 0.98, feet: { f: [44, -30], b: [0, 0] },
    a: { pelvis: 6, torso: 14, neck: -5, head: -3, shoulder_f: -84, elbow_f: -12, shoulder_b: 30, elbow_b: -30 } }),
  key(0.33, 'out', { yaw: -32, tilt: 0 }, { hipY: 22, hipX: 40, sy: 0.96, sx: 1.04, feet: { f: [64, 0], b: [0, 0] },
    a: { pelvis: 7, torso: 16, neck: -6, head: -3, shoulder_f: -76, elbow_f: -16, shoulder_b: 36, elbow_b: -34 } }),
  // settle (follow-through carries the blade on round, behind)
  key(0.44, 'back', { yaw: -48, tilt: -6 }, { hipY: 20, hipX: 36, sy: 0.99, sx: 1.01, feet: { f: [64, 0], b: [0, 0] },
    a: { pelvis: 6, torso: 12, neck: -4, head: -2, shoulder_f: -62, elbow_f: -26, shoulder_b: 28, elbow_b: -36 } }),
  // hit 2 gather: blade drops low in front, knees load
  key(0.55, 'inOut', planar(158), { hipY: 30, hipX: 34, sy: 0.955, sx: 1.03, feet: { f: [64, 0], b: [0, 0] },
    a: { pelvis: 8, torso: 12, neck: -3, head: 0, shoulder_f: -18, elbow_f: -24, shoulder_b: 22, elbow_b: -40 } }),
  // hit 2 strike: rise and rip the blade up and forward (rising backhand)
  key(0.62, 'out', planar(44), { hipY: 8, hipX: 46, sy: 1.045, sx: 0.975, feet: { f: [64, 0], b: [10, 0] },
    a: { pelvis: 2, torso: 2, neck: -6, head: -5, shoulder_f: -128, elbow_f: -22, shoulder_b: 34, elbow_b: -26 } }),
  key(0.72, 'back', planar(26), { hipY: 12, hipX: 42, sy: 1.0, sx: 1.0, feet: { f: [64, 0], b: [10, 0] },
    a: { pelvis: 1, torso: -2, neck: -4, head: -4, shoulder_f: -138, elbow_f: -30, shoulder_b: 26, elbow_b: -30 } }),
  // recover: step back to the idle spot (front foot lifts on the way)
  key(0.90, 'inOut', planar(96), { hipY: 12, hipX: 16, feet: { f: [30, -26], b: [4, 0] },
    a: { pelvis: 1, torso: 2, shoulder_f: -30, elbow_f: -30, shoulder_b: 6, elbow_b: -18 } }),
  key(COMBO_LEN, 'inOut', planar(128), IDLE_KEY),
];
const BONES: Bone[] = ['pelvis', 'torso', 'neck', 'head', 'shoulder_f', 'elbow_f', 'shoulder_b', 'elbow_b'];

function lerpPose(a: Key, b: Key, u: number): Pose {
  const m = (x: number | undefined, y: number | undefined, d: number) => (x ?? d) + ((y ?? d) - (x ?? d)) * u;
  const ff = (k: Key, s: 'f' | 'b') => k.p.feet?.[s] ?? [0, 0];
  const v2 = (s: 'f' | 'b'): [number, number] => [m(ff(a, s)[0], ff(b, s)[0], 0), m(ff(a, s)[1], ff(b, s)[1], 0)];
  const p: Pose = {
    hipX: m(a.p.hipX, b.p.hipX, 0), hipY: m(a.p.hipY, b.p.hipY, 0),
    sx: m(a.p.sx, b.p.sx, 1), sy: m(a.p.sy, b.p.sy, 1), a: {},
    feet: { f: v2('f'), b: v2('b') },
  };
  for (const n of BONES) p.a[n] = m(a.p.a[n], b.p.a[n], 0);
  return aim(p, { yaw: m(a.bl.yaw, b.bl.yaw, 0), tilt: m(a.bl.tilt, b.bl.tilt, 0) });
}

/** Combo pose at t seconds into the loop (combo, then the pause in idle). */
export function combo(t: number): Pose {
  if (t >= COMBO_LEN) return idle(t);
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const p = lerpPose(a, b, ease[b.e](Math.min(1, (t - a.t) / (b.t - a.t))));
  p.a.torso! += Math.sin(t * TAU / 2.6) * 0.8;   // a little life in the holds
  return p;
}
