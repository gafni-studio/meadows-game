import Phaser from 'phaser';
import { TILE } from '../../data/assumptions';
import type { WorldScene } from '../WorldScene';

/**
 * v0.3.2: Meadow East built from the painted tile kit (art-direction/chibi/env/meadow-east, KIT.md).
 * Pieces are pre-scaled to 5/16 by scripts/build-east-kit.py (kit hero 160 px = game hero 48 px).
 * Visuals only: collision bodies stay exactly as before (terrain.ts keeps them, invisible).
 *
 * Draw order (KIT.md): sky, far hills, near hills, ground fill/tops/undersides, ladders and ropes,
 * characters, then `grass_front` over their feet.
 */
const A = 'art/east/';
const TILES = ['ground_top', 'ground_top_256', 'ground_fill', 'ground_fill_256', 'ground_cap_left', 'ground_cap_right', 'ground_fill_cap_left', 'ground_fill_cap_right',
  'platform_mid', 'platform_left', 'platform_right', 'platform_under_mid', 'platform_under_left', 'platform_under_right',
  'grass_front', 'ladder_top', 'ladder_mid', 'ladder_bottom', 'rope_top', 'rope_mid', 'rope_bottom', 'portal'];

/** Feet stand 5 px (kit: 16-20 px at full scale) below the walking line, so the line sits 5 px above the physics top. */
const FEET = 5;
const CAP = 20, TOP_H = 30;
const DEPTH = { sky: -30, far: -20, near: -10, base: 1, under: 1.9, platform: 2, climb: 2.2, front: 10.5 };

export function preloadEastKit(scene: Phaser.Scene): void {
  for (const n of TILES) scene.load.image(`east.${n}`, `${A}${n}.png`);
  scene.load.image('east.sky', `${A}sky.jpg`);
  scene.load.image('east.far', `${A}far-hills.png`);
  scene.load.image('east.near', `${A}near-hills.png`);
}

const run = (scene: WorldScene, key: string, x: number, y: number, w: number, h: number, depth: number, phaseX = x) =>
  scene.add.tileSprite(x, y, w, h, key).setOrigin(0, 0).setDepth(depth).setTilePosition(x - phaseX, 0);
const img = (scene: WorldScene, key: string, x: number, y: number, depth: number, ox = 0, oy = 0) =>
  scene.add.image(x, y, key).setOrigin(ox, oy).setDepth(depth);

/** Sky and two hill layers, tiled sideways (every other copy mirrored so the seams match). */
export function eastParallax(scene: WorldScene, W: number, H: number): void {
  const view = scene.scale.height, camBottom = H - view;
  scene.add.image(0, 0, 'east.sky').setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.sky);
  for (const [key, sf, depth] of [['east.far', 0.2, DEPTH.far], ['east.near', 0.45, DEPTH.near]] as const) {
    const y = camBottom * sf; // at rest on the base ground the layer fills the view
    const n = Math.ceil((W * sf + 960) / 960) + 1;
    for (let i = 0; i < n; i++) scene.add.image(i * 960, y, key).setOrigin(0, 0).setFlipX(i % 2 === 1).setScrollFactor(sf, sf).setDepth(depth);
  }
}

/** A run of top tiles: left cap, long mid, right cap, with dirt fill below down to `bottom` and grass tips in front. */
function ground(scene: WorldScene, x: number, w: number, line: number, bottom: number, depth: number, front: [number, number][], kind: 'ground' | 'platform'): void {
  const mid = kind === 'ground' ? 'ground_top' : 'platform_mid';
  const capped = x > 0; // the world-edge base strip has no caps
  const capW = capped ? CAP : 0;
  if (capped) img(scene, `east.${kind === 'ground' ? 'ground_cap_left' : 'platform_left'}`, x, line, depth + 0.01);
  run(scene, `east.${mid}`, x + capW, line, w - capW * 2, TOP_H, depth + 0.01);
  if (capped) img(scene, `east.${kind === 'ground' ? 'ground_cap_right' : 'platform_right'}`, x + w - CAP, line, depth + 0.01);
  if (kind === 'ground') {
    const fy = line + TOP_H;
    run(scene, 'east.ground_fill', x + capW, fy, w - capW * 2, bottom - fy, depth, x + capW);
    if (capped) { img(scene, 'east.ground_fill_cap_left', x, fy, depth); img(scene, 'east.ground_fill_cap_right', x + w - CAP, fy, depth); }
  }
  // Front grass: same x and phase as the top mid, in front of characters. Skip stretches a taller hill covers.
  for (const [a, b] of front) run(scene, 'east.grass_front', a, line, b - a, 32 * 5 / 16, DEPTH.front, x + capW);
}

/** Subtract the covered x ranges from [a, b]. */
function visible(a: number, b: number, covers: [number, number][]): [number, number][] {
  let out: [number, number][] = [[a, b]];
  for (const [c0, c1] of covers) {
    const next: [number, number][] = [];
    for (const [s, e] of out) {
      if (c1 <= s || c0 >= e) next.push([s, e]);
      else { if (c0 - s > 1) next.push([s, c0]); if (e - c1 > 1) next.push([c1, e]); }
    }
    out = next;
  }
  return out;
}

export function eastTerrain(scene: WorldScene, W: number, H: number, physTop: number): void {
  const geo = scene.geo;
  const line0 = physTop - FEET;
  const blocks = [...(geo.blocks ?? [])].sort((p, q) => p.h - q.h);
  // Base strip (ground grass tips are hidden where a hill covers the strip).
  const hillCovers = blocks.map((b): [number, number] => [b.x * TILE + CAP, (b.x + b.w) * TILE - CAP]);
  ground(scene, 0, W, line0, H, DEPTH.base, visible(0, W, hillCovers), 'ground');
  // Hills: each one a ground run on a mound of dirt. Lower ones first, so taller ones overlap them.
  blocks.forEach((b, i) => {
    const x = b.x * TILE, w = b.w * TILE, line = line0 - b.h * TILE;
    const higher = blocks.filter((o) => o.h > b.h).map((o): [number, number] => [o.x * TILE + CAP, (o.x + o.w) * TILE - CAP]);
    ground(scene, x, w, line, H, 1.2 + i * 0.01, visible(x + CAP, x + w - CAP, higher), 'ground');
  });
  // Terraces: platform body + undersides tucked 5 px (16 kit px) under it. Platform physics top = groundY - y*TILE.
  for (const p of geo.platforms) {
    const x = p.x * TILE, w = p.w * TILE, line = scene.groundY - p.y * TILE - FEET;
    ground(scene, x, w, line, H, DEPTH.platform, [[x + CAP, x + w - CAP]], 'platform');
    const uy = line + TOP_H - 5;
    img(scene, 'east.platform_under_left', x, uy, DEPTH.under);
    run(scene, 'east.platform_under_mid', x + 40, uy, w - 80, 30, DEPTH.under);
    img(scene, 'east.platform_under_right', x + w - 40, uy, DEPTH.under);
  }
}

/** Ladders and ropes from top / mid / bottom pieces. `top` and `bottom` are the climb's walking lines (physics). */
export function eastClimbs(scene: WorldScene): void {
  for (const c of scene.climbs) {
    if (c.kind === 'rope') {
      const top = c.top - FEET - 14; // loop sits on the lip, mostly above it
      const bot = c.bottom + 6;
      img(scene, 'east.rope_top', c.x, top, DEPTH.climb, 0.5);
      run(scene, 'east.rope_mid', c.x - 5, top + 40, 10, bot - 30 - (top + 40), DEPTH.climb);
      img(scene, 'east.rope_bottom', c.x, bot - 30, DEPTH.climb, 0.5);
    } else {
      const top = c.top - FEET - 8; // both rails hook over the lip (~8 px = kit 24-28 px)
      const bot = c.bottom + 6; // feet sit in the ground grass
      img(scene, 'east.ladder_top', c.x, top, DEPTH.climb, 0.5);
      run(scene, 'east.ladder_mid', c.x - 10, top + 30, 20, bot - 20 - (top + 30), DEPTH.climb);
      img(scene, 'east.ladder_bottom', c.x, bot - 20, DEPTH.climb, 0.5);
    }
  }
}
