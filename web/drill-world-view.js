import {createGeometry,rendererFor,orientation,viewMatrix,rgba} from './scene-gl.js';
import {softwareRendererFor} from './scene-software.js';
import {paintDrillDeck,paintDrillWorld,gravityRise} from './drill-world-models.js';
import {forgeImpactAge,recordForgeStrike} from './drill-forge-effects.js';
import {drillSprites} from './drill-sprites.js';
import {starterCube} from './cube-catalog.js';
import {arcadeCubePortrait} from './arcade-cube-art.js';

// Compose the actor's rigid pose with the playfield camera. Its detailed mesh stays on the GPU.
function drillActor(mesh){
 const matrix=new Float32Array(16),c=Math.cos(.22),s=Math.sin(.22);
 return {mesh,matrix,place(x,y,z,roll,scale){
  const camera=this.camera,cr=Math.cos(roll),sr=Math.sin(roll);
  for(let i=0;i<4;i++){
   const u=camera[i],v=camera[4+i],w=camera[8+i],right=cr*u-sr*w;
   matrix[i]=scale*(c*right+s*v);
   matrix[4+i]=scale*(c*v-s*right);
   matrix[8+i]=scale*(sr*u+cr*w);
   matrix[12+i]=x*u+y*v+z*w+camera[12+i];
  }
 }};
}

export function createDrillViewport(canvas,stage,avatar=starterCube,onForgeContact){
 let renderer=rendererFor(canvas);
 if(!renderer)return null;
 if(renderer.canvas!==canvas)canvas.replaceWith(renderer.canvas);
 const surface=renderer.canvas;
 surface.tabIndex=0;
 surface.setAttribute('aria-label',canvas.getAttribute('aria-label'));
 const mesh=createGeometry(),deck=createGeometry(),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let width=0,height=0,matrix=null,last=-Infinity,current=null,closed=false,actor=null;
 let strike=null,missAt=0,tailFrame=0,contactPlayed=false;
 let softwareBudget=150000,slowFrames=0,resizePending=false;
 const redraw=()=>{if(current)draw(current,true)};
 const load=url=>{const img=new Image();img.onload=redraw;img.src=url;return img};
 const kind=stage.dataset.drill,art=kind==='endurance'?{portals:drillSprites.portals.map(load)}:{[kind]:load(drillSprites[kind])};
 const cubePortrait=arcadeCubePortrait(avatar,redraw);
 paintDrillDeck(deck,kind);

 if(renderer.kind==='webgl'){
  import('/drill-avatar.js').then(({buildDrillAvatar})=>{
   if(closed)return;
   actor=drillActor(buildDrillAvatar(avatar,createGeometry()));
   if(current)draw(current,true);
  }).catch(()=>{/* The single-face 3D hull also works without the detailed model bundle. */});
 }
 function resize(){
  width=stage.clientWidth;height=stage.clientHeight;
  const cap=renderer.kind==='software'?Math.min(.85,Math.sqrt(softwareBudget/Math.max(1,width*height))):1.7;
  const dpr=Math.min(cap,devicePixelRatio||1),out=renderer.canvas;
  const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
  if(out.width!==w)out.width=w;
  if(out.height!==h)out.height=h;
  last=-Infinity;
 }
 // A lost GPU context must not blank an active run or discard its existing pointer capture.
 function contextLost(event){
  event.preventDefault();
  if(closed||renderer.kind!=='webgl')return;
  const layer=document.createElement('canvas'),fallback=softwareRendererFor(layer);
  if(!fallback)return;
  layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{position:'absolute',inset:'0',pointerEvents:'none'});
  surface.before(layer);surface.style.opacity='0';
  renderer.dispose();renderer=fallback;
  if(current)draw(current,true);
 }
 function contextRestored(){
  if(closed||renderer.canvas===surface)return;
  const hardware=rendererFor(surface);
  if(hardware?.kind!=='webgl'){hardware?.dispose();return}
  const layer=renderer.canvas;renderer.dispose();layer.remove();
  renderer=hardware;surface.style.opacity='';
  if(current)draw(current,true);
 }
 surface.addEventListener('webglcontextlost',contextLost);
 surface.addEventListener('webglcontextrestored',contextRestored);
 function draw(run,force=false){
  if(closed)return;
  if(current!==run){strike=null;cancelAnimationFrame(tailFrame)}
  current=run;
  if(force||resizePending||width!==stage.clientWidth||height!==stage.clientHeight){resize();resizePending=false}
  if(!width||!height)return;
  const now=performance.now(),clock=run.time+(run.failed&&strike?(now-missAt)/1000:0);
  if(strike&&!contactPlayed&&strike.quality!=='miss'&&forgeImpactAge(strike,clock,reduce.matches)>=0){
   contactPlayed=true;onForgeContact?.(strike.quality);
  }
  if(!force&&renderer.kind==='software'&&now-last<29)return;
  last=now;
  const scale=Math.min(width/540,height/280),portrait=width<height;
  matrix=viewMatrix({width,height,origin:[run.x*(portrait?.24:.56),0,run.lift*gravityRise*.70],center:[width/2,height*(portrait?.72:.78)],
   vanish:[width/2,height*(portrait?.295:.38)],lens:Math.min(width*.77,height*.86),rot:orientation(1.19,0,scale)});
  mesh.reset();
  const sprites=art.portals?{portals:art.portals.map(img=>renderer.imageTexture(img))}:{[kind]:renderer.imageTexture(art[kind])};
  sprites.portrait=renderer.imageTexture(cubePortrait);
  sprites.cubeColor=avatar.color;
  const software=renderer.kind==='software',model=software?null:actor;
  if(model)model.camera=matrix;
  const bg=paintDrillWorld(mesh,run,reduce.matches,sprites,{actor:model,strike,clock,software,hasDeck:true});
  const tint=rgba(bg);
  renderer.render(matrix,[deck,mesh],[tint[0],tint[1],tint[2],.22],deck,model);
  if(software&&softwareBudget>70000){
   slowFrames=performance.now()-now>30?slowFrames+1:Math.max(0,slowFrames-1);
   if(slowFrames>=3){softwareBudget=Math.max(70000,Math.round(softwareBudget*.74));slowFrames=0;resizePending=true}
  }
 }
 function strikeAt(run,charge,swung){
  strike=recordForgeStrike(run,charge,swung);contactPlayed=false;
  if(!run.failed)return;
  missAt=performance.now();
  if(reduce.matches||!swung)return;
  const finishSwing=()=>{
   if(closed||current!==run)return;
   draw(run);
   if(performance.now()-missAt<480)tailFrame=requestAnimationFrame(finishSwing);
  };
  tailFrame=requestAnimationFrame(finishSwing);
 }
 function worldX(clientX){
  if(!matrix)return 0;
  const bounds=surface.getBoundingClientRect(),q=2*(clientX-bounds.left)/bounds.width-1,z=34+(current?.lift||0)*gravityRise;
  return (q*(matrix[11]*z+matrix[15])-matrix[8]*z-matrix[12])/(matrix[0]-q*matrix[3]);
 }
 function close(){
  closed=true;current=null;actor=null;cancelAnimationFrame(tailFrame);
  surface.removeEventListener('webglcontextlost',contextLost);
  surface.removeEventListener('webglcontextrestored',contextRestored);
  if(renderer.canvas!==surface)renderer.canvas.remove();
  renderer.dispose(true);
 }
 return {canvas:surface,draw,strike:strikeAt,worldX,close};
}
