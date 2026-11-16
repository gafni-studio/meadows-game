/**
 * v0.3.1: Mara's slap in Welcome to Meadow Town. The HP loss itself happens in Quests (so it works in Node
 * tests); this is only the look: a hand swipe from Mara's side, a red flash, the number and a small knockback.
 */
import { Game } from '../../systems/GameState';
import type { WorldScene } from '../WorldScene';

export function maraSlap(scene: WorldScene, dmg: number): void {
  const pl = scene.player;
  if (!pl) return;
  const mara = scene.npcs.find((n) => n.id === 'mara');
  const from = mara ? Math.sign(pl.x - mara.x) || 1 : -1; // the side the hand comes from
  const y = pl.y - 34;
  const hand = scene.add.ellipse(pl.x - from * 30, y, 14, 10, 0xf2c8a0).setStrokeStyle(2, 0x3e2731).setDepth(12);
  scene.tweens.add({ targets: hand, x: pl.x - from * 4, duration: 90, ease: 'Quad.easeIn', onComplete: () => {
    scene.tweens.add({ targets: hand, alpha: 0, x: hand.x + from * 10, duration: 160, onComplete: () => hand.destroy() });
  } });
  scene.time.delayedCall(90, () => {
    pl.setTintFill(0xff4040);
    scene.time.delayedCall(110, () => pl.clearTint());
    scene.floatText(pl.x, pl.y - 60, `-${dmg}`, '#ff6b6b', 16);
    scene.knockUntil = Game.now + 200;
    (pl.body as Phaser.Physics.Arcade.Body).setVelocity(from * 150, -140);
    scene.cameras.main.shake(90, 0.004);
  });
}
