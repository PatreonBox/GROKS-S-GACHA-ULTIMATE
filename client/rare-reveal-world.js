import * as THREE from 'three';

const tau=Math.PI*2;
const clamp=(n,lo=0,hi=1)=>Math.min(hi,Math.max(lo,n));
const ease=t=>t*t*(3-2*t);
const palettes={
 slit:{shadow:0x0a1c46,accent:0x67f1ff,metal:0x294077,count:22},
 prism:{shadow:0x2d134c,accent:0x83eaff,metal:0x52428e,count:30},
 starfall:{shadow:0x38182d,accent:0xff9862,metal:0x976247,count:36},
 eclipse:{shadow:0x3e0d28,accent:0xff7148,metal:0x4b223c,count:43},
 singularity:{shadow:0x160c4f,accent:0x48c7ff,metal:0x374b9c,count:52},
 horizon:{shadow:0x211054,accent:0xffce7c,metal:0x6b5a9d,count:60}
};

function seeded(seed){
 return ()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/0x100000000);
}
function place(parent,object,x=0,y=0,z=0){
 object.position.set(x,y,z);parent.add(object);return object;
}
function mesh(parent,geometry,material,x,y,z){
 return place(parent,new THREE.Mesh(geometry,material),x,y,z);
}
function glowTexture(){
 const size=48,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const distance=Math.hypot((x+.5)/size-.5,(y+.5)/size-.5)*2,offset=(y*size+x)*4;
  data.set([255,255,255,Math.round(Math.max(0,Math.exp(-6*distance*distance)-.003)*255)],offset);
 }
 const texture=new THREE.DataTexture(data,size,size);
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;
 texture.needsUpdate=true;return texture;
}
function stars(parent,texture,ink,accent,rng){
 const field=new THREE.Group();parent.add(field);
 for(let layer=0;layer<3;layer++){
  const points=[],colors=[],color=new THREE.Color();
  for(let i=0;i<[320,220,87][layer];i++){
   points.push((rng()-.5)*(58-9*layer),(rng()-.5)*(33-5*layer),-32+layer*10-rng()*10);
   color.copy(ink).lerp(accent,rng()*.72).multiplyScalar(.48+rng()*.76);
   colors.push(color.r,color.g,color.b);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const material=new THREE.PointsMaterial({map:texture,size:[.13,.12,.15][layer],vertexColors:true,
   transparent:true,opacity:[.58,.68,.85][layer],blending:THREE.AdditiveBlending,depthWrite:false});
  field.add(new THREE.Points(geometry,material));
 }
 return field;
}

const planeVertex=`
 varying vec2 uvPoint;
 void main(){
  uvPoint=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
 }
`;

function sky(scene,shadow,accent){
 const material=new THREE.ShaderMaterial({
  transparent:true,depthTest:false,depthWrite:false,
  uniforms:{shadow:{value:shadow},accent:{value:accent},aspect:{value:1},time:{value:0},light:{value:0}},
  vertexShader:`
   varying vec2 uvPoint;
   void main(){uvPoint=uv;gl_Position=vec4(position,1.);}
  `,
  fragmentShader:`
   varying vec2 uvPoint;
   uniform vec3 shadow,accent;
   uniform float aspect,time,light;
   float grain(vec2 p){
    return fract(43758.5453*sin(dot(p,vec2(127.1,311.7))));
   }
   float mist(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(grain(i),grain(i+vec2(1,0)),f.x),mix(grain(i+vec2(0,1)),grain(i+1.),f.x),f.y);
   }
   void main(){
    vec2 p=(uvPoint-.5)*vec2(max(aspect*.83,.75),1.);
    vec2 q=mat2(.85,-.53,.53,.85)*p*5.+vec2(-.06*time,.045*time);
    float density=.59*mist(q)+.27*mist(q*2.18+7.)+.14*mist(q*4.36);
    float veil=exp(-length((p-vec2(-.09,.03))*vec2(.8,1.6)));
    float ridge=exp(-abs(p.y+.26*p.x+.08)*5.7);
    float glow=smoothstep(.25,.81,density)*(veil+ridge*.39);
    vec3 hue=mix(shadow,accent,clamp(glow*.26+light*.12,0.,1.));
    gl_FragColor=vec4(hue,veil*.12+glow*(.22+light*.3));
    #include <colorspace_fragment>
   }
  `
 });
 const background=mesh(scene,new THREE.PlaneGeometry(2,2),material);
 background.frustumCulled=false;background.renderOrder=-10;
 return material.uniforms;
}

function ringLight(parent,geometry,ink,accent,{rim=.52,flow=1}={}){
 const material=new THREE.ShaderMaterial({
  side:THREE.DoubleSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{ink:{value:ink},accent:{value:accent},rim:{value:rim},flow:{value:flow},time:{value:0},power:{value:.58}},
  vertexShader:planeVertex,
  fragmentShader:`
   varying vec2 uvPoint;
   uniform vec3 ink,accent;
   uniform float rim,flow,time,power;
   void main(){
    vec2 p=2.*uvPoint-1.;
    float distance=length(p),angle=atan(p.y,p.x);
    float r=distance-rim;
    float ripple=.65+.19*sin(angle*12.+r*56.-time*2.*flow)+.13*sin(angle*21.+r*90.+time*flow);
    float white=exp(-abs(r)*94.);
    float threads=exp(-abs(r)*21.)*(.42+.58*ripple);
    float fog=exp(-abs(r)*6.6)*.13;
    float mask=smoothstep(rim-.17,rim-.08,distance)*(1.-smoothstep(.82,1.,distance));
    float intensity=(.9*white+.65*threads+fog)*mask*power;
    if(intensity<.003)discard;
    gl_FragColor=vec4(mix(accent,ink,clamp(white*.86+ripple*.3,0.,1.)),intensity);
    #include <colorspace_fragment>
   }
  `
 });
 const disc=mesh(parent,geometry,material);
 disc.renderOrder=1;return disc;
}
function framework(parent,shape,radius,tube,frame,light){
 const group=place(parent,new THREE.Group());
 mesh(group,new THREE.TorusGeometry(radius,tube,6,shape),frame);
 const trim=mesh(group,new THREE.TorusGeometry(radius-tube*.6,tube*.24,5,shape),light,0,0,tube*.72);
 trim.rotation.z=.001;
 return group;
}
function polished(color,emissive,intensity=.22){
 return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,metalness:.28,roughness:.33,flatShading:true});
}

function firstLight({world,geometry,ink,accent,metal,glow}){
 const corridor=place(world,new THREE.Group(),0,0,-8),frame=polished(metal,accent,.12);
 const light=new THREE.MeshBasicMaterial({color:ink});
 const gates=Array.from({length:5},(_,i)=>{
  const gate=framework(corridor,4,4.1+i*.68,.13,frame,light);
  gate.position.z=-i*3.3;gate.rotation.z=Math.PI/4;
  gate.scale.set(1.42,.82,1);return gate;
 });
 const lens=glow(corridor,accent,13,2.1,0,.15,-.65,.7);
 const beam=mesh(corridor,geometry.beam,light,0,.15,-.6);
 return ({time,charge,pulse,impact})=>{
  corridor.position.z=-9+charge*4.3;
  corridor.rotation.z=(1-charge)*-.17+Math.sin(time*.42)*.038;
  gates.forEach((gate,i)=>{gate.rotation.y=(1-charge)*(.26-i*.06);gate.position.z=-i*3.3+Math.max(0,impact)*.35});
  beam.scale.set(1.5+charge*15+pulse*3,.026+pulse*.055,1);lens.material.opacity=.21+.41*charge+.24*pulse;
 };
}
function prismBreak({world,geometry,ink,accent,metal,glow,rng}){
 const chamber=place(world,new THREE.Group(),0,-.32,-4.5);
 const cold=polished(metal,accent,.20),pink=polished(0x8658be,ink,.35),light=new THREE.MeshBasicMaterial({color:ink});
 const frames=Array.from({length:3},(_,i)=>{
  const frame=framework(chamber,3,4.5+i*1.4,.16+i*.035,cold,light);
  frame.position.z=-2-i*3.6;return frame;
 });
 const glowCore=glow(chamber,ink,11,11,.1,0,-1,.5);
 const crystals=Array.from({length:20},(_,i)=>({
  object:mesh(chamber,geometry.crystal,i%3?cold:pink),angle:rng()*tau,radius:3+rng()*4,
  depth:-6+rng()*9,size:.19+rng()*.62,slope:rng()*2-1
 }));
 return ({time,charge,impact,pulse})=>{
  chamber.rotation.z=.36-charge*.36+time*.06;
  frames.forEach((frame,i)=>{
   frame.rotation.set(.16+i*.22,-.14+i*.19,i%2?Math.PI+.44:.5+i*.21);
   frame.scale.setScalar(.74+charge*.29+pulse*.075);
  });
  for(const {object,angle,radius,depth,size,slope} of crystals){
   const arc=angle+time*(.12+slope*.17),r=radius*(1.24-.32*charge)+Math.max(0,impact)*.83;
   object.position.set(Math.cos(arc)*r,Math.sin(arc)*r*.77,depth);
   object.rotation.set(angle+time,.64*time+slope,arc-.75);
   object.scale.set(size*.76,size*(1.9+slope*.42),size);
  }
  glowCore.material.opacity=.11+.42*charge+.12*pulse;
 };
}
function starfall({world,geometry,ink,accent,metal,glow,rng}){
 const sky=place(world,new THREE.Group());
 const planet=place(sky,new THREE.Group(),-4.7,-1.2,-10);
 const sun=ringLight(planet,geometry.plane,ink,accent,{rim:.43,flow:.35});
 sun.scale.setScalar(4.35);
 const rock=polished(metal,accent,.19),hot=polished(0xffa46d,ink,.71);
 const sphere=mesh(planet,geometry.planet,rock);
 sphere.scale.setScalar(1.74);
 glow(planet,accent,8,8,0,0,-.2,.5);
 const lines=Array.from({length:21},(_,i)=>{
  const meteor=place(sky,new THREE.Group());
  const stone=mesh(meteor,geometry.stone,i%3?hot:rock);
  const trail=glow(meteor, i%4?accent:ink,.65,4.1,0,1.3,0,.70);
  return {meteor,stone,trail,phase:rng(),x:(rng()-.37)*23,depth:-17+rng()*19,size:.20+rng()*.51};
 });
 return ({time,charge,pulse,span})=>{
  planet.position.x=-4.7*span;planet.rotation.y=.19+time*.09;sphere.rotation.y=time*.14;
  sun.material.uniforms.time.value=time;
  for(const {meteor,stone,trail,phase,x,depth,size} of lines){
   const fall=(phase+time*(.31+size*.18))%1;
   meteor.position.set(x-8.1*fall,8.1-16*fall,depth);
   meteor.rotation.z=-.48;
   stone.rotation.set(.55+time*1.25,phase*7,time*.83);
   stone.scale.setScalar(size*(.56+charge*.28));
   trail.material.rotation=-.48;
   trail.scale.set(.37+size,1.8+size*2.6+charge*.65,1);
   trail.material.opacity=(.38+.42*charge+.35*pulse)*Math.sin(Math.PI*fall);
  }
 };
}
function eclipse({world,geometry,ink,accent,metal,glow,rng}){
 const sky=place(world,new THREE.Group(),0,.3,-6.6);
 const star=place(sky,new THREE.Group(),3.05,1.18,-2.5);
 const disc=ringLight(star,geometry.plane,ink,accent,{rim:.59,flow:.25});disc.scale.setScalar(4.33);
 const corona=glow(star,accent,10.5,10.5,0,0,-.2,.77);
 const moon=mesh(star,geometry.planet,new THREE.MeshBasicMaterial({color:0x050309}),0,0,.40);
 moon.scale.setScalar(2.48);
 const debris=polished(metal,accent,.16);
 const rocks=Array.from({length:15},()=>({
  rock:mesh(sky,geometry.stone,debris),angle:rng()*tau,orbit:6+rng()*5,depth:-5+rng()*4,size:.16+rng()*.49
 }));
 return ({time,charge,pulse,span})=>{
  star.position.x=3.05*span;
  moon.position.x=-2.1*(1-charge);disc.material.uniforms.time.value=time;
  disc.material.uniforms.power.value=.60+charge*.31+pulse*.38;
  corona.material.opacity=.53+charge*.20+pulse*.21;
  for(const {rock,angle,orbit,depth,size} of rocks){
   const arc=angle+time*.16;
   rock.position.set(Math.cos(arc)*orbit,Math.sin(arc)*orbit*.52-1.45,depth+Math.sin(arc)*3);
   rock.rotation.set(time*.93,arc,size*10);rock.scale.setScalar(size);
  }
 };
}
function gravityWell({world,geometry,ink,accent,metal,glow,rng},horizon){
 const core=place(world,new THREE.Group(),horizon?1.4:.35,.12,-4.15);
 const voidSphere=mesh(core,geometry.planet,new THREE.MeshBasicMaterial({color:0x020208}));voidSphere.scale.setScalar(horizon?2.03:1.65);
 const rings=Array.from({length:horizon?5:3},(_,i)=>{
  const ring=ringLight(core,geometry.plane,ink,accent,{rim:.49+i*.067,flow:horizon?1.2+i*.28:-2-i*.31});
  ring.scale.setScalar((horizon?6.7:5.7)+i*.68);return ring;
 });
 const glowBehind=glow(core,accent,horizon?14:11,horizon?11:9,0,0,-2.4,.6);
 const fragment=polished(metal,accent,.24),trim=new THREE.MeshBasicMaterial({color:accent});
 const gates=horizon?Array.from({length:3},(_,i)=>{
  const frame=framework(world,4,7+i*2.2,.14,fragment,trim);
  frame.position.z=-10-i*5;return frame;
 }):[];
 const shards=Array.from({length:horizon?22:27},()=>({
  mesh:mesh(core,geometry.crystal,fragment),arc:rng()*tau,radius:2.7+rng()*6,
  depth:-2+rng()*4,size:.11+rng()*.42,bias:rng()
 }));
 return ({time,charge,pulse,span})=>{
  core.position.x=(horizon?1.4:.35)*span;
  core.position.z=-7.2+charge*3.5;core.rotation.z=(horizon?-.28:.32)+time*(horizon?-.035:.065);
  rings.forEach((ring,i)=>{
   ring.rotation.set((horizon?1.17:.80)+i*(horizon?.046:.17)-.21*(1-charge),i*.10-.22,0);
   ring.material.uniforms.time.value=time;
   ring.material.uniforms.power.value=(.93-i*.13)*(.5+.5*charge)+pulse*.28;
  });
  for(const {mesh,arc,radius,depth,size,bias} of shards){
   const spiral=arc+time*(.29+bias*.46)*(horizon?-1:1),r=radius*(1.22-.35*charge)+pulse*.64;
   mesh.position.set(Math.cos(spiral)*r,Math.sin(spiral)*r*.57,depth+Math.sin(spiral)*r*.17);
   mesh.rotation.set(spiral,depth+time,spiral+.83);
   mesh.scale.set(size,size*(2.1+bias),size);
  }
  gates.forEach((gate,i)=>{
   gate.rotation.set(.17+i*.13,.20*(1-charge),Math.PI/4+i*.11+time*.036);
   gate.position.z=-13-i*5+5*charge;
  });
  glowBehind.material.opacity=.24+charge*.24+pulse*.20;
 };
}
const scenes={
 slit:firstLight,prism:prismBreak,starfall,eclipse,
 singularity:kit=>gravityWell(kit,false),horizon:kit=>gravityWell(kit,true)
};

function impactShards(parent,geometry,ink,accent,count,rng){
 const material=polished(ink,accent,.68);
 material.transparent=true;material.depthWrite=false;
 const sparks=new THREE.InstancedMesh(geometry,material,count);
 sparks.frustumCulled=false;parent.add(sparks);
 const rays=Array.from({length:count},(_,i)=>{
  const angle=rng()*tau,spread=2.2+rng()*8,depth=-4+rng()*5,size=.02+rng()*.09;
  sparks.setColorAt(i,ink.clone().lerp(accent,rng()));
  return {x:Math.cos(angle)*spread*1.33,y:Math.sin(angle)*spread,z:depth,size,angle};
 });
 const instance=new THREE.Object3D();
 return ({impact})=>{
  sparks.visible=impact>=0&&impact<1.44;
  if(!sparks.visible)return;
  const fade=clamp(1-impact/1.44),travel=1-fade**2;
  material.opacity=fade**1.48;
  rays.forEach(({x,y,z,size,angle},i)=>{
   instance.position.set(x*travel,y*travel-impact*impact*.84,z+travel*3.7);
   instance.rotation.set(angle+impact*4,.31*i+impact*3,angle);
   instance.scale.set(size*1.28,size*(1.5+1.4*travel),size);
   instance.updateMatrix();sparks.setMatrixAt(i,instance.matrix);
  });
  sparks.instanceMatrix.needsUpdate=true;
 };
}

export function createRareRevealWorld(canvas,tier){
 const context=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});
 if(!context)return null;
 const renderer=new THREE.WebGLRenderer({canvas,context,alpha:true});
 renderer.setClearColor(0x000000,0);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.12,95);
 const world=place(scene,new THREE.Group()),p=palettes[tier.effect];
 const ink=new THREE.Color(tier.ink),accent=new THREE.Color(p.accent),shadow=new THREE.Color(p.shadow);
 const texture=glowTexture(),rng=seeded(tier.n+9376);
 const geometry={plane:new THREE.PlaneGeometry(2,2),beam:new THREE.BoxGeometry(1,1,.06),
  stone:new THREE.IcosahedronGeometry(1,0),crystal:new THREE.OctahedronGeometry(1),planet:new THREE.SphereGeometry(1,40,24)};
 const glow=(parent,color,sx,sy,x,y,z,opacity)=>{
  const material=new THREE.SpriteMaterial({map:texture,color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false});
  const sprite=place(parent,new THREE.Sprite(material),x,y,z);
  sprite.scale.set(sx,sy,1);return sprite;
 };
 const dust=stars(scene,texture,ink,accent,rng),nebula=sky(scene,shadow,accent);
 scene.add(new THREE.HemisphereLight(0xd0dcff,0x342044,1.46));
 place(scene,new THREE.DirectionalLight(0xfff3ef,2.55),4,6,4);
 place(scene,new THREE.DirectionalLight(accent,2.75),-5,-2,1);
 const animate=scenes[tier.effect]({world,geometry,ink,accent,metal:p.metal,glow,rng});
 const burst=impactShards(world,geometry.stone,ink,accent,p.count,rng);
 let width=0,height=0,disposed=false;
 function draw(age){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(!w||!h||disposed||context.isContextLost())return false;
  if(width!==w||height!==h){
   width=w;height=h;camera.aspect=w/h;camera.updateProjectionMatrix();
   renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.45,Math.sqrt(2_150_000/(w*h))));
   renderer.setSize(w,h,false);nebula.aspect.value=w/h;
  }
  const time=age/1000,charge=ease(clamp(age/tier.hit)),impact=(age-tier.hit)/1000;
  const pulse=impact>=0?Math.exp(-impact*3.35):0;
  const span=clamp(camera.aspect,.40,1);
  nebula.time.value=time;nebula.light.value=charge*.61+pulse*.39;
  dust.rotation.z=.08*(1-charge)+time*.014;dust.position.z=charge*2.4;
  camera.position.set((1-charge)*-.92,.34+(1-charge)*.48,19.4+(1-charge)*2.3+pulse*.24);
  camera.lookAt(0,0,0);
  const frame={time,charge,impact,pulse,span};
  animate(frame);burst(frame);
  renderer.render(scene,camera);return true;
 }
 return {draw,dispose(){
  if(disposed)return;disposed=true;
  const geometries=new Set(Object.values(geometry)),materials=new Set();
  scene.traverse(node=>{
   if(node.geometry)geometries.add(node.geometry);
   if(node.material)materials.add(node.material);
   if(node.isInstancedMesh)node.dispose();
  });
  for(const object of [...geometries,...materials,texture])object.dispose();
  renderer.dispose();
  if(!context.isContextLost())renderer.forceContextLoss();
 }};
}
