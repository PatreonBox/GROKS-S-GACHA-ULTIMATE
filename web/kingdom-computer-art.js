import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Fixed furniture and keycaps share a single draw. Preserve the small bevels that
// catch the room light when the house roof opens.
function furnitureParts(){
 const pieces=[];
 function add(geometry,color,x,y,z,rx=0,ry=0,rz=0){
  if(geometry.index){
   const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;
  }
  geometry.rotateX(rx);geometry.rotateY(ry);geometry.rotateZ(rz);
  geometry.translate(x,y,z);
  geometry.deleteAttribute('uv');
  const tint=new THREE.Color(color),count=geometry.attributes.position.count,colors=new Float32Array(count*3);
  for(let i=0;i<count;i++)tint.toArray(colors,3*i);
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));pieces.push(geometry);
 }
 function box(color,x,y,z,w,h,d,bevel=0){
  const shape=bevel?new RoundedBoxGeometry(w,h,d,1,bevel):new THREE.BoxGeometry(w,h,d);
  add(shape,color,x,y,z);
 }
 function cylinder(color,x,y,z,top,bottom,height,rx=0,sides=12){
  add(new THREE.CylinderGeometry(top,bottom,height,sides),color,x,y,z,rx);
 }
 function rod(color,from,to,radius){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to);
  const line=b.clone().sub(a),geometry=new THREE.CylinderGeometry(radius,radius,line.length(),6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),line.normalize()));
  const centre=a.lerp(b,.5);add(geometry,color,centre.x,centre.y,centre.z);
 }
 function finish(name){
  const geometry=mergeGeometries(pieces);pieces.forEach(piece=>piece.dispose());
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.73,metalness:.06}));
  mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
 }
 return {add,box,cylinder,rod,finish};
}

const plastic='#d6cfaa',lightPlastic='#e8e0c2',aged='#b7ae8d',graphite='#454a48';
const oak='#9c6245',oakEdge='#c68a57',metal='#566262',rubber='#363e40';

function makeDesk(parts,upgraded){
 const {box,cylinder,rod}=parts,seatX=upgraded?-.105:0;
 box(oak,0,.425,-.147,1.04,.072,.598,.012);
 box(oakEdge,0,.450,.143,1.034,.02,.014,.003);
 for(const side of [-1,1]){
  const x=side*.454;
  for(const z of [-.385,.094]){
   box(metal,x,.211,z,.04,.413,.044,.004);
   box(rubber,x,.011,z,.054,.021,.055,.003);
  }
  box('#665348',x,.387,-.145,.038,.07,.51);
 }
 box('#764b39',0,.365,-.39,.92,.092,.028);
 box('#794c37',.281,.367,.075,.269,.047,.13,.004);
 box('#524a43',.281,.367,.145,.077,.009,.011);
 if(upgraded){
  cylinder(rubber,seatX,.168,.327,.033,.036,.23);
  for(let i=0;i<5;i++){
   const a=Math.PI*2*i/5,dx=Math.sin(a),dz=Math.cos(a);
   rod(metal,[seatX,.083,.327],[seatX+dx*.162,.046,.327+dz*.162],.017);
   cylinder(rubber,seatX+dx*.162,.027,.327+dz*.162,.023,.023,.033,Math.PI/2,8);
  }
  box('#354b55',seatX,.277,.326,.322,.075,.31,.021);
  box('#526c70',seatX,.591,.498,.303,.248,.047,.019);
  rod(metal,[seatX,.269,.429],[seatX,.538,.496],.016);
 }else{
  for(const side of [-1,1]){
   const x=seatX+side*.127;
   for(const z of [.224,.43])rod(metal,[x,.25,z],[x+side*.018,.013,z+(z>.3?.035:-.018)],.013);
   rod(metal,[x,.256,.432],[x,.588,.489],.012);
  }
  box('#77694e',seatX,.263,.327,.314,.048,.286,.010);
  box('#78816c',seatX,.553,.486,.302,.125,.034,.009);
 }
 return seatX;
}

// Rings are in the XY plane, with the glass looking out along +Z.
function rim(w,h,r){
 const x=w/2,y=h/2;
 return [[-x+r,-y],[x-r,-y],[x,-y+r],[x,y-r],[x-r,y],[-x+r,y],[-x,y-r],[-x,-y+r]];
}
function shell(rings,frontCap=true){
 const xyz=[],indices=[];
 for(const [w,h,r,z,dy=0] of rings)for(const [x,y] of rim(w,h,r))xyz.push(x,y+dy,z);
 for(let n=0;n<rings.length-1;n++)for(let i=0;i<8;i++){
  const a=n*8+i,b=n*8+(i+1)%8;indices.push(a,b,b+8,a,b+8,a+8);
 }
 const end=(rings.length-1)*8;
 for(let i=1;i<7;i++){
  indices.push(0,i+1,i);
  if(frontCap)indices.push(end,end+i,end+i+1);
 }
 const shape=new THREE.BufferGeometry();
 shape.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
 shape.setIndex(indices);
 const flat=shape.toNonIndexed();shape.dispose();flat.computeVertexNormals();return flat;
}

function makeKeyboard(parts,x,upgraded){
 const {box}=parts;
 const z=.063,width=.382;
 box(aged,x,.476,z,width,.029,.122,.007);
 box('#7b7a68',x,.49,z,width-.018,.008,.106);
 const keys=upgraded?'#cdd2c8':'#e6ddba',action=upgraded?'#638b91':'#93967d';
 for(let row=0;row<4;row++)for(let col=0;col<13;col++){
  if(row===3&&col>=3&&col<=7)continue;
  const gap=col>=10?.010:0;
  box(col===12||row===0&&col===0?action:keys,x-.165+col*.026+gap,.502,z-.039+row*.026,.021,.014,.019);
 }
 box(keys,x-.035,.502,z+.039,.124,.014,.019);
 box('#394b52',x+.271,.467,.049,.13,.009,.156,.006);
 box(upgraded?'#b6b7a8':'#cbc3a0',x+.275,.482,.040,.044,.033,.078,.011);
 box(graphite,x+.275,.498,.025,.006,.005,.022);
}

function makeMonitor(parts,upgraded){
 const {box,add,cylinder}=parts;
 const x=upgraded?-.12:0,centreY=upgraded?.767:.814;
 const front=upgraded?-.038:-.045;
 const w=upgraded?.522:.492,h=upgraded?.407:.367;
 const displayW=upgraded?.420:.377,displayH=upgraded?.297:.257;
 const casing=upgraded?'#cfceba':plastic;
 if(!upgraded){
  // The starter's drive enclosure doubles as the monitor plinth.
  box(aged,x,.477,-.204,.574,.031,.383,.006);
  box(plastic,x,.533,-.199,.58,.102,.39,.007);
  box('#9f9a80',x,.494,.000,.564,.008,.007);
  box('#d1c8a9',x+.139,.545,.000,.175,.047,.011);
  box(graphite,x+.134,.548,.006,.123,.008,.006);
  box(plastic,x+.20,.533,.006,.03,.009,.008);
  box('#77b36c',x+.051,.545,.007,.009,.006,.005);
  for(let i=0;i<9;i++)box('#8a8874',x-.23+.012*i,.536,.001,.005,.029,.007);
  cylinder(aged,x,.597,-.213,.106,.139,.025);
  cylinder(casing,x,.619,-.206,.084,.093,.025);
 }else{
  box('#adae9d',x,.479,-.202,.294,.035,.247,.010);
  cylinder('#a7a995',x,.529,-.216,.092,.067,.086);
  const towerX=.286,towerZ=-.213,face=-.019;
  box(rubber,towerX,.475,towerZ,.163,.03,.343,.005);
  box('#c2c2b0',towerX,.657,towerZ,.171,.344,.37,.007);
  box('#dedbc7',towerX,.658,face,.165,.329,.015,.004);
  for(const y of [.765,.706]){
   box('#a09f91',towerX,y,face+.011,.146,.052,.009,.002);
   box('#d3cfba',towerX,y+.003,face+.018,.137,.040,.008);
   box(graphite,towerX-.006,y+.012,face+.023,.109,.004,.002);
   box('#7d8377',towerX+.044,y-.008,face+.023,.022,.006,.004);
  }
  box('#7c8176',towerX,.643,face+.01,.098,.009,.006);
  cylinder('#a7ac97',towerX+.038,.573,face+.013,.013,.013,.007,Math.PI/2);
  cylinder('#76c89a',towerX+.038,.573,face+.018,.005,.005,.002,Math.PI/2);
  for(let r=0;r<2;r++)for(let c=0;c<8;c++)
   box('#8d9186',towerX-.061+c*.017,.514+r*.013,face+.009,.008,.005,.005);
  for(let i=0;i<5;i++)box('#939786',towerX+.086,.702,-.282+i*.019,.003,.085,.008);
 }
 // The narrow, inset rear cap and its bevel distinguish the CRT from a flat panel.
 add(shell([[w*.54,h*.64,.028,-.343,.009],[w*.64,h*.76,.024,-.306,.006],
  [w*.97,h*.96,.022,-.103],[w,h,.018,-.039],[w,h,.018,0]]),casing,x,centreY,front);
 const glassY=centreY+.014;
 add(shell([[w,h,.018,0],[w-.010,h-.010,.016,.010],[displayW+.019,displayH+.019,.015,.012,.014],
  [displayW,displayH,.012,.003,.014]],false),upgraded?'#d5d3c1':lightPlastic,x,centreY,front);
 box('#414c49',x,glassY,front+.002,displayW+.003,displayH+.003,.007,.004);
 for(const side of [-1,1])for(let i=0;i<6;i++){
  // Vents sit on the wide front portion of the moulding.
  box('#8c8e7e',x+side*(w/2-.003),centreY+h*.19-i*.018,front-.058,.005,.006,.034);
 }
 box('#7a7c6f',x,centreY-h/2+.019,front+.013,.060,.009,.004);
 cylinder(upgraded?'#82d5ac':'#b0d565',x+w*.354,centreY-h/2+.024,front+.014,.005,.005,.003,Math.PI/2);
 for(let i=0;i<(upgraded?4:2);i++)box(aged,x+w*.18+i*.014,centreY-h/2+.024,front+.014,.008,.009,.005);
 return makeGlass(x,glassY,front+.006,displayW,displayH,upgraded);
}

// One tiny, resolution-independent game screen. Quantizing the sample positions
// gives the older monitor chunky phosphor pixels and a legible silhouette.
function makeGlass(x,y,z,w,h,upgraded){
 const geometry=new THREE.PlaneGeometry(w-.003,h-.003,12,8);
 const positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  const px=positions.getX(i)/(w*.5),py=positions.getY(i)/(h*.5);
  positions.setZ(i,.006*(1-px*px)*(1-py*py));
 }
 const material=new THREE.ShaderMaterial({
  uniforms:{clock:{value:0},outcome:{value:0},playing:{value:0},colorDisplay:{value:upgraded?1:0}},
  vertexShader:`varying vec2 screenUV; void main(){
   screenUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }`,
  fragmentShader:`varying vec2 screenUV; uniform float clock,outcome,playing,colorDisplay;
   float rect(vec2 p,vec2 halfSize){return step(max(abs(p.x)-halfSize.x,abs(p.y)-halfSize.y),0.);}
   void main(){
    vec2 uv=floor(screenUV*vec2(124.,82.))/vec2(124.,82.);
    vec2 edge=abs(screenUV-.5)*2.;
    float vignette=1.-.26*dot(edge,edge);
    vec3 sky=mix(vec3(.009,.044,.042),vec3(.020,.101,.086),uv.y);
    vec3 sunset=mix(vec3(.95,.26,.075),vec3(.10,.34,.59),smoothstep(.28,.96,uv.y));
    vec3 color=mix(sky,sunset,colorDisplay);
    float scroll=playing>.5?clock*.245:.21;
    float dune=.30+.08*sin(uv.x*7.+scroll*.3)+.13*sin(uv.x*3.2+1.2);
    color=mix(color,mix(vec3(.025,.15,.105),vec3(.46,.094,.041),colorDisplay),1.-step(dune,uv.y));
    float hill=.23+.17*(1.-abs(2.*fract(uv.x*1.48+scroll*.16)-1.));
    color=mix(color,mix(vec3(.027,.19,.13),vec3(.40,.15,.10),colorDisplay),1.-step(hill,uv.y));
    vec3 floorColor=mix(vec3(.02,.16,.103),vec3(.05,.14,.18),colorDisplay);
    vec3 light=mix(vec3(.35,.88,.46),vec3(.65,1.,.84),colorDisplay);
    float base=.17;
    color=mix(color,floorColor,1.-step(base,uv.y));
    float rib=1.-step(.028,fract((uv.x+scroll)*12.));
    color+=floorColor*.85*rib*(1.-step(base,uv.y));
    color=mix(color,light,(1.-step(.012,abs(uv.y-base))));
    float lane=fract((uv.x-.30+scroll)/.53+.5);
    float spike=.112*(1.-abs(2.*lane-1.)*7.);
    color=mix(color,light,step(0.,spike)*step(base,uv.y)*step(uv.y,base+spike));
    float jump=max(0.,1.-abs(fract(scroll/.53+.5)-.5)*5.);
    if(playing<.5)jump=0.;
    vec2 q=(uv-vec2(.30,base+.057+.24*jump))*vec2(1.46,1.);
    float angle=jump*3.14;
    q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
    color=mix(color,vec3(.01,.05,.06),rect(q,vec2(.066)));
    color=mix(color,light,rect(q,vec2(.053)));
    color=mix(color,floorColor,rect(q,vec2(.030)));
    color=mix(color,light,rect(q,vec2(.015)));
    float progress=playing>.5?fract(clock/5.7):.34;
    float track=rect(uv-vec2(.5,.91),vec2(.38,.013));
    color=mix(color,light,track*(.17+.63*step(uv.x,.12+.76*progress)));
    color=mix(color,vec3(.63,.09,.045),.31*max(0.,-outcome));
    color=mix(color,vec3(.50,.95,.55),.28*max(0.,outcome));
    float scan=1.-.055*step(.68,fract(screenUV.y*72.));
    gl_FragColor=vec4(color*vignette*scan,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
 material.name=upgraded?'Colour CRT phosphor':'Green CRT phosphor';
 // A preview and a placed clone may share this material. Animation belongs to
 // each mesh, so rendering the overview cannot overwrite the other screen.
 material.onBeforeRender=(_renderer,_scene,_camera,_geometry,mesh)=>{
  const {uniforms}=material;
  uniforms.clock.value=mesh.userData.gameClock||0;
  uniforms.outcome.value=mesh.userData.outcome||0;
  uniforms.playing.value=mesh.userData.playing?1:0;
  material.uniformsNeedUpdate=true;
 };
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='computer-glass';mesh.position.set(x,y,z);return mesh;
}

function makeEmotion(type){
 const part=furnitureParts();
 if(type==='anger'){
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2,dx=Math.cos(a),dy=Math.sin(a);
   const corner=[.036*dx,.036*dy,0];
   part.rod('#fc7146',[corner[0]-.022*dy,corner[1]+.022*dx,0],corner,.006);
   part.rod('#fc7146',corner,[.067*dx,.067*dy,0],.006);
  }
 }else if(type==='joy'){
  for(const [x,y,r] of [[0,0,.043],[.064,.044,.024],[-.044,.059,.016]]){
   const g=new THREE.OctahedronGeometry(r);g.scale(.65,1.22,.45);part.add(g,'#ffda71',x,y,0);
  }
 }else{
  for(const [x,y,r] of [[0,0,.024],[.035,.047,.013]]){
   const g=new THREE.OctahedronGeometry(r);g.scale(.68,1.3,.56);part.add(g,'#7ee5dd',x,y,0);
  }
 }
 const mesh=part.finish('computer-'+type);
 mesh.castShadow=mesh.receiveShadow=false;mesh.visible=false;return mesh;
}

export function makeKingdomComputer(level=1){
 const upgraded=level>=2,station=new THREE.Group(),parts=furnitureParts();
 const seatX=makeDesk(parts,upgraded);
 makeKeyboard(parts,seatX,upgraded);
 const screen=makeMonitor(parts,upgraded);
 const seat=new THREE.Group();seat.name='computer-seat';
 seat.position.set(seatX,upgraded?.482:.466,.323);
 seat.rotation.y=Math.PI;seat.scale.setScalar(.34);
 station.name=upgraded?'Tower PC workstation':'Brick PC workstation';
 station.userData.level=upgraded?2:1;
 station.add(parts.finish('computer-furniture'),screen,seat);
 for(const type of ['anger','joy','stress']){
  const emotion=makeEmotion(type);
  emotion.position.set(seatX+.19,.73,.352);station.add(emotion);
 }
 return station;
}

const turn=Math.PI*2;
const clamp01=value=>Math.max(0,Math.min(1,value));
const ease=value=>{const n=clamp01(value);return n*n*(3-2*n);};
const bump=(p,start,width)=>p<=start||p>=start+width?0:Math.sin(Math.PI*(p-start)/width)**2;
const gate=(p,start,stop,fade=.14)=>ease((p-start)/fade)*(1-ease((p-stop)/fade));
const reactionOrder=['deskSlam','doubleHop','lockedIn','chairRattle','finally','deathStare','deepBreath','victorySpin','tilt'];
const events={
 deskSlam(p,pose){
  const lift=bump(p,.03,.33),slam=bump(p,.34,.19)+.67*bump(p,.64,.17);
  pose.y+=.27*lift-.06*slam;pose.pitch+=.44*lift-.53*slam;pose.w+=.16*slam;pose.h-=.19*slam;
 },
 chairRattle(p,pose){
  const envelope=gate(p,.03,.72),rattle=Math.sin(p*turn*5.2)*envelope;
  pose.x+=.09*rattle;pose.roll+=.30*rattle;pose.y+=.06*Math.abs(rattle);pose.pitch-=.16*envelope;
 },
 deathStare(p,pose){
  const stare=gate(p,.03,.77,.21),snap=bump(p,.60,.19);
  pose.yaw+=2.85*stare;pose.pitch-=.27*stare;pose.z-=.12*stare+.15*snap;
  pose.h-=.09*stare;pose.w+=.10*stare;pose.roll+=.065*stare;
 },
 tilt(p,pose){
  const lean=gate(p,.05,.69,.18);
  pose.pitch+=.57*lean;pose.roll+=.24*Math.sin(p*turn*1.7)*lean;pose.yaw-=.82*lean;pose.z-=.16*lean;
 },
 doubleHop(p,pose){
  const hop=bump(p,.04,.35)+.86*bump(p,.47,.35),land=bump(p,.38,.10)+bump(p,.80,.13);
  pose.y+=.48*hop-.06*land;pose.roll+=.25*Math.sin(turn*p)*hop;pose.h+=.07*hop-.18*land;pose.w+=.13*land;
 },
 finally(p,pose){
  const sink=gate(p,.17,.69,.22);pose.y-=.07*sink;pose.pitch+=.38*sink;
  pose.roll-=.28*sink;pose.w+=.10*sink;pose.h-=.14*sink;
 },
 victorySpin(p,pose){
  const launch=bump(p,.13,.63);
  pose.y+=.53*launch;pose.yaw+=turn*ease((p-.13)/.63);
  pose.roll+=.17*launch;pose.h-=.15*bump(p,0,.18)+.10*bump(p,.74,.21);
 },
 lockedIn(p,pose){
  const hold=gate(p,.04,.73,.13);
  pose.pitch-=.27*hold;pose.z+=.09*hold;pose.roll+=.033*Math.sin(7*turn*p)*hold;
  pose.h+=.13*hold;pose.w-=.10*hold;
 },
 deepBreath(p,pose){
  const breath=bump(p,.03,.70),exhale=bump(p,.67,.29);
  pose.h+=.23*breath-.11*exhale;pose.w-=.12*breath-.07*exhale;
  pose.pitch+=.13*breath-.13*exhale;pose.y+=.055*breath;
 }
};
const positive=new Set(['doubleHop','finally','victorySpin']),restrained=new Set(['lockedIn','deepBreath']);
const rigs=new WeakMap();
function rigFor(station){
 let rig=rigs.get(station);
 if(!rig){
  const find=suffix=>station.getObjectByName('computer-'+suffix);
  rig={screen:find('glass'),seat:find('seat'),anger:find('anger'),joy:find('joy'),stress:find('stress'),pose:{},seed:null,offset:0};
  rigs.set(station,rig);
 }
 return rig;
}

// Attach makeResident().resident to computer-seat and pass its .body here. Seconds
// are elapsed gameplay time. Seeds consistently vary reactions between residents.
export function animateKingdomComputer(station,body,seconds,seed=0,reducedMotion=false){
 const rig=rigFor(station),screen=rig.screen.userData;
 screen.playing=Boolean(body);
 if(!body){
  screen.gameClock=screen.outcome=0;rig.anger.visible=rig.joy.visible=rig.stress.visible=false;return 'idle';
 }
 if(seed!==rig.seed){
  rig.seed=seed;
  let hash=0;
  for(const char of String(seed))hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
  rig.offset=hash;
 }
 const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
 const sceneTime=t+(rig.offset%37)*.041,attemptLength=8.1,playLength=5.7;
 const index=Math.floor(sceneTime/attemptLength),local=sceneTime-index*attemptLength;
 const reaction=local>=playLength?reactionOrder[(index+rig.offset)%reactionOrder.length]:null;
 const p=clamp01((local-playLength)/(attemptLength-playLength));
 const pose=rig.pose,breathe=reducedMotion?0:Math.sin(t*2.45);
 pose.x=0;pose.y=.006*breathe;pose.z=0;pose.yaw=0;pose.roll=0;pose.w=1;pose.h=1;
 const taps=reducedMotion||reaction?0:Math.max(0,Math.sin(t*10.1))**3;
 pose.pitch=-.075-.035*taps+.012*breathe;
 if(reaction&&!reducedMotion)events[reaction](p,pose);
 body.position.set(pose.x,pose.y,pose.z);body.rotation.set(pose.pitch,pose.yaw,pose.roll);
 body.scale.set(pose.w,pose.h,pose.w);
 const won=positive.has(reaction),quiet=restrained.has(reaction);
 const refresh=station.userData.level===1?30:60;
 screen.gameClock=reducedMotion?0:Math.floor(Math.min(playLength,local)*refresh)/refresh;
 screen.outcome=reaction&&!reducedMotion?gate(p,0,.78)*(won?1:-1):0;
 const show=Boolean(reaction)&&!reducedMotion&&p>.11&&p<.86;
 rig.anger.visible=show&&!won&&!quiet;rig.joy.visible=show&&won;rig.stress.visible=show&&quiet;
 if(show){
  const effect=won?rig.joy:quiet?rig.stress:rig.anger;
  effect.position.set(rig.seat.position.x+.19,.694+.065*p+pose.y*.34,.352);
  effect.scale.setScalar(gate(p,.10,.72));effect.rotation.z=.14*Math.sin(p*turn);
 }
 return reaction||'playing';
}
