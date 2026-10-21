"""One-time GitHub migration of already-public media, verified against local hashes."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

root = Path(__file__).resolve().parent.parent
rows = json.loads((root / 'provenance/public-media-migration.json').read_text())['files']
groups = {}
for row in rows:
    groups.setdefault(row['sha256'], []).append(row)

def restore(group):
    # Download a public byte sequence once, even when site and showcase share it.
    row = group[0]
    request = urllib.request.Request(row['url'], headers={'User-Agent': 'AssetLabPublicMigration/1.0'})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read(row['bytes'] + 1)
    if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
        raise ValueError('Public media checksum mismatch: ' + row['path'])
    for entry in group:
        target = (root / entry['path']).resolve()
        if not target.is_relative_to(root) or not entry['path'].startswith(('site/', 'showcase/')):
            raise ValueError('Invalid public media destination')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return len(group)

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    total = sum(pool.map(restore, groups.values()))
print(f'Verified and restored {total} public media files; no private imports included.')
