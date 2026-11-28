import {coverUV,createGeometry,rendererFor,viewMatrix,cssOrientation} from './scene-gl.js';
import {paintArenaWorld} from './arena-world-models.js';
import {arenaPoint} from './arena-stage.js';

const activeViews=new WeakMap();
export function arenaWorldView(field){return activeViews.get(field)}
const identity=()=>new DOMMatrixReadOnly();
const matrix=css=>css==='none'?identity():new DOMMatrixReadOnly(css);
const cardLogo='/assets/player-cube.png';

function localBox(element,ancestor){
 let x=0,y=0;
 const w=element.offsetWidth,h=element.offsetHeight;
 for(let e=element;e&&e!==ancestor;e=e.offsetParent){x+=e.offsetLeft;y+=e.offsetTop}
 return {x,y,w,h};
}

function stadiumCard(g,renderer,slot,logo){
 const {body,button,team:side,w,h,x,y}=slot;
 const css=getComputedStyle(body),m=matrix(css.transform),opacity=Number(css.opacity);
 const dark=button.classList.contains('down')?.63:opacity<.9?.66:1;
 const tint=slot.tint|| (side==='allies'?'#7ce8ef':'#da8dbd');
 const picked=button.classList.contains('acting')||button.classList.contains('targeted');
 const point=(x0,y0,z)=>[
  x+m.m41+m.m11*x0+m.m21*y0+m.m31*z,
  y+m.m42+m.m12*x0+m.m22*y0+m.m32*z,
  m.m43+m.m13*x0+m.m23*y0+m.m33*z
 ];
 const bw=w/2+1,bh=h/2+1,cut=Math.min(6,bw*.20,bh*.12),depth=w<90?8:12;
 const outline=[[-bw+cut,-bh],[bw-cut,-bh],[bw,-bh+cut],[bw,bh-cut],
  [bw-cut,bh],[-bw+cut,bh],[-bw,bh-cut],[-bw,-bh+cut]];
 const back=outline.map(([x,y])=>point(x*.99,y*.99,-depth)),front=outline.map(([x,y])=>point(x,y,.07));
 const cardBase=side==='allies'?'#1b2836':'#282039';
 g.surface(front,cardBase,{light:dark});
 g.surface(back,side==='allies'?'#263c56':'#452d52',{light:dark*.82});
 for(let i=0;i<outline.length;i++){
  const j=(i+1)%outline.length;
  g.surface([back[i],back[j],front[j],front[i]],i===2||i===4?tint:cardBase,{light:(picked?.88:.75)*dark});
  if(picked||i%2===0)g.beam(front[i],front[j],picked?1.8:1.15,tint,{light:picked?1:.72});
 }
 const stamp=Math.min(w*.25,h*.27,39);
 g.picture(renderer.imageTexture(logo),[
  point(-stamp,-stamp,-depth-.21),point(stamp,-stamp,-depth-.21),
  point(stamp,stamp,-depth-.21),point(-stamp,stamp,-depth-.21)
 ],[.76,.84,1,.77*dark]);

 const portrait=button.querySelector('img.unit-cover.ready'),texture=renderer.imageTexture(portrait);
 const box=texture&&localBox(portrait,body);
 button.classList.toggle('gpu-portrait',!!(box?.w&&box.h));
 if(box?.w&&box.h){
  const x0=box.x-w/2,y0=box.y-h/2;
  const x1=x0+box.w,y1=y0+box.h;
  g.picture(texture,[point(x0,y0,1.05),point(x1,y0,1.05),
   point(x1,y1,1.05),point(x0,y1,1.05)],[dark,dark,dark,1],coverUV(portrait.naturalWidth,portrait.naturalHeight,box.w,box.h));
 }
}

export function createArenaViewport(){
 let canvas=document.createElement('canvas');canvas.className='arena-gpu';canvas.setAttribute('aria-hidden','true');
 let renderer=rendererFor(canvas);if(!renderer)return null;
 canvas=renderer.canvas;
 const deck=createGeometry(),cards=createGeometry(),effects=createGeometry();
 const logo=new Image();logo.src=cardLogo;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let field=null,world=null,frame=0,observer=null,visual=null,previous='',lastFrame=-Infinity,lastDeck=-Infinity,slots=[],gateY,measure=true,tint='#76e8dc';

 function detach(){
  cancelAnimationFrame(frame);frame=0;observer?.disconnect();observer=null;
  if(field){
   activeViews.delete(field);field.classList.remove('has-gpu-arena');
   field.querySelectorAll('.gpu-portrait').forEach(el=>el.classList.remove('gpu-portrait'));
  }
  field=null;world=null;visual=null;canvas.remove();
 }
 function attach(host){
  if(field===host)return;
  detach();if(!host||!renderer)return;
  field=host;world=field.querySelector('.arena-world');if(!world){detach();return}
  field.prepend(canvas);
  activeViews.set(field,{setEffect(draw){visual=draw}});
  tint=getComputedStyle(field.closest('.live-field')).getPropertyValue('--arena').trim()||'#79d7ec';
  previous='';lastDeck=lastFrame=-Infinity;measure=true;
  observer=new ResizeObserver(()=>{measure=true});observer.observe(field);observer.observe(world);
  frame=requestAnimationFrame(render);
 }
 function updateSlots(){
  gateY=arenaPoint(world.querySelector('.versus'),world).y;
  slots=[...world.querySelectorAll('.arena-slot')].map(element=>{
   const button=element.querySelector('.fighter'),body=element.querySelector('.arena-card-body');
   const center=arenaPoint(element,world);
   return {...center,body,button,w:body.offsetWidth,h:body.offsetHeight,
    tint:getComputedStyle(element).getPropertyValue('--unit').trim(),team:button.dataset.unit.split('-')[0],
    selected:button.classList.contains('acting')||button.classList.contains('targeted'),down:button.classList.contains('down')};
  });
 }
 function render(now){
  if(!field||!world||!renderer)return;
  if(!field.isConnected){detach();return}
  const css=getComputedStyle(world).transform,animating=!!visual||field.classList.contains('camera-locked');
  const changed=previous!==css;
  if(!measure&&renderer.kind==='software'&&now-lastFrame<30){frame=requestAnimationFrame(render);return}
  if(!measure&&!animating&&!changed&&now-lastFrame<(reduced?350:85)){frame=requestAnimationFrame(render);return}
  const dimensionsChanged=measure;
  if(measure)updateSlots();
  const width=field.clientWidth,height=field.clientHeight;
  if(!width||!height){frame=requestAnimationFrame(render);return}
  const dpr=Math.min(renderer.kind==='software'?.86:1.75,devicePixelRatio||1),w=Math.round(width*dpr),h=Math.round(height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;measure=true}
  const style=getComputedStyle(field),worldW=world.offsetWidth,worldH=world.offsetHeight;
  const center=[worldW/2,worldH/2],rot=cssOrientation(matrix(css));
  const clip=viewMatrix({width,height,origin:[...center,0],center:[world.offsetLeft+center[0],world.offsetTop+center[1]],
   vanish:style.perspectiveOrigin.split(' ').map(Number.parseFloat),lens:Number.parseFloat(style.perspective)||1200,rot});
  if(measure||now-lastDeck>(reduced?2000:180)){
   deck.reset();paintArenaWorld(deck,{width:worldW,height:worldH,tint,clock:reduced?0:now/1000,slots,gateY});lastDeck=now;
  }
  // Body transforms come from the same animated elements that handle keyboard and pointer input.
  if(dimensionsChanged||animating||now-lastFrame>=85){
   cards.reset();for(const slot of slots)stadiumCard(cards,renderer,slot,logo);
  }
  effects.reset();
  if(visual&&visual(now,effects,renderer,rot)===false)visual=null;
  if(renderer.render(clip,[deck,cards,effects])){
   field.classList.add('has-gpu-arena');lastFrame=now;previous=css;measure=false;
  }
  frame=requestAnimationFrame(render);
 }
 canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();cancelAnimationFrame(frame);frame=0;
  if(field){
   activeViews.delete(field);field.classList.remove('has-gpu-arena');
   field.querySelectorAll('.gpu-portrait').forEach(el=>el.classList.remove('gpu-portrait'));
  }
  renderer=null;visual=null;
 });
 canvas.addEventListener('webglcontextrestored',()=>{
  renderer=rendererFor(canvas);if(!renderer||!field)return;
  const host=field;detach();canvas=renderer.canvas;attach(host);
 });
 return {attach,detach,refresh(){measure=true}};
}
