import { f } from '../data/db';
import { DAMAGE, HIT } from '../data/assumptions';

export type HitCfg = typeof HIT;

/** combat_formulas.min_damage: max(1, floor(0.05 × skill_multiplier × attack)). */
export function minDamage(preDefense: number): number {
  return Math.max(1, Math.floor(0.05 * preDefense));
}

/** Uniform per-hit dice in [0.75, 1.25]. */
export function hitVariance(): number {
  const [lo, hi] = DAMAGE.hitMul;
  return lo + Math.random() * (hi - lo);
}

/** combat_formulas.damage_formula: max(min_damage, floor(skill_multiplier × attack × hit_variance − target_defense)), then crit. */
export function computeHit(attack: number, skillMultiplier: number, targetDefense: number, critChancePct: number, dmgBonusPct = 0) {
  const roll = hitVariance();
  const pre = skillMultiplier * attack * (1 + dmgBonusPct / 100) * roll;
  let dmg = Math.max(minDamage(pre), Math.floor(pre - targetDefense));
  const crit = Math.random() * 100 < critChancePct;
  if (crit) dmg = Math.floor(dmg * f('crit_multiplier'));
  return { dmg, crit, roll };
}

/** Roll a monster's attack uniformly in [attack_min, attack_max] (typical if a range is missing). */
export function rollMonsterAttack(typical: number, min?: number | null, max?: number | null): number {
  const lo = min ?? typical;
  const hi = max ?? typical;
  if (hi <= lo) return lo;
  return lo + Math.random() * (hi - lo);
}

/** combat_formulas.incoming_damage: max(min_damage, floor(rolled_monster_attack − player_defense)), then Rage's +taken%. */
export function incomingDamage(monsterAttack: number, playerDefense: number, takenBonusPct = 0): number {
  const base = Math.max(minDamage(monsterAttack), Math.floor(monsterAttack - playerDefense));
  return Math.floor(base * (1 + takenBonusPct / 100));
}

/** hit% = clamp(base + (acc − eva) × perAccEva + (attackerLvl − defenderLvl) × perLevel, min, max). Player uses HIT, monsters HIT_MONSTER. */
export function hitChance(acc: number, eva: number, attackerLevel: number, defenderLevel: number, cfg: HitCfg = HIT): number {
  const raw = cfg.base + (acc - eva) * cfg.perAccEva + (attackerLevel - defenderLevel) * cfg.perLevel;
  return Math.max(cfg.min, Math.min(cfg.max, raw));
}
export function rollHit(acc: number, eva: number, attackerLevel: number, defenderLevel: number, cfg: HitCfg = HIT): boolean {
  return Math.random() * 100 < hitChance(acc, eva, attackerLevel, defenderLevel, cfg);
}
