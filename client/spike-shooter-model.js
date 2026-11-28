import * as THREE from 'three';
import {batchStaticParts} from './building-geometry.js';

const lights=['#4fe1ff','#64f2bf','#bb8bff','#ffb963'];

export function makeSpikeShooter(level=1,icon){
 const model=new THREE.Group(),barrel=new THREE.Group(),accent=lights[level-1];
 const finish=(color,options={})=>new THREE.MeshStandardMaterial({color,roughness:.68,metalness:.27,...options});
 const steel=finish('#425367'),dark=finish('#172332'),rim=finish('#6c879b');
 const bright=finish(accent,{emissive:accent,emissiveIntensity:.38,roughness:.43});
 const mark=new THREE.MeshBasicMaterial({map:icon,transparent:true,alphaTest:.15});
 function part(group,material,geometry,x,y,z){
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);mesh.castShadow=material!==mark;mesh.receiveShadow=true;group.add(mesh);
  return mesh;
 }
 const block=(group,material,x,y,z,w,h,d)=>part(group,material,new THREE.BoxGeometry(w,h,d),x,y,z);
 part(model,dark,new THREE.CylinderGeometry(1.19,1.25,.28,8),0,-.055,0);
 part(model,rim,new THREE.CylinderGeometry(1.19,1.19,.095,8),0,.116,0);
 part(model,steel,new THREE.CylinderGeometry(.92,1.15,.28,8),0,.285,0);
 for(let index=0;index<8;index++){
  const angle=index*Math.PI/4,x=Math.sin(angle),z=Math.cos(angle);
  block(model,bright,x*1.03,.30,z*1.03,.17,.10,.11).rotation.y=angle;
 }
 block(model,steel,0,.63,0,1.11,.54,1.22);
 for(const side of [-1,1]){
  block(model,steel,side*.62,.77,-.22,.36,1.03,.92).rotation.z=side*.13;
  const axle=part(model,rim,new THREE.CylinderGeometry(.255,.255,.15,8),side*.81,1.03,-.10);
  axle.rotation.z=Math.PI/2;
  block(model,bright,.91*side,1.03,-.10,.055,.15,.15).rotation.x=Math.PI/4;
  if(level>=2)block(model,level>=4?bright:rim,.92*side,.72,-.14,.10,.22,.53);
 }
 barrel.name='spike-barrel';barrel.position.y=1.19;model.add(barrel);
 block(barrel,steel,0,0,-.36,1.18,.78,1.11);
 block(barrel,dark,0,0,.48,.80,.66,1.07);
 block(barrel,steel,0,0,.976,1.10,.86,.27);
 block(barrel,new THREE.MeshBasicMaterial({color:'#0a1226'}),0,0,1.116,.73,.51,.018);
 block(barrel,bright,0,.34,.978,1.10,.065,.29);
 const crest=part(barrel,mark,new THREE.PlaneGeometry(.52,.52),0,.003,1.132);
 crest.castShadow=false;
 block(barrel,rim,0,.443,-.47,.73,.12,.59);
 block(barrel,bright,0,.523,-.47,.46,.06,.38);
 if(level>=2){
  for(const side of [-1,1]){
   const magazine=block(barrel,dark,side*.70,.12,-.42,.36,.62,.70);
   magazine.rotation.z=side*.15;
   block(barrel,rim,side*.66,.40,-.42,.39,.095,.73).rotation.z=side*.15;
   for(const z of [-.63,-.42,-.21])block(barrel,bright,side*.88,.13,z,.028,.22,.050);
  }
 }
 if(level>=3){
  for(const side of [-1,1]){
   block(barrel,rim,side*.48,.365,-.34,.21,.26,.61).rotation.z=side*.21;
   block(barrel,bright,side*.47,.48,-.34,.13,.048,.39);
   const rail=part(barrel,rim,new THREE.CylinderGeometry(.087,.095,1.05,8),side*.462,.375,.37);
   rail.rotation.x=Math.PI/2;
  }
 }
 if(level>=4){
  // A triangulated rangefinder and heatsinks distinguish the final turret from the rail upgrade.
  for(const side of [-1,1]){
   block(barrel,dark,side*.25,.50,-.63,.09,.27,.16).rotation.z=-side*.17;
   for(let i=0;i<3;i++)block(model,rim,side*.84,.55,-.42+i*.17,.28,.26,.065);
  }
  block(barrel,steel,0,.629,-.63,.75,.20,.29);
  block(barrel,bright,0,.637,-.476,.48,.09,.018);
  block(barrel,bright,0,-.31,.99,.88,.08,.28);
 }
 batchStaticParts(model);
 batchStaticParts(barrel);
 return model;
}

export function makeSpikeProjectile(icon){
 const projectile=new THREE.Group(),shape=new THREE.Shape();
 shape.moveTo(-.38,-.39);shape.lineTo(.38,-.39);shape.lineTo(0,.38);shape.closePath();
 const prism=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSegments:1,bevelSize:.016,bevelThickness:.018});
 prism.translate(0,0,-.06);
 projectile.add(new THREE.Mesh(prism,new THREE.MeshStandardMaterial({color:'#397dff',emissive:'#185bad',emissiveIntensity:.8,roughness:.4})));
 const image=new THREE.MeshBasicMaterial({map:icon,transparent:true,alphaTest:.12});
 for(const side of [-1,1]){
  const face=new THREE.Mesh(new THREE.PlaneGeometry(.83,.83),image);
  face.position.z=side*.098;face.rotation.y=side<0?Math.PI:0;
  projectile.add(face);
 }
 return projectile;
}

export function makeSpikeTarget(){
 const target=new THREE.Group(),material=color=>new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});
 for(const [inner,outer,color] of [[.46,.525,'#acfaff'],[.29,.335,'#36baff'],[0,.12,'#faffff']]){
  target.add(new THREE.Mesh(new THREE.RingGeometry(inner,outer,24),material(color)));
 }
 const dash=new THREE.BoxGeometry(.045,.18,.015),bright=material('#aef5ff');
 for(let index=0;index<4;index++){
  const mark=new THREE.Mesh(dash,bright),angle=index*Math.PI/2;
  mark.position.set(Math.sin(angle)*.60,Math.cos(angle)*.60,0);
  mark.rotation.z=-angle;target.add(mark);
 }
 return target;
}
