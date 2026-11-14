"""v0.2.3 playtest fixes: PS cost 20, Short Sword shop, STR flat formula,
Strawberry/Blueberry, Wool-Shoulder copper (on-kill, not a 100% table),
Earthbreaker/Flame Cleave unlock training only, Wild Apple retired from shop/drops.
Run: python3 scripts/sheet-patches/v0.2.3-fixes.py && npm run export-sheet
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

def freeze_bools():
    for n in wb.sheetnames:
        for row in wb[n].iter_rows():
            for c in row:
                if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                    c.value = str(c.value).upper() == '=TRUE()'

# Guard
iws, ih, icols = table('items')
note = str(iws.cell(1, 1).value or '')
if 'v0.2.3' in note:
    sys.exit('already patched')
iws.cell(1, 1).value = note + '  v0.2.3: Wild Apple retired from shop and drops (kept so old bags still work). Strawberry restores HP, Blueberry restores MP; mouse and sheep each drop one, slightly above the old apple rate. Short Sword is a plain shop weapon at 30 Copper.'

# --- items: strawberry, blueberry, short_sword; retire wild_apple shop role ---
if not find(iws, ih, icols, 'id', 'strawberry'):
    append(iws, ih, icols, {
        'id': 'strawberry', 'name': 'Strawberry', 'item_type': 'consumable', 'subtype_id': None,
        'native_zone': 'meadows', 'passively_gatherable': False, 'sellable_only': False, 'sell_price': 3,
        'description': 'A ripe meadow strawberry.',
        'notes': 'Restores 18 HP. v0.2.3: replaces Wild Apple as the mouse forage. Shop 5 Copper. Drop 6% (was apple 4%). Mechanical effect in notes; desc is flavor only.',
        'desc': 'A ripe meadow strawberry.',
    })
if not find(iws, ih, icols, 'id', 'blueberry'):
    append(iws, ih, icols, {
        'id': 'blueberry', 'name': 'Blueberry', 'item_type': 'consumable', 'subtype_id': None,
        'native_zone': 'meadows', 'passively_gatherable': False, 'sellable_only': False, 'sell_price': 3,
        'description': 'A small, tart blueberry.',
        'notes': 'Restores 15 MP. v0.2.3: sheep forage counterpart to Strawberry. Shop 5 Copper. Drop 6%. Mechanical effect in notes; desc is flavor only.',
        'desc': 'A small, tart blueberry.',
    })
if not find(iws, ih, icols, 'id', 'short_sword'):
    append(iws, ih, icols, {
        'id': 'short_sword', 'name': 'Short Sword', 'item_type': 'gear', 'subtype_id': 'weapon',
        'native_zone': 'meadows', 'passively_gatherable': False, 'sellable_only': False, 'sell_price': 20,
        'description': 'A short iron blade, sturdier than a practice sword.',
        'notes': 'v0.2.3: Mara sells this for 30 Copper. Mid 13 damage (12–14) × 1.1, STR 1. A clear step up from the Wooden Sword (10×1.1) and below a Meadow Blade. Shop-only, not a drop.',
        'desc': 'A short iron blade, sturdier than a practice sword.',
    })
r = find(iws, ih, icols, 'id', 'wild_apple')
if r:
    iws.cell(r, icols['notes']).value = 'Restores 15 HP. v0.2.3: retired from the shop and from drops; replaced by Strawberry (HP, mouse) and Blueberry (MP, sheep). Kept so existing bags still work.'

# --- gear ---
gws, gh, gcols = table('gear')
if not find(gws, gh, gcols, 'item_id', 'short_sword'):
    append(gws, gh, gcols, {
        'item_id': 'short_sword', 'slot': 'weapon', 'class_id': 'warrior',
        'required_stat': 'STR', 'required_value': 1, 'stat_multiplier': 1.1,
        'defense': 0, 'weapon_damage': 13, 'description': 'A short iron blade, sturdier than a practice sword.',
        'defense_min': 0, 'defense_max': 0, 'weapon_damage_min': 12, 'weapon_damage_max': 14,
        'desc': 'A short iron blade, sturdier than a practice sword.',
    })

# --- shop: replace apple, add short sword at the end (do not change early order; smoke arrows to Spring Draught) ---
sws, sh, scols = table('npc_shop')
r = find(sws, sh, scols, 'id', 'shop_apple')
if r:
    sws.cell(r, scols['id']).value = 'shop_strawberry'
    sws.cell(r, scols['item_id']).value = 'strawberry'
    sws.cell(r, scols['price']).value = 5
    sws.cell(r, scols['notes']).value = 'Restores 18 HP. v0.2.3: replaces Wild Apple.'
if not find(sws, sh, scols, 'id', 'shop_blueberry'):
    append(sws, sh, scols, {
        'id': 'shop_blueberry', 'item_id': 'blueberry', 'role': 'sell', 'price': 5,
        'currency': 'copper_coin', 'stock': 'unlimited', 'notes': 'Restores 15 MP. v0.2.3.',
    })
if not find(sws, sh, scols, 'id', 'shop_short_sword'):
    append(sws, sh, scols, {
        'id': 'shop_short_sword', 'item_id': 'short_sword', 'role': 'sell', 'price': 30,
        'currency': 'copper_coin', 'stock': 'unlimited', 'notes': 'v0.2.3: a plain step up from the starter Wooden Sword, 30 Copper.',
    })
n = str(sws.cell(1, 1).value or '')
if 'v0.2.3' not in n:
    sws.cell(1, 1).value = n + '  v0.2.3: Short Sword at 30 Copper (an exception to "no weapons in this shop"); Wild Apple replaced by Strawberry and Blueberry.'

# --- drops: remove wild_apple, add berries 6% on mouse/sheep ---
dws, dh, dcols = table('drop_tables')
# delete wild_apple rows by clearing (openpyxl delete is messy); zero them and we'll skip 0 later... better delete rows from bottom
apple_rows = []
for r in range(dh + 1, dws.max_row + 1):
    if dws.cell(r, dcols['item_id']).value == 'wild_apple':
        apple_rows.append(r)
for r in reversed(apple_rows):
    dws.delete_rows(r)
if not find(dws, dh, dcols, 'monster_id', 'field_mouse', 'item_id', 'strawberry'):
    append(dws, dh, dcols, {'monster_id': 'field_mouse', 'item_id': 'strawberry', 'drop_rate': 6, 'min_qty': 1, 'max_qty': 1, 'unlock_requirement_id': None})
if not find(dws, dh, dcols, 'monster_id', 'wool_sheep', 'item_id', 'blueberry'):
    append(dws, dh, dcols, {'monster_id': 'wool_sheep', 'item_id': 'blueberry', 'drop_rate': 6, 'min_qty': 1, 'max_qty': 1, 'unlock_requirement_id': None})
dn = str(dws.cell(1, 1).value or '')
if 'v0.2.3' not in dn:
    dws.cell(1, 1).value = dn + '  v0.2.3: Wild Apple drops removed. Field Mouse 6% Strawberry, Wool Sheep 6% Blueberry (was apple 4%). Wool-Shoulder guaranteed 5–15 Copper is handled in on-kill, not as a 100% drop-table row (so droprate bonuses cannot multiply it).'

# --- Power Strike ME 20 ---
cws, ch, ccols = table('skill_costs')
r = find(cws, ch, ccols, 'skill_id', 'power_strike', 'material_id', 'monster_essence')
# find rank 1 specifically
for r in range(ch + 1, cws.max_row + 1):
    if cws.cell(r, ccols['skill_id']).value == 'power_strike' and cws.cell(r, ccols['rank']).value == 1 and cws.cell(r, ccols['material_id']).value == 'monster_essence':
        cws.cell(r, ccols['quantity']).value = 20
        break
cn = str(cws.cell(1, 1).value or '')
if 'v0.2.3' not in cn:
    cws.cell(1, 1).value = cn + '  v0.2.3: Power Strike rank-1 Monster Essence is 20 (was 30). Further ranks still scale from the rank-1 qty (r2 = 32).'

# --- combat formula ---
fws, fh, fcols = table('combat_formulas')
r = find(fws, fh, fcols, 'key', 'attack_formula')
if r:
    fws.cell(r, fcols['value']).value = 'floor(weapon_damage × weapon_stat_multiplier) + floor(main_stat / 2)'
    fws.cell(r, fcols['notes']).value = 'v0.2.3: was +1% per main-stat point, which felt weak early and strong late. Now every 2 points of the class main stat (STR Warrior, INT Mage, AGI Rogue) add +1 attack, a flat bonus after the weapon. The formula is hidden from the player. Unarmed: weapon_damage 6, multiplier 1.0.'
r = find(fws, fh, fcols, 'key', 'attack_per_main_stat_pct')
if r:
    fws.cell(r, fcols['key']).value = 'attack_per_2_main_stat'
    fws.cell(r, fcols['value']).value = 1
    fws.cell(r, fcols['notes']).value = 'v0.2.3: +1 attack per 2 main-stat points (floor). Replaces attack_per_main_stat_pct. Do not show this formula in the stats UI.'
    if 'num' in fcols:
        fws.cell(r, fcols['num']).value = 1
# food formulas
r = find(fws, fh, fcols, 'key', 'food_wild_apple')
if r:
    fws.cell(r, fcols['key']).value = 'food_strawberry'
    fws.cell(r, fcols['value']).value = '18 HP'
    fws.cell(r, fcols['notes']).value = 'Strawberry. v0.2.3: replaces Wild Apple.'
    if 'num' in fcols:
        fws.cell(r, fcols['num']).value = 18
if not find(fws, fh, fcols, 'key', 'food_blueberry'):
    append(fws, fh, fcols, {'key': 'food_blueberry', 'value': '15 MP', 'notes': 'Blueberry. v0.2.3.', **({'num': 15} if 'num' in fcols else {})})
fn = str(fws.cell(1, 1).value or '')
if 'v0.2.3' not in fn:
    fws.cell(1, 1).value = fn + '  v0.2.3: attack is +1 per 2 main-stat points (flat), hidden from the player UI.'

# --- skill_quests: crack/hot unlock training only ---
qws, qh, qcols = table('skill_quests')
for r in range(qh + 1, qws.max_row + 1):
    line = qws.cell(r, qcols['line_id']).value
    step = qws.cell(r, qcols['step']).value
    if line in ('ql_crack', 'ql_hot') and qws.cell(r, qcols['unlock_skill']).value:
        notes = str(qws.cell(r, qcols['notes']).value or '')
        qws.cell(r, qcols['notes']).value = notes + '  v0.2.3: completing this line unlocks training at Calden (rank 0 → 1 is paid), and does NOT grant the skill at rank 1. Power Strike and Rage still grant rank 1.'
qn = str(qws.cell(1, 1).value or '')
if 'v0.2.3' not in qn:
    qws.cell(1, 1).value = qn + '  v0.2.3: A Crack in the Dirt and Hot Edge only unlock training; they do not grant rank 1. The Weight of a Swing and Blood Up still grant rank 1.'

# controls: L tracker
cows, coh, cocols = table('controls')
if 'action' in cocols and not find(cows, coh, cocols, 'action', 'quest_tracker'):
    append(cows, coh, cocols, {
        'action': 'quest_tracker', 'keys': 'L', 'context': 'ui',
        'notes': 'v0.2.3: Toggle the on-screen quest objectives tracker. J still opens the full journal. L was free after the journal moved to J.',
    })

freeze_bools()
wb.save(P)
# Items 22-23 were applied in a follow-up pass on the same workbook (MP costs, copper chances).
# Re-running this file alone will skip if v0.2.3 is already in the items note; use the inline
# apply in the session or a fresh workbook from pre-0.2.3 + this file, then set:
#   skills.mp_cost: power_strike 5, rage 10, earthbreaker 10, flame_cleave 14, soul_guard 18
#   drop_tables copper: crow 80, burrow_mole 80, earth_sprite 80, ember_beetle 82, spark_bug 80
print('patched v0.2.3')
