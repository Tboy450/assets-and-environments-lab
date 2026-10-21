const $=id=>document.getElementById(id);let projects=[],assets=[],busy=false;
const query=new URLSearchParams(location.search);let projectId=query.get('project')||'swarmfall';
async function api(url,options){const response=await fetch(url,options),data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data;}
const post=(url,body)=>api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const status=text=>$('status').textContent=text;
function setBusy(value){busy=value;for(const id of ['choose','choose-folder','scan','new-project','project'])$(id).disabled=value;}
function render(){
  const project=projects.find(p=>p.id===projectId);$('project-title').textContent=project.name;$('project-description').textContent=project.description;document.title=project.name+' · Asset & Environment Studio';
  const search=$('search').value.toLowerCase(),kind=$('kind').value;$('grid').replaceChildren();
  const matches=assets.filter(a=>(kind==='all'||a.kind===kind)&&[a.name,a.filename,a.format,a.creator,a.license].join(' ').toLowerCase().includes(search));
  if(!matches.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No matching assets yet. Add files or scan the local inbox for this project.';$('grid').append(empty);}
  for(const asset of matches){
    const card=document.createElement('article');card.className='card';
    const text=(tag,value,className)=>{const element=document.createElement(tag);element.textContent=value;element.className=className||'';card.append(element);return element;};
    text('div',asset.kind==='source'?asset.format+' source':asset.kind,'tag');text('h2',asset.name);text('p',asset.filename+(asset.bytes?' · '+(asset.bytes/1024/1024).toFixed(1)+' MB':''),'file');text('p',asset.status,'status');
    const links=document.createElement('div');links.className='links';
    const link=(label,url)=>{const a=document.createElement('a');a.textContent=label;a.href=url;links.append(a);};
    if(asset.previewUrl){const url=new URL(asset.previewUrl,location.origin);url.searchParams.set('project',projectId);link('Open lab',url);}
    else link(asset.kind==='source'?'View source details':'Preview','/studio/view.html?asset='+encodeURIComponent(asset.id));
    if(asset.url)link('Download original',asset.url+'?download=1');card.append(links);
    text('p',[asset.creator,asset.license].filter(Boolean).join(' · '),'license');$('grid').append(card);
  }
}
async function refresh(){assets=await api('/api/assets?project='+encodeURIComponent(projectId));render();}
function projectOptions(){
  $('project').replaceChildren(...projects.map(project=>{const option=document.createElement('option');option.value=project.id;option.textContent=project.name;return option;}));
  if(!projects.some(p=>p.id===projectId))projectId='shared';$('project').value=projectId;
}
$('project').addEventListener('change',async()=>{projectId=$('project').value;history.replaceState(null,'','?project='+encodeURIComponent(projectId));try{await refresh();status('');}catch(error){status(error.message);}});
$('new-project').addEventListener('click',async()=>{
  const name=prompt('Project name (for example, the project folder or file name):');if(!name?.trim())return;
  try{const project=await post('/api/projects',{name});projects.push(project);projectId=project.id;projectOptions();history.replaceState(null,'','?project='+encodeURIComponent(projectId));await refresh();status('Project created. Its name becomes the preview branding.');}catch(error){status(error.message);}
});
$('choose').onclick=()=>$('files').click();$('choose-folder').onclick=()=>$('folder').click();
const accepted=/\.(blend\d*|glb|gltf|obj|fbx|stl|ply|usd|usdz|abc|hip|hipnc|zip|7z|png|jpe?g|webp|exr|hdr|wav|mp3|ogg|bin|mtl|txt|md|json|license|tga|bmp|tiff?)$/i;
async function importFiles(files){
  if(busy)return;files=[...files].filter(file=>accepted.test(file.name));if(!files.length){status('No supported asset/source files were selected.');return;}
  setBusy(true);let completed=0;
  try{
    const batch=await post('/api/batches',{projectId,name:files[0].webkitRelativePath?.split('/')[0]||files[0].name,creator:$('creator').value,license:$('license').value,source:$('source').value});
    for(const file of files){status(`Importing ${completed+1}/${files.length}: ${file.name}`);
      await api(`/api/batches/${batch.id}/files?path=${encodeURIComponent(file.webkitRelativePath||file.name)}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});completed++;
    }
    status(`Retained ${completed} file(s). GLB/glTF previews require the complete texture/dependency folder.`);
  }catch(error){status(`Imported ${completed} file(s). ${error.message}. Completed originals are retained; interrupted .partial files remain in the batch.`);}
  finally{setBusy(false);$('files').value='';$('folder').value='';await refresh();}
}
for(const input of ['files','folder'])$(input).addEventListener('change',()=>importFiles($(input).files));
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('over');});
$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('over'));
$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('over');importFiles(e.dataTransfer.files);});
$('scan').addEventListener('click',async()=>{setBusy(true);try{const result=await post('/api/inbox/scan',{projectId});await refresh();status(`Registered ${result.added} new inbox asset(s) in this project. Sources stay in the inbox.`);}catch(error){status(error.message);}finally{setBusy(false);}});
$('export').addEventListener('click',()=>{const project=projects.find(p=>p.id===projectId),url=URL.createObjectURL(new Blob([JSON.stringify({project,assets},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=project.name.replace(/[^a-z0-9_-]/gi,'_')+'-assets.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('search').addEventListener('input',render);$('kind').addEventListener('change',render);
try{[projects]=await Promise.all([api('/api/projects')]);projectOptions();const info=await api('/api/info');$('location').textContent='Local inbox: '+info.inbox+' · No publishing or source-project writes.';await refresh();status('Independent local copy. Existing Swarmfall links remain unchanged.');}catch(error){status('Studio could not load: '+error.message);}
