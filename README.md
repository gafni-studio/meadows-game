# Meadows — prototype v0.1.2

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
| Skills 3-4 | **3 / 4** (Earthbreaker / Flame Cleave once learned; bind any skill from the K window) |
| Skill training (ranks, bind 1-4) | **K** (or E at Calden) |
| HP potion (first owned: Meadow Dew → Spring Draught → Barley Cake → Wild Apple) | **5** |
| MP potion (first owned: Clear Dew → Mint Draught) | **6** or **G** |
| Pick up nearby drops / talk to NPC / use portal | **E** |
| Inventory (use, equip, move, drop) | **I** |
| Storage chest in Meadow Town (next to the sign) | **E** |
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
| Bag / storage: pick up a stack, then place it on another slot (swap) | **M**, arrows, **Enter** (or **M**); Esc cancels |
| Bag: drop the selected stack on the ground (asks first for stacks and valuables) | **X** or **Delete** |
| Storage: move the selected stack to the other side / move one | **Enter** / **1** |
| Mouse | drag tiles between slots and between bag ↔ chest; drag out of the window to drop on the ground |
| Back / close | **Esc** |

Hovering a tile with the mouse selects it too, and the preview panel shows the item's icon, type, description, effect, prices and how many you own.

**Why these keys:** no modifier keys are used, so gameplay can't trigger browser shortcuts (Ctrl+W closes the tab, etc.). Phaser calls `preventDefault` on every bound key, and a small guard blocks stray Ctrl+letter page shortcuts (Ctrl+S, Ctrl+P, ...). Potions are on 5 and 6/G instead of the sheet's Q/R.

## What's new in v0.1.2 (playtest notes)

1. **Knockback ×3:** basic 420 px/s, Power Strike 1080 px/s (hitstun and knockback resistance unchanged).
2. **Contact melee + one ranged mob:** melee mobs only hurt you on body contact (4px reach, swing must still touch). New sheet column `monsters.attack_type` (melee / ranged): the **Crow** is ranged. It keeps 150-230px away, telegraphs, and throws a slow (150 px/s) pebble at chest height. Jump over it or walk away.
3. **Mobs move 2.5× slower:** mouse 28, sheep 20, crow 38 px/s.
4. **Nicer badges:** loot/info toasts slide in with the item icon and quantity ("Copper ×3"). Level-up shows a centered "LEVEL UP!" banner with a burst, a light beam and sparks, plus a short synthesized chime (WebAudio, no files). Nothing blocks input.
5. **Lower jump:** 60% of the old height (≈73px). Pasture platforms moved down to 2 and 4 tiles so they stay reachable.
6. **Regen ÷4:** 0.5% max HP/s after 5s out of combat, × (1 + 0.02 × SPI).
7. **Inventory slots:** 24 bag slots you can rearrange (mouse drag, or M → arrows → Enter). Drop items on the ground (X / drag out). Stacks and valuables ask first. Dropped items are normal pickups (E).
8. **Storage chest** in Meadow Town: two-panel window (chest 30 slots | bag), keyboard and mouse, saved with the character.
9. **Drops:** every `drop_tables.drop_rate` doubled (relative rarity unchanged). Quantities now roll `min_qty`-`max_qty` weighted toward the low end: copper 1-4, essences 1-3, Monster Essence 1-2, common materials 1-3, uncommon 1-2, rares 1. The drop multiplier (console `droprate`) raises chance **and** quantity: above 1× it stretches `max_qty` by 50% per extra 1×, and chance above 100% becomes a bonus roll.
10. **Monster HP −50%** in the sheet (mouse 55, sheep 75, crow 95, ...).
11. **Less predictable mobs:** random wind-up per swing (250-600ms), random recover (150-450ms), 15% feints (telegraph, then hop back without striking), random hesitation before closing in again, and a random choice of back off / hop over / pause.
12. **Monster accuracy:** ≈77-79% against an equal-level player; −3.5% for each level you're above the mob; floor 40%.
13. **Subtler levels:** 3 ability points per level (was 5), +10 HP per level (was 16), +3 HP per STR (was 4), +2 MP per level (was 4). Skill ranks scale harder instead (v0.2).

14. **Pickup animation:** loot pops up, then flies to you (same bounce-y feel as a drop). The toast with the icon and quantity appears when it arrives.
15. **Gear instances and ranges:** gear no longer stacks. Each piece rolls `defense` / `weapon_damage` from the sheet's min/max when it drops or is bought, and those rolls are saved on the item. The preview shows the rolled value, the range, and a low / avg / high quality color. Materials, currency, consumables and junk still stack. Old saves are migrated (equipped and bag gear become mid-roll, non-magic instances).
16. **More Meadows gear, split pools:** each class has a Hide (Warrior) / Linen (Mage) / Trail (Rogue) armor set plus a mid weapon (Meadow Blade, Grove Staff, Bone Knife). Each mob has its own pool — e.g. mice drop gloves, sheep drop vests and pants, crows drop caps, boots and the mid weapons. Shop cloth is a weaker stepping-stone.
17. **Impactful full set:** at level 1 with 0 points, a mid-roll Meadows drop set (Meadow Blade 14×1.15 + Hide armor, defense 10) is **+45% attack** and takes **~56% less** from a Crow vs basic (Wooden Sword, no armor). Hide and the Blade need 3 STR. Steel stays ultra-rare and above this. Skill training is still the main power-up. Numbers are in `assumptions.ts` and on the gear tab.
18. **Magic gear:** about 1/12 of gear drops (and shop rolls) come out magic, with a plain prefix (Sturdy, Keen, Bright, Swift, Hearty, …) and 1–2 extra bonuses (STR/INT/AGI/SPI, accuracy, crit, HP/MP, regen) rolled from ranges. Blue name and a ✦ on the tile. Category infusion is later (Pitch Book B-003).
19. **Console `whodrops <item>`:** lists every monster (and area) that drops it, with chance and quantity range. Partial names work (`whodrops hide`). It is in `help` and does not mark the save as cheated.


## What's new in v0.2 (skill training)

- **Calden** trains skills (E), and **K** opens the same window anywhere. Keyboard-first tile UI, consistent with the shop: arrows, Enter to learn/train, 1-4 to bind a known skill, Esc to close. Preview shows the next-rank effect and the material + essence + coin cost (have / need).
- **Warrior, all 5 sheet skills** (the sheet lists 5 per class, not 6):
  - Power Strike and Rage are known at rank 0. Training rank 1+ costs 30 Monster Essence, 5 Training Scrolls and 20 Copper (× 1.6 each further rank).
  - Earthbreaker (Nature, lv 3 + 5 STR): 150% AoE slam + stun. Flame Cleave (Elemental, lv 6 + 10 STR): 200% wide swing + 3s burn (35% of the hit as DoT). Soul Guard (Spiritual, lv 8 + 15 STR): a shield absorbing 18% of max HP for 20s.
  - Category skills are learned at rank 1 (base value) and auto-bind to the first empty hotbar slot; they scale from rank 2.
- **Rank scaling** (v0.1.2 numbers): basic +5% / rank, nature +12%, elemental +10%, spiritual +10%. Damage skills add that many percentage points of the attack multiplier; buffs and the shield grow as effect × (1 + N% × ranks).
- Rares (Heartwood, crystals, shards) are only required at ranks 5 and 10.
- Mage and Rogue skills exist as sheet data (costs, icons, unlocks) but are not playable yet — there is no class select.
- Passive-tree production and Ila's 10:1 essence exchange are still later.

Console: `rank <skill> [n]` sets a rank (cheat); `train <skill>` pays the real cost.


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

- Meadow Town (safe hub): Mara's shop (buys and sells per the `npc_shop` rules), Pell (hint, plus the first starter quest "A First Step" as a one-time reward), Calden (skill trainer — E opens the training window, also available anywhere with K), and Ila (essence exchange, later). East gate to Sunny Pasture.
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
| `item <id> [qty] [magic]` | Add an item (gear becomes a rolled instance; add `magic` to force a magic roll) |
| `whodrops <item>` | List monsters and areas that drop it, with chance and qty (partial names ok; not a cheat) |
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
| `rank <skill> [n]` | Set a skill rank (default +1) |
| `train <skill>` | Pay the real cost and train the next rank |
| `reset` | Erase the save and reload |

## Combat-feel stats (not in the sheet yet)

These live in `src/data/assumptions.ts` (`HIT`, `HIT_MONSTER`, `PLAYER_ACC`, `PLAYER_EVA`, `MONSTER_FEEL`, `RANGED`, `ATTACK_FEEL`, `PLAYER_HIT_KB`, `AI`, `REGEN`, `LOOT`) and are candidates for new sheet columns:

- **Hit chance:** clamp(base + (acc − eva) × k + (attacker level − defender level) × L, min, max)%.
  - Player attacks (`HIT`): base 85, k 1.5, L 2, 50-98% (≈90% at parity).
  - Monster attacks (`HIT_MONSTER`): base 78, k 1, L 3.5, 40-95% (≈77-79% at parity).
- **Player:** accuracy = 10 + AGI + 0.5 × level; evasion = 8 + 0.8 × AGI + 0.5 × level.
- **Monsters** (acc / eva / knockback resistance / contact reach / wind-up range):
  - Field Mouse: 8 / 7 / 0.0 / 4px / 250-550ms.
  - Wool Sheep: 9 / 6 / 0.6 / 4px / 320-600ms.
  - Crow (ranged): 10 / 10 / 0.2 / keeps 150-230px, fires within 300px / 400-600ms; pebble 150 px/s, cooldown 2.2-3.6s.
- **Speeds:** mouse 28, sheep 20, crow 38 px/s (chase ×1.6). Player 190 px/s, jump 435 px/s (≈73px).
- **Knockback and hitstun:** basic 420 px/s, 320ms; Power Strike 1080 px/s, 500ms; Earthbreaker 600, 900ms; Flame Cleave 700, 450ms; Rage none. Hitstun × (1 − kbRes × 0.5). The player is pushed 170 px/s when hit.
- **AI:** recover 150-450ms after a swing, then back off (45%), hop over (35%) or pause (20%). 15% of melee wind-ups are feints. Reposition 550-1100ms, pause 250-800ms, hesitation 0-500ms.
- **HP regen:** 0.5% max HP/s after 5s out of combat, × (1 + 0.02 × SPI).
- **Drop quantity:** roll = min + floor(r^1.8 × (max − min + 1)). Drop multiplier ×: max_qty × (1 + 0.5 × (× − 1)), overflow above 100% chance = bonus roll.

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
