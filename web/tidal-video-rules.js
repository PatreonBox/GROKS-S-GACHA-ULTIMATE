import {waveRise} from './remix-wave.js';
import {newTidalCube,stepTidalCube,tidalCubeEnd} from './tidal-cube-intro.js';
import {hitsTidalHazard} from './tidal-video-hazards.js';

export const tidalVideoId=86407629;
export const tidalStep=1/120;
export const tidalLength=27.067;
export const tidalStart=3.67;
export const tidalWidth=800,tidalHeight=500,tidalX=304;
export const tidalVideoMode='video-orbs';
export const tidalVideoVersion=3;
export const tidalPortals=[
 [14.08,true],[15.07,false],[16.43,true],[17.36,false],
 [18.84,true],[19.25,false],[21.44,true],[22.35,false],[23.52,true],[24.64,false]
];

// Measured by tracking horizontal movement across six bands of the shipped recording.
export function tidalScrollSpeed(time){
 if(time<tidalStart)return 0;
 return time<4.60?392:902;
}

// Preserve verification for openings started on the original video client.
const legacyRoute=[
 [3.45,104,409],[4.95,112,367],[6.25,168,410],[7.8,95,343],
 [9.25,122,372],[10.55,191,422],[12,88,373],[13.5,128,405],
 [14.5,138,369],[15.45,107,381],[16.55,181,420],[17.9,101,355],
 [19,148,401],[20.2,200,432],[21.35,107,359],[22.55,131,394],
 [23.7,170,421],[24.85,100,363],[25.9,145,400],[27.067,100,416]
];
function legacyChannel(time){
 const next=legacyRoute.findIndex(knot=>knot[0]>time);
 if(next<=0)return (next===0?legacyRoute[0]:legacyRoute.at(-1)).slice(1);
 const [start,top,bottom]=legacyRoute[next-1], [end,nextTop,nextBottom]=legacyRoute[next];
 const u=(time-start)/(end-start);
 return [top+(nextTop-top)*u,bottom+(nextBottom-bottom)*u];
}

export function newTidalWave(version=tidalVideoVersion){
 return {version,tick:0,distance:0,y:tidalHeight/2,mini:false,held:false,pressed:false,portal:0,
  form:version>=3?'cube':'wave',cube:version>=3?newTidalCube():null,crashReason:null};
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
  if(stepTidalCube(run.cube,time,tidalStep,pressed)==='crash'){
   run.crashReason=run.cube.crashReason??'cube';
   return 'crash';
  }
  if(time>=tidalCubeEnd)run.form='transition';
  return null;
 }
 if(run.form==='transition'){
  if(time<tidalStart)return null;
  run.form='wave';
 }
 const legacy=run.version===1;
 const portal=tidalPortals[run.portal];
 if(portal&&time>=portal[0]){
  run.mini=portal[1];
  run.portal++;
 }
 const speed=legacy?(time<3.45?0:222):tidalScrollSpeed(time);
 if(speed){
  const stride=speed*tidalStep;
  run.distance+=stride;
  run.y+=waveRise(stride,run.held,run.mini);
  const [top,bottom]=legacy?legacyChannel(time):[0,tidalHeight];
  const radius=legacy?(run.mini?4:7):(run.mini?11:17);
  if(run.y-radius<top||run.y+radius>bottom){
   run.crashReason='edge';
   return 'crash';
  }
  if(run.version>=3){
   const midY=run.y-waveRise(stride*.5,run.held,run.mini);
   if(hitsTidalHazard(run.distance-stride*.5,time-tidalStep*.5,midY,radius)||hitsTidalHazard(run.distance,time,run.y,radius)){
    run.crashReason='hazard';
    return 'crash';
   }
  }
 }
 return time>=tidalLength?'clear':null;
}
