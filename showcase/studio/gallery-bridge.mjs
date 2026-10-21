const link=document.getElementById('explorer-layout'),select=document.getElementById('project');
const sync=()=>{link.href='/?project='+encodeURIComponent(select.value||new URLSearchParams(location.search).get('project')||'all-local');};
select.addEventListener('change',sync);sync();
