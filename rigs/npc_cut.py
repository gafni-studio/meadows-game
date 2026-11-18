"""Town NPC rigs for the Meadows Animation Studio: cut the parts, build the rig.

NPCs stand still, so their rig is small and the same for every NPC:
  body    legs and torso in one piece; it never moves (no handle)
  head    turns and nods; can swap to other head pictures (blink, talk)
  arms    near arm (in front) and far arm, each a sleeve (shoulder) and a
          hand (elbow), with 2-bone IK on the hand
  item    optional (Pell's staff, Calden's practice sword), held in a hand

The NPC sheets are pose sheets (art-direction/chibi/npcs/<id>.jpg), not part
sheets, so each NPC is cut from one standing frame. Where a moving part used
to cover the body (behind the arms, under the beard or chin), the body is
filled in with its own nearest colours and outlined, so it holds up when the
part moves away. Other head pictures come from other frames of the same
sheet, lined up on the main frame's head.

Writes rigs/<id>/atlas.png, atlas.json, rig.json, rest.png for every NPC in
SPECS. Poses are made in the studio, never here.

Run: python3 rigs/npc_cut.py [id ...]   (needs numpy, scipy, Pillow)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHEETS = os.path.join(ROOT, "art-direction", "chibi", "npcs")
OUTLINE = (40, 26, 16)

# All coordinates are sheet px. Polygons are drawn generously around a part;
# the part is what's both inside its polygon and on the drawing.
#   frame          the standing frame to cut from (x0, y0, x1, y1)
#   head           polygon, neck (pivot), tip (handle)
#   arm_n / arm_f  polygon, shoulder, elbow (split line y), hand (grip point)
#   far            'front' if the far arm is drawn over the body, else 'back'
#   item           polygon, grip, tip; drawn under the hand that holds it
#   body           the body's full outline, including what the arms and head hide
#   swaps          other head pictures: name -> frame box on the same sheet
#   drop           polygons to remove (breath puffs and the like)
#   pockets        background closed in by the drawing (between a staff and the body)
SPECS = {
    "pell": {
        "name": "Pell",
        "frame": (185, 25, 355, 280),
        "head": {"poly": [(186, 25), (355, 25), (355, 128), (322, 128), (322, 150), (312, 165), (295, 173),
                          (275, 173), (262, 160), (256, 148), (250, 141), (232, 138), (222, 134), (186, 134)],
                 "neck": (272, 142), "tip": (300, 40)},
        "arm_n": {"poly": [(224, 140), (252, 139), (259, 150), (259, 228), (218, 230), (216, 172)],
                  "shoulder": (243, 152), "elbow": 200, "hand": (242, 214)},
        "arm_f": {"poly": [(294, 160), (316, 160), (316, 204), (298, 204), (294, 185)],
                  "shoulder": (302, 176), "elbow": 314, "hand": (333, 188), "horizontal": True,
                  "hand_poly": [(310, 166), (348, 166), (348, 204), (310, 204)]},
        "far": "front",
        "pockets": [[(300, 202), (323, 202), (322, 268), (300, 268)]],
        "item": {"name": "staff", "poly": [(324, 136), (348, 136), (346, 274), (326, 274)],
                 "grip": (333, 188), "tip": (336, 142), "colour_of": (334, 230)},
        "body": [(244, 141), (300, 141), (312, 160), (310, 205), (306, 232), (320, 245), (322, 262), (300, 274),
                 (234, 274), (228, 232), (240, 205), (242, 160)],
        "swaps": {"blink": (765, 25, 935, 280), "talk": (190, 295, 365, 545)},
    },
    "mara": {
        "name": "Mara",
        "frame": (500, 25, 660, 280),
        "head": {"poly": [(500, 25), (640, 25), (640, 124), (606, 124), (604, 140), (590, 147), (582, 152),
                          (560, 152), (552, 146), (540, 143), (526, 140), (500, 140)],
                 "neck": (571, 148), "tip": (575, 35)},
        "arm_n": {"poly": [(514, 147), (546, 143), (553, 170), (549, 184), (546, 219), (518, 219), (514, 180)],
                  "shoulder": (533, 156), "elbow": 184, "hand": (533, 203)},
        "arm_f": {"poly": [(596, 150), (613, 150), (618, 182), (618, 213), (599, 213), (597, 183)],
                  "shoulder": (604, 158), "elbow": 182, "hand": (607, 199)},
        "far": "back",
        "body": [(530, 145), (600, 145), (603, 160), (603, 262), (520, 264), (517, 222), (530, 200)],
        "drop": [[(613, 124), (660, 124), (660, 158), (613, 158)]],
        "swaps": {"blink": (785, 25, 925, 280), "talk": (505, 295, 645, 545)},
    },
    "calden": {
        "name": "Calden",
        "frame": (490, 25, 640, 280),
        "head": {"poly": [(490, 25), (640, 25), (640, 150), (598, 151), (580, 153), (560, 153), (548, 148),
                          (546, 131), (530, 128), (490, 126)],
                 "neck": (566, 148), "tip": (565, 35)},
        "arm_n": {"poly": [(512, 131), (553, 131), (555, 166), (548, 184), (549, 233), (517, 233), (511, 200),
                           (512, 170)],
                  "shoulder": (531, 150), "elbow": 184, "hand": (528, 212)},
        "arm_f": {"poly": [(596, 147), (616, 147), (620, 182), (619, 229), (598, 229), (596, 190)],
                  "shoulder": (606, 158), "elbow": 186, "hand": (608, 215)},
        "far": "back",
        "pockets": [[(555, 236), (634, 236), (634, 272), (555, 272)]],
        "item": {"name": "sword", "poly": [(499, 199), (538, 199), (562, 205), (634, 250), (634, 272),
                                           (600, 264), (548, 242), (536, 226), (499, 223)],
                 "grip": (521, 210), "tip": (626, 262), "colour_of": (590, 245), "skin_is_hand": True},
        "body": [(532, 138), (598, 140), (601, 160), (599, 255), (530, 268), (522, 230), (530, 190)],
        "swaps": {"blink": (785, 25, 925, 280)},
    },
}


def load(npc, pockets=()):
    src = np.array(Image.open(os.path.join(SHEETS, npc + ".jpg")).convert("RGB")).astype(np.int32)
    ch = src.max(2) - src.min(2)
    lum = src.mean(2)
    lab, _ = nd.label((ch < 14) & (lum > 225))
    fg = lab != lab[0, 0]
    fg = nd.binary_opening(fg, iterations=1)
    fg = nd.binary_fill_holes(fg)
    # background that the drawing closes in (between a staff and the body):
    # the flood from the corner can't reach it, so the spec marks it
    for pk in pockets:
        fg &= ~(poly(fg.shape, pk) & (ch < 14) & (lum > 225))
    fg = nd.binary_opening(fg, iterations=1) if pockets else fg
    for _ in range(2):   # pale JPEG fringe on the outline
        edge = fg & ~nd.binary_erosion(fg)
        fg &= ~(edge & (lum > 110))
    return src, fg


def poly(shape, pts):
    m = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255)
    return np.array(m) > 0


def disc(shape, c, r):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return (xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= r * r


def inpaint(src, have, want):
    """Fill `want` with the nearest colour from `have` (outline pixels don't
    count as sources), then outline the edge of the filled shape."""
    # sources: only the big flat areas (shirt, apron, trousers), not small
    # details like a buckle, a pouch or a highlight, which would smear
    lum = src.mean(2)
    dark = lum < 48                                   # the outline
    pale = (lum > 185) & (src.max(2) - src.min(2) < 30)   # the ground shadow and highlights
    q = (src // 24)
    key = q[..., 0] * 10000 + q[..., 1] * 100 + q[..., 2]
    srcmask = np.zeros(have.shape, bool)
    cand = have & ~dark & ~pale
    for v in np.unique(key[cand]):
        lab, n = nd.label(cand & (key == v))
        if n == 0:
            continue
        sizes = nd.sum(np.ones_like(lab), lab, range(1, n + 1))
        srcmask |= np.isin(lab, np.where(sizes >= 80)[0] + 1)
    if not srcmask.any():
        srcmask = cand
    _, (iy, ix) = nd.distance_transform_edt(~srcmask, return_indices=True)
    out = src.copy()
    fill = want & ~have
    out[fill] = src[iy[fill], ix[fill]]
    shape = have | want
    rim = shape & ~nd.binary_erosion(shape, iterations=3)
    out[fill & rim] = OUTLINE
    return out, shape


def rgba(img, mask):
    a = np.zeros(mask.shape + (4,), np.uint8)
    a[mask, :3] = img[mask]
    a[mask, 3] = 255
    return a


def cap(img, mask, c, r, part):
    """A round joint cap under the real pixels: outline ring + flat fill in
    the part's main colour."""
    d = disc(mask.shape, c, r)
    inner = disc(mask.shape, c, r - 2.5)
    px = img[part & (img.mean(2) > 70)]
    col = np.median(px, axis=0).astype(np.int32)
    add = d & ~mask
    img = img.copy()
    img[add & ~inner] = OUTLINE
    img[add & inner] = col
    return img, mask | d


def crop(rgba_full, pivot):
    a = rgba_full[..., 3] > 0
    ys, xs = np.where(a)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    im = Image.fromarray(rgba_full[y0:y1, x0:x1])
    al = im.getchannel("A")
    soft = al.filter(ImageFilter.GaussianBlur(0.5))
    im.putalpha(Image.fromarray(np.minimum(np.array(soft), np.array(al))))
    return im, (pivot[0] - x0, pivot[1] - y0)


def align(fg, head_mask, frame, box):
    """Shift (dx, dy) that lays the head of `box` on the main frame's head."""
    hy, hx = np.where(head_mask)
    best, at = -1, (0, 0)
    bx, by = box[0] - frame[0], box[1] - frame[1]
    for dy in range(-14, 15):
        for dx in range(-14, 15):
            yy, xx = hy + by + dy, hx + bx + dx
            ok = (yy >= 0) & (yy < fg.shape[0]) & (xx >= 0) & (xx < fg.shape[1])
            score = fg[yy[ok], xx[ok]].sum()
            if score > best:
                best, at = score, (bx + dx, by + dy)
    return at


def build(npc, spec):
    src, fg = load(npc, spec.get("pockets", ()))
    H, W = fg.shape
    sh = (H, W)
    frame = poly(sh, [(spec["frame"][0], spec["frame"][1]), (spec["frame"][2], spec["frame"][1]),
                      (spec["frame"][2], spec["frame"][3]), (spec["frame"][0], spec["frame"][3])])
    fg = fg & frame
    for d in spec.get("drop", []):
        fg &= ~poly(sh, d)

    head = fg & poly(sh, spec["head"]["poly"])
    taken = head.copy()
    cover = head.copy()     # parts drawn over the body: the body is filled in under them
    cuts = {}       # part -> (rgba full-size, pivot)
    bones = {}
    item = spec.get("item")
    item_mask = np.zeros(sh, bool)
    if item:
        item_mask = fg & poly(sh, item["poly"])

    arms = {}
    yy, xx = np.mgrid[0:H, 0:W]
    skin = (src[..., 0] > 190) & (src[..., 1] > 140) & (src[..., 2] > 100)
    for side in ("n", "f"):
        a = spec[f"arm_{side}"]
        m = fg & poly(sh, a["poly"]) & ~head
        if a.get("horizontal"):
            # reaching forward: split at a vertical line, the hand is ahead of it
            m |= fg & poly(sh, a["hand_poly"]) & ~head
            upper = m & (xx < a["elbow"] + 1)
            hand = m & (xx >= a["elbow"] - 2)
            elbow = (a["elbow"], a["hand"][1])
        else:
            upper = m & (yy < a["elbow"] + 1)
            hand = m & (yy >= a["elbow"] - 2)
            elbow = (a["shoulder"][0] + (a["hand"][0] - a["shoulder"][0]) * 0.3, a["elbow"])
        holds = item and (("elbow_n" if item.get("skin_is_hand") else "elbow_f") == f"elbow_{side}")
        if holds:
            # fingers over the grip stay with the hand, the rest of the grip is the item's
            hand &= ~(item_mask & ~skin)
            upper &= ~item_mask
            item_mask &= ~hand
        arms[side] = (upper, hand, elbow, a)
        taken |= upper | hand
        if side == "n" or spec["far"] == "front":
            cover |= upper | hand

    item_mask &= ~taken
    taken |= item_mask
    cover |= item_mask
    body_have = fg & ~taken
    body_img, body_mask = inpaint(src, body_have, poly(sh, spec["body"]) & cover & frame)
    body_mask &= frame
    cuts["body"] = (rgba(body_img, body_mask), None)

    root = (int(np.mean([p[0] for p in spec["body"]])), int(np.where(fg.any(1))[0].max()) - 4)

    # head (and its other pictures)
    cuts["head"] = (rgba(src, head), spec["head"]["neck"])
    for name, box in spec.get("swaps", {}).items():
        fg_all = load(npc, spec.get("pockets", ()))[1]
        dx, dy = align(fg_all, head, spec["frame"], box)
        alt = np.zeros(sh, bool)
        img = np.zeros_like(src)
        shp = poly(sh, spec["head"]["poly"])
        sy, sx = np.where(shp)
        ty, tx = sy + dy, sx + dx
        ok = (ty >= 0) & (ty < H) & (tx >= 0) & (tx < W)
        alt[sy[ok], sx[ok]] = fg_all[ty[ok], tx[ok]]
        alt &= nd.binary_dilation(head, iterations=3)   # the head only, not the collar under it
        img[sy[ok], sx[ok]] = src[ty[ok], tx[ok]]
        cuts[f"head_{name}"] = (rgba(img, alt), spec["head"]["neck"])

    for side, (upper, hand, elbow, a) in arms.items():
        if side == "n" or spec["far"] == "front":
            up_img, up_mask = cap(src, upper, a["shoulder"], 9, upper)
            hd_img, hd_mask = cap(src, hand, (round(elbow[0]), round(elbow[1])), 7, hand)
        else:
            # mostly hidden behind the body: no caps, they would show past its edge
            up_img, up_mask, hd_img, hd_mask = src, upper, src, hand
        cuts[f"upperarm_{side}"] = (rgba(up_img, up_mask), a["shoulder"])
        cuts[f"hand_{side}"] = (rgba(hd_img, hd_mask), elbow)
        bones[f"shoulder_{side}"] = ("body", a["shoulder"], elbow, None)
        bones[f"elbow_{side}"] = (f"shoulder_{side}", elbow, a["hand"], None)

    if item:
        # the hidden middle of the item (under the hand) in its own colour
        hull = poly(sh, item["poly"]) & nd.binary_closing(item_mask, iterations=6)
        it_img, it_mask = inpaint(src, item_mask, hull)
        cuts[item["name"]] = (rgba(it_img, it_mask), item["grip"])
        holder = "elbow_n" if item.get("skin_is_hand") else "elbow_f"
        bones[item["name"]] = (holder, item["grip"], item["tip"], "item")

    bones = {
        "root": (None, root, None, None),
        "body": ("root", root, None, None),
        "head": ("body", spec["head"]["neck"], spec["head"]["tip"], None),
        **bones,
    }
    # draw order, back to front
    far_back = spec["far"] == "back"
    order = (["hand_f", "upperarm_f"] if far_back else []) + ["body"]
    if item:
        order.append(item["name"])
    order += ([] if far_back else ["hand_f", "upperarm_f"]) + ["hand_n", "upperarm_n", "head"]
    part_bone = {"body": "body", "head": "head", "hand_n": "elbow_n", "upperarm_n": "shoulder_n",
                 "hand_f": "elbow_f", "upperarm_f": "shoulder_f"}
    if item:
        part_bone[item["name"]] = item["name"]

    # ---------- write ----------
    out = os.path.join(HERE, npc)
    os.makedirs(out, exist_ok=True)
    ims = {}
    for n, (full, piv) in cuts.items():
        piv = piv or root
        ims[n] = crop(full, piv)
    AW = 256
    while True:
        x = y = shelf = 0
        place = {}
        for n in sorted(ims, key=lambda n: -ims[n][0].size[1]):
            w, h = ims[n][0].size
            if x + w + 2 > AW:
                x, y, shelf = 0, y + shelf + 2, 0
            place[n] = (x, y)
            x += w + 2
            shelf = max(shelf, h)
        AH = 1 << int(np.ceil(np.log2(y + shelf)))
        if AH <= AW:
            break
        AW *= 2
    atlas = Image.new("RGBA", (AW, AW))
    frames = {}
    for n, (im, (px, py)) in ims.items():
        ax, ay = place[n]
        atlas.paste(im, (ax, ay))
        w, h = im.size
        frames[n] = {"frame": {"x": ax, "y": ay, "w": w, "h": h}, "rotated": False, "trimmed": False,
                     "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h},
                     "pivot": {"x": round(px / w, 4), "y": round(py / h, 4)}}
    atlas.save(os.path.join(out, "atlas.png"))
    with open(os.path.join(out, "atlas.json"), "w") as f:
        json.dump({"frames": frames, "meta": {"image": "atlas.png", "size": {"w": AW, "h": AW}, "scale": 1}}, f, indent=1)
    pt = lambda p: [round(float(v), 2) for v in p]
    top = int(np.where(fg.any(1))[0].min())
    rig = {
        "id": npc, "name": spec["name"], "atlas": "atlas.png", "frames": "atlas.json",
        "height": root[1] - top,
        "bones": {n: {k: v for k, v in {"parent": p, "at": pt(at), "tip": pt(tip) if tip else None, "kind": kind}.items()
                      if v is not None} for n, (p, at, tip, kind) in bones.items()},
        "parts": [{"name": n, "bone": part_bone[n]} for n in order],
        "ik": [{"upper": "shoulder_n", "lower": "elbow_n", "bend": -1},
               {"upper": "shoulder_f", "lower": "elbow_f", "bend": -1}],
        "mirror": [["shoulder_n", "shoulder_f"], ["elbow_n", "elbow_f"]],
        "swaps": {"head": [f"head_{n}" for n in spec.get("swaps", {})]},
    }
    if item:
        rig["layers"] = {item["name"]: {"back": "body", "front": "head"}}
    with open(os.path.join(out, "rig.json"), "w") as f:
        json.dump(rig, f, indent=1)

    # rest check: the parts put back together, next to the sheet frame, plus the head pictures
    fx0, fy0, fx1, fy1 = spec["frame"]
    rest = Image.new("RGBA", (fx1 - fx0, fy1 - fy0), (236, 240, 232, 255))
    for n in order:
        im, (px, py) = ims[n]
        bx, by = bones[part_bone[n]][1]
        rest.alpha_composite(im, (int(round(bx - px - fx0)), int(round(by - py - fy0))))
    sheet = Image.open(os.path.join(SHEETS, npc + ".jpg")).convert("RGBA").crop(spec["frame"])
    extra = [ims[f"head_{n}"] for n in spec.get("swaps", {})]
    W2 = rest.width * 2 + sum(im.width + 10 for im, _ in extra) + 20
    sheet_rest = Image.new("RGBA", (W2, rest.height), (255, 255, 255, 255))
    sheet_rest.paste(sheet, (0, 0))
    sheet_rest.alpha_composite(rest, (rest.width, 0))
    x = rest.width * 2 + 10
    for im, _ in extra:
        sheet_rest.alpha_composite(im, (x, 10))
        x += im.width + 10
    sheet_rest.save(os.path.join(out, "rest.png"))
    print(npc, "parts:", len(ims), "atlas:", AW, "height:", rig["height"])


if __name__ == "__main__":
    for npc in sys.argv[1:] or SPECS:
        build(npc, SPECS[npc])
