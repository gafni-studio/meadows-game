# Meadows: working notes for Claude

A Phaser 3 + TypeScript + Vite browser game. Oded playtests; his notes become a spec in `planning/vX.Y.Z.md`; you implement it.

## Release workflow (do this, in this order)

1. `git pull origin main`, read `planning/vX.Y.Z.md`. Specs give design and numbers, not implementation: interpret, and ask only when something is truly unclear or conflicts with the game.
2. Implement. Data changes go straight into `data/*.json` (see Data). No sheet patch scripts.
3. Add or adjust a **fast test** only where you changed *logic* (quests, rules, data invariants). One short case per new rule.
4. Visual change? Run `npm run build && npm run shots -- <skill|slash>` and look at the one contact sheet per skill. Otherwise skip visual checks: feel is for playtesting.
5. `npm run verify` (typecheck + tests + build + boot smoke, ~30 s). It must pass.
6. Bump `"version"` in `package.json` to the release, write `docs/vX.Y.Z.md` (plain words per spec section + judgment calls; short) and add a section at the top of `CHANGELOG.md`.
7. Commit on the session branch, then release: `git push origin HEAD:<branch>` and `git push origin HEAD:main` (fast-forward; `main` is what deploys to Netlify). You cannot reach the live site from the sandbox; say so, and point to `https://meadows-gafni.netlify.app/version.json`.

Do not run long manual playthroughs, write one-off browser scripts, or re-read whole big files when `grep` will do.

## Commands

| | |
| --- | --- |
| `npm test` | fast logic tests in Node (Vitest), ~1 s |
| `npm run check` | `tsc` + tests |
| `npm run verify` | check + build + boot smoke. Run before every release |
| `npm run smoke` | boot smoke only (needs a build): boots, opens I/C/K/J/T, talks to Pell, fights. ~15 s |
| `npm run shots -- slash fire_bolt` | contact sheet per attack in `shots/` (needs a build) |
| `npm run sheet:export` | `data/*.json` → `sheet/Game_Design_DB_v0.xlsx` (for sharing) |
| `npm run sheet:import -- --yes` | xlsx → JSON. Overwrites the JSON; only when someone edited the sheet on purpose |

## Where things live

| File | Owns |
| --- | --- |
| `data/*.json` | **all tabulated design**: items, monsters, drops, skills, skill/passive costs, gear, quests (`skill_quests`), dialogue (`quest_dialogue`), NPCs, paths, map spawns, formulas (`combat_formulas`: HP, XP) |
| `src/data/db.ts` | typed access to the JSON; derives `num`, `spawns`, `links` at load |
| `src/data/assumptions.ts` | numbers the sheet never had: cooldowns, mob speed/range/AI, contact, affinity table, projectiles (`BOLT`), knockback, loot skew |
| `src/systems/Quests.ts` | quest engine (see Quest engine) |
| `src/systems/Player.ts` | stats, HP/MP, attack / magicAttack, XP, inventory, gear, bag slots |
| `src/systems/Skills.ts` | training, costs, Paths rules (chain, node state, `TREE_LAYOUT`), rank scaling |
| `src/systems/Bar.ts` | equip slots: attack 0-3 (keys 1-4), buff 4-5 (5-6), potion 6-7 (Q/G) |
| `src/systems/Passives.ts` | passive trees, production, upgrades |
| `src/systems/Loot.ts`, `Combat.ts`, `Gear.ts` | drops (cap 3 except Copper), damage / hit / affinity, gear rolls |
| `src/scenes/WorldScene.ts` (1100 lines) | world, input, combat resolution, projectiles, NPC markers, drops. `grep` for the method you need |
| `src/entities/Monster.ts` | mob AI: patrol, aggro, give-up, ledge jump, leash, windup/strike |
| `src/systems/CombatFx.ts` | every attack/skill visual. Damage fires from inside the animation via `onImpact` |
| `src/ui/Hud.ts` (1300 lines) | DOM HUD and all windows (`render<Panel>()`), keys, dialogue, rewards screen |
| `src/world/areas.ts` | area geometry: platforms, NPC positions, portals, spawn zones |
| `tests/` | `data.test.ts` (invariants), `rules.test.ts`, `quests.test.ts` (flows simulated in Node) |

## Keep files small (split as you go)

`src/ui/Hud.ts` and `src/scenes/WorldScene.ts` are too big (1,100-1,300 lines): reading them costs more than the change itself. **Whenever a release touches one of them, split out the piece you are changing in the same release**, then leave the file smaller than you found it. Do not do a separate big-bang refactor.

Rules:
- Target **under ~400 lines per file**; one responsibility per file. If you add more than ~50 lines to a file already over 500, put it in a new module instead.
- **Hud.ts** → `src/ui/panels/<panel>.ts`, one file per window (`inventory`, `stats`, `shop`, `storage`, `skills` (Paths tree), `journal`, `passives`, `exchange`, `dialog`, `rewards`, `pause`). Each exports `render(ctx)` and, if needed, its key and click handlers; `Hud.ts` keeps only the shell: panel stack, key routing, HUD bar, hotbar, toasts, console.
- **WorldScene.ts** → `src/scenes/world/<system>.ts`: `combat.ts` (swings, strikes, skill hits, burns), `projectiles.ts` (Magician bolts, mob shots), `npcs.ts` (NPCs, markers, interaction), `drops.ts` (spawn, pickup), `player.ts` (input, regen, death). Plain functions that take the scene (`scene: WorldScene`) are fine; no new framework.
- **Quests.ts** (750 lines) → when next touched: `quests/maps.ts` (the step-mechanic maps), `quests/talk.ts` (conversations, markers), `quests/journal.ts`.
- **CombatFx.ts** (750 lines) → `fx/<family>.ts` (melee, fire, nature, lightning, ward, shared helpers) when next touched.
- A split is a **pure move**: no behavior change in the same commit as the move. `npm run verify` must pass before and after, and keep every export reachable (re-export from the old file if other code imports it).
- Update the "Where things live" table in this file in the same commit, so the next turn can open the right small file directly.

## Data

- One file per tab: `{ tab, note, columns, rows }`. Edit rows directly (a small `node -e` script for bulk edits). Keep `note` updated with a one-line `vX.Y.Z:` change note.
- Player-facing text goes in `desc` / dialogue; design reasoning goes in `notes`. Player text is short. The character is the **Hero** (internal class id stays `warrior`).
- New item: a row in `items` (+ `gear` if equippable) and an icon `public/art/icons/<id>.png` (a data test fails without it).
- Recipes: explicit per rank 1-10, 10-40 per material, family essence is the main cost, no Heartwood/Log (tests enforce it).

## Quest engine (`Quests.ts`)

Rows in `skill_quests` give line, step, objective, giver, gates and final rewards; `quest_dialogue` gives the pages (`line:step:ok|wait|done|need|gate`, `line:0:start` for talk-started quests). The mechanics of each step are maps keyed `"line:step"`:

`TALKSTEP` (a conversation finishes the step) · `ACTION` (player action via `onAction`) · `DUMMY` (post hits) · `REACH` (area / x range) · `HUNT` (kills) · `COLLECT` (items consumed at turn-in) · `PREVIEW` (items shown before turn-in) · `KILL` (named foe) · `WAIT_ONLY` · `GIFT` (small step gifts → rewards screen) · `AUTO_START` (line starts when a condition holds) · `TALK_START` (Calden offers it) · `ITEM_START` · `STEP1_ITEM`.

To add a quest: rows in `skill_quests`, pages in `quest_dialogue`, entries in the maps above, one case in `tests/quests.test.ts`. Markers (`!` / `?`), the journal, the tracker and rewards all derive from the same maps.

## Traps (each one cost a debugging round once)

- Phaser groups: never `group.getChildren().forEach(d => d.destroy())`. It skips every other child. Copy first: `[...group.getChildren()]`.
- `E` both talks/picks up in the world and closes NPC windows; drops on the ground take priority over NPCs.
- `barOf()` re-sorts skills into their slot group on every call: a buff can never sit in an attack slot.
- Quest completion shows a banner, then the rewards screen ~1.1 s later; step gifts show it at once.
- Hit-stop pauses tweens but not timers. Time damage from inside an animation (`onImpact`), not with `delayedCall`.
- Timed buffs and cooldowns use `Date.now()` (`Game.buffs`, `Game.cooldowns`), not the scene clock.
- The sandbox cannot reach the live site or Netlify.

## Test hooks

`window.__state` (= `Game`: player, scene, buffs, cooldowns), `window.__game` (Phaser), `window.__version`. The in-game console (backtick) has `level`, `item`, `copper`, `quest complete <line>`, `tp`, `spawn`, `god`, `passive rank|wait|finish`; see README.

## Code style

TypeScript strict; match the surrounding code. Comments say *why*, with a short `vX.Y.Z:` tag when a spec drove the change. No new dependencies without a reason.
