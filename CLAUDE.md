# Meadows: working notes for Claude

**Start every session by reading `STATUS.md` (live version, what is in flight, next step). End every session by updating it.**

A Phaser 3 + TypeScript + Vite browser game. Oded playtests; his notes become a spec in `planning/vX.Y.Z.md`; you implement it.

## Release workflow (do this, in this order)

1. `git pull origin main`, read `planning/vX.Y.Z.md`. Specs give design and numbers, not implementation: interpret, and ask only when something is truly unclear or conflicts with the game.
2. Implement. Data changes go straight into `data/*.json` (see Data). No sheet patch scripts.
3. Add or adjust a **fast test** only where you changed *logic* (quests, rules, data invariants). One short case per new rule.
4. Visual change? Run `npm run build && npm run shots -- <skill|slash>` and look at the one contact sheet per skill. Otherwise skip visual checks: feel is for playtesting.
5. `npm run verify` (typecheck + tests + build + boot smoke, ~30 s). It must pass.
6. Bump `"version"` in `package.json` to the release, write `docs/vX.Y.Z.md` (plain words per spec section + judgment calls; short) and add a section at the top of `CHANGELOG.md`.
7. Update `STATUS.md` (live version, in flight, next step, any new gaps).
8. Commit on the session branch, then release: `git push origin HEAD:<branch>` and `git push origin HEAD:main` (fast-forward; `main` is what deploys to Netlify). You cannot reach the live site from the sandbox; say so, and point to `https://meadows-gafni.netlify.app/version.json`.

Do not run long manual playthroughs, write one-off browser scripts, or re-read whole big files when `grep` will do.

## Commands

| | |
| --- | --- |
| `npm test` | fast logic tests in Node (Vitest), ~1 s |
| `npm run check` | `tsc` + tests |
| `npm run verify` | check + build + boot smoke. Run before every release |
| `npm run smoke` | boot smoke only (needs a build): boots, opens I/C/K/J/T, talks to Pell, fights. ~15 s |
| `npm run shots -- slash fire_bolt` | contact sheet per attack in `shots/` (needs a build); `-- areas` one sheet per area (`AREA=id` for one) |
| `npm run sheet:export` | `data/*.json` → `sheet/Game_Design_DB_v0.xlsx` (for sharing) |
| `npm run sheet:import -- --yes` | xlsx → JSON. Overwrites the JSON; only when someone edited the sheet on purpose |
| `npm run studio` / `studio:build` | Animation Studio dev server (port 5180) / static build in `studio/dist` (GitHub Pages) |

## Where things live

| File | Owns |
| --- | --- |
| `data/*.json` | **all tabulated design**: items, monsters, drops, skills, skill/passive costs, gear, quests (`skill_quests`), dialogue (`quest_dialogue`), NPCs, paths, map spawns, formulas (`combat_formulas`: HP, XP) |
| `src/data/db.ts` | typed access to the JSON; derives `num`, `spawns`, `links` at load |
| `src/data/assumptions.ts` | numbers the sheet never had: cooldowns, mob speed/range/AI, contact, affinity table, projectiles (`BOLT`), knockback, loot skew |
| `src/systems/Quests.ts` | quest engine (see Quest engine): start/advance/complete, talk, markers, journal |
| `src/systems/quests/maps.ts` | the step-mechanic maps (`TALKSTEP`, `HUNT`, `COLLECT`, `REACH`, `AUTO_START`, ...) |
| `src/systems/quests/state.ts` | quest state per line (`state`, `isDone`, `isActive`, `setState`) |
| `src/systems/Player.ts` | stats, HP/MP, attack / magicAttack, XP, inventory, gear, bag slots |
| `src/systems/Skills.ts` | training, costs, Paths rules (chain, node state, `TREE_LAYOUT`), rank scaling |
| `src/systems/Bar.ts` | equip slots: attack 0-3 (keys 1-4), buff 4-5 (5-6), potion 6-7 (Q/G) |
| `src/systems/Passives.ts` | passive trees, production, upgrades |
| `src/systems/Loot.ts`, `Combat.ts`, `Gear.ts` | drops (cap 3 except Copper), damage / hit / affinity, gear rolls |
| `src/scenes/WorldScene.ts` (900 lines) | scene shell, combat resolution, Magician bolts, drops. `grep` for the method you need |
| `src/scenes/world/terrain.ts` | sky, parallax, ground, blocks, water, decor, platforms, climbs, chest, post, portals |
| `src/scenes/world/npcs.ts` | NPC sprites, quest markers, named quest foes |
| `src/scenes/world/player.ts` | walk/jump/attack/hotbar input, climbing, drop-through, slopes, regen, death |
| `src/scenes/world/ambient.ts` | area ambience: Whisperwood fog/shafts/fireflies/bog, hill wind, river, cave |
| `src/scenes/world/projectiles.ts` | mob projectiles |
| `src/entities/Monster.ts` | mob AI: patrol, aggro, give-up, ledge jump, leash, windup/strike |
| `src/entities/mobs/kinds.ts` | movement kinds: ledge-bound, hover (Wisp), hop (Toad, Thornling), ambush (Lurker), camp, slopes |
| `src/entities/mobs/looks.ts` | Whisperwood mob idle / wind-up / strike / hit / death visuals |
| `src/entities/mobs/HollowStag.ts` | the Hollow Stag's own AI (charge, sweep, root stomp, phase 2, death) |
| `src/entities/mobs/index.ts` | `createMonster` (Stag or Monster) |
| `src/systems/CombatFx.ts` | every attack/skill visual. Damage fires from inside the animation via `onImpact` |
| `src/ui/Hud.ts` (1120 lines) | DOM HUD and all windows (`render<Panel>()`), keys, dialogue, rewards screen |
| `src/ui/panels/npc.ts` | E on an NPC: quest talk, else their window, else a greeting |
| `art-direction/chibi/` | target art: style and hero sheets, mob, NPC and item sheets, art briefs (rules in `art-direction/README.md`, plan in `planning/art-plan.md`) |
| `src/ui/panels/skills.ts` | the Paths window (K): tabs, equip bar, skill tree, skill preview, farm-list button, ready glow |
| `src/ui/panels/journal.ts` | the journal (J) and its quest preview with count lines |
| `src/ui/panels/tracker.ts` | the objectives panel (L): quest lines, count lines, ready-to-turn-in, farm entries |
| `src/systems/Farm.ts` | farm list (skill next-rank recipes as objectives) and ready-to-train |
| `src/scenes/world/slap.ts` | Mara's slap visual (Welcome to Meadow Town) |
| `src/world/areas.ts` | area geometry: height, solid blocks, one-way platforms, climbs, water, NPCs, portals, per-level spawn zones |
| `src/world/surface.ts` | pure geometry queries: ground height, ledge spans, zone bounds, spawn split, slope step-up |
| `tests/` | `data.test.ts` (invariants), `rules.test.ts`, `quests.test.ts` (flows simulated in Node), `anim.test.ts` (rigs, IK, clip sampling) |
| `studio/` | Meadows Animation Studio (web tool on GitHub Pages): pose rigged assets, time keys, save clips. See `studio/README.md` |
| `rigs/<asset>/` | `cut.py` (parts from the art sheet) → `atlas.png`, `atlas.json`, `rig.json`; listed in `rigs/index.json` |
| `animations/<asset>.json` | animation clips, **written by the studio only** |
| `src/anim/rig.ts`, `clip.ts` | shared by studio and game: rig FK, 2-bone IK, springs; clip sampling and events |

## Keep files small (split as you go)

`src/ui/Hud.ts` and `src/scenes/WorldScene.ts` are too big (1,100-1,300 lines): reading them costs more than the change itself. **Whenever a release touches one of them, split out the piece you are changing in the same release**, then leave the file smaller than you found it. Do not do a separate big-bang refactor.

Rules:
- Target **under ~400 lines per file**; one responsibility per file. If you add more than ~50 lines to a file already over 500, put it in a new module instead.
- **Hud.ts** → `src/ui/panels/<panel>.ts`, one file per window (`inventory`, `stats`, `shop`, `storage`, `skills` (Paths tree), `journal`, `passives`, `exchange`, `dialog`, `rewards`, `pause`). Each exports `render(ctx)` and, if needed, its key and click handlers; `Hud.ts` keeps only the shell: panel stack, key routing, HUD bar, hotbar, toasts, console.
- **WorldScene.ts** → `src/scenes/world/<system>.ts`: `combat.ts` (swings, strikes, skill hits, burns), `projectiles.ts` (Magician bolts, mob shots), `npcs.ts` (NPCs, markers, interaction), `drops.ts` (spawn, pickup), `player.ts` (input, regen, death). Plain functions that take the scene (`scene: WorldScene`) are fine; no new framework.
- **Quests.ts** (650 lines) → maps and state are split out (`quests/`); next: `quests/talk.ts` (conversations, markers), `quests/journal.ts`.
- **CombatFx.ts** (750 lines) → `fx/<family>.ts` (melee, fire, nature, lightning, ward, shared helpers) when next touched.
- A split is a **pure move**: no behavior change in the same commit as the move. `npm run verify` must pass before and after, and keep every export reachable (re-export from the old file if other code imports it).
- Update the "Where things live" table in this file in the same commit, so the next turn can open the right small file directly.

## Data

- One file per tab: `{ tab, note, columns, rows }`. Edit rows directly (a small `node -e` script for bulk edits). Keep `note` updated with a one-line `vX.Y.Z:` change note.
- Player-facing text goes in `desc` / dialogue; design reasoning goes in `notes`. Player text is short. The character is the **Hero** (internal class id stays `warrior`).
- New item: a row in `items` (+ `gear` if equippable) and an icon `public/art/icons/<id>.png` (a data test fails without it).
- **Art direction is basic chibi:** follow `art-direction/README.md` and `planning/art-plan.md`. The source sheets are in `art-direction/chibi/`, and art briefs live next to them (for example `art-direction/chibi/rig-brief.md`). The current in-game art is placeholder: Kenney CC0 via `scripts/build-art.py`, plus `scripts/draw-art-v030.py` / `v031.py`. Use those scripts only for stand-ins until the chibi art is ported. Sprite slots and frame sizes live in `src/art/sprites.ts`.
- **Animation: Claude never authors poses.** Per asset, Claude cuts the parts and builds the rig (`rigs/<asset>/cut.py`, `rig.json`, an entry in `rigs/index.json`). Oded poses and times every clip in the Animation Studio (`studio/`), which commits `animations/<asset>.json`. Do not hand-edit that file.
- Recipes: explicit per rank 1-10, 10-40 per material, family essence is the main cost, no Heartwood/Log (tests enforce it).

## Quest engine (`Quests.ts`, maps in `quests/maps.ts`)

Rows in `skill_quests` give line, step, objective, giver, gates and final rewards; `quest_dialogue` gives the pages (`line:step:ok|wait|done|need|gate`, `line:0:start` for talk-started quests). The mechanics of each step are maps keyed `"line:step"`:

`TALKSTEP` (a conversation finishes the step) · `BAG_ADVANCE` (moves on once the `PREVIEW` items are in the bag) · `ACTION` (player action via `onAction`) · `DUMMY` (post hits) · `REACH` (area / x range) · `HUNT` (kills; with `COLLECT` on the same step, items too) · `COLLECT` (items consumed at turn-in) · `PREVIEW` (items shown before turn-in) · `KILL` (named foe) · `WAIT_ONLY` · `GIFT` (small step gifts → rewards screen) · `AUTO_START` (line starts when a condition holds) · `TALK_START` (Calden offers it) · `ITEM_START` · `STEP1_ITEM`.

To add a quest: rows in `skill_quests`, pages in `quest_dialogue`, entries in the maps above, one case in `tests/quests.test.ts`. Markers (`!` / `?`), the journal, the tracker and rewards all derive from the same maps.

## Traps (each one cost a debugging round once)

- Phaser groups: never `group.getChildren().forEach(d => d.destroy())`. It skips every other child. Copy first: `[...group.getChildren()]`.
- `E` both talks/picks up in the world and closes NPC windows; drops on the ground take priority over NPCs.
- `barOf()` re-sorts skills into their slot group on every call: a buff can never sit in an attack slot.
- Quest completion shows a banner, then the rewards screen ~1.1 s later; step gifts show it at once.
- Hit-stop pauses tweens but not timers. Time damage from inside an animation (`onImpact`), not with `delayedCall`.
- Timed buffs and cooldowns use `Date.now()` (`Game.buffs`, `Game.cooldowns`), not the scene clock.
- The sandbox cannot reach the live site or Netlify.
- v0.3.0 vertical areas: `scene.groundY` is the *base* ground at the bottom of a taller world. The floor under x can be a block (`groundAt` in `world/surface.ts`); spawn and arrive with it, never at `groundY` blindly.
- A ledge spawn zone (`y` set) makes a ledge-bound mob: it never walks off and gives up when you leave its level. Give a named foe on a ledge a `y` too.

## Test hooks

`window.__state` (= `Game`: player, scene, buffs, cooldowns), `window.__game` (Phaser), `window.__version`. The in-game console (backtick) has `level`, `item`, `copper`, `quest complete <line>`, `tp`, `spawn`, `god`, `passive rank|wait|finish`; see README.

## Code style

TypeScript strict; match the surrounding code. Comments say *why*, with a short `vX.Y.Z:` tag when a spec drove the change. No new dependencies without a reason.
