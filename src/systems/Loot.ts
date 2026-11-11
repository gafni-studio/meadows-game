import { dropsFor, DB } from '../data/db';
import { LOOT } from '../data/assumptions';

export interface RolledDrop { itemId: string; qty: number; rare: boolean }

/** Quantity between lo and hi, weighted toward lo (r^skew): with 1-4, P(1) ≈ 50%, P(4) ≈ 13%. */
export function rollQty(lo: number, hi: number): number {
  if (hi <= lo) return lo;
  return lo + Math.min(hi - lo, Math.floor(Math.pow(Math.random(), LOOT.qtySkew) * (hi - lo + 1)));
}

/**
 * Each drop_tables row is an independent roll (drop_rate is a percent, min_qty-max_qty a low-weighted range).
 * rateMul (console `droprate`, later luck buffs) affects chance AND quantity:
 *   chance = drop_rate × rateMul (capped at 100%);
 *   above 1×, max_qty grows by LOOT.maxQtyPerMul per extra 1×, and any chance overflowing 100%
 *   becomes a bonus roll for one more stack. Streaks happen naturally: nothing for a few kills, then ×3.
 * Rows gated by unlock_requirement_id are skipped (only Night Stump uses one).
 */
export function rollDrops(monsterId: string, rateMul = 1): RolledDrop[] {
  const out: RolledDrop[] = [];
  const extra = Math.max(0, rateMul - 1);
  for (const row of dropsFor(monsterId)) {
    if (row.unlock_requirement_id) continue;
    if (!DB.items[row.item_id]) continue;
    const chance = row.drop_rate * rateMul;
    if (Math.random() * 100 >= chance) continue;
    const lo = row.min_qty ?? 1;
    const hi = Math.round((row.max_qty ?? lo) * (1 + extra * LOOT.maxQtyPerMul));
    let qty = rollQty(lo, Math.max(lo, hi));
    if (chance > 100 && Math.random() * 100 < chance - 100) qty += rollQty(lo, Math.max(lo, hi)); // overflow → bonus roll
    out.push({ itemId: row.item_id, qty, rare: row.drop_rate < 1 });
  }
  return out;
}
