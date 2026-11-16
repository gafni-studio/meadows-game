#!/usr/bin/env python3
"""
v0.3.1 art: the Boar (a small bristly side-view boar, 3 frames: idle, trot, head-down wind-up) and the
Angry Bull (the old Meadow Boar sprite, darker and redder). Reuses the v0.3.0 helpers.
Run: python3 scripts/draw-art-v031.py   (needs Pillow). Writes into public/art/chars/.
"""
import importlib.util, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('art030', os.path.join(HERE, 'draw-art-v030.py'))
A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)

PAL = {'B': '#7a5232', 'b': '#5a3a22', 'L': '#9a7048', 'M': '#3a2418', 'T': '#f4ecd8', 'k': '#1a1010', 'P': '#d8908a'}
# Facing right (the game flips it). B body, b bristles/dark, L light belly, M hooves, T tusk, k eye, P snout.
IDLE = [
    '..b.b.b.......',
    '.bBbBbBbb.....',
    'bBBBBBBBBBb...',
    'BBBBBBBBBBBBk..',
    'BBBBBBBBBBBBBPP',
    'BBLLLLLLLBBBBPP',
    '.BLLLLLLLBBBT..',
    '..BB...BB.B....',
    '..MM...MM.M....',
]
TROT = [
    '..b.b.b.......',
    '.bBbBbBbb.....',
    'bBBBBBBBBBb...',
    'BBBBBBBBBBBBk..',
    'BBBBBBBBBBBBBPP',
    'BBLLLLLLLBBBBPP',
    '.BLLLLLLLBBBT..',
    '.BB.....BB.B...',
    '.MM.....MM.M...',
]
WIND = [  # head down, tusks forward
    '.b.b.b........',
    'bBbBbBbb......',
    'BBBBBBBBBb.....',
    'BBBBBBBBBBBk...',
    'BBBBBBBBBBBBB..',
    'BBLLLLLLLBBBBPP',
    '.BLLLLLLLBBBBPP',
    '..BB...BBB.TT..',
    '..MM...MM......',
]


def bull():
    """The old Meadow Boar sprite, darker and redder: an angry bull."""
    src = Image.open(os.path.join(A.OUT, 'chars', 'monster_angry_bull.png')).convert('RGBA')
    px = src.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = px[x, y]
            if a: px[x, y] = (min(255, int(r * 0.72 + 18)), int(g * 0.5), int(b * 0.45), a)
    return src


if __name__ == '__main__':
    frames = [A.grid(rows, PAL, 16, 16) for rows in (IDLE, TROT, WIND)]
    A.save(A.sheet(frames), 'chars', 'monster_boar.png')
    print('boar body', A.body_of(frames[0]))
    if os.environ.get('BULL'):
        A.save(bull(), 'chars', 'monster_angry_bull.png')
