# Rig test: polish 1

**For Claude Code.** Continue on your branch `claude/meadows-rig-test-brief-flyi1i`, and pull main for `hero/backarm-sword.jpg`. The direction is approved. This pass fixes the details below, and how you do it is your call.

**Fixes:**
- **Torso:** split it into chest and hips so the body bends.
- **Leg IK:** keep the feet planted, with no sliding in the lunge.
- **Back arm:** replace it with the drawn upper arm and gloved forearm from `hero/backarm-sword.jpg`.
- **Sword:** swap in the bigger wooden sword from the same image, about as long as the hero's leg. The current one is too small.
- **Run:** make it much less bouncy. The right leg trails behind and reads as a limp, so give both legs the same timing and stride.
- **Attack:** a horizontal side slash, not an overhead swing, with a natural wind-up rather than the arm flung straight back.
- **Combo (MapleStory-style):** hit 1 and hit 2 use two different slash animations, then a short pause, then the sequence repeats.
- **Impact from effects:** draw a simple procedural slash arc on each hit, inspired by https://godotshaders.com/shader/procedural-cyclic-slash/ (a Phaser shader or graphics). Add a small hit spark and a light camera shake if they're easy. A fuller effects pass comes later.

**Show:** an updated 1920×1080 mock and an MP4 recording of idle, run, and the 2-hit combo looping with its pause.

**Stop and report.** Next, after Oded approves this pass, is a sheep rig.
