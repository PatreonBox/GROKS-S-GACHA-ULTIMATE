import * as THREE from 'three';
import {batchStaticParts} from './building-geometry.js';

const amber='#ffa149';
const tau=2*Math.PI;

export function makeCampfire(level=1){
 level=THREE.MathUtils.clamp(Math.trunc(level)||1,1,4);
 const fire=new THREE.Group();
 fire.userData.campfireLevel=level;
 const hearth=new THREE.Group();fire.add(hearth);
 const stone=new THREE.IcosahedronGeometry(1,0),log=new THREE.CylinderGeometry(.082,.106,.98,6);
 const ash=new THREE.MeshStandardMaterial({color:'#312521',roughness:1});
 const rock=new THREE.MeshStandardMaterial({color:'#7f7b72',roughness:.95,flatShading:true});
 const bark=new THREE.MeshStandardMaterial({color:'#563126',roughness:1});
 const coal=new THREE.MeshStandardMaterial({color:'#492425',emissive:'#be3515',emissiveIntensity:.6,roughness:1});
 const iron=new THREE.MeshStandardMaterial({color:'#39434a',metalness:.46,roughness:.66});
 const sandstone=new THREE.MeshStandardMaterial({color:'#bda17f',roughness:.91});
 const brass=new THREE.MeshStandardMaterial({color:'#d7984c',metalness:.42,roughness:.48});
 function piece(geometry,material,x,y,z,parent=fire){
  const item=new THREE.Mesh(geometry,material);
  item.position.set(x,y,z);parent.add(item);return item;
 }
 function solid(geometry,material,x,y,z){
  const item=piece(geometry,material,x,y,z,hearth);
  item.castShadow=item.receiveShadow=true;return item;
 }
 function pole(from,to,radius,material){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),span=b.clone().sub(a);
  const mid=a.lerp(b,.5),post=solid(new THREE.CylinderGeometry(radius,radius,span.length(),6),
   material,mid.x,mid.y,mid.z);
  post.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),span.normalize());
 }
 piece(new THREE.CylinderGeometry(.60,.59,.12,12),ash,0,.065,0).receiveShadow=true;
 if(level===1){
  for(let i=0;i<10;i++){
   const a=i*tau/10,dist=.638+.018*Math.sin(i*31);
   const rim=solid(stone,rock,dist*Math.cos(a),.15,dist*Math.sin(a));
   rim.rotation.set(i*.86,i*1.13,i*.72);
   rim.scale.set(.21,.16+.031*Math.cos(i*4),.175);
  }
 }else{
  for(let row=0;row<2;row++)for(let i=0;i<12;i++){
   const a=(i+row*.5)*tau/12;
   const brick=solid(new THREE.BoxGeometry(.338,.13,.18),row?sandstone:rock,
    .64*Math.sin(a),.083+row*.145,.64*Math.cos(a));
   brick.rotation.y=a;
  }
  const binding=solid(new THREE.TorusGeometry(.718,.021,5,24),iron,0,.175,0);
  binding.rotation.x=Math.PI/2;
 }
 for(let i=0;i<3;i++){
  const branch=solid(log,bark,0,.17+i*.071,0);
  branch.rotation.set(0,i*Math.PI/3,1.49,'YXZ');
  branch.castShadow=true;
 }
 if(level===3){
  for(let i=0;i<3;i++){
   const angle=tau*i/3+Math.PI;
   pole([.72*Math.sin(angle),.15,.72*Math.cos(angle)],[0,1.50,0],.048,iron);
  }
  solid(new THREE.SphereGeometry(.082,8,6),brass,0,1.50,0);
  pole([0,1.49,0],[0,1.30,0],.019,iron);
  const bail=solid(new THREE.TorusGeometry(.215,.020,6,12,Math.PI),iron,0,1.08,0);
  bail.rotation.y=.46;
  solid(new THREE.CylinderGeometry(.222,.15,.245,12),iron,0,.968,0);
  solid(new THREE.CylinderGeometry(.245,.23,.043,12),brass,0,1.09,0);
 }else if(level===4){
  for(let i=0;i<4;i++){
   const angle=Math.PI/4+tau*i/4,x=Math.sin(angle),z=Math.cos(angle);
   const foot=[.70*x,.20,.70*z],shoulder=[.57*x,.99,.57*z],tip=[.25*x,1.30,.25*z];
   pole(foot,shoulder,.064,iron);pole(shoulder,tip,.052,brass);
   solid(new THREE.OctahedronGeometry(.085),brass,...shoulder);
  }
  const crown=solid(new THREE.TorusGeometry(.249,.045,6,8),brass,0,1.31,0);
  crown.rotation.x=Math.PI/2;
  const jewel=new THREE.MeshStandardMaterial({color:'#ffdd73',emissive:'#ff8422',emissiveIntensity:1.05});
  solid(new THREE.OctahedronGeometry(.207),jewel,0,1.49,0).scale.y=1.38;
 }
 batchStaticParts(hearth);
 for(let i=0;i<6;i++){
  const a=i*tau/6;
  piece(stone,coal,.24*Math.cos(a),.29,.24*Math.sin(a)).scale.setScalar(.11);
 }
 const flames=new THREE.Group(),embers=new THREE.Group();
 flames.name='campfire-flames';embers.name='campfire-embers';
 flames.position.y=level===1?.29:.34;fire.add(flames,embers);
 const flameShape=new THREE.ConeGeometry(.24,.66,5);
 const finishes=['#ec5e25',amber,'#ffe4a0'].map(color=>new THREE.MeshBasicMaterial({color,toneMapped:false}));
 for(let i=0;i<5;i++){
  const a=i*tau/5;
  const tongue=piece(flameShape,finishes[i%3],.15*Math.cos(a),.29,.15*Math.sin(a),flames);
  tongue.rotation.z=.37*Math.cos(a);tongue.rotation.x=-.34*Math.sin(a);
  tongue.scale.setScalar(.73+(i%3)*.14);
 }
 piece(flameShape,finishes[2],0,.40,0,flames).scale.set(.76,1.02,.76);
 for(let i=0;i<6;i++)piece(stone,finishes[1],0,0,0,embers).scale.setScalar(.023+i%3*.011);
 const glow=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{strength:{value:.15}},
  vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 p;uniform float strength;void main(){gl_FragColor=vec4(1.,.30,.07,pow(max(0.,1.-length(p)),2.)*strength);}'});
 const heat=piece(new THREE.PlaneGeometry(6.4,6.4),glow,0,.043,0);
 heat.name='campfire-glow';heat.rotation.x=-Math.PI/2;
 return fire;
}

export function campfireMotion(model){
 const flames=model.getObjectByName('campfire-flames'),embers=model.getObjectByName('campfire-embers');
 const glow=model.getObjectByName('campfire-glow');
 // Each fire casts its own glow while the flame and log materials stay shared.
 glow.material=glow.material.clone();
 const flameHeight=model.userData.campfireLevel===3 ? .83 : 1;
 return {glow,animate(t,light,reduced){
  const flicker=reduced?1:.92+.11*Math.sin(t*8)+.06*Math.sin(t*13.4);
  flames.scale.set(reduced?1:.98+.08*Math.sin(t*7),flicker*flameHeight,reduced?1:1+.07*Math.sin(t*9));
  flames.rotation.y=reduced?0:.25*Math.sin(t*4.4);
  glow.material.uniforms.strength.value=(.12+(1-light)*.59)*flicker;
  embers.visible=!reduced;
  if(!reduced)embers.children.forEach((spark,i)=>{
   const phase=(t*.57+i/6)%1,a=i*2.4+t*.8;
   spark.position.set(Math.cos(a)*(.08+phase*.42),.42+phase*1.39,Math.sin(a)*(.08+phase*.42));
   spark.visible=phase<.88;
  });
 }};
}
