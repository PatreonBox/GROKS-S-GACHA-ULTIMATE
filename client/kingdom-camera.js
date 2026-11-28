import * as THREE from 'three';
import {buildingFootprint,buildingSpecs,insideFootprint,manorHeight,towerFootprint} from '../web/kingdom-rules.js';
import {groundHeight} from './kingdom-model.js';

const movement=new Set(['KeyW','KeyA','KeyS','KeyD']);
const buffer=.38;

export function kingdomCameraMotion(camera,controls,canvas,signal){
 const keys=new Set(),safe=new THREE.Vector3(),target=new THREE.Vector3(),goal=new THREE.Vector3(),sample=new THREE.Vector3();
 const forward=new THREE.Vector3(),side=new THREE.Vector3(),move=new THREE.Vector3();
 let rooms=[];
 window.addEventListener('keydown',event=>{
  if(!movement.has(event.code)||!canvas.clientWidth||event.metaKey||event.ctrlKey||event.altKey||
    event.target.closest?.('input,select,textarea,[contenteditable]')||
    [...document.querySelectorAll('dialog[open]')].some(dialog=>!dialog.contains(canvas)))return;
  keys.add(event.code);event.preventDefault();
 },{signal});
 window.addEventListener('keyup',event=>keys.delete(event.code),{signal});
 window.addEventListener('blur',()=>keys.clear(),{signal});
 function clear(point){
  return point.y>groundHeight(point.x,point.z)+.56&&
   !rooms.some(({box,bottom,top})=>point.y>=bottom&&point.y<=top&&insideFootprint(point,box));
 }
 function checked(start,end){
  const count=Math.max(1,Math.ceil(start.distanceTo(end)/.19));
  for(let i=1;i<=count;i++){
   if(!clear(sample.lerpVectors(start,end,i/count)))return (i-1)/count;
  }
  return 1;
 }
 function reset(){
  safe.copy(camera.position);target.copy(controls.target);
 }
 function settle(){
  if(!clear(safe)&&clear(camera.position)){reset();return;}
  const fraction=checked(safe,camera.position);
  if(fraction<1){
   camera.position.lerpVectors(safe,camera.position,fraction);
   if(!clear(camera.position)){
    const top=Math.max(...rooms.filter(room=>insideFootprint(camera.position,room.box)).map(room=>room.top));
    camera.position.y=Math.max(top+.15,groundHeight(camera.position.x,camera.position.z)+.75,camera.position.y);
   }
   controls.target.lerpVectors(target,controls.target,fraction);
  }
  camera.lookAt(controls.target);reset();
 }
 function step(dt){
  const direction=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
  const strafe=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
  if(!direction&&!strafe)return;
  forward.subVectors(controls.target,camera.position).setY(0).normalize();
  side.crossVectors(forward,camera.up);
  const rate=THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)*.37,3.4,11);
  move.copy(forward).multiplyScalar(direction).addScaledVector(side,strafe).normalize().multiplyScalar(dt*rate);
  for(const axis of ['x','z']){
   if(!move[axis])continue;
   goal.copy(camera.position);goal[axis]+=move[axis];
   const shifted=controls.target.clone();
   shifted[axis]+=move[axis];
   if(shifted.length()>controls.maxTargetRadius&&shifted.length()>=controls.target.length())continue;
   const delta=move[axis]*checked(camera.position,goal);
   camera.position[axis]+=delta;controls.target[axis]+=delta;
  }
 }
 function setBuildings(buildings,towerHeight,construction){
  const towerPad=construction?.75:buffer;
  rooms=[{box:{left:towerFootprint.left-towerPad,right:towerFootprint.right+towerPad,
    back:towerFootprint.back-towerPad,front:towerFootprint.front+towerPad},bottom:-2,top:towerHeight+buffer},
   ...buildings.map(building=>{
    const {kind='house',level=1,x,z}=building;
    const floor=groundHeight(x,z),height=kind==='house'&&level===3?manorHeight:buildingSpecs[kind].height;
    return {box:buildingFootprint(building,buffer),bottom:floor-.8,top:floor+height+buffer};
   })];
 }
 return {reset,settle,step,setBuildings};
}
