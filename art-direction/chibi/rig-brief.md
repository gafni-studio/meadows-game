# Chibi hero rig: first pass (brief for Claude)

**Goal.** Rebuild the hero as a simple cut-out bone rig in Phaser, built from `style/hero-rig-parts.jpg`, to replace the old hand-painted rig. This first pass covers three things:
- **Idle.**
- **Run**, the default movement: a MapleStory jog, not bouncy, with no limp.
- **The basic attack**, a 2-hit combo: a side slash, then an overhead smash, then a short pause (`style/hero-swings.jpg`, rows 1–2). Add a simple code slash-arc effect on each strike.

**Benchmark.** MapleStory's basic chibi characters. Use `style/hero-poses.jpg` and `style/hero-swings.jpg` as the keyframes and match them.

**Core rules**
- Few bones: head, torso, 2 arms and 2 legs. Add a forearm or shin bone only if it's needed.
- The sword is a separate layer pinned to a hand point, with an angle per frame.
- Gear is part swaps: gloves swap the forearms, boots the shins, chest armour the torso. Hats go on the head point.
- The hero is about 160 px tall on a 1920×1080 canvas, seen from the side and facing right. Style rules are in `../README.md` and `../../planning/art-plan.md`.
- You cut the parts out of the sheet, with clean background removal. Your earlier `cut_parts.py` is on branch `claude/meadows-rig-test-brief-flyi1i` at `art-direction/rig-test/tools/`.

**Budget.** One focused session. Don't touch mobs, NPCs or game systems yet.

**Stop point.** On a new branch, put the following in `art-direction/chibi/rig-pass-1/`:
- A short video: idle, a run loop, and 3 combos.
- A side-by-side of the rig against the pose sheets.
- A short `REPORT.md` listing known issues.

Then stop for Oded's review.
