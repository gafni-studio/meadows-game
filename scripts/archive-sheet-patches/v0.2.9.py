"""v0.2.9 fixes before Whisperwood: quest lines rebuilt (intro chain, Path of the Warrior / Magician,
gradual unlocks, smaller rewards, no NPC material kits, new copy), drops -25% and capped at 3 per kill
(Copper excluded). Run:
  python3 scripts/sheet-patches/v0.2.9.py && npm run export-sheet
"""
import openpyxl, sys

P = 'sheet/Game_Design_DB_v0.xlsx'
wb = openpyxl.load_workbook(P)


def table(name):
    ws = wb[name]
    hdr_row = 2 if str(ws.cell(1, 1).value or '').startswith(('NOTE', 'DRAFT')) else 1
    cols = {str(c.value).strip(): c.column for c in ws[hdr_row] if c.value}
    return ws, hdr_row, cols


def note(ws, text):
    cur = str(ws.cell(1, 1).value or '')
    if 'v0.2.9' in cur:
        sys.exit('already patched')
    ws.cell(1, 1).value = (cur + '  ' + text).strip()


# ---------- quests ----------
ws, h, c = table('skill_quests')
note(ws, 'v0.2.9: all lines rebuilt. Welcome to Meadow Town (intro chain), Path of the Warrior and Path of the Magician replace The Weight of a Swing, The Hero\'s Paths and The Quiet Spell. Lines appear gradually (see trigger). NPCs never hand over quest materials. Rewards cut to about a third. Titles, journal text and dialogue follow the tone guide in planning/v0.2.9.md.')
for r in range(ws.max_row, h, -1):
    ws.delete_rows(r)

LINES = []


def line(line_id, name, desc, trigger, steps, gate=None, unlock=None, reward=None, notes=''):
    for i, st in enumerate(steps, 1):
        row = dict(id=f'{line_id}_{i}', line_id=line_id, step=i, name=name, desc=desc, objective=st[0], giver=st[1] if len(st) > 1 else None,
                   notes=notes if i == 1 else '', trigger=trigger if i == 1 else None, gate_level=None, gate_stat=None, gate_value=None,
                   reward_xp=None, reward_coins=None, reward_items=None, unlock_skill=None)
        if gate:
            row.update(gate_level=gate[0], gate_stat=gate[1], gate_value=gate[2])
        if i == len(steps):
            row['unlock_skill'] = unlock
            if reward:
                row.update(reward_xp=reward[0], reward_coins=reward[1], reward_items=reward[2])
        LINES.append(row)


line('ql_intro', 'Welcome to Meadow Town',
     'Meadow Town is small, but everyone in it knows something worth learning. Pell at the east gate is a good place to start.',
     'new game', [
         ('Talk to Pell at the east gate. (E talks, J opens the journal, L the objectives.)', 'pell'),
         ('Talk to Mara at her counter.', 'mara'),
         ("Buy a Strawberry from Mara's shop (E at her counter).", None),
         ('Talk to Mara again.', 'mara'),
         ('Open your bag (I), put a berry on Q, and eat it with Q.', None),
         ('Open the storage chest by the sign (E).', 'chest'),
         ('Put one item in the chest and take it back out.', None),
         ('Talk to Ila at her bench.', 'ila'),
         ('Talk to Tamsin.', 'tamsin'),
         ('Spend your first ability point (C, then Enter).', None),
         ('Talk to Calden.', 'calden'),
     ], reward=(10, None, None),
     notes='v0.2.9. One quest, eleven short steps, all in town. Small step gifts: 5 Copper (Pell), 2 Blueberry (Mara), 1 Meadow Dew (chest), 1 Clear Dew (Ila), 2 Strawberry (Tamsin). No materials.')
line('ql_warrior', 'Path of the Warrior',
     'Calden wants to see what you are made of before he puts a Path under your feet. Start at the practice post.',
     'Welcome to Meadow Town done', [
         ('Talk to Calden.', 'calden'),
         ('Land 3 basic attacks (F) on the practice post.', 'calden'),
         ('Return to Calden.', 'calden'),
         ('Defeat 5 Field Mice outside the gate and gather 5 Twig for Calden.', 'calden'),
         ('Return to Calden with 5 Twig.', 'calden'),
     ], unlock='power_strike', reward=(25, 5, None),
     notes='v0.2.9. Replaces The Weight of a Swing and The Hero\'s Paths. Completing it reveals the Warrior tab; Power Strike can then be trained (not granted).')
line('ql_magician', 'Path of the Magician',
     'Tamsin has been watching you swing. She thinks your hands could hold something quieter, and she needs wool and feathers for a focus charm.',
     'Power Strike trained', [
         ('Talk to Tamsin.', 'tamsin'),
         ('Bring Tamsin 6 Wool and 4 Feather.', 'tamsin'),
         ('Return to Tamsin.', 'tamsin'),
     ], unlock='magic_bolt', reward=(20, 5, 'clear_dew x1'),
     notes='v0.2.9. Replaces The Quiet Spell. Completing it reveals the Magician tab; Magic Bolt can then be trained.')
line('ql_warm_coat', 'Wool Before Winter',
     'Mara is short of wool and fur before the cold sets in. She will pay in more than Copper.',
     'level 3, after Path of the Warrior', [
         ('Talk to Mara in Meadow Town.', 'mara'),
         ('Bring Mara 8 Wool and 6 Fur.', 'mara'),
     ], reward=(30, 6, 'hide_vest x1'), notes='v0.2.9. Hide Vest is exact and never magic.')
line('ql_dirt_path', 'Beyond the Pasture Gate',
     'Pell wants the crows cleared from the east gate, and someone brave enough to walk the dirt path into the Banks.',
     'level 3, after Path of the Warrior', [
         ('Talk to Pell at the east gate in Meadow Town.', 'pell'),
         ('Defeat 4 Crows at the east end of Sunny Pasture.', 'pell'),
         ('Take the dirt path east into the Dirt Banks.', 'pell'),
         ('Defeat 5 Burrow Moles and 3 Ember Beetles, then return to Pell.', 'pell'),
     ], reward=(35, 8, 'nature_essence x2'), notes='v0.2.9. No passive-point prerequisite any more.')
line('ql_blood', 'The Bargain of Rage',
     'Calden says Rage is a bargain, and wants you to learn the terms against a stubborn sheep at the far end of the pasture.',
     'level 4', [
         ('Talk to Calden.', 'calden'),
         ('Walk to the east end of Sunny Pasture, near the dirt path.', 'calden'),
         ('Defeat Wool-Shoulder with Rage on and return to Calden.', 'calden'),
     ], unlock='rage', reward=(20, 5, None), notes='v0.2.9. Rage is granted at rank 1 on completion.')
line('ql_quiet_work', 'Roots That Grow',
     'Ila has slower work to show you: a root in the dirt that yields while you are away. Gather what the first one costs.',
     'level 4, after Beyond the Pasture Gate', [
         ('Talk to Ila at her bench.', 'ila'),
         ('Gather Nature Essence 20, Pebble 16, Bark 12 and 18 Copper, then plant Nature Essence in the passive tree (T).', 'ila'),
         ('Return to Ila.', 'ila'),
     ], reward=(25, 5, 'meadow_dew x1'),
     notes='v0.2.9. Ila gives no kit any more: the player gathers the exact Nature Essence rank 1 cost and spends it. Pebble comes from the Banks.')
line('ql_dirt_keeps', 'What the Banks Hide',
     'Pell wants to know what the Banks keep under the loose earth. He has something for your hand if you can bring it.',
     'level 5, after Beyond the Pasture Gate', [
         ('Talk to Pell at the east gate in Meadow Town.', 'pell'),
         ('Bring Pell 8 Earth Grit and 4 Stone Chunk.', 'pell'),
     ], reward=(45, 10, 'stone_club x1'), notes='v0.2.9. Stone Club is exact (weapon damage 16), never magic.')
line('ql_crack', 'The Cracked Stone',
     'Calden says a stone in the Banks wants to break more than itself. Moles turn it up now and then.',
     'level 5, after Beyond the Pasture Gate (Calden talk), or a Cracked Bank Stone picked up after it', [
         ('Bring Calden a Cracked Bank Stone (5 STR).', 'calden'),
         ('Walk into the Dirt Banks.', 'calden'),
         ('Collect 8 Pebble and 6 Earth Grit, then bring them to Calden.', 'calden'),
         ('Defeat Bank-Cracker in the Dirt Banks and return to Calden.', 'calden'),
     ], gate=(5, 'STR', 5), unlock='earthbreaker', reward=(35, 7, 'nature_essence x3'),
     notes='v0.2.9. Completing it opens Earthbreaker training. The first Burrow Mole killed at level 5+ after Beyond the Pasture Gate always drops a stone (once).')
line('ql_hot', 'Ember in the Scale',
     'Calden says the Ember Beetles keep a little fire in their scales. Bring him one, and the rest follows.',
     'level 6, after The Cracked Stone (Calden talk), or a Smoldering Scale picked up after it', [
         ('Bring Calden a Smoldering Scale (level 6, 10 STR).', 'calden'),
         ('Collect 6 Warm Grain from Ember Beetles and bring them to Calden.', 'calden'),
         ('Defeat Cinderback in the Dirt Banks and bring its Live Ember to Calden.', 'calden'),
     ], gate=(6, 'STR', 10), unlock='flame_cleave', reward=(45, 8, 'elemental_essence x3'),
     notes='v0.2.9. Completing it opens Flame Cleave training. The level 6 / 10 STR gate applies to the scale turn-in.')

for row in LINES:
    r = ws.max_row + 1
    for k, v in row.items():
        ws.cell(r, c[k]).value = v

# ---------- drops ----------
dws, dh, dc = table('drop_tables')
note(dws, 'v0.2.9: every drop chance x0.75 (gear and rares included, Copper too); no item other than Copper drops more than 3 from one kill (min and max capped at 3).')
n_rate = n_cap = 0
for r in range(dh + 1, dws.max_row + 1):
    item = dws.cell(r, dc['item_id']).value
    if item is None:
        continue
    rate = dws.cell(r, dc['drop_rate']).value
    new = round(float(rate) * 0.75, 3 if rate < 1 else 2)
    new = int(new) if new == int(new) else new
    dws.cell(r, dc['drop_rate']).value = new
    n_rate += 1
    if item != 'copper_coin':
        lo, hi = dws.cell(r, dc['min_qty']).value, dws.cell(r, dc['max_qty']).value
        if hi and hi > 3:
            dws.cell(r, dc['max_qty']).value = 3
            n_cap += 1
        if lo and lo > 3:
            dws.cell(r, dc['min_qty']).value = 3
print('drops', n_rate, 'capped', n_cap)

for n in wb.sheetnames:
    for row in wb[n].iter_rows():
        for cell in row:
            if cell.data_type == 'f' and str(cell.value).upper() in ('=TRUE()', '=FALSE()'):
                cell.value = str(cell.value).upper() == '=TRUE()'
wb.save(P)
print('saved', len(LINES), 'quest rows')
