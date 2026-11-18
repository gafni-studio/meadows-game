"""Hero rig for the Meadows Animation Studio: cut the parts, build the rig.

Cuts the parts out of art-direction/chibi/style/hero-rig-parts.jpg and writes,
next to this script:
  atlas.png    every part in one power-of-two atlas
  atlas.json   frames with pivots (the joint each part turns about)
  rig.json     bones (rest positions, tips for drag handles), parts in draw
               order, IK chains, mirror pairs, item layers, springs
  rest.png     the parts re-assembled at rest (check the fit)

Only the cut and the rig live here. Poses are authored in the studio
(studio/) and saved to animations/hero.json.

Every visible pixel comes from the sheet. Only hidden overlap at the joints is
painted (flat fill in the part's own colour, ringed with the sheet's outline),
so a limb can turn about its joint without opening a gap.

Run: python3 rigs/hero/cut.py   (needs numpy, scipy, Pillow)
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SHEET = os.path.join(ROOT, "art-direction", "chibi", "style", "hero-rig-parts.jpg")

src_img = Image.open(SHEET).convert("RGB")
src = np.array(src_img).astype(np.int32)
H, W, _ = src.shape
yy, xx = np.mgrid[0:H, 0:W]

# ---------- background: flood from the corner over the pale grey ----------
chroma = src.max(2) - src.min(2)
lum = src.mean(2)
lab, _ = nd.label((chroma < 14) & (lum > 225))
fg = lab != lab[0, 0]
fg = nd.binary_opening(fg, iterations=1)
fg = nd.binary_fill_holes(fg)
# drop the pale halo just inside the outline (JPEG ringing against the grey)
halo = nd.binary_dilation(~fg, iterations=1) & (chroma < 16) & (lum > 200)
fg &= ~halo
# every edge on the sheet is a dark outline: a pale pixel on the edge is JPEG
# fringe, and shows as a dotted halo once the part is cut out
for _ in range(2):
    edge = fg & ~nd.binary_erosion(fg)
    fg &= ~(edge & (lum > 110))

OUTLINE = (40, 24, 14)


def box(x0, y0, x1, y1):
    return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)


def colour_at(mask):
    return tuple(int(v) for v in np.median(src[mask], axis=0))


def circle(cx, cy, r):
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


def paint_cap(rgba, cx, cy, r, fill, keep):
    """Painted joint cap: an outlined disc in `fill`, under the real pixels."""
    disc = circle(cx, cy, r)
    inner = circle(cx, cy, r - 3.5)
    add = disc & ~keep
    rgba[add & ~inner] = (*OUTLINE, 255)
    rgba[add & inner] = (*fill, 255)
    return keep | disc


def layer(mask):
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[mask, :3] = src[mask]
    rgba[mask, 3] = 255
    return rgba


# ---------- the pieces on the sheet (component boxes) ----------
HEAD = box(150, 412, 309, 563) & fg
TORSO = box(380, 429, 482, 554) & fg
ARM = box(555, 428, 610, 567) & fg      # straight arm, fist (sword hand)
LEG = box(393, 625, 456, 774) & fg      # single leg, used for both
SWORD = box(865, 619, 1026, 772) & fg
FULL = box(481, 28, 663, 370) & fg      # assembled hero: only the scarf tail is used

R, G, B = src[..., 0], src[..., 1], src[..., 2]
orange = (R > 150) & (G < 0.62 * R) & (B < 0.45 * R)

parts = {}   # name -> (rgba, pivot in sheet px, scale, darken)

# head: whole piece, pivot at the base of the neck
parts["head"] = (layer(HEAD), (231, 555), 1.0)

# vest: the whole torso piece; scarf: the collar again, drawn over the head
parts["vest"] = (layer(TORSO), (432, 540), 1.0)
sc = nd.binary_closing(orange & TORSO & (yy < 490), iterations=2)
sc = nd.binary_fill_holes(nd.binary_dilation(sc, iterations=4)) & TORSO & (yy < 490)
parts["scarf"] = (layer(sc), (432, 540), 1.0)

# scarf tail: the loose end behind the neck, from the assembled hero
tail = nd.binary_closing(orange & FULL & box(486, 178, 534, 230), iterations=2)
tail = nd.binary_dilation(tail, iterations=4) & FULL & box(486, 178, 534, 230)
tail_rgba = layer(tail)
parts["scarf_tail"] = (tail_rgba, (531, 198), 0.96)

# arm: sleeve (upper) and glove (forearm), split at the sleeve roll
# (joint centres and half-widths measured on the sheet: the caps must not be
# wider than the limb, or they show as bumps when it bends)
SHOULDER, ELBOW = (586, 450), (577, 516)
sleeve = ARM & (yy < 519)
glove = ARM & (yy >= 514)
glove_rgba = layer(glove)
paint_cap(glove_rgba, ELBOW[0], ELBOW[1] - 2, 19, colour_at(ARM & box(570, 530, 600, 550)), glove)
parts["upperarm"] = (layer(sleeve), SHOULDER, 0.82)
parts["forearm"] = (glove_rgba, ELBOW, 0.82)

# leg: thigh over shin, split mid-trouser; round tops so they turn cleanly
HIP, KNEE = (420, 642), (420, 690)
half = 22
thigh = LEG & ((yy < KNEE[1]) | circle(*KNEE, half - 1))
shin = LEG & (yy >= KNEE[1] - 2)
shin_rgba = layer(shin)
pants = colour_at(LEG & box(405, 650, 440, 700))
paint_cap(shin_rgba, KNEE[0], KNEE[1], half, pants, shin)
# legs at 0.88: the parts sheet's legs are longer than on the pose sheets
LS = 0.88
parts["thigh"] = (layer(thigh), HIP, LS)
parts["shin"] = (shin_rgba, KNEE, LS)

# sword: turned so the blade points straight up, pivot on the grip
POMMEL, TIP = np.array([876, 757]), np.array([1023, 622])
GRIP = (893, 742)
ang = np.degrees(np.arctan2(TIP[0] - POMMEL[0], POMMEL[1] - TIP[1]))   # from up, clockwise
parts["sword"] = (layer(SWORD), GRIP, 1.0, ang)


def cut(name, spec):
    rgba, piv, scale = spec[0], spec[1], spec[2]
    rot = spec[3] if len(spec) > 3 else 0.0
    a = rgba[..., 3] > 0
    ys, xs = np.where(a)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    im = Image.fromarray(rgba[y0:y1, x0:x1])
    px, py = piv[0] - x0, piv[1] - y0
    # soften the hard cut edge by a hair (alpha only)
    al = im.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    al = Image.fromarray(np.minimum(np.array(al), np.array(im.getchannel("A"))))
    im.putalpha(al)
    if rot:
        pad = int(max(im.size) * 1.5)
        big = Image.new("RGBA", (pad * 2, pad * 2))
        big.paste(im, (int(pad - px), int(pad - py)))
        big = big.rotate(rot, resample=Image.BICUBIC, center=(pad, pad))
        bb = big.getbbox()
        im = big.crop(bb)
        px, py = pad - bb[0], pad - bb[1]
    if scale != 1.0:
        w, h = im.size
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        px, py = px * scale, py * scale
    return im, (px, py)


cuts = {n: cut(n, s) for n, s in parts.items()}

# back limbs: same pieces, a shade darker (they sit behind the body)
def darker(im, k=0.8):
    a = np.array(im).astype(np.float32)
    a[..., :3] *= k
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))

for n in ["upperarm", "forearm", "thigh", "shin"]:
    im, piv = cuts.pop(n)
    cuts[n + "_f"] = (im, piv)
    cuts[n + "_b"] = (darker(im), piv)

# ---------- the rig, in torso-piece pixels ----------
s = 0.82
HAND_F = (403 - 1 * s, 470 + 95 * s)
HAND_B = (447 - 1 * s, 468 + 95 * s)
sword_im, (_, sword_py) = cuts["sword"]
ROOT_Y = 540 + (48 + 62 + 24) * LS
# name: (parent, rest joint, tip). The tip is where the drag handle sits:
# dragging it turns the bone about its joint.
bones = {
    "root":       (None,         (434, ROOT_Y), None),
    "hips":       ("root",       (432, 540), (392, 548)),
    "torso":      ("hips",       (432, 540), (437, 438)),
    "head":       ("torso",      (437, 438), (452, 318)),
    "scarf_tail": ("torso",      (398, 455), (366, 462)),
    "shoulder_f": ("torso",      (403, 470), (403 - 9 * s, 470 + 66 * s)),
    "elbow_f":    ("shoulder_f", (403 - 9 * s, 470 + 66 * s), HAND_F),
    "sword":      ("elbow_f",    HAND_F, (HAND_F[0], HAND_F[1] - sword_py + 8)),
    "shoulder_b": ("torso",      (447, 468), (447 - 9 * s, 468 + 66 * s)),
    "elbow_b":    ("shoulder_b", (447 - 9 * s, 468 + 66 * s), HAND_B),
    "hip_f":      ("hips",       (436, 540), (436, 540 + 48 * LS)),
    "knee_f":     ("hip_f",      (436, 540 + 48 * LS), (436 + 2 * LS, 540 + 110 * LS)),
    "hip_b":      ("hips",       (427, 537), (427, 537 + 48 * LS)),
    "knee_b":     ("hip_b",      (427, 537 + 48 * LS), (427 + 2 * LS, 537 + 110 * LS)),
}
part_bone = {
    "head": "head", "vest": "torso", "scarf": "torso", "scarf_tail": "scarf_tail",
    "upperarm_f": "shoulder_f", "forearm_f": "elbow_f", "upperarm_b": "shoulder_b", "forearm_b": "elbow_b",
    "thigh_f": "hip_f", "shin_f": "knee_f", "thigh_b": "hip_b", "shin_b": "knee_b", "sword": "sword",
}
# back to front. The sword arm goes behind the head (overhead swings) but over
# the vest; the scarf collar sits over the head so the neck tucks into it.
draw = ["forearm_b", "upperarm_b", "scarf_tail", "shin_b", "thigh_b", "shin_f", "thigh_f",
        "vest", "sword", "forearm_f", "upperarm_f", "head", "scarf"]

# ---------- atlas (shelf pack, power of two) ----------
AW = 512
order = sorted(cuts, key=lambda n: -cuts[n][0].size[1])
x = y = shelf = 0
place = {}
for n in order:
    w, h = cuts[n][0].size
    if x + w + 2 > AW:
        x, y, shelf = 0, y + shelf + 2, 0
    place[n] = (x, y)
    x += w + 2
    shelf = max(shelf, h)
AH = 1 << int(np.ceil(np.log2(y + shelf)))
atlas = Image.new("RGBA", (AW, AH))
frames = {}
for n, (im, (px, py)) in cuts.items():
    ax, ay = place[n]
    atlas.paste(im, (ax, ay))
    w, h = im.size
    frames[n] = {
        "frame": {"x": ax, "y": ay, "w": w, "h": h}, "rotated": False, "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h},
        "pivot": {"x": round(px / w, 4), "y": round(py / h, 4)},
    }
atlas.save(os.path.join(HERE, "atlas.png"))
with open(os.path.join(HERE, "atlas.json"), "w") as f:
    json.dump({"frames": frames, "meta": {"image": "atlas.png", "size": {"w": AW, "h": AH}, "scale": 1}}, f, indent=1)

pt = lambda p: [round(float(v), 2) for v in p]
root_at = bones["root"][1]
rig = {
    "id": "hero",
    "name": "Hero",
    "atlas": "atlas.png",
    "frames": "atlas.json",
    # rig px from the top of the hair to the sole; the game scales this to 160 px
    "height": round(root_at[1] - 300, 1),
    "bones": {
        n: {k: v for k, v in {
            "parent": p, "at": pt(at), "tip": pt(tip) if tip else None,
            "kind": "move" if n == "hips" else "item" if n == "sword" else "spring" if n == "scarf_tail" else None,
        }.items() if v is not None}
        for n, (p, at, tip) in bones.items()
    },
    "parts": [{"name": n, "bone": part_bone[n]} for n in draw],
    # 2-bone IK: drag the lower bone's tip (hand, ankle) and both bones turn.
    # bend: the sign the lower bone's angle takes (knees forward, elbows forward)
    "ik": [
        {"upper": "shoulder_f", "lower": "elbow_f", "bend": -1},
        {"upper": "shoulder_b", "lower": "elbow_b", "bend": -1},
        {"upper": "hip_f", "lower": "knee_f", "bend": 1, "pin": True},
        {"upper": "hip_b", "lower": "knee_b", "bend": 1, "pin": True},
    ],
    "mirror": [["shoulder_f", "shoulder_b"], ["elbow_f", "elbow_b"], ["hip_f", "hip_b"], ["knee_f", "knee_b"]],
    # where an item can be moved in the draw order, per key
    "layers": {"sword": {"back": "vest", "front": "scarf"}},
    "springs": {"scarf_tail": {"k": 90, "c": 7, "gain": 0.006, "max": 24}},
}
with open(os.path.join(HERE, "rig.json"), "w") as f:
    json.dump(rig, f, indent=1)

# ---------- rest check ----------
rest = Image.new("RGBA", (300, 420), (236, 240, 232, 255))
ox, oy = root_at[0] - 150, root_at[1] - 400
for n in draw:
    im, (px, py) = cuts[n]
    bx, by = bones[part_bone[n]][1]
    rest.alpha_composite(im, (int(round(bx - px - ox)), int(round(by - py - oy))))
rest.save(os.path.join(HERE, "rest.png"))
print("parts:", len(cuts), "atlas:", AW, "x", AH)
