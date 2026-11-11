/**
 * Test/cheat console commands (enabled by DEV_CONSOLE in src/config.ts).
 * Any command that changes the game marks the save as `cheated`.
 */
import { DB, f, xpToNext } from '../data/db';
import * as Sk from './Skills';
import { whoDrops, isGear, displayName, makeGear } from './Gear';
import { AREAS } from '../world/areas';
import { Game } from './GameState';
import { resetAndReload } from './Save';
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
  whodrops: {
    usage: 'whodrops <item>', help: 'List monsters (and area) that drop an item, with chance and qty. Partial names ok.',
    run: ([...parts]) => {
      const q = parts.join(' ');
      if (!q) throw new Error('Usage: whodrops <item id or name>');
      return whoDrops(q);
    },
  },
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
    usage: 'level <n>', help: 'Set level (grants/removes ability points per level)', cheat: true,
    run: ([n]) => {
      const p = Game.player;
      const target = Math.max(1, Math.floor(num(n, 'n')));
      const delta = target - p.level;
      p.level = target;
      p.xp = 0;
      p.unspent = Math.max(0, p.unspent + delta * f('player_points_per_level'));
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
    run: ([id, q, flag]) => {
      if (!id || !DB.items[id]) {
        const hits = Object.keys(DB.items).filter((k) => !id || k.includes(id)).slice(0, 12);
        throw new Error(`Unknown item. ${hits.length ? 'Try: ' + hits.join(', ') : ''}`);
      }
      const magic = q === 'magic' || flag === 'magic';
      const qty = q && q !== 'magic' ? Math.max(1, Math.floor(num(q, 'qty'))) : 1;
      if (isGear(id)) {
        const names: string[] = [];
        for (let i = 0; i < qty; i++) {
          const g = makeGear(id, { mode: 'random', magic: magic ? true : undefined });
          P.addGear(Game.player, g);
          names.push(displayName(g));
        }
        return `+${qty} ${names.join(', ')}`;
      }
      P.addItem(Game.player, id, qty);
      return `+${qty} ${DB.items[id].name}`;
    },
  },
  rank: {
    usage: 'rank <skill> [n]', help: 'Set a skill rank (default +1, 0-10)', cheat: true,
    run: ([id, n]) => {
      const hits = Object.keys(DB.skills).filter((k) => !id || k.includes(id) || DB.skills[k].name.toLowerCase().includes((id ?? '').toLowerCase()));
      if (!id || !DB.skills[id]) throw new Error(`Unknown skill. Try: ${hits.slice(0, 8).join(', ')}`);
      const p = Game.player;
      const cur = Sk.rankOf(p, id);
      const target = n == null ? cur + 1 : Math.max(0, Math.min(DB.skills[id].max_rank ?? 10, Math.floor(num(n, 'n'))));
      p.skillRanks[id] = target;
      if (target >= 1 && DB.skills[id].branch !== 'basic') {
        const bar = Sk.barOf(p);
        if (!bar.includes(id)) { const i = bar.findIndex((x) => !x); if (i >= 0) bar[i] = id; }
      }
      return `${DB.skills[id].name} rank ${target} (${Sk.rankPreview(id, target)})`;
    },
  },
  train: {
    usage: 'train <skill>', help: 'Pay the real cost and train the next rank', cheat: true,
    run: ([id]) => {
      if (!id || !DB.skills[id]) throw new Error('Unknown skill (see rank)');
      const err = Sk.train(Game.player, id);
      if (err) throw new Error(err);
      return `Trained ${DB.skills[id].name} to rank ${Sk.rankOf(Game.player, id)}`;
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
    run: () => { resetAndReload(); return 'Save erased, reloading…'; },
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
