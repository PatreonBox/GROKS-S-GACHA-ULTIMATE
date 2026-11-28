import * as THREE from 'three';
import {makeHouse} from './kingdom-model.js';
import {makeResident} from './kingdom-cubes.js';
import {makeKingdomComputer,animateKingdomComputer} from '../web/kingdom-computer-art.js';
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
export function createHouseInterior(renderer){
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,38);
 scene.background=new THREE.Color('#26383d');
 scene.fog=new THREE.Fog('#26383d',8,22);
 camera.position.set(2.32,4.57,4.72);
 camera.lookAt(0,.65,.04);camera.updateMatrixWorld();
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
 ground.renderOrder=-3;ground.rotation.x=-Math.PI/2;ground.position.y=-.29;ground.receiveShadow=true;
 const positionGrid=makePlacementGrid();
 scene.add(ground,daylight,sunlight,bounce,positionGrid.grid);
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),intersection=new THREE.Vector3();
 const gridPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-floor);
 const occupant=makeResident(renderer.software);
 let shell,houseLevel=0,station,stationLevel=0,selectedCell=null,placing=false,playing=false,seed='';
 let lastWidth=0,lastHeight=0,dirty=true,lastReducedMotion;

 function set({house,cell=null,rotation=0,level=1,skin=null,playing:isPlaying=false,placing:isPlacing=false}){
  dirty=true;
  const nextLevel=house?.level===3?3:house?.level===2?2:1;
  if(nextLevel!==houseLevel){
   if(shell)releaseObject(shell);
   shell=makeHouse(nextLevel,{cutaway:true});
   scene.add(shell);houseLevel=nextLevel;
  }
  selectedCell=Number.isInteger(cell)&&cell>=0&&cell<columns*rows?cell:null;
  placing=Boolean(isPlacing);
  positionGrid.grid.visible=placing;
  if(placing)positionGrid.mark(selectedCell);
  const hasComputer=selectedCell!==null;
  const nextComputer=level===2?2:1;
  if(hasComputer&&nextComputer!==stationLevel){
   occupant.resident.removeFromParent();
   if(station)releaseObject(station);
   station=makeKingdomComputer(nextComputer);
   station.scale.setScalar(.70);
   station.getObjectByName('computer-seat').add(occupant.resident);
   scene.add(station);stationLevel=nextComputer;
  }
  if(!station)return;
  station.visible=hasComputer;
  if(!hasComputer)return;
  const column=selectedCell%columns,row=Math.floor(selectedCell/columns);
  station.position.set((column-1)*cellWidth,floor,(row-.5)*cellDepth);
  station.rotation.y=rotation*Math.PI/2;
  playing=Boolean(isPlaying&&skin?.id);
  occupant.resident.visible=playing;
  if(playing)occupant.setCube(skin);
  seed=String(house?.id??'')+'/'+String(skin?.id??'');
 }

 function render(width,height,seconds,reducedMotion){
  if(!width||!height)return;
  if(width!==lastWidth||height!==lastHeight){
   const aspect=width/height,half=Math.max(1.70,2.23/aspect);
   camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
   camera.updateProjectionMatrix();
   lastWidth=width;lastHeight=height;dirty=true;
  }
  if(!dirty&&reducedMotion===lastReducedMotion&&(!station?.visible||!playing||reducedMotion))return;
  if(station?.visible)animateKingdomComputer(station,playing?occupant.body:null,seconds,seed,reducedMotion);
  renderer.render(scene,camera);
  dirty=false;lastReducedMotion=reducedMotion;
 }

 function pick(ndcX,ndcY){
  pointer.set(ndcX,ndcY);ray.setFromCamera(pointer,camera);
  if(station?.visible){
   station.updateWorldMatrix(true,true);
   // A hidden reaction mesh or a vacant seat must not intercept a click.
   const parts=[];
   station.traverseVisible(part=>{if(part.isMesh)parts.push(part)});
   const first=ray.intersectObjects(parts,false)[0];
   if(first){
    if(placing)return {kind:'cell',cell:selectedCell};
    for(let node=first.object;node;node=node.parent)if(node===occupant.resident)return {kind:'resident'};
    return {kind:'computer'};
   }
  }
  if(!placing||!ray.ray.intersectPlane(gridPlane,intersection))return null;
  const col=Math.floor((intersection.x+floorWidth/2)/cellWidth);
  const row=Math.floor((intersection.z+floorDepth/2)/cellDepth);
  return col>=0&&col<columns&&row>=0&&row<rows?{kind:'cell',cell:row*columns+col}:null;
 }

 function dispose(){
  releaseObject(occupant.resident);
  releaseObject(scene);
  sunlight.shadow.dispose();
 }
 return {set,render,pick,dispose};
}
