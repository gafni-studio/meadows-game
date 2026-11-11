"""v0.1.3 balance: rare gear, essence audit, monster attack ranges, XP, STR, on-theme recipes.
Run: python3 scripts/sheet-patches/v0.1.3.py && npm run export-sheet
"""
import openpyxl, sys, json
from pathlib import Path
from collections import defaultdict
from copy import copy

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

def freeze_bools():
    for n in wb.sheetnames:
        for row in wb[n].iter_rows():
            for c in row:
                if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                    c.value = str(c.value).upper() == '=TRUE()'

def append_note(ws, text):
    note = str(ws.cell(1, 1).value or '')
    if 'v0.1.3' not in note:
        ws.cell(1, 1).value = (note + ' ' + text).strip()

# Guard
ws, h, cols = table('drop_tables')
if 'v0.1.3' in str(ws.cell(1, 1).value or ''):
    sys.exit('already patched')

# ─────────────────────────────────────────────
# Capture BEFORE for the report
# ─────────────────────────────────────────────
before = {}
dws, dh, dcols = table('drop_tables')
for r in range(dh + 1, dws.max_row + 1):
    mid = dws.cell(r, dcols['monster_id']).value
    iid = dws.cell(r, dcols['item_id']).value
    if not mid: continue
    before[(mid, iid)] = dict(
        rate=dws.cell(r, dcols['drop_rate']).value,
        lo=dws.cell(r, dcols['min_qty']).value,
        hi=dws.cell(r, dcols['max_qty']).value,
        row=r,
    )

# ─────────────────────────────────────────────
# 1. Gear rates (pasture very rare) + essence + audit
# ─────────────────────────────────────────────
# Pasture gear: individual 0.20–0.40%, pools ≈ 1.05 / 1.50 / 1.86%
# Weighted by 8+5+3 spawns → 1.34% ≈ 1 piece per 75 kills.
GEAR_RATES = {
    ('field_mouse', 'hide_gloves'): 0.35,
    ('field_mouse', 'linen_gloves'): 0.35,
    ('field_mouse', 'trail_gloves'): 0.35,   # pool 1.05%
    ('wool_sheep', 'hide_vest'): 0.30,
    ('wool_sheep', 'linen_vest'): 0.30,
    ('wool_sheep', 'trail_vest'): 0.30,
    ('wool_sheep', 'hide_pants'): 0.20,
    ('wool_sheep', 'linen_pants'): 0.20,
    ('wool_sheep', 'trail_pants'): 0.20,     # pool 1.50%
    ('crow', 'hide_cap'): 0.25,
    ('crow', 'linen_cap'): 0.22,
    ('crow', 'trail_cap'): 0.22,
    ('crow', 'hide_boots'): 0.22,
    ('crow', 'linen_boots'): 0.20,
    ('crow', 'trail_boots'): 0.20,
    ('crow', 'meadow_blade'): 0.20,
    ('crow', 'grove_staff'): 0.18,
    ('crow', 'bone_knife'): 0.18,            # pool 1.87%
}

# Essence policy (see docs / report):
#   Monster Essence is the basic-skill fuel and should be MORE common than
#   category essence (Oded). Original sheet said ME ~15% and Nature 20-30%
#   *before* the v0.1.2 ×2 (which made Nature 44-56% vs ME 30%). We set:
#     ME 34–38% qty 1–2 on every mob (bosses 40%, 1–3)
#     Category essence 16–20% qty 1–2 on themed mobs only (bosses 36%, 1–3)
#   Copper stays frequent; commons frequent; uncommons low; rares very low.
ESSENCE = {
    # (monster, item): (rate, min_qty, max_qty)
    # Monster Essence
    'monster_essence': {
        'field_mouse': (36, 1, 2), 'wool_sheep': (36, 1, 2), 'crow': (36, 1, 2),
        'burrow_mole': (36, 1, 2), 'meadow_boar': (38, 1, 2),
        'earth_sprite': (36, 1, 2), 'ember_beetle': (36, 1, 2),
        'frost_moth': (36, 1, 2), 'spark_bug': (36, 1, 2),
        'shrine_wisp': (36, 1, 2), 'dusk_wisp': (36, 1, 2),
        'old_stump': (40, 1, 3), 'night_stump': (40, 1, 3),
    },
    'nature_essence': {
        'field_mouse': (18, 1, 2), 'wool_sheep': (18, 1, 2), 'crow': (18, 1, 2),
        'burrow_mole': (18, 1, 2), 'meadow_boar': (20, 1, 2),
        'old_stump': (36, 1, 3),
    },
    'elemental_essence': {
        'earth_sprite': (18, 1, 2), 'ember_beetle': (18, 1, 2),
        'frost_moth': (18, 1, 2), 'spark_bug': (18, 1, 2),
    },
    'spirit_essence': {
        'shrine_wisp': (18, 1, 2), 'dusk_wisp': (18, 1, 2),
        'night_stump': (36, 1, 3),
    },
}

# Apply gear + essence
for r in range(dh + 1, dws.max_row + 1):
    mid = dws.cell(r, dcols['monster_id']).value
    iid = dws.cell(r, dcols['item_id']).value
    if not mid: continue
    if (mid, iid) in GEAR_RATES:
        dws.cell(r, dcols['drop_rate']).value = GEAR_RATES[(mid, iid)]
    if iid in ESSENCE and mid in ESSENCE[iid]:
        rate, lo, hi = ESSENCE[iid][mid]
        dws.cell(r, dcols['drop_rate']).value = rate
        dws.cell(r, dcols['min_qty']).value = lo
        dws.cell(r, dcols['max_qty']).value = hi

append_note(dws, (
    'v0.1.3: pasture gear is very rare (0.18–0.35% per entry; pool sums ≈1.05/1.50/1.87% for mouse/sheep/crow, '
    '≈1.34% overall ≈ 1 piece per 75 kills, in the 60–100 target). Magic stays 1/12 of gear drops. '
    'Monster Essence 36% (1–2) on every mob, above category essence (16–20%, 1–2) so basic-skill fuel is more common '
    'and category essence feels earned. Nature/Elemental/Spirit qty capped at 1–2 (bosses 1–3 at 36–40%). '
    'Copper, common mats, scrolls, uncommons and rares were already in band and are left (see the v0.1.3 audit).'))

# ─────────────────────────────────────────────
# 2. Monsters: attack_min/max, XP ×0.72
# ─────────────────────────────────────────────
mws, mh, mcols = table('monsters')
add_col(mws, mh, mcols, 'attack_min')
add_col(mws, mh, mcols, 'attack_max')
XP = {}  # for report
for r in range(mh + 1, mws.max_row + 1):
    mid = mws.cell(r, mcols['id']).value
    if not mid: continue
    atk = mws.cell(r, mcols['attack']).value or 0
    # 0.75x–1.25x of typical, integers; typical column stays the mid
    lo = max(1, round(atk * 0.75))
    hi = max(lo + 1, round(atk * 1.25))
    mws.cell(r, mcols['attack_min']).value = lo
    mws.cell(r, mcols['attack_max']).value = hi
    old_xp = mws.cell(r, mcols['xp']).value or 0
    new_xp = max(1, round(old_xp * 0.72))
    XP[mid] = (old_xp, new_xp)
    mws.cell(r, mcols['xp']).value = new_xp

append_note(mws, (
    'v0.1.3: attack_min/max are the per-hit roll (≈0.75–1.25× the typical attack column); no second variance dice on mobs. '
    'XP ×0.72 (−28%) across the roster.'))

# ─────────────────────────────────────────────
# 3. combat_formulas: STR 1%, hp_per_str 2, variance, examples
# ─────────────────────────────────────────────
fws, fh, fcols = table('combat_formulas')

def set_kv(key, value, notes=None, add=False):
    for r in range(fh + 1, fws.max_row + 1):
        if fws.cell(r, fcols['key']).value == key:
            fws.cell(r, fcols['value']).value = value
            if notes is not None:
                fws.cell(r, fcols['notes']).value = notes
            return
    if add:
        rr = fws.max_row + 1
        fws.cell(rr, fcols['key']).value = key
        fws.cell(rr, fcols['value']).value = value
        if notes and 'notes' in fcols:
            fws.cell(rr, fcols['notes']).value = notes

set_kv('hp_per_str', 2, 'v0.1.3: was 3 (v0.1.2), originally 4. Smaller so HP from STR is a subtle bonus; levels and gear matter more.')
set_kv('hp_per_level_warrior', 10, 'Added at each level after 1, before STR. HP = base + per_level × (level−1) + STR × hp_per_str (2).')
set_kv('attack_formula',
       'weapon_damage × weapon_stat_multiplier × (1 + main_stat × 0.01)',
       'v0.1.3: was (weapon_damage + main_stat × 2) × multiplier, which made each STR point a huge flat bump (~+2.2 attack on a wooden sword). '
       'Now each main-stat point is +1% of weapon attack. Weapon damage and skill ranks are the main damage sources. '
       'main_stat is STR (Warrior), INT (Mage), or AGI (Rogue). Unarmed: weapon_damage 6, multiplier 1.0.')
set_kv('attack_per_main_stat_pct', 1,
       'v0.1.3: percent damage per main-stat point (STR/INT/AGI). attack *= (1 + main_stat × this / 100).',
       add=True)
set_kv('damage_formula',
       'max(min_damage, floor(skill_multiplier × attack × hit_variance − target_defense)), then crit',
       'v0.1.3: every player hit (basic and skills) also rolls hit_variance 0.75–1.25. Crit (1.5×) is applied on top. '
       'attack already includes the weapon’s rolled instance damage and the +1%/stat. Auto/basic swing uses multiplier 1.0.')
set_kv('hit_variance', '0.75–1.25',
       'v0.1.3: uniform per-hit dice on every player hit (basic and skills). The equipped weapon’s rolled instance damage is the centre; this is extra swing. Documented in assumptions.DAMAGE.',
       add=True)
set_kv('incoming_damage',
       'max(min_damage, floor(rolled_monster_attack − player_defense))',
       'v0.1.3: rolled_monster_attack is uniform in [attack_min, attack_max] (≈0.75–1.25× typical). That IS the monster dice; no second 0.75–1.25. Then Rage’s +taken%. Same min_damage rule.')
set_kv('example_player_attack', 11,
       'v0.1.3, level 1, 0 points, Wooden Sword mid 10 × 1.1 × (1 + 0×0.01) = 11. At 6 STR: 11 × 1.06 ≈ 11.7 (was 24 under the old +2 flat). Mid Meadow Blade 14 × 1.15 = 16.1 at 0 STR (+46% vs basic).')
set_kv('example_power_strike', '14 typical (10–18 with variance)',
       'v0.1.3: floor(1.4 × 11 × variance − 2) vs a Field Mouse (def 2): at variance 1.0 → 13; at 0.75 → 9; at 1.25 → 17; a crit on a typical hit ≈ 19. Rank is the big lever (r5 basic ≈ 165% → typical 16).')
set_kv('example_xp', '7 XP from a Field Mouse toward 70 for level 2',
       'v0.1.3: monster XP ×0.72 (mouse 10→7). About 10 Field Mice to reach level 2 (was 7). The xp_to_next curve is unchanged.')

append_note(fws, 'v0.1.3: attack is +1% per main-stat point (not +2 flat); hp_per_str 2; per-hit variance 0.75–1.25; monster attack_min/max.')

# ─────────────────────────────────────────────
# 4. On-theme skill recipes
# ─────────────────────────────────────────────
# Replace off-theme materials (holy_dust on Nature, soul_dust / holy_essence on Elemental).
# Rank-1 rows are the template (higher ranks scale in code). Rares at 5 and 10 stay milestones.
cws, ch, ccols = table('skill_costs')

# (skill_id, rank, old_material) -> (new_material, new_qty)  or just change
# We'll do: for specific (skill, rank, material) set new material/qty; delete if new is None
REPLACEMENTS = {
    # Nature: holy_dust (spirit) → nature-themed; r10 earth_crystal (elemental) → nature rare
    ('earthbreaker', 1, 'holy_dust'): ('pebble', 15),          # shared nature stone
    ('earthbreaker', 10, 'earth_crystal'): ('heartwood', 2),
    ('thorn_bind', 1, 'holy_dust'): ('wool', 10),
    ('thorn_bind', 10, 'earth_crystal'): ('heartwood', 1),
    ('venom_strike', 1, 'holy_dust'): ('fur', 12),
    ('venom_strike', 10, 'earth_crystal'): ('heartwood', 2),
    # Elemental: soul_dust (spirit) → earth_shard; r10 holy_essence (spirit) → elemental rare
    ('flame_cleave', 1, 'soul_dust'): ('earth_shard', 8),
    ('flame_cleave', 10, 'holy_essence'): ('fire_crystal', 1),
    ('firebolt', 1, 'soul_dust'): ('earth_shard', 8),
    ('firebolt', 10, 'holy_essence'): ('fire_crystal', 1),
    ('lightning_dash', 1, 'soul_dust'): ('earth_shard', 6),
    ('lightning_dash', 10, 'holy_essence'): ('earth_crystal', 2),
}

recipe_before = []
recipe_after = []
# snapshot all rows first
rows = []
for r in range(ch + 1, cws.max_row + 1):
    sid = cws.cell(r, ccols['skill_id']).value
    if not sid: continue
    rows.append(dict(row=r, skill=sid, rank=cws.cell(r, ccols['rank']).value,
                     mat=cws.cell(r, ccols['material_id']).value,
                     qty=cws.cell(r, ccols['quantity']).value))

for rec in rows:
    key = (rec['skill'], rec['rank'], rec['mat'])
    if key in REPLACEMENTS:
        new_mat, new_qty = REPLACEMENTS[key]
        recipe_before.append(f"{rec['skill']} r{rec['rank']}: {rec['mat']} ×{rec['qty']}")
        recipe_after.append(f"{rec['skill']} r{rec['rank']}: {new_mat} ×{new_qty}")
        cws.cell(rec['row'], ccols['material_id']).value = new_mat
        cws.cell(rec['row'], ccols['quantity']).value = new_qty

append_note(cws, (
    'v0.1.3: Nature recipes no longer ask for Holy Dust (spirit) or Earth Crystal (elemental) — they use Pebble/Wool/Fur and Heartwood. '
    'Elemental recipes no longer ask for Soul Dust or Holy Essence — they use Earth Shard and Fire Crystal / Earth Crystal. '
    'Spiritual recipes are unchanged (Holy Dust, Soul Dust, Holy Essence, Soul Shard). Shared materials (copper, bark, grit, stones) still mix across ranks.'))

# ─────────────────────────────────────────────
# 5. Item notes: essence drop-intent (design notes only)
# ─────────────────────────────────────────────
iws, ih, icols = table('items')
NOTE_UPDATES = {
    'monster_essence':
        'v0.1.3: Neutral currency for BASIC skills (plus Copper and Training Scrolls), not category skills or passives. '
        'Dropped by every Meadows monster at 36% (1–2; bosses 40% 1–3) — more common than category essence, which is the main gate and should feel earned. '
        'Original sheet draft said ~15% (before the v0.1.2 ×2, which made it 30% and left Nature at 44–56%). We kept ME high and pulled category essence down, per playtest.',
    'nature_essence':
        'v0.1.3: Main gate for Nature skills and the Nature passive tree. Dropped only by Nature monsters at 18–20% (1–2; Old Stump 36% 1–3), below Monster Essence so it feels earned. '
        'Original sheet draft said 20–30% (before ×2). Commons exchange at 10:1 (Ila, later). Produced by the Nature tree (steep curve).',
    'elemental_essence':
        'v0.1.3: Main gate for Elemental skills and the Elemental tree. Dropped only by Elemental monsters at 18% (1–2), below Monster Essence. Original draft 20–30% before ×2.',
    'spirit_essence':
        'v0.1.3: Main gate for Spiritual skills and the Spiritual tree. Dropped only by Spiritual monsters at 18% (1–2; Night Stump 36% 1–3), below Monster Essence.',
}
for r in range(ih + 1, iws.max_row + 1):
    iid = iws.cell(r, icols['id']).value
    if iid in NOTE_UPDATES and 'notes' in icols:
        iws.cell(r, icols['notes']).value = NOTE_UPDATES[iid]

# ─────────────────────────────────────────────
# 6. controls notes for 1-6 hotbar
# ─────────────────────────────────────────────
if 'controls' in wb.sheetnames:
    ctw, cth, ctcols = table('controls')
    for r in range(cth + 1, ctw.max_row + 1):
        act = str(ctw.cell(r, ctcols['action']).value or '')
        if act == 'skill_1' and 'notes' in ctcols:
            ctw.cell(r, ctcols['notes']).value = 'Hotbar slot 1. Default: Power Strike. Can be rebound to any known skill or consumable (select in the skills or inventory window, press 1–6).'
        if act == 'potion_hp':
            ctw.cell(r, ctcols['keys']).value = '5 / Q'
            ctw.cell(r, ctcols['notes']).value = 'Hotbar slot 5. Default on new (and migrated) saves: Meadow Dew. Bind any consumable from the inventory.'
        if act == 'potion_mp':
            ctw.cell(r, ctcols['keys']).value = '6 / G'
            ctw.cell(r, ctcols['notes']).value = 'Hotbar slot 6. Default: Clear Dew. Bind any consumable from the inventory.'
    append_note(ctw, 'v0.1.3: hotbar slots 1–6 each hold a skill or a consumable; 5 and 6 default to Meadow Dew and Clear Dew.')

freeze_bools()
wb.save(P)

# ─────────────────────────────────────────────
# Before/after report
# ─────────────────────────────────────────────
# Re-read after values from the saved intent (we have them in memory)
after = {}
for r in range(dh + 1, dws.max_row + 1):
    mid = dws.cell(r, dcols['monster_id']).value
    iid = dws.cell(r, dcols['item_id']).value
    if not mid: continue
    after[(mid, iid)] = dict(
        rate=dws.cell(r, dcols['drop_rate']).value,
        lo=dws.cell(r, dcols['min_qty']).value,
        hi=dws.cell(r, dcols['max_qty']).value,
    )

lines = [
    '# v0.1.3 drop and recipe audit (before → after)',
    '',
    '## Policy',
    '',
    '- **Gear** is very rare: pasture entries 0.18–0.35%, pool sums ≈1.05% (mice) / 1.50% (sheep) / 1.87% (crows). Weighted by spawn counts 8+5+3: **≈1.34% ≈ 1 piece per 75 kills** (target 60–100). Magic stays 1/12 of those already-rare drops. Later-area gear was already 0.03–0.24% and is unchanged.',
    '- **Monster Essence** is the basic-skill fuel and is **more common** than category essence (36% 1–2 on every mob; bosses 40% 1–3). The original sheet draft said ME ~15% and Nature 20–30% *before* v0.1.2 doubled everything (Nature landed at 44–56% vs ME 30%). Playtest asked for the opposite, and ME is spent on every basic rank, so we kept ME high and pulled category essence down so it feels earned.',
    '- **Category essence** (Nature / Elemental / Spirit): 16–20% 1–2 on themed mobs only (bosses 36% 1–3).',
    '- **Copper** stays frequent (50–70%, 1–4). **Common mats** 28–40%, 1–3. **Training Scrolls** 10–12%, 1–2. **Uncommons** 2–6%. **Rares** 0.03–2%. Those bands were already coherent and were left.',
    '',
    '## Drops that changed',
    '',
    '| Monster | Item | Before (rate, qty) | After (rate, qty) |',
    '|---|---|---|---|',
]
changed = []
for k in sorted(before, key=lambda x: (x[0], x[1])):
    b, a = before[k], after[k]
    if (b['rate'], b['lo'], b['hi']) != (a['rate'], a['lo'], a['hi']):
        lines.append(f"| `{k[0]}` | `{k[1]}` | {b['rate']}% {b['lo']}–{b['hi']} | {a['rate']}% {a['lo']}–{a['hi']} |")
        changed.append(k)

lines += ['', '## Monster XP (−28%)', '', '| Monster | Before | After |', '|---|---|---|']
for mid, (o, n) in XP.items():
    lines.append(f'| `{mid}` | {o} | {n} |')

lines += ['', '## Skill recipes (off-theme materials)', '', '| Change | Before | After |', '|---|---|---|']
for b, a in zip(recipe_before, recipe_after):
    lines.append(f'| on-theme | {b} | {a} |')
lines += [
    '',
    'Spiritual recipes (Soul Guard, Holy Light, Shadow Mark) were already on-theme and were not changed.',
    'Rank 2+ quantities still scale from the rank-1 row (`round(rank_1 × 1.6^(r−1))`); rares stay at ranks 5 and 10 only.',
    '',
]
Path('docs/v0.1.3-drops.md').write_text('\n'.join(lines) + '\n')
print('patched', P)
print('drop rows changed', len(changed))
print('recipes', len(recipe_before))
print('wrote docs/v0.1.3-drops.md')
