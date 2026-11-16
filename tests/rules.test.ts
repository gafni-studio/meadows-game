/** Game rules that are easy to break silently: stats, slots, loot, recipes, passives. */
import { describe, it, expect } from 'vitest';
import { xpToNext, DB } from '../src/data/db';
import { AREAS, AREA_ALIAS } from '../src/world/areas';
import { splitCount, surfaceSpan, zoneBounds, spawnHeight } from '../src/world/surface';
import * as P from '../src/systems/Player';
import * as Sk from '../src/systems/Skills';
import * as Bar from '../src/systems/Bar';
import { rollDrops, MAX_STACK_PER_KILL } from '../src/systems/Loot';
import * as Pa from '../src/systems/Passives';
import { affinityOf } from '../src/systems/Combat';
import { freshHero } from './helpers';
import { writeSave, loadSave } from '../src/systems/Save';

describe('Hero stats', () => {
  it('HP is 100 + 7 per level + 2 per STR', () => {
    const { p } = freshHero();
    expect(P.maxHp(p)).toBe(100);
    p.level = 5; expect(P.maxHp(p)).toBe(128);
    p.level = 10; expect(P.maxHp(p)).toBe(163);
    p.level = 1; p.stats.STR = 3; expect(P.maxHp(p)).toBe(106);
  });
  it('XP: levels 1-3 unchanged, twice the kills from level 4', () => {
    expect([1, 2, 3, 4, 5, 10].map(xpToNext)).toEqual([70, 173, 298, 880, 1194, 3130]);
  });
  it('magic attack scales with INT, attack with STR, and never the other way (v0.2.9)', () => {
    const { p } = freshHero();
    const a0 = P.attack(p), m0 = P.magicAttack(p);
    p.stats.INT = 4;
    expect([P.attack(p), P.magicAttack(p)]).toEqual([a0, m0 + 2]);
    p.stats.INT = 0; p.stats.STR = 4;
    expect([P.attack(p), P.magicAttack(p)]).toEqual([a0 + 2, m0]);
  });
  it('a fresh Hero starts with the Club, 10 × 1.10', () => {
    const { p } = freshHero();
    const w = p.gearItems[p.equipment.weapon!];
    expect([w.itemId, w.weaponDamage, w.statMultiplier]).toEqual(['club', 10, 1.1]);
  });
});

describe('equip slots (v0.2.7 / v0.2.9)', () => {
  it('attacks 1-4, buffs 5-6, potions Q/G; the wrong slot is refused with a hint', () => {
    const { p } = freshHero();
    expect(Bar.assignBar(p, 0, 'rage')).toMatch(/Buffs go in the buff slots/);
    expect(Bar.assignBar(p, 4, 'power_strike')).toMatch(/Attacks go in the attack slots/);
    expect(Bar.assignBar(p, 0, 'meadow_dew')).toMatch(/Potions go in the Q and G slots/);
    expect(Bar.assignBar(p, 4, 'rage')).toBeNull();
    expect(Bar.assignBar(p, 5, 'mana_shield')).toBeNull();
    expect(Bar.assignBar(p, 1, 'magic_bolt')).toBeNull();
  });
  it('a saved bar with skills in the wrong slots is sorted on load', () => {
    const { p } = freshHero();
    p.skillBar = ['rage', 'mana_shield', 'meadow_dew', 'power_strike', 'power_strike', 'magic_bolt', 'clear_dew', 'dig_in'];
    Bar.migrateBar(p);
    p.skillBar.forEach((id, i) => { if (id) expect(Bar.idGroup(id), `${id} in slot ${i}`).toBe(Bar.slotGroup(i)); });
  });
  it('an old six-slot bar becomes the grouped eight-slot bar', () => {
    const { p } = freshHero();
    p.skillBar = ['power_strike', 'rage', null, null, 'meadow_dew', 'clear_dew'];
    Bar.migrateBar(p);
    expect(p.skillBar).toEqual(['power_strike', null, null, null, 'rage', null, 'meadow_dew', 'clear_dew']);
  });
});

describe('Paths', () => {
  it('a skill needs the previous one; no level gate', () => {
    const { p } = freshHero();
    p.questLog = { ql_crack: { step: 4, done: true } };
    expect(Sk.unlockStatus(p, Sk.skill('root_lash')!).reason).toMatch(/Learn Earthbreaker first/);
    p.skillRanks.earthbreaker = 1;
    expect(Sk.unlockStatus(p, Sk.skill('root_lash')!).ok).toBe(true);
  });
  it('recipes are explicit per rank (no 1.6× scaling)', () => {
    expect(Sk.nextCost('power_strike', 2)).toEqual(expect.arrayContaining([{ itemId: 'monster_essence', qty: 24 }, { itemId: 'fur', qty: 14 }]));
    expect(Pa.nextCost('nature_prod', 1)).toEqual(expect.arrayContaining([{ itemId: 'nature_essence', qty: 20 }, { itemId: 'pebble', qty: 16 }]));
  });
  it('passive production is a whole-number table', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(Pa.rateAt)).toEqual([0, 1, 2, 3, 5, 8, 64]);
  });
});

describe('combat', () => {
  it('affinity: Elemental is Weak on beasts and Immune on elemental mobs; basic is neutral', () => {
    expect(affinityOf('field_mouse', 'elemental')).toBe('weak');
    expect(affinityOf('earth_sprite', 'elemental')).toBe('immune');
    expect(affinityOf('earth_sprite', 'nature')).toBe('weak');
    expect(affinityOf('earth_sprite', 'basic')).toBe('normal');
  });
});

describe('loot', () => {
  it(`no kill ever drops more than ${MAX_STACK_PER_KILL} of one item except Copper`, () => {
    let maxCopper = 0;
    for (const mob of ['field_mouse', 'wool_sheep', 'crow', 'boar', 'angry_bull', 'burrow_mole', 'earth_sprite', 'ember_beetle', 'spark_bug', 'old_stump']) {
      for (let i = 0; i < 400; i++) {
        for (const d of rollDrops(mob)) {
          if (d.itemId === 'copper_coin') maxCopper = Math.max(maxCopper, d.qty);
          else expect(d.qty, `${mob} ${d.itemId}`).toBeLessThanOrEqual(MAX_STACK_PER_KILL);
        }
      }
    }
    expect(maxCopper).toBeGreaterThan(3); // Copper is exempt
  });
  it('v0.3.1 ranges: level 1-3 mobs never drop a stack of 3 except Feather; their scrolls are at least 12%', () => {
    for (const r of DB.drops.filter((d) => ['field_mouse', 'wool_sheep', 'crow'].includes(d.monster_id) && d.item_id !== 'copper_coin' && d.item_id !== 'feather')) {
      expect(r.max_qty, `${r.monster_id} ${r.item_id}`).toBeLessThanOrEqual(2);
      if (r.item_id === 'training_scroll') expect(r.drop_rate).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('the split Meadows and Whisperwood (v0.3.0)', () => {
  const HALVES: Record<string, string[]> = {
    sunny_pasture: ['wool_sheep', 'crow', 'boar'],
    meadow_west: ['field_mouse', 'wool_sheep', 'crow'],
    meadow_east: ['crow', 'wool_sheep', 'boar', 'angry_bull'],
    dirt_banks_west: ['burrow_mole', 'earth_sprite'],
    dirt_banks_east: ['ember_beetle', 'spark_bug'],
    whisperwood: ['wisp', 'thornling', 'mire_toad', 'moss_lurker', 'hollow_stag'],
  };
  it('every half has its listed mobs and no others, each with a place to spawn', () => {
    for (const [id, mobs] of Object.entries(HALVES)) {
      expect(Object.keys(DB.areas[id].spawns).sort(), id).toEqual([...mobs].sort());
      for (const m of mobs) {
        expect(AREAS[id].spawnZones[m]?.length, `${id} ${m}`).toBeGreaterThan(0);
        expect(splitCount(AREAS[id].spawnZones[m], DB.areas[id].spawns[m]).reduce((a, b) => a + b, 0), `${id} ${m} count`).toBe(DB.areas[id].spawns[m]);
      }
    }
  });
  it('v0.3.1 order: Sunny Pasture, Meadow West, town, Meadow East (Whisperwood north), Banks West, Banks East', () => {
    expect(DB.areas.sunny_pasture.links).toEqual({ east: 'meadow_west' });
    expect(DB.areas.meadow_west.links).toMatchObject({ west: 'sunny_pasture', east: 'meadow_town' });
    expect(DB.areas.meadow_town.links).toMatchObject({ west: 'meadow_west', east: 'meadow_east' });
    expect(DB.areas.meadow_east.links).toMatchObject({ west: 'meadow_town', east: 'dirt_banks_west', north: 'whisperwood' });
    expect(DB.areas.dirt_banks_west.links).toMatchObject({ west: 'meadow_east', east: 'dirt_banks_east' });
    expect(DB.areas.whisperwood.links.south).toBe('meadow_east');
    for (const id of Object.keys(HALVES)) for (const pt of AREAS[id].portals) expect(DB.areas[id].links[pt.dir], `${id} ${pt.dir}`).toBeTruthy();
  });
  it('Meadow West and Sunny Pasture have no climbing; every other half has reachable upper levels', () => {
    expect(AREAS.meadow_west.climbs ?? []).toEqual([]);
    expect(AREAS.sunny_pasture.climbs ?? []).toEqual([]);
    for (const id of ['meadow_east', 'dirt_banks_west', 'dirt_banks_east', 'whisperwood']) {
      const g = AREAS[id];
      expect(g.climbs!.length, id).toBeGreaterThan(0);
      // every climb ends on something to stand on, at both ends
      for (const c of g.climbs!) {
        expect(surfaceSpan(g, c.x, c.y1) ?? g.platforms.find((p) => p.y === c.y1 && c.x >= p.x - 1 && c.x <= p.x + p.w + 1), `${id} climb at ${c.x} top`).toBeTruthy();
        expect(c.y0 === 0 || surfaceSpan(g, c.x, c.y0) || g.platforms.some((p) => p.y === c.y0 && c.x >= p.x && c.x <= p.x + p.w), `${id} climb at ${c.x} bottom`).toBeTruthy();
      }
    }
  });
  it('ledge spawns stand on a real ledge', () => {
    for (const [id, g] of Object.entries(AREAS)) for (const [m, zones] of Object.entries(g.spawnZones)) for (const z of zones) {
      if (z.y == null) continue;
      expect(surfaceSpan(g, (z.x[0] + z.x[1]) / 2, z.y), `${id} ${m} at ${z.x} y${z.y}`).toBeTruthy();
    }
  });
  it('ground spawns stand on the hill under them, not the base ground (v0.3.1 crow fix)', () => {
    const g = AREAS.meadow_east;
    const b = zoneBounds(g, { x: [57, 70] });
    expect(b.y).toBeUndefined();
    expect(spawnHeight(g, 60, b.y)).toBe(1.5);
    expect(spawnHeight(g, 60, 6)).toBe(6);
  });
  it('old saves in Dirt Banks land in the matching half', () => {
    expect(AREA_ALIAS).toEqual({ dirt_banks: 'dirt_banks_west' });
    for (const [old, now] of Object.entries(AREA_ALIAS)) {
      const p = P.newPlayer();
      p.area = old;
      writeSave(p);
      expect(loadSave().area).toBe(now);
    }
  });
  it('Whisperwood mobs: nature weak to Elemental, the Wisp to Nature, nothing immune', () => {
    for (const id of ['thornling', 'moss_lurker', 'mire_toad', 'hollow_stag']) expect(affinityOf(id, 'elemental')).toBe('weak');
    expect(affinityOf('wisp', 'nature')).toBe('weak');
    for (const id of ['wisp', 'thornling', 'moss_lurker', 'mire_toad', 'hollow_stag']) for (const s of ['basic', 'nature', 'elemental'] as const) expect(affinityOf(id, s)).not.toBe('immune');
  });
});
