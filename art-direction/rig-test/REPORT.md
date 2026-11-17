# Rig test: hero, report

Brief: [`brief.md`](brief.md). Branch: `claude/meadows-rig-test-brief-flyi1i` (main is untouched).

## What was made

| | |
| --- | --- |
| **Mock, 1920×1080** | [`out/mock-1920x1080.png`](out/mock-1920x1080.png): idle, run and attack (strike frame) at inspection size, with all three at game scale (160 px) underneath |
| **Recording** | [`out/rig-test.mp4`](out/rig-test.mp4) (1920×1080, 30 fps, 6.8 s), [`out/rig-test.gif`](out/rig-test.gif) (960 px, 25 fps) |
| **Contact sheets** | [`out/sheet-run.png`](out/sheet-run.png) (one 0.6 s cycle), [`out/sheet-attack.png`](out/sheet-attack.png) (0.86 s attack) |
| **Parts** | [`parts/`](parts/): 14 PNGs cut from `base.jpg`. `_rest.png` is all the parts put back together at rest, and it matches `base.jpg`. `_exploded.png` shows the painted joints |
| **Rig + preview** | [`preview/`](preview/): `rig.ts` (the bone rig), `anims.ts` (poses), `main.ts` (the mock scene), `public/hero.png` + `hero.json` (one 2048×512 atlas) + `rig.json` (bones) |
| **Tools** | `tools/cut_parts.py` (base.jpg → parts + atlas), `tools/capture.mjs` (exact frame-stepped recording), `tools/sheet.py` (contact sheets) |

Live preview: `npx vite art-direction/rig-test/preview`, then open the URL it prints.

### Parts
Head, hair (back and top, which swings over the head), scarf knot, scarf tail (the front point), torso, upper arm and forearm (front and back), thigh and shin/boot (front and back), plus the Wooden Sword.

- Every visible pixel comes from `base.jpg`. The background is removed by flood fill from the edges.
- Cuts run along lines that are already drawn: the sleeve roll, the boot cuffs, the crease between the legs, under the scarf and under the vest hem. A cut edge gets the same dark-brown outline only where it can show.
- **Hidden overlap**, painted in each part's own flat colour:
  - a round cap at every joint, which is the standard cutout trick: the limb turns about the cap's centre, so no gap opens;
  - the vest behind the front arm, with a shadowed shirt socket at the shoulder;
  - the neck under the scarf;
  - a hair cap under the swinging hair.
- **The sword** is the Wooden Sword from `concepts/round1.jpg`. The round-2 outputs aren't in the repo, and the round-1 `sword-wooden.png` is 68 px pixel art in the wrong style. It is pinned to the hand bone.

### Tool choice: a light custom rig in Phaser (no DragonBones/Spine)
- About 150 lines (`rig.ts`): 18 bones with forward kinematics. Each part is a flat image inside one root container that sits at the feet, so draw order is a simple list and doesn't have to follow the bone tree. For example, the scarf draws over the arm.
- **Squash and stretch** scale the root container, so the body squashes about the ground.
- **Secondary motion:**
  - Hair, scarf knot and scarf tail are damped angular springs. Each one feels its joint's acceleration, the parent bone's spin and air drag from running speed, so it lags, overshoots and settles on its own.
  - The body bob, breathing, head counter-motion and knee give are all in the poses.
  - The slash has a short swoosh drawn in code.
- **Why not DragonBones or Spine:** no editor, no runtime dependency, and no export step. Poses are code, so they're easy to tune and to drive from game state, such as run speed or an `onImpact` hook at the strike.
- **What it lacks:** mesh deformation and IK (see below). Spine would add both if we ever need them.
- **Mipmaps:** the atlas is power of two, so the 160 px in-game hero is downscaled cleanly.

### Animations
- **Idle:** 2.6 s breath, slow weight shift, knees give with the bob, lazy sword.
- **Run:** 0.6 s cycle:
  - the body is lowest just after each contact, where it squashes;
  - it stretches at mid-stride;
  - the knees fold during the swing-through and the torso leans forward;
  - the arms counter-swing, and the sword arm swings less because it's carrying.
- **Attack:** about 0.86 s in all:
  - 0.24 s wind-up: crouch, lean back, sword cocked behind the head;
  - a 0.06 s hang at the top;
  - 0.09 s over-the-top strike with a lunge, stretch and swoosh;
  - follow-through with a squash and a slight overshoot;
  - recovery to idle.

## Against the bar
- **The same face in every frame:** yes. The head is a single image and only rotates.
- **No joint gaps:** none at the angles used. The round caps cover the elbow, knee, hip and shoulder through the full attack swing.
- **Smooth, weighty motion:** the run reads as weighty: bounce, contact squash and lean. The attack has clear anticipation, a fast strike and follow-through.

## Where it still looks stiff, and why
1. **Feet slide in the attack lunge.** Without IK the feet move with the hips. Fix: two-bone IK on the legs (about 40 lines) so the feet stay planted.
2. **The torso is one rigid piece.** It tilts but never bends or twists, which is the most "puppet" thing in strong poses. Fix: split it into chest and hips (one more cut plus a painted overlap), or use mesh deformation (Spine).
3. **The back arm is a darkened copy of the front arm.** `base.jpg` hides it almost entirely, and only the glove shows. It reads fine in motion, but a drawn back arm would be better.
4. **Hard pivots at bent joints.** A 90° elbow or knee is two rigid pieces meeting at a cap, with no bulge or crease. That's fine at 160 px but visible at inspection size.
5. **The fringe moves with the head.** Only the back and top of the hair swing. The scarf tail is the front point, so it can't trail behind in the run, and a back tail would have to be drawn.
6. **One or two stray dark pixels** sometimes show by the heel at large size. These are leftovers from the cut, not yet cleaned up.

## Effort to rig a new mob (rough)
- **With a rig-ready base image** (side view, flat background, limbs clear of the body), about **half a day**:
  - about 2 h to cut the parts: polygons per part, joint caps and a rest-pose check;
  - about 1 h for the bones;
  - 2–3 h for idle, move, attack, hit and death.
- **If the generator gives separate parts on a sheet,** like `hero/parts-guide.jpg`: cutting drops to about 30 min, so **3–4 h** in all.
- **Bigger or odd shapes** (quadrupeds, the Hollow Stag) take more bones and caps: **about a day**.
- `rig.ts` and the tools are reused as they are. Each mob adds one cut table and one poses file.
