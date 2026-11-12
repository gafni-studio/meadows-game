import { DB, f, xpToNext, ConsumableEffect } from '../data/db';
import { ASSUME, PLAYER_ACC, PLAYER_EVA, REGEN } from '../data/assumptions';
import { GearInstance, isGear, makeGear, AffixStat } from './Gear';

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
  inventory: Record<string, number>; // stackable item_id → qty (materials, consumables, junk; NOT gear)
  /** Bag layout: stack item_id or gear uid. */
  bagSlots: (string | null)[];
  /** Town storage chest: stackable counts + layout (stack id or gear uid). */
  storage: Record<string, number>;
  storageSlots: (string | null)[];
  /** Unique gear pieces (bag, storage, and equipped). Gear does not stack. */
  gearItems: Record<string, GearInstance>;
  equipment: Partial<Record<EquipSlot, string>>;
  area: string;
  x: number;
  skillRanks: Record<string, number>;
  /** Hotbar slots 1-6: skill id or consumable item id (null = empty). */
  skillBar: (string | null)[];
  questFlags: Record<string, boolean>;
  /** B-004 skill questlines: step is 1-based, done grants the skill at rank 1. */
  questLog?: import('./Quests').QuestLog;
  /** Passive tree ranks (nature_prod, elemental_prod, efficiency nodes). */
  passiveRanks?: Record<string, number>;
  /** Fractional essence accrued per production node, 0–1. */
  passiveFrac?: Record<string, number>;
  /** Timestamp (ms) production was last settled. */
  passiveAt?: number;
  /** One in-progress upgrade, paid and ticking (including offline). */
  passiveUpgrade?: import('./Passives').Upgrade;
  /** Offline yield message, toasted once on the next HUD tick. */
  passiveReport?: string;
  /** Test-console bonuses (DEV_CONSOLE). */
  cheats: { atk: number; def: number; maxHp: number; dropMul: number; god: boolean };
  /** True once any console command changed this save. */
  cheated: boolean;
  savedAt?: number;
}

export function newPlayer(): PlayerData {
  const pts = f('player_points_per_level'); // level 1 already has 5 × 1 points to spend
  const p: PlayerData = {
    version: 1, classId: 'warrior', level: 1, xp: 0, unspent: pts,
    stats: { STR: 0, INT: 0, AGI: 0, SPI: 0 }, hp: 1, mp: 1, coins: 0,
    inventory: {}, bagSlots: [], storage: {}, storageSlots: [], gearItems: {}, equipment: {}, area: 'meadow_town', x: 200,
    skillRanks: {}, skillBar: [null, null, null, null, 'meadow_dew', 'clear_dew'],
    questFlags: {}, questLog: {},
    passiveRanks: {}, passiveFrac: {},
    cheats: { atk: 0, def: 0, maxHp: 0, dropMul: 1, god: false },
    cheated: false,
  };
  const sword = makeGear(ASSUME.starterWeapon, { mode: 'mid', magic: false });
  p.gearItems[sword.uid] = sword;
  p.equipment.weapon = sword.uid;
  p.hp = maxHp(p);
  p.mp = maxMp(p);
  return p;
}

const cls = (p: PlayerData) => p.classId;

export function inst(p: PlayerData, uid?: string | null): GearInstance | undefined {
  return uid ? p.gearItems[uid] : undefined;
}
export function equippedGear(p: PlayerData): GearInstance[] {
  return EQUIP_SLOTS.map((s) => inst(p, p.equipment[s])).filter((g): g is GearInstance => !!g);
}
export function affixBonus(p: PlayerData, stat: AffixStat): number {
  let n = 0;
  for (const g of equippedGear(p)) for (const a of g.affixes) if (a.stat === stat) n += a.value;
  return n;
}
export function statOf(p: PlayerData, s: Stat): number { return p.stats[s] + affixBonus(p, s); }

export function maxHp(p: PlayerData): number {
  return f(`hp_base_${cls(p)}`) + f(`hp_per_level_${cls(p)}`) * (p.level - 1) + statOf(p, 'STR') * f('hp_per_str') + affixBonus(p, 'hp') + (p.cheats?.maxHp ?? 0);
}
export function maxMp(p: PlayerData): number {
  return f(`mp_base_${cls(p)}`) + f(`mp_per_level_${cls(p)}`) * (p.level - 1) + statOf(p, 'INT') * f('mp_per_int') + affixBonus(p, 'mp');
}
export function mpRegenPerSec(p: PlayerData): number {
  return f('mp_regen_base') + statOf(p, 'SPI') * f('mp_regen_per_spi') + affixBonus(p, 'mpRegen');
}
/** Out-of-combat HP regen per second (assumptions.REGEN + magic affixes). */
export function hpRegenPerSec(p: PlayerData): number {
  return maxHp(p) * (REGEN.pctMaxHpPerSec / 100) * (1 + statOf(p, 'SPI') * REGEN.spiBonusPerPoint) + affixBonus(p, 'hpRegen');
}
export function mainStat(p: PlayerData): number {
  return p.classId === 'warrior' ? statOf(p, 'STR') : p.classId === 'mage' ? statOf(p, 'INT') : statOf(p, 'AGI');
}
/** combat_formulas.attack_formula (v0.2.3): floor(weapon × multiplier) + floor(main_stat / 2).
 *  Every 2 points of the class main stat add +1 attack. Hidden from the player UI. */
export function attack(p: PlayerData): number {
  const w = inst(p, p.equipment.weapon);
  const dmg = w ? w.weaponDamage : ASSUME.unarmedDamage;
  const mult = w ? w.statMultiplier : ASSUME.unarmedMultiplier;
  return Math.floor(dmg * mult) + Math.floor(mainStat(p) / 2) + (p.cheats?.atk ?? 0);
}
export function defense(p: PlayerData): number {
  let d = p.cheats?.def ?? 0;
  for (const g of equippedGear(p)) d += g.defense;
  return d;
}
/** crit = 5% + AGI × 0.4% (as a percent number) + magic affixes. */
export function critChance(p: PlayerData): number {
  return f('crit_base_chance') + statOf(p, 'AGI') * f('crit_per_agi') + affixBonus(p, 'crit');
}
/** attack_interval = 1.0 / (1 + AGI × 0.005) seconds */
export function attackIntervalMs(p: PlayerData): number {
  return 1000 / (1 + statOf(p, 'AGI') * 0.005);
}

export function addItem(p: PlayerData, id: string, qty: number, opts?: { magic?: boolean }): void {
  if (id === 'copper_coin') { p.coins += qty; return; }
  if (isGear(id)) {
    for (let i = 0; i < Math.max(1, qty); i++) addGear(p, makeGear(id, { mode: 'random', magic: opts?.magic === true ? true : opts?.magic === false ? false : undefined }));
    return;
  }
  p.inventory[id] = (p.inventory[id] ?? 0) + qty;
}
export function addGear(p: PlayerData, g: GearInstance, container: 'bag' | 'storage' = 'bag'): void {
  p.gearItems ??= {};
  g.container = container;
  p.gearItems[g.uid] = g;
}
export function removeItem(p: PlayerData, id: string, qty = 1): boolean {
  if (isGear(id)) {
    // remove `qty` bag (then storage) instances of this item — used only as a fallback
    const list = Object.values(p.gearItems).filter((g) => g.itemId === id && !Object.values(p.equipment).includes(g.uid));
    if (list.length < qty) return false;
    for (const g of list.slice(0, qty)) removeGear(p, g.uid);
    return true;
  }
  const have = p.inventory[id] ?? 0;
  if (have < qty) return false;
  if (have === qty) delete p.inventory[id];
  else p.inventory[id] = have - qty;
  return true;
}
export function removeGear(p: PlayerData, uid: string): GearInstance | null {
  const g = p.gearItems[uid];
  if (!g) return null;
  for (const s of EQUIP_SLOTS) if (p.equipment[s] === uid) delete p.equipment[s];
  for (const slots of [p.bagSlots, p.storageSlots]) {
    const i = slots.indexOf(uid);
    if (i >= 0) slots[i] = null;
  }
  delete p.gearItems[uid];
  return g;
}
export function gearCount(p: PlayerData, itemId: string): number {
  return Object.values(p.gearItems).filter((g) => g.itemId === itemId).length;
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
/** Equip a gear instance (uid) from the bag or storage. */
export function equip(p: PlayerData, uid: string): string | null {
  const piece = inst(p, uid);
  if (!piece) {
    // leftover API: an item id — equip the first bag instance
    const found = Object.values(p.gearItems).find((g) => g.itemId === uid && g.container === 'bag' && !Object.values(p.equipment).includes(g.uid));
    if (found) return equip(p, found.uid);
    return 'Not in inventory';
  }
  const chk = canEquip(p, piece.itemId);
  if (!chk.ok) return chk.reason ?? 'Cannot equip';
  const slot = DB.gear[piece.itemId].slot as EquipSlot;
  const prev = p.equipment[slot];
  if (prev && prev !== uid) {
    const prevG = inst(p, prev);
    if (prevG) prevG.container = 'bag';
  }
  // pull out of storage into being worn
  for (const slots of [p.bagSlots, p.storageSlots]) {
    const i = slots.indexOf(uid);
    if (i >= 0) slots[i] = null;
  }
  p.equipment[slot] = uid;
  clampVitals(p);
  return null;
}
export function unequip(p: PlayerData, slot: EquipSlot): void {
  const uid = p.equipment[slot];
  if (!uid) return;
  delete p.equipment[slot];
  const g = inst(p, uid);
  if (g) g.container = 'bag';
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

/** Accuracy = 10 + AGI × 1 + level × 0.5 + magic affixes. */
export function accuracy(p: PlayerData): number {
  return PLAYER_ACC.base + statOf(p, 'AGI') * PLAYER_ACC.perAgi + p.level * PLAYER_ACC.perLevel + affixBonus(p, 'acc');
}
/** Evasion = 8 + AGI × 0.8 + level × 0.5. */
export function evasion(p: PlayerData): number {
  return PLAYER_EVA.base + statOf(p, 'AGI') * PLAYER_EVA.perAgi + p.level * PLAYER_EVA.perLevel;
}

// ───────────── bag / storage slots (v0.1.2) ─────────────
export const BAG_SIZE = 24;
export const STORAGE_SIZE = 30;
export type Container = 'bag' | 'storage';

const counts = (p: PlayerData, c: Container) => (c === 'bag' ? p.inventory : p.storage);
const slotsOf = (p: PlayerData, c: Container) => (c === 'bag' ? p.bagSlots : p.storageSlots);

/** Make the slot layout match stackable counts and unequipped gear instances. */
export function layout(p: PlayerData, c: Container): (string | null)[] {
  const cnt = counts(p, c);
  const size = c === 'bag' ? BAG_SIZE : STORAGE_SIZE;
  const slots = slotsOf(p, c);
  const worn = new Set(Object.values(p.equipment).filter(Boolean) as string[]);
  const seenStack = new Set<string>();
  const seenGear = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    const ref = slots[i];
    if (!ref) continue;
    const g = p.gearItems[ref];
    if (g) {
      if (worn.has(ref) || g.container !== c || seenGear.has(ref)) slots[i] = null;
      else seenGear.add(ref);
    } else if ((cnt[ref] ?? 0) > 0 && !seenStack.has(ref)) {
      seenStack.add(ref);
    } else slots[i] = null;
  }
  const extraStacks = Object.keys(cnt).filter((id) => cnt[id] > 0 && !seenStack.has(id));
  const extraGear = Object.values(p.gearItems)
    .filter((g) => g.container === c && !worn.has(g.uid) && !seenGear.has(g.uid))
    .map((g) => g.uid);
  const extra = [...extraStacks, ...extraGear];
  const need = Math.max(size, slots.filter(Boolean).length + extra.length);
  while (slots.length < need) slots.push(null);
  for (const id of extra) {
    const i = slots.indexOf(null);
    if (i < 0) slots.push(id); else slots[i] = id;
  }
  return slots;
}

/** Move/swap within a container, or move a stack / gear instance between bag and storage. */
export function moveSlot(p: PlayerData, from: Container, fromIdx: number, to: Container, toIdx: number, qty?: number): boolean {
  const a = layout(p, from), b = layout(p, to);
  const ref = a[fromIdx];
  if (!ref) return false;
  const piece = p.gearItems[ref];
  if (piece) {
    if (from === to) {
      const other = a[toIdx];
      const og = other ? p.gearItems[other] : undefined;
      [a[fromIdx], a[toIdx]] = [other ?? null, ref];
      // containers stay the same
      void og;
      return true;
    }
    // moving a unique piece across: swap with target or land on empty
    let dest = toIdx;
    if (dest < 0 || (b[dest] && p.gearItems[b[dest]!])) {
      // swap with another gear, or find empty if dest is a stack we shouldn't overwrite blindly
    }
    if (dest < 0 || dest >= b.length) dest = b.indexOf(null);
    if (from === to) return true;
    const target = dest >= 0 ? b[dest] : null;
    const tg = target ? p.gearItems[target] : undefined;
    if (tg) {
      // swap two gear pieces
      a[fromIdx] = target;
      b[dest] = ref;
      tg.container = from;
      piece.container = to;
      return true;
    }
    if (target && !tg) {
      // dest is a stack: only legal if we can place the gear in an empty slot and leave the stack
      dest = b.indexOf(null);
      if (dest < 0) return false;
    }
    if (dest < 0) return false;
    a[fromIdx] = null;
    b[dest] = ref;
    piece.container = to;
    return true;
  }
  // stackable
  if (from === to) {
    [a[fromIdx], a[toIdx]] = [a[toIdx] ?? null, ref];
    return true;
  }
  const src = counts(p, from), dst = counts(p, to);
  const n = Math.min(qty ?? src[ref] ?? 0, src[ref] ?? 0);
  if (n <= 0) return false;
  const existing = b.indexOf(ref);
  if (existing < 0) {
    if (toIdx < 0 || b[toIdx]) toIdx = b.indexOf(null);
    if (toIdx < 0) return false;
    b[toIdx] = ref;
  }
  dst[ref] = (dst[ref] ?? 0) + n;
  src[ref] -= n;
  if (src[ref] <= 0) { delete src[ref]; a[fromIdx] = null; }
  return true;
}

/** Convert a pre-instance save (equipment and inventory held gear as item ids) to instances. */
export function migrateGear(p: PlayerData): void {
  p.gearItems ??= {};
  p.bagSlots ??= [];
  p.storageSlots ??= [];
  p.storage ??= {};
  const worn = p.equipment ?? {};
  for (const s of EQUIP_SLOTS) {
    const val = worn[s];
    if (!val) continue;
    if (p.gearItems[val]) continue;
    if (isGear(val)) {
      const g = makeGear(val, { mode: 'mid', magic: false });
      p.gearItems[g.uid] = g;
      if ((p.inventory[val] ?? 0) > 0) removeItem(p, val, 1);
      p.equipment[s] = g.uid;
    } else delete p.equipment[s];
  }
  for (const id of Object.keys(p.inventory)) {
    if (!isGear(id)) continue;
    const qty = p.inventory[id];
    delete p.inventory[id];
    for (let i = 0; i < qty; i++) addGear(p, makeGear(id, { mode: 'mid', magic: false }), 'bag');
  }
  for (const id of Object.keys(p.storage)) {
    if (!isGear(id)) continue;
    const qty = p.storage[id];
    delete p.storage[id];
    for (let i = 0; i < qty; i++) addGear(p, makeGear(id, { mode: 'mid', magic: false }), 'storage');
  }
  for (const slots of [p.bagSlots, p.storageSlots]) {
    for (let i = 0; i < slots.length; i++) {
      const ref = slots[i];
      if (ref && !p.gearItems[ref] && !p.inventory[ref] && !p.storage[ref]) slots[i] = null;
    }
  }
}
