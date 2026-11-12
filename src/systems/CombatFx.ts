/**
 * v0.2.5 combat feel: slash trails timed to the real hit range, impact-frame
 * damage, hit-stop, crit shake, sparks, and a distinct animation per skill.
 * Drawn with Phaser Graphics / tweens (no extra art required).
 */
import Phaser from 'phaser';
import { ASSUME } from '../data/assumptions';

export const FX = {
  /** Basic slash duration and the moment the blade crosses the hitting line. */
  basicMs: 130,
  basicImpactMs: 70,
  /** Power Strike: raise, then smash. Impact near the bottom of the smash. */
  smashWindupMs: 90,
  smashMs: 120,
  smashImpactMs: 170, // windup + most of the smash
  earthMs: 280,
  earthImpactMs: 110,
  flameMs: 220,
  flameImpactMs: 90,
  rootMs: 260,
  rootImpactMs: 100,
  rageMs: 480,
  hitstopBasic: 48,   // ~3 frames
  hitstopCrit: 72,    // ~4 frames
  hitstopSmash: 90,
  hitstopSkill: 64,
};

type SC = Phaser.Scene;

function g(scene: SC, depth = 14): Phaser.GameObjects.Graphics {
  return scene.add.graphics().setDepth(depth);
}

/** Freeze the world for a few frames. Scene timers still run so impact callbacks fire. */
export function hitStop(scene: SC, ms: number): void {
  const st = scene as SC & { __hitResume?: Phaser.Time.TimerEvent };
  if (st.__hitResume) { st.__hitResume.remove(false); st.__hitResume = undefined; }
  scene.tweens.timeScale = 0;
  scene.physics.world.pause();
  st.__hitResume = scene.time.delayedCall(ms, () => {
    scene.tweens.timeScale = 1;
    if (scene.physics.world.isPaused) scene.physics.world.resume();
    st.__hitResume = undefined;
  });
}

export function shake(scene: SC, duration = 70, intensity = 0.004): void {
  scene.cameras.main.shake(duration, intensity);
}

/** Sparks bursting from a hit. Gold-tinted on a crit. */
export function hitSparks(scene: SC, x: number, y: number, crit = false, color = 0xfff2c0): void {
  const n = crit ? 14 : 8;
  const c = crit ? 0xffe066 : color;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.5;
    const spd = (crit ? 140 : 90) + Math.random() * 90;
    const sz = (crit ? 3.5 : 2.2) + Math.random() * 2;
    const d = scene.add.rectangle(x, y, sz, sz * (0.6 + Math.random()), c, 1).setDepth(16).setAngle(Math.random() * 180);
    const vx = Math.cos(ang) * spd;
    const vy = Math.sin(ang) * spd - 40;
    scene.tweens.add({
      targets: d,
      x: x + vx * 0.22,
      y: y + vy * 0.22 + 18,
      alpha: 0,
      scale: 0.2,
      duration: crit ? 280 : 200,
      ease: 'Cubic.easeOut',
      onComplete: () => d.destroy(),
    });
  }
  if (crit) {
    const flash = scene.add.circle(x, y, 8, 0xffe066, 0.7).setDepth(15);
    scene.tweens.add({ targets: flash, radius: 28, alpha: 0, duration: 160, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
  }
}

/** Brief white flash at the point of impact. */
export function impactFlash(scene: SC, x: number, y: number, color = 0xffffff, r = 22): void {
  const c = scene.add.circle(x, y, 6, color, 0.85).setDepth(15);
  scene.tweens.add({ targets: c, radius: r, alpha: 0, duration: 140, ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i + Math.PI / 4;
    const ln = g(scene, 15);
    ln.lineStyle(2, color, 0.9);
    ln.lineBetween(x, y, x + Math.cos(a) * 8, y + Math.sin(a) * 8);
    scene.tweens.add({
      targets: ln, alpha: 0,
      duration: 150,
      onUpdate: () => { /* keep */ },
      onComplete: () => ln.destroy(),
    });
    // stretch the lines out
    scene.tweens.addCounter({
      from: 8, to: 26, duration: 150, ease: 'Cubic.easeOut',
      onUpdate: (tw) => {
        const d = tw.getValue() ?? 0;
        ln.clear();
        ln.lineStyle(2, color, 1 - tw.progress);
        ln.lineBetween(x + Math.cos(a) * 4, y + Math.sin(a) * 4, x + Math.cos(a) * d, y + Math.sin(a) * d);
      },
    });
  }
}

/**
 * A sweeping slash trail that reaches `reach` px (the actual melee hit range).
 * The blade travels from high over the shoulder, across horizontal (the impact
 * frame), and through to a follow-through. Returns nothing; caller times damage
 * to FX.basicImpactMs.
 */
export function slashArc(scene: SC, ox: number, oy: number, facing: number, opts?: { reach?: number; color?: number; duration?: number; thick?: number }): void {
  const reach = opts?.reach ?? ASSUME.meleeReach;
  const color = opts?.color ?? 0xf4f1e4;
  const dur = opts?.duration ?? FX.basicMs;
  const thick = opts?.thick ?? 11;
  const gfx = g(scene, 13);
  const tip = g(scene, 14);
  const start = facing > 0 ? Phaser.Math.DegToRad(-115) : Phaser.Math.DegToRad(-65);
  const end = facing > 0 ? Phaser.Math.DegToRad(55) : Phaser.Math.DegToRad(125);
  const cx = ox;
  const cy = oy;
  const trail: number[] = [];
  scene.tweens.addCounter({
    from: 0, to: 1, duration: dur, ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const ang = start + (end - start) * t;
      trail.push(ang);
      if (trail.length > 12) trail.shift();
      gfx.clear();
      tip.clear();
      for (let i = 0; i < trail.length; i++) {
        const a0 = i === 0 ? trail[i] : trail[i - 1];
        const a1 = trail[i];
        const fade = (i + 1) / trail.length;
        const w = thick * (0.35 + 0.65 * fade);
        gfx.lineStyle(w, color, 0.25 + 0.75 * fade);
        gfx.beginPath();
        gfx.arc(cx, cy, reach - 2, Math.min(a0, a1), Math.max(a0, a1), false);
        gfx.strokePath();
      }
      // bright cutting edge + tip at current angle
      gfx.lineStyle(3.5, 0xffffff, 1);
      gfx.beginPath();
      gfx.arc(cx, cy, reach, ang - facing * 0.18, ang, facing < 0);
      gfx.strokePath();
      const tx = cx + Math.cos(ang) * reach;
      const ty = cy + Math.sin(ang) * reach;
      tip.fillStyle(0xffffff, 0.95);
      tip.fillCircle(tx, ty, 4.5);
    },
    onComplete: () => {
      scene.tweens.add({ targets: [gfx, tip], alpha: 0, duration: 80, onComplete: () => { gfx.destroy(); tip.destroy(); } });
    },
  });
}

/**
 * Power Strike: the sword rises, hangs a beat, then slams down. A wide impact
 * flash lands at the bottom of the smash — that's the damage frame.
 */
export function overheadSmash(scene: SC, ox: number, oy: number, facing: number, reach = ASSUME.meleeReach): void {
  const gfx = g(scene, 13);
  const rise = FX.smashWindupMs;
  const smash = FX.smashMs;
  const top = facing > 0 ? Phaser.Math.DegToRad(-150) : Phaser.Math.DegToRad(330);
  const bot = facing > 0 ? Phaser.Math.DegToRad(80) : Phaser.Math.DegToRad(100);
  const sword = scene.add.rectangle(ox, oy, 6, reach * 0.92, 0xffe08a, 0).setOrigin(0.5, 1).setDepth(13).setAngle(facing > 0 ? -20 : 20);
  sword.setFillStyle(0xffe08a, 0.95);
  // rise
  scene.tweens.add({
    targets: sword, angle: facing > 0 ? -150 : 150, duration: rise, ease: 'Cubic.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: sword, angle: facing > 0 ? 80 : -80, duration: smash, ease: 'Cubic.easeIn',
        onComplete: () => {
          scene.tweens.add({ targets: sword, alpha: 0, duration: 120, onComplete: () => sword.destroy() });
          gfx.destroy();
        },
      });
    },
  });
  // trail during the smash only
  scene.time.delayedCall(rise, () => {
    scene.tweens.addCounter({
      from: 0, to: 1, duration: smash, ease: 'Cubic.easeIn',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const ang = top + (bot - top) * t;
        gfx.clear();
        gfx.lineStyle(10, 0xffc04a, 0.35 * t);
        gfx.beginPath();
        gfx.arc(ox, oy, reach, Math.min(top, ang), Math.max(top, ang), false);
        gfx.strokePath();
        gfx.lineStyle(4, 0xfff0c0, 0.8);
        gfx.beginPath();
        gfx.arc(ox, oy, reach, ang - facing * 0.2, ang, facing < 0);
        gfx.strokePath();
      },
    });
  });
}

/** Earthbreaker: cracks shoot along the ground over `range` px, then a shockwave. */
export function earthShock(scene: SC, x: number, groundY: number, facing: number, range: number): void {
  shake(scene, 160, 0.01);
  const cracks = g(scene, 12);
  const ring = scene.add.ellipse(x, groundY - 2, 16, 8, 0xc9a46a, 0.0).setStrokeStyle(3, 0xdbc08a, 0.95).setDepth(12);
  scene.tweens.add({
    targets: ring, width: range * 2.1, height: 22, alpha: 0.15,
    duration: FX.earthMs, ease: 'Cubic.easeOut',
    onComplete: () => scene.tweens.add({ targets: ring, alpha: 0, duration: 180, onComplete: () => ring.destroy() }),
  });
  scene.tweens.addCounter({
    from: 0, to: 1, duration: FX.earthMs, ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      cracks.clear();
      const dir = facing || 1;
      // a fan of cracks in both directions (AoE), longer in the facing direction
      const arms = [-1, 1, -0.55, 0.55, -0.25, 0.25];
      for (let i = 0; i < arms.length; i++) {
        const side = Math.sign(arms[i]) || dir;
        const len = range * t * (0.55 + 0.45 * (side === dir ? 1 : 0.7)) * (0.75 + Math.abs(arms[i]) * 0.3);
        const yOff = arms[i] * 6;
        cracks.lineStyle(i < 2 ? 3.5 : 2, 0x8a6a40, 0.85);
        jagged(cracks, x, groundY - 2 + yOff, x + side * len, groundY - 2 + yOff * 1.4, 7);
      }
      // dirt puffs along the leading edge
    },
    onComplete: () => scene.tweens.add({ targets: cracks, alpha: 0, duration: 280, onComplete: () => cracks.destroy() }),
  });
  // dirt chunks
  for (let i = 0; i < 14; i++) {
    const side = Math.random() < 0.65 ? facing : (Math.random() < 0.5 ? -1 : 1);
    const dx = side * Math.random() * range;
    const chunk = scene.add.rectangle(x + dx * 0.2, groundY - 4, 3 + Math.random() * 4, 2 + Math.random() * 3, 0x8a6a40, 1).setDepth(13).setAngle(Math.random() * 90);
    scene.tweens.add({
      targets: chunk,
      x: x + dx,
      y: groundY - 10 - Math.random() * 36,
      alpha: 0,
      angle: chunk.angle + 80,
      duration: 320 + Math.random() * 180,
      ease: 'Cubic.easeOut',
      onComplete: () => chunk.destroy(),
    });
  }
}

function jagged(gfx: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, segs: number): void {
  gfx.beginPath();
  gfx.moveTo(x0, y0);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const jx = x0 + (x1 - x0) * t + (Math.random() - 0.5) * 7;
    const jy = y0 + (y1 - y0) * t + (Math.random() - 0.5) * 5;
    gfx.lineTo(jx, jy);
  }
  gfx.strokePath();
}

/** Flame Cleave: a wide fire arc that sweeps through `width` px. */
export function flameArc(scene: SC, ox: number, oy: number, facing: number, width: number): void {
  const reach = width;
  const gfx = g(scene, 13);
  const start = facing > 0 ? Phaser.Math.DegToRad(-100) : Phaser.Math.DegToRad(-80);
  const end = facing > 0 ? Phaser.Math.DegToRad(40) : Phaser.Math.DegToRad(220);
  scene.tweens.addCounter({
    from: 0, to: 1, duration: FX.flameMs, ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const ang = start + (end - start) * t;
      gfx.clear();
      // outer glow
      gfx.lineStyle(16, 0xff6a20, 0.28);
      gfx.beginPath();
      gfx.arc(ox, oy, reach * 0.92, start, ang, facing < 0);
      gfx.strokePath();
      gfx.lineStyle(8, 0xffaa33, 0.7);
      gfx.beginPath();
      gfx.arc(ox, oy, reach * 0.92, start, ang, facing < 0);
      gfx.strokePath();
      gfx.lineStyle(3, 0xfff0c0, 0.95);
      gfx.beginPath();
      gfx.arc(ox, oy, reach * 0.92, ang - facing * 0.22, ang, facing < 0);
      gfx.strokePath();
    },
    onComplete: () => scene.tweens.add({ targets: gfx, alpha: 0, duration: 180, onComplete: () => gfx.destroy() }),
  });
  // embers
  for (let i = 0; i < 16; i++) {
    const delay = 20 + i * 12;
    const dist = 20 + Math.random() * reach;
    scene.time.delayedCall(delay, () => {
      const e = scene.add.circle(ox + facing * dist * 0.4, oy - 6, 2 + Math.random() * 2.5, Math.random() < 0.4 ? 0xfff0a0 : 0xff7020, 1).setDepth(14);
      scene.tweens.add({
        targets: e,
        x: ox + facing * dist,
        y: oy - 10 - Math.random() * 40,
        alpha: 0,
        radius: 1,
        duration: 280 + Math.random() * 160,
        ease: 'Cubic.easeOut',
        onComplete: () => e.destroy(),
      });
    });
  }
}

/** Root Lash: roots erupt from the ground and snap forward along `width` px. */
export function rootWhip(scene: SC, ox: number, groundY: number, facing: number, width: number): void {
  const n = 5;
  const roots: Phaser.GameObjects.Graphics[] = [];
  for (let i = 0; i < n; i++) {
    const gfx = g(scene, 12);
    roots.push(gfx);
    const yOff = -4 - i * 5;
    const delay = i * 28;
    const len = width * (0.75 + Math.random() * 0.3);
    scene.time.delayedCall(delay, () => {
      scene.tweens.addCounter({
        from: 0, to: 1, duration: FX.rootMs - delay, ease: 'Back.easeOut',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          gfx.clear();
          const x1 = ox + facing * len * t;
          gfx.lineStyle(5 - i * 0.4, 0x4a6a2a, 0.95);
          const mid = ox + facing * len * t * 0.55;
          const sag = (1 - t) * (10 + i * 3) - t * 4;
          gfx.beginPath();
          gfx.moveTo(ox, groundY - 2);
          gfx.lineTo(mid, groundY - 18 - sag);
          gfx.lineTo(x1, groundY + yOff);
          gfx.strokePath();
          gfx.lineStyle(2, 0x8abc4a, 0.7);
          gfx.beginPath();
          gfx.moveTo(ox, groundY - 2);
          gfx.lineTo(mid, groundY - 18 - sag);
          gfx.lineTo(x1, groundY + yOff);
          gfx.strokePath();
          // little side rootlets
          if (t > 0.4) {
            gfx.lineStyle(2, 0x5a8a3a, 0.8);
            const rx = ox + facing * len * t * 0.6;
            gfx.lineBetween(rx, groundY - 8, rx + facing * 8, groundY - 16);
          }
        },
        onComplete: () => scene.tweens.add({ targets: gfx, alpha: 0, duration: 200, onComplete: () => gfx.destroy() }),
      });
    });
  }
  // dirt puffs at eruption points
  for (let i = 0; i < 6; i++) {
    const puff = scene.add.circle(ox + facing * (8 + i * 10), groundY - 2, 3, 0x6a5438, 0.7).setDepth(11);
    scene.tweens.add({ targets: puff, y: groundY - 12, radius: 8, alpha: 0, duration: 240, delay: i * 20, onComplete: () => puff.destroy() });
  }
}

/** Rage: a red aura bursts out of the body on cast. */
export function rageBurst(scene: SC, x: number, y: number): void {
  const ring = scene.add.circle(x, y, 10, 0xff4040, 0).setStrokeStyle(5, 0xff6060, 0.95).setDepth(13);
  scene.tweens.add({
    targets: ring, radius: 70, alpha: 0, duration: FX.rageMs * 0.55, ease: 'Cubic.easeOut',
    onUpdate: () => ring.setStrokeStyle(5 * (ring.alpha + 0.2), 0xff5050, ring.alpha),
    onComplete: () => ring.destroy(),
  });
  const ring2 = scene.add.circle(x, y, 8, 0xff8080, 0.35).setDepth(13);
  scene.tweens.add({ targets: ring2, radius: 46, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => ring2.destroy() });
  for (let i = 0; i < 18; i++) {
    const ang = (Math.PI * 2 * i) / 18;
    const p = scene.add.rectangle(x, y, 3, 8, 0xff6060, 1).setDepth(14).setAngle(Phaser.Math.RadToDeg(ang));
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(ang) * (40 + Math.random() * 24),
      y: y + Math.sin(ang) * (40 + Math.random() * 24) - 10,
      alpha: 0,
      duration: 380 + Math.random() * 140,
      ease: 'Cubic.easeOut',
      onComplete: () => p.destroy(),
    });
  }
}

/** Dig In: a brief earth-stamp on cast. The lingering aura is drawn in WorldScene while the buff is live. */
export function digStamp(scene: SC, x: number, groundY: number): void {
  const ring = scene.add.ellipse(x, groundY - 2, 10, 6, 0xc4a06a, 0).setStrokeStyle(3, 0xc4a06a, 0.9).setDepth(12);
  scene.tweens.add({ targets: ring, width: 70, height: 16, alpha: 0, duration: 280, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  for (let i = 0; i < 8; i++) {
    const c = scene.add.rectangle(x, groundY - 2, 3, 3, 0x8a6a40, 1).setDepth(13);
    const dir = (Math.random() - 0.5) * 50;
    scene.tweens.add({ targets: c, x: x + dir, y: groundY - 8 - Math.random() * 16, alpha: 0, duration: 260, onComplete: () => c.destroy() });
  }
}
