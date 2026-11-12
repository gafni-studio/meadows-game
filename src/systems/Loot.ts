import { dropsFor, DB } from '../data/db';
import { LOOT } from '../data/assumptions';
import { isGear, makeGear, GearInstance } from './Gear';
import { dropMulFor } from './Passives';
import * as P from './Player';

export interface RolledDrop { itemId: string; qty: number; rare: boolean; inst?: GearInstance; instances?: GearInstance[] }

/** Quantity between lo and hi, weighted toward lo (r^skew): with 1-4, P(1) ≈ 50%, P(4) ≈ 13%. */
export function rollQty(lo: number, hi: number): number {
  if (hi <= lo) return lo;
  return lo + Math.min(hi - lo, Math.floor(Math.pow(Math.random(), LOOT.qtySkew) * (hi - lo + 1)));
}

/**
 * Each drop_tables row is an independent roll (drop_rate is a percent, min_qty-max_qty a low-weighted range).
 * rateMul (console `droprate`) affects chance AND quantity:
 *   chance = drop_rate × rateMul;
 *   above 1×, max_qty grows by LOOT.maxQtyPerMul per extra 1×, and chance overflowing 100%
 *   becomes a bonus roll. Gear always yields one instance per successful roll (stats rolled now, magic ~1/12);
 *   a bonus roll spawns a second instance.
 */
export function rollDrops(monsterId: string, rateMul = 1, player?: P.PlayerData): RolledDrop[] {
  const out: RolledDrop[] = [];
  const extra = Math.max(0, rateMul - 1);
  for (const row of dropsFor(monsterId)) {
    if (row.unlock_requirement_id) continue;
    if (!DB.items[row.item_id]) continue;
    const cat = player ? dropMulFor(player, row.item_id) : 1;
    const chance = row.drop_rate * rateMul * cat;
    if (Math.random() * 100 >= chance) continue;
    if (isGear(row.item_id)) {
      const n = 1 + (chance > 100 && Math.random() * 100 < chance - 100 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const inst = makeGear(row.item_id, { mode: 'random' }); // includes magic roll
        out.push({ itemId: row.item_id, qty: 1, rare: inst.magic || row.drop_rate < 1, inst });
      }
      continue;
    }
    const lo = row.min_qty ?? 1;
    const hi = Math.round((row.max_qty ?? lo) * (1 + extra * LOOT.maxQtyPerMul));
    let qty = rollQty(lo, Math.max(lo, hi));
    if (chance > 100 && Math.random() * 100 < chance - 100) qty += rollQty(lo, Math.max(lo, hi));
    out.push({ itemId: row.item_id, qty, rare: row.drop_rate < 1 });
  }
  return out;
}
