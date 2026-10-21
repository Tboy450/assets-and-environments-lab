import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Writable } from 'node:stream';
import vm from 'node:vm';
import { StudioStore, cleanRelative, contained } from '../lib/store.mjs';
import { createStudioServer, seedAssets } from '../server.mjs';

const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),scratch=path.join(base,'tests','.work');
async function fixture(run){
  await fs.mkdir(scratch,{recursive:true});const directory=await fs.mkdtemp(path.join(scratch,'studio-'));
  try{await run(directory);}finally{const resolved=path.resolve(directory);assert.ok(contained(scratch,resolved)&&resolved!==scratch);await fs.rm(resolved,{recursive:true,force:true});}
}
test('Relative import paths preserve folder dependencies and reject traversal/device names',()=>{
  assert.equal(cleanRelative('Trees/textures/leaf.png'),'Trees/textures/leaf.png');
  for(const value of ['../private','/absolute','C:\\file','tree/../../secret','tree//a.glb','CON.blend','NUL','folder./x','a\u0000.glb'])assert.throws(()=>cleanRelative(value));
});
test('Imports keep native Blender bytes, calculate a receipt, preserve duplicates, dependencies and project state',async()=>fixture(async directory=>{
  const store=await new StudioStore(directory).init();const project=await store.createProject('Another project');
  const batch=await store.createBatch(project.id,'Robot',{creator:'Owner',license:'Private original'});
  const original=Buffer.from('BLENDER-v300 native source fixture');
  const result=await store.receiveFile(batch.id,'Robot/native.blend',Readable.from([original]));
  assert.equal(result.asset.kind,'source');assert.equal(result.asset.projectId,project.id);assert.equal(result.asset.license,'Private original');assert.equal(result.asset.sha256.length,64);
  assert.deepEqual(await fs.readFile(await store.resolveFile(result.asset.id,'Robot/native.blend')),original);
  await assert.rejects(store.receiveFile(batch.id,'Robot/native.blend',Readable.from(['replacement'])),/already exists/);
  await store.receiveFile(batch.id,'Robot/textures/leaf.bin',Readable.from([Buffer.from([1,2,3])]));
  assert.deepEqual(await fs.readFile(await store.resolveFile(result.asset.id,'Robot/textures/leaf.bin')),Buffer.from([1,2,3]));
  await assert.rejects(store.resolveFile(result.asset.id,'../catalog.json'));
  const restored=await new StudioStore(directory).init();assert.equal(restored.project(project.id).name,'Another project');assert.equal(restored.asset(result.asset.id).bytes,original.length);
  assert.ok((await fs.readdir(path.join(directory,'data','history'))).length>0,'catalog history retained');
}));
test('Read-only catalog linking and inbox scans are idempotent and never rewrite source files',async()=>fixture(async directory=>{
  const linked=path.join(directory,'source-library');await fs.mkdir(linked);
  const native=Buffer.from('BLENDER-v300');await fs.writeFile(path.join(linked,'space.blend'),native);
  const receipt=JSON.stringify({assets:[{file:'space.blend',title:'Space source',license:'CC-BY original receipt',creator:'Creator'}]});
  await fs.writeFile(path.join(linked,'catalog.json'),receipt);
  const store=await new StudioStore(directory,{linkedCatalog:path.join(linked,'catalog.json')}).init();
  assert.equal(await store.linkOriginalLibrary(),0);assert.equal(store.state.assets.length,1);
  assert.equal(await fs.readFile(path.join(linked,'catalog.json'),'utf8'),receipt);assert.deepEqual(await fs.readFile(path.join(linked,'space.blend')),native);
  await fs.writeFile(path.join(directory,'library','inbox','new.blend'),native);
  assert.equal((await store.scanInbox()).added,1);assert.equal((await store.scanInbox()).added,0);
  const inbox=store.state.assets.find(a=>a.inbox);inbox.root='obsolete absolute path after moving studio';
  assert.deepEqual(await fs.readFile(await store.resolveFile(inbox.id,'new.blend')),native,'owned inbox rebases to current studio location');
}));
test('Interrupted imports retain partial data without inventing a completed catalog asset',async()=>fixture(async directory=>{
  const store=await new StudioStore(directory).init(),batch=await store.createBatch('shared','Interrupted');
  await assert.rejects(store.receiveFile(batch.id,'large.blend',Readable.from([Buffer.alloc(16)]),{maxBytes:8}),/limit/);
  assert.equal(store.state.assets.length,0);assert.equal(batch.files.length,0);
  assert.ok((await fs.readdir(path.join(directory,'library','imports',batch.id))).some(name=>name.includes('.partial-')));
}));
test('Seeded copy contains five environment routes and eighteen credited asset routes',()=>{
  const assets=seedAssets();assert.equal(assets.filter(a=>a.kind==='environment').length,5);assert.equal(assets.filter(a=>a.kind==='bundled').length,18);
  assert.equal(new Set(assets.map(a=>a.id)).size,23);assert.ok(assets.every(a=>a.license&&a.creator));
});
test('HTTP route handler preserves imported bytes and blocks cross-origin writes/private paths (in-process, no sockets)',async()=>fixture(async directory=>{
  await fs.mkdir(path.join(directory,'site'));await fs.writeFile(path.join(directory,'site','index.html'),'<title>Studio</title>');
  const {server}=await createStudioServer({directory});const handler=server.listeners('request')[0];
  async function request(url,{method='GET',headers={},body=Buffer.alloc(0)}={}){
    const req=Readable.from([Buffer.from(body)]);Object.assign(req,{url,method,headers:{host:'127.0.0.1:4193',...headers},socket:{localPort:4193}});
    const chunks=[];const res=new Writable({write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});
    res.headersSent=false;res.writeHead=(status,values)=>{res.status=status;res.responseHeaders=values;res.headersSent=true;};
    await handler(req,res);return {status:res.status,headers:res.responseHeaders,body:Buffer.concat(chunks),json(){return JSON.parse(this.body.toString());}};
  }
  const post=(url,body)=>request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await request('/')).status,200);assert.equal((await request('/data/catalog.json')).status,404);
  assert.equal((await request('/api/projects',{method:'POST',headers:{origin:'https://other-site.example'},body:'{"name":"Wrong origin"}'})).status,403);
  const project=(await post('/api/projects',{name:'Imported Scene'})).json();
  const batch=(await post('/api/batches',{projectId:project.id,name:'Test'})).json();
  const actual=await fs.readFile(path.join(base,'site','invasion','environments','assets','fantasy','tree-high.glb'));
  const uploaded=await request(`/api/batches/${batch.id}/files?path=Tree.glb`,{method:'POST',headers:{'content-type':'application/octet-stream'},body:actual});assert.equal(uploaded.status,201);
  const {asset}=uploaded.json();assert.equal(asset.kind,'model');assert.ok(!('root' in asset));
  const file=await request(asset.url);assert.equal(file.headers['Content-Type'],'model/gltf-binary');assert.deepEqual(file.body,actual);
  assert.equal((await request('/api/assets?project='+project.id)).json().length,1);
  assert.equal((await request('/api/assets?project=all-local')).json().length,seedAssets().length+1);
  assert.equal((await request('/api/sources')).status,200);
  assert.equal((await post('/api/projects',{name:''})).status,400);
}));
test('Copied lab branding uses project text safely and retains that project on environment links',async()=>{
  const handlers={},brand={replaceChildren(...parts){this.parts=parts;}},title={textContent:'Skyway megacity'},stamp={};
  const project={id:'project-test',name:'New Project <example>'};
  const context=vm.createContext({URL,fetch:async()=>({ok:true,json:async()=>project}),location:{href:'http://127.0.0.1:4193/invasion/environments/?scene=alien',origin:'http://127.0.0.1:4193',pathname:'/invasion/environments/'},document:{
    title:'',querySelector:selector=>selector==='.brand'?brand:stamp,getElementById:()=>title,createElement:()=>({}),createTextNode:text=>({text}),addEventListener:(type,handler)=>{handlers[type]=handler;},
  }});
  const source=await fs.readFile(path.join(base,'site','invasion','environments','studio-brand.mjs'),'utf8');
  vm.runInContext(source.replace('export async function','async function'),context);await vm.runInContext('applyProjectBrand("project-test")',context);
  assert.equal(brand.parts[0].text,project.name);assert.equal(context.document.title,'New Project <example> · Skyway megacity · Asset Studio');
  const anchor={href:'http://127.0.0.1:4193/invasion/environments/?scene=citadel'};handlers.click({target:{closest:()=>anchor}});
  assert.equal(new URL(anchor.href).searchParams.get('project'),project.id);
});
