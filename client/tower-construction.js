import * as THREE from 'three';
import {cubeCatalog} from '../web/cube-catalog.js';
import {makeResident} from './kingdom-cubes.js';
import {poseKingdomCube} from './kingdom-walkers.js';
import {batchStaticParts} from './building-geometry.js';

const turn=Math.PI*2;
const crewSkins=['02','39','06'].map(id=>cubeCatalog.find(cube=>cube.id===id));

const finish=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:metalness ? .58 : .85,metalness});
function buildMaterials(){
 return {timber:finish('#b98153'),ends:finish('#764930'),striped:finish('#f5a64a'),pale:finish('#fff2c9'),
  iron:finish('#677b8c',.31),dark:finish('#34404b',.27),hat:finish('#ffcc44'),brass:finish('#d89b53',.38)};
}
function add(parent,geometry,material,x,y,z){
 const part=new THREE.Mesh(geometry,material);
 part.position.set(x,y,z);part.castShadow=part.receiveShadow=true;parent.add(part);return part;
}
const block=(parent,mat,x,y,z,w,h,d)=>add(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
function crewMember(parent,mat,index,size,software){
 const worker=makeResident(software);worker.setCube(crewSkins[index]);
 worker.resident.name='builder-'+crewSkins[index].id;worker.resident.scale.setScalar(size);
 add(worker.body,new THREE.CylinderGeometry(.47,.48,.066,12),mat.hat,0,.644,0);
 add(worker.body,new THREE.SphereGeometry(.36,12,6,0,turn,0,Math.PI/2),mat.hat,0,.665,0);
 block(worker.body,mat.pale,0,.765,0,.074,.12,.57);
 parent.add(worker.resident);return worker;
}
// In this local frame the struck face is at (0,0,0). The hammer's leading face
// meets that point at -PI/2, and the particles leave the very same point.
function strikingWorker(parent,mat,{x,y,z,heading=0,size=1,standingY=0,metal=true,software=false}){
 const station=new THREE.Group();station.position.set(x,y,z);
 station.scale.setScalar(size);station.rotation.y=heading;parent.add(station);
 const worker=crewMember(station,mat,0,.48,software);
 worker.resident.position.set(-.29,(standingY-y)/size+.254,.56);
 worker.resident.rotation.y=Math.PI-.36;
 const hammer=new THREE.Group();hammer.name='builder-hammer';
 hammer.position.set(0,.09,.35);station.add(hammer);
 block(hammer,mat.ends,0,.157,0,.044,.38,.050);
 const head=add(hammer,new THREE.CylinderGeometry(.055,.059,.18,8),mat.iron,0,.35,0);
 head.rotation.x=Math.PI/2;
 block(hammer,mat.brass,0,.267,0,.064,.046,.063);
 block(hammer,mat.pale,0,.015,0,.104,.11,.097);
 const upper=block(station,mat.striped,-.081,.030,.396,.103,.229,.111);
 upper.rotation.z=-.72;upper.rotation.x=-.39;
 const sparkGeometry=metal?new THREE.BoxGeometry(.025,.10,.024):new THREE.DodecahedronGeometry(.045,0);
 const bright=metal?new THREE.MeshBasicMaterial({color:'#ffe09b',toneMapped:false}):mat.timber;
 const flecks=Array.from({length:6},(_,i)=>{
  const bit=add(station,sparkGeometry,metal&&i%2?mat.brass:bright,0,0,0);
  bit.name='impact-fleck';bit.castShadow=false;bit.visible=false;return bit;
 });
 const smooth=t=>t*t*(3-2*t);
 return function strike(time,reduced){
  const phase=reduced ? .26 : (time*1.17)%1;
  let lift=0;
  if(phase<.50)lift=.42+1.30*smooth(phase*2);
  else if(phase<.67)lift=1.72*(1-smooth((phase-.5)/.17));
  else if(phase>.71)lift=.42*smooth((phase-.71)/.29)+.17*Math.sin(Math.PI*(phase-.71)/.29);
  hammer.rotation.x=-Math.PI/2+lift;
  worker.body.rotation.x=.07+.15*(1-lift/1.72);
  worker.body.position.y=-.025*(1-lift/1.72);
  const age=(phase-.67)/.29;
  for(let i=0;i<flecks.length;i++){
   const bit=flecks[i];bit.visible=!reduced&&age>=0&&age<1;
   if(!bit.visible)continue;
   const angle=i*2.39+.41,radius=age*(.28+(i%3)*.12);
   bit.position.set(Math.cos(angle)*radius,.012+age*(.64-age*.58),Math.sin(angle)*radius);
   bit.scale.setScalar(Math.max(.07,1-age));bit.rotation.set(age*4+i,angle,age*3+i);
  }
 };
}

export function makeTowerConstruction({software=false}={}){
 const site=new THREE.Group();
 const materials=buildMaterials(),{timber,ends,striped,pale,iron}=materials;
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

 block(site,ends,.64,2.49,1.63,.40,.35,.34);
 block(site,iron,.64,2.68,1.63,.43,.03,.35);
 batchStaticParts(site);
 const strike=strikingWorker(site,materials,{x:.64,y:2.695,z:1.63,size:.90,standingY:2.315,software});
 const carrier=crewMember(site,materials,1,.62,software),climber=crewMember(site,materials,2,.57,software);
 const boards=block(site,timber,0,.75,2.20,.92,.14,.25);
 const repairs=Array.from({length:4},(_,i)=>block(site,ends,1.46,2.46+i*.11,-.18,.25,.08,.66));

 function animate(time,progress,reduced){
  strike(time,reduced);
  const crossing=reduced ? .27 : .5-.5*Math.cos(time*.68);
  carrier.resident.position.set(-.38+1.54*crossing,.34,2.27);
  carrier.resident.rotation.y=Math.sin(time*.68)>=0?Math.PI/2:-Math.PI/2;
  poseKingdomCube(carrier.body,crossing>.85?'wobble':'trot',time*.72,reduced);
  boards.position.set(carrier.resident.position.x,.75+carrier.body.position.y*.52,2.27);
  boards.rotation.z=.10*Math.sin(time*5);

  const climb=reduced ? .64 : .5-.5*Math.cos(time*.56+.9);
  climber.resident.position.set(-1.48,.38+1.91*climb,2.45-.46*climb);
  climber.resident.rotation.y=Math.PI;
  poseKingdomCube(climber.body,'skip',time*.86,reduced);
  if(reduced)boards.rotation.z=0;
  repairs.forEach((board,i)=>board.visible=progress>(i+1)/5);
 }
 animate(0,0,false);
 return {site,animate};
}

// Front and side access differ by building. Keep the crew off the house threshold,
// the Spike Shooter's barrel and the active hearth.
const workplaces={
 house:{x:1.25,z:1.17,heading:.35,size:1,front:1.63},
 forge:{x:1.15,z:1.04,heading:.68,size:.94,front:1.73},
 'gem-mine':{x:1.60,z:1.12,heading:.74,size:1,front:1.80},
 'spike-shooter':{x:.87,z:.95,heading:.66,size:.86,front:1.39},
 campfire:{x:.65,z:.55,heading:.76,size:.66,front:1.01}
};

export function makeBuildingConstruction(kind,{software=false}={}){
 if(kind==='tower')return makeTowerConstruction({software});
 if(kind==='computer')return makeComputerConstruction({software});
 const plan=workplaces[kind];
 if(!plan)throw new Error('Unknown building for construction crew: '+kind);
 const site=new THREE.Group(),bench=new THREE.Group(),mat=buildMaterials();
 site.name=kind+'-construction';site.add(bench);
 bench.position.set(plan.x,0,plan.z);bench.rotation.y=plan.heading;bench.scale.setScalar(plan.size);
 const metal=kind!=='house',workTop=.49;
 for(const side of [-1,1]){
  const leg=block(bench,mat.ends,side*.205,.20,0,.085,.41,.26);
  leg.rotation.z=-side*.12;
 }
 block(bench,mat.timber,0,.405,0,.64,.09,.34);
 if(kind==='spike-shooter'){
  // Seat the replacement launch rail in the jaws of a small armourer's vise.
  block(bench,mat.dark,0,.459,0,.43,.018,.16);
  for(const side of [-1,1])block(bench,mat.iron,side*.18,.503,0,.065,.094,.18);
  block(bench,mat.iron,0,workTop-.014,0,.310,.028,.09);
  const spare=add(bench,new THREE.ConeGeometry(.071,.23,3),mat.brass,-.23,.502,-.076);
  spare.rotation.z=Math.PI/2;
 }else{
  block(bench,metal?mat.iron:mat.timber,0,workTop-.020,0,.52,.04,.18);
  if(metal)for(const side of [-1,1])block(bench,mat.brass,side*.19,.499,-.035,.038,.018,.038);
 }
 batchStaticParts(bench);
 const strike=strikingWorker(bench,mat,{x:0,y:workTop,z:0,metal,software});
 const carrier=crewMember(site,mat,1,.43*plan.size,software);
 const load=new THREE.Group();carrier.body.add(load);load.position.set(0,.06,.54);
 if(metal){
  block(load,mat.dark,0,0,0,.79,.30,.33);
  block(load,mat.striped,0,.16,0,.82,.055,.35);
  block(load,mat.pale,0,.22,0,.24,.069,.07);
 }else{
  for(let i=0;i<2;i++)block(load,mat.timber,0,i*.12,0,.99,.10,.20);
 }
 batchStaticParts(load);
 const braces=Array.from({length:3},(_,i)=>block(bench,mat.brass,-.19+i*.18,.391,.175,.11,.056,.028));
 function animate(time,progress,reduced){
  strike(time,reduced);
  // A short delivery run across the front apron, leaving the doorway and muzzle clear.
  const along=reduced ? .33 : .5-.5*Math.cos(time*1.12);
  carrier.resident.position.set(-plan.x*.85+plan.size*.48*along,.245*plan.size,plan.front);
  carrier.resident.rotation.y=reduced ? .8 : Math.PI/2*Math.tanh(Math.sin(time*1.12)*4);
  poseKingdomCube(carrier.body,'walk',time*.59,reduced);
  braces.forEach((brace,i)=>brace.visible=progress>=(i+1)/4);
 }
 animate(0,0,false);return {site,animate};
}

export function makeComputerConstruction({software=false}={}){
 const site=new THREE.Group(),mat=buildMaterials();
 site.name='computer-construction';
 // Both builders stand on the visitor side of the desk, flanking the chair.
 // The lead uses a folding step to reach a corner plate on the tabletop.
 const x=.454,y=.478,z=.085,size=.43,stepY=.263;
 const plate=block(site,mat.iron,x,y-.008,z,.13,.016,.071);
 for(const dx of [-.047,.047])block(plate,mat.brass,dx,.011,-.018,.011,.010,.011);
 const stepX=x-.29*size,stepZ=z+.56*size;
 block(site,mat.timber,stepX,stepY-.013,stepZ,.241,.026,.242);
 for(const dx of [-.095,.095]){
  block(site,mat.iron,stepX+dx,stepY*.5,stepZ,.018,stepY,.168);
 }
 block(site,mat.timber,stepX,.107,stepZ+.113,.22,.021,.064);
 batchStaticParts(site);
 const strike=strikingWorker(site,mat,{x,y,z,size,standingY:stepY,software});
 const helper=crewMember(site,mat,2,.18,software);
 helper.resident.position.set(-.427,.096,.297);helper.resident.rotation.y=Math.PI-.21;
 // The second worker torques a bolt on the front-left desk leg. A collar on
 // the leg locates the wrench axle even while an upgrade swaps the equipment.
 block(site,mat.dark,-.454,.216,.106,.070,.036,.096);
 const socket=add(site,new THREE.CylinderGeometry(.019,.019,.068,6),mat.brass,-.454,.216,.171);
 socket.rotation.x=Math.PI/2;
 const wrench=new THREE.Group();wrench.position.set(-.454,.216,.205);site.add(wrench);
 block(wrench,mat.iron,.053,0,0,.116,.017,.014);
 block(wrench,mat.pale,.102,0,0,.032,.032,.030);
 const tray=block(site,mat.dark,-.412,.028,.435,.18,.05,.095);
 block(tray,mat.striped,0,.029,0,.18,.011,.093);
 function animate(time,progress,reduced){
  strike(time,reduced);
  const angle=reduced?0:.37*Math.sin(time*5.6);
  wrench.rotation.z=angle;
  helper.body.rotation.x=.16+angle*.2;
  tray.rotation.y=progress<.66?-.13:.13;
 }
 animate(0,0,false);return {site,animate};
}
