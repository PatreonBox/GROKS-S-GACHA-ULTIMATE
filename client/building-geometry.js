import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Batch newly built static parts. Moving tools, pickable groups and lit decals stay independent.
export function batchStaticParts(group){
 const finishes=new Map();
 for(const piece of group.children){
  if(!piece.isMesh||!piece.castShadow||piece.name||piece.children.length)continue;
  if(!finishes.has(piece.material))finishes.set(piece.material,[]);
  finishes.get(piece.material).push(piece);
 }
 for(const [finish,pieces] of finishes){
  if(pieces.length<2)continue;
  const shapes=pieces.map(piece=>{
   piece.updateMatrix();
   const shape=piece.geometry.index?piece.geometry.toNonIndexed():piece.geometry.clone();
   group.remove(piece);
   return shape.applyMatrix4(piece.matrix);
  });
  const combined=new THREE.Mesh(mergeGeometries(shapes),finish);
  combined.castShadow=combined.receiveShadow=true;
  group.add(combined);
  shapes.forEach(shape=>shape.dispose());
 }
}
