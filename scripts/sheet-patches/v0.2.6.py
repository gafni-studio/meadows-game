"""v0.2.6: HP, XP curve, exact shop gear, explicit skill/passive recipes, drop tables,
junk removal, Frost Moth leaves the Banks. The tables are parsed straight from
planning/v0.2.6.md so numbers cannot drift from the spec. Run:
  python3 scripts/sheet-patches/v0.2.6.py [--dry] && npm run export-sheet
"""
import openpyxl, sys, re, json

DRY = '--dry' in sys.argv
P = 'sheet/Game_Design_DB_v0.xlsx'
SPEC = open('planning/v0.2.6.md', encoding='utf8').read()
wb = openpyxl.load_workbook(P)

ITEMS = {r['name']: r['id'] for r in json.load(open('data/items.json'))['rows']}
ITEMS['Copper'] = 'copper_coin'
for _slot in ('Cap', 'Vest', 'Pants', 'Boots', 'Gloves'):
    ITEMS[f'Linen {_slot}'] = f'linen_{_slot.lower()}'  # spec uses plain names; sheet has Hood/Robe/Wraps/Sandals/Sleeves
MONSTERS = {r['name']: r['id'] for r in json.load(open('data/monsters.json'))['rows']}


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


def append(ws, cols, row):
    r = ws.max_row + 1
    for k, v in row.items():
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


def note(ws, text):
    cur = str(ws.cell(1, 1).value or '')
    if 'v0.2.6' in cur:
        sys.exit('already patched')
    ws.cell(1, 1).value = (cur + '  ' + text).strip()


def clean(s):
    return s.replace('**', '').strip()


def section(title_start, until='\n---\n'):
    i = SPEC.index(title_start)
    j = SPEC.index(until, i + 1) if until in SPEC[i + 1:] else len(SPEC)
    return SPEC[i:j]


# ---------- 1. HP + XP (combat_formulas) ----------
ws, h, c = table('combat_formulas')
note(ws, 'v0.2.6: Warrior HP 100 + 7/level (was 120 + 10); Mage 70 + 4; Rogue 85 + 6; XP doubles from level 4 (80 L^1.5 + 60 L).')
for key, val, nt in [
    ('hp_base_warrior', 100, 'Max HP at level 1 before STR. v0.2.6: was 120.'),
    ('hp_per_level_warrior', 7, 'Added at each level after 1, before STR. HP = base + per_level × (level−1) + STR × hp_per_str (2). v0.2.6: was 10.'),
    ('hp_base_mage', 70, 'Max HP at level 1 before STR. v0.2.6: was 80 (parked class).'),
    ('hp_per_level_mage', 4, 'Added at each level after 1, before STR. v0.2.6: was 6 (parked class).'),
    ('hp_base_rogue', 85, 'Max HP at level 1 before STR. v0.2.6: was 100 (parked class).'),
    ('hp_per_level_rogue', 6, 'Added at each level after 1, before STR. v0.2.6: was 8 (parked class).'),
]:
    r = find(ws, h, c, 'key', key)
    setrow(ws, r, c, value=val, notes=nt)
r = find(ws, h, c, 'key', 'xp_formula')
setrow(ws, r, c,
       value='xp_to_next(L) = round(40 × L^1.5 + 30 × L) for L ≤ 3; round(80 × L^1.5 + 60 × L) for L ≥ 4',
       notes='XP required to go from level L to L+1. v0.2.6: from level 4 it takes about twice as many kills; levels 1–3 unchanged. Listed explicitly for 1-10 below; use the formula from 11 onward.')
for L in range(4, 11):
    v = round(80 * L ** 1.5 + 60 * L)
    r = find(ws, h, c, 'key', f'xp_to_next_{L}')
    old = ws.cell(r, c['notes']).value
    setrow(ws, r, c, value=v, notes=f'Level {L} → {L + 1}. v0.2.6: doubled (was {round(40 * L ** 1.5 + 30 * L)}).')
print('combat_formulas ok')

# ---------- 2. shop gear is exact ----------
ws, h, c = table('gear')
note(ws, 'v0.2.6: shop gear is fixed (min = max): full cloth set is Defense 6, Short Sword weapon damage 13.')
for iid, d, w in [('cloth_cap', 1, 0), ('cloth_tunic', 2, 0), ('cloth_pants', 1, 0), ('cloth_shoes', 1, 0),
                  ('cloth_gloves', 1, 0), ('short_sword', 0, 13)]:
    r = find(ws, h, c, 'item_id', iid)
    setrow(ws, r, c, defense=d, defense_min=d, defense_max=d, weapon_damage=w, weapon_damage_min=w, weapon_damage_max=w)
print('gear ok')

# ---------- 3. Banks spawns ----------
ws, h, c = table('map_layout')
note(ws, 'v0.2.6: Frost Moth leaves the Dirt Banks (Banks 20 regulars: mole 6, sprite 5, beetle 5, spark bug 4).')
r = find(ws, h, c, 'id', 'dirt_banks')
setrow(ws, r, c,
       monster_ids='burrow_mole, earth_sprite, ember_beetle, spark_bug',
       spawn_counts='burrow_mole 6, earth_sprite 5, ember_beetle 5, spark_bug 4')
nt = str(ws.cell(r, c['notes']).value or '')
ws.cell(r, c['notes']).value = nt + '  v0.2.6: Frost Moths no longer spawn here (their slots went to sprites, beetles and spark bugs).'
print('map_layout ok')


# ---------- 4. recipes ----------
def parse_recipe(cell):
    out = []
    for part in clean(cell).split(','):
        m = re.match(r'^(.*?)\s+(\d+)$', part.strip())
        name = m.group(1).strip()
        if name not in ITEMS:
            sys.exit(f'unknown item {name!r}')
        out.append((ITEMS[name], int(m.group(2))))
    return out


def parse_rank_tables(heading, last_col_is_recipe=True):
    """Returns {rank: [(item, qty)]} for the first table after `heading`."""
    i = SPEC.index(heading)
    lines = SPEC[i:].split('\n')[1:]
    out = {}
    started = False
    for ln in lines:
        if ln.startswith('|'):
            started = True
            cells = [x.strip() for x in ln.strip().strip('|').split('|')]
            if not cells[0].isdigit():
                continue
            out[int(cells[0])] = parse_recipe(cells[-1])
        elif started:
            break
    if sorted(out) != list(range(1, 11)):
        sys.exit(f'{heading}: ranks {sorted(out)}')
    return out


def replace_costs(sheet_name, id_col, ids_and_tables):
    ws, h, c = table(sheet_name)
    for ident in ids_and_tables:
        for r in range(ws.max_row, h, -1):
            if ws.cell(r, c[id_col]).value == ident:
                ws.delete_rows(r)
    for ident, tbl in ids_and_tables.items():
        for rank in range(1, 11):
            for mat, qty in tbl[rank]:
                append(ws, c, {id_col: ident, 'rank': rank, 'material_id': mat, 'quantity': qty})
    return ws


SK = {
    'power_strike': '### Power Strike (basic)',
    'rage': '### Rage (basic)',
    'earthbreaker': '### Earthbreaker (Nature)',
    'root_lash': '### Root Lash (Nature)',
    'flame_cleave': '### Flame Cleave (Elemental)',
    'dig_in': '### Dig In (opens around level 5',
}
skill_tables = {k: parse_rank_tables(v) for k, v in SK.items()}
ws = replace_costs('skill_costs', 'skill_id', skill_tables)
ws.cell(1, 1).value = (str(ws.cell(1, 1).value) + '  v0.2.6: Power Strike, Rage, Earthbreaker, Root Lash, Flame Cleave and Dig In have an explicit recipe at every rank 1-10 (no 1.6× scaling, amounts 10-40, no Heartwood/Log). Parked skills keep the old scaled rows.').strip()

nat = parse_rank_tables('### Nature tree (Nature Essence production')
ele = parse_rank_tables('### Elemental tree (Elemental Essence production')
ws = replace_costs('passive_costs', 'node_id', {
    'nature_prod': nat, 'nature_eff_drops': nat, 'elemental_prod': ele, 'elemental_eff_drops': ele})
ws.cell(1, 1).value = (str(ws.cell(1, 1).value) + '  v0.2.6: Nature and Elemental nodes have explicit ranks 1-10 (essence is the main gate, 20-40; other goods 8-28; Copper 18-40). Spiritual and Hunter\'s Luck are parked and unchanged.').strip()
print('recipes ok', {k: len(v) for k, v in skill_tables.items()})

# ---------- 5. drop tables ----------
ws, h, c = table('drop_tables')
note(ws, 'v0.2.6: resource stacks ~1.5-2× larger; junk (Broken Twig, Torn Cloth, Lost Button, Pasture Bell, Cracked Shell) removed from every table; Smoldering Scale 20%/12%; Ice Shard on Spark Bug; named-rate bumps for Warm Grain, Earth Shard, Tough Root, Fire/Lightning Shard, Stone Chunk.')
REMOVED_JUNK = {'broken_twig', 'torn_cloth', 'lost_button', 'pasture_bell', 'cracked_shell'}
start = SPEC.index('## Full drop tables')
end = SPEC.index('## Out of scope / unchanged')
text = SPEC[start:end]
cur = None
spec = {}
for ln in text.split('\n'):
    m = re.match(r'^### (.+?)(?: \(|$)', ln)
    if m:
        cur = MONSTERS.get(m.group(1).strip())
        if cur:
            spec[cur] = []
        continue
    if cur and ln.startswith('|'):
        cells = [x.strip() for x in ln.strip().strip('|').split('|')]
        if cells[0] in ('Item', '---') or set(cells[0]) <= set('-'):
            continue
        name = clean(cells[0])
        if name not in ITEMS:
            sys.exit(f'drop item {name!r} unknown')
        rate = float(cells[1].rstrip('%').replace('**', ''))
        rate = int(rate) if rate == int(rate) else rate
        lo, hi = re.split('[–-]', cells[2]) if re.search('[–-]', cells[2]) else (cells[2], cells[2])
        spec[cur].append((ITEMS[name], rate, int(lo), int(hi)))

stats = {'upd': 0, 'add': 0, 'del': 0}
for mid, rows in spec.items():
    want = {i for i, *_ in rows}
    for item, rate, lo, hi in rows:
        r = find(ws, h, c, 'monster_id', mid, 'item_id', item)
        if r:
            if (ws.cell(r, c['drop_rate']).value, ws.cell(r, c['min_qty']).value, ws.cell(r, c['max_qty']).value) != (rate, lo, hi):
                stats['upd'] += 1
            setrow(ws, r, c, drop_rate=rate, min_qty=lo, max_qty=hi)
        else:
            append(ws, c, {'monster_id': mid, 'item_id': item, 'drop_rate': rate, 'min_qty': lo, 'max_qty': hi, 'unlock_requirement_id': None})
            stats['add'] += 1
            print(f'  + {mid} {item} {rate}% {lo}-{hi}')
    for r in range(ws.max_row, h, -1):
        if ws.cell(r, c['monster_id']).value == mid:
            item = ws.cell(r, c['item_id']).value
            if item not in want:
                tag = 'junk' if item in REMOVED_JUNK else 'NOT IN SPEC'
                print(f'  - {mid} {item} ({tag})')
                if item in REMOVED_JUNK:
                    ws.delete_rows(r)
                    stats['del'] += 1
# junk must be gone everywhere, including the tables the spec does not list
for r in range(ws.max_row, h, -1):
    if ws.cell(r, c['item_id']).value in REMOVED_JUNK:
        print(f"  - {ws.cell(r, c['monster_id']).value} {ws.cell(r, c['item_id']).value} (junk, unlisted table)")
        ws.delete_rows(r)
        stats['del'] += 1
print('drops', stats)

# ---------- 6. skill quest / npc text that names the old kit ----------
ws, h, c = table('skill_quests')
for r in range(h + 1, ws.max_row + 1):
    for col in ('desc', 'objective', 'notes'):
        if col in c:
            v = ws.cell(r, c[col]).value
            if isinstance(v, str) and ('pebble 50' in v.lower() or 'Pebble 50' in v):
                print('  quest text mentions old kit:', ws.cell(r, c['id']).value, col)

ws, h, c = table('skill_quests')
ILA_NOTE = ('v0.2.6. Collect/turn-in. On turn-in Ila gives the rank-1 Nature Essence kit, which now equals the new rank-1 recipe exactly: '
            'Nature Essence 20, Pebble 16, Bark 12, Copper 18 (in code, not a sheet reward, so it lands mid-quest).')
for qid, col, val in [
    ('ql_quiet_work_2', 'notes', ILA_NOTE),
    ('ql_warm_coat_2', 'notes', 'v0.2.6. Collect from Wool Sheep (wool) and Field Mice (fur). Reward: 90 XP, 20 copper, Hide Vest ×1 (exact: Defense 3, never magic), Blueberry ×4. No skill. Gear is a quest gift, not a drop.'),
    ('ql_dirt_keeps_2', 'notes', 'v0.2.6. Collect from Dirt Banks regulars (Earth Sprite / Burrow Mole). Reward: 140 XP, 30 copper, Stone Club ×1 (exact: weapon damage 16, multiplier 1.15, STR 5, never magic), Nature Essence ×6. No skill. Quest gift, not a drop-table change.'),
    ('ql_hot_1', 'notes', 'B-004. v0.2.6: starts when Calden is talked to at level 6 (he shows a gold !), or on pickup/inspect of smoldering_scale at any level. The level 6 / 10 STR gate applies to turning the scale in, not to discovering the quest. Ember Beetle 20% and Spark Bug 12% drop the scale, and the first Ember Beetle killed at level 6+ always does (once per character).'),
]:
    r = find(ws, h, c, 'id', qid)
    setrow(ws, r, c, **{col: val})
ws.cell(1, 1).value = (str(ws.cell(1, 1).value or '') + '  v0.2.6: Ila kit = new Nature rank-1 recipe; quest gear gifts are exact; Hot Edge can start from Calden at level 6.').strip()

ws, h, c = table('passive_nodes')
for nid, ess in [('nature_prod', 'Nature'), ('elemental_prod', 'Elemental')]:
    r = find(ws, h, c, 'id', nid)
    setrow(ws, r, c,
           effect_per_rank=f'Produces {ess} Essence; whole essences per hour by rank: 1, 2, 3, 5, 8, 12, 18, 28, 42, 64 (rank 0 = none)',
           notes='v0.2.6: whole numbers only, starting at 1/h (was 1.5 x 1.6^(rank-1) /h). Rank 0 yields nothing.')
ws.cell(1, 1).value = (str(ws.cell(1, 1).value or '') + '  v0.2.6: production is a whole-number table: 1,2,3,5,8,12,18,28,42,64 per hour for ranks 1-10 (Nature and Elemental).').strip()

if DRY:
    print('dry run: not saving')
else:
    freeze_bools()
    wb.save(P)
    print('saved', P)
