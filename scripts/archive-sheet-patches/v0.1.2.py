"""v0.1.2 balance patch for sheet/Game_Design_DB_v0.xlsx (Oded's playtest notes).
Run once: python3 scripts/sheet-patches/v0.1.2.py && npm run export-sheet
The same edits must be mirrored in the Google Sheet master (listed in README / report)."""
import openpyxl, re, sys
P = 'sheet/Game_Design_DB_v0.xlsx'
wb = openpyxl.load_workbook(P)

def table(name):
    ws = wb[name]
    hdr_row = 2 if str(ws.cell(1, 1).value or '').startswith(('NOTE', 'DRAFT')) else 1
    cols = {str(c.value).strip(): c.column for c in ws[hdr_row] if c.value}
    return ws, hdr_row, cols

def kv_set(name, key, value=None, notes=None):
    ws, h, cols = table(name)
    for r in range(h + 1, ws.max_row + 1):
        if ws.cell(r, cols['key']).value == key:
            if value is not None: ws.cell(r, cols['value']).value = value
            if notes is not None: ws.cell(r, cols['notes']).value = notes
            return
    raise KeyError(key)

if wb['monsters'].cell(1, 1).value and 'v0.1.2' in str(wb['monsters'].cell(1, 1).value):
    sys.exit('already patched')

# 10. Monster HP −50%; 2. attack_type column (melee | ranged).
ws, h, cols = table('monsters')
if 'attack_type' not in cols:
    c = ws.max_column + 1
    ws.cell(h, c).value = 'attack_type'
    cols['attack_type'] = c
for r in range(h + 1, ws.max_row + 1):
    mid = ws.cell(r, cols['id']).value
    if not mid: continue
    ws.cell(r, cols['hp']).value = int(round(ws.cell(r, cols['hp']).value * 0.5))
    ws.cell(r, cols['attack_type']).value = 'ranged' if mid in ('crow',) else 'melee'
ws.cell(1, 1).value = str(ws.cell(1, 1).value) + (
    ' v0.1.2: hp halved across the board after playtest (regular mobs now die in ~3-4 hits at parity). '
    'attack_type: melee = damage only on body contact; ranged = slow, visible, dodgeable projectile (Crow only in Meadows).')

# 9. Drop rates ×2 (relative order kept; capped at 90%).
ws, h, cols = table('drop_tables')
types = {}
iws, ih, icols = table('items')
for r in range(ih + 1, iws.max_row + 1):
    types[iws.cell(r, icols['id']).value] = iws.cell(r, icols['item_type']).value
ESS = {'nature_essence', 'elemental_essence', 'spirit_essence'}
for r in range(h + 1, ws.max_row + 1):
    v = ws.cell(r, cols['drop_rate']).value
    item = ws.cell(r, cols['item_id']).value
    # Quantity ranges (Oded): copper 1-4, commons 1-3, uncommons 1-2, rares 1. Rolled low-weighted in game.
    if isinstance(v, (int, float)) and item:
        old_max = ws.cell(r, cols['max_qty']).value or 1
        if item == 'copper_coin': rule = 4
        elif item in ESS: rule = 3
        elif item == 'monster_essence': rule = 2
        elif types.get(item) == 'material': rule = 3 if v >= 10 else 2 if v >= 1 else 1
        else: rule = 1
        ws.cell(r, cols['min_qty']).value = ws.cell(r, cols['min_qty']).value or 1
        ws.cell(r, cols['max_qty']).value = max(old_max, rule)
    if isinstance(v, (int, float)):
        nv = min(90, v * 2)
        ws.cell(r, cols['drop_rate']).value = int(nv) if float(nv).is_integer() else round(nv, 4)
ws.cell(1, 1).value = ('NOTE: drop_rate is a percent (25 = 25%, 0.5 = 0.5%). Each row is an independent roll. '
    'v0.1.2: every rate doubled after playtest (capped at 90%), relative rarity unchanged. Bands now: copper ~70%; category essences 40-60% (qty 1-3; bosses 80%, 2-5). '
    'Monster Essence ~30%; Training Scroll ~12%. Material bands: commons 30-40%; uncommons 2-6%; crystals / Holy Essence / Soul Shard / Log ~0.6-2%; Heartwood boss-only ~4-10%; '
    'gear ~0.1-0.4%; ultra-rares ~0.02-0.1%. Healing and MP drinks are NOT on every monster — only overlapping subsets of thematically related ones, at low rates. '
    'Quantities (min_qty-max_qty, rolled weighted toward the low end): copper 1-4, essences 1-3, Monster Essence 1-2, common materials 1-3, uncommon materials 1-2, rares/gear/consumables/junk 1. '
    'Mid curios and rare high-sell junk are shared by 2-3 related monsters. unlock_requirement_id is optional (e.g. unlock_cursed_dust).')

# 13. Subtler level growth: 3 points/level (was 5), smaller HP/MP per level and HP per STR.
kv_set('combat_formulas', 'player_points_per_level', 3, 'v0.1.2: was 5. Level 1 starts with 3 points. Skill training is the main power-up, levels are a subtle bonus.')
for k, v in {'hp_per_level_warrior': 10, 'hp_per_level_mage': 6, 'hp_per_level_rogue': 8,
             'mp_per_level_warrior': 2, 'mp_per_level_mage': 6, 'mp_per_level_rogue': 4, 'hp_per_str': 3}.items():
    kv_set('combat_formulas', k, v, None)
kv_set('combat_formulas', 'hp_per_str', 3, 'v0.1.2: was 4.')
kv_set('combat_formulas', 'example_build', 'STR 12, SPI 3 (all 15 points). Wooden Sword. Full cloth (defense 12).')
kv_set('combat_formulas', 'example_player_hp', 196, '120 base + 10 × 4 levels + 12 STR × 3')
kv_set('combat_formulas', 'example_player_mp', 48, '40 base + 2 × 4 levels')
kv_set('combat_formulas', 'example_player_attack', 37, '(10 + 12 × 2) × 1.1 = 37')
kv_set('combat_formulas', 'example_power_strike', '39 damage', 'floor(1.4 × 37 − 12) = 39 (rank 0)')
kv_set('combat_formulas', 'example_hits_to_kill', '6 Power Strikes', 'Boar hp 225 (v0.1.2) / 39')
kv_set('combat_formulas', 'example_boar_hit', '24 damage (12% of 196 HP)', '36 − 12 defense')
kv_set('game_rules', 'ability_points_per_level', 3, 'v0.1.2: was 5. Fewer free points so skill training is the real power-up.')
kv_set('game_rules', 'level_up_rewards', '3 ability points; full HP and MP restore; brief invulnerability')
kv_set('game_rules', 'drop_rate_bands', 'category essences 40-60% (qty 1-3, bosses more); commons 30-40%; uncommons 2-6%; rares ~0.6-2%',
       'v0.1.2: all drop rates doubled after playtest; relative rarity unchanged.')
kv_set('game_rules', 'skill_rank_scaling', 'basic +5%/rank; nature +12%; elemental +10%; spiritual +10% (to be tuned)',
       'v0.1.2: raised (was +2/+8/+7/+7) because per-level gains were cut — rank-ups are the main power-up. '
       'Damage skills: +N percentage points of attack per rank (Power Strike 140% → 190% at rank 10). Buffs/shields: effect × (1 + N% × rank). '
       'Basic skills are known at rank 0 (base value); category skills are learned at rank 1 (base value) and scale from rank 2.')

ws, h, cols = table('ability_stats')
for r in range(h + 1, ws.max_row + 1):
    if ws.cell(r, cols['id']).value == 'STR':
        ws.cell(r, cols['description']).value = "Warrior's main damage stat (feeds attack ×2). Also +3 max HP per point."
ws.cell(1, 1).value = 'NOTE: These are the four allocatable stats. Each level grants 3 points (v0.1.2, was 5) that can be spent freely on any of them. Effects below are v0 numbers used by combat_formulas and may pivot after playtesting.'

ws, h, cols = table('skills')
scal = {'basic': '+5% / rank (to be tuned)', 'nature': '+12% / rank (to be tuned)', 'elemental': '+10% / rank (to be tuned)', 'spiritual': '+10% / rank (to be tuned)'}
for r in range(h + 1, ws.max_row + 1):
    b = ws.cell(r, cols['branch']).value
    if b in scal: ws.cell(r, cols['per_rank_scaling']).value = scal[b]
ws.cell(1, 1).value = re.sub(r'\(\+2%/rank\)', '(+5%/rank, v0.1.2)', str(ws.cell(1, 1).value)).replace(
    '(nature +8%, elemental +7%, spiritual +7%)', '(nature +12%, elemental +10%, spiritual +10% — raised in v0.1.2 so training is the main power-up)')

# openpyxl drops cached formula results; the sheet uses =TRUE()/=FALSE() cells, so store them as plain booleans.
for n in wb.sheetnames:
    for row in wb[n].iter_rows():
        for c in row:
            if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                c.value = str(c.value).upper() == '=TRUE()'
wb.save(P)
print('patched', P)
