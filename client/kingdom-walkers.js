import {houseEntry} from '../web/kingdom-rules.js';

const turn=Math.PI*2;
const moveCycle=['walk','trot','roll','vault','skip'];
const destinations=['production','tree','housing','trail','tower','meadow'];
const nightDestinations=['campfire','trail','meadow','campfire','tower','tree'];
const speed={walk:2.7,trot:3.55,roll:3.15,vault:3.2,skip:2.95,tiptoe:1.94,moonHop:2.48};
const arrival={
 production:['inspect','sneeze','spin'],tree:['look','sneeze','pancake','rest'],
 trail:['wave','breakdance','backflip','stretch'],
 tower:['salute','cheer','backflip'],meadow:['rest','pancake','breakdance','spin']
};
const nightArrival={
 campfire:['warmHands','fireDance','shiver'],trail:['stargaze','firefly','nightYawn'],
 meadow:['stargaze','nightYawn','firefly'],tower:['stargaze','shiver'],tree:['firefly','stargaze','shiver']
};
const wave=(t,frequency)=>Math.sin(t*turn*frequency);
const hop=(t,frequency)=>Math.abs(wave(t,frequency));
const pulse=(t,frequency)=>Math.max(0,wave(t,frequency))**3;

// Height, pitch, twist, lean and squash in the cube's local space.
export const kingdomCubeAnimations={
 walk:t=>[.12*hop(t,1.5),.12*wave(t,1.5),0,.10*wave(t,1.5)],
 trot:t=>[.24*hop(t,2),.26*wave(t,2),0,.15*wave(t,1)],
 roll:t=>[.25*hop(t,1.7),t*turn*.85,0,0],
 vault:t=>[.73*hop(t,.78),.79*wave(t*.5,.78),0,.12*wave(t,.78),.94,1.08],
 skip:t=>[.34*pulse(t,1.55)+.08*hop(t,1.55),.22*wave(t,1.55),.11*wave(t,1.15),.31*wave(t,1.55)],
 look:t=>[.03*hop(t,1),-.26*pulse(t,.75),.65*wave(t,.65),.12*wave(t,.75)],
 stretch:t=>[.07*pulse(t,.57),-.18*wave(t,.57),0,.32*wave(t,.66),1-.08*pulse(t,.57),1+.20*pulse(t,.57)],
 rest:t=>[-.11,0,.08*wave(t,.44),.12,1.11,.80+.035*wave(t,.75)],
 inspect:t=>[.10*hop(t,1.08),.28+.20*wave(t,1.08),.37*wave(t,1.35),.16*wave(t,.68)],
 cheer:t=>[.65*pulse(t,1.42),-.30*wave(t,1.42),.21*wave(t,1.42),.33*wave(t,.71),1.04,1.10],
 spin:t=>[.23*hop(t,.72),0,t*turn*.90,.17*wave(t,.90)],
 knock:t=>[.11*pulse(t,2.3),.54*pulse(t,2.3),0,0,1+.08*pulse(t,2.3),1-.13*pulse(t,2.3)],
 peek:t=>[.17*pulse(t,1.1),.14*wave(t,1.1),.48*pulse(t,1.1),-.42*wave(t,.75)],
 enter:t=>[.065*hop(t,1.8),.095*wave(t,1.8),0,.055*wave(t,1.8)],
 wave:t=>[.09*hop(t,1.8),0,.20*wave(t,.9),.46*wave(t,1.8)],
 salute:t=>[.14*pulse(t,1.05),-.39*pulse(t,1.05),.14*wave(t,.62),.18*pulse(t,1.05)],
 sneeze:t=>[.27*pulse(t,1.45),-.69*pulse(t,1.45)+.24*wave(t,1.45),0,.08*wave(t,5),1.10,.91],
 pancake:t=>[-.18*pulse(t,1.08),0,.18*wave(t,.71),.08,1+.36*pulse(t,1.08),1-.40*pulse(t,1.08)],
 breakdance:t=>[.10+.24*hop(t,1.8),.47*wave(t,.8),turn*t*1.22,.68*wave(t,.8),1.03,.96],
 backflip:t=>{const p=Math.min(1,t/.82);return [.76*Math.sin(Math.PI*p),-turn*p,0,.14*Math.sin(Math.PI*p)];},
 wobble:t=>[.06*hop(t,2.7),.22*wave(t,2.9),0,.26*wave(t,3.8),1.05,.94],
 tiptoe:t=>[.075*pulse(t,2.2),.15+.11*wave(t,2.2),0,.15*wave(t,1.1)],
 moonHop:t=>[.38*hop(t,1.05),-.30*wave(t,1.05),.24*wave(t,.53),.24*wave(t,.53)],
 stargaze:t=>[.03*hop(t,.38),-.41-.16*wave(t,.43),.18*wave(t,.31),.06*wave(t,.5)],
 firefly:t=>[.31*pulse(t,1.05),-.29*wave(t,1.05),.52*wave(t,.72),.38*wave(t,.61)],
 warmHands:t=>[.018*hop(t,1.03),.19+.12*wave(t,.83),.08*wave(t,.54),.09*wave(t,.66),1.04,.94],
 fireDance:t=>[.40*pulse(t,1.55),.19*wave(t,1.55),.52*wave(t,.77),.39*wave(t,1.55)],
 shiver:t=>[.035*hop(t,6),.08*wave(t,5),.045*wave(t,7),.09*wave(t,6),1.07,.93],
 nightYawn:t=>[.07*pulse(t,.45),-.44*pulse(t,.45),0,.10*wave(t,.46),1-.08*pulse(t,.45),1+.14*pulse(t,.45)],
 grassSleep:t=>[-.215,0,.03*wave(t,.41),.19,1.10,.61+.055*wave(t,.52)],
 sleepTwitch:t=>[-.215+.06*pulse(t,1.8),.11*pulse(t,1.8),.06*wave(t,1.2),.19+.12*pulse(t,1.8),1.10,.63],
 curl:t=>{const p=Math.min(t/.95,1);return [-.215*p,0,-.13*p,.19*p,1+.10*p,1-.37*p];},
 wakeUp:t=>{const p=Math.min(t/.9,1);return [-.215*(1-p)+.12*Math.sin(p*Math.PI),-.33*Math.sin(p*Math.PI),0,.19*(1-p),1.10-.10*p,.63+.37*p];}
};
const neutral=[0,0,0,0];
export function poseKingdomCube(body,action,time,reduced){
 const pose=kingdomCubeAnimations[action];
 const [height,pitch,twist,lean,width=1,tall=1]=reduced?(action==='grassSleep'||action==='sleepTwitch'?pose(0):neutral):pose(time);
 body.position.y=height;
 body.rotation.set(pitch,twist,lean);
 body.scale.set(width,tall,width);
}

export function createKingdomWalker(model,spawn,seed,scale=1,occupied=new Set(),entrance=null){
 let x=spawn.x,z=spawn.z,heading=0,turnIndex=seed,stepIndex=seed,choiceIndex=seed,seen;
 let route=[],goal,mode='look',time=0,waiting=.2+(seed%6)*.18,visit,heldHome,jammed=0,avoiding=false;
 let skinSeed=seed,sleeping=false,seekingRest=false,asleepAtHome=false,wasNight=false,patrolNext=null,patrolDirection=1;
 const residentId=seed?'visitor:'+(seed-1):'cube';
 let openStep=()=>true;
 const face=target=>{
  const dx=target.x-x,dz=target.z-z;
  return Math.hypot(dx,dz)>.025?Math.atan2(dx,dz):heading;
 };
 function move(point,stride,nav){
  const dx=point.x-x,dz=point.z-z,distance=Math.hypot(dx,dz);
  const fraction=distance<=stride?1:stride/distance;
  const next={x:x+dx*fraction,z:z+dz*fraction};
  avoiding=!openStep(next)||Boolean(nav&&!nav.clear({x,z},next));
  if(!avoiding){
   ({x,z}=next);jammed=0;return fraction===1;
  }
  if(!nav||distance<.001)return false;
  const sideways={x:x+dz*stride*.84/distance,z:z-dx*stride*.84/distance};
  if(nav.clear({x,z},sideways)&&openStep(sideways)){({x,z}=sideways);jammed=0;}
  return false;
 }
 function releaseHome(){
  if(heldHome)occupied.delete(heldHome.id);
  heldHome=null;
 }
 function patrol(nav){
  const trail=nav.trail;
  if(!trail)return null;
  const points=trail.points;
  if(patrolNext===null){
   patrolNext=points.reduce((best,point,i)=>Math.hypot(point.x-x,point.z-z)<Math.hypot(points[best].x-x,points[best].z-z)?i:best,0);
  }
  const start=points[patrolNext],path=nav.route({x,z},start);
  if(!path)return null;
  let length=0,point=start;
  for(let i=0;i<points.length&&length<4;i++){
   let next=patrolNext+patrolDirection;
   if(trail.closed)next=(next+points.length)%points.length;
   else if(next<0||next>=points.length){patrolDirection*=-1;next=patrolNext+patrolDirection;}
   const nextPoint=points[next];
   length+=Math.hypot(nextPoint.x-point.x,nextPoint.z-point.z);
   point=nextPoint;path.points.push(point);patrolNext=next;
  }
  return path;
 }
 function plan(nav,night,tired){
  if(entrance){
   const path=nav.route({x,z},entrance);
   if(path){
    if(path.recovery&&!openStep(path.recovery)){waiting=.31;return;}
    if(path.recovery)({x,z}=path.recovery);
    goal={category:'entrance',target:entrance};route=path.points;mode='trot';time=0;
    return;
   }
   entrance=null;
  }
  const options=tired?['housing','grass']:night?nightDestinations:nav.trail?['trail','trail','trail','housing','trail','production']:destinations;
  const start=tired?0:turnIndex++;
  for(let i=0;i<options.length;i++){
   const category=options[(start+i)%options.length];
   let stops=category==='grass'?nav.targets.meadow:nav.targets[category];
   if(category==='housing'){
    const own=stops.find(target=>target.home.building.resident===residentId);
    stops=own?[own]:stops.filter(target=>!target.home.building.resident);
   }
   if(!stops.length&&!(category==='trail'&&nav.trail))continue;
   let target,path;
   if(category==='housing'){
    for(let slot=0;slot<stops.length;slot++){
     target=stops[(seed+slot)%stops.length];
     if(occupied.has(target.home.id))continue;
     path=nav.homeRoute({x,z},target);
     if(path)break;
    }
   }else if(category==='trail'){
    target={};
    path=patrol(nav);
   }else if(category==='grass'){
    target=stops[(seed+choiceIndex++)%stops.length];
    path=nav.route({x,z},target);
    if(!path&&nav.passable({x,z}))path={points:[{x,z}]};
   }else{
    target=stops[choiceIndex++%stops.length];
    path=nav.route({x,z},target);
   }
   if(!path)continue;
   if(target.home){heldHome=target.home;occupied.add(heldHome.id)}
   if(path.recovery&&!openStep(path.recovery)){releaseHome();continue;}
   if(path.recovery)({x,z}=path.recovery);
   goal={category,target};route=path.points;
   mode=night?(stepIndex++%3?'tiptoe':'moonHop'):moveCycle[stepIndex++%moveCycle.length];time=0;
   return;
  }
  mode='look';waiting=1.3;time=0;
 }
 function arrive(night,tired){
  if(goal.category==='entrance'){
   entrance=null;mode='wave';waiting=1.7;
  }else if(goal.category==='grass'){
   sleeping=true;mode='curl';waiting=0;
  }else if(goal.target.home){
   const home=goal.target.home;
   visit={home,phase:'enter',points:[home.threshold,home.inside]};
   asleepAtHome=tired;
   mode=seed%2?'peek':'knock';waiting=.59;
  }else{
   const cues=(night?nightArrival:arrival)[goal.category]||arrival.meadow;
   mode=cues[choiceIndex++%cues.length];waiting=1.65+.24*(choiceIndex%5);
  }
  time=0;
 }
 function updateVisit(dt,night){
  const {home}=visit;
  if(visit.phase==='rest'&&asleepAtHome&&night)return face(home.threshold);
  if(visit.phase==='rest'&&asleepAtHome){asleepAtHome=false;waiting=.1;}
  if(waiting>0){
   waiting=Math.max(0,waiting-dt);
   if(waiting===0&&visit.phase==='rest'){
    visit.phase='leave';visit.points=[home.threshold,home.approach];
    waiting=.45;mode='rest';time=0;
   }
   return face(home.threshold);
  }
  const point=visit.points[0],angle=face(point);
  if(mode!=='enter'){mode='enter';time=0}
  if(!move(point,dt*1.96))return angle;
  visit.points.shift();
  if(visit.points.length)return angle;
  if(visit.phase==='enter'){
   visit.phase='rest';mode='rest';time=0;
   waiting=(night?13:4)+(seed%4)*.72;
  }else{
   visit=null;releaseHome();goal=null;mode='look';waiting=.34;time=0;
  }
  return angle;
 }
 function update(nav,dt,floor,reduced,hit,night=false,canStep=()=>true,nightAge=Infinity){
  openStep=canStep;avoiding=false;
  if(seen!==nav){
   route=[];goal=null;seen=nav;patrolNext=null;
   if(sleeping&&!nav.passable({x,z})){sleeping=false;seekingRest=false;waiting=0;}
   if(visit&&!nav.targets.housing.some(target=>target.home.id===visit.home.id&&target.home.building.x===visit.home.building.x&&
      (!target.home.building.resident||target.home.building.resident===residentId)&&target.home.building.z===visit.home.building.z&&target.home.building.rotation===visit.home.building.rotation)){
    visit=null;waiting=0;
   }
   if(!visit)releaseHome();
  }
  const tired=night&&skinSeed%5!==1&&nightAge>= (5+skinSeed%19)*1000;
  if(tired&&!seekingRest){
   seekingRest=true;
   if(visit)asleepAtHome=true;
   else{route=[];goal=null;waiting=0;releaseHome();}
  }
  if(!night&&wasNight){
   seekingRest=false;
   if(sleeping){sleeping=false;mode='wakeUp';waiting=1;time=0;}
   if(goal?.category==='grass'){route=[];goal=null;}
  }
  wasNight=night;
  time+=dt;
  let targetAngle=heading;
  if(sleeping){
   if(time>.95){mode=time%12>11?'sleepTwitch':'grassSleep';}
  }else if(visit){
   targetAngle=updateVisit(dt,night);
  }else if(waiting>0){
   waiting=Math.max(0,waiting-dt);
   if(goal?.target.look)targetAngle=face(goal.target.look);
  }else{
   if(!route.length)plan(nav,night,tired);
   const point=route[0];
   if(point){
    targetAngle=face(point);
    if(move(point,dt*speed[mode],nav)){
     route.shift();
     if(!route.length)arrive(night,tired);
    }else if(avoiding&&(jammed+=dt)>1.05){
     route=[];goal=null;releaseHome();jammed=0;mode='wobble';waiting=.23+seed%4*.16;
    }
   }
  }
  const bend=targetAngle-heading;
  heading+=Math.atan2(Math.sin(bend),Math.cos(bend))*Math.min(1,dt*8);
  let height=floor(x,z);
  if(visit){
   const {building,dx,dz}=visit.home,forward=(x-building.x)*dx+(z-building.z)*dz;
   const ramp=Math.max(0,Math.min(1,(1.69-forward)/.53));
   height+=(floor(building.x,building.z)+houseEntry.floor-height)*ramp;
  }
  model.resident.position.set(x,height+.55*scale,z);
  model.resident.rotation.y=heading;
  const hidden=visit?.phase==='rest';
  model.resident.visible=!hidden;hit.userData.inactive=hidden;
  poseKingdomCube(model.body,avoiding&&!visit?'wobble':mode,time,reduced);
  hit.position.copy(model.resident.position);hit.position.y+=model.body.position.y*scale;
  return visit&&!hidden?visit.home.id:null;
 }
 function seatAt(home){
  if(!home)return;
  if(visit?.home===home&&visit.phase==='rest')return;
  releaseHome();heldHome=home;occupied.add(home.id);
  x=home.inside.x;z=home.inside.z;route=[];goal=null;sleeping=false;asleepAtHome=false;
  visit={home,phase:'rest',points:[]};waiting=4;mode='rest';time=0;
 }
 function setSkin(id){skinSeed=Array.from(id||'').reduce((sum,char)=>((sum*31+char.charCodeAt(0))>>>0),seed);}
 return {update,releaseHome,seatAt,setSkin,get insideHouse(){return visit?.phase==='rest'?visit.home.id:null;},get position(){return {x,z,hidden:visit?.phase==='rest',sleeping:sleeping||asleepAtHome&&visit?.phase==='rest'};}};
}
