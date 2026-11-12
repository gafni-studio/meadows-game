"""v0.2.2: player-facing descs for Nature/Elemental production + efficiency, Ila opens the 10:1 bench.
Run: python3 scripts/sheet-patches/v0.2.2-passives.py && npm run export-sheet
"""
import openpyxl, sys
from openpyxl.utils import get_column_letter

P = 'sheet/Game_Design_DB_v0.xlsx'
wb = openpyxl.load_workbook(P)

def table(name):
    ws = wb[name]
    hdr_row = 2 if str(ws.cell(1, 1).value or '').startswith(('NOTE', 'DRAFT')) else 1
    cols = {str(c.value).strip(): c.column for c in ws[hdr_row] if c.value}
    return ws, hdr_row, cols

def freeze_bools():
    for n in wb.sheetnames:
        for row in wb[n].iter_rows():
            for c in row:
                if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                    c.value = str(c.value).upper() == '=TRUE()'

def find(ws, h, cols, key, val):
    for r in range(h + 1, ws.max_row + 1):
        if ws.cell(r, cols[key]).value == val:
            return r
    return None

def ensure_col(ws, h, cols, name):
    if name in cols:
        return cols
    c = max(cols.values()) + 1
    ws.cell(h, c).value = name
    cols[name] = c
    return cols

# Guard
pws, ph, pcols = table('passive_nodes')
note = str(pws.cell(1, 1).value or '')
if 'v0.2.2' in note:
    sys.exit('already patched')
pws.cell(1, 1).value = note + '  v0.2.2: Nature and Elemental trees are live (production + efficiency). Spiritual and Hunter\'s Luck stay parked. `desc` is player-facing; `notes` is design-only. Offline production uses timestamps. Ila\'s 10:1 bench is open.'
pcols = ensure_col(pws, ph, pcols, 'desc')

DESCS = {
    'nature_prod': 'Slowly produces Nature Essence while you play or are away. Rank 0 yields nothing.',
    'elemental_prod': 'Slowly produces Elemental Essence while you play or are away. Rank 0 yields nothing.',
    'spiritual_prod': 'Slowly produces Spirit Essence while you play or are away. Rank 0 yields nothing.',
    'nature_eff_drops': "While hunting, Nature materials and Nature Essence drop a little more often.",
    'elemental_eff_drops': "While hunting, Elemental materials and Elemental Essence drop a little more often.",
    'spiritual_eff_drops': "While hunting, Spiritual materials and Spirit Essence drop a little more often.",
    'hunters_luck': "A small extra chance of a bonus drop roll, of any kind.",
}
LIVE = {'nature_prod', 'elemental_prod', 'nature_eff_drops', 'elemental_eff_drops'}
for r in range(ph + 1, pws.max_row + 1):
    nid = pws.cell(r, pcols['id']).value
    if nid in DESCS:
        pws.cell(r, pcols['desc']).value = DESCS[nid]
    if nid in LIVE:
        if 'status' in pcols:
            pws.cell(r, pcols['status']).value = 'live'

# Ila
nws, nh, ncols = table('npcs')
r = find(nws, nh, ncols, 'id', 'ila')
if not r:
    sys.exit('ila row missing')
nws.cell(r, ncols['role']).value = 'exchange'
nws.cell(r, ncols['desc']).value = "Ten of a common material for one essence. Nature, Elemental, or Spirit — look at what you're holding."
nws.cell(r, ncols['notes']).value = 'v0.2.2: 10:1 essence bench is open (exchange tab). role=exchange opens the bench. desc is player-facing; kept even though the window opens directly, for documentation.'

# game_rules note
gws, gh, gcols = table('game_rules')
# optional, leave numbers as-is

freeze_bools()
wb.save(P)
print('patched v0.2.2 passives')
