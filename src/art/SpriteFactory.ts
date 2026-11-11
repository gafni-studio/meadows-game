import Phaser from 'phaser';
import { SPRITES } from './sprites';

/** Queue art files for every slot that has one. */
export function preloadSprites(scene: Phaser.Scene): void {
  for (const [key, s] of Object.entries(SPRITES)) {
    if (!s.file) continue;
    if (s.frameW && s.frameH) scene.load.spritesheet(key, s.file, { frameWidth: s.frameW, frameHeight: s.frameH });
    else scene.load.image(key, s.file);
  }
}

/** Generate a placeholder texture for every slot without (loaded) art. */
export function buildPlaceholderTextures(scene: Phaser.Scene): void {
  for (const [key, s] of Object.entries(SPRITES)) {
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(s.color, 1);
    if (s.shape === 'circle') g.fillCircle(s.w / 2, s.h / 2, Math.min(s.w, s.h) / 2);
    else if (s.shape === 'roundrect') g.fillRoundedRect(0, 0, s.w, s.h, Math.min(8, s.w / 4, s.h / 4));
    else g.fillRect(0, 0, s.w, s.h);
    g.generateTexture(key, s.w, s.h);
    g.destroy();
    delete s.body; // body hints are for the real art
    s.frameW = undefined;
  }
}

/** Source (unscaled) frame size of a slot's texture. */
export function sourceSize(scene: Phaser.Scene, key: string): { w: number; h: number } {
  const s = SPRITES[key];
  if (s?.frameW && s.frameH) return { w: s.frameW, h: s.frameH };
  const f = scene.textures.getFrame(key);
  return { w: f?.width ?? s?.w ?? 16, h: f?.height ?? s?.h ?? 16 };
}

/** Scale a game object so it renders at its slot's fixed size. */
export function fitSlot<T extends Phaser.GameObjects.Components.Transform>(scene: Phaser.Scene, go: T, key: string, size?: { w: number; h: number }): T {
  const s = SPRITES[key];
  const src = sourceSize(scene, key);
  const w = size?.w ?? s?.w ?? src.w;
  const h = size?.h ?? s?.h ?? src.h;
  go.setScale(w / src.w, h / src.h);
  return go;
}

/** Apply the slot's body hint (in source px) to an arcade sprite. */
export function applyBody(sprite: Phaser.Physics.Arcade.Sprite | Phaser.Physics.Arcade.Image, key: string): void {
  const b = SPRITES[key]?.body;
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  if (b) { body.setSize(b[0], b[1], false); body.setOffset(b[2], b[3]); }
}
