export const VIEW_WIDTH=900,VIEW_HEIGHT=300,CEILING=22,FLOOR=246,STEP=1/180;
export const endlessDuration=300;
const GRAVITY=1480,JUMP=510,CUBE_RADIUS=9;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

function segment(nodes,x){
 let i=1,endIndex=nodes.length-1;
 while(i<endIndex){
  const mid=(i+endIndex)>>>1;
  if(x>nodes[mid].x)i=mid+1;else endIndex=mid;
 }
 const start=nodes[i-1],end=nodes[i],t=clamp((x-start.x)/(end.x-start.x),0,1);
 return [start,end,t];
}
const mix=(x,y,t)=>x+(y-x)*t;

export function groundAt(course,x){
 if(course.gaps.some(([a,b])=>x>=a&&x<b))return null;
 const [a,b,t]=segment(course.floor,x);
 return mix(a.y,b.y,t);
}
export function tunnelAt(course,x){
 const [a,b,t]=segment(course.tunnel,x);
 return {top:mix(a.top,b.top,t),bottom:mix(a.bottom,b.bottom,t)};
}
function shape(points,kind){
 const xx=points.map(p=>p[0]),yy=points.map(p=>p[1]);
 return {points,kind,minX:Math.min(...xx),maxX:Math.max(...xx),minY:Math.min(...yy),maxY:Math.max(...yy)};
}
function spike(x,base,height,width=26,down=false){
 return shape([[x-width/2,base],[x,base+(down?height:-height)],[x+width/2,base]],down?'ceiling':'spike');
}
function tunnelWalls(nodes){
 const hazards=[];
 for(let i=1;i<nodes.length;i++){
  const a=nodes[i-1],b=nodes[i];
  hazards.push(shape([[a.x,0],[b.x,0],[b.x,b.top],[a.x,a.top]],'roof'),
   shape([[a.x,a.bottom],[b.x,b.bottom],[b.x,VIEW_HEIGHT],[a.x,VIEW_HEIGHT]],'bank'));
 }
 return hazards;
}
function tunnelCourse(r,legacy){
 const wave=r.mode==='wave',speed=wave?303:266,spacing=wave?264:286;
 const nodes=[{x:0,top:CEILING,bottom:FLOOR},{x:166,top:34,bottom:233}];
 const gates=r.pattern.map((value,i)=>({x:405+i*spacing,value}));
 for(const [i,g] of gates.entries()){
  const c=44+g.value*163,half=(wave?38:49)+(i%3===0?3:0)-(r.mark==='MINI'&&i>=4?8:0);
  const before=clamp(c+(i%2===0?-19:18),74,201),after=clamp(c+(i%2===0?19:-18),74,201);
  if(legacy)nodes.push({x:g.x-83,top:before-half-17,bottom:before+half+17},
   {x:g.x,top:c-half,bottom:c+half},{x:g.x+81,top:after-half-13,bottom:after+half+13});
  else{
   const rise=wave?28:18,turn=i%2===0?1:-1;
   nodes.push({x:g.x-104,top:before-half-15,bottom:before+half+15},
    {x:g.x-45,top:c-turn*rise-half-5,bottom:c-turn*rise+half+5},
    {x:g.x+8,top:c-half,bottom:c+half},
    {x:g.x+53,top:c+turn*rise-half-3,bottom:c+turn*rise+half+3},
    {x:g.x+105,top:after-half-13,bottom:after+half+13});
  }
 }
 for(const node of nodes){node.top=Math.max(CEILING,node.top);node.bottom=Math.min(FLOOR,node.bottom)}
 const end=gates.at(-1).x+222;
 nodes.push({x:end,top:CEILING,bottom:FLOOR},{x:end+VIEW_WIDTH,top:CEILING,bottom:FLOOR});
 return {mode:r.mode,gates,end,speed,hazards:tunnelWalls(nodes),tunnel:nodes,orbs:[],gaps:[],miniAt:r.mark==='MINI'?gates[4].x-122:null};
}
function cubeCourse(r,legacy){
 const easy=r.mark==='8 BIT',speed=easy?245:r.mark==='BLINK'?303:280,spacing=easy?292:316;
 const gates=r.pattern.map((value,i)=>({x:428+i*spacing,value}));
 const end=gates.at(-1).x+218;
 const course={mode:'cube',gates,end,speed,gaps:[],hazards:[],orbs:[],floor:[{x:0,y:FLOOR}]};
 for(const [i,g] of gates.entries()){
  const raised=18+(i%3)*(legacy?5:8);
  if(i%2===1)course.floor.push(
   {x:g.x-122,y:FLOOR},{x:g.x-(legacy?63:122-raised),y:FLOOR-raised},
   {x:g.x+78,y:FLOOR-raised},{x:g.x+(legacy?150:78+raised),y:FLOOR});
 }
 course.floor.push({x:end+VIEW_WIDTH,y:FLOOR});
 for(const [i,g] of gates.entries()){
  for(let j=0;j<g.value;j++){
   const x=g.x+j*27,height=(easy?23:28)+(i%3===2?7:0);
   course.hazards.push(spike(x,groundAt(course,x),height));
  }
  if(!easy&&i%3===1)course.hazards.push(spike(g.x+110,CEILING,38,36,true));
 }
 return course;
}

function funkCourse(){
 const end=3200,speed=316,finale=2697,orbPower=315;
 // Original rhythm chart. The last pink orb sits at 99% of the course.
 const gates=[325,534,795,1065,1285,1553,1805,2123,2408,2630,2875,3038,3168].map(x=>({x,value:1}));
 const floor=[{x:0,y:FLOOR},{x:1170,y:FLOOR},{x:1235,y:226},{x:1360,y:226},{x:1450,y:FLOOR},{x:end+VIEW_WIDTH,y:FLOOR}];
 const course={mode:'cube',gates,end,speed,finale,beat:60/146,orbs:[],gaps:[[2845,3180]],hazards:[],floor};
 for(const [x,h,w] of [[330,30,25],[544,30,25],[572,27,24],[801,34,27],[1072,37,28],[1291,32,25],
  [1560,33,25],[1588,28,25],[1812,40,27],[2122,28,24],[2150,34,23],[2408,42,29],[2435,30,24],[2630,35,25]]){
  course.hazards.push(spike(x,groundAt(course,x),h,w));
 }
 course.hazards.push(spike(2860,FLOOR,52,30),spike(2994,FLOOR,39,38),
  spike(3111,FLOOR,60,32),spike(3191,FLOOR,85,22),spike(3097,CEILING,49,50,true));
 function addOrb(x,y,tight=false){course.orbs.push({x,y,rx:tight?15:21,ry:tight?20:26,power:orbPower,tight})}
 // These centers are aligned to the jump physics and an achievable chain of separate taps.
 const first=2895,second=3038,third=end*.99,start=2807;
 const fall=(y,vy,dist)=>y+vy*(dist/speed)+.5*GRAVITY*(dist/speed)**2;
 const y1=fall(FLOOR-CUBE_RADIUS,-JUMP,first-start),y2=fall(y1,-orbPower,second-first),y3=fall(y2,-orbPower,third-second);
 addOrb(first,y1);addOrb(second,y2);addOrb(third,y3,true);
 return course;
}

function indexCourse(course){
 course.hazards.sort((a,b)=>a.minX-b.minX);
 course.hazardReach=course.hazards.reduce((wide,{minX,maxX})=>Math.max(wide,maxX-minX),0);
 return course;
}
export function* hazardsBetween(course,left,right){
 const hazards=course.hazards;
 let lo=0,hi=hazards.length;
 while(lo<hi){
  const mid=(lo+hi)>>>1;
  if(hazards[mid].minX<left-course.hazardReach)lo=mid+1;else hi=mid;
 }
 for(let i=lo;i<hazards.length&&hazards[i].minX<=right;i++){
  if(hazards[i].maxX>=left)yield hazards[i];
 }
}

export function makeCourse(remix,{legacy=false}={}){
 const course=remix.mark==='99%'?funkCourse():remix.mode==='cube'?cubeCourse(remix,legacy):tunnelCourse(remix,legacy);
 return indexCourse({...course,legacy});
}

export function createEndlessCourse(remix,seed){
 const {mode,tier,pattern}=remix,wave=mode==='wave',cube=mode==='cube';
 const speed=(wave?280:mode==='ship'?240:249)+tier*(wave?4:2.6);
 const firstX=cube?430:405,spacing=cube?329:311;
 const course={mode,speed,end:Infinity,endless:true,firstGate:0,gates:[],hazards:[],orbs:[],gaps:[]};
 let anchor=-Infinity;
 function random(index,salt){
  let h=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(salt,0x85ebca77))>>>0;
  h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);
  return ((h^(h>>>16))>>>0)/4294967296;
 }
 const gate=index=>({index,x:firstX+index*spacing+Math.floor(random(index,1)*42),
  value:pattern[Math.floor(random(index,2)*pattern.length)]});
 const centerAt=g=>clamp(74+g.value*121+(random(g.index,3)-.5)*23,95,188);
 function ensure(position){
  const near=Math.max(0,Math.floor((position-firstX)/spacing));
  if(near>=anchor&&near<anchor+8)return;
  anchor=near;
  const first=Math.max(0,near-7),last=near+17,begin=first?gate(first).x-161:0,tail=gate(last).x+178;
  const gates=Array.from({length:last-first+1},(_,i)=>gate(first+i));
  course.hazards=[];course.firstGate=first;
  if(cube){
   course.floor=[{x:begin,y:FLOOR}];
   for(const g of gates)if(g.index%3===1){
    const h=18+Math.floor(random(g.index,4)*19),x=g.x;
    course.floor.push({x:x-139,y:FLOOR},{x:x-139+h,y:FLOOR-h},{x:x+72,y:FLOOR-h},{x:x+72+h,y:FLOOR});
   }
   course.floor.push({x:tail,y:FLOOR});
   for(const g of gates){
    const {index,x,value}=g,spikes=Math.min(3,value+Number(tier>=7&&x/speed>60&&random(index,5)<.20));
    for(let j=0;j<spikes;j++){
     const position=x+j*27;
     course.hazards.push(spike(position,groundAt(course,position),23+tier*.68+Math.floor(random(index,6+j)*6),25));
    }
   }
   course.gates=gates;
  }else{
   let center=first?centerAt(gate(first-1)):(CEILING+FLOOR)/2;
   const nodes=[{x:begin,top:CEILING,bottom:FLOOR}];
   if(!first)nodes.push({x:170,top:35,bottom:232});
   function mouth(x,y,half){nodes.push({x,top:Math.max(CEILING,y-half),bottom:Math.min(FLOOR,y+half)})}
   for(const g of gates){
    const {index,x}=g,pitch=centerAt(g),half=(wave?46:59)-tier*.55-Math.min(10,Math.floor(x/speed/25));
    const lean=(index%2===0?1:-1)*(wave?31:19);
    mouth(x-101,mix(center,pitch,.55),half+21);
    mouth(x-53,pitch-lean,half+7);
    mouth(x+12,pitch,half);
    mouth(x+62,pitch+lean,half+5);
    mouth(x+105,pitch,half+14);
    center=pitch;
   }
   mouth(tail,(CEILING+FLOOR)/2,(FLOOR-CEILING)/2);
   course.gates=gates.map(g=>({...g,x:g.x+12}));
   course.tunnel=nodes;course.hazards=tunnelWalls(nodes);
  }
  indexCourse(course);
 }
 course.ensure=ensure;ensure(0);
 return course;
}
export function newAttempt(course,position=0){
 const y=course?.mode==='cube'||!course?(course?groundAt(course,position)||FLOOR:FLOOR)-CUBE_RADIUS:
  (tunnelAt(course,position).top+tunnelAt(course,position).bottom)/2;
 return {x:position,y,vy:0,ground:true,angle:0,groundAngle:0,passed:course?.gates.filter(g=>g.x<position).length||0,
  trace:[],held:false,queued:0,time:0,orbs:new Set(),event:null,mini:false,radius:CUBE_RADIUS};
}

export function pressRunner(state){
 state.held=true;state.queued=.089;
}
function circleTouches(poly,x,y,r){
 if(x+r<poly.minX||x-r>poly.maxX||y+r<poly.minY||y-r>poly.maxY)return false;
 let inside=false;
 const points=poly.points,rr=r*r;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [ax,ay]=points[j],[bx,by]=points[i],dx=bx-ax,dy=by-ay;
  if((ay>y)!==(by>y)&&x<ax+dx*(y-ay)/dy)inside=!inside;
  const t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);
  if((x-ax-dx*t)**2+(y-ay-dy*t)**2<rr)return true;
 }
 return inside;
}
export function advanceRunner(s,course,remix,dt){
 const beforeX=s.x,beforeY=s.y;
 s.time+=dt;s.x+=course.speed*dt;s.event=null;
 course.ensure?.(s.x);
 if(course.miniAt&&s.x>=course.miniAt&&!s.mini){s.mini=true;s.event='mini'}
 if(course.mode==='cube'){
  const candidate=course.orbs.findIndex((orb,i)=>!s.orbs.has(i)&&!s.ground&&
   Math.abs(s.x-orb.x)<=orb.rx&&Math.abs(s.y-orb.y)<=orb.ry);
  if(candidate>=0&&s.queued>0){
   const orb=course.orbs[candidate];s.orbs.add(candidate);s.vy=-orb.power;s.ground=false;
   s.queued=0;s.event='orb';s.lastOrb=orb;
  }else if(s.ground&&(s.queued>0||s.held)){
   s.vy=-JUMP;s.ground=false;s.queued=0;s.event='jump';
  }
  const beforeFloor=groundAt(course,beforeX),floor=groundAt(course,s.x);
  s.vy+=GRAVITY*dt;s.y+=s.vy*dt;
  const supported=floor!==null&&(s.ground||(s.vy>=0&&
   beforeY+CUBE_RADIUS<=(beforeFloor??floor)+3&&s.y+CUBE_RADIUS>=floor));
  if(supported){
   const flat=s.ground?s.groundAngle:Math.round(s.angle/(Math.PI/2))*Math.PI/2;
   const slope=!course.legacy&&beforeFloor!==null?Math.atan2(floor-beforeFloor,s.x-beforeX):0;
   s.y=floor-CUBE_RADIUS;s.vy=0;s.ground=true;s.groundAngle=flat;s.angle=flat+slope;
  }else{s.ground=false;s.angle+=s.vy<0?dt*6.9:dt*5.4}
  s.radius=CUBE_RADIUS;
 }else{
  if(course.mode==='wave')s.vy=(s.held?-1:1)*course.speed*(s.mini?(course.legacy?1.19:1.37):1);
  else s.vy=clamp(s.vy+(s.held?(course.legacy?-920:-890):730)*dt,-225,235);
  s.y+=s.vy*dt;
  const angle=Math.atan2(s.vy,course.speed);
  s.angle=course.mode==='ship'&&!course.legacy?mix(s.angle,angle,1-Math.exp(-dt*14)):angle;
  s.radius=s.mini?4.3:course.mode==='wave'?6:7.5;
 }
 s.queued=Math.max(0,s.queued-dt);
 if(s.y<-s.radius||s.y>VIEW_HEIGHT+14)return 'crash';
 const middleX=(beforeX+s.x)/2,middleY=(beforeY+s.y)/2,r=s.radius;
 for(const hit of hazardsBetween(course,beforeX-r,s.x+r)){
  if(circleTouches(hit,s.x,s.y,r)||circleTouches(hit,middleX,middleY,r))return 'crash';
 }
 const passedGate=()=>course.gates[s.passed-(course.firstGate||0)];
 while(passedGate()&&s.x>passedGate().x+29)s.passed++;
 if(s.x>=course.end&&course.finale&&s.orbs.size<course.orbs.length)return 'crash';
 return s.x>=course.end?'clear':'running';
}
