export function category(asset){return (asset.kind==='environment'||asset.kind==='terrain')?'worlds':['model','bundled','dragonfly','sample'].includes(asset.kind)?'models':['image','audio','video'].includes(asset.kind)?'art':'sources';}
export function browseRows(assets,{mode='worlds',search='',showExtras=false,favorites=null}={}){
  const query=search.trim().toLowerCase(),rows=[],sequences=new Map();
  for(const asset of assets){
    if(!showExtras&&/tools\/blender-portable\//.test(asset.relative||''))continue;
    if(mode!=='all'&&category(asset)!==mode)continue;
    if(favorites&&!favorites.has(asset.id))continue;
    if(query&&![asset.name,asset.filename,asset.relative,asset.collection,asset.projectId].join(' ').toLowerCase().includes(query))continue;
    const sequence=(asset.relative||'').match(/^(.*\/)frame[_-]?\d+\.(png|webp|jpg)$/i);
    if(sequence&&!showExtras){const key=asset.projectId+'/'+(asset.sourceId||asset.batchId||'')+'/'+sequence[1];let row=sequences.get(key);if(!row){row={...asset,name:sequence[1].split('/').filter(Boolean).at(-1).replaceAll('_',' '),frames:[]};sequences.set(key,row);rows.push(row);}row.frames.push(asset.id);continue;}
    rows.push(asset);
  }
  const pictured=a=>Boolean(a.thumbnailUrl||a.kind==='image');
  return rows.sort((a,b)=>Number(a.available===false)-Number(b.available===false)||Number(pictured(b))-Number(pictured(a))||Number(b.dragonflyPart==='all')-Number(a.dragonflyPart==='all')||a.name.localeCompare(b.name,undefined,{numeric:true}));
}
