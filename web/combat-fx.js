const schoolSprites=new Map(['shatter','lance','siphon','chain','ward','rupture','surge','vortex'].map((name,i)=>[name,i]));
let atlas;
import {schools} from './card-skills.js';

// Coordinates are in CSS pixels so impacts stay on the selected card at every viewport size.
export function combatEffects(field){
 if(!atlas){atlas=new Image();atlas.src='/assets/battle/school-fx.webp';atlas.decode?.().catch(()=>{})}
 const canvas=document.createElement('canvas');canvas.className='combat-fx';canvas.setAttribute('aria-hidden','true');field.append(canvas);
 const ctx=canvas.getContext('2d');let traces=[],frame=0,width=0,height=0;
 function resize(){
  const rect=field.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  if(width===rect.width&&height===rect.height)return;width=rect.width;height=rect.height;
  canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 }
 function line(pts,color,w=2){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke()}
 function ring(x,y,r,color,w=2){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke()}
 function blade(x,y,r,a,color){const pts=Array.from({length:25},(_,i)=>{const n=i*Math.PI/12+a,k=i%2?r*.73:r;return [x+Math.cos(n)*k,y+Math.sin(n)*k]});line(pts,color,3);ring(x,y,r*.38,'#fff')}
 function paint(t,now){
  const q=(now-t.start)/t.ms;if(q<0||q>1)return;
  const {a,b,type,color}=t,dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len;
  const phase=Math.min(1,q/.62),f=phase*phase*(3-2*phase),x=a.x+dx*f,y=a.y+dy*f;
  const strength=t.big?1.4:1;
  ctx.globalAlpha=Math.min(1,q*10,(1-q)*6);ctx.lineJoin='bevel';ctx.lineCap='round';ctx.shadowColor=color;ctx.shadowBlur=6;
  if(type==='chain'){
   for(let j=0;j<2;j++){const pts=[];for(let i=0;i<=10;i++){const z=f*i/10,offset=i&&i<10?Math.sin(i*2.6+Math.floor(q*16)+j*2+t.seed%7)*12:0;pts.push([a.x+dx*z+nx*offset,a.y+dy*z+ny*offset])}line(pts,j?'#fff':color,j?1:4)}
  }else if(type==='shatter'){blade(x,y,13*strength,q*13,color);blade(x-dx/len*19,y-dy/len*19,7,-q*15,'#ffcc9a')}
  else if(type==='lance'||type==='rupture'){
   const n=type==='lance'?3:5;for(let i=0;i<n;i++){const z=Math.max(0,f-i*.075),h=type==='lance'?(i-1)*6:Math.sin(i*2+q*4)*13,px=a.x+dx*z+nx*h,py=a.y+dy*z+ny*h;
    const bx=px-dx/len*18,by=py-dy/len*18;line([[bx+nx*4,by+ny*4],[px,py],[bx-nx*4,by-ny*4]],i?color:'#fff',3)}
  }else if(type==='surge'){const pts=[];for(let i=0;i<14;i++){const z=Math.max(0,f-i*.022),w=i%2?9:-9;pts.push([a.x+dx*z+nx*w,a.y+dy*z+ny*w])}line(pts,color,5);line(pts,'#fff',1.25)}
  else if(type==='siphon'){for(let j=0;j<2;j++){const pts=[];for(let i=0;i<24;i++){const z=f*i/23,h=Math.sin(i*.55+q*16+j*Math.PI)*7;pts.push([a.x+dx*z+nx*h,a.y+dy*z+ny*h])}line(pts,j?color:'#ffc6e3',2)}}
  else if(type==='ward'){for(let k=0;k<3;k++){const r=13+k*6;line(Array.from({length:7},(_,i)=>[x+Math.cos(i*Math.PI/3+q*2)*r,y+Math.sin(i*Math.PI/3+q*2)*r]),k?color:'#fff',1.6)}}
  else{for(let k=0;k<2;k++){const pts=[];for(let i=0;i<25;i++){const r=i*.85,angle=i*.25+q*13+Math.PI*k;pts.push([x+Math.cos(angle)*r,y+Math.sin(angle)*r])}line(pts,color,2.5)}}
  if(atlas.complete&&atlas.naturalWidth){
   const index=schoolSprites.get(type)??0,cell=atlas.naturalWidth/4,size=(t.big?100:72)*(1+.12*Math.sin(q*Math.PI));
   ctx.save();ctx.shadowBlur=0;ctx.translate(x,y);ctx.rotate(type==='shatter'||type==='vortex'?q*4:Math.atan2(dy,dx)+Math.PI/4);
   ctx.drawImage(atlas,index%4*cell,Math.floor(index/4)*cell,cell,cell,-size/2,-size/2,size,size);ctx.restore();
  }
  if(q>.52){const burst=(q-.52)/.48;ring(b.x,b.y,4+burst*32*strength,color,Math.max(.6,3*(1-burst)));for(let i=0;i<(t.big?14:8);i++){const ang=i*2.4+t.seed*.03,r=8+burst*(24+(i%3)*7)*strength;line([[b.x+Math.cos(ang)*r,b.y+Math.sin(ang)*r],[b.x+Math.cos(ang)*(r+5),b.y+Math.sin(ang)*(r+5)]],i%2?color:'#fff',2)}}
  ctx.globalAlpha=1;ctx.shadowBlur=0;
 }
 function loop(now){ctx.clearRect(0,0,width,height);traces=traces.filter(t=>now<t.start+t.ms);for(const t of traces)paint(t,now);frame=traces.length?requestAnimationFrame(loop):0}
 function launch(a,b,event,ms){if(!ctx)return;resize();const type=event.school||'ward';traces.push({a,b,type,color:schools[type]?.color||'#a5ffdb',big:event.signature,start:performance.now(),ms,seed:(event.seed||0)%41});if(!frame)frame=requestAnimationFrame(loop)}
 return {launch,stop(){cancelAnimationFrame(frame);traces=[];canvas.remove()}};
}
