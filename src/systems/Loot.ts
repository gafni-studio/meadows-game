import { dropsFor, DB } from '../data/db';

export interface RolledDrop { itemId: string; qty: number; rare: boolean }

/**
 * Each drop_tables row is an independent roll (drop_rate is a percent).
 * Rows gated by unlock_requirement_id are skipped in v0.1 (only Night Stump uses one).
 */
export function rollDrops(monsterId: string): RolledDrop[] {
  const out: RolledDrop[] = [];
  for (const row of dropsFor(monsterId)) {
    if (row.unlock_requirement_id) continue;
    if (!DB.items[row.item_id]) continue;
    if (Math.random() * 100 >= row.drop_rate) continue;
    const qty = row.min_qty + Math.floor(Math.random() * (row.max_qty - row.min_qty + 1));
    out.push({ itemId: row.item_id, qty, rare: row.drop_rate < 1 });
  }
  return out;
}
