import {waveRise} from './remix-wave.js';

export const tidalVideoId=86407629;
export const tidalStep=1/120;
export const tidalLength=27.067;
export const tidalStart=3.45;
export const tidalWidth=800,tidalHeight=500,tidalX=304,tidalSpeed=222;
export const tidalPortals=[
 [14.08,true],[15.07,false],[16.43,true],[17.36,false],
 [18.84,true],[19.25,false],[21.44,true],[22.35,false],[23.52,true],[24.64,false]
];

// The run has its own flight path in the foreground of the recording.
const route=[
 [3.45,104,409],[4.95,112,367],[6.25,168,410],[7.8,95,343],
 [9.25,122,372],[10.55,191,422],[12,88,373],[13.5,128,405],
 [14.5,138,369],[15.45,107,381],[16.55,181,420],[17.9,101,355],
 [19,148,401],[20.2,200,432],[21.35,107,359],[22.55,131,394],
 [23.7,170,421],[24.85,100,363],[25.9,145,400],[27.067,100,416]
];
export function tidalChannel(time){
 const next=route.findIndex(knot=>knot[0]>time);
 if(next<=0)return (next===0?route[0]:route.at(-1)).slice(1);
 const [start,top,bottom]=route[next-1], [end,nextTop,nextBottom]=route[next];
 const u=(time-start)/(end-start);
 return [top+(nextTop-top)*u,bottom+(nextBottom-bottom)*u];
}

export const newTidalWave=()=>({tick:0,y:250,mini:false,held:false,portal:0});
export function stepTidalWave(run){
 const time=++run.tick*tidalStep;
 const portal=tidalPortals[run.portal];
 if(portal&&time>=portal[0]){
  run.mini=portal[1];
  run.portal++;
 }
 if(time>=tidalStart){
  run.y+=waveRise(tidalSpeed,run.held,run.mini)*tidalStep;
  const [top,bottom]=tidalChannel(time),radius=run.mini?4:7;
  if(run.y-radius<top||run.y+radius>bottom)return 'crash';
 }
 return time>=tidalLength?'clear':null;
}
