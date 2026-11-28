import * as THREE from 'three';
import {Projector} from 'three/addons/renderers/Projector.js';

// Both renderers use the same camera, transforms and raycast targets. Dropping
// small scenery details on the CPU keeps placement and resident picks aligned.
export function kingdomRenderer(canvas,options={}){
 const attributes={alpha:Boolean(options.alpha),antialias:true,depth:true,stencil:false,powerPreference:'low-power'};
 const context=canvas.getContext('webgl2',attributes);
 if(context){
  const renderer=new THREE.WebGLRenderer({canvas,context,...attributes});
  canvas.dataset.renderer='webgl';
  return renderer;
 }
 const ctx=canvas.getContext('2d',{alpha:attributes.alpha});
 if(!ctx)throw Error('This browser could not create a drawing surface for the Kingdom.');
 canvas.dataset.renderer='software';
 return canvasRenderer(canvas,ctx);
}

function mappedTriangle(ctx,img,uv,a,b,c){
 if(!img?.width||!img.height||img.complete===false)return;
 const x0=uv[0].x*img.width,y0=(1-uv[0].y)*img.height;
 const s=uv[1].x*img.width-x0,t=(1-uv[1].y)*img.height-y0;
 const u=uv[2].x*img.width-x0,v=(1-uv[2].y)*img.height-y0,det=s*v-u*t;
 if(Math.abs(det)<.001)return;
 const dx=b.x-a.x,dy=b.y-a.y,ex=c.x-a.x,ey=c.y-a.y;
 const xx=(dx*v-ex*t)/det,yx=(dy*v-ey*t)/det,xy=(ex*s-dx*u)/det,yy=(ey*s-dy*u)/det;
 ctx.save();ctx.clip();ctx.transform(xx,yx,xy,yy,a.x-xx*x0-xy*y0,a.y-yx*x0-yy*y0);
 ctx.drawImage(img,0,0);ctx.restore();
}

function canvasRenderer(canvas,ctx){
 const projector=new Projector(),paint=new THREE.Color(),sun=new THREE.Vector3(-.46,.82,.54).normalize();
 const white=new THREE.Color(0xffffff),a={},b={},c={};
 const clockScreen=document.createElement('canvas');
 clockScreen.width=128;clockScreen.height=86;
 let screenKey,ratio=1;
 function tube(material){
  const {clock,playing,colorDisplay,outcome}=material.uniforms;
  const active=playing.value>0,clr=colorDisplay.value>0,t=active?Math.floor(clock.value*12):0;
  const key=[clr,t,Math.round(outcome.value*2)].join('/');
  if(key===screenKey)return clockScreen;
  screenKey=key;
  const screen=clockScreen.getContext('2d'),baseline=67;
  screen.fillStyle=clr?'#25416a':'#172f26';screen.fillRect(0,0,128,86);
  screen.strokeStyle=clr?'#8ec2dd':'#82bd79';screen.lineWidth=2;
  screen.beginPath();screen.moveTo(0,baseline);screen.lineTo(128,baseline);screen.stroke();
  screen.fillStyle=clr?'#f6be5c':'#9ad985';
  for(let i=0;i<3;i++){
   const x=(151+i*50-t*2%150)%150-8;
   screen.beginPath();screen.moveTo(x,baseline);screen.lineTo(x+5,baseline-11);screen.lineTo(x+10,baseline);screen.fill();
  }
  screen.fillStyle=clr?'#59edce':'#cfffb0';
  screen.fillRect(29,baseline-9-Math.abs(Math.sin(t*.145))*22,9,9);
  return clockScreen;
 }
 function xy(v,out){
  out.x=(v.positionScreen.x+1)*canvas.width/2;out.y=(1-v.positionScreen.y)*canvas.height/2;return out;
 }
 function render(scene,camera){
  const w=canvas.width,h=canvas.height;if(!w||!h)return;
  ctx.globalAlpha=1;
  if(scene.background?.isColor||scene.fog){ctx.fillStyle=(scene.background||scene.fog.color).getStyle();ctx.fillRect(0,0,w,h);}
  else ctx.clearRect(0,0,w,h);
  scene.traverseVisible(o=>{
   if(o.material?.uniforms?.colorDisplay)o.material.onBeforeRender(null,scene,camera,o.geometry,o);
  });
  const {elements}=projector.projectScene(scene,camera,true,true);
  for(const face of elements){
   const m=face.material;if(!m?.visible||m.opacity<=.01)continue;
   if(!face.v1){
    const image=m.map?.image;
    if(image?.width&&image.complete!==false){
     const sw=Math.abs(face.scale.x)*w/2,sh=Math.abs(face.scale.y)*h/2;
     ctx.globalAlpha=m.opacity;ctx.drawImage(image,(face.x+1)*w/2-sw/2,(1-face.y)*h/2-sh/2,sw,sh);
    }
    continue;
   }
   xy(face.v1,a);xy(face.v2,b);
   ctx.globalAlpha=m.opacity;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
   if(!face.v3){ctx.strokeStyle=(m.color||white).getStyle();ctx.lineWidth=Math.max(1,ratio);ctx.stroke();continue;}
   if(m.isShaderMaterial&&!m.uniforms?.colorDisplay)continue;
   xy(face.v3,c);ctx.lineTo(c.x,c.y);ctx.closePath();
   paint.copy(m.color||white);
   if(m.vertexColors)paint.multiply(face.color);
   if(!m.isMeshBasicMaterial)paint.multiplyScalar(.61+.55*Math.max(0,face.normalModel.dot(sun)));
   const map=m.uniforms?.colorDisplay?tube(m):m.userData.cpuTexture?m.map?.image:null;
   if(!map||!m.transparent){ctx.fillStyle=paint.getStyle();ctx.fill();}
   if(map)mappedTriangle(ctx,map,face.uvs,a,b,c);
  }
  ctx.globalAlpha=1;
 }
 return {software:true,shadowMap:{},render,setPixelRatio(n){ratio=Math.min(n,1);},
  setSize(w,h){const scale=Math.min(ratio,1000/Math.max(w,h));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));},
  dispose(){clockScreen.width=clockScreen.height=0;}};
}
