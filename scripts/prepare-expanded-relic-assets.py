"""Deterministic slicing of generated, transparent originals; no repainting."""
from pathlib import Path
from PIL import Image
import hashlib, json

records=[]
for sheet,cols,names in [('a',4,'wrap echo boots fan venom prism food phoenix fang scope leech comet'.split()),('b',3,'execution crown redmoon blackhole mirror overdrive berry bread drumstick'.split())]:
 src=Path(f'art/blade-relics/source/expanded-{sheet}.png')
 im=Image.open(src).convert('RGBA'); w,h=im.size; alpha=im.getchannel('A'); px=alpha.load()
 assert alpha.getextrema()[0]==0 and alpha.getextrema()[1]>=254
 col=[sum(px[x,y]>48 for y in range(h)) for x in range(w)]
 row=[sum(px[x,y]>48 for x in range(w)) for y in range(h)]
 def split(counts,center):
  lo=max(0,int(center-90)); hi=min(len(counts),int(center+90)); runs=[]; start=None
  for i in range(lo,hi):
   if counts[i]<=2 and start is None: start=i
   if start is not None and (counts[i]>2 or i==hi-1): runs.append((start,i)); start=None
  assert runs, 'No transparent separator'
  a,b=min(runs,key=lambda r:abs((r[0]+r[1])/2-center)); return (a+b)//2
 xs=[0]+[split(col,w*i/cols) for i in range(1,cols)]+[w]
 ys=[0]+[split(row,h*i/3) for i in range(1,3)]+[h]
 for i,name in enumerate(names):
  x,y=i%cols,i//cols; cell=(xs[x],ys[y],xs[x+1],ys[y+1]); crop=im.crop(cell); bbox=crop.getchannel('A').getbbox(); assert bbox
  crop=crop.crop(bbox); scale=min(336/crop.width,336/crop.height)
  crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
  out=Image.new('RGBA',(384,384)); out.alpha_composite(crop,((384-crop.width)//2,(384-crop.height)//2))
  food=name in ['berry','bread','drumstick']; folder=Path('src/blade/assets/food' if food else 'src/blade/assets/relics'); folder.mkdir(parents=True,exist_ok=True)
  path=folder/f'{"food-" if food else ""}{name}.webp'; out.save(path,lossless=True,method=6)
  assert out.getchannel('A').getpixel((0,0))==0
  records.append(dict(id=name,source=str(src),source_sha256=hashlib.sha256(src.read_bytes()).hexdigest(),cell=cell,crop=bbox,file=str(path),size=[384,384],bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
Path('art/blade-relics/expanded-manifest.json').write_text(json.dumps(dict(generator='OpenAI image_gen, original PNGs retained; reference: passive-items.png',style='Rounded candy forms, navy outlines, white highlights',preparation='Transparent separator slicing; tight crop; aspect-preserving fit with padding; lossless WebP',runtime_rgba_bytes=384*384*4*len(records),items=records),ensure_ascii=False,indent=2)+'\n')
print(f'{len(records)} transparent icons; {sum(r["bytes"] for r in records)} bytes')
