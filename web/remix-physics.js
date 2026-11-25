export const VIEW_WIDTH=900,VIEW_HEIGHT=300,CEILING=22,FLOOR=246,STEP=1/180;
const GRAVITY=1480,JUMP=510,CUBE_RADIUS=9;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

function segment(nodes,x){
 let i=1;
 while(i<nodes.length-1&&x>nodes[i].x)i++;
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
function tunnelCourse(r){
 const wave=r.mode==='wave',speed=wave?303:266,spacing=wave?264:286;
 const nodes=[{x:0,top:CEILING,bottom:FLOOR},{x:166,top:34,bottom:233}];
 const gates=r.pattern.map((value,i)=>({x:405+i*spacing,value}));
 for(const [i,g] of gates.entries()){
  const c=44+g.value*163,half=(wave?38:49)+(i%3===0?3:0)-(r.mark==='MINI'&&i>=4?8:0);
  const before=clamp(c+(i%2===0?-19:18),74,201),after=clamp(c+(i%2===0?19:-18),74,201);
  nodes.push({x:g.x-83,top:before-half-17,bottom:before+half+17},
   {x:g.x,top:c-half,bottom:c+half},
   {x:g.x+81,top:after-half-13,bottom:after+half+13});
 }
 for(const node of nodes){node.top=Math.max(CEILING,node.top);node.bottom=Math.min(FLOOR,node.bottom)}
 const end=gates.at(-1).x+222;
 nodes.push({x:end,top:CEILING,bottom:FLOOR},{x:end+VIEW_WIDTH,top:CEILING,bottom:FLOOR});
 const hazards=[];
 for(let i=1;i<nodes.length;i++){
  const a=nodes[i-1],b=nodes[i];
  hazards.push(shape([[a.x,0],[b.x,0],[b.x,b.top],[a.x,a.top]],'roof'),
   shape([[a.x,a.bottom],[b.x,b.bottom],[b.x,VIEW_HEIGHT],[a.x,VIEW_HEIGHT]],'bank'));
 }
 return {mode:r.mode,gates,end,speed,hazards,tunnel:nodes,orbs:[],gaps:[],miniAt:r.mark==='MINI'?gates[4].x-122:null};
}
function cubeCourse(r){
 const easy=r.mark==='8 BIT',speed=easy?245:r.mark==='BLINK'?303:280,spacing=easy?292:316;
 const gates=r.pattern.map((value,i)=>({x:428+i*spacing,value}));
 const end=gates.at(-1).x+218;
 const course={mode:'cube',gates,end,speed,gaps:[],hazards:[],orbs:[],floor:[{x:0,y:FLOOR}]};
 for(const [i,g] of gates.entries()){
  const raised=18+(i%3)*5;
  if(i%2===1)course.floor.push(
   {x:g.x-122,y:FLOOR},{x:g.x-63,y:FLOOR-raised},
   {x:g.x+78,y:FLOOR-raised},{x:g.x+150,y:FLOOR});
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

export function makeCourse(remix){
 if(remix.mark==='99%')return funkCourse();
 return remix.mode==='cube'?cubeCourse(remix):tunnelCourse(remix);
}
export function newAttempt(course,position=0){
 const y=course?.mode==='cube'||!course?(course?groundAt(course,position)||FLOOR:FLOOR)-CUBE_RADIUS:
  (tunnelAt(course,position).top+tunnelAt(course,position).bottom)/2;
 return {x:position,y,vy:0,ground:true,angle:0,passed:course?.gates.filter(g=>g.x<position).length||0,
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
   s.y=floor-CUBE_RADIUS;s.vy=0;s.ground=true;s.angle=Math.round(s.angle/(Math.PI/2))*Math.PI/2;
  }else{s.ground=false;s.angle+=s.vy<0?dt*6.9:dt*5.4}
  s.radius=CUBE_RADIUS;
 }else{
  if(course.mode==='wave')s.vy=(s.held?-1:1)*course.speed*(s.mini?1.19:1);
  else s.vy=clamp(s.vy+(s.held?-920:730)*dt,-225,235);
  s.y+=s.vy*dt;s.angle=Math.atan2(s.vy,course.speed);
  s.radius=s.mini?4.3:course.mode==='wave'?6:7.5;
 }
 s.queued=Math.max(0,s.queued-dt);
 if(s.y<-s.radius||s.y>VIEW_HEIGHT+14)return 'crash';
 const middleX=(beforeX+s.x)/2,middleY=(beforeY+s.y)/2,r=s.radius;
 for(const hit of course.hazards){
  if(hit.minX>s.x+r||hit.maxX<beforeX-r)continue;
  if(circleTouches(hit,s.x,s.y,r)||circleTouches(hit,middleX,middleY,r))return 'crash';
 }
 while(course.gates[s.passed]&&s.x>course.gates[s.passed].x+29)s.passed++;
 if(s.x>=course.end&&course.finale&&s.orbs.size<course.orbs.length)return 'crash';
 return s.x>=course.end?'clear':'running';
}
