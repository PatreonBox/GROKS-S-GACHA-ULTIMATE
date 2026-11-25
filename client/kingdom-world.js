import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {groundHeight,makeLandscape,makeResident,makeSky,makeTower,residentPath} from './kingdom-model.js';

const frameColor='#c3e5e8';
const clamp=THREE.MathUtils.clamp;

export function createKingdomWorld({canvas,cube,onSelect,onHover}){
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
 const path=residentPath(),tower=makeTower(),{resident,body,setCube}=makeResident(loader);
 setCube(cube);
 scene.add(makeLandscape(loader,path),tower,resident);

 const proxyMaterial=new THREE.MeshBasicMaterial();
 const towerHit=new THREE.Mesh(new THREE.BoxGeometry(2.72,7.35,2.7),proxyMaterial);
 const cubeHit=new THREE.Mesh(new THREE.BoxGeometry(1.45,1.5,1.45),proxyMaterial);
 towerHit.position.copy(tower.position).y=3.65;
 const pickers=[towerHit,cubeHit];
 for(const item of pickers){item.visible=false;scene.add(item)}
 const highlights=Object.fromEntries([['tower',1.57],['cube',.94]].map(([id,radius])=>{
  const geometry=new THREE.RingGeometry(radius,radius+.045,48);
  geometry.rotateX(-Math.PI/2);
  const ring=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#c7ffb2',transparent:true,opacity:.8,depthWrite:false}));
  ring.visible=false;scene.add(ring);
  return [id,ring];
 }));
 const controls=new OrbitControls(camera,canvas);
 controls.enableDamping=true;controls.dampingFactor=.12;
 controls.minPolarAngle=.43;controls.maxPolarAngle=1.38;
 controls.minDistance=5.7;controls.maxDistance=33;
 controls.maxTargetRadius=12;
 controls.screenSpacePanning=false;
 controls.rotateSpeed=.58;controls.zoomSpeed=.75;controls.panSpeed=.70;
 controls.listenToKeyEvents(canvas);
 const offset=new THREE.Vector3(),pointer=new THREE.Vector2(),ray=new THREE.Raycaster();
 const motion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let selected='tower',hovered=null,frame=0,last=0,elapsed=0,inView=true,disposed=false;
 let candidate=null;
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
  controls.target.set(-.40,1.82,.05);
  const distance=camera.aspect<.91?21.2:17.8;
  const start=new THREE.Spherical(distance,1.225,.41);
  camera.position.copy(controls.target).add(offset.setFromSpherical(start));
  controls.update();controls.saveState();
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
 function pick(event){
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  const x=event.clientX-rect.left,y=event.clientY-rect.top;
  pointer.set(x/rect.width*2-1,1-y/rect.height*2);
  ray.setFromCamera(pointer,camera);
  const item=ray.intersectObjects(pickers,false)[0]?.object;
  return {id:item===towerHit?'tower':item===cubeHit?'cube':null,x,y};
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
  fingers.add(event.pointerId);
  hover(null);
 },{signal});
 canvas.addEventListener('pointermove',event=>{
  if(fingers.size){
   if(!candidate||Math.hypot(event.clientX-candidate.x,event.clientY-candidate.y)>5){
    candidate=null;canvas.dataset.dragging='true';
   }
   return;
  }
  if(event.pointerType!=='touch')hover(event);
 },{signal});
 canvas.addEventListener('pointerleave',()=>hover(null),{signal});
 canvas.addEventListener('pointerup',event=>{
  if(candidate?.id===event.pointerId&&Math.hypot(event.clientX-candidate.x,event.clientY-candidate.y)<=5){
   const hit=pick(event);
   if(hit?.id)onSelect(hit.id);
  }
  fingers.delete(event.pointerId);candidate=null;
  canvas.dataset.dragging=String(fingers.size>0);
  if(event.pointerType!=='touch')hover(event);
 },{signal});
 canvas.addEventListener('pointercancel',event=>{
  fingers.delete(event.pointerId);candidate=null;canvas.dataset.dragging='false';hover(null);
 },{signal});
 canvas.addEventListener('keydown',event=>{
  if(event.key==='+'||event.key==='='){event.preventDefault();zoom(.79)}
  if(event.key==='-'){event.preventDefault();zoom(1.26)}
  if(event.key==='Home'){event.preventDefault();reset()}
 },{signal});

 function updateResident(time){
  const loop=(.209+time*.031)%1,point=path.getPointAt(loop),direction=path.getTangentAt(loop);
  const stride=time*2.2%1,bounce=motion?0:Math.sin(Math.PI*stride)*.295;
  const floor=groundHeight(point.x,point.z);
  resident.position.set(point.x,floor+.55+bounce,point.z);
  resident.rotation.y=Math.atan2(direction.x,direction.z);
  body.rotation.x=motion?0:Math.sin(stride*Math.PI*2)*.12;
  body.rotation.z=motion?0:.095*Math.cos(time*4.8);
  cubeHit.position.copy(resident.position);
  highlights.cube.position.set(point.x,floor+.031,point.z);
 }
 function render(now){
  frame=0;
  if(document.hidden||!inView||disposed)return;
  const delta=last?Math.min(.05,(now-last)/1000):0;
  last=now;
  elapsed+=delta;
  controls.update(delta);
  sky.position.copy(camera.position);
  updateResident(elapsed);
  for(const [id,ring] of Object.entries(highlights)){
   const visible=selected===id||hovered===id;
   ring.visible=visible;
   if(visible){
    ring.material.color.set(selected===id?'#d8ffb5':'#fff4c9');
    ring.material.opacity=selected===id?.88:.61;
   }
  }
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
 highlights.tower.position.copy(tower.position).y=.028;
 reset();
 canvas.dataset.renderer='webgl';
 wake();

 function dispose(){
  disposed=true;
  cancelAnimationFrame(frame);
  size.disconnect();viewport.disconnect();listeners.abort();controls.dispose();
  const resources=new Set();
  scene.traverse(item=>{
   if(item.geometry)resources.add(item.geometry);
   if(item.material){
    resources.add(item.material);
    if(item.material.map)resources.add(item.material.map);
   }
  });
  resources.forEach(item=>item.dispose());
  sun.shadow.dispose();
  renderer.dispose();renderer.forceContextLoss();
 }
 return {select,setCube,panMode,zoom,reset,dispose};
}
