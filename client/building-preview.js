import * as THREE from 'three';
import {kingdomRenderer} from './kingdom-renderer.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function createBuildingPreview(canvas,building){
 const renderer=kingdomRenderer(canvas,{alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.8));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.12;

 const scene=new THREE.Scene();
 let model=building.clone(),source=building;
 const camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,32);
 camera.position.set(5.8,4.5,8.5);
 const sun=new THREE.DirectionalLight('#ffe5c5',2.75);
 sun.position.set(-4,7,5);
 scene.add(model,new THREE.HemisphereLight('#e8f9ff','#82705a',2),sun);
 const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(2.29,2.05,.42,10),
  new THREE.MeshStandardMaterial({color:'#686153',roughness:.94}));
 pedestal.position.y=-.50;
 const turf=new THREE.Mesh(new THREE.CylinderGeometry(2.25,2.29,.14,10),
  new THREE.MeshStandardMaterial({color:'#64865b',roughness:1}));
 turf.position.y=-.22;
 scene.add(pedestal,turf);

 const controls=new OrbitControls(camera,canvas);
 controls.target.set(0,1.27,0);
 controls.enablePan=false;
 controls.enableZoom=false;
 controls.minPolarAngle=.55;
 controls.maxPolarAngle=1.47;
 controls.rotateSpeed=.65;
 controls.update();
 const render=()=>renderer.render(scene,camera);
 controls.addEventListener('change',render);
 function resize(){
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!width||!height)return;
  const aspect=width/height,halfHeight=2.58/Math.min(1,aspect);
  camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;
  camera.top=halfHeight;camera.bottom=-halfHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
  render();
 }
 function setModel(next){
  if(next===source)return;
  source=next;
  model.removeFromParent();model=source.clone();scene.add(model);
  render();
 }
 const size=new ResizeObserver(resize);
 size.observe(canvas);
 const listeners=new AbortController();
 const offset=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 canvas.addEventListener('keydown',event=>{
  if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
  event.preventDefault();
  offset.subVectors(camera.position,controls.target).applyAxisAngle(up,event.key==='ArrowLeft'?.26:-.26);
  camera.position.copy(controls.target).add(offset);
  controls.update();
 },{signal:listeners.signal});
 resize();
 canvas.dataset.buildingRenderer=canvas.dataset.renderer;
 return {resize,setModel,dispose(){
  delete canvas.dataset.buildingRenderer;
  listeners.abort();size.disconnect();controls.dispose();
  for(const base of [pedestal,turf]){
   base.geometry.dispose();base.material.dispose();
  }
  renderer.dispose();renderer.forceContextLoss?.();
 }};
}
