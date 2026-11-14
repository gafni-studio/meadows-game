/** Game rules that are easy to break silently: stats, slots, loot, recipes, passives. */
import { describe, it, expect } from 'vitest';
import { xpToNext } from '../src/data/db';
import * as P from '../src/systems/Player';
import * as Sk from '../src/systems/Skills';
import * as Bar from '../src/systems/Bar';
import { rollDrops, MAX_STACK_PER_KILL } from '../src/systems/Loot';
import * as Pa from '../src/systems/Passives';
import { affinityOf } from '../src/systems/Combat';
import { freshHero } from './helpers';

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
    expect(Sk.nextCost('power_strike', 2)).toEqual(expect.arrayContaining([{ itemId: 'monster_essence', qty: 24 }, { itemId: 'clay', qty: 16 }]));
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
    for (const mob of ['field_mouse', 'wool_sheep', 'crow', 'burrow_mole', 'earth_sprite', 'ember_beetle', 'spark_bug', 'old_stump']) {
      for (let i = 0; i < 400; i++) {
        for (const d of rollDrops(mob)) {
          if (d.itemId === 'copper_coin') maxCopper = Math.max(maxCopper, d.qty);
          else expect(d.qty, `${mob} ${d.itemId}`).toBeLessThanOrEqual(MAX_STACK_PER_KILL);
        }
      }
    }
    expect(maxCopper).toBeGreaterThan(3); // Copper is exempt
  });
});
