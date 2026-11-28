import {waveRise,waveVerticalOffsets} from './remix-wave.js';
import {newTidalCube,newTidalContactCube,stepLegacyTidalCube,stepTidalOverlayCube,stepTidalContactCube,tidalOrbSequence,tidalOverlayCubeEnd,tidalPortalContactAt} from './tidal-cube-intro.js';
import {shoreFps,firstShoreFrame,shoreInsets} from './tidal-shore-samples.js';

export {shoreFps as tidalVideoFps};
export const tidalVideoId=86407629;
export const tidalStep=1/120;
export const tidalLength=27.067;
export const tidalStart=tidalPortalContactAt;
export const tidalWidth=800,tidalHeight=500,tidalX=304;
export const tidalWaveCeiling=40,tidalWaveFloor=422; // Fixed boundaries used by older replays.
export const tidalVideoMode='video-shoreline';
export const tidalVideoVersion=7;
const legacyWaveStart=3.67,speedBoostAt=4.60,flightInsetDuration=.30;
const waveOffsets=[false,true].map(mini=>[false,true].map(held=>waveVerticalOffsets(held,mini)));
export const tidalPortals=[
 [14.08,true],[15.07,false],[16.43,true],[17.36,false],
 [18.84,true],[19.25,false],[21.44,true],[22.35,false],[23.52,true],[24.64,false]
];

// Measured by tracking horizontal movement across six bands of the shipped recording.
export function tidalScrollSpeed(time,version=tidalVideoVersion){
 if(time<(version>=6?tidalStart:legacyWaveStart))return 0;
 return time<speedBoostAt?392:902;
}

export function newTidalWave(version=tidalVideoVersion){
 return {version,tick:0,distance:0,y:tidalHeight/2,mini:false,held:false,pressed:false,portal:0,
  form:version===2?'wave':'cube',cube:version===2?null:version>=6?newTidalContactCube():newTidalCube(),crashReason:null};
}
export function tidalInput(run,kind,value){
 if(kind!=='held'||typeof value!=='boolean')throw Error('Invalid Tidal Wave controls.');
 if(value&&!run.held)run.pressed=true;
 run.held=value;
}

// The recording and collision coordinates share one playfield and one media clock.
// Interpolate the two shoreline samples bracketing a physics tick.
export function tidalShoreY(tick,upper){
 const last=shoreInsets.length/2-1;
 const sample=Math.max(0,Math.min(last,tick*tidalStep*shoreFps-firstShoreFrame));
 const frame=Math.floor(sample),side=upper?0:1;
 const start=shoreInsets[frame*2+side],end=shoreInsets[Math.min(last,frame+1)*2+side];
 const depth=start+(end-start)*(sample-frame);
 return upper?depth:tidalHeight-depth;
}

function firstContact(previousGap,nextGap){
 if(nextGap>0||nextGap>previousGap)return Infinity;
 return previousGap>0?previousGap/(previousGap-nextGap):0;
}

function hitShore(run,beforeY,stride){
 // The forward tip is solid. Decorative rear fins can rotate when the player
 // presses or releases without expanding the hitbox on the very same tick.
 const reach=waveOffsets[Number(run.mini)][0][1];
 const from=run.tick-1,to=run.tick;
 const ceiling=firstContact(beforeY-reach-tidalShoreY(from,true),run.y-reach-tidalShoreY(to,true));
 const floor=firstContact(tidalShoreY(from,false)-beforeY-reach,tidalShoreY(to,false)-run.y-reach);
 const fraction=Math.min(ceiling,floor);
 if(!Number.isFinite(fraction))return false;
 run.y=beforeY+(run.y-beforeY)*fraction;
 run.distance-=stride*(1-fraction);
 run.impactTime=(from+fraction)*tidalStep;
 run.crashReason=ceiling<=floor?'ceiling':'floor';
 return true;
}

export function stepTidalWave(run){
 const time=++run.tick*tidalStep;
 const pressed=run.pressed;
 run.pressed=false;
 const legacy=run.version===2||run.version===4;
 if(run.version>=6&&run.form!=='wave'){
  const contact=stepTidalContactCube(run.cube,tidalStep,pressed,tidalHeight);
  if(contact==='crash'){
   run.crashReason=run.cube.crashReason;
   return 'crash';
  }
  if(contact){
   run.form=contact;
   if(contact==='wave')run.y=run.cube.y;
  }
  return null;
 }
 if(run.form==='cube'){
  const result=legacy?stepLegacyTidalCube(run.cube,time,tidalStep,pressed):
   stepTidalOverlayCube(run.cube,time,tidalStep,pressed,tidalHeight);
  if(result==='crash'){
   run.crashReason=run.cube.crashReason;
   return 'crash';
  }
  if(time>=tidalOverlayCubeEnd&&(legacy||run.cube.nextOrb===tidalOrbSequence.length))run.form='transition';
  return null;
 }
 if(run.form==='transition'){
  if(time<legacyWaveStart)return null;
  run.form='wave';
 }
 const portal=tidalPortals[run.portal];
 if(portal&&time>=portal[0]){
  run.mini=portal[1];
  run.portal++;
 }
 const speed=tidalScrollSpeed(time,run.version);
 if(speed){
  const stride=speed*tidalStep;
  const beforeY=run.y;
  run.distance+=stride;
  run.y+=waveRise(stride,run.held,run.mini);
  if(run.version>=7){
   if(hitShore(run,beforeY,stride))return 'crash';
  }else if(legacy){
   const radius=run.mini?11:17;
   if(run.y-radius<0||run.y+radius>tidalHeight){
    run.crashReason='edge';
    return 'crash';
   }
  }else{
   const [top,bottom]=waveOffsets[Number(run.mini)][Number(run.held)];
   const inset=Math.min(1,Math.max(0,1+(time-speedBoostAt)/flightInsetDuration));
   const minY=tidalWaveCeiling*inset-top;
   const maxY=tidalHeight-(tidalHeight-tidalWaveFloor)*inset-bottom;
   if(run.y<=minY||run.y>=maxY){
    const up=run.y<=minY;
    const boundary=up?minY:maxY;
    if(run.version===6){
     const travel=Math.max(0,Math.min(1,(boundary-beforeY)/(run.y-beforeY)));
     run.distance-=stride*(1-travel);
    }
    run.y=boundary;
    run.crashReason=up?'ceiling':'floor';
    return 'crash';
   }
  }
 }
 return time>=tidalLength?'clear':null;
}
