"""v0.2.1: Warrior skill questlines (B-004), Root Lash + Dig In (B-001), mixed recipes.
Run: python3 scripts/sheet-patches/v0.2.1-quests.py && npm run export-sheet
Prerequisite: v0.2.0-dirt-banks already applied. Soul Guard / Shrine are not in this patch.
"""
import openpyxl, sys
from copy import copy
from openpyxl.utils import get_column_letter

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
        if k not in cols: raise KeyError(f'{ws.title}.{k}')
        ws.cell(r, cols[k]).value = v

def freeze_bools():
    for n in wb.sheetnames:
        for row in wb[n].iter_rows():
            for c in row:
                if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                    c.value = str(c.value).upper() == '=TRUE()'

def find(ws, h, cols, key, val, key2=None, val2=None):
    for r in range(h + 1, ws.max_row + 1):
        if ws.cell(r, cols[key]).value == val and (key2 is None or ws.cell(r, cols[key2]).value == val2):
            return r
    return None

sws, sh, scols = table('skills')
note = str(sws.cell(1, 1).value or '')
if 'v0.2.1' in note:
    sys.exit('already patched')

# ── skills: Root Lash, Dig In; notes on existing warrior skills ──
append(sws, sh, scols, dict(
    id='root_lash', class_id='warrior', name='Root Lash', branch='nature', type='active',
    unlock_stage='early', max_rank=10, per_rank_scaling='+12% / rank from rank 2',
    scaling_stat='STR', damage_multiplier=1.45, duration_s=None, mp_cost=10,
    effect='145% line strike + knockback (non-bosses)',
    description='Roots lash forward and knock smaller foes back.',
    desc='Roots lash forward and knock smaller foes back.',
    notes='v0.2.1 / B-001. Warrior Nature line, between Earthbreaker (AoE slam) and Flame Cleave. Unlock lv 4 + STR 6 (unlock_requirements), then train at Calden. No questline. +12%/rank from rank 2. Knocks small non-bosses back.',
))
append(sws, sh, scols, dict(
    id='dig_in', class_id='warrior', name='Dig In', branch='nature', type='active',
    unlock_stage='early', max_rank=10, per_rank_scaling='+0.05s window / rank from rank 2',
    scaling_stat='STR', damage_multiplier=None, duration_s=0.5, mp_cost=2,
    effect='0.5s timed block: +100% defense and knockback-immune if a hit lands in the window',
    description='Plant your feet just before a hit to shrug it off.',
    desc='Plant your feet just before a hit to shrug it off.',
    notes='v0.2.1 / B-001. Timed block, 0.5s window at rank 1 (+0.05s/rank from rank 2, to be tuned). +100% defense and knockback-immune during the window. Unlock lv 5 + STR 7. Train at Calden. MP 2.',
))
# Retune existing notes: basics are quest-unlocked, no longer "from level 1".
for sid, notes in {
    'power_strike': 'v0.2.1 / B-004: unlocked at rank 1 by completing The Weight of a Swing (starts at level 2). Further ranks at Calden. Until the quest is done the skill is not known. Design: basic starter attack, rebalanced down from 180% so later skills outpace it (+5%/rank).',
    'rage': 'v0.2.1 / B-004: unlocked at rank 1 by completing Blood Up (starts at level 3). Further ranks at Calden. Until the quest is done the skill is not known. Design: basic starter buff, intentionally modest so category skills feel like an upgrade.',
    'earthbreaker': 'v0.2.1 / B-004: unlocked at rank 1 by completing A Crack in the Dirt, which starts when you pick up a Cracked Bank Stone. Calden finishes the line only at level 3 + STR 5. Further ranks at Calden (v0.2.1 mixes Dry Root from rank 2). Nature AoE slam, slightly above Power Strike.',
    'flame_cleave': 'v0.2.1 / B-004: unlocked at rank 1 by completing Hot Edge, which starts when you pick up a Smoldering Scale. Calden finishes the line only at level 6 + STR 10. Further ranks at Calden (v0.2.1 mixes Tough Root from rank 3). Wide flaming swing, stronger than Earthbreaker. Soul Guard remains on its sheet gate; its questline is parked.',
}.items():
    r = find(sws, sh, scols, 'id', sid)
    sws.cell(r, scols['notes']).value = notes

sws.cell(1, 1).value = note + (
    ' v0.2.1: Warrior basic and mid skills are unlocked by discoverable questlines (B-004) at rank 1; further ranks still train at Calden. '
    'Root Lash and Dig In (B-001) unlock on level + STR and are learned at Calden. Soul Guard / Shrine questline is parked; Soul Guard keeps its late sheet gate.')

# ── skill_costs: Root Lash, Dig In, mixed extras, rank-specific overrides ──
cws, ch, ccols = table('skill_costs')

def add_cost(sid, rank, mid, qty):
    if find(cws, ch, ccols, 'skill_id', sid, 'material_id', None):
        # allow same skill+material at different ranks; check both
        pass
    # always append (rank-specific rows are distinct)
    append(cws, ch, ccols, dict(skill_id=sid, rank=rank, material_id=mid, quantity=qty))

# prevent exact duplicates
def has_cost(sid, rank, mid):
    for r in range(ch + 1, cws.max_row + 1):
        if (cws.cell(r, ccols['skill_id']).value == sid
            and cws.cell(r, ccols['rank']).value == rank
            and cws.cell(r, ccols['material_id']).value == mid):
            return True
    return False

def add(sid, rank, mid, qty):
    if has_cost(sid, rank, mid):
        raise SystemExit(f'cost exists {sid} r{rank} {mid}')
    append(cws, ch, ccols, dict(skill_id=sid, rank=rank, material_id=mid, quantity=qty))

# Root Lash r1 (then ×1.6). Costs sit between Thorn Bind (35 NE / 22c) and Earthbreaker (40 / 25c).
for mid, qty in [('dry_root', 30), ('tough_root', 2), ('earth_grit', 10), ('nature_essence', 36), ('copper_coin', 23)]:
    add('root_lash', 1, mid, qty)
add('root_lash', 2, 'bark', 12)          # pasture mat mixed in from rank 2
add('root_lash', 5, 'heartwood', 1)
add('root_lash', 10, 'heartwood', 2)

# Dig In r1
for mid, qty in [('dry_root', 28), ('tough_root', 3), ('pebble', 16), ('nature_essence', 38), ('copper_coin', 24)]:
    add('dig_in', 1, mid, qty)
add('dig_in', 2, 'twig', 16)
add('dig_in', 5, 'stone_chunk', 4)
add('dig_in', 10, 'heartwood', 1)

# Mixed recipes: Earthbreaker r2 adds Dry Root and cuts Twig (override scaled 56 → 40)
add('earthbreaker', 2, 'dry_root', 20)
add('earthbreaker', 2, 'twig', 40)
# Flame Cleave r3 adds Tough Root beside the (scaled) fire shards
add('flame_cleave', 3, 'tough_root', 2)

cnote = str(cws.cell(1, 1).value or '')
cws.cell(1, 1).value = cnote + (
    ' v0.2.1: Root Lash and Dig In rank-1 recipes (Dry Root, Tough Root, Nature Essence). '
    'A row at rank r > 1 is either a milestone rare or a mixed-in material; if it names a rank-1 material it overrides the scaled qty (Earthbreaker r2 Twig 40 instead of 56). '
    'Earthbreaker r2 adds Dry Root 20; Flame Cleave r3 adds Tough Root 2. Rank 1 of early skills stays on pasture mats.')

# ── unlock_requirements for Root Lash / Dig In ──
uws, uh, ucols = table('unlock_requirements')
for row in [
    dict(id='unlock_root_lash_level', target_type='skill', target_id='root_lash', requirement_type='level', requirement_id=None, requirement_value=4),
    dict(id='unlock_root_lash_str', target_type='skill', target_id='root_lash', requirement_type='stat', requirement_id='STR', requirement_value=6),
    dict(id='unlock_dig_in_level', target_type='skill', target_id='dig_in', requirement_type='level', requirement_id=None, requirement_value=5),
    dict(id='unlock_dig_in_str', target_type='skill', target_id='dig_in', requirement_type='stat', requirement_id='STR', requirement_value=7),
]:
    append(uws, uh, ucols, row)

# ── items: Live Ember ──
iws, ih, icols = table('items')
append(iws, ih, icols, dict(
    id='live_ember', name='Live Ember', item_type='misc', subtype_id=None, native_zone='meadows',
    passively_gatherable=False, sellable_only=False, sell_price=0,
    description='A scale still hot from Cinderback\'s shell.',
    desc='A scale still hot from Cinderback\'s shell.',
    notes='v0.2.1 / B-004. Guaranteed drop from Cinderback. Turn in to Calden to finish Hot Edge. Not sellable.',
))

# ── named monster variants ──
mws, mh, mcols = table('monsters')
# Wool Sheep: hp 75 atk 14 def 3 xp 12 lv 2 — Shoulder is stubborn: more HP and attack
append(mws, mh, mcols, dict(
    id='wool_shoulder', name='Wool-Shoulder', zone_id='meadows', category_id='nature', level=3, is_boss=False,
    description='A stubborn sheep that plants its feet and hits back.',
    hp=120, attack=20, defense=5, xp=24, respawn_s=0, aggression='aggressive', attack_type='melee',
    attack_min=15, attack_max=25, anim_speed=0.5,
))
# Burrow Mole: 120/22/6/23 lv4 — Bank-Cracker
append(mws, mh, mcols, dict(
    id='bank_cracker', name='Bank-Cracker', zone_id='meadows', category_id='nature', level=5, is_boss=False,
    description='A heavy mole that splits the dirt banks.',
    hp=185, attack=30, defense=9, xp=38, respawn_s=0, aggression='aggressive', attack_type='melee',
    attack_min=22, attack_max=38, anim_speed=0.5,
))
# Ember Beetle: 115/24/5/24 lv4 — Cinderback
append(mws, mh, mcols, dict(
    id='cinderback', name='Cinderback', zone_id='meadows', category_id='elemental', level=5, is_boss=False,
    description='An ember beetle whose shell still glows.',
    hp=175, attack=32, defense=8, xp=40, respawn_s=0, aggression='aggressive', attack_type='melee',
    attack_min=24, attack_max=40, anim_speed=0.5,
))
mnote = str(mws.cell(1, 1).value or '')
mws.cell(1, 1).value = mnote + ' v0.2.1: named quest variants Wool-Shoulder, Bank-Cracker, and Cinderback (respawn_s 0: they do not come back after a kill). anim_speed 0.5, attack_min/max dice. Spawn only while the matching quest step is active.'

# ── skill_quests tab ──
if 'skill_quests' in wb.sheetnames:
    del wb['skill_quests']
qs = wb.create_sheet('skill_quests')
qs.cell(1, 1).value = (
    'DRAFT — v0.2.1 / B-004 Warrior skill questlines. Discoverable: Power Strike and Rage start on a level-up; '
    'Earthbreaker and Flame Cleave start when the rare drop is picked up or inspected. Completing a line unlocks that skill at rank 1; '
    'further ranks train at Calden. Soul Guard is parked (see Pitch Book). `desc` is player-facing; `notes` is design-only. '
    'Rewards are on the last step. `trigger` is level:N or item:<id>. Gates are checked when Calden would finish the line.')
cols = ['id', 'line_id', 'step', 'name', 'desc', 'objective', 'notes', 'trigger',
        'gate_level', 'gate_stat', 'gate_value', 'reward_xp', 'reward_coins', 'reward_items', 'unlock_skill', 'giver']
for i, c in enumerate(cols, 1):
    qs.cell(2, i).value = c
QCOLS = {c: i for i, c in enumerate(cols, 1)}

def qadd(row):
    r = qs.max_row + 1
    for k, v in row.items():
        qs.cell(r, QCOLS[k]).value = v

# The Weight of a Swing
qadd(dict(id='ql_weight_1', line_id='ql_weight', step=1, name='The Weight of a Swing',
          desc='Calden wants to see a real blow, not just a practice swing.',
          objective='Go to the practice post by the east gate in Meadow Town.',
          notes='B-004. Starts at level 2. Short on purpose so the first skill is not gated for long.',
          trigger='level:2', gate_level=2, gate_stat=None, gate_value=None,
          reward_xp=None, reward_coins=None, reward_items=None, unlock_skill=None, giver='calden'))
qadd(dict(id='ql_weight_2', line_id='ql_weight', step=2, name='The Weight of a Swing',
          desc='A handful of twigs will do for a first lesson.',
          objective='Collect 4 Twig and bring them to Calden.',
          notes='Turn in consumes the twigs.',
          trigger=None, gate_level=2, giver='calden'))
qadd(dict(id='ql_weight_3', line_id='ql_weight', step=3, name='The Weight of a Swing',
          desc='Land three honest swings on the post, then Calden will teach the first real blow.',
          objective='Land 3 basic attacks (F) on the practice post.',
          notes='Only the basic F swing counts, not skills. Reward grants Power Strike at rank 1.',
          trigger=None, gate_level=2, reward_xp=40, reward_coins=10,
          reward_items='monster_essence x8', unlock_skill='power_strike', giver='calden'))

# Blood Up
qadd(dict(id='ql_blood_1', line_id='ql_blood', step=1, name='Blood Up',
          desc='Rage hits harder — and so do the things that hit you back. Talk to Calden.',
          objective='Talk to Calden about the bargain of Rage.',
          notes='B-004. Starts at level 3. Calden explains the deal.',
          trigger='level:3', gate_level=3, giver='calden'))
qadd(dict(id='ql_blood_2', line_id='ql_blood', step=2, name='Blood Up',
          desc='Walk out to where the pasture meets the dirt path.',
          objective='Reach the east end of Sunny Pasture, near the dirt path.',
          notes='Place check, around the Crow stretch / east portal.',
          trigger=None, gate_level=3, giver='calden'))
qadd(dict(id='ql_blood_3', line_id='ql_blood', step=3, name='Blood Up',
          desc='Wool-Shoulder will not back down. Stay in the fight, then return to Calden.',
          objective='Defeat Wool-Shoulder in the east pasture and return to Calden.',
          notes='Named Wool Sheep variant. The point is to stay in a fight that hits back, not to kite it from town.',
          trigger=None, gate_level=3, reward_xp=60, reward_coins=15,
          reward_items='monster_essence x10', unlock_skill='rage', giver='calden'))

# A Crack in the Dirt
qadd(dict(id='ql_crack_1', line_id='ql_crack', step=1, name='A Crack in the Dirt',
          desc='The cracked stone wants to be more than a rock. Calden will know.',
          objective='Bring the Cracked Bank Stone to Calden (level 3 and 5 STR).',
          notes='B-004. Starts on pickup/inspect of cracked_bank_stone. You can find it early; Calden waits for the gate.',
          trigger='item:cracked_bank_stone', gate_level=3, gate_stat='STR', gate_value=5, giver='calden'))
qadd(dict(id='ql_crack_2', line_id='ql_crack', step=2, name='A Crack in the Dirt',
          desc='The lesson is in the banks themselves.',
          objective='Reach the Dirt Banks.',
          notes='Place: dirt_banks area.',
          trigger=None, gate_level=3, gate_stat='STR', gate_value=5, giver='calden'))
qadd(dict(id='ql_crack_3', line_id='ql_crack', step=3, name='A Crack in the Dirt',
          desc='Pebbles and grit from the cuts. Bring them back.',
          objective='Collect 8 Pebble and 6 Earth Grit, then bring them to Calden.',
          notes='Moles and sprites. Turn in consumes the mats. Unlock quest itself uses materials already in the sheet.',
          trigger=None, gate_level=3, gate_stat='STR', gate_value=5, giver='calden'))
qadd(dict(id='ql_crack_4', line_id='ql_crack', step=4, name='A Crack in the Dirt',
          desc='Bank-Cracker waits in a hollow of the banks.',
          objective='Defeat Bank-Cracker in the Dirt Banks and return to Calden.',
          notes='Named Burrow Mole. Reward: Earthbreaker rank 1. Nature Essence ×12 does not skip rank 2 (r2 still costs on the ×1.6 curve from 40).',
          trigger=None, gate_level=3, gate_stat='STR', gate_value=5,
          reward_xp=100, reward_coins=20, reward_items='nature_essence x12', unlock_skill='earthbreaker', giver='calden'))

# Hot Edge (3 steps as in the pitch: bring scale, collect warm grain, defeat Cinderback)
qadd(dict(id='ql_hot_1', line_id='ql_hot', step=1, name='Hot Edge',
          desc='The scale is still warm. Calden will only take it when you are ready.',
          objective='Bring the Smoldering Scale to Calden (level 6 and 10 STR).',
          notes='B-004. Starts on pickup/inspect of smoldering_scale. Quest steps stay in the Dirt Banks (Spark Bug is a shared drop source, not a shrine visit).',
          trigger='item:smoldering_scale', gate_level=6, gate_stat='STR', gate_value=10, giver='calden'))
qadd(dict(id='ql_hot_2', line_id='ql_hot', step=2, name='Hot Edge',
          desc='Warm Grain from the beetles. Enough to kindle a lesson.',
          objective='Collect 6 Warm Grain from Ember Beetles and bring them to Calden.',
          notes='Turn in consumes the grain.',
          trigger=None, gate_level=6, gate_stat='STR', gate_value=10, giver='calden'))
qadd(dict(id='ql_hot_3', line_id='ql_hot', step=3, name='Hot Edge',
          desc='Cinderback leaves a Live Ember. Bring it to Calden.',
          objective='Defeat Cinderback in the Dirt Banks and bring its Live Ember to Calden.',
          notes='Named Ember Beetle, guaranteed Live Ember. Reward: Flame Cleave rank 1. Elemental Essence ×12 is a taste, not a skipped rank.',
          trigger=None, gate_level=6, gate_stat='STR', gate_value=10,
          reward_xp=140, reward_coins=25, reward_items='elemental_essence x12', unlock_skill='flame_cleave', giver='calden'))

# ── controls: J for journal ──
kws, kh, kcols = table('controls')
r = find(kws, kh, kcols, 'action', 'quest_log')
if r:
    kws.cell(r, kcols['keys']).value = 'J'
    kws.cell(r, kcols['notes']).value = 'v0.2.1: Toggle the quest journal. Keyboard-first, same as K and I. The sheet used L; J is free and reads as Journal.'
knote = str(kws.cell(1, 1).value or '')
if 'v0.2.1' not in knote:
    kws.cell(1, 1).value = knote + ' v0.2.1: quest journal is on J.'

# ── cracked/smoldering notes already mention later milestone — update ──
for iid, notes in {
    'cracked_bank_stone': 'v0.2.1 / B-004. Rare quest start for A Crack in the Dirt (Earthbreaker). Starts the line when picked up or inspected. Not sellable. Burrow Mole 1.2%, Earth Sprite 0.8%.',
    'smoldering_scale': 'v0.2.1 / B-004. Rare quest start for Hot Edge (Flame Cleave). Starts the line when picked up or inspected. Not sellable. Ember Beetle 1.2%, Spark Bug 0.8%.',
}.items():
    r = find(iws, ih, icols, 'id', iid)
    if r: iws.cell(r, icols['notes']).value = notes

freeze_bools()
wb.save(P)
print('patched', P)
