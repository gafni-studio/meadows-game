"""v0.1.2: player-facing `desc` column, distinct from design `notes`.
Run: python3 scripts/sheet-patches/v0.1.2-descs.py && npm run export-sheet
"""
import openpyxl, sys, json
from pathlib import Path

P = 'sheet/Game_Design_DB_v0.xlsx'
wb = openpyxl.load_workbook(P)

def table(name):
    ws = wb[name]
    hdr_row = 2 if str(ws.cell(1, 1).value or '').startswith(('NOTE', 'DRAFT')) else 1
    cols = {str(c.value).strip(): c.column for c in ws[hdr_row] if c.value}
    return ws, hdr_row, cols

def add_col(ws, h, cols, name, after=None):
    if name in cols:
        return
    if after and after in cols:
        # insert after `after` by shifting — simpler: append at end
        pass
    c = ws.max_column + 1
    ws.cell(h, c).value = name
    cols[name] = c

def freeze_bools():
    for n in wb.sheetnames:
        for row in wb[n].iter_rows():
            for c in row:
                if c.data_type == 'f' and str(c.value).upper() in ('=TRUE()', '=FALSE()'):
                    c.value = str(c.value).upper() == '=TRUE()'

# ── player-facing copy (one line, ~60-80 chars, flavor, no design notes) ──
ITEM_DESC = {
    'twig': 'A small dry twig.',
    'bark': 'A strip of bark from a meadow tree.',
    'branch': 'A sturdy branch.',
    'log': 'A plain cut of meadow wood.',
    'heartwood': 'Dense wood from the center of an old stump.',
    'pebble': 'A small smooth pebble.',
    'clay': 'A lump of soft meadow clay.',
    'stone_chunk': 'A rough chunk of stone.',
    'copper_nail': 'A bent copper nail from old fences.',
    'wool': 'A tuft of plain wool.',
    'feather': 'A common bird feather.',
    'fur': 'A small scrap of fur.',
    'leather_scrap': 'A small piece of tough leather.',
    'earth_grit': 'A pinch of common elemental earth grit.',
    'earth_shard': 'A small shard of elemental earth energy.',
    'earth_crystal': 'A crystal of elemental earth energy.',
    'fire_shard': 'A small shard of elemental fire.',
    'ice_shard': 'A small shard of elemental ice.',
    'lightning_shard': 'A small shard of elemental lightning.',
    'holy_dust': 'A pinch of faint holy dust.',
    'holy_essence': 'A small amount of holy essence.',
    'soul_dust': 'A pinch of faint soul dust.',
    'soul_shard': 'A small shard of soul essence.',
    'cursed_dust': 'A pinch of cursed dust.',
    'nature_essence': 'A vial of green essence drawn from living things.',
    'elemental_essence': 'A vial of raw elemental essence.',
    'spirit_essence': 'A vial of pale essence drawn from spirit.',
    'monster_essence': 'A small vial of essence left by a fallen creature.',
    'training_scroll': 'A plain training scroll.',
    'copper_coin': 'A simple copper coin.',
    'meadow_dew': 'A sip of meadow dew.',
    'clear_dew': 'A sip of clear dew.',
    'spring_draught': 'A flask of spring water mixed with herbs.',
    'mint_draught': 'A mild mint drink.',
    'barley_cake': 'A plain barley cake from town.',
    'wild_apple': 'A small wild apple.',
    'mint_sprig': 'A sprig of fresh mint.',
    'broken_twig': 'A snapped twig, too broken to use as material.',
    'lost_button': 'A plain lost button.',
    'old_bone': 'An old dry bone.',
    'torn_cloth': 'A scrap of torn cloth.',
    'cracked_shell': 'A cracked, empty shell.',
    'wooden_sword': 'A plain wooden sword.',
    'worn_staff': 'A worn wooden staff.',
    'rusty_dagger': 'A rusty dagger.',
    'cloth_tunic': 'A simple cloth tunic.',
    'leather_cap': 'A simple leather cap.',
    'leather_boots': 'A pair of simple leather boots.',
    'cloth_cap': 'A simple cloth cap.',
    'cloth_pants': 'A simple pair of cloth pants.',
    'cloth_shoes': 'A simple pair of cloth shoes.',
    'cloth_gloves': 'A simple pair of cloth gloves.',
    'leather_vest': 'A simple leather vest.',
    'leather_pants': 'A simple pair of leather pants.',
    'leather_gloves': 'A simple pair of leather gloves.',
    'iron_ore': 'A chunk of raw iron ore.',
    'fire_crystal': 'A crystal of elemental fire.',
    'steel_sword': 'A well-forged steel sword.',
    'steel_staff': 'A well-forged steel staff.',
    'steel_dagger': 'A well-forged steel dagger.',
    'pasture_bell': 'A small dull bell, the kind some sheep wear.',
    'bright_bead': 'A cheap bright bead.',
    'fence_peg': 'A short wooden peg from an old fence.',
    'warm_grain': 'A grain of dirt that still holds a little warmth.',
    'worn_charm': 'A plain charm, left at the shrine long ago.',
    'old_sap': 'A sticky drip of sap from an old stump.',
    'shiny_stone': 'A smooth stone pushed up from the dirt. Pretty, but just a stone.',
    'old_coin_purse': 'A lost purse, dirt still on the stitch.',
    'glass_chip': 'A small chip of old glass from the soil.',
    'copper_bit': 'A tiny scrap of copper.',
    'silver_thread': 'A short length of fine, pale thread.',
    'shrine_pin': 'A small pin left at the meadow shrine.',
    'evening_bead': 'A dark bead, easy to miss until evening.',
    'amber_drop': 'A hard drop of old sap that caught the light.',
    'tarnished_ring': 'An old ring, once caught in stump roots.',
    'old_key': 'A small, rusty key.',
    'meadow_blade': 'A sturdy farm blade, better than a practice sword.',
    'grove_staff': 'A staff cut from a grove tree.',
    'bone_knife': 'A sharp knife carved from bone.',
    'hide_cap': 'A cap of meadow hide, stitched for a warrior.',
    'hide_vest': 'A vest of thick meadow hide.',
    'hide_pants': 'Hide trousers, scuffed from the pasture.',
    'hide_boots': 'Sturdy hide boots for rough grass.',
    'hide_gloves': 'A pair of hide gloves, still a little stiff.',
    'linen_cap': 'A light linen hood.',
    'linen_vest': 'A simple linen robe, cool in the sun.',
    'linen_pants': 'Linen wraps for walking the meadow.',
    'linen_boots': 'Soft linen sandals.',
    'linen_gloves': 'Light linen sleeves for the hands.',
    'trail_cap': 'A worn cap for the trail.',
    'trail_vest': 'A light vest that will not catch on brush.',
    'trail_pants': 'Trail pants, easy to move in.',
    'trail_boots': 'Quiet boots for the path.',
    'trail_gloves': 'Thin gloves that keep a firm grip.',
}

# Mechanical effect lines to keep in notes (UI never shows notes; the parser still reads them).
CONSUMABLE_EFFECT = {
    'meadow_dew': 'Restores 40 HP.',
    'clear_dew': 'Restores 30 MP.',
    'spring_draught': 'Restores 100 HP.',
    'mint_draught': 'Restores 80 MP.',
    'barley_cake': 'Restores 20 HP.',
    'wild_apple': 'Restores 15 HP.',
    'mint_sprig': '+20% move and attack speed for 30 seconds.',
}

SKILL_DESC = {
    'rage': 'Channel fury to hit harder for a short time.',
    'power_strike': 'A heavy blow that hits harder than a normal swing.',
    'earthbreaker': 'Slam the ground and stagger nearby foes.',
    'flame_cleave': 'A wide flaming swing that leaves enemies burning.',
    'soul_guard': 'A shield of spirit that takes the next hits for you.',
    'energy_shield': 'Wrap yourself in a ward that dulls and reflects blows.',
    'energy_blast': 'A bolt of raw energy thrown from a distance.',
    'thorn_bind': 'Vines lash out and hold a foe in place.',
    'firebolt': 'A searing bolt that sets the target alight.',
    'holy_light': 'A burst of light that harms foes and mends you.',
    'stealth': 'Slip into the shadows and become harder to hit.',
    'backstab': 'A precise strike from hiding that finds a weak spot.',
    'venom_strike': 'A poisoned blade that keeps hurting after the cut.',
    'lightning_dash': 'Dash through your enemies in a crack of lightning.',
    'shadow_mark': 'Mark a foe so every hit that follows bites deeper.',
}

QUEST_DESC = {
    'sq_welcome': 'Talk to Pell, walk to the Sunny Pasture gate, and come back.',
    'sq_first_fight': 'Defeat 5 Field Mice in Sunny Pasture and return to Pell.',
    'sq_loot': 'Pick up 6 items in Sunny Pasture and talk to Pell.',
    'sq_shop': 'Sell a bit of junk to Mara, then buy a Meadow Dew or a Barley Cake.',
    'sq_spend_points': 'Open your stats (C) and spend your first ability points.',
    'sq_essence_lesson': 'Bring Calden a vial of Monster Essence from a Meadows monster.',
    'sq_rank_skill': 'Train a basic skill to rank 1 at Calden, or press K.',
    'sq_exchange': 'Bring Ila 10 Nature commons and exchange them for 1 Nature Essence.',
    'sq_first_passive': 'Open the passive tree (T) and spend your first point.',
}

NPCS = [
    dict(id='mara', name='Mara', role='shop',
         desc='I buy junk and sell supplies for the pasture.',
         notes='Meadows vendor. Opens the shop (npc_shop). Design only — this line is unused while role=shop opens the shop directly.'),
    dict(id='pell', name='Pell', role='hint',
         desc="Welcome to Meadow Town! Head east to Sunny Pasture — mice and sheep leave you be unless you hit them, but watch the crows. Press E to pick up drops, sell junk to Mara, and train with Calden.",
         notes='Town greeter. Grants sq_welcome on first talk. Tutorial-length dialog is longer than item descs on purpose.'),
    dict(id='calden', name='Calden', role='trainer',
         desc='Bring me Monster Essence and Training Scrolls to rank your skills. Nature, Elemental and Spiritual skills need their own essence and materials.',
         notes='Skill trainer. Role=trainer opens the skills window directly; desc is kept for later use and documentation.'),
    dict(id='ila', name='Ila', role='soon',
         desc="I'm not exchanging essence just yet. Hold on to your Twigs, Bark and Wool.",
         notes='Essence exchange (10:1) is later. Do not mention version numbers or design milestones in desc.'),
]

# Guard
ws_i, _, _ = table('items')
note0 = str(ws_i.cell(1, 1).value or '')
if 'v0.1.2-descs' in note0:
    sys.exit('already patched')

# ── items ──
ws, h, cols = table('items')
add_col(ws, h, cols, 'desc')
missing = []
for r in range(h + 1, ws.max_row + 1):
    iid = ws.cell(r, cols['id']).value
    if not iid:
        continue
    if iid not in ITEM_DESC:
        missing.append(iid)
        continue
    desc = ITEM_DESC[iid]
    ws.cell(r, cols['desc']).value = desc
    # Keep description in sync so any leftover UI path is also player-facing.
    if 'description' in cols:
        ws.cell(r, cols['description']).value = desc
    if iid in CONSUMABLE_EFFECT and 'notes' in cols:
        notes = str(ws.cell(r, cols['notes']).value or '')
        eff = CONSUMABLE_EFFECT[iid]
        if eff.lower() not in notes.lower():
            ws.cell(r, cols['notes']).value = (eff + ' ' + notes).strip()

if missing:
    sys.exit('missing ITEM_DESC for: ' + ', '.join(missing))

note = str(ws.cell(1, 1).value or '')
ws.cell(1, 1).value = note + (
    ' v0.1.2-descs: `desc` is the short player-facing line shown in tooltips (flavor only, no design notes). '
    '`notes` is design-only and is never shown in game. Mechanical consumable effects ("Restores 40 HP") live in notes and are shown as stats. '
    '`description` is kept in sync with `desc` for older exports.')

# ── gear ──
ws, h, cols = table('gear')
add_col(ws, h, cols, 'desc')
# gear ids match item ids
for r in range(h + 1, ws.max_row + 1):
    iid = ws.cell(r, cols['item_id']).value
    if not iid:
        continue
    desc = ITEM_DESC.get(iid)
    if not desc:
        sys.exit('missing ITEM_DESC for gear ' + str(iid))
    ws.cell(r, cols['desc']).value = desc
    if 'description' in cols:
        ws.cell(r, cols['description']).value = desc

note = str(ws.cell(1, 1).value or '')
if 'v0.1.2-descs' not in note:
    ws.cell(1, 1).value = note + ' v0.1.2-descs: `desc` is player-facing flavor (no rolled ranges — those are shown as stats).'

# ── skills ──
ws, h, cols = table('skills')
add_col(ws, h, cols, 'desc')
add_col(ws, h, cols, 'notes')
for r in range(h + 1, ws.max_row + 1):
    sid = ws.cell(r, cols['id']).value
    if not sid:
        continue
    if sid not in SKILL_DESC:
        sys.exit('missing SKILL_DESC for ' + str(sid))
    old = str(ws.cell(r, cols['description']).value or '') if 'description' in cols else ''
    desc = SKILL_DESC[sid]
    ws.cell(r, cols['desc']).value = desc
    # Move design reasoning into notes; keep any existing notes.
    existing_notes = str(ws.cell(r, cols['notes']).value or '').strip() if 'notes' in cols else ''
    notes = old if old and old != desc else existing_notes
    if existing_notes and existing_notes not in notes:
        notes = (notes + ' ' + existing_notes).strip()
    ws.cell(r, cols['notes']).value = notes
    if 'description' in cols:
        ws.cell(r, cols['description']).value = desc  # leftover UI must not show design notes

note = str(ws.cell(1, 1).value or '')
if 'v0.1.2-descs' not in note:
    ws.cell(1, 1).value = note + ' v0.1.2-descs: `desc` is the short player-facing line; design reasoning lives in `notes` and is never shown in game. `description` is kept in sync with `desc`.'

# ── starter_quests ──
ws, h, cols = table('starter_quests')
add_col(ws, h, cols, 'desc')
for r in range(h + 1, ws.max_row + 1):
    qid = ws.cell(r, cols['id']).value
    if not qid:
        continue
    if qid not in QUEST_DESC:
        sys.exit('missing QUEST_DESC for ' + str(qid))
    ws.cell(r, cols['desc']).value = QUEST_DESC[qid]

note = str(ws.cell(1, 1).value or '')
if 'v0.1.2-descs' not in note:
    ws.cell(1, 1).value = note + ' v0.1.2-descs: `desc` is the short player-facing quest blurb. `notes` and tuning remarks stay design-only and are never shown in game.'

# ── npcs tab (new) ──
if 'npcs' not in wb.sheetnames:
    nws = wb.create_sheet('npcs')
    nws.cell(1, 1).value = (
        'NOTE: Player-facing NPC lines. `desc` is shown in the talk dialog (or kept for later if the role opens a window directly). '
        '`notes` is design-only and is never shown in game. v0.1.2-descs.')
    for i, hname in enumerate(['id', 'name', 'role', 'desc', 'notes'], 1):
        nws.cell(2, i).value = hname
    for r, row in enumerate(NPCS, 3):
        nws.cell(r, 1).value = row['id']
        nws.cell(r, 2).value = row['name']
        nws.cell(r, 3).value = row['role']
        nws.cell(r, 4).value = row['desc']
        nws.cell(r, 5).value = row['notes']
else:
    ws, h, cols = table('npcs')
    for n in ('id', 'name', 'role', 'desc', 'notes'):
        add_col(ws, h, cols, n)
    have = {ws.cell(r, cols['id']).value for r in range(h + 1, ws.max_row + 1)}
    for row in NPCS:
        if row['id'] in have:
            for r in range(h + 1, ws.max_row + 1):
                if ws.cell(r, cols['id']).value == row['id']:
                    for k, v in row.items():
                        ws.cell(r, cols[k]).value = v
        else:
            rr = ws.max_row + 1
            for k, v in row.items():
                ws.cell(rr, cols[k]).value = v

# length check
over = []
for label, d in (('item', ITEM_DESC), ('skill', SKILL_DESC), ('quest', QUEST_DESC)):
    for k, v in d.items():
        if len(v) > 80:
            over.append(f'{label}:{k} ({len(v)}) {v}')
# NPC dialog may be longer (Pell tutorial)
for row in NPCS:
    if row['id'] != 'pell' and len(row['desc']) > 160:
        over.append(f"npc:{row['id']} ({len(row['desc'])})")
if over:
    print('WARN over 80 chars:')
    for o in over:
        print(' ', o)

freeze_bools()
wb.save(P)

# Write the report file from the same source
doc = Path('docs/player-descs.md')
lines = [
    '# Player-facing `desc` copy (v0.1.2)',
    '',
    'The sheet is the source of truth. `desc` is shown in game (tooltips and NPC/quest blurbs).',
    '`notes` holds design reasoning and is never shown. Mechanical effects (heal amounts, skill `effect`) are shown as stats.',
    '',
    '## Sheet tabs and columns (mirror these into the Google Sheet)',
    '',
    '- **items** — new column `desc` (player-facing). Existing `notes` stays design-only. Existing `description` is kept in sync with `desc`. Consumable effects such as "Restores 40 HP" were moved into `notes` (the game parses them for the stats block).',
    '- **gear** — new column `desc` (flavor only; rolled ranges stay as stats). `description` is kept in sync with `desc`.',
    '- **skills** — new columns `desc` and `notes`. The old `description` text (design reasoning) was moved into `notes`. `description` is now in sync with `desc`.',
    '- **starter_quests** — new column `desc` (short player-facing blurb). `notes` and the longer `objective` stay for design; the game should show `desc`.',
    '- **npcs** — new tab, columns `id`, `name`, `role`, `desc`, `notes`.',
    '',
    '## Items',
    '',
]
for k, v in ITEM_DESC.items():
    lines.append(f'- `{k}` — {v}')
lines += ['', '## Skills', '']
for k, v in SKILL_DESC.items():
    lines.append(f'- `{k}` — {v}')
lines += ['', '## Quests', '']
for k, v in QUEST_DESC.items():
    lines.append(f'- `{k}` — {v}')
lines += ['', '## NPCs', '']
for row in NPCS:
    lines.append(f"- `{row['id']}` ({row['role']}) — {row['desc']}")
    if row['id'] == 'pell':
        lines[-1] += f"  ({len(row['desc'])} chars; tutorial dialog is longer on purpose.)"
lines.append('')
doc.write_text('\n'.join(lines) + '\n')
print('patched', P, 'wrote', doc, 'items', len(ITEM_DESC), 'skills', len(SKILL_DESC))
