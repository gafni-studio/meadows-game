# Status

Read this first, then `CLAUDE.md`. **End every session by updating this file** (live version, what is in flight, open issues, next step).

## Live
- **v0.3.0** on `main`: The Split Meadows and Whisperwood. Check the live build at https://meadows-gafni.netlify.app/version.json (it should show `0.3.0`). The sandbox cannot reach the site, so a human confirms deploys.
- Health: `npm run verify` passes (45 logic tests ~1 s, boot smoke ~18 s; it now visits every area and climbs a ladder).

## What the game is now
Hero (internal id `warrior`) walks two Paths: Warrior (Power Strike → Earthbreaker → Root Lash / Flame Cleave; Dig In; Rage) and Magician (Magic Bolt → Mana Shield → Fire Bolt / Thorn Volley → Chain Spark). Trees are hidden until their Path quest is done. Areas: Meadow Town → Meadow West (flat) → Meadow East (hills, terraces, grove with the Old Stump) → Dirt Banks West (river) → Dirt Banks East (cave, pit, galleries); Whisperwood (5–10) north of Meadow East's grove, opened by Mist on the North Road. Vertical levels: Up/Down climbs, Down + Space drops through ledges. Whisperwood chain: Pell then Wren (five quests) ending at the Hollow Stag. Rank recipes 5–10 use Wisp Dust, Moss Fiber, Toad Gland; rank 10 of four key skills takes a Hollow Antler. Spirit skills, Soul Guard, the Meadow Shrine, Night Stump and Frost Moth stay parked.

## In flight
Nothing. v0.3.0 is released; waiting for Oded's playtest notes.

## Next
- Playtest v0.3.0: climbing feel, ledge layouts, the Stag's timings (`STAG` in `src/entities/mobs/HollowStag.ts`), Whisperwood mob speeds/ranges (`assumptions.ts`), pacing 5→10.
- The plan's next release: the Spirit family and a matching pass on passive recipes.
- Split big files piecemeal when a release touches them (see CLAUDE.md "Keep files small"): `Hud.ts` 1.26k lines, `WorldScene.ts` 940, `Quests.ts` 700, `CombatFx.ts` 750.

## Known gaps and judgment calls worth remembering
- Placeholder art: Tamsin's sprite (a recolour of Ila's), Wren's (a recolour of Pell's), the Club and Chain Spark icons. v0.3.0 mob/decor art is original, from `scripts/draw-art-v030.py`.
- v0.3.0: no day/night yet, so the Old Stump is always out. Moss Lurker, Mire Toad and Stag timings are first guesses.
- v0.3.0: an NPC with several active quests leads with the conversation that moves one forward; a "not yet" only when nothing is ready.
- Old saves in Sunny Pasture / Dirt Banks load into Meadow West / Dirt Banks West (`AREA_ALIAS`).
- v0.2.6 open questions, answered by Oded: Hero HP (100 + 7/level) is fine; late-rank recipes (3-10, Dirt Banks goods only) stay as they are and will be reworked when more content arrives.
- Pell's quest marker was reported missing in v0.2.7 and could not be reproduced; it is covered by tests. If it recurs, get the exact step from Oded.
- The Cracked Stone and Ember in the Scale start by talking to Calden (`!`); the first Burrow Mole (level 5+) / Ember Beetle (level 6+) kill drops the needed item once.
- The in-game `droprate` console cheat bypasses the 3-per-kill cap on purpose.
- Old saves (before v0.2.9) are migrated in `migrateQuests` / `migrateBar`; keep those paths working when changing quests or slots.
