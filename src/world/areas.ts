/**
 * Level geometry for each map_layout area. Which monsters spawn and how many
 * come from data/map_layout.json (spawn_counts); this file only places things.
 *
 * v0.3.0 vertical levels (MapleStory style). Heights are in tiles above the base ground (the lowest floor).
 *  - blocks: solid terrain rising from the base ground (hills, mud banks, the cave floor). Half-tile steps are
 *    walked up automatically; higher steps are jumped.
 *  - platforms: one-way ledges. Jump up through them; down + jump drops through.
 *  - climbs: ladders, ropes, vines and root ladders (up / down to climb, jump to let go).
 *  - spawnZones: per monster, one or more stretches. A zone with `y` sits on the ledge or block top at that
 *    height and its mobs patrol only that surface; `n` is how many of the area's count go there.
 */
export interface Platform { x: number; y: number; w: number }
export interface Block { x: number; w: number; h: number }
export interface Climb { x: number; y0: number; y1: number; kind: 'ladder' | 'rope' | 'vine' | 'root' }
export interface SpawnZone { x: [number, number]; y?: number; n?: number; fly?: number }
export type Ambient = 'meadow' | 'hills' | 'river' | 'cave' | 'forest';

export interface AreaGeometry {
  widthTiles: number;
  /** World height in tiles (default: one screen). */
  heightTiles?: number;
  sky: number;
  ground: 'grass' | 'dirt' | 'moss';
  /** Far and near parallax hill colors. Defaults to meadow green. */
  hills?: [number, number];
  ambient?: Ambient;
  safe: boolean;
  spawnX: number; // default arrival x (px)
  chest?: number; // storage chest x (tiles)
  platforms: Platform[];
  blocks?: Block[];
  climbs?: Climb[];
  /** Water drawn over the base ground (purely visual). */
  water?: { x: number; w: number; kind: 'river' | 'bog' }[];
  decor: { slot: string; x: number; y?: number }[];
  npcs: { id: 'mara' | 'pell' | 'calden' | 'ila' | 'tamsin' | 'wren'; name: string; x: number; role: 'shop' | 'hint' | 'soon' | 'trainer' | 'exchange' | 'path' }[];
  portals: { x: number; dir: 'east' | 'west' | 'north' | 'south'; arriveX: number; y?: number; arriveY?: number }[];
  /** Where each monster type spawns. */
  spawnZones: Record<string, SpawnZone[]>;
  /** Practice post x (tiles). Meadow Town, east gate. */
  practicePost?: number;
  /** Named quest foes: spawned only while their kill-step is active. */
  namedSpawns?: { id: string; x: number; y?: number }[];
  /** Safe camp x-range (tiles): mobs do not aggro or chase into it. */
  camp?: [number, number];
  /** The Hollow (tiles): the Hollow Stag never leaves it. */
  arena?: [number, number];
}

export const AREAS: Record<string, AreaGeometry> = {
  meadow_town: {
    widthTiles: 44,
    sky: 0x9fd4f5,
    ground: 'grass',
    safe: true,
    spawnX: 260,
    chest: 15,
    platforms: [],
    decor: [
      { slot: 'deco.tree_round', x: 2 }, { slot: 'deco.house_red', x: 8 }, { slot: 'deco.sign', x: 12 }, { slot: 'deco.bush', x: 13 },
      { slot: 'deco.house_stone', x: 19 }, { slot: 'deco.hive', x: 24 }, { slot: 'deco.tree_tall', x: 25 },
      { slot: 'deco.house_red', x: 31 }, { slot: 'deco.fence', x: 39 }, { slot: 'deco.bush', x: 41 },
    ],
    npcs: [
      { id: 'mara', name: 'Mara (Shop)', x: 10, role: 'shop' },
      { id: 'calden', name: 'Calden (Trainer)', x: 21, role: 'trainer' },
      { id: 'ila', name: 'Ila (Exchange)', x: 27, role: 'exchange' },
      { id: 'pell', name: 'Pell', x: 36, role: 'hint' },
      { id: 'tamsin', name: 'Tamsin (Magician)', x: 32, role: 'path' },
    ],
    portals: [{ x: 42, dir: 'east', arriveX: 3 }],
    spawnZones: {},
    practicePost: 40,
  },

  // v0.3.0: the gentle starter field. Flat: open grass, a fence and one low ledge. No climbing.
  meadow_west: {
    widthTiles: 92,
    sky: 0xaee3ff,
    ground: 'grass',
    ambient: 'meadow',
    safe: false,
    spawnX: 3 * 32,
    platforms: [{ x: 48, y: 2, w: 6 }],
    decor: [
      { slot: 'deco.sign', x: 4 }, { slot: 'deco.tree_round', x: 14 }, { slot: 'deco.bush', x: 18 }, { slot: 'deco.fence', x: 28 },
      { slot: 'deco.tree_tall', x: 40 }, { slot: 'deco.tree_round', x: 60 }, { slot: 'deco.bush', x: 70 }, { slot: 'deco.fence', x: 78 },
      { slot: 'deco.tree_round', x: 84 }, { slot: 'deco.sign', x: 88 },
    ],
    npcs: [],
    portals: [{ x: 1, dir: 'west', arriveX: 40 }, { x: 90, dir: 'east', arriveX: 3 }],
    spawnZones: { field_mouse: [{ x: [8, 62] }], wool_sheep: [{ x: [20, 86] }] },
  },

  // v0.3.0: hilly. Ground: rolling slopes (Crows, Wool-Shoulder at the far end). Middle: terraces with
  // Meadow Boars, short ladders up from the hilltops. Top: the raised grove (rope) with the Old Stump and the
  // Whisperwood road behind it.
  meadow_east: {
    widthTiles: 140,
    heightTiles: 22,
    sky: 0xaee3ff,
    ground: 'grass',
    ambient: 'hills',
    safe: false,
    spawnX: 3 * 32,
    blocks: [
      { x: 12, w: 24, h: 0.5 }, { x: 15, w: 18, h: 1 }, { x: 19, w: 10, h: 1.5 },
      { x: 50, w: 28, h: 0.5 }, { x: 53, w: 22, h: 1 }, { x: 57, w: 14, h: 1.5 },
      { x: 92, w: 24, h: 0.5 }, { x: 95, w: 18, h: 1 }, { x: 99, w: 10, h: 1.5 },
    ],
    platforms: [
      { x: 18, y: 6, w: 16 }, { x: 54, y: 6, w: 22 }, { x: 94, y: 6, w: 18 },
      { x: 66, y: 11, w: 28 },
    ],
    climbs: [
      { x: 24, y0: 1.5, y1: 6, kind: 'ladder' },
      { x: 60, y0: 1.5, y1: 6, kind: 'ladder' },
      { x: 104, y0: 1.5, y1: 6, kind: 'ladder' },
      { x: 72, y0: 6, y1: 11, kind: 'rope' },
    ],
    decor: [
      { slot: 'deco.sign', x: 4 }, { slot: 'deco.bush', x: 9 }, { slot: 'deco.tree_round', x: 24, y: 1.5 }, { slot: 'deco.bush', x: 40 },
      { slot: 'deco.tree_tall', x: 64, y: 1.5 }, { slot: 'deco.fence', x: 84 }, { slot: 'deco.tree_round', x: 104, y: 1.5 },
      { slot: 'deco.bush', x: 121 }, { slot: 'deco.fence', x: 130 }, { slot: 'deco.sign', x: 136 },
      { slot: 'deco.tree_tall', x: 28, y: 6 }, { slot: 'deco.bush', x: 60, y: 6 }, { slot: 'deco.tree_round', x: 98, y: 6 },
      { slot: 'deco.tree_tall', x: 69, y: 11 }, { slot: 'deco.tree_round', x: 78, y: 11 }, { slot: 'deco.tree_tall', x: 86, y: 11 }, { slot: 'deco.sign', x: 89, y: 11 },
    ],
    npcs: [],
    portals: [
      { x: 1, dir: 'west', arriveX: 88 }, { x: 138, dir: 'east', arriveX: 3 },
      { x: 92, y: 11, dir: 'north', arriveX: 4 },
    ],
    spawnZones: {
      crow: [{ x: [30, 116] }],
      meadow_boar: [{ x: [19, 33], y: 6, n: 1 }, { x: [55, 75], y: 6, n: 2 }, { x: [95, 111], y: 6, n: 1 }],
      old_stump: [{ x: [74, 90], y: 11 }],
    },
    namedSpawns: [{ id: 'wool_shoulder', x: 128 }],
  },

  // v0.3.0: the riverbank. A shallow river along the bottom, mud shelves above it, high bank ledges tied
  // together with root ladders.
  dirt_banks_west: {
    widthTiles: 112,
    heightTiles: 20,
    sky: 0xd4c4a0,
    ground: 'dirt',
    hills: [0xc4a06a, 0xa88050],
    ambient: 'river',
    safe: false,
    spawnX: 3 * 32,
    water: [{ x: 7, w: 98, kind: 'river' }],
    platforms: [
      { x: 4, y: 2, w: 3 }, { x: 33, y: 2, w: 3 }, { x: 67, y: 2, w: 3 },
      { x: 8, y: 4, w: 22 }, { x: 37, y: 4, w: 26 }, { x: 71, y: 4, w: 30 },
      { x: 14, y: 8, w: 18 }, { x: 48, y: 8, w: 20 }, { x: 84, y: 8, w: 20 },
    ],
    climbs: [
      { x: 20, y0: 4, y1: 8, kind: 'root' },
      { x: 56, y0: 4, y1: 8, kind: 'root' },
      { x: 92, y0: 4, y1: 8, kind: 'root' },
    ],
    decor: [
      { slot: 'deco.sign', x: 4 }, { slot: 'deco.rock', x: 12, y: 4 }, { slot: 'deco.clod', x: 26, y: 4 }, { slot: 'deco.bush', x: 18, y: 8 },
      { slot: 'deco.rock', x: 44, y: 4 }, { slot: 'deco.clod', x: 60, y: 4 }, { slot: 'deco.tree_round', x: 62, y: 8 },
      { slot: 'deco.rock', x: 78, y: 4 }, { slot: 'deco.clod', x: 96, y: 4 }, { slot: 'deco.bush', x: 100, y: 8 }, { slot: 'deco.sign', x: 108 },
    ],
    npcs: [],
    portals: [{ x: 2, dir: 'west', arriveX: 136 }, { x: 110, dir: 'east', arriveX: 3 }],
    spawnZones: {
      burrow_mole: [{ x: [8, 104], n: 4 }, { x: [38, 62], y: 4, n: 2 }],
      earth_sprite: [{ x: [9, 29], y: 4, n: 1 }, { x: [72, 100], y: 4, n: 1 }, { x: [15, 31], y: 8, n: 1 }, { x: [49, 67], y: 8, n: 1 }, { x: [85, 103], y: 8, n: 1 }],
    },
  },

  // v0.3.0: a cave. The base ground is the lower pit (Bank-Cracker's den); the cave floor is solid rock four
  // tiles up; upper galleries hang from ropes (Cinderback on the east gallery).
  dirt_banks_east: {
    widthTiles: 112,
    heightTiles: 20,
    sky: 0x2a2230,
    ground: 'dirt',
    hills: [0x3a3040, 0x4a3a44],
    ambient: 'cave',
    safe: false,
    spawnX: 3 * 32,
    blocks: [{ x: 0, w: 60, h: 4 }, { x: 80, w: 32, h: 4 }],
    platforms: [
      { x: 8, y: 9, w: 22 }, { x: 42, y: 9, w: 16 }, { x: 86, y: 9, w: 20 },
      { x: 60, y: 4, w: 3 }, { x: 77, y: 4, w: 3 }, // plank ledges over the pit, at the rope tops
    ],
    climbs: [
      { x: 61.5, y0: 0, y1: 4, kind: 'rope' }, { x: 78.5, y0: 0, y1: 4, kind: 'rope' },
      { x: 18, y0: 4, y1: 9, kind: 'rope' }, { x: 50, y0: 4, y1: 9, kind: 'rope' }, { x: 96, y0: 4, y1: 9, kind: 'rope' },
    ],
    decor: [
      { slot: 'deco.sign', x: 4, y: 4 }, { slot: 'deco.rock', x: 12, y: 4 }, { slot: 'deco.clod', x: 30, y: 4 }, { slot: 'deco.rock', x: 44, y: 4 },
      { slot: 'deco.rock', x: 66 }, { slot: 'deco.clod', x: 73 }, { slot: 'deco.rock', x: 88, y: 4 }, { slot: 'deco.clod', x: 104, y: 4 },
      { slot: 'deco.rock', x: 24, y: 9 }, { slot: 'deco.rock', x: 100, y: 9 },
    ],
    npcs: [],
    portals: [{ x: 2, y: 4, dir: 'west', arriveX: 108 }, { x: 110, y: 4, dir: 'east', arriveX: 3 }],
    spawnZones: {
      ember_beetle: [{ x: [6, 56], y: 4, n: 2 }, { x: [84, 106], y: 4, n: 1 }, { x: [9, 29], y: 9, n: 1 }, { x: [43, 57], y: 9, n: 1 }],
      spark_bug: [{ x: [20, 56], y: 4, n: 2 }, { x: [82, 106], y: 4, n: 1 }, { x: [87, 105], y: 9, n: 1 }],
    },
    namedSpawns: [{ id: 'bank_cracker', x: 70 }, { id: 'cinderback', x: 100, y: 9 }],
  },

  // v0.3.0: the misty forest north of Meadow East. Wren's camp at the west edge; the forest floor (a raised
  // mossy bank) runs east into the lower bog; the Hollow is past the bog. The canopy is three tiers of branches.
  whisperwood: {
    widthTiles: 182,
    heightTiles: 24,
    sky: 0x5f7f78,
    ground: 'moss',
    hills: [0x4c6a5e, 0x3e5a4c],
    ambient: 'forest',
    safe: false,
    spawnX: 4 * 32,
    camp: [0, 15],
    arena: [152, 180],
    blocks: [{ x: 0, w: 110, h: 1 }],
    water: [{ x: 112, w: 38, kind: 'bog' }],
    platforms: [
      { x: 20, y: 5, w: 16 }, { x: 38, y: 5, w: 16 }, { x: 56, y: 5, w: 16 }, { x: 74, y: 5, w: 16 }, { x: 92, y: 5, w: 12 },
      { x: 26, y: 9, w: 16 }, { x: 44, y: 9, w: 16 }, { x: 62, y: 9, w: 16 }, { x: 80, y: 9, w: 14 },
      { x: 36, y: 13, w: 14 }, { x: 52, y: 13, w: 16 }, { x: 70, y: 13, w: 14 },
    ],
    climbs: [
      { x: 22, y0: 1, y1: 5, kind: 'vine' }, { x: 100, y0: 1, y1: 5, kind: 'vine' },
      { x: 40, y0: 5, y1: 9, kind: 'rope' }, { x: 84, y0: 5, y1: 9, kind: 'rope' },
      { x: 46, y0: 9, y1: 13, kind: 'vine' }, { x: 74, y0: 9, y1: 13, kind: 'rope' },
    ],
    decor: [
      { slot: 'deco.tent', x: 5, y: 1 }, { slot: 'deco.campfire', x: 12, y: 1 }, { slot: 'deco.sign', x: 15, y: 1 },
      { slot: 'deco.old_tree', x: 30, y: 1 }, { slot: 'deco.fern', x: 36, y: 1 }, { slot: 'deco.mushroom', x: 48, y: 1 }, { slot: 'deco.old_tree', x: 64, y: 1 },
      { slot: 'deco.fern', x: 72, y: 1 }, { slot: 'deco.mushroom', x: 86, y: 1 }, { slot: 'deco.old_tree', x: 96, y: 1 }, { slot: 'deco.fern', x: 106, y: 1 },
      { slot: 'deco.reeds', x: 116 }, { slot: 'deco.reeds', x: 128 }, { slot: 'deco.dead_tree', x: 138 }, { slot: 'deco.reeds', x: 146 },
      { slot: 'deco.dead_tree', x: 153 }, { slot: 'deco.dead_tree', x: 160 }, { slot: 'deco.dead_tree', x: 172 }, { slot: 'deco.dead_tree', x: 179 },
      { slot: 'deco.mushroom', x: 30, y: 9 }, { slot: 'deco.fern', x: 66, y: 9 }, { slot: 'deco.mushroom', x: 58, y: 13 },
    ],
    npcs: [{ id: 'wren', name: 'Wren (Woodwarden)', x: 9, role: 'hint' }],
    portals: [{ x: 1, y: 1, dir: 'south', arriveX: 90, arriveY: 11 }],
    spawnZones: {
      wisp: [{ x: [18, 80], y: 1, n: 6, fly: 2.2 }, { x: [45, 59], y: 9, n: 1, fly: 1.6 }, { x: [37, 49], y: 13, n: 1, fly: 1.6 }, { x: [71, 83], y: 13, n: 1, fly: 1.6 }],
      thornling: [{ x: [56, 108], y: 1 }],
      mire_toad: [{ x: [113, 148] }],
      moss_lurker: [{ x: [57, 71], y: 5, n: 1 }, { x: [75, 89], y: 5, n: 1 }, { x: [27, 41], y: 9, n: 1 }, { x: [63, 77], y: 9, n: 1 }, { x: [53, 67], y: 13, n: 1 }],
      hollow_stag: [{ x: [158, 174] }],
    },
  },
};

/** Old area ids (before v0.3.0) → the half a save lands in. */
export const AREA_ALIAS: Record<string, string> = { sunny_pasture: 'meadow_west', dirt_banks: 'dirt_banks_west' };
