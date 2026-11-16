# Meadows — Art plan (DRAFT)

Status: **draft for Oded's review**. Nothing here is generated yet. It inventories every piece of art the game shows today or that the v0.3.1 spec implies, and plans how to replace it all with one locked PixelLab style.

Scanned on 2026-11-16 against `main` at v0.3.1 (the sprite registry, `public/art/`, `art-src/`, the area definitions, combat FX, the HUD and CSS, the item/skill/passive data, and `planning/v0.3.1.md`).

## Summary

| Phase | What | Est. generations (incl. ~2× retries) |
| --- | --- | ---: |
| 1 | Free style test (trial) | **24** of the 40 free |
| 2 | Paid test round (Tier 1) | **90** |
| 3 | Production, by area then global | **1298** |
| | **Total** | **1412** |

Phase 3 by area: Meadow West 58 · Meadow Town 176 · Meadow East 64 · Sunny Pasture 14 · Dirt Banks 146 · Whisperwood 224 · Global 616.

**Budget fit:** Phases 2 and 3 together (1388) fit inside one Tier 1 month (2,000 generations) with about 610 to spare. Hero gear is now about 188 in total (see the gear approach below).

**Assets by category** (about 309 individual pieces):

| Category | Pieces | Gens |
| --- | ---: | ---: |
| Hero gear visual | 21 | 188 |
| Mob | 14 | 258 |
| Item icon | 105 | 210 |
| Portrait | 7 | 140 |
| Effect | 28 | 132 |
| Parallax | 15 | 102 |
| Decor | 41 | 92 |
| NPC | 6 | 54 |
| UI | 19 | 52 |
| Skill icon | 22 | 44 |
| Font | 1 | 40 |
| Tileset | 16 | 32 |
| Character | 1 | 28 |
| Terrain | 7 | 20 |
| Building | 6 | 12 |
| Named variant | 3 | 8 |

### What the scan found
- **No sprite animates today.** The hero and most mobs are one static 16×16 frame (Crow 2 frames, the Whisperwood mobs 3–5). Walking, wind-ups, hits and deaths are all code tweens: squash, bob, flip, flash. Every animation in this plan is new work.
- **Gear isn't drawn on the hero today.** Equipping changes stats only.

### Gear on the hero (approved)
- **Body armour: 4 looks** (Cloth, Leather, Chain, Plate). Each look is a full hero animation set (all 11 clips). The equipped body piece picks the look by its tier and type: Cloth and Linen show Cloth; Hide, Leather and Trail show Leather. Chain and Plate are for later-tier gear. Every item keeps its own icon and stats. Palette tints can add variants later at almost no cost.
- **Weapons and hats: paper-doll layers.** One sprite per item, pinned to per-frame **hand** and **head** anchor points on every hero frame, MapleStory-style. Claude marks the anchors once per hero clip (no generations), and code places, rotates and flips the layer each frame.
- **Cost:** about 50 per extra look (re-dress the reference, about 2 for the new base, about 2 per clip) × 3 looks = **150**, since Cloth is the Phase 2 hero set. Plus 12 weapon layers (24), 5 hat layers (10) and the style-test frame (4): **about 188** in all, replacing the earlier ~410 for 5 outfit-transferred sets. Chain and Plate can wait until gear needs them (−100).
- **The UI has no art.** Every panel, button, bar, tree node and marker is HTML/CSS in the browser's system font.
- **Much of the world is code-drawn:** parallax hills, ladders, ropes, vines, root ladders, river and bog water, Whisperwood fog, and nearly all skill and hit effects.
- **Current art is CC0 placeholder** (Kenney Tiny Dungeon/Town, Pixel Platformer, Tiny Creatures) plus repo-drawn sprites (`scripts/draw-art-v030.py`, `draw-art-v031.py`) for Whisperwood, Old Stump, Angry Bull and Boar.
- **The named mobs (Wool-Shoulder, Bank-Cracker, Cinderback) reuse their base mob's sprite.** This plan gives each a cheap distinguishing edit, not a full set.
- **Skipped, because they're parked:** Frost Moth, Shrine Wisp, Dusk Wisp, Old Stump, Night Stump, Soul Guard and the other 6 parked skills, and 6 unused junk items. Existing icon files for these stay as they are.
- **Pixel density (decided):** finer detail. Smooth, sharp sprites drawn at **64 px or more** and shown **1:1** in the 960×540 game, **not** chunky pixel art. Today's 16–18 px art is scaled 2–3×; that look is retired. Sizes in the tables below are today's slot sizes. In production, character and mob canvases are at least 64 px (the hero is about 64–96 px tall), and slots grow to match. At those sizes animation clips cost about 1–3 generations each (they're 1 at 64 px), so the estimates may rise about 10–20% for the largest sprites.
- **Side view only.** Every character and mob faces east, and west is a mirror. No top-down or 3/4 views.

## PixelLab constraints and cost assumptions

- **Free trial:** 40 generations, canvas up to **200×200**, standard tools only, **no map or room tools**, and no pro modes. That's enough for a style test, not for production.
- **Tier 1 ($12/mo):** **2,000 generations a month**, canvas up to **320×320**, plus pro modes (tiles pro, building kit, rooms, outfit transfer).
- **Tier 2 and above:** needed for PixelLab music and sound effects. Not in this plan.
- **A "generation" isn't one image.** From PixelLab's MCP tool guide, read 2026-11-16:
  - **1 generation:** standard character (v3 from text is 2 at 16–90 px), template animation per direction, standard sidescroller tileset, pixen/pixflux image, pixen edit.
  - **About 4 per clip** for v3 animation at 128 px.
  - **10 or more:** portrait (10), outfit transfer (10 per batch of up to 15 frames at 64 px or less), pro tiles (15–25), Pro Flash images (5–9).
- **Side view only:** every character is drawn facing **east**, and west is a mirror. Directions in the table mean "east, mirrored".
- **Large backgrounds:** a 960-wide parallax layer is assembled from 3 tileable strips of 320 px or less.
- **Estimates:** every figure is a base cost × 2 for retries, rounded. Numbers are planning estimates, not quotes. `get_balance` and PixelLab's free price checks should be used before each batch.

## Process

1. **Inspiration.** Oded shares references (below). Gamer turns them into 3–5 named mood directions, and Oded picks one or two.
2. **Draft style prompt.** Gamer writes one style prompt: palette, outline, light direction, pixel density, camera, and a few banned traits. Oded approves it before anything is generated.
3. **Rounds of about 6 generations.** Each round makes about 6 pieces with the approved prompt. Claude composites them into a **960×540 mock in-game screenshot** with the hero, a mob, ground, parallax and HUD at real scale, so they're judged in context and never as loose sprites.
4. **Oded's feedback.** Notes go into the prompt, and the next round runs. Plan on 1–3 rounds per phase.
5. **Lock.** Write the style guide (studio template: palette file, sizes, outline, lighting, camera, frame counts, references), and save the PixelLab settings and reference images.
6. **Production batches.** One area at a time, in the Phase 3 order. Each batch goes into the real game (a playable Netlify or itch build) and gets Oded's OK before the next batch starts. Optional Python cleanup (palette snap, stray pixels, packing) runs only when needed; weak sprites get regenerated, not hand-edited.

## Inspiration references (from Oded)

The moodboard is in **[art-direction/README.md](../art-direction/README.md)**: style rules, kept references, hero candidates A and C, and discarded ideas. In short: not heavily pixelated; smooth and sharp, cozy and nostalgic; chibi (about 2.5–3 heads); bold clean dark outlines; flat bright colors with one soft shade; big readable silhouettes; cute, chunky monsters; animation quality like PixelLab's demos.

## Phase 1 — Free style test (~25 of the 40 free generations)

Goal: is PixelLab's look right for Meadows at all? One 960×540 mock with the hero, a sheep, a strip of grass and three icons, plus the hero in the Leather look holding a layered Wooden Sword. That leaves about 15 free generations in reserve for a second round.

| Asset | Category | Current source | Size | Animations / directions | Gens (×2) | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| Hero (Club, cloth start) | Character | CC0 Tiny Dungeon, 1 static 16x16 frame | 48x48 slot (canvas 48-64) | idle (side view, east; west = mirror) | 6 | create_character v3 (2) + idle template (1) |
| Wool Sheep | Mob | CC0 Tiny Creatures, 1 static frame | 48x48 | idle | 6 | base (2) + idle (1); animal needs a reference image |
| Icons: Strawberry, Wool, Training Scroll | Item icon | CC0 Kenney + hue shifts | 18x18 src / 36 shown | — | 6 | create_image_pixen, 1 each |
| Hero in Leather look + layered Wooden Sword | Hero gear visual | none yet | 64px+ | idle frame only | 4 | edit_image_pixen re-dress (1) + weapon layer sprite (1), pinned to a hand anchor |
| Grass tile swatch (for the mock) | Tileset | CC0 Pixel Platformer | 18-32px tile | — | 2 | pixen image; real tileset tool is not on the trial |
| **Subtotal** | | | | | **24** | |

## Phase 2 — Paid test round (Tier 1)

Goal: prove the full pipeline on one of everything before production: one full hero animation set, one mob's walk and attack, Meadow West's tileset and parallax, one NPC, one UI piece, one effect, one portrait and one building. All of it goes into a playable Meadow West build.

| Asset | Category | Current source | Size | Animations / directions | Gens (×2) | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| Hero full animation set | Character | see Phase 1 | 48x48 | idle, walk, run, jump, fall, climb, basic slash, overhead smash, cast, hurt, death (11 clips, east only) | 22 | reuses Phase 1 base; ~1 gen per clip (template or v3 at <=64px) |
| Boar (lvl 5) | Mob | placeholder (draw-art-v031.py) | 44x44 | walk, attack (charge) | 8 | base (2) + 2 clips |
| Meadow tileset: grass ground + plank platform | Tileset | CC0 Pixel Platformer | 32px tiles (36 shown) | — | 4 | create_sidescroller_tileset standard (1) x2 pieces; pro = 15 each if wanted |
| Meadow parallax (sky, far hills, near hills) | Parallax | code-drawn (Phaser graphics) | 960x540 layers, tiled from 320-wide strips | slow scroll (code) | 18 | 3 layers x 3 strips, pixflux/pixen 1 each |
| Pell (NPC) | NPC | CC0 Tiny Dungeon | 48x48 | idle, talk | 8 | base (2) + 2 clips |
| UI panel frame (9-slice) + button | UI | HTML/CSS only | 9-slice, 48-96px source | button: normal/hover/pressed | 4 | pixen |
| Basic slash effect | Effect | code-drawn (Phaser graphics) | 64x40 | 4-6 frames | 4 | pixen strip + animate_image_pixminimax (1) |
| Pell portrait | Portrait | none yet | 64x64 (or 128) | static (talk mouth optional +3) | 20 | create_portrait_character |
| House (red roof) | Building | CC0 Tiny Town 64x48 | 192x144 | — | 2 | pixen |
| **Subtotal** | | | | | **90** | |

## Phase 3 — Production

One batch per area, in this order. Each batch is shown in the game before the next one starts. Mobs that appear in several areas are made once, in the first area they appear.

### 3.1 Meadow West

| Asset | Category | Current source | Size | Animations / directions | Gens (×2) | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| Field Mouse | Mob | CC0 Tiny Creatures (weasel), 1 frame | 36x36 | idle, walk, attack, hit, death | 14 |  |
| Wool Sheep (rest of set) | Mob | see Phase 1 | 48x48 | walk, attack (headbutt), hit, death | 8 |  |
| Crow (also Sunny Pasture, Meadow East) | Mob | CC0 Tiny Creatures, 2 wing frames | 36x36 | fly idle, fly move, throw pebble, hit, death | 14 | flying; hovers above the surface |
| Crow pebble projectile | Effect | CC0 Tiny Dungeon | 22x22 | spin (code) + impact puff | 4 |  |
| Decor: round tree, tall tree, bush, fence, sign, flower tuft, grass tuft | Decor | CC0 Kenney / Tiny Creatures | 32-96px | grass sway optional | 14 |  |
| Portal / area exit marker | Terrain | CC0 Kenney / Tiny Creatures | 40x80 | glow loop | 4 | pixen + animate_image (1) |
| **Subtotal** | | | | | **58** | |

### 3.2 Meadow Town

| Asset | Category | Current source | Size | Animations / directions | Gens (×2) | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| Mara (shop) | NPC | CC0 Tiny Dungeon | 48x48 | idle, talk, slap | 10 |  |
| Calden (trainer) | NPC | CC0 Tiny Dungeon | 48x48 | idle, talk, demo swing | 10 |  |
| Ila (exchange) | NPC | CC0 Tiny Dungeon | 48x48 | idle, talk | 8 |  |
| Tamsin (magician) | NPC | CC0 Tiny Dungeon | 48x48 | idle, talk, small cast | 10 |  |
| Mara portrait | Portrait | none yet | 64x64 | static | 20 | create_portrait_character; optional, dialogue does not show portraits yet |
| Calden portrait | Portrait | none yet | 64x64 | static | 20 | create_portrait_character; optional, dialogue does not show portraits yet |
| Ila portrait | Portrait | none yet | 64x64 | static | 20 | create_portrait_character; optional, dialogue does not show portraits yet |
| Tamsin portrait | Portrait | none yet | 64x64 | static | 20 | create_portrait_character; optional, dialogue does not show portraits yet |
| Hero portrait | Portrait | none yet | 64x64 | static | 20 | create_portrait_character; optional, dialogue does not show portraits yet |
| Buildings: stone house, third house, Mara's stall, Ila's bench, Calden's training rack | Building | CC0 Kenney / Tiny Creatures | 96-192px | — | 10 |  |
| Town props: well, hive, lamp post, west + east gate | Decor | none yet / CC0 | 32-128px | — | 10 | the west gate is new in 0.3.1 |
| Storage chest (closed / open) | Decor | CC0 Tiny Dungeon | 40x40 | open (2-3 frames) | 6 |  |
| Practice post (dummy) | Decor | CC0 Tiny Dungeon | 40x72 | hit wobble | 4 |  |
| Town ground tiles (path / cobble) | Tileset | CC0 Pixel Platformer grass | 32px | — | 2 |  |
| Town parallax far layer (rooftops, trees) | Parallax | code-drawn (Phaser graphics) | 960 wide | — | 6 |  |
| **Subtotal** | | | | | **176** | |

### 3.3 Meadow East

| Asset | Category | Current source | Size | Animations / directions | Gens (×2) | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| Boar (rest of set) | Mob | see Phase 2 | 44x44 | idle, hit, death | 6 |  |
| Angry Bull | Mob | placeholder (old Meadow Boar recolour) | 58x58 | idle, walk, paw + charge, attack, hit, death | 16 | snort / ground-paw wind-up |
| Wool-Shoulder (named sheep) | Named variant | reuses Wool Sheep | ~56x56 | reuse sheep clips | 2 | bigger, triple fleece: one pixen edit + palette/scale in code; full set would be ~14 |
| Hill tiles: slope edges, terrace ledge, grove top | Tileset | CC0 grass + code blocks | 32px | — | 6 |  |
| Climbs: wooden ladder, knotted rope | Terrain | code-drawn (Phaser graphics) | 32px wide, tiled | rope sway (code) | 4 |  |
| Hills parallax (3 layers) | Parallax | code-drawn (Phaser graphics) | 960x540 | — | 18 |  |
| Decor: hill tree, grove trees, rocks, old stump (prop) | Decor | CC0 Kenney / Tiny Creatures | 32-160px | — | 8 |  |
| Charge dust puff | Effect | code-drawn (Phaser graphics) | 32x24 | 4 frames | 4 |  |
| **Subtotal** | | | | | **64** | |

### 3.4 Sunny Pasture

| Asset | Category | Current source | Size | Animations / directions | Gens (×2) | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| Decor: wildflower patch, broken fence, lone big tree, hay bale | Decor | none yet | 32-160px | flower sway optional | 8 | named in the 0.3.1 spec |
| Pasture parallax far layer (open fields) | Parallax | code-drawn (Phaser graphics) | 960 wide | — | 6 | reuses the Meadow sky and near layer |
| **Subtotal** | | | | | **14** | |

### 3.5 Dirt Banks

| Asset | Category | Current source | Size | Animations / directions | Gens (×2) | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| Burrow Mole | Mob | CC0 Tiny Creatures | 40x40 | idle, walk, burrow/pop-up, attack, hit, death | 16 |  |
| Earth Sprite | Mob | CC0 Tiny Creatures | 44x44 | idle (float), move, attack, hit, death | 14 |  |
| Ember Beetle | Mob | CC0 Tiny Creatures (recolour) | 40x40 | idle, walk, attack, hit, death | 14 |  |
| Spark Bug | Mob | CC0 Tiny Creatures | 36x36 | idle, move, zap attack, hit, death | 14 |  |
| Bank-Cracker (named mole) | Named variant | reuses Burrow Mole | ~52x52 | reuse mole clips + shoulder slam | 4 | edit + 1 extra clip |
| Cinderback (named beetle) | Named variant | reuses Ember Beetle | ~48x48 | reuse beetle clips | 2 | smouldering shell edit |
| Banks tiles: dirt ground, mud shelf, high bank ledge | Tileset | CC0 Pixel Platformer dirt | 32px | — | 6 |  |
| Cave tiles: rock floor, gallery ledge, wall/ceiling | Tileset | code-drawn (Phaser graphics) + dirt tiles | 32px | — | 6 |  |
| Climbs: root ladder | Terrain | code-drawn (Phaser graphics) | 32px wide | — | 2 |  |
| River surface strip | Terrain | code-drawn (Phaser graphics) | tiling 64-128px | ripple loop | 4 |  |
| Riverbank parallax (3 layers) | Parallax | code-drawn (Phaser graphics) | 960x540 | — | 18 |  |
| Cave parallax (3 layers, dark) | Parallax | code-drawn (Phaser graphics) | 960x540 | — | 18 |  |
| Decor: rock, clod, river reeds, driftwood, stalagmite, stalactite, crystal cluster, den bones | Decor | CC0 / repo-drawn | 16-96px | — | 16 |  |
| Wall torch | Decor | none yet | 16x32 | flame loop | 4 |  |
| Spark zap + ember spit | Effect | code-drawn (Phaser graphics) | 24-48px | 4 frames each | 8 |  |
| **Subtotal** | | | | | **146** | |

### 3.6 Whisperwood

| Asset | Category | Current source | Size | Animations / directions | Gens (×2) | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| Wisp | Mob | repo-drawn (draw-art-v030.py), 3 frames | 40x40 | idle bob, move, shoot mote, hit flicker, death dissolve | 14 | flying |
| Thornling | Mob | repo-drawn, 3 frames | 42x42 | idle jitter, hop, arm-back throw, hit, death (leaf burst) | 14 |  |
| Moss Lurker | Mob | repo-drawn, 4 frames | 60x48 | mound (rest), ambush pop-up, walk, lunge-bite, hit, death | 16 |  |
| Mire Toad | Mob | repo-drawn, 3 frames | 60x48 | idle throat pulse, hop + splash, cheek puff + tongue, hit, death belly-flop | 14 |  |
| Hollow Stag (miniboss) | Mob | repo-drawn, 5 frames 32x32 | 128x128 | idle, walk, charge, antler sweep, root stomp, phase-2 glow, hit, kneel death (8 clips) | 70 | v3 base (3) + ~4 per clip at 128px |
| Wren (woodwarden NPC) | NPC | recolour of Pell | 48x48 | idle, talk | 8 |  |
| Wren portrait | Portrait | none yet | 64x64 | static | 20 | optional |
| Forest tiles: moss ground, branch ledge, bog edge | Tileset | recolours of grass / plank | 32px | — | 6 |  |
| Climbs: hanging vine | Terrain | code-drawn (Phaser graphics) | 32px wide | sway (code) | 2 |  |
| Bog pool surface | Terrain | code-drawn (Phaser graphics) | tiling | ripple loop | 4 |  |
| Forest parallax (3 trunk layers; fog stays code) | Parallax | code-drawn (Phaser graphics) | 960x540 | — | 18 |  |
| Decor: old tree, dead tree, tent, fern, mushroom, glow mushroom, reeds, lantern, Hollow arch | Decor | repo-drawn (draw-art-v030.py) | 12-165px | glow pulse (code) | 18 |  |
| Campfire | Decor | repo-drawn | 44x44 | flame loop | 4 |  |
| Mob FX: wisp mote, thorn, root spikes, stag shockwave | Effect | repo-drawn / code | 12-96px | 3-6 frames each | 16 |  |
| **Subtotal** | | | | | **224** | |

### 3.7 Global (hero gear, icons, effects, UI, font)

| Asset | Category | Current source | Size | Animations / directions | Gens (×2) | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| Weapon layers (12): Club, Wooden Sword, Short Sword, Steel Sword, Meadow Blade, Stone Club, Rusty Dagger, Steel Dagger, Bone Knife, Worn Staff, Steel Staff, Grove Staff | Hero gear visual | none yet (gear not drawn on the hero) | ~24-40px | pinned to the per-frame hand anchor | 24 | paper-doll layer; code rotates it with the swing |
| Armour looks (3 beyond the Phase 2 Cloth set): Leather, Chain, Plate | Hero gear visual | none yet | 64px+ per frame | all 11 hero clips per look | 150 | ~25 per look ×2; Chain and Plate can wait for later-tier gear |
| Hat layers (5): Cloth Cap, Linen Hood, Hide Cap, Leather Cap, Trail Cap | Hero gear visual | none yet | ~32px | pinned to the per-frame head anchor | 10 | paper-doll layer |
| Item icons: gear (37) | Item icon | CC0 Kenney + hue shifts | 18x18 src | — | 74 |  |
| Item icons: materials (33, minus 2 done in Phase 1) | Item icon | CC0 Kenney / Tiny Creatures | 18x18 | — | 62 |  |
| Item icons: junk / quest items (22 live, incl. Live Ember) | Item icon | CC0 Kenney / Tiny Creatures | 18x18 | — | 44 |  |
| Item icons: consumables (8, minus Strawberry) and currencies (5 incl. 4 essences) | Item icon | CC0 Kenney / Tiny Creatures | 18x18 | — | 24 |  |
| Skill icons (11 live): Power Strike, Rage, Dig In, Earthbreaker, Root Lash, Flame Cleave, Magic Bolt, Mana Shield, Fire Bolt, Thorn Volley, Chain Spark | Skill icon | CC0 hue shifts | 18x18 src / 36+ shown | ready-to-train glow (code) | 22 |  |
| Passive icons (7 families) + buff/status icons (Rage, Dig In, Mana Shield, Burn) | Skill icon | CC0 hue shifts / none | 18x18 | — | 22 |  |
| Skill FX: side slash, overhead smash, Power Strike axe cut, Earthbreaker shock, Flame Cleave fan, Root Lash whip, Rage burst, Dig In stamp, Mana Shield ward | Effect | code-drawn (Phaser graphics) | 32-160px | 4-8 frames each | 36 | 2 each; keep code hit-stop, shake and particles on top |
| Spell FX: Magic Bolt, Fire Bolt, Thorn Volley, Chain Spark (projectile + impact each) | Effect | code-drawn (Phaser graphics) | 16-64px | loop + 4-6 frame impact | 32 |  |
| General FX: hit spark, crit spark, death poof, heal sparkle, level-up burst, loot sparkle, Mara slap swipe | Effect | code-drawn (Phaser graphics) | 24-96px | 4-8 frames | 28 |  |
| UI kit: buttons (4 states), tabs, hotbar slot, inventory slot, tooltip, dialogue box, close/back | UI | HTML/CSS only | 9-slice sources | hover/pressed states | 20 |  |
| UI: HP/MP/XP bar frames + fills | UI | HTML/CSS only | 9-slice | — | 6 |  |
| UI: skill-tree node frames (locked, available, trained, ready) + family colour trims | UI | HTML/CSS only | 40-56px | ready pulse (code) | 8 |  |
| UI: quest markers ! and ?, objective check, farm-list leaf, completion banner, rewards ribbon, level-up banner | UI | HTML/CSS only / text glyphs | 16-320px | bob (code) | 14 |  |
| Pixel font (Regular + Bold) | Font | system-ui (browser font) | 8-16px glyphs | — | 40 | create_font is a pro tool; cost not published, assumed ~10 per weight |
| **Subtotal** | | | | | **616** | |

## Open questions for Oded

1. **Chain and Plate:** make them now, with the Leather look, or wait until gear of that tier exists?
2. **Portraits:** there's no portrait UI today. Keep them in the plan (about 140 generations for 7 portraits) and add them to dialogue, or drop them for now?
