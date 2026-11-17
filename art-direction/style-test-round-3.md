# Style test — round 3 (PixelLab free trial)

**For Claude Code.** Continue on your branch `claude/stoic-pasteur-ehwb9l` and don't merge it into main. First pull main's guides into the branch (`art-direction/README.md`, `planning/art-plan.md`).

**Goal:** keep round 2's approved look (subtle pixelation, the "hero 3" style) and fix the three problems below.

**Fixes:**
- **Size:** round 2's hero was 96 px. Generate the hero from the largest converter source (about 320 px tall) and halve it to about **160 px** on the 1920×1080 canvas. Put the sheep and the sword at the same scale.
- **Run cycle:** run replaces walk as the default movement. Make a Leather run, and check its frame timing, leg alternation, body bob and foot sliding.
- **Sword in hand:** the Wooden Sword stays a separate layer. Record a hand point and angle on every idle and run frame, then pin and rotate the sword to it so it moves with the hero.

**Budget:** about 16 trial generations are left; use about 8 or fewer.

**Deliver:** a 1920×1080 in-game mock at 1:1, with the hero running with the sword in hand and the sheep nearby. Commit the outputs under `art-direction/tests/round-3/` on the branch. Report the mock path, the generations used and anything still off, then **stop** and wait for Oded's feedback.
