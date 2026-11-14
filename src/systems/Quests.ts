/**
 * Quest lines (v0.2.9 rebuild).
 *
 * Text, rewards, gates and unlock skills come from data/skill_quests.json. The mechanics of each step
 * (talk, action, dummy hits, reach, hunt, collect, named kill) live here, keyed by "line:step".
 *
 * New in v0.2.9:
 *  - Welcome to Meadow Town: an eleven-step intro chain, all in town, with tiny gifts.
 *  - Path of the Warrior / Path of the Magician replace The Weight of a Swing, The Hero's Paths, The Quiet Spell.
 *    Completing one reveals that Path's tree and opens training of its root skill (nothing is granted).
 *  - Quests appear gradually (AUTO_START / TALK_START). Locked quests are invisible.
 *  - NPCs never hand over quest materials. Rewards are small.
 *  - Every completion emits a 'quest-rewards' payload; the HUD plays the completion moment and shows the screen.
 */
import { DB, tab, descOf } from '../data/db';
import * as P from './Player';
import { Game } from './GameState';
import { playSfx } from './Sfx';
import { isGear, makeGear } from './Gear';
import { autoBind, barOf } from './Bar';

export interface QuestStepRow {
  id: string; line_id: string; step: number; name: string; desc: string; objective: string;
  notes?: string; trigger?: string | null; gate_level?: number | null; gate_stat?: string | null;
  gate_value?: number | null; reward_xp?: number | null; reward_coins?: number | null;
  reward_items?: string | null; unlock_skill?: string | null; giver?: string | null;
}
export interface QuestState { step: number; done: boolean; killed?: boolean; dummyHits?: number; kills?: Record<string, number>; chestIn?: boolean }
export type QuestLog = Record<string, QuestState>;

const ROWS = tab<QuestStepRow>('skill_quests');
const LINES = [...new Set(ROWS.map((r) => r.line_id))];

const SKILL_LINE: Record<string, string> = {};
for (const r of ROWS) if (r.unlock_skill) SKILL_LINE[r.unlock_skill] = r.line_id;

/** Materials turned in (consumed) at this step. Keyed by line+step. */
const COLLECT: Record<string, Record<string, number>> = {
  'ql_warrior:5': { twig: 5 },
  'ql_magician:3': { wool: 6, feather: 4 },
  'ql_crack:3': { pebble: 8, earth_grit: 6 },
  'ql_hot:2': { warm_grain: 6 },
  'ql_hot:3': { live_ember: 1 },
  'ql_warm_coat:2': { wool: 8, fur: 6 },
  'ql_dirt_keeps:2': { earth_grit: 8, stone_chunk: 4 },
};
/** Items shown as progress on a step before they are turned in (not consumed there). */
const PREVIEW: Record<string, Record<string, number>> = {
  'ql_warrior:4': { twig: 5 },
  'ql_magician:2': { wool: 6, feather: 4 },
};

/** Named mob that must die on this step. */
const KILL: Record<string, string> = {
  'ql_blood:3': 'wool_shoulder',
  'ql_crack:4': 'bank_cracker',
  'ql_hot:3': 'cinderback',
};
const KILL_LINE: Record<string, { line: string; step: number }> = {};
for (const [k, id] of Object.entries(KILL)) {
  const [line, step] = k.split(':');
  KILL_LINE[id] = { line, step: Number(step) };
}

/** Counted hunts (any of the listed regulars). Keyed by line+step. */
const HUNT: Record<string, Record<string, number>> = {
  'ql_warrior:4': { field_mouse: 5 },
  'ql_dirt_path:2': { crow: 4 },
  'ql_dirt_path:4': { burrow_mole: 5, ember_beetle: 3 },
};

function huntDone(need: Record<string, number>, kills: Record<string, number> | undefined): boolean {
  return Object.entries(need).every(([id, n]) => (kills?.[id] ?? 0) >= n);
}
function huntLabel(need: Record<string, number>, kills: Record<string, number> | undefined): string {
  return Object.entries(need).map(([id, n]) => `${DB.monsters[id]?.name ?? id} ${Math.min(kills?.[id] ?? 0, n)}/${n}`).join(' · ');
}

/** Place to reach: area and optional x-range in tiles. */
const REACH: Record<string, { area: string; xMin?: number; xMax?: number }> = {
  'ql_blood:2': { area: 'sunny_pasture', xMin: 100, xMax: 130 },
  'ql_crack:2': { area: 'dirt_banks' },
  'ql_dirt_path:3': { area: 'dirt_banks' },
};

const DUMMY: Record<string, number> = { 'ql_warrior:2': 3 };

/** Steps completed by a conversation with their NPC (advance, or complete on the last step). */
const TALKSTEP = new Set([
  'ql_intro:1', 'ql_intro:2', 'ql_intro:4', 'ql_intro:6', 'ql_intro:8', 'ql_intro:9', 'ql_intro:11',
  'ql_warrior:1', 'ql_warrior:3', 'ql_magician:1', 'ql_quiet_work:1', 'ql_quiet_work:3',
  'ql_warm_coat:1', 'ql_dirt_path:1', 'ql_blood:1', 'ql_dirt_keeps:1',
]);
/** Steps where the NPC only answers "not yet" (the player is doing something). */
const WAIT_ONLY = new Set(['ql_quiet_work:2', 'ql_magician:2']);

/** Steps completed by something the player does. */
const ACTION: Record<string, string> = {
  'ql_intro:3': 'buy_strawberry', 'ql_intro:5': 'eat_berry_q', 'ql_intro:7': 'chest_roundtrip', 'ql_intro:10': 'spend_point',
};

/** Small gifts, handed over when a step finishes (and shown on the rewards screen). */
interface Gift { coins?: number; items?: Record<string, number>; flavor?: string }
const GIFT: Record<string, Gift> = {
  'ql_intro:1': { coins: 5 },
  'ql_intro:2': { items: { blueberry: 2 } },
  'ql_intro:7': { items: { meadow_dew: 1 }, flavor: 'Go see Ila. She deals in things that grow.' },
  'ql_intro:8': { items: { clear_dew: 1 } },
  'ql_intro:10': { items: { strawberry: 2 }, flavor: 'Calden is waiting. He doesn’t like waiting.' },
};

/** Quests that start by themselves once their condition holds. */
const AUTO_START: Record<string, (p: P.PlayerData) => boolean> = {
  ql_intro: () => true,
  ql_warrior: (p) => isDone(p, 'ql_intro'),
  ql_magician: (p) => (p.skillRanks.power_strike ?? 0) >= 1,
  ql_warm_coat: (p) => p.level >= 3 && isDone(p, 'ql_warrior'),
  ql_dirt_path: (p) => p.level >= 3 && isDone(p, 'ql_warrior'),
  ql_blood: (p) => p.level >= 4 && isDone(p, 'ql_warrior'),
  ql_quiet_work: (p) => p.level >= 4 && isDone(p, 'ql_dirt_path'),
  ql_dirt_keeps: (p) => p.level >= 5 && isDone(p, 'ql_dirt_path'),
};
/** Quests Calden starts by talking (marker `!`), once the condition holds. */
const TALK_START: Record<string, (p: P.PlayerData) => boolean> = {
  ql_crack: (p) => p.level >= 5 && isDone(p, 'ql_dirt_path'),
  ql_hot: (p) => p.level >= 6 && isDone(p, 'ql_crack'),
};
/** Quest items that also start their line when picked up or inspected. */
const ITEM_START: Record<string, { line: string; ok: (p: P.PlayerData) => boolean }> = {
  cracked_bank_stone: { line: 'ql_crack', ok: (p) => isDone(p, 'ql_dirt_path') },
  smoldering_scale: { line: 'ql_hot', ok: (p) => isDone(p, 'ql_crack') },
};
/** The item a talk-started quest asks for on step 1 (consumed). */
const STEP1_ITEM: Record<string, string> = { ql_crack: 'cracked_bank_stone', ql_hot: 'smoldering_scale' };

/** Lines that grant their skill at rank 1 on completion. Others only open training. */
const GRANT_RANK = new Set(['ql_blood']);
const PATH_REVEAL: Record<string, string> = { ql_warrior: 'Warrior Path revealed', ql_magician: 'Magician Path revealed' };

// ───────────────────────── rows and state ─────────────────────────
export function rowsOf(line: string): QuestStepRow[] {
  return ROWS.filter((r) => r.line_id === line).sort((a, b) => a.step - b.step);
}
export function row(line: string, step: number): QuestStepRow | undefined {
  return ROWS.find((r) => r.line_id === line && r.step === step);
}
export function lineName(line: string): string { return rowsOf(line)[0]?.name ?? line; }
export function lineOfSkill(skillId: string): string | undefined { return SKILL_LINE[skillId]; }
export function allLines(): string[] { return LINES; }
const lastStep = (line: string) => rowsOf(line).slice(-1)[0]?.step ?? 1;

export function state(p: P.PlayerData, line: string): QuestState {
  p.questLog ??= {};
  return p.questLog[line] ?? { step: 0, done: false };
}
export function isDone(p: P.PlayerData, line: string): boolean { return !!state(p, line).done; }
export function isActive(p: P.PlayerData, line: string): boolean {
  const s = state(p, line);
  return !s.done && s.step >= 1;
}
export function currentRow(p: P.PlayerData, line: string): QuestStepRow | undefined {
  const s = state(p, line);
  return s.done ? undefined : row(line, s.step);
}
function setState(p: P.PlayerData, line: string, s: QuestState) {
  p.questLog ??= {};
  p.questLog[line] = s;
}

export function skillLockedByQuest(skillId: string): boolean { return !!SKILL_LINE[skillId]; }
export function skillQuestDone(p: P.PlayerData, skillId: string): boolean {
  const line = SKILL_LINE[skillId];
  return !line || isDone(p, line);
}

function parseItems(s: string | null | undefined): { id: string; qty: number }[] {
  const out: { id: string; qty: number }[] = [];
  for (const part of String(s ?? '').split(/[;,]/)) {
    const m = part.trim().match(/^([a-z_]+)\s*x(\d+)$/);
    if (m && DB.items[m[1]]) out.push({ id: m[1], qty: Number(m[2]) });
  }
  return out;
}

export function gateOk(p: P.PlayerData, line: string): { ok: boolean; reason?: string } {
  const r = rowsOf(line)[0];
  if (!r) return { ok: true };
  const lv = r.gate_level ?? 0;
  const need = r.gate_value ?? 0;
  const stat = (r.gate_stat as P.Stat | null) ?? null;
  if (lv && p.level < lv && stat && P.statOf(p, stat) < need) return { ok: false, reason: `Needs level ${lv} and ${need} ${stat}` };
  if (lv && p.level < lv) return { ok: false, reason: `Needs level ${lv}` };
  if (stat && need && P.statOf(p, stat) < need) return { ok: false, reason: `Needs ${need} ${stat}` };
  return { ok: true };
}

const hasItem = (p: P.PlayerData, id: string, n = 1) => (p.inventory[id] ?? 0) >= n;
function hasCollect(p: P.PlayerData, need: Record<string, number>): boolean {
  return Object.entries(need).every(([id, n]) => hasItem(p, id, n));
}

// ───────────────────────── start / advance / complete ─────────────────────────
export function start(p: P.PlayerData, line: string, silent = false): boolean {
  const s = state(p, line);
  if (s.done || s.step >= 1) return false;
  setState(p, line, { step: 1, done: false });
  if (!silent) {
    Game.toast(`Journal: ${lineName(line)} — press J`, 'rare');
    Game.events.emit('quest', line);
    Game.changed();
    Game.save();
  }
  return true;
}

function advance(p: P.PlayerData, line: string, toastMsg?: string): void {
  const s = state(p, line);
  if (s.done) return;
  if (s.step >= lastStep(line)) { complete(p, line); return; }
  setState(p, line, { ...s, step: s.step + 1, dummyHits: 0 });
  const nxt = row(line, s.step + 1);
  Game.toast(toastMsg ?? (nxt ? `${lineName(line)}: ${nxt.objective}` : 'Quest updated'), 'info');
  Game.events.emit('quest', line);
  Game.changed();
  Game.save();
}

function itemRowText(id: string, qty: number): string { return `${qty}× ${DB.items[id]?.name ?? id}`; }

/** A small step gift: given now, shown on the rewards screen. */
function giveGift(p: P.PlayerData, line: string, key: string, fallbackFlavor: string): void {
  const g = GIFT[key];
  if (!g) return;
  const rows: string[] = [];
  if (g.coins) { p.coins += g.coins; rows.push(`${g.coins} Copper`); }
  for (const [id, n] of Object.entries(g.items ?? {})) { P.addItem(p, id, n); rows.push(itemRowText(id, n)); }
  playSfx('pickup');
  Game.events.emit('quest-rewards', { name: lineName(line), title: 'A small gift', flavor: g.flavor ?? fallbackFlavor, rows, final: false });
}

function complete(p: P.PlayerData, line: string): void {
  const s = state(p, line);
  if (s.done) return;
  const last = rowsOf(line).slice(-1)[0];
  setState(p, line, { ...s, done: true });
  if (last?.unlock_skill && GRANT_RANK.has(line)) grantSkill(p, last.unlock_skill);
  const xp = last?.reward_xp ?? 0;
  const coins = last?.reward_coins ?? 0;
  if (xp) {
    const lv = P.gainXp(p, xp);
    if (lv) Game.scene?.levelUpFx(lv);
  }
  if (coins) p.coins += coins;
  const items = parseItems(last?.reward_items);
  const itemRows: string[] = [];
  for (const it of items) {
    if (isGear(it.id)) {
      // Quest gifts are the exact typical piece (Hide Vest Defense 3, Stone Club damage 16), never magic.
      for (let n = 0; n < it.qty; n++) {
        const g = makeGear(it.id, { mode: 'typical', magic: false });
        P.addGear(p, g);
        const stat = g.weaponDamage > 0 ? `Weapon damage ${g.weaponDamage}` : `Defense ${g.defense}`;
        itemRows.push(`1× ${DB.items[it.id].name} — ${stat}`);
      }
    } else {
      P.addItem(p, it.id, it.qty);
      itemRows.push(itemRowText(it.id, it.qty));
    }
  }
  const skillName = last?.unlock_skill ? (DB.skills[last.unlock_skill]?.name ?? last.unlock_skill) : '';
  const got = [
    skillRewardLabel(line, last), xp ? `${xp} XP` : '', coins ? `${coins} Copper` : '',
    ...items.map((it) => `${it.qty}× ${DB.items[it.id].name}`),
  ].filter(Boolean).join(', ');
  Game.toast(`Quest complete: ${lineName(line)} — ${got}`, 'rare');
  Game.events.emit('quest', line);
  Game.events.emit('quest-complete', lineName(line), got);
  playSfx('quest');
  // The rewards screen: XP, Copper, items, then the skill / Path line.
  const rows = [xp ? `${xp} XP` : '', coins ? `${coins} Copper` : '', ...itemRows,
    PATH_REVEAL[line] ?? '',
    skillName ? (GRANT_RANK.has(line) ? `${skillName} rank 1` : `${skillName} training is now open`) : ''].filter(Boolean);
  const done = TALK[`${line}:${lastStep(line)}:done`] ?? TALK[`${line}:${lastStep(line)}:ok`];
  Game.events.emit('quest-rewards', { name: lineName(line), flavor: done?.length ? done[done.length - 1] : `${lineName(line)} is done.`, rows, final: true });
  offerAll(p, false);
  Game.changed();
  Game.save();
}

function grantSkill(p: P.PlayerData, id: string) {
  if ((p.skillRanks[id] ?? 0) < 1) p.skillRanks[id] = 1;
  autoBind(barOf(p), id);
}

function skillRewardLabel(line: string, last: { unlock_skill?: string | null } | undefined): string {
  if (!last?.unlock_skill) return '';
  const name = DB.skills[last.unlock_skill]?.name ?? last.unlock_skill;
  return GRANT_RANK.has(line) ? `${name} rank 1` : `${name} training`;
}

// ───────────────────────── appearing gradually ─────────────────────────
/** Start every quest whose condition now holds. Cheap; called on level, completion and a timer. */
export function offerAll(p: P.PlayerData, silent = false): void {
  for (const line of LINES) {
    if (state(p, line).step >= 1 || isDone(p, line)) continue;
    if (AUTO_START[line]?.(p)) start(p, line, silent);
  }
}
export function onLevel(p: P.PlayerData, silent = false): void { offerAll(p, silent); }

/** The talk-started quest Calden can offer right now, if any. */
export function startableTalk(p: P.PlayerData): string | null {
  for (const line of Object.keys(TALK_START)) {
    if (state(p, line).step === 0 && !isDone(p, line) && TALK_START[line](p)) return line;
  }
  return null;
}

/** Pickup or inspect of a quest-start item. */
export function onItem(p: P.PlayerData, itemId: string, silent = false): void {
  if (itemId === 'cracked_bank_stone') { p.questFlags ??= {}; p.questFlags.stone_seen = true; }
  if (itemId === 'smoldering_scale') { p.questFlags ??= {}; p.questFlags.scale_seen = true; }
  const it = ITEM_START[itemId];
  if (it && it.ok(p)) start(p, it.line, silent);
}

/** Called a few times a second: new quests, and steps that finish when the bag is ready. */
export function tick(p: P.PlayerData): void {
  offerAll(p, false);
  if (isActive(p, 'ql_magician') && state(p, 'ql_magician').step === 2 && hasCollect(p, COLLECT['ql_magician:3'])) {
    advance(p, 'ql_magician', 'Return to Tamsin.');
  }
}

// ───────────────────────── player actions ─────────────────────────
export function onAction(p: P.PlayerData, action: string, arg?: string | number): void {
  if (!isActive(p, 'ql_intro')) return;
  const s = state(p, 'ql_intro');
  const key = `ql_intro:${s.step}`;
  if (ACTION[key] === 'buy_strawberry' && action === 'buy' && arg === 'strawberry') advance(p, 'ql_intro');
  else if (ACTION[key] === 'eat_berry_q' && action === 'eat_berry' && arg === 6) {
    Game.toast('There. Feel better? Good. Now the chest.', 'rare');
    advance(p, 'ql_intro');
  } else if (ACTION[key] === 'chest_roundtrip') {
    if (action === 'chest_put') { setState(p, 'ql_intro', { ...s, chestIn: true }); Game.save(); }
    else if (action === 'chest_take' && s.chestIn) {
      advance(p, 'ql_intro');
      giveGift(p, 'ql_intro', key, 'Go see Ila.');
    }
  } else if (ACTION[key] === 'spend_point' && action === 'spend_point') {
    advance(p, 'ql_intro');
    giveGift(p, 'ql_intro', key, '');
  }
}

/** E at the practice post: the dummy is only a target (hits are counted in onDummyHit). */
export function interactPost(p: P.PlayerData): string | null {
  if (isActive(p, 'ql_warrior') && state(p, 'ql_warrior').step === 2) return 'Three honest blows with F. Not a skill. Let Calden hear them.';
  return 'A worn practice post. Calden might ask you to train here.';
}

export function shouldSpawn(p: P.PlayerData, monsterId: string): boolean {
  const k = KILL_LINE[monsterId];
  if (!k) return false;
  const s = state(p, k.line);
  if (!isActive(p, k.line) || s.killed) return false;
  // Bank-Cracker and Cinderback are out in the Banks from the step after the first, so the named foe is visible.
  if (monsterId === 'bank_cracker' || monsterId === 'cinderback') return s.step >= 2 && s.step <= k.step;
  return s.step === k.step;
}

export function onKill(p: P.PlayerData, monsterId: string): void {
  const k = KILL_LINE[monsterId];
  if (k) {
    const s = state(p, k.line);
    if (isActive(p, k.line) && (s.step === k.step || ((monsterId === 'bank_cracker' || monsterId === 'cinderback') && s.step >= 2 && s.step <= k.step))) {
      setState(p, k.line, { ...s, killed: true });
      if (monsterId === 'cinderback') {
        P.addItem(p, 'live_ember', 1);
        Game.toast('Live Ember — take it to Calden', 'rare', 'live_ember');
      }
      if (s.step === k.step) Game.toast(`${DB.monsters[monsterId]?.name ?? monsterId} falls. Return to Calden.`, 'info');
      else Game.toast(`${DB.monsters[monsterId]?.name ?? monsterId} falls. Calden will want to hear it.`, 'info');
      Game.changed();
      Game.save();
    }
  }
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const s = state(p, line);
    const need = HUNT[`${line}:${s.step}`];
    if (!need || need[monsterId] == null) continue;
    const kills = { ...(s.kills ?? {}) };
    kills[monsterId] = (kills[monsterId] ?? 0) + 1;
    setState(p, line, { ...s, kills });
    if (huntDone(need, kills)) {
      if (s.step === lastStep(line)) {
        Game.toast(`Return to ${row(line, s.step)?.giver === 'pell' ? 'Pell' : 'Calden'}.`, 'info');
        Game.changed();
        Game.save();
      } else {
        advance(p, line, line === 'ql_dirt_path' ? 'The path into the Dirt Banks is open. Follow it east.' : line === 'ql_warrior' ? 'The mice are cleared. Return to Calden with 5 Twig.' : undefined);
      }
    } else {
      Game.toast(progressOf(p, line, s.step), 'info');
      Game.changed();
      Game.save();
    }
  }
}

/** Reach-a-place checks. */
export function checkPlace(p: P.PlayerData, area: string, xTiles: number): void {
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const s = state(p, line);
    const req = REACH[`${line}:${s.step}`];
    if (!req || req.area !== area) continue;
    if (req.xMin != null && xTiles < req.xMin) continue;
    if (req.xMax != null && xTiles > req.xMax) continue;
    advance(p, line);
  }
}

export function onDummyHit(p: P.PlayerData): void {
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const s = state(p, line);
    const need = DUMMY[`${line}:${s.step}`];
    if (!need) continue;
    const n = (s.dummyHits ?? 0) + 1;
    setState(p, line, { ...s, dummyHits: n });
    Game.toast(`Practice post ${n}/${need}`, 'info');
    if (n >= need) advance(p, line, 'Calden heard that. Return to him.');
    else { Game.changed(); Game.save(); }
  }
}
export function dummyNeeded(p: P.PlayerData): boolean {
  return LINES.some((line) => isActive(p, line) && !!DUMMY[`${line}:${state(p, line).step}`]);
}

/** Starting the Nature Essence node (first rank) finishes Ila's gathering step. */
export function onPassive(p: P.PlayerData): void {
  if (isActive(p, 'ql_quiet_work') && state(p, 'ql_quiet_work').step === 2 && (p.passiveUpgrade?.nodeId === 'nature_prod' || (p.passiveRanks?.nature_prod ?? 0) >= 1)) {
    advance(p, 'ql_quiet_work', 'The root is in the dirt. Return to Ila.');
  }
}

// ───────────────────────── conversations ─────────────────────────
export interface TalkResult {
  speaker: string;
  pages: string[];
  onFinish?: () => void;
}
function speakerOf(npc: string): string {
  return DB.npcs[npc === 'chest' ? 'mara' : npc]?.name ?? npc;
}
function say(npc: string, pages: string[], onFinish?: () => void): TalkResult {
  return { speaker: speakerOf(npc), pages, onFinish };
}

/** Short, spoken lines: one thought per page. Each NPC has one voice (Pell warm, Mara dry, Calden gruff, Ila growing, Tamsin counting). */
/** Every conversation lives in data/quest_dialogue.json (key "line:step:kind" → pages). */
const TALK: Record<string, string[]> = Object.fromEntries(tab<{ key: string; lines: string[] }>('quest_dialogue').map((r) => [r.key, r.lines]));


/** The lines of a conversation for this step; the last step of a line uses its `done` lines. */
function linesFor(line: string, step: number): string[] {
  const key = `${line}:${step}`;
  const last = step === lastStep(line);
  return (last ? TALK[`${key}:done`] : undefined) ?? TALK[`${key}:ok`] ?? TALK[`${key}:done`] ?? [row(line, step)?.objective ?? '…'];
}

/** A talk step finishes: its gift, then the next step (or the completion). */
function finishTalkStep(p: P.PlayerData, line: string, step: number, pages: string[]): void {
  const key = `${line}:${step}`;
  const last = step === lastStep(line);
  if (last) { complete(p, line); return; }
  advance(p, line);
  giveGift(p, line, key, pages[pages.length - 1] ?? '');
}

/** Talk to an NPC. Returns the conversation, or null if they have nothing quest-related to say. */
export function talk(p: P.PlayerData, npc: string): TalkResult | null {
  // Calden offers a talk-started quest (The Cracked Stone, Ember in the Scale) when nothing is ready to turn in.
  const offer = npc === 'calden' ? startableTalk(p) : null;
  if (offer && markerFor(p, npc) !== '?') {
    const item = STEP1_ITEM[offer];
    const ready = hasItem(p, item) && gateOk(p, offer).ok;
    const pages = [...TALK[`${offer}:0:start`]];
    if (ready) pages.push(...TALK[`${offer}:1:ok`]);
    else if (hasItem(p, item)) pages.push(...TALK[`${offer}:1:gate`]);
    return say(npc, pages, () => {
      start(p, offer);
      if (ready) { P.removeItem(p, item, 1); advance(p, offer); }
    });
  }
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const s = state(p, line);
    const r = row(line, s.step);
    if (!r || r.giver !== npc) continue;
    const key = `${line}:${s.step}`;
    const last = s.step === lastStep(line);

    if (TALKSTEP.has(key)) {
      const pages = linesFor(line, s.step);
      return say(npc, pages, () => finishTalkStep(p, line, s.step, pages));
    }

    // The talk-started quests' first step: bring the item (consumed) once the gate is met.
    if (s.step === 1 && STEP1_ITEM[line]) {
      const item = STEP1_ITEM[line];
      if (!hasItem(p, item)) return say(npc, TALK[`${line}:1:need`]);
      if (!gateOk(p, line).ok) return say(npc, TALK[`${line}:1:gate`]);
      return say(npc, TALK[`${line}:1:ok`], () => { P.removeItem(p, item, 1); advance(p, line); });
    }

    const hunt = HUNT[key];
    if (hunt) {
      if (!huntDone(hunt, s.kills)) return say(npc, TALK[`${key}:wait`] ?? [`Still short. ${huntLabel(hunt, s.kills)}.`]);
      if (last) return say(npc, linesFor(line, s.step), () => complete(p, line));
      return say(npc, TALK[`${key}:ok`] ?? ['That will do.'], () => advance(p, line));
    }

    const need = COLLECT[key];
    if (need) {
      if (KILL[key] && !s.killed) return say(npc, TALK[`${key}:wait`] ?? [`You still have to face ${DB.monsters[KILL[key]]?.name ?? 'the named foe'}.`]);
      if (!hasCollect(p, need)) return say(npc, TALK[`${key}:wait`] ?? [`Bring me ${collectLabel(p, need)}.`]);
      const finish = () => {
        for (const [id, n] of Object.entries(need)) P.removeItem(p, id, n);
        if (last) complete(p, line); else advance(p, line);
      };
      return say(npc, linesFor(line, s.step), finish);
    }

    if (KILL[key]) {
      if (!s.killed) return say(npc, TALK[`${key}:wait`] ?? [`You still have to face ${DB.monsters[KILL[key]]?.name}.`]);
      if (last) return say(npc, linesFor(line, s.step), () => complete(p, line));
      return say(npc, TALK[`${key}:ok`] ?? ['Well fought.'], () => advance(p, line));
    }

    if (WAIT_ONLY.has(key)) return say(npc, TALK[`${key}:wait`]);
  }
  return null;
}

/** A few lore lines when an NPC has no quest to advance. */
export function greeting(npc: string): TalkResult | null {
  if (npc === 'tamsin') {
    return say('tamsin', [
      'Mm. One, two, three. Sorry, counting. It helps.',
      'The Magician’s Path throws things from far away and spends a great deal of mana doing it. Come back once you can swing a blade.',
    ]);
  }
  if (npc === 'pell') {
    return say('pell', [
      'Meadow Town sits easy, for now. The pasture to the east is honest work — mice and sheep leave you be unless you hit them. Watch the crows.',
      'The dirt path at the far end goes on to the Banks. Loose earth, moles, a little warmth in the beetles.',
      'Sell junk to Mara. Train with Calden. If you want something slower than a swing, Ila’s bench is the place.',
    ]);
  }
  if (npc === 'calden') {
    return say('calden', [
      'A swing is a conversation. The post doesn’t lie, and neither do I.',
      'Bring Monster Essence and Training Scrolls when you want a rank. Nature, Elemental, Spiritual — those want their own essence.',
    ]);
  }
  return null;
}

/** True if talking to this NPC should open a quest conversation (instead of, or before, their usual window). */
export function wantsTalk(p: P.PlayerData, npc: string): boolean {
  if (npc === 'calden' && startableTalk(p)) return true;
  return LINES.some((line) => {
    if (!isActive(p, line)) return false;
    const s = state(p, line);
    const r = row(line, s.step);
    if (!r || r.giver !== npc) return false;
    const key = `${line}:${s.step}`;
    return TALKSTEP.has(key) || WAIT_ONLY.has(key) || !!HUNT[key] || !!COLLECT[key] || !!KILL[key] || (s.step === 1 && !!STEP1_ITEM[line]);
  });
}

// ───────────────────────── markers ─────────────────────────
/**
 * Marker above a quest NPC: `!` a quest (or its next conversation) can be started, `?` a turn-in is ready.
 * `?` wins. Nothing while a step is in progress or a gate is unmet.
 */
export function markerFor(p: P.PlayerData, npc: string): '!' | '?' | null {
  let avail = false;
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const s = state(p, line);
    const r = row(line, s.step);
    if (!r || r.giver !== npc) continue;
    const key = `${line}:${s.step}`;
    const last = s.step === lastStep(line);
    if (TALKSTEP.has(key)) {
      // the opening of a quest, or the next part of a chain: `!`. A closing conversation is a turn-in: `?`.
      if (last || (line === 'ql_quiet_work' && s.step === 3)) return '?';
      avail = true;
      continue;
    }
    if (s.step === 1 && STEP1_ITEM[line]) {
      if (hasItem(p, STEP1_ITEM[line]) && gateOk(p, line).ok) return '?';
      continue;
    }
    const hunt = HUNT[key];
    if (hunt) { if (huntDone(hunt, s.kills) && last) return '?'; continue; }
    const need = COLLECT[key];
    if (need) { if ((!KILL[key] || s.killed) && hasCollect(p, need)) return '?'; continue; }
    if (KILL[key]) { if (s.killed) return '?'; continue; }
  }
  if (npc === 'calden' && startableTalk(p)) avail = true;
  return avail ? '!' : null;
}

// ───────────────────────── objectives and the journal ─────────────────────────
/** `Twig 3/5 · Bark 0/4` for a collect step (capped at the requirement). */
export function collectLabel(p: P.PlayerData, need: Record<string, number>): string {
  return Object.entries(need).map(([id, n]) => {
    const have = id === 'copper_coin' ? p.coins : (p.inventory[id] ?? 0);
    const name = id === 'copper_coin' ? 'Copper' : (DB.items[id]?.name ?? id);
    return `${name} ${Math.min(have, n)}/${n}`;
  }).join(' · ');
}

const NATURE_RANK1 = (() => {
  const out: Record<string, number> = {};
  for (const r of tab<{ node_id: string; rank: number; material_id: string; quantity: number }>('passive_costs')) {
    if (r.node_id === 'nature_prod' && r.rank === 1) out[r.material_id] = r.quantity;
  }
  return out;
})();

/** Live progress for the current step: hunt kills, items in the bag, or what a first root costs. */
export function progressOf(p: P.PlayerData, line: string, step: number): string {
  const s = state(p, line);
  const key = `${line}:${step}`;
  const parts: string[] = [];
  const hunt = HUNT[key];
  if (hunt) parts.push(huntLabel(hunt, s.kills));
  const need = COLLECT[key] ?? PREVIEW[key];
  if (need) parts.push(collectLabel(p, need));
  if (key === 'ql_quiet_work:2') parts.push(collectLabel(p, NATURE_RANK1));
  return parts.join(' · ');
}

export function currentObjective(p: P.PlayerData): string | null {
  const all = currentObjectives(p);
  return all[0] ? `${all[0].name}: ${all[0].objective}` : null;
}

export function currentObjectives(p: P.PlayerData): { line: string; name: string; objective: string }[] {
  const out: { line: string; name: string; objective: string }[] = [];
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const r = currentRow(p, line);
    if (!r) continue;
    const prog = progressOf(p, line, state(p, line).step);
    out.push({ line, name: r.name, objective: prog ? `${r.objective} (${prog})` : r.objective });
  }
  return out;
}

export interface JournalEntry {
  line: string; name: string; desc: string; status: 'active' | 'done' | 'available';
  step: number; steps: { n: number; objective: string; current: boolean; done: boolean; progress?: string }[];
  rewards?: string; skill?: string;
}
/** v0.2.9: active quests, completed quests, and a quest that can be started right now. Nothing else. */
export function journal(p: P.PlayerData): JournalEntry[] {
  offerAll(p, true);
  const offer = startableTalk(p);
  const out: JournalEntry[] = [];
  for (const line of LINES) {
    const steps = rowsOf(line);
    const head = steps[0];
    if (!head) continue;
    const s = state(p, line);
    let status: JournalEntry['status'];
    if (s.done) status = 'done';
    else if (s.step >= 1) status = 'active';
    else if (line === offer) status = 'available';
    else continue;
    const last = steps.slice(-1)[0];
    const rewards = [
      skillRewardLabel(line, last),
      last?.reward_xp ? `${last.reward_xp} XP` : '',
      last?.reward_coins ? `${last.reward_coins} Copper` : '',
      ...parseItems(last?.reward_items).map((it) => `${it.qty}× ${DB.items[it.id].name}`),
    ].filter(Boolean).join(' · ');
    out.push({
      line, name: head.name, desc: descOf(head) || head.desc, status, step: s.step,
      steps: steps.map((r) => ({
        n: r.step, objective: r.objective,
        current: !s.done && r.step === s.step,
        done: s.done || r.step < s.step,
        progress: !s.done && r.step === s.step ? progressOf(p, line, r.step) || undefined : undefined,
      })),
      rewards, skill: last?.unlock_skill ?? undefined,
    });
  }
  const order = { active: 0, available: 1, done: 2 };
  return out.sort((a, b) => order[a.status] - order[b.status]);
}

// ───────────────────────── saves ─────────────────────────
/**
 * Bring an older save forward. The old Path-less quests become the new ones: finishing The Weight of a Swing,
 * The Hero's Paths or The Quiet Spell counts as the matching new quest. Skills already known stay known.
 */
export function migrateQuests(p: P.PlayerData): void {
  p.questLog ??= {};
  const log = p.questLog as Record<string, QuestState>;
  const finished = (line: string) => ({ step: lastStep(line), done: true });
  const old = (id: string) => log[id];
  const isOldSave = !!old('ql_weight') || !!old('ql_paths') || !!old('ql_magic') || p.level > 1 || Object.keys(p.skillRanks ?? {}).length > 0;
  if (isOldSave && !log.ql_intro) log.ql_intro = finished('ql_intro');
  if ((old('ql_weight')?.done || old('ql_paths')?.done || (p.skillRanks.power_strike ?? 0) >= 1) && !log.ql_warrior) log.ql_warrior = finished('ql_warrior');
  if ((old('ql_magic')?.done || (p.skillRanks.magic_bolt ?? 0) >= 1) && !log.ql_magician) log.ql_magician = finished('ql_magician');
  // an old save partway through The Weight of a Swing restarts the new Path of the Warrior at its first step
  if (old('ql_weight') && !old('ql_weight').done && !log.ql_warrior) log.ql_warrior = { step: 1, done: false };
  for (const gone of ['ql_weight', 'ql_paths', 'ql_magic']) delete log[gone];
  // a skill that was already known closes its line (and stays usable)
  for (const [skill, line] of Object.entries(SKILL_LINE)) {
    if (log[line]) continue;
    if (!Object.prototype.hasOwnProperty.call(p.skillRanks ?? {}, skill)) continue;
    if ((p.skillRanks[skill] ?? 0) < 1) p.skillRanks[skill] = 1;
    log[line] = finished(line);
  }
  offerAll(p, true);
  // Already-held quest items start their line, where that line is open.
  for (const [id, n] of Object.entries(p.inventory ?? {})) if ((n ?? 0) > 0) onItem(p, id, true);
}

/** Mark a line done without rewards (used when a cheat already granted the skill). */
export function markDone(p: P.PlayerData, line: string): void {
  p.questLog ??= {};
  if (p.questLog[line]?.done) return;
  const last = lastStep(line);
  p.questLog[line] = { ...(p.questLog[line] ?? { step: last, done: false }), step: last, done: true };
}

/** Cheat: finish a line (or the current step if `stepOnly`). */
export function cheatComplete(p: P.PlayerData, line: string, stepOnly = false): string {
  if (!LINES.includes(line)) return `Unknown quest. Try: ${LINES.join(', ')}`;
  if (isDone(p, line)) return `${lineName(line)} is already done`;
  if (!isActive(p, line)) start(p, line, true);
  if (stepOnly) { advance(p, line, `(cheat) ${lineName(line)} advanced`); return `Advanced ${lineName(line)} to step ${state(p, line).step}`; }
  complete(p, line);
  return `Completed ${lineName(line)}`;
}

/** Hud: the player can see this Path's tree (its Path quest is done). */
export function pathRevealed(p: P.PlayerData, pathId: string): boolean {
  return pathId === 'warrior' ? isDone(p, 'ql_warrior') : pathId === 'magician' ? isDone(p, 'ql_magician') : false;
}
