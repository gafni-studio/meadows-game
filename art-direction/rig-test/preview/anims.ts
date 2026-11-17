// Hero poses for the rig test: idle, run, one-handed attack.
// Angles in degrees, positive = clockwise on screen (a hanging limb swings
// back, a raised torso leans forward). Base px for offsets (hero ~1000 px).
import type { Bone, Pose } from './rig';

const TAU = Math.PI * 2;
const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
  out: (t: number) => 1 - (1 - t) ** 3,
  in: (t: number) => t * t * t,
  // overshoots then settles: weight at the end of a fast move
  back: (t: number) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};
type Ease = keyof typeof ease;

/** The hand angle that puts the sword at a world angle (0 = blade up). */
function sword(p: Pose, world: number) {
  const a = p.a;
  p.a.hand_f = world - (a.torso ?? 0) - (a.shoulder_f ?? 0) - (a.elbow_f ?? 0);
  return p;
}

// ---------- idle: breathing, weight shifts, a lazy sword ----------
export function idle(t: number): Pose {
  const br = Math.sin(t * TAU / 2.6);            // breath
  const sway = Math.sin(t * TAU / 5.2 + 0.6);   // slow weight shift
  const p: Pose = {
    hipY: 3 + br * 3, hipX: sway * 3,
    sy: 1 + br * 0.008, sx: 1 - br * 0.006,
    a: {
      torso: 1.5 + br * 1.2 + sway * 0.6,
      neck: -br * 1.0, head: -0.5 + Math.sin(t * TAU / 2.6 - 0.7) * 1.4,
      shoulder_f: -3 + Math.sin(t * TAU / 2.6 - 0.5) * 2.2, elbow_f: -16 - br * 2,
      shoulder_b: -6 + Math.sin(t * TAU / 2.6 - 0.9) * 2, elbow_b: -14,
      hip_f: -2 - sway * 0.5, knee_f: 2, hip_b: 2 + sway * 0.5, knee_b: 1,
      hand_b: 0,
    },
  };
  // legs keep the feet planted while the hips dip: bend knees with the bob
  const dip = (p.hipY ?? 0) - 3;
  p.a.hip_f! -= dip * 0.35; p.a.knee_f! += dip * 0.7;
  p.a.hip_b! -= dip * 0.35; p.a.knee_b! += dip * 0.7;
  return sword(p, 128 + br * 2);
}

// ---------- run: weighty, 0.6 s cycle ----------
export const RUN_CYCLE = 0.6;
export function run(t: number): Pose {
  const ph = (t / RUN_CYCLE) * TAU;
  const s = Math.sin(ph), c = Math.cos(ph);
  // contacts at ph = 0 and π: body lowest just after contact, highest mid-stride
  const bounce = Math.abs(Math.sin(ph + 0.35));
  const contact = Math.max(0, Math.cos(2 * ph + 0.5)) ** 3; // squash pulse
  const legSwing = (p: number) => {
    const sw = Math.sin(p), cw = Math.cos(p);
    const hip = -34 * sw - 6;                      // forward is negative
    // knee folds most while the leg swings through (thigh moving forward)
    const knee = 12 + 78 * Math.max(0, cw) ** 1.4 + 10 * Math.max(0, sw);
    return [hip, knee];
  };
  const [hf, kf] = legSwing(ph);
  const [hb, kb] = legSwing(ph + Math.PI);
  const p: Pose = {
    hipY: 6 - 30 * bounce + 14 * contact,
    hipX: 8,
    sy: 1 - 0.055 * contact + 0.03 * bounce, sx: 1 + 0.045 * contact - 0.015 * bounce,
    a: {
      torso: 9 + 2.5 * Math.sin(2 * ph - 0.6),
      neck: -4 - 1.5 * Math.sin(2 * ph - 1.1), head: -2 - 1.2 * Math.sin(2 * ph - 1.6),
      // arms counter-swing the legs; the sword arm swings less (it's carrying)
      shoulder_f: 26 * s + 6, elbow_f: -48 - 14 * Math.max(0, s),
      shoulder_b: -34 * s + 4, elbow_b: -55 - 18 * Math.max(0, -s),
      hip_f: hf, knee_f: kf, hip_b: hb, knee_b: kb,
    },
  };
  void c;
  return sword(p, 62 + 10 * s);
}

// ---------- attack: anticipation, fast slash, follow-through, recover ----------
interface Key { t: number; p: Pose; sw: number; e: Ease }
const k = (t: number, sw: number, e: Ease, p: Pose): Key => ({ t, p, sw, e });
export const ATTACK_LEN = 0.86;
const KEYS: Key[] = [
  k(0.00, 128, 'inOut', { hipY: 3, a: { torso: 1.5, shoulder_f: -3, elbow_f: -16, shoulder_b: -6, elbow_b: -14, hip_f: -2, knee_f: 2, hip_b: 2, knee_b: 1 } }),
  // wind-up: crouch, lean back, sword cocked high behind the head
  k(0.24, -158, 'inOut', { hipY: 20, hipX: -14, sy: 0.95, sx: 1.04,
    a: { torso: -9, neck: 4, head: 2, shoulder_f: 140, elbow_f: -92, shoulder_b: -38, elbow_b: -50,
      hip_f: -12, knee_f: 22, hip_b: 10, knee_b: 18 } }),
  // hang at the top a beat (anticipation reads)
  k(0.30, -166, 'inOut', { hipY: 22, hipX: -16, sy: 0.94, sx: 1.05,
    a: { torso: -10, neck: 5, head: 2, shoulder_f: 146, elbow_f: -98, shoulder_b: -40, elbow_b: -52,
      hip_f: -12, knee_f: 24, hip_b: 10, knee_b: 20 } }),
  // strike: 0.09 s. The arm goes over the top (146 -> 282 = -78 + 360), lunge forward, stretch on the swing
  k(0.39, 100, 'out', { hipY: 10, hipX: 34, sy: 1.04, sx: 0.97,
    a: { torso: 15, neck: -5, head: -4, shoulder_f: 282, elbow_f: -6, shoulder_b: 34, elbow_b: -30,
      hip_f: -34, knee_f: 26, hip_b: 26, knee_b: 6 } }),
  // follow-through: weight lands, squash, blade carries down
  k(0.50, 150, 'back', { hipY: 24, hipX: 40, sy: 0.95, sx: 1.05,
    a: { torso: 18, neck: -6, head: -3, shoulder_f: 318, elbow_f: -10, shoulder_b: 40, elbow_b: -34,
      hip_f: -36, knee_f: 34, hip_b: 28, knee_b: 12 } }),
  k(0.62, 146, 'inOut', { hipY: 14, hipX: 30, sy: 0.99, sx: 1.01,
    a: { torso: 11, neck: -3, head: -2, shoulder_f: 330, elbow_f: -16, shoulder_b: 24, elbow_b: -24,
      hip_f: -26, knee_f: 22, hip_b: 18, knee_b: 8 } }),
  // recover to idle
  k(ATTACK_LEN, 128, 'inOut', { hipY: 3, a: { torso: 1.5, shoulder_f: 357, elbow_f: -16, shoulder_b: -6, elbow_b: -14, hip_f: -2, knee_f: 2, hip_b: 2, knee_b: 1 } }),
];
const BONES: Bone[] = ['torso', 'neck', 'head', 'shoulder_f', 'elbow_f', 'shoulder_b', 'elbow_b', 'hip_f', 'knee_f', 'hip_b', 'knee_b'];

function lerpPose(a: Key, b: Key, u: number): Pose {
  const m = (x: number | undefined, y: number | undefined, d: number) => (x ?? d) + ((y ?? d) - (x ?? d)) * u;
  const p: Pose = {
    hipX: m(a.p.hipX, b.p.hipX, 0), hipY: m(a.p.hipY, b.p.hipY, 0),
    sx: m(a.p.sx, b.p.sx, 1), sy: m(a.p.sy, b.p.sy, 1), a: {},
  };
  for (const n of BONES) p.a[n] = m(a.p.a[n], b.p.a[n], 0);
  return sword(p, a.sw + (b.sw - a.sw) * u);
}

/** Attack pose at t seconds (0..ATTACK_LEN); `strike` is 0..1 while the blade is fast. */
export function attack(t: number): Pose & { strike: number } {
  t = Math.max(0, Math.min(ATTACK_LEN, t));
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const u = ease[b.e]((t - a.t) / (b.t - a.t));
  const p = lerpPose(a, b, u);
  // small idle life layered on top so holds never freeze
  const br = Math.sin(t * TAU / 2.6);
  p.a.torso! += br * 0.8;
  const strike = t > 0.3 && t < 0.52 ? 1 : 0;
  return Object.assign(p, { strike });
}
