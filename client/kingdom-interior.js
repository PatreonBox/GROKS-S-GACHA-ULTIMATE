import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeComputerConstruction} from './tower-construction.js';
import {makeHouse} from './kingdom-model.js';
import {makeResident} from './kingdom-cubes.js';
import {makeKingdomComputer,animateKingdomComputer,computerSmashSeconds,computerDismountAt} from '../web/kingdom-computer-art.js';
import {houseEntry} from '../web/kingdom-rules.js';

const columns=3,rows=2,cellWidth=.80,cellDepth=.92;
const floor=houseEntry.floor+.038;
const floorWidth=columns*cellWidth,floorDepth=rows*cellDepth;

function releaseObject(object){
 const owned=new Set();
 object.traverse(child=>{
  if(child.geometry)owned.add(child.geometry);
  if(!child.material)return;
  for(const material of Array.isArray(child.material)?child.material:[child.material]){
   owned.add(material);
   for(const value of Object.values(material))if(value?.isTexture)owned.add(value);
  }
 });
 object.removeFromParent();
 for(const resource of owned)resource.dispose();
}

function makePlacementGrid(){
 const canvas=document.createElement('canvas');
 canvas.width=720;canvas.height=552;
 const ctx=canvas.getContext('2d');
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=4;
 const grid=new THREE.Mesh(new THREE.PlaneGeometry(floorWidth,floorDepth),
  new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
 grid.material.userData.cpuTexture=true;
 grid.rotation.x=-Math.PI/2;grid.position.y=floor+.003;grid.visible=false;
 let painted;
 function mark(cell){
  if(cell===painted)return;
  painted=cell;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const width=canvas.width/columns,depth=canvas.height/rows;
  for(let i=0;i<columns*rows;i++){
   const x=i%columns*width+4,y=Math.floor(i/columns)*depth+4;
   const w=width-8,h=depth-8,active=i===cell;
   ctx.fillStyle=active?'rgba(88,236,199,.36)':'rgba(19,54,61,.23)';
   ctx.strokeStyle=active?'#afffec':'rgba(232,249,232,.68)';ctx.lineWidth=active?5:2;
   ctx.beginPath();ctx.roundRect(x,y,w,h,7);ctx.fill();ctx.stroke();
   ctx.fillStyle=active?'#153e3d':'rgba(19,35,42,.85)';
   ctx.beginPath();ctx.roundRect(x+8,y+h-45,34,35,5);ctx.fill();
   ctx.fillStyle=active?'#c4ffe9':'#f2f9ef';ctx.font='bold 24px system-ui, sans-serif';
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),x+25,y+h-27);
  }
  texture.needsUpdate=true;
 }
 return {grid,mark};
}

// The plot renderer owns the canvas and its animation loop. The room is a second
// scene on that renderer, so opening a house never consumes another WebGL context.
export function createHouseInterior(renderer,canvas=renderer.domElement,clock=Date.now){
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,38);
 scene.background=new THREE.Color('#26383d');
 scene.fog=new THREE.Fog('#26383d',8,22);
 const homeTarget=new THREE.Vector3(0,.67,.04);
 camera.position.set(2.32,4.57,4.72);
 camera.lookAt(homeTarget);camera.updateMatrixWorld();
 const controls=new OrbitControls(camera,canvas||null);
 controls.target.copy(homeTarget);controls.cursor.copy(homeTarget);
 controls.maxTargetRadius=1.42;
 controls.minPolarAngle=.20;controls.maxPolarAngle=1.4;
 controls.minZoom=.68;controls.maxZoom=3.3;
 controls.rotateSpeed=.75;controls.panSpeed=.86;controls.zoomSpeed=.90;
 controls.keyPanSpeed=20;controls.keyRotateSpeed=10;
 controls.update();controls.saveState();
 if(canvas)controls.listenToKeyEvents(canvas);
 const daylight=new THREE.HemisphereLight('#f7f2df','#b59c8a',1.87);
 const sunlight=new THREE.DirectionalLight('#ffe3bd',2.32);
 sunlight.position.set(-2.1,5.3,3.6);sunlight.castShadow=true;
 sunlight.shadow.mapSize.set(512,512);
 Object.assign(sunlight.shadow.camera,{left:-2.8,right:2.8,top:2.8,bottom:-2.8,near:.3,far:13});
 sunlight.shadow.camera.updateProjectionMatrix();
 sunlight.shadow.normalBias=.013;sunlight.shadow.bias=-.00022;
 const bounce=new THREE.DirectionalLight('#bee0f3',.63);
 bounce.position.set(3.4,2.1,-.9);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),
  new THREE.MeshStandardMaterial({color:'#31454a',roughness:.99}));
 ground.renderOrder=-24;ground.rotation.x=-Math.PI/2;ground.position.y=-.29;ground.receiveShadow=true;
 const positionGrid=makePlacementGrid();
 scene.add(ground,daylight,sunlight,bounce,positionGrid.grid);
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),intersection=new THREE.Vector3();
 const gridPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-floor);
 const occupant=makeResident(renderer.software),standing=new THREE.Group();
 scene.add(standing);standing.add(occupant.resident);occupant.resident.visible=false;
 const standingSpot=new THREE.Vector3(),departure=new THREE.Vector3(),seatSize=new THREE.Vector3();
 const standingScale=.267,standingAngle=.44,up=new THREE.Vector3(0,1,0),offset=new THREE.Vector3();
 let shell,leftWall,backWall,houseLevel=0,station,stationLevel=0,worksite,selectedCell=null,placing=false,playing=false;
 let assignedSkin=null,inside=false,replay=null,broken=null,construction=null,seed='';
 let active=true,houseId=null,lastWidth=0,lastHeight=0,dirty=true,lastReducedMotion,lastDraw=-Infinity;
 let focusedReplay=null,viewBeforeReplay=null;
 const visual={damage:null,smashTime:Infinity,constructionProgress:null,rage:0};
 function invalidate(){dirty=true;}
 controls.addEventListener('change',invalidate);

 function zoom(factor){
  if(!Number.isFinite(factor)||factor<=0)return;
  camera.zoom=THREE.MathUtils.clamp(camera.zoom/factor,controls.minZoom,controls.maxZoom);
  camera.updateProjectionMatrix();controls.update();invalidate();
 }
 function reset(){
  controls.reset();camera.updateMatrixWorld();invalidate();
 }
 function panMode(on){
  controls.mouseButtons.LEFT=on?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
  controls.touches.ONE=on?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
 }
 function keyCamera(event){
  if(!active||event.altKey||event.metaKey)return;
  switch(event.key.toLowerCase()){
   case '+': case '=': zoom(.84);break;
   case '-': case '_': zoom(1/.84);break;
   case 'home': case '0': reset();break;
   case 'a': case 'd':
    offset.subVectors(camera.position,controls.target).applyAxisAngle(up,event.key.toLowerCase()==='a'?-.16:.16);
    camera.position.copy(controls.target).add(offset);controls.update();break;
   default:return;
  }
  event.preventDefault();
 }
 canvas?.addEventListener('keydown',keyCamera);
 function setActive(next){
  next=Boolean(next);
  if(!active&&next){lastDraw=-Infinity;reset();}
  if(!next){focusedReplay=null;viewBeforeReplay=null;}
  active=next;controls.enabled=active;invalidate();
 }
 function removeWorksite(){
  if(worksite){releaseObject(worksite.site);worksite=null;}
 }
 function set(state){
  const {house,cell=null,rotation=0,level=1,skin=null}=state;
  if(!house)return;
  invalidate();
  const nextLevel=THREE.MathUtils.clamp(Math.trunc(house.level)||1,1,3);
  if(houseLevel!==nextLevel){
   if(shell)releaseObject(shell);
   shell=makeHouse(nextLevel,{cutaway:true});scene.add(shell);houseLevel=nextLevel;
   leftWall=shell.getObjectByName('room-left');backWall=shell.getObjectByName('room-back');
   if(renderer.software)shell.traverse(panel=>{if(panel.isMesh)panel.renderOrder=panel.userData.roomOrder;});
  }
  if(house.id!==houseId){
   houseId=house.id;focusedReplay=null;viewBeforeReplay=null;reset();lastDraw=-Infinity;
  }
  selectedCell=Number.isInteger(cell)&&cell>=0&&cell<columns*rows?cell:null;
  placing=Boolean(state.placing);positionGrid.grid.visible=placing;
  if(placing)positionGrid.mark(selectedCell);
  assignedSkin=skin;inside=Boolean(state.inside??skin);
  replay=state.replay||null;broken=state.broken||null;construction=state.construction||null;
  if(!replay&&viewBeforeReplay){
   controls.target.copy(viewBeforeReplay.target);camera.position.copy(viewBeforeReplay.position);
   camera.zoom=viewBeforeReplay.zoom;camera.updateProjectionMatrix();controls.update();viewBeforeReplay=null;
  }
  playing=Boolean(state.playing&&skin?.id);visual.rage=Number(state.rage)||0;
  seed=String(houseId||'')+'/'+String(skin?.id||'');
  const hasComputer=selectedCell!==null,nextComputer=level===2?2:1;
  if(hasComputer&&stationLevel!==nextComputer){
   standing.add(occupant.resident);removeWorksite();
   if(station)releaseObject(station);
   station=makeKingdomComputer(nextComputer);station.scale.setScalar(.70);
   scene.add(station);stationLevel=nextComputer;
  }
  if(station)station.visible=hasComputer;
  if(!hasComputer||!construction)removeWorksite();
  if(hasComputer){
   station.position.set((selectedCell%columns-1)*cellWidth,floor,(Math.floor(selectedCell/columns)-.5)*cellDepth);
   station.rotation.y=(Number(rotation)||0)*Math.PI/2;
   if(replay&&focusedReplay!==replay.startedAt&&Date.now()-replay.startedAt<computerSmashSeconds*1000){
    // Stage the recorded impact from the side so both the cube and its CRT are visible.
    focusedReplay=replay.startedAt;
    viewBeforeReplay??={target:controls.target.clone(),position:camera.position.clone(),zoom:camera.zoom};
    controls.target.copy(station.position);controls.target.y+=.41;
    offset.set(4.98,3.18,2.56).applyAxisAngle(up,station.rotation.y);
    camera.position.copy(controls.target).add(offset);camera.zoom=2.55;
    camera.updateProjectionMatrix();controls.update();
   }
   if(construction&&!worksite){
    worksite=makeComputerConstruction({software:Boolean(renderer.software)});station.add(worksite.site);
   }
  }
  // A resident can be in an entirely unfurnished house. Choose a clear tile
  // near the front door, or a neighbouring tile if that spot has a desk.
  const idleCell=hasComputer&&selectedCell===4?5:4;
  standingSpot.set((idleCell%columns-1)*cellWidth+.045,floor,(Math.floor(idleCell/columns)-.5)*cellDepth+.065);
 }
 function leaveSeat(seat,time,reducedMotion){
  // Hop sideways off the cushion before walking to the clear floor tile.
  const p=THREE.MathUtils.clamp((time-computerDismountAt)/1.25,0,1);
  const blend=p*p*(3-2*p);
  seat.getWorldPosition(departure);seat.getWorldScale(seatSize);
  standing.position.lerpVectors(departure,standingSpot,blend);
  if(!reducedMotion)standing.position.y+=.12*Math.sin(Math.PI*p);
  const angle=station.rotation.y+Math.PI;
  standing.rotation.y=angle+Math.atan2(Math.sin(standingAngle-angle),Math.cos(standingAngle-angle))*blend;
  standing.scale.setScalar(THREE.MathUtils.lerp(seatSize.x,standingScale,blend));
 }
 function updateRoom(seconds,reducedMotion){
  const now=clock(),replayTime=replay?(Date.now()-replay.startedAt)/1000:Infinity;
  const replaying=replayTime>=0&&replayTime<computerSmashSeconds;
  const damage=replaying?replay:broken;
  const time=damage?(replaying?replayTime:Math.max(0,(now-damage.at)/1000)):Infinity;
  const breaking=Boolean(damage&&time<computerSmashSeconds&&station?.visible);
  const progress=construction?THREE.MathUtils.clamp((now-construction.startedAt)/Math.max(1,construction.endsAt-construction.startedAt),0,1):null;
  const building=progress!==null&&progress<1;
  const skin=breaking?(damage.skin||assignedSkin):assignedSkin;
  const seated=Boolean(skin?.id&&station?.visible&&!building&&((playing&&!damage)||(breaking&&time<computerDismountAt)));
  const gettingOff=breaking&&!seated;
  const visible=Boolean(skin?.id&&(inside||seated||gettingOff));
  occupant.resident.visible=visible;
  if(visible)occupant.setCube(skin);
  const seat=station?.getObjectByName('computer-seat');
  const parent=seated?seat:standing;
  if(occupant.resident.parent!==parent)parent.add(occupant.resident);
  if(!seated&&visible){
   if(gettingOff)leaveSeat(seat,time,reducedMotion);
   else{
    standing.position.copy(standingSpot);standing.scale.setScalar(standingScale);standing.rotation.y=standingAngle;
   }
   const body=occupant.body;
   const breath=reducedMotion?0:Math.sin(seconds*2.5);
   body.scale.set(1-breath*.007,1+breath*.009,1-breath*.007);
   body.rotation.set(0,reducedMotion?0:.115*Math.sin(seconds*.75),0);
   body.position.set(0,-(body.userData.restBounds?.min.y??-.5)*body.scale.y,0);
  }
  if(station?.visible){
   visual.damage=damage;visual.smashTime=time;visual.constructionProgress=building?progress:null;
   animateKingdomComputer(station,seated?occupant.body:null,seconds,seed,reducedMotion,visual);
   if(worksite){
    worksite.site.visible=building;
    if(building)worksite.animate(seconds,progress,reducedMotion);
   }
  }
  return Boolean(breaking||building||visible&&!reducedMotion);
 }
 function render(width,height,seconds,reducedMotion=false){
  if(!active||!width||!height)return;
  if(width!==lastWidth||height!==lastHeight){
   const aspect=width/height,half=Math.max(1.70,2.23/aspect);
   camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
   camera.updateProjectionMatrix();lastWidth=width;lastHeight=height;invalidate();
  }
  if(leftWall){
   leftWall.visible=camera.position.x-controls.target.x>-.52;
   backWall.visible=camera.position.z-controls.target.z>-.52;
  }
  const animated=updateRoom(seconds,reducedMotion);
  // The plot shares this drawing buffer. A canvas resize can erase even an
  // idle cutaway after its first draw. Its resize handler also calls invalidate.
  if(renderer.software&&!dirty&&!animated&&lastReducedMotion===reducedMotion&&seconds-lastDraw<.55)return;
  renderer.render(scene,camera);
  dirty=false;lastReducedMotion=reducedMotion;lastDraw=seconds;
 }
 function pick(ndcX,ndcY){
  if(!active)return null;
  if(typeof ndcX==='object')pointer.copy(ndcX);else pointer.set(ndcX,ndcY);
  scene.updateMatrixWorld();camera.updateMatrixWorld();ray.setFromCamera(pointer,camera);
  if(placing){
   if(!ray.ray.intersectPlane(gridPlane,intersection))return null;
   const col=Math.floor((intersection.x+floorWidth/2)/cellWidth),row=Math.floor((intersection.z+floorDepth/2)/cellDepth);
   return col>=0&&col<columns&&row>=0&&row<rows?{kind:'cell',cell:row*columns+col}:null;
  }
  const parts=[];
  const add=part=>{if(part.isMesh)parts.push(part);};
  if(station?.visible)station.traverseVisible(add);
  if(occupant.resident.visible&&occupant.resident.parent===standing)occupant.resident.traverseVisible(add);
  const hits=ray.intersectObjects(parts,false);
  const first=hits[0]?.object;
  if(!first)return null;
  const belongsToResident=object=>{
   for(let node=object;node;node=node.parent)if(node===occupant.resident)return true;
   return false;
  };
  // The back rail can cross a seated cube's silhouette from the doorway.
  // A click through that rail onto the cube should select its resident.
  if(belongsToResident(first)||first.name==='computer-chair'&&hits.some(hit=>belongsToResident(hit.object)))return {kind:'resident'};
  return {kind:'computer'};
 }
 function dispose(){
  controls.removeEventListener('change',invalidate);
  if(canvas){controls.dispose();canvas.removeEventListener('keydown',keyCamera);}
  removeWorksite();releaseObject(scene);sunlight.shadow.dispose();
 }
 return {set,setActive,render,pick,zoom,reset,panMode,invalidate,dispose};
}
