# Meadows — Art plan

Every piece of art the game shows today or that the v0.3.1 spec implies, planned with one locked PixelLab style. Scanned on 2026-11-16 against `main` at v0.3.1. Nothing is generated yet.

**Spending rule (approved):** spend on what players feel all the time: the hero, skills and their effects, mob animation, hit, level-up and pickup feedback, the first area (Meadow West) and portraits. Save everywhere else: static scenery brought to life in code, palette swaps, recolours, icon sheets and CSS UI. Content that isn't settled waits until it's needed.

## Summary

Costs were updated after round 1: animations made at 2× cost about 3 generations each instead of 1.

| Category | Before | Now | How |
| --- | ---: | ---: | --- |
| Hero (Cloth + Leather sets, weapon and hat layers) | 214 | 214 | Full quality, about 4 per clip. Chain and Plate deferred. Tiered weapons and hats are recolours. |
| Mobs and named variants | 254 | 420 | Walk, attack, hurt and die for every mob, at about 3 per clip. Variants are recolours. Small or rare mobs get fewer frames. The boss gets a full set. |
| Effects (skills, spells, hits, level-up, pickup) | 130 | 258 | Kept in full, about 3 per animated effect |
| Portraits (7) | 140 | 140 | Kept |
| Skill, passive and buff icons | 44 | 44 | One at a time |
| Item icons | 38 | 38 | Sheets of about 4 per generation, with tiers as recolours |
| NPCs | 52 | 54 | Base and idle. Talk and gestures are code; Mara's slap is drawn. |
| Parallax | 36 | 36 | Static layers. Meadow West is unique; other areas are palette swaps plus one unique layer where needed. |
| Decor | 76 | 80 | Static images; motion comes from code |
| Tilesets and terrain | 36 | 36 | One base tileset with palette swaps. Caves are unique. |
| Buildings | 12 | 12 | Static |
| UI and font | 10 | 10 | CSS plus 5 nine-slice frames, and an open-licence web font |
| **Paid total** | **1042** | **1342** | |
| Style tests (free trial) | 18 | 25 | 15 used in round 1, and about 10 planned for round 2 |

By phase: **Phase 2** paid test 192 · **Phase 3** production 1,150 (Meadow West 100 · Town 168 · Meadow East 30 · Sunny Pasture 10 · Dirt Banks 168 · Whisperwood 276 · Global 398).

**Budget fit:** 1,342 fits in **one Tier 1 month** (2,000 generations), with about 650 to spare. That covers retries, new content, or Chain and Plate (about 190) when they're needed. Moving to 1920×1080 art (see below) would add about 36 for wider parallax, and hero clips may cost more on bigger canvases. Run PixelLab's price check before Phase 2.

## Approach

### Gear on the hero
- **Body armour looks:** Cloth (the Phase 2 set) and Leather are full hero animation sets (11 clips). The equipped body piece picks the look by tier: Cloth and Linen show Cloth; Hide, Leather and Trail show Leather. **Chain and Plate are deferred** until gear of that tier exists.
- **Weapons and hats are paper-doll layers**, pinned to per-frame hand and head anchors. Claude marks the anchors once per clip, which costs no generations. Items of the same type in higher tiers are recolours: for example, the Steel Sword is a recoloured Short Sword, and Steel and Rusty Dagger share one shape.

### Mobs
- Every mob gets **walk, attack, hurt and die**, plus idle. Each clip costs about 3 at 2×; boss clips cost about 4.
- **Variants are recolours** with a code scale: Angry Bull is a recoloured, larger Boar with one extra wind-up clip, and so are Wool-Shoulder, Bank-Cracker and Cinderback.
- Small or rare mobs (Spark Bug) skip the hurt clip and use the code flash instead. The Hollow Stag boss gets all 8 clips.

### Static art brought to life in code (for the dev)
Decor, buildings, parallax layers, climbs and water are single static images. The motion comes from code:
- **Parallax** at several scroll speeds, with **drifting clouds** (tweened sprites with wrap-around).
- **Swaying grass, flowers, vines and ropes:** a sine skew or rotation tween around the base, with per-instance phase offsets.
- **Water and bog:** a UV-scroll or wave shader on the strip, plus occasional ripple rings.
- **Glow** (mushrooms, portal, lanterns): an alpha and scale pulse, an additive glow sprite and a few floating particles.
- **Fire** (torch, campfire): flicker tweens on a glow sprite plus ember particles. The campfire keeps a short drawn loop.
- **Props:** a squash wobble for the practice post on hit, a 2-frame chest open, and an NPC idle bob with a talk bounce.
- **Light shafts and fog** in Whisperwood: additive gradient sprites that drift slowly.

### Tiles, icons and UI
- **One base sidescroller tileset** (grass ground and plank platform) is made in Meadow West. The other areas get a **palette swap** of it. Unique pieces are made only where the shape differs: slope edges, mud shelf, bog edge, and a **unique cave set**.
- **Item icons** are generated as sheets of about 4 on one canvas, then sliced. Tiered items of the same type are recolours. If sheets lose quality, fall back to one icon per generation (about +70).
- **UI** is HTML/CSS. Five 9-slice frames give it texture: a panel, a button, a slot, a tooltip/dialogue box and a bar frame. Markers, nodes and banners stay CSS.
- **Font:** use an open-licence web font in the locked look, with no generation.

### Style and recipe
- **Clean, detailed pixel art, not chunky retro** (Sea of Stars, Eastward). The chosen look is "hero 3" in `art-direction/tests/round-1/comparison.png`.
- **Recipe:** generate each asset at **2× its game size** with PixelLab's 1-generation image-to-pixel-art converter in **faithful** mode, with no Pro Flash. Then remove the background and scale it down to **exactly half**, locally, with the finishing script Claude commits in `art-direction/tools/`. The engine never resizes art. **No added outline:** keep the converter's own outline.
- **Concept sheets** draw every asset at the same scale as the hero lineup.
- **Side view only.** Everything faces east, and west is a mirror.

### Game canvas: 1920×1080 (dev task, needed before production)
- Today the game is drawn at 960×540 and then scaled up with nearest-neighbour, which turns fine pixel art chunky. Switch the Phaser config to **1920×1080**, keeping `Scale.FIT` and `roundPixels`, so art shows crisp at 1:1.
- Until the new art lands, scale today's placeholder textures 2× at load so nothing breaks. New art loads at 1:1.
- **Open question: hero size on the new canvas.** At today's scale the hero is about 125 px tall, about 23% of the screen height.
  - Keeping 125 px on a 1080-tall screen halves the hero on screen. Everything gets smaller and more of the map shows.
  - Doubling the hero to about 250 px would need a 500 px source, but Tier 1 caps the canvas at 320 px. The 2×-then-half rule therefore caps final sprites at about 160 px.
  - **Recommendation:** make the hero about **160 px** on the 1920×1080 canvas, the largest the recipe allows on Tier 1. The hero reads slightly smaller than today and more of each area shows. Scale mobs and props in proportion, about 1.3× the sizes in the tables below. Decide after round 2's 1920×1080 mock.

## PixelLab constraints and cost assumptions
- **Free trial:** 40 generations, canvas up to **200×200**, standard tools only, and no map tools.
- **Tier 1 ($12/mo):** **2,000 generations a month**, canvas up to **320×320**, and pro modes.
- **Costs** (from PixelLab's MCP tool guide, read 2026-11-16, and round 1): **1** for the image-to-pixel-art converter, a standard sidescroller tileset, or a pixen image or edit. **About 3 per animation** at 2×. **About 4 per hero clip**. **About 10** for a portrait.
- **Estimates:** every figure is the base cost × 2 for retries, rounded. Check `get_balance` and PixelLab's price check before each batch.

## Process
1. **Inspiration.** Oded shares references, and they're kept on the moodboard.
2. **Style prompt.** Gamer drafts one style prompt (palette, outline, light, density, camera, banned traits), and Oded approves it.
3. **Rounds of about 6 generations.** Claude composites each round into an **in-game mock at the game canvas** (1920×1080) at real scale.
4. **Oded's feedback.** It goes into the prompt, and the next round runs. Plan on 1–3 rounds per phase.
5. **Lock.** Write the style guide, and save the PixelLab settings and reference images.
6. **Concept sheet before every batch (standing rule).** Before PixelLab generates any batch, and whenever new content (mob, item, NPC, area or gear) is added, Gamer makes a free concept reference sheet in the style of the locked hero, with every asset at the same scale as the hero lineup. It's saved as one sheet per area or batch in `art-direction/concepts/`, for example `concepts/meadow-west.jpg`. Oded approves it, and then Claude feeds it to PixelLab as the image reference. Sheets are made per batch just before production, not all up front.
7. **Production batches.** One area at a time, in the Phase 3 order. Each batch goes into a playable build and gets Oded's OK before the next. Optional Python cleanup runs only when needed. Weak sprites are regenerated, not hand-edited.

## Inspiration references
The moodboard is in **[art-direction/README.md](../art-direction/README.md)**: style rules, references and the locked hero.

## Phase 1 — Free style tests

- **Round 1 (done):** 15 of 40 generations used. Outputs and the comparison are in `art-direction/tests/round-1/`. Oded chose hero 3.
- **Round 2:** [art-direction/style-test-round-2.md](../art-direction/style-test-round-2.md). The recipe is applied to the hero (Leather and Cloth), the sheep and the Wooden Sword (about 4), plus one Leather walk at 2× (about 3). It also commits the finishing script and runs the canvas check. That's about 7 generations, at most 10 with retries.

## Phase 2 — Paid test round (Tier 1)

One of each key thing, playable in a Meadow West build: the hero set, a mob, a tileset, parallax, an NPC, a portrait, a building, a UI frame, a skill icon and a skill effect.

| Asset | Size | Animation | Gens | Notes |
| --- | --- | --- | ---: | --- |
| Hero, Cloth: full set | 128px | idle, walk, run, jump, fall, climb, basic slash, overhead smash, cast, hurt, death (11) | 96 | base 4 + 4 per clip, ×2 |
| Boar (lvl 5) | 96px | idle, walk, attack (charge), hurt, die | 32 | the mob template for all others |
| Base tileset: grass ground + plank platform | 32px tiles | — | 4 | palette-swapped for later areas |
| Meadow West parallax: far hills, near hills, clouds | screen wide | static (code scroll and drift) | 18 | unique, first area; sky is a code gradient |
| Pell (NPC) | 96px | idle | 8 | talk bounce in code |
| Pell portrait | 128px | static | 20 | |
| House (red roof) | 192x144 | static | 2 | |
| UI panel 9-slice frame | 48-96px | — | 2 | |
| Power Strike skill icon | 36-48px | — | 2 | |
| Basic slash effect | 64x40 | 4-6 frames | 8 | code adds hit-stop, shake and particles |
| **Subtotal** | | | **192** | |

## Phase 3 — Production

One batch per area, in this order, each with its approved concept sheet. A mob that appears in several areas is made once, where it first appears.

### 3.1 Meadow West (first area: full quality)

| Asset | Size | Animation | Gens | Notes |
| --- | --- | --- | ---: | --- |
| Field Mouse | 64px | idle, walk, attack, hurt, die | 32 | |
| Wool Sheep (rest of set) | 64px | walk, headbutt, hurt, die | 24 | |
| Crow (also Sunny Pasture, Meadow East) | 64px | fly, throw pebble, hurt, die | 26 | hovers above the surface |
| Crow pebble | 22px | static (code spin, impact puff) | 2 | |
| Decor: round tree, tall tree, bush, fence, sign, flower tuft, grass tuft | 32-96px | static (code sway) | 14 | unique pieces |
| Portal / exit marker | 40x80 | static (code glow) | 2 | |
| **Subtotal** | | | **100** | |

### 3.2 Meadow Town

| Asset | Size | Animation | Gens | Notes |
| --- | --- | --- | ---: | --- |
| Mara, Calden, Ila, Tamsin (NPCs) | 96px | idle (+ Mara's slap) | 38 | 8 each, slap +6 |
| Portraits: Mara, Calden, Ila, Tamsin, Hero | 128px | static | 100 | needs a dialogue portrait slot (dev) |
| Buildings: stone house, third house, Mara's stall, Ila's bench, Calden's rack | 96-192px | static | 10 | |
| Props: well, hive, lamp post, west + east gate | 32-128px | static | 10 | |
| Storage chest, closed + open | 40px | 2 frames | 4 | |
| Practice post | 40x72 | static (code wobble) | 2 | |
| Path tile + base tileset swap | 32px | — | 2 | |
| Far parallax: rooftops and trees | screen wide | static | 2 | near layers reuse Meadow West |
| **Subtotal** | | | **168** | |

### 3.3 Meadow East

| Asset | Size | Animation | Gens | Notes |
| --- | --- | --- | ---: | --- |
| Angry Bull | Boar recolour, scaled | + paw-and-snort wind-up | 6 | |
| Wool-Shoulder (named sheep) | sheep recolour, scaled | reuses sheep clips | 2 | one edit for the triple fleece |
| Hill tiles: slope edges, terrace ledge | 32px | — | 4 | on top of the base swap |
| Climbs: wooden ladder, knotted rope | 32px wide | static (code sway) | 4 | |
| Hills parallax | screen wide | static | 2 | Meadow West swap + one far layer |
| Decor: rocks, old stump prop | 32-160px | static | 4 | trees are Meadow West recolours |
| Charge dust puff | 32x24 | 4 frames | 8 | |
| **Subtotal** | | | **30** | |

### 3.4 Sunny Pasture

| Asset | Size | Animation | Gens | Notes |
| --- | --- | --- | ---: | --- |
| Decor: wildflower patch, broken fence, lone big tree, hay bale | 32-160px | static (code sway) | 8 | |
| Far parallax: open fields | screen wide | static | 2 | the rest is the Meadow West swap |
| **Subtotal** | | | **10** | |

### 3.5 Dirt Banks

| Asset | Size | Animation | Gens | Notes |
| --- | --- | --- | ---: | --- |
| Burrow Mole | 64px | idle, walk, burrow/pop-up, attack, hurt, die | 38 | |
| Earth Sprite | 64px | float, attack, hurt, die | 26 | |
| Ember Beetle | 64px | walk, attack, hurt, die | 26 | |
| Spark Bug (small, rare) | 48px | move, zap, die | 20 | hurt = code flash |
| Bank-Cracker (named mole) | mole recolour, scaled | + shoulder slam | 8 | |
| Cinderback (named beetle) | beetle recolour | reuses beetle clips | 0 | smoulder glow in code |
| Banks tiles: mud shelf, high bank ledge | 32px | — | 4 | on top of the base swap |
| Cave tileset (unique): rock floor, gallery ledge, wall/ceiling | 32px | — | 6 | |
| Root ladder, river surface strip | 32-128px | static (code ripple shader) | 4 | |
| Parallax: riverbank (1 layer + swap), cave (2 layers) | screen wide | static | 6 | |
| Decor: rock, river reeds, driftwood, stalagmite, crystal cluster, den bones | 16-96px | static | 12 | clod and stalactite are recolours or flips |
| Wall torch | 16x32 | static (code flicker, embers) | 2 | |
| Spark zap + ember spit | 24-48px | 4 frames each | 16 | |
| **Subtotal** | | | **168** | |

### 3.6 Whisperwood

| Asset | Size | Animation | Gens | Notes |
| --- | --- | --- | ---: | --- |
| Wisp | 64px | float, shoot mote, hurt, die | 26 | |
| Thornling | 64px | hop, throw, hurt, die | 26 | |
| Moss Lurker | 96px | ambush pop-up, walk, lunge-bite, hurt, die | 32 | |
| Mire Toad | 96px | hop, tongue, hurt, die | 26 | |
| Hollow Stag (miniboss) | 128px | idle, walk, charge, antler sweep, root stomp, phase-2, hurt, kneel death (8) | 70 | full set |
| Wren (NPC) | 96px | idle | 8 | |
| Wren portrait | 128px | static | 20 | |
| Forest tiles: bog edge | 32px | — | 2 | moss ground and branch ledge are swaps |
| Hanging vine, bog surface | 32-128px | static (code sway, ripple) | 4 | |
| Forest parallax: 3 trunk layers | screen wide | static | 6 | unique; fog and light shafts in code |
| Decor: old tree, dead tree, tent, fern, mushroom, reeds, lantern, Hollow arch | 12-165px | static (code glow) | 16 | glow mushroom is a recolour |
| Campfire | 44px | short flame loop | 8 | |
| Mob FX: wisp mote, thorn, root spikes, stag shockwave | 12-96px | 3-6 frames each | 32 | |
| **Subtotal** | | | **276** | |

### 3.7 Global

| Asset | Size | Animation | Gens | Notes |
| --- | --- | --- | ---: | --- |
| Hero, Leather: full set | 128px | 11 clips | 96 | re-dress + 4 per clip, ×2 |
| Weapon layers: 8 shapes cover all 12 (Club, Stone Club, Short Sword, Meadow Blade, Dagger, Bone Knife, Staff, Grove Staff) | ~24-48px | pinned at the hand | 16 | Steel Sword, Rusty and Steel Dagger, Worn and Steel Staff are recolours |
| Hat layers: Cap, Linen Hood, Trail Cap (cover all 5) | ~32px | pinned at the head | 6 | Cloth, Hide and Leather Cap are recolours |
| Item icons: about 100 live, about 75 unique shapes | 32-48px | — | 38 | sheets of about 4, with tiers recoloured |
| Skill icons (10 more live skills) | 36-48px | ready glow in code | 20 | one at a time |
| Passive icons (7) + buff/status icons (4) | 32-48px | — | 22 | |
| Skill FX: side slash, overhead smash, Power Strike, Earthbreaker, Flame Cleave, Root Lash, Rage, Dig In, Mana Shield | 32-160px | 4-8 frames each | 72 | code hit-stop, shake and particles on top |
| Spell FX: Magic Bolt, Fire Bolt, Thorn Volley, Chain Spark (projectile + impact) | 16-64px | loop + impact | 64 | |
| General FX: hit spark, crit spark, death poof, heal sparkle, level-up burst, pickup sparkle, Mara slap swipe | 24-96px | 4-8 frames | 56 | |
| UI 9-slice frames: button, slot, tooltip/dialogue, bar frame | 48-96px | — | 8 | everything else is CSS |
| **Subtotal** | | | **398** | |

## Deferred until needed
- **Chain and Plate hero looks** (about 96 each), when gear of that tier is added.
- **Later zones and parked content** (Old Stump, Night Stump, Frost Moth, the Shrine and Dusk Wisps, Soul Guard and the parked skills). They get their own concept sheet and batch once they're designed.
