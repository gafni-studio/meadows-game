import Phaser from 'phaser';
import { preloadEastKit } from './world/eastKit';
import { preloadSprites, buildPlaceholderTextures } from '../art/SpriteFactory';
import { Game } from '../systems/GameState';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() { preloadSprites(this); preloadEastKit(this); }
  create() {
    buildPlaceholderTextures(this);
    Game.load();
    this.scene.start('World', { area: Game.player.area, x: Game.player.x });
  }
}
