// Rough base clips for the Meadow rigs, for Oded to fine-tune in the Studio.
// One-off generator (Nov 2026 request): it only ever ADDS clips. A clip name
// that already exists in animations/<asset>.json is never touched; the new
// clip is saved as the first free numbered copy (run_1, idle_2, ...).
// Re-running it therefore adds more numbered copies: run it once.
//
// Run: npx vite-node scripts/base-clips.ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { sample, type AnimFile, type Clip, type Key, type Ease } from '../src/anim/clip';
import type { Pose } from '../src/anim/rig';

const FILE = (id: string) => `animations/${id}.json`;
const load = (id: string): AnimFile => existsSync(FILE(id))
  ? JSON.parse(readFileSync(FILE(id), 'utf8')) as AnimFile
  : { asset: id, version: 1, clips: {} };
const made: string[] = [];

/** Add a clip under `name`, or its first free numbered copy. Never overwrites. */
function add(file: AnimFile, name: string, clip: Clip) {
  let n = name;
  for (let i = 1; n in file.clips; i++) n = `${name}_${i}`;
  file.clips[n] = clip;
  made.push(`${file.asset}: ${n} (${clip.keys.length} keys${clip.loop ? ', loop' : ''})`);
}

const k = (ms: number, pose: Pose, ease: Ease = 'smooth', event?: string): Key => ({ ms, ease, pose, ...(event ? { event } : {}) });
const P = (a: Record<string, number>, extra: Partial<Pose> = {}): Pose => ({ a, ...extra });

// ---------------------------------------------------------------- hero
{
  const f = load('hero');
  // run_1: MapleStory 3-pose loop A B C B. The hero faces right, so his left
  // side is the near side (*_f, the sword arm) and his right is *_b.
  //   A: right leg forward, left leg a bit behind, left hand forward, right elbow back
  //   B: mid-switch    C: A mirrored
  const sword = 110;   // blade carried forward-down, as in the idle
  const A = P({ torso: 8, head: -4, hip_b: -28, knee_b: 12, hip_f: 14, knee_f: 18,
    shoulder_f: -38, elbow_f: -30, sword, shoulder_b: 34, elbow_b: -70 }, { x: { hips: [2, 9] } });
  const B = P({ torso: 8, head: -4, hip_b: -4, knee_b: 22, hip_f: -2, knee_f: 22,
    shoulder_f: -10, elbow_f: -40, sword, shoulder_b: 4, elbow_b: -50 }, { x: { hips: [2, 6] } });
  const C = P({ torso: 8, head: -4, hip_f: -28, knee_f: 12, hip_b: 14, knee_b: 18,
    shoulder_f: 30, elbow_f: -60, sword: sword + 20, shoulder_b: -36, elbow_b: -30 }, { x: { hips: [2, 9] } });
  add(f, 'run', { loop: true, keys: [k(150, A), k(150, B), k(150, C), k(150, B)] });

  // hit: flinch back with the hurt face, then recover
  const stand = P({ hip_f: 9, knee_f: 7, hip_b: -14, knee_b: 7, shoulder_f: 3, elbow_f: -14, sword: 140, shoulder_b: -20, elbow_b: 22 }, { x: { hips: [-4, 13] } });
  const flinch = P({ torso: -14, head: -10, hip_f: 16, knee_f: 14, hip_b: -6, knee_b: 14, shoulder_f: 30, elbow_f: -40, sword: 120, shoulder_b: 30, elbow_b: -50 },
    { x: { hips: [-16, 18] }, swap: { head: 'head_hurt' } });
  add(f, 'hit', { loop: false, keys: [k(60, stand, 'easeOut'), k(260, flinch, 'easeOut'), k(200, stand)] });

  // idle_1: Oded's idle with one blink (his idle stays as it is)
  if (f.clips.idle) {
    const src = f.clips.idle;
    const at = Math.round(src.keys.slice(0, 2).reduce((s, x) => s + x.ms, 0) + 300); // a moment after key 3
    const keys: Key[] = [];
    let t = 0;
    for (const key of src.keys) {
      if (t <= at && at < t + key.ms) {
        const before = at - t, blinkMs = 130;
        keys.push({ ...key, ms: before });
        const mid = structuredClone(sample(src, at));
        if (key.pose.order) mid.order = [...key.pose.order];
        keys.push(k(blinkMs, { ...mid, swap: { head: 'head_blink' } }, 'hold'));
        const after = structuredClone(sample(src, at + blinkMs));
        if (key.pose.order) after.order = [...key.pose.order];
        keys.push({ ...key, ms: key.ms - before - blinkMs, pose: after });
      } else keys.push(structuredClone(key));
      t += key.ms;
    }
    add(f, 'idle', { loop: src.loop, keys });
  }
  writeFileSync(FILE('hero'), JSON.stringify(f, null, 1) + '\n');
}

// ---------------------------------------------------------------- town NPCs
// Every NPC: still body, head (blink / talk pictures), near arm *_n, far arm *_f.
const NPCS: Record<string, { talkArm: 'n' | 'f'; talkHead: boolean }> = {
  pell: { talkArm: 'n', talkHead: true },
  mara: { talkArm: 'n', talkHead: true },
  calden: { talkArm: 'f', talkHead: false },  // his near hand holds the sword
  ila: { talkArm: 'n', talkHead: true },
  tamsin: { talkArm: 'n', talkHead: true },
};
for (const [id, o] of Object.entries(NPCS)) {
  const f = load(id);
  const rest = P({});
  const breathe = P({ head: 2, shoulder_n: -2, shoulder_f: -2 });
  add(f, 'idle', { loop: true, keys: [
    k(1500, rest), k(1100, breathe),
    k(130, { ...breathe, swap: { head: 'head_blink' } }, 'hold'),
    k(1200, breathe),
  ] });
  const s = `shoulder_${o.talkArm}`, e = `elbow_${o.talkArm}`;
  const talk = o.talkHead ? { swap: { head: 'head_talk' } } : {};
  const g1 = P({ head: -4, [s]: -55, [e]: -45 }, talk);
  const g2 = P({ head: 2, [s]: -40, [e]: -60 });
  const g3 = P({ head: -2, [s]: -60, [e]: -35 }, talk);
  add(f, 'talk', { loop: true, keys: [k(260, rest), k(280, g1), k(260, g2), k(280, g3), k(320, P({ head: 3, [s]: -30, [e]: -40 }))] });
  writeFileSync(FILE(id), JSON.stringify(f, null, 1) + '\n');
}

// ---------------------------------------------------------------- mobs
// Every mob: body (move + tilt, whole-frame pictures hurt / dead / strike),
// leg_back and leg_front (the crow: legs). A leg's "none" picture hides it
// while the body shows a whole frame.
const MOBS: Record<string, { size: number; crow?: boolean }> = {
  field_mouse: { size: 0.7 }, wool_sheep: { size: 1 }, crow: { size: 0.8, crow: true },
  boar: { size: 1 }, angry_bull: { size: 1.3 }, wool_shoulder: { size: 1 },
};
for (const [id, o] of Object.entries(MOBS)) {
  const f = load(id);
  const legs = o.crow ? ['legs'] : ['leg_back', 'leg_front'];
  const hide = Object.fromEntries(legs.map(l => [l, `${l}_none`]));
  const s = o.size;
  const body = (x: number, y: number, a: number, extra: Partial<Pose> = {}): Pose =>
    ({ a: { body: a, ...(extra.a ?? {}) }, x: { body: [x * s, y * s] }, ...(extra.swap ? { swap: extra.swap } : {}) });

  add(f, 'idle', { loop: true, keys: [k(700, body(0, 0, 0)), k(700, body(0, 1.5, -1.5))] });

  if (o.crow) {
    // flying: the two wing frames from the sheet's fly row, bobbing in the air
    add(f, 'move', { loop: true, keys: [
      k(140, body(0, -40, 0, { swap: { body: 'body_fly_up', ...hide } })),
      k(140, body(0, -34, 4, { swap: { body: 'body_fly_down', ...hide } })),
    ] });
  } else {
    const step = (a: number, y: number) => body(0, y, 0, { a: { leg_back: a, leg_front: -a } });
    add(f, 'move', { loop: true, keys: [k(170, step(18, 0)), k(170, step(0, -3)), k(170, step(-18, 0)), k(170, step(0, -3))] });
  }

  add(f, 'attack', { loop: false, keys: [
    k(260, body(0, 0, 0)),
    k(120, body(-10, 2, -10), 'easeIn'),                                       // wind-up: lean back
    k(220, body(16, 0, 4, { swap: { body: 'body_strike', ...hide } }), 'easeOut', 'hit'),
    k(240, body(4, 0, 0)),
    k(1, body(0, 0, 0)),
  ] });

  add(f, 'hit', { loop: false, keys: [
    k(240, body(-14, 0, -8, { swap: { body: 'body_hurt', ...hide } }), 'easeOut'),
    k(220, body(-4, 0, -2)),
    k(1, body(0, 0, 0)),
  ] });

  add(f, 'death', { loop: false, keys: [
    k(300, body(-14, 0, -8, { swap: { body: 'body_hurt', ...hide } }), 'easeOut'),
    k(400, body(-22, 0, 0, { swap: { body: 'body_dead', ...hide } }), 'hold'),
    k(1, body(-22, 0, 0, { swap: { body: 'body_dead', ...hide } })),
  ] });
  writeFileSync(FILE(id), JSON.stringify(f, null, 1) + '\n');
}

console.log(made.join('\n'));
