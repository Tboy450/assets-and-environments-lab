import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(base,'provenance','source-manifest.json'),'utf8'));
const changed=[];
for(const file of manifest.files){const contents=await fs.readFile(path.join(manifest.source,file.path));if(createHash('sha256').update(contents).digest('hex')!==file.sha256)changed.push(file.path);}
const result={sourceCommit:manifest.sourceCommit,checkedOriginalFiles:manifest.files.length,changedOriginalFiles:changed,note:'Read-only comparison against the original source. This verifies files, not public deployment/browser appearance.'};
await fs.writeFile(path.join(base,'provenance','source-verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));if(changed.length)process.exitCode=1;
