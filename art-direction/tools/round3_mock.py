# Round 3 mock: pins the Wooden Sword to the hero hand point on every frame and composes the 1920x1080 mock.
# Hand points were read by eye from the 80x160 frames (see tests/round-3/hero-leather-anchors.json). SWORD_SCALE=0.65 for the smaller sword.
import math, glob, json
from PIL import Image
R='/home/user/meadows-game/'; D=R+'art-direction/tests/round-3/'
# Hand point (glove centre) of the sword hand, read per frame from the 80x160 sprites.
# Frame 0 is the idle (the start frame of the run), frames 1-8 are the run.
HAND={0:(28,91),1:(26,92),2:(28,94),3:(26,95),4:(17,91),5:(14,91),6:(16,96),7:(23,98),8:(32,93)}
SHOULDER=(36,68); BASE=40.0; GRIP0=(14,16)
def swing(h): return math.degrees(math.atan2(h[0]-SHOULDER[0], h[1]-SHOULDER[1]))*-1*-1  # hand forward = positive
anch={}
for i,h in HAND.items():
    sw=math.degrees(math.atan2(h[0]-SHOULDER[0], h[1]-SHOULDER[1]))  # 0 = straight down, + = forward
    anch[i]={'hand':list(h),'angle':round(BASE+sw,1)}
json.dump({'sprite':'80x160 (hero) / 93x33 (sword)','grip_in_sword':list(GRIP0),'rule':'angle = 40 deg + swing of shoulder(36,68)->hand from straight down (+ forward), counter-clockwise from +x',
           'frames':anch}, open(D+'hero-leather-anchors.json','w'), indent=1)
frames=[Image.open(D+'hero-leather-idle.png')]+[Image.open(f) for f in sorted(glob.glob(D+'run/*.png'))]
import os
SC=float(os.environ.get('SWORD_SCALE','1'))
GRIP=(round(GRIP0[0]*float(__import__('os').environ.get('SWORD_SCALE','1'))),round(GRIP0[1]*float(__import__('os').environ.get('SWORD_SCALE','1'))))
sword=Image.open(D+'sword-wooden.png')
if SC!=1: sword=sword.convert('RGBa').resize((round(sword.width*SC),round(sword.height*SC)),Image.LANCZOS).convert('RGBA')
def armed(i):
    f=frames[i]; h=HAND[i]; a=anch[i]['angle']
    W,H=f.size; pad=60
    out=Image.new('RGBA',(W+2*pad,H+2*pad),(0,0,0,0)); out.alpha_composite(f,(pad,pad))
    rot=sword.rotate(a,resample=Image.BICUBIC,expand=True)
    cx,cy=sword.width/2,sword.height/2; r=math.radians(a); dx,dy=GRIP[0]-cx,GRIP[1]-cy
    gx=rot.width/2+dx*math.cos(r)+dy*math.sin(r); gy=rot.height/2-dx*math.sin(r)+dy*math.cos(r)
    out.alpha_composite(rot,(round(pad+h[0]-gx),round(pad+h[1]-gy)))
    # fist over the grip: redraw the sprite pixels within 7 px of the hand point
    px=f.load(); o=out.load()
    for y in range(H):
        for x in range(W):
            if (x-h[0])**2+(y-h[1])**2<=49 and px[x,y][3]>0: o[x+pad,y+pad]=px[x,y]
    return out,pad
W,H=1920,1080
G=72; GROUND_H=128; groundY=H-GROUND_H-G; feet=groundY+8
def scene(i,hx=700):
    img=Image.new('RGBA',(W,H),(0xae,0xe3,0xff,255))
    grass=Image.open(R+'public/art/world/grass_top.png').convert('RGBA').resize((G,G),Image.NEAREST)
    dirt=Image.open(R+'public/art/world/dirt.png').convert('RGBA').resize((G,G),Image.NEAREST)
    for x in range(0,W,G):
        for y in range(groundY+G,H,G): img.alpha_composite(dirt,(x,y))
        img.alpha_composite(grass,(x,groundY))
    sh=Image.open(D+'sheep-wool-idle.png'); bb=sh.getbbox(); img.alpha_composite(sh,(1000-(bb[0]+bb[2])//2,feet-bb[3]))
    a,pad=armed(i); f=frames[i]; 
    ref=Image.open(D+'hero-leather-idle.png').getbbox()
    img.alpha_composite(a,(hx-pad-40,feet-158-pad))   # feet row of every frame is at y=158
    return img
if __name__=='__main__':
    scene(5,hx=760).convert('RGB').save(D+('mock-1920x1080.png' if SC==1 else 'mock-1920x1080-sword65.png'))
    # preview GIF: 1:1 crop around the hero and the sheep, run cycle 10 fps, ground scrolls
    cr=(520,640,1160,900)
    g=[scene(i,hx=760).crop(cr).convert('RGB') for i in range(1,9)]
    g[0].save(D+('hero-leather-run-armed-preview.gif' if SC==1 else 'hero-leather-run-armed-preview-sword65.gif'),save_all=True,append_images=g[1:],duration=100,loop=0)
    # contact sheet of the 9 armed frames at 2x
    S=2; sheet=Image.new('RGBA',(9*(200*S//2+10),220*S),(0x6a,0xa8,0x4e,255))
    for i in range(9):
        a,pad=armed(i); a=a.crop((pad-30,pad-10,pad+110,pad+170)); sheet.alpha_composite(a.resize((a.width*S,a.height*S),Image.NEAREST),(i*(a.width*S+4),0))
    sheet.convert('RGB').save('/tmp/claude-0/-home-user-meadows-game/e23af4de-8034-5082-8fd3-7eda95fc685b/scratchpad/armed_sheet.png')
    print(json.dumps(anch))
