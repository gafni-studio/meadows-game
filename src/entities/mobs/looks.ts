/**
 * v0.3.0 look and feel of the Whisperwood mobs (spec section 5): idle life, wind-up telegraphs, hit reactions
 * and deaths, drawn with small tweened shapes on top of each mob's 3-4 frame sprite sheet
 * (frame 0/1 idle-move, 2 wind-up, 3 Moss Lurker mound). Other mobs keep the default look (every hook is a no-op
 * that returns false).
 */
import Phaser from 'phaser';
import type { Monster } from '../Monster';

interface Extra { glow?: Phaser.GameObjects.Arc; throat?: Phaser.GameObjects.Ellipse; nextMote?: number; phase: number }
const EXTRA = new WeakMap<Monster, Extra>();
const ex = (m: Monster): Extra => {
  let e = EXTRA.get(m);
  if (!e) { e = { phase: Math.random() * 6 }; EXTRA.set(m, e); }
  return e;
};

/** Small tweened bits (light, leaves, moss, water) thrown out from a point. */
export function burst(scene: Phaser.Scene, x: number, y: number, n: number, color: number, o: { size?: number; spread?: number; up?: number; fall?: number; ms?: number; add?: boolean; depth?: number; rect?: boolean } = {}): void {
  for (let i = 0; i < n; i++) {
    const s = (o.size ?? 3) * (0.6 + Math.random() * 0.8);
    const dot = o.rect ? scene.add.rectangle(x, y, s * 1.6, s, color) : scene.add.circle(x, y, s, color);
    dot.setDepth(o.depth ?? 12);
    if (o.add) dot.setBlendMode(Phaser.BlendModes.ADD);
    const a = Math.random() * Math.PI * 2;
    const r = (o.spread ?? 40) * (0.4 + Math.random() * 0.6);
    scene.tweens.add({
      targets: dot, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.6 - (o.up ?? 0) + (o.fall ?? 0), alpha: 0,
      angle: o.rect ? Math.random() * 360 : 0, duration: (o.ms ?? 600) * (0.7 + Math.random() * 0.6), ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}

export function init(m: Monster): void {
  const e = ex(m);
  if (m.def.id === 'wisp') {
    e.glow = m.scene.add.circle(m.x, m.y, 20, 0xbfefff, 0.35).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
  }
  if (m.def.id === 'mire_toad') {
    e.throat = m.scene.add.ellipse(m.x, m.y, 14, 9, 0xe8d890, 0.9).setDepth(8.5);
  }
  if (m.def.id === 'moss_lurker' && m.dormant) m.setFrame(3);
}

export function idle(m: Monster, now: number): void {
  const e = EXTRA.get(m);
  if (!e || !m.alive) return;
  const id = m.def.id;
  if (id === 'wisp' && e.glow) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 300 + e.phase);
    e.glow.setPosition(m.x, m.y - m.displayHeight * 0.5).setRadius(16 + pulse * 8).setAlpha(m.engaged ? 0.45 + pulse * 0.2 : 0.25 + pulse * 0.2);
    m.setAlpha(0.8 + pulse * 0.2);
    if (now >= (e.nextMote ?? 0)) {
      e.nextMote = now + 160 + Math.random() * 200;
      burst(m.scene, m.x + (Math.random() - 0.5) * 10, m.y - m.displayHeight * 0.4, 1, 0xe8fbff, { size: 1.6, spread: 10, fall: 14, ms: 900, add: true, depth: 7 });
    }
  }
  if (id === 'mire_toad' && e.throat) {
    const puff = m.state === 'windup' ? 1.6 : 1 + 0.25 * Math.max(0, Math.sin(now / 260 + e.phase));
    const fx = m.flipX ? -1 : 1;
    e.throat.setPosition(m.x + fx * m.displayWidth * 0.22, m.y - m.displayHeight * 0.22).setScale(puff, puff * 0.9);
  }
  if (id === 'moss_lurker' && m.dormant) {
    m.setScale(m.baseSX * (1 + 0.03 * Math.sin(now / 700 + e.phase)), m.baseSY * (1 + 0.06 * Math.sin(now / 700 + e.phase)));
  }
}

/** Telegraph before a strike. True = drawn here (skip the default squash). */
export function windup(m: Monster, ms: number): boolean {
  const sc = m.scene;
  switch (m.def.id) {
    case 'thornling': // arm back (frame 2) and a lean
      sc.tweens.add({ targets: m, angle: m.flipX ? 14 : -14, duration: ms * 0.7, yoyo: false });
      return true;
    case 'mire_toad': // cheeks puff
      sc.tweens.add({ targets: m, scaleX: m.baseSX * 1.14, scaleY: m.baseSY * 1.1, duration: ms * 0.8 });
      return true;
    case 'moss_lurker': // a short, still pause, a shiver, then the lunge
      sc.tweens.add({ targets: m, x: m.x + 1.5, duration: 40, yoyo: true, repeat: Math.floor(ms / 90) });
      sc.tweens.add({ targets: m, scaleY: m.baseSY * 0.88, scaleX: m.baseSX * 1.06, duration: ms * 0.6 });
      return true;
    case 'boar': { // v0.3.1: head down, a little lean back
      sc.tweens.add({ targets: m, angle: m.flipX ? -10 : 10, scaleX: m.baseSX * 1.06, duration: ms * 0.7 });
      return true;
    }
    case 'angry_bull': { // v0.3.1: a snort and a paw at the ground before the charge
      const fx = m.flipX ? -1 : 1;
      const paws = Math.max(1, Math.floor(ms / 180));
      for (let i = 0; i < paws; i++) sc.time.delayedCall(i * 170, () => { if (m.alive) burst(sc, m.x - fx * m.halfW * 0.3, m.y - 3, 4, 0xb89a70, { size: 2.5, spread: 14, up: 10, ms: 380, rect: true }); });
      burst(sc, m.x + fx * m.halfW * 0.9, m.y - m.displayHeight * 0.45, 5, 0xeeeeee, { size: 2.5, spread: 10, ms: 420 });
      sc.tweens.add({ targets: m, x: m.x - fx * 3, duration: 90, yoyo: true, repeat: paws - 1 });
      return true;
    }
    case 'wisp': {
      const g = EXTRA.get(m)?.glow;
      if (g) sc.tweens.add({ targets: g, alpha: 0.85, duration: ms * 0.8 });
      return true;
    }
  }
  return false;
}

/** The strike itself: the Toad's tongue, the Lurker's bite, the Thornling's scratch. */
export function strike(m: Monster): void {
  const sc = m.scene;
  const fx = m.flipX ? -1 : 1;
  const y = m.y - m.displayHeight * 0.35;
  if (m.def.id === 'mire_toad') {
    const len = m.halfW + 50;
    const tongue = sc.add.rectangle(m.x + fx * m.halfW * 0.6, y, 4, 5, 0xe0607a).setOrigin(fx > 0 ? 0 : 1, 0.5).setDepth(9);
    const tip = sc.add.circle(tongue.x, y, 4, 0xf07890).setDepth(9);
    sc.tweens.add({ targets: tongue, width: len, duration: 90, yoyo: true, hold: 60, onComplete: () => tongue.destroy() });
    sc.tweens.add({ targets: tip, x: tongue.x + fx * len, duration: 90, yoyo: true, hold: 60, onComplete: () => tip.destroy() });
  } else if (m.def.id === 'moss_lurker') {
    burst(sc, m.x + fx * m.halfW, y, 6, 0x6a9a40, { size: 2.5, spread: 24, ms: 380, rect: true });
  } else if (m.def.id === 'boar' || m.def.id === 'angry_bull') {
    // v0.3.1: a short charge kicks up a dust puff behind it
    m.setAngle(0);
    burst(sc, m.x - fx * m.halfW, m.y - 4, m.def.id === 'boar' ? 6 : 9, 0xc8a878, { size: 3, spread: 18, up: 8, ms: 420, rect: true });
  } else if (m.def.id === 'thornling' && !m.ranged) {
    burst(sc, m.x + fx * m.halfW, y, 4, 0xa8d070, { size: 2, spread: 18, ms: 260 });
  }
}

export function hurt(m: Monster): void {
  if (m.def.id === 'wisp') {
    // flickers and dims
    m.scene.tweens.add({ targets: m, alpha: 0.25, duration: 50, yoyo: true, repeat: 2 });
    const g = EXTRA.get(m)?.glow;
    if (g) m.scene.tweens.add({ targets: g, alpha: 0.05, duration: 60, yoyo: true, repeat: 1 });
  }
  if (m.def.id === 'boar') {
    // v0.3.1: a squeal (the white flash is Monster's own)
    const t = m.scene.add.text(m.x, m.y - m.displayHeight - 4, 'squee!', { fontFamily: 'monospace', fontSize: '10px', color: '#ffd0d0', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(12);
    m.scene.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 500, onComplete: () => t.destroy() });
  }
  if (m.def.id === 'moss_lurker' || m.def.id === 'thornling') burst(m.scene, m.x, m.y - m.displayHeight * 0.5, 3, m.def.id === 'thornling' ? 0x7ab04a : 0x5a8a3a, { size: 2, spread: 20, ms: 350, rect: true });
}

/** Custom deaths. True = handled (the sprite ends invisible). */
export function death(m: Monster): boolean {
  const sc = m.scene;
  const cx = m.x, cy = m.y - m.displayHeight * 0.5;
  const done = () => m.setVisible(false);
  const e = EXTRA.get(m);
  switch (m.def.id) {
    case 'wisp': // dissolves into a spray of light
      burst(sc, cx, cy, 16, 0xe8fbff, { size: 2.6, spread: 60, ms: 700, add: true });
      burst(sc, cx, cy, 8, 0x9fe0ff, { size: 3.5, spread: 34, ms: 500, add: true });
      if (e?.glow) sc.tweens.add({ targets: e.glow, alpha: 0, radius: 40, duration: 400 });
      sc.tweens.add({ targets: m, alpha: 0, scale: m.scale * 1.4, duration: 260, onComplete: done });
      return true;
    case 'boar': // v0.3.1: tips over onto its side
      sc.tweens.add({ targets: m, angle: m.flipX ? -90 : 90, y: m.y - 4, duration: 260, ease: 'Quad.easeIn' });
      burst(sc, cx, m.y - 4, 6, 0xc8a878, { size: 3, spread: 24, ms: 500, rect: true });
      sc.tweens.add({ targets: m, alpha: 0, delay: 600, duration: 450, onComplete: () => { m.setAngle(0); done(); } });
      return true;
    case 'thornling': // bursts into leaves
      burst(sc, cx, cy, 14, 0x6aa040, { size: 3, spread: 50, fall: 30, ms: 900, rect: true });
      burst(sc, cx, cy, 6, 0x8a6a3a, { size: 2, spread: 30, fall: 24, ms: 700, rect: true });
      sc.tweens.add({ targets: m, alpha: 0, scaleY: m.baseSY * 0.2, duration: 160, onComplete: done });
      return true;
    case 'moss_lurker': // slumps back into moss
      m.setFrame(3);
      burst(sc, cx, m.y - 6, 8, 0x4a7a30, { size: 3, spread: 30, ms: 700, rect: true });
      sc.tweens.add({ targets: m, scaleY: m.baseSY * 0.45, scaleX: m.baseSX * 1.15, duration: 420, ease: 'Quad.easeIn' });
      sc.tweens.add({ targets: m, alpha: 0, delay: 500, duration: 500, onComplete: done });
      return true;
    case 'mire_toad': // belly-flop with a big splash
      e?.throat?.setVisible(false);
      sc.tweens.add({
        targets: m, y: m.y - 26, duration: 180, yoyo: true, ease: 'Quad.easeOut',
        onYoyo: () => m.setFlipY(true),
        onComplete: () => {
          burst(sc, m.x, m.y - 4, 18, 0x6aa0a0, { size: 3, spread: 64, up: 20, ms: 650 });
          burst(sc, m.x, m.y - 4, 8, 0xcfe8d8, { size: 2, spread: 40, up: 30, ms: 500 });
          sc.tweens.add({ targets: m, alpha: 0, delay: 250, duration: 400, onComplete: () => { m.setFlipY(false); done(); } });
        },
      });
      return true;
  }
  return false;
}

/** Toad lands from a hop with a splash. */
export function land(m: Monster): void {
  if (m.def.id === 'mire_toad') {
    burst(m.scene, m.x, m.y - 3, 6, 0x7ab0a8, { size: 2.2, spread: 28, up: 8, ms: 400 });
    m.scene.tweens.add({ targets: m, scaleY: m.baseSY * 0.82, scaleX: m.baseSX * 1.12, duration: 70, yoyo: true });
  }
}

export function hop(m: Monster): void {
  m.scene.tweens.add({ targets: m, scaleY: m.baseSY * 1.12, scaleX: m.baseSX * 0.92, duration: 90, yoyo: true });
}

/** The Moss Lurker pops up and shakes off its moss. */
export function wake(m: Monster): void {
  if (m.def.id !== 'moss_lurker') return;
  m.setFrame(0);
  m.setScale(m.baseSX * 0.8, m.baseSY * 0.6);
  m.scene.tweens.add({ targets: m, scaleX: m.baseSX, scaleY: m.baseSY, duration: 260, ease: 'Back.easeOut' });
  burst(m.scene, m.x, m.y - m.displayHeight * 0.6, 12, 0x5a8a3a, { size: 3, spread: 46, up: 10, fall: 26, ms: 700, rect: true });
}

export function sleep(m: Monster): void {
  if (m.def.id !== 'moss_lurker') return;
  m.setFrame(3);
  m.scene.tweens.add({ targets: m, scaleY: m.baseSY, duration: 300 });
}

export function respawn(m: Monster): void {
  const e = EXTRA.get(m);
  e?.throat?.setVisible(true);
  if (e?.glow) e.glow.setAlpha(0.3).setRadius(20);
  m.setFlipY(false);
  if (m.def.id === 'moss_lurker' && m.dormant) m.setFrame(3);
}

export function destroy(m: Monster): void {
  const e = EXTRA.get(m);
  e?.glow?.destroy();
  e?.throat?.destroy();
  EXTRA.delete(m);
}
