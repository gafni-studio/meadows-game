/**
 * Warrior skill questlines (v0.2.1 / B-004).
 * Text, rewards, triggers and gates come from data/skill_quests.json.
 * Step mechanics (reach, collect, talk, kill, dummy hits) are here.
 * Completing The Weight of a Swing and Blood Up grants the skill at rank 1.
 * A Crack in the Dirt and Hot Edge only unlock training at Calden (v0.2.3).
 */
import { DB, tab, descOf } from '../data/db';
import * as P from './Player';
import { Game } from './GameState'
import { playSfx } from './Sfx';

export interface QuestStepRow {
  id: string; line_id: string; step: number; name: string; desc: string; objective: string;
  notes?: string; trigger?: string | null; gate_level?: number | null; gate_stat?: string | null;
  gate_value?: number | null; reward_xp?: number | null; reward_coins?: number | null;
  reward_items?: string | null; unlock_skill?: string | null; giver?: string | null;
}
export interface QuestState { step: number; done: boolean; killed?: boolean; dummyHits?: number }

export type QuestLog = Record<string, QuestState>;

const ROWS = tab<QuestStepRow>('skill_quests');
const LINES = [...new Set(ROWS.map((r) => r.line_id))];

const SKILL_LINE: Record<string, string> = {};
for (const r of ROWS) if (r.unlock_skill) SKILL_LINE[r.unlock_skill] = r.line_id;

/** Materials turned in (consumed) at this step. Keyed by line+step. */
const COLLECT: Record<string, Record<string, number>> = {
  'ql_weight:2': { twig: 4 },
  'ql_crack:3': { pebble: 8, earth_grit: 6 },
  'ql_hot:2': { warm_grain: 6 },
  'ql_hot:3': { live_ember: 1 },
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

/** Place to reach: area and optional x-range in tiles. */
const REACH: Record<string, { area: string; xMin?: number; xMax?: number; nearPost?: boolean }> = {
  'ql_weight:1': { area: 'meadow_town', nearPost: true },
  'ql_blood:2': { area: 'sunny_pasture', xMin: 100, xMax: 130 },
  'ql_crack:2': { area: 'dirt_banks' },
};

const DUMMY: Record<string, number> = { 'ql_weight:3': 3 };

export function rowsOf(line: string): QuestStepRow[] {
  return ROWS.filter((r) => r.line_id === line).sort((a, b) => a.step - b.step);
}
export function row(line: string, step: number): QuestStepRow | undefined {
  return ROWS.find((r) => r.line_id === line && r.step === step);
}
export function lineName(line: string): string { return rowsOf(line)[0]?.name ?? line; }
export function lineOfSkill(skillId: string): string | undefined { return SKILL_LINE[skillId]; }
export function allLines(): string[] { return LINES; }

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

function setState(p: P.PlayerData, line: string, s: QuestState) {
  p.questLog ??= {};
  p.questLog[line] = s;
}

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
  const steps = rowsOf(line);
  const last = steps[steps.length - 1]?.step ?? 1;
  if (s.step >= last) {
    complete(p, line);
    return;
  }
  setState(p, line, { ...s, step: s.step + 1, dummyHits: 0 });
  const nxt = row(line, s.step + 1);
  Game.toast(toastMsg ?? (nxt ? `${lineName(line)}: ${nxt.objective}` : `Quest updated`), 'info');
  Game.events.emit('quest', line);
  Game.changed();
  Game.save();
}

function complete(p: P.PlayerData, line: string): void {
  const s = state(p, line);
  if (s.done) return;
  const last = (rowsOf(line).slice(-1)[0]);
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
  for (const it of items) P.addItem(p, it.id, it.qty);
  const got = [
    skillRewardLabel(line, last),
    xp ? `${xp} XP` : '',
    coins ? `${coins} Copper` : '',
    ...items.map((it) => `${it.qty}× ${DB.items[it.id].name}`),
  ].filter(Boolean).join(', ');
  Game.toast(`Quest complete: ${lineName(line)} — ${got}`, 'rare');
  Game.events.emit('quest', line);
  Game.events.emit('quest-complete', lineName(line), got);
  playSfx('quest');
  Game.changed();
  Game.save();
}

function grantSkill(p: P.PlayerData, id: string) {
  if ((p.skillRanks[id] ?? 0) < 1) p.skillRanks[id] = 1;
  p.skillBar ??= [null, null, null, null, 'meadow_dew', 'clear_dew'];
  while (p.skillBar.length < 6) p.skillBar.push(null);
  if (!p.skillBar.includes(id)) {
    const i = p.skillBar.findIndex((x) => !x);
    if (i >= 0) p.skillBar[i] = id;
  }
}

/** Level-up and load: start any level-triggered lines the player now qualifies for. */
export function onLevel(p: P.PlayerData, silent = false): void {
  for (const line of LINES) {
    const t = rowsOf(line)[0]?.trigger ?? '';
    const m = String(t).match(/^level:(\d+)$/);
    if (m && p.level >= Number(m[1])) start(p, line, silent);
  }
}

/** Pickup or inspect of a quest-start item. */
export function onItem(p: P.PlayerData, itemId: string, silent = false): void {
  for (const line of LINES) {
    const t = rowsOf(line)[0]?.trigger ?? '';
    if (t === `item:${itemId}`) start(p, line, silent);
  }
}

/** E at the practice post: advances The Weight of a Swing step 1. */
export function interactPost(p: P.PlayerData): string | null {
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const s = state(p, line);
    if (line === 'ql_weight' && s.step === 1) {
      advance(p, line, 'The post will do. Collect 4 Twig and take them to Calden.');
      return 'Good. This post can take a real blow. Bring Calden 4 Twig, then come back and hit it properly — F, not a skill.';
    }
  }
  return 'A worn practice post. Come back when your journal (J) asks you to train here.';
}

export function shouldSpawn(p: P.PlayerData, monsterId: string): boolean {
  const k = KILL_LINE[monsterId];
  if (!k) return false;
  const s = state(p, k.line);
  return isActive(p, k.line) && s.step === k.step && !s.killed;
}

export function onKill(p: P.PlayerData, monsterId: string): void {
  const k = KILL_LINE[monsterId];
  if (!k) return;
  const s = state(p, k.line);
  if (!isActive(p, k.line) || s.step !== k.step) return;
  setState(p, k.line, { ...s, killed: true });
  if (monsterId === 'cinderback') {
    P.addItem(p, 'live_ember', 1);
    Game.toast('Live Ember — take it to Calden', 'rare', 'live_ember');
  }
  Game.toast(`${DB.monsters[monsterId]?.name ?? monsterId} falls. Return to Calden.`, 'info');
  Game.changed();
  Game.save();
}

/** Reach-a-place checks. `postNear` is true when the player is at the practice post. */
export function checkPlace(p: P.PlayerData, area: string, xTiles: number, postNear: boolean): void {
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const s = state(p, line);
    const req = REACH[`${line}:${s.step}`];
    if (!req) continue;
    if (req.area !== area) continue;
    if (req.nearPost && !postNear) continue;
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
    if (n >= need) advance(p, line);
    else { Game.changed(); Game.save(); }
  }
}

export function dummyNeeded(p: P.PlayerData): boolean {
  return LINES.some((line) => {
    const s = state(p, line);
    return isActive(p, line) && !!DUMMY[`${line}:${s.step}`];
  });
}

function hasCollect(p: P.PlayerData, need: Record<string, number>): boolean {
  return Object.entries(need).every(([id, n]) => (p.inventory[id] ?? 0) >= n);
}

/** Calden (or another giver) talk. Returns dialog text if the journal should open a dialog instead of the skills window. */
export function talk(p: P.PlayerData, npc: string): string | null {
  // Prefer a step this NPC can actually advance, then a reminder.
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const s = state(p, line);
    const r = row(line, s.step);
    if (!r || (r.giver && r.giver !== npc)) continue;
    const key = `${line}:${s.step}`;

    // Talk-only step (Blood Up 1).
    if (line === 'ql_blood' && s.step === 1) {
      advance(p, line, 'Rage is a bargain — hit harder, get hit harder. Walk to the east pasture.');
      return 'Rage is a bargain. You hit harder, and so does everything that hits you. Walk to the east end of the pasture, near the dirt path. A stubborn sheep is waiting. Stay in the fight.';
    }

    // Gate-checked hand-in (stone / scale).
    if (r.trigger?.startsWith('item:') || (s.step === 1 && (line === 'ql_crack' || line === 'ql_hot'))) {
      const g = gateOk(p, line);
      if (!g.ok) return `I can see what you've brought. ${g.reason}. Come back when you're ready — keep it safe.`;
      advance(p, line);
      if (line === 'ql_crack') return 'This stone wants to break more than itself. The Dirt Banks will finish the lesson. Go east, through the pasture.';
      return 'Still warm. Good. Bring me Warm Grain from the Ember Beetles in the Dirt Banks, then we will talk fire.';
    }

    const need = COLLECT[key];
    if (need) {
      // Hot Edge last step also needs the kill + live ember.
      if (KILL[key] && !s.killed) {
        return `You still have to face ${DB.monsters[KILL[key]]?.name ?? 'the named foe'}. ${r.objective}`;
      }
      if (!hasCollect(p, need)) {
        const miss = Object.entries(need).filter(([id, n]) => (p.inventory[id] ?? 0) < n)
          .map(([id, n]) => `${n}× ${DB.items[id].name}`).join(', ');
        return `Bring me ${miss}. ${r.objective}`;
      }
      for (const [id, n] of Object.entries(need)) P.removeItem(p, id, n);
      if (s.step === (rowsOf(line).slice(-1)[0])!.step) {
        complete(p, line);
        return lastWords(line);
      }
      advance(p, line);
      return 'That will do. ' + (row(line, s.step + 1)?.objective ?? 'See your journal (J) for the next step.');
    }

    if (KILL[key]) {
      if (!s.killed) return `You still have to face ${DB.monsters[KILL[key]]?.name}. ${r.objective}`;
      // Blood Up / Crack last step: kill is enough, then return (no extra item except Hot Edge, handled above).
      if (s.step === (rowsOf(line).slice(-1)[0])!.step) {
        complete(p, line);
        return lastWords(line);
      }
      advance(p, line);
      return 'Well fought. ' + (row(line, s.step + 1)?.objective ?? '');
    }
  }
  return null;
}

/** Lines that grant the skill at rank 1 on complete. Crack / Hot only unlock training. */
const GRANT_RANK = new Set(['ql_weight', 'ql_blood']);

function skillRewardLabel(line: string, last: { unlock_skill?: string | null } | undefined): string {
  if (!last?.unlock_skill) return '';
  const name = DB.skills[last.unlock_skill]?.name ?? last.unlock_skill;
  return GRANT_RANK.has(line) ? `${name} rank 1` : `${name} training`;
}

function lastWords(line: string): string {
  if (line === 'ql_weight') return 'There. That is a real blow. Power Strike is yours — bind it from this window, or with 1–6. Come back when you want to rank it up.';
  if (line === 'ql_blood') return 'You stayed in it. Rage is yours. Remember the other half of the bargain.';
  if (line === 'ql_crack') return 'The ground answered. Earthbreaker training is open — come back to Calden with Nature Essence when you want to learn it.';
  if (line === 'ql_hot') return 'A clean, hot edge. Flame Cleave training is open — Elemental Essence will teach it.';
  return `${lineName(line)} is done.`;
}

/** True if talking to this NPC should open a quest dialog (instead of, or before, their usual window). */
export function wantsTalk(p: P.PlayerData, npc: string): boolean {
  return LINES.some((line) => {
    if (!isActive(p, line)) return false;
    const s = state(p, line);
    const r = row(line, s.step);
    if (!r || (r.giver && r.giver !== npc)) return false;
    const key = `${line}:${s.step}`;
    if (line === 'ql_blood' && s.step === 1) return true;
    if (s.step === 1 && (line === 'ql_crack' || line === 'ql_hot')) return true;
    if (COLLECT[key] || KILL[key]) return true;
    return false;
  });
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
    if (r) out.push({ line, name: r.name, objective: r.objective });
  }
  return out;
}

export interface JournalEntry {
  line: string; name: string; desc: string; status: 'active' | 'done' | 'soon';
  step: number; steps: { n: number; objective: string; current: boolean; done: boolean }[];
  rewards?: string; skill?: string;
}
export function journal(p: P.PlayerData): JournalEntry[] {
  onLevel(p, true); // catch a save already past a start level (no toast on open)
  const out: JournalEntry[] = [];
  for (const line of LINES) {
    const steps = rowsOf(line);
    const head = steps[0];
    if (!head) continue;
    const s = state(p, line);
    let status: JournalEntry['status'] = 'soon';
    if (s.done) status = 'done';
    else if (s.step >= 1) status = 'active';
    else {
      // Tease level-start lines; keep drop-start lines quiet until found.
      const t = String(head.trigger ?? '');
      if (t.startsWith('level:')) status = 'soon';
      else continue;
    }
    const last = (steps.slice(-1)[0]);
    const rewards = [
      skillRewardLabel(line, last),
      last?.reward_xp ? `${last.reward_xp} XP` : '',
      last?.reward_coins ? `${last.reward_coins} Copper` : '',
      ...parseItems(last?.reward_items).map((it) => `${it.qty}× ${DB.items[it.id].name}`),
    ].filter(Boolean).join(' · ');
    out.push({
      line, name: head.name, desc: descOf(head) || head.desc,
      status, step: s.step,
      steps: steps.map((r) => ({
        n: r.step, objective: r.objective,
        current: !s.done && r.step === s.step,
        done: s.done || r.step < s.step,
      })),
      rewards, skill: last?.unlock_skill ?? undefined,
    });
  }
  const order = { active: 0, soon: 1, done: 2 };
  return out.sort((a, b) => order[a.status] - order[b.status]);
}

/** Old saves had basic skills known at rank 0. Mark those questlines done and grant rank 1. */
export function migrateQuests(p: P.PlayerData): void {
  p.questLog ??= {};
  const had = (id: string) => Object.prototype.hasOwnProperty.call(p.skillRanks ?? {}, id);
  for (const [skill, line] of Object.entries(SKILL_LINE)) {
    if (p.questLog[line]) continue;
    if (!had(skill)) continue;
    // They already had the skill (even at rank 0). Close the line and make sure it's usable.
    if ((p.skillRanks[skill] ?? 0) < 1) p.skillRanks[skill] = 1;
    p.questLog[line] = { step: (rowsOf(line).slice(-1)[0])?.step ?? 1, done: true };
  }
  onLevel(p, true);
  // Already-held quest items (e.g. a Cracked Bank Stone from before this update) start their line.
  for (const [id, n] of Object.entries(p.inventory ?? {})) {
    if ((n ?? 0) > 0) onItem(p, id, true);
  }
}

/** Mark a line done without rewards (used when a cheat already granted the skill). */
export function markDone(p: P.PlayerData, line: string): void {
  p.questLog ??= {};
  if (p.questLog[line]?.done) return;
  const last = (rowsOf(line).slice(-1)[0])?.step ?? 1;
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
