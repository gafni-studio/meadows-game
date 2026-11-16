# Changelog

One section per release, newest first. The full write-up of each release is `docs/vX.Y.Z.md`; the spec it came from is `planning/vX.Y.Z.md`.

## v0.3.1 (playtest fixes: west of town)

The town gets a **west side**: Meadow West moves left of town (mirrored, mice by the gate) and a new **Sunny Pasture** (3–5) lies beyond it; Pell stands at the west gate and new Heroes go west first. Meadow East loses the Old Stump and its bull pack: the Meadow Boar is now a single **Angry Bull** in the grove, and a new level 5 **Boar** holds the terraces. Mara slaps the Hero (18 HP) so the strawberry visibly heals; the chest steps are gone. The Paths window opens on the new Path after a Path quest with its first skill pulsing; objectives show count lines; a green **farm list**; affordable skills glow; ready quests show bold gold with ✓. Plain stat wording, 1.0 s hit invulnerability, mobs no longer spawn inside hills, and a drop-range pass (1–2 for level 1–3 mobs, 1–3 for 4+). Write-up in `docs/v0.3.1.md`.

## v0.3.0 (The Split Meadows and Whisperwood)

The Meadows split into **Meadow West** (flat starter field), hilly **Meadow East** (terraces with Meadow Boars, a raised grove with the Old Stump), **Dirt Banks West** (river, mud shelves, root ladders) and **Dirt Banks East** (a cave with galleries and Bank-Cracker's pit), with vertical levels: **Up/Down** climbs ladders, ropes and vines, **Down + Space** drops through a ledge. North of Meadow East opens the **Whisperwood** (5–10): Wren's camp, Wisps, Thornlings, Moss Lurkers, Mire Toads, a three-tier canopy, the bog and the **Hollow Stag** miniboss (charge, sweep, root stomp, phase 2). A five-quest chain from Pell and Wren, three new materials and the Hollow Antler trophy, and every Path skill's rank recipes rewritten to follow the map. Write-up in `docs/v0.3.0.md`.

## v0.2.9 (fixes before Whisperwood)

A new Hero starts with **Welcome to Meadow Town**, an eleven-step walk through town where each NPC teaches one thing for a tiny gift, then **Path of the Warrior** (Calden) and **Path of the Magician** (Tamsin). Path trees stay hidden until their quest is done, other quests appear gradually by level, NPCs never hand over quest materials, rewards are about a third of what they were, and every quest has new copy and ends on a completion banner and the rewards screen. Also: a **Back** button in conversations, magic scaling with **INT**, a journal that shows only startable quests, a gray side slash for the basic attack, drops down 25% with no stack above 3 per kill (Copper excepted), and buffs and attacks only in their own slots. Write-up in `docs/v0.2.9.md`.

## v0.2.8 (Magician Path)

A second Path: ranged and MP-hungry. **Magic Bolt → Mana Shield → Fire Bolt / Thorn Volley → Chain Spark**, with projectiles you can see in the air, family-coloured effects and damage that lands when they arrive (Chain Spark leaps between foes, Fire Bolt burns, Thorn Volley throws three thorns, Mana Shield wards you for a third less damage). A new town NPC, **Tamsin**, runs the tutorial (**The Quiet Spell**). The Magician tab of the Paths window (**K**, Tab to switch) is a full tree. Write-up in `docs/v0.2.8.md`.

## v0.2.7 (Paths)

The character is the **Hero**, who walks **Paths**. The Warrior Path is a visual skill tree (**K**): train a skill once you have the one before it in the chain, no level gate. Equip slots are now **attack 1–4, buff 5–6, potions Q / G**. Calden has a short tutorial quest (**The Hero's Paths**). Also: a class-neutral **Club** as the starting weapon, a slash for the basic attack, Pell's quest markers, Field Mouse 4 XP / Wool Sheep 8 XP, and **E** closes the NPC window it opened. Write-up in `docs/v0.2.7.md`.

## v0.2.6 (rewards, markers, tougher mobs, real recipes)

Playtest notes on v0.2.5: a quest **rewards screen**, gold `!` / `?` **markers** over quest NPCs, an **Objectives (L)** button in the journal, `3/8` **progress counts**, exact shop gear and gear bonuses on the character screen, lower Warrior HP (100 + 7/level), whole-number passive production (1/h at rank 1), faster mobs with longer reach, wide patrols with give-up-when-stuck and ledge jumping, **contact damage** (40%), no skill queue, Frost Moth out of the Dirt Banks, five junk items gone, **twice the XP per level from level 4**, an explicit recipe for every rank of every live skill and passive (10–40 per material, no Heartwood), weaknesses and immunities (Flame Cleave is Immune on elemental mobs), and Hot Edge that can actually be started. Animations: the normal attack is the overhead smash, Power Strike is a forward axe cut, Flame Cleave is a fire fan. Write-up in `docs/v0.2.6.md`; sheet patch `scripts/sheet-patches/v0.2.6.py`.

## v0.2.5 (feel, drops, quests, talk)

Playtest notes on v0.2.4: a satisfying slash (trail to the real hit range, damage on the impact frame, hit-stop, crit shake, sparks) and a distinct animation for each skill; drop-rate pass; Earthbreaker trains with Earth Shard and Clay; Dig In is a simple 1-minute +50% defense buff; Rage is gone from the character sheet unless it's actually on; Bank-Cracker shows up in the Dirt Banks during A Crack in the Dirt; slightly faster swings and shorter attacking-skill cooldowns; a few longer mob reaches; three new quests (Ila's tree, Mara's coat, Pell's banks) with multi-line dialogue. Write-up in `docs/v0.2.5.md`.

## v0.2.4 (The Dirt Path)

Pell's first job past the east pasture: **The Dirt Path**, plus two new regulars in the Dirt Banks.

1. **The Dirt Path (B-001).** After you spend a first passive point, the journal opens this short hunt. Talk to Pell, defeat 4 Crows at the east end of Sunny Pasture, take the dirt path into the Dirt Banks, then defeat 5 Burrow Moles and 3 Ember Beetles and return to Pell. Rewards: 120 XP, 25 Copper, Nature Essence ×8, Elemental Essence ×5, Meadow Dew ×2 — a taste, not a skipped rank. No skill is granted.
2. **Spark Bug and Frost Moth** now wander the Banks (east and west ends). They share the Banks' roots, grit and warm stones, each drop a unique extra (Spark Shell, Pale Wing), and their warrior gear is rare (~1 in 150–200 kills). Monster Essence is more common than Elemental Essence. The Meadow Shrine stays closed.

Write-up in `docs/v0.2.4-dirt-path.md`. Warrior only; Soul Guard, the Shrine, and infusion stay parked.

## v0.2.3 (playtest notes)

Twenty-one playtest fixes on v0.2.2: lighter basic knockback, mob movement speed restored (animation stays slow), inventory click-to-select with tabs and gear comparison, hidden sell prices and roll ranges, quest-gated skills stay hidden until discovered, Earthbreaker and Flame Cleave unlock training only, Power Strike costs 20 Monster Essence, a Short Sword in Mara's shop, flat +1 attack per 2 STR, Rage tint and Wild Apple replaced by Strawberry and Blueberry, a nicer on-screen quest tracker (L), lower skill MP costs, more copper from Crows and Dirt Banks, a practice post you can hit from melee range with real damage numbers, and a one-shot skill cooldown queue. Write-up in `docs/v0.2.3-fixes.md`.

## v0.2.2 (passive tree + Ila)

The third playable milestone of v0.2.

1. **Nature and Elemental trees (T).** Each has a production node (category essence only) and an efficiency node. Rank 1 produces 1.5 essence/hour on a steep 1.6× curve; rank 0 yields nothing. Production continues while you are away. One upgrade at a time, 10 minutes for rank 1 (then 16, and so on). Spiritual and Hunter's Luck stay parked.
2. **Ila's 10:1 bench** is open in Meadow Town. Common Nature materials (including Dry Root) become Nature Essence; Earth Grit and listed shards become Elemental Essence. Enter exchanges one batch of ten.
3. Write-up in `docs/v0.2.2-passives.md`.

## v0.2.1 (Warrior quests)

The second playable milestone of v0.2. Nature and Elemental **passive** trees follow in v0.2.2.

1. **Journal (J).** Four Warrior skill questlines: The Weight of a Swing (Power Strike at lv2), Blood Up (Rage at lv3), A Crack in the Dirt (Earthbreaker, from a Cracked Bank Stone), and Hot Edge (Flame Cleave, from a Smoldering Scale). A slim tracker sits on the HUD; Calden finishes talk and turn-in steps. Soul Guard / Shrine stay parked.
2. **Practice post** by Meadow Town's east gate: E to begin, then 3 basic **F** hits after the Twig turn-in grant Power Strike rank 1 and bind it to the hotbar. New characters start with potions only on 5 and 6 — skills are no longer known at rank 0.
3. **Named foes.** Wool-Shoulder, Bank-Cracker, and Cinderback spawn only on their hunt step and do not respawn. Cinderback always leaves a Live Ember (not a 100% drop-table roll, so droprate bonuses cannot multiply it).
4. **Root Lash and Dig In** (B-001) train at Calden once you meet the sheet gates (lv4+STR 6 / lv5+STR 7). Root Lash is a 145% line with knockback on non-bosses; Dig In is a 0.5s (+0.05s/rank) window of +100% defense and knockback immunity. Mixed recipes (Bark, Twig, and Earthbreaker's Twig override at r2) are live.
5. Full write-up in `docs/v0.2.1-quests.md`. Player-facing text in `docs/player-descs.md`.

## v0.2.0 (Dirt Banks)

The first playable milestone of the next Meadows area. Questlines, Root Lash / Dig In, and the Nature + Elemental passive trees follow in later v0.2 milestones.

1. **Dirt Banks is open.** The east portal in Sunny Pasture leads through to a dug-up stretch of bank (dirt ground, brown hills, rocks and clods). Burrow Moles, Earth Sprites and Ember Beetles hunt there (sheet spawn counts 6 / 4 / 4). The east path on to Meadow Shrine is still closed. Pell now points you at the dirt path.
2. **Shared materials plus Banks-weighted extras** (Pitch Book B-001, rates on the v0.1.3 rules): **Dry Root** (common Nature wood, sell 2, 10:1 essence — Mole 32%, Sprite 16%, Crow 12%, Sheep 10%) and **Tough Root** (uncommon, sell 5 — Mole 5%, Sprite 3%, Crow 2%). **Warm Stone** is sell-only junk (sell 70) on Ember Beetle 1.6%, Earth Sprite 1.0%, Frost Moth 0.8%.
3. **Stone Club**, a Warrior mid weapon a step above Meadow Blade: damage 15–18 (typical 16), ×1.15, STR 5, sell 80. Drops: Mole 0.24%, Sprite 0.16%, Crow 0.06%.
4. **Gear pools** on the new (and retuned) Banks mobs sit in the v0.1.3 band of about 1 piece per 150–200 kills: mole 0.56% (1/179), sprite 0.60% (1/167), beetle 0.62% (1/161). Crow's pool stays 0.67% after adding the club (hide cap/boots trimmed 0.08→0.07). Magic is still 1/12. Monster Essence stays more common than category essence. Full table in `docs/v0.2.0-dirt-banks.md`.
5. **Quest-start drops are live** (questlines themselves are the next milestone): **Cracked Bank Stone** (Mole 1.2%, Sprite 0.8%) and **Smoldering Scale** (Beetle 1.2%, Spark Bug 0.8%). Not sellable.
6. Dirt Banks mobs use `anim_speed` 0.5, `attack_min`/`attack_max` dice, and slightly distinct move speeds (mole 15, sprite 19, beetle 16).

## v0.1.3 (playtest notes)

1. **Gear is very rare:** about 1 piece per 150–200 kills per mob pool (mouse 0.54% / 1 in 185, sheep 0.66% / 1 in 152, crow 0.63% / 1 in 159). Individual entries are 0.06–0.18% (Crow's nine-item pool has to sit a touch under 0.1% on some mid weapons). Magic is still 1/12 of those already-rare drops. Full before/after in `docs/v0.1.3-drops.md`.

2. **Damage variance:** every player hit (basic and skills) rolls a 0.75–1.25× dice on top of the weapon's rolled instance damage, then crits (1.5×) on top of that. Monsters roll uniformly in `attack_min`–`attack_max` (≈0.75–1.25× their typical attack). Damage numbers visibly vary. Documented in `assumptions.DAMAGE` and `combat_formulas`.

3. **Slower movement and animation:** player speed 190 → 148 (≈−22%). Mobs another ≈28% slower (mouse 20, sheep 14, crow 27). Crow pebbles 120 px/s so the dodge ratio stays the same. Hero walk wobble is ~35% slower and follows actual move speed (mint sprig speeds it up). Attack FX are a bit slower but combat wind-ups and swing intervals are unchanged. Mob walk/idle/flap uses a per-monster `anim_speed` (Crow stays at 1, it looked fine; every other mob is 0.5, i.e. half the old frame rate).

4. **Subtler STR:** attack is `weapon × multiplier × (1 + main_stat × 1%)` instead of `(weapon + STR × 2) × multiplier`. At 6 STR a wooden sword is ≈11.7 attack (was 24). HP per STR is 2 (was 3). Weapon damage and skill ranks are the main damage sources. The skill preview no longer shows "150% → 150%" for an unlearned category skill — it spells out "Learn at 150%; further ranks +12% (162% at rank 2)".

5. **Drop audit:** Monster Essence is more common than category essence (36% 1–2 on every mob vs 16–20% 1–2 on themed mobs). That's a deliberate break from the original sheet draft (ME ~15%, Nature 20–30% before the v0.1.2 double), because ME fuels every basic rank and Oded wanted it the other way around; category essence is the main gate and should feel earned. Copper, common mats and scrolls stay frequent; uncommons low; rares very low. Nature and Elemental skill recipes no longer ask for Holy Dust / Soul Dust / Holy Essence — Earthbreaker uses Pebble and Heartwood, Flame Cleave uses Earth Shard and Fire Crystal. Table in `docs/v0.1.3-drops.md`.

6. **XP −28%:** every monster's XP ×0.72 (Field Mouse 10 → 7). The level curve is unchanged, so about 10 mice to reach level 2 (was 7).

7. **Flexible hotbar:** slots 1–6 each hold a skill or a consumable. Bind from the training window (K) or the inventory (I): select, then press the slot number (replaces whatever was there; already-bound entries swap). Icons and stack counts show on the bar. New saves (and migrated old ones) default 5 to Meadow Dew and 6 to Clear Dew. Q and G still fire slots 5 and 6.

## v0.1.2 (playtest notes)

1. **Knockback ×3:** basic 420 px/s, Power Strike 1080 px/s (hitstun and knockback resistance unchanged).
2. **Contact melee + one ranged mob:** melee mobs only hurt you on body contact (4px reach, swing must still touch). New sheet column `monsters.attack_type` (melee / ranged): the **Crow** is ranged. It keeps 150-230px away, telegraphs, and throws a slow (150 px/s) pebble at chest height. Jump over it or walk away.
3. **Mobs move 2.5× slower:** mouse 28, sheep 20, crow 38 px/s.
4. **Nicer badges:** loot/info toasts slide in with the item icon and quantity ("Copper ×3"). Level-up shows a centered "LEVEL UP!" banner with a burst, a light beam and sparks, plus a short synthesized chime (WebAudio, no files). Nothing blocks input.
5. **Lower jump:** 60% of the old height (≈73px). Pasture platforms moved down to 2 and 4 tiles so they stay reachable.
6. **Regen ÷4:** 0.5% max HP/s after 5s out of combat, × (1 + 0.02 × SPI).
7. **Inventory slots:** 24 bag slots you can rearrange (mouse drag, or M → arrows → Enter). Drop items on the ground (X / drag out). Stacks and valuables ask first. Dropped items are normal pickups (E).
8. **Storage chest** in Meadow Town: two-panel window (chest 30 slots | bag), keyboard and mouse, saved with the character.
9. **Drops:** every `drop_tables.drop_rate` doubled (relative rarity unchanged). Quantities now roll `min_qty`-`max_qty` weighted toward the low end: copper 1-4, essences 1-3, Monster Essence 1-2, common materials 1-3, uncommon 1-2, rares 1. The drop multiplier (console `droprate`) raises chance **and** quantity: above 1× it stretches `max_qty` by 50% per extra 1×, and chance above 100% becomes a bonus roll.
10. **Monster HP −50%** in the sheet (mouse 55, sheep 75, crow 95, ...).
11. **Less predictable mobs:** random wind-up per swing (250-600ms), random recover (150-450ms), 15% feints (telegraph, then hop back without striking), random hesitation before closing in again, and a random choice of back off / hop over / pause.
12. **Monster accuracy:** ≈77-79% against an equal-level player; −3.5% for each level you're above the mob; floor 40%.
13. **Subtler levels:** 3 ability points per level (was 5), +10 HP per level (was 16), +3 HP per STR (was 4), +2 MP per level (was 4). Skill ranks scale harder instead (v0.2).

14. **Pickup animation:** loot pops up, then flies to you (same bounce-y feel as a drop). The toast with the icon and quantity appears when it arrives.
15. **Gear instances and ranges:** gear no longer stacks. Each piece rolls `defense` / `weapon_damage` from the sheet's min/max when it drops or is bought, and those rolls are saved on the item. The preview shows the rolled value, the range, and a low / avg / high quality color. Materials, currency, consumables and junk still stack. Old saves are migrated (equipped and bag gear become mid-roll, non-magic instances).
16. **More Meadows gear, split pools:** each class has a Hide (Warrior) / Linen (Mage) / Trail (Rogue) armor set plus a mid weapon (Meadow Blade, Grove Staff, Bone Knife). Each mob has its own pool — e.g. mice drop gloves, sheep drop vests and pants, crows drop caps, boots and the mid weapons. Shop cloth is a weaker stepping-stone.
17. **Impactful full set:** at level 1 with 0 points, a mid-roll Meadows drop set (Meadow Blade 14×1.15 + Hide armor, defense 10) is **+45% attack** and takes **~56% less** from a Crow vs basic (Wooden Sword, no armor). Hide and the Blade need 3 STR. Steel stays ultra-rare and above this. Skill training is still the main power-up. Numbers are in `assumptions.ts` and on the gear tab.
18. **Magic gear:** about 1/12 of gear drops (and shop rolls) come out magic, with a plain prefix (Sturdy, Keen, Bright, Swift, Hearty, …) and 1–2 extra bonuses (STR/INT/AGI/SPI, accuracy, crit, HP/MP, regen) rolled from ranges. Blue name and a ✦ on the tile. Category infusion is later (Pitch Book B-003).
19. **Console `whodrops <item>`:** lists every monster (and area) that drops it, with chance and quantity range. Partial names work (`whodrops hide`). It is in `help` and does not mark the save as cheated.
20. **Reset actually starts a fresh character:** both console `reset` and Esc → New game used to be undone by the tab-close autosave, which wrote the old character back during reload. Reset now sets a wipe flag, clears every `meadows*` key, skips autosave, and reloads. The menu asks first; Enter or Y confirms, N or Esc cancels.
21. **Player-facing descriptions:** tooltips and NPC/quest blurbs show a short `desc` (flavor only) plus stats. Design notes live in a separate `notes` column and are never shown. New descs are listed in `docs/player-descs.md`.


## v0.2 (skill training)

- **Calden** trains skills (E), and **K** opens the same window anywhere. Keyboard-first tile UI, consistent with the shop: arrows, Enter to learn/train, 1-6 to bind a known skill (inventory 1-6 binds a consumable), Esc to close. Preview shows the next-rank effect and the material + essence + coin cost (have / need).
- **Warrior, all 5 sheet skills** (the sheet lists 5 per class, not 6):
  - Power Strike and Rage are known at rank 0. Training rank 1+ costs 30 Monster Essence, 5 Training Scrolls and 20 Copper (× 1.6 each further rank).
  - Earthbreaker (Nature, lv 3 + 5 STR): 150% AoE slam + stun. Flame Cleave (Elemental, lv 6 + 10 STR): 200% wide swing + 3s burn (35% of the hit as DoT). Soul Guard (Spiritual, lv 8 + 15 STR): a shield absorbing 18% of max HP for 20s.
  - Category skills are learned at rank 1 (base value) and auto-bind to the first empty hotbar slot; they scale from rank 2.
- **Rank scaling** (v0.1.2 numbers): basic +5% / rank, nature +12%, elemental +10%, spiritual +10%. Damage skills add that many percentage points of the attack multiplier; buffs and the shield grow as effect × (1 + N% × ranks).
- Rares (Heartwood, crystals, shards) are only required at ranks 5 and 10.
- Mage and Rogue skills exist as sheet data (costs, icons, unlocks) but are not playable yet — there is no class select.
- Passive-tree production and Ila's 10:1 essence exchange are still later.

Console: `rank <skill> [n]` sets a rank (cheat); `train <skill>` pays the real cost.


## v0.1.1

- **Keyboard menus:** every window (NPC dialogs, quest dialog, shop, inventory, stats, Esc menu, erase-save confirm) works with arrows + Enter + Esc + Tab.
- **Shop and inventory as tile grids** with item icons and a preview panel. The shop has Buy/Sell tabs. The inventory has an equipment row plus the bag.
- **Combat feel:**
  - Monsters approach to reach, wind up (a red flash plus a "!"), then strike, back off, hop over to your other side, or pause. They no longer park on you.
  - Attacks roll a hit chance and show MISS.
  - Hits knock monsters back with hitstun (sheep are heavy, mice are light). You get pushed a little when hit.
- **Out-of-combat HP regen:** after 5s without taking damage or attacking, you regain 2% max HP/s (Spirit speeds it up). A green glow and a pulsing HP bar show it.
- **Real pixel art** (CC0) replaces the colored boxes.
- **Test console** (`` ` ``); see below.

## What's in v0.1

- Meadow Town (safe hub): Mara's shop (buys and sells per the `npc_shop` rules), Pell (hint, plus the first starter quest "A First Step" as a one-time reward), Calden (skill trainer — E opens the training window, also available anywhere with K), and Ila (essence exchange, later). East gate to Sunny Pasture.
- Sunny Pasture: Field Mouse ×8, Wool Sheep ×5 and Crow ×3 (from `map_layout.spawn_counts`), with timed respawns (`monsters.respawn_s`). Passive mobs fight back once hit; aggressive mobs (Crow) aggro within 8 tiles. They leash at 20 tiles from spawn and walk home with HP reset. One-way platforms. The east path leads to the Dirt Banks (v0.2.0); Meadow Shrine further east is still closed.
- Warrior only. Real-time melee, single target, with damage numbers and crits.
  - Power Strike: 140% damage, 8 MP, 1s cooldown.
  - Rage: +15% damage dealt and +10% damage taken for 60s, 12 MP.
  - The skill numbers come from the `skills` tab.
- Combat math comes from `combat_formulas`: attack, damage with the minimum-damage rule, crit, attack interval, incoming damage minus armor, HP/MP by level and stats, and MP regen.
- Drops are rolled independently per `drop_tables` row. Drops appear on the ground, rare ones (<1%) pulse orange, and you pick them up with E.
- Inventory with coins, consumables (use buttons and hotkeys), gear equip/unequip, and stat requirements.
- XP curve comes from `xp_to_next_N` (the formula is used beyond level 10). Each level gives 5 ability points, full HP/MP and 1.5s of invulnerability.
- Death costs 5% of current-level XP progress (you can't lose a level). You respawn in town after 3s at full HP/MP and keep your items.
- localStorage save (`meadows.save.v1`): autosaves every 10s, on area change, level-up, shop actions and tab close. To start fresh: Esc → New game (erase save) → Enter or Y to confirm (N or Esc cancels). Console `reset` does the same without a confirm. Reset clears every `meadows*` key and blocks autosave / tab-close from writing the old character back.

**Not in v0.1:** Mage and Rogue, skill ranking, the passive tree, the essence exchange, the full quest chain, other Meadows areas, bosses, crafting, server and multiplayer, mobile controls.

