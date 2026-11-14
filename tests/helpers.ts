import { expect } from 'vitest';
import { Game } from '../src/systems/GameState';
import * as P from '../src/systems/Player';
import * as Q from '../src/systems/Quests';

export interface Rewards { name: string; title?: string; flavor: string; rows: string[]; final?: boolean }

/** A brand-new Hero, wired as Game.player, with the rewards screens it would have seen. */
export function freshHero() {
  const p = P.newPlayer();
  Game.player = p;
  const rewards: Rewards[] = [];
  Game.events.on('quest-rewards', (r: Rewards) => rewards.push(r));
  Q.offerAll(p, true);
  return { p, rewards };
}

/** Talk to an NPC and read every page to the end (runs the step). Returns the text. */
export function talk(p: P.PlayerData, npc: string): string {
  const t = Q.talk(p, npc);
  expect(t, `${npc} has nothing to say`).toBeTruthy();
  t!.onFinish?.();
  return t!.pages.join(' ');
}

export const step = (p: P.PlayerData, line: string) => Q.state(p, line);
export const MATERIALS = ['monster_essence', 'training_scroll', 'clay', 'nature_essence', 'elemental_essence', 'pebble', 'bark', 'twig', 'wool', 'feather', 'earth_grit'];
export const bagOf = (p: P.PlayerData) => ({ ...p.inventory });
