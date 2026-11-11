/**
 * SPRITE REGISTRY — the only place that knows what things look like.
 *
 * Game logic refers to art by slot key (e.g. "monster.field_mouse") and never by file
 * name. Each slot has a FIXED display size (w × h, in px) that physics bodies and UI are
 * built around; the art file is scaled to fit it. To swap art (e.g. anime style later),
 * replace the file or point `file` at a new one — no game code changes.
 *
 * Current art: CC0 pixel art from Kenney (kenney.nl) and Tiny Creatures by Clint
 * Bellanger, built by scripts/build-art.py into public/art/. See CREDITS.md.
 */
import { DB } from '../data/db';

export interface SpriteSlot {
  /** Fixed display size in px. */
  w: number;
  h: number;
  /** Placeholder color (used when no file is set or it fails to load). */
  color: number;
  shape?: 'rect' | 'circle' | 'roundrect';
  /** Art file, relative to the site root (public/). */
  file?: string;
  /** Spritesheet frame size in source px (omit for single images). */
  frameW?: number;
  frameH?: number;
  /** Physics body in SOURCE px (before scaling): width, height, offsetX, offsetY. */
  body?: [number, number, number, number];
}

const A = 'art/';
const char = (file: string, w: number, h: number, color: number, body: SpriteSlot['body'], extra: Partial<SpriteSlot> = {}): SpriteSlot =>
  ({ w, h, color, shape: 'roundrect', file: `${A}chars/${file}.png`, body, ...extra });

export const SPRITES: Record<string, SpriteSlot> = {
  // Characters (16×16 source art)
  'player.warrior': char('player_warrior', 48, 48, 0x3b6fd8, [10, 14, 3, 2]),
  'npc.mara': char('npc_mara', 48, 48, 0xd88a3b, [10, 14, 3, 2]),
  'npc.pell': char('npc_pell', 48, 48, 0x6aa84f, [10, 14, 3, 2]),
  'npc.calden': char('npc_calden', 48, 48, 0x8e7cc3, [10, 14, 3, 2]),
  'npc.ila': char('npc_ila', 48, 48, 0x45a5a5, [10, 14, 3, 2]),

  // Monsters (one slot per monsters.id)
  'monster.field_mouse': char('monster_field_mouse', 36, 36, 0x9c8b7a, [12, 10, 2, 4]),
  'monster.wool_sheep': char('monster_wool_sheep', 48, 48, 0xf2f2ee, [14, 11, 1, 3]),
  'monster.crow': char('monster_crow', 36, 36, 0x2b2b33, [10, 10, 3, 4], { frameW: 16, frameH: 16 }),
  'monster.burrow_mole': char('monster_burrow_mole', 40, 40, 0x5a4636, [12, 11, 2, 4]),
  'monster.earth_sprite': char('monster_earth_sprite', 44, 44, 0x8a6a40, [12, 13, 2, 3]),
  'monster.ember_beetle': char('monster_ember_beetle', 40, 40, 0xd8602a, [12, 10, 2, 5]),
  'monster.frost_moth': char('monster_frost_moth', 40, 40, 0xbfe8ff, [10, 12, 3, 3]),
  'monster.spark_bug': char('monster_spark_bug', 36, 36, 0xf0d040, [10, 10, 3, 4]),
  'monster.shrine_wisp': char('monster_shrine_wisp', 36, 36, 0x9fe0ff, [10, 10, 3, 3]),
  'monster.dusk_wisp': char('monster_dusk_wisp', 36, 36, 0x8a5ad0, [10, 10, 3, 3]),
  'monster.meadow_boar': char('monster_meadow_boar', 52, 52, 0x7a5a40, [14, 11, 1, 4]),
  'monster.default': { w: 32, h: 32, color: 0xcc3355, shape: 'roundrect' },

  // World
  'tile.grass_top': { w: 36, h: 36, color: 0x5fae4a, file: `${A}world/grass_top.png` },
  'tile.dirt': { w: 36, h: 36, color: 0x8a6440, file: `${A}world/dirt.png` },
  'tile.platform': { w: 32, h: 16, color: 0x9a7b4f, file: `${A}world/platform.png` },
  'deco.house_red': { w: 192, h: 144, color: 0xb98a5a, file: `${A}world/house_red.png` },
  'deco.house_stone': { w: 192, h: 144, color: 0x8899aa, file: `${A}world/house_stone.png` },
  'deco.tree_round': { w: 72, h: 72, color: 0x3f8a3a, file: `${A}world/tree_round.png` },
  'deco.tree_tall': { w: 64, h: 80, color: 0x3f8a3a, file: `${A}world/tree_tall.png` },
  'deco.bush': { w: 40, h: 40, color: 0x4f9a3f, file: `${A}world/bush.png` },
  'deco.fence': { w: 96, h: 32, color: 0xc9a46a, file: `${A}world/fence.png` },
  'deco.sign': { w: 36, h: 36, color: 0xc9a46a, file: `${A}world/sign.png` },
  'deco.hive': { w: 32, h: 32, color: 0xe0b040, file: `${A}world/hive.png` },
  'deco.chest': { w: 40, h: 40, color: 0xa0703a, file: `${A}world/chest.png` },
  'deco.chest_open': { w: 40, h: 40, color: 0xa0703a, file: `${A}world/chest_open.png` },
  portal: { w: 40, h: 80, color: 0xffe08a, shape: 'roundrect', file: `${A}world/portal.png` },

  // Effects
  'fx.slash': { w: 64, h: 40, color: 0xffffff, shape: 'roundrect' },
  'fx.sword': { w: 36, h: 36, color: 0xdddddd, file: `${A}fx/sword.png` },
  'fx.pebble': { w: 22, h: 22, color: 0x777777, shape: 'circle', file: `${A}fx/pebble.png` },
  'fx.glow': { w: 16, h: 16, color: 0x7dff9b, shape: 'circle' },
};

/** Item icons: one slot per items.id (18×18 source, shown at ICON_SIZE in menus). */
export const ICON_SIZE = 36;
export const DROP_SIZE = 26;
for (const id of Object.keys(DB.items)) {
  SPRITES[`icon.${id}`] = { w: DROP_SIZE, h: DROP_SIZE, color: 0xbdbdbd, file: `${A}icons/${id}.png` };
}

export function iconKey(itemId: string): string {
  return SPRITES[`icon.${itemId}`] ? `icon.${itemId}` : 'fx.glow';
}
/** URL for DOM <img> icons (same files as the in-world textures). */
export function iconUrl(itemId: string): string {
  return SPRITES[`icon.${itemId}`]?.file ?? '';
}
export function monsterSlot(monsterId: string): string {
  return SPRITES[`monster.${monsterId}`] ? `monster.${monsterId}` : 'monster.default';
}
