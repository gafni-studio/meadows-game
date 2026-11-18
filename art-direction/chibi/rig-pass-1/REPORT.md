# Hero rig, pass 1: report

Brief: [`../rig-brief.md`](../rig-brief.md). Branch: `claude/festive-babbage-bdzucw`. `main` and the game are untouched.

## For review
| | |
| --- | --- |
| **Video** | [`hero-rig-pass-1.mp4`](hero-rig-pass-1.mp4) (1920×1080, 30 fps, 11 s), also as [`hero-rig-pass-1.gif`](hero-rig-pass-1.gif). It plays 3 s of idle, a 3.2 s run loop (A B C B), then 3 combos. The hero is shown large for review, with the same rig at game scale (160 px) underneath. |
| **Side by side** | [`compare.png`](compare.png): 9 sheet keyframes (idle, 2 run frames, 3 slash, 3 smash), each next to the rig in the same pose at the same scale. |
| **Still** | [`still.png`](still.png): hit 1 landing, with its slash arc and spark. |

## What was built
- **Parts** (`parts/`, cut by `tools/cut_parts.py`): 13 images cut from `style/hero-rig-parts.jpg`:
  - head, vest, scarf collar, scarf tail;
  - per arm, an upper arm (sleeve) and a forearm (glove);
  - per leg, a thigh and a shin (lower trouser and boot);
  - the sword.
  
  Every visible pixel comes from the sheet. The background is removed by flood fill, and pale JPEG fringe pixels on the edges are dropped. The only painted pixels are the hidden joint caps, sized to the limb's measured width so they never show as bumps. `parts/_rest.png` shows all the parts put back together at rest.
- **Rig** (`preview/rig.ts`): about 200 lines, carried over from the rig test and cut down. It has 17 bones: root, hips, torso, head, scarf tail, 3 per arm (shoulder, elbow, hand point) and 3 per leg (hip, knee, ankle).
  - The legs use 2-bone IK, so planted feet don't slide. A foot that moves between keys steps on an arc, the front foot first, so the hero never hops.
  - The scarf tail is a damped spring.
  - Squash and stretch scale the whole rig about the feet.
- **Sword:** its own layer, pinned to the hand point. Each key sets the blade's screen angle, and the hand angle is solved from it. A `yaw` value foreshortens the blade when it points toward the camera, as in the slash wind-up. The sword normally draws over the vest and under the sword hand.
- **Gear swaps are part swaps by design.** Gloves are the forearm image, boots are the shin image and chest armour is the vest image. A hat would be one more image on the head bone. Nothing is swapped yet.
- **Clips** (`preview/anims.ts`), keyed from the sheets:
  - **Idle:** 2.4 s breath with a slow weight shift.
  - **Run** (simplified on request): a plain 3-pose loop, A B C B, 1 s per cycle. In A the right (far) leg is forward, the left (near) leg is a bit behind, the left hand is forward and the right elbow is back. B is mid-switch, with the legs together and the arms down. C is A mirrored. The feet stay on the ground with no knee or foot lift, the stride is small (18 px), and there's no bob or squash. Because the feet never lift, the forward-moving foot slides on the ground. The grass scrolls at the feet's average speed.
  - **Combo** (1.16 s, then a 0.44 s pause):
    - **Hit 1, side slash** (swings row 1), lands at 0.20 s: wind-up with the blade low by the back hip, then the arm shoots out at shoulder height and the blade comes round flat.
    - **Hit 2, overhead smash** (row 2), lands at 0.68 s: the sword goes up behind the head, then he chops down into a deep lunge.
    - **Recover:** a step back into the stance.
- **Effects** (`preview/fx.ts`, unchanged from the rig test): a crescent slash arc drawn in code along each hit's path (a flat sweep for the slash, a vertical arc for the smash), a small spark, and an 80 ms light shake on the large hero only.

Live preview: `npx vite art-direction/chibi/rig-pass-1/preview`. To rebuild everything:
1. `python3 art-direction/chibi/rig-pass-1/tools/cut_parts.py`
2. `node art-direction/chibi/rig-pass-1/tools/capture.mjs`
3. `python3 art-direction/chibi/rig-pass-1/tools/compare.py`

## Judgment calls
- **Forearm and shin bones were added.** The brief allows them "if needed", and they are: the run's knees and the guard poses' elbows don't read with straight limbs, and they are what gloves and boots swap onto. The knee is mid-trouser rather than at the boot cuff, because a bend at the cuff looked like an ankle.
- **Legs at 88 %.** The parts sheet's legs are longer than on the pose sheets. I scaled them so the proportions sit closer to the keyframes, and the hero is now about 350 sheet px tall.
- **Arms at 82 %** to match the assembled hero on the parts sheet; at full size the hands hung to mid-thigh.
- **One arm piece and one leg piece for both sides.** The back arm and back leg are 20 % darker.
- **The scarf tail** comes from the assembled hero at the top of the parts sheet, because the parts row has only the collar.
- **The sword stays in hand while running.** The run row on the pose sheet has no sword. Holding it matches MapleStory and the sword-carrying frames in row 3.
- **Draw order:** the sword arm draws over the vest but behind the head, so the overhead wind-up matches the sheet. The scarf collar draws over the head, so the neck tucks into it.

## Known issues
- **The head is smaller than on the pose sheets.** The keyframe heroes have a bigger head and a stockier body than the parts sheet. The head is a single image, so scaling it is a one-line change once you pick a ratio.
- **The lunges are a little narrower and more upright than the sheet**, mainly in the smash strike. The legs reach their IK limit before the sheet's stance width, so the back leg can't stretch as far.
- **The side slash reads mostly through the arc.** The blade's path from the low guard to the forward point is short. A wider wind-up, with the blade further back, would sell the sweep better at the cost of matching frame 1.
- **The blend from run into the combo** is a 0.16 s cross-fade and looks a little soft. In the game, the attack would start from the current pose.
- **Run:** the forward-moving foot slides, because the feet never lift. The run frames in `compare.png` still show the earlier jog; only the video was re-exported.
- **The hair and fringe don't move.** The head is one piece with no hair spring, which the brief keeps out of scope.
- **Joints at strong bends** are two rigid pieces meeting at a cap. That's invisible at 160 px but visible at review size.
- **The parts are at sheet resolution** (hero about 350 px), so the review view upscales them about 1.6× and looks a little soft. At game scale they are downscaled cleanly through the power-of-two atlas with mipmaps.
- **Not done, per the brief:** no game wiring, no mobs or NPCs, and no walk, jump or climb clips.
