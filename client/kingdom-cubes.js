import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const turn=Math.PI*2;
const rect=(x,y,w,h)=>[[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]];
const cornered=(w,h,c)=>[[-w/2+c,-h/2],[w/2-c,-h/2],[w/2,-h/2+c],[w/2,h/2-c],
 [w/2-c,h/2],[-w/2+c,h/2],[-w/2,h/2-c],[-w/2,-h/2+c]];
function polar(r,a,x=0,y=0){return [x+Math.cos(a)*r,y+Math.sin(a)*r]}
function polygon(n,r,angle=0,x=0,y=0){
 return Array.from({length:n},(_,i)=>polar(r,angle+turn*i/n,x,y));
}
function path(points,type=THREE.Shape){
 const outline=new type(points.map(([x,y])=>new THREE.Vector2(x,y)));
 outline.closePath();return outline;
}
function features(cube){
 const accent=new THREE.Color(cube.color);
 const colors={
  bright:accent.clone(),mid:accent.clone().multiplyScalar(.43),deep:accent.clone().multiplyScalar(.14),
  edge:accent.clone().lerp(new THREE.Color('#edf7ff'),.37),glow:accent.clone().lerp(new THREE.Color('#ffffff'),.16),
  dark:new THREE.Color('#0e172b'),trim:new THREE.Color('#30425c'),silver:new THREE.Color('#9bb1d0')
 };
 const batches=[[],[]];
 function add(geometry,paint,z,mirror=false){
  if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat}
  const tint=colors[paint]||new THREE.Color(paint);
  const positions=geometry.getAttribute('position'),rgb=new Float32Array(positions.count*3);
  for(let i=0;i<positions.count;i++)tint.toArray(rgb,i*3);
  geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
  geometry.translate(0,0,z);
  const batch=batches[paint==='glow'?1:0];
  batch.push(geometry);
  if(mirror&&z)batch.push(geometry.clone().translate(0,0,-2*z));
 }
 function box(x,y,z,w,h,d,paint,r=.032,angle=0,mirror=false){
  const geometry=r?new RoundedBoxGeometry(w,h,d,1,r):new THREE.BoxGeometry(w,h,d);
  geometry.rotateZ(angle).translate(x,y,0);
  add(geometry,paint,z,mirror);
 }
 function form(points,z,depth,paint,{bevel=.018,holes=[],mirror=false}={}){
  const shape=path(points);
  for(const hole of holes)shape.holes.push(path(hole,THREE.Path));
  const geometry=new THREE.ExtrudeGeometry(shape,{
   depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:1
  });
  add(geometry.translate(0,0,-depth/2),paint,z,mirror);
 }
 function disc(x,y,z,rad,depth,paint,sides=16,mirror=false){
  const geometry=new THREE.CylinderGeometry(rad,rad,depth,sides);
  geometry.rotateX(Math.PI/2).translate(x,y,0);
  add(geometry,paint,z,mirror);
 }
 function ring(x,y,z,outer,inner,depth,paint,mirror=false,segments=24){
  form(polygon(segments,outer,0,x,y),z,depth,paint,{
   holes:[polygon(segments,inner,0,x,y)],bevel:.009,mirror
  });
 }
 function band(z,outer,inner,start,sweep,depth,paint,mirror=false,x=0,y=0){
  const n=Math.max(3,Math.ceil(sweep*4));
  const angles=Array.from({length:n+1},(_,i)=>start+sweep*i/n);
  form([...angles.map(a=>polar(outer,a,x,y)),...angles.reverse().map(a=>polar(inner,a,x,y))],
   z,depth,paint,{bevel:.009,mirror});
 }
 function orb(x,y,z,w,h,d,paint,mirror=false){
  const geometry=new THREE.SphereGeometry(1,14,10);
  geometry.scale(w/2,h/2,d/2).translate(x,y,0);
  add(geometry,paint,z,mirror);
 }
 function ribbon(points,z,width,paint,mirror=false){
  const center=points.map(([x,y])=>new THREE.Vector3(x,y,0));
  const curve=new THREE.CatmullRomCurve3(center);
  add(new THREE.TubeGeometry(curve,20,width,6,false),paint,z,mirror);
 }
 function finish(){
  const model=new THREE.Group();
  const bounds=new THREE.Box3();
  const merged=batches.map(pieces=>{
   if(!pieces.length)return null;
   const geometry=mergeGeometries(pieces);
   pieces.forEach(piece=>piece.dispose());
   geometry.computeBoundingBox();bounds.union(geometry.boundingBox);return geometry;
  });
  const origin=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const scale=Math.min(1.17/size.y,1.35/size.x,1.35/size.z);
  for(let i=0;i<merged.length;i++){
   const geometry=merged[i];if(!geometry)continue;
   geometry.translate(-origin.x,-bounds.min.y,-origin.z).scale(scale,scale,scale).translate(0,-.53,0);
   const material=i===0?new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.49,metalness:.13,emissive:'#40506a',emissiveIntensity:.10
   }):new THREE.MeshBasicMaterial({vertexColors:true});
   const mesh=new THREE.Mesh(geometry,material);
   mesh.castShadow=i===0;mesh.receiveShadow=i===0; model.add(mesh);
  }
  model.name=cube.name;model.userData.cubeId=cube.id;
  return model;
 }
 return {box,form,disc,ring,band,orb,ribbon,finish};
}
const twin={mirror:true},tinyRim={mirror:true,bevel:.009};
const recipes={
 // Core Frame
 '01'({box,form}){
  const frame=cornered(1.02,1.02,.095),window=rect(0,0,.54,.54);
  form(frame,0,.55,'deep',{holes:[window],bevel:.05});
  form(frame,.317,.10,'bright',{holes:[rect(0,0,.61,.61)],bevel:.022,mirror:true});
  form(cornered(.79,.79,.052),.293,.055,'dark',{holes:[rect(0,0,.48,.48)],bevel:.012,mirror:true});
  box(0,0,0,.49,.49,.44,'trim',.056);
  box(0,0,.257,.27,.27,.12,'glow',.023,0,true);
  for(const x of [-.42,.42])for(const y of [-.42,.42])box(x,y,.389,.068,.068,.023,'edge',.01,0,true);
 },
 // Square One
 '02'({box,form,orb}){
  box(0,0,0,1,1,.82,'mid',.12);
  form(cornered(.92,.92,.102),.419,.078,'bright',twin);
  for(const x of [-.22,.22]){
   box(x,.16,.465,.23,.24,.08,'dark',.039,0,true);
   orb(x,.177,.519,.115,.125,.048,'trim',true);
   box(x+.024,.202,.546,.041,.045,.02,'edge',.008,0,true);
  }
  box(0,-.19,.475,.67,.18,.08,'dark',.043,0,true);
  box(0,-.209,.508,.50,.035,.023,'deep',.007,0,true);
  for(const x of [-.42,.42])box(x,-.335,0,.12,.095,.74,'edge',.023);
 },
 // Crossbolt
 '06'({box,form,disc}){
  const bolt=[[-.16,.54],[.16,.54],[.16,.29],[.29,.29],[.29,.165],[.54,.165],[.54,-.165],[.29,-.165],[.29,-.29],[.16,-.29],[.16,-.54],[-.16,-.54],[-.16,-.29],[-.29,-.29],[-.29,-.165],[-.54,-.165],[-.54,.165],[-.29,.165],[-.29,.29],[-.16,.29]];
  for(const x of [-.37,.37])for(const y of [-.37,.37]){
   box(x,y,0,.27,.27,.55,'dark',.049);
   box(x,y,.287,.19,.19,.05,'trim',.028,0,true);
  }
  form(bolt,0,.45,'deep',{bevel:.04});
  form(bolt,.256,.095,'bright',{holes:[rect(0,0,.23,.23)],mirror:true,bevel:.018});
  disc(0,0,.269,.10,.054,'glow',4,true);
 },
 // Bone Block
 '13'({box,form}){
  const bone=[[-.48,.46],[.48,.46],[.48,-.085],[.125,-.085],[.125,-.26],[.48,-.26],[.48,-.49],[-.48,-.49],[-.48,-.26],[-.125,-.26],[-.125,-.085],[-.48,-.085]];
  form(bone,0,.51,'trim',{bevel:.06});
  const sockets=[rect(-.22,.185,.20,.20),rect(.22,.185,.20,.20)];
  form(bone,.302,.12,'bright',{holes:sockets,bevel:.022,mirror:true});
  for(const x of [-.22,.22])box(x,.185,.239,.29,.29,.08,'dark',.019,0,true);
  for(const x of [-.35,0,.35])box(x,-.371,.371,.102,.049,.025,'edge',.01,0,true);
  box(0,-.153,0,.17,.15,.61,'mid',.021);
 },
 // Shard Grid
 '27'({box,form}){
  box(0,0,0,.74,.74,.43,'dark',.07,Math.PI/4);
  for(const x of [-1,1])for(const y of [-1,1]){
   const corner=[[.18,.51],[.51,.51],[.51,.18],[.39,.18],[.39,.39],[.18,.39]]
    .map(([u,v])=>[x*u,y*v]);
   form(corner,0,.50,'deep',{bevel:.029});
   form(corner,.278,.076,'bright',tinyRim);
   box(x*.33,y*.33,.15,.135,.135,.32,'trim',.023,0,true);
  }
  const top=[[-.225,.255],[.225,.255],[0,.035]],bottom=top.map(([x,y])=>[x,-y]);
  form(top,.313,.125,'edge',twin);form(bottom,.313,.125,'bright',twin);
  form([[0,.14],[.14,0],[0,-.14],[-.14,0]],.411,.065,'glow',tinyRim);
 },
 // Iron Grin
 '39'({form,box}){
  const hull=[[-.42,-.47],[.42,-.47],[.51,-.35],[.51,.22],[.42,.27],[.54,.55],[.14,.475],[0,.425],[-.14,.475],[-.54,.55],[-.42,.27],[-.51,.22],[-.51,-.35]];
  form(hull,0,.68,'deep',{bevel:.049});
  form(hull,.358,.11,'mid',twin);
  form(hull.map(([x,y])=>[x*.91,y*.91]),.435,.047,'bright',tinyRim);
  for(const x of [-.23,.23])box(x,.156,.469,.225,.219,.065,'dark',.032,0,true);
  box(0,-.227,.467,.71,.263,.068,'dark',.035,0,true);
  for(const x of [-.225,0,.225]){
   box(x,-.131,.514,.102,.109,.051,'edge',.012,0,true);
   box(x+.044,-.309,.513,.099,.094,.049,'mid',.012,0,true);
  }
 },
 // Jelly Chomp
 '90'({form,orb,box}){
  const squish=[[-.43,-.47],[.43,-.47],[.49,-.36],[.40,-.22],[.42,.20],[.49,.34],[.44,.47],[-.44,.47],[-.49,.34],[-.42,.20],[-.40,-.22],[-.49,-.36]];
  form(squish,0,.66,'deep',{bevel:.065});
  form(squish,.35,.13,'bright',{...twin,bevel:.041});
  const mouth=[[-.34,.19],[-.225,.105],[-.13,.19],[0,.115],[.13,.19],[.225,.105],[.34,.19],[.31,-.28],[.18,-.37],[-.18,-.37],[-.31,-.28]];
  form(mouth,.452,.062,'dark',twin);
  orb(-.088,-.225,.486,.42,.23,.13,'#a0439b',true);
  orb(.083,-.24,.495,.28,.18,.095,'mid',true);
  for(const x of [-.29,.29]){
   orb(x,.39,.294,.29,.28,.34,'trim',true);
   orb(x,.418,.447,.148,.162,.13,'dark',true);
   orb(x-.035,.454,.502,.056,.057,.030,'edge',true);
   box(x,-.376,0,.19,.16,.65,'mid',.049);
  }
 },
 // Star Circuit
 '22'({box,form,disc}){
  const star=Array.from({length:16},(_,i)=>polar(i%2?.34:.50,i*turn/16));
  form(star,0,.48,'trim',{bevel:.036});
  form(star,.275,.12,'bright',twin);
  for(let i=0;i<8;i++){
   const a=i*turn/8,[x,y]=polar(i%2?.57:.51,a);
   box(x*.77,y*.77,0,.14,.26,.32,'deep',.022,a-Math.PI/2);
   box(x,y,0,i%2?.19:.11,i%2?.19:.15,.39,'mid',.027,a+(i%2?Math.PI/4:0));
   disc(x,y,.218,i%2?.072:.043,.058,'glow',4,true);
  }
  form(polygon(4,.34),.381,.079,'dark',{holes:[polygon(4,.182)],bevel:.013,mirror:true});
  disc(0,0,.269,.133,.22,'deep',4,true);
  disc(0,0,.398,.083,.056,'glow',4,true);
 },
 // Singularity
 '31'({disc,ring,orb,band}){
  disc(0,0,0,.51,.70,'deep',16);
  orb(0,0,0,1.03,1.03,.88,'dark');
  ring(0,0,.301,.515,.413,.16,'trim',true);
  ring(0,0,.414,.364,.292,.068,'dark',true);
  ring(0,0,.456,.228,.155,.048,'mid',true);
  orb(0,0,.423,.268,.268,.22,'bright',true);
  disc(0,0,.54,.083,.023,'glow',18,true);
  for(let i=0;i<4;i++)band(.384,.533,.485,i*turn/4+.13,.30,.081,'edge',true);
 },
 // Glitch Mask
 '56'({box,form}){
  box(0,0,0,.93,.93,.67,'dark',.081);
  form([[-.49,-.46],[-.03,-.46],[-.035,-.12],[.018,-.038],[-.02,.45],[-.41,.49],[-.49,.40]],.362,.135,'bright',twin);
  form([[.045,-.44],[.47,-.42],[.47,.42],[.38,.48],[.036,.44],[.065,.07],[.022,-.06]],.382,.123,'mid',twin);
  const eye=[[-.41,.062],[-.334,.28],[-.081,.094],[-.090,-.066],[-.30,-.214]];
  for(const side of [-1,1]){
   form(eye.map(([x,y])=>[x*side,y]),.453,.081,'dark',twin);
   form([[-.339,.097],[-.161,.065],[-.256,-.008]].map(([x,y])=>[x*side,y]),.515,.032,'trim',tinyRim);
  }
  for(const [x,y] of [[-.44,.38],[.46,-.31],[.37,.438],[-.39,-.45]])box(x,y,.10,.17,.156,.50,'edge',.011,0,true);
 },
 // Broken Gear
 '75'({form,box,disc,ring}){
  const torn=[[-.5,-.47],[.53,-.47],[.49,-.21],[.32,-.29],[.19,-.205],[.07,-.282],[-.12,-.105],[-.01,.035],[.2,-.056],[.34,.055],[.49,-.008],[.5,.49],[-.49,.49],[-.337,.335],[-.47,.195],[-.32,.102],[-.5,-.074]];
  form(torn,0,.56,'deep',{bevel:.042});
  form(torn,.298,.113,'bright',twin);
  ring(.035,.279,.381,.201,.129,.10,'trim',true,16);
  disc(.035,.279,.40,.103,.07,'dark',14,true);
  disc(.035,.279,.442,.06,.021,'mid',12,true);
  box(.322,-.145,0,.17,.082,.58,'trim',.016,-.59);
  box(-.293,-.37,.391,.19,.062,.044,'edge',.01,0,true);
 },
 // Sky Knot
 '199'({form,box}){
  const triangles=[[[-.48,.46],[.48,.46],[0,-.035]],[[-.48,-.46],[.48,-.46],[0,.035]]];
  for(const triangle of triangles){
   const center=triangle.reduce(([x,y],[u,v])=>[x+u/3,y+v/3],[0,0]);
   form(triangle,0,.53,'trim',{holes:[triangle.map(([x,y])=>[center[0]+(x-center[0])*.62,center[1]+(y-center[1])*.62])],bevel:.041});
  }
  form([[-.49,-.49],[.49,.49],[.49,-.234],[.257,-.022],[.354,.08],[.369,.033],[.369,.194],[-.49,-.49]],.31,.135,'bright',twin);
  form([[-.476,-.47],[-.476,.234],[-.237,.03],[-.333,-.078],[-.359,-.029],[-.359,-.191],[.47,.49]],.318,.12,'mid',twin);
  box(0,0,.411,.19,.19,.106,'edge',.022,Math.PI/4,true);
 },
 // Circuit Sentinel
 '217'({box,disc,ring}){
  box(0,.065,0,.77,.78,.69,'deep',.051);
  box(0,.137,.375,.61,.61,.118,'bright',.027,0,true);
  ring(0,.137,.454,.195,.128,.078,'trim',true,16);
  disc(0,.137,.47,.096,.04,'dark',16,true);
  disc(0,.137,.497,.052,.025,'glow',8,true);
  for(const x of [-.49,.49]){
   box(x,.196,0,.13,.61,.50,'mid',.039);
   box(x,.258,.273,.075,.335,.074,'edge',.012,0,true);
   box(x*.69,-.38,0,.251,.28,.62,'trim',.035);
   box(x*.69,-.394,.327,.174,.176,.052,'bright',.016,0,true);
  }
  box(0,-.41,0,.14,.22,.62,'dark',.020);
 },
 // Shatterstorm
 '134'({form,box,disc}){
  box(0,0,0,.39,.39,.53,'dark',.036,Math.PI/4);
  for(let i=0;i<4;i++){
   const a=i*turn/4;
   const shard=[[.06,.16],[.33,.51],[.53,.51],[.49,.28],[.35,.143],[.30,-.011],[.166,.024]];
   const blade=shard.map(([x,y])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]);
   form(blade,i%2?.07:-.07,.52,'trim',{bevel:.030});
   form(blade,.331,.099,i%2?'mid':'bright',twin);
   const ridge=[[.19,.17],[.386,.454],[.476,.457],[.413,.338],[.28,.161]]
    .map(([x,y])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]);
   form(ridge,.391,.052,'edge',tinyRim);
  }
  disc(0,0,.299,.158,.097,'glow',4,true);
 },
 // Side Eye
 '321'({form,box,orb}) {
  const face=[[-.51,-.47],[.51,-.47],[.51,.24],[.39,.37],[.25,.46],[0,.51],[-.28,.46],[-.43,.35],[-.51,.22]];
  form(face,0,.67,'deep',{bevel:.06});
  form(face,.358,.098,'mid',twin);
  const cap=[[-.50,.10],[-.45,.30],[-.28,.47],[-.025,.534],[.228,.484],[.381,.412],[.51,.224],[.489,.123],[.343,.088],[.207,.122],[.129,.045],[-.006,.091],[-.15,.166],[-.359,.113]];
  form(cap,.405,.136,'trim',{...twin,bevel:.028});
  orb(-.242,-.117,.422,.40,.292,.163,'dark',true);
  form([[.07,-.176],[.112,-.067],[.449,.081],[.452,-.094],[.379,-.255],[.176,-.278]],.454,.096,'dark',twin);
  const squint=[[.126,-.164],[.408,-.042],[.376,-.178],[.303,-.22],[.202,-.215]];
  form(squint,.522,.034,'glow',tinyRim);
  orb(.294,-.15,.547,.096,.082,.046,'trim',true);
  box(-.035,-.358,.456,.16,.072,.052,'dark',.031,-.27,true);
 },
 // Tempest Core
 '305'({band,disc,box,ring,form}){
  disc(0,0,0,.469,.65,'deep',12);
  ring(0,0,.29,.513,.36,.155,'trim',true);
  for(let i=0;i<4;i++){
   const a=.15+i*turn/4;
   band(.381,.527,.432,a,1.12,.091,'bright',true);
   band(.411,.337,.272,a+.46,1.02,.056,'mid',true);
   const [x,y]=polar(.435,a+.12);
   box(x,y,0,.198,.18,.67,'dark',.024,a+Math.PI/4);
   box(x,y,.389,.134,.112,.061,'edge',.014,a+Math.PI/4,true);
  }
  form(polygon(4,.218,Math.PI/4),.405,.118,'dark',{holes:[polygon(4,.115,Math.PI/4)],mirror:true});
  disc(0,0,.445,.084,.103,'glow',4,true);
 },
 // Solar Orrery
 '402'({band,disc,box,ring,orb}){
  disc(0,0,0,.49,.51,'deep',18);
  ring(0,0,.22,.509,.41,.083,'dark',true);
  ring(0,0,.294,.43,.376,.085,'mid',true);
  for(let i=0;i<4;i++){
   const a=i*turn/4+.135;
   band(.375,.511,.457,a,1.21,.065,'bright',true);
   band(.365,.351,.3,a+.24,1.08,.046,'edge',true);
  }
  for(const y of [-.48,.48])box(0,y,0,.64,.077,.53,'mid',.021);
  for(const x of [-.386,.386])box(x,0,0,.075,.74,.425,'trim',.019);
  orb(0,0,.347,.455,.407,.217,'bright',true);
  ring(0,0,.399,.258,.208,.064,'edge',true,18);
  box(0,0,.477,.386,.063,.11,'dark',.019,.20,true);
  disc(0,0,.554,.074,.043,'glow',9,true);
 },
 // Void Maw
 '170'({form,box,ribbon}){
  const mask=[[-.51,-.48],[.51,-.48],[.48,.41],[.39,.535],[.185,.407],[0,.383],[-.185,.407],[-.39,.535],[-.48,.41]];
  form(mask,0,.70,'dark',{bevel:.048});
  form(mask,.361,.105,'deep',twin);
  form([[-.43,.43],[.43,.43],[.40,.19],[.235,.085],[0,.051],[-.235,.085],[-.40,.19]],.421,.11,'bright',twin);
  form([[-.414,.137],[-.306,.263],[0,.074],[.306,.263],[.414,.137],[.401,.046],[0,-.045],[-.401,.046]],.438,.090,'dark',twin);
  for(const side of [-1,1]){
   form([[.155,.082],[.332,.174],[.345,.109],[.28,.071]].map(([x,y])=>[x*side,y]),.507,.042,'glow',tinyRim);
  }
  box(0,-.266,.426,.82,.325,.104,'#1a1227',.064,0,true);
  for(const x of [-.33,-.2,-.067,.067,.2,.33])
   form([[x-.047,-.156],[x+.047,-.156],[x+.015,-.29],[x-.011,-.317]],.493,.094,'mid',tinyRim);
  ribbon([[-.36,-.376],[-.20,-.402],[0,-.419],[.20,-.402],[.36,-.376]],.444,.023,'bright',true);
 },
 // Lunar Scarab
 '462'({box,form,orb,disc,ring}){
  orb(0,.173,0,.94,.79,.83,'mid');
  for(const x of [-.417,.417])box(x,-.06,0,.219,.646,.66,'deep',.058,-x*.42);
  orb(0,.22,.19,.861,.628,.47,'bright',true);
  const jaw=[[-.43,-.153],[-.32,-.16],[-.29,-.304],[-.13,-.337],[-.11,-.452],[.11,-.452],[.13,-.337],[.29,-.304],[.32,-.16],[.43,-.153],[.43,-.357],[.23,-.428],[.15,-.528],[-.15,-.528],[-.23,-.428],[-.43,-.357]];
  form(jaw,.369,.149,'bright',twin);
  form([[-.342,.017],[-.075,-.026],[-.123,-.236],[-.316,-.196]],.404,.093,'dark',twin);
  form([[.342,.017],[.075,-.026],[.123,-.236],[.316,-.196]],.404,.093,'dark',twin);
  form([[-.147,.116],[.147,.116],[.129,-.107],[0,-.242],[-.129,-.107]],.427,.157,'trim',twin);
  ring(0,.339,.425,.111,.073,.072,'deep',true,14);
  disc(0,.339,.477,.065,.035,'glow',12,true);
 },
 // Classic
 classic({box,form,orb,ribbon,ring,disc}){
  box(0,0,0,.91,.91,.63,'dark',.109,-.055);
  const sweep=[[-.50,.45],[-.12,.50],[.015,.306],[-.046,.091],[-.27,-.18],[-.477,-.343],[-.445,-.112],[-.343,.092],[-.19,.22],[-.31,.371]];
  for(const side of [-1,1]){
   const curve=sweep.map(([x,y])=>[x*side,y*side]);
   form(curve,0,.66,'deep',{bevel:.045});
   form(curve,.358,.12,'mid',twin);
   const flourish=[[-.473,-.267],[-.34,-.068],[-.192,.025],[-.030,.157],[.064,.319],[-.018,.442],[-.155,.455],[-.305,.375],[-.435,.212]];
   ribbon(flourish.map(([x,y])=>[x*side,y*side]),.451,.03,'glow',true);
   const guard=[[.125,.477],[.464,.505],[.512,.408],[.402,.155],[.303,.052],[.337,.298]];
   form(guard.map(([x,y])=>[x*side,y*side]),.34,.105,'trim',twin);
  }
  for(const [x,y,r] of [[-.157,.279,.127],[.124,-.284,.118],[.035,-.031,.085]]){
   ring(x,y,.472,r,r*.69,.064,'bright',true,16);
   orb(x,y,.491,r*1.21,r*1.21,r*.96,'dark',true);
   disc(x+.008,y+.013,.538,r*.39,.030,'glow',12,true);
  }
 }
};

export function makeKingdomCube(cube){
 const build=features(cube);
 (recipes[cube.id]||recipes['01'])(build);
 return build.finish();
}

function makeMapCube(cube){
 const group=new THREE.Group(),loader=new THREE.TextureLoader();
 const body=new THREE.Mesh(new THREE.BoxGeometry(.99,.99,.99),new THREE.MeshStandardMaterial({color:cube.color}));
 const face=new THREE.Mesh(new THREE.PlaneGeometry(.96,.96),new THREE.MeshBasicMaterial({map:loader.load(cube.icon),transparent:true}));
 face.position.z=.5;face.material.userData.cpuTexture=true;group.add(body,face);
 group.userData.cubeId=cube.id;return group;
}

export function makeResident(software=false){
 const resident=new THREE.Group(),body=new THREE.Group();
 resident.add(body);
 let active;
 function setCube(cube){
  if(active?.userData.cubeId===cube.id)return;
  if(active){
   active.removeFromParent();
   for(const mesh of active.children){mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose()}
  }
  active=software?makeMapCube(cube):makeKingdomCube(cube);body.add(active);
 }
 return {resident,body,setCube};
}
