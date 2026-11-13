/**
 * Values the prototype needs that the Game Design DB sheet does not (yet) define
 * as a number. Each one is a placeholder; move it into the sheet when it is tuned.
 * Values that ARE in the sheet live in /data and are read through src/data/db.ts.
 */
export const TILE = 32; // px per tile (aggro/leash distances are given in tiles)

export const ASSUME = {
  // game_rules.monster_aggro_leash says "~8 tiles" / "~20 tiles" in prose.
  aggroTiles: 8,
  leashTiles: 20,
  // game_rules.death_penalty says "~3s delay".
  respawnDelayMs: 3000,
  // game_rules.level_up_rewards says "~1.5s invulnerability".
  levelUpInvulnMs: 1500,
  // combat_formulas.attack_formula notes: unarmed weapon_damage 6, multiplier 1.0.
  unarmedDamage: 6,
  unarmedMultiplier: 1.0,
  // Not in sheet: starting gear. The Hero starts with a Club (same numbers as the old Wooden Sword) so a level-1
  // Power Strike kills a Field Mouse in ~4 hits (sheet target: 3-5 hits).
  starterWeapon: 'club',
  // Not in sheet: skill cooldowns. The worked example assumes a 1s Power Strike cooldown.
  cooldownMs: { power_strike: 800, rage: 60000, earthbreaker: 2400, flame_cleave: 2000, soul_guard: 30000, root_lash: 1600, dig_in: 4000, magic_bolt: 700, mana_shield: 20000, fire_bolt: 1600, thorn_volley: 2000, chain_spark: 2400 } as Record<string, number>,
  potionCooldownMs: 400,
  // Not in sheet: hurt invulnerability after taking a hit, monster swing interval and speeds.
  hurtInvulnMs: 700,
  // v0.2.6: travel speed up ~45-50% (animation frame rates are unchanged; they scale off this number).
  // Chase is still 1.6× walk speed; the player stays at 148.
  monsterSpeed: { field_mouse: 42, wool_sheep: 30, crow: 55, burrow_mole: 32, earth_sprite: 40, ember_beetle: 32, wool_shoulder: 28, bank_cracker: 30, cinderback: 32, spark_bug: 36, frost_moth: 34, meadow_boar: 36, default: 36 } as Record<string, number>,
  // Player movement (px/s, px/s², px/s). v0.1.3: 148 (was 190, ≈−22%).
  playerSpeed: 148,
  gravity: 1300,
  // v0.1.2: 435 (was 560) → jump height v²/2g ≈ 73px, 60% of the old ≈ 121px. Platforms sit 2 / 4 tiles up.
  jumpVelocity: 435,
  meleeReach: 70,
  // Ground drops disappear after this long (not in sheet).
  dropLifetimeMs: 120000,
  pickupRadius: 56,
  autosaveMs: 10000,
};

/**
 * Combat-feel stats (accuracy/evasion, knockback, hitstun, AI timings).
 * Not in the design sheet yet — candidates for a new sheet tab.
 *
 * Hit chance (attacker → defender):
 *   hit% = clamp(base + (acc − eva) × perAccEva + (attackerLevel − defenderLevel) × perLevel, min, max)
 * v0.1.2: monsters use HIT_MONSTER — ~77-79% against an equal-level player, −3.5% per level the
 * player is above the mob, floor 40%. The player keeps HIT (≈90% at parity).
 */
export const HIT = { base: 85, perAccEva: 1.5, perLevel: 2, min: 50, max: 98 };
export const HIT_MONSTER = { base: 78, perAccEva: 1, perLevel: 3.5, min: 40, max: 95 };

/** Player accuracy/evasion: base + AGI × perAgi + level × perLevel. */
export const PLAYER_ACC = { base: 10, perAgi: 1, perLevel: 0.5 };
export const PLAYER_EVA = { base: 8, perAgi: 0.8, perLevel: 0.5 };

/**
 * Per-monster combat-feel stats.
 * acc/eva feed the hit formula (tuned: level-appropriate mobs miss the player ~15-25%,
 * the player misses them ~10%). kbRes 0 = full knockback, 1 = immovable.
 * range = attack reach in px (edge to edge, after spacing), windupMs = telegraph before a swing.
 */
export interface MonsterFeel { acc: number; eva: number; kbRes: number; range: number; windupMs: [number, number] }
export const MONSTER_FEEL: Record<string, MonsterFeel> = {
  // range = melee reach (edge to edge, px). v0.2.6: longer reaches so mobs connect from a step away (was 4-28; Boar 44 is the longest).
  // windupMs = random telegraph per swing (v0.1.2: was fixed 380-450).
  field_mouse: { acc: 8, eva: 7, kbRes: 0.0, range: 16, windupMs: [225, 495] },
  wool_sheep: { acc: 9, eva: 6, kbRes: 0.6, range: 18, windupMs: [288, 540] },
  crow: { acc: 10, eva: 10, kbRes: 0.2, range: 14, windupMs: [360, 540] },
  burrow_mole: { acc: 10, eva: 6, kbRes: 0.5, range: 22, windupMs: [315, 585] },
  earth_sprite: { acc: 11, eva: 11, kbRes: 0.15, range: 38, windupMs: [252, 495] },
  ember_beetle: { acc: 10, eva: 8, kbRes: 0.35, range: 36, windupMs: [270, 522] },
  spark_bug: { acc: 12, eva: 11, kbRes: 0.2, range: 32, windupMs: [234, 468] },
  frost_moth: { acc: 11, eva: 13, kbRes: 0.1, range: 28, windupMs: [288, 540] },
  wool_shoulder: { acc: 11, eva: 7, kbRes: 0.7, range: 24, windupMs: [288, 558] },
  bank_cracker: { acc: 12, eva: 7, kbRes: 0.65, range: 36, windupMs: [324, 612] },
  cinderback: { acc: 12, eva: 9, kbRes: 0.55, range: 34, windupMs: [288, 540] },
  meadow_boar: { acc: 11, eva: 7, kbRes: 0.55, range: 44, windupMs: [288, 540] },
  default: { acc: 9, eva: 8, kbRes: 0.3, range: 20, windupMs: [270, 540] },
};


/**
 * Ranged attackers (monsters.attack_type = ranged in the sheet): keep a distance, telegraph,
 * then throw a slow, visible projectile that flies straight at chest height — jump or walk away to dodge.
 */
export const RANGED = {
  keepPx: [150, 230] as [number, number], // preferred distance band to the player
  fireRangePx: 300,
  projectileSpeed: 120, // px/s (player runs 148; same 0.8× ratio as 150/190)
  projectileLifeMs: 2800,
  hitRadius: 14,
  cooldownMs: [2200, 3600] as [number, number],
};

/**
 * Knockback per attack/skill: kb = horizontal push (px/s) before resistance,
 * hitstunMs = how long the monster can't act (scaled by 1 − kbRes × 0.5).
 */
export const ATTACK_FEEL: Record<string, { kb: number; hitstunMs: number }> = {
  // v0.1.2: ×3 (was basic 140, Power Strike 360).
  // v0.2.3: basic knockback halved (was 420). Specials keep the big push.
  basic: { kb: 210, hitstunMs: 320 },
  power_strike: { kb: 1080, hitstunMs: 500 },
  earthbreaker: { kb: 600, hitstunMs: 900 }, // AoE slam; the "short stun"
  flame_cleave: { kb: 700, hitstunMs: 450 },
  root_lash: { kb: 900, hitstunMs: 400 },
  // v0.2.8 Magician Path: projectiles push less than melee
  magic_bolt: { kb: 180, hitstunMs: 300 },
  fire_bolt: { kb: 320, hitstunMs: 380 },
  thorn_volley: { kb: 110, hitstunMs: 220 },
  chain_spark: { kb: 150, hitstunMs: 260 },
  dig_in: { kb: 0, hitstunMs: 0 },
  rage: { kb: 0, hitstunMs: 0 },
};

/** Player gets pushed when hit (plus existing hurt i-frames). */
export const PLAYER_HIT_KB = { vx: 170, vy: -160 };

/** Monster AI timings (ms) and behaviour weights after each swing. */
export const AI = {
  recoverMs: [125, 375] as [number, number], // v0.2.5: ~17% faster (was [150, 450])
  feintChance: 0.15, // telegraph, then cancel and back off instead of striking
  approachDelayMs: [0, 415] as [number, number], // v0.2.5: ~17% shorter hesitation
  repositionMs: [550, 1100] as [number, number], // how long a back-off / circle lasts
  idlePauseMs: [250, 800] as [number, number], // short idle before re-engaging
  backOffChance: 0.45, // step away from the player
  circleChance: 0.35, // hop over to the player's other side
  // remaining chance: short idle pause in place
  backOffSpeedMul: 1.1,
  chaseSpeedMul: 1.6,
  hopVelocity: 380, // circle hop
  minGapPx: 0, // v0.1.2: melee mobs close to contact (was 6)
};

/** Out-of-combat HP regen (game_rules has none yet). */
export const REGEN = {
  delayMs: 5000, // no damage taken and no attacks for this long
  pctMaxHpPerSec: 0.5, // v0.1.2: % of max HP per second (was 2, ÷4)
  // ×(1 + SPI × 0.02): multiplicative, so the absolute SPI contribution also dropped 4× with the base.
  spiBonusPerPoint: 0.02,
};

/** Drop quantity rolls (drop_tables min_qty/max_qty are in the sheet). */
export const LOOT = {
  qtySkew: 1.8, // r^1.8 → weighted toward min_qty
  maxQtyPerMul: 0.5, // droprate 3× → max_qty × 2
};

/**
 * Gear instances (v0.1.2). Full mid-roll Meadows *drop* set vs basic, level 1, 0 ability points:
 *   Basic: Wooden Sword (10 × 1.1) = 11 attack, 0 defense.
 *   Drop set: Meadow Blade mid 14 × 1.15 = 16 attack (+45%), Hide armor mid defense 10
 *     (cap 2 + vest 3 + pants 2 + boots 2 + gloves 1).
 *   Survivability vs a Crow (attack 18): 18 dmg → 8 dmg, 56% less taken.
 *   Shop cloth is a stepping-stone (mid defense 6). Hide requires 3 STR; Meadow Blade requires 3 STR.
 *   Steel (17-21 × 1.25) is ultra-rare and above this target. Skill training is still the main power-up.
 *   Numbers live on the gear tab (defense_min/max, weapon_damage_min/max); mid values are the "typical" columns.
 */
/** Per-hit dice (v0.1.3). Applied on every player hit (basic and skills) after weapon instance damage and the flat +1 attack per 2 main-stat (v0.2.3). Crit is on top. Monsters use attack_min/max instead of a second dice. */
/** Sprite animation (v0.1.3). Hero walk is ~35% slower than v0.1.2 and scales with actual vx. Attack FX are a bit slower but still readable (combat wind-up / swing intervals are unchanged). Mob frame rates use monsters.anim_speed (Crow 1, others 0.5). */
export const ANIM = {
  heroWalkPeriod: 95, // was 70; 35% slower at full playerSpeed. Multiplied by vx / playerSpeed.
  heroSwingMs: 130,   // v0.2.5 snappier (was 185); timed with CombatFx.basicMs
  heroSlashMs: 160,   // v0.2.5, kept in sync with the trail
  heroLungeMs: 80,    // body punch, was 60 (yoyo)
  mobFrameMoveMs: 120, // at anim_speed 1; actual interval is this / anim_speed, scaled by vx
  mobFrameIdleMs: 400,
  mobWobble: 0.35,     // angle frequency at anim_speed 1
};

export const DAMAGE = {
  hitMul: [0.75, 1.25] as [number, number],
};

/**
 * v0.1.3 attack: weapon_damage × multiplier × (1 + main_stat × 0.01).
 * At level 1, 0 points, Wooden Sword mid 10 × 1.1 = 11 (same as v0.1.2).
 * At 6 STR: 11 × 1.06 ≈ 11.7 (was (10+12)×1.1 = 24 — the old +2 flat was "insane").
 * Mid Meadows drop set is still +45% vs basic (16 vs 11) because that comes from the weapon, not STR.
 * Skill ranks remain the big lever (basic +5%/rank, nature +12%, etc.).
 */
export const MAGIC = {
  /** Fraction of gear drops (and shop rolls) that come out magic. 1/12 ≈ 8.3%, in the 1/10–1/20 band. */
  chance: 1 / 12,
  /** Given a magic item, chance it gets a second affix. */
  secondAffixChance: 0.4,
  /** Rolled uniformly in [min, max]. */
  affixes: {
    STR: [1, 3], INT: [1, 3], AGI: [1, 3], SPI: [1, 3],
    acc: [2, 6], crit: [1, 4],
    hp: [8, 20], mp: [5, 15],
    hpRegen: [0.15, 0.4], // flat HP/s added to out-of-combat regen
    mpRegen: [0.05, 0.15],
  } as Record<string, [number, number]>,
};

/** v0.2.6: contact damage — a bump from a mob that is in combat is this fraction of a normal swing. */
export const CONTACT = { fraction: 0.4, kbScale: 0.45 };

/** v0.2.6: how long (ms) an aggroed mob that cannot reach the player tries before giving up. */
export const GIVE_UP_MS = 2750;
/** v0.2.6: highest ledge (px above a mob's feet) a mob can jump onto, and the jump it makes. */
export const MOB_JUMP = { maxRisePx: 80, velocity: 470 };

/**
 * v0.2.6 affinity. Skills have a school; mobs are weak to / immune to a school.
 * Nature and beast mobs are weak to Elemental; elemental mobs are weak to Nature and immune to Elemental.
 * Basic is never weak or immune. Contact damage is Basic.
 */
export type School = 'basic' | 'nature' | 'elemental';
export const SKILL_SCHOOL: Record<string, School> = { earthbreaker: 'nature', root_lash: 'nature', flame_cleave: 'elemental', fire_bolt: 'elemental', thorn_volley: 'nature', chain_spark: 'elemental' };
export const AFFINITY: Record<string, { weak?: School; immune?: School }> = {
  field_mouse: { weak: 'elemental' }, wool_sheep: { weak: 'elemental' }, crow: { weak: 'elemental' },
  burrow_mole: { weak: 'elemental' }, meadow_boar: { weak: 'elemental' }, old_stump: { weak: 'elemental' },
  wool_shoulder: { weak: 'elemental' }, bank_cracker: { weak: 'elemental' },
  earth_sprite: { weak: 'nature', immune: 'elemental' }, ember_beetle: { weak: 'nature', immune: 'elemental' },
  spark_bug: { weak: 'nature', immune: 'elemental' }, cinderback: { weak: 'nature', immune: 'elemental' },
  frost_moth: { weak: 'nature', immune: 'elemental' },
  shrine_wisp: { weak: 'nature' }, dusk_wisp: { weak: 'nature' }, night_stump: { weak: 'nature' },
};
export const WEAK_MUL = 1.5;

/** v0.2.8 Magician Path projectiles (px, px/s). The player throws from about chest height in front of the hands. */
export const BOLT = {
  speed: { magic_bolt: 470, fire_bolt: 410, thorn_volley: 540, chain_spark: 540 } as Record<string, number>,
  range: 320,
  hitRadius: 10,
  thornFanDeg: 7,
  thornStaggerMs: 70,
  chainJumps: 3,
  chainReachPx: 150,
  chainFalloff: 0.75,
  chainDelayMs: 110,
  shieldBasePct: 30,
  shieldMaxPct: 60,
};
