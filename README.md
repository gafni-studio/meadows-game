# Meadows — prototype v0.1

A 2D side-scrolling browser MMORPG prototype (MapleStory-style real-time grinding, later Travian-style offline growth).
v0.1 is a **single-player** slice of the Meadows zone: **Meadow Town** (hub + Mara's shop) and **Sunny Pasture** (levels 1-3).

Stack: **Phaser 3 + TypeScript + Vite**. Save is in `localStorage`. Art is placeholder shapes behind a sprite registry.

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
| Close window / menu (save, new game) | **Esc** |

**Why these keys:** no modifier keys are used, so gameplay can't trigger browser shortcuts (Ctrl+W closes the tab, etc.). Phaser calls `preventDefault` on every bound key, and a small guard blocks stray Ctrl+letter page shortcuts (Ctrl+S, Ctrl+P, ...). Potions are on 5 and 6/G instead of the sheet's Q/R.

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

## Design data (Google Sheet → JSON)

The **Game Design DB - v0** Google Sheet is the source of truth. The game reads `data/*.json` (one file per tab) and never hard-codes stats that live in the sheet. Prototype-only numbers the sheet doesn't define (cooldowns, movement speed, starter weapon, ...) are listed in one place: `src/data/assumptions.ts`.

To re-export after editing the sheet:

1. In Google Sheets: **File → Download → Microsoft Excel (.xlsx)**.
2. Save it as `sheet/Game_Design_DB_v0.xlsx`, replacing the old file.
3. Run `npm run export-sheet` (or `npm run export-sheet -- path/to/file.xlsx`).
4. Commit `data/` and the xlsx.

Each JSON file looks like `{ tab, note, columns, rows }`. Numbers and booleans are converted. `combat_formulas` and `game_rules` rows get a `num` field (the first number in `value`). `map_layout` rows get parsed `spawns` and `links`.

## Art swapping

All visuals go through **`src/art/sprites.ts`**, a registry of named slots (`player.warrior`, `monster.field_mouse`, `drop.rare`, `tile.grass`, ...). Each slot has a fixed logical size. Game logic only references slot keys. To replace placeholder shapes with real art (Kenney pixel art now, anime style later), drop images in `public/art/` and set `file` (plus `frameW`/`frameH` for spritesheets) on the slot. Keep the slot size, or change it in one place.

## Code layout

```
data/            exported sheet tabs (JSON), committed
sheet/           the downloaded .xlsx the export reads
scripts/         export-sheet.mjs, smoke-test.mjs
src/main.ts      Phaser game config + DOM HUD
src/scenes/      BootScene (textures, load save), WorldScene (areas, combat, loot, portals)
src/entities/    Monster (AI: wander / aggro / chase / leash / respawn)
src/systems/     Player (stats, XP, inventory, gear), Combat, Loot, Save, Controls, GameState
src/data/        db.ts (typed access to /data), assumptions.ts (non-sheet placeholders)
src/art/         sprite registry + placeholder texture factory
src/world/       per-area geometry (platforms, NPCs, portals, spawn zones)
src/ui/          DOM HUD and windows (inventory, stats, shop, dialog, menu)
```
