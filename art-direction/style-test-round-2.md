# Style test — round 2 (PixelLab free trial)

**For Claude Code.** Pull `gafni-studio/meadows-game` first. About 25 trial generations are left.

**Goal:** lock the round-1 look on the core assets, and check how it reads on a 1920×1080 canvas.

**Benchmark:** "hero 3" (the middle hero) in `art-direction/tests/round-1/comparison.png`. If that file isn't in the repo, save your round-1 comparison image there first.

**Assets (about 7 generations):**
- Hero, Leather and Cloth, idle (from `art-direction/hero/hero-locked-lineup.jpg`)
- Wool Sheep and the Wooden Sword (from `art-direction/concepts/round1.jpg`)
- One short Leather walk at 2× (about 3 generations)

**Rules:**
- Clean, detailed pixel art with subtle pixelation, not chunky retro.
- Generate at **2× game size** with the 1-generation converter in faithful mode (no Pro Flash), then remove the background and scale down to **exactly half** locally.
- Use the same scale for every asset, matching the hero lineup.
- Nothing is resized by the engine; everything is shown 1:1.
- Add no outline. Keep the converter's own outline.
- Commit the finishing script to `art-direction/tools/`.

**Budget:** at most 1 retry per asset, about 10 generations at most.

**Deliver:** commit the outputs under `art-direction/tests/round-2/`, plus a 1920×1080 in-game mock at 1:1. Report the mock path, the generations used, and anything that didn't match hero 3. Then **stop** and wait for Oded's feedback.
