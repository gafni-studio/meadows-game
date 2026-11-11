import { DB, f, xpToNext, ConsumableEffect } from '../data/db';
import { ASSUME } from '../data/assumptions';

export type Stat = 'STR' | 'INT' | 'AGI' | 'SPI';
export const STATS: Stat[] = ['STR', 'INT', 'AGI', 'SPI'];
export const EQUIP_SLOTS = ['weapon', 'head', 'torso', 'legs', 'gloves', 'boots'] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

/** Everything that is saved. Plain data only. */
export interface PlayerData {
  version: 1;
  classId: 'warrior';
  level: number;
  xp: number; // progress toward next level
  unspent: number;
  stats: Record<Stat, number>;
  hp: number;
  mp: number;
  coins: number;
  inventory: Record<string, number>; // item_id → qty
  equipment: Partial<Record<EquipSlot, string>>;
  area: string;
  x: number;
  skillRanks: Record<string, number>;
  questFlags: Record<string, boolean>;
  savedAt?: number;
}

export function newPlayer(): PlayerData {
  const pts = f('player_points_per_level'); // level 1 already has 5 × 1 points to spend
  const p: PlayerData = {
    version: 1, classId: 'warrior', level: 1, xp: 0, unspent: pts,
    stats: { STR: 0, INT: 0, AGI: 0, SPI: 0 }, hp: 1, mp: 1, coins: 0,
    inventory: {}, equipment: { weapon: ASSUME.starterWeapon }, area: 'meadow_town', x: 200,
    skillRanks: { power_strike: 0, rage: 0 },
    questFlags: {},
  };
  p.hp = maxHp(p);
  p.mp = maxMp(p);
  return p;
}

const cls = (p: PlayerData) => p.classId;

export function maxHp(p: PlayerData): number {
  return f(`hp_base_${cls(p)}`) + f(`hp_per_level_${cls(p)}`) * (p.level - 1) + p.stats.STR * f('hp_per_str');
}
export function maxMp(p: PlayerData): number {
  return f(`mp_base_${cls(p)}`) + f(`mp_per_level_${cls(p)}`) * (p.level - 1) + p.stats.INT * f('mp_per_int');
}
export function mpRegenPerSec(p: PlayerData): number {
  return f('mp_regen_base') + p.stats.SPI * f('mp_regen_per_spi');
}
export function mainStat(p: PlayerData): number {
  return p.classId === 'warrior' ? p.stats.STR : 0;
}
/** combat_formulas.attack_formula: (weapon_damage + main_stat × 2) × weapon_stat_multiplier */
export function attack(p: PlayerData): number {
  const w = p.equipment.weapon ? DB.gear[p.equipment.weapon] : undefined;
  const dmg = w ? w.weapon_damage : ASSUME.unarmedDamage;
  const mult = w ? w.stat_multiplier : ASSUME.unarmedMultiplier;
  return Math.floor((dmg + mainStat(p) * 2) * mult);
}
export function defense(p: PlayerData): number {
  let d = 0;
  for (const s of EQUIP_SLOTS) {
    const id = p.equipment[s];
    if (id && s !== 'weapon') d += DB.gear[id]?.defense ?? 0;
  }
  return d;
}
/** crit = 5% + AGI × 0.4% (as a percent number). */
export function critChance(p: PlayerData): number {
  return f('crit_base_chance') + p.stats.AGI * f('crit_per_agi');
}
/** attack_interval = 1.0 / (1 + AGI × 0.005) seconds */
export function attackIntervalMs(p: PlayerData): number {
  return 1000 / (1 + p.stats.AGI * 0.005);
}

export function addItem(p: PlayerData, id: string, qty: number): void {
  if (id === 'copper_coin') { p.coins += qty; return; }
  p.inventory[id] = (p.inventory[id] ?? 0) + qty;
}
export function removeItem(p: PlayerData, id: string, qty = 1): boolean {
  const have = p.inventory[id] ?? 0;
  if (have < qty) return false;
  if (have === qty) delete p.inventory[id];
  else p.inventory[id] = have - qty;
  return true;
}

/** Gear requirement check (gear.required_stat / required_value; "any" = total points). */
export function canEquip(p: PlayerData, itemId: string): { ok: boolean; reason?: string } {
  const g = DB.gear[itemId];
  if (!g) return { ok: false, reason: 'Not equippable' };
  if (g.class_id !== 'any' && g.class_id !== p.classId) return { ok: false, reason: `${g.class_id} only` };
  if (g.required_stat && g.required_value > 0) {
    const have = g.required_stat === 'any' ? STATS.reduce((a, s) => a + p.stats[s], 0) : p.stats[g.required_stat as Stat] ?? 0;
    if (have < g.required_value) return { ok: false, reason: `Needs ${g.required_value} ${g.required_stat}` };
  }
  return { ok: true };
}
export function equip(p: PlayerData, itemId: string): string | null {
  const g = DB.gear[itemId];
  const chk = canEquip(p, itemId);
  if (!g || !chk.ok) return chk.reason ?? 'Cannot equip';
  const slot = g.slot as EquipSlot;
  if (!removeItem(p, itemId)) return 'Not in inventory';
  const prev = p.equipment[slot];
  if (prev) addItem(p, prev, 1);
  p.equipment[slot] = itemId;
  clampVitals(p);
  return null;
}
export function unequip(p: PlayerData, slot: EquipSlot): void {
  const id = p.equipment[slot];
  if (!id) return;
  delete p.equipment[slot];
  addItem(p, id, 1);
  clampVitals(p);
}

export function clampVitals(p: PlayerData): void {
  p.hp = Math.min(p.hp, maxHp(p));
  p.mp = Math.min(p.mp, maxMp(p));
}

/** Adds XP; returns number of levels gained. Level-up: +5 points, full HP/MP (game_rules.level_up_rewards). */
export function gainXp(p: PlayerData, amount: number): number {
  p.xp += amount;
  let gained = 0;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.unspent += f('player_points_per_level');
    gained++;
  }
  if (gained) { p.hp = maxHp(p); p.mp = maxMp(p); }
  return gained;
}

/** game_rules.death_penalty: lose 5% of current-level XP progress, never below 0 (no level loss). Returns XP lost. */
export function applyDeathPenalty(p: PlayerData): number {
  const lost = Math.floor(p.xp * 0.05);
  p.xp = Math.max(0, p.xp - lost);
  return lost;
}

export function spendPoint(p: PlayerData, s: Stat): void {
  if (p.unspent <= 0) return;
  p.unspent--;
  p.stats[s]++;
  if (s === 'STR') p.hp += f('hp_per_str');
  if (s === 'INT') p.mp += f('mp_per_int');
}

export function applyConsumable(p: PlayerData, eff: ConsumableEffect): void {
  if (eff.hp) p.hp = Math.min(maxHp(p), p.hp + eff.hp);
  if (eff.mp) p.mp = Math.min(maxMp(p), p.mp + eff.mp);
}
