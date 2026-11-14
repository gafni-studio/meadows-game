# Status

Read this first, then `CLAUDE.md`. **End every session by updating this file** (live version, what is in flight, open issues, next step).

## Live
- **v0.2.9** on `main` (+ workflow/tooling commits since). Check the live build at https://meadows-gafni.netlify.app/version.json (it shows `0.2.9`). The sandbox cannot reach the site, so a human confirms deploys.
- Health: `npm run verify` passes (34 logic tests ~1 s, boot smoke ~15 s). GitHub Actions runs the same on every push; its first run has not been seen from the sandbox.

## What the game is now
Hero (internal id `warrior`) walks two Paths: Warrior (Power Strike → Earthbreaker → Root Lash / Flame Cleave; Dig In; Rage) and Magician (Magic Bolt → Mana Shield → Fire Bolt / Thorn Volley → Chain Spark). Trees are hidden until their Path quest is done. A new Hero plays Welcome to Meadow Town, then Path of the Warrior (Calden), then Path of the Magician (Tamsin, once Power Strike is trained). Other quests appear by level. Areas: Meadow Town, Sunny Pasture, Dirt Banks. Spirit skills, Soul Guard and the Meadow Shrine stay parked.

## In flight
Nothing. The last two commits were tooling only (tests, CLAUDE.md, file-split rule).

## Next
- **v0.3.0: Whisperwood** (the next area, levels 5–10) is the next planned release; no spec file exists yet. Wait for `planning/v0.3.0.md` from Oded's notes.
- Split big files piecemeal when a release touches them (see CLAUDE.md "Keep files small"): `Hud.ts` 1.3k lines, `WorldScene.ts` 1.1k, `Quests.ts` 750, `CombatFx.ts` 750.

## Known gaps and judgment calls worth remembering
- Placeholder art: Tamsin's sprite (a recolour of Ila's), the Club and Chain Spark icons.
- v0.2.6 open questions, answered by Oded: Hero HP (100 + 7/level) is fine; late-rank recipes (3-10, Dirt Banks goods only) stay as they are and will be reworked when more content arrives.
- Pell's quest marker was reported missing in v0.2.7 and could not be reproduced; it is covered by tests. If it recurs, get the exact step from Oded.
- The Cracked Stone and Ember in the Scale start by talking to Calden (`!`); the first Burrow Mole (level 5+) / Ember Beetle (level 6+) kill drops the needed item once.
- The in-game `droprate` console cheat bypasses the 3-per-kill cap on purpose.
- Old saves (before v0.2.9) are migrated in `migrateQuests` / `migrateBar`; keep those paths working when changing quests or slots.
