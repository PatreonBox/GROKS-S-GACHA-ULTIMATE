export const tidalOverlayCubeEnd=1.6;
export const tidalCubeRadius=15;

const acceleration=1220;
const overlayStartY=285;
const supportEnds=.38;
export const tidalOrbSequence=['pink','green','green','pink','pink'];
const cubeSpeed=480;
const launchFloorEnd=180,approachFloorStart=768;
const pinkJump=310,greenJump=465;
const portalY=265,portalHalfHeight=40,portalDepth=22;
export const tidalPortalContactAt=4.65;
const portalX=tidalPortalContactAt*cubeSpeed;
export const tidalPortalApproachX=portalX-120;
const orbHeights=[274,260,342,246,234];
const contactOrbs=tidalOrbSequence.map((type,i)=>({type,x:200+i*110,y:orbHeights[i],radius:43}));
const orbWindows=tidalOrbSequence.map((type,index)=>({
 type,
 from:.33+index*.23,
 until:.54+index*.23
}));
const overlayTaps=[
 {type:'pink',from:.34,until:.64},
 {type:'green',from:.61,until:1.01}
];

export function newTidalCube(){
 return {y:overlayStartY,vy:0,gravity:1,nextOrb:0,angle:0,missedOrb:null,crashReason:''};
}

export function newTidalContactCube(){
 return {...newTidalCube(),x:0,grounded:true,tapBuffer:0,orbContact:null};
}

function reachesOrb(cube,orb){
 const dx=orb.x-cube.x,dy=orb.y-cube.y;
 const sin=Math.sin(cube.angle),cos=Math.cos(cube.angle);
 const x=Math.max(0,Math.abs(dx*cos+dy*sin)-tidalCubeRadius);
 const y=Math.max(0,Math.abs(dy*cos-dx*sin)-tidalCubeRadius);
 return x*x+y*y<=orb.radius*orb.radius;
}

export function stepTidalContactCube(cube,dt,pressed,height){
 cube.x+=cubeSpeed*dt;
 const orb=contactOrbs[cube.nextOrb],approaching=!orb&&cube.x>=approachFloorStart;
 cube.orbContact=null;
 if(pressed)cube.tapBuffer=.055;
 if(orb&&!cube.missedOrb){
  if(cube.x>orb.x+orb.radius+tidalCubeRadius*Math.SQRT2)cube.missedOrb=orb.type;
  else if(reachesOrb(cube,orb)){
   cube.orbContact=orb.type;
   if(cube.tapBuffer>0){
    if(orb.type==='green')cube.gravity=-cube.gravity;
    cube.vy=-(orb.type==='green'?greenJump:pinkJump)*cube.gravity;
    cube.grounded=false;
    cube.tapBuffer=0;
    cube.nextOrb++;
   }
  }else if(cube.grounded&&cube.x<=launchFloorEnd&&cube.tapBuffer>0){
   cube.vy=-pinkJump;cube.grounded=false;cube.tapBuffer=0;
  }
 }
 cube.tapBuffer=Math.max(0,cube.tapBuffer-dt);
 cube.vy+=cube.gravity*acceleration*dt;
 cube.y+=cube.vy*dt;
 const support=approaching?portalY:cube.x<=launchFloorEnd?overlayStartY:null;
 cube.grounded=support!==null&&cube.gravity===1&&cube.y>=support&&cube.vy>=0;
 if(cube.grounded){
  cube.y=support;cube.vy=0;
  cube.angle=Math.round(cube.angle/(Math.PI/2))*(Math.PI/2);
 }else cube.angle+=cube.gravity*dt*8;

 const extent=tidalCubeRadius*(Math.abs(Math.sin(cube.angle))+Math.abs(Math.cos(cube.angle)));
 if(cube.y-extent<=0||cube.y+extent>=height){
  const up=cube.y<height/2;
  const edge=up?'ceiling':'floor';
  cube.y=up?extent:height-extent;
  cube.crashReason=cube.missedOrb?'You missed the '+cube.missedOrb+' orb and hit the '+edge+'.':
   'Your cube hit the '+edge+'.';
  return 'crash';
 }
 if(approaching&&cube.x>=portalX){
  if(cube.x<=portalX+portalDepth&&Math.abs(cube.y-portalY)<=portalHalfHeight+extent)return 'wave';
  if(cube.x>portalX+portalDepth){
   cube.crashReason='You missed the wave portal.';
   return 'crash';
  }
 }
 return approaching?'transition':null;
}

export function stepLegacyTidalCube(cube,time,dt,pressed){
 const orb=overlayTaps[cube.nextOrb];
 if(orb&&time>orb.until){
  cube.crashReason='You missed the '+orb.type+' orb.';
  return 'crash';
 }
 if(orb&&pressed&&time>=orb.from){
  if(orb.type==='green')cube.gravity=-1;
  cube.vy=orb.type==='pink'?-310:-235;
  cube.nextOrb++;
 }
 cube.vy+=cube.gravity*acceleration*dt;
 cube.y=Math.max(tidalCubeRadius,Math.min(overlayStartY,cube.y+cube.vy*dt));
 if(cube.y===overlayStartY||cube.y===tidalCubeRadius){
  cube.vy=0;
  const quarterTurn=Math.PI/2;
  cube.angle=Math.round(cube.angle/quarterTurn)*quarterTurn;
 }else cube.angle+=cube.gravity*dt*8;
 return null;
}

export function stepTidalOverlayCube(cube,time,dt,pressed,height){
 const orb=orbWindows[cube.nextOrb];
 if(orb&&!cube.missedOrb){
  if(time>orb.until)cube.missedOrb=orb.type;
  else if(pressed&&time>=orb.from){
   if(orb.type==='green'){
    cube.gravity=-cube.gravity;
    cube.vy=170*cube.gravity;
   }else cube.vy=-310*cube.gravity;
   cube.nextOrb++;
  }
 }

 cube.vy+=cube.gravity*acceleration*dt;
 cube.y+=cube.vy*dt;
 if(time<=supportEnds&&cube.y>=overlayStartY){
  cube.y=overlayStartY;cube.vy=0;
 }else cube.angle+=cube.gravity*dt*8;

 const extent=tidalCubeRadius*(Math.abs(Math.sin(cube.angle))+Math.abs(Math.cos(cube.angle)));
 if(cube.y-extent<=0||cube.y+extent>=height){
  const up=cube.y<height/2;
  const edge=up?'ceiling':'floor';
  cube.y=up?extent:height-extent;
  cube.crashReason=cube.missedOrb?'You missed the '+cube.missedOrb+' orb and hit the '+edge+'.':
   'Your cube hit the '+edge+'.';
  return 'crash';
 }
 return null;
}
