import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {groundHeight,makeHouse,makeLandscape,makeSky,makeTower,residentPath} from './kingdom-model.js';
import {makeResident} from './kingdom-cubes.js';
import {createBuildingPreview} from './building-preview.js';
import {makeResourceBubble,makeManaForge} from './mana-forge-model.js';
import {makeGemMine} from './gem-mine-model.js';
import {makeSpikeProjectile,makeSpikeShooter,makeSpikeTarget} from './spike-shooter-model.js';
import {buildingSpecs,forgeMinimum,forgeStored,gemMinePlan,housePlan,kingdomBounds,kingdomDaylight,manaIcon,manorHeight,plotTrees,visitorSlots,visitorWelcomeMs} from '../web/kingdom-rules.js';
import {spikeIcon,spikeKind,spikePlan} from '../web/kingdom-defences.js';
import {kingdomNavigation} from './kingdom-navigation.js';
import {createKingdomWalker} from './kingdom-walkers.js';
import {treeWithin} from '../web/kingdom-forest.js';
import {makeTowerConstruction} from './tower-construction.js';

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
function buildGrid({left,right,back,front}){
 const edges=[
  [left,back,right,back],[right,back,right,front],[right,front,left,front],[left,front,left,back]
 ],lines=[];
 for(let x=Math.ceil(left);x<right;x++)lines.push([x,back,x,front]);
 for(let z=Math.ceil(back);z<front;z++)lines.push([left,z,right,z]);
 const grid=new THREE.Group();
 const boundaries=new THREE.LineSegments(gridGeometry(edges),new THREE.LineBasicMaterial({color:'#d8ffe9',transparent:true,opacity:.78}));
 const tiles=new THREE.LineSegments(gridGeometry(lines),new THREE.LineBasicMaterial({color:'#e2fff1',transparent:true,opacity:.26}));
 grid.add(tiles,boundaries);tiles.visible=false;
 return {grid,tiles,boundaries};
}
function ringFor(){
 const geometry=new THREE.RingGeometry(.95,1,48);
 geometry.rotateX(-Math.PI/2);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#d8ffb5',transparent:true,opacity:.84,depthWrite:false,side:THREE.DoubleSide}));
 mesh.userData.flat=geometry.getAttribute('position').array.slice();
 mesh.frustumCulled=false;
 return mesh;
}
function skyBirds(){
 const flock=new THREE.Group(),finish=new THREE.MeshBasicMaterial({color:'#38516a',side:THREE.DoubleSide});
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,.16,0,0,-.25,.62,0,-.12],3));
 const birds=Array.from({length:5},(_,i)=>{
  const body=new THREE.Group(),wing=new THREE.Mesh(geometry,finish),other=new THREE.Mesh(geometry,finish);
  other.scale.x=-1;
  body.add(wing,other);body.scale.setScalar(.72+i*.045);flock.add(body);
  return {body,wing,other};
 });
 return {flock,animate(time,light){
  flock.visible=light>.56;
  if(!flock.visible)return;
  for(let i=0;i<birds.length;i++){
   const {body,wing,other}=birds[i],phase=time*.23-i*.19,beat=Math.sin(time*7.2-i*.7);
   body.position.set(Math.cos(phase)*20,10+i*.47+Math.sin(phase*2)*1.05,Math.sin(phase)*17-4);
   body.rotation.y=-phase;
   wing.rotation.z=beat*.72;other.rotation.z=-beat*.72;
  }
 }};
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

export function createKingdomWorld({canvas,cube,clock=Date.now,onSelect,onHover,onPlot,onCollect,onSpikeHit}){
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
 const sky=makeSky(),birds=skyBirds();
 const ambient=new THREE.HemisphereLight('#e3fcff','#8e7757',2.07);
 scene.add(sky,ambient,birds.flock);
 const sun=new THREE.DirectionalLight('#ffe5bd',2.48);
 sun.position.set(-12,17,9);
 sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);
 Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:.5,far:58});
 sun.shadow.normalBias=.038;sun.shadow.bias=-.00018;
 scene.add(sun);
 const dayPalette=['#e3fcff','#8e7757','#ffe5bd',frameColor].map(value=>new THREE.Color(value));
 const nightPalette=['#95b1ff','#30375a','#a2c1ff','#424e75'].map(value=>new THREE.Color(value));
 const lightColors=[ambient.color,ambient.groundColor,sun.color,scene.fog.color];
 let lastLight=-1;
 const loader=new THREE.TextureLoader();
 const path=residentPath(),tower=makeTower(),owner=makeResident();
 const spikeTexture=loader.load(spikeIcon);spikeTexture.colorSpace=THREE.SRGBColorSpace;
 const defences=[1,2,3,4].map(level=>makeSpikeShooter(level,spikeTexture));
 const models={house:makeHouse(),forge:makeManaForge(),'gem-mine':makeGemMine(),[spikeKind]:defences[0]};
 const improvedModels={house:makeHouse(2),forge:makeManaForge(2)},manor=makeHouse(3),windows=new Set();
 for(const model of [models.house,improvedModels.house,manor]){
  model.traverse(part=>{if(part.material?.name==='Cottage lights')windows.add(part.material)});
 }
 function bubbleFor(path){
  const icon=loader.load(path);icon.colorSpace=THREE.SRGBColorSpace;
  return makeResourceBubble(icon);
 }
 const resources={
  forge:{key:'mana',bubble:bubbleFor(manaIcon),lift:4.02,amount:forgeStored,minimum:forgeMinimum},
  'gem-mine':{key:'gems',bubble:bubbleFor('/assets/packs/gem.png'),lift:4.10,amount:(mine,now)=>gemMinePlan(mine,now).stored,minimum:1}
 };
 const bursts=[];
 const projectile=makeSpikeProjectile(spikeTexture),testTarget=makeSpikeTarget();
 projectile.visible=testTarget.visible=false;
 scene.add(projectile,testTarget);
 let testShot=null;
 let land=0,bounds=kingdomBounds(),forest=plotTrees([]),forestKey=forest.map(tree=>tree.id).join('/');
 let landscape=makeLandscape(loader,path,bounds,forest),grid=buildGrid(bounds);
 let nav,navKey='',worksite;
 const foundationMaterial=new THREE.MeshStandardMaterial({color:'#475761',roughness:.95,side:THREE.DoubleSide});
 const occupiedHomes=new Set(),openDoors=new Set();
 const residentWalk=createKingdomWalker(owner,path.getPointAt(.209),0,1,occupiedHomes);
 owner.setCube(cube);scene.add(landscape.ground,grid.grid,tower,owner.resident);
 const ghostFinish=new THREE.MeshStandardMaterial({
  color:'#6cf7b8',emissive:'#48966c',emissiveIntensity:.4,transparent:true,opacity:.52,depthWrite:false
 });
 const ghostOutline=new THREE.LineBasicMaterial({color:'#d7ffbc',transparent:true,opacity:.98});
 const ghosts={};
 for(const [kind,model] of Object.entries(models)){
  const ghost=model.clone(),{width,depth}=buildingSpecs[kind].size;
  ghost.traverse(part=>{if(part.isMesh){part.material=ghostFinish;part.castShadow=false;part.receiveShadow=false;part.renderOrder=3}});
  const foundation=new THREE.BoxGeometry(width,.035,depth),edges=new THREE.EdgesGeometry(foundation);
  foundation.dispose();
  ghost.add(new THREE.LineSegments(edges,ghostOutline));ghost.visible=false;scene.add(ghost);
  ghosts[kind]=ghost;
 }
 const picked=new Map(),structures=new Map(),guests=new Map(),proxyMaterial=new THREE.MeshBasicMaterial();
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

 function editTrees(){
  const wanted=new Set(forest.filter(tree=>treeWithin(tree,bounds)).map(tree=>tree.id));
  for(const id of picked.keys())if(id.startsWith('tree-')&&!wanted.has(id))removePicker(id);
  for(const tree of forest){
   if(!wanted.has(tree.id)||picked.has(tree.id))continue;
   const width=tree.height*.50;
   hitBox(tree.id,width,tree.height,width,.77+tree.radius).position.set(tree.x,groundHeight(tree.x,tree.z)+tree.height*.5,tree.z);
  }
 }
 function setLand(next,nextForest){
  const key=nextForest.map(tree=>tree.id).join('/'),expanded=next!==land;
  if(!expanded&&key===forestKey){editTrees();return;}
  forest=nextForest;forestKey=key;
  land=next;bounds=kingdomBounds(land);
  landscape.ground.removeFromParent();release(landscape.ground);
  landscape=makeLandscape(loader,path,bounds,forest);scene.add(landscape.ground);
  editTrees();
  if(!expanded)return;
  grid.grid.removeFromParent();release(grid.grid);
  grid=buildGrid(bounds);scene.add(grid.grid);
  const shadowSpan=bounds.right+6;
  Object.assign(sun.shadow.camera,{left:-shadowSpan,right:shadowSpan,top:shadowSpan,bottom:-shadowSpan});
  sun.shadow.camera.updateProjectionMatrix();
  setBuild(build);reset();
 }
 function setWorksite(schedule,towerLevel){
  if(worksite?.schedule.endsAt===schedule?.endsAt)return;
  const finished=worksite&&towerLevel>=(worksite.schedule.level??2)&&!schedule;
  if(worksite){worksite.site.removeFromParent();release(worksite.site);worksite=null}
  if(schedule){
   worksite={...makeTowerConstruction(),schedule};
   worksite.site.position.copy(tower.position);
   scene.add(worksite.site);
  }else if(finished){
   const point=tower.position.clone();point.y+=3.3;
   burstAt(point,true);
  }
 }
 function foundationOutline({x,z,kind,rotation},segments){
  const {width,depth}=buildingSpecs[kind].size,turn=rotation*Math.PI/2;
  const sin=Math.sin(turn),cos=Math.cos(turn);
  return Array.from({length:segments},(_,i)=>{
   const angle=i*Math.PI*2/segments,dx=Math.sin(angle)*(width/2-.04),dz=Math.cos(angle)*(depth/2-.04);
   return [x+dx*cos+dz*sin,z+dz*cos-dx*sin];
  });
 }
 function floorAt(building){
  const level=groundHeight(building.x,building.z);
  if(!resources[building.kind]&&building.kind!==spikeKind)return level;
  return Math.max(level,...foundationOutline(building,16).map(([x,z])=>groundHeight(x,z)))+.033;
 }
 function productionBase(building,level){
  const vertices=[],outline=foundationOutline(building,8);
  const edges=outline.map(([x,z])=>[[x,level-.10,z],[x,groundHeight(x,z)-.09,z]]);
  for(let i=0;i<edges.length;i++){
   const [a,b]=edges[i],[c,d]=edges[(i+1)%edges.length];
   vertices.push(...a,...b,...c,...c,...b,...d);
  }
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,foundationMaterial);
  mesh.receiveShadow=true;
  return mesh;
 }
 function setPlot(buildings,visitors,towerLevel,landLevel=0,construction=null,removedTrees=[]){
  setLand(landLevel,plotTrees(buildings,removedTrees));
  setWorksite(construction,towerLevel);
  const key=[landLevel,Boolean(construction),forestKey,...buildings.map(item=>[item.id,item.x,item.z,item.rotation].join(':'))].join('/');
  if(navKey!==key){
   nav=kingdomNavigation(bounds,buildings,forest.map(tree=>[tree.x,tree.z]),construction);navKey=key;
  }
  const towerScale=1+Math.min(4,towerLevel-1)*.115;
  tower.scale.y=towerScale;
  tower.getObjectByName('tower-upgraded-trim').visible=towerLevel>=2;
  const towerHit=picked.get('tower').mesh;towerHit.scale.y=towerScale;towerHit.position.y=3.65*towerScale;
  tower.getObjectByName('pennant').material.color.set(['#7ce5d9','#eeb852','#f17e57','#bb81eb','#ffe398'][towerLevel-1]);
  const buildingIds=new Set(buildings.map(house=>house.id));
  const visitorIds=new Set(visitors.map(guest=>guest.id));
  for(const [id,structure] of structures)if(!buildingIds.has(id)){
   if(testShot?.id===id)endTestShot();
   structure.model.removeFromParent();structure.bubble?.removeFromParent();
   if(structure.base){structure.base.removeFromParent();structure.base.geometry.dispose();}
   removePicker(structure.key);structures.delete(id);
  }
  for(const building of buildings){
   const {id,x,z,rotation,kind='house'}=building,{size,height}=buildingSpecs[kind],key=kind+':'+id;
   const level=kind===spikeKind?spikePlan(building,clock()).level:
    kind==='house'?housePlan(building,clock()).level:building.level===2?2:1,existing=structures.get(id);
   const tall=kind==='house'&&level===3?manorHeight:height;
   if(existing?.level===level&&existing.building.x===x&&existing.building.z===z&&existing.building.rotation===rotation){
    existing.building=building;continue;
   }
   if(testShot?.id===id)endTestShot();
   const template=kind===spikeKind?defences[level-1]:level===3?manor:(level===2&&improvedModels[kind])||models[kind];
   const model=template.clone(),floor=floorAt(building);
   model.position.set(x,floor,z);model.rotation.y=rotation*Math.PI/2;
   scene.add(model);
   const resource=resources[kind],door=model.getObjectByName('house-door');
   const base=resource||kind===spikeKind?productionBase(building,floor):null;
   if(base)scene.add(base);
   const hit=existing?picked.get(key).mesh:hitBox(key,size.width,height,size.depth,Math.max(size.width,size.depth)/2+.34);
   hit.position.copy(model.position);hit.position.y+=tall/2;hit.scale.y=tall/height;hit.rotation.y=model.rotation.y;
   if(existing){
    if(door&&existing.door)door.rotation.y=existing.door.rotation.y;
    existing.model.removeFromParent();
    if(existing.base){existing.base.removeFromParent();existing.base.geometry.dispose();}
    if(existing.level!==level){const point=model.position.clone();point.y+=height*.67;burstAt(point,true);}
    Object.assign(existing,{model,building,door,level,base});
    continue;
   }
   const structure={key,model,building,door,level,base,resource};
   if(resource&&onCollect){
    const bubble=resource.bubble.clone();
    bubble.visible=false;
    bubble.children[0].userData={id:resource.key+':'+id,kind,buildingId:id};
    scene.add(bubble);structure.bubble=bubble;
   }
   structures.set(id,structure);
  }
  for(const [id,walker] of guests)if(!visitorIds.has(id)){
   walker.walk.releaseHome();
   walker.resident.removeFromParent();release(walker.resident);
   removePicker('visitor:'+id);guests.delete(id);
  }
  for(const visitor of visitors){
   if(guests.has(visitor.id))continue;
   const walker=makeResident();
   walker.resident.scale.setScalar(.81);walker.setCube(visitor.skin);
   walker.hit=hitBox('visitor:'+visitor.id,1.25,1.25,1.25,.86);
   const recent=visitor.arrivedAt>0&&clock()-visitor.arrivedAt<visitorWelcomeMs;
   const spawn=recent?{x:(visitor.slot-4.5)*1.9,z:bounds.front+1.8}:
    path.getPointAt((.21+(visitor.slot+1)/(visitorSlots.length+1))%1);
   const trailX=(visitor.slot%5-2)*1.25;
   const entrance=recent?{x:trailX,z:4.25,look:{x:trailX,z:bounds.front}}:null;
   walker.walk=createKingdomWalker(walker,spawn,visitor.slot+1,.81,occupiedHomes,entrance);
   scene.add(walker.resident);guests.set(visitor.id,walker);
  }
 }

 const controls=new OrbitControls(camera,canvas);
 controls.enableDamping=true;controls.dampingFactor=.12;
 controls.minPolarAngle=.43;controls.maxPolarAngle=1.38;
 controls.minDistance=5.7;controls.maxDistance=61;
 controls.maxTargetRadius=23;
 controls.screenSpacePanning=false;
 controls.rotateSpeed=.58;controls.zoomSpeed=.75;controls.panSpeed=.70;
 controls.listenToKeyEvents(canvas);
 const offset=new THREE.Vector3(),pointer=new THREE.Vector2(),ray=new THREE.Raycaster();
 const motion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let selected='tower',hovered=null,build=null,preview=null,previewOpen=false;
 let frame=0,last=0,elapsed=0,inView=true,disposed=false,candidate=null;
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
  const scale=bounds.right/14;
  const distance=(build?(camera.aspect<.91?31:27):camera.aspect<.91?22.2:19)*scale;
  const start=new THREE.Spherical(distance,build ? .93 : 1.225,.41);
  camera.position.copy(controls.target).add(offset.setFromSpherical(start));
  controls.update();controls.saveState();
 }
 function setBuild(next){
  const starting=!build&&next;
  build=next;
  grid.boundaries.material.opacity=build ? .79 : .32;
  grid.tiles.visible=Boolean(build?.snap);
  for(const [kind,ghost] of Object.entries(ghosts))ghost.visible=Boolean(build?.kind===kind&&build.spot);
  canvas.dataset.building=String(Boolean(build));
  if(starting){hover(null);reset()}
  if(starting&&testShot)endTestShot();
  if(!build?.spot)return;
  const ghost=ghosts[build.kind];
  const {x,z,rotation}=build.spot;
  ghost.position.set(x,floorAt(build.spot)+.04,z);
  ghost.rotation.y=rotation*Math.PI/2;
  const good=!build.error;
  ghostFinish.color.set(good?(build.locked?'#a2ffe2':'#60eab9'):'#fa7680');
  ghostFinish.emissive.set(good?'#48966c':'#8a292e');
  ghostOutline.color.set(good?'#c6ffb4':'#ffa9a6');
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
  camera.updateMatrixWorld();
  ray.setFromCamera(pointer,camera);
  return {x,y};
 }
 function pick(event){
  const point=aim(event);
  if(!point)return null;
  const targets=[...picked.values()].map(item=>item.mesh).filter(mesh=>!mesh.userData.inactive);
  for(const {bubble} of structures.values())if(bubble?.visible)targets.push(bubble.children[0]);
  const object=ray.intersectObjects(targets,false)[0]?.object;
  return {...point,...object?.userData};
 }
 function plot(event,lock){
  if(build.locked)return;
  const point=aim(event)&&ray.intersectObject(landscape.surface,false)[0]?.point;
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
    if(hit?.buildingId)onCollect(hit.kind,hit.buildingId,{x:event.clientX,y:event.clientY});
    else if(hit?.id)onSelect(hit.id);
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

 function showRing(ring,id){
  const marker=picked.get(id);
  ring.visible=Boolean(marker&&!marker.mesh.userData.inactive&&!build);
  if(!ring.visible)return;
  const {x,z}=marker.mesh.position;
  const key=x+':'+z+':'+marker.radius;
  if(ring.userData.marker===key)return;
  ring.userData.marker=key;
  const positions=ring.geometry.getAttribute('position'),flat=ring.userData.flat;
  for(let i=0;i<positions.count;i++){
   const gx=x+flat[i*3]*marker.radius,gz=z+flat[i*3+2]*marker.radius;
   positions.setXYZ(i,gx,groundHeight(gx,gz)+.075,gz);
  }
  positions.needsUpdate=true;
 }
 function productionPoint(id){
  const structure=structures.get(id);
  if(!structure?.bubble)return null;
  const point=structure.model.position.clone();
  point.y+=structure.resource.lift;
  return structure.bubble.visible?structure.bubble.position.clone():point;
 }
 function productionOrigin(id){
  const point=productionPoint(id);
  if(!point)return null;
  point.project(camera);
  if(Math.abs(point.x)>1||Math.abs(point.y)>1||Math.abs(point.z)>1)return null;
  const view=canvas.getBoundingClientRect();
  return {x:view.left+(point.x+1)*view.width*.5,y:view.top+(1-point.y)*view.height*.5};
 }
 function burstAt(point,celebration=false){
  if(motion)return;
  const group=new THREE.Group(),color=celebration?'#ffe286':'#87efff',reach=celebration?2.8:1.2;
  const ring=new THREE.Mesh(new THREE.RingGeometry(.91,1,32),
   new THREE.MeshBasicMaterial({color,transparent:true,opacity:.94,depthWrite:false,side:THREE.DoubleSide}));
  const geometry=new THREE.OctahedronGeometry(.084),bright=new THREE.MeshBasicMaterial({color});
  const pale=new THREE.MeshBasicMaterial({color:celebration?'#f6b3ff':'#d9ffff'});
  const sparks=Array.from({length:celebration?20:13},(_,i)=>new THREE.Mesh(geometry,i%2?bright:pale));
  group.add(ring,...sparks);group.position.copy(point);scene.add(group);
  bursts.push({group,ring,sparks,reach,duration:celebration ? .82 : .43,start:elapsed});
 }
 function popProduction(id){
  const point=productionPoint(id);
  if(point)burstAt(point);
 }
 const spikeDirection=new THREE.Vector3(),spikeFacing=new THREE.Vector3(),spikeSide=new THREE.Vector3(),spikeBasis=new THREE.Matrix4();
 const shotCameraPoint=new THREE.Vector3(),shotCameraShift=new THREE.Vector3();
 function shotFocus(start,goal){
  camera.updateMatrixWorld();
  const nearEdge=[start,goal].some(point=>{
   shotCameraPoint.copy(point).project(camera);
   return Math.abs(shotCameraPoint.x)>.80||Math.abs(shotCameraPoint.y)>.69||Math.abs(shotCameraPoint.z)>=1;
  });
  return nearEdge?{from:controls.target.clone(),to:start.clone().lerp(goal,.5)}:null;
 }
 function centerShot(focus,ratio){
  shotCameraPoint.lerpVectors(focus.from,focus.to,ratio*ratio*(3-2*ratio));
  camera.position.add(shotCameraShift.subVectors(shotCameraPoint,controls.target));
  controls.target.copy(shotCameraPoint);
  controls.update();
 }
 function endTestShot(){
  const {barrel}=testShot;
  barrel.position.z=barrel.rotation.x=0;
  projectile.visible=testTarget.visible=false;
  testShot=null;
 }
 function fireSpike(id){
  const structure=structures.get(id),building=structure?.building;
  if(building?.kind!==spikeKind||build||testShot)return false;
  const model=structure.model,barrel=model.getObjectByName('spike-barrel');
  const start=model.localToWorld(new THREE.Vector3(0,1.19,1.20));
  const goal=model.localToWorld(new THREE.Vector3(0,1.19,4.1));
  goal.y=Math.max(start.y,groundHeight(goal.x,goal.z)+1.08);
  const damage=spikePlan(building,clock()).damage,focus=shotFocus(start,goal),lead=focus&&!motion?.23:0;
  testShot={id,barrel,start,goal,damage,focus,lead,at:elapsed,hit:false};
  projectile.position.copy(start);projectile.visible=!lead;
  testTarget.position.copy(goal);testTarget.visible=true;
  return true;
 }
 function animateSpike(){
  if(!testShot)return;
  const {id,barrel,start,goal,damage,focus,lead,at}=testShot,age=elapsed-at;
  if(focus){
   const ratio=lead?clamp(age/lead,0,1):1;
   centerShot(focus,ratio);
   testTarget.quaternion.copy(camera.quaternion);
   if(ratio<1)return;
   testShot.focus=null;
  }
  const time=Math.max(0,age-lead);
  const progress=clamp(time/.34,0,1);
  const recoil=motion?0:Math.max(0,1-time/.29)**2;
  barrel.position.z=-.23*recoil;barrel.rotation.x=-.14*recoil;
  testTarget.quaternion.copy(camera.quaternion);
  testTarget.scale.setScalar(time<.34?.85+progress*.15:Math.max(.02,1-(time-.34)/.46));
  if(!testShot.hit){
   projectile.visible=true;
   projectile.position.lerpVectors(start,goal,progress);
   projectile.position.y+=.16*Math.sin(Math.PI*progress);
   spikeDirection.subVectors(goal,start).normalize();
   spikeFacing.subVectors(camera.position,projectile.position);
   spikeFacing.addScaledVector(spikeDirection,-spikeFacing.dot(spikeDirection)).normalize();
   if(spikeFacing.lengthSq()<.001)spikeFacing.set(0,1,0);
   spikeSide.crossVectors(spikeDirection,spikeFacing).normalize();
   spikeFacing.crossVectors(spikeSide,spikeDirection);
   projectile.quaternion.setFromRotationMatrix(spikeBasis.makeBasis(spikeSide,spikeDirection,spikeFacing));
   if(progress===1){
    testShot.hit=true;projectile.visible=false;
    burstAt(goal);onSpikeHit?.(id,damage);
   }
  }
  if(time>=.8)endTestShot();
 }
 function animateProduction(now){
  for(const {bubble,building,model,resource} of structures.values()){
   if(!bubble)continue;
   const ready=!build&&resource.amount(building,now)>=resource.minimum;
   if(ready&&!bubble.visible)bubble.userData.appeared=elapsed;
   bubble.visible=ready;
   if(!ready)continue;
   bubble.position.copy(model.position);bubble.position.y+=resource.lift+(motion?0:.15*Math.sin(elapsed*3));
   const growth=motion?1:clamp((elapsed-bubble.userData.appeared)*4,0,1);
   bubble.scale.setScalar(motion?1:Math.max(.10,Math.sin(growth*Math.PI/2)*(1+.18*Math.sin(growth*Math.PI))));
  }
  for(let i=bursts.length-1;i>=0;i--){
   const {group,ring,sparks,reach,duration,start}=bursts[i],progress=clamp((elapsed-start)/duration,0,1);
   if(progress===1){group.removeFromParent();release(group);bursts.splice(i,1);continue}
   const spread=1-(1-progress)**2;
   ring.quaternion.copy(camera.quaternion);
   ring.scale.setScalar(.54+spread*reach);ring.material.opacity=.9*(1-progress)**1.6;
   sparks.forEach((spark,j)=>{
    const angle=j*2.39996,spreadOut=spread*reach*(.56+(j%5)*.11);
    spark.position.set(Math.cos(angle)*spreadOut,spreadOut*(.56*Math.sin(angle)+.46)-progress**2*.38,Math.sin(angle)*spreadOut*.53);
    spark.rotation.set(angle+progress*4,j+progress*5,angle);
    spark.scale.setScalar(Math.max(.02,(1-progress)*(1.3+j%3*.16)));
   });
  }
 }
 function lightPlot(light){
  if(lastLight===light)return;
  lastLight=light;
  sky.material.uniforms.daylight.value=light;
  lightColors.forEach((color,i)=>color.copy(nightPalette[i]).lerp(dayPalette[i],light));
  ambient.intensity=.93+1.14*light;
  sun.intensity=.64+1.84*light;
  for(const material of windows)material.emissiveIntensity=.23+.96*(1-light);
 }
 function animateCubes(delta,night){
  openDoors.clear();
  const actors=[{walk:residentWalk,hit:cubeHit,radius:.68},...[...guests.values()].map(guest=>({walk:guest.walk,hit:guest.hit,radius:.57}))];
  for(const actor of actors){
   const stay=actor.walk.position;
   const canStep=point=>actors.every(other=>{
    if(actor===other)return true;
    const spot=other.walk.position;
    if(spot.hidden)return true;
    const gap=Math.hypot(spot.x-point.x,spot.z-point.z);
    return gap>=actor.radius+other.radius||gap>=Math.hypot(spot.x-stay.x,spot.z-stay.z)+.001;
   });
   const home=actor.walk.update(nav,delta,groundHeight,motion,actor.hit,night,canStep);
   if(home)openDoors.add(home);
  }
  for(const [id,{door}] of structures){
   if(!door)continue;
   const angle=openDoors.has(id)?1.64:0;
   door.rotation.y=motion?angle:THREE.MathUtils.damp(door.rotation.y,angle,10,delta);
  }
 }
 function render(now){
  frame=0;
  if(document.hidden||!inView||disposed||previewOpen)return;
  const delta=last?Math.min(.05,(now-last)/1000):0;
  last=now;elapsed+=delta;
  controls.update(delta);
  animateSpike();
  sky.position.copy(camera.position);
  const timestamp=clock(),{light,night}=kingdomDaylight(timestamp);
  lightPlot(light);birds.animate(motion?0:elapsed,light);
  if(nav)animateCubes(delta,night);
  if(worksite){
   const {startedAt,endsAt}=worksite.schedule;
   worksite.animate(elapsed,clamp((timestamp-startedAt)/(endsAt-startedAt),0,1),motion);
  }
  animateProduction(timestamp);
  showRing(selectRing,selected);
  showRing(hoverRing,hovered===selected?null:hovered);
  renderer.render(scene,camera);
  frame=requestAnimationFrame(render);
 }
 function wake(){
  if(frame||document.hidden||!inView||disposed||previewOpen)return;
  last=0;frame=requestAnimationFrame(render);
 }
 function setBuildingPreview(canvas,kind){
  if(canvas){
   if(!preview)preview=createBuildingPreview(canvas,models[kind]);
   else {preview.setModel(models[kind]);preview.resize()}
  }
  previewOpen=Boolean(canvas);
  wake();
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
  preview?.dispose();
  scene.add(...Object.values(models),...Object.values(improvedModels),manor,...defences,...Object.values(resources).map(resource=>resource.bubble));
  release(scene);foundationMaterial.dispose();
  sun.shadow.dispose();
  renderer.dispose();renderer.forceContextLoss();
 }
 return {select,setCube:owner.setCube,setPlot,setBuild,setBuildingPreview,productionOrigin,popProduction,fireSpike,panMode,zoom,reset,dispose};
}

export {createCubePortraitRenderer} from './cube-shop-preview.js';
