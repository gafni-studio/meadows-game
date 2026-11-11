import Phaser from 'phaser';

/**
 * Keyboard bindings. ATTACK is F (hold to keep swinging). No modifier keys are
 * used, so browser shortcuts (Ctrl+W/T/N, ...) can't be triggered by gameplay.
 */
export const BINDINGS = {
  left: ['A', 'LEFT'],
  right: ['D', 'RIGHT'],
  jump: ['SPACE', 'UP'],
  attack: ['F'],
  interact: ['E'],
  skill1: ['ONE'],
  skill2: ['TWO'],
  skill3: ['THREE'],
  skill4: ['FOUR'],
  skill5: ['FIVE', 'Q'],
  skill6: ['SIX', 'G'],
} as const;
// Menu keys (I, C, Esc, Enter, arrows in menus, backtick console) are handled by the DOM UI (src/ui/Hud.ts).
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

  /** Forget presses (used while a menu is open so nothing fires on close). */
  clear(): void { this.latched.clear(); }

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
 * Phaser already calls preventDefault for every bound key (enableCapture).
 * This guard only blocks stray Ctrl+<letter> page shortcuts (Ctrl+S, Ctrl+P, ...) and
 * the context menu. It must NOT touch keys Phaser handles: Phaser ignores events that
 * are already defaultPrevented.
 */
export function installCtrlGuard(): void {
  const phaserKeys = new Set(['a', 'd', 'e', 'f', 'g', 'i', 'c', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'escape', '1', '2', '3', '4', '5', '6']);
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !phaserKeys.has(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}
