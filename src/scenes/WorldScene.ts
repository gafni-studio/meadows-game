import Phaser from 'phaser';
import { DB, f, consumableEffect } from '../data/db';
import { ANIM, ASSUME, TILE, ATTACK_FEEL, PLAYER_HIT_KB, REGEN, HIT_MONSTER, RANGED, CONTACT, SKILL_SCHOOL } from '../data/assumptions';
import { AREAS, AreaGeometry } from '../world/areas';
import { SPRITES, iconKey, DROP_SIZE } from '../art/sprites';
import { fitSlot, applyBody } from '../art/SpriteFactory';
import { Monster } from '../entities/Monster';
import { Controls } from '../systems/Controls';
import { Game } from '../systems/GameState';
import * as P from '../systems/Player';
import { computeHit, incomingDamage, rollHit, rollMonsterAttack, affinityOf, weakDamage } from '../systems/Combat';
import * as Sk from '../systems/Skills';
import { playSfx } from '../systems/Sfx';
import { rollDrops } from '../systems/Loot';
import { GearInstance, displayName } from '../systems/Gear';
import * as Q from '../systems/Quests';
import * as Fx from '../systems/CombatFx';

const GROUND_H = 64;

interface Drop extends Phaser.Physics.Arcade.Image { itemId: string; qty: number; expireAt: number; rare: boolean; inst?: GearInstance; picking?: boolean }
interface Shot { img: Phaser.GameObjects.Image; vx: number; vy: number; dieAt: number; m: Monster }

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
  private npcs: { x: number; id: string; role: string; name: string; marker?: Phaser.GameObjects.Text }[] = [];
  private lastMarkerAt = 0;
  private wasMenu = false;
  private portals: { x: number; dir: string; arriveX: number; target?: string }[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private sword!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Graphics;
  private lastSave = 0;
  private lastCombatAt = 0;
  private knockUntil = 0;
  private walkT = 0;
  private playerBaseScale = { x: 1, y: 1 };
  private burns: { m: Monster; perTick: number; next: number; until: number }[] = [];
  private shots: Shot[] = [];
  private chestX: number | null = null;
  private chestImg?: Phaser.GameObjects.Image;
  private postX: number | null = null;
  private lastQuestAt = 0;
  private pendingAttack = false;
  /** v0.2.6: the readyAt of the cooldown we already showed a banner for (so a mash stays quiet). */
  private cdBanner: Record<string, number> = {};
  private platformGroup!: Phaser.Physics.Arcade.StaticGroup;

  constructor() { super('World'); }

  init(data: { area?: string; x?: number }) {
    this.areaId = data.area && AREAS[data.area] ? data.area : 'meadow_town';
    this.geo = AREAS[this.areaId];
    Game.player.area = this.areaId;
    if (data.x !== undefined) Game.player.x = data.x;
    this.monsters = [];
    this.npcs = [];
    this.portals = [];
    this.shots = [];
    this.burns = [];
    this.chestX = null;
    this.chestImg = undefined;
    this.postX = null;
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
    const hillFar = this.geo.hills?.[0] ?? 0x8fcf74;
    const hillNear = this.geo.hills?.[1] ?? 0x6fb85a;
    const hills = this.add.graphics().setScrollFactor(0.35);
    hills.fillStyle(hillFar, 1);
    for (let i = 0; i < W / 300 + 4; i++) hills.fillCircle(i * 300, this.groundY + 50, 170 + (i % 3) * 30);
    const hills2 = this.add.graphics().setScrollFactor(0.6);
    hills2.fillStyle(hillNear, 1);
    for (let i = 0; i < W / 220 + 4; i++) hills2.fillCircle(i * 220 + 90, this.groundY + 70, 110 + (i % 2) * 25);

    // Ground: a top row (grass or dirt) + dirt fill + one static body.
    const topKey = this.geo.ground === 'dirt' ? 'tile.dirt_top' : 'tile.grass_top';
    const gs = SPRITES[topKey];
    const top = this.add.tileSprite(0, this.groundY, W, gs.h, topKey).setOrigin(0, 0).setDepth(1);
    top.setTileScale(gs.w / this.textures.getFrame(topKey).width);
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

    this.platformGroup = platforms;

    // Storage chest (town).
    if (this.geo.chest !== undefined) {
      this.chestX = this.geo.chest * TILE;
      this.chestImg = fitSlot(this, this.add.image(this.chestX, groundY, 'deco.chest').setOrigin(0.5, 1).setDepth(3), 'deco.chest');
      this.add.text(this.chestX, groundY - 44, 'Storage', { fontFamily: 'monospace', fontSize: '11px', color: '#fff6c2', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(4);
    }
    if (this.geo.practicePost != null) {
      this.postX = this.geo.practicePost * TILE;
      fitSlot(this, this.add.image(this.postX, groundY, 'deco.practice_post').setOrigin(0.5, 1).setDepth(3), 'deco.practice_post');
      this.add.text(this.postX, groundY - 50, 'Practice Post', { fontFamily: 'monospace', fontSize: '11px', color: '#fff6c2', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(4);
    }

    // Portals.
    const area = DB.areas[this.areaId];
    for (const p of this.geo.portals) {
      const target = area?.links?.[p.dir];
      const implemented = target && AREAS[target];
      const img = fitSlot(this, this.add.image(p.x * TILE, groundY, 'portal').setOrigin(0.5, 1).setDepth(2), 'portal').setAlpha(implemented ? 1 : 0.45);
      if (implemented) this.tweens.add({ targets: img, alpha: 0.75, yoyo: true, repeat: -1, duration: 900 });
      const tname = target ? DB.areas[target]?.name ?? target : '—';
      this.add.text(p.x * TILE, groundY - 100, implemented ? `→ ${tname}` : `${tname}\n(later)`, {
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
      // v0.2.6: a gold ! (quest available) or ? (turn-in ready) bobs above the name.
      const marker = this.add.text(n.x * TILE, groundY - img.displayHeight - 24, '!', { fontFamily: 'monospace', fontSize: '26px', color: '#ffd23a', stroke: '#3a2400', strokeThickness: 5, fontStyle: 'bold' })
        .setOrigin(0.5, 1).setDepth(6).setVisible(false);
      this.tweens.add({ targets: marker, y: marker.y - 6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.npcs.push({ x: n.x * TILE, id: n.id, role: n.role, name: n.name, marker });
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
          this.spawnMonster(mid, (zone[0] + ((zone[1] - zone[0]) * (i + 0.5)) / count + (Math.random() - 0.5) * 2) * TILE, [zone[0] * TILE, zone[1] * TILE]);
        }
      }
      this.ensureNamed();
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

  spawnMonster(id: string, x: number, patrol?: [number, number]): Monster | null {
    const def = DB.monsters[id];
    if (!def) return null;
    const m = new Monster(this, def, Phaser.Math.Clamp(x, 40, this.geo.widthTiles * TILE - 40), this.groundY + 4, patrol);
    m.setDepth(8);
    this.physics.add.collider(m, this.ground);
    // v0.2.6: mobs can stand on (and jump up to) the same one-way ledges as the player.
    this.physics.add.collider(m, this.platformGroup, undefined, (mob, plat) => {
      const b = (mob as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
      const pb = (plat as Phaser.GameObjects.TileSprite).body as Phaser.Physics.Arcade.StaticBody;
      return b.velocity.y >= 0 && b.bottom <= pb.top + 10;
    });
    this.monsters.push(m);
    return m;
  }

  // ───────────────────────────── loop ─────────────────────────────
  update(time: number, delta: number) {
    Game.now = time;
    const p = Game.player;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const menu = Game.menuOpen || Game.consoleOpen;
    // v0.2.7: a key that closed a window (E) must not also act in the world on the next frame.
    if (menu) this.wasMenu = true;
    else if (this.wasMenu) { this.wasMenu = false; this.controls.clear(); }

    // v0.2.3: Rage tint is driven by the live buff (Date.now()), so a leftover red
    // tint cannot stick after the buff ends or after a scene restart.
    if (this.player) {
      if (!Game.dead && this.buffActive('rage')) this.player.setTint(0xff9a9a);
      else this.player.clearTint();
    }

    if (!Game.dead && !menu) {
      const speedMul = this.buffActive('mint_sprig') ? 1 + (consumableEffect('mint_sprig').buff?.speedPct ?? 0) / 100 : 1;
      let vx = 0;
      if (this.controls.down('left')) vx -= 1;
      if (this.controls.down('right')) vx += 1;
      // let a hit's knockback play out briefly before input takes over again
      if (time >= this.knockUntil) body.setVelocityX(vx * ASSUME.playerSpeed * speedMul);
      if (vx !== 0) { this.facing = vx; this.player.setFlipX(vx < 0); }
      if (this.controls.pressed('jump') && body.blocked.down) body.setVelocityY(-ASSUME.jumpVelocity);

      // v0.2.3: buffer a swing pressed during recovery so the next hit fires as soon as ready.
      if (this.controls.pressed('attack')) {
        if (!this.trySwing(1.0, 0, 'basic')) this.pendingAttack = true;
      } else if (this.pendingAttack) {
        if (this.trySwing(1.0, 0, 'basic')) this.pendingAttack = false;
      } else if (this.controls.down('attack')) {
        this.trySwing(1.0, 0, 'basic');
      }
      if (this.controls.pressed('skill1')) this.useHotbar(0);
      if (this.controls.pressed('skill2')) this.useHotbar(1);
      if (this.controls.pressed('skill3')) this.useHotbar(2);
      if (this.controls.pressed('skill4')) this.useHotbar(3);
      if (this.controls.pressed('skill5')) this.useHotbar(4);
      if (this.controls.pressed('skill6')) this.useHotbar(5);
      if (this.controls.pressed('skill7')) this.useHotbar(6);
      if (this.controls.pressed('skill8')) this.useHotbar(7);
      if (this.controls.pressed('interact')) this.interact();
      // Walk wobble: ~35% slower than v0.1.2 (period 95 vs 70) and tied to actual move speed.
      const spd = Math.abs(body.velocity.x);
      if (spd > 8 && body.blocked.down) {
        this.walkT += delta * (spd / ASSUME.playerSpeed);
        this.player.setAngle(Math.sin(this.walkT / ANIM.heroWalkPeriod) * 5);
      } else this.player.setAngle(0);
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
    for (const m of this.monsters) {
      const a = m.tick(time, target);
      if (a === 'swing') this.monsterSwings(m);
      else if (a === 'shoot') this.fireShot(m);
      // v0.2.6: a mob that is in combat bumps for 40% of a swing when its body touches the player.
      else if (!Game.dead && m.alive && m.engaged && this.touching(m)) this.monsterSwings(m, m.x, true);
    }
    this.updateShots(time, delta);
    this.tickBurns(time);

    for (const d of this.drops.getChildren() as Drop[]) if (time > d.expireAt) d.destroy();
    if (!Game.dead && !menu && time - this.lastQuestAt > 350) {
      this.lastQuestAt = time;
      Q.checkPlace(p, this.areaId, this.player.x / TILE, this.nearPost());
      this.ensureNamed();
    }
    this.updateMarkers(time);
    this.updatePrompt();
    if (this.chestImg) this.chestImg.setTexture(Game.storageOpen ? 'deco.chest_open' : 'deco.chest');
    p.x = this.player.x;
    if (time - this.lastSave > ASSUME.autosaveMs) { this.lastSave = time; Game.save(); }
  }

  /** Out-of-combat HP regen (assumptions.REGEN). */
  private regen(time: number, delta: number) {
    const p = Game.player;
    const max = P.maxHp(p);
    if ((Game.buffs.soul_guard ?? 0) <= time) Game.shield = 0;
    const active = time - this.lastCombatAt > REGEN.delayMs && p.hp < max;
    Game.regenActive = active;
    this.glow.clear();
    // Buff visuals must use wall-clock (Date.now), same as Game.buffs. Using the
    // scene clock here left Dig In's aura on forever after v0.2.1 (Date.now() >> scene time).
    const wall = Date.now();
    if (Game.shield > 0 && (Game.buffs.soul_guard ?? 0) > wall) {
      const a = 0.3 + 0.15 * Math.sin(wall / 160);
      this.glow.lineStyle(3, 0x9fe0ff, a).strokeEllipse(this.player.x, this.player.y - 22, 52, 58);
    }
    if ((Game.buffs.dig_in ?? 0) > wall) {
      const a = 0.35 + 0.2 * Math.sin(wall / 180);
      this.glow.lineStyle(4, 0xc4a06a, a).strokeEllipse(this.player.x, this.player.y - 18, 60, 52);
      this.glow.fillStyle(0xc4a06a, 0.08 + 0.05 * Math.sin(wall / 180));
      this.glow.fillEllipse(this.player.x, this.player.y - 18, 60, 52);
    }
    if (!active) return;
    const perSec = P.hpRegenPerSec(p);
    p.hp = Math.min(max, p.hp + (perSec * delta) / 1000);
    const a = 0.25 + 0.15 * Math.sin(time / 200);
    this.glow.fillStyle(0x7dff9b, a).fillEllipse(this.player.x, this.player.y - 4, 44, 12);
    if (Math.random() < delta / 250) {
      const t = this.add.text(this.player.x + (Math.random() - 0.5) * 30, this.player.y - 20, '+', { fontFamily: 'monospace', fontSize: '14px', color: '#7dff9b', stroke: '#000', strokeThickness: 3 }).setDepth(12);
      this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 800, onComplete: () => t.destroy() });
    }
  }

  // ─────────────────────────── combat ───────────────────────────
  private buffActive(id: string) { return (Game.buffs[id] ?? 0) > Date.now(); }

  private trySwing(mult: number, mpCost: number, kind: 'basic' | 'power_strike'): boolean {
    const p = Game.player;
    const now = Game.now;
    const atkSpeed = this.buffActive('mint_sprig') ? 1 + (consumableEffect('mint_sprig').buff?.speedPct ?? 0) / 100 : 1;
    if (now < this.swingReadyAt) return false;
    if (p.mp < mpCost) { Game.toast('Not enough MP', 'warn'); this.swingReadyAt = now + 300; return false; }
    p.mp -= mpCost;
    this.swingReadyAt = now + P.attackIntervalMs(p) / atkSpeed;
    this.lastCombatAt = now;
    const facing = this.facing;
    // Damage lands on the impact frame, called from inside the animation: the basic smash coming down,
    // or the axe cut going level, so the visual and the hit cannot disagree.
    this.swingFx(kind, () => this.resolveSwing(mult, kind, facing));
    return true;
  }

  /** Hit detection at the moment the slash/smash connects. */
  private resolveSwing(mult: number, kind: 'basic' | 'power_strike', facing: number): void {
    if (Game.dead || !this.player) return;
    const p = Game.player;
    let best: Monster | null = null;
    let bestD = Infinity;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const dx = (m.x - this.player.x) * facing;
      const reach = ASSUME.meleeReach + m.halfW;
      if (dx < -18 || dx > reach || Math.abs(m.y - this.player.y) > 60) continue;
      if (dx < bestD) { bestD = dx; best = m; }
    }
    if (!best) {
      if (this.postInMelee()) this.hitPost(mult, kind);
      return;
    }
    const topY = best.y - best.displayHeight - 12;
    const hitX = best.x, hitY = best.y - best.displayHeight * 0.45;
    if (!rollHit(P.accuracy(p), best.feel.eva, p.level, best.def.level)) {
      this.floatText(best.x, topY, 'MISS', '#c8c8c8', 15);
      return;
    }
    const rage = this.buffActive('rage') ? Sk.rageNumbers(p).dealtPct : 0;
    const { dmg, crit } = computeHit(P.attack(p), mult, best.def.defense, P.critChance(p), rage);
    this.floatText(best.x, topY, `${dmg}`, crit ? '#ffcf33' : '#ffffff', crit ? 20 : 16);
    const feel = ATTACK_FEEL[kind];
    if (best.hurt(dmg, this.player.x, feel.kb, feel.hitstunMs)) this.onKill(best);
    Fx.hitSparks(this, hitX, hitY, crit);
    if (kind === 'power_strike') {
      Fx.impactFlash(this, hitX, hitY, 0xffe066, 34);
      Fx.hitStop(this, crit ? Fx.FX.hitstopSmash + 20 : Fx.FX.hitstopSmash);
      Fx.shake(this, crit ? 110 : 90, crit ? 0.007 : 0.005);
    } else {
      Fx.hitStop(this, crit ? Fx.FX.hitstopCrit : Fx.FX.hitstopBasic);
      if (crit) { Fx.impactFlash(this, hitX, hitY, 0xffe066, 24); Fx.shake(this, 70, 0.0045); }
    }
  }

  private swingFx(kind: string, onImpact?: () => void) {
    const s = this.sword;
    this.tweens.killTweensOf(s);
    this.tweens.killTweensOf(this.player);
    this.player.setScale(this.playerBaseScale.x, this.playerBaseScale.y);
    const ox = this.player.x;
    const oy = this.player.y - 26;
    const reach = ASSUME.meleeReach;
    if (kind === 'power_strike') {
      // v0.2.6: a forward axe cut from the rear hip; the body steps into the blow.
      s.setVisible(false);
      Fx.axeSwing(this, ox, oy, this.facing, reach, this.groundY + 4, onImpact);
      const pb = this.player.body as Phaser.Physics.Arcade.Body;
      this.knockUntil = Game.now + 110;
      pb.setVelocityX(this.facing * 150);
      this.tweens.add({
        targets: this.player,
        scaleX: this.playerBaseScale.x * 1.1,
        scaleY: this.playerBaseScale.y * 0.95,
        duration: Fx.FX.axeWindupMs + Fx.FX.axeImpactMs * 0.6,
        yoyo: true,
        ease: 'Cubic.easeIn',
        onComplete: () => this.player.setScale(this.playerBaseScale.x, this.playerBaseScale.y),
      });
      return;
    }
    if (kind === 'basic') {
      // v0.2.7: the normal attack is a quick swing / slash that reaches the real melee range (70 px).
      s.setVisible(true).setFlipX(this.facing < 0).setTint(0xffffff);
      s.setPosition(this.player.x + this.facing * 14, this.player.y - 18);
      s.setAngle(-80 * this.facing);
      this.tweens.add({
        targets: s, angle: 70 * this.facing, duration: Fx.FX.basicMs, ease: 'Cubic.easeIn',
        onComplete: () => s.setVisible(false),
      });
      Fx.slashArc(this, ox, oy, this.facing, { reach, duration: Fx.FX.basicMs, onImpact });
      this.tweens.add({
        targets: this.player,
        scaleX: this.playerBaseScale.x * 1.06,
        scaleY: this.playerBaseScale.y * 0.97,
        duration: Math.floor(Fx.FX.basicMs * 0.45),
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: () => this.player.setScale(this.playerBaseScale.x, this.playerBaseScale.y),
      });
      return;
    }
    // Skills draw their own FX in castStrike; keep a short body punch so the character reacts.
    s.setVisible(false);
    this.tweens.add({
      targets: this.player,
      scaleX: this.playerBaseScale.x * 1.05,
      scaleY: this.playerBaseScale.y * 0.97,
      duration: 70,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => this.player.setScale(this.playerBaseScale.x, this.playerBaseScale.y),
    });
  }

  private useHotbar(slot: number) {
    const id = Sk.barOf(Game.player)[slot];
    if (!id) { Game.toast('Empty slot — bind a skill or a potion from K or I', 'info'); return; }
    if (Sk.isHotbarSkill(id)) this.useSkill(id);
    else if (Sk.isHotbarItem(id)) this.useItem(id);
    else Game.toast('Empty slot', 'info');
  }

  useSkill(id: string) {
    const s = Sk.skill(id);
    const p = Game.player;
    const now = Date.now();
    if (!s || !Sk.known(p, id)) { Game.toast('Skill not learned yet — visit Calden', 'warn'); return; }
    const readyAt = Game.cooldowns[id] ?? 0;
    if (readyAt > now) {
      // v0.2.6: no queue. A press on cooldown is ignored and silent, except one banner per cooldown
      // when more than 5 seconds remain (Rage's 60 s, Soul Guard's 30 s).
      if (readyAt - now > 5000 && this.cdBanner[id] !== readyAt) {
        this.cdBanner[id] = readyAt;
        Game.toast(`${s.name} is on cooldown`, 'warn');
      }
      return;
    }
    if (p.mp < s.mp_cost) {
      Game.toast('Not enough MP', 'warn');
      return;
    }

    const kind = (['power_strike', 'earthbreaker', 'flame_cleave'].includes(id) ? id : 'basic') as keyof typeof ATTACK_FEEL;
    const mul = Sk.damageMul(id, Sk.rankOf(p, id));
    let ok = false;
    if (id === 'rage') {
      p.mp -= s.mp_cost;
      this.lastCombatAt = Game.now;
      Game.buffs.rage = now + (s.duration_s ?? 60) * 1000;
      const { dealtPct, takenPct } = Sk.rageNumbers(p);
      Game.toast(`Rage! +${dealtPct}% dealt, +${takenPct}% taken for ${s.duration_s}s`, 'info');
      Fx.rageBurst(this, this.player.x, this.player.y - 22);
      ok = true;
    } else if (id === 'soul_guard') {
      p.mp -= s.mp_cost;
      this.lastCombatAt = Game.now;
      Game.shield = Sk.shieldAmount(p);
      Game.buffs.soul_guard = now + (s.duration_s ?? 20) * 1000;
      Game.toast(`Soul Guard: ${Game.shield} HP shield`, 'info');
      ok = true;
    } else if (id === 'earthbreaker') {
      ok = this.castStrike(mul, s.mp_cost, 'earthbreaker', { aoe: 90, stun: true });
    } else if (id === 'flame_cleave') {
      ok = this.castStrike(mul, s.mp_cost, 'flame_cleave', { wide: 110, burnS: s.duration_s ?? 3 });
    } else if (id === 'root_lash') {
      ok = this.castStrike(mul, s.mp_cost, 'root_lash', { wide: 110, tint: 0x5a8a3a, kbIf: (m) => !m.def.is_boss });
    } else if (id === 'dig_in') {
      p.mp -= s.mp_cost;
      this.lastCombatAt = Game.now;
      const ms = Sk.digInWindowMs(p);
      Game.buffs.dig_in = now + ms; // wall clock, same as buffActive
      Game.toast(`Dig In! +50% defense for ${Math.round(ms / 1000)}s`, 'info');
      Fx.digStamp(this, this.player.x, this.groundY);
      ok = true;
    } else {
      ok = this.trySwing(mul, s.mp_cost, kind === 'power_strike' ? 'power_strike' : 'basic');
    }
    // A press while a swing is still recovering is "not ready": ignored, never queued.
    if (ok) Game.cooldowns[id] = now + Sk.cooldownOf(id);
    Game.changed();
  }

  /** Multi-target skill strike (Earthbreaker AoE, Flame Cleave wide swing). */
  private castStrike(mul: number, mpCost: number, kind: keyof typeof ATTACK_FEEL, opt: { aoe?: number; wide?: number; burnS?: number; stun?: boolean; tint?: number; kbIf?: (m: Monster) => boolean }): boolean {
    const p = Game.player;
    const now = Game.now;
    if (now < this.swingReadyAt) return false;
    if (p.mp < mpCost) { Game.toast('Not enough MP', 'warn'); this.swingReadyAt = now + 300; return false; }
    p.mp -= mpCost;
    this.swingReadyAt = now + 250;
    this.lastCombatAt = now;
    const facing = this.facing;
    this.swingFx(kind);
    if (kind === 'earthbreaker') Fx.earthShock(this, this.player.x, this.groundY, facing, opt.aoe ?? 90);
    if (kind === 'flame_cleave') Fx.flameFan(this, this.player.x, this.player.y - 24, facing, opt.wide ?? 110, this.groundY + 4);
    if (kind === 'root_lash') Fx.rootWhip(this, this.player.x, this.groundY, facing, opt.wide ?? 110);
    if (kind === 'flame_cleave') {
      // v0.2.6: damage is timed to the fire front reaching each target, not to the key press.
      const range = opt.wide ?? 110;
      const ox = this.player.x;
      for (const m of this.monsters) {
        if (!m.alive) continue;
        const dx = m.x - ox;
        const dy = Math.abs(m.y - this.player.y);
        if (!(dx * facing > -20 && Math.abs(dx) <= range + m.halfW && dy < 70)) continue;
        this.time.delayedCall(Fx.flameArrivalMs(Math.abs(dx), range + m.halfW), () => this.resolveStrike(mul, kind, facing, opt, { targets: [m], post: false }));
      }
      this.time.delayedCall(Fx.FX.flameMs, () => this.resolveStrike(mul, kind, facing, opt, { targets: [], post: true }));
      return true;
    }
    const impactMs = kind === 'earthbreaker' ? Fx.FX.earthImpactMs : Fx.FX.rootImpactMs;
    this.time.delayedCall(impactMs, () => this.resolveStrike(mul, kind, facing, opt));
    return true; // spent MP even if nobody was in range
  }

  private resolveStrike(mul: number, kind: keyof typeof ATTACK_FEEL, facing: number, opt: { aoe?: number; wide?: number; burnS?: number; stun?: boolean; tint?: number; kbIf?: (m: Monster) => boolean }, only?: { targets: Monster[]; post: boolean }): void {
    if (Game.dead || !this.player) return;
    const p = Game.player;
    const feel = ATTACK_FEEL[kind] ?? ATTACK_FEEL.basic;
    const rage = this.buffActive('rage') ? Sk.rageNumbers(p).dealtPct : 0;
    let any = false;
    let anyCrit = false;
    for (const m of only ? only.targets : this.monsters) {
      if (!m.alive) continue;
      const dx = m.x - this.player.x;
      const dy = Math.abs(m.y - this.player.y);
      const inAoe = opt.aoe != null && Math.hypot(dx, dy) <= opt.aoe + m.halfW;
      const inWide = opt.wide != null && dx * facing > -20 && Math.abs(dx) <= opt.wide + m.halfW && dy < 70;
      if (!only && !inAoe && !inWide) continue;
      const topY = m.y - m.displayHeight - 12;
      const hitX = m.x, hitY = m.y - m.displayHeight * 0.45;
      if (!rollHit(P.accuracy(p), m.feel.eva, p.level, m.def.level)) { this.floatText(m.x, topY, 'MISS', '#c8c8c8', 15); continue; }
      // v0.2.6 affinity: Weak = ×1.5, Immune = nothing lost.
      const aff = affinityOf(m.def.id, SKILL_SCHOOL[kind]);
      if (aff === 'immune') {
        this.floatText(m.x, topY, 'Immune', '#9fd8ff', 15);
        m.provoke();
        if (kind === 'flame_cleave') Fx.impactFlash(this, hitX, hitY, 0x9fd8ff, 14);
        continue;
      }
      let { dmg, crit } = computeHit(P.attack(p), mul, m.def.defense, P.critChance(p), rage);
      if (aff === 'weak') { dmg = weakDamage(dmg); this.floatText(m.x, topY - 16, 'Weak!', '#ff9a3a', 11); }
      this.floatText(m.x, topY, `${dmg}`, crit ? '#ffcf33' : aff === 'weak' ? '#ff9a3a' : '#ffb070', crit ? 20 : aff === 'weak' ? 18 : 16);
      if (kind === 'flame_cleave') Fx.fireBloom(this, hitX, hitY);
      const stun = feel.hitstunMs;
      const kb = opt.kbIf && !opt.kbIf(m) ? 0 : feel.kb;
      if (m.hurt(dmg, this.player.x, kb, stun)) this.onKill(m);
      else if (opt.burnS && m.alive) this.applyBurn(m, Math.max(1, Math.floor(dmg * 0.35)), opt.burnS);
      Fx.hitSparks(this, hitX, hitY, crit, kind === 'flame_cleave' ? 0xff8020 : kind === 'root_lash' ? 0x8abc4a : 0xe8d2a0);
      if (kind === 'earthbreaker') Fx.impactFlash(this, hitX, this.groundY - 8, 0xdbc08a, 26);
      any = true;
      if (crit) anyCrit = true;
    }
    if (any) Fx.hitStop(this, anyCrit ? Fx.FX.hitstopSkill + 20 : Fx.FX.hitstopSkill);
    if ((!only || only.post) && this.postInStrike(opt)) this.hitPost(mul, kind === 'basic' || kind === 'power_strike' ? kind : 'basic');
  }

  private applyBurn(m: Monster, total: number, seconds: number) {
    this.burns = this.burns.filter((b) => b.m !== m);
    const ticks = Math.max(1, Math.round(seconds / 0.5));
    this.burns.push({ m, perTick: Math.max(1, Math.floor(total / ticks)), next: Game.now + 500, until: Game.now + seconds * 1000 });
    m.setTint(0xff6020);
  }
  private tickBurns(now: number) {
    this.burns = this.burns.filter((b) => {
      if (!b.m.active || !b.m.alive || now > b.until) { if (b.m.active && b.m.alive && !this.buffActive('rage')) b.m.restoreTint(); return false; }
      if (now >= b.next) {
        b.next = now + 500;
        if (b.m.hurt(b.perTick, b.m.x, 0, 0)) this.onKill(b.m);
        else this.floatText(b.m.x, b.m.y - b.m.displayHeight - 8, `${b.perTick}`, '#ff8020', 12);
      }
      return true;
    });
  }

  /** Ranged monsters: a slow, visible pebble aimed at chest height (jump over it or walk away). */
  private fireShot(m: Monster) {
    const dir = Math.sign(this.player.x - m.x) || 1;
    const y = m.y - m.displayHeight * 0.55;
    const img = fitSlot(this, this.add.image(m.x + dir * m.halfW, y, 'fx.pebble').setDepth(11), 'fx.pebble');
    const ty = this.player.y - 24; // chest height at release time
    const dist = Math.max(40, Math.abs(this.player.x - m.x));
    const vy = Phaser.Math.Clamp(((ty - y) / dist) * RANGED.projectileSpeed, -80, 80);
    this.shots.push({ img, vx: dir * RANGED.projectileSpeed, vy, dieAt: Game.now + RANGED.projectileLifeMs, m });
  }

  private updateShots(time: number, delta: number) {
    this.shots = this.shots.filter((s) => {
      s.img.x += (s.vx * delta) / 1000;
      s.img.y += (s.vy * delta) / 1000;
      s.img.angle += delta * 0.6;
      const hit = !Game.dead && Math.abs(s.img.x - this.player.x) < RANGED.hitRadius + 6 && s.img.y > this.player.y - 46 && s.img.y < this.player.y + 2;
      if (hit) this.monsterSwings(s.m, s.img.x);
      if (hit || time > s.dieAt || s.img.y > this.groundY + 10) {
        this.tweens.add({ targets: s.img, alpha: 0, scale: s.img.scale * 1.6, duration: 120, onComplete: () => s.img.destroy() });
        return false;
      }
      return true;
    });
  }

  /** Body-on-body overlap between a mob and the player. */
  private touching(m: Monster): boolean {
    const a = m.body2;
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  /** A swing, a pebble, or (contact) a bump. A bump is CONTACT.fraction of a swing, physical, with a small nudge and no miss roll. */
  private monsterSwings(m: Monster, fromX = m.x, contact = false) {
    const p = Game.player;
    if (Game.dead || Game.now < Game.invulnUntil) return;
    if (!contact && !rollHit(m.feel.acc, P.evasion(p), m.def.level, p.level, HIT_MONSTER)) {
      this.floatText(this.player.x, this.player.y - 60, 'MISS', '#c8c8c8', 14);
      return;
    }
    this.lastCombatAt = Game.now;
    const taken = this.buffActive('rage') ? Sk.rageNumbers(p).takenPct : 0;
    const digging = this.buffActive('dig_in');
    const matk = rollMonsterAttack(m.def.attack, m.def.attack_min, m.def.attack_max) * (contact ? CONTACT.fraction : 1);
    let dmg = p.cheats.god ? 0 : incomingDamage(matk, P.defense(p) * (digging ? 1.5 : 1), taken);
    if (Game.shield > 0 && (Game.buffs.soul_guard ?? 0) > Date.now()) {
      const absorbed = Math.min(Game.shield, dmg);
      Game.shield -= absorbed;
      dmg -= absorbed;
      this.floatText(this.player.x, this.player.y - 78, absorbed ? `shield -${absorbed}` : '', '#9fe0ff', 12);
      if (Game.shield <= 0) { Game.shield = 0; delete Game.buffs.soul_guard; }
    }
    p.hp -= dmg;
    Game.invulnUntil = Game.now + ASSUME.hurtInvulnMs;
    this.knockUntil = Game.now + 200;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const nudge = contact ? CONTACT.kbScale : 1;
    body.setVelocity(Math.sign(this.player.x - fromX || 1) * PLAYER_HIT_KB.vx * nudge, PLAYER_HIT_KB.vy * nudge);
    this.floatText(this.player.x, this.player.y - 60, p.cheats.god ? 'GOD' : `-${dmg}`, digging ? '#c4a06a' : '#ff6b6b', 16);
    if (p.hp <= 0) this.die();
  }

  onKill(m: Monster) {
    const p = Game.player;
    const lv = P.gainXp(p, m.def.xp);
    this.floatText(m.x, m.y - m.displayHeight - 30, `+${m.def.xp} XP`, '#9be7ff', 13);
    if (lv > 0) this.levelUpFx(lv);
    Q.onKill(p, m.def.id);
    Q.onLevel(p);
    // v0.2.3: guaranteed 5–15 Copper on Wool-Shoulder, in on-kill so a droprate bonus cannot multiply it.
    if (m.def.id === 'wool_shoulder') {
      const n = 5 + Math.floor(Math.random() * 11);
      p.coins += n;
      Game.toast(`${n} Copper`, 'loot', 'copper_coin');
    }
    const rolled = rollDrops(m.def.id, p.cheats.dropMul, p);
    // v0.2.6: the first Ember Beetle killed at level 6+ always drops a Smoldering Scale (once per character),
    // so a ready player can never be locked out of Hot Edge.
    if (['ember_beetle', 'cinderback'].includes(m.def.id) && p.level >= 6 && !p.questFlags.scale_seen && !(p.inventory.smoldering_scale ?? 0)
      && !rolled.some((d) => d.itemId === 'smoldering_scale')) {
      rolled.push({ itemId: 'smoldering_scale', qty: 1, rare: true });
    }
    if (p.level >= 6 && rolled.some((d) => d.itemId === 'smoldering_scale')) p.questFlags.scale_seen = true; // dropped for a ready player: counts
    for (const d of rolled) this.spawnDrop(m.x, m.y - 20, d.itemId, d.qty, d.rare, d.inst);
    Game.changed();
  }

  levelUpFx(levels: number) {
    const p = Game.player;
    Game.invulnUntil = Game.now + ASSUME.levelUpInvulnMs;
    Game.events.emit('levelup', p.level, f('player_points_per_level') * levels);
    Q.onLevel(p);
    playSfx('levelup');
    // burst: golden ring + sparks around the player
    const cx = this.player.x, cy = this.player.y - 24;
    const ring = this.add.circle(cx, cy, 10, 0xffe066, 0).setStrokeStyle(4, 0xffe066, 0.9).setDepth(13);
    this.tweens.add({ targets: ring, radius: 90, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onUpdate: () => ring.setStrokeStyle(4 * ring.alpha + 1, 0xffe066, ring.alpha), onComplete: () => ring.destroy() });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const sp = this.add.rectangle(cx, cy, 4, 4, i % 2 ? 0xffe066 : 0xffffff).setDepth(13);
      this.tweens.add({ targets: sp, x: cx + Math.cos(a) * (60 + Math.random() * 40), y: cy + Math.sin(a) * (50 + Math.random() * 30) - 10, alpha: 0, angle: 180, duration: 700 + Math.random() * 300, ease: 'Cubic.easeOut', onComplete: () => sp.destroy() });
    }
    const beam = this.add.rectangle(cx, this.player.y, 46, 220, 0xfff2a8, 0.35).setOrigin(0.5, 1).setDepth(7);
    this.tweens.add({ targets: beam, alpha: 0, scaleX: 0.2, duration: 900, onComplete: () => beam.destroy() });
    Game.save();
  }

  /** Drop a stack (or a gear instance, if `uid` is given) onto the ground. */
  dropFromBag(itemId: string, qty: number, uid?: string): boolean {
    if (Game.dead) return false;
    let inst: GearInstance | undefined;
    if (uid) {
      inst = P.removeGear(Game.player, uid) ?? undefined;
      if (!inst) return false;
      itemId = inst.itemId; qty = 1;
    } else if (!P.removeItem(Game.player, itemId, qty)) return false;
    const d = this.spawnDrop(this.player.x + this.facing * 26, this.player.y - 30, itemId, qty, !!inst?.magic, inst);
    d.setVelocity(this.facing * 60, -180);
    Game.changed();
    Game.save();
    return true;
  }

  spawnDrop(x: number, y: number, itemId: string, qty: number, rare: boolean, inst?: GearInstance): Drop {
    const key = iconKey(itemId);
    const d = this.drops.create(x + (Math.random() - 0.5) * 30, y, key) as Drop;
    fitSlot(this, d, key, { w: DROP_SIZE, h: DROP_SIZE });
    d.setDepth(9);
    d.itemId = itemId;
    d.qty = qty;
    d.rare = rare;
    d.inst = inst;
    if (inst?.magic) d.setTint(0x9ec8ff);
    d.expireAt = Game.now + ASSUME.dropLifetimeMs;
    d.setVelocity((Math.random() - 0.5) * 160, -260);
    d.setBounce(0.2);
    d.setDragX(300);
    if (rare) {
      d.setTint(0xffe9a8);
      this.tweens.add({ targets: d, alpha: 0.55, yoyo: true, repeat: -1, duration: 400 });
    }
    return d;
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

  /** Use a consumable (from hotkey or inventory). */
  useItem(id: string) {
    const p = Game.player;
    if (Game.dead) return;
    if ((Game.cooldowns.potion ?? 0) > Date.now()) return;
    const eff = consumableEffect(id);
    if (!eff.hp && !eff.mp && !eff.buff) return;
    if (eff.buff && this.buffActive(id)) { Game.toast(`${DB.items[id].name} is already active`, 'warn'); return; }
    if (!P.removeItem(p, id)) return;
    P.applyConsumable(p, eff);
    if (eff.buff) Game.buffs[id] = Date.now() + eff.buff.durationS * 1000;
    Game.cooldowns.potion = Date.now() + ASSUME.potionCooldownMs;
    const parts = [eff.hp && `+${eff.hp} HP`, eff.mp && `+${eff.mp} MP`, eff.buff && `+${eff.buff.speedPct}% speed`].filter(Boolean);
    this.floatText(this.player.x, this.player.y - 60, parts.join(' '), '#7dff9b', 14);
    Game.changed();
  }

  /** Pop up, then fly to the player along a short arc (same bounce-y feel as a drop), then toast. */
  private pickupDrop(d: Drop, delay = 0) {
    d.picking = true;
    const body = d.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) body.enable = false;
    const popY = d.y - 28;
    this.tweens.add({
      targets: d, y: popY, duration: 140, delay, ease: 'Quad.easeOut',
      onComplete: () => {
        const fromX = d.x;
        const fromY = d.y;
        const fly = { t: 0 };
        this.tweens.add({
          targets: fly, t: 1, duration: 400, ease: 'Cubic.easeInOut',
          onUpdate: () => {
            if (!d.active) return;
            const t = fly.t;
            const tx = this.player.x;
            const ty = this.player.y - 28;
            const arc = Math.sin(t * Math.PI) * 26;
            d.x = fromX + (tx - fromX) * t;
            d.y = fromY + (ty - fromY) * t - arc;
            d.setScale(1 - t * 0.28);
            d.setAlpha(1 - t * 0.12);
          },
          onComplete: () => {
            if (!d.active) return;
            if (d.inst) P.addGear(Game.player, d.inst);
            else {
              P.addItem(Game.player, d.itemId, d.qty);
              Q.onItem(Game.player, d.itemId);
            }
            const name = d.inst ? displayName(d.inst) : (DB.items[d.itemId].name === 'Copper Coin' ? 'Copper' : DB.items[d.itemId].name);
            const suffix = d.inst ? (d.inst.magic ? '  (magic)' : '') : ` ×${d.qty}`;
            Game.toast(`${name}${suffix}`, d.inst?.magic || d.rare ? 'rare' : 'loot', d.itemId);
            playSfx('pickup');
            d.destroy();
            Game.changed();
          },
        });
      },
    });
  }

  // ───────────────────────── interaction ─────────────────────────
  private nearbyDrops(): Drop[] {
    return (this.drops.getChildren() as Drop[]).filter(
      (d) => Phaser.Math.Distance.Between(d.x, d.y, this.player.x, this.player.y - 20) < ASSUME.pickupRadius,
    );
  }
  private nearNpc() { return this.npcs.find((n) => Math.abs(n.x - this.player.x) < 40); }
  private nearChest() { return this.chestX !== null && Math.abs(this.chestX - this.player.x) < 36; }
  private nearPortal() { return this.portals.find((pt) => Math.abs(pt.x - this.player.x) < 34); }
  /** Close enough to talk to / arrive at the practice post (interact and quest-reach). */
  private nearPost() { return this.postX !== null && Math.abs(this.postX - this.player.x) < 40; }

  /** Same melee window as a monster: in front, within reach, not only while standing on the post. */
  private postInMelee(): boolean {
    if (this.postX === null) return false;
    const dx = (this.postX - this.player.x) * this.facing;
    const reach = ASSUME.meleeReach + 20; // practice_post is 40px wide
    return dx >= -18 && dx <= reach && Math.abs(this.player.y - (this.groundY + 4)) < 80;
  }

  /** Roll a real hit against the post (defense 0) and count a dummy swing if the quest needs one. */
  private hitPost(mult: number, kind: string) {
    const p = Game.player;
    const rage = this.buffActive('rage') ? Sk.rageNumbers(p).dealtPct : 0;
    const { dmg, crit } = computeHit(P.attack(p), mult, 0, P.critChance(p), rage);
    const x = this.postX ?? this.player.x;
    this.floatText(x, this.player.y - 80, `${dmg}`, crit ? '#ffcf33' : '#ffffff', crit ? 20 : 16);
    if (kind === 'basic' && Q.dummyNeeded(p)) Q.onDummyHit(p);
  }

  /** AoE / wide skills can also tag the post. */
  private postInStrike(opt: { aoe?: number; wide?: number }): boolean {
    if (this.postX === null) return false;
    const dx = this.postX - this.player.x;
    const dy = Math.abs(this.player.y - (this.groundY + 4));
    if (opt.aoe != null && Math.hypot(dx, dy) <= opt.aoe + 20) return true;
    if (opt.wide != null && dx * this.facing > -20 && Math.abs(dx) <= opt.wide + 20 && dy < 70) return true;
    return this.postInMelee();
  }

  /** Spawn a named quest foe only while its kill-step is active and it is not already here. */
  private ensureNamed() {
    for (const n of this.geo.namedSpawns ?? []) {
      if (this.monsters.some((m) => m.def.id === n.id && m.alive)) continue;
      if (Q.shouldSpawn(Game.player, n.id)) {
        this.spawnMonster(n.id, n.x * TILE);
        if (n.id === 'bank_cracker') Game.toast('Bank-Cracker claws out of the bank.', 'rare');
        if (n.id === 'cinderback') Game.toast('Cinderback claws out of the bank.', 'rare');
        if (n.id === 'wool_shoulder') Game.toast('Wool-Shoulder shoulders out of the flock.', 'rare');
      }
    }
  }

  private interact() {
    const drops = this.nearbyDrops().filter((d) => !d.picking);
    if (drops.length) {
      drops.forEach((d, i) => this.pickupDrop(d, i * 40));
      return;
    }
    if (this.nearPost()) {
      const msg = Q.interactPost(Game.player);
      if (msg) Game.toast(msg, 'info');
      return;
    }
    const npc = this.nearNpc();
    if (npc) { Game.events.emit('npc', npc.id, npc.role, npc.name); return; }
    if (this.nearChest()) { Game.events.emit('chest'); return; }
    const portal = this.nearPortal();
    if (portal) {
      if (!portal.target) { Game.toast('That path is not open yet.', 'info'); return; }
      this.travel(portal.target, portal.arriveX);
    }
  }

  travel(area: string, x?: number) {
    Game.events.emit('close-all');
    this.scene.restart({ area, x: x ?? AREAS[area]?.spawnX });
  }

  /** Quest markers above NPCs; hidden while any window (including the conversation) is open. */
  private updateMarkers(time: number) {
    if (!this.npcs.length || time - this.lastMarkerAt < 120) return;
    this.lastMarkerAt = time;
    for (const n of this.npcs) {
      if (!n.marker) continue;
      const m = Game.menuOpen ? null : Q.markerFor(Game.player, n.id);
      if (!m) { n.marker.setVisible(false); continue; }
      n.marker.setText(m).setColor(m === '!' ? '#ffd23a' : '#fff4b8').setVisible(true);
    }
  }

  private updatePrompt() {
    let text = '';
    if (this.nearbyDrops().length) text = 'E: pick up';
    else if (this.nearPost()) text = 'E: practice';
    else if (this.nearNpc()) text = `E: talk to ${this.nearNpc()!.name.split(' ')[0]}`;
    else if (this.nearChest()) text = 'E: open storage';
    else if (this.nearPortal()) text = this.nearPortal()!.target ? 'E: enter' : 'Closed (later)';
    this.prompt.setText(text).setVisible(!!text && !Game.dead && !Game.menuOpen).setPosition(this.player.x, this.player.y - 56);
  }

  floatText(x: number, y: number, text: string, color: string, size: number) {
    const t = this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 4, fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
