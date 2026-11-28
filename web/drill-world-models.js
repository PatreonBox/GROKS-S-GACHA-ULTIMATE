import {drillDepth,drillLanes,drillPace,drillViewScale,portalSlot,sawPassage,sawRadius,sawTrackEdge} from './drill-physics.js';

import {forgeImpactAge,paintForgeFracture,paintForgeHammer} from './drill-forge-effects.js';

export const gravityRise=93;

const tones={
 spike:{bg:'#170e21',rail:'#f69264',floor:'#241729',mark:'#ffc478'},
 saw:{bg:'#091524',rail:'#45dbfc',floor:'#102334',mark:'#9efffa'},
 endurance:{bg:'#151326',rail:'#a88afe',floor:'#201f3a',mark:'#9dfed8'}
};
const HURT='#fa6b8c';
const lit={light:1};
const bar=(g,x,y,z,width,depth,height,color)=>g.box(x,y,z,width,depth,height,color,lit);

export function paintDrillDeck(g,kind){
 const a=tones[kind];
 g.box(0,-1020,-14,490,2390,21,a.floor);
 for(const side of [-1,1]){
  g.box(side*248,-1020,2,13,2390,8,'#353249');
  g.box(side*248,-1020,6.4,3,2390,1,a.rail,{light:.65});
 }
}
function stripe(g,x,y,z,w,d,color){
 g.surface([[x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y+d/2,z],[x-w/2,y+d/2,z]],color,lit);
}
function runway(g,run,a,depthScale,software){
 const lead=run.dist*depthScale%130;
 for(let i=-1;i<18;i++){
  const y=lead-i*130,near=y>-1280;
  if(y>163||y<-drillDepth)continue;
  stripe(g,0,y,-.5,468,near?2.2:3.5,'#52678b');
  for(const direction of [-1,1]){
   const x=direction*248;
   if(near&&(!software||i<5||i%2===0)){
    g.box(x,y,10,20,23,29,'#343855');
    if(!software||i%2===0)g.box(direction*(312+26*(i%4)),y-40,8,45,32,40+(i%3)*12,'#302743',{light:.7});
   }
   stripe(g,x,y-54,8.5,4,91,a.rail);
   stripe(g,direction*213,y-56,1,3,41,a.rail);
  }
  if(run.kind==='endurance'){
   for(const x of [-76,76])stripe(g,x,y-61,.5,2,77,'#737796');
   if(near)for(const x of [-235,-76,76,235])stripe(g,x,y-52,gravityRise+44.5,4,92,run.inverted?a.rail:'#655d80');
  }
 }
}
function sprite(g,texture,x,y,z,width,height,rotation=0,tint='#ffffff'){
 const c=Math.cos(rotation),s=Math.sin(rotation);
 const corners=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([u,v])=>{
  const dx=u*width/2,dz=v*height/2;
  return [x+dx*c-dz*s,y,z+dx*s+dz*c];
 });
 g.picture(texture,corners,tint);
}
function playerCube(g,x,z,roll,color){
 g.box(x,0,z,40,37,39,color,{roll});
 g.box(x,19.5,z,27,2,17,'#152338',{roll,light:.92});
}
function obstacle(g,x,y,w,h,skin,height=0,dir=1){
 g.box(x,y,height+h*.42*dir,w,26,h,skin);
 bar(g,x,y+13,height+h*.62*dir,w-4,2,3,'#ff9dd0');
 const count=Math.min(4,Math.max(1,Math.floor(w/30)));
 for(let i=0;i<count;i++)g.pyramid(x+((i+.5)/count-.5)*w,y,height+(h+4)*dir,w/count-4,25,20,'#e874a7',{yaw:Math.PI/4,pitch:dir<0?Math.PI:0});
}
function sawGate(g,gate,y,run,a,next,opening,texture){
 const [x0,x1]=sawPassage(gate,opening);
 for(const [edge,dir] of [[x0,-1],[x1,1]]){
  const space=sawTrackEdge-edge*dir;
  if(space<7)continue;
  obstacle(g,edge+dir*space/2,y,space,27,'#673657');
  bar(g,edge+dir*3,y,27,6,11,52,a.mark);
  if(next&&space>=28){
   const radius=Math.min(29,(space-4)/2),x=edge+dir*(radius+3),spin=dir*run.time*9;
   g.ring(x,y+8,30,radius*.84,radius*.24,7,HURT,{pitch:Math.PI/2,roll:spin,segments:12,teeth:true});
   sprite(g,texture,x,y+14,30,2*radius,2*radius,spin,'#ffadb7');
  }
 }
 bar(g,(x0+x1)/2,y,0,x1-x0-10,10,2,a.mark);
 g.pyramid((x0+x1)/2,y,68,16,16,20,a.mark,{pitch:Math.PI,light:1});
}
const portalLight=['#ffe658','#62ff95','#5cecff'];
function laneGate(g,gate,y,a,next,textures,inverted){
 for(const [i,x] of drillLanes.entries()){
  if(!gate.lanes.includes(i)){
   obstacle(g,x,y,135,45,'#734066');
   if(inverted)obstacle(g,x,y,135,45,'#734066',gravityRise+43,-1);
   continue;
  }
  const slot=portalSlot(gate,i),color=portalLight[slot];
  if(textures?.[slot]){
   sprite(g,textures[slot],x,y+1,75,78,130);
   g.ring(x,y,1,58,50,2,color,{segments:12,light:1});
  }else g.ring(x,y,75,49,39,10,color,{pitch:Math.PI/2,segments:12,light:1});
  if(next)bar(g,x,y+3,0,134,58,2,'#3c8989');
  bar(g,x,y,2,113,6,2,color);
  bar(g,x,y,gravityRise+43,113,6,2,color);
 }
}
function forgeGate(g,gate,y,run,a,next,pace,texture,strike,clock,reduce){
 const hit=strike?.gate===gate.index,age=hit?forgeImpactAge(strike,clock,reduce):Infinity;
 if(gate.cleared&&age>=0){
  paintForgeFracture(g,gate,y,age,reduce);
  return;
 }
 g.box(0,y,11,153,36,23,'#583354');
 const burst=hit||next&&gate.distance-run.dist<=pace.speed*pace.strike;
 for(const x of [-46,0,46]){
  g.pyramid(x,y,41,37,35,47,burst?'#ffcb85':'#38558b',{yaw:Math.PI/4});
  sprite(g,texture,x,y+21,42,43,48,0,burst?'#ffe3a8':'#e1f3ff');
 }
 if(next)g.ring(0,y+5,83,12,6,5,burst?a.mark:'#f78a92',{pitch:Math.PI/2,segments:10});
}
export function paintDrillWorld(g,run,reduce=false,sprites={},visual={}){
 const {kind,time,x}=run,a=tones[kind],pace=drillPace(kind,time),speed=pace.speed,depthScale=drillViewScale(speed);
 const {strike,actor}=visual,clock=visual.clock??time;
 if(!visual.hasDeck)paintDrillDeck(g,kind);
 runway(g,run,a,depthScale,visual.software);
 let next=true;
 for(const gate of run.gates){
  const y=(run.dist-gate.distance)*depthScale;
  if(y>168||y<-drillDepth||gate.cleared&&kind!=='spike')continue;
  if(kind==='saw')sawGate(g,gate,y,run,a,next,pace.opening,sprites.saw);
  if(kind==='endurance')laneGate(g,gate,y,a,next,sprites.portals,run.inverted);
  if(kind==='spike')forgeGate(g,gate,y,run,a,next,pace,sprites.spike,strike,clock,reduce);
  if(!gate.cleared)next=false;
 }
 bar(g,0,1,0,475,2,1,run.failed?HURT:a.rail);
 const bob=reduce?0:Math.sin(time*12)*2;
 const skin=run.failed?HURT:sprites.cubeColor||'#65f6e1';
 if(kind==='saw'){
  const spin=reduce?0:run.dist*.039;
  const z=34+bob;
  g.ring(x,0,z,sawRadius*.68,7,13,skin,{pitch:Math.PI/2,roll:spin,segments:20});
  if(sprites.saw)sprite(g,sprites.saw,x,8,z,sawRadius*2,sawRadius*2,spin,run.failed?HURT:'#e6fbff');
  else g.ring(x,8,z,sawRadius,12,6,skin,{pitch:Math.PI/2,roll:spin,segments:20,teeth:true});
  g.ring(x,11,z,sawRadius*.49,0,3,'#121b30',{pitch:Math.PI/2,segments:20,light:1});
  g.ring(x,13,z,sawRadius*.49,sawRadius*.40,2,skin,{pitch:Math.PI/2,segments:20,light:1});
  if(actor)actor.place(x,15,z,0,.42);
  else sprite(g,sprites.portrait,x,15,z,sawRadius*.62,sawRadius*.62,0,run.failed?HURT:'#ffffff');
 }else{
  const lean=reduce?0:Math.max(-.28,Math.min(.28,run.v/700)),lift=run.lift||0;
  const z=21+bob+lift*gravityRise,flip=lift*Math.PI-lean;
  if(actor)actor.place(x,0,z,flip,1);
  else if(sprites.portrait)sprite(g,sprites.portrait,x,3,z,44,44,-flip,run.failed?HURT:'#ffffff');
  else playerCube(g,x,z,flip,skin);
  if(kind==='spike')paintForgeHammer(g,run,depthScale,strike,clock,reduce);
 }
 if(!reduce&&!run.failed)for(let i=0;i<10;i++){
  const y=(time*speed*.29+i*79)%200+8,dx=Math.sin(i*3.55+time*4)*19;
  const sz=2.6*(1-y/250);
  bar(g,x+dx,y,5+i%5,sz,10+sz,sz,skin);
 }
 return a.bg;
}
