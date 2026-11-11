#!/usr/bin/env python3
"""
Build game-ready sprites from the vendored CC0 packs in art-src/ into public/art/.

Sources (all CC0 1.0, see CREDITS.md):
  pp = Kenney Pixel Platformer (18x18)        tt = Kenney Tiny Town (16x16)
  td = Kenney Tiny Dungeon (16x16)            fa = Kenney Pixel Platformer Farm Expansion (18x18)
  tc = Tiny Creatures by Clint Bellanger (16x16, Kenney Tiny style)

Output is native-resolution PNGs. The game scales them to each sprite slot's fixed
size (src/art/sprites.ts), so swapping art later only means replacing these files.
Run: python3 scripts/build-art.py   (needs Pillow)
"""
import colorsys, json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = {
    'pp': 'pixel-platformer/Tiles', 'tt': 'tiny-town/Tiles', 'td': 'tiny-dungeon/Tiles',
    'fa': 'pixel-platformer-farm-expansion/Tiles', 'tc': 'tiny-creatures/Tiles',
}
OUT = os.path.join(ROOT, 'public', 'art')


def tile(ref):
    pack, num = ref[:2], int(ref[2:])
    im = Image.open(os.path.join(ROOT, 'art-src', SRC[pack], f'tile_{num:04d}.png')).convert('RGBA')
    return clear_bg(im) if pack == 'tc' else im


def clear_bg(im):
    """Tiny Creatures tiles ship with an opaque background; flood-fill it away from the corners."""
    im = im.copy(); px = im.load(); w, h = im.size
    bg = px[0, 0]
    if bg[3] == 0: return im
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    seen = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        seen.add((x, y))
        if px[x, y][:3] != bg[:3]: continue
        px[x, y] = (0, 0, 0, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im


def save(im, *parts):
    p = os.path.join(OUT, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)


def hue(im, deg, sat=1.0, val=1.0):
    """Recolor non-outline pixels to a hue (keeps dark outline and shading)."""
    im = im.copy(); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v < 0.3: continue  # outline
            r2, g2, b2 = colorsys.hsv_to_rgb(deg / 360, min(1, max(s, 0.35) * sat), min(1, v * val))
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return im


def grey(im, val=1.0):
    return hue(im, 0, 0.0, val)


def pad(im, size=18):
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return out


def comp(rows, pack='tt', size=16):
    h, w = len(rows), len(rows[0])
    out = Image.new('RGBA', (w * size, h * size), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, n in enumerate(r):
            if n is not None: out.alpha_composite(tile(f'{pack}{n}'), (x * size, y * size))
    return out


def crop_alpha(im):
    return im.crop(im.getbbox())


# ───────── characters / monsters (16x16; crow has 2 wing frames) ─────────
save(tile('td96'), 'chars', 'player_warrior.png')
for name, ref in {'mara': 'td99', 'pell': 'td98', 'calden': 'td97', 'ila': 'td84'}.items():
    save(tile(ref), 'chars', f'npc_{name}.png')
save(tile('tc177'), 'chars', 'monster_field_mouse.png')
save(tile('tc154'), 'chars', 'monster_wool_sheep.png')
crow = Image.new('RGBA', (32, 16)); crow.alpha_composite(tile('tc137'), (0, 0)); crow.alpha_composite(tile('tc138'), (16, 0))
save(crow, 'chars', 'monster_crow.png')
save(tile('tc161'), 'chars', 'monster_burrow_mole.png')  # placeholder for v0.2 (boar-ish critter)

# ───────── world ─────────
save(tile('pp2'), 'world', 'grass_top.png')
save(tile('pp122'), 'world', 'dirt.png')
save(crop_alpha(tile('pp146')), 'world', 'platform.png')
save(comp([[52, 53, 53, 54], [64, 65, 65, 66], [72, 84, 85, 75]]), 'world', 'house_red.png')
save(comp([[48, 49, 49, 50], [60, 61, 61, 62], [76, 88, 89, 79]]), 'world', 'house_stone.png')
save(comp([[44, 45, 46]]), 'world', 'fence.png')
save(tile('tt16'), 'world', 'tree_round.png')
save(tile('tt28'), 'world', 'tree_tall.png')
save(tile('tt5'), 'world', 'bush.png')
save(tile('tt83'), 'world', 'sign.png')
save(tile('tt94'), 'world', 'hive.png')
door = Image.new('RGBA', (18, 36)); door.alpha_composite(tile('pp130'), (0, 0)); door.alpha_composite(tile('pp150'), (0, 18))
save(door, 'world', 'portal.png')
save(tile('td104'), 'fx', 'sword.png')

# ───────── item icons (one per items.id; 18x18 canvas) ─────────
G = lambda ref: tile(ref)
ICONS = {
    # materials
    'twig': G('fa104'), 'bark': G('pp146'), 'branch': G('pp89'), 'log': G('tt106'), 'heartwood': hue(G('tt106'), 350, 1.2),
    'pebble': G('td102'), 'clay': hue(G('td102'), 25, 1.5), 'stone_chunk': G('pp6'), 'copper_nail': hue(G('td103'), 25, 1.4),
    'wool': grey(G('tt5'), 1.4), 'feather': G('tt119'), 'fur': hue(G('tt5'), 30, 0.8, 0.8), 'leather_scrap': hue(G('tt130'), 30),
    'earth_grit': hue(G('td102'), 35, 1.2, 0.8), 'earth_shard': hue(G('pp67'), 35, 1.0, 0.8), 'earth_crystal': hue(G('pp67'), 30, 1.3),
    'fire_shard': hue(G('pp67'), 5, 1.3), 'ice_shard': hue(G('pp67'), 185, 0.6, 1.2), 'lightning_shard': hue(G('pp67'), 55, 1.3),
    'holy_dust': hue(G('tt93'), 50, 0.3, 1.3), 'holy_essence': hue(G('td125'), 50, 0.6, 1.2), 'soul_dust': hue(G('tt93'), 270, 0.6),
    'soul_shard': hue(G('pp67'), 275, 1.0), 'cursed_dust': hue(G('tt93'), 300, 0.9, 0.6),
    'iron_ore': grey(G('pp6'), 0.9), 'fire_crystal': hue(G('pp67'), 0, 1.5),
    # currencies
    'nature_essence': hue(G('pp67'), 115, 1.2), 'elemental_essence': hue(G('pp67'), 28, 1.4), 'spirit_essence': hue(G('pp67'), 285, 1.1),
    'monster_essence': G('td129'), 'training_scroll': G('td66'), 'copper_coin': G('pp151'),
    # consumables
    'meadow_dew': G('td115'), 'clear_dew': G('td116'), 'spring_draught': G('td127'), 'mint_draught': G('td128'),
    'barley_cake': G('fa10'), 'wild_apple': G('fa57'), 'mint_sprig': G('fa36'),
    # misc / junk / curios
    'broken_twig': grey(G('fa104'), 0.9), 'lost_button': G('td101'), 'old_bone': grey(G('pp89'), 1.5), 'torn_cloth': grey(G('tt130'), 1.2),
    'cracked_shell': grey(G('tt93'), 1.1), 'pasture_bell': hue(G('tt94'), 45, 1.0), 'bright_bead': hue(G('td101'), 330, 1.5),
    'fence_peg': G('tt46'), 'warm_grain': G('fa58'), 'worn_charm': hue(G('td129'), 200, 0.8), 'old_sap': hue(G('td125'), 35, 1.3),
    'shiny_stone': hue(G('td102'), 200, 0.5, 1.4), 'old_coin_purse': G('tt107'), 'glass_chip': hue(G('pp67'), 170, 0.3, 1.3),
    'copper_bit': hue(G('pp151'), 22, 1.2), 'silver_thread': grey(G('tt129'), 1.3), 'shrine_pin': hue(G('td103'), 50, 1.2),
    'evening_bead': hue(G('td101'), 260, 1.2, 0.8), 'amber_drop': hue(G('pp67'), 38, 1.6), 'tarnished_ring': hue(G('pp170'), 45, 0.7, 0.8),
    'old_key': G('tt117'),
    # gear
    'wooden_sword': hue(G('td104'), 30, 1.2), 'worn_staff': G('td129'), 'rusty_dagger': hue(G('td103'), 20, 0.9),
    'steel_sword': G('td104'), 'steel_staff': grey(G('td129'), 1.2), 'steel_dagger': G('td103'),
    'cloth_cap': hue(G('tt131'), 200, 0.5), 'cloth_tunic': hue(G('tt130'), 200, 0.4, 1.2), 'cloth_pants': hue(G('tt130'), 220, 0.5),
    'cloth_shoes': hue(G('tt107'), 210, 0.4), 'cloth_gloves': hue(G('tt131'), 220, 0.4, 1.2),
    'leather_cap': hue(G('tt131'), 28), 'leather_vest': G('tt130'), 'leather_pants': hue(G('tt130'), 25, 1.0, 0.8),
    'leather_boots': hue(G('tt107'), 25), 'leather_gloves': hue(G('tt131'), 30, 1.0, 0.8),
}
items = [r['id'] for r in json.load(open(os.path.join(ROOT, 'data', 'items.json')))['rows']]
missing = [i for i in items if i not in ICONS]
for item_id in items:
    save(pad(ICONS.get(item_id, G('td65'))), 'icons', f'{item_id}.png')
print(f'Wrote art to public/art ({len(items)} icons). Fallback icon used for: {missing or "none"}')
