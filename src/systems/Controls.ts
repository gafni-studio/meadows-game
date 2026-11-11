import Phaser from 'phaser';

/**
 * Keyboard bindings. ATTACK is Ctrl (Oded's choice). Keys that combine badly
 * with a held Ctrl in browsers (Ctrl+W/T/N close/open tabs, Ctrl+Q quits on Linux,
 * Ctrl+R reloads) are deliberately NOT bound to any game action.
 */
export const BINDINGS = {
  left: ['A', 'LEFT'],
  right: ['D', 'RIGHT'],
  jump: ['SPACE', 'UP'],
  attack: ['CTRL', 'J'],
  interact: ['E'],
  skill1: ['ONE'],
  skill2: ['TWO'],
  skill3: ['THREE'],
  skill4: ['FOUR'],
  potionHp: ['FIVE', 'F'],
  potionMp: ['SIX', 'G'],
  inventory: ['I'],
  stats: ['C'],
  shopClose: ['ESC'],
} as const;
export type Action = keyof typeof BINDINGS;

export class Controls {
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  /** Latched "was pressed since last check" flags, so quick taps are never missed. */
  private latched = new Set<string>();

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    for (const [action, names] of Object.entries(BINDINGS)) {
      // addKey(..., enableCapture=true) makes Phaser call preventDefault on these keys.
      this.keys[action] = names.map((n) => {
        const key = kb.addKey(Phaser.Input.Keyboard.KeyCodes[n as keyof typeof Phaser.Input.Keyboard.KeyCodes], true);
        key.on('down', () => this.latched.add(action));
        return key;
      });
    }
  }

  down(a: Action): boolean {
    // A tap shorter than a frame still counts once as "down".
    return this.keys[a].some((k) => k.isDown) || (a === 'attack' && this.latched.has(a) && (this.latched.delete(a), true));
  }
  pressed(a: Action): boolean {
    const hit = this.latched.has(a);
    this.latched.delete(a);
    return hit;
  }
}

/**
 * Phaser already calls preventDefault for every bound key (enableCapture), which also
 * covers Ctrl itself and Ctrl+<game key> (Ctrl+D bookmark, Ctrl+F find, ...).
 * This guard handles the remaining Ctrl+<letter> combos a player may hit while holding
 * attack (Ctrl+S save page, Ctrl+P print, Ctrl+H history, ...). It must NOT touch keys
 * Phaser handles: Phaser ignores events that are already defaultPrevented.
 * Browsers never let pages block Ctrl+W/T/N, which is why those letters are unbound.
 */
export function installCtrlGuard(): void {
  const phaserKeys = new Set(['control', 'a', 'd', 'e', 'f', 'g', 'i', 'c', 'j', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'escape', '1', '2', '3', '4', '5', '6']);
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !phaserKeys.has(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}
