// Rig test preview: a 1920x1080 mock with the hero idling, running and
// attacking, big for inspection and at game scale (160 px) underneath.
// `?capture=1` stops the clock so tools/capture.mjs can step frames exactly.
import Phaser from 'phaser';
import { HeroRig } from './rig';
import { idle, run, attack, ATTACK_LEN } from './anims';

const HERO_PX = 994;           // hero height in base.jpg px (hair to sole)
const BIG = 440 / HERO_PX;     // inspection size
const GAME = 160 / HERO_PX;    // in-game size (art-direction/README.md)
const RUN_SPEED = 1150;        // base px/s, drives scrolling ground + hair drag
const ATTACK_EVERY = 1.7;      // s: attack, then idle until the next one

type Mode = 'idle' | 'run' | 'attack';

class Mock extends Phaser.Scene {
  private rigs: { rig: HeroRig; mode: Mode; offset: number }[] = [];
  clock = 0;
  private marks: { g: Phaser.GameObjects.Graphics; speed: number; y0: number; x0: number; x1: number }[] = [];
  private trails = new Map<HeroRig, { pts: Phaser.Math.Vector2[]; ages: number[] }>();
  private fx!: Phaser.GameObjects.Graphics;

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
    this.add.text(40, 72, '14 parts cut from base.jpg · 18 bones · spring hair & scarf · squash & stretch', { fontFamily: 'Georgia, serif', fontSize: '20px', color: '#6b5440' });

    // scrolling tufts under the runners, so the run reads as travel
    const tufts = (x0: number, x1: number, y: number, scale: number) => {
      const t = this.add.graphics();
      this.marks.push({ g: t, speed: RUN_SPEED * scale, y0: y, x0, x1 });
    };
    tufts(760, 1160, 732, BIG);
    tufts(860, 1060, 992, GAME);

    const big: [number, Mode][] = [[380, 'idle'], [960, 'run'], [1530, 'attack']];
    big.forEach(([x, mode]) => {
      this.rigs.push({ rig: new HeroRig(this, x, 732, BIG), mode, offset: 0 });
      label(x, 760, mode[0].toUpperCase() + mode.slice(1));
    });
    const small: [number, Mode][] = [[760, 'idle'], [960, 'run'], [1170, 'attack']];
    small.forEach(([x, mode]) => this.rigs.push({ rig: new HeroRig(this, x, 994, GAME), mode, offset: 0.4 }));
    label(960, 1020, 'game scale: 160 px', 22).setColor('#f3e6cf');
    this.fx = this.add.graphics();
    this.tick(0);
  }

  update(_: number, deltaMs: number) {
    this.tick(Math.min(deltaMs, 50) / 1000);
  }

  private tick(dt: number) {
    this.clock += dt;
    const t = this.clock;
    this.fx.clear();
    for (const r of this.rigs) {
      if (r.mode === 'idle') { r.rig.vx = 0; r.rig.apply(idle(t + r.offset), dt); continue; }
      if (r.mode === 'run') { r.rig.vx = RUN_SPEED; r.rig.apply(run(t + r.offset), dt); continue; }
      const at = (t + r.offset) % ATTACK_EVERY;
      const p = at < ATTACK_LEN ? attack(at) : Object.assign(idle(t), { strike: 0 });
      r.rig.vx = 0;
      r.rig.apply(p, dt);
      this.trail(r.rig, p.strike > 0, dt);
    }
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

  /** Swoosh behind the blade while it is fast: a code effect, not art. */
  private trail(rig: HeroRig, on: boolean, dt: number) {
    let tr = this.trails.get(rig);
    if (!tr) { tr = { pts: [], ages: [] }; this.trails.set(rig, tr); }
    if (on) { tr.pts.push(rig.point('hand_f', [0, -250])); tr.ages.push(0); tr.pts.push(rig.point('hand_f', [0, -120])); tr.ages.push(0); }
    tr.ages = tr.ages.map(a => a + dt);
    while (tr.ages.length && tr.ages[0] > 0.16) { tr.ages.splice(0, 2); tr.pts.splice(0, 2); }
    for (let i = 0; i + 3 < tr.pts.length; i += 2) {
      const a = 1 - tr.ages[i] / 0.16;
      this.fx.fillStyle(0xfff6dc, 0.55 * a);
      this.fx.fillPoints([tr.pts[i], tr.pts[i + 2], tr.pts[i + 3], tr.pts[i + 1]], true);
    }
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
