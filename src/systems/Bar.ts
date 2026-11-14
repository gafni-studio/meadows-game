/**
 * Equip slots (v0.2.7). Eight slots in three groups:
 *   attack 1-4 (keys 1-4), buff 5-6 (keys 5-6), potion Q / G (HP and MP drinks).
 * A skill only fits its own group (skills.type: active → attack, buff → buff); consumables go in potion slots.
 * Old saves had six mixed slots; migrateBar sorts them into the new groups.
 */
import { DB } from '../data/db';
import type { PlayerData } from './Player';

export type SlotGroup = 'attack' | 'buff' | 'potion';
export const BAR_SIZE = 8;
export const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', 'Q', 'G'];
export const GROUP_SLOTS: Record<SlotGroup, number[]> = { attack: [0, 1, 2, 3], buff: [4, 5], potion: [6, 7] };

export function slotGroup(i: number): SlotGroup { return i < 4 ? 'attack' : i < 6 ? 'buff' : 'potion'; }

/** Which group an id belongs in: a skill by its type, a consumable as a potion, otherwise null. */
export function idGroup(id: string | null | undefined): SlotGroup | null {
  if (!id) return null;
  const s = DB.skills[id];
  if (s) return s.type === 'buff' ? 'buff' : 'attack';
  if (DB.items[id]?.item_type === 'consumable') return 'potion';
  return null;
}

export function defaultBar(): (string | null)[] { return [null, null, null, null, null, null, 'meadow_dew', 'clear_dew']; }

export function isHotbarItem(id: string | null | undefined): boolean {
  return !!id && !!DB.items[id] && DB.items[id].item_type === 'consumable';
}
export function isHotbarSkill(id: string | null | undefined): boolean {
  return !!id && !!DB.skills[id];
}

/** Put an id in the first empty slot of its group. Returns the slot, or -1 if the group is full / it is already bound. */
export function autoBind(bar: (string | null)[], id: string): number {
  if (bar.includes(id)) return bar.indexOf(id);
  const g = idGroup(id);
  if (!g) return -1;
  for (const i of GROUP_SLOTS[g]) if (!bar[i]) { bar[i] = id; return i; }
  return -1;
}

/** Sort an old six-slot bar (skills and potions mixed) into the grouped layout. */
export function migrateBar(p: PlayerData): void {
  const old = p.skillBar;
  if (old && old.length === BAR_SIZE) {
    // v0.2.9: sort anything sitting in the wrong kind of slot (attacks in attacks, buffs in buffs, potions in potions)
    const wrong: string[] = [];
    old.forEach((id, i) => { if (id && idGroup(id) !== slotGroup(i)) { wrong.push(id); old[i] = null; } });
    for (const id of wrong) autoBind(old, id);
    return;
  }
  const next: (string | null)[] = new Array(BAR_SIZE).fill(null);
  for (const id of old ?? []) if (id) autoBind(next, id);
  const def = defaultBar();
  for (const i of GROUP_SLOTS.potion) if (!next[i] && !next.includes(def[i]!)) next[i] = def[i];
  p.skillBar = next;
}

export function barOf(p: PlayerData): (string | null)[] {
  migrateBar(p);
  return p.skillBar;
}

/** Bind an id to a slot of the right group. Returns an error message, or null on success. */
export function assignBar(p: PlayerData, slot: number, id: string | null): string | null {
  const bar = barOf(p);
  if (slot < 0 || slot >= BAR_SIZE) return 'No such slot';
  if (id) {
    const g = idGroup(id);
    if (g !== slotGroup(slot)) {
      return g === 'attack' ? 'Attacks go in the attack slots (1–4)' : g === 'buff' ? 'Buffs go in the buff slots (5–6)' : g === 'potion' ? 'Potions go in the Q and G slots' : 'Cannot be bound';
    }
    const i = bar.indexOf(id);
    if (i >= 0) bar[i] = bar[slot]; // swap if already bound
  }
  bar[slot] = id;
  return null;
}
