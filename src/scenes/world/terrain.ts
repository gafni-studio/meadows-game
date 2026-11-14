import Phaser from 'phaser';
import { AreaDef } from '../../data/db';
import { DB } from '../../data/db';
import { AREAS } from '../../world/areas';
import { SPRITES } from '../../art/sprites';
import { fitSlot } from '../../art/SpriteFactory';
import { TILE } from '../../data/assumptions';
import type { WorldScene } from '../WorldScene';

export const GROUND_H = 64;

/** Sky, parallax, ground, decor, one-way platforms, chest, practice post and portals (moved out of WorldScene). */
export function buildTerrain(scene: WorldScene, W: number, area: AreaDef | undefined): { platforms: Phaser.Physics.Arcade.StaticGroup; groundY: number } {
  // Parallax hills + clouds.
  const far = scene.add.graphics().setScrollFactor(0.2);
  far.fillStyle(0xffffff, 0.8);
  for (let i = 0; i < W / 400 + 3; i++) { const cx = i * 400 + 80, cy = 70 + (i % 3) * 30; far.fillRoundedRect(cx, cy, 90, 22, 11); far.fillRoundedRect(cx + 20, cy - 12, 50, 22, 11); }
  const hillFar = scene.geo.hills?.[0] ?? 0x8fcf74;
  const hillNear = scene.geo.hills?.[1] ?? 0x6fb85a;
  const hills = scene.add.graphics().setScrollFactor(0.35);
  hills.fillStyle(hillFar, 1);
  for (let i = 0; i < W / 300 + 4; i++) hills.fillCircle(i * 300, scene.groundY + 50, 170 + (i % 3) * 30);
  const hills2 = scene.add.graphics().setScrollFactor(0.6);
  hills2.fillStyle(hillNear, 1);
  for (let i = 0; i < W / 220 + 4; i++) hills2.fillCircle(i * 220 + 90, scene.groundY + 70, 110 + (i % 2) * 25);

  // Ground: a top row (grass or dirt) + dirt fill + one static body.
  const topKey = scene.geo.ground === 'dirt' ? 'tile.dirt_top' : 'tile.grass_top';
  const gs = SPRITES[topKey];
  const top = scene.add.tileSprite(0, scene.groundY, W, gs.h, topKey).setOrigin(0, 0).setDepth(1);
  top.setTileScale(gs.w / scene.textures.getFrame(topKey).width);
  const dirt = scene.add.tileSprite(0, scene.groundY + gs.h, W, GROUND_H, 'tile.dirt').setOrigin(0, 0).setDepth(1);
  dirt.setTileScale(SPRITES['tile.dirt'].w / scene.textures.getFrame('tile.dirt').width);
  scene.ground = scene.add.rectangle(W / 2, scene.groundY + GROUND_H / 2 + 4, W, GROUND_H, 0, 0);
  scene.physics.add.existing(scene.ground, true);
  const groundY = scene.groundY + 4; // feet stand slightly into the grass row

  for (const d of scene.geo.decor) fitSlot(scene, scene.add.image(d.x * TILE, groundY, d.slot).setOrigin(0.5, 1).setDepth(0), d.slot);

  // One-way platforms (jump up through them, land on top).
  const platforms = scene.physics.add.staticGroup();
  const ps = SPRITES['tile.platform'];
  for (const p of scene.geo.platforms) {
    const y = scene.groundY - p.y * TILE;
    const plat = scene.add.tileSprite(p.x * TILE, y, p.w * TILE, ps.h, 'tile.platform').setOrigin(0, 0).setDepth(2);
    const fr = scene.textures.getFrame('tile.platform');
    plat.setTileScale(ps.h / fr.height);
    platforms.add(plat);
  }

  scene.platformGroup = platforms;

  // Storage chest (town).
  if (scene.geo.chest !== undefined) {
    scene.chestX = scene.geo.chest * TILE;
    scene.chestImg = fitSlot(scene, scene.add.image(scene.chestX, groundY, 'deco.chest').setOrigin(0.5, 1).setDepth(3), 'deco.chest');
    scene.add.text(scene.chestX, groundY - 44, 'Storage', { fontFamily: 'monospace', fontSize: '11px', color: '#fff6c2', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(4);
  }
  if (scene.geo.practicePost != null) {
    scene.postX = scene.geo.practicePost * TILE;
    fitSlot(scene, scene.add.image(scene.postX, groundY, 'deco.practice_post').setOrigin(0.5, 1).setDepth(3), 'deco.practice_post');
    scene.add.text(scene.postX, groundY - 50, 'Practice Post', { fontFamily: 'monospace', fontSize: '11px', color: '#fff6c2', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(4);
  }

  // Portals.
  for (const p of scene.geo.portals) {
    const target = area?.links?.[p.dir];
    const implemented = target && AREAS[target];
    const img = fitSlot(scene, scene.add.image(p.x * TILE, groundY, 'portal').setOrigin(0.5, 1).setDepth(2), 'portal').setAlpha(implemented ? 1 : 0.45);
    if (implemented) scene.tweens.add({ targets: img, alpha: 0.75, yoyo: true, repeat: -1, duration: 900 });
    const tname = target ? DB.areas[target]?.name ?? target : '—';
    scene.add.text(p.x * TILE, groundY - 100, implemented ? `→ ${tname}` : `${tname}\n(later)`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0).setDepth(3);
    scene.portals.push({ x: p.x * TILE, dir: p.dir, arriveX: p.arriveX * TILE, target: implemented ? target : undefined });
  }
  return { platforms, groundY };
}
