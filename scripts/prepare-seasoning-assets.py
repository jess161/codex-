"""Normalize the generated 4x2 seasoning family without repainting any artwork."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/seasonings/source/seasoning-family.png'
TARGET = ROOT / 'src/blade/assets/seasonings'
IDS = ['seasoningTin', 'pepperPowder', 'chiliSauce', 'mushroomSauce',
       'thunderSalt', 'volcanicSauce', 'jadeMushroom']
image = Image.open(SOURCE).convert('RGBA')
TARGET.mkdir(parents=True, exist_ok=True)
records = []
# Generated rows are visually aligned, but their transparent gutter is above the
# geometric halfway point. Find that gutter per column so no neighbouring lid is cut in.
seams = []
for col in range(4):
    strip = image.getchannel('A').crop((round(col * image.width / 4), 0,
                                        round((col + 1) * image.width / 4), image.height))
    runs = []
    for y in range(image.height // 3, image.height * 2 // 3):
        if strip.crop((0, y, strip.width, y + 1)).getextrema()[1] < 16:
            if runs and y == runs[-1][-1] + 1:
                runs[-1].append(y)
            else:
                runs.append([y])
    gutter = max(runs, key=len) if runs else []
    seams.append((gutter[0] + gutter[-1]) // 2 if col < 3 and gutter else image.height // 2)
for index, name in enumerate(IDS):
    col, row = index % 4, index // 4
    box = (round(col * image.width / 4), 0 if row == 0 else seams[col],
           round((col + 1) * image.width / 4), seams[col] if row == 0 else image.height)
    cell = image.crop(box)
    bounds = cell.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError(f'Empty generated cell: {name}')
    sprite = cell.crop(bounds)
    sprite.thumbnail((224, 224), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (256, 256))
    canvas.alpha_composite(sprite, ((256 - sprite.width) // 2, (256 - sprite.height) // 2))
    path = TARGET / f'{name}.webp'
    canvas.save(path, 'WEBP', lossless=True, method=6)
    records.append({'id': name, 'path': str(path.relative_to(ROOT)), 'source_cell': box,
                    'alpha_crop': bounds, 'size': [256, 256], 'bytes': path.stat().st_size,
                    'alpha_extrema': canvas.getchannel('A').getextrema(),
                    'anchor': 'center', 'frames': 1, 'collision': 'none; UI only'})
(ROOT / 'art/seasonings/normalized.json').write_text(json.dumps(records, indent=2) + '\n')
print(f'Normalized {len(records)} generated icons into 256x256 lossless WebP files.')
