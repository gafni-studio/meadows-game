import Phaser from 'phaser';
import { RANGED } from '../../data/assumptions';
import { fitSlot } from '../../art/SpriteFactory';
import { Game } from '../../systems/GameState';
import type { Monster } from '../../entities/Monster';
import type { WorldScene } from '../WorldScene';

/** Mob projectiles (moved out of WorldScene). Magician bolts still live in WorldScene. */
/** Ranged monsters: a slow, visible pebble aimed at chest height (jump over it or walk away). */
export function fireShot(scene: WorldScene, m: Monster): void {
  const dir = Math.sign(scene.player.x - m.x) || 1;
  const y = m.y - m.displayHeight * 0.55;
  const img = fitSlot(scene, scene.add.image(m.x + dir * m.halfW, y, 'fx.pebble').setDepth(11), 'fx.pebble');
  const ty = scene.player.y - 24; // chest height at release time
  const dist = Math.max(40, Math.abs(scene.player.x - m.x));
  const vy = Phaser.Math.Clamp(((ty - y) / dist) * RANGED.projectileSpeed, -80, 80);
  scene.shots.push({ img, vx: dir * RANGED.projectileSpeed, vy, dieAt: Game.now + RANGED.projectileLifeMs, m });
}

export function updateShots(scene: WorldScene, time: number, delta: number): void {
  scene.shots = scene.shots.filter((s) => {
    s.img.x += (s.vx * delta) / 1000;
    s.img.y += (s.vy * delta) / 1000;
    s.img.angle += delta * 0.6;
    const hit = !Game.dead && Math.abs(s.img.x - scene.player.x) < RANGED.hitRadius + 6 && s.img.y > scene.player.y - 46 && s.img.y < scene.player.y + 2;
    if (hit) scene.monsterSwings(s.m, s.img.x);
    if (hit || time > s.dieAt || s.img.y > scene.groundY + 10) {
      scene.tweens.add({ targets: s.img, alpha: 0, scale: s.img.scale * 1.6, duration: 120, onComplete: () => s.img.destroy() });
      return false;
    }
    return true;
  });
}
