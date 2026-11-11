/**
 * Level geometry for each map_layout area. Which monsters spawn and how many
 * come from data/map_layout.json (spawn_counts); this file only places things.
 */
export interface AreaGeometry {
  widthTiles: number;
  sky: number;
  ground: 'grass' | 'dirt';
  safe: boolean;
  spawnX: number; // default arrival x
  platforms: { x: number; y: number; w: number }[]; // tile coords: x, height above ground, width
  decor: { slot: string; x: number }[];
  npcs: { id: 'mara' | 'pell' | 'calden' | 'ila'; name: string; x: number; role: 'shop' | 'hint' | 'soon' }[];
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
    platforms: [],
    decor: [
      { slot: 'deco.house', x: 6 }, { slot: 'deco.house', x: 17 }, { slot: 'deco.well', x: 24 },
      { slot: 'deco.house', x: 30 }, { slot: 'deco.fence', x: 38 }, { slot: 'deco.fence', x: 39 },
    ],
    npcs: [
      { id: 'mara', name: 'Mara (Shop)', x: 10, role: 'shop' },
      { id: 'calden', name: 'Calden (Trainer)', x: 21, role: 'soon' },
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
      { x: 22, y: 3, w: 6 }, { x: 46, y: 3, w: 5 }, { x: 52, y: 6, w: 4 }, { x: 78, y: 3, w: 6 },
      { x: 98, y: 3, w: 5 }, { x: 104, y: 6, w: 5 },
    ],
    decor: [
      { slot: 'deco.tree', x: 14 }, { slot: 'deco.fence', x: 30 }, { slot: 'deco.fence', x: 31 },
      { slot: 'deco.tree', x: 60 }, { slot: 'deco.tree', x: 88 }, { slot: 'deco.fence', x: 112 }, { slot: 'deco.tree', x: 120 },
    ],
    npcs: [],
    portals: [{ x: 1, dir: 'west', arriveX: 40 }, { x: 128, dir: 'east', arriveX: 3 }],
    spawnZones: { field_mouse: [8, 55], wool_sheep: [25, 80], crow: [85, 124] },
  },
};
