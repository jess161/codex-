"""Slice generated regional materials into registered, transparent sprite layers."""
from pathlib import Path
import json
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/carrot-elements/source'
TARGET=ROOT/'src/blade/assets/carrot-elements'
TARGET.mkdir(parents=True,exist_ok=True)
SIZE=(2172,724)
records=[]

def regional(source,name,windows):
    image=Image.open(SOURCE/source).convert('RGBA')
    if image.size!=SIZE:
        image=image.resize(SIZE,Image.Resampling.LANCZOS)
    # Feather only the crop boundaries. No material colors or silhouettes are painted here.
    values=[]
    for x in range(SIZE[0]):
        value=0
        for left,right,feather in windows:
            weight=max(0,min(1,(x-left)/feather,(right-x)/feather))
            value=max(value,round(weight*255))
        values.append(value)
    mask=Image.frombytes('L',(SIZE[0],1),bytes(values)).resize(SIZE,Image.Resampling.NEAREST)
    image.putalpha(ImageChops.multiply(image.getchannel('A'),mask))
    # Keep one coordinate system for every layer and the approved original grip/tip.
    path=TARGET/(name+'.webp')
    image.save(path,'WEBP',lossless=True,method=6)
    records.append({'id':name,'path':str(path.relative_to(ROOT)),'source':source,
                    'size':SIZE,'grip':[650,370],'physical_tip':[2085,370],
                    'windows':windows,'alpha_bounds':image.getchannel('A').getbbox(),
                    'alpha_extrema':image.getchannel('A').getextrema(),'bytes':path.stat().st_size})

regional('fire-poison.png','poison-body',[(620,1545,55)])
regional('fire-poison.png','poison-leaves',[(-100,585,50)])
regional('fire-poison.png','fire-tip',[(1440,2300,85)])
if (SOURCE/'frost-grip.png').exists():
    regional('frost-grip.png','frost-grip',[(-100,745,65)])
if (SOURCE/'electric-grip.png').exists():
    regional('electric-grip.png','electric-grip',[(-100,745,65)])
    regional('electric-grip.png','electric-grip-front',[(485,745,35)])
(ROOT/'art/carrot-elements/normalized.json').write_text(json.dumps(records,indent=2)+'\n')
print(f'Normalized {len(records)} registered generated material layers.')
