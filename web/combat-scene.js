import {moveArts,schoolArt,orbSprites} from './combat-arts.js';
import {arenaWorldView} from './arena-world-view.js';
import {rgba} from './scene-gl.js';
import {drillSprites} from './drill-sprites.js';

const TAU=2*Math.PI;
const limit=(x,lo=0,hi=1)=>Math.min(hi,Math.max(lo,x));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=limit(t);return t*t*(3-2*t)};
const hsla=(h,s,l,a=1)=>'hsla('+h+' '+s+'% '+l+'% / '+limit(a)+')';

const timing={
 tidal:[2400,.67,'tideRise','tideCrash'],
 railshot:[1850,.69,'greenCharge','greenImpact'],
 execute:[1600,.65,'stealCharge','stealCut']
};
const signatureTiming={
 leviathan:[2430,.68,'whaleCall','tideCrash'],
 infernoBreath:[2160,.66,'firewallBuild','firewallHit'],
 obsidianChomp:[1960,.68,'mawGrowl','mawSnap'],
 bloodWard:[2090,.66,'shieldCast','stealCut'],
 courtroomChalk:[1880,.65,'paperShuffle','chalkPop'],
 firewall:[2550,.66,'firewallBuild','firewallHit'],
 domain:[2280,.65,'domainBuild','domainHit'],
 artemis:[2080,.68,'prismCast','moonImpact'],
 city:[2140,.67,'forgeCast','moonImpact'],
 acu:[1920,.65,'sawRun','shatter'],
 amethyst:[2310,.66,'prismCast','crystalFall'],
 orbit:[2250,.67,'orbChords','chain'],
 null:[2180,.66,'domainBuild','vortex'],
 paracosm:[1900,.66,'portalCast','surge'],
 syringe:[1770,.66,'dreamPulse','siphon'],
 mirror:[1900,.65,'domainBuild','vortex'],
 bladeArc:[1840,.66,'stealCharge','stealCut'],
 coilwell:[1940,.67,'domainBuild','relaySnap'],
 spectralKeel:[2090,.70,'keelCharge','keelBreak'],
 waterfall:[2170,.68,'tideRise','tideCrash'],
 secondSun:[2160,.67,'firewallBuild','firewallHit'],
 scrapTurbine:[1970,.66,'sawRun','shatter'],
 keyCascade:[2300,.70,'relayTones','relaySnap'],
 gateRelay:[1960,.67,'relayTones','surge'],
 shockGrid:[1920,.66,'gridCharge','gridBreak'],
 spikeQuake:[1920,.67,'forgeCast','rupture'],
 crossfire:[1760,.68,'greenCharge','greenImpact'],
 prismBloom:[1920,.67,'prismCast','crystalFall'],
 rampart:[1890,.65,'shieldCast','ward'],
 starfall:[2150,.68,'prismCast','moonImpact'],
 packetDrop:[2340,.69,'gridCharge','relaySnap']
};
const accents={
 gear:'forgeCast',shards:'prismCast',storm:'stormCast',
 portal:'portalCast',barrier:'shieldCast',wave:'tideRise',
 projectile:'greenCharge',sweep:'stealCharge'
};

export function attackTiming(event,reduced){
 if(reduced)return {duration:170,at:.43};
 const art=moveArts[event.art],shape=art?.shape;
 const [duration,at,windup,impact]=timing[event.cinematic]||signatureTiming[event.visual]||
  (event.signature?[event.native?1540:event.tier>=10?1390:event.tier>=6?1060:825,.63,accents[shape]||'battleWind']:
   [shape==='projectile'?530:465,.58]);
 const tempo=event.style===1?.78:event.style===2?1.19:1;
 return {duration:Math.round(duration*tempo),at,windup,impact};
}

function arenaProjection(field,world){
 const css=getComputedStyle(field),transform=getComputedStyle(world).transform;
 const model=new DOMMatrixReadOnly(transform==='none'?undefined:transform);
 const [cx,cy]=css.perspectiveOrigin.split(' ').map(Number.parseFloat);
 const perspective=Number.parseFloat(css.perspective)||1300;
 const originX=world.offsetWidth/2,originY=world.offsetHeight/2;
 const offsetX=world.offsetLeft+originX,offsetY=world.offsetTop+originY;
 return ([x,y,z])=>{
  x-=originX;y-=originY;
  const depth=model.m13*x+model.m23*y+model.m33*z;
  const k=perspective/Math.max(perspective*.25,perspective-depth);
  return [cx+(offsetX+model.m11*x+model.m21*y+model.m31*z-cx)*k,
   cy+(offsetY+model.m12*x+model.m22*y+model.m32*z-cy)*k,depth];
 };
}

function renderer(ctx,project){
 const faces=[],traces=[],sprites=[];
 const poly=(points,fill,edge)=>{
  const view=points.map(project),depth=view.reduce((sum,p)=>sum+p[2],0)/view.length;
  faces.push({points:view,fill,edge,depth});
 };
 const trace=(points,color,width,glow=0)=>traces.push({points:points.map(project),color,width,glow});
 const sprite=(img,point,size,hue,alpha,rotation,aspect=1)=>{
  if(!img.complete||!img.naturalWidth||alpha<=0)return;
  const [x,y,depth]=project(point);
  sprites.push({img,x,y,depth,size:size*limit(1+depth/1200,.82,1.2),hue,alpha,rotation,aspect});
 };
 function path(points){
  ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
 }
 function draw(){
  faces.sort((a,b)=>a.depth-b.depth);
  for(const face of faces){
   path(face.points);ctx.closePath();ctx.fillStyle=face.fill;ctx.fill();
   if(face.edge){ctx.strokeStyle=face.edge;ctx.lineWidth=.7;ctx.stroke()}
  }
  sprites.sort((a,b)=>a.depth-b.depth);
  for(const {img,x,y,size,hue,alpha,rotation,aspect} of sprites){
   ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor=hsla(hue,100,70,.87);ctx.shadowBlur=11;
   const wide=size*aspect;
   ctx.translate(x,y);ctx.rotate(rotation);ctx.drawImage(img,-wide/2,-size/2,wide,size);ctx.restore();
  }
  for(const line of traces){
   path(line.points);ctx.strokeStyle=line.color;ctx.lineWidth=line.width;
   ctx.shadowColor=line.color;ctx.shadowBlur=line.glow;ctx.stroke();
  }
  ctx.shadowBlur=0;
 }
 return {poly,trace,sprite,draw};
}

const waterProfile=[
 [-1.17,0],[-.97,.06],[-.75,.17],[-.56,.34],[-.43,.57],[-.31,.82],[-.15,1],
 [.06,1.09],[.32,1.06],[.58,.91],[.72,.67],[.68,.46],[.54,.35]
];

function seawall(mesh,g,q,p){
 const {point,wide,hue,seed,event,reach}=g,large=event.cinematic==='tidal';
 const wash=ease((q-g.at)/(1-g.at)),build=ease((q-.06)/.45);
 const crest=large?92:49,span=wide*(large?1:.54)*mix(.65,1.36,wash)*build;
 const rise=crest*build*(1-wash*.94),thick=(large?72:39)*(.9+wash*.66);
 const run=reach*p+wash*54-thick*.32*build,segments=large?24:14;
 function strand(i,[x,z]){
  const u=i/segments*2-1,f=1-.61*Math.abs(u)**3;
  const roll=Math.sin(i*.68+q*11+seed)*(.038+.055*wash);
  return point(run+(x+roll)*thick+u*u*26,u*span,z*rise*(f+roll)-5);
 }
 const sheet=Array.from({length:segments+1},(_,i)=>waterProfile.map(section=>strand(i,section)));
 for(let i=0;i<segments;i++){
  for(let j=0;j<waterProfile.length-1;j++){
   const feather=ease((1-Math.abs((i+.5)/segments*2-1))*4);
   const foam=j>=7?Math.max(0,Math.sin(i*4.67+j*1.68+q*8)-.19):0;
   const light=21+Math.min(j,9)*4.1+5*Math.sin(i*1.4+j*.51+q*12)+foam*27;
   const glass=hsla(hue+j*.95,89,light,(.42+.46*j/12)*(1-wash*.76)*feather);
   mesh.poly([sheet[i][j],sheet[i+1][j],sheet[i+1][j+1],sheet[i][j+1]],glass,
    j%3===0?hsla(hue,95,70,.16*(1-wash)):null);
  }
 }
 for(const row of [3,5,7,8,10,12]){
  mesh.trace(sheet.slice(1,-1).map(column=>column[row]),hsla(hue-11,100,row>=7?89:66,(row>=7?.91:.36)*(1-wash*.83)),row>=7?2.2:1,3);
 }
 // The broken lip throws foam up and ahead while the water fans out along the deck.
 const spray=limit((q-.34)/.53);
 for(let i=0;i<(large?63:32);i++){
  const phase=((i*.618+seed*.173)%1),dx=(phase*2-1),f=spray*(.46+(i%7)*.11);
  const z=rise*(.6+.24*Math.sin(i*2.23))+Math.sin(Math.PI*f)*(12+i%27);
  const x=run+thick*.37+f*(i%11)*7;
  const y=dx*(span+f*36);
  const len=(2+i%4)*(1-wash*.75)*build;
  mesh.trace([point(x,y,z),point(x-len*2,y+dx*len,z+len)],hsla(hue,100,88,(1-wash)*(.44+.54*phase)),len*.67);
 }
 if(wash){
  const puddle=Array.from({length:28},(_,i)=>{
   const angle=i*TAU/28,wobble=1+.13*Math.sin(i*2.6+q*17);
   return point(run+Math.cos(angle)*thick*wobble,Math.sin(angle)*span*wobble,-6);
  });
  mesh.poly(puddle,hsla(hue,92,71,Math.sin(wash*Math.PI)*.27));
  for(let r=0;r<4;r++){
   const points=Array.from({length:19},(_,i)=>{
    const n=i/18*2-1;
    return point(run+22+r*10*wash+n*n*29,n*span*(1+r*.077),-4+2*Math.sin(i*1.6+r));
   });
   mesh.trace(points,hsla(hue,95,78,(1-wash)*(.81-r*.13)),1.8-r*.29);
  }
 }
}

function circle(point,along,across,z,r,count=28,vertical=false,spin=0){
 return Array.from({length:count+1},(_,i)=>{
  const a=TAU*i/count+spin;
  return vertical?point(along,across+Math.cos(a)*r,z+Math.sin(a)*r):
   point(along+Math.cos(a)*r,across+Math.sin(a)*r,z);
 });
}
function shot(mesh,g,q,p){
 const {point,reach,at,hue,event}=g,big=event.cinematic==='railshot';
 const head=mix(0,reach,p),fade=1-ease((q-at)/(1-at)),z=29+Math.sin(p*Math.PI)*(big?22:11);
 const charge=ease(q/(at*.62));
 if(q<at*.78){
  for(let i=0;i<3;i++){
   mesh.trace(circle(point,i*9,0,29,8+charge*(10+i*6),8,true,q*7),
    hsla(hue,100,79,charge*(.7-i*.16)*(1-p)),2,5);
  }
 }
 const launch=ease((q-(big?.30:.08))/(at-.26));
 if(!launch)return;
 const sides=8,size=(big?9:5)*Math.max(.42,1-p*.25);
 const length=(big?54:34)*launch;
 const ring=(along,r)=>circle(point,along,0,z,r,sides,true,Math.PI/8);
 const front=ring(head-length*.24,size),back=ring(head-length*.87,size*.75);
 for(let i=0;i<sides;i++){
  mesh.poly([front[i],back[i],back[i+1],front[i+1]],hsla(hue,89,32+51*Math.max(0,Math.sin(i*Math.PI/4)) ,fade),hsla(hue,100,85,fade*.65));
  mesh.poly([point(head,0,z),front[i],front[i+1]],hsla(hue,98,60+31*Math.max(0,Math.sin(i*Math.PI/4)),fade));
 }
 for(let i=-2;i<=2;i++){
  const from=Math.max(-16,head-length*(1.55+Math.abs(i)*.14)),trail=[];
  for(let j=0;j<9;j++){
   const r=j/8;
   trail.push(point(mix(from,head-length*.45,r),i*(1-r)*4,z+i*1.8+Math.sin(q*17+i+j*.6)*2));
  }
  mesh.trace(trail,hsla(hue,100,i?61:89,fade*launch*(i?.61:.99)),i?2:4,i?5:12);
 }
}

function scythe(mesh,g,q,p){
 const {point,reach,at,hue,event}=g,execute=event.cinematic==='execute';
 const hold=ease(q/.32),fade=1-ease((q-at)/(1-at)),arc=ease((q-at*.36)/(at*.78));
 const center=reach*(execute?.94:p),radius=(execute?68:43)*hold;
 const spin=-2.3+arc*3.95;
 if(execute){
  for(let i=0;i<4;i++){
   mesh.trace(circle(point,reach,0,-7+11*i,(18+i*6)*(1.6-hold*.6),8,false,-q*2),
    hsla(hue,99,70,fade*hold*(.83-i*.14)),2,6);
  }
 }
 for(let ghost=3;ghost>=0;ghost--){
  const thick=(ghost?.36:1)*(execute?16:12);
  const edge=[],inner=[];
  for(let i=0;i<=18;i++){
   const t=i/18,a=spin-t*1.81-ghost*.174;
   const r=radius*(.52+t*.48),y=Math.cos(a)*r,z=28+Math.sin(a)*r*.69;
   edge.push(point(center+Math.sin(a)*r*.57,y,z+15));
   inner.push(point(center+Math.sin(a)*r*.57-thick*Math.sin(Math.PI*t),y,z+15-thick*Math.sin(Math.PI*t)));
  }
  mesh.poly([...edge,...inner.reverse()],hsla(hue+8,91,ghost?56:67,fade*hold*(ghost?.154:.83)));
  mesh.trace(edge,hsla(hue,100,ghost?71:92,fade*hold*(ghost?.20:1)),ghost?1.2:3,ghost?0:8);
 }
 if(execute&&q>at){
  const steal=ease((q-at)/(1-at)),x=reach*(1-steal),z=24+Math.sin(steal*Math.PI)*68;
  for(let i=0;i<3;i++){
   const x0=x+i*9;mesh.poly([point(x0,-6,z),point(x0+8,0,z+12),point(x0,6,z),point(x0-8,0,z-12)],
    hsla(hue,99,83,fade),hsla(hue,100,96,fade));
  }
 }
}

function shard(mesh,point,x,y,z,r,length,h,alpha,spin=0){
 const a=point(x,y,z+length),b=point(x,y,z-length*.45),mid=[];
 for(let i=0;i<=4;i++){
  const angle=(i/4)*TAU+spin;
  mid.push(point(x+Math.cos(angle)*r,y+Math.sin(angle)*r,z));
 }
 for(let i=0;i<4;i++){
  mesh.poly([mid[i],mid[i+1],a],hsla(h+i*3,93,37+i*14,alpha),hsla(h,99,81,alpha*.59));
  mesh.poly([mid[i],mid[i+1],b],hsla(h+i*3,90,21+i*12,alpha));
 }
}

function formations(mesh,g,q,p){
 const {point,reach,at,hue,art,seed,event,shape}=g;
 const fade=ease(q/.15)*(1-ease((q-at)/(1-at))),x=reach*p,amp=event.signature?1.43:1;
 switch(shape){
  case 'shards':
   for(let i=0;i<5;i++){
    const f=limit(p*(1+i*.028)-i*.072),h=Math.sin(f*Math.PI);
    const z=20+h*(art==='magma'?52:75);
    shard(mesh,point,reach*f-18,((i%3)-1)*14,Math.max(15,z),7*amp,17*amp,hue+i*4,fade,q*5+i);
    mesh.trace([point(reach*f-22,(i%3-1)*14,z),point(reach*f-48,(i%3-1)*17,z+14)],hsla(hue,98,78,fade*.61),2,3);
   }
   break;
  case 'gear':{
   for(let row=0;row<(art==='gear'?3:2);row++){
    const r=(row===0?29:16)*amp,center=x-row*24,end=[],middle=[],low=[];
    for(let i=0;i<=28;i++){
     const a=i*TAU/28+q*(row%2?-13:15),n=r*(i%2?.72:1),rx=Math.cos(a),ry=Math.sin(a);
     end.push(point(center+rx*n,row*8+ry*n,37+ry*14));
     low.push(point(center+rx*n,row*8+ry*n,29+ry*14));
     middle.push(point(center+rx*n*.28,row*8+ry*n*.28,38+ry*4));
    }
    for(let i=0;i<28;i++){
     mesh.poly([low[i],low[i+1],end[i+1],end[i]],hsla(hue,76,30,fade));
     mesh.poly([end[i],end[i+1],middle[i+1],middle[i]],hsla(hue+(i%7),94,40+i%6*8,fade));
    }
    mesh.trace(end,hsla(hue,100,84,fade),1.7,4);
   }
   break;
  }
  case 'eye':{
   const z=35+22*Math.sin(p*Math.PI),r=31*amp,open=ease(q/.28);
   const top=point(x,0,z+r*.61*open),btm=point(x,0,z-r*.61*open);
   mesh.poly([point(x,-r,z),top,point(x,r,z),btm],hsla(hue,91,22,fade),hsla(hue,98,78,fade));
   mesh.trace(circle(point,x-2,0,z,8+9*open,8,true,q*4),hsla(hue,100,89,fade),2,8);
   mesh.trace([point(x,0,z),point(mix(x,reach,ease(p*.91)),0,20)],hsla(hue,100,74,fade*p),3,6);
   break;
  }
  case 'barrier':{
   const r=29*amp*ease(p*1.9),sp=art==='halo'?q*4:Math.PI/6;
   const base=circle(point,x,0,2,r,6,false,sp),top=circle(point,x,0,42*amp,r*.88,6,false,sp);
   for(let i=0;i<6;i++)mesh.poly([base[i],base[i+1],top[i+1],top[i]],hsla(hue,90,48,fade*.27),hsla(hue,100,73,fade));
   mesh.trace(circle(point,x,0,art==='halo'?56:27,r*1.13,8,false,-sp),hsla(hue,100,88,fade*.91),2,5);
   break;
  }
  case 'pulse':
   for(let i=0;i<4;i++){
    const n=(p*.96+i*.137)%1,r=(7+49*n)*amp;
    const loop=circle(point,x,0,5+i*10,r,art==='echo'?12:4,false,q*4+i);
    mesh.trace(loop,hsla(hue+i*9,100,84,fade*(1-n)),3-n*2,4);
   }
   shard(mesh,point,x,0,36,8*amp,14,hue,fade,q*8);
   break;
  case 'portal':
   for(let i=0;i<5;i++){
    const r=(12+i*6)*amp*(.7+.3*Math.sin(p*6+i));
    mesh.trace(circle(point,x-i*7,0,29,r,art==='abyss'?8:16,true,(i%2?-q:q)*9),hsla(hue+i*4,100,76,fade*(.91-i*.13)),2.1-i*.16,5);
   }
   shard(mesh,point,art==='abyss'?reach-x*.48:x,0,29,9,11,hue,fade*.76,q*9);
   break;
  case 'storm':
   for(let i=0;i<5;i++){
    const bolt=Array.from({length:13},(_,j)=>{
     const f=j/12,zig=j%2?1:-1,rand=Math.sin(seed+i*23+j*171+Math.floor(q*40));
     return point(f*x,Math.sin(f*Math.PI)*zig*rand*(17+i*4),20+Math.sin(f*Math.PI)*(20+zig*rand*33+i*5));
    });
    mesh.trace(bolt,hsla(hue+i*3,99,i%2?93:63,fade*(i?.59:1)),i?1.1:3,8);
   }
   break;
  case 'thorns':
   for(let i=0;i<11;i++){
    const f=(i+1)/11,appear=ease((p-f+.23)/.23);
    if(!appear)continue;
    const y=Math.sin(seed+i*2)*15,height=(16+i%4*11)*amp*appear;
    const drop=art==='meteor'?(1-appear)*88:0;
    shard(mesh,point,f*reach,y,drop+5,7*appear,height,hue+i*2,fade*appear,i);
   }
   break;
 }
}

function held(q,at){
 return ease(q/.25)*(1-ease((q-at)/(1-at)));
}

function firewall(mesh,g,q,p){
 const {width,start,end,at,seed}=g,swell=ease(q/.41),fade=held(q,at);
 const y=mix(start.y,end.y,p),heat=1-ease((q-at)/(1-at));
 const direction=Math.sign(end.y-start.y)||-1;
 const columns=24,panel=[];
 for(let i=0;i<=columns;i++){
  const f=i/columns,x=mix(8,width-8,f);
  const peak=(49+39*Math.abs(Math.sin(i*1.93+q*22))+28*Math.abs(Math.sin(i*.36-q*16)))*swell;
  panel.push([
   [x,y-direction*17,-10],[x,y-direction*8,peak*.22],
   [x,y+direction*8,peak*.62],[x,y+direction*(21+8*Math.sin(i+q*10)),peak]
  ]);
 }
 for(let i=0;i<columns;i++)for(let j=0;j<3;j++){
  const light=[32,58,72][j]+Math.sin(i*2.96+q*32)*12;
  const alpha=fade*[.86,.83,.63][j];
  mesh.poly([panel[i][j],panel[i+1][j],panel[i+1][j+1],panel[i][j+1]],
   hsla(8+j*15+8*Math.sin(i*.7+q*18),100,light,alpha));
 }
 mesh.trace(panel.map(column=>column[0]),hsla(8,100,57,fade*.8),5,9);
 mesh.trace(panel.map(column=>column[2]),hsla(43,100,84,fade*.63),2.4,10);
 for(let i=0;i<42;i++){
  const n=(i*.618+seed*.013)%1,x=width*n,age=(q*2.6+(i*.171)%1)%1;
  const z=age*(67+i%19*2)*swell;
  const step=8+age*19,hot=(1-age)*fade;
  mesh.trace([[x,y+direction*(z*.23),z],[x+n*7,y+direction*(z*.17),z+step]],
   hsla(i%3?31:49,100,i%2?67:86,hot),i%3?1.8:3);
 }
 if(q>at){
  const spread=36+(1-heat)*84;
  mesh.poly([[8,y-spread,-10],[width-8,y-spread,-10],[width-8,y+spread,-10],[8,y+spread,-10]],
   hsla(11,98,48,Math.sin(heat*Math.PI)*.28));
 }
}

function domain(mesh,g,q,p){
 const {width,end,at,seed}=g,open=ease((q-.10)/.49),fade=held(q,at);
 const radius=(width*.46)*open,depth=52*open,wall=102*open;
 const cx=width*.5,cy=end.y,base=-12;
 const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>[cx+x*radius,cy+y*depth,base]);
 for(let i=0;i<4;i++){
  const a=corners[i],b=corners[(i+1)%4];
  const ta=[a[0],a[1],base+wall],tb=[b[0],b[1],base+wall];
  mesh.poly([a,b,tb,ta],hsla(267+i*6,88,40,fade*(i%2?.19:.29)));
  mesh.trace([a,b,tb,ta,a],hsla(i%2?309:270,97,74,fade*.75),2.4,6);
  for(let j=1;j<6;j++){
   const u=j/6,x=mix(a[0],b[0],u),y=mix(a[1],b[1],u);
   mesh.trace([[x,y,base],[x,y,base+wall]],hsla(281,90,64,fade*.29),1);
  }
 }
 mesh.poly(corners,hsla(267,87,38,fade*.27));
 for(let i=1;i<7;i++){
  const x=cx-radius+radius*i/3.5,y=cy-depth+2*depth*i/7;
  mesh.trace([[x,cy-depth,base],[x,cy+depth,base]],hsla(281,96,65,fade*.41),1);
  mesh.trace([[cx-radius,y,base],[cx+radius,y,base]],hsla(277,96,77,fade*.35),1);
 }
 for(let i=0;i<5;i++){
  const theta=i*TAU/5+q*3,rr=(28+i*6)*open;
  const x=cx+Math.cos(theta)*rr,y=cy+Math.sin(theta)*rr;
  shard(mesh,(x,y,z)=>[x,y,z],x,y,wall*.61+11*Math.cos(i*2.1+seed),6,13,272+i*9,fade,q*7+i);
 }
}

function artemis(mesh,g,q,p){
 const {point,reach,at}=g,fade=held(q,at),hold=ease(q/.43),fall=ease((q-.42)/.23);
 const z=mix(191,20,fall),size=(28+24*hold)*(1-ease((q-at)/(1-at))*.69);
 const x=reach+25*(1-fall);
 const core=hsla(232,83,82,fade);
 shard(mesh,point,x,0,z,size*.79,size*1.2,230,fade,q*.45);
 for(let k=0;k<4;k++){
  const ring=circle(point,x,0,z+k*8,size+12+k*9,20,false,q+k);
  mesh.trace(ring,hsla(226+k*8,95,k===0?94:78,fade*(1-k*.17)),2.1,6);
 }
 if(fall){
  mesh.poly([point(x-size*.51,0,z),point(x+size*.51,0,z),point(reach,0,197)],
   hsla(231,97,73,fade*.47),core);
  const t=ease((q-.58)/.38);
  mesh.trace(circle(point,reach,0,5,21+t*111,12,false),hsla(234,99,95,fade),3.8,8);
 }
}

function tower(mesh,x,y,z,w,d,h,hue,fade){
 const a=[x-w,y-d,z],b=[x+w,y-d,z],c=[x+w,y+d,z],e=[x-w,y+d,z];
 const top=([x,y,z])=>[x,y,z+h];
 mesh.poly([a,b,top(b),top(a)],hsla(hue,75,38,fade),hsla(hue,88,69,fade*.8));
 mesh.poly([b,c,top(c),top(b)],hsla(hue,78,48,fade),hsla(hue,88,69,fade*.75));
 mesh.poly([e,a,top(a),top(e)],hsla(hue-14,71,32,fade));
 mesh.poly([a,b,c,e].map(top),hsla(hue+8,89,63,fade),hsla(hue,97,84,fade));
 for(let j=1;j<4;j++){
  const level=z+h*j/4;
  mesh.trace([[x-w,y-d,level],[x+w,y-d,level],[x+w,y+d,level]],hsla(hue+10,93,71,fade*.67),1.7);
 }
}

function city(mesh,g,q,p){
 const {width,end,at}=g,fade=held(q,at),build=ease((q-.06)/.39),drop=ease((q-.43)/.23);
 for(let i=0;i<7;i++){
  const x=width*(i+1)/8,y=end.y+(i%2===0?41:-31),w=Math.min(26,width*.036);
  const height=(46+31*Math.abs(Math.sin(i*2.47)))*build;
  tower(mesh,x,y,-12+(1-drop)*39,w,9+(i%3)*3,height,32+i*3,fade);
 }
 const barY=end.y+19,barZ=5+build*36;
 mesh.poly([[10,barY,-13],[width-10,barY,-13],[width-10,barY,barZ],[10,barY,barZ]],
  hsla(42,96,54,fade*.20),hsla(38,99,74,fade));
 for(let i=0;i<13;i++){
  const x=width*(i+.3)/13;
  mesh.trace([[x,barY+.4,-10],[x+13,barY+.4,barZ]],hsla(36,99,76,fade*.66),2.3);
 }
}

function saw(mesh,center,size,angle,hue,fade,tilt){
 const wheel=[],inner=[],under=[];
 for(let i=0;i<=24;i++){
  const a=i*TAU/24+angle,r=size*(i%2?.75:1),sn=Math.sin(a),cs=Math.cos(a);
  const [x,y,z]=center;
  wheel.push([x+cs*r,y+sn*r,z+sn*r*tilt]);
  inner.push([x+cs*r*.29,y+sn*r*.29,z+sn*r*tilt*.29]);
  under.push([x+cs*r,y+sn*r,z+sn*r*tilt-6]);
 }
 for(let i=0;i<24;i++){
  mesh.poly([wheel[i],wheel[i+1],under[i+1],under[i]],hsla(hue,84,27,fade));
  mesh.poly([wheel[i],wheel[i+1],inner[i+1],inner[i]],hsla(hue+i%4*7,93,47+i%5*7,fade));
 }
 mesh.trace(wheel,hsla(hue,100,86,fade),1.8,4);
}

function acu(mesh,g,q,p){
 const {targets,end,start,at,seed}=g,fade=held(q,at);
 for(let i=0;i<6;i++){
  const dest=targets[i%targets.length]||end;
  const u=ease((q+.085*Math.sin(i*1.84)-.17)/(at-.17));
  const float=Math.sin(Math.PI*u),radius=(21+i%3*4)*(.44+.56*ease(q/.34));
  const x=mix(start.x,dest.x,u)+Math.sin(i*2.6+q*6)*58*float;
  const y=mix(start.y,dest.y,u)+(i-2.5)*14*float,z=19+float*(48+i%3*15);
  saw(mesh,[x,y,z],radius,seed+q*(i%2?-20:26)+i*2.1,29+i*8,fade*Math.min(1,p+.55),i%2?.55:-.45);
 }
}

function amethyst(mesh,g,q,p){
 const {point,reach,at,wide,seed}=g,fade=held(q,at),build=ease((q-.14)/.38);
 for(let i=0;i<7;i++){
  const x=reach+(i%3-1)*28,y=(i-3)*Math.min(31,wide*.16),h=(28+i%4*16)*build;
  const lift=ease((q-.33)/.24),z=mix(68+i%3*28,11+h*.34,lift);
  shard(mesh,point,x,y,z,9+build*(7+i%4),h,276+i*6,fade,q*1.7+i+seed);
  mesh.trace([point(x+14,y,z+h),point(x+29,y,z+h+36*(1-lift))],hsla(286+i*5,99,84,fade*.60),2.6,7);
 }
 for(let i=0;i<12;i++){
  const s=limit((q-at+.1)/.39),a=i*2.4+seed,r=13+s*(37+i%3*15);
  const x=reach+Math.cos(a)*r,y=Math.sin(a)*r,z=20+Math.sin(Math.PI*s)*(29+i%4*8);
  if(s>0)shard(mesh,point,x,y,z,3+i%3,7,288+i*4,fade*(1-s*.48),q*9+i);
 }
}

let orbImages;
function orbit(mesh,g,q,p){
 orbImages??=orbSprites.map(src=>{const img=new Image();img.src=src;return img});
 const {start,end,targets,point,reach,hue,at}=g,fade=held(q,at);
 const spin=q*17,spread=1-ease((q-.29)/.26);
 const palette=[319,43,169,218,118,275];
 for(let i=0;i<orbImages.length;i++){
  const a=i*TAU/6+spin,dest=targets[i%targets.length]||end;
  const t=ease((q-.35+.053*Math.sin(i*1.8))/(at-.35));
  const r=(35+i%2*11)*(spread+.26*Math.sin(t*Math.PI));
  const x=mix(start.x,dest.x,t)+Math.cos(a)*r;
  const y=mix(start.y,dest.y,t)+Math.sin(a)*r*.85;
  const z=29+15*Math.sin(a)+39*Math.sin(t*Math.PI),h=palette[i];
  const tail=[[mix(start.x,dest.x,Math.max(0,t-.21))+Math.cos(a-.70)*r,mix(start.y,dest.y,Math.max(0,t-.21))+Math.sin(a-.70)*r,z-8],[x,y,z]];
  mesh.trace(tail,hsla(h,100,76,fade),3.7,8);
  mesh.sprite(orbImages[i],[x,y,z],(29+i%2*5)*(1+.30*Math.sin(Math.PI*t)),h,fade,a*.14);
 }
 if(q>.47){
  const pulse=ease((q-.47)/.33);
  mesh.trace(circle(point,reach,0,5,17+pulse*59,12,false,spin*.18),hsla(hue,99,79,fade),2.3,7);
 }
}

function nullHorizon(mesh,g,q,p){
 const {point,reach,at,seed}=g,fade=held(q,at);
 const x=reach*p,seal=ease(q/.36),drawIn=ease((q-.36)/.27);
 for(let i=0;i<6;i++){
  const r=(25+i*9)*seal*(1-drawIn*.55),z=13+i*8;
  const shape=circle(point,x-i*4,0,z,r,8,false,i*.78-q*8);
  if(i===2)mesh.poly(shape,hsla(252,88,8,fade*.93));
  mesh.trace(shape,hsla(257+i*8,97,65+i*3,fade*(.88-i*.11)),2.8,6);
 }
 for(let i=0;i<19;i++){
  const a=i*2.4+q*6+seed,r=(49+i%5*11)*(1-drawIn*.79),y=r*Math.sin(a);
  shard(mesh,point,x+r*Math.cos(a),y,26+18*Math.cos(a*2),3+(i%2)*2,8,249+i%6*8,fade,q*11+i);
 }
}

function paracosm(mesh,g,q,p){
 const {point,reach,at,seed}=g,fade=held(q,at),width=34*(g.event.tier>=10?1.2:.88);
 const tunnel=ease((q-.13)/.51);
 for(let i=0;i<10;i++){
  const f=(i+1)/10,x=f*reach*tunnel,z=24+6*Math.sin(i*.63+q*17);
  const edge=circle(point,x,0,z,width+i%3*6,4,true,q*2.2+i*.20);
  mesh.trace(edge,hsla(204+i*15+q*135,99,73,fade*(.6+i*.035)),2.7,5);
 }
 const wave=[];
 for(let i=0;i<15;i++){
  const f=Math.max(0,p-i*.031),y=Math.sin(f*28+q*18)*14;
  wave.push(point(reach*f,y,28+((i+seed)%2?13:0)));
 }
 mesh.trace(wave,hsla(160+q*180,100,73,fade),5.3,10);
 mesh.trace(wave,hsla(149+q*210,100,94,fade),1.5);
}

function syringe(mesh,g,q,p){
 const {point,reach,at}=g,fade=held(q,at),x=reach*p,z=28+Math.sin(p*Math.PI)*42;
 const barrel=circle(point,x-19,0,z,11,8,true,Math.PI/8),cap=circle(point,x-55,0,z,11,8,true,Math.PI/8);
 for(let i=0;i<8;i++){
  mesh.poly([barrel[i],barrel[i+1],cap[i+1],cap[i]],hsla(167+i*4,89,48+i%3*12,fade*.8),
   hsla(178,98,83,fade*.61));
 }
 mesh.trace([point(x-19,0,z),point(x+12,0,z-5)],hsla(167,94,88,fade),4.2,6);
 mesh.trace([point(x-57,0,z),point(x-70,0,z)],hsla(184,99,76,fade),6.8);
 for(let i=0;i<8;i++){
  const t=Math.max(0,p-i*.074),h=22+Math.sin(t*Math.PI)*34;
  shard(mesh,point,reach*t-34,(i-4)*4,h,3,5,140+i*9,fade*(.92-i*.08),q*8+i);
 }
}

function mirrorFrame(mesh,g,q,p){
 const {point,reach,at}=g,fade=held(q,at),open=ease(q/.24),x=reach*p;
 for(let i=0;i<5;i++){
  const r=14+i*9,w=r*open;
  mesh.trace([point(x,-w,15),point(x,0,15+w),point(x,w,15),point(x,0,15-w*.38),point(x,-w,15)],
   hsla(281+i*12,92,72,fade*(.94-i*.14)),2.2,7);
 }
}


const signatureImages=new Map();
function signatureImage(source){
 if(!signatureImages.has(source)){
  const image=new Image();image.decoding='async';image.src=source;signatureImages.set(source,image);
 }
 return signatureImages.get(source);
}

function bladeArc(mesh,g,q,p){
 const {point,reach,hue,at,seed}=g,fade=held(q,at),center=reach*p;
 for(let blade=0;blade<3;blade++){
  const front=[],back=[],rim=[],radius=(46-blade*8)*ease(q/.26);
  for(let i=0;i<=16;i++){
   const u=i/16,a=-1.5+u*2.8+p*.67+blade*.61;
   const x=center+Math.cos(a)*radius*.63-blade*13,y=Math.sin(a)*radius;
   const z=29+Math.cos(a)*radius*.77;
   front.push(point(x,y,z));back.push(point(x-12*Math.sin(u*Math.PI),y*.86,z-10));
   rim.push(point(x-3,y,z-7-blade*2));
  }
  for(let i=0;i<16;i++){
   mesh.poly([front[i],front[i+1],back[i+1],back[i]],hsla(hue+blade*9,90,63,fade*(1-blade*.22)));
   mesh.poly([front[i],front[i+1],rim[i+1],rim[i]],hsla(hue+15,100,90,fade*.72));
  }
  mesh.trace(front,hsla(hue+blade*7,100,92,fade*.88),2.5,7);
 }
 if(p>.25)for(let i=0;i<6;i++){
  const offset=(i-2.5)*8,z=29+i%3*10,a=seed+i*2.4;
  mesh.trace([point(center-44,offset+Math.sin(a)*18,z-3),point(center-10,offset,z+5)],hsla(hue,100,83,fade*.6),1.3,3);
 }
}

function coilwell(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),open=ease(q/.34),x=reach*p;
 for(let coil=0;coil<3;coil++){
  const loop=Array.from({length:30},(_,i)=>{
   const f=i/29,a=q*10+seed*.14+coil*TAU/3+f*TAU*1.3;
   const radius=(14+35*f)*open*(1-.52*p);
   return point(x-(1-f)*68,Math.cos(a)*radius,39+Math.sin(a)*radius);
  });
  mesh.trace(loop,hsla(hue+coil*23,100,78,fade*.83),2.9,7);
 }
 const heart=circle(point,x,0,39,17*open,10,true,q*4);
 mesh.poly(heart,hsla(hue,87,13,fade*.85),hsla(hue+11,99,85,fade));
 shard(mesh,point,x+4,0,39,8*open,15*open,hue+13,fade,q*6);
}

function spectralKeel(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),nose=reach*p,z=35+Math.sin(Math.PI*p)*51;
 const span=(28+seed%12)*ease(q/.27),keel=[point(nose+13,0,z+6),point(nose-52,-span,z+3),
  point(nose-35,0,z-13),point(nose-52,span,z+3)];
 for(let i=0;i<4;i++)mesh.poly([keel[i],keel[(i+1)%4],point(nose-28,0,z+19)],
  hsla(hue+i*7,93,i%2?62:30,fade*.88),hsla(hue+17,100,84,fade*.90));
 for(const sign of [-1,1]){
  const sail=[point(nose-44,sign*span,z+3),point(nose-36,sign*span*.33,z+53),point(nose-11,sign*8,z+6)];
  mesh.poly(sail,hsla(hue+22,84,63,fade*.55),hsla(hue+21,99,91,fade*.82));
  for(let i=0;i<3;i++){
   const path=Array.from({length:10},(_,j)=>{
    const f=j/9;
    return point(nose-38-f*102,sign*(span+f*(13+i*9)),z-12-f*27+Math.sin(f*10+q*24)*5);
   });
   mesh.trace(path,hsla(hue+i*11,100,83,fade*(.77-i*.18)),2.5-i*.45,5);
  }
 }
}

function waterfall(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),drop=ease((q-.32)/(at-.32)),fall=1-drop;
 const width=(43+seed%22)*ease(q/.26),x=reach*(.58+.42*p);
 for(let i=0;i<8;i++){
  const y=(i/7-.5)*width*2.1,curve=5*Math.sin(i*1.4+q*22);
  const stream=[point(x-8,y,32+fall*133),point(x+curve,y+3,21+fall*77),
   point(x+20*(1-fall),y+9,11+fall*22),point(x+29*drop,y+2,5)];
  const edge=stream.map(([x,y,z])=>[x+7,y+width*.24,z-1]);
  mesh.poly([...stream,...edge.reverse()],hsla(hue+i*5,96,51+i%3*12,fade*.58));
  mesh.trace(stream,hsla(hue+8,99,87,fade*.86),2.1,6);
 }
 for(let i=0;i<3;i++)mesh.trace(circle(point,reach,0,4+i*5,13+drop*(width+8*i),16,false,i*.7),
  hsla(hue,100,87,fade*drop*(.94-i*.2)),3.1,5);
}

function secondSun(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),x=reach*p,heat=ease(q/.37);
 const radius=(26+seed%13)*heat,z=40+Math.sin(Math.PI*p)*27;
 mesh.poly(circle(point,x,0,z,radius*.86,16,true),hsla(hue+9,98,57,fade*.84));
 for(let i=0;i<4;i++){
  const r=radius*(1+i*.16),shell=circle(point,x-i*11,0,z,r,14,i%2===0,q*4+i*.49);
  mesh.trace(shell,hsla(hue+i*9,100,89-i*5,fade*(.98-i*.15)),3-i*.34,9);
 }
 for(let i=0;i<13;i++){
  const a=i*2.399+seed+q*3,offset=i%4*6,y=Math.cos(a)*radius*.83,r=Math.sin(a)*radius*.83;
  mesh.trace([point(x-7,y,z+r),point(x-23-offset,y*1.33,z+r*1.37),point(x-46-offset,y*1.6,z+r*1.22)],
   hsla(hue+7+i%3*13,100,70,fade*.79),1+i%3,6);
 }
}

function scrapTurbine(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),image=signatureImage(drillSprites.saw);
 for(let i=0;i<4;i++){
  const t=ease((q-.13-i*.03)/(at-.13-i*.03)),arc=Math.sin(t*Math.PI),r=(18+i%2*7)*ease(q/.22);
  const x=reach*t-i*6,y=(i-1.5)*26*arc,z=28+arc*(35+i*7),spin=(i%2?22:-25)*q+seed+i;
  mesh.trace([point(x-45,y*.75,z-12),point(x-15,y*.94,z-3),point(x,y,z)],hsla(hue+i*8,97,70,fade*.7),3.6,6);
  mesh.trace(circle(point,x,y,z,r*.82,12,true,spin),hsla(hue+i*8,89,64,fade),2.5,5);
  mesh.sprite(image,point(x,y,z),r*2,hue,fade,spin);
 }
}

function gateRelay(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at);
 for(let i=0;i<4;i++){
  const t=(i+1)/4,x=reach*t,open=ease((q-.06-i*.055)/.26);
  const y=Math.sin(i*2+seed)*18,z=32+12*Math.sin(q*6+i),r=(28+i%3*6)*open;
  const rim=circle(point,x,y,z,r,12,true,q*3+i);
  mesh.poly(rim,hsla(hue+i*18,82,40,fade*open*.22));
  mesh.trace(rim,hsla(hue+i*18,100,80,fade*open*.76),2.5,7);
  mesh.sprite(signatureImage(drillSprites.portals[(i+seed)%3]),point(x,y,z),r*2.18,hue,fade*open,Math.sin(q*5+i)*.10,.62);
 }
 const zigzag=Array.from({length:11},(_,i)=>{
  const t=p*i/10;
  return point(reach*t,Math.sin(t*7+seed)*15,27+Math.sin(t*16)*17);
 });
 mesh.trace(zigzag,hsla(hue+17,100,88,fade*p),4.1,8);
}

function keyCascade(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),slide=ease((q-.25)/(at-.25));
 const image=signatureImage(drillSprites.mini);
 for(let i=0;i<8;i++){
  const a=i*TAU/8+q*(i%2===0?2.8:-2),r=(44+i%3*13)*(1-.68*slide);
  const x=reach*slide+Math.cos(a)*r,y=Math.sin(a)*r,z=32+(i%4)*13;
  const chosen=i===(seed%8),tint=chosen?111:hue+i*9;
  mesh.trace(circle(point,x,y,z,8+i%2,9,true,q*10),hsla(tint,100,85,fade),2.6,5);
  mesh.trace([point(x,y,z-8),point(x,y,z-24),point(x,y+8,z-24),point(x,y+8,z-19),point(x,y,z-19)],
   hsla(tint,100,83,fade),2.5,6);
  if(chosen)mesh.sprite(image,point(x-4,y,z-4),58,tint,fade*.82,q*.6,.6);
 }
}

function shockGrid(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at);
 const tiles=7;
 for(let col=0;col<tiles;col++){
  const t=(col+.55)/tiles,bump=ease((p-t+.37)/.38),x=reach*t;
  if(!bump)continue;
  for(let row=-1;row<=1;row++){
   const y=row*31,w=Math.max(8,reach/tiles*.47),h=(12+9*Math.sin(row+col+q*12+seed))*bump;
   const tile=[point(x-w,y-12,2),point(x+w,y-12,3),point(x+w,y+12,h),point(x-w,y+12,h)];
   mesh.poly(tile,hsla(hue+col*6,87,42+7*(row+1),fade*bump*.62),hsla(hue+10,100,74,fade*bump*.81));
   mesh.trace([tile[0],point(x,y,h+18),tile[2]],hsla(hue+row*11,100,83,fade*bump*.68),2.2,4);
  }
 }
}

function spikeQuake(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),image=signatureImage(drillSprites.spike);
 for(let i=0;i<9;i++){
  const lane=(i%3)-1,t=Math.floor(i/3)*.19+.62,a=ease((p-t+.5)/.5);
  if(!a)continue;
  const x=reach*t,y=lane*(25+seed%14),h=(28+i%4*10)*a;
  shard(mesh,point,x,y,h*.5,10*a,h*.52,hue+i*3,fade*a,i*.7);
  mesh.sprite(image,point(x+5,y,h*.55),h,hue,fade*a*.94,lane*.14);
  mesh.trace([point(x-21,y,1),point(x-5,y+6,2),point(x+18,y,2)],hsla(hue,100,81,fade*a),2.6,5);
 }
}

function crossfire(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),spread=31+seed%19;
 for(let i=-1;i<=1;i++){
  const t=limit(p*(1+i*.10)+i*.04),x=reach*t,corner=reach*.61;
  const y=i*spread*(1-Math.abs(t-.61)*1.65),z=31+Math.sin(t*Math.PI)*24;
  const flash=point(x,y,z),mid=point(Math.min(x,corner),i*spread,z+Math.abs(i)*11);
  mesh.trace([point(2,0,26),mid,flash],hsla(hue+i*17,100,77,fade*(i?.64:1)*p),i?2.6:4.7,10);
  shard(mesh,point,x,y,z,4+i*i*2,11,hue+i*13,fade*p,seed+q*9);
  mesh.trace([point(corner,i*spread,z-10),mid,point(corner+7,i*spread,z+15)],hsla(hue,100,83,fade*p*.54),1.8,4);
 }
}

function prismBloom(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),fold=ease(q/.33),r=(26+seed%14)*fold;
 const x=reach*p,z=45+Math.sin(p*Math.PI)*24;
 for(let i=0;i<6;i++){
  const a=i*TAU/6+q*4,dy=Math.cos(a),dz=Math.sin(a);
  const a0=point(x-r*.7,dy*r*.4,z+dz*r*.4),a1=point(x+4,dy*r,z+dz*r),a2=point(x+r*.64,dy*r*.51,z+dz*r*.51);
  mesh.poly([a0,a1,a2,point(x,dy*r*.05,z)],hsla(hue+i*15,95,50,fade*.63),hsla(hue+i*11,100,88,fade));
  if(p>.62)mesh.trace([a1,point(reach+19,dy*r*(1+p),z+dz*r*(1+.49*p))],hsla(hue+i*15,100,86,fade*.75),2.7,6);
 }
 shard(mesh,point,x,0,z,10*fold,29*fold,hue,fade,q*6);
}

function rampart(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),rise=ease(q/.29),x=reach*p*.25;
 const r=(43+seed%13)*rise;
 const foot=circle(point,x,0,4,r,8,false,Math.PI/8),crown=circle(point,x,0,47*rise,r*.77,8,false,Math.PI/8);
 for(let i=0;i<8;i++){
  mesh.poly([foot[i],foot[i+1],crown[i+1],crown[i]],hsla(hue+i*6,88,52,fade*.38),hsla(hue+9,99,85,fade*.76));
  mesh.trace([crown[i],point(x,0,69*rise),crown[i+1]],hsla(hue+22,100,83,fade*.66),1.8,5);
 }
 const crest=reach*p;
 shard(mesh,point,crest,0,28,11*rise,16*rise,hue+10,fade,q*5);
 mesh.trace([point(x,0,50*rise),point(crest,0,28)],hsla(hue,100,87,fade*p),3.1,8);
}

function starfall(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at);
 for(let i=0;i<6;i++){
  const fall=ease((q-.27-i*.027)/(at-.27-i*.027)),angle=seed+i*2.399;
  const x=reach+(1-fall)*64*Math.cos(angle),y=(i-2.5)*13+42*(1-fall)*Math.sin(angle),z=13+(1-fall)*(88+i*15);
  const r=(8+i%4*4)*ease(q/.27);
  mesh.trace([point(x+22,y-15,z+40),point(x+9,y-5,z+17),point(x,y,z)],hsla(hue+i*4,100,83,fade*.83),3-i*.21,7);
  shard(mesh,point,x,y,z,r,r*1.35,hue+i*8,fade,q*12+i);
  mesh.trace(circle(point,reach,y,3,9+fall*24,7,false,i*.45),hsla(hue+i*10,99,79,fade*fall),1.6,4);
 }
}

function packetDrop(mesh,g,q,p){
 const {point,reach,at,hue,seed}=g,fade=held(q,at),lock=ease(q/.38),split=ease((q-.53)/.36);
 for(let i=0;i<12;i++){
  const a=i*2.4+seed,glitch=Math.sin(Math.floor(q*27)*3+i)*5;
  const r=(22+i%4*11)*lock+split*(20+i*4),x=reach*p+Math.cos(a)*r,y=Math.sin(a)*r,z=38+i%4*9+glitch;
  const square=[point(x-6,y,z-5),point(x+9,y,z-5),point(x+9,y,z+7),point(x-6,y,z+7)];
  mesh.poly(square,hsla(hue+i*7,92,64,fade*(.77+i%3*.061)),hsla(hue+13,100,89,fade));
  mesh.trace([point(x-25,y,z),square[1]],hsla(hue,99,75,fade*.61),2.1,5);
 }
 const gate=circle(point,reach*p,0,42,31*lock*(1+split*.65),4,true,Math.PI/4);
 mesh.trace(gate,hsla(hue+18,100,87,fade),3.6,9);
}

function joinRings(mesh,rings,paint){
 for(let i=0;i<rings.length-1;i++){
  const near=rings[i],far=rings[i+1];
  for(let j=0;j<near.length;j++){
   const next=(j+1)%near.length;
   mesh.poly([near[j],near[next],far[next],far[j]],paint(i,j));
  }
 }
}

const whaleProfile=[
 [-93,1.6,2.8],[-69,6,6],[-48,12,11],[-26,24,19],[10,30,27],
 [43,26,23],[62,19,17],[74,10,9],[78,0,0]
];
function leviathan(mesh,g,q,p){
 const {point,reach,at,wide,seed}=g;
 const fade=ease((q-.13)/.13)*(1-ease((q-at)/(1-at)));
 if(!fade)return;
 const scale=Math.min(1.16,wide/125),breach=ease((q-.13)/.50),dive=ease((q-at)/(1-at));
 const pitch=mix(.32,-.18,p)-dive*.35,cs=Math.cos(pitch),sn=Math.sin(pitch);
 const x=reach*(.08+.77*p)+dive*44-27,z=10+Math.sin(breach*Math.PI*.82)*64-dive*73;
 const body=(u,y,v)=>point(x+scale*(u*cs-v*sn),scale*y,z+scale*(u*sn+v*cs));
 const sides=12,skirt=(u,y,v)=>body(u,y,v+Math.sin(q*16+u*.045)*4);
 const rings=whaleProfile.map(([u,r,h])=>Array.from({length:sides},(_,i)=>{
  const angle=i*TAU/sides;
  return skirt(u,r*Math.cos(angle),h*Math.sin(angle));
 }));
 joinRings(mesh,rings,(_,j)=>{
  const angle=(j+.5)*TAU/sides,back=Math.sin(angle);
  return hsla(back<-.23?196:209,back<-.23?48:64,
   back<-.23?53-15*back:35+18*back+Math.cos(angle)*8,fade*.98);
 });
 const fin=points=>mesh.poly(points.map(([u,y,v])=>skirt(u,y,v)),hsla(211,68,32,fade),hsla(190,87,65,fade*.52));
 fin([[-49,0,11],[-26,0,51],[-18,0,24],[-10,0,19]]);
 for(const side of [-1,1]){
  const beat=Math.sin(q*16-3.8)*9;
  fin([[-79,0,0],[-105,side*41,3+beat],[-112,side*23,-6+beat],[-96,0,0]]);
  fin([[31,side*24,-6],[9,side*57,-22+beat*.45],[-9,side*41,-24],[2,side*23,-13]]);
  mesh.trace([body(40,side*25,-5),body(53,side*20,-9),body(73,side*9,-6)],
   hsla(211,55,18,fade),1.7);
  mesh.trace([body(55,side*21,6),body(58,side*22,7)],hsla(188,92,91,fade),2.3,3);
 }
 const wash=ease((q-at+.11)/(.95-at+.11));
 for(let i=0;i<24;i++){
  const a=i*2.399+seed,r=(14+wash*(34+i%7*7))*scale,h=Math.sin(wash*Math.PI)*(16+i%8*6);
  const y=Math.sin(a)*r,u=reach+Math.cos(a)*r;
  mesh.trace([point(u,y,h-6),point(u+Math.cos(a)*9,y+Math.sin(a)*8,h+5)],
   hsla(188,96,83,fade*(1-wash*.76)),1.25+i%3*.44,3);
 }
}

function infernoBreath(mesh,g,q){
 const {point,reach,at,seed}=g,fade=held(q,at);
 const flow=ease((q-.17)/(at-.17)),length=reach*flow;
 if(length<1)return;
 const rings=Array.from({length:11},(_,i)=>{
  const f=i/10,spread=(4+Math.min(48,reach*.23)*f**.78)*flow;
  return Array.from({length:10},(_,j)=>{
   const a=TAU*j/10,flutter=.83+.17*Math.sin(i*1.6+j*2.4+q*22);
   return point(length*f+Math.cos(j+q*24)*f*8,Math.cos(a)*spread*flutter,
    25+Math.sin(a)*spread*flutter+f*(10+8*Math.sin(i+q*12)));
  });
 });
 joinRings(mesh,rings,(i,j)=>{
  const flame=Math.sin(i*1.8+j*2.72+q*26);
  return hsla(9+i*2.5+flame*11,100,45+flame*17,fade*(.70-i*.032));
 });
 for(let j=0;j<8;j++){
  const tongue=Array.from({length:12},(_,i)=>{
   const f=i/11,a=j*.79+q*13-i*.26;
   return point(length*f,Math.cos(a)*f*(8+j*3),26+Math.sin(a)*f*(10+j*3)+f*16);
  });
  mesh.trace(tongue,hsla(30+j*3,100,70+j*2,fade*(.8-j*.04)),Math.max(1.2,4-j*.35),7);
 }
 for(let i=0;i<23;i++){
  const a=i*2.399+seed,age=(q*2.3+i*.132)%1,u=length*age;
  const y=Math.cos(a)*age*(13+i%9*5),h=25+age*(10+i%6*12);
  mesh.trace([point(u-8,y,h-4),point(u,y+Math.sin(a)*4,h)],hsla(42,100,80,fade*(1-age)),1.9,3);
 }
}

function extrude(mesh,point,outline,half,front,side,edge){
 const left=outline.map(([x,z])=>point(x,-half,z)),right=outline.map(([x,z])=>point(x,half,z));
 mesh.poly(left,front,edge);
 mesh.poly(right,front,edge);
 for(let i=0;i<outline.length;i++){
  const next=(i+1)%outline.length;
  mesh.poly([left[i],left[next],right[next],right[i]],side,edge);
 }
}

function obsidianChomp(mesh,g,q,p){
 const {point,reach,at,wide}=g,grow=ease(q/.29),fade=held(q,at);
 const size=Math.min(1.16,wide/139)*grow;
 const center=reach*(.23+.77*p)-35;
 const opening=.67*ease((q-.12)/.29)*(1-ease((q-at+.115)/.115));
 for(const top of [true,false]){
  const turn=(top?1:-1)*opening,cs=Math.cos(turn),sn=Math.sin(turn);
  const jaw=(x,y,z)=>point(center+size*(x*cs-z*sn),y*size,33+size*(x*sn+z*cs));
  const stone=hsla(top?252:262,33,top?21:14,fade*.97);
  const facet=hsla(top?273:257,37,top?32:20,fade*.95);
  const neon=hsla(328,92,65,fade*.67);
  const outline=top?[[-32,6],[-26,24],[3,36],[43,17],[60,4],[47,-2]]:
   [[-32,-5],[49,-3],[60,-10],[37,-24],[-15,-20]];
  extrude(mesh,jaw,outline,26,stone,facet,neon);
  for(const side of [-1,1]){
   for(const x of [10,27,45]){
    const tooth=(u,y,z)=>jaw(x+u,side*19+y,z);
    const direction=top?-1:1;
    extrude(mesh,tooth,[[-5,0],[0,direction*(10+x*.09)],[5,0]],4,
     hsla(306,45,88,fade),hsla(279,52,56,fade));
   }
   if(top){
    mesh.poly([[11,14],[32,17],[24,9]].map(([u,z])=>jaw(u,side*26.2,z)),hsla(349,100,77,fade),neon);
    mesh.trace([jaw(1,side*26.3,28),jaw(14,side*26.3,25)],hsla(308,93,65,fade*.71),2,4);
   }
  }
 }
}

function bloodWard(mesh,g,q,p){
 const {point,reach,at,seed}=g,fade=held(q,at);
 scythe(mesh,g,q,p);
 const gather=ease((q-.20)/.49),shield=1-ease((q-.87)/.13);
 for(let i=0;i<3;i++){
  const loop=circle(point,0,0,14+i*13,(20+i*3)*gather,6,false,q*(2+i*.71));
  mesh.trace(loop,hsla(347,94,i===1?83:61,shield*gather*.88),1.5,4);
 }
 for(let i=0;i<14;i++){
  const angle=i*2.399+seed,u=reach*(1-gather)+Math.cos(angle)*gather*(18+i%3*8);
  const y=Math.sin(angle)*gather*(10+i%4*6),z=14+Math.sin(gather*Math.PI)*(12+i%4*5);
  shard(mesh,point,u,y,z,3.6,8+i%4*2,348,fade*.65,angle);
 }
}

function courtroomChalk(mesh,g,q,p){
 const {point,reach,at,seed}=g,wind=ease(q/.37),fade=held(q,at);
 const swing=p*1.24-1.1,cs=Math.cos(swing),sn=Math.sin(swing);
 const pivot=reach*(.31+.62*p)-16;
 const gavel=(x,y,z)=>point(pivot+x*cs-z*sn,y,29+wind*(x*sn+z*cs));
 extrude(mesh,gavel,[[-38,15],[16,15],[16,21],[-38,21]],4,hsla(31,65,35,fade),hsla(39,81,55,fade));
 extrude(mesh,gavel,[[8,3],[24,3],[24,34],[8,34]],12,hsla(29,68,31,fade),hsla(39,80,58,fade));
 const scatter=ease((q-at+.035)/(1-at+.035));
 if(!scatter)return;
 const opacity=(1-scatter)*.68;
 for(let i=0;i<32;i++){
  const a=i*2.399+seed,r=(12+(i%12)*6)*scatter,y=Math.sin(a)*r,x=reach+Math.cos(a)*r;
  const h=12+Math.sin(scatter*Math.PI*.72)*(12+i%10*7),size=(3+i%7*2)*(1+scatter*.65);
  const cloud=circle(point,x,y,h,size,7,true,a);
  mesh.poly(cloud.slice(0,-1),hsla(44,33,94,opacity*(.62+i%3*.17)));
  if(i%3===0)mesh.trace([point(x-5,y,h-3),point(x,y+4,h+6)],hsla(51,85,97,opacity),1.4,3);
 }
}

const signatureScenes={leviathan,infernoBreath,obsidianChomp,bloodWard,courtroomChalk,firewall,domain,artemis,city,acu,amethyst,orbit,null:nullHorizon,paracosm,syringe,mirror:mirrorFrame,
 bladeArc,coilwell,spectralKeel,waterfall,secondSun,scrapTurbine,keyCascade,gateRelay,shockGrid,spikeQuake,
 crossfire,prismBloom,rampart,starfall,packetDrop};

// Follow the attack's actual target pattern with a windup and projected paths.
function signatureTrail(mesh,g,q,p){
 const {point,reach,at,event,hue,seed,start,end,targets}=g;
 if(!event.pose||event.cinematic)return;
 const gain=held(q,at),reachIn=reach*p;
 if(event.pose==='slam'||event.pose==='pulse'){
  for(let i=0;i<3;i++){
   const r=(18+i*13)*(p+.3),h=event.pose==='slam'?11+i*13*(1-p):6+i*15;
   mesh.trace(circle(point,reachIn,0,h,r,4+i*2,false,seed+i*.2+q*3),
    hsla(hue+i*8,98,81,gain*(.83-i*.19)),2-i*.37,3);
  }
 }
 if(event.pose==='spiral'||event.pose==='sweep'||event.pose==='orbit'){
  const arc=Array.from({length:17},(_,i)=>{
   const f=i/16,ang=f*TAU+q*10+seed;
   const r=(14+35*f)*p;
   return point(reachIn+Math.cos(ang)*r,Math.sin(ang)*r,12+f*57);
  });
  mesh.trace(arc,hsla(hue,99,84,gain*.66),1.9,5);
 }
 const strands=targets.length?targets:[end];
 for(let i=0;i<strands.length;i++){
  const t=strands[i],height=event.pose==='slam'?76:event.pose==='stream'?15:29+(i%4)*11;
  const vertices=Array.from({length:13},(_,j)=>{
   const f=j/12*p,r=Math.sin(f*Math.PI);
   return [mix(start.x,t.x,f)+Math.sin(i*3+f*9)*r*12,mix(start.y,t.y,f),15+r*height];
  });
  mesh.trace(vertices,hsla(hue+i*11,99,77,gain*(i?.62:.86)),i?1.7:2.8,4);
 }
}

function impact(mesh,g,q){
 if(q<g.at)return;
 const t=limit((q-g.at)/(1-g.at)),{point,reach,hue,shape,event,seed}=g,big=event.signature;
 const opacity=(1-t)**1.55;
 for(let i=0;i<2;i++){
  mesh.trace(circle(point,reach,0,1+i*9,6+t*(big?82:47)+i*4,shape==='wave'?20:8,false,i*.39),
   hsla(hue,100,81,opacity*(1-i*.34)),(big?3.6:2)*(1-t*.83),4);
 }
 for(let i=0;i<(big?34:18);i++){
  const a=i*2.399+seed;const speed=29+(i%8)*4,r=t*speed,tip=r+Math.max(2,(7+i%5)*(1-t));
  const z=12+Math.sin(t*2.9)*(i%8)*6;
  mesh.trace([point(reach+Math.cos(a)*r,Math.sin(a)*r,z),point(reach+Math.cos(a)*tip,Math.sin(a)*tip,z+4)],
   hsla(hue,100,i%3?84:97,opacity),(i%3)+1);
 }
}

function worldEffect(mesh,draw,rot,{origin=[0,0,0],scale=1}={}){
 const place=scale===1?point=>point:point=>point.map((n,i)=>n*scale+origin[i]);
 const length=p=>Math.hypot(...p)||1;
 const norm=p=>{const d=length(p);return p.map(n=>n/d)};
 const depth=norm(rot.depth),right=norm(rot.right),down=norm(rot.down);
 function trace(points,color,width,glow=0){
  const c=rgba(color);
  for(let i=1;i<points.length;i++){
   const a=place(points[i-1]),b=place(points[i]),x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2];
   const side=norm([y*depth[2]-z*depth[1],z*depth[0]-x*depth[2],x*depth[1]-y*depth[0]]);
   const ribbon=r=>[a.map((n,k)=>n+side[k]*r),b.map((n,k)=>n+side[k]*r),
    b.map((n,k)=>n-side[k]*r),a.map((n,k)=>n-side[k]*r)];
   if(glow>0)mesh.surface(ribbon((width*.72+glow*.24)*scale),[...c.slice(0,3),c[3]*.16],{light:1});
   mesh.surface(ribbon(width*scale/2),c,{light:1});
  }
 }
 function poly(points,fill,edge){
  mesh.surface(points.map(place),fill,{light:.89});
  if(edge)trace([...points,points[0]],edge,.8);
 }
 function sprite(img,center,size,hue,alpha,rotation,aspect=1){
  const texture=draw.imageTexture(img);if(!texture||alpha<=0)return;
  const c=Math.cos(rotation),s=Math.sin(rotation);
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>
   place(center.map((n,i)=>n+(right[i]*(x*aspect*c-y*s)+down[i]*(x*aspect*s+y*c))*size/2)));
  mesh.picture(texture,corners,[1,1,1,Math.min(alpha,.994)]);
 }
 return {poly,trace,sprite};
}

function paintScene(mesh,scene,q){
  const {g,at}=scene;
  const launch=g.event.cinematic==='railshot'?.43:.14;
  const p=ease((q-launch)/(at-launch));
  const sceneDraw=signatureScenes[g.event.visual];
  if(sceneDraw)sceneDraw(mesh,g,q,p);
  else if(g.shape==='wave')seawall(mesh,g,q,p);
  else if(g.shape==='projectile')shot(mesh,g,q,p);
  else if(g.shape==='sweep')scythe(mesh,g,q,p);
  else formations(mesh,g,q,p);
  if(g.event.copiedFrom&&g.event.visual!=='mirror')mirrorFrame(mesh,g,q,p);
  signatureTrail(mesh,g,q,p);
  impact(mesh,g,q);
}

function effectGeometry(a,b,event,at,width,targets){
 const art=event.art||schoolArt[event.school]||'prism',data=moveArts[art]||moveArts.prism;
 const dx=b.x-a.x,dy=b.y-a.y,reach=Math.max(1,Math.hypot(dx,dy)),vx=dx/reach,vy=dy/reach;
 const point=(along,across,z)=>[a.x+vx*along-vy*across,a.y+vy*along+vx*across,z];
 return {art,shape:data.shape,at,hue:data.hue,event,reach,point,seed:(event.seed||0)%127,width,
  start:a,end:b,targets,wide:Math.min(262,width*.41)};
}

export function paintArmyCast(geometry,draw,rotation,cast,progress){
 const {unit,target,event,timing}=cast,scale=.73;
 const start={x:0,y:0},end={x:(target.x-unit.x)/scale,y:(target.y-unit.y)/scale};
 const g=effectGeometry(start,end,event,timing.at,410,[]);
 const space={origin:[unit.x,unit.y,13],scale};
 paintScene(worldEffect(geometry,draw,rotation,space),{g,at:timing.at},progress);
}

export function combatScene(field,world){
 const stage=arenaWorldView(field);
 const canvas=stage?null:document.createElement('canvas');
 if(canvas){canvas.className='combat-fx combat-depth';canvas.setAttribute('aria-hidden','true');field.append(canvas)}
 const ctx=canvas?.getContext('2d');
 let frame=0,scene=null;
 function draw(now){
  if(!scene)return;
  const {width,height,project,duration,start}=scene,q=limit((now-start)/duration);
  ctx.clearRect(0,0,width,height);
  if(q===1){scene=null;frame=0;return}
  const mesh=renderer(ctx,project);
  paintScene(mesh,scene,q);mesh.draw();
  frame=requestAnimationFrame(draw);
 }
 function drawDepth(now,geometry,draw,rotation){
  if(!scene)return false;
  const q=limit((now-scene.start)/scene.duration);
  if(q===1){scene=null;return false}
  paintScene(worldEffect(geometry,draw,rotation),scene,q);
  return true;
 }
 function cast(a,b,event,{duration,at},targets=[]){
  if(!ctx&&!stage)return;
  const width=field.clientWidth,height=field.clientHeight,dpr=Math.min(1.75,window.devicePixelRatio||1);
  if(!width||!height)return;
  const w=Math.ceil(width*dpr),h=Math.ceil(height*dpr);
  if(canvas){
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineCap='round';ctx.lineJoin='round';
  }
  const g=effectGeometry(a,b,event,at,world.clientWidth,targets);
  scene={width,height,project:canvas?arenaProjection(field,world):null,g,at,duration,start:performance.now()};
  if(stage)stage.setEffect(drawDepth);
  else if(!frame)frame=requestAnimationFrame(draw);
 }
 function stop(){cancelAnimationFrame(frame);frame=0;scene=null;stage?.setEffect(null);canvas?.remove()}
 return {cast,stop};
}
