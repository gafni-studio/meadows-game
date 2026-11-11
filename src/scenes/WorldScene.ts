import Phaser from 'phaser';
import { DB, f, consumableEffect, buffNumbers } from '../data/db';
import { ASSUME, TILE, ATTACK_FEEL, PLAYER_HIT_KB, REGEN } from '../data/assumptions';
import { AREAS, AreaGeometry } from '../world/areas';
import { SPRITES, iconKey, DROP_SIZE } from '../art/sprites';
import { fitSlot, applyBody } from '../art/SpriteFactory';
import { Monster } from '../entities/Monster';
import { Controls } from '../systems/Controls';
import { Game } from '../systems/GameState';
import * as P from '../systems/Player';
import { computeHit, incomingDamage, rollHit } from '../systems/Combat';
import { rollDrops } from '../systems/Loot';

const GROUND_H = 64;
/** v0.1 HP/MP potion bar order (first one owned is used). */
export const HP_POTIONS = ['meadow_dew', 'spring_draught', 'barley_cake', 'wild_apple'];
export const MP_POTIONS = ['clear_dew', 'mint_draught'];

interface Drop extends Phaser.Physics.Arcade.Image { itemId: string; qty: number; expireAt: number; rare: boolean }

export class WorldScene extends Phaser.Scene {
  private areaId = 'meadow_town';
  private geo!: AreaGeometry;
  private groundY = 0;
  private ground!: Phaser.GameObjects.Rectangle;
  player!: Phaser.Physics.Arcade.Sprite;
  private controls!: Controls;
  monsters: Monster[] = [];
  private drops!: Phaser.Physics.Arcade.Group;
  private facing = 1;
  private swingReadyAt = 0;
  private npcs: { x: number; id: string; role: string; name: string }[] = [];
  private portals: { x: number; dir: string; arriveX: number; target?: string }[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private sword!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Graphics;
  private lastSave = 0;
  private lastCombatAt = 0;
  private knockUntil = 0;
  private walkT = 0;
  private playerBaseScale = { x: 1, y: 1 };

  constructor() { super('World'); }

  init(data: { area?: string; x?: number }) {
    this.areaId = data.area && AREAS[data.area] ? data.area : 'meadow_town';
    this.geo = AREAS[this.areaId];
    Game.player.area = this.areaId;
    if (data.x !== undefined) Game.player.x = data.x;
    this.monsters = [];
    this.npcs = [];
    this.portals = [];
  }

  create() {
    const W = this.geo.widthTiles * TILE;
    const H = this.scale.height;
    this.groundY = H - GROUND_H;
    this.cameras.main.setBackgroundColor(this.geo.sky);
    this.physics.world.setBounds(0, 0, W, H);
    this.physics.world.gravity.y = ASSUME.gravity;
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.roundPixels = true;

    // Parallax hills + clouds.
    const far = this.add.graphics().setScrollFactor(0.2);
    far.fillStyle(0xffffff, 0.8);
    for (let i = 0; i < W / 400 + 3; i++) { const cx = i * 400 + 80, cy = 70 + (i % 3) * 30; far.fillRoundedRect(cx, cy, 90, 22, 11); far.fillRoundedRect(cx + 20, cy - 12, 50, 22, 11); }
    const hills = this.add.graphics().setScrollFactor(0.35);
    hills.fillStyle(0x8fcf74, 1);
    for (let i = 0; i < W / 300 + 4; i++) hills.fillCircle(i * 300, this.groundY + 50, 170 + (i % 3) * 30);
    const hills2 = this.add.graphics().setScrollFactor(0.6);
    hills2.fillStyle(0x6fb85a, 1);
    for (let i = 0; i < W / 220 + 4; i++) hills2.fillCircle(i * 220 + 90, this.groundY + 70, 110 + (i % 2) * 25);

    // Ground: grass row + dirt fill (tile art scaled to the slot size) + one static body.
    const gs = SPRITES['tile.grass_top'];
    const grass = this.add.tileSprite(0, this.groundY, W, gs.h, 'tile.grass_top').setOrigin(0, 0).setDepth(1);
    grass.setTileScale(gs.w / this.textures.getFrame('tile.grass_top').width);
    const dirt = this.add.tileSprite(0, this.groundY + gs.h, W, GROUND_H, 'tile.dirt').setOrigin(0, 0).setDepth(1);
    dirt.setTileScale(SPRITES['tile.dirt'].w / this.textures.getFrame('tile.dirt').width);
    this.ground = this.add.rectangle(W / 2, this.groundY + GROUND_H / 2 + 4, W, GROUND_H, 0, 0);
    this.physics.add.existing(this.ground, true);
    const groundY = this.groundY + 4; // feet stand slightly into the grass row

    for (const d of this.geo.decor) fitSlot(this, this.add.image(d.x * TILE, groundY, d.slot).setOrigin(0.5, 1).setDepth(0), d.slot);

    // One-way platforms (jump up through them, land on top).
    const platforms = this.physics.add.staticGroup();
    const ps = SPRITES['tile.platform'];
    for (const p of this.geo.platforms) {
      const y = this.groundY - p.y * TILE;
      const plat = this.add.tileSprite(p.x * TILE, y, p.w * TILE, ps.h, 'tile.platform').setOrigin(0, 0).setDepth(2);
      const fr = this.textures.getFrame('tile.platform');
      plat.setTileScale(ps.h / fr.height);
      platforms.add(plat);
    }

    // Portals.
    const area = DB.areas[this.areaId];
    for (const p of this.geo.portals) {
      const target = area?.links?.[p.dir];
      const implemented = target && AREAS[target];
      const img = fitSlot(this, this.add.image(p.x * TILE, groundY, 'portal').setOrigin(0.5, 1).setDepth(2), 'portal').setAlpha(implemented ? 1 : 0.45);
      if (implemented) this.tweens.add({ targets: img, alpha: 0.75, yoyo: true, repeat: -1, duration: 900 });
      const tname = target ? DB.areas[target]?.name ?? target : '—';
      this.add.text(p.x * TILE, groundY - 100, implemented ? `→ ${tname}` : `${tname}\n(v0.2)`, {
        fontFamily: 'monospace', fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 3, align: 'center',
      }).setOrigin(0.5, 0).setDepth(3);
      this.portals.push({ x: p.x * TILE, dir: p.dir, arriveX: p.arriveX * TILE, target: implemented ? target : undefined });
    }

    // NPCs.
    for (const n of this.geo.npcs) {
      const img = fitSlot(this, this.add.image(n.x * TILE, groundY, `npc.${n.id}`).setOrigin(0.5, 1).setDepth(4), `npc.${n.id}`);
      if (n.x * TILE > W / 2) img.setFlipX(true);
      this.add.text(n.x * TILE, groundY - img.displayHeight - 4, n.name, { fontFamily: 'monospace', fontSize: '11px', color: '#fff6c2', stroke: '#000', strokeThickness: 3 })
        .setOrigin(0.5, 1).setDepth(4);
      this.npcs.push({ x: n.x * TILE, id: n.id, role: n.role, name: n.name });
    }

    // Player.
    const px = Phaser.Math.Clamp(Game.player.x, 40, W - 40);
    this.player = this.physics.add.sprite(px, groundY - 2, 'player.warrior').setOrigin(0.5, 1).setDepth(10);
    fitSlot(this, this.player, 'player.warrior');
    this.playerBaseScale = { x: this.player.scaleX, y: this.player.scaleY };
    applyBody(this.player, 'player.warrior');
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, platforms, undefined, (pl, plat) => {
      const b = (pl as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
      const pb = (plat as Phaser.GameObjects.TileSprite).body as Phaser.Physics.Arcade.StaticBody;
      return b.velocity.y >= 0 && b.bottom <= pb.top + 10;
    });
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 60);
    this.sword = fitSlot(this, this.add.image(0, 0, 'fx.sword').setDepth(11).setVisible(false).setOrigin(0.5, 0.9), 'fx.sword');
    this.glow = this.add.graphics().setDepth(9);

    // Monsters (types + counts from map_layout.spawn_counts).
    if (!this.geo.safe && area) {
      for (const [mid, count] of Object.entries(area.spawns)) {
        const zone = this.geo.spawnZones[mid];
        if (!zone) continue;
        for (let i = 0; i < count; i++) {
          this.spawnMonster(mid, (zone[0] + ((zone[1] - zone[0]) * (i + 0.5)) / count + (Math.random() - 0.5) * 2) * TILE);
        }
      }
    }

    this.drops = this.physics.add.group();
    this.physics.add.collider(this.drops, this.ground);
    this.physics.add.collider(this.drops, platforms);

    this.prompt = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fff', backgroundColor: '#000a', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1).setDepth(30).setVisible(false);

    this.controls = new Controls(this);
    const onUse = (id: string) => this.useItem(id);
    const onKb = (on: boolean) => {
      const kb = this.input.keyboard!;
      kb.enabled = on;
      if (on) kb.enableGlobalCapture(); else { kb.disableGlobalCapture(); kb.resetKeys(); }
    };
    Game.events.on('use-item', onUse);
    Game.events.on('keyboard', onKb);
    Game.scene = this;
    this.events.once('shutdown', () => {
      Game.events.off('use-item', onUse);
      Game.events.off('keyboard', onKb);
      this.monsters.forEach((m) => m.destroy());
      this.monsters = [];
    });
    if (Game.consoleOpen) onKb(false);

    Game.events.emit('area', DB.areas[this.areaId]?.name ?? this.areaId);
    Game.changed();
    Game.save();
  }

  spawnMonster(id: string, x: number): Monster | null {
    const def = DB.monsters[id];
    if (!def) return null;
    const m = new Monster(this, def, Phaser.Math.Clamp(x, 40, this.geo.widthTiles * TILE - 40), this.groundY + 4);
    m.setDepth(8);
    this.physics.add.collider(m, this.ground);
    this.monsters.push(m);
    return m;
  }

  // ───────────────────────────── loop ─────────────────────────────
  update(time: number, delta: number) {
    Game.now = time;
    const p = Game.player;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const menu = Game.menuOpen || Game.consoleOpen;

    if (!Game.dead && !menu) {
      const speedMul = this.buffActive('mint_sprig') ? 1 + (consumableEffect('mint_sprig').buff?.speedPct ?? 0) / 100 : 1;
      let vx = 0;
      if (this.controls.down('left')) vx -= 1;
      if (this.controls.down('right')) vx += 1;
      // let a hit's knockback play out briefly before input takes over again
      if (time >= this.knockUntil) body.setVelocityX(vx * ASSUME.playerSpeed * speedMul);
      if (vx !== 0) { this.facing = vx; this.player.setFlipX(vx < 0); }
      if (this.controls.pressed('jump') && body.blocked.down) body.setVelocityY(-ASSUME.jumpVelocity);

      if (this.controls.down('attack')) this.trySwing(1.0, 0, 'basic');
      if (this.controls.pressed('skill1')) this.usePowerStrike();
      if (this.controls.pressed('skill2')) this.useRage();
      if (this.controls.pressed('potionHp')) this.drinkFirst(HP_POTIONS, 'HP');
      if (this.controls.pressed('potionMp')) this.drinkFirst(MP_POTIONS, 'MP');
      if (this.controls.pressed('interact')) this.interact();
      // walk wobble
      if (vx !== 0 && body.blocked.down) { this.walkT += delta; this.player.setAngle(Math.sin(this.walkT / 70) * 5); }
      else this.player.setAngle(0);
    } else {
      this.controls.clear();
      if (!Game.dead && body.blocked.down) body.setVelocityX(0);
    }

    if (!Game.dead) {
      p.mp = Math.min(P.maxMp(p), p.mp + (P.mpRegenPerSec(p) * delta) / 1000);
      this.regen(time, delta);
    }

    this.player.setAlpha(time < Game.invulnUntil && !Game.dead ? (Math.floor(time / 80) % 2 ? 0.35 : 1) : Game.dead ? 0.3 : 1);

    const target = { x: this.player.x, y: this.player.y, halfW: SPRITES['player.warrior'].w * 0.4, targetable: !Game.dead };
    for (const m of this.monsters) if (m.tick(time, target)) this.monsterSwings(m);

    for (const d of this.drops.getChildren() as Drop[]) if (time > d.expireAt) d.destroy();
    this.updatePrompt();
    p.x = this.player.x;
    if (time - this.lastSave > ASSUME.autosaveMs) { this.lastSave = time; Game.save(); }
  }

  /** Out-of-combat HP regen (assumptions.REGEN). */
  private regen(time: number, delta: number) {
    const p = Game.player;
    const max = P.maxHp(p);
    const active = time - this.lastCombatAt > REGEN.delayMs && p.hp < max;
    Game.regenActive = active;
    this.glow.clear();
    if (!active) return;
    const perSec = max * (REGEN.pctMaxHpPerSec / 100) * (1 + p.stats.SPI * REGEN.spiBonusPerPoint);
    p.hp = Math.min(max, p.hp + (perSec * delta) / 1000);
    const a = 0.25 + 0.15 * Math.sin(time / 200);
    this.glow.fillStyle(0x7dff9b, a).fillEllipse(this.player.x, this.player.y - 4, 44, 12);
    if (Math.random() < delta / 250) {
      const t = this.add.text(this.player.x + (Math.random() - 0.5) * 30, this.player.y - 20, '+', { fontFamily: 'monospace', fontSize: '14px', color: '#7dff9b', stroke: '#000', strokeThickness: 3 }).setDepth(12);
      this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 800, onComplete: () => t.destroy() });
    }
  }

  // ─────────────────────────── combat ───────────────────────────
  private buffActive(id: string) { return (Game.buffs[id] ?? 0) > Game.now; }

  private trySwing(mult: number, mpCost: number, kind: 'basic' | 'power_strike'): boolean {
    const p = Game.player;
    const now = Game.now;
    const atkSpeed = this.buffActive('mint_sprig') ? 1 + (consumableEffect('mint_sprig').buff?.speedPct ?? 0) / 100 : 1;
    if (now < this.swingReadyAt) return false;
    if (p.mp < mpCost) { Game.toast('Not enough MP', 'warn'); this.swingReadyAt = now + 300; return false; }
    p.mp -= mpCost;
    this.swingReadyAt = now + P.attackIntervalMs(p) / atkSpeed;
    this.lastCombatAt = now;
    this.swingFx(kind);

    // Single target: nearest living monster in front within reach.
    let best: Monster | null = null;
    let bestD = Infinity;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const dx = (m.x - this.player.x) * this.facing;
      const reach = ASSUME.meleeReach + m.halfW;
      if (dx < -18 || dx > reach || Math.abs(m.y - this.player.y) > 60) continue;
      if (dx < bestD) { bestD = dx; best = m; }
    }
    if (!best) return true;
    const topY = best.y - best.displayHeight - 12;
    if (!rollHit(P.accuracy(p), best.feel.eva, p.level, best.def.level)) {
      this.floatText(best.x, topY, 'MISS', '#c8c8c8', 15);
      return true;
    }
    const rage = this.buffActive('rage') ? buffNumbers('rage').dealtPct : 0;
    const { dmg, crit } = computeHit(P.attack(p), mult, best.def.defense, P.critChance(p), rage);
    this.floatText(best.x, topY, `${dmg}`, crit ? '#ffcf33' : '#ffffff', crit ? 20 : 16);
    const feel = ATTACK_FEEL[kind];
    if (best.hurt(dmg, this.player.x, feel.kb, feel.hitstunMs)) this.onKill(best);
    if (kind === 'power_strike') this.cameras.main.shake(80, 0.004);
    return true;
  }

  private swingFx(kind: string) {
    const s = this.sword;
    s.setVisible(true).setFlipX(this.facing < 0).setTint(kind === 'basic' ? 0xffffff : 0xffc04a);
    s.setPosition(this.player.x + this.facing * 14, this.player.y - 18);
    s.setAngle(-70 * this.facing);
    this.tweens.killTweensOf(s);
    this.tweens.add({ targets: s, angle: 80 * this.facing, duration: 140, ease: 'Quad.easeOut', onComplete: () => s.setVisible(false) });
    const fx = this.add.image(this.player.x + this.facing * 40, this.player.y - 26, 'fx.slash').setDepth(12)
      .setAlpha(kind === 'basic' ? 0.25 : 0.55).setTint(kind === 'basic' ? 0xffffff : 0xffc04a);
    this.tweens.add({ targets: fx, alpha: 0, scaleX: 1.3, duration: 180, onComplete: () => fx.destroy() });
    // lunge
    this.tweens.add({ targets: this.player, scaleX: this.playerBaseScale.x * 1.08, duration: 60, yoyo: true });
  }

  private usePowerStrike() {
    const s = DB.skills['power_strike'];
    const now = Game.now;
    if ((Game.cooldowns.power_strike ?? 0) > now) return;
    const rankBonus = 0.02 * (Game.player.skillRanks.power_strike ?? 0);
    if (this.trySwing((s.damage_multiplier ?? 1) + rankBonus, s.mp_cost, 'power_strike')) {
      Game.cooldowns.power_strike = now + (ASSUME.cooldownMs.power_strike ?? 1000);
    }
  }

  private useRage() {
    const s = DB.skills['rage'];
    const p = Game.player;
    const now = Game.now;
    if ((Game.cooldowns.rage ?? 0) > now) { Game.toast('Rage is on cooldown', 'warn'); return; }
    if (p.mp < s.mp_cost) { Game.toast('Not enough MP', 'warn'); return; }
    p.mp -= s.mp_cost;
    this.lastCombatAt = now;
    Game.buffs.rage = now + (s.duration_s ?? 60) * 1000;
    Game.cooldowns.rage = now + (ASSUME.cooldownMs.rage ?? 60000);
    const { dealtPct, takenPct } = buffNumbers('rage');
    Game.toast(`Rage! +${dealtPct}% damage dealt, +${takenPct}% damage taken for ${s.duration_s}s`, 'info');
    this.player.setTint(0xff9a9a);
    this.time.delayedCall((s.duration_s ?? 60) * 1000, () => this.player?.clearTint());
  }

  private monsterSwings(m: Monster) {
    const p = Game.player;
    if (Game.dead || Game.now < Game.invulnUntil) return;
    if (!rollHit(m.feel.acc, P.evasion(p), m.def.level, p.level)) {
      this.floatText(this.player.x, this.player.y - 60, 'MISS', '#c8c8c8', 14);
      return;
    }
    this.lastCombatAt = Game.now;
    const taken = this.buffActive('rage') ? buffNumbers('rage').takenPct : 0;
    const dmg = p.cheats.god ? 0 : incomingDamage(m.def.attack, P.defense(p), taken);
    p.hp -= dmg;
    Game.invulnUntil = Game.now + ASSUME.hurtInvulnMs;
    this.knockUntil = Game.now + 200;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.sign(this.player.x - m.x || 1) * PLAYER_HIT_KB.vx, PLAYER_HIT_KB.vy);
    this.floatText(this.player.x, this.player.y - 60, p.cheats.god ? 'GOD' : `-${dmg}`, '#ff6b6b', 16);
    if (p.hp <= 0) this.die();
  }

  onKill(m: Monster) {
    const p = Game.player;
    const lv = P.gainXp(p, m.def.xp);
    this.floatText(m.x, m.y - m.displayHeight - 30, `+${m.def.xp} XP`, '#9be7ff', 13);
    if (lv > 0) this.levelUpFx(lv);
    for (const d of rollDrops(m.def.id, p.cheats.dropMul)) this.spawnDrop(m.x, m.y - 20, d.itemId, d.qty, d.rare);
    Game.changed();
  }

  levelUpFx(levels: number) {
    const p = Game.player;
    Game.invulnUntil = Game.now + ASSUME.levelUpInvulnMs;
    Game.toast(`LEVEL UP! Level ${p.level} — +${f('player_points_per_level') * levels} ability points (press C)`, 'level');
    this.floatText(this.player.x, this.player.y - 80, 'LEVEL UP!', '#ffe066', 24);
    Game.save();
  }

  private spawnDrop(x: number, y: number, itemId: string, qty: number, rare: boolean) {
    const key = iconKey(itemId);
    const d = this.drops.create(x + (Math.random() - 0.5) * 30, y, key) as Drop;
    fitSlot(this, d, key, { w: DROP_SIZE, h: DROP_SIZE });
    d.setDepth(9);
    d.itemId = itemId;
    d.qty = qty;
    d.rare = rare;
    d.expireAt = Game.now + ASSUME.dropLifetimeMs;
    d.setVelocity((Math.random() - 0.5) * 160, -260);
    d.setBounce(0.2);
    d.setDragX(300);
    if (rare) {
      d.setTint(0xffe9a8);
      this.tweens.add({ targets: d, alpha: 0.55, yoyo: true, repeat: -1, duration: 400 });
    }
  }

  private die() {
    const p = Game.player;
    p.hp = 0;
    Game.dead = true;
    const lost = P.applyDeathPenalty(p);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
    Game.toast(`You were defeated. Lost ${lost} XP. Returning to Meadow Town…`, 'warn');
    Game.events.emit('dead', true);
    Game.changed();
    this.time.delayedCall(ASSUME.respawnDelayMs, () => {
      Game.dead = false;
      p.hp = P.maxHp(p);
      p.mp = P.maxMp(p);
      Game.buffs = {};
      Game.events.emit('dead', false);
      this.scene.restart({ area: 'meadow_town', x: AREAS.meadow_town.spawnX });
    });
  }

  private drinkFirst(ids: string[], kind: string) {
    const p = Game.player;
    const id = ids.find((i) => (p.inventory[i] ?? 0) > 0);
    if (!id) { Game.toast(`No ${kind} potions`, 'warn'); return; }
    this.useItem(id);
  }

  /** Use a consumable (from hotkey or inventory). */
  useItem(id: string) {
    const p = Game.player;
    if (Game.dead) return;
    if ((Game.cooldowns.potion ?? 0) > Game.now) return;
    const eff = consumableEffect(id);
    if (!eff.hp && !eff.mp && !eff.buff) return;
    if (eff.buff && this.buffActive(id)) { Game.toast(`${DB.items[id].name} is already active`, 'warn'); return; }
    if (!P.removeItem(p, id)) return;
    P.applyConsumable(p, eff);
    if (eff.buff) Game.buffs[id] = Game.now + eff.buff.durationS * 1000;
    Game.cooldowns.potion = Game.now + ASSUME.potionCooldownMs;
    const parts = [eff.hp && `+${eff.hp} HP`, eff.mp && `+${eff.mp} MP`, eff.buff && `+${eff.buff.speedPct}% speed`].filter(Boolean);
    this.floatText(this.player.x, this.player.y - 60, parts.join(' '), '#7dff9b', 14);
    Game.changed();
  }

  // ───────────────────────── interaction ─────────────────────────
  private nearbyDrops(): Drop[] {
    return (this.drops.getChildren() as Drop[]).filter(
      (d) => Phaser.Math.Distance.Between(d.x, d.y, this.player.x, this.player.y - 20) < ASSUME.pickupRadius,
    );
  }
  private nearNpc() { return this.npcs.find((n) => Math.abs(n.x - this.player.x) < 40); }
  private nearPortal() { return this.portals.find((pt) => Math.abs(pt.x - this.player.x) < 34); }

  private interact() {
    const drops = this.nearbyDrops();
    if (drops.length) {
      for (const d of drops) {
        P.addItem(Game.player, d.itemId, d.qty);
        Game.toast(`+${d.qty} ${DB.items[d.itemId].name}`, d.rare ? 'rare' : 'loot');
        d.destroy();
      }
      Game.changed();
      return;
    }
    const npc = this.nearNpc();
    if (npc) { Game.events.emit('npc', npc.id, npc.role, npc.name); return; }
    const portal = this.nearPortal();
    if (portal) {
      if (!portal.target) { Game.toast('That path opens in v0.2.', 'info'); return; }
      this.travel(portal.target, portal.arriveX);
    }
  }

  travel(area: string, x?: number) {
    Game.events.emit('close-all');
    this.scene.restart({ area, x: x ?? AREAS[area]?.spawnX });
  }

  private updatePrompt() {
    let text = '';
    if (this.nearbyDrops().length) text = 'E: pick up';
    else if (this.nearNpc()) text = `E: talk to ${this.nearNpc()!.name.split(' ')[0]}`;
    else if (this.nearPortal()) text = this.nearPortal()!.target ? 'E: enter' : 'Closed (v0.2)';
    this.prompt.setText(text).setVisible(!!text && !Game.dead && !Game.menuOpen).setPosition(this.player.x, this.player.y - 56);
  }

  floatText(x: number, y: number, text: string, color: string, size: number) {
    const t = this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 4, fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
