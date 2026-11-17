// Rig pass 1 preview (1920x1080). One hero big for review, the same hero at
// game scale (160 px) underneath, playing idle -> run -> 3 combos on a loop.
//   ?capture=1   the clock stops; tools/capture.mjs steps exact 1/30 s frames
//   ?compare=1   a single still hero; window.__rig.pose(clip, t) sets its pose
import Phaser from 'phaser';
import { HeroRig, type Pose } from './rig';
import { idle, run, combo, HITS, COMBO_LOOP, RUN_SPEED } from './anims';
import { HitFx, type ArcSpec } from './fx';

const HERO_PX = 350;            // rig px, hair tip to sole
const BIG = 560 / HERO_PX;      // review size
const GAME = 160 / HERO_PX;     // in-game size (art-direction/README.md)
const GROUND = 820;
const SMALL_GROUND = 1010;

type Clip = 'idle' | 'run' | 'combo';
/** The reel: [clip, seconds]. */
const REEL: [Clip, number][] = [['idle', 3.0], ['run', 3.2], ['combo', COMBO_LOOP * 3]];
export const REEL_LEN = REEL.reduce((s, [, d]) => s + d, 0);
const BLEND = 0.16;             // s to cross-fade poses between clips

function clipPose(c: Clip, t: number): Pose {
  return c === 'idle' ? idle(t) : c === 'run' ? run(t) : combo(t % COMBO_LOOP);
}

function mix(a: Pose, b: Pose, k: number): Pose {
  const m = (x = 0, y = 0) => x + (y - x) * k;
  const out: Pose = { hipX: m(a.hipX, b.hipX), hipY: m(a.hipY, b.hipY), sx: m(a.sx ?? 1, b.sx ?? 1), sy: m(a.sy ?? 1, b.sy ?? 1), a: {}, sword: b.sword };
  for (const n of new Set([...Object.keys(a.a), ...Object.keys(b.a)]) as Set<keyof Pose['a']>) out.a[n] = m(a.a[n], b.a[n]);
  const f = (s: 'f' | 'b'): [number, number] => {
    const pa = a.feet?.[s] ?? [0, 0], pb = b.feet?.[s] ?? [0, 0];
    return [m(pa[0], pb[0]), m(pa[1], pb[1])];
  };
  out.feet = { f: f('f'), b: f('b') };
  return out;
}

function reelAt(t: number): { clip: Clip; local: number; pose: Pose } {
  t %= REEL_LEN;
  let start = 0;
  for (let i = 0; i < REEL.length; i++) {
    const [clip, d] = REEL[i];
    if (t < start + d) {
      const local = t - start;
      let pose = clipPose(clip, local);
      if (local < BLEND) {
        const [pc, pd] = REEL[(i + REEL.length - 1) % REEL.length];
        const k = local / BLEND;
        pose = mix(clipPose(pc, pd + local), pose, k * k * (3 - 2 * k));
      }
      return { clip, local, pose };
    }
    start += d;
  }
  return { clip: 'idle', local: 0, pose: idle(0) };
}

const params = new URLSearchParams(location.search);
const capture = params.has('capture') || params.has('compare');
const compare = params.has('compare');

class Preview extends Phaser.Scene {
  clock = 0;
  private heroes: { rig: HeroRig; shake: boolean; last: number; ground: number }[] = [];
  private fx!: HitFx;
  private fxG!: Phaser.GameObjects.Graphics;
  private tufts!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private scroll = 0;

  preload() {
    this.load.atlas('hero', 'hero.png', 'hero.json');
    this.load.json('rig', 'rig.json');
  }

  create() {
    if (compare) return this.createCompare();
    const g = this.add.graphics();
    g.fillStyle(0xd6ecf5, 1).fillRect(0, 0, 1920, 1080);
    g.fillStyle(0xcde6c0, 1);
    [[160, 900, 520], [820, 940, 600], [1500, 920, 560]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
    g.fillStyle(0xb7d99f, 1).fillRect(0, GROUND, 1920, 1080 - GROUND);
    g.fillStyle(0x97c67b, 1).fillRect(0, GROUND, 1920, 8);
    g.fillStyle(0x8a6a45, 1).fillRect(0, SMALL_GROUND + 8, 1920, 70);
    g.fillStyle(0x7fb663, 1).fillRect(0, SMALL_GROUND, 1920, 10);
    // ground shadows
    g.fillStyle(0x6f9a5a, 0.35).fillEllipse(960, GROUND + 4, 260, 26);
    g.fillStyle(0x5a4630, 0.35).fillEllipse(960, SMALL_GROUND + 3, 74, 8);
    const font = { fontFamily: 'Georgia, serif', color: '#4a3220' };
    this.add.text(40, 28, 'Hero rig, pass 1', { ...font, fontSize: '36px' });
    this.add.text(40, 74, 'cut-out bone rig in Phaser · parts from hero-rig-parts.jpg · leg IK · spring scarf · slash arcs in code', { ...font, fontSize: '20px', color: '#6b5440' });
    this.label = this.add.text(1880, 34, '', { ...font, fontSize: '34px' }).setOrigin(1, 0);
    this.add.text(1180, SMALL_GROUND - 34, 'game scale: 160 px', { ...font, fontSize: '20px', color: '#4a3220' });
    this.tufts = this.add.graphics();
    this.heroes.push({ rig: new HeroRig(this, 960, GROUND, BIG), shake: true, last: -1, ground: GROUND });
    this.heroes.push({ rig: new HeroRig(this, 960, SMALL_GROUND, GAME), shake: false, last: -1, ground: SMALL_GROUND });
    this.fxG = this.add.graphics();
    this.fx = new HitFx(this.fxG);
    this.tick(0);
  }

  private createCompare() {
    this.cameras.main.setBackgroundColor('#f6f6f4');
    const rig = new HeroRig(this, 960, 900, BIG);
    window.__rig.pose = (c: string, t: number) => {
      const p = clipPose(c as Clip, t);
      for (let i = 0; i < 40; i++) rig.apply(clipPose(c as Clip, t), 1 / 60);   // settle the scarf
      rig.apply(p, 0);
    };
  }

  update(_: number, deltaMs: number) {
    if (!compare) this.tick(Math.min(deltaMs, 50) / 1000);
  }

  private tick(dt: number) {
    this.clock += dt;
    const { clip, local, pose } = reelAt(this.clock);
    this.label.setText(clip === 'idle' ? 'Idle' : clip === 'run' ? 'Run (jog)' : `2-hit combo ${Math.min(3, Math.floor(local / COMBO_LOOP) + 1)} / 3`);
    this.fxG.clear();
    const moving = clip === 'run';
    if (moving) this.scroll += dt * RUN_SPEED;
    for (const h of this.heroes) {
      h.rig.vx = moving ? RUN_SPEED : 0;
      h.rig.apply(pose, dt);
      if (clip === 'combo') {
        const ct = local % COMBO_LOOP;
        HITS.forEach((hit, i) => {
          if (h.last >= 0 && h.last < hit.t && ct >= hit.t) this.hit(h.rig, hit.arc, i, h.shake);
        });
        h.last = ct;
      } else h.last = -1;
    }
    this.fx.update(dt);
    this.drawTufts();
  }

  /** Grass tufts scroll under the runner at the planted foot's speed. */
  private drawTufts() {
    const g = this.tufts.clear();
    for (const [y, sc, gap, x0, x1] of [[GROUND, BIG, 150, 560, 1360], [SMALL_GROUND, GAME, 90, 820, 1100]]) {
      const off = (this.scroll * sc) % gap;
      for (let x = x1 + gap - off; x > x0; x -= gap) {
        const a = Math.min(1, (x - x0) / 80, (x1 - x) / 80);
        if (a <= 0) continue;
        const s = sc / BIG;
        g.fillStyle(0x6fa957, a).fillTriangle(x, y, x + 9 * s, y - 24 * s, x + 18 * s, y);
        g.fillStyle(0x6fa957, a).fillTriangle(x + 14 * s, y, x + 24 * s, y - 16 * s, x + 31 * s, y);
      }
    }
  }

  /** A hit lands: a slash arc along the blade's path, a spark where a foe
   *  would stand, and a light shake (review hero only). */
  private hit(rig: HeroRig, kind: 'side' | 'smash', i: number, shake: boolean) {
    const sh = rig.point('shoulder_f');
    const R = 250 * rig.scale;                 // arm + blade, rig px -> screen
    const spec: ArcSpec = kind === 'side'
      // flat sweep round the near side at chest height, from behind to ahead
      ? { cx: sh.x + 0.1 * R, cy: sh.y - 0.12 * R, rx: R, ry: 0.3 * R, rot: -0.04, from: Math.PI * 0.95, to: -0.25, width: 0.24 * R }
      // overhead chop: from above the head, over the front, down to low ahead
      : { cx: sh.x, cy: sh.y + 0.05 * R, rx: 0.98 * R, ry: 0.98 * R, rot: 0, from: -1.95, to: 0.5, width: 0.24 * R };
    this.fx.slash(spec);
    const [px, py] = HitFx.at(spec, kind === 'side' ? -0.1 : 0.3);
    this.fx.spark(px, py, 0.18 * R, i + 1);
    if (shake) this.cameras.main.shake(80, 0.002);
  }
}

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  width: 1920, height: 1080,
  parent: 'app',
  backgroundColor: '#d6ecf5',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, mipmapFilter: 'LINEAR_MIPMAP_LINEAR', preserveDrawingBuffer: capture },
  scene: Preview,
});

declare global { interface Window { __rig: { ready: boolean; step: (n: number) => void; pose: (c: string, t: number) => void; len: number } } }
window.__rig = { ready: false, step: () => {}, pose: () => {}, len: REEL_LEN };
game.events.once(Phaser.Core.Events.READY, () => {
  // Phaser starts its loop right after READY: stop it a moment later, then
  // only step() advances time (exactly 1/30 s per frame).
  setTimeout(() => {
    if (capture) {
      game.loop.sleep();
      (game.scene.scenes[0] as Preview).clock = 0;
      let now = 0;
      window.__rig.step = (n: number) => { for (let i = 0; i < n; i++) { now += 1000 / 30; game.step(now, 1000 / 30); } };
    }
    window.__rig.ready = true;
  }, 300);
});
