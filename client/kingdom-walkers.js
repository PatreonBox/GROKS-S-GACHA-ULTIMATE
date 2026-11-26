import {houseEntry} from '../web/kingdom-rules.js';

const turn=Math.PI*2;
const moveCycle=['walk','trot','roll','vault','skip'];
const destinations=['production','tree','housing','trail','tower','meadow'];
const speed={walk:2.7,trot:3.55,roll:3.15,vault:3.2,skip:2.95};
const arrival={
 production:['inspect','cheer','spin'],tree:['look','stretch','rest'],
 trail:['wave','spin','stretch'],
 tower:['salute','cheer'],meadow:['rest','wave','spin']
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
 salute:t=>[.14*pulse(t,1.05),-.39*pulse(t,1.05),.14*wave(t,.62),.18*pulse(t,1.05)]
};
const neutral=[0,0,0,0];
export function poseKingdomCube(body,action,time,reduced){
 const [height,pitch,twist,lean,width=1,tall=1]=reduced?neutral:kingdomCubeAnimations[action](time);
 body.position.y=height;
 body.rotation.set(pitch,twist,lean);
 body.scale.set(width,tall,width);
}

export function createKingdomWalker(model,spawn,seed,scale=1,occupied=new Set()){
 let x=spawn.x,z=spawn.z,heading=0,turnIndex=seed,stepIndex=seed,choiceIndex=seed,seen;
 let route=[],goal,mode='look',time=0,waiting=.2+(seed%6)*.18,visit,heldHome,seekHome=false,wasNight=false;
 const face=target=>{
  const dx=target.x-x,dz=target.z-z;
  return Math.hypot(dx,dz)>.025?Math.atan2(dx,dz):heading;
 };
 function move(point,stride){
  const distance=Math.hypot(point.x-x,point.z-z);
  if(distance<=stride){({x,z}=point);return true}
  x+=(point.x-x)*stride/distance;z+=(point.z-z)*stride/distance;
  return false;
 }
 function releaseHome(){
  if(heldHome)occupied.delete(heldHome.id);
  heldHome=null;
 }
 function plan(nav){
  for(let i=0;i<destinations.length;i++){
   const category=seekHome?'housing':destinations[turnIndex++%destinations.length];
   seekHome=false;
   const stops=nav.targets[category];
   if(!stops.length)continue;
   let target,path;
   if(category==='housing'){
    for(let slot=0;slot<stops.length;slot++){
     target=stops[(seed+slot)%stops.length];
     if(occupied.has(target.home.id))continue;
     path=nav.homeRoute({x,z},target);
     if(path)break;
    }
   }else{
    target=stops[choiceIndex++%stops.length];
    path=nav.route({x,z},target);
   }
   if(!path)continue;
   if(target.home){heldHome=target.home;occupied.add(heldHome.id)}
   if(path.recovery)({x,z}=path.recovery);
   goal={category,target};route=path.points;
   mode=moveCycle[stepIndex++%moveCycle.length];time=0;
   return;
  }
  mode='look';waiting=1.3;time=0;
 }
 function arrive(){
  if(goal.target.home){
   const home=goal.target.home;
   visit={home,phase:'enter',points:[home.threshold,home.inside]};
   mode=seed%2?'peek':'knock';waiting=.59;
  }else{
   const cues=arrival[goal.category];
   mode=cues[choiceIndex++%cues.length];waiting=1.65+.24*(choiceIndex%5);
  }
  time=0;
 }
 function updateVisit(dt,night){
  const {home}=visit;
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
 function update(nav,dt,floor,reduced,hit,night=false){
  if(seen!==nav){
   route=[];goal=null;seen=nav;
   if(!visit)releaseHome();
  }
  if(night&&!wasNight&&!visit&&!heldHome)seekHome=true;
  wasNight=night;
  time+=dt;
  let targetAngle=heading;
  if(visit){
   targetAngle=updateVisit(dt,night);
  }else if(waiting>0){
   waiting=Math.max(0,waiting-dt);
   if(goal?.target.look)targetAngle=face(goal.target.look);
  }else{
   if(!route.length)plan(nav);
   const point=route[0];
   if(point){
    targetAngle=face(point);
    if(move(point,dt*speed[mode])){
     route.shift();
     if(!route.length)arrive();
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
  poseKingdomCube(model.body,mode,time,reduced);
  hit.position.copy(model.resident.position);hit.position.y+=model.body.position.y*scale;
  return visit&&!hidden?visit.home.id:null;
 }
 return {update,releaseHome};
}
