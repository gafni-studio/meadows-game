# Meadows — Art plan

Every piece of art the game shows today or that the v0.3.1 spec implies, and how it gets made. Updated 2026-11-17 after the switch to a hand-painted, bone-rigged style.

**Status:** the pipeline below is approved. The full plan rewrite (per-asset rig lists and dev-time estimates) waits until the rig test ([art-direction/rig-test/brief.md](../art-direction/rig-test/brief.md)) is approved.

**Spending rule (approved):** put the effort where players feel it all the time: the hero, skills and their effects, mob animation, hit, level-up and pickup feedback, the first area (Meadow West) and portraits. Everywhere else, keep it simple: static scenery brought to life in code, recolours and CSS UI. Content that isn't settled waits until it's needed.

## Pipeline

1. **Static art: Grok Bot, free.** Hero parts, mobs, NPCs, icons, portraits, and backgrounds as parallax layers, all generated with the approved hero (`art-direction/rig-test/hero/base.jpg`) as the style reference. Rigged characters come as a rig-ready side-view pose plus a parts guide.
2. **Rigging and animation: Claude, in code.** Claude cuts the parts, paints in the hidden joint areas, builds a bone rig in Phaser, and animates it. Code adds secondary motion (hair, scarf, cloth), squash and stretch, and effects.
3. **Oded reviews** each batch in a 1920×1080 mock or a playable build before the next starts.

**Cost:** generation is about zero. The cost is now dev time: about one rig per character or mob, plus its clips.

## Approach

### Gear on the hero
- **Armour looks swap rig parts:** each look (Cloth, Leather, then Chain and Plate later) is a set of torso, arm and leg parts on the same rig, so every animation works with every look. The equipped body piece picks the look by tier: Cloth and Linen show Cloth; Hide, Leather and Trail show Leather.
- **Weapons and hats are pinned** to a hand point (with angle) and a head point on the rig, so they move with the hero. A new weapon or hat is one image.
- **Grip types:** one-handed (sword, club, dagger), two-handed, staff and bow. Each grip type has its own attack animations; idle, run and the other clips are shared. Only one-handed is needed now.
- **Tiers are recolours:** for example, the Steel Sword is a recoloured Short Sword.
- **Run is the default movement cycle.**

### Mobs
- Every mob gets a bone rig with **walk, attack, hurt and die**, plus idle. Small or rare mobs can use fewer clips plus code flashes; bosses get a full set.
- **Variants are recolours** with a code scale: Angry Bull from the Boar, and Wool-Shoulder, Bank-Cracker and Cinderback from their base mobs. One extra clip only where the behaviour differs.

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
- **Item icons:** one image per shape, and tiered items of the same type are recolours.
- **UI** is HTML/CSS. Five 9-slice frames give it texture: a panel, a button, a slot, a tooltip/dialogue box and a bar frame. Markers, nodes and banners stay CSS.
- **Font:** use an open-licence web font that suits the storybook look.

### Style
- **Smooth, hand-painted cartoon** with crisp dark-brown outlines, soft cel shading, a cozy storybook feel, chibi proportions and a side view only. The benchmark is `art-direction/rig-test/hero/base.jpg`. See [art-direction/README.md](../art-direction/README.md).

### Game canvas: 1920×1080 (dev task, needed before production)
- Switch the Phaser config to **1920×1080** with `Scale.FIT`, so the art shows at full resolution. Until the new art lands, scale today's placeholder textures 2× at load so nothing breaks.
- The hero is about **160 px** tall in game, and every other asset uses the same scale (about 1.3× the sizes in the inventory below).

## Process
1. **Concept sheet before every batch (standing rule).** Whenever new content (mob, item, NPC, area or gear) is added, Grok Bot makes a concept sheet in the hero's style, with every asset at the same scale as the hero. It goes in `art-direction/concepts/`, one sheet per area or batch (for example `concepts/meadow-west.jpg`). Oded approves it before any production art is made.
2. **Final art:** Grok Bot generates the approved pieces, and rig-ready parts for anything that animates.
3. **Claude rigs and animates** the pieces, and puts them in a 1920×1080 mock or a playable build.
4. **Oded's OK** comes before the next batch, one area at a time, in the inventory order.

## Asset inventory (by area)

One batch per area, in this order. A mob that appears in several areas is made once, where it first appears.

### 3.0 First batch (after the rig test)

One of each key thing, playable in a Meadow West build.

| Asset | Size | Animation | Notes |
| --- | --- | --- | --- |
| Hero, Cloth look: rig | 160px | idle, run, jump, fall, climb, one-handed slash, one-handed overhead smash, cast, hurt, death | Leather is a part swap |
| Boar (lvl 5) | 96px | idle, walk, attack (charge), hurt, die | the mob rig template |
| Base tileset: grass ground + plank platform | 32px tiles | — | recoloured for later areas |
| Meadow West parallax: far hills, near hills, clouds | screen wide | static (code scroll and drift) | sky is a code gradient |
| Pell (NPC) | 96px | idle | talk bounce in code |
| Pell portrait | 128px | static | |
| House (red roof) | 192x144 | static | |
| UI panel 9-slice frame | 48-96px | — | |
| Power Strike skill icon | 36-48px | — | |
| Basic slash effect | 64x40 | short loop | code adds hit-stop, shake and particles |

### 3.1 Meadow West (first area: full quality)

| Asset | Size | Animation | Notes |
| --- | --- | --- | --- |
| Field Mouse | 64px | idle, walk, attack, hurt, die | |
| Wool Sheep (rest of set) | 64px | walk, headbutt, hurt, die | |
| Crow (also Sunny Pasture, Meadow East) | 64px | fly, throw pebble, hurt, die | hovers above the surface |
| Crow pebble | 22px | static (code spin, impact puff) | |
| Decor: round tree, tall tree, bush, fence, sign, flower tuft, grass tuft | 32-96px | static (code sway) | unique pieces |
| Portal / exit marker | 40x80 | static (code glow) | |

### 3.2 Meadow Town

| Asset | Size | Animation | Notes |
| --- | --- | --- | --- |
| Mara, Calden, Ila, Tamsin (NPCs) | 96px | idle (+ Mara's slap) | |
| Portraits: Mara, Calden, Ila, Tamsin, Hero | 128px | static | needs a dialogue portrait slot (dev) |
| Buildings: stone house, third house, Mara's stall, Ila's bench, Calden's rack | 96-192px | static | |
| Props: well, hive, lamp post, west + east gate | 32-128px | static | |
| Storage chest, closed + open | 40px | 2 frames | |
| Practice post | 40x72 | static (code wobble) | |
| Path tile + base tileset swap | 32px | — | |
| Far parallax: rooftops and trees | screen wide | static | near layers reuse Meadow West |

### 3.3 Meadow East

| Asset | Size | Animation | Notes |
| --- | --- | --- | --- |
| Angry Bull | Boar recolour, scaled | + paw-and-snort wind-up | |
| Wool-Shoulder (named sheep) | sheep recolour, scaled | reuses sheep clips | one edit for the triple fleece |
| Hill tiles: slope edges, terrace ledge | 32px | — | on top of the base swap |
| Climbs: wooden ladder, knotted rope | 32px wide | static (code sway) | |
| Hills parallax | screen wide | static | Meadow West recolour + one far layer |
| Decor: rocks, old stump prop | 32-160px | static | trees are Meadow West recolours |
| Charge dust puff | 32x24 | 4 frames | |

### 3.4 Sunny Pasture

| Asset | Size | Animation | Notes |
| --- | --- | --- | --- |
| Decor: wildflower patch, broken fence, lone big tree, hay bale | 32-160px | static (code sway) | |
| Far parallax: open fields | screen wide | static | the rest is the Meadow West swap |

### 3.5 Dirt Banks

| Asset | Size | Animation | Notes |
| --- | --- | --- | --- |
| Burrow Mole | 64px | idle, walk, burrow/pop-up, attack, hurt, die | |
| Earth Sprite | 64px | float, attack, hurt, die | |
| Ember Beetle | 64px | walk, attack, hurt, die | |
| Spark Bug (small, rare) | 48px | move, zap, die | hurt = code flash |
| Bank-Cracker (named mole) | mole recolour, scaled | + shoulder slam | |
| Cinderback (named beetle) | beetle recolour | reuses beetle clips | smoulder glow in code |
| Banks tiles: mud shelf, high bank ledge | 32px | — | on top of the base swap |
| Cave tileset (unique): rock floor, gallery ledge, wall/ceiling | 32px | — | |
| Root ladder, river surface strip | 32-128px | static (code ripple shader) | |
| Parallax: riverbank (1 layer + swap), cave (2 layers) | screen wide | static | |
| Decor: rock, river reeds, driftwood, stalagmite, crystal cluster, den bones | 16-96px | static | clod and stalactite are recolours or flips |
| Wall torch | 16x32 | static (code flicker, embers) | |
| Spark zap + ember spit | 24-48px | 4 frames each | |

### 3.6 Whisperwood

| Asset | Size | Animation | Notes |
| --- | --- | --- | --- |
| Wisp | 64px | float, shoot mote, hurt, die | |
| Thornling | 64px | hop, throw, hurt, die | |
| Moss Lurker | 96px | ambush pop-up, walk, lunge-bite, hurt, die | |
| Mire Toad | 96px | hop, tongue, hurt, die | |
| Hollow Stag (miniboss) | 128px | idle, walk, charge, antler sweep, root stomp, phase-2, hurt, kneel death (8) | full set |
| Wren (NPC) | 96px | idle | |
| Wren portrait | 128px | static | |
| Forest tiles: bog edge | 32px | — | moss ground and branch ledge are swaps |
| Hanging vine, bog surface | 32-128px | static (code sway, ripple) | |
| Forest parallax: 3 trunk layers | screen wide | static | unique; fog and light shafts in code |
| Decor: old tree, dead tree, tent, fern, mushroom, reeds, lantern, Hollow arch | 12-165px | static (code glow) | glow mushroom is a recolour |
| Campfire | 44px | short flame loop | |
| Mob FX: wisp mote, thorn, root spikes, stag shockwave | 12-96px | 3-6 frames each | |

### 3.7 Global

| Asset | Size | Animation | Notes |
| --- | --- | --- | --- |
| Hero, Leather look | 160px | rig part set (torso, arms, legs) | uses the Cloth rig and clips |
| Weapon layers (pinned to the hand point and angle): 8 shapes cover all 12 (Club, Stone Club, Short Sword, Meadow Blade, Dagger, Bone Knife, Staff, Grove Staff) | ~24-48px | pinned at the hand | Steel Sword, Rusty and Steel Dagger, Worn and Steel Staff are recolours |
| Hat layers: Cap, Linen Hood, Trail Cap (cover all 5) | ~32px | pinned at the head | Cloth, Hide and Leather Cap are recolours |
| Item icons: about 100 live, about 75 unique shapes | 32-48px | — | sheets of about 4, with tiers recoloured |
| Skill icons (10 more live skills) | 36-48px | ready glow in code | one at a time |
| Passive icons (7) + buff/status icons (4) | 32-48px | — | |
| Skill FX: side slash, overhead smash, Power Strike, Earthbreaker, Flame Cleave, Root Lash, Rage, Dig In, Mana Shield | 32-160px | 4-8 frames each | code hit-stop, shake and particles on top |
| Spell FX: Magic Bolt, Fire Bolt, Thorn Volley, Chain Spark (projectile + impact) | 16-64px | loop + impact | |
| General FX: hit spark, crit spark, death poof, heal sparkle, level-up burst, pickup sparkle, Mara slap swipe | 24-96px | 4-8 frames | |
| UI 9-slice frames: button, slot, tooltip/dialogue, bar frame | 48-96px | — | everything else is CSS |

## Deferred until needed
- **Chain and Plate hero looks** (about 96 each), when gear of that tier is added.
- **Later zones and parked content** (Old Stump, Night Stump, Frost Moth, the Shrine and Dusk Wisps, Soul Guard and the parked skills). They get their own concept sheet and batch once they're designed.