"""v0.2.8 Magician Path: renames the four unused mage skills into the chain, adds Chain Spark,
explicit recipes for ranks 1-10, the new NPC Tamsin and her tutorial quest. Run:
  python3 scripts/sheet-patches/v0.2.8.py && npm run export-sheet
"""
import openpyxl, sys, json

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
    if 'v0.2.8' in cur:
        sys.exit('already patched')
    ws.cell(1, 1).value = (cur + '  ' + text).strip()


ITEMS = {r['name']: r['id'] for r in json.load(open('data/items.json'))['rows']}
ITEMS['Copper'] = 'copper_coin'


def recipe(text):
    out = []
    for part in text.split(','):
        name, n = part.strip().rsplit(' ', 1)
        if name not in ITEMS:
            sys.exit(f'unknown item {name!r}')
        out.append((ITEMS[name], int(n)))
    return out


# ---------- paths ----------
ws, h, c = table('paths')
r = find(ws, h, c, 'id', 'magician')
ws.cell(r, c['status']).value = 'live'
ws.cell(r, c['description']).value = 'Ranged and MP-hungry: Magic Bolt at the root, a ward, and Fire, Thorn and Spark branches.'
note(ws, 'v0.2.8: Magician Path is live (Magic Bolt, Mana Shield, Fire Bolt, Thorn Volley, Chain Spark).')

# ---------- skills ----------
ws, h, c = table('skills')
note(ws, 'v0.2.8: Magician Path. Energy Blast → Magic Bolt, Energy Shield → Mana Shield, Firebolt → Fire Bolt, Thorn Bind → Thorn Volley; new Chain Spark. Frost Shard, Spirit Drain and other Spirit skills are future content.')
RENAME = {'energy_blast': 'magic_bolt', 'energy_shield': 'mana_shield', 'firebolt': 'fire_bolt', 'thorn_bind': 'thorn_volley'}
DEF = {
    'magic_bolt': dict(name='Magic Bolt', branch='basic', type='active', unlock_stage='start', damage_multiplier=1.3, duration_s=None, mp_cost=8,
                       effect='130% ranged damage', desc='A bolt of raw energy thrown from a distance.', prev=None,
                       notes='v0.2.8: root of the Magician Path (was Energy Blast). Ranged; spends more MP than the Warrior Path for the same fight.'),
    'mana_shield': dict(name='Mana Shield', branch='basic', type='buff', unlock_stage='start', damage_multiplier=None, duration_s=45, mp_cost=14,
                        effect='30% less damage taken (+5% per rank)', desc='A ward that dulls incoming blows.', prev='magic_bolt',
                        notes='v0.2.8: basic defensive follow-up (was Energy Shield). 45 s.'),
    'fire_bolt': dict(name='Fire Bolt', branch='elemental', type='active', unlock_stage='mid', damage_multiplier=1.9, duration_s=3, mp_cost=16,
                      effect='190% damage + 3s burn', desc='A searing bolt that sets the target alight.', prev='mana_shield',
                      notes='v0.2.8: hits harder than Magic Bolt and burns (was Firebolt).'),
    'thorn_volley': dict(name='Thorn Volley', branch='nature', type='active', unlock_stage='early', damage_multiplier=0.7, duration_s=None, mp_cost=14,
                         effect='Three thorns, 70% damage each', desc='A spread of thorns that flies from your hand.', prev='mana_shield',
                         notes='v0.2.8: a short volley of three projectiles (was Thorn Bind).'),
    'chain_spark': dict(name='Chain Spark', branch='elemental', type='active', unlock_stage='late', damage_multiplier=1.5, duration_s=None, mp_cost=20,
                        effect='150% damage, then jumps to up to 3 more foes (75% each jump)', desc='A spark that leaps from foe to foe.', prev='thorn_volley',
                        notes='v0.2.8: the deepest Magician skill in this release, paced toward blue.'),
}
for old, new in RENAME.items():
    r = find(ws, h, c, 'id', old)
    ws.cell(r, c['id']).value = new
for sid, d in DEF.items():
    r = find(ws, h, c, 'id', sid)
    if r is None:
        r = ws.max_row + 1
        ws.cell(r, c['id']).value = sid
        ws.cell(r, c['class_id']).value = 'mage'
        ws.cell(r, c['max_rank']).value = 10
    ws.cell(r, c['name']).value = d['name']
    ws.cell(r, c['branch']).value = d['branch']
    ws.cell(r, c['type']).value = d['type']
    ws.cell(r, c['unlock_stage']).value = d['unlock_stage']
    ws.cell(r, c['damage_multiplier']).value = d['damage_multiplier']
    ws.cell(r, c['duration_s']).value = d['duration_s']
    ws.cell(r, c['mp_cost']).value = d['mp_cost']
    ws.cell(r, c['effect']).value = d['effect']
    ws.cell(r, c['description']).value = d['desc']
    ws.cell(r, c['desc']).value = d['desc']
    ws.cell(r, c['notes']).value = d['notes']
    ws.cell(r, c['path_id']).value = 'magician'
    ws.cell(r, c['prev_skill_id']).value = d['prev']

# ---------- unlock requirements / costs ----------
uws, uh, uc = table('unlock_requirements')
for r in range(uws.max_row, uh, -1):
    if uws.cell(r, uc['target_type']).value == 'skill' and uws.cell(r, uc['target_id']).value in RENAME.values():
        uws.delete_rows(r)

cws, ch, cc = table('skill_costs')
for r in range(cws.max_row, ch, -1):
    if cws.cell(r, cc['skill_id']).value in list(RENAME) + list(RENAME.values()) + ['chain_spark']:
        cws.delete_rows(r)
note(cws, 'v0.2.8: Magic Bolt, Mana Shield, Fire Bolt, Thorn Volley and Chain Spark have an explicit recipe at every rank 1-10 (existing Meadow and Dirt Banks goods only, 10-40 per material, family essence as the main cost).')
R = {
    'magic_bolt': [
        'Monster Essence 20, Training Scroll 8, Copper 22',
        'Monster Essence 28, Training Scroll 10, Copper 26, Pebble 14',
        'Monster Essence 34, Training Scroll 12, Copper 30, Tough Root 14, Stone Chunk 10',
        'Monster Essence 38, Training Scroll 14, Copper 34, Earth Shard 12, Dry Root 20',
        'Monster Essence 40, Training Scroll 16, Copper 36, Tough Root 18, Stone Chunk 14, Earth Crystal 1',
        'Monster Essence 40, Training Scroll 16, Copper 36, Clay 24, Earth Shard 14',
        'Monster Essence 40, Training Scroll 18, Copper 38, Tough Root 22, Fire Shard 10',
        'Monster Essence 40, Training Scroll 18, Copper 40, Earth Grit 28, Stone Chunk 16',
        'Monster Essence 40, Training Scroll 20, Copper 40, Earth Shard 16, Lightning Shard 12',
        'Monster Essence 40, Training Scroll 20, Copper 40, Tough Root 24, Earth Crystal 2',
    ],
    'mana_shield': [
        'Monster Essence 24, Training Scroll 8, Copper 24, Clay 12',
        'Monster Essence 30, Training Scroll 10, Copper 28, Clay 16',
        'Monster Essence 36, Training Scroll 12, Copper 32, Tough Root 14, Earth Shard 10',
        'Monster Essence 40, Training Scroll 14, Copper 34, Dry Root 22, Earth Shard 12',
        'Monster Essence 40, Training Scroll 16, Copper 36, Tough Root 18, Earth Crystal 1',
        'Monster Essence 40, Training Scroll 16, Copper 36, Clay 24, Earth Shard 14',
        'Monster Essence 40, Training Scroll 18, Copper 38, Tough Root 22, Fire Shard 10',
        'Monster Essence 40, Training Scroll 18, Copper 40, Earth Grit 28, Stone Chunk 16',
        'Monster Essence 40, Training Scroll 20, Copper 40, Earth Shard 16, Lightning Shard 12',
        'Monster Essence 40, Training Scroll 20, Copper 40, Tough Root 24, Earth Crystal 2',
    ],
    'fire_bolt': [
        'Elemental Essence 28, Earth Grit 20, Fire Shard 10, Copper 26',
        'Elemental Essence 34, Earth Grit 24, Fire Shard 14, Copper 30',
        'Elemental Essence 40, Fire Shard 16, Earth Shard 12, Earth Grit 28, Copper 34',
        'Elemental Essence 40, Fire Shard 18, Lightning Shard 12, Copper 36',
        'Elemental Essence 40, Fire Shard 20, Earth Grit 32, Copper 38, Earth Crystal 1',
        'Elemental Essence 40, Fire Shard 20, Earth Shard 16, Tough Root 16, Copper 38',
        'Elemental Essence 40, Fire Shard 22, Earth Grit 34, Copper 40',
        'Elemental Essence 40, Fire Shard 22, Lightning Shard 16, Earth Shard 16, Copper 40',
        'Elemental Essence 40, Fire Shard 24, Earth Grit 36, Copper 40',
        'Elemental Essence 40, Fire Shard 24, Earth Grit 36, Lightning Shard 18, Copper 40, Earth Crystal 2',
    ],
    'thorn_volley': [
        'Nature Essence 24, Dry Root 14, Bark 10, Copper 22',
        'Nature Essence 30, Dry Root 18, Bark 12, Clay 12, Copper 26',
        'Nature Essence 36, Dry Root 22, Tough Root 12, Earth Shard 10, Copper 30',
        'Nature Essence 40, Tough Root 16, Dry Root 24, Clay 20, Copper 34',
        'Nature Essence 40, Tough Root 20, Earth Shard 14, Stone Chunk 12, Copper 36, Earth Crystal 1',
        'Nature Essence 40, Dry Root 26, Clay 24, Tough Root 18, Copper 36',
        'Nature Essence 40, Earth Shard 16, Dry Root 28, Stone Chunk 14, Copper 38',
        'Nature Essence 40, Tough Root 22, Earth Grit 26, Clay 26, Copper 38',
        'Nature Essence 40, Earth Shard 18, Tough Root 24, Dry Root 30, Copper 40',
        'Nature Essence 40, Tough Root 26, Earth Grit 30, Stone Chunk 16, Copper 40, Earth Crystal 2',
    ],
    'chain_spark': [
        'Elemental Essence 32, Lightning Shard 12, Earth Grit 24, Copper 30',
        'Elemental Essence 36, Lightning Shard 14, Earth Shard 14, Copper 32',
        'Elemental Essence 40, Lightning Shard 16, Fire Shard 14, Copper 34',
        'Elemental Essence 40, Lightning Shard 16, Earth Grit 30, Copper 36',
        'Elemental Essence 40, Lightning Shard 18, Earth Shard 16, Copper 38, Earth Crystal 1',
        'Elemental Essence 40, Lightning Shard 18, Fire Shard 18, Copper 38',
        'Elemental Essence 40, Lightning Shard 20, Earth Grit 34, Copper 40',
        'Elemental Essence 40, Lightning Shard 20, Earth Shard 18, Copper 40',
        'Elemental Essence 40, Lightning Shard 22, Fire Shard 20, Copper 40',
        'Elemental Essence 40, Lightning Shard 24, Earth Grit 36, Copper 40, Earth Crystal 2',
    ],
}
for sid, ranks in R.items():
    for i, txt in enumerate(ranks):
        for mat, qty in recipe(txt):
            if qty > 40:
                sys.exit(f'{sid} r{i + 1} {mat} {qty}')
            append(cws, cc, {'skill_id': sid, 'rank': i + 1, 'material_id': mat, 'quantity': qty})

# ---------- Tamsin ----------
ws, h, c = table('npcs')
note(ws, 'v0.2.8: Tamsin, the Magician Path tutorial giver in Meadow Town.')
append(ws, c, {'id': 'tamsin', 'name': 'Tamsin', 'role': 'path',
               'desc': 'Magic is mostly patience, and a great deal of mana. Walk the Magician Path when you are ready.',
               'notes': 'v0.2.8. Dreamy and exact; counts under her breath. Gives The Quiet Spell. After it, E opens the Paths window on the Magician tab.'})

# ---------- tutorial quest ----------
ws, h, c = table('skill_quests')
note(ws, "v0.2.8: ql_magic, Tamsin's Magician Path tutorial (talk, open the Magician tab, train Magic Bolt, report back).")
base = dict(line_id='ql_magic', name='The Quiet Spell', giver='tamsin', gate_level=None, gate_stat=None, gate_value=None, unlock_skill=None,
            reward_xp=None, reward_coins=None, reward_items=None, trigger=None)
for st in [
    dict(id='ql_magic_1', step=1, desc='Tamsin walks the Magician Path, and thinks you might.', objective='Talk to Tamsin in Meadow Town.', trigger='quest:ql_paths',
         notes='v0.2.8. Auto-starts when The Hero\'s Paths is done. Introduces the Magician Path, its chain and the MP cost; gives the Magic Bolt rank 1 materials.'),
    dict(id='ql_magic_2', step=2, desc='Open the Paths window and look at the second tree.', objective='Press K and switch to the Magician Path.',
         notes='v0.2.8. Advances when the Magician tab is shown.'),
    dict(id='ql_magic_3', step=3, desc='Magic Bolt is the root. Learn it and keep it in an attack slot.', objective='Train Magic Bolt and keep it in an attack slot.',
         notes='v0.2.8. Advances when Magic Bolt is learned.'),
    dict(id='ql_magic_4', step=4, desc='Tamsin wants to hear about the mana.', objective='Return to Tamsin.',
         notes='v0.2.8. Rewards: 70 XP, 20 copper, Clear Dew x4 (MP), Monster Essence x6. No skill.',
         reward_xp=70, reward_coins=20, reward_items='clear_dew x4; monster_essence x6'),
]:
    append(ws, c, {**base, **st})

for n in wb.sheetnames:
    for row in wb[n].iter_rows():
        for cell in row:
            if cell.data_type == 'f' and str(cell.value).upper() in ('=TRUE()', '=FALSE()'):
                cell.value = str(cell.value).upper() == '=TRUE()'
wb.save(P)
print('saved')
