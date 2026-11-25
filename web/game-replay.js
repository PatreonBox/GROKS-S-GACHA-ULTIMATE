import {makeDrill,stepDrill,drillStep,pressForge,releaseForge,steerDrill,directDrillLane,shiftDrillLane} from './drill-physics.js';
import {makeCourse,newAttempt,pressRunner,advanceRunner,STEP} from './remix-physics.js';

export function seededRandom(seed) {
 let state=seed>>>0;
 const next=() => ((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 next.state=()=>state;
 return next;
}
export function drillInput(run,kind,value) {
 if (kind==='reset') {run.held=false;run.pressed=false;run.charge=0;return;}
 if (run.kind==='spike'&&kind==='press') pressForge(run);
 else if (run.kind==='spike'&&kind==='release') releaseForge(run);
 else if (run.kind==='saw'&&kind==='aim'&&Number.isFinite(value)&&Math.abs(value)<=100000) steerDrill(run,value);
 else if (run.kind==='endurance'&&kind==='lane'&&[0,1,2].includes(value)) directDrillLane(run,value);
 else if (run.kind==='endurance'&&kind==='shift'&&[-1,1].includes(value)) shiftDrillLane(run,value);
 else throw Error('Invalid training controls.');
}
export function runnerInput(run,kind,value) {
 if (kind==='press') pressRunner(run);
 else if (kind==='held'&&typeof value==='boolean') run.held=value;
 else if (kind==='reset') {run.held=false;run.queued=0;}
 else throw Error('Invalid arcade controls.');
}
function replay(proof,{duration,step,maxSeconds,offset=0,apply,advance}) {
 const {ticks,trace}=proof||{};
 if (!Number.isSafeInteger(ticks)||ticks<offset||ticks-offset>Math.floor(maxSeconds/step)||
    ticks*step*1000>duration+500||!Array.isArray(trace)||trace.length>18000)throw Error('This run could not be verified.');
 let prior=-1;
 for (const event of trace) {
  if (!Array.isArray(event)||event.length!==3||!Number.isInteger(event[0])||event[0]<offset||event[0]<prior||event[0]>ticks)
   throw Error('Invalid replay controls.');
  prior=event[0];
 }
 let next=0,status;
 for (let tick=offset;tick<ticks;tick++) {
  while (trace[next]?.[0]===tick) {
   const [,kind,value]=trace[next++];
   apply(kind,value);
  }
  status=advance();
  if (status) {
   if (tick+1!==ticks) throw Error('The replay continues past the end of the run.');
   break;
  }
 }
 return status;
}
export function replayDrill(session,proof,now) {
 const saved=session.checkpoint;
 const offset=saved?.ticks||0;
 if((proof?.from??0)!==offset)throw Error('Your training checkpoint changed.');
 const random=seededRandom(saved?.seed??session.seed);
 const run=saved?{...saved.run,random}:makeDrill(session.kind,random);
 let axis=saved?.axis||0;
 replay(proof,{
  duration:now-session.start,step:drillStep,maxSeconds:180,offset,
  apply(kind,value){
   if(kind==='axis'&&session.kind==='saw'&&[-1,0,1].includes(value)){axis=value;return;}
   drillInput(run,kind,value);
  },
  advance(){
   if(run.failed)throw Error('The training run has already ended.');
   stepDrill(run,drillStep,axis);
   return run.failed?'crash':null;
  }
 });
 const {random:next,event,...state}=run;
 return {run:state,axis,ticks:proof.ticks,seed:next.state()};
}
export function replayRemix(remix,session,proof,now) {
 const course=makeCourse(remix),runner=newAttempt(course);
 const result=replay(proof,{
  duration:now-session.start,step:STEP,maxSeconds:180,
  apply:(kind,value)=>runnerInput(runner,kind,value),
  advance(){const status=advanceRunner(runner,course,remix,STEP);return status==='running'?null:status;}
 });
 if (!result) throw Error('Finish the attempt before saving it.');
 if (result==='clear'&&(remix.mark!=='KEY'||proof.key===session.key)) return 100;
 return Math.min(remix.finish?remix.finish-1:99,Math.floor((remix.finish||100)*runner.x/course.end));
}
