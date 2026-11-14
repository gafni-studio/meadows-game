import Phaser from 'phaser';
import { MonsterDef } from '../data/db';
import { ANIM, ASSUME, TILE, MONSTER_FEEL, AI, RANGED, GIVE_UP_MS, MOB_JUMP, MOB_KIND, MobKind } from '../data/assumptions';
import type { AreaGeometry } from '../world/areas';
import * as Kind from './mobs/kinds';
import * as Looks from './mobs/looks';
import { monsterSlot, SPRITES } from '../art/sprites';
import { fitSlot, applyBody } from '../art/SpriteFactory';

/**
 * Monster AI states:
 *  idle → (aggro or hit) → approach → windup (telegraph) → strike → recover
 *       → reposition (back off | hop over to the other side | short pause) → approach …
 *  hitstun interrupts anything; return = leash home (HP reset).
 * v0.2.6: idle mobs patrol their whole spawn stretch; an aggroed mob that cannot reach the player for
 *   GIVE_UP_MS drops aggro and patrols again; mobs jump onto low ledges the player stands on.
 * Melee (monsters.attack_type = melee): walks to body contact; a swing only lands if still touching.
 *   Random wind-up length, random recover, occasional feints (telegraph → back off without striking).
 * Ranged (attack_type = ranged): keeps RANGED.keepPx distance, telegraphs, then throws a slow projectile.
 */
export type Attack = 'swing' | 'shoot' | null;
type State = 'idle' | 'approach' | 'windup' | 'recover' | 'backoff' | 'hop' | 'pause' | 'hitstun' | 'return' | 'dead';

const rand = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);

export interface Target { x: number; y: number; halfW: number; targetable: boolean }
/** v0.3.0 spawn options: patrol one ledge only, hover (tiles), the stag's arena, Wren's camp, terrain for slopes. */
export interface MobOpts { ledge?: boolean; fly?: number; arena?: [number, number]; camp?: [number, number]; terrain?: { geo: AreaGeometry; groundY: number } }

export class Monster extends Phaser.Physics.Arcade.Sprite {
  def: MonsterDef;
  feel: (typeof MONSTER_FEEL)[string];
  hp: number;
  spawnX: number;
  state: State = 'idle';
  /** Where this mob was when it last went into combat; the leash is measured from here. */
  home: number;
  spawnY: number;
  patrol: [number, number] | null;
  stuckMs = 0;
  lastTickAt = 0;
  nextJumpAt = 0;
  until = 0; // state timer
  dir = 1; // reposition direction
  wanderTarget: number;
  nextWanderAt = 0;
  bar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  alert: Phaser.GameObjects.Text;
  speed: number;
  baseSX = 1;
  baseSY = 1;
  animT = 0;
  slot: string;
  readonly ranged: boolean;
  nextShotAt = 0;
  feint = false;
  namedTint: number | null = null;
  // v0.3.0
  readonly kind: MobKind;
  readonly opts: MobOpts;
  /** Asleep (Moss Lurker ambush): a still mound until the player comes close or hits it. */
  dormant = false;
  dormantAt = 0;
  /** A ranged mob's next strike is a melee scratch (Thornling, cornered). */
  meleeNext = false;
  nextHopAt = 0;
  hopVx = 0;
  wasAir = false;
  /** Hit the player for `mult` of a swing from x (set by the scene; bosses use it for their own moves). */
  strikePlayer?: (mult: number, fromX: number) => void;

  constructor(scene: Phaser.Scene, def: MonsterDef, x: number, groundY: number, patrol?: [number, number], opts: MobOpts = {}) {
    const slot = monsterSlot(def.id);
    super(scene, x, groundY, slot);
    this.slot = slot;
    this.def = def;
    this.feel = MONSTER_FEEL[def.id] ?? MONSTER_FEEL.default;
    this.hp = def.hp;
    this.spawnX = x;
    this.home = x;
    this.patrol = patrol ?? null;
    this.wanderTarget = x;
    this.speed = ASSUME.monsterSpeed[def.id] ?? ASSUME.monsterSpeed.default;
    this.ranged = def.attack_type === 'ranged';
    this.kind = MOB_KIND[def.id] ?? {};
    this.opts = opts;
    if (this.kind.fly) groundY -= (opts.fly ?? 2) * TILE; // hovers over its surface
    this.spawnY = groundY;
    this.dormant = !!this.kind.ambushTiles;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    fitSlot(scene, this, slot);
    this.baseSX = this.scaleX;
    this.baseSY = this.scaleY;
    applyBody(this, slot);
    this.y = groundY;
    const NAMED: Record<string, number> = { wool_shoulder: 0xffe08a, bank_cracker: 0xd0d8e4, cinderback: 0xff7040 };
    if (NAMED[def.id]) {
      this.namedTint = NAMED[def.id];
      const grow = def.id === 'bank_cracker' ? 1.36 : 1.18;
      this.setScale(this.scaleX * grow, this.scaleY * grow);
      this.baseSX = this.scaleX;
      this.baseSY = this.scaleY;
      this.setTint(this.namedTint);
    }
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.bar = scene.add.graphics().setDepth(20);
    const color = NAMED[def.id] ? '#ffe08a' : def.aggression === 'aggressive' ? '#ffd2d2' : '#ffffff';
    this.label = scene.add
      .text(x, groundY, `Lv${def.level} ${def.name}`, { fontFamily: 'monospace', fontSize: '11px', color, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(20);
    this.alert = scene.add.text(x, groundY, '!', { fontFamily: 'monospace', fontSize: '18px', color: '#ff4040', stroke: '#000', strokeThickness: 4, fontStyle: 'bold' })
      .setOrigin(0.5, 1).setDepth(21).setVisible(false);
    if (this.kind.fly) (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    Looks.init(this);
  }

  get alive() { return this.state !== 'dead'; }
  /** Visual half-width used for spacing (sprites are wider than their physics bodies). */
  get halfW() { return (SPRITES[this.slot]?.w ?? this.displayWidth) * 0.4; }
  get body2() { return this.body as Phaser.Physics.Arcade.Body; }
  get engaged() { return !['idle', 'return', 'dead'].includes(this.state); }

  set(state: State, ms = 0) {
    const wasEngaged = this.engaged;
    this.state = state;
    if (!wasEngaged && this.engaged) { this.home = this.x; this.stuckMs = 0; }
    this.until = this.scene.time.now + ms;
    this.alert.setVisible(state === 'windup');
    if (state !== 'windup') { this.restoreTint(); this.setScale(this.baseSX, this.baseSY); }
  }

  /** Damage + knockback. Returns true if it died. */
  hurt(dmg: number, fromX: number, kb: number, hitstunMs: number): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    if (this.dormant) Kind.wake(this);
    Looks.hurt(this);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => { if (this.state !== 'windup') this.restoreTint(); });
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

  /** Hit by something that did no damage (an immune hit): wake a passive mob up without pushing it. */
  provoke() {
    if (this.alive && this.state === 'idle') this.set('approach');
  }

  die() {
    this.set('dead');
    this.hp = 0;
    this.body2.enable = false;
    // v0.3.0: Whisperwood mobs have their own deaths (light spray, leaves, slump, belly-flop, mist).
    if (!Looks.death(this)) this.scene.tweens.add({ targets: this, alpha: 0, y: this.y - 10, duration: 300, onComplete: () => this.setVisible(false) });
    this.bar.clear();
    this.label.setVisible(false);
    const rs = Number(this.def.respawn_s) || 0;
    if (rs > 0) this.scene.time.delayedCall(rs * 1000, () => this.respawn());
  }

  /** Restore a named-mob tint (clearTint would wash out Wool-Shoulder etc.). */
  restoreTint() {
    if (this.namedTint != null) this.setTint(this.namedTint);
    else this.clearTint();
  }

  respawn() {
    if (!this.scene) return;
    this.hp = this.def.hp;
    this.set('idle');
    this.x = this.spawnX;
    this.y = this.spawnY; // a mob that died on a ledge comes back on the ground
    this.home = this.spawnX;
    this.setAlpha(1).setVisible(true).setAngle(0).setScale(this.baseSX, this.baseSY);
    this.body2.enable = true;
    this.label.setVisible(true);
    this.dormant = !!this.kind.ambushTiles;
    Looks.respawn(this);
  }

  /** Remove permanently (console kill/cleanup of spawned mobs). */
  kill() { if (this.alive) this.die(); }

  startWindup(ms: number) {
    this.body2.setVelocityX(0);
    this.set('windup', ms);
    this.setTint(0xff7070);
    if (this.texture.frameTotal > 3) this.setFrame(2); // v0.3.0: wind-up pose
    if (!Looks.windup(this, ms)) this.scene.tweens.add({ targets: this, scaleY: this.baseSY * 0.85, scaleX: this.baseSX * 1.1, duration: ms * 0.8 });
  }

  /** AI tick. Returns 'swing' on the frame a melee swing lands, 'shoot' when a projectile is released. */
  tick(now: number, t: Target): Attack {
    if (!this.alive) return null;
    const body = this.body2;
    const dtMs = this.lastTickAt ? Math.min(100, now - this.lastTickAt) : 16;
    this.lastTickAt = now;
    const dx = t.x - this.x;
    const dy = Math.abs(t.y - this.y);
    // v0.2.6 reachability: how far above this mob's feet the player stands.
    const rise = this.y - t.y;
    const sameLevel = Math.abs(rise) <= 40;
    const jumpable = rise > 40 && rise <= MOB_JUMP.maxRisePx;
    const reachable = rise <= MOB_JUMP.maxRisePx;
    const gap = Math.abs(dx) - t.halfW - this.halfW; // edge-to-edge distance
    const toward = Math.sign(dx) || 1;
    const aggroPx = ASSUME.aggroTiles * TILE;
    const leashPx = ASSUME.leashTiles * TILE;
    let swing: Attack = null;

    // v0.3.0: ledge-bound mobs only notice a player on their own level; nobody aggroes into Wren's camp; an
    // ambusher wakes only up close (Kind.tickDormant).
    const inCamp = Kind.inCamp(this, t.x);
    // a ranged ledge mob (Thornling) also throws up at a climber on the next tier
    const levelOk = this.opts.ledge ? sameLevel || (this.ranged && Math.abs(rise) < 140) : dy < 140 && reachable;
    if (this.state === 'idle' && this.def.aggression === 'aggressive' && !this.kind.ambushTiles && t.targetable && !inCamp && Math.abs(dx) < aggroPx && levelOk) this.set('approach');
    if (this.state === 'idle' && this.dormant && Kind.tickDormant(this, now, dx, sameLevel, t.targetable && !inCamp)) { this.drawUi(); return null; }
    if (this.engaged && (!t.targetable || inCamp || Math.abs(this.x - this.home) > leashPx)) this.set('return');

    // Give up when stuck: the player is on a ledge this mob cannot reach (or it keeps failing to get up).
    if (this.engaged && this.state !== 'hitstun') {
      if (sameLevel || (this.ranged && Math.abs(rise) < 140) || (rise < -40 && !this.opts.ledge && !this.kind.fly)) this.stuckMs = 0;
      else if (!reachable || jumpable || this.opts.ledge) this.stuckMs += dtMs;
      if (this.kind.fly && Math.abs(rise) < 160) this.stuckMs = 0; // a hovering wisp just keeps throwing
      if (this.stuckMs >= GIVE_UP_MS) {
        this.stuckMs = 0;
        body.setVelocityX(0);
        this.set('idle');
        this.dormantAt = now + 2000;
        this.nextWanderAt = now + 1200;
        const [lo, hi] = this.patrolRange();
        this.wanderTarget = Phaser.Math.Clamp(this.x + (dx > 0 ? -1 : 1) * (6 + Math.random() * 10) * TILE, lo, hi);
        return null;
      }
    }

    switch (this.state) {
      case 'idle': {
        // v0.2.6: walk to a random spot along the whole spawn stretch, pause, pick another.
        const w0 = this.wanderTarget - this.x;
        if (now >= this.nextWanderAt && (Math.abs(w0) <= 6 || now >= this.nextWanderAt + 12000)) {
          this.nextWanderAt = now + 600 + Math.random() * 2400;
          const [lo, hi] = this.patrolRange();
          this.wanderTarget = Math.random() < 0.12 ? this.x : lo + Math.random() * (hi - lo);
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
          // v0.3.0: a cornered Thornling scratches instead of throwing
          if (this.kind.meleePx && gap <= this.kind.meleePx && dy < 60) { this.feint = false; this.meleeNext = true; this.startWindup(rand(this.feel.windupMs) * 0.8); }
          else if (d <= RANGED.fireRangePx && dy < (this.kind.fly ? 170 : 140) && now >= this.nextShotAt) { this.feint = false; this.meleeNext = false; this.startWindup(rand(this.feel.windupMs)); }
        } else if (gap <= this.feel.range && dy < 60) {
          this.feint = Math.random() < AI.feintChance;
          this.startWindup(rand(this.feel.windupMs));
        } else {
          body.setVelocityX(gap < AI.minGapPx ? -toward * this.speed : toward * this.speed * AI.chaseSpeedMul);
          // The player is on a low ledge: jump up to it (a ledge above the jump is left to the give-up timer).
          if (jumpable && !this.opts.ledge && body.blocked.down && now >= this.nextJumpAt && Math.abs(dx) < 90) {
            this.nextJumpAt = now + 750;
            body.setVelocityY(-MOB_JUMP.velocity);
            body.setVelocityX(toward * this.speed * AI.chaseSpeedMul);
          }
        }
        break;
      case 'windup':
        body.setVelocityX(!this.ranged && gap < AI.minGapPx ? -toward * this.speed * 0.5 : 0);
        if (now >= this.until) {
          if (this.ranged && !this.meleeNext) {
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
            if (swing) this.stuckMs = 0;
            this.meleeNext = false;
            body.setVelocityX(toward * (this.kind.lungeVx ?? 90));
            Looks.strike(this);
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
        const back = this.home - this.x;
        body.setVelocityX(Math.sign(back) * this.speed * 2.2);
        if (Math.abs(back) < 8) { this.set('idle'); this.hp = this.def.hp; body.setVelocityX(0); this.dormantAt = now + 1500; } // leash reset
        break;
      }
    }

    // v0.3.0 movement kinds: stay on the own ledge, hover, hop, step up half-tile slopes.
    Kind.move(this, now, t);

    // Facing: engaged monsters face the player (except while backing off); art faces right.
    if (this.state === 'backoff' && !this.ranged) this.setFlipX(this.dir < 0);
    else if (this.engaged && this.state !== 'hop') this.setFlipX(dx < 0);
    else if (Math.abs(body.velocity.x) > 1) this.setFlipX(body.velocity.x < 0);

    // Walk/idle/flap: monsters.anim_speed (Crow 1 = v0.1.2 rate; others 0.5 = 2× slower).
    // Frame rate and wobble also scale with actual horizontal speed.
    const anim = this.def.anim_speed ?? (this.def.id === 'crow' ? 1 : 0.5);
    const moving = Math.abs(body.velocity.x) > 5;
    const ref = ASSUME.monsterSpeed[this.def.id] ?? ASSUME.monsterSpeed.default;
    const walkMul = moving ? Math.max(0.35, Math.abs(body.velocity.x) / Math.max(1, ref)) : 0;
    this.animT += walkMul * anim;
    if (this.texture.frameTotal > 2 && this.state !== 'windup' && !this.dormant) {
      const base = (moving || !body.blocked.down) ? ANIM.mobFrameMoveMs : ANIM.mobFrameIdleMs;
      const frameMs = base / Math.max(0.15, anim * (walkMul || 1));
      this.setFrame(Math.floor(now / frameMs) % 2);
    }
    this.setAngle(moving && this.state !== 'windup' && !this.kind.hop ? Math.sin(this.animT * ANIM.mobWobble) * 6 : 0);
    Looks.idle(this, now);

    this.drawUi();
    return swing;
  }

  /** The stretch of ground this mob patrols: its spawn stretch, else a wide span around its spawn point. */
  patrolRange(): [number, number] {
    const bounds = this.scene.physics.world.bounds;
    const lo = this.patrol ? this.patrol[0] : this.spawnX - 16 * TILE;
    const hi = this.patrol ? this.patrol[1] : this.spawnX + 16 * TILE;
    return [Math.max(bounds.x + 24, lo), Math.min(bounds.x + bounds.width - 24, hi)];
  }

  drawUi() {
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
    Looks.destroy(this);
    super.destroy(fromScene);
  }
}
