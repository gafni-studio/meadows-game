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
   - Exact angle and offset for the selected bone, and the sword's layer (behind the body, normal, or in front).
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

**Keys:**
| Key | Action |
| --- | --- |
| Space | Play or pause |
| ← and → | Previous or next key |
| Insert | Add a key |
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo |
| Ctrl+C, Ctrl+V | Copy or paste the pose |
| Ctrl+S | Save |
| Esc | Deselect |

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
  - `layer`: the item layer, `back` or `front`.
- To play a clip, call `sample(clip, ms)`. It returns a pose, and `solve(rig, pose)` turns that pose into bone transforms.

## Develop
- `npm run studio`: dev server on port 5180.
- `npm run studio:build`: builds the site to `studio/dist`.

**Adding an asset:**
1. Write `rigs/<asset>/cut.py` and run it.
2. Add the asset to `rigs/index.json`.
