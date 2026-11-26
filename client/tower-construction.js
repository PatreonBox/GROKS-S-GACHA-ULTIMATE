import * as THREE from 'three';
import {cubeCatalog} from '../web/cube-catalog.js';
import {makeResident} from './kingdom-model.js';
import {poseKingdomCube} from './kingdom-walkers.js';

const turn=Math.PI*2;
const clamp=THREE.MathUtils.clamp;
const wood=new THREE.Color('#ad7045');
const crewSkins=['02','39','06'].map(id=>cubeCatalog.find(cube=>cube.id===id));

export function makeTowerConstruction(loader){
 const site=new THREE.Group();
 const timber=new THREE.MeshStandardMaterial({color:wood,roughness:.88});
 const ends=new THREE.MeshStandardMaterial({color:'#774629',roughness:.94});
 const striped=new THREE.MeshStandardMaterial({color:'#f5a64a',roughness:.69,flatShading:true});
 const pale=new THREE.MeshStandardMaterial({color:'#fff2c9',roughness:.78});
 const iron=new THREE.MeshStandardMaterial({color:'#7a8999',metalness:.24,roughness:.52});
 const hat=new THREE.MeshStandardMaterial({color:'#fbd65b',roughness:.48});
 const spark=new THREE.MeshBasicMaterial({color:'#ffeb9e'});
 function add(parent,geometry,material,x,y,z){
  const part=new THREE.Mesh(geometry,material);
  part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;
  parent.add(part);return part;
 }
 const block=(parent,mat,x,y,z,w,h,d)=>add(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
 function rung(from,to,width,finish=timber){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),line=b.clone().sub(a),mid=a.lerp(b,.5);
  const bar=block(site,finish,mid.x,mid.y,mid.z,width,line.length(),width);
  bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),line.normalize());
 }
 for(const x of [-1.62,1.62])for(const z of [-1.38,1.73]){
  block(site,ends,x,.03,z,.31,.13,.32);
  block(site,timber,x,2.04,z,.16,4.04,.16);
  block(site,iron,x,2.43,z,.21,.11,.21);
 }
 for(const x of [-1.62,1.62]){
  rung([x,.32,-1.38],[x,2.36,1.73],.095);
  rung([x,.32,1.73],[x,2.36,-1.38],.095);
  rung([x,2.36,-1.38],[x,3.84,1.73],.085);
 }
 for(const y of [1.10,2.28,3.56]){
  for(const z of [-1.38,1.73])block(site,ends,0,y,z,3.51,.14,.17);
  for(const x of [-1.62,1.62])block(site,ends,x,y,.16,.17,.14,3.19);
 }
 for(let i=0;i<5;i++)block(site,timber,0,2.25,1.47+i*.17,3.55,.13,.15);
 for(const x of [-1.67,-1.30])rung([x,.08,2.24],[x,2.33,1.88],.078);
 for(let i=0;i<=7;i++)block(site,timber,-1.485,.23+i*.27,2.21-i*.044,.51,.09,.11);
 for(const x of [-2.1,2.1]){
  add(site,new THREE.ConeGeometry(.22,.52,12),striped,x,.30,2.49);
  add(site,new THREE.CylinderGeometry(.125,.157,.08,12),pale,x,.32,2.49);
  block(site,ends,x,.04,2.49,.43,.08,.43);
 }
 for(const z of [1.94,2.25]){
  block(site,ends,2.02,.27,z,.62,.52,.31);
  block(site,timber,2.02,.55,z,.63,.07,.35);
  block(site,pale,2.02,.29,z+.165,.43,.075,.025);
 }
 const rail=block(site,striped,1.08,.57,2.69,1.15,.24,.11);
 rail.rotation.z=-.06;
 for(let i=0;i<3;i++)block(rail,pale,(i-1)*.34,.01,.061,.14,.22,.021).rotation.z=.36;
 for(const x of [.52,1.62])block(site,timber,x,.26,2.69,.08,.50,.10);

 const workers=crewSkins.map(cube=>{
  const person=makeResident(loader);person.setCube(cube);
  person.resident.scale.setScalar(.62);
  add(person.body,new THREE.CylinderGeometry(.43,.45,.065,14),hat,0,.56,0);
  add(person.body,new THREE.SphereGeometry(.34,14,8,0,turn,0,Math.PI/2),hat,0,.58,0);
  site.add(person.resident);return person;
 });
 const hammer=new THREE.Group();site.add(hammer);
 block(hammer,timber,0,.21,0,.08,.46,.08);
 block(hammer,iron,0,.47,0,.36,.17,.15);
 const boards=block(site,timber,0,.75,2.20,.92,.14,.25);
 const sparks=Array.from({length:8},()=>add(site,new THREE.OctahedronGeometry(.065),spark,0,0,0));
 const repairs=Array.from({length:4},(_,i)=>block(site,ends,1.46,2.46+i*.11,-.18,.25,.08,.66));

 function animate(time,progress,reduced){
  const strike=reduced ? .35 : (time*1.25)%1;
  const [mason,carrier,climber]=workers;
  mason.resident.position.set(.74,2.65,1.65);
  mason.resident.rotation.y=2.75;
  poseKingdomCube(mason.body,'knock',time*.62,reduced);
  hammer.position.set(.96,2.81,1.58);
  hammer.rotation.x=.48-2.08*Math.sin(Math.PI*strike)**2;
  hammer.rotation.z=.19*Math.sin(strike*turn);

  const crossing=reduced ? .27 : .5-.5*Math.cos(time*.68);
  carrier.resident.position.set(-1.24+2.51*crossing,.34,2.27);
  carrier.resident.rotation.y=Math.sin(time*.68)>=0?Math.PI/2:-Math.PI/2;
  poseKingdomCube(carrier.body,'trot',time*.72,reduced);
  boards.position.set(carrier.resident.position.x,.75+carrier.body.position.y*.52,2.27);
  boards.rotation.z=.10*Math.sin(time*5);

  const climb=reduced ? .64 : .5-.5*Math.cos(time*.56+.9);
  climber.resident.position.set(-1.48,.38+1.91*climb,2.45-.46*climb);
  climber.resident.rotation.y=Math.PI;
  poseKingdomCube(climber.body,'skip',time*.86,reduced);
  if(reduced)boards.rotation.z=0;
  for(let i=0;i<sparks.length;i++){
   const particle=sparks[i],age=clamp((strike-.71)*3.45,0,1),angle=turn*i/sparks.length;
   particle.visible=!reduced&&strike>.71;
   particle.position.set(.57+Math.cos(angle)*age*.85,2.72+age*.51,1.21+Math.sin(angle)*age*.65);
   particle.scale.setScalar(Math.max(.03,1-age));
   particle.rotation.set(angle+age,age*2,angle);
  }
  repairs.forEach((board,i)=>board.visible=progress>(i+1)/5);
 }
 return {site,animate};
}
