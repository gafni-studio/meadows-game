import { PlayerData, newPlayer, maxHp, maxMp, migrateGear } from './Player';
import { migrateBar } from './Skills';
import { DB } from '../data/db';

const KEY = 'meadows.save.v1';
const KEY_PREFIX = 'meadows';

/** Set while a reset is in flight so autosave / beforeunload cannot rewrite the old character. */
let wiping = false;

export function isWiping(): boolean {
  return wiping;
}

export function loadSave(): PlayerData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newPlayer();
    const base = newPlayer();
    const p = { ...base, ...JSON.parse(raw) } as PlayerData;
    p.cheats = { ...base.cheats, ...(p.cheats ?? {}) };
    p.storage ??= {};
    p.bagSlots ??= [];
    p.storageSlots ??= [];
    p.skillRanks ??= { power_strike: 0, rage: 0 };
    p.skillBar ??= ['power_strike', 'rage', null, null];
    migrateGear(p);
    migrateBar(p);
    if (!DB.areas[p.area]) p.area = 'meadow_town';
    // Drop unknown item ids if the sheet removed them since the save was written.
    for (const id of Object.keys(p.inventory)) if (!DB.items[id]) delete p.inventory[id];
    for (const id of Object.keys(p.storage)) if (!DB.items[id]) delete p.storage[id];
    p.hp = Math.min(Math.max(1, p.hp), maxHp(p));
    p.mp = Math.min(Math.max(0, p.mp), maxMp(p));
    return p;
  } catch {
    return newPlayer();
  }
}

export function writeSave(p: PlayerData): void {
  if (wiping || !p) return;
  p.savedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(p));
}

/** Clear every meadows.* key (current and any leftover versioned keys) and arm the wipe flag. */
export function clearSave(): void {
  wiping = true;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
}

/** Clear every game key and reload onto a fresh character. Safe against beforeunload autosave. */
export function resetAndReload(): void {
  clearSave();
  location.reload();
}
