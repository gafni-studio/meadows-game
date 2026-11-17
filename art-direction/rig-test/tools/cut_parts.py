"""Cut the approved hero (hero/base.jpg) into rig parts.

Rig test only (art-direction/rig-test/brief.md). Every visible pixel comes from
base.jpg; only the hidden overlap at the joints is painted, with flat fills in
the part's own colour plus the same dark-brown outline.

Writes:
  parts/<part>.png          one PNG per part, transparent, full source scale
  preview/public/hero.png   the parts packed in one power-of-two atlas
  preview/public/hero.json  atlas frames + rig (pivots in base.jpg pixels)
  parts/_rest.png           all parts re-assembled at rest (should equal base)
  parts/_exploded.png       parts pulled apart, to check the painted joints

Run: python3 art-direction/rig-test/tools/cut_parts.py
"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RIG = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(RIG))
BASE = os.path.join(RIG, "hero", "base.jpg")
OUT_PARTS = os.path.join(RIG, "parts")
OUT_PUB = os.path.join(RIG, "preview", "public")

OUTLINE = (38, 20, 6)
OUT_W = 4  # outline width in source pixels (base.jpg's lines are ~4-5 px)

src = np.array(Image.open(BASE).convert("RGB")).astype(np.int32)
H, W, _ = src.shape
rng = np.random.default_rng(7)


# ---------- helpers ----------
def poly_mask(points):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return np.array(m) > 0


def ellipse_mask(cx, cy, rx, ry):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    return np.array(m) > 0


def morph(mask, r, op):
    """Dilate (op='max') or erode (op='min') a bool mask by r px."""
    img = Image.fromarray((mask * 255).astype(np.uint8))
    f = ImageFilter.MaxFilter if op == "max" else ImageFilter.MinFilter
    return np.array(img.filter(f(2 * r + 1))) > 127


def flood_bg(_img, seed_test):
    h, w = seed_test.shape
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        q.append((0, x)); q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0)); q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or bg[y, x] or not seed_test[y, x]:
            continue
        bg[y, x] = True
        q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    return bg


def fill_holes(mask):
    """Pixels enclosed by the mask join it (stops outlines round pin-holes)."""
    outside = flood_bg(None, ~mask)
    return mask | ~outside


def soft_alpha(fg):
    """1 px anti-aliased edge so the cut-out doesn't look jaggy."""
    a = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    return np.minimum(np.array(a).astype(np.int32), fg * 255 + 0)


# ---------- background ----------
chroma = src.max(2) - src.min(2)
lum = src.mean(2)
bg = flood_bg(src, (chroma < 10) & (lum > 180) & (lum < 215))
fg = ~bg
# grey halo pixels just inside the outline: drop them
fg &= ~(morph(bg, 1, "max") & (chroma < 12) & (lum > 150))
# base.jpg has a near-white gap between the boots (and other tiny pale specks
# against the grey); they are background, not cloth
_yy, _xx = np.mgrid[0:H, 0:W]
fg &= ~((lum > 140) & (chroma < 22) & (_yy > 830) & (_xx > 405) & (_xx < 450))

# ---------- labels ----------
yy, xx = np.mgrid[0:H, 0:W]
label = np.full((H, W), "", dtype=object)

R, G = src[..., 0], src[..., 1]
red = (G < 0.53 * R) & (R > 90) & (yy > 336)
scarf_zone = poly_mask([(312, 336), (530, 336), (530, 482), (312, 482)])
scarf = morph(morph(red & scarf_zone, 3, "max"), 3, "min")      # close small gaps
scarf = morph(scarf, 4, "max") & scarf_zone & fg
# smooth the mask so its edge follows the drawn outline, not a square kernel
scarf = (np.array(Image.fromarray((scarf * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))) > 127) & fg

head = fg & (yy < 380) & ~scarf
# front arm: sleeve above the roll's lower outline, glove below it
sleeve_f = poly_mask([(294, 388), (403, 388), (403, 596), (300, 600)]) & fg & ~scarf
glove_f = poly_mask([(298, 596), (386, 594), (386, 688), (402, 698), (402, 730),
                     (392, 743), (298, 745)]) & fg
arm_f = sleeve_f | glove_f
TORSO_SHAPE = [(326, 376), (540, 376), (540, 578), (525, 586), (526, 718), (332, 728), (322, 640), (326, 520)]
torso_shape = poly_mask(TORSO_SHAPE)
torso = torso_shape & fg & ~scarf & ~head & ~arm_f
legs = fg & (yy >= 700) & ~arm_f & ~torso & ~torso_shape & ~((xx > 526) & (yy < 745))
# the legs part along the drawn crease between them (traced from base.jpg)
crease = np.interp(yy, [700, 730, 760, 800, 830, 845, 900], [460, 458, 451, 441, 432, 428, 428])
front = xx <= crease + 2
boot_f_y, boot_b_y = 868, 864

label[torso] = "torso"
label[legs & front & (yy < boot_f_y)] = "thigh_f"
label[legs & ~front & (yy < boot_b_y)] = "thigh_b"
label[legs & (xx < 431) & (yy >= boot_f_y)] = "shin_f"
label[legs & (xx >= 431) & (yy >= boot_b_y)] = "shin_b"

label[sleeve_f] = "upperarm_f"
label[glove_f] = "forearm_f"
label[head] = "head"
tail = scarf & (xx > 452) & (yy > 404)
label[scarf & ~tail] = "scarf"
label[tail] = "scarf_tail"

# ---------- painted joints (hidden overlap) ----------
# Cutout-rig rule: every child limb gets a round cap centred on its joint, so it
# can turn without opening a gap; the parent's end sits on top and hides it.
# Fills are flat in the part's own colour, with the same outline (added below).
VEST = (112, 70, 36)
SHIRT = (240, 207, 162)
PANTS = (70, 53, 39)
GLOVE = (104, 63, 32)
SKIN = (236, 184, 138)
SCARF = (160, 62, 28)

def cap(cx, cy, r, to=None):
    """Circle at a joint, plus a band joining it to the limb's cut edge."""
    m = ellipse_mask(cx, cy, r, r)
    if to is not None:
        x0, y0, x1, y1 = to
        m |= poly_mask([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    return m

fills = []
# torso: behind the front arm (vest), with a shirt shoulder socket
fills.append(("torso", torso_shape & fg & ~torso & ~head, VEST))
# (in shadow: it only shows in the armpit when the arm is raised)
fills.append(("torso", ellipse_mask(370, 430, 30, 34) & torso_shape, tuple(int(c * 0.78) for c in SHIRT)))
# head: the neck carries on under the scarf
fills.append(("head", poly_mask([(440, 352), (484, 352), (484, 400), (440, 400)]), SKIN))
# scarf tail: root runs up under the knot
fills.append(("scarf_tail", cap(482, 398, 20, (462, 398, 504, 412)), SCARF))
# upper arm: round shoulder under the scarf
fills.append(("upperarm_f", cap(374, 412, 30, (346, 412, 402, 430)), SHIRT))
# forearm: wrist runs up inside the sleeve roll, round at the elbow
fills.append(("forearm_f", cap(350, 592, 36, (316, 576, 384, 604)), GLOVE))
# thighs: round hips under the vest, pants carry on inside the boot cuff
fills.append(("thigh_f", cap(396, 722, 44, (354, 722, 446, 740)), PANTS))
fills.append(("thigh_f", cap(382, 880, 40, (344, 850, 422, 880)), PANTS))
fills.append(("thigh_b", cap(482, 722, 42, (452, 722, 522, 745)), PANTS))
fills.append(("thigh_b", cap(474, 876, 38, (440, 845, 512, 876)), PANTS))

ORDER = ["thigh_b", "shin_b", "thigh_f", "shin_f", "torso", "scarf_tail", "head",
         "forearm_f", "upperarm_f", "scarf"]

COVERED_BY = {
    "head": ["scarf", "scarf_tail"], "torso": ["scarf", "scarf_tail", "head"],
    "scarf_tail": ["scarf"], "upperarm_f": ["scarf"], "forearm_f": ["upperarm_f"],
    "thigh_f": ["torso", "shin_f", "forearm_f"], "thigh_b": ["torso", "shin_b", "shin_f", "thigh_f"],
    "shin_b": ["shin_f"],
}

# ---------- build each part ----------
parts = {}
for name in ORDER:
    own = fill_holes((label == name) & fg)
    rgb = src.copy()
    synth = np.zeros((H, W), bool)
    for p, region, col in fills:
        if p != name:
            continue
        region = region & ~own & ~synth
        noise = rng.normal(0, 3, (H, W, 1))
        shade = ((yy - yy[region].min()) / max(1, np.ptp(yy[region]) if region.any() else 1))[..., None] if region.any() else 0
        fillc = np.array(col)[None, None, :] * (1.04 - 0.14 * shade) + noise
        rgb[region] = fillc[region].astype(np.int32)
        synth |= region
    mask = own | synth
    # outline where the part was cut from other foreground, or where painted
    edge = mask & morph(~mask, OUT_W // 2, "max")
    # a cut edge only needs a line where it can show: not where a part drawn
    # on top of this one always covers it
    covered = np.isin(label, COVERED_BY.get(name, []))
    across = morph(fg & ~mask & ~covered, OUT_W // 2 + 1, "max")
    draw_edge = edge & (synth | across) & ~(morph(bg, OUT_W, "max") & own)
    if name == "scarf":
        draw_edge &= synth
    rgb[draw_edge] = OUTLINE
    parts[name] = (rgb, mask)

# hair overlay: the back and top of the hair, swings over the head
hair_poly = poly_mask([(512, 30), (230, 30), (230, 345), (352, 345), (372, 318), (366, 252),
                       (388, 238), (424, 230), (442, 188), (514, 108)])
hair_mask = hair_poly & (label == "head") & fg
# head under the hair: original hair along the cut line (the overlay fades out
# there), a flat shrunk hair cap elsewhere, so a swing never shows grey.
head_rgb, head_mask = parts["head"]
head_rgb = head_rgb.copy()
cap = morph(hair_mask, 12, "min")
cap_col = np.median(src[hair_mask & (lum > 175)], axis=0).astype(np.int32)
near_seam = hair_mask & morph(~hair_poly, 14, "max")
head_rgb[cap & ~near_seam] = cap_col
parts["head"] = (head_rgb, (head_mask & ~hair_mask) | near_seam | cap)
# hair alpha: soft outer edge, feathered fade along the inner cut line
feather = np.array(Image.fromarray((hair_poly * 255).astype(np.uint8))
                   .filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(4))).astype(np.int32)
hair_alpha = np.minimum(soft_alpha(hair_mask), feather)
parts["hair"] = (src.copy(), hair_mask, hair_alpha)
ORDER.insert(ORDER.index("head") + 1, "hair")

# back arm: the base hides it, so it is the front arm, re-used and darkened
for f, b in (("upperarm_f", "upperarm_b"), ("forearm_f", "forearm_b")):
    rgb, m = parts[f][:2]
    dark = (rgb.astype(np.float32) * np.array([0.80, 0.73, 0.66])).astype(np.int32)
    parts[b] = (dark, m)

# ---------- sword (Wooden Sword, from concepts/round1.jpg) ----------
c = np.array(Image.open(os.path.join(ROOT, "art-direction", "concepts", "round1.jpg")).convert("RGB")).astype(np.int32)
c = c[285:415, 410:755]
cbg = flood_bg(c, (np.abs(c - np.array([253, 237, 212])).sum(2) < 40))
sword_rgb = c
sword_mask = ~cbg

# ---------- rig (pivots in base.jpg pixels) ----------
# parent, joint position, layer (low = behind)
BONES = {
    "root":       {"parent": None,         "at": [440, 1062]},
    "hips":       {"parent": "root",       "at": [440, 718]},
    "torso":      {"parent": "hips",       "at": [440, 718]},
    "neck":       {"parent": "torso",      "at": [452, 362]},
    "head":       {"parent": "neck",       "at": [452, 362]},
    "hair":       {"parent": "head",       "at": [410, 210]},
    "scarf":      {"parent": "torso",      "at": [430, 372]},
    "scarf_tail": {"parent": "scarf",      "at": [480, 396]},
    "shoulder_f": {"parent": "torso",      "at": [374, 418]},
    "elbow_f":    {"parent": "shoulder_f", "at": [352, 590]},
    "hand_f":     {"parent": "elbow_f",    "at": [356, 702]},
    "shoulder_b": {"parent": "torso",      "at": [478, 416]},
    "elbow_b":    {"parent": "shoulder_b", "at": [456, 590]},
    "hand_b":     {"parent": "elbow_b",    "at": [460, 702]},
    "hip_f":      {"parent": "hips",       "at": [396, 722]},
    "knee_f":     {"parent": "hip_f",      "at": [380, 880]},
    "hip_b":      {"parent": "hips",       "at": [482, 722]},
    "knee_b":     {"parent": "hip_b",      "at": [474, 876]},
}
# part -> bone, offset of the back-arm copies (they are cut at the front arm)
PART_BONE = {
    "upperarm_b": ("shoulder_b", [104, -2]), "forearm_b": ("elbow_b", [104, -2]),
    "thigh_b": ("hip_b", [0, 0]), "shin_b": ("knee_b", [0, 0]),
    "thigh_f": ("hip_f", [0, 0]), "shin_f": ("knee_f", [0, 0]),
    "torso": ("torso", [0, 0]), "scarf_tail": ("scarf_tail", [0, 0]),
    "head": ("head", [0, 0]), "hair": ("hair", [0, 0]),
    "sword": ("hand_f", [0, 0]),
    "forearm_f": ("elbow_f", [0, 0]), "upperarm_f": ("shoulder_f", [0, 0]),
    "scarf": ("scarf", [0, 0]),
}
DRAW = ["upperarm_b", "forearm_b", "thigh_b", "shin_b", "thigh_f", "shin_f", "torso",
        "scarf_tail", "head", "hair", "sword", "forearm_f", "upperarm_f", "scarf"]

# ---------- export ----------
os.makedirs(OUT_PARTS, exist_ok=True)
os.makedirs(OUT_PUB, exist_ok=True)
images = {}
for name, val in parts.items():
    rgb, m = val[0], val[1]
    a = val[2] if len(val) > 2 else np.where(morph(bg, 2, "max"), soft_alpha(m), 255)
    a = np.where(m, a, 0)
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)[y0:y1, x0:x1]
    images[name] = (Image.fromarray(rgba, "RGBA"), (int(x0), int(y0)))

ys, xs = np.where(sword_mask)
s = np.dstack([sword_rgb, soft_alpha(sword_mask)]).astype(np.uint8)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
sword = Image.fromarray(s, "RGBA")
# sized to the hero: blade ~1.5 head heights; grip centre on the hand point,
# blade pointing up (the rig rotates it).
sw = 300 / sword.width
sword = sword.resize((round(sword.width * sw), round(sword.height * sw)), Image.LANCZOS).rotate(90, expand=True)
grip_from_top = int(sword.height * 0.86)  # grip centre (pommel at the bottom)
hx, hy = BONES["hand_f"]["at"]
images["sword"] = (sword, (hx - sword.width // 2, hy - grip_from_top))

for name, (img, _) in images.items():
    img.save(os.path.join(OUT_PARTS, f"{name}.png"))

# atlas (simple shelf packing, 8 px padding for mipmaps)
PAD = 8
names = sorted(images, key=lambda n: -images[n][0].height)
AW = 2048
x = y = shelf = 0
place = {}
for n in names:
    img = images[n][0]
    if x + img.width + PAD > AW:
        x, y, shelf = 0, y + shelf + PAD, 0
    place[n] = (x, y)
    x += img.width + PAD
    shelf = max(shelf, img.height)
AH = 1
while AH < y + shelf:
    AH *= 2
atlas = Image.new("RGBA", (AW, AH), (0, 0, 0, 0))
frames = {}
for n, (px, py) in place.items():
    img, (ox, oy) = images[n]
    atlas.paste(img, (px, py))
    bone, off = PART_BONE[n]
    jx, jy = BONES[bone]["at"]
    jx -= off[0]; jy -= off[1]
    frames[n] = {
        "frame": {"x": px, "y": py, "w": img.width, "h": img.height},
        "rotated": False, "trimmed": False,
        "sourceSize": {"w": img.width, "h": img.height},
        "spriteSourceSize": {"x": 0, "y": 0, "w": img.width, "h": img.height},
        # Phaser origin so the sprite rotates about its bone's joint
        "pivot": {"x": (jx - ox) / img.width, "y": (jy - oy) / img.height},
    }
atlas.save(os.path.join(OUT_PUB, "hero.png"))
meta = {"frames": frames, "meta": {"image": "hero.png", "size": {"w": AW, "h": AH}, "scale": "1"}}
json.dump(meta, open(os.path.join(OUT_PUB, "hero.json"), "w"), indent=1)
rig = {"bones": BONES, "parts": {n: {"bone": PART_BONE[n][0]} for n in DRAW}, "draw": DRAW,
       "height": 1062 - 68}
json.dump(rig, open(os.path.join(OUT_PUB, "rig.json"), "w"), indent=1)

# ---------- checks ----------
canvas = Image.new("RGBA", (W, H), (197, 197, 197, 255))
for n in DRAW:
    img, (ox, oy) = images[n]
    if n.endswith("_b") and n.startswith(("upper", "fore")):
        ox += PART_BONE[n][1][0]; oy += PART_BONE[n][1][1]
    canvas.alpha_composite(img, (ox, oy))
canvas.convert("RGB").save(os.path.join(OUT_PARTS, "_rest.png"))

ex = Image.new("RGBA", (1500, 1250), (197, 197, 197, 255))
spots = {"head": (40, 20), "hair": (420, 20), "scarf": (760, 40), "scarf_tail": (1020, 40),
         "torso": (40, 420), "upperarm_f": (420, 420), "forearm_f": (600, 420),
         "upperarm_b": (760, 420), "forearm_b": (940, 420), "sword": (1120, 380),
         "thigh_f": (420, 800), "shin_f": (600, 800), "thigh_b": (820, 800), "shin_b": (1000, 800)}
for n, p in spots.items():
    ex.alpha_composite(images[n][0], p)
ex.convert("RGB").save(os.path.join(OUT_PARTS, "_exploded.png"))
print("atlas", AW, AH, "parts", len(images))

if os.environ.get("PROBE"):
    for px, py in json.loads(os.environ["PROBE"]):
        hits = []
        for n, (img, (ox, oy)) in images.items():
            if n.endswith("_b") and n.startswith(("upper", "fore")):
                ox += PART_BONE[n][1][0]; oy += PART_BONE[n][1][1]
            x, y = px - ox, py - oy
            if 0 <= x < img.width and 0 <= y < img.height and img.getpixel((x, y))[3] > 20:
                hits.append((n, img.getpixel((x, y))))
        print((px, py), hits)
