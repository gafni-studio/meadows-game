// Light custom bone rig for the hero (rig test, not game code).
//
// Why custom and not DragonBones/Spine: the hero is 15 cut-out parts on ~21
// bones; forward kinematics + two-bone leg IK is ~200 lines, needs no editor,
// no runtime dependency, and poses are code (easy to tune and to drive from
// game state).
//
// Layout: one root Container at the feet (squash & stretch scales it, so it
// squashes about the ground). Every part is a flat Image inside it, positioned
// each frame from its bone's world transform, so draw order is a plain list
// and does not have to follow the bone tree.
import Phaser from 'phaser';

export type Bone =
  | 'root' | 'hips' | 'pelvis' | 'torso' | 'neck' | 'head' | 'hair' | 'scarf' | 'scarf_tail'
  | 'shoulder_f' | 'elbow_f' | 'hand_f' | 'shoulder_b' | 'elbow_b' | 'hand_b'
  | 'hip_f' | 'knee_f' | 'hip_b' | 'knee_b' | 'ankle_f' | 'ankle_b';

/** A pose: bone angles in degrees (positive = clockwise on screen, so a hanging
 *  limb swings backward), plus hip offset and squash. Missing = 0 / 1. */
export interface Pose {
  a: Partial<Record<Bone, number>>;
  hipX?: number; hipY?: number; // base px
  sx?: number; sy?: number;     // squash & stretch about the feet
  /** Leg IK: ankle offset (base px) from its rest spot. A leg with a target
   *  ignores its hip/knee angles, so a planted foot never slides. */
  feet?: { f?: [number, number]; b?: [number, number] };
  /** Sword: apparent length (1 = full, <1 = foreshortened, pointing at or
   *  away from the camera) and whether it is in front of the body. */
  sword?: { len?: number; front?: boolean };
}

interface RigJson {
  bones: Record<Bone, { parent: Bone | null; at: [number, number] }>;
  parts: Record<string, { bone: Bone }>;
  draw: string[];
}

interface Spring { bone: Bone; com: [number, number]; k: number; c: number; gain: number; drag: number; max: number; th: number; v: number }

const D2R = Math.PI / 180;

export class HeroRig {
  readonly root: Phaser.GameObjects.Container;
  private rig: RigJson;
  private order: Bone[];
  private local: Record<string, [number, number]> = {};
  private world: Record<string, { x: number; y: number; r: number }> = {};
  private imgs: { img: Phaser.GameObjects.Image; bone: Bone }[] = [];
  private swordImg?: Phaser.GameObjects.Image;
  private swordSlot = 0;
  private springs: Spring[];
  private prev = new Map<Bone, { x: number; y: number; vx: number; vy: number; r: number; w: number }>();
  /** world speed the rig is moving at (base px/s): drives hair/scarf drag. */
  vx = 0;
  scale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, scale: number) {
    this.rig = scene.cache.json.get('rig') as RigJson;
    this.scale = scale;
    this.root = scene.add.container(x, y);
    const b = this.rig.bones;
    const rootAt = b.root.at;
    // bones in parent-first order
    this.order = [];
    const visit = (n: Bone) => { if (!this.order.includes(n)) { const p = b[n].parent; if (p) visit(p); this.order.push(n); } };
    (Object.keys(b) as Bone[]).forEach(visit);
    for (const n of this.order) {
      const p = b[n].parent;
      const pa = p ? b[p].at : rootAt;
      this.local[n] = [b[n].at[0] - pa[0], b[n].at[1] - pa[1]];
    }
    const frames = scene.textures.get('hero');
    for (const part of this.rig.draw) {
      const img = scene.add.image(0, 0, 'hero', part);
      const piv = (frames.get(part) as unknown as { customPivot: boolean; pivotX: number; pivotY: number });
      img.setOrigin(piv.pivotX, piv.pivotY);
      this.root.add(img);
      this.imgs.push({ img, bone: this.rig.parts[part].bone });
      if (part === 'sword') { this.swordImg = img; this.swordSlot = this.root.length - 1; }
    }
    // Secondary motion: damped angular springs. `com` is the centre of mass
    // of the hanging part relative to its joint (base px); the spring feels
    // the joint's acceleration and the air (vx) through it.
    this.springs = [
      { bone: 'hair', com: [-70, -30], k: 140, c: 11, gain: 0.0011, drag: 0.0016, max: 9, th: 0, v: 0 },
      { bone: 'scarf', com: [-20, 20], k: 220, c: 16, gain: 0.0005, drag: 0.0006, max: 4, th: 0, v: 0 },
      { bone: 'scarf_tail', com: [10, 45], k: 90, c: 7, gain: 0.0022, drag: 0.004, max: 28, th: 0, v: 0 },
    ];
    this.setScale(1, 1);
  }

  private setScale(sx: number, sy: number) {
    this.root.setScale(this.scale * sx * (this.flip ? -1 : 1), this.scale * sy);
  }
  flip = false;

  /** Apply a pose, then step secondary motion by dt seconds. */
  apply(p: Pose, dt: number) {
    this.solve(p);
    if (p.feet) {
      for (const side of ['f', 'b'] as const) {
        const off = p.feet[side];
        if (off) this.legIK(p, side, off);
      }
      this.solve(p);
    }
    for (const { img, bone } of this.imgs) {
      const w = this.world[bone];
      img.setPosition(w.x, w.y).setRotation(w.r);
    }
    const sw = this.swordImg;
    if (sw) {
      sw.setScale(1, p.sword?.len ?? 1);
      this.root.moveTo(sw, p.sword?.front ? this.root.length - 1 : this.swordSlot);
    }
    this.setScale(p.sx ?? 1, p.sy ?? 1);
    if (dt > 0) this.stepSprings(dt);
  }

  /** Two-bone IK: set hip/knee so the ankle reaches rest + off, knee forward. */
  private legIK(p: Pose, side: 'f' | 'b', off: [number, number]) {
    const b = this.rig.bones;
    const hip = `hip_${side}` as Bone, knee = `knee_${side}` as Bone, ank = `ankle_${side}` as Bone;
    const rootAt = b.root.at;
    const thighRest = [b[knee].at[0] - b[hip].at[0], b[knee].at[1] - b[hip].at[1]];
    const shinRest = [b[ank].at[0] - b[knee].at[0], b[ank].at[1] - b[knee].at[1]];
    const L1 = Math.hypot(thighRest[0], thighRest[1]), L2 = Math.hypot(shinRest[0], shinRest[1]);
    const H = this.world[hip];
    const tx = b[ank].at[0] - rootAt[0] + off[0], ty = b[ank].at[1] - rootAt[1] + off[1];
    const d = Phaser.Math.Clamp(Math.hypot(tx - H.x, ty - H.y), Math.abs(L1 - L2) + 1, L1 + L2 - 0.5);
    const phi = Math.atan2(ty - H.y, tx - H.x);
    const A = Math.acos(Phaser.Math.Clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const t1 = phi - A;                                   // knee bends forward (+x)
    const kx = H.x + L1 * Math.cos(t1), ky = H.y + L1 * Math.sin(t1);
    const t2 = Math.atan2(ty - ky, tx - kx);
    const thighWorld = t1 - Math.atan2(thighRest[1], thighRest[0]);
    const shinWorld = t2 - Math.atan2(shinRest[1], shinRest[0]);
    const parentR = this.world[b[hip].parent!].r;
    p.a[hip] = (thighWorld - parentR) / D2R;
    p.a[knee] = (shinWorld - thighWorld) / D2R;
  }

  private solve(p: Pose) {
    const b = this.rig.bones;
    const sp = new Map(this.springs.map(s => [s.bone, s]));
    for (const n of this.order) {
      const par = b[n].parent;
      let [lx, ly] = this.local[n];
      if (n === 'hips') { lx += p.hipX ?? 0; ly += p.hipY ?? 0; }
      const ang = (p.a[n] ?? 0) + (sp.get(n)?.th ?? 0);
      if (!par) { this.world[n] = { x: 0, y: 0, r: ang * D2R }; continue; }
      const pw = this.world[par];
      const c = Math.cos(pw.r), s = Math.sin(pw.r);
      this.world[n] = { x: pw.x + lx * c - ly * s, y: pw.y + lx * s + ly * c, r: pw.r + ang * D2R };
    }
  }

  private stepSprings(dt: number) {
    const b = this.rig.bones;
    const sc = this.scale; // world accel in base px: the root moves in screen px
    for (const s of this.springs) {
      const par = b[s.bone].parent!;
      const w = this.world[s.bone], pw = this.world[par];
      // joint position in screen-independent base px (+ the rig's own travel)
      const prev = this.prev.get(s.bone);
      const x = w.x + this.root.x / sc, y = w.y + this.root.y / sc;
      if (!prev) { this.prev.set(s.bone, { x, y, vx: 0, vy: 0, r: pw.r, w: 0 }); continue; }
      const vx = (x - prev.x) / dt, vy = (y - prev.y) / dt;
      const ax = (vx - prev.vx) / dt, ay = (vy - prev.vy) / dt;
      const wv = (pw.r - prev.r) / dt;           // parent angular velocity
      const wa = (wv - prev.w) / dt;              // parent angular acceleration
      this.prev.set(s.bone, { x, y, vx, vy, r: pw.r, w: wv });
      // centre of mass in world orientation
      const c = Math.cos(w.r), sn = Math.sin(w.r);
      const rx = s.com[0] * c - s.com[1] * sn, ry = s.com[0] * sn + s.com[1] * c;
      // inertial force = -m·a, plus air drag against travel (+ a little gust)
      const fx = -ax * s.gain - (this.vx + vx) * s.drag;
      const fy = -ay * s.gain;
      const torque = (rx * fy - ry * fx) / Math.hypot(s.com[0], s.com[1]);
      const acc = -s.k * s.th - s.c * s.v + torque * 60 - wa * 0.012;
      s.v += acc * dt;
      s.th += s.v * dt;
      if (Math.abs(s.th) > s.max) { s.th = Math.sign(s.th) * s.max; s.v *= -0.3; }
    }
  }

  /** World position (screen px) of a bone joint, e.g. the sword tip. */
  point(bone: Bone, off: [number, number] = [0, 0]): Phaser.Math.Vector2 {
    const w = this.world[bone];
    const c = Math.cos(w.r), s = Math.sin(w.r);
    const lx = w.x + off[0] * c - off[1] * s, ly = w.y + off[0] * s + off[1] * c;
    const m = this.root.getWorldTransformMatrix();
    return new Phaser.Math.Vector2(m.getX(lx, ly), m.getY(lx, ly));
  }
}
