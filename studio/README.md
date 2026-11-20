# Meadows Animation Studio

A web tool for posing rigged assets and saving their animation clips. It is published to GitHub Pages by `.github/workflows/studio-pages.yml`.

**The split:** Claude cuts each asset's parts and builds its rig (`rigs/<asset>/`). People make every pose in the studio, and the studio saves them to `animations/<asset>.json`, which the game reads.

## Use it
1. **Pick** an asset and a clip at the top.
2. **Pose** the current key on the stage:
   - **Round handle:** turns that bone.
   - **Green handle** (hand or foot, with IK on): moves the whole limb.
   - **Orange handle:** an item, such as the sword.
   - **Purple square:** moves the hips. Pinned feet stay planted.
   - **Empty space:** drag to pan. Use the mouse wheel to zoom.
3. **Side panel:**
   - **Selected:** exact angle (slider, number, ±1°/±5° nudges) and offset for the selected bone, its picture, and its layer (▲ forward / ▼ back). Click any part on the stage to select it, including parts without a handle.
   - **Layers:** the draw order (z-order) of every part on the current key, front at the top. It switches at the key and doesn't blend. **Use on all keys** copies it to the whole clip.
   - **Picture:** for parts that have other pictures, such as an NPC head's `blink` and `talk`. A picture switches at its key and doesn't blend, so a blink is a key with `blink` followed by a short key without it.
   - Copy, paste, **mirror** (swap left and right) and reset the pose.
4. **Timeline:**
   - **Add key** duplicates the current key after it.
   - Each key sets **to next** (ms until the next key), **blend**, and an optional **event** (for example `hit`, for the game's impact hook).
   - **Blend** modes:
     - **smooth:** a curve through the neighbouring keys.
     - **linear**, **easeIn**, **easeOut**, **easeInOut**.
     - **hold:** stays on this pose until the next key.
   - **Play** loops the clip. Speed can be 0.25× to 2×.
5. **Save to GitHub** commits `animations/<asset>.json`. If saving isn't possible, use **Download** and commit the file by hand.

The **? Help** button (bottom right, or the <kbd>?</kbd> key) opens a panel that explains every control and how to build an animation.

**Keys:**
| Key | Action |
| --- | --- |
| Space | Play or pause |
| ← and → | Previous or next key |
| Insert | Add a key |
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo |
| Ctrl+C, Ctrl+V | Copy or paste the pose |
| Ctrl+S | Save |
| Delete | Delete the current key |
| [ and ] | Send the selected part back, or bring it forward |
| F, H | Fit the view; show or hide handles |
| ? | Help |
| Esc | Deselect, or close the help |

**Drafts:** every edit is also kept in this browser. If you close the tab before saving, the studio offers to restore your changes next time.

## GitHub token (once per browser)
Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new):
- **Resource owner:** gafni-studio.
- **Repository access:** only `meadows-game`.
- **Permissions:** Contents, Read and write.

Paste it in **⚙ Settings**. It is stored in this browser's localStorage and is only sent to `api.github.com`. Settings also has the repo and the branch; saves go to `main` by default.

## Files
| Path | What |
| --- | --- |
| `rigs/index.json` | the assets the studio lists, with their starting clips |
| `rigs/<asset>/cut.py` | cuts the parts from the art sheet and writes `atlas.png`, `atlas.json` and `rig.json` |
| `rigs/<asset>/rig.json` | bones (rest joints, handle tips, kinds), parts in draw order, IK chains, mirror pairs, item layers, springs |
| `animations/<asset>.json` | the clips (written by the studio) |
| `src/anim/rig.ts`, `src/anim/clip.ts` | the rig and clip code, shared by the studio and the game: FK, IK, sampling and events |
| `studio/` | the tool itself |

**Clip format:**
- `clips.<name>` has `loop` and `keys[]`. Each key has `ms` (time to the next key), `ease`, `event?` and `pose`.
- A pose has:
  - `a`: bone angles in degrees, clockwise, relative to the parent. 0 is the rest pose, and a missing bone is at rest.
  - `x`: offsets in rig px, for bones that move (the hips).
  - `order`: optional draw order for this key, back to front. The older `layer` field (item `back` or `front`) still plays. Use `drawOrder(rig, pose)` to get the order.
- To play a clip, call `sample(clip, ms)`. It returns a pose, and `solve(rig, pose)` turns that pose into bone transforms.

## Develop
- `npm run studio`: dev server on port 5180.
- `npm run studio:build`: builds the site to `studio/dist`.

**Adding an asset:**
1. Write `rigs/<asset>/cut.py` and run it.
2. Add the asset to `rigs/index.json`.

**Town NPCs** (`rigs/npc_cut.py`) share one simple rig:
- **Body:** a still body with the legs.
- **Head:** turns, and swaps to the `blink` and `talk` pictures.
- **Arms:** two arms, each a sleeve and a hand, with IK on the hand.
- **Item:** Pell's staff or Calden's sword.

Ila and Tamsin have no side-view closed-eye frame, so their `blink` is painted by hand. They are cut from one standing frame of each NPC sheet, and the body behind the arms and head is filled in from its own flat colours. To add an NPC, add a spec to `SPECS`, then run `python3 rigs/npc_cut.py <id>`.

**Meadow mobs** (`rigs/mob_cut.py`) share one rig:
- **Body:** moves (square handle) and tilts (round handle).
- **Legs:** two leg pairs that swing (the crow has one).
- **Body pictures:** whole frames from the sheet: `hurt`, `dead`, `strike`, and for the crow `fly_up` and `fly_down`.
- **Leg pictures:** each leg pair has a `none` picture, to hide it while the body shows a whole frame.

Base clips (idle, move, attack, hit, death; NPC idle and talk) came from `scripts/base-clips.ts` as rough starting points.
