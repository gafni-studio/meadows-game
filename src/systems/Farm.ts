/**
 * v0.3.1 farm list: "Add to farm list" on a skill's next rank puts a green farm objective under the quests,
 * with the recipe's materials as count lines. It goes away by itself once that rank is trained.
 */
import { DB } from '../data/db';
import type { PlayerData } from './Player';
import * as Sk from './Skills';
import type { CountLine } from './Quests';

export interface FarmEntry { skill: string; rank: number; name: string; counts: CountLine[] }

/** Drop entries whose rank is already trained (or whose skill is gone). */
export function prune(p: PlayerData): void {
  if (!p.farm) return;
  p.farm = p.farm.filter((f) => DB.skills[f.skill] && Sk.rankOf(p, f.skill) < f.rank);
}

export function has(p: PlayerData, skill: string): boolean {
  return !!p.farm?.some((f) => f.skill === skill);
}

/** Add the skill's next rank to the list, or take it off if it is there. True = now on the list. */
export function toggle(p: PlayerData, skill: string): boolean {
  prune(p);
  p.farm ??= [];
  if (has(p, skill)) { p.farm = p.farm.filter((f) => f.skill !== skill); return false; }
  const sk = DB.skills[skill];
  const r = Sk.rankOf(p, skill);
  if (!sk || r >= (sk.max_rank ?? 10)) return false;
  p.farm.push({ skill, rank: r + 1 });
  return true;
}

export function remove(p: PlayerData, skill: string): void {
  if (p.farm) p.farm = p.farm.filter((f) => f.skill !== skill);
}

export function entries(p: PlayerData): FarmEntry[] {
  prune(p);
  return (p.farm ?? []).map((f) => ({
    skill: f.skill, rank: f.rank, name: DB.skills[f.skill].name,
    counts: Sk.nextCost(f.skill, f.rank).map((c) => {
      const have = Math.min(c.qty, c.itemId === 'copper_coin' ? p.coins : (p.inventory[c.itemId] ?? 0));
      return { label: c.itemId === 'copper_coin' ? 'Copper' : (DB.items[c.itemId]?.name ?? c.itemId), have, need: c.qty, done: have >= c.qty };
    }),
  }));
}

/** v0.3.1: a node glows when its next rank is fully affordable right now (never when maxed or locked). */
export function readyToTrain(p: PlayerData, skill: string): boolean {
  const sk = DB.skills[skill];
  if (!sk) return false;
  const r = Sk.rankOf(p, skill);
  if (r >= (sk.max_rank ?? 10) || !Sk.unlockStatus(p, sk).ok) return false;
  const costs = Sk.nextCost(skill, r + 1);
  return costs.length > 0 && Sk.canAfford(p, costs);
}
