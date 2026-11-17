#!/usr/bin/env python3
"""Finish a PixelLab 2x sprite for Meadows: remove background, scale to exactly half.

Recipe (art-direction/README.md): generate at 2x game size with the
1-generation converter in faithful mode, then run this. No outline is added.

  python3 art-direction/tools/finish.py IN.png OUT.png [--tol 22] [--shadow-rows 8] [--leg-gaps 0.65]
  python3 art-direction/tools/finish.py --frames IN_0.png IN_1.png ... --out-dir DIR [--ref-from IDLE_2X.png]

Steps:
1. Background key (run twice, before and after step 2): the converter returns an opaque cream background. The
   background colour is the median border pixel; every pixel within `tol`
   (sum of RGB differences) that is connected to the border becomes
   transparent. Flood fill, so light colours inside the sprite (white hair,
   wool) survive. Keep `tol` low (about 22): hair leaks at 40.
2. Ground shadow: the concept sheets draw a pale shadow under the feet.
   Light pixels (RGB sum > 540) in the bottom `shadow-rows` rows of the
   sprite's bounding box are cleared. Use 0 for props and icons.
   Characters: --leg-gaps 0.65 also clears background pockets enclosed
   between the legs (low in the sprite only, so hair and wool are safe).
   Leave none: an animation spreads a leftover pocket into a smear.
3. Scale: with --height H the sprite is scaled to that height (animation
   frames, see to_height). Otherwise half scale: exact 2:1 Lanczos on premultiplied alpha (no colour fringes),
   which keeps the converter's own outline. Width and height must be even.
"""
import argparse
import sys
from collections import deque

from PIL import Image


def ref_of(im):
    w, h = im.size
    px = im.load()
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)]
    border += [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    # Some outputs already come with part of the border transparent: take the
    # reference from the opaque border pixels only.
    opaque = [c for c in border if c[3] > 0] or [(255, 255, 255, 255)]
    return sorted(opaque, key=lambda c: sum(c[:3]))[len(opaque) // 2]


def key_background(im, tol):
    im = im.convert("RGBA")
    return key_background_ref(im, ref_of(im), tol)


def key_background_ref(im, ref, tol):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def is_bg(c):
        return c[3] == 0 or sum(abs(c[i] - ref[i]) for i in range(3)) <= tol

    seen = set()
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    # Also grow from pixels that are already transparent, so pockets opened by
    # the shadow pass (the gap between the legs) are keyed on the second pass.
    q.extend((x, y) for y in range(h) for x in range(w) if px[x, y][3] == 0)
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        if is_bg(px[x, y]):
            px[x, y] = (0, 0, 0, 0)
            q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im


def clear_shadow(im, rows):
    if rows <= 0 or im.getbbox() is None:
        return im
    px = im.load()
    _, _, _, bottom = im.getbbox()
    for y in range(max(0, bottom - rows), bottom):
        for x in range(im.width):
            c = px[x, y]
            if c[3] and sum(c[:3]) > 540:
                px[x, y] = (0, 0, 0, 0)
    return im


def clear_leg_gaps(im, ref, tol, frac):
    """Clear enclosed background pockets (the gap between the legs) whose top
    is below `frac` of the sprite height. Only low pockets, so cream hair or
    wool higher up is never touched."""
    if frac <= 0 or im.getbbox() is None:
        return im
    px = im.load()
    w, h = im.size
    _, top, _, bottom = im.getbbox()
    limit = top + frac * (bottom - top)
    near = lambda c: c[3] and sum(abs(c[i] - ref[i]) for i in range(3)) <= tol
    seen = set()
    for y0 in range(h):
        for x0 in range(w):
            if (x0, y0) in seen or not near(px[x0, y0]):
                continue
            comp, q = [], deque([(x0, y0)])
            seen.add((x0, y0))
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and near(px[n]):
                        seen.add(n)
                        q.append(n)
            if min(y for _, y in comp) >= limit:
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)
    return im


def half(im):
    if im.width % 2 or im.height % 2:
        sys.exit(f"size {im.size} is not even; generate at an even 2x size")
    return im.convert("RGBa").resize((im.width // 2, im.height // 2), Image.LANCZOS).convert("RGBA")


def to_height(im, height):
    """Scale to an exact height (width follows, rounded to even). Used for
    animation frames: the animation tools cap a frame at 256 px, so a hero
    that must end up 160 px tall is animated at 256 and scaled by 0.625."""
    w = round(im.width * height / im.height)
    return im.convert("RGBa").resize((w, height), Image.LANCZOS).convert("RGBA")


def finish(path, tol, shadow_rows, ref=None, leg_gaps=0.0, height=0):
    src = Image.open(path).convert("RGBA")
    # Animation frames come back on transparency, so their border has no
    # background colour: pass the idle sprite's (--ref-from) instead.
    ref = ref or ref_of(src)
    im = clear_shadow(key_background_ref(src, ref, tol), shadow_rows)
    # Second pass: same background colour, now also reaching pockets the
    # shadow pass opened up (and, on animation frames, background-coloured
    # smears the animator carried over from such a pocket).
    im = key_background_ref(im, ref, tol)
    im = clear_leg_gaps(im, ref, tol, leg_gaps)
    return to_height(im, height) if height else half(im)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+", help="IN OUT, or the frame files with --frames")
    ap.add_argument("--tol", type=int, default=22)
    ap.add_argument("--shadow-rows", type=int, default=0)
    ap.add_argument("--frames", action="store_true", help="finish several frames into --out-dir")
    ap.add_argument("--out-dir")
    ap.add_argument("--leg-gaps", type=float, default=0.0,
                    help="clear enclosed background pockets below this fraction of the height (characters: 0.65)")
    ap.add_argument("--height", type=int, default=0,
                    help="scale to this height instead of exactly half (for 256 px animation frames)")
    ap.add_argument("--ref-from", help="take the background colour from this (opaque, 2x) image")
    a = ap.parse_args()
    ref = ref_of(Image.open(a.ref_from).convert("RGBA")) if a.ref_from else None
    if a.frames:
        import os
        os.makedirs(a.out_dir, exist_ok=True)
        for p in a.paths:
            finish(p, a.tol, a.shadow_rows, ref, a.leg_gaps, a.height).save(os.path.join(a.out_dir, os.path.basename(p)))
    else:
        if len(a.paths) != 2:
            ap.error("give IN and OUT")
        finish(a.paths[0], a.tol, a.shadow_rows, ref, a.leg_gaps, a.height).save(a.paths[1])


if __name__ == "__main__":
    main()
