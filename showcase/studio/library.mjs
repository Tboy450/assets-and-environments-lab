const $=id=>document.getElementById(id);
let projects=[],assets=[],reports={sources:[]},busy=false,page=1;
let projectId=new URLSearchParams(location.search).get('project')||'all-local';
import {api} from './api-client.mjs';
const post=(url,body={})=>api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const status=text=>$('status').textContent=text;
const size=n=>n>=1024**3?(n/1024**3).toFixed(2)+' GB':n>=1024**2?(n/1024**2).toFixed(1)+' MB':(n/1024).toFixed(1)+' KB';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
function setBusy(value){busy=value;for(const id of ['choose','choose-folder','scan','rescan','new-project','project'])$(id).disabled=value;}
function renderSources(){
  $('source-list').replaceChildren();
  for(const report of reports.sources)$('source-list').append(node('p',`${report.name} · ${report.files.toLocaleString()} files · ${size(report.bytes)}${report.errors.length?' · '+report.errors.join('; '):''}`));
  $('scan-time').textContent=reports.scannedAt?'Last indexed '+new Date(reports.scannedAt).toLocaleString():'';
}
function render(){
  const project=projects.find(p=>p.id===projectId);if(!project)return;
  $('project-title').textContent=project.name;$('project-description').textContent=project.description;
  document.title=project.name+' · Asset & Environment Studio';$('project-links').replaceChildren();
  for(const [label,url] of [['Play local copy',project.playUrl],['GitHub source',project.repository],['Open pull request',project.pullRequest]])if(url){const a=node('a',label);a.href=url;$('project-links').append(a);}
  const search=$('search').value.toLowerCase(),kind=$('kind').value;
  const matches=assets.filter(a=>(kind==='all'||a.kind===kind)&&[a.name,a.filename,a.relative,a.format,a.creator,a.license,a.collection,projects.find(p=>p.id===a.projectId)?.name].join(' ').toLowerCase().includes(search)).sort((a,b)=>Number(Boolean(b.thumbnailUrl||b.kind==='image'))-Number(Boolean(a.thumbnailUrl||a.kind==='image')));
  const pages=Math.max(1,Math.ceil(matches.length/48));page=Math.min(page,pages);
  $('stats').textContent=`${assets.length.toLocaleString()} catalog entries · ${size(assets.reduce((n,a)=>n+(a.bytes||0),0))} cataloged · ${matches.length.toLocaleString()} matches`;
  $('grid').replaceChildren();
  if(!matches.length)$('grid').append(node('p','No matching assets. Add files or rescan the connected folders.','empty'));
  for(const asset of matches.slice((page-1)*48,page*48)){
    const card=node('article',null,'card');
    if((asset.thumbnailUrl||asset.kind==='image')&&asset.available!==false){const img=node('img');img.src=asset.thumbnailUrl||asset.url;img.alt=asset.name;img.loading='lazy';img.className='thumb';card.append(img);}
    else card.append(node('div',asset.format?.toUpperCase()||asset.kind.toUpperCase(),'format-tile'));
    card.append(node('div',asset.collection||projects.find(p=>p.id===asset.projectId)?.name,'tag'),node('h2',asset.name),node('p',(asset.relative||asset.filename)+(asset.bytes?' · '+size(asset.bytes):''),'file'),node('p',asset.status,'status'));
    const links=node('div',null,'links');const link=(label,url)=>{const a=node('a',label);a.href=url;links.append(a);};
    if(asset.available!==false){
      if(asset.previewUrl){const url=new URL(asset.previewUrl,location.origin);url.searchParams.set('project',asset.projectId);link('Open lab',url);}
      else link(asset.kind==='source'?'Source details':'Preview','/studio/view.html?asset='+encodeURIComponent(asset.id));
      if(asset.url)link(asset.webOptimized?'Web copy':'Original',asset.url+'?download=1');
    }
    card.append(links,node('p',[asset.creator,asset.license].filter(Boolean).join(' · '),'license'));$('grid').append(card);
  }
  $('page-label').textContent=`Page ${page} of ${pages}`;$('previous').disabled=page===1;$('next').disabled=page===pages;
}
async function refresh(){assets=await api('/api/assets?project='+encodeURIComponent(projectId));page=1;render();}
function projectOptions(){
  $('project').replaceChildren(...projects.map(p=>{const el=node('option',p.name);el.value=p.id;return el;}));
  if(!projects.some(p=>p.id===projectId))projectId='shared';$('project').value=projectId;
}
$('project').onchange=async()=>{projectId=$('project').value;history.replaceState(null,'','?project='+encodeURIComponent(projectId));try{await refresh();status('');}catch(error){status(error.message);}};
$('new-project').onclick=async()=>{const name=prompt('Project name:');if(!name?.trim())return;try{const p=await post('/api/projects',{name});projects.push(p);projectId=p.id;projectOptions();history.replaceState(null,'','?project='+encodeURIComponent(projectId));await refresh();status('Project created.');}catch(error){status(error.message);}};
$('choose').onclick=()=>$('files').click();$('choose-folder').onclick=()=>$('folder').click();
const accepted=/\.(blend\d*|glb|gltf|obj|fbx|stl|ply|usd[acz]?|abc|hip(?:lc|nc)?|hda(?:lc|nc)?|bgeo|sc|vdb|zip|7z|rar|png|jpe?g|webp|gif|svg|exr|hdr|wav|mp3|ogg|flac|mp4|webm|ttf|otf|bin|mtl|txt|md|json|license|tga|bmp|tiff?)$/i;
async function importFiles(files){
  if(busy)return;files=[...files].filter(f=>accepted.test(f.name));if(!files.length){status('No supported files selected.');return;}
  setBusy(true);let completed=0;
  try{const batch=await post('/api/batches',{projectId:projectId==='all-local'?'shared':projectId,name:files[0].webkitRelativePath?.split('/')[0]||files[0].name,creator:$('creator').value,license:$('license').value,source:$('source').value});
    for(const file of files){status(`Importing ${completed+1}/${files.length}: ${file.name}`);await api(`/api/batches/${batch.id}/files?path=${encodeURIComponent(file.webkitRelativePath||file.name)}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});completed++;}
    status(`Retained ${completed} files. Include model textures and sidecars together.`);
  }catch(error){status(`Imported ${completed} files. ${error.message}. Completed originals and partial recovery files are retained.`);}
  finally{setBusy(false);$('files').value='';$('folder').value='';await refresh();}
}
for(const input of ['files','folder'])$(input).onchange=()=>importFiles($(input).files);
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('over');});
$('dropzone').ondragleave=()=>$('dropzone').classList.remove('over');
$('dropzone').ondrop=e=>{e.preventDefault();$('dropzone').classList.remove('over');importFiles(e.dataTransfer.files);};
$('scan').onclick=async()=>{setBusy(true);try{const result=await post('/api/inbox/scan',{projectId:projectId==='all-local'?'shared':projectId});await refresh();status(`Registered ${result.added} new inbox assets.`);}catch(error){status(error.message);}finally{setBusy(false);}};
$('rescan').onclick=async()=>{setBusy(true);status('Indexing connected asset folders…');try{reports=await post('/api/sources/scan');renderSources();projects=await api('/api/projects');projectOptions();await refresh();const errors=reports.sources.filter(r=>r.errors.length);status(errors.length?`${errors.length} folders need attention; see Connected folders.`:'Connected folders indexed. Independent snapshot folders indexed.');}catch(error){status(error.message);}finally{setBusy(false);}};
$('export').onclick=()=>{const project=projects.find(p=>p.id===projectId),url=URL.createObjectURL(new Blob([JSON.stringify({project,assets},null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download=project.name.replace(/[^a-z0-9_-]/gi,'_')+'-assets.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
for(const id of ['search','kind'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=1;render();});
$('previous').onclick=()=>{page--;render();$('stats').scrollIntoView({block:'start'});};$('next').onclick=()=>{page++;render();$('stats').scrollIntoView({block:'start'});};
try{[projects,reports]=await Promise.all([api('/api/projects'),api('/api/sources')]);projectOptions();renderSources();const info=await api('/api/info');$('location').textContent='Import inbox: '+info.inbox;await refresh();status('Public asset showcase · originals retained in the local library.');}catch(error){status('Studio could not load: '+error.message);}
