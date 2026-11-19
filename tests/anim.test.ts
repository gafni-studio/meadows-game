// Animation Studio format: rigs/<asset>/rig.json + animations/<asset>.json.
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { solve, solveIk, chainEnd, bendOf, drawOrder, type RigDef } from '../src/anim/rig';
import { sample, clipLength, type Clip } from '../src/anim/clip';

const rig = JSON.parse(readFileSync('rigs/hero/rig.json', 'utf8')) as RigDef;

describe('animation rigs', () => {
  it('every rig in the index has its files, and every part a bone and a frame', () => {
    const index = JSON.parse(readFileSync('rigs/index.json', 'utf8')) as { id: string }[];
    for (const { id } of index) {
      const r = JSON.parse(readFileSync(`rigs/${id}/rig.json`, 'utf8')) as RigDef;
      const frames = JSON.parse(readFileSync(`rigs/${id}/atlas.json`, 'utf8')).frames;
      expect(existsSync(`rigs/${id}/atlas.png`)).toBe(true);
      for (const p of r.parts) {
        expect(r.bones[p.bone], p.name).toBeTruthy();
        expect(frames[p.name], p.name).toBeTruthy();
      }
      for (const c of r.ik ?? []) expect(r.bones[c.lower].tip, c.lower).toBeTruthy();
      for (const [part, pics] of Object.entries(r.swaps ?? {})) {
        expect(r.parts.some(p => p.name === part), part).toBe(true);
        for (const f of pics) expect(frames[f], f).toBeTruthy();
      }
    }
  });

  it('IK puts the hand / foot on the target and keeps the bend on its side', () => {
    for (const chain of rig.ik!) {
      const pose = { a: {} as Record<string, number> };
      const start = chainEnd(rig, solve(rig, pose), chain);
      // two drags in a row: the joint stays on its side (no flip on the second)
      for (const [dx, dy] of [[15, -20], [60, -50]]) {
        const target: [number, number] = [start[0] + dx, start[1] + dy];
        solveIk(rig, pose, chain, target);
        const end = chainEnd(rig, solve(rig, pose), chain);
        expect(Math.hypot(end[0] - target[0], end[1] - target[1])).toBeLessThan(0.5);
        expect(Math.sign(bendOf(rig, chain, pose.a[chain.lower]))).toBe(chain.bend);
      }
    }
  });
});

describe('draw order (layers)', () => {
  const parts = rig.parts.map(p => p.name);
  it('a key can reorder parts; unknown names drop, missing parts keep their spot', () => {
    expect(drawOrder(rig, { a: {} })).toEqual(parts);
    const swapped = [...parts].reverse();
    expect(drawOrder(rig, { a: {}, order: swapped })).toEqual(swapped);
    const partial = drawOrder(rig, { a: {}, order: ['sword', 'nope', ...parts.filter(n => n !== 'sword' && n !== 'head')] });
    expect(partial[0]).toBe('sword');
    expect(partial).toHaveLength(parts.length);
    expect(partial).toContain('head');
  });
  it('older saves: an item layer still moves the item', () => {
    const o = drawOrder(rig, { a: {}, layer: { sword: 'back' } });
    expect(o.indexOf('sword')).toBe(o.indexOf('vest') - 1);
  });
});

describe('animation clips', () => {
  const clip: Clip = { loop: true, keys: [
    { ms: 100, ease: 'linear', pose: { a: { torso: 0 } } },
    { ms: 300, ease: 'linear', pose: { a: { torso: 10 } } },
  ] };
  it('blends between keys and loops back to the first', () => {
    expect(clipLength(clip)).toBe(400);
    expect(sample(clip, 50).a.torso).toBeCloseTo(5);
    expect(sample(clip, 250).a.torso).toBeCloseTo(5);   // halfway back
    expect(sample(clip, 450).a.torso).toBeCloseTo(5);   // wrapped
  });
  it('smooth passes through every key', () => {
    const c: Clip = { loop: true, keys: clip.keys.map(k => ({ ...k, ease: 'smooth' })) };
    expect(sample(c, 0).a.torso).toBeCloseTo(0);
    expect(sample(c, 100).a.torso).toBeCloseTo(10);
  });
  it('saved animation files only name clips with keys and bones the rig has', () => {
    for (const { id } of JSON.parse(readFileSync('rigs/index.json', 'utf8')) as { id: string }[]) {
      if (!existsSync(`animations/${id}.json`)) continue;
      const file = JSON.parse(readFileSync(`animations/${id}.json`, 'utf8'));
      const r = JSON.parse(readFileSync(`rigs/${id}/rig.json`, 'utf8')) as RigDef;
      expect(file.asset).toBe(id);
      for (const c of Object.values(file.clips) as Clip[]) {
        expect(c.keys.length).toBeGreaterThan(0);
        for (const k of c.keys) for (const b of Object.keys(k.pose.a)) expect(r.bones[b], b).toBeTruthy();
      }
    }
  });
});
