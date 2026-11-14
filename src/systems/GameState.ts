import { PlayerData } from './Player';
import { loadSave, writeSave, isWiping } from './Save';
import type { WorldScene } from '../scenes/WorldScene';

type Handler = (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
/** A tiny event bus (no Phaser), so game logic also runs in Node for the fast tests. */
class Emitter {
  private map = new Map<string, Set<Handler>>();
  on(ev: string, fn: Handler): this { (this.map.get(ev) ?? this.map.set(ev, new Set()).get(ev)!).add(fn); return this; }
  off(ev: string, fn: Handler): this { this.map.get(ev)?.delete(fn); return this; }
  once(ev: string, fn: Handler): this { const w: Handler = (...a) => { this.off(ev, w); fn(...a); }; return this.on(ev, w); }
  emit(ev: string, ...args: unknown[]): boolean { const s = this.map.get(ev); if (!s?.size) return false; [...s].forEach((fn) => fn(...args)); return true; }
}

/** Shared runtime state + event bus between the world scene and the DOM UI. */
export const Game = {
  player: null as unknown as PlayerData,
  events: new Emitter(),
  /** Timestamps (ms, Date.now() wall clock) for cooldowns and timed buffs, so a scene restart does not reset them. */
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
