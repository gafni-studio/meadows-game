"""v0.2.7 Paths: path/chain data on skills, a `paths` tab, class-neutral Club, Hero, Mouse/Sheep XP,
Calden's Paths tutorial quest. Run:
  python3 scripts/sheet-patches/v0.2.7.py && npm run export-sheet
"""
import openpyxl, sys

P = 'sheet/Game_Design_DB_v0.xlsx'
wb = openpyxl.load_workbook(P)


def table(name):
    ws = wb[name]
    hdr_row = 2 if str(ws.cell(1, 1).value or '').startswith(('NOTE', 'DRAFT')) else 1
    cols = {str(c.value).strip(): c.column for c in ws[hdr_row] if c.value}
    return ws, hdr_row, cols


def find(ws, h, cols, key, val):
    for r in range(h + 1, ws.max_row + 1):
        if ws.cell(r, cols[key]).value == val:
            return r
    return None


def append(ws, cols, row):
    r = ws.max_row + 1
    for k, v in row.items():
        ws.cell(r, cols[k]).value = v
    return r


def note(ws, text):
    cur = str(ws.cell(1, 1).value or '')
    if 'v0.2.7' in cur:
        sys.exit('already patched')
    ws.cell(1, 1).value = (cur + '  ' + text).strip()


def freeze_bools():
    for n in wb.sheetnames:
        for row in wb[n].iter_rows():
            for c in row:
                if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                    c.value = str(c.value).upper() == '=TRUE()'


# ---------- skills: path + chain ----------
ws, h, c = table('skills')
note(ws, 'v0.2.7: path_id + prev_skill_id define the Paths trees. A skill needs its previous skill at rank 1+ (no level gate). Warrior Path: Power Strike → Earthbreaker (→ Root Lash, Flame Cleave), Dig In, Rage.')
for name in ('path_id', 'prev_skill_id'):
    col = ws.max_column + 1
    ws.cell(h, col).value = name
    c[name] = col
CHAIN = {
    'power_strike': ('warrior', None),
    'earthbreaker': ('warrior', 'power_strike'),
    'dig_in': ('warrior', 'power_strike'),
    'rage': ('warrior', 'power_strike'),
    'root_lash': ('warrior', 'earthbreaker'),
    'flame_cleave': ('warrior', 'earthbreaker'),
}
for sid, (path, prev) in CHAIN.items():
    r = find(ws, h, c, 'id', sid)
    ws.cell(r, c['path_id']).value = path
    ws.cell(r, c['prev_skill_id']).value = prev

# the old level/STR gates no longer apply to Warrior Path skills
uws, uh, uc = table('unlock_requirements')
for r in range(uws.max_row, uh, -1):
    if uws.cell(r, uc['target_type']).value == 'skill' and uws.cell(r, uc['target_id']).value in CHAIN:
        uws.delete_rows(r)
note(uws, 'v0.2.7: Warrior Path skills have no level or stat gate any more (chain + materials only); their rows were removed.')

# ---------- paths tab ----------
pws = wb.create_sheet('paths')
pws.cell(1, 1).value = 'NOTE: v0.2.7. A Path is an open skill tree a Hero can train. Any Hero can train any path; a skill needs the previous skill in its chain (rank 1+) plus materials. Levels are only a pacing guide for recipe cost: green ~ L5, blue ~ L10, orange ~ L20 (out of scope).'
for i, name in enumerate(['id', 'name', 'status', 'description']):
    pws.cell(2, i + 1).value = name
for row in [
    ('warrior', 'Warrior Path', 'live', 'Melee: Power Strike at the root, Nature and Elemental branches below.'),
    ('magician', 'Magician Path', 'soon', 'Ranged and MP-hungry. Arrives in v0.2.8.'),
]:
    pws.append(list(row))

# ---------- classes: Hero ----------
ws, h, c = table('classes')
note(ws, 'v0.2.7: the single playable character is the Hero (internal id warrior kept for stat formulas). Hero walks Paths.')
r = find(ws, h, c, 'id', 'warrior')
ws.cell(r, c['name']).value = 'Hero'
ws.cell(r, c['description']).value = 'The one playable character. Walks Paths (Warrior Path first, Magician Path next). Strength-based for now.'

# ---------- Club ----------
ws, h, c = table('items')
append(ws, c, {'id': 'club', 'name': 'Club', 'item_type': 'gear', 'subtype_id': 'weapon', 'native_zone': 'meadows', 'passively_gatherable': False,
               'sellable_only': False, 'sell_price': 20, 'description': 'A plain wooden club.',
               'notes': 'v0.2.7: the class-neutral starting weapon (same numbers as the Wooden Sword: 10 × 1.10). Not a drop. Stone Club is the later Dirt Banks piece.',
               'desc': 'A plain wooden club.'})
ws, h, c = table('gear')
append(ws, c, {'item_id': 'club', 'slot': 'weapon', 'class_id': 'any', 'required_stat': None, 'required_value': 0, 'stat_multiplier': 1.1,
               'defense': 0, 'weapon_damage': 10, 'description': 'A plain wooden club.', 'defense_min': 0, 'defense_max': 0,
               'weapon_damage_min': 10, 'weapon_damage_max': 10, 'desc': 'A plain wooden club.'})

# ---------- XP ----------
ws, h, c = table('monsters')
note(ws, 'v0.2.7: Field Mouse 4 XP (was 7), Wool Sheep 8 XP (was 12).')
for mid, xp in (('field_mouse', 4), ('wool_sheep', 8)):
    ws.cell(find(ws, h, c, 'id', mid), c['xp']).value = xp

# ---------- Calden's Paths tutorial ----------
ws, h, c = table('skill_quests')
note(ws, "v0.2.7: ql_paths, Calden's short tutorial for Paths (talk, open the tree, train Power Strike rank 2, report back).")
base = dict(line_id='ql_paths', name="The Hero's Paths", giver='calden', gate_level=None, gate_stat=None, gate_value=None, unlock_skill=None,
            reward_xp=None, reward_coins=None, reward_items=None, trigger=None)
steps = [
    dict(id='ql_paths_1', step=1, desc='Calden wants to show you how a Hero grows: by Paths.', objective='Talk to Calden about Paths.',
         notes='v0.2.7. Auto-starts when The Weight of a Swing is done. Introduces Paths, families, the chain, and points at Ila for passives.', trigger='quest:ql_weight'),
    dict(id='ql_paths_2', step=2, desc='Open the Paths window and see what is trained and what is locked.', objective='Press K and look at the Warrior Path.',
         notes='v0.2.7. Advances when the Paths window (K) is opened. Calden gives the rank 2 Power Strike materials on the way (Monster Essence 24, Training Scroll 10, Clay 16, Copper 25).'),
    dict(id='ql_paths_3', step=3, desc='Train a rank. Skills you can afford light up.', objective='Train Power Strike to rank 2, and keep it in an attack slot.',
         notes='v0.2.7. Advances when Power Strike reaches rank 2.'),
    dict(id='ql_paths_4', step=4, desc='Tell Calden how it felt.', objective='Return to Calden.',
         notes='v0.2.7. Rewards: 60 XP, 20 copper, Monster Essence x6, Training Scroll x4. No skill.',
         reward_xp=60, reward_coins=20, reward_items='monster_essence x6; training_scroll x4'),
]
for st in steps:
    row = {**base, **st}
    append(ws, c, row)

freeze_bools()
wb.save(P)
print('saved')
