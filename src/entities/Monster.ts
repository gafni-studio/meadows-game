import Phaser from 'phaser';
import { MonsterDef } from '../data/db';
import { ASSUME, TILE } from '../data/assumptions';
import { monsterSlot } from '../art/sprites';

type State = 'idle' | 'chase' | 'return' | 'dead';

export class Monster extends Phaser.Physics.Arcade.Sprite {
  def: MonsterDef;
  hp: number;
  spawnX: number;
  state: State = 'idle';
  private wanderTarget: number;
  private nextWanderAt = 0;
  nextAttackAt = 0;
  private bar: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private speed: number;

  constructor(scene: Phaser.Scene, def: MonsterDef, x: number, groundY: number) {
    const slot = monsterSlot(def.id);
    super(scene, x, groundY, slot);
    this.def = def;
    this.hp = def.hp;
    this.spawnX = x;
    this.wanderTarget = x;
    this.speed = ASSUME.monsterSpeed[def.id] ?? ASSUME.monsterSpeed.default;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.y = groundY;
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.bar = scene.add.graphics().setDepth(20);
    const color = def.aggression === 'aggressive' ? '#ffd2d2' : '#ffffff';
    this.label = scene.add
      .text(x, groundY, `Lv${def.level} ${def.name}`, { fontFamily: 'monospace', fontSize: '11px', color, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 0).setDepth(20);
  }

  get alive() { return this.state !== 'dead'; }

  hurt(dmg: number, fromX: number): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(Math.sign(this.x - fromX || 1) * 120);
    if (this.state !== 'return') this.state = 'chase'; // passive monsters fight back once hit
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  private die() {
    this.state = 'dead';
    this.hp = 0;
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.scene.tweens.add({ targets: this, alpha: 0, y: this.y - 10, duration: 300, onComplete: () => this.setVisible(false) });
    this.bar.clear();
    this.label.setVisible(false);
    this.scene.time.delayedCall(this.def.respawn_s * 1000, () => this.respawn());
  }

  private respawn() {
    if (!this.scene) return;
    this.hp = this.def.hp;
    this.state = 'idle';
    this.x = this.spawnX;
    this.setAlpha(1).setVisible(true);
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.label.setVisible(true);
  }

  /** AI tick. Returns true if the monster is swinging at the player this frame. */
  tick(now: number, px: number, py: number, playerTargetable: boolean): boolean {
    if (!this.alive) return false;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dx = px - this.x;
    const dy = Math.abs(py - this.y);
    const aggroPx = ASSUME.aggroTiles * TILE;
    const leashPx = ASSUME.leashTiles * TILE;
    let swing = false;

    if (this.state === 'idle' && this.def.aggression === 'aggressive' && playerTargetable && Math.abs(dx) < aggroPx && dy < 140) {
      this.state = 'chase';
    }
    if (this.state === 'chase') {
      if (!playerTargetable || Math.abs(this.x - this.spawnX) > leashPx) {
        this.state = 'return';
      } else if (Math.abs(dx) > ASSUME.monsterReach * 0.6) {
        body.setVelocityX(Math.sign(dx) * this.speed * 1.6);
      } else {
        body.setVelocityX(0);
      }
      if (Math.abs(dx) <= ASSUME.monsterReach && dy < 60 && now >= this.nextAttackAt) {
        this.nextAttackAt = now + ASSUME.monsterAttackIntervalMs;
        swing = true;
        this.scene.tweens.add({ targets: this, scaleX: 1.15, scaleY: 0.9, yoyo: true, duration: 90 });
      }
    } else if (this.state === 'return') {
      const back = this.spawnX - this.x;
      body.setVelocityX(Math.sign(back) * this.speed * 2.2);
      if (Math.abs(back) < 8) { this.state = 'idle'; this.hp = this.def.hp; body.setVelocityX(0); } // leash reset
    } else {
      if (now >= this.nextWanderAt) {
        this.nextWanderAt = now + 1500 + Math.random() * 2500;
        this.wanderTarget = Math.random() < 0.35 ? this.x : this.spawnX + (Math.random() * 2 - 1) * 4 * TILE;
      }
      const w = this.wanderTarget - this.x;
      body.setVelocityX(Math.abs(w) > 6 ? Math.sign(w) * this.speed * 0.6 : 0);
    }
    if (Math.abs(body.velocity.x) > 1) this.setFlipX(body.velocity.x < 0);
    else if (this.state === 'chase') this.setFlipX(dx < 0);
    this.drawUi();
    return swing;
  }

  private drawUi() {
    const top = this.y - this.height;
    this.label.setPosition(this.x, this.y + 2);
    this.bar.clear();
    if (this.hp < this.def.hp) {
      const w = Math.max(30, this.width);
      this.bar.fillStyle(0x000000, 0.7).fillRect(this.x - w / 2, top - 9, w, 5);
      this.bar.fillStyle(0xe04040, 1).fillRect(this.x - w / 2 + 1, top - 8, (w - 2) * (this.hp / this.def.hp), 3);
    }
  }

  destroy(fromScene?: boolean) {
    this.bar?.destroy();
    this.label?.destroy();
    super.destroy(fromScene);
  }
}
