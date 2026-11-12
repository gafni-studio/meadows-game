# Player-facing `desc` copy (v0.1.2)

The sheet is the source of truth. `desc` is shown in game (tooltips and NPC/quest blurbs).
`notes` holds design reasoning and is never shown. Mechanical effects (heal amounts, skill `effect`) are shown as stats.

## Sheet tabs and columns (mirror these into the Google Sheet)

- **items** — new column `desc` (player-facing). Existing `notes` stays design-only. Existing `description` is kept in sync with `desc`. Consumable effects such as "Restores 40 HP" were moved into `notes` (the game parses them for the stats block).
- **gear** — new column `desc` (flavor only; rolled ranges stay as stats). `description` is kept in sync with `desc`.
- **skills** — new columns `desc` and `notes`. The old `description` text (design reasoning) was moved into `notes`. `description` is now in sync with `desc`.
- **starter_quests** — new column `desc` (short player-facing blurb). `notes` and the longer `objective` stay for design; the game should show `desc`.
- **npcs** — new tab, columns `id`, `name`, `role`, `desc`, `notes`.

## Items

- `twig` — A small dry twig.
- `bark` — A strip of bark from a meadow tree.
- `branch` — A sturdy branch.
- `log` — A plain cut of meadow wood.
- `heartwood` — Dense wood from the center of an old stump.
- `pebble` — A small smooth pebble.
- `clay` — A lump of soft meadow clay.
- `stone_chunk` — A rough chunk of stone.
- `copper_nail` — A bent copper nail from old fences.
- `wool` — A tuft of plain wool.
- `feather` — A common bird feather.
- `fur` — A small scrap of fur.
- `leather_scrap` — A small piece of tough leather.
- `earth_grit` — A pinch of common elemental earth grit.
- `earth_shard` — A small shard of elemental earth energy.
- `earth_crystal` — A crystal of elemental earth energy.
- `fire_shard` — A small shard of elemental fire.
- `ice_shard` — A small shard of elemental ice.
- `lightning_shard` — A small shard of elemental lightning.
- `holy_dust` — A pinch of faint holy dust.
- `holy_essence` — A small amount of holy essence.
- `soul_dust` — A pinch of faint soul dust.
- `soul_shard` — A small shard of soul essence.
- `cursed_dust` — A pinch of cursed dust.
- `nature_essence` — A vial of green essence drawn from living things.
- `elemental_essence` — A vial of raw elemental essence.
- `spirit_essence` — A vial of pale essence drawn from spirit.
- `monster_essence` — A small vial of essence left by a fallen creature.
- `training_scroll` — A plain training scroll.
- `copper_coin` — A simple copper coin.
- `meadow_dew` — A sip of meadow dew.
- `clear_dew` — A sip of clear dew.
- `spring_draught` — A flask of spring water mixed with herbs.
- `mint_draught` — A mild mint drink.
- `barley_cake` — A plain barley cake from town.
- `wild_apple` — A small wild apple.
- `mint_sprig` — A sprig of fresh mint.
- `broken_twig` — A snapped twig, too broken to use as material.
- `lost_button` — A plain lost button.
- `old_bone` — An old dry bone.
- `torn_cloth` — A scrap of torn cloth.
- `cracked_shell` — A cracked, empty shell.
- `wooden_sword` — A plain wooden sword.
- `worn_staff` — A worn wooden staff.
- `rusty_dagger` — A rusty dagger.
- `cloth_tunic` — A simple cloth tunic.
- `leather_cap` — A simple leather cap.
- `leather_boots` — A pair of simple leather boots.
- `cloth_cap` — A simple cloth cap.
- `cloth_pants` — A simple pair of cloth pants.
- `cloth_shoes` — A simple pair of cloth shoes.
- `cloth_gloves` — A simple pair of cloth gloves.
- `leather_vest` — A simple leather vest.
- `leather_pants` — A simple pair of leather pants.
- `leather_gloves` — A simple pair of leather gloves.
- `iron_ore` — A chunk of raw iron ore.
- `fire_crystal` — A crystal of elemental fire.
- `steel_sword` — A well-forged steel sword.
- `steel_staff` — A well-forged steel staff.
- `steel_dagger` — A well-forged steel dagger.
- `pasture_bell` — A small dull bell, the kind some sheep wear.
- `bright_bead` — A cheap bright bead.
- `fence_peg` — A short wooden peg from an old fence.
- `warm_grain` — A grain of dirt that still holds a little warmth.
- `worn_charm` — A plain charm, left at the shrine long ago.
- `old_sap` — A sticky drip of sap from an old stump.
- `shiny_stone` — A smooth stone pushed up from the dirt. Pretty, but just a stone.
- `old_coin_purse` — A lost purse, dirt still on the stitch.
- `glass_chip` — A small chip of old glass from the soil.
- `copper_bit` — A tiny scrap of copper.
- `silver_thread` — A short length of fine, pale thread.
- `shrine_pin` — A small pin left at the meadow shrine.
- `evening_bead` — A dark bead, easy to miss until evening.
- `amber_drop` — A hard drop of old sap that caught the light.
- `tarnished_ring` — An old ring, once caught in stump roots.
- `old_key` — A small, rusty key.
- `meadow_blade` — A sturdy farm blade, better than a practice sword.
- `grove_staff` — A staff cut from a grove tree.
- `bone_knife` — A sharp knife carved from bone.
- `hide_cap` — A cap of meadow hide, stitched for a warrior.
- `hide_vest` — A vest of thick meadow hide.
- `hide_pants` — Hide trousers, scuffed from the pasture.
- `hide_boots` — Sturdy hide boots for rough grass.
- `hide_gloves` — A pair of hide gloves, still a little stiff.
- `linen_cap` — A light linen hood.
- `linen_vest` — A simple linen robe, cool in the sun.
- `linen_pants` — Linen wraps for walking the meadow.
- `linen_boots` — Soft linen sandals.
- `linen_gloves` — Light linen sleeves for the hands.
- `trail_cap` — A worn cap for the trail.
- `trail_vest` — A light vest that will not catch on brush.
- `trail_pants` — Trail pants, easy to move in.
- `trail_boots` — Quiet boots for the path.
- `trail_gloves` — Thin gloves that keep a firm grip.

## Skills

- `rage` — Channel fury to hit harder for a short time.
- `power_strike` — A heavy blow that hits harder than a normal swing.
- `earthbreaker` — Slam the ground and stagger nearby foes.
- `flame_cleave` — A wide flaming swing that leaves enemies burning.
- `soul_guard` — A shield of spirit that takes the next hits for you.
- `energy_shield` — Wrap yourself in a ward that dulls and reflects blows.
- `energy_blast` — A bolt of raw energy thrown from a distance.
- `thorn_bind` — Vines lash out and hold a foe in place.
- `firebolt` — A searing bolt that sets the target alight.
- `holy_light` — A burst of light that harms foes and mends you.
- `stealth` — Slip into the shadows and become harder to hit.
- `backstab` — A precise strike from hiding that finds a weak spot.
- `venom_strike` — A poisoned blade that keeps hurting after the cut.
- `lightning_dash` — Dash through your enemies in a crack of lightning.
- `shadow_mark` — Mark a foe so every hit that follows bites deeper.

## Quests

- `sq_welcome` — Talk to Pell, walk to the Sunny Pasture gate, and come back.
- `sq_first_fight` — Defeat 5 Field Mice in Sunny Pasture and return to Pell.
- `sq_loot` — Pick up 6 items in Sunny Pasture and talk to Pell.
- `sq_shop` — Sell a bit of junk to Mara, then buy a Meadow Dew or a Barley Cake.
- `sq_spend_points` — Open your stats (C) and spend your first ability points.
- `sq_essence_lesson` — Bring Calden a vial of Monster Essence from a Meadows monster.
- `sq_rank_skill` — Train a basic skill to rank 1 at Calden, or press K.
- `sq_exchange` — Bring Ila 10 Nature commons and exchange them for 1 Nature Essence.
- `sq_first_passive` — Open the passive tree (T) and spend your first point.

## NPCs

- `mara` (shop) — I buy junk and sell supplies for the pasture.
- `pell` (hint) — Welcome to Meadow Town! Head east to Sunny Pasture — mice and sheep leave you be unless you hit them, but watch the crows. Press E to pick up drops, sell junk to Mara, and train with Calden.  (190 chars; tutorial dialog is longer on purpose.)
- `calden` (trainer) — Bring me Monster Essence and Training Scrolls to rank your skills. Nature, Elemental and Spiritual skills need their own essence and materials.
- `ila` (soon) — I'm not exchanging essence just yet. Hold on to your Twigs, Bark and Wool.



## v0.2.0 Dirt Banks

- `dry_root` — A dry root, tougher than a twig.
- `tough_root` — A thick, stubborn root.
- `warm_stone` — A stone that still holds a little warmth.
- `stone_club` — A heavy club of packed stone.
- `cracked_bank_stone` — A cracked stone from the dirt banks.
- `smoldering_scale` — A beetle scale that still glows at the edge.
- `pell` — Welcome text now mentions the open dirt path to the Dirt Banks.

## v0.2.1 — quests, Root Lash, Dig In

- **The Weight of a Swing.** Calden wants a real blow, not a wave. The practice post by the east gate will do.
- **Blood Up.** Rage is a bargain: you hit harder, and so does everything that hits you. Stay in the fight.
- **A Crack in the Dirt.** The stone wants to break more than itself. The Dirt Banks will finish the lesson.
- **Hot Edge.** Still warm. A clean, hot edge — if you can take it off Cinderback.
- **Live Ember.** A scale still hot from Cinderback's shell.
- **Root Lash.** Roots snap out in a line and yank foes that are not bosses.
- **Dig In.** A short window of doubled defense. You will not be pushed.
- **Practice Post.** A worn post by Meadow Town's east gate. F, not a skill.
- **Wool-Shoulder / Bank-Cracker / Cinderback.** Named foes. They only appear when your journal asks for them.

## v0.2.2 — passives and Ila

- **Nature Essence (tree).** Slowly produces Nature Essence while you play or are away. Rank 0 yields nothing.
- **Elemental Essence (tree).** Slowly produces Elemental Essence while you play or are away. Rank 0 yields nothing.
- **Forager's Eye.** While hunting, Nature materials and Nature Essence drop a little more often.
- **Elemental Attunement.** While hunting, Elemental materials and Elemental Essence drop a little more often.
- **Ila.** Ten of a common material for one essence. Nature, Elemental, or Spirit — look at what you're holding.
