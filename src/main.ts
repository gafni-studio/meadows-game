import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { Hud } from './ui/Hud';
import { installCtrlGuard } from './systems/Controls';
import { Game } from './systems/GameState';

installCtrlGuard();

const game = new Phaser.Game({
  type: new URLSearchParams(location.search).has('canvas') ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  pixelArt: true,
  backgroundColor: '#9fd4f5',
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, WorldScene],
});

new Hud();
window.addEventListener('beforeunload', () => { if (Game.player) Game.save(); });
(window as unknown as { __game: Phaser.Game; __state: typeof Game }).__game = game;
(window as unknown as { __state: typeof Game }).__state = Game;
