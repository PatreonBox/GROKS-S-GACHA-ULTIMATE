export const tidalCubeEnd=2;
export const tidalCubeX=304;
export const tidalCubeRadius=15;

const speed=335;
const acceleration=1220;
const floor=358;
const orbs=[
 {type:'pink',x:tidalCubeX+speed*.65,y:329,radius:32},
 {type:'green',x:tidalCubeX+speed*1.24,y:179,radius:34}
];
const platforms=[
 {x:-64,y:floor,width:tidalCubeX+speed*.86+64,height:27},
 {x:tidalCubeX+speed*1.05,y:66,width:495,height:27}
];
const spikes=Array.from({length:10},(_,index)=>{
 const x=tidalCubeX+speed*.95+46*index;
 return [[x,500],[x+23,365-(index%3)*11],[x+46,500]];
});
const reach=orb=>orb.radius+tidalCubeRadius+10;

export function newTidalCube(){
 return {y:floor-tidalCubeRadius,vy:0,gravity:1,nextOrb:0,landed:true,angle:0,hitAt:-Infinity,crashReason:''};
}

export function tidalCubeScene(time){
 const scroll=time*speed;
 return {
  orbs:orbs.map(orb=>({...orb,x:orb.x-scroll})),
  platforms:platforms.map(platform=>({...platform,x:platform.x-scroll})),
  spikes:spikes.map(points=>points.map(([x,y])=>[x-scroll,y]))
 };
}

function hitsSpikes(cube,x){
 const left=x-tidalCubeRadius,right=x+tidalCubeRadius;
 return spikes.some(([[start,bottom],[peak,top],[end]])=>{
  if(right<start||left>end||cube.y-tidalCubeRadius>bottom)return false;
  const closest=Math.max(left,Math.min(right,peak));
  const face=top+(bottom-top)*Math.abs(closest-peak)/(end-peak);
  return cube.y+tidalCubeRadius>=face;
 });
}

function crash(cube,reason){
 cube.crashReason=reason;
 return 'crash';
}

export function stepTidalCube(cube,time,dt,pressed){
 const x=tidalCubeX+time*speed;
 const orb=orbs[cube.nextOrb];
 if(orb&&pressed&&Math.hypot(orb.x-x,orb.y-cube.y)<=reach(orb)){
  if(orb.type==='green')cube.gravity=-cube.gravity;
  cube.vy=(orb.type==='pink'?-640:460)*cube.gravity;
  cube.nextOrb++;
  cube.hitAt=time;
 }else if(orb&&x>orb.x+reach(orb)){
  return crash(cube,'You missed the '+orb.type+' orb.');
 }

 const before=cube.y;
 cube.vy+=cube.gravity*acceleration*dt;
 cube.y+=cube.vy*dt;
 cube.landed=false;
 for(const platform of platforms){
  if(x+tidalCubeRadius<=platform.x||x-tidalCubeRadius>=platform.x+platform.width)continue;
  const top=platform.y-tidalCubeRadius,bottom=platform.y+platform.height+tidalCubeRadius;
  if(cube.gravity>0&&before<=top&&cube.y>=top){
   cube.y=top;
   cube.landed=true;
  }else if(cube.gravity<0&&before>=bottom&&cube.y<=bottom){
   cube.y=bottom;
   cube.landed=true;
  }else if(cube.y>top&&cube.y<bottom){
   return crash(cube,'Your cube hit a platform.');
  }
  if(cube.landed)cube.vy=0;
 }
 if(hitsSpikes(cube,x))return crash(cube,'Your cube hit the spikes.');
 if(cube.y-tidalCubeRadius<0||cube.y+tidalCubeRadius>500)return crash(cube,'Your cube left the course.');
 const quarterTurn=Math.PI/2;
 cube.angle=cube.landed?Math.round(cube.angle/quarterTurn)*quarterTurn:cube.angle+cube.gravity*dt*8;
 return null;
}
