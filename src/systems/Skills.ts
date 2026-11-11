/**
 * Skill training (v0.2). Costs and unlocks come from the sheet (skill_costs,
 * skills, unlock_requirements, game_rules.skill_unlocks / skill_rank_scaling).
 *
 * Rank-1 quantities are listed. For rank r > 1: qty = round(rank_1_qty × 1.6^(r-1)).
 * Rare drops are extra milestone costs at ranks 5 and 10 only.
 * Basic skills are known at rank 0 (base value); category skills are learned at
 * rank 1 (base value) and scale from rank 2.
 * Damage skills: +N percentage points of the attack multiplier per scaling rank.
 * Buffs / shields: effect × (1 + N% × scaling ranks).
 */
import { DB, SkillDef, tab } from '../data/db';
import { ASSUME } from '../data/assumptions';
import * as P from './Player';

export interface Cost { itemId: string; qty: number }
interface CostRow { skill_id: string; rank: number; material_id: string; quantity: number }

const COSTS = tab<CostRow>('skill_costs');

/** Percent-points of scaling per rank, by branch (game_rules.skill_rank_scaling, v0.1.2). */
export const RANK_PCT: Record<string, number> = { basic: 5, nature: 12, elemental: 10, spiritual: 10 };

export function skill(id: string): SkillDef | undefined { return DB.skills[id]; }

const BRANCH_ORDER = ['basic', 'nature', 'elemental', 'spiritual'];
export function skillsFor(classId: string): SkillDef[] {
  return Object.values(DB.skills)
    .filter((s) => s.class_id === classId)
    .sort((a, b) => (BRANCH_ORDER.indexOf(a.branch) - BRANCH_ORDER.indexOf(b.branch)) || (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'active' ? -1 : 1));
}

export function rankOf(p: P.PlayerData, id: string): number { return p.skillRanks[id] ?? 0; }
export function known(p: P.PlayerData, id: string): boolean {
  const s = skill(id);
  if (!s) return false;
  return s.branch === 'basic' || rankOf(p, id) >= 1;
}

/** Unlock thresholds: basic from start; nature lv3+5 main; elemental lv6+10; spiritual lv8+15. */
const UNLOCK: Record<string, { level: number; stat: number }> = {
  start: { level: 1, stat: 0 }, early: { level: 3, stat: 5 }, mid: { level: 6, stat: 10 }, late: { level: 8, stat: 15 },
};
export function unlockReq(s: SkillDef) { return UNLOCK[s.unlock_stage] ?? UNLOCK.start; }

export function canSee(p: P.PlayerData, s: SkillDef): boolean {
  if (s.class_id !== p.classId) return false;
  const r = unlockReq(s);
  // Show a category skill once you're close (one level or a few points shy), so the trainer can tease it.
  return p.level + 2 >= r.level;
}

export function unlockStatus(p: P.PlayerData, s: SkillDef): { ok: boolean; reason?: string } {
  const r = unlockReq(s);
  const main = P.mainStat(p);
  const statName = s.scaling_stat ?? (p.classId === 'warrior' ? 'STR' : 'INT');
  if (p.level < r.level && main < r.stat) return { ok: false, reason: `Needs level ${r.level} and ${r.stat} ${statName}` };
  if (p.level < r.level) return { ok: false, reason: `Needs level ${r.level}` };
  if (main < r.stat) return { ok: false, reason: `Needs ${r.stat} ${statName}` };
  return { ok: true };
}

/** Cost to go from current rank to current+1. Empty at max rank. */
export function nextCost(id: string, nextRank: number): Cost[] {
  const s = skill(id);
  if (!s || nextRank < 1 || nextRank > (s.max_rank ?? 10)) return [];
  const scale = Math.pow(1.6, nextRank - 1);
  const out: Cost[] = [];
  for (const row of COSTS) {
    if (row.skill_id !== id) continue;
    if (row.rank === 1) out.push({ itemId: row.material_id, qty: Math.max(1, Math.round(row.quantity * scale)) });
    else if (row.rank === nextRank) out.push({ itemId: row.material_id, qty: row.quantity }); // milestone rare
  }
  return out;
}

export function canAfford(p: P.PlayerData, costs: Cost[]): boolean {
  return costs.every((c) => (c.itemId === 'copper_coin' ? p.coins : (p.inventory[c.itemId] ?? 0)) >= c.qty);
}

export function pay(p: P.PlayerData, costs: Cost[]): boolean {
  if (!canAfford(p, costs)) return false;
  for (const c of costs) {
    if (c.itemId === 'copper_coin') p.coins -= c.qty;
    else P.removeItem(p, c.itemId, c.qty);
  }
  return true;
}

/** Train the next rank. Returns an error string, or null on success. */
export function train(p: P.PlayerData, id: string): string | null {
  const s = skill(id);
  if (!s || s.class_id !== p.classId) return 'Unknown skill';
  const cur = rankOf(p, id);
  const max = s.max_rank ?? 10;
  if (cur >= max) return 'Already at max rank';
  const un = unlockStatus(p, s);
  if (!un.ok) return un.reason ?? 'Locked';
  const costs = nextCost(id, cur + 1);
  if (!costs.length) return 'No cost listed';
  if (!pay(p, costs)) return 'Missing materials';
  p.skillRanks[id] = cur + 1;
  // Auto-bind a newly learned category skill to the first empty hotbar slot.
  if (cur === 0 && s.branch !== 'basic') {
    p.skillBar ??= defaultBar();
    const i = p.skillBar.findIndex((x) => !x);
    if (i >= 0) p.skillBar[i] = id;
  }
  return null;
}

/** How many scaling ranks apply: basic uses rank (0 = base); category uses rank-1 (1 = base). */
export function scalingRanks(s: SkillDef, rank: number): number {
  return s.branch === 'basic' ? rank : Math.max(0, rank - 1);
}

/** Attack multiplier including rank (1.4 = 140%). */
export function damageMul(id: string, rank: number): number {
  const s = skill(id);
  if (!s) return 1;
  const pct = RANK_PCT[s.branch] ?? 5;
  return (s.damage_multiplier ?? 1) + (pct / 100) * scalingRanks(s, rank);
}

/** Buff / shield effects grow as effect × (1 + N% × scaling ranks). */
export function effectScale(id: string, rank: number): number {
  const s = skill(id);
  if (!s) return 1;
  return 1 + ((RANK_PCT[s.branch] ?? 5) / 100) * scalingRanks(s, rank);
}

export function rageNumbers(p: P.PlayerData): { dealtPct: number; takenPct: number } {
  const base = { dealtPct: 15, takenPct: 10 }; // skills.effect for Rage
  const k = effectScale('rage', rankOf(p, 'rage'));
  return { dealtPct: Math.round(base.dealtPct * k), takenPct: Math.round(base.takenPct * k) };
}

/** Soul Guard shield = 18% of max HP × effect scale. */
export function shieldAmount(p: P.PlayerData): number {
  return Math.round(P.maxHp(p) * 0.18 * effectScale('soul_guard', rankOf(p, 'soul_guard')));
}

export function defaultBar(): (string | null)[] { return ['power_strike', 'rage', null, null, 'meadow_dew', 'clear_dew']; }

export function migrateBar(p: P.PlayerData): void {
  const def = defaultBar();
  if (!p.skillBar || !p.skillBar.length) { p.skillBar = def.slice(); return; }
  if (p.skillBar.length < 6) {
    const next = p.skillBar.slice();
    while (next.length < 6) next.push(null);
    if (!next[4]) next[4] = 'meadow_dew';
    if (!next[5]) next[5] = 'clear_dew';
    p.skillBar = next;
  }
}

export function barOf(p: P.PlayerData): (string | null)[] {
  migrateBar(p);
  return p.skillBar;
}

export function isHotbarItem(id: string | null | undefined): boolean {
  return !!id && !!DB.items[id] && DB.items[id].item_type === 'consumable';
}
export function isHotbarSkill(id: string | null | undefined): boolean {
  return !!id && !!DB.skills[id];
}

export function assignBar(p: P.PlayerData, slot: number, id: string | null): void {
  const bar = barOf(p);
  if (slot < 0 || slot > 5) return;
  if (id) {
    const i = bar.indexOf(id);
    if (i >= 0) bar[i] = bar[slot]; // swap if already bound
  }
  bar[slot] = id;
}

export function cooldownOf(id: string): number { return ASSUME.cooldownMs[id] ?? 2000; }

/** Short summary of the next-rank change, for the preview panel. */
export function rankPreview(id: string, rank: number): string {
  const s = skill(id);
  if (!s) return '';
  const next = rank + 1;
  if (s.damage_multiplier) {
    const a = Math.round(damageMul(id, rank) * 100);
    const b = Math.round(damageMul(id, next) * 100);
    // Category skills learn at rank 1 with the base multiplier and only scale from rank 2,
    // so 150% → 150% at 0→1 looked broken. Spell out the first increase instead.
    if (a === b && s.branch !== 'basic') {
      const later = Math.round(damageMul(id, Math.max(next, 2)) * 100);
      const pct = RANK_PCT[s.branch] ?? 5;
      const verb = rank === 0 ? 'Learn at' : `Rank ${rank}:`;
      return `${verb} ${a}% damage · further ranks +${pct}% each (${later}% at rank ${Math.max(next, 2)})`;
    }
    return `${a}% → ${b}% damage`;
  }
  if (id === 'rage') {
    const n = (rk: number) => {
      const k = effectScale('rage', rk);
      return { d: Math.round(15 * k), t: Math.round(10 * k) };
    };
    const a = n(rank), b = n(next);
    return `+${a.d}% dealt / +${a.t}% taken → +${b.d}% / +${b.t}%`;
  }
  if (id === 'soul_guard') {
    const k = (hp: number) => Math.round(18 * effectScale('soul_guard', hp));
    return `Shield ${k(rank)}% max HP → ${k(next)}%`;
  }
  return s.effect;
}
