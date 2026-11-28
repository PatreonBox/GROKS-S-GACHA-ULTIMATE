export const tidalOverlayCubeEnd=1.6;
export const tidalCubeRadius=15;

const acceleration=1220;
const overlayStartY=285;
const supportEnds=.38;
export const tidalOrbSequence=['pink','green','green','pink','pink'];
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
