"""Meadow mob rigs for the Meadows Animation Studio: cut the parts, build the rig.

Mobs share one small rig:
  body    the mob with its head and tail; it can be moved (square handle) and
          tilted (round handle). The legs hang from it.
  legs    two leg pairs (back, front) that swing for walking; the crow has one.
  pictures  the body can show whole frames from the sheet instead of its own:
          hurt, dead, strike (and fly_up / fly_down for the crow). Each leg
          part can show "none", so a whole-frame picture isn't drawn over legs.

The mob sheets (art-direction/chibi/mobs/<sheet>.jpg) have 4 rows: idle,
walk/fly, attack (windup, strike, recover), hit and die (flinch, knockback,
lying). The figures are found automatically; SPECS says which frame is which
and where the legs start.

Writes rigs/<id>/atlas.png, atlas.json, rig.json, rest.png for every mob in
SPECS.

Run: python3 rigs/mob_cut.py [id ...]   (needs numpy, scipy, Pillow)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
SHEETS = os.path.join(os.path.dirname(HERE), "art-direction", "chibi", "mobs")
ROW_Y = [125, 330, 530, 730]   # row centres on every mob sheet

# Frames are (row, col) on the sheet, counted from 0. Leg coordinates are in
# the idle frame's own pixels (0, 0 = its top-left): the legs are what is below
# `cut` inside each x range.
SPECS = {
    "field_mouse": {"sheet": "field-mouse", "name": "Field Mouse",
                    "cut": 124, "back": (58, 122), "front": (122, 175),
                    "pictures": {"hurt": (3, 0), "dead": (3, 2), "strike": (2, 1)}},
    "wool_sheep": {"sheet": "wool-sheep", "name": "Wool Sheep",
                   "cut": 124, "back": (14, 76), "front": (80, 136),
                   "pictures": {"hurt": (3, 0), "dead": (3, 2), "strike": (2, 1)}},
    "crow": {"sheet": "crow", "name": "Crow",
             "cut": 103, "legs": (44, 116),
             "pictures": {"hurt": (3, 0), "dead": (3, 2), "strike": (2, 2), "fly_up": (1, 0), "fly_down": (1, 2)}},
    "boar": {"sheet": "boar", "name": "Boar",
             "cut": 120, "back": (18, 72), "front": (84, 152),
             "pictures": {"hurt": (3, 0), "dead": (3, 2), "strike": (2, 1)}},
    "angry_bull": {"sheet": "angry-bull", "name": "Angry Bull",
                   "cut": 128, "back": (44, 132), "front": (138, 242),
                   "pictures": {"hurt": (3, 2), "dead": (3, 0), "strike": (2, 1)}},
    "wool_shoulder": {"sheet": "wool-shoulder", "name": "Wool-Shoulder",
                      "cut": 127, "back": (24, 86), "front": (88, 156),
                      "pictures": {"hurt": (3, 0), "dead": (3, 2), "strike": (2, 1)}},
}


def load(sheet):
    src = np.array(Image.open(os.path.join(SHEETS, sheet + ".jpg")).convert("RGB")).astype(np.int32)
    ch = src.max(2) - src.min(2)
    lum = src.mean(2)
    lab, _ = nd.label((ch < 14) & (lum > 225))
    fg = lab != lab[0, 0]
    fg = nd.binary_opening(fg, iterations=1)
    fg = nd.binary_fill_holes(fg)
    raw = fg.copy()      # figures are found (and SPECS measured) with their shadow
    # the soft grey ground shadow under each figure is not part of the mob
    fg &= ~((ch < 8) & (lum > 150) & (lum < 236))
    fg = nd.binary_opening(fg, iterations=1)
    for _ in range(2):   # pale JPEG fringe on the outline
        edge = fg & ~nd.binary_erosion(fg)
        fg &= ~(edge & (lum > 110) & (ch < 30))
    return src, raw, fg


def frames(fg):
    """Figures on the sheet as {(row, col): (mask of the figure, bbox)}."""
    lab, n = nd.label(fg)
    out = []
    for i, sl in enumerate(nd.find_objects(lab)):
        size = (lab[sl] == i + 1).sum()
        if size < 1500:
            continue   # motion lines, dust, feathers, a spat pebble
        cy = (sl[0].start + sl[0].stop) / 2
        row = int(np.argmin([abs(cy - r) for r in ROW_Y]))
        out.append((row, sl[1].start, lab == i + 1, (sl[1].start, sl[0].start, sl[1].stop, sl[0].stop)))
    res = {}
    for row in range(4):
        items = sorted([o for o in out if o[0] == row], key=lambda o: o[1])
        for col, (_, _, mask, bb) in enumerate(items):
            res[(row, col)] = (mask, bb)
    return res


def rgba(src, mask, bb):
    x0, y0, x1, y1 = bb
    a = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    m = mask[y0:y1, x0:x1]
    a[m, :3] = src[y0:y1, x0:x1][m]
    a[m, 3] = 255
    return a


def soften(a):
    im = Image.fromarray(a)
    al = im.getchannel("A")
    im.putalpha(Image.fromarray(np.minimum(np.array(al.filter(ImageFilter.GaussianBlur(0.5))), np.array(al))))
    return im


def extrude_up(a, leg, px=10):
    """Grow a leg piece upward under the body (copy its top pixel per column),
    so it never shows a gap when it swings."""
    a = a.copy()
    for x in range(a.shape[1]):
        ys = np.where(leg[:, x])[0]
        if len(ys) == 0:
            continue
        top = ys[0]
        # skip the outline: copy from a few pixels down
        srcy = min(top + 4, ys[-1])
        for y in range(max(0, top - px), top):
            a[y, x] = a[srcy, x]
            leg[y, x] = True
    return a, leg


def trim(img):
    a = np.array(img)
    ys, xs = np.where(a[..., 3] > 0)
    x0, y0 = xs.min(), ys.min()
    return img.crop((x0, y0, xs.max() + 1, ys.max() + 1)), (x0, y0)


def build(mid, spec):
    src, raw, fg = load(spec["sheet"])
    figs = {k: (mask & fg, bb) for k, (mask, bb) in frames(raw).items()}
    idle_mask, bb = figs[(0, 0)]
    base = rgba(src, idle_mask, bb)
    H, W = base.shape[:2]
    m = base[..., 3] > 0
    yy, xx = np.mgrid[0:H, 0:W]
    cut = spec["cut"]

    groups = {"legs": spec["legs"]} if "legs" in spec else {"leg_back": spec["back"], "leg_front": spec["front"]}
    parts = {}          # name -> (PIL image, pivot in idle-frame px)
    bones = {}
    leg_union = np.zeros_like(m)
    bottom = int(np.where(m.any(1))[0].max())
    for name, (xa, xb) in groups.items():
        leg = m & (yy >= cut) & (xx >= xa) & (xx < xb)
        leg_union |= leg
        a = base.copy()
        a[~leg] = 0
        a, leg2 = extrude_up(a, leg.copy())
        a[~leg2] = 0
        img, (ox, oy) = trim(soften(a))
        cx = (xa + xb) / 2
        pivot = (cx, cut - 2)
        parts[name] = (img, (pivot[0] - ox, pivot[1] - oy))
        bones[name] = ("body", pivot, (cx, bottom))
    body = base.copy()
    body[leg_union] = 0
    bimg, (bx, by) = trim(soften(body))
    legs_x = [v for r in groups.values() for v in r]
    body_pivot = ((min(legs_x) + max(legs_x)) / 2, cut - 4)
    top = int(np.where(m.any(1))[0].min())
    parts["body"] = (bimg, (body_pivot[0] - bx, body_pivot[1] - by))

    # whole-frame pictures, lined up on the idle frame: same ground line, same middle
    base_cx = W / 2
    for pic, rc in spec["pictures"].items():
        fm, fbb = figs[rc]
        a = rgba(src, fm, fbb)
        img, (ox, oy) = trim(soften(a))
        fh, fw = a.shape[:2]
        fbottom = int(np.where((a[..., 3] > 0).any(1))[0].max())
        px = body_pivot[0] - base_cx + fw / 2 - ox
        py = body_pivot[1] - bottom + fbottom - oy
        parts[f"body_{pic}"] = (img, (px, py))
    for name in groups:
        parts[f"{name}_none"] = (Image.new("RGBA", (2, 2)), (1, 1))

    root = (body_pivot[0], bottom)
    bones = {"root": (None, root, None), "body": ("root", body_pivot, (body_pivot[0], top + 8)), **bones}

    # ---------- write ----------
    out = os.path.join(HERE, mid)
    os.makedirs(out, exist_ok=True)
    AW = 256
    while True:
        x = y = shelf = 0
        place = {}
        for n in sorted(parts, key=lambda n: -parts[n][0].size[1]):
            w, h = parts[n][0].size
            if x + w + 2 > AW:
                x, y, shelf = 0, y + shelf + 2, 0
            place[n] = (x, y)
            x += w + 2
            shelf = max(shelf, h)
        if y + shelf <= AW:
            break
        AW *= 2
    atlas = Image.new("RGBA", (AW, AW))
    fr = {}
    for n, (img, (px, py)) in parts.items():
        ax, ay = place[n]
        atlas.paste(img, (ax, ay))
        w, h = img.size
        fr[n] = {"frame": {"x": ax, "y": ay, "w": w, "h": h}, "rotated": False, "trimmed": False,
                 "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h},
                 "pivot": {"x": round(px / w, 4), "y": round(py / h, 4)}}
    atlas.save(os.path.join(out, "atlas.png"))
    with open(os.path.join(out, "atlas.json"), "w") as f:
        json.dump({"frames": fr, "meta": {"image": "atlas.png", "size": {"w": AW, "h": AW}, "scale": 1}}, f, indent=1)
    pt = lambda p: [round(float(v), 2) for v in p]
    leg_names = list(groups)
    rig = {
        "id": mid, "name": spec["name"], "atlas": "atlas.png", "frames": "atlas.json",
        "height": bottom - top,
        "bones": {n: {k: v for k, v in {"parent": p, "at": pt(at), "tip": pt(tip) if tip else None,
                                          "kind": "move" if n == "body" else None}.items() if v is not None}
                  for n, (p, at, tip) in bones.items()},
        "parts": [{"name": n, "bone": n} for n in leg_names] + [{"name": "body", "bone": "body"}],
        "swaps": {"body": [f"body_{p}" for p in spec["pictures"]], **{n: [f"{n}_none"] for n in leg_names}},
    }
    if len(leg_names) == 2:
        rig["mirror"] = [leg_names]
    with open(os.path.join(out, "rig.json"), "w") as f:
        json.dump(rig, f, indent=1)

    # rest check: the sheet frame | the parts put back together | each picture
    sheet = Image.fromarray(base)
    rest = Image.new("RGBA", (W, H))
    for n in leg_names + ["body"]:
        img, (px, py) = parts[n]
        at = bones[n][1]
        rest.alpha_composite(img, (int(round(at[0] - px)), int(round(at[1] - py))))
    pics = [parts[f"body_{p}"][0] for p in spec["pictures"]]
    sheet_w = W * 2 + sum(p.width + 8 for p in pics) + 8
    check = Image.new("RGBA", (sheet_w, max([H] + [p.height for p in pics])), (236, 240, 232, 255))
    check.alpha_composite(sheet, (0, 0))
    check.alpha_composite(rest, (W, 0))
    x = W * 2 + 8
    for p in pics:
        check.alpha_composite(p, (x, 0))
        x += p.width + 8
    check.save(os.path.join(out, "rest.png"))
    print(mid, "parts:", len(parts), "atlas:", AW, "height:", rig["height"])


if __name__ == "__main__":
    for mid in sys.argv[1:] or SPECS:
        build(mid, SPECS[mid])
