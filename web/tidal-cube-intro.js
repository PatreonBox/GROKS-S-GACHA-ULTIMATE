export const tidalOverlayCubeEnd=1.6;
export const tidalCubeRadius=15;

const acceleration=1220;
const overlayStartY=285;
const overlayTaps=[
 {type:'pink',from:.34,until:.64},
 {type:'green',from:.61,until:1.01}
];

export function newTidalCube(){
 return {y:overlayStartY,vy:0,gravity:1,nextOrb:0,angle:0,crashReason:''};
}

export function stepTidalOverlayCube(cube,time,dt,pressed){
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
