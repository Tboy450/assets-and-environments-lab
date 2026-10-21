import './embed.mjs';
const query=new URLSearchParams(location.search),version=query.get('version')==='legacy'?'legacy':'current';
if(query.has('embed'))document.body.classList.add('embedded');
const data=(await(await fetch('/studio/terrain-sources/rpg-maps.json')).json())[version];
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');let selected=null;
const rgb=c=>'rgb('+c.join(',')+')';
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function region(type,x,y,size){
  ctx.save();ctx.translate(x,y);ctx.scale(size/900,size/900);
  ctx.fillStyle=rgb(data.palette[type]||[35,55,35]);ctx.fillRect(0,0,900,900);
  ctx.strokeStyle='#ffffff12';ctx.lineWidth=1;for(let i=0;i<900;i+=50){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,900);ctx.moveTo(0,i);ctx.lineTo(900,i);ctx.stroke();}
  // Browser adaptation of the archived area's static drawing primitives.
  if(type==='forest')for(const [a,b] of [[150,200],[350,180],[550,220],[750,190],[450,300],[200,400],[600,380],[300,500],[700,480],[400,600]]){circle(a,b,30,'#326432');circle(a+2,b+2,30,'#285a28');ctx.fillStyle='#50321e';ctx.fillRect(a-5,b+20,10,20);}
  if(type==='desert')for(const [a,b] of [[200,150],[600,200],[400,400]]){ctx.fillStyle='#786e50';ctx.beginPath();ctx.ellipse(a+40,b+20,40,20,0,0,Math.PI*2);ctx.fill();}
  if(type==='mountain'){ctx.fillStyle='#505064';ctx.beginPath();ctx.moveTo(0,900);for(const [a,b] of [[200,800],[400,750],[600,780],[800,770],[900,900]])ctx.lineTo(a,b);ctx.fill();}
  if(['swamp','volcano','ice'].includes(type))for(let i=0;i<8;i++)circle(95+(i*173)%720,125+(i*227)%610,type==='ice'?15:25,{swamp:'#1e323c',volcano:'#ff6400',ice:'#c8dcff'}[type]);
  if(type==='cave')for(let i=0;i<5;i++){const a=100+i*160;ctx.fillStyle='#3c3c50';ctx.beginPath();ctx.moveTo(a,60);ctx.lineTo(a-12,100);ctx.lineTo(a+12,100);ctx.fill();}
  if(type==='beach')for(let i=0;i<3;i++){const a=150+i*300;ctx.fillStyle='#785028';ctx.fillRect(a-5,170,10,40);circle(a,150,25,'#329632');}
  ctx.fillStyle='#061017b0';ctx.fillRect(0,730,900,170);ctx.fillStyle='#e5f3e9';ctx.font='600 54px system-ui';ctx.fillText(type.toUpperCase(),35,830);ctx.strokeStyle='#97bbab';ctx.lineWidth=5;ctx.strokeRect(1,1,898,898);ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,900,900);
  if(selected!==null)region(data.layout[selected],0,0,900);
  else data.layout.forEach((type,i)=>region(type,(i%3)*300,Math.floor(i/3)*300,300));
  document.querySelector('#label').textContent=(version==='legacy'?'Original beach overworld':'Plains overworld snapshot')+(selected===null?'':' · '+data.layout[selected]);
}
canvas.addEventListener('click',event=>{const r=canvas.getBoundingClientRect();if(selected!==null)selected=null;else selected=Math.min(8,Math.floor((event.clientY-r.top)/r.height*3)*3+Math.floor((event.clientX-r.left)/r.width*3));draw();});
document.querySelector('#whole').onclick=()=>{selected=null;draw();};draw();
for(let i=0;i<16;i++)globalThis.assetStudioCapture?.(canvas);
