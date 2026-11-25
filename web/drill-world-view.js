import {createGeometry,rendererFor,orientation,viewMatrix,rgba} from './scene-gl.js';
import {paintDrillWorld,gravityRise} from './drill-world-models.js';
import {drillSprites} from './drill-sprites.js';
import {starterCube} from './cube-catalog.js';

export function createDrillViewport(canvas,stage,avatar=starterCube){
 const renderer=rendererFor(canvas);
 if(!renderer)return null;
 if(renderer.canvas!==canvas)canvas.replaceWith(renderer.canvas);
 const surface=renderer.canvas;
 surface.tabIndex=0;
 surface.setAttribute('aria-label',canvas.getAttribute('aria-label'));
 const mesh=createGeometry();
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let width=0,height=0,matrix=null,last=-Infinity,current=null;
 const load=url=>{
  const img=new Image();img.onload=()=>{if(current)draw(current,true)};img.src=url;return img;
 };
 const kind=stage.dataset.drill,art=kind==='endurance'?{portals:drillSprites.portals.map(load)}:{[kind]:load(drillSprites[kind])};
 art.cube=load(avatar.icon);
 function resize(){
  width=stage.clientWidth;height=stage.clientHeight;
  const cap=renderer.kind==='software'?Math.min(.85,Math.sqrt(190000/Math.max(1,width*height))):1.7;
  const dpr=Math.min(cap,devicePixelRatio||1);
  surface.width=Math.max(1,Math.round(width*dpr));surface.height=Math.max(1,Math.round(height*dpr));
  last=-Infinity;
 }
 function draw(run,force=false){
  current=run;
  if(force||width!==stage.clientWidth||height!==stage.clientHeight)resize();
  const now=performance.now();
  if(!force&&renderer.kind==='software'&&now-last<29)return;
  last=now;
  const scale=Math.min(width/540,height/280),portrait=width<height;
  // Pull back on narrow screens so both rails and all three lanes stay in frame.
  matrix=viewMatrix({width,height,origin:[run.x*(portrait?.24:.56),0,run.lift*gravityRise*.70],center:[width/2,height*(portrait?.72:.78)],
   vanish:[width/2,height*(portrait?.295:.38)],lens:Math.min(width*.77,height*.86),rot:orientation(1.19,0,scale)});
  mesh.reset();
  const sprites=art.portals?{portals:art.portals.map(img=>renderer.imageTexture(img))}:{[kind]:renderer.imageTexture(art[kind])};
  sprites.cube=renderer.imageTexture(art.cube);
  sprites.cubeColor=avatar.color;
  const bg=paintDrillWorld(mesh,run,reduce.matches,sprites);
  const tint=rgba(bg);
  renderer.render(matrix,[mesh],[tint[0],tint[1],tint[2],.22]);
 }
 function worldX(clientX){
  if(!matrix)return 0;
  const bounds=surface.getBoundingClientRect(),q=2*(clientX-bounds.left)/bounds.width-1,z=34+(current?.lift||0)*gravityRise;
  return (q*(matrix[11]*z+matrix[15])-matrix[8]*z-matrix[12])/(matrix[0]-q*matrix[3]);
 }
 return {canvas:surface,draw,worldX,close(){current=null;renderer.dispose()}};
}
