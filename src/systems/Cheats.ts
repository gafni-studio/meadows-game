/**
 * Test/cheat console commands (enabled by DEV_CONSOLE in src/config.ts).
 * Any command that changes the game marks the save as `cheated`.
 */
import { DB, xpToNext } from '../data/db';
import { AREAS } from '../world/areas';
import { Game } from './GameState';
import { clearSave } from './Save';
import * as P from './Player';

type Cmd = { usage: string; help: string; run: (args: string[]) => string; cheat?: boolean };

const num = (s: string | undefined, name: string): number => {
  const n = Number(s);
  if (s === undefined || !Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
};
const scene = () => {
  if (!Game.scene) throw new Error('World not ready');
  return Game.scene;
};

export const COMMANDS: Record<string, Cmd> = {
  help: {
    usage: 'help', help: 'List commands',
    run: () => Object.values(COMMANDS).map((c) => `${c.usage.padEnd(24)} ${c.help}`).join('\n'),
  },
  xp: {
    usage: 'xp <n>', help: 'Gain n XP (levels up normally)', cheat: true,
    run: ([n]) => {
      const lv = P.gainXp(Game.player, Math.max(0, Math.floor(num(n, 'n'))));
      if (lv) Game.scene?.levelUpFx(lv);
      return `+${n} XP → level ${Game.player.level}, ${Game.player.xp}/${xpToNext(Game.player.level)}`;
    },
  },
  level: {
    usage: 'level <n>', help: 'Set level (grants/removes 5 points per level)', cheat: true,
    run: ([n]) => {
      const p = Game.player;
      const target = Math.max(1, Math.floor(num(n, 'n')));
      const delta = target - p.level;
      p.level = target;
      p.xp = 0;
      p.unspent = Math.max(0, p.unspent + delta * 5);
      p.hp = P.maxHp(p); p.mp = P.maxMp(p);
      return `Level ${p.level}, ${p.unspent} unspent points`;
    },
  },
  copper: {
    usage: 'copper <n>', help: 'Add n Copper Coin (negative to remove)', cheat: true,
    run: ([n]) => { Game.player.coins = Math.max(0, Game.player.coins + Math.floor(num(n, 'n'))); return `Copper: ${Game.player.coins}`; },
  },
  item: {
    usage: 'item <id> [qty]', help: 'Add an item by items.id', cheat: true,
    run: ([id, q]) => {
      if (!id || !DB.items[id]) {
        const hits = Object.keys(DB.items).filter((k) => !id || k.includes(id)).slice(0, 12);
        throw new Error(`Unknown item. ${hits.length ? 'Try: ' + hits.join(', ') : ''}`);
      }
      const qty = q ? Math.max(1, Math.floor(num(q, 'qty'))) : 1;
      P.addItem(Game.player, id, qty);
      return `+${qty} ${DB.items[id].name}`;
    },
  },
  hp: {
    usage: 'hp <n>', help: 'Set current HP', cheat: true,
    run: ([n]) => { const p = Game.player; p.hp = Math.max(1, Math.min(P.maxHp(p), num(n, 'n'))); return `HP ${Math.round(p.hp)}/${P.maxHp(p)}`; },
  },
  maxhp: {
    usage: 'maxhp <n>', help: 'Bonus max HP (0 to clear)', cheat: true,
    run: ([n]) => { const p = Game.player; p.cheats.maxHp = Math.floor(num(n, 'n')); p.hp = P.maxHp(p); return `Max HP ${P.maxHp(p)} (bonus ${p.cheats.maxHp})`; },
  },
  atk: {
    usage: 'atk <n>', help: 'Bonus attack (0 to clear)', cheat: true,
    run: ([n]) => { const p = Game.player; p.cheats.atk = Math.floor(num(n, 'n')); return `Attack ${P.attack(p)} (bonus ${p.cheats.atk})`; },
  },
  def: {
    usage: 'def <n>', help: 'Bonus defense (0 to clear)', cheat: true,
    run: ([n]) => { const p = Game.player; p.cheats.def = Math.floor(num(n, 'n')); return `Defense ${P.defense(p)} (bonus ${p.cheats.def})`; },
  },
  god: {
    usage: 'god', help: 'Toggle invulnerability', cheat: true,
    run: () => { const c = Game.player.cheats; c.god = !c.god; return `God mode ${c.god ? 'ON' : 'OFF'}`; },
  },
  heal: {
    usage: 'heal', help: 'Full HP and MP', cheat: true,
    run: () => { const p = Game.player; p.hp = P.maxHp(p); p.mp = P.maxMp(p); return 'Healed'; },
  },
  kill: {
    usage: 'kill', help: 'Kill all monsters in this area (XP + drops)', cheat: true,
    run: () => {
      const s = scene();
      let n = 0;
      for (const m of s.monsters) if (m.alive) { m.kill(); s.onKill(m); n++; }
      return `Killed ${n}`;
    },
  },
  tp: {
    usage: 'tp <area>', help: `Teleport (${Object.keys(AREAS).join(', ')})`, cheat: true,
    run: ([a]) => {
      const area = Object.keys(AREAS).find((k) => k === a || k.startsWith(a ?? '#'));
      if (!area) throw new Error(`Unknown area. Areas: ${Object.keys(AREAS).join(', ')}`);
      scene().travel(area);
      return `→ ${DB.areas[area]?.name ?? area}`;
    },
  },
  spawn: {
    usage: 'spawn <monsterId> [n]', help: 'Spawn monsters next to you', cheat: true,
    run: ([id, n]) => {
      if (!id || !DB.monsters[id]) throw new Error(`Unknown monster. Try: ${Object.keys(DB.monsters).join(', ')}`);
      const s = scene();
      const count = n ? Math.min(30, Math.max(1, Math.floor(num(n, 'n')))) : 1;
      for (let i = 0; i < count; i++) s.spawnMonster(id, s.player.x + 120 + i * 40);
      return `Spawned ${count} ${DB.monsters[id].name}`;
    },
  },
  droprate: {
    usage: 'droprate <multiplier>', help: 'Multiply all drop chances (1 = normal)', cheat: true,
    run: ([m]) => { const v = Math.max(0, num(m, 'multiplier')); Game.player.cheats.dropMul = v; return `Drop rate ×${v}`; },
  },
  reset: {
    usage: 'reset', help: 'Erase the save and restart',
    run: () => { clearSave(); setTimeout(() => location.reload(), 300); return 'Save erased, reloading…'; },
  },
};

/** Run one console line. Returns output text; throws on error. */
export function runCommand(line: string): string {
  const [name, ...args] = line.trim().split(/\s+/);
  if (!name) return '';
  const cmd = COMMANDS[name.toLowerCase()];
  if (!cmd) throw new Error(`Unknown command "${name}". Type help.`);
  const out = cmd.run(args);
  if (cmd.cheat) {
    Game.player.cheated = true;
    P.clampVitals(Game.player);
    Game.changed();
    if (name !== 'reset') Game.save();
  }
  return out;
}
