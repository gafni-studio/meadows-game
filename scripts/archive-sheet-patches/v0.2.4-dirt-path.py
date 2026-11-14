"""v0.2.4: The Dirt Path quest, Spark Bug + Frost Moth in the Dirt Banks,
shared materials + a unique extra each, warrior gear pools ~1/150–200,
ME > category essence. Run: python3 scripts/sheet-patches/v0.2.4-dirt-path.py && npm run export-sheet
"""
import openpyxl, sys

P = 'sheet/Game_Design_DB_v0.xlsx'
wb = openpyxl.load_workbook(P)

def table(name):
    ws = wb[name]
    hdr_row = 2 if str(ws.cell(1, 1).value or '').startswith(('NOTE', 'DRAFT')) else 1
    cols = {str(c.value).strip(): c.column for c in ws[hdr_row] if c.value}
    return ws, hdr_row, cols

def find(ws, h, cols, key, val, key2=None, val2=None):
    for r in range(h + 1, ws.max_row + 1):
        if ws.cell(r, cols[key]).value == val and (key2 is None or ws.cell(r, cols[key2]).value == val2):
            return r
    return None

def append(ws, h, cols, row):
    r = ws.max_row + 1
    for k, v in row.items():
        if k not in cols:
            raise KeyError(f'{ws.title}.{k}')
        ws.cell(r, cols[k]).value = v
    return r

def setrow(ws, r, cols, **kw):
    for k, v in kw.items():
        ws.cell(r, cols[k]).value = v

def freeze_bools():
    for n in wb.sheetnames:
        for row in wb[n].iter_rows():
            for c in row:
                if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                    c.value = str(c.value).upper() == '=TRUE()'

iws, ih, icols = table('items')
note = str(iws.cell(1, 1).value or '')
if 'v0.2.4' in note:
    sys.exit('already patched')
iws.cell(1, 1).value = note + '  v0.2.4: Spark Shell (Spark Bug unique junk) and Pale Wing (Frost Moth unique junk).'

if not find(iws, ih, icols, 'id', 'spark_shell'):
    append(iws, ih, icols, {
        'id': 'spark_shell', 'name': 'Spark Shell', 'item_type': 'misc', 'subtype_id': None,
        'native_zone': 'meadows', 'passively_gatherable': False, 'sellable_only': True, 'sell_price': 48,
        'description': 'A shell that still holds a faint snap.',
        'notes': 'v0.2.4: unique extra on Spark Bug (2.4%). Sell-only junk, not a material or trophy. Design only in notes.',
        'desc': 'A shell that still holds a faint snap.',
    })
if not find(iws, ih, icols, 'id', 'pale_wing'):
    append(iws, ih, icols, {
        'id': 'pale_wing', 'name': 'Pale Wing', 'item_type': 'misc', 'subtype_id': None,
        'native_zone': 'meadows', 'passively_gatherable': False, 'sellable_only': True, 'sell_price': 42,
        'description': 'A moth wing, cool to the touch.',
        'notes': 'v0.2.4: unique extra on Frost Moth (2.2%). Sell-only junk. Design only in notes.',
        'desc': 'A moth wing, cool to the touch.',
    })

# --- skill_quests: The Dirt Path ---
qws, qh, qcols = table('skill_quests')
if not find(qws, qh, qcols, 'id', 'ql_dirt_path_1'):
    append(qws, qh, qcols, {
        'id': 'ql_dirt_path_1', 'line_id': 'ql_dirt_path', 'step': 1,
        'name': 'The Dirt Path',
        'desc': 'Pell has a job past the east pasture, into the dirt.',
        'objective': 'Talk to Pell at the east gate in Meadow Town.',
        'notes': 'B-001 / v0.2.4. Starts once the player has spent a first passive point (prereq sq_first_passive, or any passive rank / pending upgrade). Giver Pell. Does not grant a skill.',
        'trigger': 'passive:1', 'gate_level': None, 'gate_stat': None, 'gate_value': None,
        'reward_xp': None, 'reward_coins': None, 'reward_items': None, 'unlock_skill': None, 'giver': 'pell',
    })
    append(qws, qh, qcols, {
        'id': 'ql_dirt_path_2', 'line_id': 'ql_dirt_path', 'step': 2,
        'name': 'The Dirt Path',
        'desc': 'The crows at the east end of the pasture keep the path.',
        'objective': 'Defeat 4 Crows in the east of Sunny Pasture.',
        'notes': 'B-001. Hunt counts (not a named foe). Advances automatically at 4.',
        'trigger': None, 'gate_level': None, 'gate_stat': None, 'gate_value': None,
        'reward_xp': None, 'reward_coins': None, 'reward_items': None, 'unlock_skill': None, 'giver': None,
    })
    append(qws, qh, qcols, {
        'id': 'ql_dirt_path_3', 'line_id': 'ql_dirt_path', 'step': 3,
        'name': 'The Dirt Path',
        'desc': 'The dirt path at the far east of the pasture leads on.',
        'objective': 'Take the dirt path at the far east of the pasture into the Dirt Banks.',
        'notes': 'B-001. Reach dirt_banks. Auto-advances.',
        'trigger': None, 'gate_level': None, 'gate_stat': None, 'gate_value': None,
        'reward_xp': None, 'reward_coins': None, 'reward_items': None, 'unlock_skill': None, 'giver': None,
    })
    append(qws, qh, qcols, {
        'id': 'ql_dirt_path_4', 'line_id': 'ql_dirt_path', 'step': 4,
        'name': 'The Dirt Path',
        'desc': 'A first mixed hunt in the banks — moles and warm beetles — then back to Pell.',
        'objective': 'Defeat 5 Burrow Moles and 3 Ember Beetles, then return to Pell.',
        'notes': 'B-001. Hunt 5 moles + 3 beetles, then talk to Pell to complete. Rewards: 120 XP, 25 copper, Nature Essence ×8, Elemental Essence ×5, Meadow Dew ×2 — a taste, not a skipped rank.',
        'trigger': None, 'gate_level': None, 'gate_stat': None, 'gate_value': None,
        'reward_xp': 120, 'reward_coins': 25, 'reward_items': 'nature_essence x8; elemental_essence x5; meadow_dew x2',
        'unlock_skill': None, 'giver': 'pell',
    })
qn = str(qws.cell(1, 1).value or '')
if 'v0.2.4' not in qn:
    qws.cell(1, 1).value = qn + '  v0.2.4: The Dirt Path (ql_dirt_path), giver Pell, prereq sq_first_passive / first passive point. 4 Crows, reach the Banks, 5 Moles and 3 Ember Beetles, return to Pell. No skill grant.'

# --- map_layout Dirt Banks ---
mws, mh, mcols = table('map_layout')
r = find(mws, mh, mcols, 'id', 'dirt_banks')
if r:
    setrow(mws, r, mcols,
        monster_ids='burrow_mole, earth_sprite, ember_beetle, spark_bug, frost_moth',
        spawn_counts='burrow_mole 6, earth_sprite 4, ember_beetle 4, spark_bug 3, frost_moth 3',
        level_range='3-6',
        notes=str(mws.cell(r, mcols['notes']).value or '') + '  v0.2.4: Spark Bugs along the east banks (3) and Frost Moths on the west (3). Shared materials plus a unique extra each. Shrine remains closed; these two also stay listed on the Shrine row for later.',
    )
mn = str(mws.cell(1, 1).value or '')
if 'v0.2.4' not in mn:
    mws.cell(1, 1).value = (mn or '') + '  v0.2.4: Dirt Banks also spawns Spark Bug (3) and Frost Moth (3). Meadow Shrine stays closed.'

# --- drops ---
dws, dh, dcols = table('drop_tables')

def set_drop(mid, iid, rate, mn=1, mx=1):
    r = find(dws, dh, dcols, 'monster_id', mid, 'item_id', iid)
    if r:
        setrow(dws, r, dcols, drop_rate=rate, min_qty=mn, max_qty=mx)
    else:
        append(dws, dh, dcols, {'monster_id': mid, 'item_id': iid, 'drop_rate': rate, 'min_qty': mn, 'max_qty': mx, 'unlock_requirement_id': None})

def del_drop(mid, iid):
    r = find(dws, dh, dcols, 'monster_id', mid, 'item_id', iid)
    if r:
        dws.delete_rows(r)

# Spark Bug: shared mats + unique shell; warrior gear ~0.56% (1 in 179); ME 36 > EE 18; drop rogue weapons
del_drop('spark_bug', 'rusty_dagger')
del_drop('spark_bug', 'steel_dagger')
set_drop('spark_bug', 'copper_coin', 80, 1, 4)
set_drop('spark_bug', 'monster_essence', 36, 1, 2)
set_drop('spark_bug', 'elemental_essence', 18, 1, 2)
set_drop('spark_bug', 'dry_root', 22, 1, 3)
set_drop('spark_bug', 'tough_root', 3.5, 1, 2)
set_drop('spark_bug', 'earth_grit', 30, 1, 3)
set_drop('spark_bug', 'warm_stone', 1.2, 1, 1)
set_drop('spark_bug', 'lightning_shard', 5, 1, 2)
set_drop('spark_bug', 'spark_shell', 2.4, 1, 1)
set_drop('spark_bug', 'stone_club', 0.22, 1, 1)
set_drop('spark_bug', 'leather_vest', 0.18, 1, 1)
set_drop('spark_bug', 'leather_gloves', 0.16, 1, 1)
set_drop('spark_bug', 'smoldering_scale', 0.8, 1, 1)
set_drop('spark_bug', 'training_scroll', 12, 1, 2)

# Frost Moth: now a Banks mob — copper 80 (v0.2.3 note 23), shared mats, Pale Wing, warrior gear ~0.62%
set_drop('frost_moth', 'copper_coin', 80, 1, 4)
set_drop('frost_moth', 'monster_essence', 36, 1, 2)
set_drop('frost_moth', 'elemental_essence', 18, 1, 2)
set_drop('frost_moth', 'dry_root', 16, 1, 3)
set_drop('frost_moth', 'tough_root', 2.5, 1, 2)
set_drop('frost_moth', 'earth_grit', 30, 1, 3)
set_drop('frost_moth', 'ice_shard', 5, 1, 2)
set_drop('frost_moth', 'warm_stone', 0.8, 1, 1)
set_drop('frost_moth', 'pale_wing', 2.2, 1, 1)
del_drop('frost_moth', 'steel_staff')
set_drop('frost_moth', 'worn_staff', 0.06, 1, 1)  # tiny mage overlap
set_drop('frost_moth', 'cloth_tunic', 0.18, 1, 1)
set_drop('frost_moth', 'cloth_gloves', 0.16, 1, 1)
set_drop('frost_moth', 'hide_boots', 0.16, 1, 1)
set_drop('frost_moth', 'stone_club', 0.12, 1, 1)

dn = str(dws.cell(1, 1).value or '')
if 'v0.2.4' not in dn:
    dws.cell(1, 1).value = dn + '  v0.2.4: Spark Bug and Frost Moth retuned for the Dirt Banks — shared Dry Root / Tough Root / Earth Grit / Warm Stone, unique Spark Shell (2.4%) and Pale Wing (2.2%), warrior gear pools 0.56% / 0.62% (≈1 in 179 / 161). ME 36% stays above EE 18%. Frost Moth copper 80. Rogue/mage mid weapons trimmed so the 150–200 band holds.'

# --- npcs Pell note ---
nws, nh, ncols = table('npcs')
r = find(nws, nh, ncols, 'id', 'pell')
if r:
    notes = str(nws.cell(r, ncols['notes']).value or '')
    if 'v0.2.4' not in notes:
        nws.cell(r, ncols['notes']).value = notes + '  v0.2.4: After a first passive point, Pell offers The Dirt Path.'

freeze_bools()
wb.save(P)
print('patched v0.2.4')
