/**
 * Nature + Elemental passive trees (v0.2.2).
 * Each tree has one production node (category essence only) and one efficiency node
 * (+% category material / essence finds). Rate is a whole-number table (v0.2.6: 1,2,3,5,8,12,18,28,42,64 /h);
 * rank 0 yields nothing. Production accrues online and offline from timestamps.
 * Upgrade time is 10 × 1.6^(targetRank−1) minutes; cost is paid up front. One upgrade at a time.
 * Spiritual and Hunter's Luck stay parked.
 */
import { DB, tab, descOf } from '../data/db';
import * as P from './Player';
import { Game } from './GameState';
import * as Q from './Quests';

export interface PassiveNode {
  id: string; tree_id: string; name: string; effect_type: string; effect_per_rank: string;
  max_rank: number; upgrade_time_per_rank?: string | null; status?: string | null;
  notes?: string; desc?: string; description?: string;
}
interface CostRow { node_id: string; rank: number; material_id: string; quantity: number }
export interface Cost { itemId: string; qty: number }
export interface Upgrade { nodeId: string; targetRank: number; startedAt: number; doneAt: number }

const NODES = tab<PassiveNode>('passive_nodes');
const COSTS = tab<CostRow>('passive_costs');

/** Trees shipped in v0.2.2. Spiritual is parked. */
export const LIVE_TREES = ['nature', 'elemental'] as const;
export type TreeId = (typeof LIVE_TREES)[number];

const ESSENCE: Record<string, string> = {
  nature_prod: 'nature_essence',
  elemental_prod: 'elemental_essence',
  spiritual_prod: 'spirit_essence',
};

const SUB_CAT: Record<string, TreeId | 'spiritual'> = {
  wood: 'nature', hide: 'nature', stone: 'nature',
  earth: 'elemental', fire: 'elemental', ice: 'elemental', lightning: 'elemental',
  holy: 'spiritual', soul: 'spiritual', curse: 'spiritual',
};

export function nodesOf(tree: string): PassiveNode[] {
  return NODES.filter((n) => n.tree_id === tree && (n.status ?? '') !== 'deprecated'
    && (n.effect_type === 'production' || n.effect_type === 'efficiency'));
}
export function liveNodes(): PassiveNode[] {
  return LIVE_TREES.flatMap((t) => nodesOf(t));
}
export function node(id: string): PassiveNode | undefined {
  return NODES.find((n) => n.id === id);
}
export function isLive(id: string): boolean {
  const n = node(id);
  return !!n && (LIVE_TREES as readonly string[]).includes(n.tree_id) && (n.status ?? '') !== 'deprecated';
}

export function rankOf(p: P.PlayerData, id: string): number { return p.passiveRanks?.[id] ?? 0; }

/** v0.2.6: whole essences per hour by rank (index = rank). Rank 0 yields nothing. */
export const RATE_TABLE = [0, 1, 2, 3, 5, 8, 12, 18, 28, 42, 64];

/** Essence / hour at this rank (0 at rank 0). Always a whole number. */
export function rateAt(rank: number): number {
  if (rank < 1) return 0;
  return RATE_TABLE[Math.min(rank, RATE_TABLE.length - 1)];
}
export function rateOf(p: P.PlayerData, id: string): number {
  const n = node(id);
  if (!n || n.effect_type !== 'production') return 0;
  let r = rankOf(p, id);
  // During an upgrade the current rank still produces; the next rank starts at doneAt (handled in settle).
  return rateAt(r);
}

/** Minutes to finish an upgrade TO this rank. */
export function upgradeMinutes(targetRank: number): number {
  if (targetRank < 1) return 0;
  return 10 * Math.pow(1.6, targetRank - 1);
}

/** v0.2.6: a node whose every rank 1-10 lists its own recipe (a Copper row at each rank). No 1.6× scaling. */
const EXPLICIT = new Set(
  [...new Set(COSTS.map((r) => r.node_id))].filter((id) =>
    Array.from({ length: 10 }, (_, i) => i + 1).every((rk) => COSTS.some((r) => r.node_id === id && r.rank === rk && r.material_id === 'copper_coin'))),
);

export function nextCost(id: string, nextRank: number): Cost[] {
  const n = node(id);
  if (!n || nextRank < 1 || nextRank > (n.max_rank ?? 10)) return [];
  if (EXPLICIT.has(id)) return COSTS.filter((r) => r.node_id === id && r.rank === nextRank).map((r) => ({ itemId: r.material_id, qty: r.quantity }));
  const scale = Math.pow(1.6, nextRank - 1);
  const at1 = COSTS.filter((r) => r.node_id === id && r.rank === 1);
  const atRank = COSTS.filter((r) => r.node_id === id && r.rank === nextRank);
  const override = new Set(nextRank === 1 ? [] : atRank.map((r) => r.material_id));
  const out: Cost[] = [];
  for (const row of at1) {
    if (override.has(row.material_id)) continue;
    out.push({ itemId: row.material_id, qty: Math.max(1, Math.round(row.quantity * scale)) });
  }
  if (nextRank > 1) for (const row of atRank) out.push({ itemId: row.material_id, qty: row.quantity });
  return out;
}

function canAfford(p: P.PlayerData, costs: Cost[]): boolean {
  return costs.every((c) => (c.itemId === 'copper_coin' ? p.coins : (p.inventory[c.itemId] ?? 0)) >= c.qty);
}
function pay(p: P.PlayerData, costs: Cost[]): boolean {
  if (!canAfford(p, costs)) return false;
  for (const c of costs) {
    if (c.itemId === 'copper_coin') p.coins -= c.qty;
    else P.removeItem(p, c.itemId, c.qty);
  }
  return true;
}

export function startUpgrade(p: P.PlayerData, id: string, now = Date.now()): string | null {
  settle(p, now, true);
  if (!isLive(id)) return 'Not available yet';
  const n = node(id)!;
  if (p.passiveUpgrade) return `Already upgrading ${node(p.passiveUpgrade.nodeId)?.name ?? p.passiveUpgrade.nodeId}`;
  const cur = rankOf(p, id);
  const max = n.max_rank ?? 10;
  if (cur >= max) return 'Already at max rank';
  const costs = nextCost(id, cur + 1);
  if (!costs.length) return 'No cost listed';
  if (!pay(p, costs)) return 'Missing materials';
  const ms = upgradeMinutes(cur + 1) * 60_000;
  p.passiveUpgrade = { nodeId: id, targetRank: cur + 1, startedAt: now, doneAt: now + ms };
  Game.toast(`Upgrading ${n.name} to rank ${cur + 1} — ${formatDur(ms)}`, 'info');
  Q.onPassive(p);
  Game.changed();
  Game.save();
  return null;
}

export function formatDur(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60 ? ` ${s % 60}s` : ''}`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`;
}

function grantEssence(p: P.PlayerData, nodeId: string, hours: number): number {
  const essence = ESSENCE[nodeId];
  const rate = rateAt(rankOf(p, nodeId));
  if (!essence || rate <= 0 || hours <= 0) return 0;
  p.passiveFrac ??= {};
  const frac = (p.passiveFrac[nodeId] ?? 0) + rate * hours;
  const whole = Math.floor(frac + 1e-9);
  p.passiveFrac[nodeId] = frac - whole;
  if (whole > 0) P.addItem(p, essence, whole);
  return whole;
}

/**
 * Apply finished upgrades and accrue production since `passiveAt`.
 * Safe to call often; toasts only when at least one essence is granted (unless silent).
 */
export function settle(p: P.PlayerData, now = Date.now(), silent = false): number {
  p.passiveRanks ??= {};
  p.passiveFrac ??= {};
  let last = p.passiveAt ?? now;
  if (last > now) last = now;
  const got: Record<string, number> = {};
  const bump = (id: string, n: number) => { if (n) got[id] = (got[id] ?? 0) + n; };

  const up = p.passiveUpgrade;
  if (up && up.doneAt <= now && up.doneAt > last) {
    // Produce at the old rank until the upgrade finishes, then bump.
    const hours = (up.doneAt - last) / 3_600_000;
    for (const n of liveNodes()) if (n.effect_type === 'production') bump(n.id, grantEssence(p, n.id, hours));
    p.passiveRanks[up.nodeId] = up.targetRank;
    if (!silent) Game.toast(`${node(up.nodeId)?.name ?? up.nodeId} reached rank ${up.targetRank}`, 'rare');
    p.passiveUpgrade = undefined;
    last = up.doneAt;
  } else if (up && up.doneAt <= now) {
    p.passiveRanks[up.nodeId] = up.targetRank;
    if (!silent) Game.toast(`${node(up.nodeId)?.name ?? up.nodeId} reached rank ${up.targetRank}`, 'rare');
    p.passiveUpgrade = undefined;
  }

  if (now > last) {
    const hours = (now - last) / 3_600_000;
    for (const n of liveNodes()) if (n.effect_type === 'production') bump(n.id, grantEssence(p, n.id, hours));
  }
  p.passiveAt = now;

  const parts: string[] = [];
  let total = 0;
  for (const [id, n] of Object.entries(got)) {
    if (n <= 0) continue;
    total += n;
    const ess = ESSENCE[id];
    parts.push(`${n}× ${DB.items[ess]?.name ?? ess}`);
    if (!silent) Game.toast(`${node(id)?.name ?? id} yielded ${n}× ${DB.items[ess]?.name ?? ess}`, 'loot', ess);
  }
  if (silent && total > 0) {
    p.passiveReport = `While you were away: ${parts.join(', ')}.`;
  }
  return total;
}

/** Finish a pending upgrade immediately (cheat / tests). */
export function finishUpgrade(p: P.PlayerData): string {
  if (!p.passiveUpgrade) return 'No upgrade in progress';
  p.passiveUpgrade.doneAt = Date.now();
  settle(p);
  Game.changed();
  Game.save();
  return `${node(p.passiveUpgrade?.nodeId ?? '')?.name ?? 'Node'} done`;
}

/** Accrue as if `hours` passed (cheat / tests). Completes upgrades that fall in that window. */
export function waitHours(p: P.PlayerData, hours: number): string {
  const now = Date.now();
  // Shift the clock backward on timestamps so settle sees a gap, including mid-upgrade.
  const shift = hours * 3_600_000;
  if (p.passiveAt != null) p.passiveAt -= shift;
  else p.passiveAt = now - shift;
  if (p.passiveUpgrade) {
    p.passiveUpgrade.startedAt -= shift;
    p.passiveUpgrade.doneAt -= shift;
  }
  const n = settle(p, now);
  Game.changed();
  Game.save();
  return `Advanced ${hours}h — ${n} essence collected`;
}

export function setRank(p: P.PlayerData, id: string, rank: number): string {
  if (!isLive(id) && !node(id)) return `Unknown node ${id}`;
  p.passiveRanks ??= {};
  p.passiveRanks[id] = Math.max(0, Math.min(node(id)?.max_rank ?? 10, rank));
  settle(p, Date.now(), true);
  Game.changed();
  Game.save();
  return `${node(id)?.name ?? id} rank ${p.passiveRanks[id]} (${rateAt(p.passiveRanks[id])}/h)`;
}

/** Category of an item for efficiency bonuses, or null. */
export function categoryOf(itemId: string): TreeId | 'spiritual' | null {
  if (itemId === 'nature_essence') return 'nature';
  if (itemId === 'elemental_essence') return 'elemental';
  if (itemId === 'spirit_essence') return 'spiritual';
  const it = DB.items[itemId];
  if (!it) return null;
  const sub = it.subtype_id as string | null;
  if (sub && SUB_CAT[sub]) return SUB_CAT[sub];
  return null;
}

/** Extra drop-rate multiplier from efficiency nodes (1 = no bonus). */
export function dropMulFor(p: P.PlayerData, itemId: string): number {
  const cat = categoryOf(itemId);
  if (!cat || cat === 'spiritual') return 1; // spiritual parked
  const nid = cat === 'nature' ? 'nature_eff_drops' : 'elemental_eff_drops';
  const r = rankOf(p, nid);
  return 1 + 0.02 * r;
}

export function preview(p: P.PlayerData, id: string): string {
  const n = node(id);
  if (!n) return '';
  const r = rankOf(p, id);
  if (n.effect_type === 'production') {
    const a = rateAt(r), b = rateAt(r + 1);
    if (r === 0) return `Learn: ${b} essence per hour (none at rank 0)`;
    return `${a}/h → ${b}/h`;
  }
  if (n.effect_type === 'efficiency') {
    const pct = (rk: number) => 2 * rk;
    return `+${pct(r)}% finds → +${pct(r + 1)}%`;
  }
  return n.effect_per_rank;
}

export function flavor(n: PassiveNode): string {
  return descOf(n) || n.desc || (n.effect_type === 'production'
    ? `Slowly produces ${n.name} while you play or are away. Rank 0 yields nothing.`
    : n.effect_per_rank);
}

export function remainingMs(p: P.PlayerData, now = Date.now()): number {
  return p.passiveUpgrade ? Math.max(0, p.passiveUpgrade.doneAt - now) : 0;
}

export function fracToward(p: P.PlayerData, id: string): number {
  return p.passiveFrac?.[id] ?? 0;
}

export function etaNextEssence(p: P.PlayerData, id: string): string | null {
  const rate = rateOf(p, id);
  if (rate <= 0) return null;
  const have = fracToward(p, id);
  const hours = (1 - have) / rate;
  return formatDur(hours * 3_600_000);
}
