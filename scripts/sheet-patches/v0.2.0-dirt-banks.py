"""v0.2.0: Dirt Banks foundation — unique/shared materials, Stone Club, retuned Banks gear pools.
Run: python3 scripts/sheet-patches/v0.2.0-dirt-banks.py && npm run export-sheet
Prerequisite: v0.1.3 and v0.1.3b already applied.
"""
import openpyxl, sys
from pathlib import Path

P = 'sheet/Game_Design_DB_v0.xlsx'
wb = openpyxl.load_workbook(P)

def table(name):
    ws = wb[name]
    hdr_row = 2 if str(ws.cell(1, 1).value or '').startswith(('NOTE', 'DRAFT')) else 1
    cols = {str(c.value).strip(): c.column for c in ws[hdr_row] if c.value}
    return ws, hdr_row, cols

def append(ws, h, cols, row):
    r = ws.max_row + 1
    for k, v in row.items():
        if k not in cols: raise KeyError(k)
        ws.cell(r, cols[k]).value = v

def freeze_bools():
    for n in wb.sheetnames:
        for row in wb[n].iter_rows():
            for c in row:
                if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                    c.value = str(c.value).upper() == '=TRUE()'

def find_item(ws, h, cols, iid):
    for r in range(h + 1, ws.max_row + 1):
        if ws.cell(r, cols['id']).value == iid:
            return r
    return None

def find_drop(ws, h, cols, mid, iid):
    for r in range(h + 1, ws.max_row + 1):
        if ws.cell(r, cols['monster_id']).value == mid and ws.cell(r, cols['item_id']).value == iid:
            return r
    return None

dws, dh, dcols = table('drop_tables')
note = str(dws.cell(1, 1).value or '')
if 'v0.2.0' in note:
    sys.exit('already patched')

# ── items ──
iws, ih, icols = table('items')
ITEMS = [
    dict(id='dry_root', name='Dry Root', item_type='material', subtype_id='wood', native_zone='meadows',
         passively_gatherable=True, sellable_only=False, sell_price=2,
         description='A dry root, tougher than a twig.',
         desc='A dry root, tougher than a twig.',
         notes='v0.2.0 / B-001. Next Nature wood common after Twig and Bark. Same sell and 10:1 essence value; used in later-rank recipes, not a better vendor price. Shared across areas; best rates in the Dirt Banks, already visible in the east pasture.'),
    dict(id='tough_root', name='Tough Root', item_type='material', subtype_id='wood', native_zone='meadows',
         passively_gatherable=False, sellable_only=False, sell_price=5,
         description='A thick, stubborn root.',
         desc='A thick, stubborn root.',
         notes='v0.2.0 / B-001. Uncommon of the Dry Root family (the way Branch sits above Twig). Small recipe counts at higher ranks. Banks-weighted, not exclusive. Not on the 10:1 exchange.'),
    dict(id='warm_stone', name='Warm Stone', item_type='misc', subtype_id=None, native_zone='meadows',
         passively_gatherable=False, sellable_only=True, sell_price=70,
         description='A stone that still holds a little warmth.',
         desc='A stone that still holds a little warmth.',
         notes='v0.2.0 / B-001. Sell-only junk, not a material or a trophy. Banks-weighted unique addition, shared by a couple of overlapping elemental mobs (Ember Beetle, Earth Sprite, and Frost Moth at the shrine).'),
    dict(id='stone_club', name='Stone Club', item_type='gear', subtype_id=None, native_zone='meadows',
         passively_gatherable=False, sellable_only=False, sell_price=80,
         description='A heavy club of packed stone.',
         desc='A heavy club of packed stone.',
         notes='v0.2.0 / B-001. Warrior mid weapon a step above Meadow Blade (13–16 typ 14, ×1.15, STR 3, sell 60) and below Steel (17–21 typ 19, ×1.25, STR 5, sell 120). dmg 15–18 typ 16, ×1.15, STR 5.'),
    dict(id='cracked_bank_stone', name='Cracked Bank Stone', item_type='misc', subtype_id=None, native_zone='meadows',
         passively_gatherable=False, sellable_only=False, sell_price=0,
         description='A cracked stone from the dirt banks.',
         desc='A cracked stone from the dirt banks.',
         notes='v0.2.0 / B-004. Rare quest start for A Crack in the Dirt (Earthbreaker). Not sellable. Picking it up will start the questline in a later milestone; the drop is live now.'),
    dict(id='smoldering_scale', name='Smoldering Scale', item_type='misc', subtype_id=None, native_zone='meadows',
         passively_gatherable=False, sellable_only=False, sell_price=0,
         description='A beetle scale that still glows at the edge.',
         desc='A beetle scale that still glows at the edge.',
         notes='v0.2.0 / B-004. Rare quest start for Hot Edge (Flame Cleave). Not sellable. Picking it up will start the questline in a later milestone; the drop is live now.'),
]
for it in ITEMS:
    if find_item(iws, ih, icols, it['id']):
        raise SystemExit(f'item already exists: {it["id"]}')
    append(iws, ih, icols, it)

# ── gear: Stone Club ──
gws, gh, gcols = table('gear')
append(gws, gh, gcols, dict(
    item_id='stone_club', slot='weapon', class_id='warrior', required_stat='STR', required_value=5,
    stat_multiplier=1.15, defense=0, weapon_damage=16,
    description='A heavy club of packed stone.',
    desc='A heavy club of packed stone.',
    defense_min=0, defense_max=0, weapon_damage_min=15, weapon_damage_max=18,
))

# ── exchange: Dry Root 10:1 Nature Essence (same as Twig/Bark) ──
ews, eh, ecols = table('exchange')
append(ews, eh, ecols, dict(
    id='ex_dry_root', input_item_id='dry_root', input_qty=10,
    output_item_id='nature_essence', output_qty=1,
    notes='v0.2.0: 10 Dry Root = 1 Nature Essence, same steep rate as Twig and Bark.',
))
enote = str(ews.cell(1, 1).value or '')
if 'Dry Root' not in enote:
    ews.cell(1, 1).value = enote + ' v0.2.0: Dry Root also exchanges 10:1 for Nature Essence (same sell and essence value as Twig/Bark).'

# ── drops ──
# Materials from B-001 (shared, Banks-weighted). Gear pools follow v0.1.3 (1 per 150–200 kills).
# Stone Club rates: mole 0.24 + existing leather 0.32 = 0.56% (1/179). Sprite 0.16 plus cloth to fill the pool.
# Crow: add 0.06 and trim hide cap/boots 0.08→0.07 so the 9-item + club pool stays at 0.67% (1/149).
NEW_DROPS = [
    # Dry Root (common 1–3)
    ('burrow_mole', 'dry_root', 32, 1, 3),
    ('earth_sprite', 'dry_root', 16, 1, 3),
    ('crow', 'dry_root', 12, 1, 3),
    ('wool_sheep', 'dry_root', 10, 1, 3),
    # Tough Root (uncommon 1–2)
    ('burrow_mole', 'tough_root', 5, 1, 2),
    ('earth_sprite', 'tough_root', 3, 1, 2),
    ('crow', 'tough_root', 2, 1, 2),
    # Warm Stone (rare junk, qty 1)
    ('ember_beetle', 'warm_stone', 1.6, 1, 1),
    ('earth_sprite', 'warm_stone', 1.0, 1, 1),
    ('frost_moth', 'warm_stone', 0.8, 1, 1),
    # Stone Club (gear, qty 1) — v0.1.3 band
    ('burrow_mole', 'stone_club', 0.24, 1, 1),
    ('earth_sprite', 'stone_club', 0.16, 1, 1),
    ('crow', 'stone_club', 0.06, 1, 1),
    # Earth Sprite pool fill (worn_staff 0.16 + club 0.16 + these = 0.60%, 1/167)
    ('earth_sprite', 'cloth_tunic', 0.14, 1, 1),
    ('earth_sprite', 'cloth_cap', 0.14, 1, 1),
    # Ember Beetle first gear pool 0.62% (1/161)
    ('ember_beetle', 'leather_cap', 0.16, 1, 1),
    ('ember_beetle', 'leather_boots', 0.16, 1, 1),
    ('ember_beetle', 'linen_boots', 0.16, 1, 1),
    ('ember_beetle', 'trail_boots', 0.14, 1, 1),
    # B-004 start items (questlines hook them up next milestone)
    ('burrow_mole', 'cracked_bank_stone', 1.2, 1, 1),
    ('earth_sprite', 'cracked_bank_stone', 0.8, 1, 1),
    ('ember_beetle', 'smoldering_scale', 1.2, 1, 1),
    ('spark_bug', 'smoldering_scale', 0.8, 1, 1),
]
for mid, iid, rate, lo, hi in NEW_DROPS:
    if find_drop(dws, dh, dcols, mid, iid):
        raise SystemExit(f'drop already exists: {mid} {iid}')
    append(dws, dh, dcols, dict(monster_id=mid, item_id=iid, drop_rate=rate, min_qty=lo, max_qty=hi, unlock_requirement_id=None))

# Crow hide cap/boots trim so the pool stays in the 150–200 band after Stone Club
for mid, iid, rate in [('crow', 'hide_cap', 0.07), ('crow', 'hide_boots', 0.07)]:
    r = find_drop(dws, dh, dcols, mid, iid)
    if not r: raise SystemExit(f'missing {mid} {iid}')
    dws.cell(r, dcols['drop_rate']).value = rate

dws.cell(1, 1).value = note + (
    ' v0.2.0: Dirt Banks materials (Dry Root, Tough Root) are shared across pasture and Banks, with better rates in the Banks. '
    'Warm Stone is sell-only junk on Ember Beetle / Earth Sprite / Frost Moth. Stone Club is a Warrior mid weapon '
    '(mole 0.24% + leather 0.32% = 0.56% pool; sprite 0.60% with cloth; crow 0.06% and hide cap/boots trimmed so the pool stays 0.67%). '
    'Ember Beetle first gear pool 0.62%. Cracked Bank Stone and Smoldering Scale are rare quest-start drops (questlines in a later milestone). '
    'All new gear pools follow the v0.1.3 1-per-150–200 rule; ME stays more common than category essence.')

# ── Pell points at the now-open Dirt Banks path ──
nws, nh, ncols = table('npcs')
for r in range(nh + 1, nws.max_row + 1):
    if nws.cell(r, ncols['id']).value == 'pell':
        nws.cell(r, ncols['desc']).value = (
            'Welcome to Meadow Town! Head east to Sunny Pasture — mice and sheep leave you be unless you hit them, but watch the crows. '
            'The dirt path at the far east of the pasture leads on to the Dirt Banks. '
            'Press E to pick up drops, sell junk to Mara, and train with Calden.')
        notes = str(nws.cell(r, ncols['notes']).value or '')
        if 'v0.2.0' not in notes:
            nws.cell(r, ncols['notes']).value = notes + ' v0.2.0: mentions the open dirt path to the Dirt Banks.'
        break

# ── map_layout note ──
mws, mh, mcols = table('map_layout')
mnote = str(mws.cell(1, 1).value or '')
if 'v0.2.0' not in mnote:
    mws.cell(1, 1).value = mnote + ' v0.2.0: Dirt Banks is playable (portal from the east pasture). Meadow Shrine and further east remain closed.'

freeze_bools()
wb.save(P)
print('patched', P)
