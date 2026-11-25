// CPU rasterizer for the same world-space solids, textures, and camera used by WebGL.
const STRIDE=9;

function project(m,w,h,x,y,z){
 const inv=1/(m[3]*x+m[7]*y+m[11]*z+m[15]);
 if(inv<0||inv>5.55)return null;
 return [
  (1+(m[0]*x+m[4]*y+m[8]*z+m[12])*inv)*w*.5,
  (1-(m[1]*x+m[5]*y+m[9]*z+m[13])*inv)*h*.5,
  (m[2]*x+m[6]*y+m[10]*z+m[14])*inv,inv
 ];
}
const areaKey=p=>(p[0][2]+p[1][2]+p[2][2])/3;
const min3=(a,b,c)=>Math.min(a,b,c);
const max3=(a,b,c)=>Math.max(a,b,c);

export function softwareRendererFor(input){
 let canvas=input,ctx=canvas.getContext('2d');
 if(!ctx){canvas=input.cloneNode(false);ctx=canvas.getContext('2d')}
 if(!ctx)return null;
 canvas.dataset.renderer='software';
 const cache=new WeakMap(),textures=new Map();
 const reader=document.createElement('canvas'),read=reader.getContext('2d',{willReadFrequently:true});
 let disposed=false,oldView=null,image=null,zBuffer=null,ground=null;

 function imageTexture(img){
  const canvasSource=typeof img?.getContext==='function';
  if(!read||(canvasSource?!img.width||!img.height:!img?.complete||!img.naturalWidth))return null;
  const key=canvasSource?img:img.currentSrc||img.src;
  if(textures.has(key))return textures.get(key);
  // DOM portraits cover external images that cannot be sampled into a texture.
  if(!canvasSource&&new URL(key,location.href).origin!==location.origin)return null;
  const sourceWidth=canvasSource?img.width:img.naturalWidth,sourceHeight=canvasSource?img.height:img.naturalHeight;
  const scale=Math.min(1,320/Math.max(sourceWidth,sourceHeight));
  const width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
  let texture=null;
  try{
   reader.width=width;reader.height=height;read.drawImage(img,0,0,width,height);
   texture={width,height,source:read.getImageData(0,0,width,height).data};
  }catch{/* A DOM portrait can still be displayed. */}
  if(textures.size>=64)textures.delete(textures.keys().next().value);
  textures.set(key,texture);return texture;
 }

 function clipFaces(mesh,key,view){
  const stream=mesh[key],old=cache.get(stream);
  if(old?.view===view&&old.revision===mesh.revision)return old.faces;
  const {matrix,width,height}=view,data=stream.data,faces=[];
  for(let i=0;i<data.length;i+=STRIDE*3){
   const p=[i,i+STRIDE,i+2*STRIDE].map(j=>project(matrix,width,height,data[j],data[j+1],data[j+2]));
   if(p.some(v=>!v)||[0,1].some(k=>p.every(v=>v[k]<0)||p.every(v=>v[k]>(k?height:width))))continue;
   faces.push({p,r:data[i+3]*255,g:data[i+4]*255,b:data[i+5]*255,alpha:data[i+6],depth:areaKey(p)});
  }
  cache.set(stream,{view,revision:mesh.revision,faces});return faces;
 }
 function pictureFaces(item,view,batch){
  const {matrix,width,height}=view,{projection,points,color,uv:sourceUV}=item;
  const p=points.map(point=>project(matrix,width,height,...point));
  if(p.some(q=>!q))return;
  for(const indices of [[0,1,2],[0,2,3]]){
   const pts=indices.map(n=>p[n]);
   const uv=indices.map(n=>sourceUV[n].map(value=>value*p[n][3]));
   batch.push({p:pts,uv,texture:projection,r:color[0],g:color[1],b:color[2],alpha:color[3],depth:areaKey(pts)});
  }
 }
 function raster(face,solid){
  const [a,b,c]=face.p,w=image.width,h=image.height;
  const ax=a[0],ay=a[1],bx=b[0],by=b[1],cx=c[0],cy=c[1];
  const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
  if(Math.abs(den)<.07)return;
  const left=Math.max(0,Math.ceil(min3(ax,bx,cx)-.5)),right=Math.min(w-1,Math.floor(max3(ax,bx,cx)-.5));
  const top=Math.max(0,Math.ceil(min3(ay,by,cy)-.5)),bottom=Math.min(h-1,Math.floor(max3(ay,by,cy)-.5));
  const ra=(by-cy)/den,sa=(cx-bx)/den,rb=(cy-ay)/den,sb=(ax-cx)/den;
  const pixels=image.data,depth=zBuffer,texture=face.texture,uv=face.uv;
  const alpha=face.alpha,red=face.r,green=face.g,blue=face.b;
  const az=a[2]-c[2],bz=b[2]-c[2],cz=c[2];
  for(let y=top;y<=bottom;y++){
   const dy=y+.5-cy,dx=left+.5-cx;
   let fa=ra*dx+sa*dy,fb=rb*dx+sb*dy,idx=y*w+left;
   for(let x=left;x<=right;x++,idx++,fa+=ra,fb+=rb){
    const fc=1-fa-fb;
    if(fa<-.00001||fb<-.00001||fc<-.00001)continue;
    const d=cz+az*fa+bz*fb;if(d>depth[idx]+.000002)continue;
    let r=red,g=green,b0=blue,opa=alpha;
    if(texture){
     const inv=a[3]*fa+b[3]*fb+c[3]*fc;
     const u=(uv[0][0]*fa+uv[1][0]*fb+uv[2][0]*fc)/inv,v=(uv[0][1]*fa+uv[1][1]*fb+uv[2][1]*fc)/inv;
     const tx=Math.min(texture.width-1,Math.max(0,(u*texture.width)|0));
     const ty=Math.min(texture.height-1,Math.max(0,(v*texture.height)|0)),at=4*(ty*texture.width+tx);
     const data=texture.source;
     r*=data[at];g*=data[at+1];b0*=data[at+2];opa*=data[at+3]/255;
    }
    if(opa<.008)continue;
    const at=idx*4;
    if(solid&&opa>=.997){
     depth[idx]=d;pixels[at]=r;pixels[at+1]=g;pixels[at+2]=b0;pixels[at+3]=255;
    }else{
     const keep=pixels[at+3]/255*(1-opa),aOut=opa+keep;
     pixels[at]=(r*opa+pixels[at]*keep)/aOut;
     pixels[at+1]=(g*opa+pixels[at+1]*keep)/aOut;
     pixels[at+2]=(b0*opa+pixels[at+2]*keep)/aOut;
     pixels[at+3]=aOut*255;
    }
   }
  }
 }
 // Cache the opaque ground on a fixed camera so every animation frame can reuse its depth.
 function render(matrix,meshes,clear=[0,0,0,0],floor){
  if(disposed)return false;
  const width=canvas.width,height=canvas.height,old=oldView;
  const view=old&&old.width===width&&old.height===height&&matrix.every((v,i)=>old.matrix[i]===v)?old:{width,height,matrix};
  oldView=view;
  if(!image||image.width!==width||image.height!==height){
   image=ctx.createImageData(width,height);zBuffer=new Float32Array(width*height);
  }
  const pixels=new Uint32Array(image.data.buffer);
  if(floor&&ground?.view===view&&ground.floor===floor&&ground.revision===floor.revision){
   pixels.set(ground.pixels);zBuffer.set(ground.depth);
  }else{
   zBuffer.fill(Infinity);
   const [r,g,b,a]=clear.map(n=>Math.round(n*255));
   pixels.fill((a<<24)|(b<<16)|(g<<8)|r);
   if(floor){
    for(const face of clipFaces(floor,'opaque',view))raster(face,true);
    ground={view,floor,revision:floor.revision,pixels:pixels.slice(),depth:zBuffer.slice()};
   }else ground=null;
  }
  const solid=[],blended=[];
  for(const mesh of meshes){
   if(mesh===floor)continue;
   solid.push(...clipFaces(mesh,'opaque',view));
   blended.push(...clipFaces(mesh,'translucent',view));
   for(const item of mesh.pictures)pictureFaces(item,view,item.color[3]>=.995?solid:blended);
  }
  for(const face of solid)raster(face,true);
  blended.sort((a,b)=>b.depth-a.depth);
  for(const face of blended)raster(face,false);
  ctx.putImageData(image,0,0);
  return true;
 }
 return {canvas,kind:'software',render,imageTexture,dispose(){disposed=true;textures.clear();ground=null}};
}
