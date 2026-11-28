const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});

function roundCorners(points,closed,clear){
 const smooth=[];
 for(const [i,center] of points.entries()){
  const a=points[i-1]??(closed?points.at(-1):null),b=points[i+1]??(closed?points[0]:null);
  if(!a||!b){smooth.push(center);continue;}
  const radius=Math.min(.71,distance(center,a)*.37,distance(center,b)*.37);
  if(radius<.035){smooth.push(center);continue;}
  const start=lerp(center,a,radius/distance(center,a)),end=lerp(center,b,radius/distance(center,b));
  const bend=Array.from({length:7},(_,j)=>{
   const t=j/6;
   return lerp(lerp(start,center,t),lerp(center,end,t),t);
  });
  const safe=bend.every((point,j)=>!j||clear(bend[j-1],point));
  smooth.push(...(safe?bend:[center]));
 }
 return smooth;
}

export function routeKingdomTrail({points,closed},nav,bounds){
 const {left,right,back,front}=bounds;
 const inside=({x,z})=>x>=left&&x<=right&&z>=back&&z<=front;
 const anchors=points.map(([x,z])=>({x,z})).filter(point=>inside(point)&&nav.passable(point));
 if(anchors.length<2)return [];
 const legs=[];
 let current=[anchors[0]];
 for(const target of anchors.slice(1).concat(closed?[anchors[0]]:[])){
  const path=nav.route(current.at(-1),target,true);
  if(path&&!path.recovery){
   for(const point of path.points)if(distance(current.at(-1),point)>.035)current.push(point);
  }else{
   if(current.length>1)legs.push({points:current,closed:false});
   current=[target];
  }
 }
 if(current.length>1){
  const loop=closed&&distance(current[0],current.at(-1))<.035&&current.length>3;
  if(loop)current.pop();
  legs.push({points:current,closed:loop});
 }
 return legs.map(leg=>({...leg,points:roundCorners(leg.points,leg.closed,nav.clear)}));
}

export function trailPatrol(legs){
 const leg=legs.reduce((longest,next)=>next.points.length>(longest?.points.length||0)?next:longest,null);
 if(!leg)return null;
 const {closed,points}=leg;
 return {closed,points};
}
