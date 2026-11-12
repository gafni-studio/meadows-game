/**
 * Level geometry for each map_layout area. Which monsters spawn and how many
 * come from data/map_layout.json (spawn_counts); this file only places things.
 */
export interface AreaGeometry {
  widthTiles: number;
  sky: number;
  ground: 'grass' | 'dirt';
  /** Far and near parallax hill colors. Defaults to meadow green. */
  hills?: [number, number];
  safe: boolean;
  spawnX: number; // default arrival x
  chest?: number; // storage chest x (tiles)
  platforms: { x: number; y: number; w: number }[]; // tile coords: x, height above ground, width
  decor: { slot: string; x: number }[];
  npcs: { id: 'mara' | 'pell' | 'calden' | 'ila'; name: string; x: number; role: 'shop' | 'hint' | 'soon' | 'trainer' }[];
  portals: { x: number; dir: 'east' | 'west'; arriveX: number }[];
  /** x-ranges (tiles) where each monster type spawns. */
  spawnZones: Record<string, [number, number]>;
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
      { id: 'ila', name: 'Ila (Exchange)', x: 27, role: 'soon' },
      { id: 'pell', name: 'Pell', x: 36, role: 'hint' },
    ],
    portals: [{ x: 42, dir: 'east', arriveX: 3 }],
    spawnZones: {},
  },
  sunny_pasture: {
    widthTiles: 130,
    sky: 0xaee3ff,
    ground: 'grass',
    safe: false,
    spawnX: 3 * 32,
    platforms: [
      // v0.1.2: lowered for the lower jump (≈71px): 2 tiles from the ground, 4 tiles from a 2-tile platform.
      { x: 22, y: 2, w: 6 }, { x: 46, y: 2, w: 5 }, { x: 52, y: 4, w: 4 }, { x: 78, y: 2, w: 6 },
      { x: 98, y: 2, w: 5 }, { x: 104, y: 4, w: 5 },
    ],
    decor: [
      { slot: 'deco.sign', x: 4 }, { slot: 'deco.tree_round', x: 14 }, { slot: 'deco.bush', x: 18 }, { slot: 'deco.fence', x: 31 },
      { slot: 'deco.tree_tall', x: 40 }, { slot: 'deco.tree_round', x: 60 }, { slot: 'deco.bush', x: 70 }, { slot: 'deco.tree_tall', x: 88 },
      { slot: 'deco.fence', x: 112 }, { slot: 'deco.tree_round', x: 120 }, { slot: 'deco.bush', x: 125 },
    ],
    npcs: [],
    portals: [{ x: 1, dir: 'west', arriveX: 40 }, { x: 128, dir: 'east', arriveX: 3 }],
    spawnZones: { field_mouse: [8, 55], wool_sheep: [25, 80], crow: [85, 124] },
  },
  dirt_banks: {
    widthTiles: 114,
    sky: 0xd4c4a0,
    ground: 'dirt',
    hills: [0xc4a06a, 0xa88050],
    safe: false,
    spawnX: 3 * 32,
    platforms: [
      { x: 16, y: 2, w: 6 }, { x: 36, y: 2, w: 5 }, { x: 42, y: 4, w: 4 },
      { x: 62, y: 2, w: 6 }, { x: 84, y: 2, w: 5 }, { x: 90, y: 4, w: 5 },
    ],
    decor: [
      { slot: 'deco.sign', x: 4 }, { slot: 'deco.rock', x: 10 }, { slot: 'deco.clod', x: 13 },
      { slot: 'deco.bush', x: 22 }, { slot: 'deco.rock', x: 28 }, { slot: 'deco.clod', x: 34 },
      { slot: 'deco.tree_round', x: 48 }, { slot: 'deco.rock', x: 55 }, { slot: 'deco.clod', x: 68 },
      { slot: 'deco.bush', x: 74 }, { slot: 'deco.rock', x: 80 }, { slot: 'deco.clod', x: 97 },
      { slot: 'deco.bush', x: 102 }, { slot: 'deco.rock', x: 108 }, { slot: 'deco.sign', x: 111 },
    ],
    npcs: [],
    // west arrives just inside the pasture's east portal (at tile 128); east is Meadow Shrine (not yet open).
    portals: [{ x: 2, dir: 'west', arriveX: 126 }, { x: 112, dir: 'east', arriveX: 3 }],
    spawnZones: { burrow_mole: [8, 70], earth_sprite: [30, 90], ember_beetle: [70, 108] },
  },
};
