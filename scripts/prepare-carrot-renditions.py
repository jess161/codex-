"""Register generated RGBA sprites, preserving native soft alpha and full canvases.

No original-sheet cutouts, RGB threshold matting or glow clipping enter the game.
"""
from pathlib import Path
import json,math,hashlib
import numpy as np
from scipy import ndimage
from PIL import Image,ImageChops,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/carrot-element-reference'
OUTPUT=ROOT/'src/blade/assets/carrot-sword/renditions'
OUTPUT.mkdir(parents=True,exist_ok=True)
spec=json.loads((ART/'production-inputs.json').read_text())
records=[];sources={};transforms={};extent=[]
ADVANCE=1024

for name,item in spec['images'].items():
    path=ART/item['file'];raw=Image.open(path).convert('RGBA')
    if raw.getchannel('A').getextrema()[0]!=0:
        raise ValueError(f'{name}: native transparent background missing; regenerate, never threshold-matte')
    w,h=raw.size;grip=item.get('grip',[w*.5,h*(460/1536)])
    if 'tip' in item:tip=item['tip']
    else:
        # This mask locates physical geometry only; it is NEVER applied to pixels.
        alpha=np.asarray(raw.getchannel('A'));centre=alpha[int(h*.65):,int(w*.36):int(w*.64)]
        ys,xs=np.where(centre>220)
        if not len(ys):raise ValueError(f'{name}: physical tip needs a manual landmark')
        bottom=int(ys.max());tip=[float(np.median(xs[ys>=bottom-2])+int(w*.36)),float(bottom+int(h*.65))]
    rotated=raw.transpose(Image.Transpose.ROTATE_90)
    hand=(grip[1],w-1-grip[0]);end=(tip[1],w-1-tip[0])
    dx,dy=end[0]-hand[0],end[1]-hand[1];scale=ADVANCE/math.hypot(dx,dy)
    angle=math.atan2(dy,dx);c,s=math.cos(angle),math.sin(angle)
    transforms[name]=(hand,scale,c,s)
    for x,y in [(0,0),(h,0),(0,w),(h,w)]:
        extent.append((scale*(c*(x-hand[0])+s*(y-hand[1])),scale*(-s*(x-hand[0])+c*(y-hand[1]))))
    sources[name]=(rotated,item,raw.size,grip,tip)

left=math.ceil(-min(x for x,y in extent))+32;top=math.ceil(-min(y for x,y in extent))+32
width=math.ceil((left+max(x for x,y in extent)+32)/32)*32
height=math.ceil((top+max(y for x,y in extent)+32)/32)*32
FRAME=(width,height);PIXEL_SCALE=4;RASTER=(width//PIXEL_SCALE,height//PIXEL_SCALE);GRIP=(left,top);TIP=(left+ADVANCE,top)
registered={}

def save(name,image,**metadata):
    if image.size!=RASTER:image=image.resize(RASTER,Image.Resampling.LANCZOS)
    target=OUTPUT/(name+'.webp');image.save(target,'WEBP',lossless=True,method=6)
    alpha=np.asarray(image.getchannel('A'))
    records.append({'id':name,'path':str(target.relative_to(ROOT)),'logical_frame':FRAME,'raster_size':RASTER,
      'grip':GRIP,'physical_tip':TIP,'alpha_extrema':[int(alpha.min()),int(alpha.max())],
      'soft_alpha_pixels':int(((alpha>0)&(alpha<255)).sum()),'bytes':target.stat().st_size,
      'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),**metadata})
    return image

for name,(rotated,item,original_size,source_grip,source_tip) in sources.items():
    hand,scale,c,s=transforms[name]
    a,b,d,e=c/scale,-s/scale,s/scale,c/scale
    matrix=(a,b,hand[0]-a*left-b*top,d,e,hand[1]-d*left-e*top)
    image=rotated.transform(FRAME,Image.Transform.AFFINE,matrix,Image.Resampling.BICUBIC)
    registered[name]=save(name,image,origin='image_gen.imagegen; full native RGBA preserved',source=item['file'],
      prompt=item['prompt'],source_size=original_size,source_grip=source_grip,source_tip=source_tip,
      raw_sha256=hashlib.sha256((ART/item['file']).read_bytes()).hexdigest(),glow_clipped=False)

def interval_runs(mask):
    values=np.flatnonzero(mask)
    if not len(values):return []
    pieces=np.split(values,np.flatnonzero(np.diff(values)>1)+1)
    return [(int(p[0]),int(p[-1])) for p in pieces if len(p)>1]

base=registered['base'];base_array=np.asarray(base);neutral_alpha=np.asarray(base.getchannel('A'),dtype=float)/255
shape=base_array[:,:,3]>200  # Geometry lookup only, never background removal.
valid_columns=[x for x in range(RASTER[0]) if np.any(shape[:,x])]

def apply_form(material,form,preserve_leaf_paint=False):
    """Fit the generated material to a generated form, leaving native glow whole."""
    target=np.asarray(registered[form]).copy();texture=np.asarray(material)
    mask=target[:,:,3]>200
    leaf_columns=np.arange(RASTER[0])<(left-60)/PIXEL_SCALE
    base_weight=neutral_alpha[:,leaf_columns]
    material_weight=np.asarray(material.getchannel('A'),dtype=float)[:,leaf_columns]/255
    base_mean=(base_array[:,leaf_columns,:3]*base_weight[:,:,None]).sum((0,1))/max(1,base_weight.sum())
    material_mean=(texture[:,leaf_columns,:3]*material_weight[:,:,None]).sum((0,1))/max(1,material_weight.sum())
    leaf_tint=material_mean/max(16,float(np.dot(base_mean,[.2126,.7152,.0722])))
    for x in range(RASTER[0]):
        pieces=interval_runs(mask[:,x])
        if not pieces:continue
        if leaf_columns[x] and not preserve_leaf_paint:
            # Preserve the drawn leaf-bridge texture rather than repeating an
            # entire crown pattern into each small leaf of the dual form.
            luminance=np.dot(target[:,x,:3],[.2126,.7152,.0722])
            target[:,x,:3]=np.clip(luminance[:,None]*leaf_tint[None,:],0,255)
            continue
        sx=min(valid_columns,key=lambda col:abs(col-x));ys=np.flatnonzero(shape[:,sx]);lo,hi=int(ys[0]),int(ys[-1])
        available=np.flatnonzero((texture[:,sx,3]>128)&(np.arange(RASTER[1])>=lo)&(np.arange(RASTER[1])<=hi))
        if not len(available):available=np.flatnonzero(texture[:,sx,3]>128)
        if not len(available):continue
        source_lo,source_hi=int(available[0]),int(available[-1])
        for begin,end in pieces:
            coords=np.linspace(source_lo,source_hi,end-begin+1)
            samples=np.clip(np.rint(coords).astype(int),0,RASTER[1]-1)
            for index,row in enumerate(samples):
                if texture[row,sx,3]<128:coords[index]=available[np.argmin(abs(available-row))]
            for channel in range(3):
                target[begin:end+1,x,channel]=np.interp(coords,np.arange(RASTER[1]),texture[:,sx,channel])
    # Do not erase the form's original anti-aliased pixels or soft alpha.
    result=Image.fromarray(target,'RGBA')
    if form=='greatsword' and 'armor' in registered:result=Image.alpha_composite(result,registered['armor'])
    return result

def native_aura(image):
    aura=image.copy();alpha=np.asarray(image.getchannel('A'),dtype=float)
    # Continuous neutral coverage removes only the opaque core from this copy.
    # The generated halo outside that core retains its original fractional alpha.
    aura.putalpha(Image.fromarray(np.uint8(np.rint(alpha*(1-neutral_alpha))),'L'))
    return aura

bank={form:{} for form in ['base','greatsword','dual','wave']}
single={1:'fire',2:'ice',4:'poison',8:'lightning',7:'calamity'}
element_bits={'fire':1,'ice':2,'poison':4,'lightning':8}
x=np.arange(RASTER[0])*PIXEL_SCALE
zones={'ice':(0,left+130),'poison':(left+150,left+820),'fire':(left+760,width),'lightning':(left+60,left+330)}
for bits in range(15):
    if bits==0:
        for form in bank:bank[form][bits]=form
        continue
    if bits in single:
        name=single[bits];material=registered[name];bank['base'][bits]=name
    else:
        material=base.copy()
        for element in ['ice','poison','fire','lightning']:
            if not bits&element_bits[element]:continue
            raw=registered[element];core=raw.copy();start,end=zones[element]
            feather=np.clip(np.minimum((x-start)/55,(end-x)/55),0,1)
            if start==0:feather[x<55]=1
            coverage=neutral_alpha*feather[None,:]
            core.putalpha(Image.fromarray(np.uint8(np.rint(np.asarray(raw.getchannel('A'))*coverage)),'L'))
            material=Image.alpha_composite(material,core)
            if element!='lightning' or 'lightning-fx' not in registered:
                material=Image.alpha_composite(material,native_aura(raw))
        if bits&8 and 'lightning-fx' in registered:material=Image.alpha_composite(material,registered['lightning-fx'])
        name='mix-'+str(bits);material=save(name,material,origin='registered generated-material zones; full exterior halos retained',elements=bits)
        bank['base'][bits]=name
    for form in ['greatsword','dual','wave']:
        if form=='wave':
            result=material.copy()
            if bits!=7:result=Image.alpha_composite(result,registered.get('wave-fx',native_aura(registered['wave'])))
        else:
            if bits==7 and 'calamity-fx' in registered:
                result=Image.alpha_composite(apply_form(material,form,True),registered['calamity-fx'])
            elif bits&8 and 'lightning-fx' in registered:
                result=Image.alpha_composite(apply_form(material,form),registered['lightning-fx'])
            else:result=Image.alpha_composite(native_aura(material),apply_form(material,form))
        name='skin-'+form+'-'+str(bits)
        save(name,result,origin='generated form and generated material registration; no original-sheet pixels',elements=bits)
        bank[form][bits]=name

# A separate opaque-core contour is used only by the retained 3D viewer.
labels,n=ndimage.label(shape);counts=np.bincount(labels.ravel());counts[0]=0;geometry=labels==int(counts.argmax())
def contour(mask):
    h,w=mask.shape;first=np.argwhere(mask)[0];start=(int(first[1]),int(first[0]));point=start;back=(start[0]-1,start[1])
    neighbours=[(-1,-1),(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0)]
    points=[];first_step=None
    for _ in range(w*h):
        points.append(point);begin=neighbours.index((back[0]-point[0],back[1]-point[1]))
        for step in range(8):
            index=(begin+step)%8;dx,dy=neighbours[index];next_point=(point[0]+dx,point[1]+dy)
            if 0<=next_point[0]<w and 0<=next_point[1]<h and mask[next_point[1],next_point[0]]:
                previous=neighbours[(index-1)%8];next_back=(point[0]+previous[0],point[1]+previous[1]);break
        else:raise ValueError('Physical contour contains an isolated point')
        if first_step is None:first_step=next_point
        elif point==start and next_point==first_step:return points[:-1]
        point=next_point;back=next_back
    raise ValueError('Physical contour did not close')

def simplify(points,tolerance=1):
    if len(points)<3:return points
    a,b=points[0],points[-1];dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
    distances=[abs(dy*(p[0]-a[0])-dx*(p[1]-a[1]))/length if length else math.hypot(p[0]-a[0],p[1]-a[1]) for p in points]
    peak=max(range(len(points)),key=distances.__getitem__)
    if distances[peak]<=tolerance:return [a,b]
    return simplify(points[:peak+1],tolerance)[:-1]+simplify(points[peak:],tolerance)

edge=contour(geometry);middle=len(edge)//2
points=simplify(edge[:middle+1])[:-1]+simplify(edge[middle:]+[edge[0]])[:-1]
points=[(x*PIXEL_SCALE,y*PIXEL_SCALE) for x,y in points]
outline='M'+' L'.join(f'{px} {py}' for px,py in points)+' Z'
layout={'width':width,'height':height,'source':{'width':width,'height':height,'x':0,'y':0},'grip':GRIP,'tip':TIP,'outline':outline}
fx={'width':width,'height':height,'grip':GRIP,'tip':TIP,'poisonDrop':[left+650,top+160],
 'fireTip':[left+1010,top],'electricSpark':[left+180,top-180],
 'electricArc':[[left+150,top-150],[left+205,top-70],[left+150,top],[left+210,top+75],[left+150,top+150]],
 'poisonTrail':[left+650,top+160],'electricTrail':[left+190,top+150],'frostTrail':[left-100,top+120]}
(OUTPUT.parent/'rendition-layout.ts').write_text('// Generated RGBA art registered without alpha threshold matting.\n'
 +'export const RENDITION_LAYOUT = '+json.dumps(layout,indent=2)+' as const;\n'
 +'export const RENDITION_FX = '+json.dumps(fx,indent=2)+' as const;\n'
 +'export const RENDITION_APPEARANCES = '+json.dumps(bank,indent=2)+' as const;\n')

manifest={'schema_version':2,'approved_visual_target':'source/fire-glow-refined.png',
 'user_approval':'按这个标准继续重制整套','original_design':'reference.jpg','active_original_sheet_cutouts':False,
 'alpha_policy':'native generated alpha retained; no RGB keying, no threshold matting, full canvas bounds retained',
 'actual_production_imagegen_calls':len(spec['images'])+1,'assets':records,
 'review':{'static_native_scale':True,'tests':False,'gameplay':False,'browser':False,'typecheck':False}}
(ART/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

families=['base','fire','ice','poison','lightning','calamity','greatsword','dual','wave']
sheet=Image.new('RGB',(1200,len(families)*160),'#eef2ec');draw=ImageDraw.Draw(sheet)
for row,name in enumerate(families):
    y=row*160;draw.rectangle((600,y,1200,y+160),fill='#261e22');draw.text((10,y+8),name,fill='#29475d')
    image=registered[name]
    for start in [85,685]:
        for offset,size in [(0,50),(130,80),(290,110)]:
            s=size/image.width;preview=image.resize((size,max(1,round(image.height*s))),Image.Resampling.LANCZOS)
            sheet.paste(preview,(start+offset,y+45),preview)
sheet.save(ART/'native-preview.png')
sample_ids=['base','fire','ice','poison','lightning','calamity','greatsword','dual','wave',
 'skin-greatsword-1','skin-greatsword-2','skin-greatsword-7','skin-dual-1','skin-dual-2','skin-dual-7',
 'skin-wave-1','skin-wave-7','mix-3']
sample=Image.new('RGB',(1200,1500),'#eef2ec');draw=ImageDraw.Draw(sample)
for index,name in enumerate(sample_ids):
    x=(index%3)*400;y=(index//3)*250;dark=index%2
    draw.rectangle((x,y,x+400,y+250),fill='#261e22' if dark else '#eef2ec')
    draw.text((x+10,y+8),name,fill='white' if dark else '#29475d')
    image=Image.open(OUTPUT/(name+'.webp')).convert('RGBA');scale=min(370/image.width,205/image.height)
    preview=image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS)
    sample.paste(preview,(x+(400-preview.width)//2,y+30),preview)
sample.save(ART/'combinations-preview.png')
print(f'Prepared {len(records)} transparent textures; common frame {FRAME}, raster {RASTER}. Native alpha preserved.')
