import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {StudioStore} from '../lib/store.mjs';
import {importMobileEffects, mobileEffects} from '../scripts/import-mobile-effects.mjs';

async function fixture(run) {
  const scratch = path.resolve('tests/.work');
  await fs.mkdir(scratch, {recursive: true});
  const folder = await fs.mkdtemp(path.join(scratch, 'mobile-'));
  try {
    const source = path.join(folder, 'originals');
    await fs.mkdir(source);
    for (const [number] of mobileEffects) await fs.writeFile(path.join(source, number + '.gif'), 'GIF89a' + number);
    await run({source, store: await new StudioStore(folder).init()});
  } finally {
    await fs.rm(folder, {recursive: true, force: true});
  }
}

test('Mobile import preserves original bytes, receipts, license notes and avoids duplicates on rerun', async () => fixture(async ({source, store}) => {
  assert.equal((await importMobileEffects(store, source)).imported, 6);
  assert.equal(store.state.assets.length, 6);
  for (const asset of store.state.assets) {
    const original = path.join(source, asset.name.match(/100004658[1-6]/)[0] + '.gif');
    assert.deepEqual(await fs.readFile(await store.resolveFile(asset.id, asset.relative)), await fs.readFile(original));
    assert.match(asset.license, /Unreviewed/);
  }
  assert.deepEqual(await importMobileEffects(store, source), {imported: 0, skipped: 6});
  assert.equal(store.state.batches.length, 1);
}));

test('Mobile import rejects an invalid final GIF before changing the catalog', async () => fixture(async ({source, store}) => {
  await fs.writeFile(path.join(source, '1000046586.gif'), 'not a GIF');
  await assert.rejects(importMobileEffects(store, source), /Invalid GIF header/);
  assert.equal(store.state.assets.length, 0);
  assert.equal(store.state.batches.length, 0);
}));
