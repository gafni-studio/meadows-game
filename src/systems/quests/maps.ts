/**
 * The mechanics of each quest step, keyed by "line:step" (moved out of Quests.ts).
 * Text, rewards and gates are in data/skill_quests.json; pages in data/quest_dialogue.json.
 */
import type * as P from '../Player';
import { isDone } from './state';

/** Materials turned in (consumed) at this step. Keyed by line+step. */
export const COLLECT: Record<string, Record<string, number>> = {
  'ql_warrior:5': { twig: 5 },
  'ql_magician:3': { wool: 6, feather: 4 },
  'ql_crack:3': { pebble: 8, earth_grit: 6 },
  'ql_hot:2': { warm_grain: 6 },
  'ql_hot:3': { live_ember: 1 },
  'ql_warm_coat:2': { wool: 8, fur: 6 },
  'ql_dirt_keeps:2': { earth_grit: 8, stone_chunk: 4 },
  // v0.3.0 Whisperwood chain
  'ql_lanterns:2': { wisp_dust: 4 },
  'ql_branches:2': { moss_fiber: 4 },
  'ql_hollow:4': { toad_gland: 3 },
  'ql_antlers:2': { hollow_antler: 1 },
};
/** Items shown as progress on a step before they are turned in (not consumed there). */
export const PREVIEW: Record<string, Record<string, number>> = {
  'ql_warrior:4': { twig: 5 },
  'ql_magician:2': { wool: 6, feather: 4 },
  'ql_hollow:2': { toad_gland: 3 },
  'ql_hollow:3': { toad_gland: 3 },
};
/** Steps that finish by themselves once their PREVIEW items are in the bag (toast shown). */
export const BAG_ADVANCE: Record<string, string> = {
  'ql_magician:2': 'Return to Tamsin.',
  'ql_hollow:2': 'Three glands. Now follow the stag’s tracks east through the bog.',
};

/** Named mob that must die on this step. */
export const KILL: Record<string, string> = {
  'ql_blood:3': 'wool_shoulder',
  'ql_crack:4': 'bank_cracker',
  'ql_hot:3': 'cinderback',
  'ql_antlers:2': 'hollow_stag',
};
export const KILL_LINE: Record<string, { line: string; step: number }> = {};
for (const [k, id] of Object.entries(KILL)) {
  const [line, step] = k.split(':');
  KILL_LINE[id] = { line, step: Number(step) };
}

/** Counted hunts (any of the listed regulars). Keyed by line+step. */
export const HUNT: Record<string, Record<string, number>> = {
  'ql_warrior:4': { field_mouse: 5 },
  'ql_dirt_path:2': { crow: 4 },
  'ql_dirt_path:4': { burrow_mole: 5, ember_beetle: 3 },
  'ql_lanterns:2': { wisp: 6 },
  'ql_branches:2': { moss_lurker: 5, thornling: 3 },
};

/** Place to reach: area and optional x-range in tiles. */
export const REACH: Record<string, { area: string; xMin?: number; xMax?: number }> = {
  // v0.3.0: the far ground of Meadow East; the Banks start at Dirt Banks West.
  'ql_blood:2': { area: 'meadow_east', xMin: 118 },
  'ql_crack:2': { area: 'dirt_banks_west' },
  'ql_dirt_path:3': { area: 'dirt_banks_west' },
  'ql_mist:2': { area: 'whisperwood' },
  'ql_hollow:3': { area: 'whisperwood', xMin: 146 },
};

export const DUMMY: Record<string, number> = { 'ql_warrior:2': 3 };

/** Steps completed by a conversation with their NPC (advance, or complete on the last step). */
export const TALKSTEP = new Set([
  'ql_intro:1', 'ql_intro:2', 'ql_intro:4', 'ql_intro:6', 'ql_intro:8', 'ql_intro:9', 'ql_intro:11',
  'ql_warrior:1', 'ql_warrior:3', 'ql_magician:1', 'ql_quiet_work:1', 'ql_quiet_work:3',
  'ql_warm_coat:1', 'ql_dirt_path:1', 'ql_blood:1', 'ql_dirt_keeps:1',
  'ql_mist:1', 'ql_mist:3', 'ql_lanterns:1', 'ql_branches:1', 'ql_hollow:1', 'ql_antlers:1',
]);
/** Steps where the NPC only answers "not yet" (the player is doing something). */
export const WAIT_ONLY = new Set(['ql_quiet_work:2', 'ql_magician:2', 'ql_mist:2', 'ql_hollow:2', 'ql_hollow:3']);

/** Steps completed by something the player does. */
export const ACTION: Record<string, string> = {
  'ql_intro:3': 'buy_strawberry', 'ql_intro:5': 'eat_berry_q', 'ql_intro:7': 'chest_roundtrip', 'ql_intro:10': 'spend_point',
};

/** Small gifts, handed over when a step finishes (and shown on the rewards screen). */
export interface Gift { coins?: number; items?: Record<string, number>; flavor?: string }
export const GIFT: Record<string, Gift> = {
  'ql_intro:1': { coins: 5 },
  'ql_intro:2': { items: { blueberry: 2 } },
  'ql_intro:7': { items: { meadow_dew: 1 }, flavor: 'Go see Ila. She deals in things that grow.' },
  'ql_intro:8': { items: { clear_dew: 1 } },
  'ql_intro:10': { items: { strawberry: 2 }, flavor: 'Calden is waiting. He doesn’t like waiting.' },
};

/** Quests that start by themselves once their condition holds. */
export const AUTO_START: Record<string, (p: P.PlayerData) => boolean> = {
  ql_intro: () => true,
  ql_warrior: (p) => isDone(p, 'ql_intro'),
  ql_magician: (p) => (p.skillRanks.power_strike ?? 0) >= 1,
  ql_warm_coat: (p) => p.level >= 3 && isDone(p, 'ql_warrior'),
  ql_dirt_path: (p) => p.level >= 3 && isDone(p, 'ql_warrior'),
  ql_blood: (p) => p.level >= 4 && isDone(p, 'ql_warrior'),
  ql_quiet_work: (p) => p.level >= 4 && isDone(p, 'ql_dirt_path'),
  ql_dirt_keeps: (p) => p.level >= 5 && isDone(p, 'ql_dirt_path'),
  // v0.3.0 Whisperwood chain: Pell opens it at level 5, Wren gives the rest by level.
  ql_mist: (p) => p.level >= 5 && isDone(p, 'ql_dirt_path'),
  ql_lanterns: (p) => isDone(p, 'ql_mist'),
  ql_branches: (p) => p.level >= 7 && isDone(p, 'ql_lanterns'),
  ql_hollow: (p) => p.level >= 8 && isDone(p, 'ql_branches'),
  ql_antlers: (p) => p.level >= 9 && isDone(p, 'ql_hollow'),
};
/** Quests Calden starts by talking (marker `!`), once the condition holds. */
export const TALK_START: Record<string, (p: P.PlayerData) => boolean> = {
  ql_crack: (p) => p.level >= 5 && isDone(p, 'ql_dirt_path'),
  ql_hot: (p) => p.level >= 6 && isDone(p, 'ql_crack'),
};
/** Quest items that also start their line when picked up or inspected. */
export const ITEM_START: Record<string, { line: string; ok: (p: P.PlayerData) => boolean }> = {
  cracked_bank_stone: { line: 'ql_crack', ok: (p) => isDone(p, 'ql_dirt_path') },
  smoldering_scale: { line: 'ql_hot', ok: (p) => isDone(p, 'ql_crack') },
};
/** The item a talk-started quest asks for on step 1 (consumed). */
export const STEP1_ITEM: Record<string, string> = { ql_crack: 'cracked_bank_stone', ql_hot: 'smoldering_scale' };

/** Lines that grant their skill at rank 1 on completion. Others only open training. */
export const GRANT_RANK = new Set(['ql_blood']);
export const PATH_REVEAL: Record<string, string> = { ql_warrior: 'Warrior Path revealed', ql_magician: 'Magician Path revealed' };
