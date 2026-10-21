import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {StudioStore} from '../lib/store.mjs';
import {bootstrapPortableCatalog} from '../lib/portable-catalog.mjs';

test('Portable showcase resolves converted glTF without its private import batch',async()=>{
  // Keep test files inside the workspace, matching Windows app permissions.
  const scratch=path.resolve('tests/.work');
  await fs.mkdir(scratch,{recursive:true});
  const directory=await fs.mkdtemp(path.join(scratch,'portable-'));
  try{
    await fs.mkdir(path.join(directory,'showcase/public-assets/kit'),{recursive:true});
    await fs.mkdir(path.join(directory,'showcase/studio'),{recursive:true});
    await fs.mkdir(path.join(directory,'showcase/thumbnails'),{recursive:true});
    await fs.writeFile(path.join(directory,'showcase/public-assets/kit/model.gltf'),'model bytes');
    await fs.writeFile(path.join(directory,'showcase/studio/public-data.json'),JSON.stringify({projects:[],assets:[{id:'portable',batchId:'private-batch',kind:'model',relative:'original.glb',url:'/public-assets/kit/model.gltf'}]}));
    const store=await new StudioStore(directory).init();
    await bootstrapPortableCatalog(store,directory);
    assert.equal(store.asset('portable').batchId,undefined);
    assert.equal(store.asset('portable').relative,'model.gltf');
    assert.equal(await fs.readFile(await store.resolveFile('portable','model.gltf'),'utf8'),'model bytes');
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
