import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function makeManaForge(level=1){
 const upgraded=level===2;
 const forge=new THREE.Group();
 const slate=new THREE.MeshStandardMaterial({color:'#344b58',roughness:.87,flatShading:true});
 const rim=new THREE.MeshStandardMaterial({color:'#748e91',roughness:.65,metalness:.23});
 const bronze=new THREE.MeshStandardMaterial({color:'#b48a56',roughness:.53,metalness:.49});
 const blue=new THREE.MeshStandardMaterial({color:upgraded?'#80f2ff':'#37e4fc',emissive:'#0d81d4',emissiveIntensity:upgraded?1.22:.72,roughness:.32,flatShading:true});
 function add(shape,finish,x,y,z){
  const part=new THREE.Mesh(shape,finish);part.position.set(x,y,z);
  part.castShadow=true;part.receiveShadow=true;forge.add(part);return part;
 }
 add(new THREE.CylinderGeometry(1.50,1.62,.37,8),slate,0,-.09,0);
 add(new THREE.CylinderGeometry(1.47,1.52,.12,8),rim,0,.15,0);
 add(new THREE.CylinderGeometry(1.13,1.34,.63,8),slate,0,.47,0);
 add(new THREE.CylinderGeometry(1.26,1.03,.23,8),bronze,0,.82,0);
 add(new THREE.CylinderGeometry(.86,1.02,.13,12),blue,0,.95,0);
 const ring=add(new THREE.TorusGeometry(.96,.10,8,28),rim,0,1.05,0);
 ring.rotation.x=Math.PI/2;
 for(let i=0;i<4;i++){
  const angle=Math.PI/4+i*Math.PI/2,x=1.16*Math.cos(angle),z=1.16*Math.sin(angle);
  add(new THREE.CylinderGeometry(.17,.23,.88,6),slate,x,.98,z);
  add(new THREE.CylinderGeometry(.23,.17,.15,6),bronze,x,1.45,z);
  add(new THREE.OctahedronGeometry(.18),blue,x,1.68,z).scale.y=1.36;
  const panel=add(new THREE.BoxGeometry(.27,.075,.55),blue,1.19*Math.cos(angle+.785),.36,1.19*Math.sin(angle+.785));
  panel.rotation.y=-(angle+.785);
 }
 add(new THREE.OctahedronGeometry(.67),blue,0,2.10,0).scale.set(.79,1.64,.79);
 const upper=add(new THREE.TorusGeometry(.84,.058,6,30),bronze,0,1.75,0);
 upper.rotation.set(Math.PI*.38,.33,.22);
 if(upgraded){
  const crown=add(new THREE.TorusGeometry(.89,.073,6,30),bronze,0,2.28,0);
  crown.rotation.set(Math.PI*.64,-.32,.35);
  add(new THREE.OctahedronGeometry(.26),blue,0,3.35,0).rotation.y=Math.PI/4;
 }
 const surfaces=new Map();
 for(const part of forge.children){
  part.updateMatrix();
  const geometry=part.geometry.index?part.geometry.toNonIndexed():part.geometry;
  if(geometry!==part.geometry)part.geometry.dispose();
  geometry.applyMatrix4(part.matrix);
  if(!surfaces.has(part.material))surfaces.set(part.material,[]);
  surfaces.get(part.material).push(geometry);
 }
 forge.clear();
 for(const [finish,parts] of surfaces){
  add(mergeGeometries(parts),finish,0,0,0);
  for(const part of parts)part.dispose();
 }
 return forge;
}

export function makeManaBubble(icon){
 const bubble=new THREE.Group();
 const finish=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,
  vertexShader:`
   varying vec3 normalView;
   varying vec3 facing;
   void main(){
    vec4 at=modelViewMatrix*vec4(position,1.0);
    normalView=normalize(normalMatrix*normal);
    facing=normalize(-at.xyz);
    gl_Position=projectionMatrix*at;
   }`,
  fragmentShader:`
   varying vec3 normalView;
   varying vec3 facing;
   void main(){
    vec3 n=normalize(normalView);
    float rim=pow(1.0-max(0.0,dot(n,normalize(facing))),2.25);
    float gleam=pow(max(0.0,dot(n,normalize(vec3(-.50,.65,.67)))),22.0);
    vec3 blue=mix(vec3(.17,.55,.91),vec3(.55,1.,.96),rim);
    gl_FragColor=vec4(blue+gleam*.55,.16+.65*rim+.45*gleam);
   }`
 });
 const sheen=new THREE.Mesh(new THREE.SphereGeometry(.66,24,16),finish);
 const orbs=new THREE.Sprite(new THREE.SpriteMaterial({map:icon,transparent:true,depthWrite:false}));
 orbs.scale.set(.81,.75,1);orbs.renderOrder=7;
 sheen.renderOrder=8;
 bubble.add(sheen,orbs);
 return bubble;
}
