import {VIEW_HEIGHT as H,CEILING,FLOOR,tunnelAt,hazardsBetween} from './remix-physics.js';
import {orbSprites} from './combat-arts.js';
import {drillSprites} from './drill-sprites.js';
import {arcadeSprites} from './minigame-guide.js';
import {starterCube} from './cube-catalog.js';
import {drawWave,drawWaveTrail} from './remix-wave.js';

const styles={
 SURF:{image:'surf',wall:'#123758',pattern:'diamond',light:'#d0fffe'},
 DRAIN:{image:'drain',wall:'#471727',pattern:'brick',light:'#ffd1be'},
 KEY:{wall:'#23204a',pattern:'circuit',light:'#d9d3ff'},
 RINGS:{image:'rings',wall:'#49231f',pattern:'diamond',light:'#ffdeb6'},
 '99%':{image:'funk',wall:'#482445',pattern:'circuit',light:'#ffe9fa'},
 HIVE:{image:'hive',wall:'#48351e',pattern:'hex',light:'#fff4b0'},
 BLINK:{image:'blink',wall:'#392652',pattern:'diamond',light:'#ffd6fe'},
 SNOOZE:{image:'snooze',wall:'#212959',pattern:'brick',light:'#d8e9ff'},
 '8 BIT':{image:'pixel',wall:'#2b3e26',pattern:'pixel',light:'#edffcf'},
 MINI:{image:'drain',wall:'#45221e',pattern:'circuit',light:'#ffe1bc'},
 GEO:{wall:'#30234c',pattern:'diamond',light:'#f6d7ff'},
 CIRCUIT:{wall:'#143944',pattern:'circuit',light:'#c1ffca'},
 LIFT:{wall:'#173b49',pattern:'brick',light:'#ccfff6'},
 DUSK:{wall:'#272453',pattern:'diamond',light:'#e4ddff'}
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function tracePath(ctx,points){
 ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
}
function path(ctx,points,fill,stroke,width=1){
 tracePath(ctx,points);
 if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill()}
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}
}
function label(ctx,text,x,y,size=14,color='#fff'){
 ctx.font='800 '+size+'px Barlow,system-ui,sans-serif';ctx.fillStyle=color;ctx.fillText(text,x,y);
}
function image(src,ready){
 const img=new Image();img.decoding='async';img.onload=ready;img.src=src;return img;
}
function circle(ctx,x,y,r,fill,stroke,width=1){
 ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
 if(fill){ctx.fillStyle=fill;ctx.fill()}
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}
}

const tileStep=56;
function tilePattern(ctx,theme,tint){
 const tile=document.createElement('canvas');
 tile.width=tile.height=tileStep;
 const paint=tile.getContext('2d'),soft=tint+'36',bright=theme.light+'86';
 const diamond=(x,y,r)=>[[x,y-r],[x+r,y],[x,y+r],[x-r,y],[x,y-r]];
 switch(theme.pattern){
  case 'diamond':
   for(const [x,y] of [[28,28],[0,0],[56,0],[56,56],[0,56]]){
    path(paint,diamond(x,y,25),tint+'12',soft,1.4);
    path(paint,diamond(x,y,13),null,soft);
   }
   paint.fillStyle=bright;paint.fillRect(26,26,4,4);
   break;
  case 'hex':
   for(const [x,y] of [[28,14],[0,42],[56,42]]){
    const points=[[x-24,y],[x-12,y-13],[x+12,y-13],[x+24,y],[x+12,y+13],[x-12,y+13],[x-24,y]];
    path(paint,points,tint+'17',soft,1.5);
    path(paint,[[x-17,y],[x-8,y-9],[x+8,y-9]],null,bright,1.2);
   }
   break;
  case 'brick':
   paint.fillStyle=tint+'19';paint.fillRect(2,2,52,24);paint.fillRect(2,30,24,24);paint.fillRect(30,30,24,24);
   path(paint,[[2,25],[2,2],[54,2]],null,soft,1.3);
   path(paint,[[2,53],[2,30],[26,30]],null,soft,1.3);
   path(paint,[[30,53],[30,30],[54,30]],null,soft,1.3);
   paint.fillStyle=bright;paint.fillRect(7,6,13,2);paint.fillRect(35,34,9,2);
   break;
  case 'pixel':
   for(const [x,y] of [[2,2],[30,2],[2,30],[30,30]]){
    paint.fillStyle=tint+'20';paint.fillRect(x,y,24,24);
    path(paint,[[x,y+24],[x,y],[x+24,y]],null,soft,2.3);
    paint.fillStyle=bright;paint.fillRect(x+4,y+4,5,5);
   }
   break;
  default:
   path(paint,[[0,28],[12,28],[21,19],[35,19],[44,28],[56,28]],null,soft,2);
   path(paint,[[28,0],[28,12],[44,28],[44,44],[28,44],[28,56]],null,soft,1.2);
   path(paint,[[12,28],[12,44],[28,44]],null,soft,1.2);
   paint.fillStyle=bright;paint.fillRect(19,17,4,4);paint.fillRect(42,26,4,4);paint.fillRect(10,42,4,4);
 }
 return ctx.createPattern(tile,'repeat');
}

export function createRemixArt(ctx,remix,course,onReady,skin=starterCube){
 const theme=styles[remix.mark],tint=remix.color;
 const scene=remix.mark==='KEY'?null:image(remix.art||(theme.image?'/assets/remix/'+theme.image+'.webp':'/assets/shots/'+remix.id+'.webp'),onReady);
 const icon=image(skin.icon,onReady),vehicle=course.mode==='ship'?image(arcadeSprites.ship,onReady):null;
 const pinkOrb=image(orbSprites[0],onReady),spikeSprite=image(drillSprites.spike,onReady);
 const exitPortal=image(drillSprites.exit,onReady),miniPortal=course.miniAt?image(drillSprites.mini,onReady):null;
 const tiles=tilePattern(ctx,theme,tint),wall=ctx.createLinearGradient(0,0,0,H);
 wall.addColorStop(0,'#0c1327');wall.addColorStop(.34,theme.wall);wall.addColorStop(.63,theme.wall);wall.addColorStop(1,'#091222');
 let drawX=0,W=0,viewHeight=0,top=0,player=0,sky,shade,paintedVehicle,tileShift=0;

 function vehiclePaint(){
  if(paintedVehicle||!vehicle?.naturalWidth)return paintedVehicle;
  const sprite=document.createElement('canvas');
  sprite.width=vehicle.naturalWidth;sprite.height=vehicle.naturalHeight;
  const paint=sprite.getContext('2d');
  paint.drawImage(vehicle,0,0);
  paint.globalCompositeOperation='source-atop';paint.globalAlpha=.54;paint.fillStyle=skin.color;
  paint.fillRect(0,0,sprite.width,sprite.height);
  paintedVehicle=sprite;
  return sprite;
 }

 function backdrop(s,reduced){
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,viewHeight);
  if(scene?.complete&&scene.naturalWidth){
   const cover=Math.max((W+50)/scene.naturalWidth,viewHeight/scene.naturalHeight);
   const w=scene.naturalWidth*cover,h=scene.naturalHeight*cover;
   const slide=reduced?0:(course.endless?Math.cos(s.x/840):1-2*s.x/course.end)*Math.min(72,(w-W)/2);
   ctx.drawImage(scene,(W-w)/2+slide,(viewHeight-h)*.49,w,h);
  }
  ctx.fillStyle=shade;ctx.fillRect(0,0,W,viewHeight);
  for(let i=0;i<28;i++){
   const y=19+(i*87)%(Math.max(1,viewHeight-38)),x=((47+i*141-s.x*.19+(reduced?0:s.time*5*(i%3)))%(W+40)+W+40)%(W+40)-20;
   ctx.fillStyle=i%3?tint+'54':'#e4f5ffad';ctx.fillRect(x,y,i%4===0?3:2,i%4===0?3:2);
  }
  ctx.fillStyle='#080e1f32';ctx.fillRect(0,top+12,W,H-32);
 }
 function keyObservatory(s,reduced){
  const spacing=290,scroll=s.x*.26%spacing;
  for(let x=-scroll;x<W+spacing;x+=spacing){
   const center=x+95,y=136;
   ctx.fillStyle='#1d1c447c';ctx.fillRect(center-52,-top,104,viewHeight);
   path(ctx,[[center-52,-top],[center-52,viewHeight-top]],null,'#7460b359',2.2);
   path(ctx,[[center+52,-top],[center+52,viewHeight-top]],null,'#4d428675',1.2);
   for(const radius of [83,67,49])circle(ctx,center,y,radius,null,radius===67?'#9889e783':'#7a60c449',radius===67?2:1.2);
   const clock=reduced?0:s.time*.55;
   for(let i=0;i<8;i++){
    const angle=clock+i*Math.PI/4;
    const ax=center+Math.cos(angle)*67,ay=y+Math.sin(angle)*67;
    path(ctx,[[ax,ay-4],[ax+3,ay],[ax,ay+4],[ax-3,ay]],i%2?'#807fb7b3':'#b39ef0d2');
   }
   path(ctx,[[center-12,y-23],[center+8,y-23],[center+18,y-8],[center+6,y+7],[center+14,y+26],[center-14,y+26],[center-7,y+7],[center-18,y-8]],
    '#130f31d9','#9b83e29e',2.2);
  }
 }
 function atmosphere(s,reduced){
  if(remix.mark==='KEY')keyObservatory(s,reduced);
  if(remix.mark==='SURF'){
   for(let j=0;j<3;j++){
    const line=[];for(let x=0;x<=W+17;x+=17)line.push([x,156+j*18+Math.sin(x*.016+(reduced?0:s.time*3)+j*.7)*9]);
    path(ctx,[...line,[W+17,FLOOR],[0,FLOOR]],'#57c8ef15');
    path(ctx,line,null,'#9fedff4e',1.4);
   }
  }
  if(remix.mark==='DRAIN'){
   const level=FLOOR-54*(course.endless?.5+.45*Math.cos(s.time*.30):1-s.x/course.end);
   ctx.fillStyle='#ec262437';ctx.fillRect(0,level,W,H-level);
   for(let i=0;i<3;i++){
    const line=[];for(let x=0;x<=W+18;x+=18)line.push([x,level+i*12+Math.sin(x*.04+s.time*5+i)*4]);
    path(ctx,line,null,'#ff95ae60',1.1);
   }
  }
  if(remix.mark==='BLINK'&&!reduced){
   const shutter=Math.pow(Math.max(0,Math.sin(s.time*1.35)),18)*24;
   ctx.fillStyle='#35164775';ctx.fillRect(0,20,W,shutter);ctx.fillRect(0,FLOOR-shutter,W,shutter);
  }
  if(remix.mark==='SNOOZE'){
   for(let i=0;i<4;i++)label(ctx,'z',W*.76+i*16,79-i*12+(reduced?0:Math.sin(s.time*3-i)*4),11+i*3,'#d8ddff99');
  }
 }
 function material(points,rim,toward){
  path(ctx,points,wall);
  if(tiles){
   ctx.save();tracePath(ctx,points);ctx.closePath();ctx.clip();
   ctx.translate(-tileShift,0);ctx.fillStyle=tiles;ctx.fillRect(0,-top,W+tileStep,viewHeight);
   ctx.restore();
  }
  const [a,b]=rim;
  path(ctx,[a,b,[b[0],b[1]+toward*8],[a[0],a[1]+toward*8]],tint+'50');
  path(ctx,rim.map(([x,y])=>[x,y+toward*10]),null,tint+'70',1);
  path(ctx,rim,null,tint+'32',10);path(ctx,rim,null,tint,3.4);path(ctx,rim,null,theme.light,1.25);
  const left=Math.min(a[0],b[0]),right=Math.max(a[0],b[0]);
  for(let x=Math.ceil((Math.max(left+8,0)+tileShift)/tileStep)*tileStep-tileShift;x<Math.min(right-8,W);x+=tileStep){
   const y=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
   path(ctx,[[x-3,y+toward*1],[x,y+toward*5],[x+3,y+toward*1]],null,theme.light,1.2);
  }
 }
 function floor(){
  const start=drawX(0);
  if(start>0){
   const y=course.floor[0].y,bottom=viewHeight-top;
   material([[0,y],[start,y],[start,bottom],[0,bottom]],[[0,y],[start,y]],1);
  }
  for(let i=1;i<course.floor.length;i++){
   const a=course.floor[i-1],b=course.floor[i];
   if(drawX(b.x)<0||drawX(a.x)>W)continue;
   const cuts=[a.x,...course.gaps.flat().filter(n=>n>a.x&&n<b.x),b.x].sort((x,y)=>x-y);
   for(let j=1;j<cuts.length;j++){
    const x0=cuts[j-1],x1=cuts[j],mid=(x0+x1)/2;
    if(course.gaps.some(([l,r])=>mid>=l&&mid<r))continue;
    const y=x=>a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);
    const left=Math.max(x0,a.x),right=Math.min(x1,b.x);
    const p=[drawX(left),y(left)],q=[drawX(right),y(right)];
    material([p,q,[q[0],viewHeight-top],[p[0],viewHeight-top]],[p,q],1);
   }
  }
 }
 function ledge(obstacle){
  const p=obstacle.points.map(([x,y])=>[drawX(x),y]);
  const bottom=obstacle.kind==='bank',rim=bottom?p.slice(0,2):p.slice(2);
  for(const i of bottom?[2,3]:[0,1])p[i][1]=bottom?viewHeight-top:-top;
  material(p,rim,bottom?1:-1);
 }
 function tunnelStart(){
  const x=drawX(0);
  if(x<=0)return;
  const {top:roof,bottom:bank}=course.tunnel[0];
  material([[0,-top],[x,-top],[x,roof],[0,roof]],[[0,roof],[x,roof]],-1);
  material([[0,bank],[x,bank],[x,viewHeight-top],[0,viewHeight-top]],[[0,bank],[x,bank]],1);
 }
 function shard(obstacle){
  const p=obstacle.points.map(([x,y])=>[drawX(x),y]),[a,b,c]=p;
  path(ctx,p,theme.wall,tint+'43',7);
  if(spikeSprite.naturalWidth){
   ctx.save();ctx.translate(b[0],(a[1]+b[1])/2);
   const h=Math.abs(a[1]-b[1]),w=c[0]-a[0];
   if(obstacle.kind==='ceiling')ctx.scale(1,-1);
   ctx.globalAlpha=.47;ctx.drawImage(spikeSprite,-w/2,-h/2,w,h);
   ctx.restore();
  }
  path(ctx,[a,b,[(a[0]+c[0])/2,a[1]]],tint+'78');
  path(ctx,[b,c,[(a[0]+c[0])/2,a[1]]],tint+'29');
  path(ctx,[a,b,c,a],null,theme.light,1.5);
 }
 function portal(x,y,palette,clock,sprite,wide=21){
  if(x<-64||x>W+64)return;
  ctx.save();ctx.translate(x,y);
  const glow=ctx.createRadialGradient(0,0,7,0,0,54);
  glow.addColorStop(0,palette+'6e');glow.addColorStop(1,palette+'00');circle(ctx,0,0,54,glow);
  if(sprite?.naturalWidth){
   const height=130,width=height*sprite.naturalWidth/sprite.naturalHeight;
   ctx.drawImage(sprite,-width/2,-height/2,width,height);
  }else for(let i=0;i<3;i++){
   ctx.beginPath();ctx.ellipse(0,0,wide+i*4,57+i*6,0,0,Math.PI*2);
   ctx.strokeStyle=i?palette+'44':palette;ctx.lineWidth=i?1.5:3;ctx.stroke();
  }
  for(let i=0;i<8;i++){
   const a=clock*2.8+i*Math.PI/4,x=Math.cos(a)*(wide+7),y=Math.sin(a)*62;
   ctx.fillStyle=i%2?palette:'#effbff';ctx.fillRect(x-1.3,y-1.3,2.6,2.6);
  }
  ctx.restore();
 }
 function gateMarks(s,reduced){
  if(course.mode==='cube'){
   if(!course.finale)return;
   const marker=drawX(course.finale);
   if(marker>-60&&marker<W-130){
    label(ctx,'FINALE',marker+9,61,18,'#ffe7fa');
    path(ctx,[[marker,71],[marker+70,71],[marker+80,63]],null,'#ff91cf',2);
   }
   const beatSpacing=course.beat*course.speed;
   for(let x=Math.floor((s.x-player)/beatSpacing)*beatSpacing;x<=s.x+W;x+=beatSpacing){
    const px=drawX(x),beat=Math.floor(x/beatSpacing+.5),near=Math.abs(x-s.x)<beatSpacing*.18;
    ctx.fillStyle=!reduced&&near?'#fff2fa':tint+'96';ctx.fillRect(px,FLOOR+29,beat%4===0?4:2,beat%4===0?16:9);
   }
   return;
  }
  for(let i=Math.max(0,s.passed-(course.firstGate||0)-3);i<course.gates.length;i++){
   const g=course.gates[i];
   const number=g.index??i;
   if(drawX(g.x)>W+50)break;
   const x=drawX(g.x);if(x<-50||x>W+50)continue;
   const {top,bottom}=tunnelAt(course,g.x),mid=(top+bottom)/2;
   const color=s.passed>number?tint+'45':tint+'a9';
   path(ctx,[[x-10,top+7],[x+5,top+7],[x+11,top+13]],null,color,2);
   path(ctx,[[x-10,bottom-7],[x+5,bottom-7],[x+11,bottom-13]],null,color,2);
   if(remix.mark==='RINGS'||course.endless&&number%5===4){
    const height=(bottom-top)*.38;
    ctx.beginPath();ctx.ellipse(x,mid,13,height,0,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,mid,13,height,0,0,Math.PI*2);ctx.strokeStyle=theme.light;ctx.lineWidth=1;ctx.stroke();
    label(ctx,String(number+1),x+19,mid+4,13,theme.light);
   }
   if(remix.mark==='HIVE')path(ctx,[[x-10,mid],[x-5,mid-9],[x+5,mid-9],[x+10,mid],[x+5,mid+9],[x-5,mid+9]],tint+'22',color,1.4);
  }
 }
 function orbs(s,reduced){
  for(const [i,o] of course.orbs.entries()){
   const x=drawX(o.x);if(x<-60||x>W+60)continue;
   const used=s.orbs.has(i),r=17+(reduced?0:2*Math.sin(s.time*7+i));
   if(o.tight){
    path(ctx,[[x,38],[x,107]],null,'#ffb7eb77',1.4);
    label(ctx,'99%',x-21,34,24,'#fff2fa');
   }
   if(used){
    circle(ctx,x,o.y,14,null,'#ffb2dd57',1.5);
    continue;
   }
   const near=!s.ground&&Math.abs(s.x-o.x)<=o.rx&&Math.abs(s.y-o.y)<=o.ry;
   const glow=ctx.createRadialGradient(x,o.y,3,x,o.y,32);
   glow.addColorStop(0,near?'#ffacdcb0':'#ff50b285');glow.addColorStop(1,'#ff50b200');
   circle(ctx,x,o.y,32,glow);
   circle(ctx,x,o.y,r+5,null,near?'#fff4fd':'#ff80cbab',near?3:1.5);
   if(pinkOrb.complete&&pinkOrb.naturalWidth)ctx.drawImage(pinkOrb,x-22,o.y-22,44,44);
   else{circle(ctx,x,o.y,14,'#401334','#ffc8eb',3);path(ctx,[[x-7,o.y+3],[x,o.y-5],[x+7,o.y+3]],null,'#fff6fa',2)}
  }
 }
 function actor(s,faded){
  const trail=faded?s.trace:[...s.trace,[s.x,s.y]];
  if(course.mode==='wave'){
   drawWaveTrail(ctx,trail.map(([x,y])=>[drawX(x),y]),{skin,mini:s.mini,faded});
   if(!faded)drawWave(ctx,{x:player,y:s.y,angle:s.angle,mini:s.mini,skin});
   return;
  }
  ctx.lineJoin='round';ctx.lineCap='round';
  for(let i=1;i<trail.length;i++){
   const [ax,ay]=trail[i-1],[bx,by]=trail[i];
   const age=i/trail.length,size=5*age;
   ctx.globalAlpha=age**1.45*(faded?.42:1);
   const line=[[drawX(ax),ay],[drawX(bx),by]];
   path(ctx,line,null,skin.color+'54',size+5);
   path(ctx,line,null,skin.color,size);
   path(ctx,line,null,'#fefeffe0',Math.max(.8,size*.29));
  }
  ctx.globalAlpha=1;
  if(faded)return;
  ctx.save();ctx.translate(player,s.y);ctx.rotate(s.angle);
  const scale=s.mini?.66:1,appearance=vehicle?vehiclePaint():icon;
  ctx.scale(scale,scale);ctx.shadowColor=skin.color;ctx.shadowBlur=11;
  if(appearance&&(appearance.naturalWidth||appearance===paintedVehicle)){
   const width=course.mode==='cube'?22:37,height=course.mode==='cube'?22:19;
   const fit=Math.min(width/appearance.width,height/appearance.height);
   const w=appearance.width*fit,h=appearance.height*fit;
   ctx.drawImage(appearance,-w/2,-h/2,w,h);
   if(vehicle&&icon.naturalWidth){
    const size=11;
    ctx.shadowBlur=0;ctx.drawImage(icon,-size*.63,-size*.55,size,size);
   }
  }else if(course.mode==='cube'){
   ctx.fillStyle=skin.color;ctx.fillRect(-10,-10,20,20);
   ctx.strokeStyle='#eff5ff';ctx.lineWidth=1.5;ctx.strokeRect(-10,-10,20,20);
  }else{
   path(ctx,[[-16,-4],[-3,-7],[16,0],[-3,8],[-15,3]],skin.color,'#fff',1.45);
   path(ctx,[[-8,-3],[4,-3],[9,0],[2,3],[-8,2]],'#f0f7ff');
  }
  ctx.restore();
 }
 return function draw(s,{phase,particles,reduced,width,height}){
  if(width!==W||height!==viewHeight){
   W=width;viewHeight=height;top=(height-H)*.49;player=Math.min(154,width*.23);
   sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#0b1021');sky.addColorStop(.73,'#181b32');sky.addColorStop(1,tint+'66');
   shade=ctx.createLinearGradient(0,0,0,height);shade.addColorStop(0,'#080d1f62');shade.addColorStop(.48,'#080d1f28');shade.addColorStop(1,'#080b18c6');
  }
  drawX=x=>player+x-s.x;
  tileShift=((s.x-player)%tileStep+tileStep)%tileStep;
  backdrop(s,reduced);
  ctx.save();ctx.translate(0,top);atmosphere(s,reduced);
  if(course.mode==='cube')floor();else tunnelStart();
  for(const obstacle of hazardsBetween(course,s.x-player-30,s.x-player+W+30)){
   if(obstacle.kind==='bank'||obstacle.kind==='roof')ledge(obstacle);
   else shard(obstacle);
  }
  const clock=reduced?0:s.time;
  if(course.miniAt)portal(drawX(course.miniAt),126,'#ffa0fc',clock,miniPortal,16);
  if(!course.endless)portal(drawX(course.end),course.mode==='cube'?FLOOR-46:127,'#ffd58c',clock,exitPortal,19);
  actor(s,phase==='lost');
  for(const p of particles){
   const a=clamp(p.life/p.max,0,1),x=drawX(p.x);ctx.globalAlpha=a;
   ctx.fillStyle=p.color;ctx.fillRect(x,p.y,p.size,p.size);
  }
  ctx.restore();
 };
}
