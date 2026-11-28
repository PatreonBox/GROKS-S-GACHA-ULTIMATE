import {breakwaterColor,breakwaterCourse,breakwaterRadius,breakwaterSawY} from './breakwater-course.js';
import {drawWave,drawWaveTrail} from './remix-wave.js';

const amber='#ffd18e';
const hitboxInk='#fffaa4';
const tau=2*Math.PI;
function polygon(ctx,points){
 ctx.beginPath();ctx.moveTo(...points[0]);
 for(const point of points.slice(1))ctx.lineTo(...point);
 ctx.closePath();
}
function disk(ctx,x,y,radius){
 ctx.beginPath();ctx.arc(x,y,radius,0,tau);
}
function line(ctx,x,y,toX,toY){
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(toX,toY);ctx.stroke();
}

export function createBreakwaterArt(ctx,skin,playerLimit){
 const {ceiling,floor,height,end,hazards}=breakwaterCourse;
 let viewHeight=0,sky;
 const tiles=ctx.createLinearGradient(0,ceiling,0,floor);
 tiles.addColorStop(0,'#263d45');tiles.addColorStop(.5,'#192b35');tiles.addColorStop(1,'#263d45');

 function backdrop(width,tall,top,scroll,time){
  if(viewHeight!==tall){
   viewHeight=tall;sky=ctx.createLinearGradient(0,0,0,tall);
   sky.addColorStop(0,'#0b1522');sky.addColorStop(.47,'#172b34');sky.addColorStop(1,'#071319');
  }
  ctx.fillStyle=sky;ctx.fillRect(0,0,width,tall);
  const spacing=270,shift=((scroll*.28)%spacing+spacing)%spacing;
  for(let x=-shift-spacing;x<width+spacing;x+=spacing){
   polygon(ctx,[[x+36,0],[x+146,0],[x+254,tall],[x+185,tall]]);
   ctx.fillStyle='#3f656e21';ctx.fill();
   ctx.strokeStyle='#61939722';ctx.lineWidth=1.3;ctx.stroke();
   ctx.strokeStyle='#8fddcb1c';line(ctx,x+139,0,x+247,tall);
   ctx.fillStyle='#71b7a34a';
   ctx.fillRect(x+113,top+77,18,2);ctx.fillRect(x+195,top+height-80,18,2);
  }
  ctx.strokeStyle='#8db4b00e';ctx.lineWidth=1;
  for(let y=top+66;y<top+height-40;y+=33)line(ctx,0,y,width,y);
  for(let i=0;i<24;i++){
   const y=top+61+i*59%(height-122),x=((i*137-scroll*.4-time*(i%3)*12)%width+width)%width;
   ctx.fillStyle=i%5?'#9ee9cf36':'#dfedd976';ctx.fillRect(x,y,i%4?2:3,i%4?2:3);
  }
 }

 function outerRails(left,width,top,tall){
  ctx.fillStyle='#0b1721';
  ctx.fillRect(0,-top,width,ceiling+top);ctx.fillRect(0,floor,width,tall-top-floor);
  ctx.strokeStyle='#88b8a366';ctx.lineWidth=1.5;
  line(ctx,0,ceiling,width,ceiling);line(ctx,0,floor,width,floor);
  ctx.fillStyle='#6ea29863';
  for(let x=-(left%44);x<width;x+=44){
   ctx.fillRect(x,ceiling-7,12,2);ctx.fillRect(x,floor+5,12,2);
  }
 }

 function ramp(obstacle,left,debug){
  const points=obstacle.points.map(([x,y])=>[x-left,y]);
  const edge=obstacle.kind==='floor'?breakwaterColor:'#a9c5ff';
  polygon(ctx,points);
  ctx.fillStyle=tiles;ctx.fill();
  ctx.save();ctx.clip();
  ctx.strokeStyle=edge+'32';ctx.lineWidth=1;
  for(let x=obstacle.left-174;x<obstacle.right+42;x+=23)line(ctx,x-left,obstacle.top,x-left+174,obstacle.bottom);
  polygon(ctx,points);ctx.strokeStyle=edge+'42';ctx.lineWidth=15;ctx.stroke();
  ctx.strokeStyle=edge;ctx.lineWidth=4.8;ctx.stroke();
  ctx.restore();
  if(debug){
   polygon(ctx,points);ctx.strokeStyle=hitboxInk;ctx.lineWidth=1.2;ctx.stroke();
   ctx.fillStyle=hitboxInk;
   for(const [x,y] of points)ctx.fillRect(x-1.7,y-1.7,3.4,3.4);
  }
 }

 function rotor(saw,left,time,reduced,debug){
  const x=saw.x-left,y=breakwaterSawY(saw,time),r=saw.radius;
  ctx.strokeStyle='#dac6a542';ctx.lineWidth=1.4;
  line(ctx,x,saw.y-saw.travel,x,saw.y+saw.travel);
  const glow=ctx.createRadialGradient(x,y,r*.5,x,y,r*1.65);
  glow.addColorStop(0,'#ffc37448');glow.addColorStop(1,'#ffc37400');
  disk(ctx,x,y,r*1.65);ctx.fillStyle=glow;ctx.fill();
  disk(ctx,x,y,r);ctx.fillStyle='#251f27';ctx.fill();
  ctx.save();ctx.translate(x,y);ctx.rotate(reduced?0:time*3.8+saw.x*.013);
  for(let i=0;i<9;i++){
   ctx.rotate(tau/9);
   polygon(ctx,[[r*.52,-r*.18],[r*.95,-r*.24],[r*.93,r*.33],[r*.62,r*.15]]);
   ctx.fillStyle=i%2?'#9c6a42':'#d89a58';ctx.fill();
  }
  ctx.restore();
  disk(ctx,x,y,r);ctx.strokeStyle=debug?hitboxInk:amber;ctx.lineWidth=1.6;ctx.stroke();
  disk(ctx,x,y,r*.28);ctx.fillStyle='#ffe4a8';ctx.fill();
  disk(ctx,x,y,r*.14);ctx.fillStyle='#633e36';ctx.fill();
 }

 function exit(width,left){
  const x=end-left;
  if(x<0||x>width+42)return;
  ctx.strokeStyle='#fff0ba65';ctx.lineWidth=1.5;ctx.setLineDash([5,8]);
  line(ctx,x,ceiling+15,x,floor-15);ctx.setLineDash([]);
  const y=(ceiling+floor)/2;
  polygon(ctx,[[x-18,y-85],[x+18,y-85],[x+33,y-66],[x+33,y+66],[x+18,y+85],[x-18,y+85],[x-33,y+66],[x-33,y-66]]);
  ctx.fillStyle='#ffdd7819';ctx.fill();ctx.strokeStyle=amber;ctx.lineWidth=3;ctx.stroke();
 }

 return (s,{phase,particles,reduced,width,height:tall,hitboxes=false})=>{
  const player=Math.min(playerLimit,width*.22),left=s.x-player,top=(tall-height)/2;
  backdrop(width,tall,top,left,reduced?0:s.time);
  ctx.save();ctx.translate(0,top);ctx.lineJoin='bevel';
  outerRails(left,width,top,tall);
  for(const hazard of hazards){
   if(hazard.left>left+width+30)break;
   if(hazard.right<left-30)continue;
   if(hazard.kind==='saw')rotor(hazard,left,s.time,reduced,hitboxes);
   else ramp(hazard,left,hitboxes);
  }
  exit(width,left);
  drawWaveTrail(ctx,[...s.trace,[s.x,s.y]].map(([x,y])=>[x-left,y]),{skin,faded:phase==='lost'});
  drawWave(ctx,{x:player,y:s.y,angle:s.angle,skin});
  if(hitboxes){
   ctx.strokeStyle=hitboxInk;
   ctx.lineWidth=1.2;
   line(ctx,0,ceiling,width,ceiling);line(ctx,0,floor,width,floor);
   disk(ctx,player,s.y,breakwaterRadius);ctx.stroke();
  }
  for(const particle of particles){
   ctx.globalAlpha=particle.life/particle.max;ctx.fillStyle=particle.color;
   ctx.fillRect(particle.x-left,particle.y,particle.size,particle.size);
  }
  ctx.restore();
 };
}
