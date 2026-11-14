/**
 * Quest flows, simulated in Node: the same functions the game calls, without a browser.
 * A new quest or step should get one short case here.
 */
import { describe, it, expect } from 'vitest';
import * as Q from '../src/systems/Quests';
import * as P from '../src/systems/Player';
import { freshHero, talk, step, MATERIALS, bagOf } from './helpers';

/** Play Welcome to Meadow Town to the end the way a player would. */
function playIntro(p: P.PlayerData) {
  talk(p, 'pell');
  talk(p, 'mara');
  Q.onAction(p, 'buy', 'strawberry');
  talk(p, 'mara');
  Q.onAction(p, 'eat_berry', 6);
  talk(p, 'chest');
  Q.onAction(p, 'chest_put');
  Q.onAction(p, 'chest_take');
  talk(p, 'ila');
  talk(p, 'tamsin');
  Q.onAction(p, 'spend_point');
  talk(p, 'calden');
}

function playWarrior(p: P.PlayerData) {
  talk(p, 'calden');
  for (let i = 0; i < 3; i++) Q.onDummyHit(p);
  talk(p, 'calden');
  for (let i = 0; i < 5; i++) Q.onKill(p, 'field_mouse');
  P.addItem(p, 'twig', 5);
  talk(p, 'calden');
}

describe('a fresh Hero', () => {
  it('sees only Welcome to Meadow Town, with Pell marked', () => {
    const { p } = freshHero();
    expect(Object.keys(p.questLog!)).toEqual(['ql_intro']);
    expect(Q.markerFor(p, 'pell')).toBe('!');
    expect(Q.journal(p).map((e) => e.line)).toEqual(['ql_intro']);
  });

  it('walks the intro chain: tiny gifts, no materials, ends with 10 XP and the completion', () => {
    const { p, rewards } = freshHero();
    const before = bagOf(p);
    playIntro(p);
    expect(step(p, 'ql_intro').done).toBe(true);
    for (const m of MATERIALS) expect(p.inventory[m] ?? 0, m).toBe(before[m] ?? 0);
    const gifts = rewards.filter((r) => !r.final).map((r) => r.rows.join());
    expect(gifts).toEqual(['5 Copper', '2× Blueberry', '1× Meadow Dew', '1× Clear Dew', '2× Strawberry']);
    const done = rewards.find((r) => r.final)!;
    expect(done.name).toBe('Welcome to Meadow Town');
    expect(done.rows).toEqual(['10 XP']);
    expect(Q.isActive(p, 'ql_warrior')).toBe(true);
  });

  it('cannot skip ahead: an action out of turn does nothing', () => {
    const { p } = freshHero();
    Q.onAction(p, 'buy', 'strawberry');
    Q.onAction(p, 'spend_point');
    expect(step(p, 'ql_intro').step).toBe(1);
  });
});

describe('Path of the Warrior and Path of the Magician', () => {
  it('Warrior: post, mice, Twig; reveals the tree and opens Power Strike training (not granted)', () => {
    const { p, rewards } = freshHero();
    playIntro(p);
    expect(Q.pathRevealed(p, 'warrior')).toBe(false);
    talk(p, 'calden');
    expect(step(p, 'ql_warrior').step).toBe(2);
    for (let i = 0; i < 3; i++) Q.onDummyHit(p);
    talk(p, 'calden');
    for (let i = 0; i < 5; i++) Q.onKill(p, 'field_mouse');
    expect(step(p, 'ql_warrior').step).toBe(5);
    expect(Q.markerFor(p, 'calden')).toBe(null); // no Twig yet
    P.addItem(p, 'twig', 5);
    expect(Q.markerFor(p, 'calden')).toBe('?');
    talk(p, 'calden');
    expect(step(p, 'ql_warrior').done).toBe(true);
    expect(p.inventory.twig ?? 0).toBe(0);
    expect(p.skillRanks.power_strike ?? 0).toBe(0);
    expect(Q.pathRevealed(p, 'warrior')).toBe(true);
    expect(rewards.at(-1)!.rows).toEqual(['25 XP', '5 Copper', 'Warrior Path revealed', 'Power Strike training is now open']);
  });

  it('Magician: appears once Power Strike is trained; wool and feathers; reveals the Magician tree', () => {
    const { p, rewards } = freshHero();
    playIntro(p);
    playWarrior(p);
    Q.tick(p);
    expect(Q.isActive(p, 'ql_magician')).toBe(false);
    p.skillRanks.power_strike = 1;
    Q.tick(p);
    expect(Q.markerFor(p, 'tamsin')).toBe('!');
    talk(p, 'tamsin');
    P.addItem(p, 'wool', 6); P.addItem(p, 'feather', 4);
    Q.tick(p);
    expect(Q.markerFor(p, 'tamsin')).toBe('?');
    talk(p, 'tamsin');
    expect(Q.pathRevealed(p, 'magician')).toBe(true);
    expect(rewards.at(-1)!.rows).toEqual(['20 XP', '5 Copper', '1× Clear Dew', 'Magician Path revealed', 'Magic Bolt training is now open']);
  });
});

describe('quests appear gradually (v0.2.9)', () => {
  const at = (p: P.PlayerData, level: number) => { p.level = level; Q.offerAll(p, true); return Object.entries(p.questLog!).filter(([, s]) => !s.done).map(([l]) => l).sort(); };
  it('by level and by the quests before them', () => {
    const { p } = freshHero();
    playIntro(p);
    playWarrior(p);
    expect(at(p, 2)).toEqual([]);
    expect(at(p, 3)).toEqual(['ql_dirt_path', 'ql_warm_coat']);
    expect(at(p, 4)).toEqual(['ql_blood', 'ql_dirt_path', 'ql_warm_coat']);
    Q.markDone(p, 'ql_dirt_path');
    expect(at(p, 4)).toContain('ql_quiet_work');
    expect(at(p, 4)).not.toContain('ql_dirt_keeps');
    expect(at(p, 5)).toContain('ql_dirt_keeps');
    expect(Q.markerFor(p, 'calden')).toBe('!'); // The Cracked Stone, by talk
    expect(Q.journal(p).find((e) => e.line === 'ql_crack')?.status).toBe('available');
    expect(Q.journal(p).some((e) => e.line === 'ql_hot')).toBe(false);
  });
});

describe('talk-started quests', () => {
  it('The Cracked Stone: Calden starts it; the stone (and 5 STR) turns it in', () => {
    const { p } = freshHero();
    p.questLog = { ql_intro: { step: 11, done: true }, ql_warrior: { step: 5, done: true }, ql_dirt_path: { step: 4, done: true } };
    p.level = 5;
    talk(p, 'calden');
    expect(step(p, 'ql_crack').step).toBe(1);
    expect(Q.markerFor(p, 'calden')).toBe(null);
    P.addItem(p, 'cracked_bank_stone', 1);
    p.stats.STR = 4;
    expect(Q.markerFor(p, 'calden')).toBe(null); // gate on the turn-in
    p.stats.STR = 5;
    expect(Q.markerFor(p, 'calden')).toBe('?');
    talk(p, 'calden');
    expect(step(p, 'ql_crack').step).toBe(2);
    expect(p.inventory.cracked_bank_stone ?? 0).toBe(0);
  });
});

describe('Roots That Grow: Ila gives no kit', () => {
  it('the player gathers and plants the first root', () => {
    const { p } = freshHero();
    p.questLog = { ql_intro: { step: 11, done: true }, ql_warrior: { step: 5, done: true }, ql_dirt_path: { step: 4, done: true } };
    p.level = 4;
    Q.offerAll(p, true);
    const before = bagOf(p);
    talk(p, 'ila');
    expect(bagOf(p)).toEqual(before);
    expect(Q.progressOf(p, 'ql_quiet_work', 2)).toMatch(/Nature Essence 0\/20/);
    p.passiveUpgrade = { nodeId: 'nature_prod', targetRank: 1, startedAt: 0, doneAt: 1 };
    Q.onPassive(p);
    expect(Q.markerFor(p, 'ila')).toBe('?');
  });
});

describe('old saves', () => {
  it('finished old quests become the new Path quests; skills stay', () => {
    const { p } = freshHero();
    p.questLog = { ql_weight: { step: 3, done: true }, ql_paths: { step: 4, done: true }, ql_magic: { step: 4, done: true } } as P.PlayerData['questLog'];
    p.skillRanks = { power_strike: 2, magic_bolt: 1 };
    p.level = 6;
    Q.migrateQuests(p);
    for (const l of ['ql_intro', 'ql_warrior', 'ql_magician']) expect(step(p, l).done, l).toBe(true);
    expect(Object.keys(p.questLog!)).not.toContain('ql_weight');
    expect(p.skillRanks.power_strike).toBe(2);
  });
});
