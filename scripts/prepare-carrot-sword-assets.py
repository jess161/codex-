"""Register generated carrot-sword artwork and derive its runtime alpha silhouette."""
from pathlib import Path
import json,math,hashlib
from PIL import Image,ImageChops

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/carrot-sword/source'
TARGET=ROOT/'src/blade/assets/carrot-sword'
SIZE=(2172,724)
GRIP=(500,365)
TIP=(2112,365)
records=[]
TARGET.mkdir(parents=True,exist_ok=True)
(TARGET/'materials').mkdir(exist_ok=True)

def read(name):
    im=Image.open(SOURCE/name).convert('RGBA')
    if abs(im.width/im.height-3)>.02:
        raise ValueError(f'{name}: expected the registered 3:1 frame, received {im.size}')
    return im if im.size==SIZE else im.resize(SIZE,Image.Resampling.LANCZOS)

def save(im,path,source,**extra):
    # RGB under fully transparent pixels is discarded; all visible pixels stay lossless.
    im.save(path,'WEBP',lossless=True,method=6)
    records.append({'id':path.stem,'path':str(path.relative_to(ROOT)),
      'source':source,'size':SIZE,'grip':GRIP,'physical_tip':TIP,
      'alpha_bounds':im.getchannel('A').getbbox(),'alpha_extrema':im.getchannel('A').getextrema(),
      'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),**extra})

def boundary(im):
    alpha=im.getchannel('A').point(lambda value:255 if value>64 else 0)
    data=alpha.tobytes();w,h=im.size
    first=next(i for i,value in enumerate(data) if value)
    start=(first%w,first//w);p=start;b=(start[0]-1,start[1]);points=[];first_step=None
    # Clockwise Moore-neighbour tracing follows the real connected silhouette,
    # including the two guard horns and leafy pommel, rather than a bounding box.
    neighbours=[(-1,-1),(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0)]
    for _ in range(w*h):
        points.append(p)
        offset=(b[0]-p[0],b[1]-p[1]);begin=neighbours.index(offset)
        for step in range(8):
            index=(begin+step)%8;dx,dy=neighbours[index];q=(p[0]+dx,p[1]+dy)
            if 0<=q[0]<w and 0<=q[1]<h and data[q[1]*w+q[0]]:
                previous=neighbours[(index-1)%8];next_back=(p[0]+previous[0],p[1]+previous[1]);break
        else:raise ValueError('Isolated alpha pixel cannot define the sword silhouette')
        if first_step is None:first_step=q
        elif p==start and q==first_step:
            points.pop();return points
        p=q;b=next_back
    raise ValueError('Alpha silhouette did not close')

def simplify(points,tolerance=3):
    if len(points)<3:return points
    a,b=points[0],points[-1];dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
    distances=[abs(dy*(p[0]-a[0])-dx*(p[1]-a[1]))/length if length else math.hypot(p[0]-a[0],p[1]-a[1]) for p in points]
    peak=max(range(len(points)),key=distances.__getitem__)
    if distances[peak]<=tolerance:return [a,b]
    return simplify(points[:peak+1],tolerance)[:-1]+simplify(points[peak:],tolerance)

base=read('base.png')
save(base,TARGET/'base.webp','base.png')
edge=boundary(base);middle=len(edge)//2
outline=simplify(edge[:middle+1])[:-1]+simplify(edge[middle:]+[edge[0]])[:-1]
layout={'width':SIZE[0],'height':SIZE[1],
        'source':{'width':SIZE[0],'height':SIZE[1],'x':0,'y':0},
        'grip':GRIP,'tip':TIP,'outline':'M'+' L'.join(f'{x} {y}' for x,y in outline)+' Z'}
fx={'width':SIZE[0],'height':SIZE[1],'grip':GRIP,'tip':TIP,
    'poisonDrop':[1140,495],'fireTip':[2090,355],'electricSpark':[845,285],
    'electricArc':[[800,280],[875,320],[800,365],[880,420],[795,455]],
    'poisonTrail':[1230,505],'electricTrail':[800,425],'frostTrail':[500,430]}
(TARGET/'layout.ts').write_text('// Registered generated sword; alpha contour derived by prepare-carrot-sword-assets.py.\n'
    +'export const CARROT_SWORD_LAYOUT = '+json.dumps(layout,indent=2)+' as const;\n'
    +'export const CARROT_SWORD_FX = '+json.dumps(fx,indent=2)+' as const;\n')

def regional(source,name,windows):
    im=read(source);values=[]
    for x in range(SIZE[0]):
        weight=max(max(0,min(1,(x-left)/feather,(right-x)/feather)) for left,right,feather in windows)
        values.append(round(weight*255))
    mask=Image.frombytes('L',(SIZE[0],1),bytes(values)).resize(SIZE,Image.Resampling.NEAREST)
    im.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
    save(im,TARGET/'materials'/(name+'.webp'),source,windows=windows)

if (SOURCE/'fire-poison.png').exists():
    regional('fire-poison.png','poison-body',[(790,1660,60)])
    regional('fire-poison.png','poison-leaves',[(-100,350,40)])
    regional('fire-poison.png','fire-tip',[(1570,2300,80)])
if (SOURCE/'electric-grip.png').exists():
    regional('electric-grip.png','electric-grip',[(-100,870,55)])
    regional('electric-grip.png','electric-grip-front',[(650,870,35)])
(ROOT/'art/carrot-sword/normalized.json').write_text(json.dumps(records,indent=2)+'\n')
print(f'Prepared {len(records)} registered sword images; silhouette has {len(outline)} vertices.')
