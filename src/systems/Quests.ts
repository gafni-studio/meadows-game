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
import { isGear, makeGear } from './Gear';
import { autoBind, barOf } from './Bar';

export interface QuestStepRow {
  id: string; line_id: string; step: number; name: string; desc: string; objective: string;
  notes?: string; trigger?: string | null; gate_level?: number | null; gate_stat?: string | null;
  gate_value?: number | null; reward_xp?: number | null; reward_coins?: number | null;
  reward_items?: string | null; unlock_skill?: string | null; giver?: string | null;
}
export interface QuestState { step: number; done: boolean; killed?: boolean; dummyHits?: number; kills?: Record<string, number> }

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
  'ql_quiet_work:2': { twig: 8, bark: 4 },
  'ql_warm_coat:2': { wool: 8, fur: 6 },
  'ql_dirt_keeps:2': { earth_grit: 8, stone_chunk: 4 },
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
  'ql_dirt_path:2': { crow: 4 },
  'ql_dirt_path:4': { burrow_mole: 5, ember_beetle: 3 },
};

function huntDone(need: Record<string, number>, kills: Record<string, number> | undefined): boolean {
  return Object.entries(need).every(([id, n]) => (kills?.[id] ?? 0) >= n);
}

function huntLabel(need: Record<string, number>, kills: Record<string, number> | undefined): string {
  return Object.entries(need).map(([id, n]) => {
    const have = Math.min(kills?.[id] ?? 0, n);
    return `${DB.monsters[id]?.name ?? id} ${have}/${n}`;
  }).join(', ');
}

/** Place to reach: area and optional x-range in tiles. */
const REACH: Record<string, { area: string; xMin?: number; xMax?: number; nearPost?: boolean }> = {
  'ql_weight:1': { area: 'meadow_town', nearPost: true },
  'ql_blood:2': { area: 'sunny_pasture', xMin: 100, xMax: 130 },
  'ql_crack:2': { area: 'dirt_banks' },
  'ql_dirt_path:3': { area: 'dirt_banks' },
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
      itemRows.push(`${it.qty}× ${DB.items[it.id].name}`);
    }
  }
  const got = [
    skillRewardLabel(line, last),
    xp ? `${xp} XP` : '',
    coins ? `${coins} Copper` : '',
    ...items.map((it) => `${it.qty}× ${DB.items[it.id].name}`),
  ].filter(Boolean).join(', ');
  Game.toast(`Quest complete: ${lineName(line)} — ${got}`, 'rare');
  Game.events.emit('quest', line);
  Game.events.emit('quest-complete', lineName(line), got);
  // v0.2.6: a dedicated rewards screen (XP, Copper, each item with gear stats, skill rank / training).
  const doneLines = TALK[`${line}:${last?.step}:done`];
  const skillName = last?.unlock_skill ? (DB.skills[last.unlock_skill]?.name ?? last.unlock_skill) : '';
  const rows = [
    skillName ? (GRANT_RANK.has(line) ? `${skillName} rank 1` : `${skillName} training is now open`) : '',
    xp ? `${xp} XP` : '',
    coins ? `${coins} Copper` : '',
    ...itemRows,
  ].filter(Boolean);
  // Order: XP, Copper, items, then the skill line (spec order), so move the skill row to the end.
  if (skillName) rows.push(rows.shift()!);
  Game.events.emit('quest-rewards', { name: lineName(line), flavor: doneLines?.length ? doneLines[doneLines.length - 1] : lastWords(line), rows });
  playSfx('quest');
  offerFollowups(p, false);
  Game.changed();
  Game.save();
}

function grantSkill(p: P.PlayerData, id: string) {
  if ((p.skillRanks[id] ?? 0) < 1) p.skillRanks[id] = 1;
  autoBind(barOf(p), id);
}

/** Level-up and load: start any level-triggered lines the player now qualifies for. */
export function onLevel(p: P.PlayerData, silent = false): void {
  for (const line of LINES) {
    const trig = rowsOf(line)[0]?.trigger ?? '';
    const m = String(trig).match(/^level:(\d+)$/);
    if (m && p.level >= Number(m[1])) start(p, line, silent);
  }
  offerDirtPath(p, silent);
  offerFollowups(p, silent);
}

/** Start lines whose trigger is `quest:<other>` once that other line is done. */
function offerFollowups(p: P.PlayerData, silent = false): void {
  for (const line of LINES) {
    const trig = String(rowsOf(line)[0]?.trigger ?? '');
    const m = trig.match(/^quest:(.+)$/);
    if (m && isDone(p, m[1])) start(p, line, silent);
  }
}

/** True once the last starter lesson is done: a first passive point spent, or the stub flag. */
export function hasDirtPathPrereq(p: P.PlayerData): boolean {
  if (p.questFlags?.sq_first_passive) return true;
  if (p.passiveUpgrade) return true;
  return Object.values(p.passiveRanks ?? {}).some((r) => (r ?? 0) >= 1);
}

/** Call after a first passive point is spent (or on load) to discover The Dirt Path. */
export function offerDirtPath(p: P.PlayerData, silent = false): void {
  if (!hasDirtPathPrereq(p)) return;
  p.questFlags ??= {};
  p.questFlags.sq_first_passive = true;
  start(p, 'ql_dirt_path', silent);
}

/** The Paths window (K) was opened: step 2 of Calden's tutorial. */
export function onTreeOpen(p: P.PlayerData): void {
  const s = state(p, 'ql_paths');
  if (isActive(p, 'ql_paths') && s.step === 2) advance(p, 'ql_paths', 'Train Power Strike to rank 2 in the tree (select it, Enter).');
  checkPaths(p);
}
/** Step 3 of the tutorial: Power Strike at rank 2. Called on training and on opening the tree. */
export function checkPaths(p: P.PlayerData): void {
  const s = state(p, 'ql_paths');
  if (isActive(p, 'ql_paths') && s.step === 3 && (p.skillRanks.power_strike ?? 0) >= 2) advance(p, 'ql_paths', 'Rank two. Return to Calden.');
}

export function onPassive(p: P.PlayerData): void {
  offerDirtPath(p, false);
}

/** Pickup or inspect of a quest-start item. */
export function onItem(p: P.PlayerData, itemId: string, silent = false): void {
  if (itemId === 'smoldering_scale') { p.questFlags ??= {}; p.questFlags.scale_seen = true; } // the level-6 guarantee is once per character
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
  if (!isActive(p, k.line) || s.killed) return false;
  // Bank-Cracker is present from the moment you enter the Banks on A Crack in the Dirt
  // (step 2 Reach, step 3 collect, step 4 the formal hunt) so the named foe is actually visible.
  // Cinderback (v0.2.6) is the same: out in the Banks from the moment Hot Edge reaches the grain step.
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
      const who = k.line === 'ql_blood' || k.line === 'ql_crack' || k.line === 'ql_hot' ? 'Calden' : 'town';
      if (s.step === k.step) Game.toast(`${DB.monsters[monsterId]?.name ?? monsterId} falls. Return to ${who}.`, 'info');
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
      const last = (rowsOf(line).slice(-1)[0])?.step;
      if (s.step === last) {
        const who = row(line, s.step)?.giver === 'pell' ? 'Pell' : 'Calden';
        Game.toast(`Return to ${who}.`, 'info');
        Game.changed();
        Game.save();
      } else {
        advance(p, line, line === 'ql_dirt_path' ? 'The path into the Dirt Banks is open. Follow it east.' : undefined);
      }
    } else {
      Game.toast(huntLabel(need, kills), 'info');
      Game.changed();
      Game.save();
    }
  }
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
export interface TalkResult {
  speaker: string;
  pages: string[];
  onFinish?: () => void;
}

function speakerOf(npc: string): string {
  return DB.npcs[npc]?.name ?? npc;
}

function say(npc: string, pages: string[], onFinish?: () => void): TalkResult {
  return { speaker: speakerOf(npc), pages, onFinish };
}

/** Short, spoken lines. One thought per page. Enter or click advances. */
const TALK: Record<string, string[]> = {
  // Calden — gruff, patient, a real blow matters.
  'ql_weight:2:ok': [
    'Twigs. Good. You went and got them, you didn’t wave at the grass.',
    'Now come back to the post and hit it properly. F. Not a skill. A real blow.',
  ],
  'ql_weight:2:wait': [],
  'ql_weight:3:done': [
    'There. That is a real blow.',
    'Power Strike is yours. Bind it from this window, or with 1–6.',
    'Come back when you want to rank it up. Ila, over by the bench — she has slower work, if you’ve the patience.',
  ],
  'ql_blood:1:ok': [
    'Rage is a bargain.',
    'You hit harder. So does everything that hits you.',
    'Walk to the east end of the pasture, near the dirt path. A stubborn sheep is waiting. Stay in the fight.',
  ],
  'ql_blood:3:wait': [
    'The sheep is still out there. East pasture, near the path. Don’t come back until you’ve stood in it.',
  ],
  'ql_blood:3:done': [
    'You stayed in it.',
    'Rage is yours. Remember the other half of the bargain.',
  ],
  'ql_crack:1:ok': [
    'This stone wants to break more than itself.',
    'The Dirt Banks will finish the lesson. Go east, through the pasture, and take the dirt path.',
    'A thing lives in those banks that splits the earth with its shoulders. You will know it when it stands up.',
  ],
  'ql_crack:1:gate': [
    'I can see what you’ve brought. You’re not ready to finish this yet.',
    'Keep the stone safe. Come back when you’re stronger.',
  ],
  'ql_crack:3:ok': [
    'Pebble and grit. The banks gave them up.',
    'Now the named one. Bank-Cracker. It is already in the dirt, if you walked there once.',
    'Put it down, and come back to me.',
  ],
  'ql_crack:3:wait': [],
  'ql_crack:4:wait': [
    'Bank-Cracker is still in the banks. Look for the pale, heavy one — bigger than a mole, the color of cracked stone.',
  ],
  'ql_crack:4:done': [
    'The ground answered.',
    'Earthbreaker training is open. Come back with Nature Essence, Earth Shard, and Clay when you want to learn it.',
  ],
  'ql_hot:0:start': [
    'Level six. You are stirring the dirt now.',
    'Fire wants a spark first. Bring me a Smoldering Scale from the Ember Beetles in the Dirt Banks.',
    'And ten STR in your arm, or it will burn you worse than the beetle.',
  ],
  'ql_hot:1:need': [
    'No scale yet. The Ember Beetles in the Dirt Banks carry them.',
    'Bring me one, and bring a strong arm to hold it.',
  ],
  'ql_hot:1:ok': [
    'Still warm. Good.',
    'Bring me Warm Grain from the Ember Beetles in the Dirt Banks. Then we will talk fire.',
  ],
  'ql_hot:1:gate': [
    'I can feel the heat on that scale. You’re not ready for the rest of it.',
    'Keep it. Come back when your arm can carry the lesson.',
  ],
  'ql_hot:2:ok': [
    'Warm grain, still smelling of the beetle.',
    'Cinderback is next. In the eastern banks, where the dirt holds a little fire. Bring me its Live Ember.',
  ],
  'ql_hot:2:wait': [],
  'ql_hot:3:wait': [
    'Cinderback first. The ember comes off its shell. Don’t lose it on the walk back.',
  ],
  'ql_hot:3:done': [
    'A clean, hot edge.',
    'Flame Cleave training is open. Elemental Essence will teach it.',
  ],

  // Calden — the Paths tutorial (v0.2.7).
  'ql_paths:1:ok': [
    'A Hero is not one thing. A Hero walks Paths.',
    'A Path is a tree of skills. You walk the Warrior Path: Power Strike at the root, and branches that grow from it.',
    'Every skill has a family. Basic, Nature, Elemental. A family’s essence pays for its skills: Nature Essence for Nature, Elemental Essence for Elemental.',
    'You need the skill before it in the chain, at least rank one, before you can learn the next. Earthbreaker follows Power Strike. Root Lash and Flame Cleave follow Earthbreaker.',
    'The slow work is Ila’s: passives. Roots in the dirt that yield while you are away. Ask her.',
    'Take these. Essence, scrolls, clay, a little copper. Press K and look at the Warrior Path.',
  ],
  'ql_paths:2:wait': [
    'Press K. Look at the Warrior Path: what you have, what is locked, what you can reach.',
  ],
  'ql_paths:3:wait': [
    'Train Power Strike to rank two. Select it in the tree and press Enter. Keep it in an attack slot, 1 to 4.',
  ],
  'ql_paths:4:done': [
    'Rank two. You felt that.',
    'The tree is yours. Locked only means not yet. Learn the skill before it, gather the essence, and it opens.',
    'Go on. Ila has the slow work, and the pasture has teeth.',
  ],

  // Pell — warm, folksy, knows the paths.
  'ql_dirt_path:1:ok': [
    'You look like you’ve set something growing. Good.',
    'The dirt path at the far east of the pasture goes on to the banks.',
    'Clear the crows that keep it — four of them — then walk through.',
    'Hunt the moles, and the warm beetles. Come back when you have.',
  ],
  'ql_dirt_path:4:wait': [
    'Still short of a proper first hunt. Moles and the warm beetles. The banks will wait.',
  ],
  'ql_dirt_path:4:done': [
    'The banks are yours to hunt.',
    'Root and stone, and a little warmth — bring what you find back to town.',
    'I may have another question for the dirt, later. For now, walk it as you like.',
  ],
  'ql_dirt_keeps:1:ok': [
    'You’ve walked the banks once. Good. They keep things, under the loose earth.',
    'Bring me eight pinches of Earth Grit, and four honest Stone Chunks.',
    'I want to feel what the place is holding. Then I have something for your hand.',
  ],
  'ql_dirt_keeps:2:wait': [],
  'ql_dirt_keeps:2:done': [
    'Grit and stone. That’s the banks, all right.',
    'This club came out of packed dirt and a stubborn idea. It should sit well in a warrior’s hand.',
    'If it asks for more strength than you have today, keep it. The banks aren’t going anywhere.',
  ],

  // Ila — quiet, growing-things metaphors.
  'ql_quiet_work:1:ok': [
    'You have a swing now. That’s the loud work.',
    'There is slower work, too. Roots, underfoot. They grow while you walk, and while you sleep.',
    'Bring me eight Twigs and four strips of Bark. Pasture cuttings. Then I’ll show you the tree.',
  ],
  'ql_quiet_work:2:wait': [],
  'ql_quiet_work:2:ok': [
    'These will do.',
    'Here. Nature Essence, pebble, bark, and a little copper — enough to set a first rank going.',
    'Press T. Look at Nature Essence. Start the upgrade. It takes a little time. That’s the point.',
    'Come back to me when you’ve set it.',
  ],
  'ql_quiet_work:3:wait': [
    'The tree is T. Nature Essence, first rank. I’ve given you what it costs. Set it going, then come back.',
  ],
  'ql_quiet_work:3:done': [
    'There. A root is in the dirt.',
    'It will yield while you hunt, and while you’re away. One upgrade at a time — don’t rush the second.',
    'When you’re ready for a path, talk to Pell at the east gate. He has a walk that wants walking.',
  ],

  // Mara — practical, wry, talks useful things.
  'ql_warm_coat:1:ok': [
    'You look like you’ll be out in the pasture a while.',
    'Bring me eight Wool and six Fur. Sheep and mice. I don’t need a whole flock — just enough to cut a vest.',
    'I’ll see you paid in more than copper.',
  ],
  'ql_warm_coat:2:wait': [],
  'ql_warm_coat:2:done': [
    'This will keep a blow off your ribs. Not a knight’s coat. A good one.',
    'A few berries for the road. If you want to sell me junk, the shop is still here.',
  ],
};

/** v0.2.6: exactly the new Nature production rank-1 recipe (Nature Essence 20, Pebble 16, Bark 12, Copper 18). */
const ILA_KIT: [string, number][] = [
  ['nature_essence', 20], ['pebble', 16], ['bark', 12],
];
const ILA_KIT_COPPER = 18;
/** v0.2.7: Calden's tutorial kit = the Power Strike rank 2 recipe (Monster Essence 24, Training Scroll 10, Clay 16, Copper 25). */
const PATHS_KIT: [string, number][] = [['monster_essence', 24], ['training_scroll', 10], ['clay', 16]];
const PATHS_KIT_COPPER = 25;

function waitPages(line: string, step: number, fallback: string): string[] {
  return TALK[`${line}:${step}:wait`]?.length ? TALK[`${line}:${step}:wait`] : [fallback];
}

/** Calden (or another giver) talk. Multi-line; the step advances when the last page is closed. */
export function talk(p: P.PlayerData, npc: string): TalkResult | null {
  // v0.2.6: Calden starts Hot Edge at level 6 even if the player has never seen a scale.
  if (npc === 'calden' && hotStartable(p) && markerFor(p, npc) !== '?') {
    const hasScale = (p.inventory.smoldering_scale ?? 0) > 0;
    const ready = hasScale && gateOk(p, 'ql_hot').ok;
    const pages = [...TALK['ql_hot:0:start']];
    if (ready) pages.push(...TALK['ql_hot:1:ok']);
    else if (hasScale) pages.push(...TALK['ql_hot:1:gate']); // not ready: he looks at it and keeps nothing
    return say(npc, pages, () => {
      start(p, 'ql_hot');
      if (ready) { P.removeItem(p, 'smoldering_scale', 1); advance(p, 'ql_hot'); }
    });
  }
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const s = state(p, line);
    const r = row(line, s.step);
    if (!r || (r.giver && r.giver !== npc)) continue;
    const key = `${line}:${s.step}`;
    const last = (rowsOf(line).slice(-1)[0])!.step;

    // Talk-only first steps.
    if (line === 'ql_paths' && s.step > 1) {
      if (s.step === 4) return say(npc, TALK['ql_paths:4:done'], () => complete(p, line));
      return say(npc, TALK[`ql_paths:${s.step}:wait`]);
    }
    if ((line === 'ql_dirt_path' || line === 'ql_blood' || line === 'ql_quiet_work'
      || line === 'ql_warm_coat' || line === 'ql_dirt_keeps' || line === 'ql_paths') && s.step === 1) {
      return say(npc, TALK[`${line}:1:ok`] ?? [r.objective], () => {
        if (line === 'ql_paths') {
          // the exact Power Strike rank 2 recipe, so the tutorial can be finished
          for (const [id, n] of PATHS_KIT) P.addItem(p, id, n);
          p.coins += PATHS_KIT_COPPER;
          Game.toast('Calden hands you the materials for Power Strike rank 2', 'rare');
        }
        const toast = line === 'ql_paths' ? 'Press K and look at the Warrior Path.' : line === 'ql_dirt_path' ? 'Defeat 4 Crows at the east end of Sunny Pasture.'
          : line === 'ql_blood' ? 'Rage is a bargain — hit harder, get hit harder. Walk to the east pasture.'
          : undefined;
        advance(p, line, toast);
      });
    }

    const hunt = HUNT[key];
    if (hunt && r.giver === npc) {
      if (!huntDone(hunt, s.kills)) {
        return say(npc, waitPages(line, s.step, `Still short. ${huntLabel(hunt, s.kills)}. ${r.objective}`));
      }
      if (s.step === last) {
        return say(npc, TALK[`${line}:${s.step}:done`] ?? [lastWords(line)], () => complete(p, line));
      }
      return say(npc, TALK[`${line}:${s.step}:ok`] ?? ['That will do.'], () => advance(p, line));
    }

    if (r.trigger?.startsWith('item:') || (s.step === 1 && (line === 'ql_crack' || line === 'ql_hot'))) {
      const g = gateOk(p, line);
      if (line === 'ql_hot') {
        if ((p.inventory.smoldering_scale ?? 0) < 1) return say(npc, TALK['ql_hot:1:need']);
        if (!g.ok) return say(npc, TALK['ql_hot:1:gate']);
        return say(npc, TALK['ql_hot:1:ok'], () => { P.removeItem(p, 'smoldering_scale', 1); advance(p, line); });
      }
      if (!g.ok) return say(npc, TALK[`${line}:1:gate`] ?? [`I can see what you've brought. ${g.reason}. Come back when you're ready — keep it safe.`]);
      return say(npc, TALK[`${line}:1:ok`] ?? [r.objective], () => advance(p, line));
    }

    const need = COLLECT[key];
    if (need) {
      if (KILL[key] && !s.killed) {
        return say(npc, waitPages(line, s.step, `You still have to face ${DB.monsters[KILL[key]]?.name ?? 'the named foe'}. ${r.objective}`));
      }
      if (!hasCollect(p, need)) {
        const miss = Object.entries(need).filter(([id, n]) => (p.inventory[id] ?? 0) < n)
          .map(([id, n]) => `${n}× ${DB.items[id].name}`).join(', ');
        const baked = TALK[`${line}:${s.step}:wait`];
        return say(npc, baked?.length ? baked : [`Bring me ${miss}. ${r.objective}`]);
      }
      const finish = () => {
        for (const [id, n] of Object.entries(need)) P.removeItem(p, id, n);
        if (line === 'ql_quiet_work' && s.step === 2) {
          for (const [id, n] of ILA_KIT) P.addItem(p, id, n);
          p.coins += ILA_KIT_COPPER;
          Game.toast('Ila’s kit — enough for a first rank', 'rare');
        }
        if (s.step === last) complete(p, line);
        else advance(p, line);
      };
      if (s.step === last) return say(npc, TALK[`${line}:${s.step}:done`] ?? [lastWords(line)], finish);
      return say(npc, TALK[`${line}:${s.step}:ok`] ?? ['That will do.'], finish);
    }

    if (KILL[key]) {
      if (!s.killed) return say(npc, waitPages(line, s.step, `You still have to face ${DB.monsters[KILL[key]]?.name}. ${r.objective}`));
      if (s.step === last) return say(npc, TALK[`${line}:${s.step}:done`] ?? [lastWords(line)], () => complete(p, line));
      return say(npc, TALK[`${line}:${s.step}:ok`] ?? ['Well fought.'], () => advance(p, line));
    }

    // Quiet Work last step: spend a first point, then talk.
    if (line === 'ql_quiet_work' && s.step === 3) {
      if (!hasDirtPathPrereq(p)) return say(npc, TALK['ql_quiet_work:3:wait']);
      return say(npc, TALK['ql_quiet_work:3:done'], () => complete(p, line));
    }
  }
  return null;
}

/** A few lore lines when Pell (or another hint NPC) is spoken to with no quest to advance. */
export function greeting(npc: string): TalkResult | null {
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

/** Lines that grant the skill at rank 1 on complete. Crack / Hot only unlock training. */
const GRANT_RANK = new Set(['ql_weight', 'ql_blood']);

function skillRewardLabel(line: string, last: { unlock_skill?: string | null } | undefined): string {
  if (!last?.unlock_skill) return '';
  const name = DB.skills[last.unlock_skill]?.name ?? last.unlock_skill;
  return GRANT_RANK.has(line) ? `${name} rank 1` : `${name} training`;
}

function lastWords(line: string): string {
  const done = TALK[`${line}:${(rowsOf(line).slice(-1)[0])?.step}:done`];
  if (done?.length) return done[done.length - 1]!;
  return `${lineName(line)} is done.`;
}

/** True if talking to this NPC should open a quest dialog (instead of, or before, their usual window). */
export function wantsTalk(p: P.PlayerData, npc: string): boolean {
  if (npc === 'calden' && hotStartable(p)) return true;
  return LINES.some((line) => {
    if (!isActive(p, line)) return false;
    const s = state(p, line);
    const r = row(line, s.step);
    if (!r || (r.giver && r.giver !== npc)) return false;
    const key = `${line}:${s.step}`;
    if (s.step === 1) return true; // every line’s opener is a talk
    if (line === 'ql_paths') return true; // steps 2-4: a reminder, or the turn-in
    const hunt = HUNT[key];
    if (hunt && huntDone(hunt, s.kills) && r.giver === npc) return true;
    if (hunt && r.giver === npc) return true; // reminder
    if (COLLECT[key] || KILL[key]) return true;
    if (line === 'ql_quiet_work' && s.step === 3) return true;
    return false;
  });
}

/** Hot Edge can be started by talking to Calden at level 6, scale or not. */
export function hotStartable(p: P.PlayerData): boolean {
  return p.level >= 6 && !isDone(p, 'ql_hot') && state(p, 'ql_hot').step === 0 && !!rowsOf('ql_hot').length;
}

/** Lines whose first step is "talk to the giver" (the opening conversation). */
const TALK_OPENERS = new Set(['ql_dirt_path', 'ql_blood', 'ql_quiet_work', 'ql_warm_coat', 'ql_dirt_keeps', 'ql_paths']);

/**
 * v0.2.6 marker above a quest NPC: `!` a quest is available (or its opening talk is waiting),
 * `?` a turn-in is ready. `?` wins. Nothing while a step is still in progress or a gate is unmet.
 */
export function markerFor(p: P.PlayerData, npc: string): '!' | '?' | null {
  let avail = false;
  for (const line of LINES) {
    if (!isActive(p, line)) continue;
    const s = state(p, line);
    const r = row(line, s.step);
    if (!r || (r.giver && r.giver !== npc)) continue;
    const key = `${line}:${s.step}`;
    const last = rowsOf(line).slice(-1)[0]!.step;
    if (TALK_OPENERS.has(line) && s.step === 1) { avail = true; continue; }
    if (line === 'ql_paths') { if (s.step === 4) return '?'; continue; } // steps 2-3 are on the player
    if (s.step === 1 && (line === 'ql_crack' || line === 'ql_hot')) {
      const scaleOk = line !== 'ql_hot' || (p.inventory.smoldering_scale ?? 0) > 0;
      if (gateOk(p, line).ok && scaleOk) return '?';
      continue;
    }
    const hunt = HUNT[key];
    if (hunt) { if (huntDone(hunt, s.kills) && s.step === last) return '?'; continue; }
    const need = COLLECT[key];
    if (need) { if ((!KILL[key] || s.killed) && hasCollect(p, need)) return '?'; continue; }
    if (KILL[key]) { if (s.killed) return '?'; continue; }
    if (line === 'ql_quiet_work' && s.step === 3 && hasDirtPathPrereq(p)) return '?';
  }
  if (npc === 'calden' && hotStartable(p)) avail = true;
  return avail ? '!' : null;
}

/** `Twig 3/8 · Bark 0/4` for a collect step (capped at the requirement); '' if the step has no items. */
export function collectLabel(p: P.PlayerData, need: Record<string, number>): string {
  return Object.entries(need).map(([id, n]) => `${DB.items[id]?.name ?? id} ${Math.min(p.inventory[id] ?? 0, n)}/${n}`).join(' · ');
}

/** Live progress for the current step of a line: hunt kills, or items in the bag. */
export function progressOf(p: P.PlayerData, line: string, step: number): string {
  const s = state(p, line);
  const key = `${line}:${step}`;
  const hunt = HUNT[key];
  if (hunt) return huntLabel(hunt, s.kills);
  const need = COLLECT[key];
  if (need) return collectLabel(p, need);
  return '';
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
    if (r) {
      const s = state(p, line);
      const prog = progressOf(p, line, s.step);
      const obj = prog ? `${r.objective} (${prog})` : r.objective;
      out.push({ line, name: r.name, objective: obj });
    }
  }
  return out;
}

export interface JournalEntry {
  line: string; name: string; desc: string; status: 'active' | 'done' | 'soon';
  step: number; steps: { n: number; objective: string; current: boolean; done: boolean; progress?: string }[];
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
      const trig = String(head.trigger ?? '');
      if (trig.startsWith('level:')) status = 'soon';
      else if (trig.startsWith('passive:') && hasDirtPathPrereq(p)) status = 'soon';
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
        progress: !s.done && r.step === s.step ? progressOf(p, line, r.step) || undefined : undefined,
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
