import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
// Match the repository subpath so local checks catch resource URLs that only work at '/'.
const root=path.resolve('.runtime/github-pages'),mount='/assets-and-environments-lab/';
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.bin':'application/octet-stream'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/'){res.writeHead(302,{Location:mount});return res.end();}
    if(!url.pathname.startsWith(mount))throw Error('Not found');
    const file=path.resolve(root,decodeURIComponent(url.pathname.slice(mount.length))||'index.html');
    const relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Not found');
    const bytes=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(4268,'127.0.0.1',()=>console.log('http://127.0.0.1:4268'+mount));
