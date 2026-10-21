// Copy the six supplied GIFs into the local catalog without deleting source files.
// This rebuild replaces a crash-corrupted Python fragment; it is not recovered source.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {StudioStore} from '../lib/store.mjs';

export const mobileEffects = [
  ['1000046581', 'mobile-blue-white-energy-beam'],
  ['1000046582', 'mobile-cyan-energy-beam-with-rings'],
  ['1000046583', 'mobile-cyan-spinning-projectile'],
  ['1000046584', 'mobile-blue-beam-on-green-background'],
  ['1000046585', 'mobile-three-flame-projectile-variations'],
  ['1000046586', 'mobile-four-vertical-flame-variations'],
];

export async function importMobileEffects(store, sourceDirectory) {
  const folder = await fs.realpath(sourceDirectory);
  const candidates = [];
  // Validate every input before creating a batch: a bad sixth file must not
  // leave five apparently successful imports behind.
  for (const [number, label] of mobileEffects) {
    const name = `${label}-${number}`;
    let source;
    for (const filename of [`${number}.gif`, `${name}.gif`]) {
      const file = path.join(folder, filename);
      try {
        const info = await fs.lstat(file);
        if (!info.isFile() || info.isSymbolicLink()) throw Error(`Choose a regular GIF file: ${filename}`);
        source = file;
        break;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    if (!source) throw Error(`Missing mobile effect ${number}.gif`);
    const bytes = await fs.readFile(source);
    if (!['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) {
      throw Error(`Invalid GIF header: ${path.basename(source)}`);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    // Existing checksum receipts identify the same bytes even after a rename.
    const existing = store.state.assets.find(asset => asset.sha256 === sha256);
    candidates.push({source, name, sha256, existing});
  }
  const pending = candidates.filter(file => !file.existing);
  if (!pending.length) return {imported: 0, skipped: candidates.length};
  const batch = await store.createBatch('shared', 'Mobile animated effects', {
    creator: 'Unknown; user-supplied reference',
    license: 'Unreviewed; source and reuse rights not supplied',
  });
  for (const candidate of pending) {
    // StudioStore streams a byte-preserving copy, computes its own checksum,
    // and records the import in catalog history. Original downloads stay put.
    const relative = `Effects/Animated/${candidate.name}.gif`;
    const result = await store.receiveFile(batch.id, relative, createReadStream(candidate.source));
    if (result.asset.sha256 !== candidate.sha256) throw Error(`Source changed during import: ${candidate.name}`);
  }
  // Publication remains a separate allowlist operation. Importing never grants
  // public visibility or changes source/creator/license notices.
  return {imported: pending.length, skipped: candidates.length - pending.length, batchId: batch.id};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw Error('Usage: node scripts/import-mobile-effects.mjs SOURCE_FOLDER');
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const store = await new StudioStore(workspace).init();
  console.log(JSON.stringify(await importMobileEffects(store, process.argv[2])));
}
