import Phaser from 'phaser';
import { SPRITES } from './sprites';

/** Queue real art files (slots with `file`) in a Scene's preload(). */
export function preloadSprites(scene: Phaser.Scene): void {
  for (const [key, s] of Object.entries(SPRITES)) {
    if (!s.file) continue;
    if (s.frameW && s.frameH) scene.load.spritesheet(key, s.file, { frameWidth: s.frameW, frameHeight: s.frameH });
    else scene.load.image(key, s.file);
  }
}

/** Generate placeholder textures for every slot that has no real art file. */
export function buildPlaceholderTextures(scene: Phaser.Scene): void {
  for (const [key, s] of Object.entries(SPRITES)) {
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(s.color, 1);
    if (s.shape === 'circle') g.fillCircle(s.w / 2, s.h / 2, Math.min(s.w, s.h) / 2);
    else if (s.shape === 'roundrect') g.fillRoundedRect(0, 0, s.w, s.h, Math.min(8, s.w / 4, s.h / 4));
    else g.fillRect(0, 0, s.w, s.h);
    // A darker outline so shapes read on any background.
    g.lineStyle(2, Phaser.Display.Color.ValueToColor(s.color).darken(35).color, 1);
    if (s.shape === 'circle') g.strokeCircle(s.w / 2, s.h / 2, Math.min(s.w, s.h) / 2 - 1);
    else g.strokeRect(1, 1, s.w - 2, s.h - 2);
    if (key.startsWith('player.') || key.startsWith('npc.') || key.startsWith('monster.')) {
      // Eye so facing direction is visible (sprites face right; flipX for left).
      g.fillStyle(0x111111, 1);
      g.fillCircle(s.w * 0.72, s.h * 0.3, Math.max(2, s.w / 12));
    }
    g.generateTexture(key, s.w, s.h);
    g.destroy();
  }
}
