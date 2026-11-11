import { PlayerData, newPlayer, maxHp, maxMp, migrateGear } from './Player';
import { DB } from '../data/db';

const KEY = 'meadows.save.v1';

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
  p.savedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}
