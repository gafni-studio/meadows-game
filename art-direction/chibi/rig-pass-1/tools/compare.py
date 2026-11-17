"""Side-by-side: each sheet keyframe next to the rig in the same pose.

Reads _keys/<n>.png (written by tools/capture.mjs) and the style sheets;
writes compare.png and deletes _keys/.
Run: python3 art-direction/chibi/rig-pass-1/tools/compare.py
"""
import os
import shutil

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage as nd

PASS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLE = os.path.join(PASS, "..", "style")
poses = Image.open(os.path.join(STYLE, "hero-poses.jpg")).convert("RGB")
swings = Image.open(os.path.join(STYLE, "hero-swings.jpg")).convert("RGB")

# same order as the keys in capture.mjs: (label, sheet, crop box)
KEYS = [
    ("Idle", poses, (195, 24, 325, 188)),
    ("Run: contact", poses, (400, 204, 512, 358)),
    ("Run: passing", poses, (205, 204, 306, 358)),
    ("Slash: wind-up", swings, (220, 24, 340, 192)),
    ("Slash: strike", swings, (465, 24, 696, 192)),
    ("Slash: follow", swings, (770, 24, 970, 192)),
    ("Smash: wind-up", swings, (185, 204, 340, 396)),
    ("Smash: strike", swings, (458, 234, 646, 396)),
    ("Smash: settle", swings, (764, 234, 936, 396)),
]
SHEET_HERO = 168      # hero height on the pose sheets (px)
RIG_HERO = 560        # hero height in the capture (px)
UP = 1.6              # enlarge both for viewing
CELL_H = 340


def trim(im, bg):
    """Crop to the hero: the biggest blob plus blobs clear of the box edge (bits of neighbours touch it)."""
    a = np.abs(np.array(im).astype(int) - np.array(bg)).max(2) > 18
    lab, n = nd.label(a)
    edge = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
    sizes = nd.sum(a, lab, range(1, n + 1))
    biggest = int(np.argmax(sizes)) + 1     # the hero, even if it touches the box
    keep = np.isin(lab, [biggest] + [i for i in range(1, n + 1) if i not in edge and sizes[i - 1] > 150])
    ys, xs = np.where(keep)
    flat = Image.new("RGB", im.size, bg)
    flat.paste(im, mask=Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)))
    return flat.crop((max(0, xs.min() - 6), max(0, ys.min() - 6), min(im.width, xs.max() + 7), min(im.height, ys.max() + 7)))


cells = []
for i, (name, sheet, box) in enumerate(KEYS):
    a = trim(sheet.crop(box), (250, 250, 248))
    a = a.resize((round(a.width * UP), round(a.height * UP)), Image.LANCZOS)
    b = trim(Image.open(os.path.join(PASS, "_keys", f"{i}.png")).convert("RGB"), (246, 246, 244))
    k = SHEET_HERO / RIG_HERO * UP
    b = b.resize((round(b.width * k), round(b.height * k)), Image.LANCZOS)
    cells.append((name, a, b))

font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
cw = max(a.width + b.width for _, a, b in cells) + 70
W, H = cw * 3, (CELL_H + 50) * 3 + 70
out = Image.new("RGB", (W, H), (250, 250, 248))
d = ImageDraw.Draw(out)
d.text((20, 18), "Rig pass 1: sheet keyframe (left) vs rig (right), same scale", fill=(70, 50, 32), font=font)
for i, (name, a, b) in enumerate(cells):
    x0, y0 = (i % 3) * cw, 70 + (i // 3) * (CELL_H + 50)
    d.rounded_rectangle((x0 + 10, y0, x0 + cw - 10, y0 + CELL_H + 40), 10, outline=(220, 214, 204), width=2)
    d.text((x0 + 24, y0 + 8), name, fill=(70, 50, 32), font=font)
    base = y0 + CELL_H + 30      # both stand on the same line
    out.paste(a, (x0 + 24, base - a.height))
    out.paste(b, (x0 + 44 + a.width, base - b.height))
    d.text((x0 + 24, base + 2), "sheet", fill=(150, 130, 110), font=small)
    d.text((x0 + 44 + a.width, base + 2), "rig", fill=(150, 130, 110), font=small)
out.save(os.path.join(PASS, "compare.png"), optimize=True)
shutil.rmtree(os.path.join(PASS, "_keys"))
print("compare.png", out.size)
