"""v0.3.2: scale the Meadow East tile kit (art-direction/chibi/env/meadow-east) into the game's pixel scale.
Kit hero = 160 px, game hero = 48 px, so tiles go to 5/16 (all kit sizes are multiples of 32 -> whole pixels).
Parallax layers are 1920x1080 -> 960x540."""
from PIL import Image
import glob, os
SRC = 'art-direction/chibi/env/meadow-east'
OUT = 'public/art/east'
os.makedirs(OUT, exist_ok=True)
for f in sorted(glob.glob(f'{SRC}/tiles/*.png')):
    n = os.path.basename(f)
    if n == 'portal_master.png': continue
    im = Image.open(f).convert('RGBA')
    im = im.resize((im.width * 5 // 16, im.height * 5 // 16), Image.LANCZOS)
    im.save(f'{OUT}/{n}', optimize=True)
for n in ['far-hills.png', 'near-hills.png', 'sky.jpg']:
    im = Image.open(f'{SRC}/parallax/{n}')
    im = im.resize((960, 540), Image.LANCZOS)
    if n.endswith('jpg'): im.save(f'{OUT}/{n}', quality=88)
    else: im.save(f'{OUT}/{n}', optimize=True)
