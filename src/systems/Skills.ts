/**
 * Skill training (v0.2). Costs and unlocks come from the sheet (skill_costs,
 * skills, unlock_requirements, game_rules.skill_unlocks / skill_rank_scaling).
 *
 * v0.2.6: Power Strike, Rage, Earthbreaker, Root Lash, Flame Cleave and Dig In list an exact recipe
 * at every rank. Parked skills still use rank-1 quantities: for rank r > 1, qty = round(rank_1_qty × 1.6^(r-1)).
 * Rare drops are extra milestone costs at ranks 5 and 10 only.
 * v0.2.1: a skill is known once it is at rank 1 (quest grant, or trained). Category
 * skills still scale from rank 2; basic skills scale from rank 1 as before.
 * Damage skills: +N percentage points of the attack multiplier per scaling rank.
 * Buffs / shields: effect × (1 + N% × scaling ranks).
 */
import { DB, SkillDef, tab } from '../data/db';
import { ASSUME, BOLT } from '../data/assumptions';
import * as P from './Player';
import * as Q from './Quests';

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
  return !!skill(id) && rankOf(p, id) >= 1;
}

/** Fallback by unlock_stage when the skill has no unlock_requirements rows. */
const UNLOCK: Record<string, { level: number; stat: number }> = {
  start: { level: 1, stat: 0 }, early: { level: 3, stat: 5 }, mid: { level: 6, stat: 10 }, late: { level: 8, stat: 15 },
};
interface UnlockRow { target_type: string; target_id: string; requirement_type: string; requirement_id: string | null; requirement_value: number }
const UNLOCK_ROWS = tab<UnlockRow>('unlock_requirements').filter((r) => r.target_type === 'skill');
export function unlockReq(s: SkillDef): { level: number; stat: number } {
  const rows = UNLOCK_ROWS.filter((r) => r.target_id === s.id);
  if (rows.length) {
    let level = 1, stat = 0;
    for (const r of rows) {
      if (r.requirement_type === 'level') level = Number(r.requirement_value) || 1;
      if (r.requirement_type === 'stat') stat = Number(r.requirement_value) || 0;
    }
    return { level, stat };
  }
  return UNLOCK[s.unlock_stage] ?? UNLOCK.start;
}

// ───────────── Paths (v0.2.7) ─────────────
export interface PathDef { id: string; name: string; status: 'live' | 'soon'; description: string }
export const PATHS = tab<PathDef>('paths');
/** The skills of a path in tree order (root first), so keyboard order matches the picture. */
export function pathSkills(pathId: string): SkillDef[] {
  const order = Object.keys(TREE_LAYOUT[pathId]?.nodes ?? {});
  const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? 999 : i; };
  return Object.values(DB.skills).filter((s) => s.path_id === pathId).sort((a, b) => rank(a.id) - rank(b.id));
}
export function prevOf(s: SkillDef): SkillDef | undefined { return s.prev_skill_id ? DB.skills[s.prev_skill_id] : undefined; }
/** locked = the previous skill (or its quest) is missing; available = can be trained; trained = rank 1+. */
export type NodeState = 'locked' | 'available' | 'trained';
export function nodeState(p: P.PlayerData, s: SkillDef): NodeState {
  if (known(p, s.id)) return 'trained';
  return unlockStatus(p, s).ok ? 'available' : 'locked';
}

export function canSee(p: P.PlayerData, s: SkillDef): boolean {
  if (s.path_id) return true; // every node of a path is on the tree
  if (s.class_id !== p.classId) return false;
  // v0.2.3: quest-gated skills stay hidden until the quest is discovered
  // (active or done). Once visible they stay locked until the quest is finished,
  // then they can be trained at Calden.
  if (Q.skillLockedByQuest(s.id)) {
    const line = Q.lineOfSkill(s.id);
    return !!line && (Q.isActive(p, line) || Q.isDone(p, line));
  }
  const r = unlockReq(s);
  return p.level + 2 >= r.level;
}

export function unlockStatus(p: P.PlayerData, s: SkillDef): { ok: boolean; reason?: string } {
  // v0.2.7: a path skill needs its previous skill at rank 1+ and (where one exists) its quest. No level gate.
  if (s.path_id) {
    const prev = prevOf(s);
    if (prev && !known(p, prev.id)) return { ok: false, reason: `Learn ${prev.name} first` };
  }
  if (Q.skillLockedByQuest(s.id) && !Q.skillQuestDone(p, s.id)) {
    const name = Q.lineName(Q.lineOfSkill(s.id) ?? '');
    return { ok: false, reason: `Complete ${name} in your journal (J)` };
  }
  if (s.path_id) return { ok: true };
  const r = unlockReq(s);
  const main = P.mainStat(p);
  const statName = s.scaling_stat ?? (p.classId === 'warrior' ? 'STR' : 'INT');
  if (p.level < r.level && main < r.stat) return { ok: false, reason: `Needs level ${r.level} and ${r.stat} ${statName}` };
  if (p.level < r.level) return { ok: false, reason: `Needs level ${r.level}` };
  if (main < r.stat) return { ok: false, reason: `Needs ${r.stat} ${statName}` };
  return { ok: true };
}

/** Cost to go from current rank to current+1. Empty at max rank. */
/** v0.2.6: a skill whose every rank 1-10 lists its own recipe (a Copper row at each rank). No 1.6× scaling. */
const EXPLICIT = new Set(
  [...new Set(COSTS.map((r) => r.skill_id))].filter((id) =>
    Array.from({ length: 10 }, (_, i) => i + 1).every((rk) => COSTS.some((r) => r.skill_id === id && r.rank === rk && r.material_id === 'copper_coin'))),
);

export function nextCost(id: string, nextRank: number): Cost[] {
  const s = skill(id);
  if (!s || nextRank < 1 || nextRank > (s.max_rank ?? 10)) return [];
  if (EXPLICIT.has(id)) return COSTS.filter((r) => r.skill_id === id && r.rank === nextRank).map((r) => ({ itemId: r.material_id, qty: r.quantity }));
  const scale = Math.pow(1.6, nextRank - 1);
  const at1 = COSTS.filter((r) => r.skill_id === id && r.rank === 1);
  const atRank = COSTS.filter((r) => r.skill_id === id && r.rank === nextRank);
  const override = new Set(nextRank === 1 ? [] : atRank.map((r) => r.material_id));
  const out: Cost[] = [];
  for (const row of at1) {
    if (override.has(row.material_id)) continue; // exact qty lives on the rank row (e.g. Earthbreaker r2 Twig)
    out.push({ itemId: row.material_id, qty: Math.max(1, Math.round(row.quantity * scale)) });
  }
  if (nextRank > 1) for (const row of atRank) out.push({ itemId: row.material_id, qty: row.quantity });
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
  if (!s || (!s.path_id && s.class_id !== p.classId)) return 'Unknown skill';
  const cur = rankOf(p, id);
  const max = s.max_rank ?? 10;
  if (cur >= max) return 'Already at max rank';
  const un = unlockStatus(p, s);
  if (!un.ok) return un.reason ?? 'Locked';
  const costs = nextCost(id, cur + 1);
  if (!costs.length) return 'No cost listed';
  if (!pay(p, costs)) return 'Missing materials';
  p.skillRanks[id] = cur + 1;
  // Auto-bind a newly learned skill to the first empty hotbar slot.
  if (cur === 0) autoBind(barOf(p), id);
  Q.tick(p);
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

/** v0.2.8 Mana Shield: percent less damage taken, 30% + 5% per rank beyond 1 (basic scaling), capped at 60%. */
export function manaShieldPct(p: P.PlayerData): number {
  const k = effectScale('mana_shield', rankOf(p, 'mana_shield'));
  return Math.min(BOLT.shieldMaxPct, Math.round(BOLT.shieldBasePct * k));
}

/** Soul Guard shield = 18% of max HP × effect scale. */
export function shieldAmount(p: P.PlayerData): number {
  return Math.round(P.maxHp(p) * 0.18 * effectScale('soul_guard', rankOf(p, 'soul_guard')));
}

import { autoBind, barOf } from './Bar';
export { defaultBar, migrateBar, barOf, isHotbarItem, isHotbarSkill, assignBar, autoBind } from './Bar';

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
    return id === 'thorn_volley' ? `${a}% → ${b}% damage per thorn (×3)` : `${a}% → ${b}% damage`;
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
  if (id === 'dig_in') {
    return `+50% defense for 60s`;
  }
  if (id === 'mana_shield') {
    const n = (rk: number) => Math.min(BOLT.shieldMaxPct, Math.round(BOLT.shieldBasePct * effectScale('mana_shield', rk)));
    return `${n(Math.max(1, rank))}% less damage → ${n(next)}%`;
  }
  return s.effect;
}

/** Dig In duration in ms (v0.2.5: a flat 60s buff, from skills.duration_s). */
export function digInWindowMs(_p: P.PlayerData): number {
  const s = skill('dig_in');
  return (s?.duration_s ?? 60) * 1000;
}

/**
 * Tree layout per path: column / row of each node, plus the empty "future" slots the design drawing leaves
 * open (not implemented; shown dashed). Rows may be fractional.
 */
export interface TreeNodePos { c: number; r: number }
export interface FutureSlot { c: number; r: number; from: string; label: string; family: 'basic' | 'nature' | 'elemental' | 'spiritual' }
export const TREE_LAYOUT: Record<string, { nodes: Record<string, TreeNodePos>; future: FutureSlot[] }> = {
  warrior: {
    nodes: {
      power_strike: { c: 0, r: 1.5 },
      earthbreaker: { c: 1, r: 0.5 }, dig_in: { c: 1, r: 1.5 }, rage: { c: 1, r: 2.5 },
      root_lash: { c: 2, r: 0 }, flame_cleave: { c: 2, r: 1 },
    },
    future: [
      { c: 0, r: 2.9, from: 'power_strike', label: 'later', family: 'basic' },
      { c: 2, r: 2, from: 'dig_in', label: 'Soul Guard', family: 'spiritual' },
      { c: 2, r: 3, from: 'rage', label: 'later', family: 'basic' },
      { c: 3, r: 1, from: 'flame_cleave', label: 'later', family: 'spiritual' },
    ],
  },
  magician: {
    nodes: {
      magic_bolt: { c: 0, r: 1 },
      mana_shield: { c: 1, r: 1 },
      fire_bolt: { c: 2, r: 0 }, thorn_volley: { c: 2, r: 2 },
      chain_spark: { c: 3, r: 2 },
    },
    future: [
      { c: 3, r: 0, from: 'fire_bolt', label: 'later', family: 'elemental' },
      { c: 4, r: 2, from: 'chain_spark', label: 'later', family: 'spiritual' },
    ],
  },
};
