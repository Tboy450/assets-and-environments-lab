"""Make small animated WebP previews for the public showcase's GIFs.

Run from the project folder:  python -P scripts/make-gif-thumbnails.py
Reads showcase/studio/public-data.json and the GIF copies in showcase/public-assets/.
Writes .runtime/thumbnails/<asset id>.webp, where build-public-showcase.mjs picks them up.
Original GIFs are only read; the full GIF is still what the preview and download use.
"""
import json
import os
import sys
import urllib.parse

from PIL import Image, ImageSequence

SIZE = 320  # Longest side in pixels: sharp on Grid cards, tiny in the Explorer list.
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
catalog = os.path.join(root, 'showcase', 'studio', 'public-data.json')
out_dir = os.path.join(root, '.runtime', 'thumbnails')
os.makedirs(out_dir, exist_ok=True)

made = skipped = 0
before = after = 0
with open(catalog, encoding='utf-8') as handle:
    assets = json.load(handle)['assets']
for asset in assets:
    url = asset.get('url') or ''
    if not url.lower().endswith('.gif'):
        continue
    source = os.path.join(root, 'showcase', *urllib.parse.unquote(url).lstrip('/').split('/'))
    target = os.path.join(out_dir, asset['id'] + '.webp')
    if not os.path.isfile(source):
        sys.exit(f'Missing public GIF for {asset["id"]}: {url}')
    if os.path.isfile(target) and os.path.getmtime(target) >= os.path.getmtime(source):
        skipped += 1
        continue
    frames, durations = [], []
    with Image.open(source) as image:
        for frame in ImageSequence.Iterator(image):
            still = frame.convert('RGBA')
            still.thumbnail((SIZE, SIZE), Image.LANCZOS)
            frames.append(still)
            durations.append(frame.info.get('duration') or image.info.get('duration') or 100)
    temporary = target + '.tmp'
    frames[0].save(temporary, 'WEBP', save_all=True, append_images=frames[1:], duration=durations,
                   loop=0, quality=70, method=4)
    os.replace(temporary, target)
    made += 1
    before += os.path.getsize(source)
    after += os.path.getsize(target)
    print(f'{asset["filename"]}: {os.path.getsize(source) / 1e6:.2f} MB -> {os.path.getsize(target) / 1e3:.0f} KB')
print(f'{made} previews made, {skipped} already current' + (f'; {before / 1e6:.1f} MB of GIFs -> {after / 1e6:.1f} MB' if made else ''))
