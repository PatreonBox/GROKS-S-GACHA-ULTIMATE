import * as THREE from 'three';
import {makeKingdomCube} from './kingdom-cubes.js';

const portraitSize=224;
const cameraAngle=new THREE.Vector3(1.45,1.12,3.55).normalize();

function placeLight(scene,color,intensity,x,y,z){
 const light=new THREE.DirectionalLight(color,intensity);
 light.position.set(x,y,z);
 scene.add(light);
}

function releaseModel(model){
 const geometries=new Set(),materials=new Set();
 model.traverse(part=>{
  if(part.geometry)geometries.add(part.geometry);
  if(part.material)for(const material of [part.material].flat())materials.add(material);
 });
 for(const geometry of geometries)geometry.dispose();
 for(const material of materials)material.dispose();
}

export function createCubePortraitRenderer(){
 const canvas=document.createElement('canvas');
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power',preserveDrawingBuffer:true});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.16;
 renderer.setClearColor(0x000000,0);
 renderer.setSize(portraitSize,portraitSize,false);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(31,1,.1,12);
 scene.add(new THREE.HemisphereLight('#f2f8ff','#5a4681',2.15));
 placeLight(scene,'#fff5e4',2.6,-2,3,4);
 placeLight(scene,'#83e6ff',2.25,3,2,-3);
 placeLight(scene,'#e3b7ff',.85,4,-1,2);
 const bounds=new THREE.Box3(),center=new THREE.Vector3(),corner=new THREE.Vector3();

 function frame(model){
  bounds.setFromObject(model);
  bounds.getCenter(center);
  camera.position.copy(center).addScaledVector(cameraAngle,3.7);
  camera.lookAt(center);
  camera.zoom=1;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  let extent=.01;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
   corner.set(x,y,z).project(camera);
   extent=Math.max(extent,Math.abs(corner.x),Math.abs(corner.y));
  }
  camera.zoom=.88/extent;
  camera.updateProjectionMatrix();
 }

 return {
  draw(cube){
   if(renderer.getContext().isContextLost())return null;
   const model=makeKingdomCube(cube);
   scene.add(model);
   try{
    frame(model);
    renderer.render(scene,camera);
    const portrait=canvas.toDataURL('image/webp',.9);
    return portrait==='data:,'?null:portrait;
   }finally{
    model.removeFromParent();
    releaseModel(model);
   }
  },
  dispose(){
   renderer.dispose();
   renderer.forceContextLoss();
  }
 };
}
