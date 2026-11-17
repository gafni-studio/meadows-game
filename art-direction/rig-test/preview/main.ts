// Rig test preview: a 1920x1080 mock with the hero idling, running and doing
// a 2-hit combo, big for inspection and at game scale (160 px) underneath.
// `?capture=1` stops the clock so tools/capture.mjs can step frames exactly.
import Phaser from 'phaser';
import { HeroRig } from './rig';
import { idle, run, combo, HITS, COMBO_LEN, COMBO_PAUSE, RUN_SPEED } from './anims';
import { HitFx, type ArcSpec } from './fx';

const HERO_PX = 994;           // hero height in base.jpg px (hair to sole)
const BIG = 440 / HERO_PX;     // inspection size
const GAME = 160 / HERO_PX;    // in-game size (art-direction/README.md)
const COMBO_LOOP = COMBO_LEN + COMBO_PAUSE;  // hit, hit, pause, repeat

type Mode = 'idle' | 'run' | 'combo';

class Mock extends Phaser.Scene {
  private rigs: { rig: HeroRig; mode: Mode; offset: number; shake: boolean; last: number }[] = [];
  clock = 0;
  private marks: { g: Phaser.GameObjects.Graphics; speed: number; y0: number; x0: number; x1: number }[] = [];
  private fx!: HitFx;
  private fxG!: Phaser.GameObjects.Graphics;

  preload() {
    this.load.atlas('hero', 'hero.png', 'hero.json');
    this.load.json('rig', 'rig.json');
  }

  create() {
    const g = this.add.graphics();
    // sky + hills + ground, flat colours in the zone palette
    g.fillGradientStyle(0xbfe3f2, 0xbfe3f2, 0xeaf4e4, 0xeaf4e4, 1).fillRect(0, 0, 1920, 1080);
    g.fillStyle(0xcfe6bf, 1);
    [[200, 820, 520], [760, 860, 600], [1400, 840, 560], [1900, 880, 480]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
    g.fillStyle(0xb4d79c, 1).fillRect(0, 730, 1920, 350);
    g.fillStyle(0x93c477, 1).fillRect(0, 730, 1920, 10);
    g.fillStyle(0x8a6a45, 1).fillRect(0, 1000, 1920, 80);
    g.fillStyle(0x7fb663, 1).fillRect(0, 990, 1920, 14);

    const label = (x: number, y: number, t: string, size = 30) =>
      this.add.text(x, y, t, { fontFamily: 'Georgia, serif', fontSize: `${size}px`, color: '#4a3220' }).setOrigin(0.5, 0);
    this.add.text(40, 28, 'Hero rig test: bone rig in Phaser', { fontFamily: 'Georgia, serif', fontSize: '34px', color: '#4a3220' });
    this.add.text(40, 72, '15 parts · chest/hips bend · leg IK (planted feet) · spring hair & scarf · squash & stretch · slash arc, spark, shake', { fontFamily: 'Georgia, serif', fontSize: '20px', color: '#6b5440' });

    // scrolling tufts under the runners, so the run reads as travel
    const tufts = (x0: number, x1: number, y: number, scale: number) => {
      const t = this.add.graphics();
      this.marks.push({ g: t, speed: RUN_SPEED * scale, y0: y, x0, x1 });
    };
    tufts(700, 1100, 732, BIG);
    tufts(840, 1040, 992, GAME);

    const big: [number, Mode, string][] = [[330, 'idle', 'Idle'], [900, 'run', 'Run'], [1440, 'combo', '2-hit combo']];
    big.forEach(([x, mode, name]) => {
      this.rigs.push({ rig: new HeroRig(this, x, 732, BIG), mode, offset: 0, shake: true, last: -1 });
      label(mode === 'combo' ? x + 60 : x, 760, name);
    });
    const small: [number, Mode][] = [[740, 'idle'], [940, 'run'], [1140, 'combo']];
    small.forEach(([x, mode]) => this.rigs.push({ rig: new HeroRig(this, x, 994, GAME), mode, offset: 0.4, shake: false, last: -1 }));
    label(960, 1020, 'game scale: 160 px', 22).setColor('#f3e6cf');
    this.fxG = this.add.graphics();
    this.fx = new HitFx(this.fxG);
    this.tick(0);
  }

  update(_: number, deltaMs: number) {
    this.tick(Math.min(deltaMs, 50) / 1000);
  }

  private tick(dt: number) {
    this.clock += dt;
    const t = this.clock;
    this.fxG.clear();
    for (const r of this.rigs) {
      if (r.mode === 'idle') { r.rig.vx = 0; r.rig.apply(idle(t + r.offset), dt); continue; }
      if (r.mode === 'run') { r.rig.vx = RUN_SPEED; r.rig.apply(run(t + r.offset), dt); continue; }
      const ct = (t + r.offset) % COMBO_LOOP;
      r.rig.vx = 0;
      r.rig.apply(combo(ct), dt);
      HITS.forEach((h, i) => {
        const crossed = r.last <= ct ? r.last < h.t && ct >= h.t : ct >= h.t; // loop wrap
        if (crossed && r.last >= 0) this.hit(r.rig, h.arc, i, r.shake);
      });
      r.last = ct;
    }
    this.fx.update(dt);
    for (const m of this.marks) {
      m.g.clear();
      const gap = 120 * (m.speed / (RUN_SPEED * BIG));
      const off = (t * m.speed) % gap;
      for (let x = m.x1 + gap - off; x > m.x0; x -= gap) {
        const a = Math.min(1, (x - m.x0) / 60, (m.x1 - x) / 60);
        if (a <= 0) continue;
        const s = m.speed / (RUN_SPEED * BIG);
        m.g.fillStyle(0x6fa957, a).fillTriangle(x, m.y0, x + 8 * s, m.y0 - 22 * s, x + 16 * s, m.y0);
        m.g.fillStyle(0x6fa957, a).fillTriangle(x + 12 * s, m.y0, x + 22 * s, m.y0 - 15 * s, x + 28 * s, m.y0);
      }
    }
  }

  /** A hit lands: slash arc along the blade's path, spark where a foe would
   *  stand, and a light camera shake (big hero only, so the mock isn't busy). */
  private hit(rig: HeroRig, kind: 'side' | 'rise', i: number, shake: boolean) {
    const sh = rig.point('shoulder_f');
    const R = 560 * rig.scale;
    const spec: ArcSpec = kind === 'side'
      // flat ellipse in front of the chest: from behind, round the near side
      // (the lower half reads as closer to the camera), out past the front
      ? { cx: sh.x + 0.1 * R, cy: sh.y + 0.18 * R, rx: R, ry: 0.3 * R, rot: -0.1, from: Math.PI * 1.02, to: -0.35, width: 0.24 * R }
      // rising backhand: from low in front, up and over the front
      : { cx: sh.x - 0.05 * R, cy: sh.y + 0.02 * R, rx: 0.95 * R, ry: 0.85 * R, rot: 0, from: 1.15, to: -1.3, width: 0.22 * R };
    this.fx.slash(spec);
    const [px, py] = HitFx.at(spec, kind === 'side' ? 0.15 : 0.05);
    this.fx.spark(px, py, 0.16 * R, i + 1);
    if (shake) this.cameras.main.shake(90, 0.0025);
  }
}

const capture = new URLSearchParams(location.search).has('capture');
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  width: 1920, height: 1080,
  parent: 'app',
  backgroundColor: '#dfeee0',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // the atlas is power-of-two, so the 160 px heroes get mipmaps (no shimmer)
  render: { antialias: true, mipmapFilter: 'LINEAR_MIPMAP_LINEAR', preserveDrawingBuffer: capture },
  scene: Mock,
});

declare global { interface Window { __rig: { ready: boolean; step: (n: number) => void } } }
window.__rig = { ready: false, step: () => {} };
game.events.once(Phaser.Core.Events.READY, () => {
  // Phaser starts its loop right after READY, so stop it a moment later; from
  // then on only step() advances time (exactly 1/30 s per frame).
  setTimeout(() => {
    if (capture) {
      game.loop.sleep();
      (game.scene.scenes[0] as Mock).clock = 0;
      let now = 0;
      window.__rig.step = (n: number) => { for (let i = 0; i < n; i++) { now += 1000 / 30; game.step(now, 1000 / 30); } };
    }
    window.__rig.ready = true;
  }, 300);
});
