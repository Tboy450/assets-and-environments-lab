import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {StudioStore,previewKind} from '../lib/store.mjs';
import {scanSources} from '../lib/sources.mjs';
const scratch=path.join(path.dirname(fileURLToPath(import.meta.url)),'.work');
async function temporary(){await fs.mkdir(scratch,{recursive:true});return fs.mkdtemp(path.join(scratch,'sources-'));}

test('Configured sources rescan without duplication, retain originals and report removed/offline files',async()=>{
  const temp=await temporary();
  try{
    const sources=path.join(temp,'sources');await fs.mkdir(path.join(sources,'textures'),{recursive:true});
    const bytes=Buffer.from('native scene fixture');await fs.writeFile(path.join(sources,'coast.hiplc'),bytes);
    await fs.writeFile(path.join(sources,'textures','ground.png'),bytes);await fs.writeFile(path.join(sources,'private.env'),'skip');
    await fs.mkdir(path.join(sources,'.venv'));await fs.writeFile(path.join(sources,'.venv','skip.png'),bytes);
    const store=await new StudioStore(path.join(temp,'studio')).init();
    const config={projects:[{id:'houdini',name:'Houdini'}],sources:[{id:'coast',name:'Coast',projectId:'houdini',root:sources,license:'Apprentice noncommercial'}]};
    assert.equal((await scanSources(store,config)).sources[0].added,2);
    assert.equal((await scanSources(store,config)).sources[0].added,0);
    assert.equal(store.state.assets.length,2);
    const native=store.state.assets.find(a=>a.format==='hiplc');assert.equal(native.license,'Apprentice noncommercial');
    assert.deepEqual(await fs.readFile(await store.resolveFile(native.id,native.relative)),bytes);
    await fs.unlink(path.join(sources,'coast.hiplc'));assert.equal((await scanSources(store,config)).sources[0].missing,1);
    assert.equal(store.asset(native.id).available,false);await assert.rejects(store.resolveFile(native.id,native.relative),/missing|offline/);
    await fs.rename(sources,sources+'-offline');assert.equal((await scanSources(store,config)).sources[0].errors.length,1);
    assert.equal(store.state.assets.length,2);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
});

test('Houdini native formats and caches import intact; media classification includes GIF/audio/video',async()=>{
  const temp=await temporary();
  try{
    const store=await new StudioStore(temp).init(),batch=await store.createBatch('shared','Houdini');
    for(const name of ['scene.hiplc','tool.hdanc','terrain.bgeo.sc','smoke.vdb','world.usdc']){
      const bytes=Buffer.from(name);const result=await store.receiveFile(batch.id,name,Readable.from([bytes]));
      assert.deepEqual(await fs.readFile(await store.resolveFile(result.asset.id,name)),bytes);
    }
    assert.equal(previewKind('attack.gif'),'image');assert.equal(previewKind('sound.ogg'),'audio');assert.equal(previewKind('effect.mp4'),'video');
  }finally{await fs.rm(temp,{recursive:true,force:true});}
});
