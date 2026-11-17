"""Contact sheets from out/rig-test.mp4: one row per animation, frames left to right.
Run after capture.mjs: python3 art-direction/rig-test/tools/sheet.py
Writes out/sheet-run.png and out/sheet-combo.png.
The capture starts at scene clock 1.0 s (30 settle frames), at 30 fps.
"""
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw

RIG = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(RIG, "out")
FPS = 30

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(["ffmpeg", "-loglevel", "error", "-i", os.path.join(OUT, "rig-test.mp4"),
                    os.path.join(tmp, "f%04d.png")], check=True)

    def frame(clock):
        i = round((clock - 1.0) * FPS) + 1  # ffmpeg numbers from 1
        return Image.open(os.path.join(tmp, f"f{i:04d}.png")).convert("RGB")

    def sheet(name, box, clocks, cols):
        w, h = box[2] - box[0], box[3] - box[1]
        s = 0.6
        tw, th = int(w * s), int(h * s)
        rows = (len(clocks) + cols - 1) // cols
        img = Image.new("RGB", (tw * cols, (th + 22) * rows), (240, 236, 226))
        d = ImageDraw.Draw(img)
        for k, c in enumerate(clocks):
            x, y = (k % cols) * tw, (k // cols) * (th + 22)
            img.paste(frame(c).crop(box).resize((tw, th), Image.LANCZOS), (x, y))
            d.text((x + 6, y + th + 4), f"{c - clocks[0]:.2f}s", fill=(60, 40, 20))
        img.save(os.path.join(OUT, f"sheet-{name}.png"))

    sheet("run", (700, 260, 1100, 740), [2.0 + i / FPS * 2 for i in range(10)], 10)
    sheet("combo", (1130, 160, 1860, 740), [1.7 + i / FPS * 2 for i in range(18)], 9)
print("sheets in", OUT)
