import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'showcase'),output=path.join(root,'.runtime/github-pages');
const base=process.env.PAGES_BASE_PATH||'/assets-and-environments-lab/';
// A bootstrap upload must not deploy before its public media migration completes.
try{
  const migration=JSON.parse(await fs.readFile(path.join(root,'provenance/public-media-migration.json'),'utf8'));
  for(const file of migration.files)await fs.access(path.join(root,file.path));
}catch(error){if(error.code!=='ENOENT'||error.path!==path.join(root,'provenance/public-media-migration.json'))throw error;}
if(!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))throw Error('Choose a slash-delimited Pages base path');
await fs.mkdir(output,{recursive:true});
await fs.cp(source,output,{recursive:true});
const names=(await fs.readdir(source)).filter(name=>name!=='api').map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
// Rebase actual resource roots. Leave virtual /api routes and split('/') alone.
const resources=new RegExp('(["\x27`])/(?=(?:'+names.join('|')+')(?:[/?#]|["\x27`]))','g');
let count=0;
async function walk(folder){
  for(const entry of await fs.readdir(folder,{withFileTypes:true})){
    const file=path.join(folder,entry.name);
    if(entry.isDirectory()){await walk(file);continue;}
    if(!/\.(html|mjs|js|css|json|xml)$/.test(entry.name))continue;
    let text=await fs.readFile(file,'utf8');
    text=text.replace(resources,(_,quote)=>quote+base);
    text=text.replace(/(href\s*=\s*["'])\/(["'])/g,(_,prefix,quote)=>prefix+base+quote);
    text=text.replace(/(\.href\s*=\s*["'])\/(["'])/g,(_,prefix,quote)=>prefix+base+quote);
    // Grid builds its Explorer link with a query after the root slash.
    text=text.replace(/(\.href\s*=\s*["'])\/(?=\?)/g,(_,prefix)=>prefix+base);
    text=text.replace(/url\(\/(?!\/)([^)]+)\)/g,(_,value)=>'url('+base+value+')');
    await fs.writeFile(file,text);count++;
  }
}
await walk(output);await fs.writeFile(path.join(output,'.nojekyll'),'');
console.log(JSON.stringify({output,base,textFilesRebased:count}));
