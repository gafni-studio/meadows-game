"""v0.1.3b: rarer gear (1/150–200 per mob pool) and per-monster anim_speed.
Run: python3 scripts/sheet-patches/v0.1.3b-gear-anim.py && npm run export-sheet
Prerequisite: v0.1.3.py already applied.
"""
import openpyxl, sys
from pathlib import Path

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

mws, mh, mcols = table('monsters')
note = str(mws.cell(1, 1).value or '')
if 'v0.1.3b' in note:
    sys.exit('already patched')

# ── anim_speed: 1 = current (Crow, it looked fine); 0.5 = half frame rate for everyone else ──
add_col(mws, mh, mcols, 'anim_speed')
for r in range(mh + 1, mws.max_row + 1):
    mid = mws.cell(r, mcols['id']).value
    if not mid: continue
    mws.cell(r, mcols['anim_speed']).value = 1 if mid == 'crow' else 0.5
mws.cell(1, 1).value = note + (
    ' v0.1.3b: `anim_speed` is a per-monster multiplier on walk/idle/flap frame rate and walk wobble '
    '(1 = the v0.1.2 rate; Crow stays at 1 because that looked fine; other mobs are 0.5, i.e. 2× slower). '
    'Walk anim also scales with actual move speed. Attack wind-up timing is unchanged.')

# ── Gear: 1 piece per 150–200 kills per mob pool; entries ~0.1–0.25% (Crow's 9-item pool dips to 0.06–0.10) ──
# mouse 0.18×3 = 0.54% (1/185); sheep 0.12×3+0.10×3 = 0.66% (1/152); crow 0.63% (1/159)
GEAR = {
    ('field_mouse', 'hide_gloves'): 0.18,
    ('field_mouse', 'linen_gloves'): 0.18,
    ('field_mouse', 'trail_gloves'): 0.18,
    ('wool_sheep', 'hide_vest'): 0.12,
    ('wool_sheep', 'linen_vest'): 0.12,
    ('wool_sheep', 'trail_vest'): 0.12,
    ('wool_sheep', 'hide_pants'): 0.10,
    ('wool_sheep', 'linen_pants'): 0.10,
    ('wool_sheep', 'trail_pants'): 0.10,
    ('crow', 'hide_cap'): 0.08,
    ('crow', 'linen_cap'): 0.07,
    ('crow', 'trail_cap'): 0.07,
    ('crow', 'hide_boots'): 0.08,
    ('crow', 'linen_boots'): 0.07,
    ('crow', 'trail_boots'): 0.07,
    ('crow', 'meadow_blade'): 0.07,
    ('crow', 'grove_staff'): 0.06,
    ('crow', 'bone_knife'): 0.06,
    # later-area pools that were still ~1% (1/80–90) — bring them into the same 150–200 band
    ('meadow_boar', 'leather_vest'): 0.15,
    ('meadow_boar', 'leather_boots'): 0.10,
    ('meadow_boar', 'leather_cap'): 0.10,
    ('meadow_boar', 'leather_pants'): 0.10,
    ('meadow_boar', 'wooden_sword'): 0.08,
    ('meadow_boar', 'rusty_dagger'): 0.08,
    # steel_sword stays 0.03 (ultra-rare)
    ('old_stump', 'wooden_sword'): 0.18,
    ('old_stump', 'cloth_pants'): 0.12,
    ('old_stump', 'cloth_tunic'): 0.12,
    ('old_stump', 'cloth_gloves'): 0.10,
    ('old_stump', 'steel_sword'): 0.06,
    ('night_stump', 'cloth_tunic'): 0.16,
    ('night_stump', 'cloth_cap'): 0.13,
    ('night_stump', 'cloth_shoes'): 0.12,
    ('night_stump', 'steel_staff'): 0.08,
    ('night_stump', 'steel_dagger'): 0.06,
}

dws, dh, dcols = table('drop_tables')
n = 0
for r in range(dh + 1, dws.max_row + 1):
    mid = dws.cell(r, dcols['monster_id']).value
    iid = dws.cell(r, dcols['item_id']).value
    if (mid, iid) in GEAR:
        dws.cell(r, dcols['drop_rate']).value = GEAR[(mid, iid)]
        n += 1

dnote = str(dws.cell(1, 1).value or '')
dws.cell(1, 1).value = dnote + (
    ' v0.1.3b: pasture gear retargeted to ≈1 piece per 150–200 kills per mob pool '
    '(mouse 0.54% / 1 in 185, sheep 0.66% / 1 in 152, crow 0.63% / 1 in 159). '
    'Entries 0.06–0.18% (Crow’s 9-item pool has to sit slightly under 0.1% on some mid weapons). '
    'Magic stays 1/12 of a gear drop. Boar and Stump pools brought into the same band.')

freeze_bools()
wb.save(P)
print('patched', P, 'gear rows', n)
