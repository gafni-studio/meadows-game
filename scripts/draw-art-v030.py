#!/usr/bin/env python3
"""
v0.3.0 art: Whisperwood mobs, the Hollow Stag, the Old Stump, Wren, the new material icons, Whisperwood decor
and tiles. Original pixel art drawn here (ASCII grids for small sprites, simple shapes for big ones) in the
Kenney Tiny style of the rest of the game: flat colours, one highlight, a 1px dark outline added automatically.
Run: python3 scripts/draw-art-v030.py   (needs Pillow). Writes into public/art/.
"""
import colorsys, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'art')
OUTLINE = (62, 39, 49, 255)


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def save(im, *parts):
    p = os.path.join(OUT, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)


def outline(im, color=OUTLINE):
    """1px outline around every opaque pixel (4-neighbours), like the Kenney packs."""
    im = im.copy(); px = im.load(); w, h = im.size
    src = [[px[x, y][3] > 0 for x in range(w)] for y in range(h)]
    for y in range(h):
        for x in range(w):
            if src[y][x]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and src[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = color
    return im


def grid(rows, pal, w=None, h=None):
    """ASCII rows → image. '.' is transparent. Bottom-aligned and centred in a w×h canvas (leaving room for the outline)."""
    gw = max(len(r) for r in rows); gh = len(rows)
    im = Image.new('RGBA', (gw, gh), (0, 0, 0, 0)); px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.' and ch != ' ': px[x, y] = hexc(pal[ch])
    bb = im.getbbox()
    im = im.crop(bb)
    w = w or gw; h = h or gh
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(im, ((w - im.width) // 2, h - 1 - im.height), im)
    return outline(out)


def sheet(frames):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames): s.paste(f, (i * w, 0), f)
    return s


def body_of(frame):
    bb = frame.getbbox()
    return (bb[2] - bb[0] - 2, bb[3] - bb[1] - 2, bb[0] + 1, bb[1] + 1)


# ───────────────────────── Wisp (16×16, 3 frames) ─────────────────────────
WISP_PAL = {'W': 'f4fdff', 'C': '9fe0ff', 'B': '5aa8d8', 'Y': 'fff8c8', 'k': '2a3a5a'}
wisp0 = [
    '.....C......',
    '....CC......',
    '...CWWC.....',
    '..CWWWWC....',
    '.CWWYYWWC...',
    '.CWYYYYWC...',
    'CWkYYYkWWC..',
    'CWYYYYYYWC..',
    'CWWYYYYWWC..',
    '.CWWWWWWC...',
    '..CCWWCC....',
    '...BC.CB....',
    '...B...B....',
]
wisp1 = [r for r in wisp0[:-2]] + ['..BC..CB....', '..B....B....']
wisp2 = [
    '....CCC.....',
    '...CWWWC....',
    '..CWWWWWC...',
    '.CWWYYYWWC..',
    'CWWYYYYYWWC.',
    'CWkYYYYYkWC.',
    'CWYYYYYYYWC.',
    'CWYYYYYYYWC.',
    'CWWYYYYYWWC.',
    '.CWWWWWWWC..',
    '..CCWWWCC...',
    '...BC.CB....',
]

# ───────────────────────── Thornling (16×16, 3 frames) ─────────────────────────
TH_PAL = {'T': '8a6a3a', 'D': '5a4024', 'G': '5f9a3a', 'L': 'a8d070', 'Y': 'f0e060', 'R': 'c04a3a'}
th0 = [
    '..G.L.G...',
    '.GLGGLGL..',
    '.GGLGGLG..',
    '..TTTTT...',
    '..TYTTYT..',
    '..TTTTTT..',
    '...TDDT...',
    'T..TTTT..T',
    '.T.TTTT.T.',
    '..TTTTTT..',
    '...TTTT...',
    '....TT....',
    '...T..T...',
    '..T....T..',
    '..D....D..',
]
th1 = th0[:12] + ['..T....T..', '.T......T.', '.D......D.']
th2 = [
    '..G.L.G..L',
    '.GLGGLGL.L',
    '.GGLGGLG.T',
    '..TTTTT.T.',
    '..TYTTYTT.',
    '..TTTTTT..',
    '...TRRT...',
    'T..TTTT...',
    '.T.TTTT...',
    '..TTTTTT..',
    '...TTTT...',
    '....TT....',
    '...T..T...',
    '..T....T..',
    '..D....D..',
]

# ───────────────────────── Moss Lurker (20×16, 4 frames) ─────────────────────────
ML_PAL = {'M': '4a7a30', 'm': '6a9a40', 'd': '2f5220', 'E': 'd8f060', 'T': 'f0ecd0', 'R': '3a1a1a', 'f': '9a7a4a'}
ml0 = [
    '.....m.m.mm.......',
    '...mmMmMmMMm......',
    '..mMMMMMMMMMm.....',
    '.mMMEdMMMdEMMm....',
    '.MMMddMMMddMMM....',
    'mMMMMMMMMMMMMMm...',
    'MMRRRRRRRRRRMMM...',
    'MMRTRTRTRTRRMMd...',
    'MMRRRRRRRRRRMMd...',
    'MMMTRTRTRTRMMdd...',
    'dMMMMMMMMMMMMdd...',
    'dddMMMMMMMMMddd...',
    '.ff.dd..dd..ff....',
]
ml1 = [r.replace('E', 'm') if i == 3 else r for i, r in enumerate(ml0)]
ml1 = ['......m.mm.m......'] + ml1[1:]
ml2 = [
    '....m.m.mm.........',
    '..mmMmMmMMmm.......',
    '.mMMMMMMMMMMm......',
    'mMMEEdMMMdEEMm.....',
    'MMMddMMMMMddMMM....',
    'MRRRRRRRRRRRRMMm...',
    'MRTRTRTRTRTRRMMd...',
    'MRRRRRRRRRRRRMdd...',
    'MRRRRRRRRRRRRMdd...',
    'MMTRTRTRTRTRMMdd...',
    'dMMMMMMMMMMMMddd...',
    '.ff.ddd..ddd.ff....',
]
ml3 = [
    '..................',
    '..................',
    '..................',
    '......m.mm........',
    '....mmMmMMmm......',
    '..mmMMMMMMMMmm....',
    '.mMMMmMMMMmMMMm...',
    'mMMMMMMMMMMMMMMm..',
    'MMMmMMMMMMMMmMMMd.',
    'dMMMMMMMMMMMMMMdd.',
    'ddMMMMMMMMMMMMddd.',
    '.dddddMMMMddddd...',
]

# ───────────────────────── Mire Toad (20×16, 3 frames) ─────────────────────────
MT_PAL = {'O': '6a8a3a', 'o': '4a6a2a', 'P': 'd8d090', 'E': 'e8d040', 'k': '1a1a1a', 's': '3e5a24'}
mt0 = [
    '..EE.......EE.....',
    '.EkkE.....EkkE....',
    '.OEEOOOOOOOEEOO...',
    'OOOOOsOOOOsOOOOO..',
    'OOsOOOOOOOOOOsOOO.',
    'OOOOOOOOOOOOOOOOO.',
    'OOPPPPPPPPPPPPOOO.',
    'oPPPPPPPPPPPPPPOo.',
    'oOPPPPPPPPPPPPOOo.',
    'ooOOOOOOOOOOOOOoo.',
    'oo.ooo.....ooo.oo.',
]
mt1 = [
    '...EE.......EE....',
    '..EkkE.....EkkE...',
    '..OEEOOOOOOOEEOO..',
    '.OOOOsOOOOsOOOOOO.',
    '.OOsOOOOOOOOOsOOO.',
    '.OOOOOOOOOOOOOOOO.',
    '.OPPPPPPPPPPPPOOO.',
    '..PPPPPPPPPPPPPO..',
    '..oOOOOOOOOOOOo...',
    '.oo..........oo...',
    'oo............oo..',
]
mt2 = [
    '..EE.......EE.....',
    '.EkkE.....EkkE....',
    '.OEEOOOOOOOEEOOO..',
    'OOOOOsOOOOsOOOOOO.',
    'OOsOOOOOOOOOOsOOOO',
    'OOOOOOOOOOOOOOPPPP',
    'OOPPPPPPPPPPPPPPPP',
    'oPPPPPPPPPPPPPPPPP',
    'oOPPPPPPPPPPPPPPPo',
    'ooOOOOOOOOOOOOOOo.',
    'oo.ooo.....ooo.oo.',
]

# ───────────────────────── icons (18×18) ─────────────────────────
ICON_PAL = {'W': 'f4fdff', 'C': '9fe0ff', 'B': '5aa8d8', 'Y': 'fff8c8', 'G': '5f9a3a', 'L': 'a8d070', 'D': '3e6a28',
            'O': 'e09040', 'o': 'b0602a', 'S': 'f8d070', 'g': '80c060', 'A': 'e8e2d0', 'a': 'b8b0a0', 'm': '6a9a40', 'p': 'c8f0c0'}
ICONS = {
    'wisp_dust': [
        '.......W.......',
        '......WYW......',
        '...C...W...C...',
        '..CWC.....CWC..',
        '...C..C.C..C...',
        '.....CWYWC.....',
        '....CWYYYWC....',
        '...CWYYYYYWC...',
        '..CCWWYYYWWCC..',
        '.BCCCWWWWWCCCB.',
        '.BBBCCCCCCCBBB.',
    ],
    'moss_fiber': [
        '.....GGGGG.....',
        '...GGLLLLLGG...',
        '..GLLGGGGGLLG..',
        '.GLGGDDDDDGGLG.',
        '.GLGDGGGGGDGLG.',
        '.GLGDGLLLGDGLG.',
        '.GLGDGLDLGDGLG.',
        '.GLGDGGLGGDGLG.',
        '.GLGGDDDDDGGLG.',
        '..GLLGGGGGLLGm.',
        '...GGLLLLLGG.mm',
        '.....GGGGG....m',
    ],
    'toad_gland': [
        '.......g.......',
        '.....SOOO......',
        '...SOOOOOOo....',
        '..SOOSSOOOOo...',
        '.SOOSSOOOOOOo..',
        '.OOOOOOOOOOOo..',
        '.OOOOOOOOOOoo..',
        '.oOOOOOOOOooo..',
        '..ooOOOOOooo...',
        '...ooooooo.....',
        '....g...g......',
    ],
    'hollow_antler': [
        '.A.......A.....',
        '.A....A..A.....',
        '.AA...A.AA.....',
        '..A..AA.A......',
        '..AA.A.AA......',
        '...AAA.A.......',
        '....AAAA.......',
        '.....AAa.......',
        '.....AAa..m....',
        '......Aa.mm....',
        '......AAamm....',
        '.......aam.....',
    ],
}

# ───────────────────────── shapes (big sprites) ─────────────────────────
def canvas(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def stag(pose):
    """Hollow Stag, 32×32. pose: idle, step, head_down (charge), rear (stomp), sway (sweep)."""
    im = canvas(32, 32); d = ImageDraw.Draw(im)
    fur, furd, belly, moss, glow, hole, antler, nose = hexc('8a8478'), hexc('5e5a52'), hexc('b0a898'), hexc('5a8a3a'), hexc('9aff9a'), hexc('1e2a24'), hexc('e4dccb'), hexc('2a2420')
    up = -3 if pose == 'rear' else 0
    # legs (back pair darker); rearing lifts the front pair
    back = [(7, 21), (10, 21)]
    front = [(18, 21), (21, 21)]
    for i, (x, y) in enumerate(back):
        dx = (1 if i else -1) if pose == 'step' else 0
        d.line([(x, y + up), (x + dx, 31)], fill=furd if i else fur, width=2)
    for i, (x, y) in enumerate(front):
        if pose == 'rear': d.line([(x + 2, y + up - 3), (x + 7, y + up - 10)], fill=furd if i else fur, width=2); continue
        dx = (-1 if i else 1) if pose == 'step' else 0
        d.line([(x, y), (x + dx, 31)], fill=furd if i else fur, width=2)
    # body with the hollow ribs (dark cavity, moss-light, rib bars)
    d.ellipse([4, 13 + up, 24, 22 + up], fill=fur)
    d.ellipse([7, 18 + up, 21, 22 + up], fill=belly)
    d.ellipse([10, 14 + up, 18, 21 + up], fill=hole)
    d.ellipse([13, 16 + up, 15, 19 + up], fill=glow)
    for rx in (11, 14, 17): d.line([(rx, 15 + up), (rx, 20 + up)], fill=belly)
    d.line([(4, 15 + up), (2, 17 + up)], fill=furd, width=2)  # tail
    for mx in (7, 12, 16, 20): d.line([(mx, 13 + up), (mx, 15 + up)], fill=moss)  # moss on the back
    P = {
        'idle': dict(neck=[(19, 15), (23, 14), (25, 9), (22, 9)], head=[21, 7, 27, 12], snout=[25, 9, 30, 12], eye=(24, 9), nose=(30, 10),
                     ant=[((23, 7), (19, 1)), ((19, 1), (16, 0)), ((21, 4), (17, 4)), ((24, 7), (27, 1)), ((27, 1), (30, 0)), ((26, 4), (30, 4)), ((20, 2), (21, 0))]),
        'head_down': dict(neck=[(19, 15), (23, 14), (27, 18), (24, 19)], head=[23, 16, 29, 21], snout=[27, 18, 31, 22], eye=(26, 18), nose=(31, 20),
                          ant=[((25, 16), (30, 10)), ((30, 10), (31, 8)), ((27, 13), (31, 13)), ((24, 16), (26, 9)), ((26, 9), (25, 7)), ((25, 12), (28, 10))]),
        'rear': dict(neck=[(18, 11), (22, 10), (23, 5), (20, 5)], head=[19, 3, 25, 8], snout=[23, 5, 28, 8], eye=(22, 5), nose=(28, 6),
                     ant=[((21, 3), (17, 0)), ((19, 1), (16, 1)), ((22, 3), (25, 0)), ((24, 1), (27, 1))]),
        'sway': dict(neck=[(19, 15), (22, 14), (21, 8), (18, 9)], head=[17, 5, 23, 10], snout=[21, 7, 26, 10], eye=(20, 7), nose=(26, 8),
                     ant=[((18, 5), (12, 1)), ((12, 1), (10, 1)), ((15, 3), (12, 5)), ((19, 5), (18, 0)), ((18, 0), (20, 0)), ((14, 2), (13, 0))]),
    }
    q = P['idle' if pose == 'step' else pose]
    d.polygon(q['neck'], fill=fur)
    d.ellipse(q['head'], fill=fur)
    d.ellipse(q['snout'], fill=fur)
    d.point(q['nose'], fill=nose)
    d.point(q['eye'], fill=glow)
    for a, b in q['ant']: d.line([a, b], fill=antler)
    for a, b in q['ant'][:3]:  # moss hanging from the tines
        d.line([b, (b[0], min(31, b[1] + 3))], fill=moss)
    return outline(im)


def stump(pose):
    """Old Stump, 24×24. pose: idle, step, windup."""
    im = canvas(24, 24); d = ImageDraw.Draw(im)
    bark, barkd, ring, eye, moss = hexc('7a5a3a'), hexc('54402a'), hexc('c8a070'), hexc('ffb040'), hexc('5f9a3a')
    sh = 1 if pose == 'step' else 0
    d.rectangle([5, 7, 18, 21], fill=bark)
    for x in (7, 11, 15): d.line([(x, 9), (x, 21)], fill=barkd)
    d.ellipse([5, 4, 18, 10], fill=ring); d.ellipse([8, 5, 15, 9], fill=hexc('a88050'))
    # roots (feet)
    d.line([(5, 21), (2 + sh, 23)], fill=barkd, width=2); d.line([(18, 21), (21 - sh, 23)], fill=barkd, width=2); d.line([(11, 21), (11, 23)], fill=barkd, width=2)
    # angry face
    d.line([(7, 12), (10, 13)], fill=barkd); d.line([(16, 12), (13, 13)], fill=barkd)
    d.point((8, 14), fill=eye); d.point((15, 14), fill=eye); d.point((9, 14), fill=eye); d.point((14, 14), fill=eye)
    d.line([(9, 18), (14, 18)], fill=hexc('2a1a10'))
    # branch arm
    if pose == 'windup': d.line([(18, 12), (22, 4)], fill=bark, width=2); d.line([(22, 4), (23, 2)], fill=moss)
    else: d.line([(18, 13), (22, 15)], fill=bark, width=2); d.point((23, 15), fill=moss)
    d.line([(5, 13), (2, 11)], fill=bark, width=2)
    d.point((6, 7), fill=moss); d.point((12, 4), fill=moss); d.point((13, 4), fill=moss)
    return outline(im)


def deco_old_tree():
    im = canvas(32, 48); d = ImageDraw.Draw(im)
    bark, barkd, moss, leaf, leafd = hexc('5a4a3a'), hexc('3e3226'), hexc('6a9a40'), hexc('3e6a3a'), hexc('2e523a')
    d.ellipse([0, 0, 31, 22], fill=leafd); d.ellipse([3, 2, 28, 18], fill=leaf)
    d.rectangle([10, 16, 21, 45], fill=bark)
    d.polygon([(10, 40), (4, 47), (12, 47)], fill=bark); d.polygon([(21, 40), (28, 47), (19, 47)], fill=bark)
    for x in (12, 16, 19): d.line([(x, 20), (x, 44)], fill=barkd)
    for y in (24, 31, 37): d.line([(10, y), (13, y + 2)], fill=moss)
    d.line([(21, 27), (19, 30)], fill=moss)
    for x in (6, 14, 24): d.line([(x, 17), (x, 23)], fill=moss)
    return outline(im)


def deco_dead_tree():
    im = canvas(24, 40); d = ImageDraw.Draw(im)
    g, gd = hexc('8a8478'), hexc('5e5a52')
    d.rectangle([10, 10, 14, 39], fill=g); d.line([(12, 12), (12, 38)], fill=gd)
    for a, b in [((12, 18), (4, 8)), ((12, 14), (20, 4)), ((6, 11), (2, 6)), ((18, 7), (22, 8)), ((12, 10), (11, 1)), ((12, 26), (19, 20))]:
        d.line([a, b], fill=g, width=2)
    d.polygon([(10, 36), (6, 39), (18, 39), (14, 36)], fill=g)
    return outline(im)


def deco_tent():
    im = canvas(24, 20); d = ImageDraw.Draw(im)
    c, cd, door = hexc('a89060'), hexc('7a6440'), hexc('3a2a1a')
    d.polygon([(1, 19), (12, 1), (23, 19)], fill=c); d.polygon([(12, 1), (23, 19), (16, 19)], fill=cd)
    d.polygon([(9, 19), (12, 10), (15, 19)], fill=door)
    d.line([(12, 0), (12, 2)], fill=hexc('5a3a20'))
    return outline(im)


def deco_campfire(t=0):
    im = canvas(16, 16); d = ImageDraw.Draw(im)
    d.line([(2, 14), (13, 12)], fill=hexc('6a4a2a'), width=2); d.line([(2, 12), (13, 14)], fill=hexc('5a3a20'), width=2)
    d.polygon([(4, 12), (8, 2), (12, 12)], fill=hexc('f08030')); d.polygon([(6, 12), (8, 5), (10, 12)], fill=hexc('ffd060'))
    for x in (1, 14): d.ellipse([x - 1, 13, x + 1, 15], fill=hexc('888078'))
    return outline(im)


def deco_fern():
    im = canvas(16, 12); d = ImageDraw.Draw(im)
    f, fd = hexc('5f9a3a'), hexc('3e6a28')
    for a, b in [((8, 11), (1, 3)), ((8, 11), (15, 3)), ((8, 11), (5, 0)), ((8, 11), (11, 0)), ((8, 11), (8, 1))]:
        d.line([a, b], fill=f, width=2)
    d.line([(8, 11), (3, 6)], fill=fd); d.line([(8, 11), (13, 6)], fill=fd)
    return outline(im)


def deco_mushroom():
    im = canvas(12, 12); d = ImageDraw.Draw(im)
    d.rectangle([5, 6, 6, 11], fill=hexc('e8e0c8')); d.ellipse([1, 1, 10, 7], fill=hexc('8ad0c0')); d.point((4, 3), fill=hexc('e8fff8')); d.point((7, 2), fill=hexc('e8fff8'))
    d.rectangle([9, 9, 9, 11], fill=hexc('e8e0c8')); d.ellipse([8, 7, 11, 10], fill=hexc('8ad0c0'))
    return outline(im)


def deco_reeds():
    im = canvas(12, 16); d = ImageDraw.Draw(im)
    for x, top in ((2, 3), (5, 0), (8, 2), (10, 5)):
        d.line([(x, 15), (x, top + 3)], fill=hexc('6a8a3a'))
        d.rectangle([x - 1 if x > 0 else x, top, x, top + 3], fill=hexc('7a5a30'))
    return outline(im)


def recolor(im, src_hue_ok, deg, sat=1.0, val=1.0):
    im = im.copy(); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v < 0.32 or not src_hue_ok(h, s, v): continue
            r2, g2, b2 = colorsys.hsv_to_rgb(deg / 360, min(1, max(s, 0.25) * sat), min(1, v * val))
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return im


if __name__ == '__main__':
    bodies = {}
    def mob(name, frames, size):
        imgs = [grid(f, pal, *size) for f, pal in frames]
        save(sheet(imgs), 'chars', f'monster_{name}.png'); bodies[name] = body_of(imgs[0])
    mob('wisp', [(wisp0, WISP_PAL), (wisp1, WISP_PAL), (wisp2, WISP_PAL)], (16, 16))
    mob('thornling', [(th0, TH_PAL), (th1, TH_PAL), (th2, TH_PAL)], (16, 16))
    mob('moss_lurker', [(ml0, ML_PAL), (ml1, ML_PAL), (ml2, ML_PAL), (ml3, ML_PAL)], (20, 16))
    mob('mire_toad', [(mt0, MT_PAL), (mt1, MT_PAL), (mt2, MT_PAL)], (20, 16))
    stags = [stag(p) for p in ('idle', 'step', 'head_down', 'rear', 'sway')]
    save(sheet(stags), 'chars', 'monster_hollow_stag.png'); bodies['hollow_stag'] = body_of(stags[0])
    stumps = [stump(p) for p in ('idle', 'step', 'windup')]
    save(sheet(stumps), 'chars', 'monster_old_stump.png'); bodies['old_stump'] = body_of(stumps[0])
    # Wren: Pell's sprite in woodwarden green (cloth hues only; skin and hair stay).
    pell = Image.open(os.path.join(OUT, 'chars', 'npc_pell.png')).convert('RGBA')
    save(recolor(pell, lambda h, s, v: s < 0.28 and v > 0.45, 118, sat=1.3, val=0.75), 'chars', 'npc_wren.png')
    for k, rows in ICONS.items(): save(grid(rows, ICON_PAL, 18, 18), 'icons', f'{k}.png')
    # tiles: moss ground top and branch ledges, from the existing grass and plank tiles
    g = Image.open(os.path.join(OUT, 'world', 'grass_top.png')).convert('RGBA')
    save(recolor(g, lambda h, s, v: 0.2 < h < 0.6, 105, sat=0.75, val=0.72), 'world', 'moss_top.png')
    plank = Image.open(os.path.join(OUT, 'world', 'platform.png')).convert('RGBA')
    br = recolor(plank, lambda h, s, v: True, 30, sat=0.45, val=0.5)
    bp = br.load()
    for x in range(1, br.width - 1, 3): bp[x, 1] = hexc('6a9a40')
    save(br, 'world', 'branch.png')
    # fx
    mote = canvas(10, 10); d = ImageDraw.Draw(mote); d.ellipse([0, 0, 9, 9], fill=hexc('9fe0ff', 200)); d.ellipse([2, 2, 7, 7], fill=hexc('f4fdff')); save(mote, 'fx', 'mote.png')
    thorn = canvas(12, 6); d = ImageDraw.Draw(thorn); d.polygon([(0, 2), (11, 3), (0, 4)], fill=hexc('8ac050')); d.line([(0, 3), (5, 3)], fill=hexc('3e6a28')); d.point((3, 1), fill=hexc('8ac050')); d.point((6, 5), fill=hexc('8ac050')); save(outline(thorn), 'fx', 'thorn.png')
    for name, im in (('old_tree', deco_old_tree()), ('dead_tree', deco_dead_tree()), ('tent', deco_tent()), ('campfire', deco_campfire()),
                     ('fern', deco_fern()), ('mushroom', deco_mushroom()), ('reeds', deco_reeds())):
        save(im, 'world', f'{name}.png')
    print('bodies (w, h, offX, offY):', bodies)
