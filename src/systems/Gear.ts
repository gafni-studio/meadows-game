/**
 * Gear instances (v0.1.2): each piece of gear is unique. Stats are rolled from
 * the sheet's min/max on drop or purchase, and a rare magic roll adds a prefix
 * plus 1-2 extra bonuses. Materials, currency, consumables and junk still stack.
 */
import { DB, GearDef } from '../data/db';
import { MAGIC } from '../data/assumptions';

export type AffixStat = 'STR' | 'INT' | 'AGI' | 'SPI' | 'acc' | 'crit' | 'hp' | 'mp' | 'hpRegen' | 'mpRegen';
export interface Affix { stat: AffixStat; value: number }
export interface GearInstance {
  uid: string;
  itemId: string;
  defense: number;
  weaponDamage: number;
  statMultiplier: number;
  magic: boolean;
  prefix?: string;
  affixes: Affix[];
  /** Where an unequipped instance lives. Equipped pieces are listed in `equipment`. */
  container: 'bag' | 'storage';
}

export const AFFIX_LABEL: Record<AffixStat, string> = {
  STR: 'STR', INT: 'INT', AGI: 'AGI', SPI: 'SPI',
  acc: 'Accuracy', crit: 'Crit chance', hp: 'Max HP', mp: 'Max MP',
  hpRegen: 'HP regen', mpRegen: 'MP regen',
};

const PREFIX: Record<AffixStat, string> = {
  STR: 'Sturdy', INT: 'Bright', AGI: 'Swift', SPI: 'Calm',
  acc: 'Keen', crit: 'Sharp', hp: 'Hearty', mp: 'Deep',
  hpRegen: 'Lively', mpRegen: 'Focused',
};

export function isGear(itemId: string): boolean { return !!DB.gear[itemId]; }

export function defOf(itemId: string): GearDef | undefined { return DB.gear[itemId]; }

export function rangeOf(g: GearDef, kind: 'defense' | 'weapon'): { min: number; max: number } {
  if (kind === 'defense') return { min: g.defense_min ?? g.defense ?? 0, max: g.defense_max ?? g.defense ?? 0 };
  return { min: g.weapon_damage_min ?? g.weapon_damage ?? 0, max: g.weapon_damage_max ?? g.weapon_damage ?? 0 };
}

function uniform(lo: number, hi: number): number {
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function mid(lo: number, hi: number): number { return Math.round((lo + hi) / 2); }

function uid(): string { return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

export type RollMode = 'random' | 'mid' | 'min' | 'max';

/** Apply a magic prefix and 1-2 affixes (used by rollInstance). */
export function enchant(inst: GearInstance): void {
  const pool = Object.keys(MAGIC.affixes) as AffixStat[];
  const n = Math.random() < MAGIC.secondAffixChance ? 2 : 1;
  const picked: AffixStat[] = [];
  const bag = [...pool];
  for (let i = 0; i < n && bag.length; i++) {
    const j = Math.floor(Math.random() * bag.length);
    picked.push(bag.splice(j, 1)[0]);
  }
  inst.affixes = picked.map((stat) => {
    const [lo, hi] = MAGIC.affixes[stat];
    const step = Number.isInteger(lo) && Number.isInteger(hi) ? 1 : 0.05;
    const raw = lo + Math.random() * (hi - lo);
    const value = step === 1 ? Math.round(raw) : Math.round(raw / step) * step;
    return { stat, value: Math.max(lo, Math.min(hi, value)) };
  });
  inst.magic = true;
  inst.prefix = PREFIX[picked[0]];
}

export function makeGear(itemId: string, opts: { mode?: RollMode; magic?: boolean | 'roll'; container?: 'bag' | 'storage' } = {}): GearInstance {
  const g = DB.gear[itemId];
  if (!g) throw new Error(`Not gear: ${itemId}`);
  const d = rangeOf(g, 'defense'), w = rangeOf(g, 'weapon');
  const pick = (r: { min: number; max: number }) => {
    if (opts.mode === 'mid') return mid(r.min, r.max);
    if (opts.mode === 'min') return r.min;
    if (opts.mode === 'max') return r.max;
    return uniform(r.min, r.max);
  };
  const inst: GearInstance = {
    uid: uid(), itemId,
    defense: pick(d), weaponDamage: pick(w),
    statMultiplier: g.stat_multiplier ?? 1,
    magic: false, affixes: [],
    container: opts.container ?? 'bag',
  };
  const mode = opts.mode ?? 'random';
  const doMagic = opts.magic === true || (opts.magic !== false && mode === 'random' && Math.random() < MAGIC.chance);
  if (doMagic) enchant(inst);
  return inst;
}

export type Quality = 'low' | 'avg' | 'high';
export function qualityOf(rolled: number, min: number, max: number): Quality {
  if (max <= min) return 'avg';
  const t = (rolled - min) / (max - min);
  if (t < 1 / 3) return 'low';
  if (t > 2 / 3) return 'high';
  return 'avg';
}

/** Combined quality from defense and/or weapon damage ranges. */
export function instanceQuality(inst: GearInstance): Quality {
  const g = DB.gear[inst.itemId];
  if (!g) return 'avg';
  const parts: Quality[] = [];
  const d = rangeOf(g, 'defense'), w = rangeOf(g, 'weapon');
  if (d.max > 0) parts.push(qualityOf(inst.defense, d.min, d.max));
  if (w.max > 0) parts.push(qualityOf(inst.weaponDamage, w.min, w.max));
  if (!parts.length) return 'avg';
  const score = parts.reduce((a, q) => a + (q === 'low' ? 0 : q === 'high' ? 2 : 1), 0) / parts.length;
  return score < 0.7 ? 'low' : score > 1.3 ? 'high' : 'avg';
}

export function displayName(inst: GearInstance): string {
  const name = DB.items[inst.itemId]?.name ?? inst.itemId;
  return inst.magic && inst.prefix ? `${inst.prefix} ${name}` : name;
}

export function formatAffix(a: Affix): string {
  const n = Number.isInteger(a.value) ? String(a.value) : a.value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const unit = a.stat === 'crit' ? '%' : a.stat === 'hpRegen' || a.stat === 'mpRegen' ? '/s' : '';
  return `+${n}${unit} ${AFFIX_LABEL[a.stat]}`;
}

/** `whodrops` text: monsters (and area) that drop this item, with chance and qty. Partial name matches. */
export function whoDrops(query: string): string {
  const q = query.trim().toLowerCase().replace(/\s+/g, '_');
  const qName = query.trim().toLowerCase();
  const items = Object.values(DB.items).filter((it) =>
    it.id === qName.replace(/\s+/g, '_') || it.id.includes(q) || it.name.toLowerCase().includes(qName),
  );
  if (!items.length) return `No item matches "${query}".`;
  const areaOf = (monsterId: string): string => {
    for (const a of Object.values(DB.areas)) {
      if ((a.monster_ids ?? '').includes(monsterId) || a.spawns?.[monsterId]) return a.name;
    }
    const z = DB.monsters[monsterId]?.zone_id;
    return z ? `${z} (zone)` : '?';
  };
  const blocks: string[] = [];
  for (const it of items.slice(0, 12)) {
    const rows = DB.drops.filter((d) => d.item_id === it.id && !d.unlock_requirement_id);
    if (!rows.length) { blocks.push(`${it.name} (${it.id}): not on any drop table.`); continue; }
    const lines = rows.map((d) => {
      const m = DB.monsters[d.monster_id];
      const qty = d.min_qty === d.max_qty ? `×${d.min_qty}` : `×${d.min_qty}–${d.max_qty}`;
      return `  ${m?.name ?? d.monster_id} (${areaOf(d.monster_id)})  ${d.drop_rate}%  ${qty}`;
    });
    const gear = isGear(it.id) ? '  [gear: rolled stats, no stack; ~1/12 magic]' : '';
    blocks.push(`${it.name} (${it.id})${gear}\n${lines.join('\n')}`);
  }
  if (items.length > 12) blocks.push(`…and ${items.length - 12} more matches. Narrow the name.`);
  return blocks.join('\n\n');
}
