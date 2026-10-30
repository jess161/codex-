"""Deterministically slice and normalize the generated family; retain original PNG."""
from pathlib import Path
from PIL import Image
import hashlib, json
src=Path('art/blade-relics/source/passive-items.png')
im=Image.open(src).convert('RGBA'); w,h=im.size
alpha=im.getchannel('A'); pixels=alpha.load()
assert alpha.getextrema()[0]==0 and alpha.getextrema()[1]==255
col=[sum(pixels[x,y]>48 for y in range(h)) for x in range(w)]
row=[sum(pixels[x,y]>48 for x in range(w)) for y in range(h)]
def split(counts,center):
 lo=max(0,int(center-90)); hi=min(len(counts),int(center+90))
 runs=[]; start=None
 for i in range(lo,hi):
  if counts[i]<=2 and start is None: start=i
  if start is not None and (counts[i]>2 or i==hi-1):
   runs.append((start,i)); start=None
 assert runs,'No transparent separator'
 a,b=max(runs,key=lambda r:r[1]-r[0]); return (a+b)//2
xs=[0]+[split(col,w*i/4) for i in range(1,4)]+[w]
ys=[0]+[split(row,h*i/3) for i in range(1,3)]+[h]
names=[['stone','feather','ember','heart'],['ruler','bell','crystal','magnet'],['anvil','hourglass','thunder','star']]
out=Path('src/blade/assets/relics'); out.mkdir(parents=True,exist_ok=True)
records=[]
for y in range(3):
 for x in range(4):
  name=names[y][x]; crop=im.crop((xs[x],ys[y],xs[x+1],ys[y+1])); bbox=crop.getchannel('A').getbbox(); assert bbox
  crop=crop.crop(bbox); crop.thumbnail((336,336),Image.Resampling.LANCZOS)
  normalized=Image.new('RGBA',(384,384)); normalized.alpha_composite(crop,((384-crop.width)//2,(384-crop.height)//2))
  path=out/f'{name}.webp'; normalized.save(path,lossless=True,method=6)
  assert normalized.getchannel('A').getpixel((0,0))==0
  records.append({'id':name,'file':str(path),'size':[384,384],'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source_cell':[xs[x],ys[y],xs[x+1],ys[y+1]]})
record={'source':str(src),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'generator':'OpenAI image_gen; user-requested passive-item family, original sheet retained','direction':'Rounded candy forms, navy outlines, bright simple shading and white highlights','preparation':'Alpha-verified transparent separators; tight crops, aspect preserved, padded 384px lossless WebP','runtime_rgba_bytes':384*384*4*12,'items':records}
Path('art/blade-relics/manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print('12 alpha-verified icons prepared;',sum(r['bytes'] for r in records),'runtime bytes; separators',xs,ys)
