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
  'npc.tamsin': char('npc_tamsin', 48, 48, 0x4a6ad0, [10, 14, 3, 2]),
  'npc.wren': char('npc_wren', 48, 48, 0x4a7a40, [10, 14, 3, 2]), // v0.3.0 (Pell's sprite in woodwarden green)

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
  // v0.3.1: the Angry Bull (old Meadow Boar art, darker, a bit bigger) and the new Boar (scripts/draw-art-v031.py).
  'monster.angry_bull': char('monster_angry_bull', 58, 58, 0x5a2a1a, [14, 11, 1, 4]),
  'monster.boar': char('monster_boar', 44, 44, 0x7a5232, [14, 9, 1, 6], { frameW: 16, frameH: 16 }),
  // v0.3.0 (scripts/draw-art-v030.py). Frames: 0/1 idle-move, 2 wind-up; Lurker 3 = mound; Stag 2-4 = charge/stomp/sweep.
  'monster.old_stump': char('monster_old_stump', 84, 84, 0x7a5a3a, [16, 17, 4, 6], { frameW: 24, frameH: 24 }),
  'monster.wisp': char('monster_wisp', 40, 40, 0xbfefff, [10, 12, 3, 2], { frameW: 16, frameH: 16 }),
  'monster.thornling': char('monster_thornling', 42, 42, 0x8a6a3a, [10, 14, 3, 1], { frameW: 16, frameH: 16 }),
  'monster.moss_lurker': char('monster_moss_lurker', 60, 48, 0x4a7a30, [15, 11, 2, 4], { frameW: 20, frameH: 16 }),
  'monster.mire_toad': char('monster_mire_toad', 60, 48, 0x6a8a3a, [17, 11, 1, 4], { frameW: 20, frameH: 16 }),
  'monster.hollow_stag': char('monster_hollow_stag', 128, 128, 0x8a8478, [20, 18, 4, 13], { frameW: 32, frameH: 32 }),
  'monster.default': { w: 32, h: 32, color: 0xcc3355, shape: 'roundrect' },

  // World
  'tile.grass_top': { w: 36, h: 36, color: 0x5fae4a, file: `${A}world/grass_top.png` },
  'tile.dirt_top': { w: 36, h: 36, color: 0x9a7048, file: `${A}world/dirt_top.png` },
  'tile.dirt': { w: 36, h: 36, color: 0x8a6440, file: `${A}world/dirt.png` },
  'tile.platform': { w: 32, h: 16, color: 0x9a7b4f, file: `${A}world/platform.png` },
  'tile.moss_top': { w: 36, h: 36, color: 0x3e6a3a, file: `${A}world/moss_top.png` },
  'tile.branch': { w: 32, h: 16, color: 0x5a4a3a, file: `${A}world/branch.png` },
  'deco.tent': { w: 84, h: 70, color: 0xa89060, file: `${A}world/tent.png` },
  'deco.campfire': { w: 44, h: 44, color: 0xf08030, file: `${A}world/campfire.png` },
  'deco.old_tree': { w: 110, h: 165, color: 0x3e6a3a, file: `${A}world/old_tree.png` },
  'deco.dead_tree': { w: 80, h: 134, color: 0x8a8478, file: `${A}world/dead_tree.png` },
  'deco.fern': { w: 48, h: 36, color: 0x5f9a3a, file: `${A}world/fern.png` },
  'deco.mushroom': { w: 30, h: 30, color: 0x8ad0c0, file: `${A}world/mushroom.png` },
  'deco.reeds': { w: 36, h: 48, color: 0x6a8a3a, file: `${A}world/reeds.png` },
  'deco.house_red': { w: 192, h: 144, color: 0xb98a5a, file: `${A}world/house_red.png` },
  'deco.house_stone': { w: 192, h: 144, color: 0x8899aa, file: `${A}world/house_stone.png` },
  'deco.tree_round': { w: 72, h: 72, color: 0x3f8a3a, file: `${A}world/tree_round.png` },
  'deco.tree_tall': { w: 64, h: 80, color: 0x3f8a3a, file: `${A}world/tree_tall.png` },
  'deco.bush': { w: 40, h: 40, color: 0x4f9a3f, file: `${A}world/bush.png` },
  'deco.fence': { w: 96, h: 32, color: 0xc9a46a, file: `${A}world/fence.png` },
  'deco.sign': { w: 36, h: 36, color: 0xc9a46a, file: `${A}world/sign.png` },
  'deco.hive': { w: 32, h: 32, color: 0xe0b040, file: `${A}world/hive.png` },
  'deco.rock': { w: 40, h: 36, color: 0x888070, file: `${A}world/rock.png` },
  'deco.clod': { w: 44, h: 32, color: 0x8a6440, file: `${A}world/clod.png` },
  'deco.chest': { w: 40, h: 40, color: 0xa0703a, file: `${A}world/chest.png` },
  'deco.chest_open': { w: 40, h: 40, color: 0xa0703a, file: `${A}world/chest_open.png` },
  'deco.practice_post': { w: 40, h: 72, color: 0xc9a46a, file: `${A}world/practice_post.png` },
  portal: { w: 40, h: 80, color: 0xffe08a, shape: 'roundrect', file: `${A}world/portal.png` },

  // Effects
  'fx.slash': { w: 64, h: 40, color: 0xffffff, shape: 'roundrect' },
  'fx.sword': { w: 36, h: 36, color: 0xdddddd, file: `${A}fx/sword.png` },
  'fx.pebble': { w: 22, h: 22, color: 0x777777, shape: 'circle', file: `${A}fx/pebble.png` },
  'fx.mote': { w: 16, h: 16, color: 0xbfefff, shape: 'circle', file: `${A}fx/mote.png` },
  'fx.thorn': { w: 24, h: 12, color: 0x8ac050, file: `${A}fx/thorn.png` },
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
export function skillIconUrl(skillId: string): string {
  return `art/icons/skill_${skillId}.png`;
}
const NAMED_ALIAS: Record<string, string> = {
  wool_shoulder: 'monster.wool_sheep',
  bank_cracker: 'monster.burrow_mole',
  cinderback: 'monster.ember_beetle',
};
export function monsterSlot(monsterId: string): string {
  if (NAMED_ALIAS[monsterId]) return NAMED_ALIAS[monsterId];
  return SPRITES[`monster.${monsterId}`] ? `monster.${monsterId}` : 'monster.default';
}
