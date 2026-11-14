import Phaser from 'phaser';
import { consumableEffect } from '../../data/db';
import { ANIM, ASSUME, REGEN } from '../../data/assumptions';
import { AREAS } from '../../world/areas';
import { groundAt, stepUpTo } from '../../world/surface';
import { TILE } from '../../data/assumptions';
import { Game } from '../../systems/GameState';
import * as P from '../../systems/Player';
import * as Fx from '../../systems/CombatFx';
import type { WorldScene } from '../WorldScene';

/** Walk, jump, attack and hotbar keys for one frame (moved out of WorldScene.update). */
export function playerInput(scene: WorldScene, time: number, delta: number, menu: boolean): void {
  const body = scene.player.body as Phaser.Physics.Arcade.Body;
  if (!Game.dead && !menu) {
    const speedMul = scene.buffActive('mint_sprig') ? 1 + (consumableEffect('mint_sprig').buff?.speedPct ?? 0) / 100 : 1;
    let vx = 0;
    if (scene.controls.down('left')) vx -= 1;
    if (scene.controls.down('right')) vx += 1;
    // let a hit's knockback play out briefly before input takes over again
    // v0.3.0: ladders and ropes. While climbing, nothing else moves the Hero.
    if (climb(scene, time, delta, vx)) return;
    if (time >= scene.knockUntil) body.setVelocityX(vx * ASSUME.playerSpeed * speedMul);
    if (vx !== 0) { scene.facing = vx; scene.player.setFlipX(vx < 0); }
    const jump = scene.controls.pressed('jump') || (scene.controls.pressed('up') && !climbAt(scene, 'up'));
    if (jump && body.blocked.down) {
      // down + jump on a one-way ledge drops through it
      if (scene.controls.down('down') && onLedge(scene)) { scene.dropUntil = time + 260; body.setVelocityY(80); }
      else body.setVelocityY(-ASSUME.jumpVelocity);
    }
    if (vx !== 0 && body.blocked.down && (vx < 0 ? body.blocked.left : body.blocked.right)) {
      const top = stepUpTo(scene.geo, scene.groundY + 4, scene.player.x + vx * (body.halfWidth + 3), body.bottom);
      if (top != null) scene.player.y = top - 0.5;
    }

    // v0.2.3: buffer a swing pressed during recovery so the next hit fires as soon as ready.
    if (scene.controls.pressed('attack')) {
      if (!scene.trySwing(1.0, 0, 'basic')) scene.pendingAttack = true;
    } else if (scene.pendingAttack) {
      if (scene.trySwing(1.0, 0, 'basic')) scene.pendingAttack = false;
    } else if (scene.controls.down('attack')) {
      scene.trySwing(1.0, 0, 'basic');
    }
    if (scene.controls.pressed('skill1')) scene.useHotbar(0);
    if (scene.controls.pressed('skill2')) scene.useHotbar(1);
    if (scene.controls.pressed('skill3')) scene.useHotbar(2);
    if (scene.controls.pressed('skill4')) scene.useHotbar(3);
    if (scene.controls.pressed('skill5')) scene.useHotbar(4);
    if (scene.controls.pressed('skill6')) scene.useHotbar(5);
    if (scene.controls.pressed('skill7')) scene.useHotbar(6);
    if (scene.controls.pressed('skill8')) scene.useHotbar(7);
    if (scene.controls.pressed('interact')) scene.interact();
    // Walk wobble: ~35% slower than v0.1.2 (period 95 vs 70) and tied to actual move speed.
    const spd = Math.abs(body.velocity.x);
    if (spd > 8 && body.blocked.down) {
      scene.walkT += delta * (spd / ASSUME.playerSpeed);
      scene.player.setAngle(Math.sin(scene.walkT / ANIM.heroWalkPeriod) * 5);
    } else scene.player.setAngle(0);
  } else {
    scene.controls.clear();
    if (!Game.dead && body.blocked.down) body.setVelocityX(0);
  }
}

/** Out-of-combat HP regen (assumptions.REGEN). */
export function regen(scene: WorldScene, time: number, delta: number): void {
  const p = Game.player;
  const max = P.maxHp(p);
  if ((Game.buffs.soul_guard ?? 0) <= time) Game.shield = 0;
  const active = time - scene.lastCombatAt > REGEN.delayMs && p.hp < max;
  Game.regenActive = active;
  scene.glow.clear();
  // Buff visuals must use wall-clock (Date.now), same as Game.buffs. Using the
  // scene clock here left Dig In's aura on forever after v0.2.1 (Date.now() >> scene time).
  const wall = Date.now();
  if (Game.shield > 0 && (Game.buffs.soul_guard ?? 0) > wall) {
    const a = 0.3 + 0.15 * Math.sin(wall / 160);
    scene.glow.lineStyle(3, 0x9fe0ff, a).strokeEllipse(scene.player.x, scene.player.y - 22, 52, 58);
  }
  if ((Game.buffs.dig_in ?? 0) > wall) {
    const a = 0.35 + 0.2 * Math.sin(wall / 180);
    scene.glow.lineStyle(4, 0xc4a06a, a).strokeEllipse(scene.player.x, scene.player.y - 18, 60, 52);
    scene.glow.fillStyle(0xc4a06a, 0.08 + 0.05 * Math.sin(wall / 180));
    scene.glow.fillEllipse(scene.player.x, scene.player.y - 18, 60, 52);
  }
  if ((Game.buffs.mana_shield ?? 0) > wall) Fx.wardGlow(scene.glow, scene.player.x, scene.player.y - 22, wall);
  if (!active) return;
  const perSec = P.hpRegenPerSec(p);
  p.hp = Math.min(max, p.hp + (perSec * delta) / 1000);
  const a = 0.25 + 0.15 * Math.sin(time / 200);
  scene.glow.fillStyle(0x7dff9b, a).fillEllipse(scene.player.x, scene.player.y - 4, 44, 12);
  if (Math.random() < delta / 250) {
    const t = scene.add.text(scene.player.x + (Math.random() - 0.5) * 30, scene.player.y - 20, '+', { fontFamily: 'monospace', fontSize: '14px', color: '#7dff9b', stroke: '#000', strokeThickness: 3 }).setDepth(12);
    scene.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }
}

export function die(scene: WorldScene): void {
  const p = Game.player;
  p.hp = 0;
  Game.dead = true;
  const lost = P.applyDeathPenalty(p);
  (scene.player.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
  Game.toast(`You were defeated. Lost ${lost} XP. Returning to Meadow Town…`, 'warn');
  Game.events.emit('dead', true);
  Game.changed();
  scene.time.delayedCall(ASSUME.respawnDelayMs, () => {
    Game.dead = false;
    p.hp = P.maxHp(p);
    p.mp = P.maxMp(p);
    Game.buffs = {};
    Game.events.emit('dead', false);
    scene.scene.restart({ area: 'meadow_town', x: AREAS.meadow_town.spawnX });
  });
}

/** v0.3.0 climbing speeds (px/s). */
const CLIMB = { speed: 120, grabPx: 15 };

/** A climb the Hero can grab going up (feet on it) or down (standing on its top). */
function climbAt(scene: WorldScene, dir: 'up' | 'down'): WorldScene['climbs'][number] | undefined {
  const x = scene.player.x;
  const feet = (scene.player.body as Phaser.Physics.Arcade.Body).bottom;
  return scene.climbs.find((c) => Math.abs(c.x - x) < CLIMB.grabPx
    && (dir === 'up' ? feet > c.top + 4 && feet <= c.bottom + 8 : Math.abs(feet - c.top) <= 10));
}

/** Standing on a one-way ledge (not on solid ground). */
function onLedge(scene: WorldScene): boolean {
  const feet = (scene.player.body as Phaser.Physics.Arcade.Body).bottom;
  const solid = scene.groundY + 4 - groundAt(scene.geo, scene.player.x / TILE) * TILE;
  return Math.abs(feet - solid) > 8;
}

function letGo(scene: WorldScene): void {
  const body = scene.player.body as Phaser.Physics.Arcade.Body;
  scene.climbing = null;
  body.setAllowGravity(true);
  scene.player.setAngle(0);
}

/** Grab, climb and leave ladders / ropes / vines. Returns true while the Hero is on one. */
function climb(scene: WorldScene, time: number, delta: number, vx: number): boolean {
  const body = scene.player.body as Phaser.Physics.Arcade.Body;
  const up = scene.controls.down('up'), down = scene.controls.down('down');
  if (!scene.climbing) {
    if (time < scene.knockUntil) return false;
    const c = up ? climbAt(scene, 'up') : down && body.blocked.down && !scene.controls.down('jump') ? climbAt(scene, 'down') : undefined;
    if (!c) return false;
    scene.climbing = c;
    body.setAllowGravity(false);
    body.setVelocity(0, 0);
    scene.player.x = c.x;
    if (!up) scene.player.y += 8; // step down past the ledge lip
    scene.pendingAttack = false;
  }
  const c = scene.climbing;
  if (scene.controls.pressed('jump')) {
    // jump off, sideways if a direction is held
    letGo(scene);
    body.setVelocity(vx * ASSUME.playerSpeed, vx ? -260 : 0);
    if (vx) { scene.facing = vx; scene.player.setFlipX(vx < 0); }
    return false;
  }
  const dy = up ? -1 : down ? 1 : 0;
  body.setVelocity(0, dy * CLIMB.speed);
  scene.player.x = c.x;
  if (dy) { scene.walkT += delta; scene.player.setAngle(Math.sin(scene.walkT / 70) * 6); }
  const feet = body.bottom + (dy * CLIMB.speed * delta) / 1000;
  if (dy < 0 && feet <= c.top) { letGo(scene); scene.player.y = c.top - 1; body.setVelocity(0, 0); return false; }
  if (dy > 0 && feet >= c.bottom) { letGo(scene); return false; }
  return true;
}
