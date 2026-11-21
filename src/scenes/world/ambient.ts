/**
 * v0.3.0 area ambience (spec section 5), purely visual:
 *  - Whisperwood: layered fog in parallax, shafts of light, drifting fireflies, ripples in the bog pools.
 *    The Hollow Stag's phase 2 thickens the mist; its death lifts it.
 *  - Meadow East: wind in the hill grass.  Dirt Banks West: water moving along the river.
 *  - Dirt Banks East: drips and glints in the cave, torchlit glow near Bank-Cracker's den.
 */
import Phaser from 'phaser';
import { TILE } from '../../data/assumptions';
import { Game } from '../../systems/GameState';
import { groundAt } from '../../world/surface';
import type { WorldScene } from '../WorldScene';

export function buildAmbient(scene: WorldScene): void {
  switch (scene.geo.ambient) {
    case 'forest': forest(scene); break;
    case 'hills': if (!scene.geo.kit) hills(scene); break; // the kit scene has its own painted grass
    case 'river': river(scene); break;
    case 'cave': cave(scene); break;
  }
}

const H = (scene: WorldScene) => scene.physics.world.bounds.height;
const W = (scene: WorldScene) => scene.physics.world.bounds.width;

function forest(scene: WorldScene): void {
  const w = W(scene), h = H(scene);
  // Light shafts through the canopy (behind the mobs, additive, slowly breathing).
  const shafts = scene.add.graphics().setDepth(0.5).setBlendMode(Phaser.BlendModes.ADD);
  for (let x = 140; x < w; x += 260 + ((x * 7) % 120)) {
    shafts.fillStyle(0xfff4c8, 0.07);
    shafts.fillPoints([{ x, y: 0 }, { x: x + 70, y: 0 }, { x: x + 170, y: h }, { x: x + 60, y: h }], true);
  }
  scene.tweens.add({ targets: shafts, alpha: 0.55, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // Fog: three layers at different parallax depths, drifting.
  const layers: Phaser.GameObjects.Graphics[] = [];
  [[0.3, 0.1, 0.5], [0.6, 0.08, 2.2], [1.15, 0.07, 14]].forEach(([sf, a, depth], i) => {
    const g = scene.add.graphics().setScrollFactor(sf, 1).setDepth(depth).setAlpha(1);
    for (let k = 0; k < (w * sf) / 180 + 8; k++) {
      const fx = k * 180 + (i * 70), fy = h - 60 - ((k * 53 + i * 97) % (h * 0.8));
      g.fillStyle(0xe4efe8, a).fillEllipse(fx, fy, 260 + (k % 3) * 60, 46 + (k % 2) * 18);
    }
    scene.tweens.add({ targets: g, x: 120 + i * 40, duration: 14000 + i * 5000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    layers.push(g);
  });
  const onPhase = (p: number) => {
    // phase 2 thickens the mist; the death lifts it
    for (const g of layers) scene.tweens.add({ targets: g, alpha: p === 2 ? 1.9 : p === 0 ? 0.35 : 1, duration: 1200 });
    if (p === 0) scene.time.delayedCall(6000, () => layers.forEach((g) => scene.tweens.add({ targets: g, alpha: 1, duration: 3000 })));
  };
  Game.events.on('stag-phase', onPhase);
  scene.events.once('shutdown', () => Game.events.off('stag-phase', onPhase));

  // Fireflies.
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * w, y = h - 90 - Math.random() * (h - 160);
    const f = scene.add.circle(x, y, 1.8, 0xf6ffa0, 0.9).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: f, x: x + (Math.random() - 0.5) * 120, y: y + (Math.random() - 0.5) * 60, duration: 4000 + Math.random() * 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: f, alpha: 0.1, duration: 600 + Math.random() * 900, yoyo: true, repeat: -1, delay: Math.random() * 1000 });
  }

  // Bog ripples.
  for (const b of scene.waterBands.filter((x) => x.bog)) {
    scene.time.addEvent({
      delay: 420, loop: true, callback: () => {
        const x = b.x + Math.random() * b.w;
        const r = scene.add.ellipse(x, b.y + 6, 8, 3).setStrokeStyle(1.5, 0x9ac088, 0.8).setDepth(9.1);
        scene.tweens.add({ targets: r, scaleX: 5, scaleY: 3, alpha: 0, duration: 1400, onComplete: () => r.destroy() });
      },
    });
  }
}

/** Grass tufts along the ground and hill tops that lean with gusts of wind. */
function hills(scene: WorldScene): void {
  const gy = scene.groundY + 4;
  const tufts: { x: number; y: number; h: number }[] = [];
  for (let x = 8; x < W(scene); x += 22 + ((x * 13) % 17)) tufts.push({ x, y: gy - groundAt(scene.geo, x / TILE) * TILE, h: 7 + ((x * 7) % 6) });
  for (const p of scene.geo.platforms) for (let x = p.x * TILE + 10; x < (p.x + p.w) * TILE - 6; x += 26) tufts.push({ x, y: gy - p.y * TILE - 4, h: 6 + ((x * 5) % 5) });
  const g = scene.add.graphics().setDepth(3);
  const draw = () => {
    const t = scene.time.now / 1000;
    g.clear();
    for (const k of tufts) {
      const gust = Math.sin(t * 1.3 + k.x * 0.004) * 0.5 + Math.sin(t * 3.1 + k.x * 0.02) * 0.2;
      const lean = gust * k.h * 0.9;
      g.lineStyle(2, 0x4f9a3f, 1).lineBetween(k.x, k.y, k.x + lean, k.y - k.h);
      g.lineStyle(2, 0x6fbf55, 1).lineBetween(k.x + 4, k.y, k.x + 4 + lean * 1.2, k.y - k.h * 0.8);
    }
  };
  draw();
  scene.time.addEvent({ delay: 70, loop: true, callback: draw });
}

/** Light glints sliding along the river surface. */
function river(scene: WorldScene): void {
  for (const b of scene.waterBands.filter((x) => !x.bog)) {
    scene.time.addEvent({
      delay: 180, loop: true, callback: () => {
        const x = b.x + Math.random() * b.w;
        const line = scene.add.rectangle(x, b.y + 4 + Math.random() * 12, 10 + Math.random() * 14, 2, 0xe8f6ff, 0.8).setDepth(9.1);
        scene.tweens.add({ targets: line, x: x + 40, alpha: 0, duration: 1300, onComplete: () => line.destroy() });
      },
    });
  }
}

function cave(scene: WorldScene): void {
  const w = W(scene);
  const top = 0; // the cave ceiling is the top of the world
  // ceiling: dark rock teeth along the top of the cave
  const ceil = scene.add.graphics().setDepth(1.5);
  ceil.fillStyle(0x1c1620, 1).fillRect(0, 0, w, top + 20);
  for (let x = 0; x < w; x += 34) ceil.fillTriangle(x, top + 18, x + 34, top + 18, x + 17, top + 40 + ((x * 7) % 26));
  // drips
  scene.time.addEvent({
    delay: 380, loop: true, callback: () => {
      const x = Math.random() * w;
      const yTop = top + 40;
      const floor = scene.groundY + 4 - groundAt(scene.geo, x / TILE) * TILE;
      const d = scene.add.rectangle(x, yTop, 2, 5, 0x9ad0f0, 0.9).setDepth(9);
      scene.tweens.add({
        targets: d, y: floor - 2, duration: Math.sqrt((floor - yTop) / 650) * 1000, ease: 'Quad.easeIn',
        onComplete: () => {
          d.destroy();
          for (const s of [-1, 1]) {
            const p = scene.add.circle(x, floor - 3, 1.5, 0x9ad0f0, 0.9).setDepth(9);
            scene.tweens.add({ targets: p, x: x + s * 8, y: floor - 9, alpha: 0, duration: 260, onComplete: () => p.destroy() });
          }
        },
      });
    },
  });
  // glints in the walls
  for (let i = 0; i < 30; i++) {
    const s = scene.add.star(Math.random() * w, top + 60 + Math.random() * (scene.groundY - top - 80), 4, 1, 3, 0xfff0b0, 0.8).setDepth(0.6);
    s.setAlpha(0);
    scene.tweens.add({ targets: s, alpha: 0.9, duration: 500, yoyo: true, repeat: -1, delay: Math.random() * 4000, repeatDelay: 1500 + Math.random() * 3000 });
  }
  // torchlight near the den (the pit) and at the gallery ropes
  const pit = scene.geo.blocks?.length ? [60, 80] : [0, 0];
  const torches = [pit[0] * TILE - 20, pit[1] * TILE + 20, (pit[0] + pit[1]) * TILE / 2];
  torches.forEach((x, i) => {
    const y = i < 2 ? scene.groundY + 4 - 4 * TILE : scene.groundY + 4;
    const glow = scene.add.circle(x, y - 40, 46, 0xffa040, 0.1).setDepth(0.7).setBlendMode(Phaser.BlendModes.ADD);
    const flame = scene.add.circle(x, y - 40, 5, 0xffd070, 1).setDepth(3);
    scene.add.rectangle(x, y - 22, 4, 32, 0x5a3a20).setOrigin(0.5, 0.5).setDepth(2.9);
    scene.tweens.add({ targets: glow, alpha: 0.16, scale: 1.08, duration: 160, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: flame, scale: 1.3, duration: 120, yoyo: true, repeat: -1 });
  });
}
