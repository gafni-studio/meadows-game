import { f } from '../data/db';
import { HIT } from '../data/assumptions';

/** combat_formulas.min_damage: max(1, floor(0.05 × skill_multiplier × attack)). */
export function minDamage(preDefense: number): number {
  return Math.max(1, Math.floor(0.05 * preDefense));
}

/** combat_formulas.damage_formula: max(min_damage, floor(skill_multiplier × attack − target_defense)). */
export function computeHit(attack: number, skillMultiplier: number, targetDefense: number, critChancePct: number, dmgBonusPct = 0) {
  const pre = skillMultiplier * attack * (1 + dmgBonusPct / 100);
  let dmg = Math.max(minDamage(pre), Math.floor(pre - targetDefense));
  const crit = Math.random() * 100 < critChancePct;
  if (crit) dmg = Math.floor(dmg * f('crit_multiplier'));
  return { dmg, crit };
}

/** combat_formulas.incoming_damage: max(min_damage, floor(monster_attack − player_defense)), then Rage's +taken%. */
export function incomingDamage(monsterAttack: number, playerDefense: number, takenBonusPct = 0): number {
  const base = Math.max(minDamage(monsterAttack), Math.floor(monsterAttack - playerDefense));
  return Math.floor(base * (1 + takenBonusPct / 100));
}

/** hit% = clamp(85 + (acc − eva) × 1.5 + (attackerLvl − defenderLvl) × 2, 50, 98) */
export function hitChance(acc: number, eva: number, attackerLevel: number, defenderLevel: number): number {
  const raw = HIT.base + (acc - eva) * HIT.perAccEva + (attackerLevel - defenderLevel) * HIT.perLevel;
  return Math.max(HIT.min, Math.min(HIT.max, raw));
}
export function rollHit(acc: number, eva: number, attackerLevel: number, defenderLevel: number): boolean {
  return Math.random() * 100 < hitChance(acc, eva, attackerLevel, defenderLevel);
}
