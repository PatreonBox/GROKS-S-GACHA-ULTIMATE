import {Color} from 'three';
import {makeKingdomCube} from './kingdom-cubes.js';

// Bake the equipped Kingdom model once into the drill renderer's static vertex buffer.
export function buildDrillAvatar(cube,mesh){
 const model=makeKingdomCube(cube),tint=new Color();
 for(const part of model.children){
  const {geometry,material}=part;
  try{
   const {position,color}=geometry.attributes;
   for(let i=0;i<position.count;i+=3){
    const face=[];
    for(let j=i;j<i+3;j++){
     face.push([position.getX(j)*34,position.getZ(j)*34,(position.getY(j)-.055)*34]);
    }
    tint.fromBufferAttribute(color,i).convertLinearToSRGB();
    mesh.surface(face,[tint.r,tint.g,tint.b],material.isMeshBasicMaterial?{light:1}:undefined);
   }
  }finally{geometry.dispose();material.dispose()}
 }
 return mesh;
}
