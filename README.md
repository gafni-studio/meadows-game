# Meadows

A 2D side-scrolling browser MMORPG prototype (MapleStory-style real-time grinding, later Travian-style offline growth). A single-player slice of the Meadows zone: **Meadow Town**, **Meadow West** (levels 1–3), hilly **Meadow East** (3–7, the Old Stump at 10), the **Dirt Banks** West (river) and East (cave), and the misty **Whisperwood** (5–10, the Hollow Stag). The Hero walks Paths (Warrior, Magician).

Stack: **Phaser 3 + TypeScript + Vite**. Save in `localStorage`. In-game art is CC0 pixel-art placeholder (see [CREDITS.md](CREDITS.md)). The target look is basic chibi: see [art-direction/README.md](art-direction/README.md) and [planning/art-plan.md](planning/art-plan.md).

- Live build: https://meadows-gafni.netlify.app (which version is live: `/version.json`, also shown in the HUD help line)
- What changed in each release: [CHANGELOG.md](CHANGELOG.md) · release write-ups in `docs/` · specs in `planning/`
- Working on the code (and Claude's workflow): [CLAUDE.md](CLAUDE.md)

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # fast logic tests (~1 s, no browser)
npm run verify     # typecheck + tests + build + boot smoke (~30 s) — run before every release
```

Add `?canvas` to the URL to force the Canvas renderer.

## Controls

| Action | Keys |
| --- | --- |
| Move | **A / D** or **← / →** |
| Jump | **Space** or **↑** |
| Attack (basic swing, 100%) | **F** (hold to keep swinging) |
| Attack skills (4 slots) | **1 – 4** (Power Strike starts in 1) |
| Buff skills (2 slots) | **5 / 6** (Rage, Dig In once learned) |
| Paths: skill tree, train, equip (1–4 attacks, 5–6 buffs) | **K** (or E at Calden) |
| HP potion slot (bind any HP drink or food from the bag with Q) | **Q** |
| MP potion slot (bind from the bag with G) | **G** |
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

**Why these keys:** no modifier keys are used, so gameplay can't trigger browser shortcuts (Ctrl+W closes the tab, etc.). Phaser calls `preventDefault` on every bound key, and a small guard blocks stray Ctrl+letter page shortcuts (Ctrl+S, Ctrl+P, ...). The hotbar is 1–6 (skills or consumables); Q and G still fire slots 5 and 6, instead of the sheet's Q/R potion keys.



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
| `tp <area>` | Teleport: `meadow_town`, `meadow_west`, `meadow_east`, `dirt_banks_west`, `dirt_banks_east`, `whisperwood` |
| `spawn <monsterId> [n]` | Spawn monsters next to you (e.g. `spawn crow 3`) |
| `droprate <x>` | Multiply all drop chances (1 = normal) |
| `rank <skill> [n]` | Set a skill rank (default +1) |
| `train <skill>` | Pay the real cost and train the next rank |
| `reset` | Erase the save and reload onto a fresh character (no confirm; menu New game asks first) |

## Design data

`data/*.json` is the source of truth (one file per tab: `{ tab, note, columns, rows }`); edit it directly. `npm run sheet:export` writes `sheet/Game_Design_DB_v0.xlsx` for sharing. If someone edited that xlsx on purpose, `npm run sheet:import -- --yes` reads it back (this overwrites the JSON). Prototype numbers the sheet never defined (cooldowns, speeds, AI timings, projectile and contact values) live in `src/data/assumptions.ts`.

## Art

All visuals go through **`src/art/sprites.ts`**, a registry of named slots with fixed logical sizes; game logic only references slot keys, so art can be swapped by replacing files. `python3 scripts/build-art.py` (Pillow) builds `public/art/` from the vendored CC0 tiles in `art-src/`. Item icons are `public/art/icons/<item_id>.png`, skill icons `skill_<id>.png`, NPCs `public/art/chars/npc_<id>.png`.

That pipeline (and `scripts/draw-art-v030.py` / `v031.py`) produces **placeholder** art. The art direction is **basic chibi** (MapleStory-like): style rules in [art-direction/README.md](art-direction/README.md), the pipeline and asset index in [planning/art-plan.md](planning/art-plan.md), and the generated sheets in `art-direction/chibi/`. The new art replaces the placeholders as it is rigged and ported.
