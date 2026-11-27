import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const pi=Math.PI, turn=2*pi;
const clamp=(number,min=0,max=1)=>Math.min(max,Math.max(min,number));
const fraction=(time,start,end)=>clamp((time-start)/(end-start));
const smooth=t=>t*t*(3-2*t);
const out=t=>1-(1-t)**3;
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const selectTier={
 standard:{body:'#4b6388',grain:'#354a69',plate:'#b8d9fc',edge:'#59709f',radiance:'#42dffe',iris:'#66edff',room:'#142440'},
 special:{body:'#434e67',grain:'#34445f',plate:'#ffcb59',edge:'#a4632d',radiance:'#5fb9ff',iris:'#79d6ff',room:'#102a3b'},
 pro:{body:'#533484',grain:'#402b65',plate:'#ffcc62',edge:'#a66235',radiance:'#a9f95e',iris:'#bdff71',room:'#211441'}
};
const empty='#080a17';
const hints={
 common:{color:'#a6c9e5',key:null,power:0,amount:0},
 uncommon:{color:'#62ffc3',key:null,power:.12,amount:9},
 rare:{color:'#60d5ff',key:null,power:.22,amount:14},
 epic:{color:'#b47aff',key:'#a99aef',power:.44,amount:22},
 legendary:{color:'#ffcb57',key:'#ffe581',power:.58,amount:28},
 mythic:{color:'#ff627b',key:'#ff7973',power:.66,amount:36},
 ancient:{color:'#ae71ec',key:'#ba88ed',power:.73,amount:42,shadow:'#231932'},
 exotic:{color:'#ff679c',key:'#ff5477',power:.80,amount:48},
 celestial:{color:'#dcebff',key:'#a6b5c9',power:1.05,amount:60,shadow:'#171722'},
 secret:{color:'#eb4b74',key:'#9b3148',power:1.14,amount:65,shadow:'#230f19'},
 divine:{color:'#fff295',key:'#fff3a1',power:1.24,amount:72},
 apex:{color:'#e2b8ff',key:'#ffce65',power:1.33,amount:78},
 impossible:{color:'#b886ff',key:'#9970ff',power:1.38,amount:78,shadow:'#160e22'}
};
const palettes=(tier,rarity)=>({colors:selectTier[tier]||selectTier.standard,hint:hints[rarity]||hints.common});

function flatMaterial(color,options={}){
 return new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.12,...options});
}
function place(parent,object,x=0,y=0,z=0){
 object.position.set(x,y,z);parent.add(object);return object;
}
function group(parent,x=0,y=0,z=0){return place(parent,new THREE.Group(),x,y,z)}
function mesh(parent,geometry,material,x=0,y=0,z=0){
 return place(parent,new THREE.Mesh(geometry,material),x,y,z);
}
function box(parent,size,material,x=0,y=0,z=0,radius=.03){
 const geometry=radius?new RoundedBoxGeometry(...size,1,radius):new THREE.BoxGeometry(...size);
 return mesh(parent,geometry,material,x,y,z);
}
function polyLoop(points){
 return points.map(([x,y])=>new THREE.Vector2(x,y));
}
function plate(parent,points,depth,finish,x=0,y=0,z=0,hole=null,bevel=.042){
 const outline=new THREE.Shape(polyLoop(points));outline.closePath();
 if(hole){
  const path=new THREE.Path(polyLoop(hole));path.closePath();outline.holes.push(path);
 }
 const geometry=new THREE.ExtrudeGeometry(outline,{depth,bevelSize:bevel,bevelThickness:bevel,
  bevelSegments:2,bevelEnabled:bevel>0,curveSegments:1});
 return mesh(parent,geometry.translate(0,0,-depth/2),finish,x,y,z);
}
function circlePoints(count,radius,angle=0){
 return Array.from({length:count},(_,i)=>{
  const a=angle+i/count*turn;return [Math.cos(a)*radius,Math.sin(a)*radius];
 });
}
function disc(parent,rad,depth,finish,x=0,y=0,z=0,count=24){
 const shape=mesh(parent,new THREE.CylinderGeometry(rad,rad,depth,count),finish,x,y,z);
 shape.rotation.x=pi/2;return shape;
}
function horn(parent,side,finish){
 const center=new THREE.CatmullRomCurve3([v(.34*side,.11,0),v(.51*side,.25,.025),
  v(.65*side,.37,.11),v(.73*side,.62,.12)]);
 const positions=[],faces=[],sides=10,steps=10;
 for(let j=0;j<=steps;j++){
  const t=j/steps,p=center.getPoint(t),along=center.getTangent(t).normalize();
  const a=v().crossVectors(along,v(0,0,1)).normalize(),b=v().crossVectors(along,a).normalize();
  const radius=.155*(1-t)**.71+.004;
  for(let i=0;i<sides;i++){
   const angle=i/sides*turn;
   positions.push(...p.clone().addScaledVector(a,radius*Math.cos(angle)).addScaledVector(b,radius*.85*Math.sin(angle)).toArray());
   if(j){
    const before=(j-1)*sides+i,after=(j-1)*sides+(i+1)%sides;
    faces.push(before,after,before+sides,after,after+sides,before+sides);
   }
  }
 }
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setIndex(faces);geometry.computeVertexNormals();
 return mesh(parent,geometry,finish);
}
function badge(parent,gear,style,key=false){
 const {frame,trim,bright,iris,edge,dark}=style;
 if(gear){
  const c=12,shape=Array.from({length:c*4},(_,i)=>{
   const r=i%4===0||i%4===3?.55:.67,a=turn*i/(c*4)+.02;
   return [Math.cos(a)*r,Math.sin(a)*r];
  });
  plate(parent,shape,.10,dark,0,0,-.025);
  plate(parent,shape.map(([x,y])=>[x*.91,y*.91]),.145,frame,0,0,.055);
  disc(parent,.40,.16,trim,0,0,.146,20);
  disc(parent,.325,.09,frame,0,0,.24,20);
  for(const side of [-1,1]){
   disc(parent,.134,.054,edge,side*.17,.075,.31,16);
   disc(parent,.092,.055,iris,side*.17,.075,.34,16);
  }
  box(parent,[.23,.11,.07],dark,0,-.225,.30,.025);
  return;
 }
 const face=[[-.54,.08],[-.46,.29],[0,.43],[.46,.29],[.54,.08],[.48,-.30],[.30,-.45],[0,-.51],[-.30,-.45],[-.48,-.30]];
 plate(parent,face,.17,dark);
 plate(parent,face.map(([x,y])=>[x*.95,y*.93]),.14,edge,0,-.007,.12);
 plate(parent,[[-.478,.15],[-.43,.295],[0,.395],[.43,.295],[.478,.15],[.23,-.02],[0,-.06],[-.23,-.02]],.107,frame,0,0,.23);
 for(const side of [-1,1]){
  horn(parent,side,frame);
  const eye=[[-.433,.087],[-.14,-.059],[-.10,-.16],[-.214,-.208],[-.365,-.135],[-.448,-.019]]
   .map(([x,y])=>[x*side,y]);
  plate(parent,eye,.082,dark,0,0,.24,null,.021);
  plate(parent,eye.map(([x,y])=>[(x+side*.27)*.79-side*.27,(y+.061)*.72-.061]),.079,iris,0,.004,.295,null,.017);
 }
 plate(parent,[[-.424,-.225],[-.218,-.230],[0,-.255],[.218,-.230],[.424,-.225],[.27,-.363],[0,-.405],[-.27,-.363]],
  .068,dark,0,0,.216,null,.025);
 for(let i=-2;i<=2;i++){
  const x=.135*i;
  plate(parent,[[x-.065,-.241],[x+.055,-.249],[x-.009,-.347]],.042,bright,0,0,.261,null,.014);
 }
 if(!key)box(parent,[.27,.052,.036],trim,0,-.397,.24,.013);
}

function chestModel(parent,style,tier){
 const {body,wood,lining,frame,edge,trim,bright,dark}=style;
 const rig=group(parent),base=group(rig);
 const b=box(base,[3.03,.185,1.9],edge,0,.099,0,.083);b.castShadow=true;b.receiveShadow=true;
 box(base,[2.94,.16,1.82],frame,0,.197,0,.052);
 box(base,[2.56,.082,1.49],lining,0,.26,0,.018);
 for(const side of [-1,1]){
  const z=side*.806,x=side*1.375;
  const panel=box(base,[2.74,.945,.16],body,0,.624,z,.040);panel.castShadow=true;
  box(base,[.15,.94,1.56],body,x,.62,0,.046);
  box(base,[2.47,.14,.040],wood,0,.492,z+side*.093,.009);
  box(base,[2.47,.14,.040],wood,0,.768,z+side*.093,.009);
  box(base,[2.63,.11,.068],trim,0,1.01,z+side*.073,.020);
  box(base,[1.58,.12,.15],lining,0,1.050,z-side*.01,.027);
  for(const left of [-1,1]){
   box(base,[.224,.96,.212],edge,left*1.26,.618,z+side*.045,.045);
   box(base,[.120,.824,.046],frame,left*1.26,.618,z+side*.162,.020);
   for(const y of [.308,.874])disc(base,.059,.032,bright,left*1.26,y,z+side*.194,8);
  }
  box(base,[.28,.32,.52],edge,x,.69,0,.061);
  const handle=mesh(base,new THREE.TorusGeometry(.202,.051,8,16),frame,x+side*.17,.682,0);
  handle.rotation.y=pi/2;
 }
 const hinge=group(rig,0,1.10,-.79);
 const roof=mesh(hinge,new RoundedBoxGeometry(2.93,.34,1.75,2,.12),body,0,.15,.79);
 roof.castShadow=true;
 for(let i=0;i<4;i++){
  const x=.493*(i-1.5);
  box(hinge,[.422,.049,1.48],i%2?wood:body,x,.328,.78,.017);
 }
 for(const s of [-1,1]){
  box(hinge,[.235,.431,1.76],edge,s*1.28,.17,.79,.064);
  box(hinge,[.126,.049,1.76],frame,s*1.28,.398,.80,.018);
  box(hinge,[.141,.329,.103],frame,s*1.28,.183,1.71,.024);
  for(const z of [.18,1.45]){
   const bolt=mesh(hinge,new THREE.CylinderGeometry(.054,.054,.027,8),bright,s*1.28,.432,z);
   bolt.rotation.y=pi/8;
  }
  box(hinge,[.312,.222,.18],trim,s*.76,.02,-.072,.04);
 }
 box(hinge,[2.97,.13,.164],frame,0,.064,1.666,.031);
 box(hinge,[2.48,.054,1.46],lining,0,-.033,.773,.027);
 const mask=group(hinge,0,.16,1.83);mask.scale.setScalar(.91);
 badge(mask,tier==='special',style);
 const collar=group(base,0,.783,.991);
 const outer=[[-.34,-.12],[-.23,-.25],[.23,-.25],[.34,-.12],[.34,.24],[-.34,.24]];
 const socket=[[-.081,-.115],[.081,-.115],[.049,-.020],[.088,.066],[.047,.134],[-.047,.134],[-.088,.066],[-.049,-.020]];
 plate(collar,outer,.104,edge);
 plate(collar,outer.map(([x,y])=>[x*.79,y*.80]),.064,trim,0,0,.088,socket,.024);
 plate(collar,socket.map(([x,y])=>[x*1.05,y*1.05]),.036,dark,0,0,.102,null,.015);
 return {rig,hinge};
}
function demonKey(parent,style,tier){
 const {frame,edge,trim,bright,iris,dark}=style;
 const key=group(parent),head=group(key);
 head.scale.setScalar(.40);
 badge(head,tier==='special',{frame,edge,trim,bright,iris,dark},true);
 box(key,[1.087,.204,.184],edge,.714,0,0,.027);
 box(key,[1.050,.149,.170],frame,.738,.026,.019,.025);
 box(key,[.172,.291,.175],frame,1.113,-.076,0,.021);
 box(key,[.124,.226,.166],frame,1.316,-.067,0,.019);
 box(key,[.122,.200,.208],bright,.474,.014,.013,.018);
 box(key,[.084,.155,.205],trim,.774,.010,.010,.015);
 return key;
}
function makeRoom(parent,colors,cave){
 const room=group(parent),stone=flatMaterial(cave?'#241f34':'#233954',{roughness:.74}),base=flatMaterial(cave?'#120e1d':'#152233');
 const step=mesh(room,new THREE.CylinderGeometry(3.18,3.28,.36,12),stone,0,-.221,0);
 step.receiveShadow=true;
 mesh(room,new THREE.CylinderGeometry(3.32,3.37,.20,12),base,0,-.44,0);
 const inlay=flatMaterial(cave?'#9e73d4':colors.plate,{emissive:cave?'#8251f7':colors.radiance,emissiveIntensity:cave?.62:.19,roughness:.38});
 for(const rad of [2.48,2.68]){
  const line=mesh(room,new THREE.TorusGeometry(rad,.014,5,80),inlay,0,-.038,0);
  line.rotation.x=pi/2;
 }
 for(let i=0;i<24;i++){
  const a=i/24*turn;
  const mark=box(room,[.105,.026,.212],inlay,2.84*Math.sin(a),-.037,2.84*Math.cos(a),0);
  mark.rotation.y=a;
  if(i%3===0){
   const gem=mesh(room,new THREE.OctahedronGeometry(.089),inlay,2.83*Math.sin(a),.026,2.83*Math.cos(a));
   gem.rotation.y=a;
  }
 }
 const tiles=new THREE.InstancedMesh(new RoundedBoxGeometry(1.14,.145,1.14,1,.037),flatMaterial('#687c95',{roughness:.88}),196);
 const o=new THREE.Object3D(),color=new THREE.Color();let count=0;
 for(let z=-7;z<7;z++)for(let x=-7;x<7;x++){
  const hash=Math.sin((x+9)*17+(z+9)*13)*.5+.5;
  o.position.set(x*1.175+(z%2)*.16,-.66+.04*hash,z*1.175);
  o.rotation.y=.017*(hash-.5);o.updateMatrix();tiles.setMatrixAt(count,o.matrix);
  color.set(cave?'#56536a':'#abbede').multiplyScalar(.54+.37*hash);
  tiles.setColorAt(count++,color);
 }
 tiles.receiveShadow=true;room.add(tiles);
 if(cave){
  const rock=flatMaterial('#252032',{flatShading:true,roughness:.93});
  for(let i=0;i<19;i++){
   const a=pi/2+(i/18)*pi, dist=5.3+(i%3)*.43;
   const x=dist*Math.sin(a),z=dist*Math.cos(a)-1.4;
   const height=2.3+(i%7)*.6;
   const pillar=mesh(room,new THREE.DodecahedronGeometry(1,0),rock,x,height/2-.65,z);
   pillar.scale.set(1.04+(i%3)*.3,height*.67,1.12);
   pillar.rotation.set(i*.37,i*.74,(i%3-1)*.13);
   const stone=mesh(room,new THREE.ConeGeometry(.31+(i%4)*.17,1.75+(i%5)*.52,5),rock,x,4.2+(i%2)*.77,z+.51);
   stone.rotation.z=pi+(i%3-1)*.21;
  }
  for(let i=0;i<8;i++){
   const a=pi/2+(i/7)*pi;
   const shard=mesh(room,new THREE.OctahedronGeometry(.22+(i%3)*.082),inlay,3.67*Math.sin(a),.09,3.67*Math.cos(a)-.35);
   shard.scale.y=2.2;shard.rotation.z=(i%3-1)*.24;
  }
 }else{
  const pillar=flatMaterial('#2b4260',{roughness:.63});
  for(const x of [-5.6,-3.8,3.8,5.6]){
   box(room,[.94,.40,.94],base,x,-.29,-4.02,.09);
   box(room,[.66,4.15,.67],pillar,x,1.9,-4.02,.06);
   box(room,[.87,.20,.83],inlay,x,3.93,-4.02,.05);
  }
  box(room,[12.4,.26,.66],pillar,0,4.26,-4.02,.05);
 }
 return room;
}
function glowPlane(parent,color,width,opacity){
 const finish=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{hue:{value:new THREE.Color(color)},power:{value:opacity}},
  vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 hue;uniform float power;varying vec2 p;void main(){float r=length((p-.5)*2.);gl_FragColor=vec4(hue,exp(-r*r*5.6)*pow(max(0.,1.-r),.65)*power);\n#include <colorspace_fragment>\n}'});
 return mesh(parent,new THREE.PlaneGeometry(width,width),finish);
}
function particles(parent,hint){
 const m=new THREE.MeshBasicMaterial({color:hint.color,transparent:true,opacity:.92});
 const materialDark=new THREE.MeshBasicMaterial({color:hint.shadow||'#9362b0',transparent:true,opacity:.88});
 const bits=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.075,0),m,120);
 const soot=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.075,0),materialDark,50);
 bits.frustumCulled=soot.frustumCulled=false;
 parent.add(bits,soot);
 const tmp=new THREE.Object3D();
 const sample=Array.from({length:120},(_,i)=>({
  angle:i*2.399963229728653+Math.sin(i*27)*.20,distance:1.15+(i*13%17)/8,height:.48+(i*39%31)/12,size:.43+(i*71%13)/15
 }));
 function draw(time,drop,turnEnd){
  const life=fraction(time,drop,drop+.86),burst=fraction(time,turnEnd,turnEnd+1.0);
  const ratio=time>=turnEnd?burst:life;
  const alive=(time>=drop&&ratio<1)?1-ratio:0;
  const count=time>=turnEnd?Math.min(120,48+hint.amount):hint.amount;
  const darkCount=hint.shadow?Math.min(Math.floor(count*.46),50):0;
  bits.count=alive>0?count:0;soot.count=alive>0?darkCount:0;
  const progress=out(ratio),lift=time>=turnEnd?1.25:.19;
  for(let i=0;i<bits.count;i++){
   const {angle,distance,height,size}=sample[i],rad=.4+distance*progress;
   tmp.position.set(Math.cos(angle)*rad,lift+height*progress*(1-ratio*.59),Math.sin(angle)*rad*.70);
   tmp.rotation.set(angle+time*3,i*time*.12,time*6);
   tmp.scale.set(size*alive,size*(1.05+progress)*alive,size*alive);
   tmp.updateMatrix();bits.setMatrixAt(i,tmp.matrix);
   if(i<darkCount){
    tmp.position.x*=-1.09;tmp.position.z*=1.17;tmp.position.y+=.23;
    tmp.scale.multiplyScalar(1.27);tmp.updateMatrix();soot.setMatrixAt(i,tmp.matrix);
   }
  }
  bits.instanceMatrix.needsUpdate=true;soot.instanceMatrix.needsUpdate=true;
 }
 return {draw};
}
function batchModels(parent){
 const byFinish=new Map();
 for(const child of parent.children){
  if(child.isGroup)batchModels(child);
  if(!child.isMesh||child.isInstancedMesh)continue;
  const stamp=child.material.id+':'+Number(child.castShadow)+Number(child.receiveShadow);
  if(!byFinish.has(stamp))byFinish.set(stamp,[]);
  byFinish.get(stamp).push(child);
 }
 for(const copies of byFinish.values()){
  if(copies.length<2)continue;
  const pieces=copies.map(part=>{
   part.updateMatrix();
   const geometry=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();
   return geometry.deleteAttribute('uv').applyMatrix4(part.matrix);
  });
  const geometry=mergeGeometries(pieces);
  pieces.forEach(part=>part.dispose());
  if(!geometry)continue;
  const first=copies[0],unified=mesh(parent,geometry,first.material);
  unified.castShadow=first.castShadow;unified.receiveShadow=first.receiveShadow;
  parent.remove(...copies);
  copies.forEach(part=>part.geometry.dispose());
 }
}
function disposeScene(scene){
 const objects=new Set();
 scene.traverse(o=>{
  if(o.isInstancedMesh)o.dispose();
  if(o.geometry)objects.add(o.geometry);
  if(o.material)objects.add(o.material);
  if(o.shadow)objects.add(o.shadow);
 });
 objects.forEach(item=>item.dispose());
}

export function createChestRevealWorld(canvas,tier,rarity){
 const context=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});
 if(!context)return null;
 const renderer=new THREE.WebGLRenderer({canvas,context,alpha:true});
 renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const scene=new THREE.Scene(),rig=group(scene);
 const {colors,hint}=palettes(tier,rarity),cave=rarity==='impossible';
 const room=makeRoom(rig,colors,cave),hall=cave?makeRoom(rig,colors,false):null;
 const caveFloor=cave?-4.4:0;
 room.position.y=caveFloor;
 const color=colors.body;
 const accents={
  frame:flatMaterial(colors.plate,{metalness:.39,roughness:.32}),
  edge:flatMaterial(colors.edge,{metalness:.29,roughness:.43}),
  trim:flatMaterial(colors.edge,{metalness:.24,roughness:.39}),
  bright:flatMaterial('#eaffff',{metalness:.26,roughness:.31}),
  dark:flatMaterial('#182132',{roughness:.65}),
  iris:new THREE.MeshBasicMaterial({color:colors.iris,toneMapped:false}),
  body:flatMaterial(color,{roughness:.52}),wood:flatMaterial(colors.grain,{roughness:.67}),lining:flatMaterial(empty,{roughness:.70})
 };
 const chest=chestModel(rig,accents,tier);
 const keyColor=hint.key?new THREE.Color(hint.key):null;
 const keyParts=keyColor?{
  ...accents,frame:flatMaterial(keyColor,{metalness:.46,roughness:.29}),
  edge:flatMaterial(keyColor.clone().multiplyScalar(.33),{metalness:.4,roughness:.4}),
  iris:new THREE.MeshBasicMaterial({color:hint.color,toneMapped:false})
 }:accents;
 const key=demonKey(chest.rig,keyParts,tier),flecks=particles(group(rig,0,caveFloor,0),hint);
 batchModels(chest.rig);batchModels(room);if(hall)batchModels(hall);
 const bloom=glowPlane(rig,hint.color,5,.0),keyGlow=glowPlane(rig,hint.color,1.14,0);
 const under=glowPlane(rig,hint.color,7.1,.25);
 under.position.y=-.023;under.rotation.x=-pi/2;
 const sky=scene.fog=new THREE.Fog(cave?'#0a0912':colors.room,11,24);
 const hemi=new THREE.HemisphereLight(cave?'#bfbeff':'#d5e9ff','#453346',2.28);
 const front=place(scene,new THREE.DirectionalLight('#fff1dc',2.65),-3.8,7,6);
 front.castShadow=true;
 Object.assign(front.shadow.camera,{left:-3.9,right:3.9,bottom:-3.9,top:3.9,near:.65,far:16});
 front.shadow.mapSize.set(768,768);front.shadow.bias=-.00013;front.shadow.normalBias=.014;
 const rim=place(scene,new THREE.PointLight(cave?'#875ffa':colors.radiance,19,13,1.6),2.5,3.1,-2.85);
 const rays=rarity==='divine'||rarity==='apex'?Array.from({length:6},(_,i)=>{
  const beam=glowPlane(scene,i%3===1&&rarity==='apex'?'#ac6bff':'#ffe078',2.4,0);
  beam.position.set((i-2.5)*.99,2.8,-1.4-((i+2)%4)*.31);
  beam.rotation.z=(i-2.5)*-.24;beam.scale.set(.41,4.2,1);
  return beam;
 }):[];
 const flood=place(rig,new THREE.PointLight(hint.color,2.5,10,1.7),0,1.15,.28);
 scene.add(hemi);
 const view=new THREE.PerspectiveCamera(39,1,.06,42);
 const focus=v(),bow=v(),spinAxis=v(1,0,0),upAxis=v(0,1,0),aim=new THREE.Quaternion(),spin=new THREE.Quaternion();
 let width=0,height=0,disposed=false;
 function draw(ms,timePlan,phase){
  if(disposed||context.isContextLost())return false;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(!w||!h)return false;
  if(width!==w||height!==h){
   width=w;height=h;view.aspect=w/h;view.updateProjectionMatrix();
   renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.40,Math.sqrt(1_950_000/(w*h))));
   renderer.setSize(w,h,false);
  }
  const t=ms/1000,{descent,landing,settle,turnStart,turnEnd,open}=timePlan;
  const p=phase==='cards'?1:smooth(fraction(t,turnEnd,open));
  const base=t-descent;
  const descend=cave?fraction(t,.07,descent):1;
  const impact=t-landing;
  const fall=fraction(t,descent+.10,landing);
  const bounce=impact<0?(1-fall**2)*(cave?1.45:4):Math.max(0,Math.sin(impact*14.5))*.42*Math.exp(-impact*5.7);
  const shakeStart=fraction(t,landing,settle),shaking=(1-shakeStart)*Math.sin(shakeStart*pi)*hint.power;
  const baseY=cave&&t<descent?(-2.95*smooth(descend)):caveFloor+bounce;
  chest.rig.position.set(shaking*.165*Math.cos(t*34),baseY,0);
  chest.rig.rotation.set((1-fall)*.24*Math.sin(base*5),-.32-(1-fall)*.42+shaking*.09*Math.sin(t*31),shaking*.11*Math.cos(t*35));
  chest.rig.scale.y=1-(impact>=0?.082*Math.exp(-impact*13):0);
  chest.hinge.rotation.x=-1.95*p-.075*Math.sin(p*pi*2)*(1-p);
  const fly=smooth(fraction(t,settle,turnStart)),twist=fraction(t,turnStart,turnEnd);
  const withdraw=smooth(fraction(t,turnEnd-.035,turnEnd+.39));
  key.visible=t>=settle&&t<turnEnd+.4;
  key.position.set((1-fly)*2.8+withdraw*1.04,.786+(1-fly)*2.01+withdraw*.94,2.186+(1-fly)*1.35+withdraw*1.56);
  aim.setFromAxisAngle(upAxis,-.39+2.04*fly);spin.setFromAxisAngle(spinAxis,(1-fly)*-.5-1.30*smooth(twist)+.47*withdraw);
  key.quaternion.copy(aim).multiply(spin);
  const cameraWide=Math.min(1,view.aspect)/.9;
  const distance=8.1+Math.max(0,1-cameraWide)*4.35;
  const gallery=phase==='cards';
  rig.position.y=-caveFloor*smooth(fraction(descend,.09,.93));
  room.visible=!cave||descend>=.45;
  if(hall)hall.visible=descend<.51;
  const falling=cave?.51*Math.sin(pi*descend):0;
  view.position.set(.76+(1-fly)*.42,3.38-falling+(.7*gallery),distance+gallery*1.30);
  focus.set(0,1.18-(.14*gallery),0);view.lookAt(focus);
  chest.rig.localToWorld(bow.copy(key.position));
  keyGlow.position.copy(rig.worldToLocal(bow));
  keyGlow.quaternion.copy(view.quaternion);
  keyGlow.material.uniforms.power.value=key.visible?hint.power*(1-withdraw)*.44:0;
  bloom.position.set(0,caveFloor+1.17+.54*p,.48);bloom.quaternion.copy(view.quaternion);
  bloom.material.uniforms.power.value=(p*.87+shaking*.37)*(.70+hint.power*.15)*(gallery?.63:1);
  under.position.y=caveFloor-.023;
  flood.position.y=caveFloor+1.15;
  flood.intensity=1.8+p*18+shaking*7;
  under.material.uniforms.power.value=.19+shaking*.63+p*.45;
  hemi.intensity=cave?1.29-descend*.28+smooth(descend)*.48:2.17;
  front.intensity=cave?2.03-.96*Math.sin(pi*descend):2.65;
  sky.near=gallery?9:11;
  rim.intensity=cave?13+descend*6:19;
  rays.forEach((beam,i)=>{
   beam.material.uniforms.power.value=(shaking+.36*fly+p*1.12)*(.22+.09*Math.cos(i*1.5+t*2.4));
  });
  flecks.draw(t,landing,turnEnd);
  renderer.render(scene,view);
  return true;
 }
 return {draw,dispose(){
  if(disposed)return;
  disposed=true;disposeScene(scene);renderer.dispose();
  if(!context.isContextLost())renderer.forceContextLoss();
 }};
}
