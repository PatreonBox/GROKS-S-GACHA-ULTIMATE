import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {houseEntry,houseSize,towerPlot,trailCorners} from '../web/kingdom-rules.js';

const vertex=(x,y,z)=>new THREE.Vector3(x,y,z);
const material=(color,options={})=>new THREE.MeshStandardMaterial({color,roughness:.9,...options});
const tau=2*Math.PI;

function randomFor(seed){
 let state=seed>>>0;
 return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
}
function meshAt(group,geometry,finish,x,y,z,shadow=true){
 const mesh=new THREE.Mesh(geometry,finish);
 mesh.position.set(x,y,z);
 mesh.castShadow=shadow;mesh.receiveShadow=true;
 group.add(mesh);
 return mesh;
}
function cylinder(group,top,bottom,height,finish,x,y,z,sides=8){
 const mesh=meshAt(group,new THREE.CylinderGeometry(top,bottom,height,sides),finish,x,y,z);
 mesh.rotation.y=Math.PI/sides;
 return mesh;
}

export function makeSky(){
 const finish=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,
  uniforms:{
   zenith:{value:new THREE.Color('#287bcc')},horizon:{value:new THREE.Color('#c7eaf1')},
   cloudTint:{value:new THREE.Color('#f9fbef')},sunDirection:{value:vertex(-.65,.43,.52).normalize()},
   nightZenith:{value:new THREE.Color('#0d153d')},nightHorizon:{value:new THREE.Color('#405d8a')},
   duskTint:{value:new THREE.Color('#f7b283')},moonDirection:{value:vertex(-.48,.26,-.83).normalize()},
   daylight:{value:1}
  },
  vertexShader:`
   varying vec3 direction;
   void main(){
    direction=position;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
   }`,
  fragmentShader:`
   varying vec3 direction;
   uniform vec3 zenith,horizon,cloudTint,sunDirection;
   uniform vec3 nightZenith,nightHorizon,duskTint,moonDirection;
   uniform float daylight;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
   }
   void main(){
    vec3 ray=normalize(direction);
    float h=max(0.,ray.y);
    float blend=pow(clamp(h/.40,0.,1.),.52);
    float dusk=4.*daylight*(1.-daylight);
    vec3 low=mix(nightHorizon,horizon,daylight);
    vec3 color=mix(mix(low,duskTint,.33*dusk),mix(nightZenith,zenith,daylight),blend);
    float sun=max(0.,dot(ray,sunDirection));
    color=mix(color,cloudTint,daylight*(.24*pow(sun,18.)+.68*smoothstep(.9983,.9997,sun)));
    float moon=max(0.,dot(ray,moonDirection));
    float shadow=smoothstep(.99925,.99939,dot(ray,normalize(moonDirection+vec3(.013,.006,-.004))));
    float crescent=smoothstep(.99925,.99939,moon)*(1.-shadow);
    color+=vec3(.48,.64,1.)*(1.-daylight)*(.10*pow(moon,112.)+.9*crescent);
    vec2 field=vec2(atan(ray.z,ray.x)*44.,ray.y*99.);
    float star=hash(floor(field));
    float point=1.-smoothstep(.03,.15,length(fract(field)-vec2(star,hash(floor(field)+8.))));
    color+=vec3(.58,.74,1.)*point*step(.91,star)*smoothstep(.035,.24,h)*pow(1.-daylight,3.);
    vec2 p=ray.xz/max(.085,h)*vec2(1.1,.78)+vec2(3.9,19.8);
    float cloud=noise(p)*.59+noise(p*2.05)*.26+noise(p*4.15)*.11+noise(p*8.4)*.04;
    float wisps=smoothstep(.42,.68,cloud)*smoothstep(.015,.125,h);
    color=mix(color,mix(vec3(.022,.042,.096),cloudTint,daylight),wisps*(.25+.69*daylight));
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
 const sky=new THREE.Mesh(new THREE.SphereGeometry(155,28,16),finish);
 sky.renderOrder=-10;sky.frustumCulled=false;
 return sky;
}

export function groundHeight(x,z){
 const edge=THREE.MathUtils.smoothstep(Math.hypot(x,z),8,30);
 return (.72*Math.sin(x*.19)+.59*Math.cos(z*.22)+.36*Math.sin((x+z)*.33))*edge;
}
function grainMap(width,height,draw){
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 draw(canvas.getContext('2d'),width,height);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}

function makeGround(loader,bounds){
 const texture=loader.load('/assets/kingdom/grass.webp');
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.MirroredRepeatWrapping;
 texture.repeat.set(17,28);texture.anisotropy=8;
 const geometry=new THREE.PlaneGeometry(174,174,128,128);
 geometry.rotateX(-Math.PI/2);
 const positions=geometry.getAttribute('position'),colors=new Float32Array(positions.count*3);
 const a=new THREE.Color('#d8e8ae'),b=new THREE.Color('#b9cf82'),mix=new THREE.Color();
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),z=positions.getZ(i);
  positions.setY(i,groundHeight(x,z));
  const blend=.5+.23*Math.sin(z*.47+x*.32)+.18*Math.sin(x*.24-z*.53);
  const edgeDistance=Math.min(x-bounds.left,bounds.right-x,z-bounds.back,bounds.front-z);
  const owned=THREE.MathUtils.smoothstep(edgeDistance,-1.2,.85);
  mix.copy(a).lerp(b,blend).multiplyScalar(.82+.18*owned).toArray(colors,i*3);
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 geometry.computeVertexNormals();
 const ground=new THREE.Mesh(geometry,material('#ffffff',{map:texture,vertexColors:true}));
 ground.receiveShadow=true;
 return ground;
}

export function residentPath(){
 return new THREE.CatmullRomCurve3(trailCorners.map(([x,z])=>vertex(x,0,z)),true,'centripetal');
}
function makeTrail(path){
 const rows=180,lanes=[-1,-.65,0,.65,1],positions=[],uv=[],colors=[],indices=[];
 for(let i=0;i<=rows;i++){
  const t=i/rows,p=path.getPointAt(t),dir=path.getTangentAt(t);
  const width=.55+.09*Math.sin(i*.19)+.06*Math.cos(i*.43);
  for(const lane of lanes){
   const x=p.x+dir.z*lane*width,z=p.z-dir.x*lane*width;
   positions.push(x,groundHeight(x,z)+.014,z);
   uv.push((lane+1)*.5,t*12);
   colors.push(1,1,1,Math.abs(lane)===1?0:.82);
  }
  if(i===0)continue;
  const start=(i-1)*lanes.length;
  for(let j=0;j<lanes.length-1;j++){
   const a=start+j,b=a+lanes.length;
   indices.push(a,b,a+1,a+1,b,b+1);
  }
 }
 const texture=grainMap(128,128,(ctx,w,h)=>{
  ctx.fillStyle='#a2966d';ctx.fillRect(0,0,w,h);
  const random=randomFor(842);
  for(let i=0;i<2350;i++){
   ctx.fillStyle=random()>.45?'#63513838':'#f5dbb146';
   ctx.fillRect(random()*w,random()*h,.5+random()*4,.5+random()*2);
  }
 });
 texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const trail=new THREE.Mesh(geometry,material('#ffffff',{map:texture,vertexColors:true,side:THREE.DoubleSide,transparent:true,depthWrite:false}));
 trail.receiveShadow=true;
 return trail;
}

function leafTexture(){
 return grainMap(128,128,(ctx,w,h)=>{
  const random=randomFor(7291);
  ctx.fillStyle='#c2d5a1';ctx.fillRect(0,0,w,h);
  for(let i=0;i<1220;i++){
   const x=random()*w,y=random()*h,r=1.3+random()*3.1;
   ctx.fillStyle=['#667a30','#9eaf58','#e1e9a9','#7c985d','#b8cc86'][i%5];
   ctx.globalAlpha=.22+random()*.36;
   ctx.beginPath();ctx.ellipse(x,y,r,r*.5,random()*tau,0,tau);ctx.fill();
  }
 });
}

function irregularCrown(){
 const geometry=new THREE.SphereGeometry(1,15,11),positions=geometry.getAttribute('position');
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  const r=1+.075*Math.sin(x*9+y*4)*Math.cos(z*7-y*3)+.073*Math.cos(x*7+y*4+z*9);
  positions.setXYZ(i,x*r,y*r,z*r);
 }
 geometry.computeVertexNormals();
 return geometry;
}

function leafSpray(){
 const vertices=[],indices=[];
 for(const [angle,x,y] of [[.73,-.21,.15],[-.65,.36,.23],[.22,.04,.42]]){
  const base=vertices.length/3;
  for(const [px,py,pz] of [[0,-.25,0],[-.16,-.025,0],[0,.27,0],[.15,.022,0],[0,.015,.047]]){
   vertices.push(x+px*Math.cos(angle)-py*Math.sin(angle),y+py*Math.cos(angle)+px*Math.sin(angle),pz);
  }
  for(let i=0;i<4;i++)indices.push(base+i,base+(i+1)%4,base+4);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
 geometry.computeVertexNormals();
 return geometry;
}

function treeGrove(group,trees){
 const random=randomFor(2011),matrix=new THREE.Object3D(),up=vertex(0,1,0),out=vertex(0,0,1);
 const limbParts=[],crownParts=[],leaves=[];
 const palettes=[
  ['#365b35','#597737','#9cac4e'],['#2f533b','#457a57','#85ae67'],
  ['#426b42','#649049','#abc06d'],['#304f43','#457360','#79a47b']
 ].map(list=>list.map(color=>new THREE.Color(color)));
 function limb(a,b,radius){
  const delta=b.clone().sub(a);
  matrix.position.copy(a).lerp(b,.5);
  matrix.quaternion.setFromUnitVectors(up,delta.clone().normalize());
  matrix.scale.set(radius,delta.length(),radius);matrix.updateMatrix();
  limbParts.push(matrix.matrix.clone());
 }
 for(const {x,z,height:h,shade} of trees){
  const earth=groundHeight(x,z),angle=random()*tau,c=Math.cos(angle),s=Math.sin(angle);
  const place=(dx,dy,dz)=>vertex(x+h*(dx*c+dz*s),earth+h*dy,z+h*(-dx*s+dz*c));
  const near=Math.hypot(x,z)<28,fork=place(.022,.34,.010),top=place(-.008,.79,-.027);
  limb(place(0,-.025,0),fork,h*.072);
  limb(fork,top,h*.043);
  if(near)for(let j=0;j<3;j++){
   const a=angle+j*tau/3;
   limb(place(0,.045,0),place(Math.cos(a)*.112,-.029,Math.sin(a)*.112),h*.028);
  }
  const palette=palettes[shade];
  const tall=shade===3;
  const crownCount=near?9:5;
  for(let j=0;j<crownCount;j++){
   const a=tau*j/(crownCount-1)+random()*.48;
   const radius=j===0?0:(.135+random()*.105)*(tall?.77:1);
   const y=j===0?.89:.61+random()*.27;
   const center=place(Math.cos(a)*radius,y,Math.sin(a)*radius);
   if(j>0)limb(fork.clone().lerp(top,.12+random()*.49),center,h*(.013+random()*.012));
   const size=h*(j===0?.195:.121+random()*.044)*(tall?.85:1),taper=.75+random()*.17;
   matrix.position.copy(center);matrix.rotation.set((random()-.5)*.27,a,(random()-.5)*.14);
   matrix.scale.set(size*(1+random()*.20),size*(tall?1.45:.82+random()*.2),size*taper);matrix.updateMatrix();
   const tint=palette[0].clone().lerp(palette[1],.31+random()*.58).multiplyScalar(.92+.16*y);
   crownParts.push([matrix.matrix.clone(),tint]);
   if(!near)continue;
   for(let k=0;k<9;k++){
    const a=k*2.4+random()*.63,e=.12+random()*1.35;
    const direction=vertex(Math.cos(a)*Math.sin(e),Math.cos(e),Math.sin(a)*Math.sin(e));
    const radiusScale=.91+random()*.18;
    matrix.position.copy(center).addScaledVector(direction,size*radiusScale);
    matrix.quaternion.setFromUnitVectors(out,direction);
    matrix.rotateZ((random()-.5)*2.8);
    matrix.scale.setScalar(size*(.28+random()*.20));matrix.updateMatrix();
    const color=palette[1].clone().lerp(palette[2],random()*.61).multiplyScalar(.84+random()*.26);
    leaves.push([matrix.matrix.clone(),color]);
   }
  }
 }
 const bark=woodGrain(918,'#8e765f','#503a28');
 bark.center.set(.5,.5);bark.rotation=Math.PI/2;
 const trunkFinish=material('#ab8a64',{map:bark,bumpMap:bark,bumpScale:.045});
 const canopyFinish=material('#ffffff',{map:leafTexture(),roughness:.96});
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.44,1,1,8),trunkFinish,limbParts.length);
 const crowns=new THREE.InstancedMesh(irregularCrown(),canopyFinish,crownParts.length);
 const sprouts=new THREE.InstancedMesh(leafSpray(),material('#ffffff',{side:THREE.DoubleSide}),leaves.length);
 limbParts.forEach((transform,i)=>trunks.setMatrixAt(i,transform));
 crownParts.forEach(([transform,color],i)=>{crowns.setMatrixAt(i,transform);crowns.setColorAt(i,color)});
 leaves.forEach(([transform,color],i)=>{sprouts.setMatrixAt(i,transform);sprouts.setColorAt(i,color)});
 trunks.castShadow=true;trunks.receiveShadow=true;
 crowns.castShadow=true;crowns.receiveShadow=true;
 group.add(trunks,crowns,sprouts);
}

function vegetation(group,trees,bounds){
 treeGrove(group,trees);
 const random=randomFor(2015),matrix=new THREE.Object3D();
 const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),material('#ffffff',{flatShading:true}),39);
 for(let i=0;i<rocks.count;i++){
  const radius=5.9+random()*15,angle=random()*tau,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,size=.10+random()*.35;
  matrix.position.set(x,groundHeight(x,z)+size*.25,z);matrix.scale.set(size,size*.65,size*.84);
  matrix.rotation.set(random()*.9,angle,.18);matrix.updateMatrix();
  rocks.setMatrixAt(i,matrix.matrix);
  rocks.setColorAt(i,new THREE.Color(i%3?'#8d8b77':'#adb2a6'));
 }
 rocks.castShadow=true;rocks.receiveShadow=true;group.add(rocks);
 const points=[],tints=[];
 const grassColors=['#739654','#6a8b4c','#90a965','#557d4a','#99ad60'].map(c=>new THREE.Color(c));
 for(let i=0;i<780;i++){
  const radius=2.8+random()*(bounds.right+5),angle=random()*tau,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
  if(Math.hypot(x+2.65,z)<1.7||Math.abs(radius-5)<.63)continue;
  const floor=groundHeight(x,z),color=grassColors[i%grassColors.length];
  for(let j=0;j<3;j++){
   const height=.06+random()*.12,shift=(random()-.5)*.20,side=(random()-.5)*.13;
   points.push(x+shift-.035,floor,z+side,x+shift+.032,floor,z+side+.027,x+shift+side*.72,floor+height,z+side-.035);
   tints.push(color.r*.46,color.g*.46,color.b*.46,color.r*.63,color.g*.63,color.b*.63,color.r,color.g,color.b);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));
 const grass=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,vertexColors:true}));
 group.add(grass);
}

export function makeLandscape(loader,path,bounds,trees){
 const ground=new THREE.Group();
 const surface=makeGround(loader,bounds);
 ground.add(surface,makeTrail(path));
 vegetation(ground,trees,bounds);
 const random=randomFor(371),hills=['#6f9f99','#6e9b97','#7a9e96','#89adab'].map(color=>material(color,{flatShading:true}));
 const geometry=new THREE.IcosahedronGeometry(1,2);
 for(let i=0;i<20;i++){
  const angle=tau*i/20,radius=57+8*random();
  const hill=meshAt(ground,geometry,hills[i%hills.length],Math.cos(angle)*radius,-.9,Math.sin(angle)*radius,false);
  hill.rotation.y=angle;hill.scale.set(11+random()*9,2.7+random()*5.4,14+random()*9);
 }
 return {ground,surface,trees};
}

function masonry(){
 return grainMap(512,768,(ctx,w,h)=>{
  const random=randomFor(301);
  ctx.fillStyle='#a39776';ctx.fillRect(0,0,w,h);
  const rows=16,course=h/rows,brick=64;
  for(let i=0;i<rows;i++){
   const y=i*course;
   for(let j=-1;j<=8;j++){
    const x=j*brick+(i%2)*brick/2,light=68+random()*16;
    ctx.fillStyle='hsl('+Math.round(36+random()*10)+' 21% '+light+'%)';
    ctx.fillRect(x+1,y+1,brick-2,course-2);
    ctx.fillStyle='#fff7d561';ctx.fillRect(x+2,y+2,brick-4,1.3);
    ctx.fillStyle='#5b50392b';ctx.fillRect(x+3,y+course-4,brick-6,2);
   }
  }
  for(let i=0;i<7000;i++){
   const x=random()*w,y=random()*h;
   ctx.fillStyle=random()>.56?'#f6eaca2c':'#564b3233';ctx.fillRect(x,y,1+random()*3,1+random());
  }
 });
}

function roofTiles(){
 return grainMap(512,512,(ctx,w,h)=>{
  const random=randomFor(278);
  ctx.fillStyle='#1c6d75';ctx.fillRect(0,0,w,h);
  for(let i=0;i<12;i++){
   const y=i*h/12;
   for(let j=-1;j<25;j++){
    const x=j*w/24+(i%2)*w/48;
    ctx.fillStyle='hsl('+Math.round(183+random()*12)+' 48% '+Math.round(35+random()*19)+'%)';
    ctx.fillRect(x+1,y+1,w/24-1.5,h/12-2);
    ctx.fillStyle='#baf3e555';ctx.fillRect(x+2,y+2,w/24-4,1.2);
   }
  }
 });
}
function arch(width,height,depth){
 const shape=new THREE.Shape(),radius=width/2,spring=height-radius;
 shape.moveTo(-radius,0);shape.lineTo(radius,0);shape.lineTo(radius,spring);
 shape.absarc(0,spring,radius,0,Math.PI,false);shape.lineTo(-radius,0);
 return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.022,bevelThickness:.022,bevelSegments:1,curveSegments:10});
}

function opening(group,stone,wood,iron,light,width,height,y,z,isDoor=false){
 const cluster=new THREE.Group();
 cluster.position.set(0,y,z);
 group.add(cluster);
 meshAt(cluster,arch(width+.22,height+.14,.075),stone,0,-.035,0);
 meshAt(cluster,arch(width+.045,height+.02,.066),iron,0,.01,.046);
 meshAt(cluster,arch(width,height,.047),isDoor?wood:light,0,.012,.092);
 if(isDoor){
  const plank=new THREE.BoxGeometry(.016,1,.019),strap=new THREE.BoxGeometry(width*.96,.066,.035);
  for(const step of [-2,-1,0,1,2]){
   const x=step*width*.16,maxY=height-width/2+Math.sqrt((width/2)**2-x*x)-.035;
   meshAt(cluster,plank,iron,x,maxY/2,.163,false).scale.y=maxY;
  }
  for(const y of [.35,.83])meshAt(cluster,strap,iron,0,y,.171,false);
  meshAt(cluster,new THREE.SphereGeometry(.052,9,6),light,width*.27,.7,.201,false);
 }else{
  meshAt(cluster,new THREE.BoxGeometry(.039,height*.91,.034),iron,0,height*.49,.163,false);
  meshAt(cluster,new THREE.BoxGeometry(width*.97,.039,.034),iron,0,height*.39,.163,false);
 }
 return cluster;
}

export function makeTower(){
 const tower=new THREE.Group();
 tower.position.set(towerPlot.x,0,towerPlot.z);
 const stone=material('#f3ecda',{map:masonry(),roughness:1}),trim=material('#d8c79d'),
  base=material('#8e8b82'),pine=material('#a36c3b'),iron=material('#493f3a',{metalness:.25}),
  gold=material('#e8be58',{metalness:.37,roughness:.39}),
  glow=material('#ffe0a0',{emissive:'#ff983a',emissiveIntensity:.34}),
  teal=material('#20717b'),tile=material('#9ce7e3',{map:roofTiles(),roughness:.74,metalness:.05});
 cylinder(tower,1.41,1.50,.24,base,0,.12,0);
 cylinder(tower,1.34,1.43,.18,trim,0,.32,0);
 cylinder(tower,1.21,1.31,.18,base,0,.49,0);
 cylinder(tower,1.00,1.22,4.16,stone,0,2.63,0);
 cylinder(tower,1.17,1.12,.16,trim,0,4.60,0);
 cylinder(tower,1.26,1.15,.14,base,0,4.75,0);
 const roofLine=[[1.49,0],[1.48,.081],[1.35,.13],[1.30,.41],[1.14,.47],[1.10,.69],[.91,.75],[.87,.99],[.67,1.05],[.61,1.30],[.46,1.35],[.40,1.58],[.25,1.64],[.18,1.78],[0,1.98]];
 const roof=meshAt(tower,new THREE.LatheGeometry(roofLine.map(([r,y])=>new THREE.Vector2(r,y)),8),tile,0,4.79,0);
 roof.rotation.y=Math.PI/8;
 cylinder(tower,1.45,1.49,.075,teal,0,4.81,0);
 cylinder(tower,.055,.071,.22,gold,0,6.72,0,9);
 meshAt(tower,new THREE.SphereGeometry(.095,9,8),gold,0,6.82,0);
 cylinder(tower,.025,.034,.52,iron,0,7.06,0,8);
 const pennant=new THREE.BufferGeometry();
 pennant.setAttribute('position',new THREE.Float32BufferAttribute([0,7.30,0,.62,7.22,.03,.42,7.12,.11,.02,7.03,0],3));
 pennant.setIndex([0,1,2,0,2,3]);pennant.computeVertexNormals();
 meshAt(tower,pennant,material('#7ce5d9',{side:THREE.DoubleSide,flatShading:true}),0,0,0).name='pennant';
 opening(tower,trim,pine,iron,glow,.86,1.28,.57,1.10,true);
 for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
  const wall=new THREE.Group();
  wall.rotation.y=angle;tower.add(wall);
  opening(wall,trim,pine,iron,glow,.32,.67,3.41,.985);
 }
 for(const x of [-.67,.67]){
  meshAt(tower,new THREE.BoxGeometry(.13,.28,.12),iron,x,1.49,1.08);
  meshAt(tower,new THREE.BoxGeometry(.13,.18,.13),glow,x,1.5,1.16);
  const shade=meshAt(tower,new THREE.ConeGeometry(.11,.11,4),iron,x,1.63,1.16);
  shade.rotation.y=Math.PI/4;
 }
 const crest=new THREE.Group();
 crest.name='tower-upgraded-trim';crest.visible=false;tower.add(crest);
 for(const y of [2.22,4.41])cylinder(crest,1.17,1.17,.105,gold,0,y,0);
 for(const side of [-1,1]){
  const banner=meshAt(crest,new THREE.BoxGeometry(.35,.85,.035),teal,side*.58,3.10,.95);
  banner.rotation.y=side*.44;
  meshAt(banner,new THREE.OctahedronGeometry(.10),gold,0,.17,.05,false).scale.set(1,1.3,.28);
 }
 for(let i=0;i<3;i++){
  meshAt(tower,new THREE.BoxGeometry(1.31-i*.13,.104,1.24-i*.23),i===0?base:trim,0,.06+i*.10,1.22);
 }
 return tower;
}

function woodGrain(seed,light,shadow){
 const map=grainMap(256,128,(ctx,w,h)=>{
  const random=randomFor(seed);
  ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
  for(let i=0;i<230;i++){
   const x=random()*w,y=random()*h,length=8+random()*w*.72;
   ctx.strokeStyle=shadow;ctx.globalAlpha=.12+random()*.38;ctx.lineWidth=.6+random()*1.9;
   ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+length*.22,y+2,x+length*.58,y-2,x+length,y+random()*2-1);ctx.stroke();
  }
  ctx.globalAlpha=.7;
  for(let i=0;i<6;i++){
   const x=random()*w,y=random()*h;
   for(let ring=1;ring<=4;ring++){
    ctx.beginPath();ctx.ellipse(x,y,2+ring*3,1+ring,random()*.22,0,tau);ctx.stroke();
   }
  }
 });
 map.anisotropy=4;
 return map;
}

export function makeHouse(level=1){
 const upgraded=level>=2,manor=level===3;
 const house=new THREE.Group(),positions=new Map();
 const boards=woodGrain(851,'#dfb187','#83573d'),beams=woodGrain(817,'#bd8963','#64412a');
 const timber=material('#a0724c',{map:beams,bumpMap:beams,bumpScale:.018});
 const warm=material(upgraded?'#d3a16c':'#b79572',{map:boards,bumpMap:boards,bumpScale:.012});
 const pale=material(upgraded?'#fae5b9':'#d6be98',{map:boards});
 const stepStone=material('#9c9687',{flatShading:true}),mortar=material('#b4a894');
 const dark=material('#43352e'),iron=material('#4f4b43',{metalness:.28});
 const roofColors=manor?['#258393','#36748f','#42a1b0','#285d78']:
  upgraded?['#73472f','#9c6340','#af7647','#835d41']:['#594f3e','#6c5d47'];
 const roof=roofColors.map(color=>material(color,{map:boards,bumpMap:boards,bumpScale:.025}));
 const lit=material('#ffcf80',{emissive:'#dc7431',emissiveIntensity:.38});
 const glass=material('#ffdf9f',{emissive:'#de974c',emissiveIntensity:.18});
 glass.name=lit.name='Cottage lights';
 const sash=material('#65452f');
 const copper=material('#e1b662',{metalness:.44,roughness:.46});
 function add(finish,shape,x,y,z,angle=0){
  if(angle)shape.rotateZ(angle);
  shape.translate(x,y,z);
  if(!positions.has(finish))positions.set(finish,[]);
  positions.get(finish).push(shape);
 }
 const block=(finish,x,y,z,w,h,d,angle)=>add(finish,new THREE.BoxGeometry(w,h,d),x,y,z,angle);
 const {width,depth}=houseSize;
 const {front:doorZ,width:doorWidth,height:doorHeight,floor}=houseEntry;
 const doorTop=floor+doorHeight,wallTop=1.709,pierWidth=(2.77-doorWidth)/2;
 block(stepStone,0,-.10,0,width,.35,depth);
 block(mortar,0,.068,0,3.06,.079,2.63);
 block(stepStone,0,.129,0,2.94,.07,2.53);
 block(warm,0,.955,-1.136,2.77,1.57,.18);
 for(const side of [-1,1]){
  block(warm,side*1.295,.955,0,.18,1.57,2.32);
  block(warm,side*(doorWidth/2+pierWidth/2),.955,doorZ-.085,pierWidth,1.57,.17);
 }
 block(timber,0,(wallTop+doorTop)/2,doorZ-.05,doorWidth,wallTop-doorTop,.22);
 for(let i=0;i<8;i++){
  const y=.26+i*.185,finish=i%3===1?pale:warm;
  block(finish,0,y,-1.226,2.71,.170,.034);
  for(const side of [-1,1]){
   block(finish,side*(doorWidth/2+pierWidth/2),y,doorZ,pierWidth,.170,.034);
   block(finish,side*1.397,y,-.032,.044,.168,2.38);
  }
 }
 for(const z of [-1.212,1.14]){
  for(const x of [-1.30,1.30]){
   block(timber,x,.971,z,.20,1.68,.22);
   if(upgraded)block(copper,x,1.43,z+(z>0?.12:-.12),.064,.067,.021);
  }
  block(timber,0,1.67,z,2.79,.105,.15);
  if(z<0)block(timber,0,.26,z,2.79,.14,.15);
 }
 for(const x of [-1.387,1.387]){
  for(const y of [.26,1.65])block(timber,x,y,-.035,.145,.14,2.45);
  block(timber,x,.96,-.039,.13,1.51,.16);
 }
 const ridge=manor?3.06:upgraded?2.80:2.50,rise=ridge-1.66,slope=rise/1.53;
 function gable(z,back){
  const vertices=[-1.39,0,0,1.39,0,0,0,rise,0];
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2));
  geo.setIndex(back?[0,2,1]:[0,1,2]);geo.computeVertexNormals();
  add(pale,geo,0,1.68,z);
 }
 gable(1.151,false);gable(-1.217,true);
 if(upgraded){
  block(timber,0,2.12,1.181,.113,.84,.113);
  block(timber,0,2.12,-1.241,.113,.84,.113);
 }
 const span=Math.hypot(1.53,rise);
 const random=randomFor(884);
 for(const side of [-1,1]){
  const angle=-side*Math.atan(slope),rows=upgraded?8:6,rowWidth=1.53/rows;
  block(dark,side*.765,ridge-.765*slope,0,span,.115,2.68,angle);
  for(const z of [-1.286,1.286])block(timber,side*.765,ridge+.01-.765*slope,z,span+.05,.175,.12,angle);
  for(let row=0;row<rows;row++){
   const x=(row+.46)*rowWidth,y=ridge+.08-x*slope,w=rowWidth*Math.hypot(1,slope)-.007;
   if(upgraded){
    for(let tile=0;tile<9;tile++){
     const z=(tile-4)*.292+(row%2?.055:-.027);
     block(roof[Math.floor(random()*roof.length)],side*x,y,z,w,.061+random()*.018,.27,angle);
    }
   }else{
    block(roof[row%2],side*x,y,0,w,.063,2.68,angle);
   }
  }
 }
 block(timber,0,ridge+.11,0,.16,.12,2.65);
 for(const x of [-doorWidth/2-.052,doorWidth/2+.052]){
  block(timber,x,floor+doorHeight/2,doorZ+.024,.103,doorHeight,.15);
 }
 block(stepStone,0,.103,1.34,doorWidth+.19,.12,.43);
 block(mortar,0,.042,1.46,doorWidth+.32,.076,.40);
 for(const x of [-.984,.984]){
  block(timber,x,1.09,1.208,.51,.57,.112);
  block(glass,x,1.09,1.274,.394,.43,.026);
  block(sash,x,1.09,1.291,.041,.431,.02);
  block(sash,x,1.09,1.291,.397,.042,.02);
  block(timber,x,.83,1.278,.57,.066,.11);
  if(upgraded)block(timber,x,.572,1.201,.60,.102,.105,x<0?.56:-.56);
 }
 if(upgraded){
  block(stepStone,-.89,2.52,-.62,.47,1.12,.48);
  for(const y of [2.53,2.73,2.93])block(mortar,-.89,y,-.62,.48,.026,.49);
  block(stepStone,-.89,3.102,-.62,.55,.13,.56);
  block(dark,-.89,3.17,-.62,.32,.018,.32);
  if(!manor){
   block(timber,0,2.179,1.204,.42,.42,.082,Math.PI/4);
   block(lit,0,2.18,1.253,.29,.29,.020,Math.PI/4);
   block(timber,0,2.18,1.271,.085,.085,.015,Math.PI/4);
  }
  for(const side of [-1,1]){
   block(timber,side*1.424,1.12,-.52,.097,.56,.61);
   block(glass,side*1.475,1.12,-.52,.019,.416,.458);
   block(sash,side*1.49,1.12,-.52,.018,.421,.039);
   block(timber,side*1.462,.845,-.52,.131,.069,.68);
  }
  block(iron,1.17,1.501,1.251,.11,.27,.13);
  block(lit,1.17,1.50,1.32,.10,.141,.062);
  block(iron,1.17,1.61,1.316,.16,.07,.085);
 }
 if(manor){
  const trim=material('#c7ab78',{metalness:.27}),teal=roof[1];
  block(stepStone,.89,2.62,-.61,.41,1.22,.44);
  block(trim,.89,3.24,-.61,.52,.11,.52);
  block(dark,.89,3.31,-.61,.32,.04,.34);
  block(timber,0,2.31,1.16,.98,.78,.32);
  for(const side of [-1,1]){
   block(teal,.255*side,2.75,1.18,.67,.12,.44,-side*.52);
   block(trim,.247*side,2.76,1.413,.69,.055,.052,-side*.52);
   block(lit,.211*side,2.35,1.334,.292,.34,.04);
   block(timber,.211*side,2.35,1.357,.042,.34,.035);
   block(mortar,side*1.23,.63,1.245,.16,.84,.15);
   block(trim,side*.594,1.56,1.288,.12,.124,.12);
  }
  block(trim,0,2.115,1.34,1.04,.11,.24);
  block(teal,0,1.697,1.306,1.55,.09,.45);
  block(trim,0,1.66,1.52,1.58,.08,.075);
  block(trim,0,3.265,.14,.075,.39,.079);
  block(copper,0,3.53,.14,.19,.19,.19,Math.PI/4);
 }
 for(const [finish,pieces] of positions){
  meshAt(house,mergeGeometries(pieces),finish,0,0,0);
  pieces.forEach(piece=>piece.dispose());
 }
 const door=new THREE.Group(),leafWidth=doorWidth-.052,leafHeight=doorHeight-.035;
 door.name='house-door';door.position.set(-doorWidth/2+.021,floor+.016,doorZ+.02);house.add(door);
 const doorBlock=(finish,x,y,z,w,h,d)=>meshAt(door,new THREE.BoxGeometry(w,h,d),finish,x,y,z);
 doorBlock(upgraded?timber:warm,leafWidth/2,leafHeight/2,0,leafWidth,leafHeight,.078);
 for(let slat=1;slat<=5;slat++)doorBlock(dark,leafWidth*slat/6,leafHeight/2,.042,.014,leafHeight-.03,.008);
 for(const y of [.32,1.12])doorBlock(upgraded?iron:timber,leafWidth/2,y,.05,leafWidth-.065,.072,.030);
 doorBlock(upgraded?copper:iron,leafWidth-.17,.66,.063,.089,.10,.058);
 return house;
}

export function makeResident(loader){
 const resident=new THREE.Group(),body=new THREE.Group();
 resident.add(body);
 const base=material('#5feacf',{roughness:.53});
 const skin=new THREE.MeshBasicMaterial({transparent:true,alphaTest:.13,depthWrite:true,polygonOffset:true,polygonOffsetFactor:-2});
 meshAt(body,new RoundedBoxGeometry(1.05,1.05,1.05,2,.075),base,0,0,0);
 const geometry=new THREE.PlaneGeometry(.95,.95);
 for(let i=0;i<4;i++){
  const angle=i*Math.PI/2;
  const face=meshAt(body,geometry,skin,Math.sin(angle)*.532,0,Math.cos(angle)*.532,false);
  face.rotation.y=angle;
 }
 let activeId='';
 function setCube(cube){
  if(activeId===cube.id)return;
  activeId=cube.id;
  base.color.set(cube.color);
  skin.map?.dispose();
  skin.map=loader.load(cube.icon);
  skin.map.colorSpace=THREE.SRGBColorSpace;
  skin.map.anisotropy=4;
  skin.needsUpdate=true;
 }
 return {resident,body,setCube};
}
