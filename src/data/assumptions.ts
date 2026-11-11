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
  monsterAttackIntervalMs: 1500,
  monsterReach: 44,
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
