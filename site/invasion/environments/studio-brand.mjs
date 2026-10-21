// Independent copy only. The published Swarmfall project never imports this module.
export async function applyProjectBrand(projectId){
  let project={id:'shared',name:'Asset Studio'};
  try{const response=await fetch('/api/projects/'+encodeURIComponent(projectId));if(response.ok)project=await response.json();}catch{}
  const brand=document.querySelector('.brand'),subtitle=document.createElement('span');subtitle.textContent='ASSET & ENVIRONMENT LAB · LOCAL COPY';
  brand.replaceChildren(document.createTextNode(project.name),subtitle);brand.href='/?project='+encodeURIComponent(project.id);
  document.title=project.name+' · '+document.getElementById('title').textContent+' · Asset Studio';
  const stamp=document.querySelector('[data-build-stamp]');stamp.textContent='Independent local copy';
  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('a');if(!anchor)return;
    const url=new URL(anchor.href,location.href);if(url.origin===location.origin&&url.pathname===location.pathname){url.searchParams.set('project',project.id);anchor.href=url.href;}
  },true);
  return project;
}
