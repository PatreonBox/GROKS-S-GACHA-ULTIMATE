import {waveRise} from './remix-wave.js';
import {newTidalCube,stepTidalOverlayCube,tidalOverlayCubeEnd} from './tidal-cube-intro.js';

export const tidalVideoId=86407629;
export const tidalStep=1/120;
export const tidalLength=27.067;
export const tidalStart=3.67;
export const tidalWidth=800,tidalHeight=500,tidalX=304;
export const tidalVideoMode='video-overlay';
export const tidalVideoVersion=4;
export const tidalPortals=[
 [14.08,true],[15.07,false],[16.43,true],[17.36,false],
 [18.84,true],[19.25,false],[21.44,true],[22.35,false],[23.52,true],[24.64,false]
];

// Measured by tracking horizontal movement across six bands of the shipped recording.
export function tidalScrollSpeed(time){
 if(time<tidalStart)return 0;
 return time<4.60?392:902;
}

export function newTidalWave(version=tidalVideoVersion){
 return {tick:0,distance:0,y:tidalHeight/2,mini:false,held:false,pressed:false,portal:0,
  form:version===2?'wave':'cube',cube:version===2?null:newTidalCube(),crashReason:null};
}
export function tidalInput(run,kind,value){
 if(kind!=='held'||typeof value!=='boolean')throw Error('Invalid Tidal Wave controls.');
 if(value&&!run.held)run.pressed=true;
 run.held=value;
}
export function stepTidalWave(run){
 const time=++run.tick*tidalStep;
 const pressed=run.pressed;
 run.pressed=false;
 if(run.form==='cube'){
  if(stepTidalOverlayCube(run.cube,time,tidalStep,pressed)==='crash'){
   run.crashReason=run.cube.crashReason;
   return 'crash';
  }
  if(time>=tidalOverlayCubeEnd)run.form='transition';
  return null;
 }
 if(run.form==='transition'){
  if(time<tidalStart)return null;
  run.form='wave';
 }
 const portal=tidalPortals[run.portal];
 if(portal&&time>=portal[0]){
  run.mini=portal[1];
  run.portal++;
 }
 const speed=tidalScrollSpeed(time);
 if(speed){
  const stride=speed*tidalStep;
  run.distance+=stride;
  run.y+=waveRise(stride,run.held,run.mini);
  const radius=run.mini?11:17;
  if(run.y-radius<0||run.y+radius>tidalHeight){
   run.crashReason='edge';
   return 'crash';
  }
 }
 return time>=tidalLength?'clear':null;
}
