import Phaser from 'phaser';
import { DB, f, consumableEffect } from '../data/db';
import { ASSUME, TILE, ATTACK_FEEL, PLAYER_HIT_KB, HIT_MONSTER, CONTACT, SKILL_SCHOOL, BOLT } from '../data/assumptions';
import { AREAS, AREA_ALIAS, AreaGeometry } from '../world/areas';
import { maraSlap } from './world/slap';
import { groundAt, zoneBounds, splitCount, spawnHeight } from '../world/surface';
import { createMonster } from '../entities/mobs';
import { buildAmbient } from './world/ambient';
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
import { buildTerrain, GROUND_H } from './world/terrain';
import { playerInput, regen, die } from './world/player';
import { fireShot, updateShots } from './world/projectiles';
import { buildNpcs, updateMarkers, ensureNamed } from './world/npcs';


interface Drop extends Phaser.Physics.Arcade.Image { itemId: string; qty: number; expireAt: number; rare: boolean; inst?: GearInstance; picking?: boolean }
interface Shot { img: Phaser.GameObjects.Image; vx: number; vy: number; dieAt: number; m: Monster; spin?: number }
/** A Magician Path projectile in flight (v0.2.8). */
interface Bolt { kind: Fx.BoltKind; head: Phaser.GameObjects.Container; vx: number; vy: number; dir: number; mul: number; travelled: number }

export class WorldScene extends Phaser.Scene {
  areaId = 'meadow_town';
  geo!: AreaGeometry;
  groundY = 0;
  ground!: Phaser.GameObjects.Rectangle;
  player!: Phaser.Physics.Arcade.Sprite;
  controls!: Controls;
  monsters: Monster[] = [];
  drops!: Phaser.Physics.Arcade.Group;
  facing = 1;
  swingReadyAt = 0;
  npcs: { x: number; id: string; role: string; name: string; marker?: Phaser.GameObjects.Text }[] = [];
  lastMarkerAt = 0;
  wasMenu = false;
  portals: { x: number; y: number; dir: string; arriveX: number; arriveY?: number; target?: string }[] = [];
  prompt!: Phaser.GameObjects.Text;
  sword!: Phaser.GameObjects.Image;
  glow!: Phaser.GameObjects.Graphics;
  lastSave = 0;
  lastCombatAt = 0;
  knockUntil = 0;
  walkT = 0;
  playerBaseScale = { x: 1, y: 1 };
  burns: { m: Monster; perTick: number; next: number; until: number }[] = [];
  shots: Shot[] = [];
  bolts: Bolt[] = [];
  chestX: number | null = null;
  chestImg?: Phaser.GameObjects.Image;
  postX: number | null = null;
  lastQuestAt = 0;
  pendingAttack = false;
  /** v0.2.6: the readyAt of the cooldown we already showed a banner for (so a mash stays quiet). */
  cdBanner: Record<string, number> = {};
  platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  /** v0.3.0 solid terrain steps. */
  blockGroup!: Phaser.Physics.Arcade.StaticGroup;
  /** v0.3.0 ladders, ropes and vines (px; top/bottom are feet heights). */
  climbs: { x: number; top: number; bottom: number; kind: string }[] = [];
  /** The climb the player is on, if any. */
  climbing: { x: number; top: number; bottom: number; kind: string } | null = null;
  /** Down + jump: one-way ledges let the player through until this time. */
  dropUntil = 0;
  waterBands: { x: number; w: number; y: number; bog: boolean }[] = [];
  /** Arrival height (px, feet) from a portal on a ledge. */
  arriveY?: number;

  constructor() { super('World'); }

  init(data: { area?: string; x?: number; y?: number }) {
    const want = data.area ? AREA_ALIAS[data.area] ?? data.area : undefined;
    this.areaId = want && AREAS[want] ? want : 'meadow_town';
    this.arriveY = data.y;
    this.climbs = [];
    this.climbing = null;
    this.waterBands = [];
    this.geo = AREAS[this.areaId];
    Game.player.area = this.areaId;
    if (data.x !== undefined) Game.player.x = data.x;
    this.monsters = [];
    this.npcs = [];
    this.portals = [];
    this.shots = [];
    this.bolts = [];
    this.burns = [];
    this.chestX = null;
    this.chestImg = undefined;
    this.postX = null;
  }

  create() {
    const W = this.geo.widthTiles * TILE;
    // v0.3.0: tall areas (vertical levels) scroll up; the base ground is always at the bottom.
    const H = Math.max(this.scale.height, (this.geo.heightTiles ?? 0) * TILE);
    this.groundY = H - GROUND_H;
    this.cameras.main.setBackgroundColor(this.geo.sky);
    this.physics.world.setBounds(0, 0, W, H);
    this.physics.world.gravity.y = ASSUME.gravity;
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.scrollY = H - this.scale.height;
    this.cameras.main.roundPixels = true;

    const area = DB.areas[this.areaId];
    const { platforms, groundY } = buildTerrain(this, W, area);

    buildNpcs(this, groundY);

    // Player.
    const px = Phaser.Math.Clamp(Game.player.x, 40, W - 40);
    // Arrive on the portal's ledge, else on top of whatever solid ground is under x.
    const py = this.arriveY != null ? groundY - this.arriveY * TILE - 2 : groundY - groundAt(this.geo, px / TILE) * TILE - 2;
    this.player = this.physics.add.sprite(px, py, 'player.warrior').setOrigin(0.5, 1).setDepth(10);
    fitSlot(this, this.player, 'player.warrior');
    this.playerBaseScale = { x: this.player.scaleX, y: this.player.scaleY };
    applyBody(this.player, 'player.warrior');
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.blockGroup, undefined, () => !this.climbing);
    this.physics.add.collider(this.player, platforms, undefined, (pl, plat) => {
      if (this.climbing || Game.now < this.dropUntil) return false;
      const b = (pl as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
      const pb = (plat as Phaser.GameObjects.TileSprite).body as Phaser.Physics.Arcade.StaticBody;
      return b.velocity.y >= 0 && b.bottom <= pb.top + 10;
    });
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 60);
    this.sword = fitSlot(this, this.add.image(0, 0, 'fx.sword').setDepth(11).setVisible(false).setOrigin(0.5, 0.9), 'fx.sword');
    this.glow = this.add.graphics().setDepth(9);

    // Monsters (types + counts from map_layout.spawn_counts).
    if (!this.geo.safe && area) {
      // v0.3.0: each zone sits on one level; its mobs patrol that surface only.
      for (const [mid, count] of Object.entries(area.spawns)) {
        const zones = this.geo.spawnZones[mid];
        if (!zones) continue;
        const counts = splitCount(zones, count);
        zones.forEach((z, zi) => {
          const b = zoneBounds(this.geo, z);
          const n = counts[zi];
          for (let i = 0; i < n; i++) {
            const xt = b.x0 + ((b.x1 - b.x0) * (i + 0.5)) / n + (Math.random() - 0.5) * Math.min(2, (b.x1 - b.x0) / n);
            this.spawnMonster(mid, xt * TILE, [b.x0 * TILE, b.x1 * TILE], { y: b.y, ledge: b.ledge, fly: z.fly });
          }
        });
      }
      ensureNamed(this);
    }

    this.drops = this.physics.add.group();
    this.physics.add.collider(this.drops, this.ground);
    this.physics.add.collider(this.drops, platforms);
    this.physics.add.collider(this.drops, this.blockGroup);
    buildAmbient(this);

    this.prompt = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fff', backgroundColor: '#000a', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1).setDepth(30).setVisible(false);

    this.controls = new Controls(this);
    const onUse = (id: string) => this.useItem(id);
    const onKb = (on: boolean) => {
      const kb = this.input.keyboard!;
      kb.enabled = on;
      if (on) kb.enableGlobalCapture(); else { kb.disableGlobalCapture(); kb.resetKeys(); }
    };
    const onSlap = (dmg: number) => maraSlap(this, dmg);
    Game.events.on('use-item', onUse);
    Game.events.on('keyboard', onKb);
    Game.events.on('mara-slap', onSlap);
    Game.scene = this;
    this.events.once('shutdown', () => {
      Game.events.off('use-item', onUse);
      Game.events.off('keyboard', onKb);
      Game.events.off('mara-slap', onSlap);
      this.monsters.forEach((m) => m.destroy());
      this.monsters = [];
    });
    if (Game.consoleOpen) onKb(false);

    Game.events.emit('area', DB.areas[this.areaId]?.name ?? this.areaId);
    Game.changed();
    Game.save();
  }

  /** opts.y: surface height in tiles (default: the solid ground under x). ledge: patrol only that surface. fly: hover tiles. */
  spawnMonster(id: string, x: number, patrol?: [number, number], opts: { y?: number; ledge?: boolean; fly?: number } = {}): Monster | null {
    const def = DB.monsters[id];
    if (!def) return null;
    const cx = Phaser.Math.Clamp(x, 40, this.geo.widthTiles * TILE - 40);
    const yt = spawnHeight(this.geo, cx / TILE, opts.y);
    const m = createMonster(this, def, cx, this.groundY + 4 - yt * TILE, patrol, { ledge: opts.ledge, fly: opts.fly, arena: this.geo.arena, camp: this.geo.camp, terrain: { geo: this.geo, groundY: this.groundY + 4 } });
    m.strikePlayer = (mult, fromX) => this.monsterSwings(m, fromX, false, mult);
    m.setDepth(8);
    this.physics.add.collider(m, this.ground);
    this.physics.add.collider(m, this.blockGroup);
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

    playerInput(this, time, delta, menu);

    if (!Game.dead) {
      p.mp = Math.min(P.maxMp(p), p.mp + (P.mpRegenPerSec(p) * delta) / 1000);
      regen(this, time, delta);
    }

    this.player.setAlpha(time < Game.invulnUntil && !Game.dead ? (Math.floor(time / 80) % 2 ? 0.35 : 1) : Game.dead ? 0.3 : 1);

    const target = { x: this.player.x, y: this.player.y, halfW: SPRITES['player.warrior'].w * 0.4, targetable: !Game.dead };
    for (const m of this.monsters) {
      const a = m.tick(time, target);
      if (a === 'swing') this.monsterSwings(m);
      else if (a === 'shoot') fireShot(this, m);
      // v0.2.6: a mob that is in combat bumps for 40% of a swing when its body touches the player.
      else if (!Game.dead && m.alive && m.engaged && this.touching(m)) this.monsterSwings(m, m.x, true);
    }
    updateShots(this, time, delta);
    this.updateBolts(delta);
    this.tickBurns(time);

    for (const d of this.drops.getChildren() as Drop[]) if (time > d.expireAt) d.destroy();
    if (!Game.dead && !menu && time - this.lastQuestAt > 350) {
      this.lastQuestAt = time;
      Q.checkPlace(p, this.areaId, this.player.x / TILE);
      Q.tick(p);
      ensureNamed(this);
    }
    updateMarkers(this, time);
    this.updatePrompt();
    if (this.chestImg) this.chestImg.setTexture(Game.storageOpen ? 'deco.chest_open' : 'deco.chest');
    p.x = this.player.x;
    if (time - this.lastSave > ASSUME.autosaveMs) { this.lastSave = time; Game.save(); }
  }

  // ─────────────────────────── combat ───────────────────────────
  buffActive(id: string) { return (Game.buffs[id] ?? 0) > Date.now(); }

  trySwing(mult: number, mpCost: number, kind: 'basic' | 'power_strike'): boolean {
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
      // v0.2.9: the normal attack is a wide gray crescent swept in front of the Hero, reaching the real melee range (70 px).
      s.setVisible(false);
      Fx.sideSlash(this, ox, oy, this.facing, { reach, duration: Fx.FX.basicMs, onImpact });
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

  useHotbar(slot: number) {
    const id = Sk.barOf(Game.player)[slot];
    if (!id) { Game.toast('Empty slot — bind a skill or a potion from K or I', 'info'); return; }
    if (Sk.isHotbarSkill(id)) this.useSkill(id);
    else if (Sk.isHotbarItem(id)) {
      const p = Game.player;
      const before = p.inventory[id] ?? 0;
      this.useItem(id);
      // Welcome to Meadow Town: a berry eaten from the Q slot
      if ((p.inventory[id] ?? 0) < before && (id === 'strawberry' || id === 'blueberry')) Q.onAction(p, 'eat_berry', slot);
    }
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
    } else if (id === 'mana_shield') {
      p.mp -= s.mp_cost;
      this.lastCombatAt = Game.now;
      const dur = s.duration_s ?? 45;
      Game.buffs.mana_shield = now + dur * 1000;
      Game.toast(`Mana Shield: ${Sk.manaShieldPct(p)}% less damage for ${dur}s`, 'info');
      Fx.wardBurst(this, this.player.x, this.player.y - 22);
      ok = true;
    } else if (id === 'magic_bolt' || id === 'fire_bolt' || id === 'thorn_volley' || id === 'chain_spark') {
      ok = this.castBolt(id, mul, s.mp_cost, s.duration_s ?? 0);
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

  // ───────────── Magician Path projectiles (v0.2.8) ─────────────
  /** Throw a bolt, a thorn volley or a spark from the hands. Damage lands when the projectile arrives. */
  private castBolt(kind: Fx.BoltKind, mul: number, mpCost: number, burnS: number): boolean {
    const p = Game.player;
    const now = Game.now;
    if (now < this.swingReadyAt) return false;
    if (p.mp < mpCost) { Game.toast('Not enough MP', 'warn'); this.swingReadyAt = now + 300; return false; }
    p.mp -= mpCost;
    this.swingReadyAt = now + 300;
    this.lastCombatAt = now;
    const facing = this.facing;
    this.swingFx(kind);
    Fx.castFlash(this, kind, this.player.x + facing * 20, this.player.y - 26);
    const angles = kind === 'thorn_volley' ? [-BOLT.thornFanDeg, 0, BOLT.thornFanDeg] : [0];
    angles.forEach((deg, i) => {
      const launch = () => this.launchBolt(kind, mul, facing, deg, burnS);
      if (i === 0) launch(); else this.time.delayedCall(i * BOLT.thornStaggerMs, launch);
    });
    return true;
  }

  private launchBolt(kind: Fx.BoltKind, mul: number, facing: number, angleDeg: number, burnS: number): void {
    if (Game.dead || !this.player) return;
    const a = Phaser.Math.DegToRad(angleDeg);
    const sp = BOLT.speed[kind];
    const vx = facing * Math.cos(a) * sp, vy = Math.sin(a) * sp;
    const head = Fx.boltHead(this, kind, this.player.x + facing * 20, this.player.y - 26, Math.atan2(vy, vx));
    (head as Phaser.GameObjects.Container & { burnS?: number }).burnS = burnS;
    this.bolts.push({ kind, head, vx, vy, dir: facing, mul, travelled: 0 });
  }

  private updateBolts(delta: number): void {
    if (!this.bolts.length) return;
    this.bolts = this.bolts.filter((b) => {
      const dt = delta / 1000;
      b.head.x += b.vx * dt;
      b.head.y += b.vy * dt;
      b.travelled += Math.hypot(b.vx, b.vy) * dt;
      Fx.boltTick(this, b.kind, b.head, b.dir);
      for (const m of this.monsters) {
        if (!m.alive) continue;
        if (Math.abs(m.x - b.head.x) > m.halfW + BOLT.hitRadius) continue;
        if (b.head.y < m.y - m.displayHeight - 4 || b.head.y > m.y + 6) continue;
        this.boltHit(b, m);
        return false;
      }
      const gone = b.travelled > BOLT.range || b.head.y > this.groundY + 8 || b.head.x < 0 || b.head.x > this.geo.widthTiles * TILE;
      if (gone) {
        // out of range: the bolt fizzles into a few motes
        Fx.boltImpact(this, b.kind === 'fire_bolt' ? 'magic_bolt' : b.kind, b.head.x, b.head.y, false);
        b.head.destroy();
        return false;
      }
      return true;
    });
  }

  private boltHit(b: Bolt, m: Monster): void {
    const burnS = (b.head as Phaser.GameObjects.Container & { burnS?: number }).burnS ?? 0;
    const x = b.head.x, y = b.head.y;
    b.head.destroy();
    const out = this.skillHit(m, b.mul, b.kind, this.player.x, { burnS });
    Fx.boltImpact(this, b.kind, x, y, out.crit);
    if (out.landed) {
      Fx.hitStop(this, out.crit ? 56 : 36);
      if (b.kind === 'chain_spark') this.chainJump(m, b.mul, new Set([m]), BOLT.chainJumps);
    }
  }

  /** Chain Spark: leap from foe to foe, each jump a beat later and 25% weaker. */
  private chainJump(from: Monster, mul: number, seen: Set<Monster>, left: number): void {
    if (left <= 0) return;
    let best: Monster | null = null;
    let bd = Infinity;
    for (const m of this.monsters) {
      if (!m.alive || seen.has(m)) continue;
      const dx = Math.abs(m.x - from.x), dy = Math.abs(m.y - from.y);
      if (dx > BOLT.chainReachPx || dy > 90) continue;
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = m; }
    }
    if (!best) return;
    const next = best;
    seen.add(next);
    const x0 = from.x, y0 = from.y - from.displayHeight * 0.5;
    this.time.delayedCall(BOLT.chainDelayMs, () => {
      if (!next.alive || Game.dead) return;
      const x1 = next.x, y1 = next.y - next.displayHeight * 0.5;
      Fx.lightningLink(this, x0, y0, x1, y1);
      const m2 = mul * BOLT.chainFalloff;
      const out = this.skillHit(next, m2, 'chain_spark', x0);
      Fx.boltImpact(this, 'chain_spark', x1, y1, out.crit);
      this.chainJump(next, m2, seen, left - 1);
    });
  }

  /** One skill hit on one monster: hit roll, affinity, damage, knockback, burn. Used by projectiles. */
  private skillHit(m: Monster, mul: number, kind: keyof typeof ATTACK_FEEL, fromX: number, opt: { burnS?: number } = {}): { landed: boolean; crit: boolean } {
    const p = Game.player;
    const topY = m.y - m.displayHeight - 12;
    const hitY = m.y - m.displayHeight * 0.45;
    if (!rollHit(P.accuracy(p), m.feel.eva, p.level, m.def.level)) { this.floatText(m.x, topY, 'MISS', '#c8c8c8', 15); return { landed: false, crit: false }; }
    const aff = affinityOf(m.def.id, SKILL_SCHOOL[kind]);
    if (aff === 'immune') { this.floatText(m.x, topY, 'Immune', '#9fd8ff', 15); m.provoke(); return { landed: false, crit: false }; }
    const rage = this.buffActive('rage') ? Sk.rageNumbers(p).dealtPct : 0;
    let { dmg, crit } = computeHit(P.magicAttack(p), mul, m.def.defense, P.critChance(p), rage);
    if (aff === 'weak') { dmg = weakDamage(dmg); this.floatText(m.x, topY - 16, 'Weak!', '#ff9a3a', 11); }
    const color = crit ? '#ffcf33' : aff === 'weak' ? '#ff9a3a' : ({ magic_bolt: '#cfe6ff', fire_bolt: '#ffb070', thorn_volley: '#b6ee86', chain_spark: '#a6ecff' } as Record<string, string>)[kind] ?? '#ffffff';
    this.floatText(m.x, topY, `${dmg}`, color, crit ? 20 : aff === 'weak' ? 18 : 16);
    const feel = ATTACK_FEEL[kind];
    if (m.hurt(dmg, fromX, feel.kb, feel.hitstunMs)) this.onKill(m);
    else if (opt.burnS && m.alive) this.applyBurn(m, Math.max(1, Math.floor(dmg * 0.35)), opt.burnS);
    Fx.hitSparks(this, m.x, hitY, crit, Fx.BOLT_COLORS[kind as Fx.BoltKind]?.glow ?? 0xfff2c0);
    return { landed: true, crit };
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

  /** Body-on-body overlap between a mob and the player. */
  private touching(m: Monster): boolean {
    const a = m.body2;
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  /** A swing, a pebble, or (contact) a bump. A bump is CONTACT.fraction of a swing, physical, with a small nudge and no miss roll. */
  monsterSwings(m: Monster, fromX = m.x, contact = false, mult = 1) {
    const p = Game.player;
    if (Game.dead || Game.now < Game.invulnUntil) return;
    if (!contact && !rollHit(m.feel.acc, P.evasion(p), m.def.level, p.level, HIT_MONSTER)) {
      this.floatText(this.player.x, this.player.y - 60, 'MISS', '#c8c8c8', 14);
      return;
    }
    this.lastCombatAt = Game.now;
    const taken = this.buffActive('rage') ? Sk.rageNumbers(p).takenPct : 0;
    const digging = this.buffActive('dig_in');
    const matk = rollMonsterAttack(m.def.attack, m.def.attack_min, m.def.attack_max) * (contact ? CONTACT.fraction : 1) * mult;
    let dmg = p.cheats.god ? 0 : incomingDamage(matk, P.defense(p) * (digging ? 1.5 : 1), taken);
    // v0.2.8 Mana Shield: a ward that dulls every incoming hit (swings, pebbles and bumps alike).
    if (this.buffActive('mana_shield') && dmg > 0) {
      dmg = Math.max(1, dmg - Math.floor((dmg * Sk.manaShieldPct(p)) / 100));
      this.floatText(this.player.x + 18, this.player.y - 74, 'ward', '#9fd0ff', 11);
    }
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
    if (p.hp <= 0) die(this);
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
    // v0.2.6: the first Ember Beetle killed at level 6+ (once Ember in the Scale can start) always drops a Smoldering Scale
    // (once per character); v0.2.9: the same for the first Burrow Mole at level 5+ and a Cracked Bank Stone, so a ready
    // player can never be locked out of those quests.
    if (['ember_beetle', 'cinderback'].includes(m.def.id) && p.level >= 6 && Q.isDone(p, 'ql_crack') && !p.questFlags.scale_seen && !(p.inventory.smoldering_scale ?? 0)
      && !rolled.some((d) => d.itemId === 'smoldering_scale')) {
      rolled.push({ itemId: 'smoldering_scale', qty: 1, rare: true });
    }
    if (p.level >= 6 && Q.isDone(p, 'ql_crack') && rolled.some((d) => d.itemId === 'smoldering_scale')) p.questFlags.scale_seen = true;
    if (['burrow_mole', 'bank_cracker'].includes(m.def.id) && p.level >= 5 && Q.isDone(p, 'ql_dirt_path') && !p.questFlags.stone_seen && !(p.inventory.cracked_bank_stone ?? 0)
      && !rolled.some((d) => d.itemId === 'cracked_bank_stone')) {
      rolled.push({ itemId: 'cracked_bank_stone', qty: 1, rare: true });
    }
    if (p.level >= 5 && Q.isDone(p, 'ql_dirt_path') && rolled.some((d) => d.itemId === 'cracked_bank_stone')) p.questFlags.stone_seen = true;
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
  private nearPortal() { return this.portals.find((pt) => Math.abs(pt.x - this.player.x) < 34 && Math.abs(pt.y - this.player.y) < 40); }
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

  interact() {
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
      // v0.3.0: the Whisperwood road opens with Mist on the North Road.
      if (portal.target === 'whisperwood' && !Q.roadOpen(Game.player)) { Game.toast('The mist is too thick to follow. Pell might know the way.', 'info'); return; }
      this.travel(portal.target, portal.arriveX, portal.arriveY);
    }
  }

  travel(area: string, x?: number, y?: number) {
    Game.events.emit('close-all');
    this.scene.restart({ area, x: x ?? AREAS[area]?.spawnX, y });
  }

  private updatePrompt() {
    let text = '';
    if (this.nearbyDrops().length) text = 'E: pick up';
    else if (this.nearPost()) text = 'E: practice';
    else if (this.nearNpc()) text = `E: talk to ${this.nearNpc()!.name.split(' ')[0]}`;
    else if (this.nearChest()) text = 'E: open storage';
    else if (this.nearPortal()) text = !this.nearPortal()!.target ? 'Closed (later)' : this.nearPortal()!.target === 'whisperwood' && !Q.roadOpen(Game.player) ? 'Too misty' : 'E: enter';
    this.prompt.setText(text).setVisible(!!text && !Game.dead && !Game.menuOpen).setPosition(this.player.x, this.player.y - 56);
  }

  floatText(x: number, y: number, text: string, color: string, size: number) {
    const t = this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 4, fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
