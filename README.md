# Meadows — prototype v0.1.1

A 2D side-scrolling browser MMORPG prototype (MapleStory-style real-time grinding, later Travian-style offline growth).
v0.1 is a **single-player** slice of the Meadows zone: **Meadow Town** (hub + Mara's shop) and **Sunny Pasture** (levels 1-3).

Stack: **Phaser 3 + TypeScript + Vite**. Save is in `localStorage`. Art is CC0 pixel art (Kenney + Tiny Creatures, see [CREDITS.md](CREDITS.md)) behind a sprite registry.

Live build: https://meadows-gafni.netlify.app

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check (tsc) + production build into dist/
npm run preview    # serve dist/ at http://localhost:4173
npm run smoke      # headless browser smoke test (needs a build + Chrome/Chromium; set CHROME_PATH if not /usr/bin/google-chrome)
```

Add `?canvas` to the URL to force the Canvas renderer instead of WebGL (used by the smoke test).

## Controls

| Action | Keys |
| --- | --- |
| Move | **A / D** or **← / →** |
| Jump | **Space** or **↑** |
| Attack (basic swing, 100%) | **F** (hold to keep swinging) |
| Skill 1: Power Strike | **1** |
| Skill 2: Rage | **2** |
| Skills 3-4 | **3 / 4** (empty in v0.1) |
| HP potion (first owned: Meadow Dew → Spring Draught → Barley Cake → Wild Apple) | **5** |
| MP potion (first owned: Clear Dew → Mint Draught) | **6** or **G** |
| Pick up nearby drops / talk to NPC / use portal | **E** |
| Inventory (use, equip, sell when the shop is open) | **I** |
| Character / ability points | **C** |
| Close window / open menu (save, new game) | **Esc** |
| Test console | **`** (backtick) |

### Menus (keyboard first, mouse optional)

While any window is open, gameplay keys (move, jump, F attack, skills, potions) are ignored.

| In a window | Keys |
| --- | --- |
| Move the highlight (grids, lists, tabs, buttons) | **← ↑ ↓ →** |
| Confirm / OK / buy / sell / use / equip / remove / +1 stat | **Enter** |
| Switch Buy ↔ Sell in Mara's shop | **Tab** (or ↑ to the tab row, then ← →) |
| Back / close | **Esc** |

Hovering a tile with the mouse selects it too, and the preview panel shows the item's icon, type, description, effect, prices and how many you own.

**Why these keys:** no modifier keys are used, so gameplay can't trigger browser shortcuts (Ctrl+W closes the tab, etc.). Phaser calls `preventDefault` on every bound key, and a small guard blocks stray Ctrl+letter page shortcuts (Ctrl+S, Ctrl+P, ...). Potions are on 5 and 6/G instead of the sheet's Q/R.

## What's new in v0.1.1

- **Keyboard menus:** every window (NPC dialogs, quest dialog, shop, inventory, stats, Esc menu, erase-save confirm) works with arrows + Enter + Esc + Tab.
- **Shop and inventory as tile grids** with item icons and a preview panel. The shop has Buy/Sell tabs. The inventory has an equipment row plus the bag.
- **Combat feel:**
  - Monsters approach to reach, wind up (a red flash plus a "!"), then strike, back off, hop over to your other side, or pause. They no longer park on you.
  - Attacks roll a hit chance and show MISS.
  - Hits knock monsters back with hitstun (sheep are heavy, mice are light). You get pushed a little when hit.
- **Out-of-combat HP regen:** after 5s without taking damage or attacking, you regain 2% max HP/s (Spirit speeds it up). A green glow and a pulsing HP bar show it.
- **Real pixel art** (CC0) replaces the colored boxes.
- **Test console** (`` ` ``); see below.

## What's in v0.1

- Meadow Town (safe hub): Mara's shop (buys and sells per the `npc_shop` rules), Pell (hint, plus the first starter quest "A First Step" as a one-time reward), and Calden and Ila (placeholders until v0.2). East gate to Sunny Pasture.
- Sunny Pasture: Field Mouse ×8, Wool Sheep ×5 and Crow ×3 (from `map_layout.spawn_counts`), with timed respawns (`monsters.respawn_s`). Passive mobs fight back once hit; aggressive mobs (Crow) aggro within 8 tiles. They leash at 20 tiles from spawn and walk home with HP reset. One-way platforms. The east path to Dirt Banks is marked "v0.2".
- Warrior only. Real-time melee, single target, with damage numbers and crits.
  - Power Strike: 140% damage, 8 MP, 1s cooldown.
  - Rage: +15% damage dealt and +10% damage taken for 60s, 12 MP.
  - The skill numbers come from the `skills` tab.
- Combat math comes from `combat_formulas`: attack, damage with the minimum-damage rule, crit, attack interval, incoming damage minus armor, HP/MP by level and stats, and MP regen.
- Drops are rolled independently per `drop_tables` row. Drops appear on the ground, rare ones (<1%) pulse orange, and you pick them up with E.
- Inventory with coins, consumables (use buttons and hotkeys), gear equip/unequip, and stat requirements.
- XP curve comes from `xp_to_next_N` (the formula is used beyond level 10). Each level gives 5 ability points, full HP/MP and 1.5s of invulnerability.
- Death costs 5% of current-level XP progress (you can't lose a level). You respawn in town after 3s at full HP/MP and keep your items.
- localStorage save (`meadows.save.v1`): autosaves every 10s, on area change, level-up, shop actions and tab close. Esc → "New game" erases it.

**Not in v0.1:** Mage and Rogue, skill ranking, the passive tree, the essence exchange, the full quest chain, other Meadows areas, bosses, crafting, server and multiplayer, mobile controls.

## Test console (`` ` ``)

Press **`** to open, type a command, press **Enter** to run, **↑/↓** for history, **Esc** to close. Any change marks the save as **cheated**: it shows a ⚑ next to your level and a note in the Esc menu. The console is controlled by `DEV_CONSOLE` in `src/config.ts`. It's on for the public playtest build; set it to `false` to remove it.

| Command | Effect |
| --- | --- |
| `help` | List commands |
| `xp <n>` | Gain n XP (levels up normally) |
| `level <n>` | Set level (±5 ability points per level) |
| `copper <n>` | Add (or remove, if negative) Copper Coin |
| `item <id> [qty]` | Add an item by `items.id` (e.g. `item spring_draught 5`) |
| `hp <n>` | Set current HP |
| `maxhp <n>` | Bonus max HP (0 clears) |
| `atk <n>` | Bonus attack (0 clears) |
| `def <n>` | Bonus defense (0 clears) |
| `god` | Toggle invulnerability |
| `heal` | Full HP and MP |
| `kill` | Kill every monster in the area (gives XP and drops) |
| `tp <area>` | Teleport: `meadow_town`, `sunny_pasture` |
| `spawn <monsterId> [n]` | Spawn monsters next to you (e.g. `spawn crow 3`) |
| `droprate <x>` | Multiply all drop chances (1 = normal) |
| `reset` | Erase the save and reload |

## Combat-feel stats (not in the sheet yet)

These live in `src/data/assumptions.ts` (`HIT`, `PLAYER_ACC`, `PLAYER_EVA`, `MONSTER_FEEL`, `ATTACK_FEEL`, `PLAYER_HIT_KB`, `AI`, `REGEN`) and are candidates for new sheet columns:

- **Hit chance:** clamp(85 + (acc − eva) × 1.5 + (attacker level − defender level) × 2, 50, 98)%.
- **Player:**
  - Accuracy = 10 + AGI + 0.5 × level.
  - Evasion = 8 + 0.8 × AGI + 0.5 × level.
- **Monsters:** acc / eva / knockback resistance / reach / wind-up:
  - Field Mouse: 5 / 7 / 0.0 / 14px / 380ms.
  - Wool Sheep: 6 / 6 / 0.6 / 16px / 450ms.
  - Crow: 8 / 10 / 0.2 / 18px / 400ms.
- **Knockback and hitstun:** basic attack 140 px/s, 320ms. Power Strike 360 px/s, 500ms. Rage none. Hitstun is scaled by 1 − kbRes × 0.5. The player is pushed 170 px/s when hit.
- **AI:**
  - Recover 250ms after a swing.
  - Then back off (45%), hop over (35%) or pause (20%).
  - A reposition lasts 550–1100ms and a pause 250–800ms.
  - Monsters stay at least 6px apart from you, edge to edge.
- **HP regen:** 2% max HP/s after 5s out of combat, × (1 + 0.02 × SPI).

## Design data (Google Sheet → JSON)

The **Game Design DB - v0** Google Sheet is the source of truth. The game reads `data/*.json` (one file per tab) and never hard-codes stats that live in the sheet. Prototype-only numbers the sheet doesn't define (cooldowns, movement speed, starter weapon, ...) are listed in one place: `src/data/assumptions.ts`.

To re-export after editing the sheet:

1. In Google Sheets: **File → Download → Microsoft Excel (.xlsx)**.
2. Save it as `sheet/Game_Design_DB_v0.xlsx`, replacing the old file.
3. Run `npm run export-sheet` (or `npm run export-sheet -- path/to/file.xlsx`).
4. Commit `data/` and the xlsx.

Each JSON file looks like `{ tab, note, columns, rows }`. Numbers and booleans are converted. `combat_formulas` and `game_rules` rows get a `num` field (the first number in `value`). `map_layout` rows get parsed `spawns` and `links`.

## Art

`python3 scripts/build-art.py` (needs Pillow) turns the vendored CC0 tiles in `art-src/` into `public/art/` (characters, world props and one icon per `items.id`). Licenses are in [CREDITS.md](CREDITS.md).

### Art swapping

All visuals go through **`src/art/sprites.ts`**, a registry of named slots (`player.warrior`, `monster.field_mouse`, `drop.rare`, `tile.grass`, ...). Each slot has a fixed logical size. Game logic only references slot keys. Each slot points at a file in `public/art/`, and art at any resolution is scaled to the slot. To swap to anime-style art later, replace the files or change `file` (plus `frameW`/`frameH` for spritesheets) on the slot. If the art has a different body shape, adjust its `body` hitbox. Game code doesn't change. A slot whose file is missing falls back to a colored shape.

## Code layout

```
data/            exported sheet tabs (JSON), committed
sheet/           the downloaded .xlsx the export reads
scripts/         export-sheet.mjs, build-art.py, smoke-test.mjs
src/main.ts      Phaser game config + DOM HUD
src/scenes/      BootScene (textures, load save), WorldScene (areas, combat, loot, portals)
src/entities/    Monster (AI: wander / aggro / chase / leash / respawn)
src/systems/     Player (stats, XP, inventory, gear, acc/eva), Combat (damage, hit chance), Loot, Save, Controls, Cheats, GameState
src/data/        db.ts (typed access to /data), assumptions.ts (non-sheet placeholders)
src/art/         sprite registry (slots → files, fixed sizes) + texture helpers
src/config.ts    DEV_CONSOLE flag
public/art/      built sprites (from art-src/ via scripts/build-art.py)
src/world/       per-area geometry (platforms, NPCs, portals, spawn zones)
src/ui/          DOM HUD, keyboard-navigable windows, item preview, test console
```
