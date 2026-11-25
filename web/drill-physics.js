export const drillLanes=[-152,0,152];
export const drillDepth=2250;
export const drillStep=1/120;
export const sawRadius=32;
export const sawTrackEdge=235;
export const sawMinHalfGap=sawRadius+25;
export const gravityPortals=['yellow','green','blue'];
export const portalSlot=(gate,lane)=>(gate.index+lane-1)%gravityPortals.length;
const spawns={spike:335,saw:390,endurance:365};
const limit=(value,low,high)=>Math.min(high,Math.max(low,value));
const slowTime=elapsed=>Math.min(elapsed,105);

export function drillPace(kind,elapsed){
 const seconds=slowTime(elapsed);
 return {
  speed:spawns[kind]+elapsed*4.3,
  interval:(kind==='spike'?1.70:1.53)-seconds*(kind==='spike'?.0058:.0068),
  opening:kind==='saw'?Math.max(sawMinHalfGap,126-elapsed*.68):kind==='spike'?.142-seconds*.00087:69-seconds*.24,
  strike:.55-seconds*.0024
 };
}
export function sawPassage(gate,opening){
 return [Math.max(-sawTrackEdge,gate.x-opening),Math.min(sawTrackEdge,gate.x+opening)];
}
// Reframe distant gates once the run outgrows the default two-second sightline.
export const drillViewScale=speed=>Math.min(1,drillDepth/(speed*2.4));

function nextGate(run,distance){
 const {kind,random,serial,gates}=run,previous=gates.at(-1);
 if(kind==='spike')return {index:serial,distance,charge:.29+random()*.49,cleared:false};
 if(kind==='saw'){
  const a=previous?.x||0;
  const options=[-163,-106,-48,32,99,162].filter(x=>Math.abs(x-a)>43&&Math.abs(x-a)<218);
  return {index:serial,distance,x:options[Math.floor(random()*options.length)],cleared:false};
 }
 const last=previous?.lanes.at(-1)??1;
 const step=1+Math.floor(random()*2),main=(last+step)%3;
 const options=serial<4||serial%6===4?[main,(main+1+Math.floor(random()*2))%3]:[main];
 return {index:serial,distance,lanes:options,cleared:false};
}
export function makeDrill(kind,random=Math.random){
 const run={kind,random,dist:0,time:0,x:0,aim:0,v:0,lane:1,score:0,perfect:0,charge:0,
  hammer:0,hammerV:0,held:false,pressed:false,failed:false,event:null,lastGate:null,serial:1,gates:[],inverted:false,lift:0};
 run.gates.push(nextGate(run,spawns[kind]*2.15));
 fillCourse(run);
 return run;
}
function fillCourse(run){
 const {speed,interval}=drillPace(run.kind,run.time);
 const horizon=run.dist+drillDepth/drillViewScale(speed);
 while(run.gates.at(-1).distance<horizon){
  const last=run.gates.at(-1);
  run.serial++;
  run.gates.push(nextGate(run,last.distance+speed*interval*(.92+.16*run.random())));
 }
}
export function activeDrillGate(run){
 return run.gates.find(g=>!g.cleared)||run.lastGate;
}
export function setDrillLane(run,lane){
 run.lane=limit(lane,0,2);run.aim=drillLanes[run.lane];
}
export function directDrillLane(run,lane){setDrillLane(run,run.inverted?2-lane:lane)}
export function shiftDrillLane(run,direction){setDrillLane(run,run.lane+(run.inverted?-direction:direction))}
export function steerDrill(run,goal){run.aim=limit(goal,-(sawTrackEdge-sawRadius),sawTrackEdge-sawRadius)}
export function pressForge(run){
 if(run.held||run.failed)return;
 run.held=true;
}
export function releaseForge(run){
 if(!run.held)return;
 run.held=false;run.pressed=true;
}
function resolve(run,gate,margin){
 const quality=margin<0?'miss':margin>=.57?'perfect':'hit';
 run.event={quality,gate};
 if(quality==='miss'){run.failed=true;return}
 gate.cleared=true;gate.clearedAt=run.time;gate.quality=quality;
 run.score++;
 if(quality==='perfect')run.perfect++;
 run.lastGate=gate;
}
function stepForge(run,gate,dt,pace){
 if(run.held)run.charge=Math.min(1,run.charge+dt*(1.48+slowTime(run.time)*.0055));
 if(run.pressed){
  run.pressed=false;
  const charge=run.charge;run.charge=0;run.hammer=1;run.hammerV=-2;
  const approach=(gate.distance-run.dist)/pace.speed;
  const precision=1-Math.abs(charge-gate.charge)/pace.opening;
  resolve(run,gate,approach<=pace.strike&&approach>=-.01?precision:-1);
 }
 run.hammerV+=(-95*run.hammer-13*run.hammerV)*dt;
 run.hammer+=run.hammerV*dt;
}
export function stepDrill(run,dt,axis=0){
 run.event=null;
 if(run.failed)return;
 const pace=drillPace(run.kind,run.time),gate=activeDrillGate(run);
 run.time+=dt;
 const at=run.dist+pace.speed*dt;
 if(run.kind==='spike')stepForge(run,gate,dt,pace);
 else{
  if(axis&&run.kind==='saw')steerDrill(run,run.aim+axis*dt*540);
  run.v+=((run.aim-run.x)*(run.kind==='saw'?112:181)-run.v*(run.kind==='saw'?16:23))*dt;
  run.x+=run.v*dt;
  if(run.kind==='endurance')run.lift+=(Number(run.inverted)-run.lift)*Math.min(1,dt*7);
 }
 if(!run.failed&&!gate.cleared&&at>=gate.distance){
  let margin=-1;
  if(run.kind==='saw'){
   const [left,right]=sawPassage(gate,pace.opening);
   margin=(Math.min(run.x-left,right-run.x)-sawRadius)/((right-left)/2-sawRadius);
  }
  if(run.kind==='endurance'){
   const lane=gate.lanes.reduce((best,next)=>Math.abs(run.x-drillLanes[next])<Math.abs(run.x-drillLanes[best])?next:best);
   margin=1-Math.abs(run.x-drillLanes[lane])/pace.opening;
   resolve(run,gate,margin);
   if(gate.cleared){
    const portal=gravityPortals[portalSlot(gate,lane)];
    run.event.portal=portal;gate.portal=portal;
    run.inverted=portal==='green'?!run.inverted:portal==='yellow';
   }
  }else resolve(run,gate,margin);
 }
 if(run.failed)return;
 run.dist=at;
 if(run.gates[0].distance<run.dist-230/drillViewScale(pace.speed))run.gates.shift();
 fillCourse(run);
}
