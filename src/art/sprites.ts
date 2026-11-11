/**
 * SPRITE REGISTRY — the only place that knows what things look like.
 *
 * Game logic refers to art by slot key (e.g. "monster.field_mouse") and never by
 * file name or color. Each slot has a FIXED logical size (w × h, in px) that the
 * physics bodies and UI are built around. To swap placeholder shapes for real art
 * (Kenney pixel art, anime-style sheets, ...), set `file` on a slot (an image in
 * /public/art/... sized to w × h, or a spritesheet with frameW/frameH) — no game
 * code has to change.
 */
export interface SpriteSlot {
  w: number;
  h: number;
  /** Placeholder fill color (used when no file is set). */
  color: number;
  shape?: 'rect' | 'circle' | 'roundrect';
  /** Optional real art. Path relative to /public. */
  file?: string;
  frameW?: number;
  frameH?: number;
}

export const SPRITES: Record<string, SpriteSlot> = {
  // Characters
  'player.warrior': { w: 32, h: 48, color: 0x3b6fd8, shape: 'roundrect' },
  'npc.mara': { w: 32, h: 48, color: 0xd88a3b, shape: 'roundrect' },
  'npc.pell': { w: 32, h: 48, color: 0x6aa84f, shape: 'roundrect' },
  'npc.calden': { w: 32, h: 48, color: 0x8e7cc3, shape: 'roundrect' },
  'npc.ila': { w: 32, h: 48, color: 0x45a5a5, shape: 'roundrect' },

  // Monsters (one slot per monsters.id)
  'monster.field_mouse': { w: 30, h: 20, color: 0x9c8b7a, shape: 'roundrect' },
  'monster.wool_sheep': { w: 46, h: 34, color: 0xf2f2ee, shape: 'roundrect' },
  'monster.crow': { w: 30, h: 24, color: 0x2b2b33, shape: 'roundrect' },
  'monster.burrow_mole': { w: 34, h: 24, color: 0x5a4636, shape: 'roundrect' },
  'monster.default': { w: 32, h: 32, color: 0xcc3355, shape: 'roundrect' },

  // World
  'tile.grass': { w: 32, h: 32, color: 0x5fae4a },
  'tile.dirt': { w: 32, h: 32, color: 0x8a6440 },
  'tile.platform': { w: 32, h: 16, color: 0x9a7b4f },
  'deco.house': { w: 128, h: 112, color: 0xb98a5a },
  'deco.tree': { w: 64, h: 112, color: 0x3f8a3a, shape: 'roundrect' },
  'deco.fence': { w: 32, h: 20, color: 0xc9a46a },
  'deco.well': { w: 48, h: 48, color: 0x8899aa, shape: 'roundrect' },
  'portal': { w: 40, h: 72, color: 0xffe08a, shape: 'roundrect' },

  // Effects
  'fx.slash': { w: 64, h: 40, color: 0xffffff, shape: 'roundrect' },

  // Ground drops (one generic per item type; per-item overrides allowed as drop.<item_id>)
  'drop.copper_coin': { w: 14, h: 14, color: 0xf2c94c, shape: 'circle' },
  'drop.currency': { w: 14, h: 14, color: 0x9b51e0, shape: 'circle' },
  'drop.consumable': { w: 12, h: 16, color: 0xeb5757, shape: 'roundrect' },
  'drop.material': { w: 14, h: 14, color: 0xa0825a },
  'drop.misc': { w: 14, h: 14, color: 0xbdbdbd },
  'drop.gear': { w: 16, h: 16, color: 0x56ccf2 },
  'drop.rare': { w: 16, h: 16, color: 0xff9f1c, shape: 'circle' },
};

/** Which sprite slot a ground drop uses. */
export function dropSlot(itemId: string, itemType: string, rare: boolean): string {
  if (SPRITES[`drop.${itemId}`]) return `drop.${itemId}`;
  if (rare) return 'drop.rare';
  return SPRITES[`drop.${itemType}`] ? `drop.${itemType}` : 'drop.misc';
}

export function monsterSlot(monsterId: string): string {
  return SPRITES[`monster.${monsterId}`] ? `monster.${monsterId}` : 'monster.default';
}
