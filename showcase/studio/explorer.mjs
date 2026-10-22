import {browseRows,category} from './browse-data.mjs';
import {thumbnailQueue} from './thumbnails.mjs';
import {api} from './api-client.mjs';
import {collectionAssets} from './collections.mjs';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const query=new URLSearchParams(location.search);let projectId=query.get('project')||'all-local',mode=query.get('tab')||'worlds',projects=[],assets=[],rows=[],selected=null,onlyFavorites=false,visibleLimit=100;
let saved=new Set();try{saved=new Set(JSON.parse(localStorage.getItem('asset-explorer-favorites')||'[]'));}catch{}
const post=(url,data={})=>api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const status=text=>$('status').textContent=text;
const projectAssets=()=>collectionAssets(assets,projectId);
const projectName=id=>projects.find(p=>p.id===id)?.name||'Local collection';
const labels={worlds:'Worlds',models:'Models',art:'Art & sound',sources:'Source files'};
const symbol=a=>category(a)==='worlds'?'◈':category(a)==='models'?'⬡':a.kind==='audio'?'♫':a.kind==='video'?'▷':a.format==='zip'?'▤':'◇';
const title=a=>a.name.length>78?a.name.split(':')[0]:a.name;
function updateURL(){const q=new URLSearchParams({project:projectId,tab:mode});if(selected)q.set('asset',selected.id);history.replaceState(null,'','?'+q);$('grid-layout').href='/library.html?project='+encodeURIComponent(projectId);}
function categories(){
  $('categories').replaceChildren();const available=projectAssets();
  for(const [key,name] of Object.entries(labels)){
    const count=browseRows(available,{mode:key}).length,b=el('button',null,'category'+(mode===key?' active':''));b.append(el('strong',name),el('span',count));b.disabled=!count;b.setAttribute('aria-pressed',String(mode===key));
    b.onclick=()=>{mode=key;visibleLimit=100;render();select(rows[0]);updateURL();};$('categories').append(b);
  }
}
function render(){
  const relevant=projectAssets();$('project-title').textContent=projectId==='all-local'?'Your asset universe':projectName(projectId);document.title=projectName(projectId)+' · Asset Explorer';
  categories();rows=browseRows(relevant,{mode,search:$('search').value,showExtras:$('show-extras').checked,favorites:onlyFavorites?saved:null});
  $('count').textContent=`${rows.length.toLocaleString()} ${labels[mode]?.toLowerCase()||'assets'}${onlyFavorites?' · favorites':''}`;
  const scroll=$('asset-list').scrollTop;$('asset-list').replaceChildren();
  if(!rows.length)$('asset-list').append(el('p',onlyFavorites?'Star a few assets to build your collection.':'Nothing here yet. Try another category or search.','empty-list'));
  for(const asset of rows.slice(0,visibleLimit)){
    const row=el('div',null,'asset-row'+(selected?.id===asset.id?' selected':''));row.setAttribute('role','listitem');row.dataset.asset=asset.id;
    const button=el('button',null,'asset-select');button.setAttribute('aria-label','Preview '+title(asset));button.setAttribute('aria-pressed',String(selected?.id===asset.id));
    const icon=el('span',null,'asset-icon '+(category(asset)==='worlds'?'world':''));const image=asset.thumbnailUrl||(asset.kind==='image'?asset.url:null);
    if(image){const img=el('img');img.src=image;img.alt='';img.loading='lazy';icon.append(img);}else icon.textContent=symbol(asset);
    const text=el('span',null,'asset-text');text.append(el('strong',title(asset)),el('small',asset.frames?.length?asset.frames.length+' animation frames':asset.kind==='sample'?'Original starter sample':projectId==='all-local'?projectName(asset.projectId):asset.collection||asset.format||'Interactive preview'));
    button.append(icon,text);button.onclick=()=>select(asset);row.append(button);
    const star=el('button',saved.has(asset.id)?'★':'☆','star'+(saved.has(asset.id)?' saved':''));star.setAttribute('aria-label',(saved.has(asset.id)?'Unfavorite ':'Favorite ')+title(asset));star.onclick=()=>{if(saved.has(asset.id))saved.delete(asset.id);else saved.add(asset.id);try{localStorage.setItem('asset-explorer-favorites',JSON.stringify([...saved]));}catch{}render();};row.append(star);$('asset-list').append(row);
  }
  if(rows.length>visibleLimit){const more=el('button','Show more');more.onclick=()=>{visibleLimit+=100;render();};$('asset-list').append(more);}
  $('asset-list').scrollTop=scroll;
}
function select(asset){
  if(!asset)return;selected=asset;render();updateURL();
  $('stage-empty').hidden=true;$('preview').hidden=false;$('asset-title').textContent=title(asset);$('stage-project').textContent=projectName(asset.projectId);$('stage-type').textContent=asset.frames?.length?'ANIMATION':asset.kind==='sample'?'ORIGINAL STARTER SAMPLE':labels[category(asset)];
  $('stage-hint').textContent=asset.worldType==='map'?'Tap a region to inspect · Whole map to return':asset.kind==='terrain'?'Drag to orbit · scroll to zoom':category(asset)==='worlds'?'Drag to look around · scroll to move closer':category(asset)==='models'?'Drag to orbit · scroll to zoom':'Browse with the arrows. Details and original files are one click away.';
  const url=new URL(asset.frames?.length?'/studio/sequence.html':asset.previewUrl||'/studio/view.html',location.origin);
  if(!asset.previewUrl||asset.frames?.length)url.searchParams.set('asset',asset.id);
  if(asset.previewUrl&&!asset.previewUrl.startsWith('/studio/'))url.searchParams.set('project',asset.projectId);
  $('full-view').href=url.href;$('full-view').hidden=false;url.searchParams.set('embed','1');url.searchParams.set('thumbAsset',asset.id);$('preview').src=url.href;
  $('preview-actions').replaceChildren();
  const actions=asset.worldType==='map'?[]:category(asset)==='worlds'&&asset.kind!=='terrain'?[['vista','Vista'],['street','Street'],['tour','Flyover']]:(category(asset)==='models'||asset.kind==='terrain')?[['fit','Fit'],['rotate','Turntable']]:[];
  for(const [action,label] of actions){const b=el('button',label);b.onclick=()=>$('preview').contentWindow.postMessage({type:'studio-action',action},location.origin);$('preview-actions').append(b);}
  $('previous').disabled=rows.length<2;$('next').disabled=rows.length<2;
}
function step(direction){const index=rows.findIndex(a=>a.id===selected?.id);select(rows[(index+direction+rows.length)%rows.length]);$('asset-list').querySelector('.selected')?.scrollIntoView({block:'nearest'});}
$('previous').onclick=()=>step(-1);$('next').onclick=()=>step(1);
$('search').oninput=()=>{visibleLimit=100;render();};$('show-extras').onchange=render;
$('favorites').onclick=()=>{onlyFavorites=!onlyFavorites;$('favorites').setAttribute('aria-pressed',String(onlyFavorites));render();};
$('project').onchange=()=>{projectId=$('project').value;$('search').value='';onlyFavorites=false;$('favorites').setAttribute('aria-pressed','false');const available=projectAssets();mode=Object.keys(labels).find(key=>available.some(a=>category(a)===key))||'sources';visibleLimit=100;render();select(rows[0]);updateURL();};
addEventListener('keydown',event=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)||document.querySelector('dialog[open]'))return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();step(event.key==='ArrowRight'?1:-1);}});
function thumbnailReady(asset){const existing=assets.find(a=>a.id===asset.id);if(existing)existing.thumbnailUrl=asset.thumbnailUrl;const row=$('asset-list').querySelector(`[data-asset="${asset.id}"] .asset-icon`);if(row){const img=el('img');img.src=asset.thumbnailUrl;img.alt='';row.replaceChildren(img);}}
addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==$('preview').contentWindow)return;if(event.data?.type==='studio-thumbnail')thumbnailReady({id:event.data.id,thumbnailUrl:event.data.url});});
async function reload(){[projects,assets]=await Promise.all([api('/api/projects'),api('/api/assets')]);const order=['all-local','swarmfall','dragonfly','starter-samples','rocket-run','dragons-lair','blender','houdini','shared','beginner-python'];projects.sort((a,b)=>(order.indexOf(a.id)<0?99:order.indexOf(a.id))-(order.indexOf(b.id)<0?99:order.indexOf(b.id)));$('project').replaceChildren(...projects.map(p=>{const option=el('option',p.name);option.value=p.id;return option;}));if(!projects.some(p=>p.id===projectId))projectId='all-local';$('project').value=projectId;render();}
async function pickerInfo(){try{const info=await api('/api/picker/info?project='+encodeURIComponent(projectId));$('picker-folder').textContent='Windows picker starts in: '+info.folder;}catch(error){$('picker-folder').textContent='Browser file selection is available.';}}
$('manage-open').onclick=()=>{$('manage').showModal();pickerInfo();};
$('details-open').onclick=()=>{if(!selected)return;$('details-content').replaceChildren();for(const [label,value] of [['Name',selected.name],['File',selected.relative||selected.filename],['Collection',projectName(selected.projectId)],['Creator',selected.creator],['License',selected.license],['Notes',selected.notes],['Status',selected.status]])if(value){$('details-content').append(el('h3',label),el('p',value));}if(selected.url){const a=el('a',selected.webOptimized?'Download web copy':'Download original');a.href=selected.url+'?download=1';$('details-content').append(a);}if(selected.source?.startsWith('https://')){const a=el('a','Source & credits');a.href=selected.source;a.target='_blank';a.rel='noopener';$('details-content').append(el('p'),a);}$('details').showModal();};
function busy(value){for(const id of ['choose','choose-folder','browser-picker','new-project','rescan','scan'])$(id).disabled=value;}
const notes=()=>({creator:$('creator').value,license:$('license').value,source:$('source').value});
$('choose').onclick=async()=>{busy(true);status('Choose files in the Windows dialog…');try{const r=await post('/api/picker/import',{projectId,...notes()});status(r.cancelled?'No files selected.':`${r.imported} files added.${r.errors?.length?' '+r.errors.join('; '):''}`);await reload();pickerInfo();}catch(error){status(error.message+' · Use Browser picker if needed.');}finally{busy(false);}};
$('browser-picker').onclick=()=>$('files').click();$('choose-folder').onclick=()=>$('folder').click();
async function importFiles(files){if(!files.length)return;busy(true);let count=0;try{const batch=await post('/api/batches',{projectId:projectId==='all-local'?'shared':projectId,name:files[0].webkitRelativePath?.split('/')[0]||files[0].name,...notes()});for(const file of files){status(`Adding ${count+1}/${files.length}: ${file.name}`);await api(`/api/batches/${batch.id}/files?path=${encodeURIComponent(file.webkitRelativePath||file.name)}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});count++;}status(`${count} files added.`);}catch(error){status(`${count} files added. ${error.message}. Completed imports are retained.`);}finally{busy(false);await reload();}}
for(const id of ['files','folder'])$(id).onchange=()=>importFiles([...$(id).files]);
$('new-project').onclick=async()=>{const name=prompt('Collection name:');if(!name?.trim())return;try{const p=await post('/api/projects',{name});projectId=p.id;mode='sources';await reload();pickerInfo();status('Collection created.');}catch(error){status(error.message);}};
$('rescan').onclick=async()=>{busy(true);status('Refreshing your library…');try{const r=await post('/api/sources/scan');await reload();$('source-list').replaceChildren(...r.sources.map(s=>el('p',s.name+' · '+s.files+' assets'+(s.errors.length?' · '+s.errors.join('; '):''))));status('Library refreshed.');}catch(error){status(error.message);}finally{busy(false);}};
$('scan').onclick=async()=>{try{const r=await post('/api/inbox/scan',{projectId:projectId==='all-local'?'shared':projectId});await reload();status(r.added+' files found in the inbox.');}catch(error){status(error.message);}};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({project:projectName(projectId),assets:projectAssets()},null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='asset-collection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
try{await reload();if(!rows.length){mode=Object.keys(labels).find(key=>projectAssets().some(a=>category(a)===key))||'sources';render();}select(rows.find(a=>a.id===query.get('asset'))||rows[0]);const modelAssets=assets.filter(a=>category(a)==='models'||a.kind==='terrain').sort((a,b)=>Number(b.kind==='dragonfly')-Number(a.kind==='dragonfly')||Number(b.kind==='sample')-Number(a.kind==='sample'));if(!globalThis.ASSET_PUBLIC)thumbnailQueue(modelAssets,thumbnailReady).catch(error=>console.warn(error.message));}catch(error){$('count').textContent=error.message;}
