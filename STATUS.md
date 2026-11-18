# Status

Read this first, then `CLAUDE.md`. **End every session by updating this file** (live version, what is in flight, open issues, next step).

## Live
- **v0.3.1** on `main`: playtest fixes, west of town. Check the live build at https://meadows-gafni.netlify.app/version.json (it should show `0.3.1`). The sandbox cannot reach the site, so a human confirms deploys.
- Health: `npm run verify` passes (51 logic tests ~1 s, boot smoke ~18 s; it visits every area incl. Sunny Pasture and climbs a ladder).

## What the game is now
Hero (internal id `warrior`) walks two Paths: Warrior (Power Strike → Earthbreaker → Root Lash / Flame Cleave; Dig In; Rage) and Magician (Magic Bolt → Mana Shield → Fire Bolt / Thorn Volley → Chain Spark). Trees are hidden until their Path quest is done; finishing one opens its tree once with the first skill pulsing. Areas, left to right: **Sunny Pasture (3–5) → Meadow West (1–3, mirrored, mice by the gate) → Meadow Town (west + east gates; Pell at the west gate) → Meadow East (hills: crows/sheep, Boars on terraces, one Angry Bull in the grove) → Dirt Banks West → Dirt Banks East**; Whisperwood (5–10) north of Meadow East's grove. New Heroes go west first. Welcome to Meadow Town is ten steps (Mara's 18 HP slap, no chest steps). Objectives show count lines; a green farm list; affordable skill nodes glow. Spirit skills, Soul Guard, the Meadow Shrine, the Old Stump (no spawn), Night Stump and Frost Moth stay parked.

## In flight
- **Meadows Animation Studio** (`studio/`, `studio/README.md`) on branch `claude/festive-babbage-bdzucw`, not merged yet. It is a web tool for GitHub Pages: pose the hero rig (`rigs/hero/`) key by key, set per-key timing and blend, preview the looping clip, save to `animations/hero.json` through the GitHub API (or Download). The idle, run and combo clips start at the rest pose; **Oded poses them**. Claude only cuts parts and builds rigs from now on, never poses. Pages goes live once the branch is merged to main and Pages is set to "GitHub Actions" in the repo settings.
- **Town NPC rigs** for the studio: Pell, Mara, Calden (`rigs/npc_cut.py`), each with a still body, a head with `blink` and `talk` pictures (a new studio feature: per-key part pictures), and two arms with IK. Calden holds his sword and Pell his staff. Starting clips are idle and talk, for Oded to pose. Known gap: the body behind a raised arm is filled in from flat colours, which is rough on Calden (behind the sword and arm). Ila and Tamsin can be added the same way.
- Rig pass 1 (`art-direction/chibi/rig-pass-1/`) stays as the reference for the first rig; its hand-made poses are superseded by the studio.
- v0.3.1 is released; waiting for Oded's playtest notes.

## Next
- Playtest v0.3.1: Boar and Angry Bull timings (`MONSTER_FEEL` / `MOB_KIND` in `assumptions.ts`), Sunny Pasture pacing 3–5, the slap, farm list and tracker readability.
- The plan's next release: more Whisperwood maps (deeper, harder), where the Old Stump returns as a boss.
- Split big files piecemeal when a release touches them (see CLAUDE.md "Keep files small"): `Hud.ts` ~1.15k lines (Paths window and journal moved out in v0.3.1), `WorldScene.ts` 950, `Quests.ts` 750, `CombatFx.ts` 750.

## Known gaps and judgment calls worth remembering
- v0.3.1: id `meadow_boar` is now `angry_bull`; the new mob is `boar`. Boar art is original (`scripts/draw-art-v031.py`); the Angry Bull is the old boar sprite recoloured. Wildflowers in Sunny Pasture are not drawn yet (no flower decor slot).
- v0.3.1: the `sunny_pasture` save alias is gone (it is a real area again); intro saves past the removed chest steps are renumbered once (`questFlags.intro_v031`).
- All in-game art is placeholder until the chibi art (`art-direction/chibi/`, `planning/art-plan.md`) is ported. Older stand-ins: Tamsin's sprite (a recolour of Ila's), Wren's (a recolour of Pell's), the Club and Chain Spark icons. v0.3.0 mob/decor art is original, from `scripts/draw-art-v030.py`.
- v0.3.0: Moss Lurker, Mire Toad and Stag timings are first guesses.
- v0.3.0: an NPC with several active quests leads with the conversation that moves one forward; a "not yet" only when nothing is ready.
- Old saves in Dirt Banks load into Dirt Banks West (`AREA_ALIAS`).
- v0.2.6 open questions, answered by Oded: Hero HP (100 + 7/level) is fine; late-rank recipes (3-10, Dirt Banks goods only) stay as they are and will be reworked when more content arrives.
- Pell's quest marker was reported missing in v0.2.7 and could not be reproduced; it is covered by tests. If it recurs, get the exact step from Oded.
- The Cracked Stone and Ember in the Scale start by talking to Calden (`!`); the first Burrow Mole (level 5+) / Ember Beetle (level 6+) kill drops the needed item once.
- The in-game `droprate` console cheat bypasses the 3-per-kill cap on purpose.
- Old saves (before v0.2.9) are migrated in `migrateQuests` / `migrateBar`; keep those paths working when changing quests or slots.
