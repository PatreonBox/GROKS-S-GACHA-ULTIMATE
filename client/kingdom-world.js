import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {groundHeight,makeHouse,makeLandscape,makeResident,makeSky,makeTower,residentPath} from './kingdom-model.js';
import {houseHeight,houseSize,plotBounds,visitorSlots} from '../web/kingdom-rules.js';

const clamp=THREE.MathUtils.clamp;
const frameColor='#c3e5e8';

function gridGeometry(lines){
 const vertices=[];
 for(const [x,z,endX,endZ] of lines){
  const length=Math.ceil(Math.hypot(endX-x,endZ-z));
  for(let i=0;i<length;i++){
   for(const t of [i/length,(i+1)/length]){
    const a=x+(endX-x)*t,b=z+(endZ-z)*t;
    vertices.push(a,groundHeight(a,b)+.044,b);
   }
  }
 }
 return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
}
function buildGrid(){
 const {left,right,back,front}=plotBounds,edges=[
  [left,back,right,back],[right,back,right,front],[right,front,left,front],[left,front,left,back]
 ],lines=[];
 for(let x=left+1;x<right;x++)lines.push([x,back,x,front]);
 for(let z=back+1;z<front;z++)lines.push([left,z,right,z]);
 const grid=new THREE.Group();
 const boundaries=new THREE.LineSegments(gridGeometry(edges),new THREE.LineBasicMaterial({color:'#d8ffe9',transparent:true,opacity:.78}));
 const tiles=new THREE.LineSegments(gridGeometry(lines),new THREE.LineBasicMaterial({color:'#e2fff1',transparent:true,opacity:.26}));
 grid.add(tiles,boundaries);grid.visible=false;
 return {grid,tiles};
}
function ringFor(){
 const geometry=new THREE.RingGeometry(.95,1,48);
 geometry.rotateX(-Math.PI/2);
 return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#d8ffb5',transparent:true,opacity:.84,depthWrite:false}));
}
function release(root){
 const parts=new Set();
 root.traverse(item=>{
  if(item.geometry)parts.add(item.geometry);
  if(item.material){
   parts.add(item.material);
   if(item.material.map)parts.add(item.material.map);
  }
 });
 parts.forEach(item=>item.dispose());
}

export function createKingdomWorld({canvas,cube,onSelect,onHover,onPlot}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.13;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();
 scene.fog=new THREE.Fog(frameColor,26,98);
 const camera=new THREE.PerspectiveCamera(52,1,.12,240);
 const sky=makeSky();
 scene.add(sky,new THREE.HemisphereLight('#e3fcff','#8e7757',2.07));
 const sun=new THREE.DirectionalLight('#ffe5bd',2.48);
 sun.position.set(-12,17,9);
 sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);
 Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:.5,far:58});
 sun.shadow.normalBias=.038;sun.shadow.bias=-.00018;
 scene.add(sun);
 const loader=new THREE.TextureLoader();
 const path=residentPath(),tower=makeTower(),owner=makeResident(loader),houseModel=makeHouse();
 const {ground,surface}=makeLandscape(loader,path);
 owner.setCube(cube);scene.add(ground,tower,owner.resident);
 const {grid,tiles}=buildGrid();
 scene.add(grid);
 const ghost=houseModel.clone(),ghostFinish=new THREE.MeshStandardMaterial({
  color:'#6cf7b8',emissive:'#48966c',emissiveIntensity:.4,transparent:true,opacity:.52,depthWrite:false
 });
 ghost.children.forEach(part=>{part.material=ghostFinish;part.castShadow=false;part.receiveShadow=false;part.renderOrder=3});
 const footprint=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(houseSize.width,.035,houseSize.depth)),
  new THREE.LineBasicMaterial({color:'#d7ffbc',transparent:true,opacity:.98}));
 ghost.add(footprint);ghost.visible=false;scene.add(ghost);
 const picked=new Map(),houses=new Map(),guests=new Map(),proxyMaterial=new THREE.MeshBasicMaterial();
 function hitBox(id,width,height,depth,radius){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),proxyMaterial);
  mesh.visible=false;mesh.userData.id=id;scene.add(mesh);
  picked.set(id,{mesh,radius});
  return mesh;
 }
 function removePicker(id){
  const mesh=picked.get(id).mesh;
  mesh.removeFromParent();mesh.geometry.dispose();picked.delete(id);
 }
 hitBox('tower',2.72,7.35,2.7,1.62).position.copy(tower.position).y=3.65;
 const cubeHit=hitBox('cube',1.45,1.5,1.45,1);
 const selectRing=ringFor(),hoverRing=ringFor();
 hoverRing.material.color.set('#fff0be');hoverRing.material.opacity=.60;
 scene.add(selectRing,hoverRing);

 function setPlot(buildings,visitors,towerLevel){
  tower.getObjectByName('pennant').material.color.set(['#7ce5d9','#eeb852','#f17e57','#bb81eb','#ffe398'][towerLevel-1]);
  const buildingIds=new Set(buildings.map(house=>house.id));
  const visitorIds=new Set(visitors.map(guest=>guest.id));
  for(const [id,model] of houses)if(!buildingIds.has(id)){
   model.removeFromParent();removePicker('house:'+id);houses.delete(id);
  }
  for(const house of buildings){
   if(houses.has(house.id))continue;
   const model=houseModel.clone(),height=groundHeight(house.x,house.z);
   model.position.set(house.x,height,house.z);model.rotation.y=house.rotation*Math.PI/2;
   scene.add(model);houses.set(house.id,model);
   const hit=hitBox('house:'+house.id,houseSize.width,houseHeight,houseSize.depth,1.94);
   hit.position.copy(model.position);hit.position.y+=houseHeight/2;hit.rotation.y=model.rotation.y;
  }
  for(const [id,walker] of guests)if(!visitorIds.has(id)){
   walker.resident.removeFromParent();release(walker.resident);
   removePicker('visitor:'+id);guests.delete(id);
  }
  for(const visitor of visitors){
   if(guests.has(visitor.id))continue;
   const walker=makeResident(loader);
   walker.resident.scale.setScalar(.81);walker.setCube(visitor.skin);
   walker.hit=hitBox('visitor:'+visitor.id,1.25,1.25,1.25,.86);
   walker.phase=(visitor.slot+1)/(visitorSlots.length+1);
   scene.add(walker.resident);guests.set(visitor.id,walker);
  }
 }

 const controls=new OrbitControls(camera,canvas);
 controls.enableDamping=true;controls.dampingFactor=.12;
 controls.minPolarAngle=.43;controls.maxPolarAngle=1.38;
 controls.minDistance=5.7;controls.maxDistance=35;
 controls.maxTargetRadius=13;
 controls.screenSpacePanning=false;
 controls.rotateSpeed=.58;controls.zoomSpeed=.75;controls.panSpeed=.70;
 controls.listenToKeyEvents(canvas);
 const offset=new THREE.Vector3(),pointer=new THREE.Vector2(),ray=new THREE.Raycaster();
 const motion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let selected='tower',hovered=null,build=null,frame=0,last=0,elapsed=0,inView=true,disposed=false,candidate=null;
 const fingers=new Set(),listeners=new AbortController(),signal=listeners.signal;

 function resize(){
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!width||!height)return;
  camera.aspect=width/height;camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
 }
 const size=new ResizeObserver(resize);
 size.observe(canvas);resize();
 function reset(){
  controls.target.set(build?0:-.40,build ? .55 : 1.82,.05);
  const distance=build?(camera.aspect<.91?31:25):camera.aspect<.91?21.2:17.8;
  const start=new THREE.Spherical(distance,build ? .93 : 1.225,.41);
  camera.position.copy(controls.target).add(offset.setFromSpherical(start));
  controls.update();controls.saveState();
 }
 function setBuild(next){
  const starting=!build&&next;
  build=next;
  grid.visible=Boolean(build);tiles.visible=Boolean(build?.snap);
  ghost.visible=Boolean(build?.spot);
  canvas.dataset.building=String(Boolean(build));
  if(starting){hover(null);reset()}
  if(!ghost.visible)return;
  const {x,z,rotation}=build.spot;
  ghost.position.set(x,groundHeight(x,z)+.04,z);
  ghost.rotation.y=rotation*Math.PI/2;
  const good=!build.error;
  ghostFinish.color.set(good?(build.locked?'#a2ffe2':'#60eab9'):'#fa7680');
  ghostFinish.emissive.set(good?'#48966c':'#8a292e');
  footprint.material.color.set(good?'#c6ffb4':'#ffa9a6');
 }
 function panMode(on){
  controls.mouseButtons.LEFT=on?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
  controls.touches.ONE=on?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
 }
 function zoom(factor){
  offset.subVectors(camera.position,controls.target);
  offset.setLength(clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));
  camera.position.copy(controls.target).add(offset);
  controls.update();
 }
 function select(id){selected=id}
 function aim(event){
  if(!event)return null;
  const bounds=canvas.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return null;
  const x=event.clientX-bounds.left,y=event.clientY-bounds.top;
  pointer.set(x/bounds.width*2-1,1-y/bounds.height*2);
  ray.setFromCamera(pointer,camera);
  return {x,y};
 }
 function pick(event){
  const point=aim(event);
  if(!point)return null;
  const object=ray.intersectObjects([...picked.values()].map(item=>item.mesh),false)[0]?.object;
  return {...point,id:object?.userData.id};
 }
 function plot(event,lock){
  if(build.locked)return;
  const point=aim(event)&&ray.intersectObject(surface,false)[0]?.point;
  onPlot(point?{x:point.x,z:point.z}:null,lock);
 }
 function hover(event){
  const hit=event?pick(event):null;
  hovered=hit?.id||null;
  canvas.dataset.pointing=String(Boolean(hovered));
  onHover(hovered,hit);
 }
 canvas.addEventListener('pointerdown',event=>{
  if(fingers.size||event.button!==0)candidate=null;
  else candidate={id:event.pointerId,x:event.clientX,y:event.clientY};
  fingers.add(event.pointerId);hover(null);
 },{signal});
 canvas.addEventListener('pointermove',event=>{
  if(fingers.size){
   if(!candidate||Math.hypot(event.clientX-candidate.x,event.clientY-candidate.y)>5){
    candidate=null;canvas.dataset.dragging='true';
    if(build)plot(null,false);
   }
   return;
  }
  if(event.pointerType==='touch')return;
  if(build)plot(event,false);else hover(event);
 },{signal});
 canvas.addEventListener('pointerleave',()=>{if(build)plot(null,false);else hover(null)},{signal});
 canvas.addEventListener('pointerup',event=>{
  if(candidate?.id===event.pointerId&&Math.hypot(event.clientX-candidate.x,event.clientY-candidate.y)<=5){
   if(build)plot(event,true);
   else{
    const hit=pick(event);
    if(hit?.id)onSelect(hit.id);
   }
  }
  fingers.delete(event.pointerId);candidate=null;
  canvas.dataset.dragging=String(fingers.size>0);
  if(!build&&event.pointerType!=='touch')hover(event);
 },{signal});
 canvas.addEventListener('pointercancel',event=>{
  fingers.delete(event.pointerId);candidate=null;canvas.dataset.dragging='false';hover(null);
 },{signal});
 canvas.addEventListener('keydown',event=>{
  if(event.key==='+'||event.key==='='){event.preventDefault();zoom(.79)}
  if(event.key==='-'){event.preventDefault();zoom(1.26)}
  if(event.key==='Home'){event.preventDefault();reset()}
 },{signal});

 function walk({resident,body},hit,time,phase,scale=1){
  const loop=(.209+phase+time*.031)%1,point=path.getPointAt(loop),direction=path.getTangentAt(loop);
  const stride=(time*2.2+phase*.78)%1,bounce=motion?0:Math.sin(Math.PI*stride)*.295;
  const floor=groundHeight(point.x,point.z);
  resident.position.set(point.x,floor+(.55+bounce)*scale,point.z);
  resident.rotation.y=Math.atan2(direction.x,direction.z);
  body.rotation.x=motion?0:Math.sin(stride*Math.PI*2)*.12;
  body.rotation.z=motion?0:.095*Math.cos((time+phase)*4.8);
  hit.position.copy(resident.position);
 }
 function showRing(ring,id){
  const marker=picked.get(id);
  ring.visible=Boolean(marker&&!build);
  if(!ring.visible)return;
  const {x,z}=marker.mesh.position;
  ring.position.set(x,groundHeight(x,z)+.033,z);
  ring.scale.set(marker.radius,1,marker.radius);
 }
 function render(now){
  frame=0;
  if(document.hidden||!inView||disposed)return;
  const delta=last?Math.min(.05,(now-last)/1000):0;
  last=now;elapsed+=delta;
  controls.update(delta);
  sky.position.copy(camera.position);
  walk(owner,cubeHit,elapsed,0);
  for(const guest of guests.values())walk(guest,guest.hit,elapsed,guest.phase,.81);
  showRing(selectRing,selected);
  showRing(hoverRing,hovered===selected?null:hovered);
  renderer.render(scene,camera);
  frame=requestAnimationFrame(render);
 }
 function wake(){
  if(frame||document.hidden||!inView||disposed)return;
  last=0;frame=requestAnimationFrame(render);
 }
 const viewport=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;wake()});
 viewport.observe(canvas);
 document.addEventListener('visibilitychange',wake,{signal});
 reset();
 canvas.dataset.renderer='webgl';
 wake();

 function dispose(){
  disposed=true;
  cancelAnimationFrame(frame);
  size.disconnect();viewport.disconnect();listeners.abort();controls.dispose();
  scene.add(houseModel);
  release(scene);
  sun.shadow.dispose();
  renderer.dispose();renderer.forceContextLoss();
 }
 return {select,setCube:owner.setCube,setPlot,setBuild,panMode,zoom,reset,dispose};
}
