import Phaser from 'phaser';
import { MonsterDef } from '../data/db';
import { ASSUME, TILE, MONSTER_FEEL, AI, RANGED } from '../data/assumptions';
import { monsterSlot, SPRITES } from '../art/sprites';
import { fitSlot, applyBody } from '../art/SpriteFactory';

/**
 * Monster AI states:
 *  idle → (aggro or hit) → approach → windup (telegraph) → strike → recover
 *       → reposition (back off | hop over to the other side | short pause) → approach …
 *  hitstun interrupts anything; return = leash home (HP reset).
 * Melee (monsters.attack_type = melee): walks to body contact; a swing only lands if still touching.
 *   Random wind-up length, random recover, occasional feints (telegraph → back off without striking).
 * Ranged (attack_type = ranged): keeps RANGED.keepPx distance, telegraphs, then throws a slow projectile.
 */
export type Attack = 'swing' | 'shoot' | null;
type State = 'idle' | 'approach' | 'windup' | 'recover' | 'backoff' | 'hop' | 'pause' | 'hitstun' | 'return' | 'dead';

const rand = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);

export interface Target { x: number; y: number; halfW: number; targetable: boolean }

export class Monster extends Phaser.Physics.Arcade.Sprite {
  def: MonsterDef;
  feel: (typeof MONSTER_FEEL)[string];
  hp: number;
  spawnX: number;
  state: State = 'idle';
  private until = 0; // state timer
  private dir = 1; // reposition direction
  private wanderTarget: number;
  private nextWanderAt = 0;
  private bar: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private alert: Phaser.GameObjects.Text;
  private speed: number;
  private baseSX = 1;
  private baseSY = 1;
  private animT = 0;
  private slot: string;
  readonly ranged: boolean;
  private nextShotAt = 0;
  private feint = false;

  constructor(scene: Phaser.Scene, def: MonsterDef, x: number, groundY: number) {
    const slot = monsterSlot(def.id);
    super(scene, x, groundY, slot);
    this.slot = slot;
    this.def = def;
    this.feel = MONSTER_FEEL[def.id] ?? MONSTER_FEEL.default;
    this.hp = def.hp;
    this.spawnX = x;
    this.wanderTarget = x;
    this.speed = ASSUME.monsterSpeed[def.id] ?? ASSUME.monsterSpeed.default;
    this.ranged = def.attack_type === 'ranged';
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    fitSlot(scene, this, slot);
    this.baseSX = this.scaleX;
    this.baseSY = this.scaleY;
    applyBody(this, slot);
    this.y = groundY;
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.bar = scene.add.graphics().setDepth(20);
    const color = def.aggression === 'aggressive' ? '#ffd2d2' : '#ffffff';
    this.label = scene.add
      .text(x, groundY, `Lv${def.level} ${def.name}`, { fontFamily: 'monospace', fontSize: '11px', color, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(20);
    this.alert = scene.add.text(x, groundY, '!', { fontFamily: 'monospace', fontSize: '18px', color: '#ff4040', stroke: '#000', strokeThickness: 4, fontStyle: 'bold' })
      .setOrigin(0.5, 1).setDepth(21).setVisible(false);
  }

  get alive() { return this.state !== 'dead'; }
  /** Visual half-width used for spacing (sprites are wider than their physics bodies). */
  get halfW() { return (SPRITES[this.slot]?.w ?? this.displayWidth) * 0.4; }
  get body2() { return this.body as Phaser.Physics.Arcade.Body; }
  get engaged() { return !['idle', 'return', 'dead'].includes(this.state); }

  private set(state: State, ms = 0) {
    this.state = state;
    this.until = this.scene.time.now + ms;
    this.alert.setVisible(state === 'windup');
    if (state !== 'windup') { this.clearTint(); this.setScale(this.baseSX, this.baseSY); }
  }

  /** Damage + knockback. Returns true if it died. */
  hurt(dmg: number, fromX: number, kb: number, hitstunMs: number): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => { if (this.state !== 'windup') this.clearTint(); });
    if (this.hp <= 0) { this.die(); return true; }
    const push = kb * (1 - this.feel.kbRes);
    if (push > 0 && this.state !== 'return') {
      this.body2.setVelocityX(Math.sign(this.x - fromX || 1) * push);
      if (push > 600) this.body2.setVelocityY(-160);
      this.set('hitstun', hitstunMs * (1 - this.feel.kbRes * 0.5));
    } else if (this.state === 'idle') {
      this.set('approach'); // passive monsters fight back once hit
    }
    return false;
  }

  private die() {
    this.set('dead');
    this.hp = 0;
    this.body2.enable = false;
    this.scene.tweens.add({ targets: this, alpha: 0, y: this.y - 10, duration: 300, onComplete: () => this.setVisible(false) });
    this.bar.clear();
    this.label.setVisible(false);
    this.scene.time.delayedCall(this.def.respawn_s * 1000, () => this.respawn());
  }

  respawn() {
    if (!this.scene) return;
    this.hp = this.def.hp;
    this.set('idle');
    this.x = this.spawnX;
    this.setAlpha(1).setVisible(true);
    this.body2.enable = true;
    this.label.setVisible(true);
  }

  /** Remove permanently (console kill/cleanup of spawned mobs). */
  kill() { if (this.alive) this.die(); }

  private startWindup(ms: number) {
    this.body2.setVelocityX(0);
    this.set('windup', ms);
    this.setTint(0xff7070);
    this.scene.tweens.add({ targets: this, scaleY: this.baseSY * 0.85, scaleX: this.baseSX * 1.1, duration: ms * 0.8 });
  }

  /** AI tick. Returns 'swing' on the frame a melee swing lands, 'shoot' when a projectile is released. */
  tick(now: number, t: Target): Attack {
    if (!this.alive) return null;
    const body = this.body2;
    const dx = t.x - this.x;
    const dy = Math.abs(t.y - this.y);
    const gap = Math.abs(dx) - t.halfW - this.halfW; // edge-to-edge distance
    const toward = Math.sign(dx) || 1;
    const aggroPx = ASSUME.aggroTiles * TILE;
    const leashPx = ASSUME.leashTiles * TILE;
    let swing: Attack = null;

    if (this.state === 'idle' && this.def.aggression === 'aggressive' && t.targetable && Math.abs(dx) < aggroPx && dy < 140) this.set('approach');
    if (this.engaged && (!t.targetable || Math.abs(this.x - this.spawnX) > leashPx)) this.set('return');

    switch (this.state) {
      case 'idle': {
        if (now >= this.nextWanderAt) {
          this.nextWanderAt = now + 1500 + Math.random() * 2500;
          this.wanderTarget = Math.random() < 0.35 ? this.x : this.spawnX + (Math.random() * 2 - 1) * 4 * TILE;
        }
        const w = this.wanderTarget - this.x;
        body.setVelocityX(Math.abs(w) > 6 ? Math.sign(w) * this.speed * 0.6 : 0);
        break;
      }
      case 'approach':
        if (now < this.until) { body.setVelocityX(0); break; } // brief random hesitation
        if (this.ranged) {
          const d = Math.abs(dx);
          if (d < RANGED.keepPx[0]) body.setVelocityX(-toward * this.speed * AI.chaseSpeedMul); // too close: retreat
          else if (d > RANGED.keepPx[1]) body.setVelocityX(toward * this.speed * AI.chaseSpeedMul);
          else body.setVelocityX(0);
          if (d <= RANGED.fireRangePx && dy < 80 && now >= this.nextShotAt) { this.feint = false; this.startWindup(rand(this.feel.windupMs)); }
        } else if (gap <= this.feel.range && dy < 60) {
          this.feint = Math.random() < AI.feintChance;
          this.startWindup(rand(this.feel.windupMs));
        } else {
          body.setVelocityX(gap < AI.minGapPx ? -toward * this.speed : toward * this.speed * AI.chaseSpeedMul);
        }
        break;
      case 'windup':
        body.setVelocityX(!this.ranged && gap < AI.minGapPx ? -toward * this.speed * 0.5 : 0);
        if (now >= this.until) {
          if (this.ranged) {
            swing = 'shoot';
            this.nextShotAt = now + rand(RANGED.cooldownMs);
            this.set('recover', rand(AI.recoverMs));
          } else if (this.feint) {
            // Feint: telegraphed but no strike — hop back instead.
            body.setVelocity(-toward * 120, -160);
            this.dir = -toward;
            this.set('backoff', rand(AI.repositionMs) * 0.6);
          } else {
            // Strike: small lunge; damage only if still touching the player.
            swing = gap <= this.feel.range + 6 && dy < 50 ? 'swing' : null;
            body.setVelocityX(toward * 90);
            this.set('recover', rand(AI.recoverMs));
          }
        }
        break;
      case 'recover':
        if (now >= this.until) {
          const r = Math.random();
          if (this.ranged) this.set('pause', rand(AI.idlePauseMs));
          else if (r < AI.backOffChance) {
            this.dir = -toward;
            this.set('backoff', rand(AI.repositionMs));
          } else if (r < AI.backOffChance + AI.circleChance && body.blocked.down) {
            this.dir = toward; // hop over the player to the other side
            body.setVelocity(toward * (Math.abs(dx) + t.halfW * 2 + 40) * 1.6, -AI.hopVelocity);
            this.set('hop', 250);
          } else {
            this.set('pause', rand(AI.idlePauseMs));
          }
        } else body.setVelocityX(body.velocity.x * 0.85);
        break;
      case 'backoff':
        body.setVelocityX(this.dir * this.speed * AI.backOffSpeedMul);
        if (now >= this.until) this.set('pause', rand(AI.idlePauseMs));
        break;
      case 'hop':
        if (now >= this.until && body.blocked.down) this.set('pause', rand(AI.idlePauseMs));
        break;
      case 'pause':
        body.setVelocityX(gap < AI.minGapPx ? -toward * this.speed : 0);
        if (now >= this.until) this.set('approach', rand(AI.approachDelayMs));
        break;
      case 'hitstun':
        body.setVelocityX(body.velocity.x * 0.9);
        if (now >= this.until) this.set(Math.random() < 0.5 ? 'pause' : 'approach', rand(AI.idlePauseMs) * 0.5);
        break;
      case 'return': {
        const back = this.spawnX - this.x;
        body.setVelocityX(Math.sign(back) * this.speed * 2.2);
        if (Math.abs(back) < 8) { this.set('idle'); this.hp = this.def.hp; body.setVelocityX(0); } // leash reset
        break;
      }
    }

    // Facing: engaged monsters face the player (except while backing off); art faces right.
    if (this.state === 'backoff' && !this.ranged) this.setFlipX(this.dir < 0);
    else if (this.engaged && this.state !== 'hop') this.setFlipX(dx < 0);
    else if (Math.abs(body.velocity.x) > 1) this.setFlipX(body.velocity.x < 0);

    // Tiny walk animation: crow flaps (2 frames), others wobble.
    const moving = Math.abs(body.velocity.x) > 5;
    this.animT += moving ? 1 : 0;
    if (this.texture.frameTotal > 2) this.setFrame(Math.floor(now / (moving || !body.blocked.down ? 120 : 400)) % 2);
    this.setAngle(moving && this.state !== 'windup' ? Math.sin(this.animT * 0.35) * 6 : 0);

    this.drawUi();
    return swing;
  }

  private drawUi() {
    const top = this.y - this.displayHeight;
    this.label.setPosition(this.x, top - 11);
    this.alert.setPosition(this.x, top - 25);
    this.bar.clear();
    if (this.hp < this.def.hp) {
      const w = Math.max(30, this.displayWidth * 0.8);
      this.bar.fillStyle(0x000000, 0.7).fillRect(this.x - w / 2, top - 9, w, 5);
      this.bar.fillStyle(0xe04040, 1).fillRect(this.x - w / 2 + 1, top - 8, (w - 2) * (this.hp / this.def.hp), 3);
    }
  }

  destroy(fromScene?: boolean) {
    this.bar?.destroy();
    this.label?.destroy();
    this.alert?.destroy();
    super.destroy(fromScene);
  }
}
