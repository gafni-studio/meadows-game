import Phaser from 'phaser';
import { AreaDef } from '../../data/db';
import { DB } from '../../data/db';
import { AREAS } from '../../world/areas';
import { SPRITES } from '../../art/sprites';
import { fitSlot } from '../../art/SpriteFactory';
import { TILE } from '../../data/assumptions';
import { groundAt } from '../../world/surface';
import { eastParallax, eastTerrain, eastClimbs } from './eastKit';
import type { WorldScene } from '../WorldScene';

export const GROUND_H = 64;

/** Sky, parallax, ground, decor, one-way platforms, chest, practice post and portals (moved out of WorldScene). */
export function buildTerrain(scene: WorldScene, W: number, area: AreaDef | undefined): { platforms: Phaser.Physics.Arcade.StaticGroup; groundY: number } {
  const geo = scene.geo;
  const H = scene.physics.world.bounds.height;
  // v0.3.0: tall areas scroll vertically. Parallax layers are placed so they look as before when the camera
  // rests on the base ground (camera y = H - view height).
  // v0.3.2: Meadow East is drawn from the painted tile kit (eastKit.ts); collision below is unchanged.
  const kit = geo.kit === 'meadow_east';
  if (kit) eastParallax(scene, W, H);
  else drawBackdrop(scene, W, H);

  // Ground: a top row (grass, dirt or moss) + dirt fill + one static body.
  const topKey = geo.ground === 'dirt' ? 'tile.dirt_top' : geo.ground === 'moss' ? 'tile.moss_top' : 'tile.grass_top';
  const gs = SPRITES[topKey];
  if (!kit) {
    const top = scene.add.tileSprite(0, scene.groundY, W, gs.h, topKey).setOrigin(0, 0).setDepth(1);
    top.setTileScale(gs.w / scene.textures.getFrame(topKey).width);
    const dirt = scene.add.tileSprite(0, scene.groundY + gs.h, W, GROUND_H, 'tile.dirt').setOrigin(0, 0).setDepth(1);
    dirt.setTileScale(SPRITES['tile.dirt'].w / scene.textures.getFrame('tile.dirt').width);
    dirt.setTint(geo.ambient === 'forest' ? 0x7a6a5a : geo.ambient === 'cave' ? 0x9a8a90 : 0xffffff);
  }
  const soil = geo.ambient === 'forest' ? 0x7a6a5a : geo.ambient === 'cave' ? 0x9a8a90 : 0xffffff;
  scene.ground = scene.add.rectangle(W / 2, scene.groundY + GROUND_H / 2 + 4, W, GROUND_H, 0, 0);
  scene.physics.add.existing(scene.ground, true);
  const groundY = scene.groundY + 4; // feet stand slightly into the grass row
  const yOf = (tiles: number) => groundY - tiles * TILE;

  // v0.3.0 solid terrain steps (hills, banks, the cave floor). Collide on every side.
  const blocks = scene.physics.add.staticGroup();
  for (const b of geo.blocks ?? []) {
    const x = b.x * TILE, w = b.w * TILE, h = b.h * TILE, y = groundY - h;
    if (kit) { blocks.add(scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0, 0)); continue; }
    const fill = scene.add.tileSprite(x, y, w, h + GROUND_H, 'tile.dirt').setOrigin(0, 0).setDepth(1.2);
    fill.setTileScale(SPRITES['tile.dirt'].w / scene.textures.getFrame('tile.dirt').width);
    fill.setTint(soil);
    const cap = scene.add.tileSprite(x, y - 4, w, Math.min(gs.h, h + 4), topKey).setOrigin(0, 0).setDepth(1.3);
    cap.setTileScale(gs.w / scene.textures.getFrame(topKey).width);
    const body = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0, 0);
    blocks.add(body);
  }
  scene.blockGroup = blocks;

  drawWater(scene, groundY);
  if (kit) eastTerrain(scene, W, H, groundY);

  for (const d of kit ? [] : geo.decor) fitSlot(scene, scene.add.image(d.x * TILE, yOf(d.y ?? 0), d.slot).setOrigin(0.5, 1).setDepth(d.y ? 1.5 : 0), d.slot); // raised decor: over block tops, behind ledges

  // One-way platforms (jump up through them, land on top; down + jump drops through).
  const platforms = scene.physics.add.staticGroup();
  const pk = geo.ground === 'moss' ? 'tile.branch' : 'tile.platform';
  const ps = SPRITES[pk];
  for (const p of geo.platforms) {
    const y = scene.groundY - p.y * TILE;
    const plat = scene.add.tileSprite(p.x * TILE, y, p.w * TILE, ps.h, pk).setOrigin(0, 0).setDepth(2);
    const fr = scene.textures.getFrame(pk);
    plat.setTileScale(ps.h / fr.height);
    if (kit) plat.setVisible(false); // kit ledge drawn by eastTerrain; this keeps the one-way body
    platforms.add(plat);
  }
  scene.platformGroup = platforms;

  // Ladders, ropes, vines and root ladders.
  scene.climbs = (geo.climbs ?? []).map((c) => ({ x: c.x * TILE, top: yOf(c.y1), bottom: yOf(c.y0), kind: c.kind }));
  if (kit) eastClimbs(scene); else drawClimbs(scene);

  // Storage chest (town).
  if (geo.chest !== undefined) {
    scene.chestX = geo.chest * TILE;
    scene.chestImg = fitSlot(scene, scene.add.image(scene.chestX, groundY, 'deco.chest').setOrigin(0.5, 1).setDepth(3), 'deco.chest');
    scene.add.text(scene.chestX, groundY - 44, 'Storage', { fontFamily: 'monospace', fontSize: '11px', color: '#fff6c2', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(4);
  }
  if (geo.practicePost != null) {
    scene.postX = geo.practicePost * TILE;
    fitSlot(scene, scene.add.image(scene.postX, groundY, 'deco.practice_post').setOrigin(0.5, 1).setDepth(3), 'deco.practice_post');
    scene.add.text(scene.postX, groundY - 50, 'Practice Post', { fontFamily: 'monospace', fontSize: '11px', color: '#fff6c2', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(4);
  }

  // Portals (v0.3.0: may stand on a ledge, `y` tiles up).
  for (const p of geo.portals) {
    const target = area?.links?.[p.dir];
    const implemented = target && AREAS[target];
    const py = yOf(p.y ?? groundAt(geo, p.x));
    const img = kit
      ? scene.add.image(p.x * TILE, py + 2, 'east.portal').setOrigin(0.5, 1).setDepth(2.5).setAlpha(implemented ? 1 : 0.45) // glow base sits in the grass
      : fitSlot(scene, scene.add.image(p.x * TILE, py, 'portal').setOrigin(0.5, 1).setDepth(2), 'portal').setAlpha(implemented ? 1 : 0.45);
    if (!kit && (p.dir === 'north' || p.dir === 'south')) img.setTint(0xc8f0d8);
    if (implemented) scene.tweens.add({ targets: img, alpha: 0.75, yoyo: true, repeat: -1, duration: 900 });
    const tname = target ? DB.areas[target]?.name ?? target : '—';
    scene.add.text(p.x * TILE, py - 100, implemented ? `→ ${tname}` : `${tname}\n(later)`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0).setDepth(3);
    const arriveY = p.arriveY != null ? p.arriveY : undefined;
    scene.portals.push({ x: p.x * TILE, y: py, dir: p.dir, arriveX: p.arriveX * TILE, arriveY, target: implemented ? target : undefined });
  }
  return { platforms, groundY };
}

/** Placeholder sky clouds and hills (every area but the kit scene). */
function drawBackdrop(scene: WorldScene, W: number, H: number): void {
  const geo = scene.geo;
  const camBottom = H - scene.scale.height;
  const at = (sf: number, screenY: number) => screenY + camBottom * sf;
  const viewGround = scene.scale.height - GROUND_H;
  const far = scene.add.graphics().setScrollFactor(0.2);
  far.fillStyle(0xffffff, geo.ambient === 'cave' || geo.ambient === 'forest' ? 0 : 0.8); // no clouds under rock or canopy
  for (let i = 0; i < W / 400 + 3; i++) { const cx = i * 400 + 80, cy = at(0.2, 70 + (i % 3) * 30); far.fillRoundedRect(cx, cy, 90, 22, 11); far.fillRoundedRect(cx + 20, cy - 12, 50, 22, 11); }
  const hillFar = geo.hills?.[0] ?? 0x8fcf74;
  const hillNear = geo.hills?.[1] ?? 0x6fb85a;
  const hills = scene.add.graphics().setScrollFactor(0.35);
  const hy = at(0.35, viewGround + 50);
  const hills2 = scene.add.graphics().setScrollFactor(0.6);
  const hy2 = at(0.6, viewGround + 70);
  if (geo.ambient === 'forest') {
    // v0.3.0 Whisperwood: rows of old trunks fading into the mist instead of hills
    for (const [g, color, sf, y0, wMin] of [[hills, hillFar, 0.35, hy, 26], [hills2, hillNear, 0.6, hy2, 40]] as const) {
      g.fillStyle(color, 1);
      for (let x = 0; x < W * sf + 400; x += wMin * 3 + ((x * 13) % 70)) {
        const tw = wMin + ((x * 7) % 24);
        g.fillRect(x, at(sf, -40), tw, y0 + H);
        g.fillEllipse(x + tw / 2, at(sf, 10 + ((x * 3) % 60)), tw * 5, 120);
      }
      g.fillRect(0, y0, W, H);
    }
  } else {
    hills.fillStyle(hillFar, 1);
    for (let i = 0; i < W / 300 + 4; i++) hills.fillCircle(i * 300, hy, 170 + (i % 3) * 30);
    hills.fillRect(0, hy, W, H);
    hills2.fillStyle(hillNear, 1);
    for (let i = 0; i < W / 220 + 4; i++) hills2.fillCircle(i * 220 + 90, hy2, 110 + (i % 2) * 25);
    hills2.fillRect(0, hy2, W, H);
  }

}

/** River and bog water over the base ground: a translucent band with a lighter, moving surface line. */
function drawWater(scene: WorldScene, groundY: number): void {
  for (const w of scene.geo.water ?? []) {
    const x = w.x * TILE, wpx = w.w * TILE;
    const bog = w.kind === 'bog';
    const g = scene.add.graphics().setDepth(9);
    g.fillStyle(bog ? 0x2e4a30 : 0x4a90c0, bog ? 0.55 : 0.45).fillRect(x, groundY - 14, wpx, 22);
    g.fillStyle(bog ? 0x6a8a4a : 0xbfe6ff, 0.6).fillRect(x, groundY - 14, wpx, 2);
    scene.waterBands.push({ x, w: wpx, y: groundY - 14, bog });
  }
}

/** Climbs drawn with graphics: wooden ladders, knotted ropes, leafy vines (they sway), gnarled root ladders. */
function drawClimbs(scene: WorldScene): void {
  const g = scene.add.graphics().setDepth(2.2);
  for (const c of scene.climbs) {
    const h = c.bottom - c.top;
    if (c.kind === 'ladder' || c.kind === 'root') {
      const rail = c.kind === 'root' ? 0x5a3a20 : 0x8a6236;
      const rung = c.kind === 'root' ? 0x6e4a2a : 0xb88a50;
      g.fillStyle(rail, 1).fillRect(c.x - 11, c.top - 6, 4, h + 6).fillRect(c.x + 7, c.top - 6, 4, h + 6);
      for (let y = c.top + 4; y < c.bottom; y += 12) {
        const wob = c.kind === 'root' ? Math.sin(y * 0.3) * 2 : 0;
        g.fillStyle(rung, 1).fillRect(c.x - 9, y + wob, 18, 3);
      }
      if (c.kind === 'root') for (let y = c.top; y < c.bottom; y += 22) g.fillStyle(0x4a2e18, 1).fillCircle(c.x + (y % 44 ? -10 : 10), y, 3);
    } else if (c.kind === 'rope') {
      g.fillStyle(0xc8a878, 1).fillRect(c.x - 2, c.top - 8, 4, h + 8);
      for (let y = c.top + 10; y < c.bottom; y += 18) g.fillStyle(0x9a7a50, 1).fillCircle(c.x, y, 3);
      g.fillStyle(0x6a5030, 1).fillRect(c.x - 6, c.top - 10, 12, 4);
    }
  }
  // Vines sway (v0.3.0 look): one graphics redrawn on a slow timer.
  const vines = scene.climbs.filter((c) => c.kind === 'vine');
  if (!vines.length) return;
  const vg = scene.add.graphics().setDepth(2.2);
  const draw = () => {
    vg.clear();
    const t = scene.time.now / 900;
    for (const c of vines) {
      for (let y = c.top - 6; y < c.bottom; y += 6) {
        const k = (y - c.top) / Math.max(1, c.bottom - c.top);
        const sx = Math.sin(t + y * 0.04) * 3 * k;
        vg.fillStyle(0x3f7a34, 1).fillRect(c.x - 2 + sx, y, 4, 7);
        if (Math.floor(y / 6) % 3 === 0) vg.fillStyle(0x6ab04a, 1).fillEllipse(c.x + sx + (Math.floor(y / 6) % 2 ? 6 : -6), y + 3, 9, 5);
      }
    }
  };
  draw();
  scene.time.addEvent({ delay: 80, loop: true, callback: draw });
}
