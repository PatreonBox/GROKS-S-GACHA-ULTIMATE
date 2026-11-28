import {waveAngle,waveRise} from './remix-wave.js';

export const breakwaterMode='breakwater';
export const breakwaterColor='#70f2d2';
export const breakwaterRadius=11;
const ceiling=33,floor=407,height=440;
const crest=[[0,0],[.19,.37],[.24,.61],[.33,.52],[.54,1],[.72,.63],[.80,.73],[.86,.34],[1,0]];
const fold=[[0,0],[.19,.46],[.12,.66],[.35,.92],[.56,1],[.68,.76],[.57,.52],[.83,.44],[1,0]];
const shelf=[[0,0],[.13,.38],[.31,.38],[.31,.63],[.48,.63],[.63,1],[.73,.91],[.88,.49],[1,0]];

function bank(x,width,depth,points,upper=false){
 const edge=upper?ceiling:floor;
 return {kind:upper?'ceiling':'floor',left:x,right:x+width,
  top:upper?edge:edge-depth,bottom:upper?edge+depth:edge,
  points:points.map(([u,v])=>[x+width*u,edge+(upper?depth:-depth)*v])};
}
function saw(x,y,radius,travel,halfCycle,phase=0){
 return {kind:'saw',x,y,radius,travel,halfCycle,phase,left:x-radius,right:x+radius,
  top:y-travel-radius,bottom:y+travel+radius};
}

// An original layout in world coordinates. The same outlines drive rendering and collision.
export const breakwaterCourse={
 mode:'wave',speed:840,height,ceiling,floor,end:12320,gates:[],
 tunnel:[{x:0,top:ceiling,bottom:floor},{x:12320,top:ceiling,bottom:floor}],
 hazards:[
  bank(550,350,142,crest),
  bank(1000,390,151,fold,true),saw(1290,335,23,32,.55),
  bank(1510,345,195,shelf),
  bank(1990,415,183,crest,true),saw(2255,321,25,31,.61,.6),
  bank(2550,455,209,fold),
  bank(3060,440,180,shelf,true),saw(3340,316,28,24,.49,.5),
  bank(3640,460,166,crest),saw(3870,130,25,24,.57),
  bank(4260,460,217,fold,true),
  bank(4740,460,172,shelf),saw(4910,124,31,36,.62,.2),
  bank(5310,410,170,crest,true),saw(5620,331,23,45,.63,.8),
  bank(5810,540,212,fold),
  bank(6380,430,195,shelf,true),saw(6730,342,28,34,.44),
  bank(6960,505,185,crest),saw(7130,143,31,24,.62,.7),
  bank(7525,465,212,fold,true),
  bank(8110,470,178,shelf),saw(8370,137,27,31,.52,.4),
  bank(8700,465,202,crest,true),saw(8950,342,29,33,.59),
  bank(9280,525,204,fold),
  bank(9840,420,196,shelf,true),saw(10140,328,30,24,.50,1),
  bank(10390,495,211,crest),saw(10710,127,29,40,.57,.4),
  bank(10940,540,220,fold,true),
  bank(11550,430,202,shelf),saw(11700,124,24,24,.50,.8)
 ].sort((a,b)=>a.left-b.left)
};

const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(maximum,value));
function sweepDisk(x,y,dx,dy,radius){
 const gap=x*x+y*y-radius*radius;
 if(gap<=0)return 0;
 const approach=x*dx+y*dy;
 if(approach>=0)return Infinity;
 const speed2=dx*dx+dy*dy, discriminant=approach*approach-speed2*gap;
 if(discriminant<0)return Infinity;
 const time=gap/(-approach+Math.sqrt(discriminant));
 return time<=1?time:Infinity;
}

// Crossing an edge strip or either rounded end gives first contact even across a thin polygon.
export function sweepBreakwaterPolygon(points,x,y,dx,dy,radius){
 let earliest=Infinity,inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [ax,ay]=points[j],[bx,by]=points[i];
  const ex=bx-ax,ey=by-ay,length=Math.hypot(ex,ey),px=x-ax,py=y-ay;
  earliest=Math.min(earliest,sweepDisk(px,py,dx,dy,radius));
  if(!length)continue;
  if((ay>y)!==(by>y)&&x<ax+ex*py/ey)inside=!inside;
  const ux=ex/length,uy=ey/length;
  const normal=ux*py-uy*px,along=ux*px+uy*py;
  if(Math.abs(normal)<=radius){
   if(along>=0&&along<=length)return 0;
   continue;
  }
  const change=ux*dy-uy*dx;
  if(!change)continue;
  const t=(Math.sign(normal)*radius-normal)/change;
  const contact=along+(ux*dx+uy*dy)*t;
  if(t>=0&&t<=1&&contact>=0&&contact<=length)earliest=Math.min(earliest,t);
 }
 return inside?0:earliest;
}

export function breakwaterSawY(saw,time){
 const phase=(time/saw.halfCycle+saw.phase)%2;
 return saw.y+saw.travel*(1-2*Math.abs(phase-1));
}
function sweepSaw(saw,x,y,dx,dy,radius,time,dt){
 // The saw slides linearly between reversals. Sweep in its moving reference frame.
 let first=0;
 let turn=(Math.floor(time/saw.halfCycle+saw.phase+1e-9)+1-saw.phase)*saw.halfCycle;
 while(first<1){
  const end=clamp((turn-time)/dt,first,1), span=end-first;
  const startY=breakwaterSawY(saw,time+dt*first),endY=breakwaterSawY(saw,time+dt*end);
  const hit=sweepDisk(x+dx*first-saw.x,y+dy*first-startY,dx*span,dy*span-(endY-startY),radius+saw.radius);
  if(Number.isFinite(hit))return first+span*hit;
  first=end;turn+=saw.halfCycle;
 }
 return Infinity;
}

export function stepBreakwaterWave(state,dt,course=breakwaterCourse){
 if(state.contact)return 'crash';
 const {x,y,time,held}=state,r=breakwaterRadius;
 if(x>=course.end)return 'clear';
 const dx=Math.min(course.end-x,course.speed*dt),dy=waveRise(dx,held),duration=dx/course.speed;
 const boundary=held?course.ceiling+r:course.floor-r;
 let contact=(boundary-y)/dy;
 if(contact<0)contact=0;
 if(contact>1)contact=Infinity;
 let kind=held?'ceiling':'floor';
 for(const hazard of course.hazards){
  if(hazard.left>x+dx+r)break;
  if(hazard.right<x-r||hazard.top>Math.max(y,y+dy)+r||hazard.bottom<Math.min(y,y+dy)-r)continue;
  const hit=hazard.kind==='saw'?sweepSaw(hazard,x,y,dx,dy,r,time,duration):
   sweepBreakwaterPolygon(hazard.points,x,y,dx,dy,r);
  if(hit<contact){
   contact=hit;kind=hazard.kind==='saw'?'saw':'ramp';
  }
 }
 const travel=Math.min(1,contact);
 state.time+=duration*travel;
 state.x=x+dx*travel;
 state.y=y+dy*travel;
 state.vy=waveRise(course.speed,held);
 state.angle=waveAngle(held,false);
 if(contact<=1){
  state.contact=kind;
  return 'crash';
 }
 return state.x>=course.end?'clear':'running';
}
