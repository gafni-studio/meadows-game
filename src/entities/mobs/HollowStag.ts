/**
 * v0.3.0 the Hollow Stag (Whisperwood miniboss, level 10, blue tier). Its own AI instead of Monster's:
 *  - Charge: head down and paws the ground (dust), then rushes across the clearing. Sidestep or jump it.
 *  - Antler sweep: sways back, then a wide arc in front.
 *  - Root stomp: rears tall, stomps; a line of root spikes erupts along the ground both ways. Jump it or be on a ledge.
 *  - At 50% HP the hollow glows brighter and the mist thickens: stomps come more often, a charge chains into a
 *    sweep, speed rises a little.
 * It never leaves the Hollow (opts.arena): a player who walks out is let go and it heals on the way back.
 * Damage goes through strikePlayer (the scene's normal hit roll, defense, Rage, Mana Shield).
 * Frames: 0 idle, 1 step, 2 head down (charge), 3 rearing (stomp), 4 swayed back (sweep).
 */
import Phaser from 'phaser';
import { TILE } from '../../data/assumptions';
import { Monster, Target, Attack } from '../Monster';
import { burst } from './looks';
import { Game } from '../../systems/GameState';

type Move = 'walk' | 'charge_wind' | 'charge' | 'sweep_wind' | 'sweep' | 'stomp_wind' | 'stomp' | 'rest';

export const STAG = {
  walkMul: 1, phase2SpeedMul: 1.12,
  chargeWindMs: 900, chargeSpeed: 330, chargeMaxMs: 1500, chargeMult: 1.25,
  sweepWindMs: 650, sweepWindMs2: 520, sweepReach: 118, sweepMult: 1.0,
  stompWindMs: 820, stompMult: 0.85, spikeStep: 30, spikeGapMs: 45, spikeReach: 300,
  stompEveryMs: [9000, 5200] as [number, number], chargeEveryMs: 6500,
  restMs: [700, 1100] as [number, number],
};

interface Spike { x: number; at: number; done: boolean }

export class HollowStag extends Monster {
  private move: Move = 'walk';
  private moveUntil = 0;
  private nextStompAt = 0;
  private nextChargeAt = 0;
  private chargeDir = 1;
  private chargeHit = false;
  private spikes: Spike[] = [];
  private phase2 = false;
  private heart: Phaser.GameObjects.Arc;
  private nextMistAt = 0;
  private aggro = false;

  constructor(...args: ConstructorParameters<typeof Monster>) {
    super(...args);
    this.heart = this.scene.add.circle(this.x, this.y, 12, 0x8aff9a, 0.4).setDepth(8.6).setBlendMode(Phaser.BlendModes.ADD);
  }

  private get lo() { return (this.opts.arena?.[0] ?? 0) * TILE + this.halfW; }
  private get hi() { return (this.opts.arena?.[1] ?? 9999) * TILE - this.halfW; }
  private inArena(x: number) { return x >= this.lo - this.halfW - TILE && x <= this.hi + this.halfW + TILE; }

  private go(move: Move, ms: number) {
    this.move = move;
    this.moveUntil = this.scene.time.now + ms;
    this.restoreTint();
    const frame = { walk: 0, charge_wind: 2, charge: 2, sweep_wind: 4, sweep: 0, stomp_wind: 3, stomp: 0, rest: 0 }[move];
    if (this.texture.frameTotal > 5) this.setFrame(frame);
    this.alert.setVisible(move.endsWith('_wind'));
  }

  /** Heavy: no knockback and no hitstun; it only flashes. Wakes up and turns phase 2 at half HP. */
  hurt(dmg: number): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.aggro = true;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => { if (this.alive) this.restoreTint(); });
    if (this.hp <= 0) { this.die(); return true; }
    if (!this.phase2 && this.hp <= this.def.hp / 2) this.enterPhase2();
    return false;
  }

  private enterPhase2() {
    this.phase2 = true;
    this.speed *= STAG.phase2SpeedMul;
    this.scene.cameras.main.flash(300, 160, 255, 170, false);
    this.scene.tweens.add({ targets: this.heart, radius: 20, duration: 400 });
    Game.events.emit('stag-phase', 2);
    burst(this.scene, this.x, this.y - this.displayHeight * 0.5, 20, 0x9aff9a, { size: 3, spread: 80, ms: 900, add: true });
  }

  private shake(intensity = 0.006, ms = 220) {
    this.scene.cameras.main.shake(ms, intensity);
  }

  private dust(x: number, n = 10) {
    burst(this.scene, x, this.y - 4, n, 0xb8a888, { size: 3.5, spread: 50, up: 14, ms: 600 });
  }

  tick(now: number, t: Target): Attack {
    if (!this.alive) { this.heart.setVisible(false); return null; }
    const body = this.body2;
    const dx = t.x - this.x;
    const toward = Math.sign(dx) || 1;
    const onGround = (y: number) => Math.abs(y - this.y) < 14;
    const playerIn = t.targetable && this.inArena(t.x) && Math.abs(t.y - this.y) < 220;

    // presence: moss-light breathing in the ribs, mist curling off the back
    const breathe = 0.5 + 0.5 * Math.sin(now / (this.phase2 ? 260 : 480));
    this.heart.setVisible(true).setPosition(this.x + (this.flipX ? 6 : -6), this.y - this.displayHeight * 0.52)
      .setAlpha((this.phase2 ? 0.55 : 0.3) + breathe * 0.3);
    if (now >= this.nextMistAt) {
      this.nextMistAt = now + (this.phase2 ? 120 : 260);
      burst(this.scene, this.x + (Math.random() - 0.5) * this.displayWidth * 0.5, this.y - this.displayHeight * 0.8, 1, 0xdfeee6, { size: 5, spread: 16, up: 26, ms: 1300, depth: 9 });
    }

    // root spikes erupting outward
    for (const s of this.spikes) {
      if (s.done || now < s.at) continue;
      s.done = true;
      this.spike(s.x);
      if (t.targetable && Math.abs(t.x - s.x) < 20 && onGround(t.y)) this.strikePlayer?.(STAG.stompMult, s.x);
    }
    this.spikes = this.spikes.filter((s) => !s.done);

    // leave a player who walked out; heal while walking home
    if (!playerIn) {
      this.aggro = false;
      if (this.move !== 'walk') this.go('walk', 0);
      const home = (this.lo + this.hi) / 2;
      body.setVelocityX(Math.abs(home - this.x) > 10 ? Math.sign(home - this.x) * this.speed : 0);
      if (this.hp < this.def.hp && Math.abs(home - this.x) <= 10) { this.hp = this.def.hp; if (this.phase2) { this.phase2 = false; this.speed /= STAG.phase2SpeedMul; this.heart.setRadius(12); } }
      this.state = 'idle';
      this.face(body.velocity.x);
      this.animateWalk(now);
      this.clampArena();
      this.drawUi();
      return null;
    }
    if (!this.aggro && t.targetable) this.aggro = true;
    this.state = 'approach';

    switch (this.move) {
      case 'walk': {
        this.face(dx);
        const gap = Math.abs(dx) - t.halfW - this.halfW;
        body.setVelocityX(gap > 30 ? toward * this.speed : 0);
        this.animateWalk(now);
        if (!this.nextStompAt) { this.nextStompAt = now + 4000; this.nextChargeAt = now + 2500; }
        if (now >= this.nextStompAt && Math.abs(dx) < 260) { this.startStomp(now); break; }
        if (gap < STAG.sweepReach - 40) { this.go('sweep_wind', this.phase2 ? STAG.sweepWindMs2 : STAG.sweepWindMs); this.swayBack(); body.setVelocityX(0); break; }
        if (now >= this.nextChargeAt && Math.abs(dx) > 150) {
          this.chargeDir = toward;
          this.go('charge_wind', STAG.chargeWindMs);
          body.setVelocityX(0);
          this.setTint(0xffb0a0);
        }
        break;
      }
      case 'charge_wind':
        body.setVelocityX(0);
        if (Math.floor(now / 180) % 2 === 0) this.dust(this.x - this.chargeDir * this.halfW * 0.6, 1); // pawing
        if (now >= this.moveUntil) { this.go('charge', STAG.chargeMaxMs); this.chargeHit = false; this.shake(0.003, 160); }
        break;
      case 'charge': {
        body.setVelocityX(this.chargeDir * STAG.chargeSpeed * (this.phase2 ? 1.08 : 1));
        if (Math.random() < 0.5) this.dust(this.x - this.chargeDir * this.halfW, 1);
        if (!this.chargeHit && t.targetable && Math.abs(dx) < this.halfW + t.halfW && Math.abs(t.y - this.y) < 60) {
          this.chargeHit = true;
          this.strikePlayer?.(STAG.chargeMult, this.x);
          this.shake(0.008, 200);
        }
        const atEdge = (this.chargeDir > 0 && this.x >= this.hi) || (this.chargeDir < 0 && this.x <= this.lo);
        if (atEdge || now >= this.moveUntil) {
          body.setVelocityX(0);
          this.shake(0.007, 220);
          this.dust(this.x + this.chargeDir * this.halfW, 14);
          this.nextChargeAt = now + STAG.chargeEveryMs;
          if (this.phase2) { this.face(dx); this.go('sweep_wind', 380); this.swayBack(); } else this.go('rest', rand(STAG.restMs));
        }
        break;
      }
      case 'sweep_wind':
        body.setVelocityX(0);
        if (now >= this.moveUntil) { this.go('sweep', 260); this.doSweep(t); }
        break;
      case 'stomp_wind':
        body.setVelocityX(0);
        if (now >= this.moveUntil) { this.go('stomp', 380); this.doStomp(now); }
        break;
      case 'sweep':
      case 'stomp':
      case 'rest':
        body.setVelocityX(0);
        if (now >= this.moveUntil) this.go(this.move === 'rest' ? 'walk' : 'rest', this.move === 'rest' ? 0 : rand(STAG.restMs) * (this.phase2 ? 0.7 : 1));
        break;
    }
    this.clampArena();
    this.drawUi();
    return null;
  }

  private startStomp(now: number) {
    this.go('stomp_wind', STAG.stompWindMs * (this.phase2 ? 0.85 : 1));
    this.body2.setVelocityX(0);
    this.nextStompAt = now + STAG.stompEveryMs[this.phase2 ? 1 : 0];
    // rears tall
    this.scene.tweens.add({ targets: this, scaleY: this.baseSY * 1.12, scaleX: this.baseSX * 0.94, duration: STAG.stompWindMs * 0.8, ease: 'Quad.easeOut' });
  }

  private swayBack() {
    this.scene.tweens.add({ targets: this, angle: this.flipX ? 9 : -9, duration: 400, ease: 'Quad.easeOut' });
  }

  private doSweep(t: Target) {
    this.setAngle(0);
    const fx = this.flipX ? -1 : 1;
    const arc = this.scene.add.graphics().setDepth(12);
    arc.lineStyle(10, 0xe8f0d0, 0.75).beginPath();
    arc.arc(this.x + fx * 10, this.y - this.displayHeight * 0.55, STAG.sweepReach * 0.85, fx > 0 ? -1.4 : Math.PI - 0.6, fx > 0 ? 0.6 : Math.PI + 1.4, false).strokePath();
    this.scene.tweens.add({ targets: arc, alpha: 0, duration: 260, onComplete: () => arc.destroy() });
    const dx = (t.x - this.x) * fx;
    if (t.targetable && dx > -30 && dx < STAG.sweepReach + t.halfW + this.halfW * 0.5 && Math.abs(t.y - this.y) < 90) this.strikePlayer?.(STAG.sweepMult, this.x);
    this.shake(0.004, 140);
  }

  private doStomp(now: number) {
    this.setScale(this.baseSX, this.baseSY);
    this.shake(0.012, 320);
    this.dust(this.x, 20);
    // shockwave ring
    const ring = this.scene.add.ellipse(this.x, this.y - 4, 30, 10).setStrokeStyle(4, 0xd8e8c0, 0.9).setDepth(12);
    this.scene.tweens.add({ targets: ring, scaleX: 9, scaleY: 3, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
    for (let d = STAG.spikeStep; d <= STAG.spikeReach; d += STAG.spikeStep) {
      const k = d / STAG.spikeStep;
      for (const dir of [-1, 1]) {
        const x = this.x + dir * (this.halfW * 0.5 + d);
        if (x < this.lo - this.halfW || x > this.hi + this.halfW) continue;
        this.spikes.push({ x, at: now + k * STAG.spikeGapMs, done: false });
      }
    }
  }

  /** One root spike out of the ground: up, hold, down. */
  private spike(x: number) {
    const sc = this.scene;
    const g = sc.add.graphics().setDepth(9.5);
    g.fillStyle(0x5a3a1e, 1).fillTriangle(-7, 0, 7, 0, 0, -34);
    g.fillStyle(0x86b04a, 1).fillTriangle(-3, -16, 2, -16, -1, -30);
    g.setPosition(x, this.y + 30);
    sc.tweens.add({ targets: g, y: this.y + 2, duration: 90, ease: 'Back.easeOut', hold: 260, yoyo: true, onComplete: () => g.destroy() });
    burst(sc, x, this.y - 2, 3, 0x7a5a3a, { size: 2.5, spread: 18, up: 10, ms: 400 });
  }

  private face(vx: number) { if (Math.abs(vx) > 1) this.setFlipX(vx < 0); }

  private animateWalk(now: number) {
    const moving = Math.abs(this.body2.velocity.x) > 5;
    if (this.texture.frameTotal > 5 && (this.move === 'walk')) this.setFrame(moving ? Math.floor(now / 380) % 2 : 0);
    // slow, heavy steps
    if (moving && Math.floor(now / 380) !== Math.floor((now - 17) / 380) && Math.floor(now / 380) % 2 === 0) this.dust(this.x, 2);
  }

  private clampArena() {
    if (!this.opts.arena) return;
    if (this.x < this.lo) { this.x = this.lo; this.body2.setVelocityX(Math.max(0, this.body2.velocity.x)); }
    if (this.x > this.hi) { this.x = this.hi; this.body2.setVelocityX(Math.min(0, this.body2.velocity.x)); }
  }

  /** Kneels, then dissolves into mist and fireflies as the clearing brightens. */
  die() {
    this.spikes = [];
    this.heart.setVisible(false);
    super.die();
    this.alert.setVisible(false);
    this.scene.tweens.killTweensOf(this);
    this.setAlpha(1).setVisible(true);
    stagDeath(this);
  }

  respawn() {
    super.respawn();
    this.phase2 = false;
    this.speed = Math.abs(this.speed);
    this.heart.setRadius(12).setVisible(true);
    this.go('walk', 0);
    this.nextStompAt = 0;
  }

  destroy(fromScene?: boolean) {
    this.heart?.destroy();
    super.destroy(fromScene);
  }
}

const rand = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);

/** The stag's death (called from Looks.death). */
export function stagDeath(m: Monster): void {
  const sc = m.scene;
  m.setFrame(0);
  sc.tweens.add({
    targets: m, angle: m.flipX ? -12 : 12, scaleY: m.baseSY * 0.78, y: m.y + 6, duration: 700, ease: 'Quad.easeIn',
    onComplete: () => {
      sc.cameras.main.flash(900, 220, 255, 220, false);
      Game.events.emit('stag-phase', 0);
      for (let i = 0; i < 4; i++) sc.time.delayedCall(i * 160, () => burst(sc, m.x, m.y - m.displayHeight * 0.5, 10, 0xe8f4ee, { size: 6, spread: 70, up: 40, ms: 1500 }));
      burst(sc, m.x, m.y - m.displayHeight * 0.5, 24, 0xf8f088, { size: 2.2, spread: 140, up: 60, ms: 2200, add: true });
      sc.tweens.add({ targets: m, alpha: 0, duration: 1200, onComplete: () => m.setVisible(false) });
    },
  });
}
