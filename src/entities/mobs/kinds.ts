/**
 * v0.3.0 movement kinds layered on top of Monster's AI (assumptions.MOB_KIND):
 * ledge-bound patrol, hovering (Wisp), hopping (Mire Toad, Thornling), ambush (Moss Lurker),
 * Wren's camp, and the half-tile step-up for walkers on slopes.
 */
import { TILE } from '../../data/assumptions';
import { stepUpTo } from '../../world/surface';
import type { Monster, Target } from '../Monster';
import * as Looks from './looks';

const rand = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);

/** x (px) inside Wren's camp: no mob aggroes or chases into it. */
export function inCamp(m: Monster, x: number): boolean {
  const c = m.opts.camp;
  return !!c && x >= c[0] * TILE && x <= (c[1] + 2) * TILE;
}

/** The ambusher pops up (shakes off its moss) and pauses before it comes at you. */
export function wake(m: Monster): void {
  if (!m.dormant) return;
  m.dormant = false;
  Looks.wake(m);
  if (m.state === 'idle') m.set('pause', 520);
}

/** A sleeping mound: breathe, and wake when the player is close on the same level. True = still asleep. */
export function tickDormant(m: Monster, now: number, dx: number, sameLevel: boolean, canSee: boolean): boolean {
  m.body2.setVelocityX(0);
  Looks.idle(m, now);
  if (canSee && sameLevel && Math.abs(dx) < (m.kind.ambushTiles ?? 3) * TILE) { wake(m); return false; }
  return true;
}

/** After the AI has picked a velocity: apply the mob's own way of moving. */
export function move(m: Monster, now: number, t: Target): void {
  const body = m.body2;
  if (!m.alive) return;

  // An ambusher that went back to idle settles into a mound again.
  if (m.kind.ambushTiles && !m.dormant && m.state === 'idle' && m.dormantAt && now >= m.dormantAt) {
    m.dormant = true;
    m.dormantAt = 0;
    body.setVelocityX(0);
    Looks.sleep(m);
  }

  // Hover and bob; when fighting, drift toward the player's height a little.
  if (m.kind.fly) {
    const bob = Math.sin(now / 520 + m.spawnX) * 9;
    let ty = m.spawnY + bob;
    if (m.engaged) ty = Math.max(m.spawnY - 50, Math.min(m.spawnY + 60, t.y - 46)) + bob;
    body.setVelocityY((ty - m.y) * 2.4);
    return;
  }

  // Ledge-bound mobs never walk off their own level.
  if (m.opts.ledge && body.blocked.down) {
    const [lo, hi] = m.patrolRange();
    if ((m.x <= lo && body.velocity.x < 0) || (m.x >= hi && body.velocity.x > 0)) body.setVelocityX(0);
    // knocked off its ledge: once it calms down it fades back in at its spawn
    if (m.state === 'idle' && Math.abs(m.y - m.spawnY) > 40) {
      m.x = m.spawnX;
      m.y = m.spawnY;
      m.setAlpha(0);
      m.scene.tweens.add({ targets: m, alpha: 1, duration: 400 });
    }
  }

  // Hops instead of walking (the strike lunge and knockback are left alone).
  const hop = m.kind.hop;
  if (hop && ['idle', 'approach', 'backoff', 'pause', 'return'].includes(m.state)) {
    const want = body.velocity.x;
    if (body.blocked.down) {
      if (m.wasAir) Looks.land(m);
      if (Math.abs(want) > 1 && now >= m.nextHopAt) {
        m.hopVx = Math.sign(want) * Math.max(Math.abs(want), m.speed) * hop.vxMul * 0.55;
        body.setVelocity(m.hopVx, -hop.vy);
        m.nextHopAt = now + rand(hop.everyMs);
        Looks.hop(m);
      } else body.setVelocityX(0);
    } else body.setVelocityX(m.hopVx);
  }
  m.wasAir = !body.blocked.down;

  // Walk up half-tile slopes; turn around at a wall while patrolling.
  const terr = m.opts.terrain;
  if (terr && body.blocked.down && Math.abs(body.velocity.x) > 1) {
    const d = Math.sign(body.velocity.x);
    if (d < 0 ? body.blocked.left : body.blocked.right) {
      const top = stepUpTo(terr.geo, terr.groundY, m.x + d * (body.halfWidth + 3), body.bottom);
      if (top != null) m.y = top - 0.5;
      else if (m.state === 'idle') m.wanderTarget = m.x - d * (2 + Math.random() * 6) * TILE;
    }
  }
}
