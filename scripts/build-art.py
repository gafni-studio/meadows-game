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
save(tile('tc161'), 'chars', 'monster_burrow_mole.png')
# v0.2 areas (Dirt Banks, Meadow Shrine, Dusk Margin)
for mid, im in {
    'earth_sprite': tile('tc45'), 'ember_beetle': hue(tile('tc140'), 15, 1.5, 1.1),
    'frost_moth': hue(tile('tc13'), 190, 0.7, 1.2), 'spark_bug': tile('tc141'),
    'shrine_wisp': tile('tc90'), 'dusk_wisp': hue(tile('tc90'), 275, 0.8, 0.8), 'angry_bull': tile('tc21'),
}.items():
    save(im, 'chars', f'monster_{mid}.png')

# ───────── world ─────────
save(tile('pp2'), 'world', 'grass_top.png')
save(hue(tile('pp2'), 32, 0.85, 0.95), 'world', 'dirt_top.png')  # grass lip, dirt-colored
save(tile('pp122'), 'world', 'dirt.png')
save(crop_alpha(tile('pp7')), 'world', 'rock.png')
save(crop_alpha(tile('pp6')), 'world', 'clod.png')
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
save(tile('td102'), 'fx', 'pebble.png')  # crow projectile
save(tile('td89'), 'world', 'chest.png')
save(tile('td90'), 'world', 'chest_open.png')

# Practice post (training dummy): wooden crate body + sack head, Kenney CC0
dummy = Image.new('RGBA', (16, 32), (0, 0, 0, 0))
dummy.alpha_composite(tile('tt106'), (0, 16))  # log / crate as the post
dummy.alpha_composite(hue(tile('tt5'), 25, 0.9, 1.05), (0, 2))  # sack head
# a small red cloth mark so it reads as a target
mark = hue(tile('tt93'), 5, 1.6, 1.1)
dummy.alpha_composite(mark.resize((8, 8), Image.Resampling.NEAREST), (4, 6))
save(crop_alpha(dummy), 'world', 'practice_post.png')

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
    'barley_cake': G('fa10'), 'wild_apple': G('fa57'), 'strawberry': hue(G('fa57'), 5, 1.7, 1.15), 'blueberry': hue(G('fa57'), 230, 1.5, 0.95), 'mint_sprig': G('fa36'),
    # misc / junk / curios
    'broken_twig': grey(G('fa104'), 0.9), 'lost_button': G('td101'), 'old_bone': grey(G('pp89'), 1.5), 'torn_cloth': grey(G('tt130'), 1.2),
    'cracked_shell': grey(G('tt93'), 1.1), 'pasture_bell': hue(G('tt94'), 45, 1.0), 'bright_bead': hue(G('td101'), 330, 1.5),
    'fence_peg': G('tt46'), 'warm_grain': G('fa58'), 'worn_charm': hue(G('td129'), 200, 0.8), 'old_sap': hue(G('td125'), 35, 1.3),
    'shiny_stone': hue(G('td102'), 200, 0.5, 1.4), 'old_coin_purse': G('tt107'), 'glass_chip': hue(G('pp67'), 170, 0.3, 1.3),
    'copper_bit': hue(G('pp151'), 22, 1.2), 'silver_thread': grey(G('tt129'), 1.3), 'shrine_pin': hue(G('td103'), 50, 1.2),
    'evening_bead': hue(G('td101'), 260, 1.2, 0.8), 'amber_drop': hue(G('pp67'), 38, 1.6), 'tarnished_ring': hue(G('pp170'), 45, 0.7, 0.8),
    'old_key': G('tt117'),
    # v0.2.0 Dirt Banks
    'dry_root': hue(G('fa104'), 30, 1.15, 0.9),
    'tough_root': hue(G('fa104'), 25, 1.3, 0.65),
    'warm_stone': hue(G('td102'), 28, 1.4, 1.15), 'spark_shell': hue(G('tt93'), 50, 1.6, 1.2), 'pale_wing': hue(G('fa36'), 200, 0.5, 1.3),
    'stone_club': hue(G('td129'), 28, 0.9, 0.85),
    'cracked_bank_stone': hue(G('pp7'), 30, 0.6, 1.0),
    'smoldering_scale': hue(G('tt93'), 15, 1.6, 1.1),
    'live_ember': hue(G('tt93'), 10, 1.8, 1.25),
    # gear
    'wooden_sword': hue(G('td104'), 30, 1.2), 'short_sword': hue(G('td104'), 200, 0.45, 1.15), 'worn_staff': G('td129'), 'rusty_dagger': hue(G('td103'), 20, 0.9),
    'steel_sword': G('td104'), 'steel_staff': grey(G('td129'), 1.2), 'steel_dagger': G('td103'),
    'cloth_cap': hue(G('tt131'), 200, 0.5), 'cloth_tunic': hue(G('tt130'), 200, 0.4, 1.2), 'cloth_pants': hue(G('tt130'), 220, 0.5),
    'cloth_shoes': hue(G('tt107'), 210, 0.4), 'cloth_gloves': hue(G('tt131'), 220, 0.4, 1.2),
    'leather_cap': hue(G('tt131'), 28), 'leather_vest': G('tt130'), 'leather_pants': hue(G('tt130'), 25, 1.0, 0.8),
    'leather_boots': hue(G('tt107'), 25), 'leather_gloves': hue(G('tt131'), 30, 1.0, 0.8),
    # v0.1.2 class drop sets
    'meadow_blade': hue(G('td104'), 35, 1.3, 1.05), 'grove_staff': hue(G('td129'), 115, 0.8, 1.1), 'bone_knife': hue(G('td103'), 40, 0.7, 1.15),
    'hide_cap': hue(G('tt131'), 25, 1.1), 'hide_vest': hue(G('tt130'), 25, 1.1, 0.9), 'hide_pants': hue(G('tt130'), 22, 1.0, 0.75),
    'hide_boots': hue(G('tt107'), 22, 1.1), 'hide_gloves': hue(G('tt131'), 22, 1.1, 0.85),
    'linen_cap': hue(G('tt131'), 260, 0.35, 1.25), 'linen_vest': hue(G('tt130'), 255, 0.3, 1.3), 'linen_pants': hue(G('tt130'), 250, 0.25, 1.2),
    'linen_boots': hue(G('tt107'), 250, 0.3, 1.25), 'linen_gloves': hue(G('tt131'), 255, 0.3, 1.2),
    'trail_cap': hue(G('tt131'), 40, 0.7, 0.75), 'trail_vest': hue(G('tt130'), 38, 0.7, 0.7), 'trail_pants': hue(G('tt130'), 35, 0.65, 0.65),
    'trail_boots': hue(G('tt107'), 35, 0.7, 0.7), 'trail_gloves': hue(G('tt131'), 38, 0.7, 0.7),
}

items = [r['id'] for r in json.load(open(os.path.join(ROOT, 'data', 'items.json')))['rows']]
missing = [i for i in items if i not in ICONS]
for item_id in items:
    save(pad(ICONS.get(item_id, G('td65'))), 'icons', f'{item_id}.png')

# Skill icons (trainer / hotbar)
SKILLS = {
    'power_strike': G('td104'), 'rage': hue(G('td127'), 5, 1.5),
    'earthbreaker': G('pp6'), 'flame_cleave': hue(G('td104'), 5, 1.6, 1.1),
    'soul_guard': G('td102'),
    'root_lash': hue(G('fa104'), 115, 1.3, 1.0),
    'dig_in': hue(G('pp6'), 30, 1.1, 0.95),
    'energy_blast': hue(G('td116'), 200, 1.2), 'energy_shield': hue(G('td102'), 200, 0.6, 1.2),
    'thorn_bind': hue(G('fa104'), 115, 1.2), 'firebolt': hue(G('pp67'), 5, 1.5),
    'holy_light': hue(G('td125'), 50, 0.5, 1.3),
    'stealth': grey(G('tt131'), 0.6), 'backstab': G('td103'),
    'venom_strike': hue(G('td103'), 115, 1.3), 'lightning_dash': hue(G('pp67'), 55, 1.4),
    'shadow_mark': hue(G('td129'), 275, 1.0),
}
for sid, im in SKILLS.items():
    save(pad(im), 'icons', f'skill_{sid}.png')

# Passive-tree node icons
PASSIVES = {
    'nature_prod': hue(G('pp67'), 115, 1.2),
    'elemental_prod': hue(G('pp67'), 28, 1.4),
    'spiritual_prod': hue(G('pp67'), 285, 1.1),
    'nature_eff_drops': hue(G('td125'), 115, 0.8, 1.15),
    'elemental_eff_drops': hue(G('td125'), 28, 1.1, 1.15),
    'spiritual_eff_drops': hue(G('td125'), 285, 0.9, 1.1),
    'hunters_luck': hue(G('td66'), 45, 1.0, 1.15),
}
for pid, im in PASSIVES.items():
    save(pad(im), 'icons', f'passive_{pid}.png')
print(f'Wrote art to public/art ({len(items)} icons + {len(SKILLS)} skills). Fallback icon used for: {missing or "none"}')

