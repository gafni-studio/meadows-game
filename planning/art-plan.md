# Meadows: art plan

This plan covers how Meadows art is made and what exists so far. It was rewritten on 2026-11-16 for the **basic chibi** direction. The style rules and generation tips live in [art-direction/README.md](../art-direction/README.md).

**Spending rule:** put the effort where players feel it all the time: the hero, skills and their effects, mob animation, hit, level-up and pickup feedback, and the first area. Everywhere else stays simple: static scenery brought to life in code, recolours, and CSS UI.

## Style (summary)
- True basic chibi, like MapleStory. Humanoids are about 2.5 heads tall, built from simple round shapes with minimal detail.
- Bold dark-brown or black outlines, flat colours with one shadow tone.
- Side view facing right, on a plain light grey background, with no text on sheets.
- The hero is about **160 px** tall on a **1920×1080** canvas, and every other asset uses the same scale.

## Pipeline
1. **Grok Bot generates static sheets** with GenerateImage, using `art-direction/chibi/style/concept-sheet.jpg` plus the closest pose sheet as references. Output covers mob and NPC pose sheets, item icon grids, and later backgrounds, tiles and portraits.
2. **Claude cuts parts and builds simple bone rigs in Phaser.** The pose sheets are the keyframes, and Claude tweens between them. Code adds secondary motion (hair, scarf), squash and stretch, and the **effects** (slash arcs, hit sparks, hit-stop, shake, particles).
3. **Oded reviews** each batch in a 1920×1080 mock or a playable build before the next batch starts.

**Current brief:** [`art-direction/chibi/rig-brief.md`](../art-direction/chibi/rig-brief.md), the first hero rig pass.

## Hero rig and gear
- **Rig parts** follow `chibi/style/hero-rig-parts.jpg`: head, torso, upper and lower arms, thighs and shins.
- **Gear swaps rig parts:** gloves swap the forearms, boots swap the shins, and chest armour swaps the torso. So every animation works with every look.
- **Weapons and hats are pinned** to the **hand point** (with angle) and the **head point**. A new weapon or hat is one image, cut from its item sheet.
- **Grip types:** one-handed (sword, club, dagger), two-handed, staff, and bow. Each grip type has its own attack keyframes, and every other clip is shared. Only one-handed is needed now.
- **Run is the default movement** cycle.

## Combat feel
- **Basic attack:** a **2-hit combo**, a side slash then an overhead smash, with a short pause before the next combo. Keyframes are in `chibi/style/hero-swings.jpg`.
- **Effects carry the hit:** a code slash arc on each swing, plus a hit spark, a brief hit-stop, a small shake and a mob flinch. The drawn poses stay simple.

## Mobs
- Every mob sheet has 4 rows: **idle, walk or fly, attack** (windup, strike, recover) and **hit and die** (flinch, knockback, lying with swirly eyes). Those rows map straight to rig clips.
- **Variants** (named mobs, night forms) have their own sheet, but they reuse the base mob's rig and clips with recoloured parts.

## Scenery, tiles, icons and UI
- **Scenery is static and animated in code:** parallax with drifting clouds, a sine sway for grass, vines and ropes, a wave shader for water and bog, pulses for glow and fire, and a wobble for the practice post.
- **Tiles:** one base tileset (grass ground and plank platform), palette-swapped per area. Unique pieces only where the shape differs (slopes, mud shelf, bog edge, cave set).
- **Item icons** are cut from the batch sheets in `chibi/items/`. Grid positions are listed in [`chibi/items/index.md`](../art-direction/chibi/items/index.md).
- **UI** is HTML/CSS, with a few 9-slice frames (panel, button, slot, tooltip/dialogue, bar).

## Dev task: 1920×1080 canvas
Switch Phaser to **1920×1080** with `Scale.FIT`. Until the new art is wired in, scale today's placeholder textures 2× at load.

## Process
1. Any new mob, NPC or item batch gets a sheet in this style. Oded approves it before rigging.
2. Claude rigs the sheet and wires it into a build.
3. Oded signs off before the next batch.

## Asset index
Paths are under `art-direction/chibi/`. **Approved** means Oded signed off. **New** means generated on 2026-11-16 and waiting for review.

| Asset | File | Status |
| --- | --- | --- |
| Concept sheet | `style/concept-sheet.jpg` | Approved |
| Hero poses / swings / rig parts | `style/hero-poses.jpg`, `style/hero-swings.jpg`, `style/hero-rig-parts.jpg` | Approved |
| **Mobs (live)** | | |
| Field Mouse | `mobs/field-mouse.jpg` | Approved |
| Wool Sheep | `mobs/wool-sheep.jpg` | Approved |
| Wool-Shoulder | `mobs/wool-shoulder.jpg` | Approved |
| Crow | `mobs/crow.jpg` | Approved |
| Boar | `mobs/boar.jpg` | Approved |
| Angry Bull | `mobs/angry-bull.jpg` | New (flaws resolved: full-size frames, mirrored to face right) |
| Burrow Mole | `mobs/burrow-mole.jpg` | New (flaws resolved: open eyes except hit/die) |
| Bank-Cracker | `mobs/bank-cracker.jpg` | New |
| Earth Sprite | `mobs/earth-sprite.jpg` | New (flaws resolved: side view facing right) |
| Ember Beetle | `mobs/ember-beetle.jpg` | New |
| Cinderback | `mobs/cinderback.jpg` | New |
| Spark Bug | `mobs/spark-bug.jpg` | New (flaws resolved: tube removed, clear zap attack) |
| Wisp | `mobs/wisp.jpg` | New |
| Thornling | `mobs/thornling.jpg` | New |
| Moss Lurker | `mobs/moss-lurker.jpg` | New |
| Mire Toad | `mobs/mire-toad.jpg` | New (flaws resolved: 3 idle frames) |
| Hollow Stag (miniboss) | `mobs/hollow-stag.jpg` | New |
| **Mobs (not spawned yet)** | | |
| Old Stump | `mobs/old-stump.jpg` | New (near side view, accepted) |
| Night Stump | `mobs/night-stump.jpg` | New |
| Frost Moth | `mobs/frost-moth.jpg` | New |
| Shrine Wisp | `mobs/shrine-wisp.jpg` | New |
| Dusk Wisp | `mobs/dusk-wisp.jpg` | New |
| **NPCs** | | |
| Pell | `npcs/pell.jpg` | Approved |
| Mara | `npcs/mara.jpg` | Approved |
| Tamsin | `npcs/tamsin.jpg` | Approved |
| Wren | `npcs/wren.jpg` | Approved |
| Ila | `npcs/ila.jpg` | New (full-body fix) |
| Calden | `npcs/calden.jpg` | New (wooden practice sword fix) |
| **Items (111)** | | |
| Swords and clubs (6) | `items/05-weapons-swords-clubs.jpg` | New |
| Daggers and staves (6) | `items/06-weapons-daggers-staves.jpg` | New |
| Caps and torsos (10) | `items/07-armour-heads-torsos.jpg` | New |
| Pants and boots (10) | `items/08-armour-legs-boots.jpg` | New |
| Gloves (5) | `items/09-armour-gloves.jpg` | New |
| Consumables (9) | `items/10-consumables.jpg` | New |
| Currencies (6) | `items/11-currencies.jpg` | New |
| Wood materials (8) | `items/12-materials-wood.jpg` | New |
| Stone and earth materials (8) | `items/13-materials-stone-earth.jpg` | New |
| Hide materials (6) | `items/14-materials-hide.jpg` | New |
| Elemental materials (10) | `items/15-materials-elemental.jpg` | New |
| Quest items and curiosities (9) | `items/16-quest-curiosities.jpg` | New (flaws resolved: single glowing scale; Warm Grain is a glowing pouch) |
| Junk (8) | `items/17-junk.jpg` | New |
| Rare junk (10) | `items/18-rare-junk.jpg` | New |

## Still to make
- **Per area:** parallax layers, the tileset swap and decor for Meadow West, Meadow Town (buildings, well, gates, chest, practice post), Meadow East (slopes, ladder, rope), Sunny Pasture, the Dirt Banks (river, cave set, torch) and Whisperwood (forest layers, bog, campfire, lantern).
- **Portraits** for the hero and every NPC.
- **Skill, passive and buff icons.**
- **FX that need drawn art:** spell projectiles, mob projectiles (pebble, mote, thorn, ember), and the death poof and level-up burst. Slash arcs and sparks are code.
- **Later:** Chain and Plate hero looks, Soul Guard, and parked skills, made once they're designed.
