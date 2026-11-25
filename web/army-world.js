import {createGeometry,orientation,rendererFor,viewMatrix,rgba} from './scene-gl.js';
import {moveArts} from './combat-arts.js';
import {paintArmyCast} from './combat-scene.js';

const cube='/assets/player-cube.png';
const tau=Math.PI*2;
const team=['#77f9ed','#ff9b78'];
const levels=['#b3dddb','#8ddfff','#a8ee9e','#f8d472','#ff966b','#ff89c6','#b6a0ff','#fca0dc','#ff826b','#ff6ca9','#ffc05e'];
const limit=(n,a=0,b=1)=>Math.max(a,Math.min(n,b));
const mix=(a,b,q)=>a+(b-a)*q;
const bright={light:1};

function arenaGeometry(g,key,map){
 g.reset();
 const harbor=key==='harbor',d=map.depth+43;
 const hull=harbor?'#101d46':'#291927',floor=harbor?'#263657':'#3d2930';
 const edging=harbor?'#465d9e':'#8a4844',trace=harbor?'#226e97':'#9a452e',accent=harbor?'#59d7ed':'#ff9f61';
 g.box(0,0,-46,1152,2*d+22,44,hull);
 g.box(0,0,-22,1170,2*d+25,8,edging);
 g.box(0,0,-11,1176,2*d+28,13,hull);
 g.box(0,0,-3.5,1150,2*d,5,floor);
 for(let col=-5;col<=5;col++){
  const x=col*103;
  for(let row=-2;row<=2;row++){
   const y=row*d*.38;
   if(!col&&row===0)continue;
   const tile=harbor?(row+col)%3?'#242f4e':'#2f4161':(row+col)%3?'#322832':'#48404c';
   g.box(x,y,-.84,100,d*.38-2,1.1,tile);
  }
  for(const sign of [-1,1]){
   g.box(x,sign*d,-8,91,21,13,edging);
   g.box(x,sign*d,-.5,76,4,1.6,accent,{light:.77});
   g.box(x,sign*(d+13),-28,60,4,3.4,trace,bright);
  }
 }
 for(const side of [-1,1]){
  const color=team[(side+1)/2];
  for(const y of [-d*.62,d*.62]){
   g.beam([side*30,y,-.1],[side*555,y,-.1],2.8,trace,{light:.88});
   g.beam([side*330,y,-.05],[side*552,y,-.05],3.2,color,{light:.82});
  }
  for(let i=0;i<4;i++){
   const x=side*(328+i*46),r=12+i*2;
   g.surface([[x-r,-22,.1],[x,0,.1],[x-r,22,.1],[x+r*.2,22,.1],[x+r,0,.1],[x+r*.2,-22,.1]],edging);
   g.box(x,-d+19,-.35,22,8,1,trace);
  }
 }
 g.ring(0,0,.1,66,63,.6,edging,{segments:12,yaw:Math.PI/12});
 g.ring(0,0,.38,45,43,.6,accent,{segments:8,yaw:Math.PI/8,light:.9});
 g.box(0,0,1,21,21,1,accent,{yaw:Math.PI/4,light:.8});
 if(harbor){
  for(const [x,y,h,angle] of [[-507,-d+11,83,.5],[-466,-d+9,48,.1],[505,-d+13,110,-.55],[465,-d+9,55,.6],[-557,d-5,42,.7],[553,d-7,38,-.5]]){
   g.box(x,y,5,38,29,11,'#222a57',{yaw:angle});
   g.pyramid(x,y,h/2+8,35,31,h,'#687cf5',{yaw:angle,pitch:.12});
   g.pyramid(x-3,y-3,h*.56+8,17,24,h*.91,'#58e7f2',{yaw:angle+.13,light:.81});
  }
 }else{
  for(const x of [-538,-386,370,528]){
   const y=-d+2,h=66+(x>-500&&x<500?26:0);
   g.box(x,y,13,49,44,24,'#3d2e36');
   g.box(x,y,h/2,27,26,h,'#403145');
   g.box(x,y+14,h/2,3.6,2,h*.69,'#fb7044',bright);
   g.pyramid(x,y,h+10,37,35,20,'#9c4745',{yaw:.4});
  }
  for(const y of [-d-12,d+12]){
   g.beam([-565,y,-30],[565,y,-30],8,'#d05a39',{light:.87});
   g.beam([-565,y+1,-32],[565,y+1,-32],2.3,'#ffba67',bright);
  }
 }
}

function nameStrip(name){
 const canvas=document.createElement('canvas');canvas.width=228;canvas.height=48;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 ctx.fillStyle='#101c2b';ctx.fillRect(0,0,228,48);
 ctx.fillStyle='#f5fbfe';ctx.textBaseline='middle';ctx.textAlign='center';
 let size=33;
 ctx.font='700 '+size+'px system-ui';
 while(size>19&&ctx.measureText(name).width>212)ctx.font='700 '+(--size)+'px system-ui';
 let label=name;
 if(ctx.measureText(label).width>212){
  const characters=Array.from(label);
  while(characters.length&&ctx.measureText(characters.join('')+'…').width>212)characters.pop();
  label=characters.join('')+'…';
 }
 ctx.fillText(label,114,24);
 return canvas;
}

export function projectArmyPoint(m,w,h,[x,y,z]){
 if(!m)return null;
 const depth=1/(m[3]*x+m[7]*y+m[11]*z+m[15]);
 if(!(depth>0&&depth<5.55))return null;
 return {
  x:(1+(m[0]*x+m[4]*y+m[8]*z+m[12])*depth)*w*.5,
  y:(1-(m[1]*x+m[5]*y+m[9]*z+m[13])*depth)*h*.5,
  depth:(m[2]*x+m[6]*y+m[10]*z+m[14])*depth
 };
}

function contains(quad,x,y,slop){
 let direction=0;
 for(let i=0;i<quad.length;i++){
  const a=quad[i],b=quad[(i+1)%quad.length],dx=b.x-a.x,dy=b.y-a.y;
  const cross=dx*(y-a.y)-dy*(x-a.x);
  if(Math.abs(cross)<=slop*Math.hypot(dx,dy))continue;
  if(direction&&direction!==Math.sign(cross))return false;
  direction=Math.sign(cross);
 }
 return true;
}

function cardPose(u,time){
 const down=!u.hp,q=down?limit((time-u.downAt)/.72):0;
 const cast=u.pending,charge=cast?limit((time-cast.started)/(cast.hit-cast.started)):0;
 const recoil=limit(1-(time-u.hitAt)*9);
 const toward=cast?Math.sign(cast.target.x-u.x)||1:u.side===0?1:-1;
 const close=cast?.event.melee,forward=(down?u.lean*q*37:Math.sin(charge*Math.PI)*toward*(close?20:9));
 const x=u.x+forward+u.lean*recoil*6;
 const z=down?mix(50,12,q):52+Math.sin(time*5.5+u.index*.79)*2.4+Math.sin(charge*Math.PI)*(close?12:5)+recoil*3;
 return {x,y:u.y,z,q,yaw:(u.side===0?-.12:.12)+toward*charge*(close?.35:.12),
  pitch:down?-q*1.5:recoil*.18,charge,recoil,close};
}

function standingCard(g,u,time,texture,labelTexture,scale,selected){
 const {x,y,z,q,yaw,pitch,charge,recoil,close}=cardPose(u,time);
 if(q>=1)return;
 const tint=team[u.side],frame=selected?'#f3fff8':u.captain?'#ffcc6d':levels[u.tier]||levels[10];
 const body=[...rgba(frame).slice(0,3),1-q],sideLight=[...rgba(tint).slice(0,3),1-q];
 const alpha=Math.min(1,1-q*.93),roll=-Math.sin(charge*Math.PI)*(u.side===0?1:-1)*(close?.24:.12)+u.lean*recoil*.22;
 const opts={yaw,pitch,roll,alpha};
 const w=68,h=100,c=Math.cos(yaw),s=Math.sin(yaw),p=Math.cos(pitch),t=Math.sin(pitch),r=Math.cos(roll),v=Math.sin(roll);
 const face=(a,b,d=6)=>{
  const rx=c*a-s*d,ry=s*a+c*d,rz=t*ry+p*b;
  return [x+(r*rx+v*rz)*scale,y+(p*ry-t*b)*scale,z+(r*rz-v*rx)*scale];
 };
 const quad=(left,right,bottom,top,depth)=>[face(left,top,depth),face(right,top,depth),face(right,bottom,depth),face(left,bottom,depth)];
 if(!q){
  g.surface([[x-30,y-17,.6],[x+25,y-17,.6],[x+32,y+10,.6],[x-25,y+20,.6]],'#060b17',{alpha:.45});
  g.ring(x,y,1,30,27,.7,tint,{segments:10,light:.8,alpha:.85});
  if(selected)g.ring(x,y,2,42,36,2,'#f0fff9',{segments:12,light:1,alpha:.92});
  if(u.captain)g.ring(x,y,2,38,33,1.5,'#ffcc6d',{segments:12,light:1,alpha:.90});
 }
 g.box(x,y,z,w*scale,9*scale,h*scale,frame,opts);
 g.surface(quad(-31,31,-46,46,5),'#0b1424',{light:.87,alpha});
 const img=texture(u),art=quad(-29,29,-10,41,6);
 if(img)g.picture(img,art,[.93,.96,1,alpha]);
 else g.surface(art,frame,{alpha:.35*alpha});
 g.surface(quad(-29,29,43,45,6.5),sideLight,bright);
 const name=labelTexture(u);
 if(name)g.picture(name,quad(-30,30,-29,-12,6.8),[1,1,1,alpha]);
 g.surface(quad(-29,29,-41,-33,6.5),'#070a0f',{light:.9,alpha});
 const hpWidth=58*u.hp/u.maxHp;
 if(u.hp){
  g.surface(quad(-29,-29+hpWidth,-39,-34,7.2),tint,bright);
  if(u.shield>0)g.surface(quad(-29,-29+58*u.shield/u.maxHp,-44,-42,7.2),'#c4d9ff',bright);
  if(u.marked)g.pyramid(x,y+6,z+55,11,11,14,'#ff82ca',{yaw:time*2,light:1});
  if(u.pending?.event.signature){
   const color=moveArts[u.pending.event.art]?.color||tint;
   g.ring(x,y,z+47,8+12*charge,6+12*charge,2,color,{segments:9,yaw:time*4,pitch:time,light:1});
  }
 }
 g.surface(quad(-28,-22,-47,-44,7),body,bright);
 g.surface(quad(22,28,-47,-44,7),body,bright);
 if(u.hp)return quad(-34,34,-50,50,7);
}

function bladeArc(g,cast,q){
 const {unit,target,event,timing}=cast,art=moveArts[event.art]||moveArts.saw;
 const progress=limit((q-.25)/(timing.at-.25));
 const fade=(1-limit((q-timing.at)/(1-timing.at)))**1.2;
 if(progress<=0||fade<.03)return;
 const x=unit.x,y=unit.y,face=Math.atan2(target.y-y,target.x-x);
 const reach=event.signature?80:59,span=(event.signature?2.8:2.1)*progress;
 const segments=event.signature?9:6,lead=face+.9;
 function point(i,offset,z){
  const a=lead-span*(1-i/segments),r=reach+offset;
  return [x+Math.cos(a)*r,y+Math.sin(a)*r,z+Math.sin(a-face)*18];
 }
 for(let i=0;i<segments;i++){
  const low=point(i,-12,28),tip=point(i,8,40),nextTip=point(i+1,8,40);
  g.surface([low,tip,nextTip,point(i+1,-12,28)],art.color,{light:1,alpha:.61*fade});
  g.beam(tip,nextTip,4.5,'#fff3ed',{light:1,alpha:.84*fade});
 }
 if(event.signature)g.ring(unit.x,unit.y,3,reach,reach-3,2,art.color,{segments:12,alpha:.36*fade,light:1});
}

function castTrail(g,cast,q){
 const {unit,target,event,timing}=cast,art=moveArts[event.art]||moveArts.prism;
 const p=limit((q-.06)/(timing.at-.06)),fade=1-limit((q-timing.at)/(1-timing.at));
 const a=[unit.x,unit.y,42],b=[target.x,target.y,47];
 const v=[mix(a[0],b[0],p),mix(a[1],b[1],p),mix(a[2],b[2],p)];
 if(p<1){
  const lead=Math.max(0,p-.19),tail=[mix(a[0],b[0],lead),mix(a[1],b[1],lead),mix(a[2],b[2],lead)];
  if(art.shape==='gear'){
   g.ring(...v,event.signature?19:12,4,4,art.color,{segments:12,yaw:p*18,pitch:1.4,light:1,teeth:true});
  }else if(art.shape==='wave'){
   for(const side of [-1,0,1])g.beam([tail[0],tail[1]+side*8,tail[2]],[v[0],v[1]+side*19,v[2]+(1-Math.abs(side))*11],5,art.color,bright);
  }else g.pyramid(...v,event.signature?19:12,10,14,art.color,{yaw:p*8,pitch:.7,light:1});
  g.beam(tail,v,event.signature?7:4,'#f5fcff',{light:1,alpha:.75});
 }else{
  const radius=(1-fade)*(event.signature?54:27)+9;
  g.ring(b[0],b[1],4,radius,Math.max(1,radius-3),1.3,art.color,{segments:9,alpha:fade,light:1});
  g.beam([b[0],b[1],11],b,fade*6,art.color,{light:1,alpha:fade});
 }
}

function burst(g,fx,time){
 const q=limit((time-fx.at)/fx.life);
 if(q>=1)return;
 const {x=fx.unit.x,y=fx.unit.y}=fx,contact=fx.kind==='contact';
 const color=fx.art?(moveArts[fx.art]?.color||'#ead8ff'):
  fx.kind==='ko'?team[fx.unit.side]:fx.kind==='heal'?'#95ffd0':fx.kind==='shield'?'#7dbcff':'#e0a3ff';
 const fade=(1-q)**1.4,r=(fx.kind==='ko'?68:contact?62+fx.force*.05:40)*q+8;
 g.ring(x,y,2+r*.10,r,Math.max(1,r-3),2,color,{segments:12,light:1,alpha:fade});
 for(let i=0;i<(fx.kind==='ko'?10:5);i++){
  const a=i*2.399+fx.at,c=Math.cos(a),s=Math.sin(a);
  const z=42+Math.sin(q*Math.PI)*(33+i*7)-q*23;
  g.pyramid(x+c*r,y+s*r,z,5+i%3,6,7+i%5,color,{yaw:tau*q+a,pitch:q*4,light:1,alpha:fade});
 }
}

export function createArmyWorld(container,coverSource){
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
 const draw=rendererFor(canvas);
 if(!draw)return null;
 draw.canvas.className='army-canvas';container.prepend(draw.canvas);
 const floor=createGeometry(),cards=createGeometry(),effects=createGeometry(),images=new Map(),labels=new Map();
 let mapKey='',projection,viewWidth=0,viewHeight=0,cameraStamp='',rotation;
 const targets=new Map();
 const software=draw.kind==='software';
 const load=src=>{
  if(images.has(src))return images.get(src);
  const img=new Image();
  if(!software&&new URL(src,location.href).origin!==location.origin)img.crossOrigin='anonymous';
  img.src=src;
  if(images.size>=72)images.delete(images.keys().next().value);
  images.set(src,img);return img;
 };
 const fallback=load(cube);
 function prepare(teams){
  for(const unit of teams.flat())load(coverSource(unit.id));
 }
 const texture=u=>draw.imageTexture(load(coverSource(u.id)))||draw.imageTexture(fallback);
 function labelTexture(u){
  if(!labels.has(u.name)){
   if(labels.size>=44)labels.delete(labels.keys().next().value);
   labels.set(u.name,nameStrip(u.name));
  }
  return draw.imageTexture(labels.get(u.name));
 }
 const project=point=>projectArmyPoint(projection,viewWidth,viewHeight,point);
 function cardAt(x,y,slop=0){
  let closest=null,depth=Infinity;
  for(const [unit,area] of targets){
   if(area.depth<depth&&contains(area.quad,x,y,slop)){closest=unit;depth=area.depth}
  }
  return closest;
 }
 function render({key,map,teams,time,casts=[],bursts=[],angle=0,view,selected,reduced=false}){
  if(mapKey!==key){arenaGeometry(floor,key,map);mapKey=key}
  const width=container.clientWidth,height=container.clientHeight;
  if(!width||!height)return;
  const stamp=[width,height,angle,view.zoom,view.x,view.y].join('|');
  if(cameraStamp!==stamp){
   viewWidth=width;viewHeight=height;cameraStamp=stamp;
   const dpr=software?Math.min(.94,680/width):Math.min(1.75,window.devicePixelRatio||1);
   const w=width<525?1160:1240,h=w*height/width;
   const pixelsX=Math.round(width*dpr),pixelsY=Math.round(height*dpr);
   if(draw.canvas.width!==pixelsX||draw.canvas.height!==pixelsY){draw.canvas.width=pixelsX;draw.canvas.height=pixelsY}
   rotation=orientation(.94,angle,view.zoom);
   projection=viewMatrix({width:w,height:h,origin:[view.x,view.y,18],center:[w*.5,h*.57],vanish:[w*.5,h*.42],lens:1760,rot:rotation});
  }
  cards.reset();effects.reset();targets.clear();
  const scale=width<525?1.25:1.08;
  for(const unit of teams.flat().sort((a,b)=>a.y-b.y)){
   const quad=standingCard(cards,unit,reduced?Math.max(unit.downAt+.72,time):time,texture,labelTexture,scale,unit===selected);
   if(!quad)continue;
   const projected=quad.map(project);
   if(projected.every(Boolean))targets.set(unit,{quad:projected,depth:projected[0].depth,
    x:(projected[0].x+projected[1].x)/2,y:Math.min(projected[0].y,projected[1].y)});
  }
  let full=0;
  const order=casts.slice().sort((a,b)=>Number(!!b.event.visual||!!b.event.cinematic)-Number(!!a.event.visual||!!a.event.cinematic));
  for(const cast of order){
   const q=(time-cast.started)/cast.length;
   if(q<0||q>=1)continue;
   if(!reduced&&cast.event.signature&&full<(software?1:4)){
    paintArmyCast(effects,draw,rotation,cast,q);full++;
   }else if(!cast.event.melee)castTrail(effects,cast,q);
   if(cast.event.melee)bladeArc(effects,cast,q);
  }
  for(const fx of bursts)burst(effects,fx,time);
  draw.render(projection,[floor,cards,effects],undefined,software?floor:null);
 }
 return {render,prepare,software,cardAt,locate:unit=>targets.get(unit),project,
  dispose(){draw.dispose();draw.canvas.remove();images.clear();labels.clear();targets.clear()}};
}
