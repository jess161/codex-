"""Normalize the approved static art into game sprites, preserving source originals."""
from pathlib import Path
import math
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output/art/blade-evolution-v0.1'
TARGET = ROOT / 'src/blade/assets'
TARGET.mkdir(parents=True, exist_ok=True)

def trimmed(image, size, padding=12):
    bounds = image.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    if bounds:
        image = image.crop(bounds)
    image.thumbnail((size-padding*2, size-padding*2), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size))
    canvas.alpha_composite(image, ((size-image.width)//2, (size-image.height)//2))
    return canvas

characters = Image.open(SOURCE / '03-characters-and-pickups.png').convert('RGBA')
rectangles = {
    'hero': (55, 108, 450, 402),
    'blob': (510, 142, 807, 393),
    'swift': (921, 108, 1159, 393),
    'armor': (95, 425, 452, 744),
    'shooter': (478, 477, 807, 745),
    'elite': (805, 394, 1254, 787),
    'boss': (10, 739, 531, 1215),
    'xp': (588, 838, 864, 1175),
    'heal': (898, 865, 1216, 1180),
}
for key, box in rectangles.items():
    trimmed(characters.crop(box), 384 if key == 'boss' else 256).save(TARGET / f'{key}.png', optimize=True)

weapons = Image.open(SOURCE / '02-six-blade-forms.png').convert('RGBA')
# Approved sheet is a visual layout, not an evenly divided animation atlas.
# Blade handles and tips explicitly establish one shared rotation pivot.
blades = [
    ((85, 145, 385, 420), (153, 365), (349, 180)),
    ((560, 48, 990, 485), (620, 421), (937, 82)),
    ((1050, 20, 1523, 486), (1140, 407), (1457, 48)),
    ((12, 490, 495, 1015), (116, 911), (431, 509)),
    ((513, 485, 1017, 1017), (607, 934), (953, 498)),
    ((1025, 464, 1536, 1024), (1122, 938), (1501, 481)),
]
for i, (box, handle, tip) in enumerate(blades, 1):
    image = weapons.crop(box)
    hx, hy = handle[0]-box[0], handle[1]-box[1]
    angle = math.atan2(tip[1]-handle[1], tip[0]-handle[0])
    scale = 510/math.dist(handle, tip)
    c, s = math.cos(angle)/scale, math.sin(angle)/scale
    # Inverse affine: source handle maps to the consistent output pivot (56,128).
    matrix = (c, -s, hx-56*c+128*s, s, c, hy-56*s-128*c)
    normalized = image.transform((640, 256), Image.Transform.AFFINE, matrix, Image.Resampling.BICUBIC)
    normalized.save(TARGET / f'blade-{i}.png', optimize=True)

effects = Image.open(SOURCE / '04-six-slash-effects.png').convert('RGBA')
for i in range(6):
    x, y = (i%3)*512, (i//3)*512
    effects.crop((x, y, x+512, y+512)).resize((384, 384), Image.Resampling.LANCZOS).save(TARGET / f'slash-{i+1}.png', optimize=True)

manifest = {'source': str(SOURCE.relative_to(ROOT)), 'bladeFrame': [640, 256], 'bladePivot': [56, 128], 'bladeTipDistance': 510, 'sprites': list(rectangles), 'note': 'Static source art animated in-engine; all original images are preserved.'}
(TARGET / 'provenance.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Prepared 21 transparent game sprites in {TARGET}')
