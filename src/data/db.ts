/**
 * Data access layer. All gameplay numbers come from the JSON files exported
 * from the Game Design DB sheet (see scripts/export-sheet.mjs → /data).
 * Nothing here hard-codes stats; it only indexes and parses the exported rows.
 */
type Row = Record<string, unknown>;
interface TabFile { tab: string; note: string | null; columns: string[]; rows: Row[] }

const files = import.meta.glob('../../data/*.json', { eager: true, import: 'default' }) as Record<string, TabFile>;
const tabs: Record<string, TabFile> = {};
for (const [p, f] of Object.entries(files)) tabs[p.split('/').pop()!.replace('.json', '')] = f;

export function tab<T = Row>(name: string): T[] {
  const t = tabs[name];
  if (!t) throw new Error(`Missing data/${name}.json — run npm run export-sheet`);
  return t.rows as T[];
}

export interface ItemDef {
  id: string; name: string; item_type: 'material' | 'gear' | 'currency' | 'misc' | 'consumable';
  subtype_id: string | null; sellable_only: boolean; sell_price: number | null; description: string; desc?: string; notes?: string;
}
export interface MonsterDef {
  id: string; name: string; category_id: string; level: number; is_boss: boolean; description: string;
  hp: number; attack: number; defense: number; xp: number; respawn_s: number; aggression: 'passive' | 'aggressive'; zone_id?: string;
  attack_type?: 'melee' | 'ranged' | null;
  attack_min?: number | null; attack_max?: number | null;
  /** Walk/idle/flap multiplier (1 = v0.1.2 rate; Crow is 1, other mobs 0.5). */
  anim_speed?: number | null;
}
export interface DropRow { monster_id: string; item_id: string; drop_rate: number; min_qty: number; max_qty: number; unlock_requirement_id: string | null }
export interface ShopRow { id: string; item_id: string; role: 'sell' | 'buy'; price: number | null; currency: string; stock: string; notes: string }
export interface GearDef { item_id: string; slot: string; class_id: string; required_stat: string | null; required_value: number; stat_multiplier: number; defense: number; weapon_damage: number; defense_min?: number; defense_max?: number; weapon_damage_min?: number; weapon_damage_max?: number; description?: string; desc?: string }
export interface SkillDef { id: string; class_id: string; name: string; branch: string; type: 'active' | 'buff'; unlock_stage: string; max_rank: number; per_rank_scaling: string | null; scaling_stat: string | null; damage_multiplier: number | null; duration_s: number | null; mp_cost: number; effect: string; description: string; desc?: string; notes?: string; path_id?: string | null; prev_skill_id?: string | null }
export interface AreaDef { id: string; name: string; level_range: string; monster_ids: string; spawns: Record<string, number>; links: Record<string, string>; notes: string }
export interface KV { key: string; value: unknown; notes: string; num: number | null }

/** A consumable's effect, parsed from notes (and leftover description text). Never shown as flavor. */
export interface ConsumableEffect { hp?: number; mp?: number; buff?: { speedPct: number; durationS: number } }

const byId = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r])) as Record<string, T>;

export const DB = {
  items: byId(tab<ItemDef>('items')),
  monsters: byId(tab<MonsterDef>('monsters')),
  drops: tab<DropRow>('drop_tables'),
  shop: tab<ShopRow>('npc_shop'),
  gear: Object.fromEntries(tab<GearDef>('gear').map((g) => [g.item_id, g])) as Record<string, GearDef>,
  skills: byId(tab<SkillDef>('skills')),
  npcs: byId(tab<NpcDef>('npcs')),
  areas: byId(tab<AreaDef>('map_layout')),
  formulas: Object.fromEntries(tab<KV>('combat_formulas').map((k) => [k.key, k])) as Record<string, KV>,
  rules: Object.fromEntries(tab<KV>('game_rules').map((k) => [k.key, k])) as Record<string, KV>,
};

/** Numeric value of a combat_formulas row. Percent values ("5%") come back as the percent number (5). */
export function f(key: string): number {
  const v = DB.formulas[key]?.num;
  if (v === null || v === undefined) throw new Error(`combat_formulas.${key} has no number`);
  return v;
}

/** v0.2.6: named foes without their own table roll their base mob's table. */
const DROP_BASE: Record<string, string> = { wool_shoulder: 'wool_sheep', bank_cracker: 'burrow_mole', cinderback: 'ember_beetle' };

export function dropsFor(monsterId: string): DropRow[] {
  const id = DROP_BASE[monsterId] ?? monsterId;
  return DB.drops.filter((d) => d.monster_id === id);
}

export function consumableEffect(itemId: string): ConsumableEffect {
  const it = DB.items[itemId];
  const text = [it?.notes, it?.description, it?.desc].filter(Boolean).join(' ');
  const eff: ConsumableEffect = {};
  const hp = text.match(/Restores (\d+) HP/i);
  const mp = text.match(/Restores (\d+) MP/i);
  if (hp) eff.hp = Number(hp[1]);
  if (mp) eff.mp = Number(mp[1]);
  const buff = text.match(/\+(\d+)% move and attack speed for (\d+)/i);
  if (buff) eff.buff = { speedPct: Number(buff[1]), durationS: Number(buff[2]) };
  return eff;
}

/** Rage's numbers are parsed from skills.effect: "+15% damage dealt, +10% damage taken". */
export function buffNumbers(skillId: string): { dealtPct: number; takenPct: number } {
  const e = DB.skills[skillId]?.effect ?? '';
  return {
    dealtPct: Number(e.match(/\+(\d+)% damage dealt/i)?.[1] ?? 0),
    takenPct: Number(e.match(/\+(\d+)% damage taken/i)?.[1] ?? 0),
  };
}

/** Shop price of an item if Mara sells it. */
export function shopPrice(itemId: string): number | null {
  const r = DB.shop.find((s) => s.role === 'sell' && s.item_id === itemId);
  return r?.price ?? null;
}

/**
 * Vendor buy-back price per npc_shop rules:
 * misc sellable_only → 100% sell_price; consumables → 50% of shop price (or 50% sell_price);
 * gear → 50% of shop price if listed, else 50% sell_price; materials/currency → not bought.
 */
export function vendorBuyPrice(itemId: string): number | null {
  const it = DB.items[itemId];
  if (!it) return null;
  if (it.item_type === 'misc' && it.sellable_only) return it.sell_price ?? 0;
  if (it.item_type === 'consumable' || it.item_type === 'gear') {
    const base = shopPrice(itemId) ?? it.sell_price ?? 0;
    return Math.max(1, Math.floor(base * 0.5));
  }
  return null;
}

export function xpToNext(level: number): number {
  const row = DB.formulas[`xp_to_next_${level}`];
  if (row?.num) return row.num;
  // combat_formulas.xp_formula (v0.2.6): levels 1-3 as before; from level 4 twice as many kills.
  return level <= 3 ? Math.round(40 * Math.pow(level, 1.5) + 30 * level) : Math.round(80 * Math.pow(level, 1.5) + 60 * level);
}

export interface QuestRow { id: string; name: string; giver: string; reward_xp: number | null; reward_coins: number | null; reward_items: string | null; objective: string; desc?: string; notes?: string }
export interface NpcDef { id: string; name: string; role: string; desc: string; notes?: string }
/** Player-facing line. Never returns design notes. */
export function descOf(row: { desc?: string | null; description?: string | null } | undefined): string {
  return (row?.desc || row?.description || '').trim();
}

/** starter_quests row with parsed reward_items ("meadow_dew x3; training_scroll x4"). */
export function quest(id: string) {
  const q = tab<QuestRow>('starter_quests').find((r) => r.id === id);
  if (!q) return null;
  const items: { id: string; qty: number }[] = [];
  for (const part of String(q.reward_items ?? '').split(/[;,]/)) {
    const m = part.trim().match(/^([a-z_]+)\s*x(\d+)$/);
    if (m && DB.items[m[1]]) items.push({ id: m[1], qty: Number(m[2]) });
  }
  return { ...q, items };
}
