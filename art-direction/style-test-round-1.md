# Style test — round 1 (PixelLab free trial)

**For Claude Code.** You have the PixelLab MCP on the free trial: 40 generations, canvas up to 200×200, standard tools only. Work in `gafni-studio/meadows-game`, and pull first.

## Goal
Check, before we pay for anything, that PixelLab can produce our **locked hero** and our style at game size. This round is a small test, not production.

## References
- **The locked hero:** `art-direction/hero/hero-locked-lineup.jpg`, showing the Cloth, Leather, Chain and Plate looks. Crop the look you need from it.
- **Round 1 concept sheet:** `art-direction/concepts/round1.jpg`, showing the sheep, the Wooden Sword, and the Wool, Feather, Health Potion and Copper Coin icons. Crop each one as the reference for that asset.
- These two sheets are our own art and the only images you may feed PixelLab.
- **Style rules:** the "Style rules" section of `art-direction/README.md`.
- **Motion feel only:** `art-direction/hero/hero-anim-mock.jpg`. Don't copy its flaws.
- Images in `art-direction/refs/` are third-party. Look at them, but never feed them to PixelLab.

**The hero:** fluffy white hair, a short orange knotted scarf (no cape), and a simple fitted body, about 4 heads tall. Side view facing right, bold dark-brown outlines, smooth and sharp, not pixelated.

## Method
- **Image-to-sprite from our sheets.** Use the hero from the lineup crop and the sheep, sword and icons from the concept-sheet crops, so shapes and colors match. Don't redesign from text.
- **Side view only, facing east.** West is a mirror, done in code.
- **Canvas 64 px or more** (the hero about 96–128 px tall), shown **1:1**. The trial caps the canvas at 200×200.
- **Smooth, not heavily pixelated:** crisp edges, no big-pixel stair-steps, no dithering, flat colors with one soft shade.
- **Consistent across every asset:** the same dark-brown outline, the same light from the top left, the same palette as the lineup.
- **Transparent background** on every sprite and icon.

## Round 1 assets (about 6 generations)

| # | Asset | Notes |
| --- | --- | --- |
| 1 | Hero, **Leather** look, idle frame | from the Leather crop of the lineup |
| 2 | Hero, **Cloth** look, idle frame | same pose, scale and canvas as #1 |
| 3 | **Wooden Sword** as its own layer sprite | from the concept sheet. Transparent, no hand. In the mock, pin it to the hero's hand (note the hand anchor in px). |
| 4 | **Wool Sheep**, idle frame | from the concept sheet. Same outline and light as the hero. |
| 5–6 | Item icons: **Wool**, **Health Potion** | from the concept sheet, about 32–48 px, icon only (the slot frame is UI) |
| opt | **Feather** and **Copper Coin** icons | only if the budget allows |
| opt | Short **walk** for the Leather hero (east) | only if the trial allows animation at this size |

## Budget rule
- At most **one retry per asset**. If the retry is still off, keep the best take and note why.
- **Stop after this round** and report. Don't start round 2, and don't spend the trial on extras.
- Check the balance before and after (`get_balance`), and report the generations used.

## Deliverable
1. Save every output (PNG, transparent) under `art-direction/tests/round-1/` with clear names, such as `hero-leather-idle.png` and `icon-wool.png`.
2. Composite **one 960×540 in-game mock** at 1:1 as `art-direction/tests/round-1/mock-960x540.png`:
   - **Background:** today's Meadow West look (sky `#aee3ff` and the grass ground tile `public/art/world/grass_top.png` along the bottom) or a plain placeholder ground strip.
   - The Leather hero holding the layered Wooden Sword, the Cloth hero, and the sheep, all standing on the ground.
   - The icons in a hotbar-style UI slot in a corner (dark slot, brown border).
3. Commit only the round-1 outputs and the mock, push, and report: the mock path, the generations used, and one line per asset (good, or what's off).
4. **Wait for Oded's feedback before round 2.**
