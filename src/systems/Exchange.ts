/** Ila's 10:1 essence bench. Recipes come from data/exchange.json. */
import { DB, tab } from '../data/db';
import * as P from './Player';
import { Game } from './GameState';

export interface Recipe {
  id: string; input_item_id: string; input_qty: number; output_item_id: string; output_qty: number;
  notes?: string;
}

export function recipes(): Recipe[] {
  return tab<Recipe>('exchange').filter((r) => DB.items[r.input_item_id] && DB.items[r.output_item_id]);
}

export function recipe(id: string): Recipe | undefined { return recipes().find((r) => r.id === id); }

export function maxBatches(p: P.PlayerData, r: Recipe): number {
  return Math.floor((p.inventory[r.input_item_id] ?? 0) / r.input_qty);
}

export function trade(p: P.PlayerData, id: string, batches = 1): string | null {
  const r = recipe(id);
  if (!r) return 'Unknown recipe';
  const n = Math.max(1, Math.floor(batches));
  if (maxBatches(p, r) < n) return `Need ${r.input_qty * n}× ${DB.items[r.input_item_id].name}`;
  P.removeItem(p, r.input_item_id, r.input_qty * n);
  P.addItem(p, r.output_item_id, r.output_qty * n);
  const out = `${r.output_qty * n}× ${DB.items[r.output_item_id].name}`;
  Game.toast(`Exchanged ${r.input_qty * n}× ${DB.items[r.input_item_id].name} for ${out}`, 'loot', r.output_item_id);
  Game.changed();
  Game.save();
  return null;
}
