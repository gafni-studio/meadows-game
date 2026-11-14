/**
 * Data invariants: the design rules every release must keep. Pure JSON checks — no game code runs.
 * Update a rule here only when a spec changes it.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { DB, tab } from '../src/data/db';

const drops = DB.drops;
const skillCosts = tab<{ skill_id: string; rank: number; material_id: string; quantity: number }>('skill_costs');
const passiveCosts = tab<{ node_id: string; rank: number; material_id: string; quantity: number }>('passive_costs');
const quests = tab<{ id: string; line_id: string; step: number; giver: string | null; reward_items: string | null }>('skill_quests');
const dialogue = tab<{ key: string; lines: string[] }>('quest_dialogue');

const LIVE_SKILLS = Object.values(DB.skills).filter((s) => s.path_id).map((s) => s.id);
const LIVE_NODES = ['nature_prod', 'nature_eff_drops', 'elemental_prod', 'elemental_eff_drops'];

describe('recipes (v0.2.6 rules)', () => {
  const check = (rows: { rank: number; material_id: string; quantity: number }[], id: string) => {
    for (let rk = 1; rk <= 10; rk++) {
      const r = rows.filter((x) => x.rank === rk);
      expect(r.some((x) => x.material_id === 'copper_coin'), `${id} rank ${rk} has a recipe`).toBe(true);
      for (const x of r) {
        expect(x.quantity, `${id} r${rk} ${x.material_id}`).toBeLessThanOrEqual(40);
        expect(['heartwood', 'log'], `${id} r${rk}`).not.toContain(x.material_id);
        expect(DB.items[x.material_id], `${id} r${rk} unknown item ${x.material_id}`).toBeTruthy();
      }
    }
  };
  it('every live path skill has an explicit recipe at ranks 1-10, 10-40 per material', () => {
    for (const id of LIVE_SKILLS) check(skillCosts.filter((r) => r.skill_id === id), id);
  });
  it('every live passive node too', () => {
    for (const id of LIVE_NODES) check(passiveCosts.filter((r) => r.node_id === id), id);
  });
});

describe('drops (v0.2.9 rules)', () => {
  it('nothing but Copper drops more than 3 from one kill', () => {
    const over = drops.filter((d) => d.item_id !== 'copper_coin' && (d.max_qty > 3 || d.min_qty > 3));
    expect(over.map((d) => `${d.monster_id}:${d.item_id}`)).toEqual([]);
  });
  it('every drop row names a real item and a real monster, with a sane chance', () => {
    for (const d of drops) {
      expect(DB.items[d.item_id], d.item_id).toBeTruthy();
      expect(DB.monsters[d.monster_id], d.monster_id).toBeTruthy();
      expect(d.drop_rate).toBeGreaterThan(0);
      expect(d.drop_rate).toBeLessThanOrEqual(100);
      expect(d.min_qty).toBeLessThanOrEqual(d.max_qty);
    }
  });
  it('removed junk stays removed', () => {
    const junk = ['broken_twig', 'torn_cloth', 'lost_button', 'pasture_bell', 'cracked_shell'];
    expect(drops.filter((d) => junk.includes(d.item_id))).toEqual([]);
  });
});

describe('skills and paths', () => {
  it('every path skill follows a skill on the same path (or is the root)', () => {
    for (const s of Object.values(DB.skills).filter((x) => x.path_id)) {
      if (!s.prev_skill_id) continue;
      expect(DB.skills[s.prev_skill_id]?.path_id, `${s.id} follows ${s.prev_skill_id}`).toBe(s.path_id);
    }
  });
  it('each path has exactly one root', () => {
    for (const path of tab<{ id: string }>('paths')) {
      const roots = Object.values(DB.skills).filter((s) => s.path_id === path.id && !s.prev_skill_id);
      expect(roots.map((r) => r.id), path.id).toHaveLength(1);
    }
  });
});

describe('quests and dialogue', () => {
  it('every quest row belongs to a line, and steps run 1..n', () => {
    const lines = [...new Set(quests.map((q) => q.line_id))];
    for (const l of lines) {
      const steps = quests.filter((q) => q.line_id === l).map((q) => q.step).sort((a, b) => a - b);
      expect(steps, l).toEqual(steps.map((_, i) => i + 1));
    }
    for (const q of quests) expect(q.line_id, q.id).toBeTruthy();
  });
  it('every dialogue key points at a real line and step, and has 1-6 short pages', () => {
    const steps = new Set(quests.map((q) => `${q.line_id}:${q.step}`));
    for (const d of dialogue) {
      const [line, st] = d.key.split(':');
      expect(st === '0' || steps.has(`${line}:${st}`), `dialogue ${d.key} has no quest step`).toBe(true);
      expect(d.lines.length, d.key).toBeGreaterThan(0);
      expect(d.lines.length, d.key).toBeLessThanOrEqual(6);
      for (const l of d.lines) expect(l.length, `${d.key}: "${l}"`).toBeLessThan(170);
    }
  });
  it('quest givers are real NPCs (or the storage chest)', () => {
    for (const q of quests) if (q.giver) expect(q.giver === 'chest' || !!DB.npcs[q.giver], `${q.id} giver ${q.giver}`).toBe(true);
  });
  it('reward items exist', () => {
    for (const q of quests) for (const part of String(q.reward_items ?? '').split(/[;,]/).filter((x) => x.trim())) {
      const id = part.trim().replace(/\s*x\d+$/, '');
      expect(DB.items[id], `${q.id} reward ${id}`).toBeTruthy();
    }
  });
});

describe('art exists for what the data references', () => {
  it('every item has an icon', () => {
    const missing = Object.keys(DB.items).filter((id) => !existsSync(`public/art/icons/${id}.png`));
    expect(missing).toEqual([]);
  });
  it('every path skill has an icon, every NPC a sprite', () => {
    for (const id of LIVE_SKILLS) expect(existsSync(`public/art/icons/skill_${id}.png`), id).toBe(true);
    for (const id of Object.keys(DB.npcs)) expect(existsSync(`public/art/chars/npc_${id}.png`), id).toBe(true);
  });
});
