import Phaser from 'phaser';
import { preloadSprites, buildPlaceholderTextures } from '../art/SpriteFactory';
import { Game } from '../systems/GameState';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() { preloadSprites(this); }
  create() {
    buildPlaceholderTextures(this);
    Game.load();
    this.scene.start('World', { area: Game.player.area, x: Game.player.x });
  }
}
