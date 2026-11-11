import Phaser from 'phaser';
import { PlayerData } from './Player';
import { loadSave, writeSave, isWiping } from './Save';
import type { WorldScene } from '../scenes/WorldScene';

/** Shared runtime state + event bus between the world scene and the DOM UI. */
export const Game = {
  player: null as unknown as PlayerData,
  events: new Phaser.Events.EventEmitter(),
  /** Timestamps (ms, scene clock) for cooldowns and timed buffs. */
  cooldowns: {} as Record<string, number>,
  buffs: {} as Record<string, number>, // buff id → expires at (ms)
  invulnUntil: 0,
  dead: false,
  /** A DOM menu/dialog is open: gameplay keys are ignored. */
  menuOpen: false,
  consoleOpen: false,
  regenActive: false,
  /** Remaining Soul Guard HP (0 = none). */
  shield: 0,
  storageOpen: false,
  scene: null as WorldScene | null,
  now: 0,
  load() { this.player = loadSave(); },
  save() { if (isWiping() || !this.player) return; writeSave(this.player); this.events.emit('saved'); },
  changed() { this.events.emit('changed'); },
  toast(msg: string, kind: 'info' | 'loot' | 'rare' | 'warn' | 'level' = 'info', icon?: string) { this.events.emit('toast', msg, kind, icon); },
};
