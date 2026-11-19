// Animation clips (animations/<asset>.json), written by the Animation Studio
// (studio/) and read by the game. A clip is a list of key poses; each key says
// how long it takes to reach the next one and how it gets there.
import type { Pose } from './rig';

export type Ease = 'smooth' | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold';
export const EASES: Ease[] = ['smooth', 'linear', 'easeIn', 'easeOut', 'easeInOut', 'hold'];

export interface Key {
  /** ms from this key to the next (for the last key of a looping clip: back to the first) */
  ms: number;
  /** how this key moves to the next. smooth = a curve through the neighbouring keys */
  ease: Ease;
  pose: Pose;
  /** optional game event fired when this key is reached (e.g. "hit") */
  event?: string;
}
export interface Clip { loop: boolean; keys: Key[] }
export interface AnimFile {
  asset: string;
  version: 1;
  clips: Record<string, Clip>;
}

export const restKey = (ms = 400): Key => ({ ms, ease: 'smooth', pose: { a: {} } });

export function newFile(asset: string, clips: string[]): AnimFile {
  return { asset, version: 1, clips: Object.fromEntries(clips.map(c => [c, { loop: true, keys: [restKey()] }])) };
}

/** Play length (ms): a loop includes the last key's way back to the first. */
export function clipLength(c: Clip): number {
  const n = c.keys.length;
  return c.keys.reduce((s, k, i) => s + (c.loop || i < n - 1 ? k.ms : 0), 0);
}

/** Start time (ms) of each key. */
export function keyTimes(c: Clip): number[] {
  let t = 0;
  return c.keys.map(k => { const s = t; t += k.ms; return s; });
}

const easeFn: Record<Exclude<Ease, 'smooth'>, (u: number) => number> = {
  linear: u => u,
  easeIn: u => u * u,
  easeOut: u => 1 - (1 - u) * (1 - u),
  easeInOut: u => u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2,
  hold: () => 0,
};

/** Catmull-Rom through p0..p3 at u (0..1 between p1 and p2). */
const cr = (p0: number, p1: number, p2: number, p3: number, u: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);

/** The pose at t ms (wraps for a looping clip, holds the end otherwise). */
export function sample(c: Clip, t: number): Pose {
  const n = c.keys.length;
  if (n === 1) return c.keys[0].pose;
  const len = clipLength(c);
  if (len <= 0) return c.keys[0].pose;
  t = c.loop ? ((t % len) + len) % len : Math.min(Math.max(t, 0), len);
  const starts = keyTimes(c);
  let i = n - 1;
  while (i > 0 && starts[i] > t) i--;
  if (!c.loop && i === n - 1) return c.keys[n - 1].pose;
  const at = (j: number) => c.keys[c.loop ? (j + n) % n : Math.min(Math.max(j, 0), n - 1)];
  const k1 = at(i), k2 = at(i + 1);
  const u = k1.ms > 0 ? Math.min(1, (t - starts[i]) / k1.ms) : 1;
  const k0 = at(i - 1), k3 = at(i + 2);
  const mix = (get: (p: Pose) => number) => k1.ease === 'smooth'
    ? cr(get(k0.pose), get(k1.pose), get(k2.pose), get(k3.pose), u)
    : get(k1.pose) + (get(k2.pose) - get(k1.pose)) * easeFn[k1.ease](u);

  const bones = new Set<string>();
  const moves = new Set<string>();
  for (const k of [k0, k1, k2, k3]) {
    Object.keys(k.pose.a).forEach(b => bones.add(b));
    Object.keys(k.pose.x ?? {}).forEach(b => moves.add(b));
  }
  const out: Pose = { a: {} };
  for (const b of bones) out.a[b] = mix(p => p.a[b] ?? 0);
  if (moves.size) {
    out.x = {};
    for (const b of moves) out.x[b] = [mix(p => p.x?.[b]?.[0] ?? 0), mix(p => p.x?.[b]?.[1] ?? 0)];
  }
  // layers and pictures switch at the key, they don't blend
  if (k1.pose.order) out.order = [...k1.pose.order];
  if (k1.pose.layer) out.layer = { ...k1.pose.layer };
  if (k1.pose.swap) out.swap = { ...k1.pose.swap };
  return out;
}

/** Events between two play times (ms), for the game's onImpact hooks. */
export function eventsBetween(c: Clip, from: number, to: number): string[] {
  const starts = keyTimes(c);
  return c.keys.filter((k, i) => k.event && starts[i] > from && starts[i] <= to).map(k => k.event!);
}
