import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {browseRows} from '../site/studio/browse-data.mjs';
import {StudioStore} from '../lib/store.mjs';
import {nativeImport,pickerDirectory} from '../lib/native-picker.mjs';
import {inCollection,collectionAssets} from '../site/studio/collections.mjs';
test('All collections lists Swarmfall copies of archived kit files once; their own collection keeps them',()=>{
  const rows=[{id:'archive-tree',projectId:'shared',kind:'model',filename:'tree-high.glb'},{id:'swarm-tree',projectId:'swarmfall',kind:'bundled',filename:'tree-high.glb'},
    {id:'swarm-drone',projectId:'swarmfall',kind:'bundled',filename:'scout.glb'},{id:'rpg-tree',projectId:'dragons-lair',kind:'image',filename:'tree-high.png'}];
  assert.deepEqual(collectionAssets(rows,'all-local').map(a=>a.id),['archive-tree','swarm-drone','rpg-tree']);
  assert.deepEqual(collectionAssets(rows,'swarmfall').map(a=>a.id),['swarm-tree','swarm-drone']);
  assert.deepEqual(collectionAssets(rows,null).map(a=>a.id),rows.map(a=>a.id));
});
test('Blender includes archived compatible models without exposing unrelated media or duplicating catalog entries',()=>{
  const rows=[{id:'kit',projectId:'shared',kind:'model',format:'glb'},{id:'native',projectId:'shared',kind:'source',format:'blend'},{id:'texture',projectId:'shared',kind:'image',format:'png'},{id:'rpg',projectId:'dragons-lair',kind:'image',format:'png'},{id:'own',projectId:'blender',kind:'model'}];
  assert.deepEqual(rows.filter(a=>inCollection(a,'blender')).map(a=>a.id),['kit','native','own']);
  assert.equal(rows.length,5);assert.equal(inCollection(rows[0],'shared'),true);assert.equal(inCollection(rows[3],'all-local'),true);
  assert.equal(browseRows([{id:'terrain',kind:'terrain',name:'Titan'}],{mode:'worlds'}).length,1);
});
test('Browse groups animation frames and sorts actual images and rendered thumbnails ahead of blanks',()=>{
  const rows=browseRows([{id:'blank',name:'A blank model',kind:'model'},{id:'rendered',name:'Z model',kind:'model',thumbnailUrl:'/model.png'},{id:'image',name:'B sprite',kind:'image'},{id:'f1',name:'frame_01',filename:'frame_01.png',relative:'effects/fire/frame_01.png',projectId:'rpg',kind:'image'},{id:'f2',name:'frame_02',filename:'frame_02.png',relative:'effects/fire/frame_02.png',projectId:'rpg',kind:'image'}],{mode:'all'});
  assert.equal(rows.length,4);assert.equal(rows.at(-1).id,'blank');assert.equal(rows.find(r=>r.frames).frames.length,2);assert.equal(browseRows(rows,{mode:'models',favorites:new Set(['rendered'])})[0].id,'rendered');
});
test('Windows import starts in configured assets and remembers the selected folder without changing originals',async()=>{
  const scratch=path.join(path.dirname(fileURLToPath(import.meta.url)),'.work');await fs.mkdir(scratch,{recursive:true});const base=await fs.mkdtemp(path.join(scratch,'picker-'));
  try{
    const store=await new StudioStore(base).init(),source=path.join(base,'source'),other=path.join(base,'other');await fs.mkdir(source);await fs.mkdir(other);const original=Buffer.from('source bytes');const file=path.join(other,'scene.hiplc');await fs.writeFile(file,original);
    const config={sources:[{projectId:'shared',root:source}]};assert.equal(await pickerDirectory(store,config,'shared'),source);
    const result=await nativeImport(store,config,'shared',{},async initial=>{assert.equal(initial,source);return [file];});assert.equal(result.imported,1);assert.equal(await pickerDirectory(store,config,'shared'),other);assert.deepEqual(await fs.readFile(file),original);assert.equal((await nativeImport(store,config,'shared',{},async()=>[])).cancelled,true);
  }finally{await fs.rm(base,{recursive:true,force:true});}
});
