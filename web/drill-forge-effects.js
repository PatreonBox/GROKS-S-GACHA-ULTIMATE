import {drillPace} from './drill-physics.js';

const contactTime=.09;
const hammerReturn=.35;
const sparks=Array.from({length:12},(_,i)=>{
 const angle=i*2.39996,radius=55+(i%5)*21;
 return [Math.cos(angle)*radius,Math.sin(angle)*radius,65+i%4*33];
});
const clamp01=n=>Math.max(0,Math.min(1,n));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>t*t*(3-2*t);

export function recordForgeStrike(run,charge,swung){
 const {gate,quality}=run.event,pace=drillPace('spike',run.time);
 const inReach=gate.distance-run.dist<=pace.speed*pace.strike+1;
 return {gate:gate.index,at:run.time,charge,swung,quality,inReach,
  distance:inReach?gate.distance:run.dist+60};
}
export function forgeImpactAge(strike,clock,reduced){
 return clock-strike.at-(reduced||!strike.swung?0:contactTime);
}
function restPose(x,charge){
 return {x:x+36,y:5+20*charge,z:41+55*charge,tilt:.16+charge*.94};
}

export function forgeHammerPose(run,scale,strike,clock,reduced){
 const idle=restPose(run.x,run.charge);
 if(!strike?.swung)return idle;
 const age=forgeImpactAge(strike,clock,reduced);
 if(age>hammerReturn)return idle;
 const start=restPose(run.x,strike.charge);
 const y=Math.min(95,(run.dist-strike.distance)*scale);
 // The underside of the head meets the center spike at its actual world depth.
 const contact={x:run.x,y,z:strike.inReach?73:31,tilt:0};
 if(reduced)return age<.09?contact:idle;
 if(age<0){
  const t=clamp01(1+age/contactTime),v=t*t;
  return {x:mix(start.x,contact.x,v),y:mix(start.y,y,v),z:mix(start.z,contact.z,v)+Math.sin(Math.PI*t)*21,tilt:mix(start.tilt,0,v)};
 }
 const settle=clamp01(age/.045),dip=age<.045?13*settle:13*(1-clamp01((age-.045)/.085));
 const t=clamp01((age-.045)/(hammerReturn-.045)),v=ease(t);
 return {x:mix(contact.x,idle.x,v),y:mix(y,idle.y,v),z:mix(contact.z-dip,idle.z,v)+Math.sin(Math.PI*t)*25,tilt:mix(0,idle.tilt,v)-Math.sin(Math.PI*t)*.65};
}
export function paintForgeHammer(g,run,scale,strike,clock,reduced){
 const pose=forgeHammerPose(run,scale,strike,clock,reduced);
 const {x,y,z,tilt}=pose,c=Math.cos(tilt),s=Math.sin(tilt);
 const point=(dx,dy,dz)=>[x+dx,y+dy*c-dz*s,z+dy*s+dz*c];
 const head=(dx,dy,dz,w,d,h,color,light)=>{
  const [u,v,wz]=point(dx,dy,dz);
  g.box(u,v,wz,w,d,h,color,{pitch:tilt,light});
 };
 // A short handled throwing hammer travels with the head through the whole swing.
 g.beam(point(0,2,0),point(0,23,-35),5.8,'#bda181');
 g.beam(point(0,15,-22),point(0,24,-37),7.8,'#3e2e3c');
 g.beam(point(0,23,-35),point(0,24,-38),9,'#d5a16a');
 head(0,0,0,33,18,16,'#6d5364');
 head(-16,0,0,5.5,20,19,'#f7bf8b');
 head(16,0,0,5.5,20,19,'#e8a275');
 head(0,1,9,20,11,3,'#df8673');
 head(0,9.8,0,21,1.8,3,run.charge>.12?'#ffdf92':'#d57f5f',1);
}

export function paintForgeFracture(g,gate,y,age,reduced){
 const perfect=gate.quality==='perfect',hot=perfect?'#fff4bd':'#ffb477';
 g.box(0,y,7,151,35,14,'#624254');
 // Sheared outer teeth and the exposed core remain attached to the passing plinth.
 for(const dir of [-1,1]){
  g.pyramid(dir*47,y,21,34,31,24,'#876176',{roll:-dir*.26});
  g.pyramid(dir*13,y+4,16,22,25,13,'#9d665c',{roll:dir*.44});
 }
 if(age>=.43)return;
 const heat=Math.max(0,1-age/.43);
 g.beam([-24,y+11,18],[-5,y+7,16],2.7,hot,{light:1,alpha:heat});
 g.beam([-5,y+7,16],[15,y-5,15],2.4,hot,{light:1,alpha:heat});
 if(reduced)return;
 if(age<.2){
  const radius=8+age*230;
  g.ring(0,y,56-age*67,radius,Math.max(1,radius-2.2),1.3,hot,{segments:14,light:1,alpha:.75*(1-age/.2)});
 }
 const count=perfect?sparks.length:8,phase=gate.index*.69,c=Math.cos(phase),s=Math.sin(phase);
 for(let i=0;i<count;i++){
  const [vx,vy,vz]=sparks[i],dx=vx*c-vy*s,dy=vx*s+vy*c;
  const flight=t=>[dx*t,y+dy*t,63+vz*t-340*t*t];
  const point=flight(age),tail=flight(Math.max(0,age-.031));
  g.beam(tail,point,i%3===0?2.2:1.35,i%3===0?'#fff4bd':'#ffa159',{light:1,alpha:heat});
  if(i<4&&age>.018)g.box(point[0],point[1],point[2]-4,7,5,9,'#bc7483',{pitch:i+age*7,roll:age*(i+3)});
 }
}
