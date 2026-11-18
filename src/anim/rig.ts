// Cut-out bone rigs (rigs/<asset>/rig.json): types, forward kinematics, 2-bone
// IK and spring follow-through. Pure maths, no Phaser and no DOM, so the
// Animation Studio (studio/) and the game share it.
//
// Space: rig px, y down, as cut from the asset's sheet. A bone's `at` is its
// joint at rest. Angles are degrees, clockwise on screen, relative to the
// parent; 0 = rest.

export interface BoneDef {
  parent?: string;
  at: [number, number];
  /** Where the studio's drag handle sits at rest (dragging it turns the bone). */
  tip?: [number, number];
  /** move: the joint can be dragged around (e.g. hips); item: a held item
   *  (e.g. sword); spring: follow-through added on playback. */
  kind?: 'move' | 'item' | 'spring';
}
export interface IkChain { upper: string; lower: string; bend: 1 | -1; pin?: boolean }
export interface SpringDef { k: number; c: number; gain: number; max: number }
export interface RigDef {
  id: string;
  name: string;
  atlas: string;
  frames: string;
  height: number;
  bones: Record<string, BoneDef>;
  /** Draw order, back to front. */
  parts: { name: string; bone: string }[];
  ik?: IkChain[];
  mirror?: [string, string][];
  /** Items that can change layer per key: draw just before `back`, or just after `front`. */
  layers?: Record<string, { back: string; front: string }>;
  springs?: Record<string, SpringDef>;
}

/** One keyframe pose. Missing bones are at rest. */
export interface Pose {
  /** bone -> angle (deg, clockwise, relative to parent) */
  a: Record<string, number>;
  /** move bones -> offset from rest (rig px, in the parent's space) */
  x?: Record<string, [number, number]>;
  /** item part -> layer ('mid' = its place in the draw order) */
  layer?: Record<string, 'back' | 'mid' | 'front'>;
}

export interface Xform { x: number; y: number; r: number }
const D2R = Math.PI / 180;

/** Bones in parent-first order. */
export function boneOrder(rig: RigDef): string[] {
  const out: string[] = [];
  const visit = (n: string) => {
    if (out.includes(n)) return;
    const p = rig.bones[n].parent;
    if (p) visit(p);
    out.push(n);
  };
  Object.keys(rig.bones).forEach(visit);
  return out;
}

/** World transform of every bone (rig px, relative to the root's rest joint). */
export function solve(rig: RigDef, pose: Pose, extra?: Record<string, number>): Record<string, Xform> {
  const w: Record<string, Xform> = {};
  for (const n of boneOrder(rig)) {
    const b = rig.bones[n];
    const ang = ((pose.a[n] ?? 0) + (extra?.[n] ?? 0)) * D2R;
    const off = pose.x?.[n] ?? [0, 0];
    if (!b.parent) {
      w[n] = { x: off[0], y: off[1], r: ang };
      continue;
    }
    const pb = rig.bones[b.parent], pw = w[b.parent];
    const lx = b.at[0] - pb.at[0] + off[0], ly = b.at[1] - pb.at[1] + off[1];
    const c = Math.cos(pw.r), s = Math.sin(pw.r);
    w[n] = { x: pw.x + lx * c - ly * s, y: pw.y + lx * s + ly * c, r: pw.r + ang };
  }
  return w;
}

/** World position of a rest-space point carried by `bone`. */
export function carry(rig: RigDef, w: Record<string, Xform>, bone: string, p: [number, number]): [number, number] {
  const b = rig.bones[bone], t = w[bone];
  const lx = p[0] - b.at[0], ly = p[1] - b.at[1];
  const c = Math.cos(t.r), s = Math.sin(t.r);
  return [t.x + lx * c - ly * s, t.y + lx * s + ly * c];
}

/** Rest-space point -> world, for the root's frame (rest root joint = origin). */
export function restToWorld(rig: RigDef, p: [number, number]): [number, number] {
  const r = rootOf(rig);
  return [p[0] - rig.bones[r].at[0], p[1] - rig.bones[r].at[1]];
}

export function rootOf(rig: RigDef): string {
  return Object.keys(rig.bones).find(n => !rig.bones[n].parent)!;
}

/** Local angle (deg) that points `bone`'s tip at a world point. */
export function aimAngle(rig: RigDef, w: Record<string, Xform>, bone: string, target: [number, number]): number {
  const b = rig.bones[bone];
  const tip = b.tip ?? [b.at[0], b.at[1] - 1];
  const rest = Math.atan2(tip[1] - b.at[1], tip[0] - b.at[0]);
  const want = Math.atan2(target[1] - w[bone].y, target[0] - w[bone].x);
  const parentR = b.parent ? w[b.parent].r : 0;
  return (want - rest - parentR) / D2R;
}

/** Bring `deg` within 180 of `near`, so dragging never flips a bone by 360. */
export function unwrap(deg: number, near: number): number {
  while (deg - near > 180) deg -= 360;
  while (deg - near < -180) deg += 360;
  return deg;
}

/**
 * 2-bone IK: set `upper` and `lower` so the lower bone's tip reaches `target`
 * (world). Keeps the bend on the side it is already on (or the chain's
 * default when straight). Writes into pose.a.
 */
export function solveIk(rig: RigDef, pose: Pose, chain: IkChain, target: [number, number]) {
  const up = rig.bones[chain.upper], lo = rig.bones[chain.lower];
  const tip = lo.tip!;
  const L1 = Math.hypot(lo.at[0] - up.at[0], lo.at[1] - up.at[1]);
  const L2 = Math.hypot(tip[0] - lo.at[0], tip[1] - lo.at[1]);
  const w = solve(rig, pose);
  const J = w[chain.upper];
  const d = Math.min(Math.max(Math.hypot(target[0] - J.x, target[1] - J.y), Math.abs(L1 - L2) + 0.01), L1 + L2 - 0.01);
  const phi = Math.atan2(target[1] - J.y, target[0] - J.x);
  const A = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const cur = pose.a[chain.lower] ?? 0;
  const parentR = up.parent ? w[up.parent].r : 0;
  const restUp = Math.atan2(lo.at[1] - up.at[1], lo.at[0] - up.at[0]);
  const restLo = Math.atan2(tip[1] - lo.at[1], tip[0] - lo.at[0]);
  // which way the joint bends now (the rest pose may already have a kink)
  const geom = bendOf(rig, chain, cur);
  const side = Math.abs(geom) > 5 ? Math.sign(geom) : chain.bend;   // near straight: the default side
  // the lower bone turns by `side`: put the knee/elbow on the other side of the line
  const t1 = phi - side * A;
  const kx = J.x + L1 * Math.cos(t1), ky = J.y + L1 * Math.sin(t1);
  const t2 = Math.atan2(target[1] - ky, target[0] - kx);
  const upLocal = (t1 - restUp - parentR) / D2R;
  const loLocal = (t2 - restLo - (t1 - restUp)) / D2R;
  pose.a[chain.upper] = unwrap(upLocal, pose.a[chain.upper] ?? 0);
  pose.a[chain.lower] = unwrap(loLocal, cur);
}

/** How far (deg) a chain's joint is bent off straight, signed: + bends the
 *  lower bone clockwise. `chain.bend` is the sign it should normally have. */
export function bendOf(rig: RigDef, chain: IkChain, lowerAngle: number): number {
  const up = rig.bones[chain.upper], lo = rig.bones[chain.lower], tip = lo.tip!;
  const restUp = Math.atan2(lo.at[1] - up.at[1], lo.at[0] - up.at[0]);
  const restLo = Math.atan2(tip[1] - lo.at[1], tip[0] - lo.at[0]);
  let d = lowerAngle - (restUp - restLo) / D2R;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/** World position of a chain's end (the lower bone's tip). */
export function chainEnd(rig: RigDef, w: Record<string, Xform>, chain: IkChain): [number, number] {
  return carry(rig, w, chain.lower, rig.bones[chain.lower].tip!);
}

/** Swap left/right: mirror pairs trade angles. */
export function mirrorPose(rig: RigDef, pose: Pose): Pose {
  const out: Pose = clonePose(pose);
  for (const [a, b] of rig.mirror ?? []) {
    out.a[a] = pose.a[b] ?? 0;
    out.a[b] = pose.a[a] ?? 0;
  }
  return out;
}

export function clonePose(p: Pose): Pose {
  return {
    a: { ...p.a },
    ...(p.x ? { x: Object.fromEntries(Object.entries(p.x).map(([k, v]) => [k, [v[0], v[1]] as [number, number]])) } : {}),
    ...(p.layer ? { layer: { ...p.layer } } : {}),
  };
}

/**
 * Follow-through for spring bones (playback only, never saved): each one lags
 * behind its parent's turning and the joint's acceleration, then settles.
 */
export class Springs {
  private st: Record<string, { th: number; v: number; pr?: number; pw?: number; px?: number; py?: number; vx?: number; vy?: number }> = {};
  constructor(private rig: RigDef) {}
  reset() { this.st = {}; }
  /** Offsets (deg) to pass to solve() as `extra`. */
  step(w: Record<string, Xform>, dt: number): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [n, sp] of Object.entries(this.rig.springs ?? {})) {
      const s = (this.st[n] ??= { th: 0, v: 0 });
      const par = this.rig.bones[n].parent!;
      const pr = w[par].r, x = w[n].x, y = w[n].y;
      if (dt > 0 && s.pr !== undefined) {
        const wv = (pr - s.pr) / dt, wa = (wv - (s.pw ?? 0)) / dt;
        const vx = (x - s.px!) / dt, vy = (y - s.py!) / dt;
        const ax = (vx - (s.vx ?? 0)) / dt, ay = (vy - (s.vy ?? 0)) / dt;
        const torque = (ax * Math.sin(w[n].r) - ay * Math.cos(w[n].r)) * sp.gain * 60;
        const acc = -sp.k * s.th - sp.c * s.v + torque - wa * 0.6;
        s.v += acc * dt;
        s.th += s.v * dt;
        if (Math.abs(s.th) > sp.max) { s.th = Math.sign(s.th) * sp.max; s.v *= -0.3; }
        s.pw = wv; s.vx = vx; s.vy = vy;
      }
      s.pr = pr; s.px = x; s.py = y;
      out[n] = s.th;
    }
    return out;
  }
}
