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
  // Not in sheet: starting gear. Warrior starts with a Wooden Sword so a level-1
  // Power Strike kills a Field Mouse in ~4 hits (sheet target: 3-5 hits).
  starterWeapon: 'wooden_sword',
  // Not in sheet: skill cooldowns. The worked example assumes a 1s Power Strike cooldown.
  cooldownMs: { power_strike: 1000, rage: 60000 } as Record<string, number>,
  potionCooldownMs: 400,
  // Not in sheet: hurt invulnerability after taking a hit, monster swing interval and speeds.
  hurtInvulnMs: 700,
  monsterSpeed: { field_mouse: 70, wool_sheep: 50, crow: 95, default: 60 } as Record<string, number>,
  // Player movement (px/s, px/s², px/s).
  playerSpeed: 190,
  gravity: 1300,
  jumpVelocity: 560,
  meleeReach: 70,
  // Ground drops disappear after this long (not in sheet).
  dropLifetimeMs: 120000,
  pickupRadius: 56,
  autosaveMs: 10000,
};

/**
 * v0.1.1 combat-feel stats (accuracy/evasion, knockback, hitstun, AI timings).
 * Not in the design sheet yet — candidates for a new sheet tab.
 *
 * Hit chance (attacker → defender):
 *   hit% = clamp(85 + (acc − eva) × 1.5 + (attackerLevel − defenderLevel) × 2, 50, 98)
 */
export const HIT = { base: 85, perAccEva: 1.5, perLevel: 2, min: 50, max: 98 };

/** Player accuracy/evasion: base + AGI × perAgi + level × perLevel. */
export const PLAYER_ACC = { base: 10, perAgi: 1, perLevel: 0.5 };
export const PLAYER_EVA = { base: 8, perAgi: 0.8, perLevel: 0.5 };

/**
 * Per-monster combat-feel stats.
 * acc/eva feed the hit formula (tuned: level-appropriate mobs miss the player ~15-25%,
 * the player misses them ~10%). kbRes 0 = full knockback, 1 = immovable.
 * range = attack reach in px (edge to edge, after spacing), windupMs = telegraph before a swing.
 */
export const MONSTER_FEEL: Record<string, { acc: number; eva: number; kbRes: number; range: number; windupMs: number }> = {
  field_mouse: { acc: 5, eva: 7, kbRes: 0.0, range: 14, windupMs: 380 },
  wool_sheep: { acc: 6, eva: 6, kbRes: 0.6, range: 16, windupMs: 450 },
  crow: { acc: 8, eva: 10, kbRes: 0.2, range: 18, windupMs: 400 },
  default: { acc: 8, eva: 8, kbRes: 0.3, range: 16, windupMs: 400 },
};

/**
 * Knockback per attack/skill: kb = horizontal push (px/s) before resistance,
 * hitstunMs = how long the monster can't act (scaled by 1 − kbRes × 0.5).
 */
export const ATTACK_FEEL: Record<string, { kb: number; hitstunMs: number }> = {
  basic: { kb: 140, hitstunMs: 320 },
  power_strike: { kb: 360, hitstunMs: 500 },
  rage: { kb: 0, hitstunMs: 0 },
};

/** Player gets pushed when hit (plus existing hurt i-frames). */
export const PLAYER_HIT_KB = { vx: 170, vy: -160 };

/** Monster AI timings (ms) and behaviour weights after each swing. */
export const AI = {
  recoverMs: 250, // pause right after a swing
  repositionMs: [550, 1100] as [number, number], // how long a back-off / circle lasts
  idlePauseMs: [250, 800] as [number, number], // short idle before re-engaging
  backOffChance: 0.45, // step away from the player
  circleChance: 0.35, // hop over to the player's other side
  // remaining chance: short idle pause in place
  backOffSpeedMul: 1.1,
  chaseSpeedMul: 1.6,
  hopVelocity: 380, // circle hop
  minGapPx: 6, // never closer than this (edge to edge) unless hopping over
};

/** Out-of-combat HP regen (game_rules has none yet). */
export const REGEN = {
  delayMs: 5000, // no damage taken and no attacks for this long
  pctMaxHpPerSec: 2, // % of max HP per second
  spiBonusPerPoint: 0.02, // ×(1 + SPI × 0.02)
};
