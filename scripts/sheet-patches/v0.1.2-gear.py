"""v0.1.2 gear: stat ranges, class-specific Meadows sets, split drop pools.
Run: python3 scripts/sheet-patches/v0.1.2-gear.py && npm run export-sheet
"""
import openpyxl, sys
P = 'sheet/Game_Design_DB_v0.xlsx'
wb = openpyxl.load_workbook(P)

def table(name):
    ws = wb[name]
    hdr_row = 2 if str(ws.cell(1, 1).value or '').startswith(('NOTE', 'DRAFT')) else 1
    cols = {str(c.value).strip(): c.column for c in ws[hdr_row] if c.value}
    return ws, hdr_row, cols

def add_col(ws, h, cols, name):
    if name in cols: return
    c = ws.max_column + 1
    ws.cell(h, c).value = name
    cols[name] = c

def append(ws, h, cols, row):
    r = ws.max_row + 1
    for k, v in row.items():
        if k not in cols: raise KeyError(k)
        ws.cell(r, cols[k]).value = v

if 'v0.1.2-gear' in str(wb['gear'].cell(1, 1).value or ''):
    sys.exit('already patched')

# ── gear tab: range columns + existing ranges + new class sets ──
ws, h, cols = table('gear')
for n in ('defense_min', 'defense_max', 'weapon_damage_min', 'weapon_damage_max'):
    add_col(ws, h, cols, n)

# existing: (def_lo, def_hi, dmg_lo, dmg_hi) — None keeps 0
EXISTING = {
    'wooden_sword': (0, 0, 10, 10), 'worn_staff': (0, 0, 10, 10), 'rusty_dagger': (0, 0, 10, 10),
    'steel_sword': (0, 0, 17, 21), 'steel_staff': (0, 0, 17, 21), 'steel_dagger': (0, 0, 17, 21),
    # shop cloth: a stepping stone (mid total def 6)
    'cloth_cap': (1, 2, 0, 0), 'cloth_tunic': (2, 3, 0, 0), 'cloth_pants': (1, 2, 0, 0),
    'cloth_shoes': (1, 2, 0, 0), 'cloth_gloves': (1, 1, 0, 0),
    # generic leather (later Meadows areas, any class); mid total 10
    'leather_cap': (1, 3, 0, 0), 'leather_vest': (2, 5, 0, 0), 'leather_pants': (1, 4, 0, 0),
    'leather_boots': (1, 3, 0, 0), 'leather_gloves': (1, 2, 0, 0),
}
# also rewrite typical defense / weapon_damage to the mid of the range
for r in range(h + 1, ws.max_row + 1):
    mid = ws.cell(r, cols['item_id']).value
    if mid not in EXISTING: continue
    dlo, dhi, wlo, whi = EXISTING[mid]
    ws.cell(r, cols['defense_min']).value = dlo
    ws.cell(r, cols['defense_max']).value = dhi
    ws.cell(r, cols['weapon_damage_min']).value = wlo
    ws.cell(r, cols['weapon_damage_max']).value = whi
    ws.cell(r, cols['defense']).value = (dlo + dhi) // 2
    ws.cell(r, cols['weapon_damage']).value = (wlo + whi) // 2

# New class drop gear. Hide (warrior) mid def 2+4+3+2+1 = 12? Wait we want mid 10:
# cap 2 (1-3), vest 3 (2-5), pants 2 (1-4), boots 2 (1-3), gloves 1 (1-2) = 10
NEW_GEAR = [
    # weapons (drop mid-tier). Typical dmg 14, range 13-16, mult 1.15. Req 3 main.
    dict(item_id='meadow_blade', slot='weapon', class_id='warrior', required_stat='STR', required_value=3,
         stat_multiplier=1.15, defense=0, weapon_damage=14, defense_min=0, defense_max=0,
         weapon_damage_min=13, weapon_damage_max=16,
         description='A sturdy farm blade, better than a wooden practice sword.'),
    dict(item_id='grove_staff', slot='weapon', class_id='mage', required_stat='INT', required_value=3,
         stat_multiplier=1.15, defense=0, weapon_damage=14, defense_min=0, defense_max=0,
         weapon_damage_min=13, weapon_damage_max=16,
         description='A staff cut from a meadow grove. A step up from a worn staff.'),
    dict(item_id='bone_knife', slot='weapon', class_id='rogue', required_stat='AGI', required_value=3,
         stat_multiplier=1.15, defense=0, weapon_damage=14, defense_min=0, defense_max=0,
         weapon_damage_min=13, weapon_damage_max=16,
         description='A sharp knife made from a cleaned bone. A step up from a rusty dagger.'),
]
# armor templates: (suffix, slot, def_lo, def_hi, typical)
ARMOR = [
    ('cap', 'head', 1, 3, 2), ('vest', 'torso', 2, 5, 3), ('pants', 'legs', 1, 4, 2),
    ('boots', 'boots', 1, 3, 2), ('gloves', 'gloves', 1, 2, 1),
]
SETS = [
    # id prefix, class, req stat, name prefix, desc
    ('hide', 'warrior', 'STR', 'Hide', 'Thick hide {slot} for a Meadows warrior.'),
    ('linen', 'mage', 'INT', 'Linen', 'Light linen {slot} for a Meadows mage.'),
    ('trail', 'rogue', 'AGI', 'Trail', 'Worn trail {slot} for a Meadows rogue.'),
]
# slot word for descriptions
SLOT_WORD = {'head': 'cap', 'torso': 'vest', 'legs': 'pants', 'boots': 'boots', 'gloves': 'gloves'}
# linen uses hood/robe/wraps/sandals/sleeves as ids? Keep consistent *_cap etc. for code simplicity.
# Display names can be nicer via items tab.
ARMOR_NAMES = {
    'hide_cap': 'Hide Cap', 'hide_vest': 'Hide Vest', 'hide_pants': 'Hide Pants', 'hide_boots': 'Hide Boots', 'hide_gloves': 'Hide Gloves',
    'linen_cap': 'Linen Hood', 'linen_vest': 'Linen Robe', 'linen_pants': 'Linen Wraps', 'linen_boots': 'Linen Sandals', 'linen_gloves': 'Linen Sleeves',
    'trail_cap': 'Trail Cap', 'trail_vest': 'Trail Vest', 'trail_pants': 'Trail Pants', 'trail_boots': 'Trail Boots', 'trail_gloves': 'Trail Gloves',
    'meadow_blade': 'Meadow Blade', 'grove_staff': 'Grove Staff', 'bone_knife': 'Bone Knife',
}
for prefix, cls, stat, _, desc_t in SETS:
    for suf, slot, lo, hi, mid in ARMOR:
        iid = f'{prefix}_{suf}'
        NEW_GEAR.append(dict(
            item_id=iid, slot=slot, class_id=cls, required_stat=stat, required_value=3,
            stat_multiplier=1.0, defense=mid, weapon_damage=0,
            defense_min=lo, defense_max=hi, weapon_damage_min=0, weapon_damage_max=0,
            description=desc_t.replace('{slot}', SLOT_WORD[slot]),
        ))

for g in NEW_GEAR:
    append(ws, h, cols, g)

ws.cell(1, 1).value = (
    'NOTE: item_id is a foreign key to items.id (item_type = gear). '
    'v0.1.2-gear: defense and weapon_damage are the typical (mid) values; defense_min/max and weapon_damage_min/max are rolled per dropped or bought instance and stored on the item (gear does not stack). '
    'A magic roll (~1/12 of gear drops) adds a prefix and 1-2 extra bonuses — see assumptions.MAGIC. Category infusion is later (Pitch Book B-003). '
    'Balance: at level 1 with 0 points, a mid-roll Meadows drop set (Meadow Blade 14×1.15 + Hide armor def 10) is about +45% attack and ~55% less damage taken from a Crow vs basic (Wooden Sword, no armor). '
    'Cloth is a weaker shop stepping-stone (mid def 6). Skill training remains the main power-up. Steel is ultra-rare.')

# ── items tab: one row per new gear piece ──
iws, ih, icols = table('items')
ITEM_META = {
    'meadow_blade': (60, 'A sturdy farm blade. Rolled weapon damage 13-16.'),
    'grove_staff': (60, 'A staff from the grove. Rolled weapon damage 13-16.'),
    'bone_knife': (60, 'A sharp bone knife. Rolled weapon damage 13-16.'),
    'hide_cap': (28, 'Warrior hide head armor. Rolled defense 1-3.'),
    'hide_vest': (48, 'Warrior hide torso armor. Rolled defense 2-5.'),
    'hide_pants': (36, 'Warrior hide leg armor. Rolled defense 1-4.'),
    'hide_boots': (28, 'Warrior hide boots. Rolled defense 1-3.'),
    'hide_gloves': (22, 'Warrior hide gloves. Rolled defense 1-2.'),
    'linen_cap': (28, 'Mage linen hood. Rolled defense 1-3.'),
    'linen_vest': (48, 'Mage linen robe. Rolled defense 2-5.'),
    'linen_pants': (36, 'Mage linen wraps. Rolled defense 1-4.'),
    'linen_boots': (28, 'Mage linen sandals. Rolled defense 1-3.'),
    'linen_gloves': (22, 'Mage linen sleeves. Rolled defense 1-2.'),
    'trail_cap': (28, 'Rogue trail cap. Rolled defense 1-3.'),
    'trail_vest': (48, 'Rogue trail vest. Rolled defense 2-5.'),
    'trail_pants': (36, 'Rogue trail pants. Rolled defense 1-4.'),
    'trail_boots': (28, 'Rogue trail boots. Rolled defense 1-3.'),
    'trail_gloves': (22, 'Rogue trail gloves. Rolled defense 1-2.'),
}
existing_ids = {iws.cell(r, icols['id']).value for r in range(ih + 1, iws.max_row + 1)}
for iid, (price, desc) in ITEM_META.items():
    if iid in existing_ids: continue
    append(iws, ih, icols, dict(
        id=iid, name=ARMOR_NAMES[iid], item_type='gear', subtype_id='armor' if 'blade' not in iid and 'staff' not in iid and 'knife' not in iid else 'weapon',
        native_zone='meadows', passively_gatherable=False, sellable_only=False, sell_price=price,
        description=desc, notes='v0.1.2-gear. Stats are rolled per instance (see gear tab ranges). Does not stack.',
    ))

# ── drop_tables: class-specific pools, each mob has its own, pasture is farmable ──
dws, dh, dcols = table('drop_tables')
# Retarget existing pasture leather rows to warrior hide (don't leave two pools on the same mob).
REMAP = {
    ('wool_sheep', 'leather_vest'): ('hide_vest', 2.0),
    ('wool_sheep', 'leather_boots'): ('hide_pants', 1.5),
    ('crow', 'leather_cap'): ('hide_cap', 2.0),
    ('crow', 'leather_gloves'): ('hide_boots', 1.5),
}
for r in range(dh + 1, dws.max_row + 1):
    key = (dws.cell(r, dcols['monster_id']).value, dws.cell(r, dcols['item_id']).value)
    if key in REMAP:
        nid, rate = REMAP[key]
        dws.cell(r, dcols['item_id']).value = nid
        dws.cell(r, dcols['drop_rate']).value = rate
        dws.cell(r, dcols['min_qty']).value = 1
        dws.cell(r, dcols['max_qty']).value = 1

# Additional exclusive pools (not everyone drops everything).
NEW_DROPS = [
    # Field Mouse: gloves / small pieces + no weapons
    ('field_mouse', 'hide_gloves', 2.0),
    ('field_mouse', 'linen_gloves', 2.0),
    ('field_mouse', 'trail_gloves', 2.0),
    # Wool Sheep: torsos / legs (hide already remapped)
    ('wool_sheep', 'linen_vest', 2.0),
    ('wool_sheep', 'linen_pants', 1.5),
    ('wool_sheep', 'trail_vest', 2.0),
    ('wool_sheep', 'trail_pants', 1.5),
    # Crow: heads / boots / mid weapons
    ('crow', 'linen_cap', 2.0),
    ('crow', 'linen_boots', 1.5),
    ('crow', 'trail_cap', 2.0),
    ('crow', 'trail_boots', 1.5),
    ('crow', 'meadow_blade', 1.0),
    ('crow', 'grove_staff', 1.0),
    ('crow', 'bone_knife', 1.0),
    # Dirt Banks (mole): remaining gloves already has leather; add hide leftover none; linen/trail already assigned.
    # Mole keeps leather_pants / leather_gloves (any-class). Add nothing else to keep pools distinct.
    # Ember beetle / earth sprite: linen extras already on pasture. Optional steel stays on boar.
    # Meadow Boar: keeps leather set + steel sword (warrior). Add mage/rogue steel already on... steel_staff not dropped. Add rare class weapons as ultra-rare alternatives? Skip — steel_* already warrior only on boar.
]
# Avoid duplicate (monster, item) pairs
have = set()
for r in range(dh + 1, dws.max_row + 1):
    have.add((dws.cell(r, dcols['monster_id']).value, dws.cell(r, dcols['item_id']).value))
for mid, iid, rate in NEW_DROPS:
    if (mid, iid) in have: continue
    append(dws, dh, dcols, dict(monster_id=mid, item_id=iid, drop_rate=rate, min_qty=1, max_qty=1, unlock_requirement_id=None))

note = str(dws.cell(1, 1).value or '')
if 'v0.1.2-gear' not in note:
    dws.cell(1, 1).value = note + (
        ' v0.1.2-gear: each monster has its own gear pool (class-specific Hide / Linen / Trail sets and mid weapons in Sunny Pasture). '
        'Gear quantity is always 1 (an instance with rolled stats); magic (~1/12) is rolled on the instance, not a separate row.')

# preserve boolean formula results
for n in wb.sheetnames:
    for row in wb[n].iter_rows():
        for c in row:
            if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                c.value = str(c.value).upper() == '=TRUE()'
wb.save(P)
print('patched', P, 'new gear', len(NEW_GEAR), 'new drops', len(NEW_DROPS))
