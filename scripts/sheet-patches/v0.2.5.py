"""v0.2.5: drop rates, Earthbreaker recipe, Dig In rework, three new quests,
skill cooldowns / attack interval notes. Run:
  python3 scripts/sheet-patches/v0.2.5.py && npm run export-sheet
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
        if k not in cols:
            raise KeyError(f'{ws.title}.{k}')
        ws.cell(r, cols[k]).value = v

def freeze_bools():
    for n in wb.sheetnames:
        for row in wb[n].iter_rows():
            for c in row:
                if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                    c.value = str(c.value).upper() == '=TRUE()'

# ---------- drops ----------
# (monster, item) -> (rate, min, max). Exact v0.2.5 numbers.
DROPS = {
    ('field_mouse', 'strawberry'): (10, 1, 1),
    ('wool_sheep', 'blueberry'): (12, 1, 1),
    ('burrow_mole', 'blueberry'): (12, 1, 1),
    ('earth_sprite', 'stone_chunk'): (8, 1, 3),
    ('crow', 'monster_essence'): (40, 1, 3),
    ('burrow_mole', 'monster_essence'): (46, 1, 3),
    ('earth_sprite', 'monster_essence'): (46, 1, 3),
    ('ember_beetle', 'monster_essence'): (46, 1, 4),
    ('wool_sheep', 'nature_essence'): (24, 1, 2),
    ('crow', 'nature_essence'): (30, 1, 3),
    ('burrow_mole', 'nature_essence'): (30, 1, 3),
    ('crow', 'training_scroll'): (20, 1, 3),
    ('burrow_mole', 'training_scroll'): (16, 1, 3),
    ('burrow_mole', 'tough_root'): (8, 1, 2),
    ('earth_sprite', 'tough_root'): (6, 1, 2),
    ('crow', 'branch'): (4, 1, 1),
    ('meadow_boar', 'branch'): (8, 1, 2),
    ('old_stump', 'branch'): (10, 1, 2),
    # extra: Earth Shard on moles so Earthbreaker clay/shard recipe is farmable in the Banks
    ('burrow_mole', 'earth_shard'): (8, 1, 2),
}

dws, dh, dcols = table('drop_tables')
dnote = str(dws.cell(1, 1).value or '')
if 'v0.2.5' in dnote:
    sys.exit('already patched')
dws.cell(1, 1).value = (dnote + '  v0.2.5: berries, Stone Chunk on Earth Sprite, ME/NE/scrolls/roots/Branch rates; Earth Shard on Burrow Mole for the Earthbreaker recipe.').strip()

for (mid, iid), (rate, mn, mx) in DROPS.items():
    r = find(dws, dh, dcols, 'monster_id', mid, 'item_id', iid)
    if r:
        setrow(dws, r, dcols, drop_rate=rate, min_qty=mn, max_qty=mx)
        print(f'updated drop {mid} {iid} -> {rate}% {mn}-{mx}')
    else:
        append(dws, dh, dcols, {
            'monster_id': mid, 'item_id': iid, 'drop_rate': rate,
            'min_qty': mn, 'max_qty': mx, 'unlock_requirement_id': None,
        })
        print(f'added drop {mid} {iid} {rate}% {mn}-{mx}')

# ---------- Earthbreaker recipe: Branch -> Earth Shard, Bark -> Clay ----------
cws, ch, ccols = table('skill_costs')
# rank 1 bark 30 -> clay 30; branch 3 -> earth_shard 3
# If a clay/earth_shard row already exists at rank 1, just replace quantities carefully.
for old, new, qty in (('bark', 'clay', 30), ('branch', 'earth_shard', 3)):
    r = find(cws, ch, ccols, 'skill_id', 'earthbreaker', 'material_id', old)
    # also match rank 1 — there may be rank 5 etc. Scan all.
    changed = 0
    for rr in range(ch + 1, cws.max_row + 1):
        if (cws.cell(rr, ccols['skill_id']).value == 'earthbreaker'
            and cws.cell(rr, ccols['material_id']).value == old
            and int(cws.cell(rr, ccols['rank']).value or 0) == 1):
            # if new material already has a rank-1 row, add qty and delete old? check
            exist = None
            for r2 in range(ch + 1, cws.max_row + 1):
                if (cws.cell(r2, ccols['skill_id']).value == 'earthbreaker'
                    and cws.cell(r2, ccols['material_id']).value == new
                    and int(cws.cell(r2, ccols['rank']).value or 0) == 1):
                    exist = r2
                    break
            if exist:
                # keep existing clay/shard row, just remove bark/branch
                # If we want exact replace of qty, set to qty (the requested recipe)
                setrow(cws, exist, ccols, quantity=qty)
                # clear the old row (blank id so export skips? better change material to a marker)
                # Actually delete by shifting: set skill_id empty and skip? Export may include empty.
                # Change the old row into a duplicate and then we'll just convert in place if no exist.
                for c in range(1, cws.max_column + 1):
                    cws.cell(rr, c).value = None
                print(f'merged earthbreaker r1 {old} into existing {new} qty={qty}, cleared old row {rr}')
            else:
                setrow(cws, rr, ccols, material_id=new, quantity=qty)
                print(f'earthbreaker r1 {old} -> {new} x{qty}')
            changed += 1
    if not changed:
        print('WARN no rank-1 row for', old)

# ---------- Dig In skill ----------
sws, sh, scols = table('skills')
r = find(sws, sh, scols, 'id', 'dig_in')
setrow(sws, r, scols,
    type='buff',
    duration_s=60,
    per_rank_scaling='Duration and defense stay 60s / +50% at all ranks for now (to be tuned)',
    effect='+50% defense for 60 seconds',
    description='Set your feet. For a minute, blows land softer.',
    desc='Set your feet. For a minute, blows land softer.',
    notes='v0.2.5: reworked from a 0.5s timed block (+100% def, knockback-immune) that left a stuck visual. Now a simple 60s buff: +50% defense, no knockback immunity, no HP shield. Visual (earth aura) lasts only while the buff is active. Wall-clock expiry. Unlock unchanged.',
)
print('dig_in reworked')

# cooldown notes on attacking skills (authoritative numbers live in assumptions + this note;
# Skills.cooldownOf still reads ASSUME, which matches these).
COOLDOWN_NOTE = {
    'power_strike': 'v0.2.5 cooldown 0.8s (was 1.0s, −20%).',
    'earthbreaker': 'v0.2.5 cooldown 2.4s (was 3.0s, −20%). Recipe rank 1: Earth Shard replaces Branch, Clay replaces Bark.',
    'flame_cleave': 'v0.2.5 cooldown 2.0s (was 2.5s, −20%).',
    'root_lash': 'v0.2.5 cooldown 1.6s (was 2.0s, −20%).',
}
for sid, extra in COOLDOWN_NOTE.items():
    rr = find(sws, sh, scols, 'id', sid)
    if rr:
        prev = str(sws.cell(rr, scols['notes']).value or '')
        if 'v0.2.5 cooldown' not in prev:
            setrow(sws, rr, scols, notes=(prev + '  ' + extra).strip())

# ---------- combat_formulas: live values ----------
fws, fh, fcols = table('combat_formulas')
def set_formula(key, value, notes, num=None):
    r = find(fws, fh, fcols, 'key', key)
    kw = {'value': value, 'notes': notes}
    if 'num' in fcols and num is not None:
        kw['num'] = num
    if r:
        setrow(fws, r, fcols, **kw)
        print('updated formula', key)
    else:
        row = {'key': key, 'value': value, 'notes': notes}
        if 'num' in fcols:
            row['num'] = num
        append(fws, fh, fcols, row)
        print('added formula', key)

set_formula(
    'attack_interval',
    '0.83 / (1 + AGI × 0.005) seconds',
    'v0.2.5: base shortened 17% (was 1.0s) so basic swings and mob recoveries feel snappier. AGI still shortens it. Lives in Player.attackIntervalMs; this row is the sheet record.',
    0.83,
)
r = find(fws, fh, fcols, 'key', 'damage_formula')
if r:
    setrow(fws, r, fcols, notes='v0.1.3: every player hit (basic and skills) also rolls hit_variance 0.75–1.25. Crit (1.5×) is applied on top. attack already includes the weapon’s rolled instance damage and the v0.2.3 flat +1 attack per 2 main-stat. Auto/basic swing uses multiplier 1.0. v0.2.5: damage is applied on the slash’s impact frame, not at swing start.')
set_formula(
    'skill_cooldown_attacking',
    'power_strike 0.8s; earthbreaker 2.4s; flame_cleave 2.0s; root_lash 1.6s',
    'v0.2.5: attacking-skill cooldowns cut ~20%. Rage (60s), Dig In (4s), and parked Soul Guard (30s) are unchanged. Source in play: src/data/assumptions.ts ASSUME.cooldownMs.',
    None,
)
set_formula(
    'mob_attack_speed',
    'recoverMs [125, 375]; approachDelayMs [0, 415]; windup ~10% shorter than v0.2.4',
    'v0.2.5: mobs swing about 17% more often (recovery and hesitation shortened; telegraph stays readable). Source in play: src/data/assumptions.ts AI + MONSTER_FEEL.windupMs.',
    None,
)
set_formula(
    'mob_attack_range',
    'ember_beetle 22; meadow_boar 28; earth_sprite 24; spark_bug 18; bank_cracker 20; others 4 (contact)',
    'v0.2.5: selected melee reaches, in px edge-to-edge. Boar lunges; Ember Beetle and Earth Sprite reach farther; Spark Bug snaps; Bank-Cracker has heavier arms. Source: MONSTER_FEEL.range.',
    None,
)

# ---------- new quests ----------
qws, qh, qcols = table('skill_quests')

def add_q(**row):
    if find(qws, qh, qcols, 'id', row['id']):
        print('quest exists', row['id'])
        return
    append(qws, qh, qcols, row)
    print('added', row['id'])

# The Quiet Work — Ila, introduces the passive tree, guides first point.
# Fits Dirt Path: spending the first point (this quest's last step) is still Dirt Path's prereq.
add_q(
    id='ql_quiet_work_1', line_id='ql_quiet_work', step=1,
    name='The Quiet Work',
    desc='Ila has something slower than a swing to show you.',
    objective='Talk to Ila at her bench in Meadow Town.',
    notes='v0.2.5. Introduces the Nature / Elemental trees. Auto-starts when The Weight of a Swing is done. Giver Ila. Guides spending the first passive point, which is also The Dirt Path’s prereq — completing this (or spending the point) opens Pell’s hunt. Does not grant a skill. Starter-kit materials are given at step 2 (exact Nature Essence rank-1 cost) so the spend is possible at this level.',
    trigger='quest:ql_weight', gate_level=None, gate_stat=None, gate_value=None,
    reward_xp=None, reward_coins=None, reward_items=None, unlock_skill=None, giver='ila',
)
add_q(
    id='ql_quiet_work_2', line_id='ql_quiet_work', step=2,
    name='The Quiet Work',
    desc='A handful of pasture cuttings, and Ila will show you the rest.',
    objective='Bring Ila 8 Twig and 4 Bark.',
    notes='v0.2.5. Collect/turn-in. On turn-in Ila gives the rank-1 Nature Essence kit: pebble 50, bark 40, earth_shard 5, nature_essence 50, copper 30 (in code, not a sheet reward, so it lands mid-quest).',
    trigger=None, gate_level=None, gate_stat=None, gate_value=None,
    reward_xp=None, reward_coins=None, reward_items=None, unlock_skill=None, giver='ila',
)
add_q(
    id='ql_quiet_work_3', line_id='ql_quiet_work', step=3,
    name='The Quiet Work',
    desc='Open the tree, and set a first root going.',
    objective='Open the passive tree (T) and start a first rank, then return to Ila.',
    notes='v0.2.5. Completes when a first passive point is spent (same hook as Dirt Path) and the player talks to Ila. Rewards are a taste: 80 XP, 15 copper, Meadow Dew ×2. No skill grant. If a save already has a passive rank, talking to Ila at this step finishes it.',
    trigger=None, gate_level=None, gate_stat=None, gate_value=None,
    reward_xp=80, reward_coins=15, reward_items='meadow_dew x2', unlock_skill=None, giver='ila',
)

# A Warm Coat — Mara, pasture, wool/fur, Hide Vest.
add_q(
    id='ql_warm_coat_1', line_id='ql_warm_coat', step=1,
    name='A Warm Coat',
    desc='Mara has a coat in mind, if the pasture will spare the wool.',
    objective='Talk to Mara in Meadow Town.',
    notes='v0.2.5. Pasture resource-and-gear quest. Auto-starts after The Quiet Work is done (so it does not fight Ila or the shop at the same door). Giver Mara. E on Mara opens this dialogue before the shop while she wants to talk.',
    trigger='quest:ql_quiet_work', gate_level=None, gate_stat=None, gate_value=None,
    reward_xp=None, reward_coins=None, reward_items=None, unlock_skill=None, giver='mara',
)
add_q(
    id='ql_warm_coat_2', line_id='ql_warm_coat', step=2,
    name='A Warm Coat',
    desc='Sheep for the wool, mice for the fur. Mara will cut the rest.',
    objective='Bring Mara 8 Wool and 6 Fur, then talk to her.',
    notes='v0.2.5. Collect from Wool Sheep (wool) and Field Mice (fur). Reward: 90 XP, 20 copper, Hide Vest ×1 (fixed decent torso, mid roll in code), Blueberry ×4. No skill. Gear is a quest gift, not a drop — does not change the 1/150–200 drop band.',
    trigger=None, gate_level=None, gate_stat=None, gate_value=None,
    reward_xp=90, reward_coins=20, reward_items='hide_vest x1; blueberry x4', unlock_skill=None, giver='mara',
)

# What the Dirt Keeps — Pell, Banks, grit and stone, Stone Club.
add_q(
    id='ql_dirt_keeps_1', line_id='ql_dirt_keeps', step=1,
    name='What the Dirt Keeps',
    desc='Pell wants to know what the banks are holding, under the loose earth.',
    objective='Talk to Pell at the east gate in Meadow Town.',
    notes='v0.2.5. Dirt Banks resource-and-gear quest. Auto-starts after The Dirt Path is done. Giver Pell.',
    trigger='quest:ql_dirt_path', gate_level=None, gate_stat=None, gate_value=None,
    reward_xp=None, reward_coins=None, reward_items=None, unlock_skill=None, giver='pell',
)
add_q(
    id='ql_dirt_keeps_2', line_id='ql_dirt_keeps', step=2,
    name='What the Dirt Keeps',
    desc='Grit and a few honest chunks. The banks give them up if you ask with a blade.',
    objective='Bring Pell 8 Earth Grit and 4 Stone Chunk, then talk to him.',
    notes='v0.2.5. Collect from Dirt Banks regulars (Earth Sprite / Burrow Mole). Reward: 140 XP, 30 copper, Stone Club ×1 (fixed decent warrior weapon, mid roll in code), Nature Essence ×6. No skill. Stone Club requires STR 5 — a Banks piece, not a starter. Quest gift, not a drop-table change.',
    trigger=None, gate_level=None, gate_stat=None, gate_value=None,
    reward_xp=140, reward_coins=30, reward_items='stone_club x1; nature_essence x6', unlock_skill=None, giver='pell',
)

# NPC notes
nws, nh, ncols = table('npcs')
for nid, extra in {
    'ila': 'v0.2.5: gives The Quiet Work (passive-tree intro) after The Weight of a Swing. Multi-line dialogue. E opens dialogue when she wants to talk, otherwise the exchange bench.',
    'mara': 'v0.2.5: gives A Warm Coat after The Quiet Work. Multi-line dialogue. E opens dialogue when she wants to talk, otherwise the shop. Shop sell tab shows what Mara pays; inventory still hides sell price.',
    'pell': 'v0.2.5: gives What the Dirt Keeps after The Dirt Path. Multi-line dialogue at quest start and turn-in. Default greeting is a few short lore lines.',
    'calden': 'v0.2.5: multi-line dialogue on every skill-quest step (start, progress, turn-in). Gruff, patient, cares about a real blow.',
}.items():
    rr = find(nws, nh, ncols, 'id', nid)
    if rr:
        prev = str(nws.cell(rr, ncols['notes']).value or '')
        if 'v0.2.5' not in prev:
            setrow(nws, rr, ncols, notes=(prev + '  ' + extra).strip())

# items notes
iws, ih, icols = table('items')
for iid, extra in {
    'earth_shard': 'v0.2.5: also drops from Burrow Mole (8% ×1–2) so the Earthbreaker rank-1 recipe is farmable in the Dirt Banks. Already on Earth Sprite.',
    'clay': 'v0.2.5: used in the Earthbreaker rank-1 recipe (replaces Bark). Already a common Burrow Mole drop (36%).',
    'stone_chunk': 'v0.2.5: Earth Sprite 8% ×1–3 (new). Already a rare Burrow Mole drop.',
    'branch': 'v0.2.5: Crow 4% ×1 (new); Meadow Boar 8% ×1–2; Old Stump 10% ×1–2. No longer an Earthbreaker rank-1 cost (replaced by Earth Shard).',
}.items():
    rr = find(iws, ih, icols, 'id', iid)
    if rr:
        prev = str(iws.cell(rr, icols['notes']).value or '')
        if 'v0.2.5' not in prev:
            setrow(iws, rr, icols, notes=(prev + '  ' + extra).strip())

# items tab banner
inote = str(iws.cell(1, 1).value or '')
if 'v0.2.5' not in inote:
    iws.cell(1, 1).value = inote + '  v0.2.5: no new item ids (Stone Chunk, Branch, Earth Shard, Clay already existed). Drop and recipe changes only.'

freeze_bools()
wb.save(P)
print('saved', P)
