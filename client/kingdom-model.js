import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {houseSize,towerPlot,trailCorners} from '../web/kingdom-rules.js';

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
   cloudTint:{value:new THREE.Color('#f9fbef')},sunDirection:{value:vertex(-.65,.43,.52).normalize()}
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
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
   }
   void main(){
    vec3 ray=normalize(direction);
    float h=max(0.,ray.y);
    vec3 color=mix(horizon,zenith,pow(clamp(h/.40,0.,1.),.52));
    float sun=max(0.,dot(ray,sunDirection));
    color=mix(color,cloudTint,.24*pow(sun,18.)+.68*smoothstep(.9983,.9997,sun));
    vec2 p=ray.xz/max(.085,h)*vec2(1.1,.78)+vec2(3.9,19.8);
    float cloud=noise(p)*.59+noise(p*2.05)*.26+noise(p*4.15)*.11+noise(p*8.4)*.04;
    float wisps=smoothstep(.42,.68,cloud)*smoothstep(.015,.125,h);
    color=mix(color,cloudTint,wisps*.94);
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

function makeGround(loader){
 const texture=loader.load('/assets/kingdom/grass.webp');
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.MirroredRepeatWrapping;
 texture.repeat.set(17,28);texture.anisotropy=8;
 const geometry=new THREE.PlaneGeometry(174,174,86,86);
 geometry.rotateX(-Math.PI/2);
 const positions=geometry.getAttribute('position'),colors=new Float32Array(positions.count*3);
 const a=new THREE.Color('#d8e8ae'),b=new THREE.Color('#b9cf82'),mix=new THREE.Color();
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),z=positions.getZ(i);
  positions.setY(i,groundHeight(x,z));
  const blend=.5+.23*Math.sin(z*.47+x*.32)+.18*Math.sin(x*.24-z*.53);
  mix.copy(a).lerp(b,blend).toArray(colors,i*3);
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

function vegetation(group){
 const random=randomFor(2011),matrix=new THREE.Object3D();
 const trees=[];
 for(let i=0;i<48;i++){
  const angle=i/48*tau+(random()-.5)*.24,radius=17.4+random()*27;
  trees.push([Math.cos(angle)*radius,Math.sin(angle)*radius,1.8+random()*3.7,random()]);
 }
 trees.push([-12.8,-5.1,4.5,.2],[10.0,-11.8,4.0,.84],[-11.1,-11.9,5.4,.09],[13.5,-5.2,3.2,.59],[12.9,5.75,3.15,.35]);
 const trunkGeometry=new THREE.CylinderGeometry(.055,.11,1,6);
 const canopyGeometry=new THREE.IcosahedronGeometry(1,1);
 const trunks=new THREE.InstancedMesh(trunkGeometry,material('#604f41'),trees.length);
 const crowns=new THREE.InstancedMesh(canopyGeometry,material('#ffffff',{flatShading:true}),trees.length*3);
 const greens=['#38654e','#4d7454','#668b53','#57824b','#517966'].map(c=>new THREE.Color(c));
 for(const [i,[x,z,height,shade]] of trees.entries()){
  const floor=groundHeight(x,z);
  matrix.position.set(x,floor+height*.27,z);matrix.rotation.set(0,i,0);
  matrix.scale.set(height*.42,height*.54,height*.42);matrix.updateMatrix();
  trunks.setMatrixAt(i,matrix.matrix);
  for(let j=0;j<3;j++){
   const size=height*(.235-j*.05);
   matrix.position.set(x+Math.sin(i*2+j)*size*.59,floor+height*(.65+j*.11),z+Math.cos(i+j*4)*size*.59);
   matrix.scale.set(size,size*1.14,size);matrix.rotation.set(j*.18,i+j,0);matrix.updateMatrix();
   crowns.setMatrixAt(i*3+j,matrix.matrix);
   crowns.setColorAt(i*3+j,greens[Math.floor(shade*greens.length)].clone().multiplyScalar(.89+j*.085));
  }
 }
 trunks.castShadow=true;crowns.castShadow=true;crowns.receiveShadow=true;group.add(trunks,crowns);
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
  const radius=2.8+random()*19,angle=random()*tau,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
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

export function makeLandscape(loader,path){
 const ground=new THREE.Group();
 const surface=makeGround(loader);
 ground.add(surface,makeTrail(path));
 vegetation(ground);
 const random=randomFor(371),hills=['#6f9f99','#6e9b97','#7a9e96','#89adab'].map(color=>material(color,{flatShading:true}));
 const geometry=new THREE.IcosahedronGeometry(1,2);
 for(let i=0;i<20;i++){
  const angle=tau*i/20,radius=57+8*random();
  const hill=meshAt(ground,geometry,hills[i%hills.length],Math.cos(angle)*radius,-.9,Math.sin(angle)*radius,false);
  hill.rotation.y=angle;hill.scale.set(11+random()*9,2.7+random()*5.4,14+random()*9);
 }
 return {ground,surface};
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
 meshAt(tower,pennant,material('#7ce5d9',{side:THREE.DoubleSide,flatShading:true}),0,0,0);
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
 for(let i=0;i<3;i++){
  meshAt(tower,new THREE.BoxGeometry(1.31-i*.13,.104,1.24-i*.23),i===0?base:trim,0,.06+i*.10,1.22);
 }
 return tower;
}

export function makeHouse(){
 const house=new THREE.Group(),positions=new Map();
 const slate=material('#1d2e4e',{roughness:.75}),steel=material('#3b648f',{metalness:.24});
 const wall=material('#42698a',{roughness:.73}),plinth=material('#456358');
 const trim=material('#aadde1',{roughness:.7}),lime=material('#d9ee83',{emissive:'#45582e',emissiveIntensity:.24});
 const glow=material('#7beaef',{emissive:'#34c6db',emissiveIntensity:.80,roughness:.4});
 function block(finish,x,y,z,w,h,d){
  const piece=new THREE.BoxGeometry(w,h,d);
  piece.translate(x,y,z);
  if(!positions.has(finish))positions.set(finish,[]);
  positions.get(finish).push(piece);
 }
 const {width,depth}=houseSize;
 block(plinth,0,-.06,0,width,.26,depth);
 block(trim,0,.08,0,width-.08,.12,depth-.08);
 block(slate,0,.19,0,2.96,.22,2.52);
 block(wall,0,1.03,-.04,2.8,1.55,2.31);
 for(const x of [-1.28,1.28])for(const z of [-1.13,1.07]){
  block(steel,x,1.04,z,.24,1.67,.22);
  block(lime,x,.4,z,.27,.11,.25);
  block(trim,x,1.65,z,.24,.12,.23);
 }
 block(slate,0,1.93,-.05,3.14,.24,2.63);
 block(trim,0,2.045,-.05,3.12,.045,2.59);
 block(steel,0,2.18,-.08,2.85,.25,2.33);
 block(slate,0,2.34,-.1,2.14,.15,1.78);
 block(steel,0,2.49,-.12,1.32,.17,1.03);
 block(lime,0,2.59,-.14,1.16,.05,.85);
 for(const x of [-1.09,-.57,.57,1.09])block(glow,x,1.92,1.275,.31,.077,.016);
 block(plinth,.02,.18,1.19,1.22,.13,.33);
 block(slate,.02,.827,1.134,1.04,1.29,.10);
 block(trim,.02,.86,1.195,.86,1.20,.062);
 block(steel,.02,.82,1.235,.68,1.11,.024);
 block(glow,.02,.82,1.256,.43,.83,.014);
 block(slate,.02,.82,1.268,.29,.69,.017);
 block(lime,.20,.71,1.284,.055,.073,.022);
 for(const x of [-.95,.92]){
  block(slate,x,1.15,1.145,.51,.57,.090);
  block(trim,x,1.15,1.198,.42,.47,.037);
  block(glow,x,1.15,1.224,.32,.35,.02);
  block(slate,x,1.15,1.238,.032,.36,.012);
 }
 for(const side of [-1,1]){
  block(steel,side*1.407,1.08,-.44,.073,.66,1.21);
  block(slate,side*1.449,1.08,-.44,.024,.56,1.10);
  for(const z of [-.76,-.44,-.12])block(glow,side*1.467,1.08,z,.012,.29,.22);
  for(const z of [.49,.67,.85])block(lime,side*1.425,.51,z,.03,.14,.11);
 }
 block(steel,-1.01,2.29,-.72,.48,.46,.44);
 block(slate,-1.01,2.54,-.72,.55,.09,.51);
 block(lime,-1.01,2.60,-.72,.30,.03,.31);
 for(const [finish,pieces] of positions){
  meshAt(house,mergeGeometries(pieces),finish,0,0,0);
  pieces.forEach(piece=>piece.dispose());
 }
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
