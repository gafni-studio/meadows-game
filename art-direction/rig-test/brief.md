# Rig test: hero

**For Claude Code.** Work on a new branch, not main. How you do it is your call.

**Goal:** prove that bone animation makes the hero feel alive and hand-made, not like a puppet.

**Inputs:** `hero/base.jpg` is the approved hero: side view facing right, in a rig-ready pose on flat grey. `hero/parts-guide.jpg` is a rough guide to how the hidden joint areas should look; it isn't exact.

**Make:**
- **Parts** cut from `base.jpg` so they match it exactly: head, hair, scarf (knot, plus a tail if needed), torso, and the upper arm, forearm, thigh and shin/boot for both the front and back sides. Remove the background, and paint in the hidden overlap at each joint.
- **A bone rig in Phaser** (DragonBones, Spine-style or a light custom rig). Animate **idle, run and a one-handed attack**, with the round-2 Wooden Sword (or a simple placeholder) pinned to the hand point.
- **Secondary motion:** hair and scarf follow-through, body bob, squash and stretch.

**Show:** a 1920×1080 mock of the hero idling, running and attacking, plus a short recording or GIF, and a live preview if that's easy.

**Bar:** smooth, weighty motion, no joint gaps, and the same face in every frame. If it looks stiff, say why instead of polishing it.

**Stop and report:** what you made, the tool you chose, and a rough effort estimate for rigging a new mob.
