import * as THREE from 'three';

const amber='#ffa149';
const tau=2*Math.PI;

export function makeCampfire(){
 const fire=new THREE.Group();
 const stone=new THREE.IcosahedronGeometry(1,0),log=new THREE.CylinderGeometry(.082,.106,.98,6);
 const ash=new THREE.MeshStandardMaterial({color:'#312521',roughness:1});
 const rock=new THREE.MeshStandardMaterial({color:'#7f7b72',roughness:.95,flatShading:true});
 const bark=new THREE.MeshStandardMaterial({color:'#563126',roughness:1});
 const coal=new THREE.MeshStandardMaterial({color:'#492425',emissive:'#be3515',emissiveIntensity:.6,roughness:1});
 function piece(geometry,material,x,y,z,parent=fire){
  const item=new THREE.Mesh(geometry,material);
  item.position.set(x,y,z);parent.add(item);return item;
 }
 piece(new THREE.CylinderGeometry(.60,.59,.12,12),ash,0,.065,0).receiveShadow=true;
 for(let i=0;i<10;i++){
  const a=i*tau/10,dist=.638+.018*Math.sin(i*31);
  const rim=piece(stone,rock,dist*Math.cos(a),.15,dist*Math.sin(a));
  rim.rotation.set(i*.86,i*1.13,i*.72);
  rim.scale.set(.21,.16+.031*Math.cos(i*4),.175);rim.castShadow=true;
 }
 for(let i=0;i<3;i++){
  const branch=piece(log,bark,0,.17+i*.071,0);
  branch.rotation.set(0,i*Math.PI/3,1.49,'YXZ');
  branch.castShadow=true;
 }
 for(let i=0;i<6;i++){
  const a=i*tau/6;
  piece(stone,coal,.24*Math.cos(a),.29,.24*Math.sin(a)).scale.setScalar(.11);
 }
 const flames=new THREE.Group(),embers=new THREE.Group();
 flames.name='campfire-flames';embers.name='campfire-embers';
 flames.position.y=.29;fire.add(flames,embers);
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
 return {glow,animate(t,light,reduced){
  const flicker=.92+.11*Math.sin(t*8)+.06*Math.sin(t*13.4);
  flames.scale.set(.98+.08*Math.sin(t*7),flicker,1+.07*Math.sin(t*9));
  flames.rotation.y=.25*Math.sin(t*4.4);
  glow.material.uniforms.strength.value=(.12+(1-light)*.59)*flicker;
  embers.visible=!reduced;
  if(!reduced)embers.children.forEach((spark,i)=>{
   const phase=(t*.57+i/6)%1,a=i*2.4+t*.8;
   spark.position.set(Math.cos(a)*(.08+phase*.42),.42+phase*1.39,Math.sin(a)*(.08+phase*.42));
   spark.visible=phase<.88;
  });
 }};
}
