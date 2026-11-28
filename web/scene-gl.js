import {softwareRendererFor} from './scene-software.js';

/* Small WebGL triangle renderer for the arena and the training playfields. */
const TAU=2*Math.PI,stride=9;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const cross=([a,b,c],[x,y,z])=>[b*z-c*y,c*x-a*z,a*y-b*x];
const delta=(a,b)=>a.map((value,i)=>value-b[i]);
const dot=(a,b)=>a.reduce((n,value,i)=>n+value*b[i],0);
const add=(a,b)=>a.map((value,i)=>value+b[i]);
const scale=(p,n)=>p.map(v=>v*n);
const unit=p=>scale(p,1/(Math.hypot(...p)||1));
const LIGHT=unit([-.45,-.65,1]);
const colors=new Map();
const fullUV=[[0,0],[1,0],[1,1],[0,1]];

export function coverUV(sourceWidth,sourceHeight,width,height){
 const ratio=width*sourceHeight/(height*sourceWidth);
 const x=(1-Math.min(1,ratio))/2,y=(1-Math.min(1,1/ratio))/2;
 return [[x,y],[1-x,y],[1-x,1-y],[x,1-y]];
}

export function rgba(css){
 if(Array.isArray(css))return [css[0],css[1],css[2],css[3]??1];
 if(colors.has(css))return colors.get(css);
 let color;
 if(css[0]==='#'){
  let value=css.slice(1);if(value.length===3||value.length===4)value=[...value].map(x=>x+x).join('');
  color=[0,2,4,6].map(i=>value[i]?parseInt(value.slice(i,i+2),16)/255:1);
 }else{
  const parts=css.match(/[+-]?(?:\d*\.)?\d+/g)?.map(Number)||[];
  if(css.startsWith('hsl')){
   const [deg,sat,light,a]=parts,h=((deg%360)+360)%360/30,s=clamp(sat/100),l=clamp(light/100);
   const c=s*Math.min(l,1-l),hue=n=>l-c*Math.max(-1,Math.min((n+h)%12-3,9-(n+h)%12,1));
   color=[hue(0),hue(8),hue(4),a??1];
  }else color=[(parts[0]??255)/255,(parts[1]??255)/255,(parts[2]??255)/255,parts[3]??1];
 }
 // Animated particles produce continuously changing colors. Bound this cache.
 if(colors.size>625)colors.clear();
 colors.set(css,color);return color;
}

function rotate([x,y,z],{yaw=0,pitch=0,roll=0}){
 if(yaw){const c=Math.cos(yaw),s=Math.sin(yaw);[x,y]=[x*c-y*s,x*s+y*c]}
 if(pitch){const c=Math.cos(pitch),s=Math.sin(pitch);[y,z]=[y*c-z*s,y*s+z*c]}
 if(roll){const c=Math.cos(roll),s=Math.sin(roll);[x,z]=[x*c+z*s,z*c-x*s]}
 return [x,y,z];
}
const pointsAt=(x,y,z,options)=>point=>add([x,y,z],rotate(point,options));

function createStream(){
 let values=new Float32Array(8192),size=0;
 return {
  get data(){return values.subarray(0,size)},
  clear(){size=0},
  vertex(p,c,u=0,v=0){
   if(size+stride>values.length){const grown=new Float32Array(values.length*2);grown.set(values);values=grown}
   values[size++]=p[0];values[size++]=p[1];values[size++]=p[2];
   values[size++]=c[0];values[size++]=c[1];values[size++]=c[2];values[size++]=c[3];
   values[size++]=u;values[size++]=v;
  }
 };
}

export function createGeometry(){
 const opaque=createStream(),translucent=createStream(),pictures=[];
 let revision=0;
 function reset(){opaque.clear();translucent.clear();pictures.length=0;revision++}
 function surface(points,color,options={}){
  if(points.length<3)return;
  const rgbaColor=rgba(color),a=clamp((options.alpha??1)*rgbaColor[3]);
  if(a<.005)return;
  const normal=unit(cross(delta(points[1],points[0]),delta(points[2],points[0])));
  const light=options.light??(.53+.45*Math.abs(dot(normal,LIGHT)));
  const c=[clamp(rgbaColor[0]*light),clamp(rgbaColor[1]*light),clamp(rgbaColor[2]*light),a];
  const buffer=a>.995?opaque:translucent;
  for(let i=1;i<points.length-1;i++){
   buffer.vertex(points[0],c);buffer.vertex(points[i],c);buffer.vertex(points[i+1],c);
  }
 }
 function solid(v,color,options){
  for(const face of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){
   surface(face.map(i=>v[i]),color,options);
  }
 }
 function box(x,y,z,width,depth,height,color,options={}){
  const w=width/2,d=depth/2,h=height/2;
  const vertices=[[-w,-d,-h],[w,-d,-h],[w,d,-h],[-w,d,-h],[-w,-d,h],[w,-d,h],[w,d,h],[-w,d,h]].map(pointsAt(x,y,z,options));
  solid(vertices,color,options);
 }
 function pyramid(x,y,z,width,depth,height,color,options={}){
  const w=width/2,d=depth/2,h=height/2;
  const v=[[-w,-d,-h],[w,-d,-h],[w,d,-h],[-w,d,-h],[0,0,h]].map(pointsAt(x,y,z,options));
  surface(v.slice(0,4),color,options);
  for(let i=0;i<4;i++)surface([v[i],v[(i+1)%4],v[4]],color,options);
 }
 function ring(x,y,z,radius,inner,height,color,options={}){
  if(radius<=0||height<=0)return;
  const n=Math.max(6,Math.min(48,options.segments||16)),p=pointsAt(x,y,z,options),top=[],edge=[];
  for(let i=0;i<=n;i++){
   const a=i*TAU/n,c=Math.cos(a),s=Math.sin(a),r=radius*(options.teeth&&i%2?.74:1),h=height/2;
   top.push([p([c*r,s*r,h]),p([c*inner,s*inner,h])]);
   edge.push([p([c*r,s*r,-h]),p([c*inner,s*inner,-h])]);
  }
  for(let i=0;i<n;i++){
   const [a,b]=top[i],[c,d]=top[i+1],[e,f]=edge[i],[g,h]=edge[i+1];
   surface([a,c,d,b],color,options);surface([e,g,c,a],color,options);
   if(inner>0)surface([b,d,h,f],color,options);
   surface([e,f,h,g],color,options);
  }
 }
 function beam(from,to,width,color,options={}){
  if(width<=0)return;
  const axis=unit(delta(to,from));
  if(dot(axis,axis)<.7)return;
  const normal=scale(unit(cross(axis,Math.abs(axis[2])>.91?[0,1,0]:[0,0,1])),width/2);
  const up=scale(unit(cross(normal,axis)),width/2);
  const ends=center=>[add(add(center,normal),up),add(add(center,scale(normal,-1)),up),
   add(add(center,scale(normal,-1)),scale(up,-1)),add(add(center,normal),scale(up,-1))];
  solid([...ends(from),...ends(to)],color,options);
 }
 function picture(projection,points,color='#ffffff',uv=fullUV){
  if(projection)pictures.push({projection,points,color:rgba(color),uv});
 }
 return {reset,box,pyramid,ring,beam,surface,picture,opaque,translucent,pictures,get revision(){return revision}};
}

export function orientation(pitch=0,yaw=0,zoom=1){
 const rx=unit([Math.cos(yaw),0,Math.sin(yaw)]),p=Math.cos(pitch),s=Math.sin(pitch);
 const ry=[s*Math.sin(yaw),p,-s*Math.cos(yaw)],rz=[-p*Math.sin(yaw),s,p*Math.cos(yaw)];
 return {right:scale(rx,zoom),down:scale(ry,zoom),depth:scale(rz,zoom)};
}
export function cssOrientation(matrix){
 return {right:[matrix.m11,matrix.m21,matrix.m31],down:[matrix.m12,matrix.m22,matrix.m32],depth:[matrix.m13,matrix.m23,matrix.m33]};
}

// Project world-space CSS pixels with the same optical center as the card controls.
export function viewMatrix({width,height,origin,center,vanish,lens,rot}){
 const {right,down,depth}=rot;
 const coefficients=axis=>[...axis,-dot(axis,origin)];
 const rx=coefficients(right),ry=coefficients(down),rz=coefficients(depth);
 const w=rz.map((n,i)=>(i===3?1:0)-n/lens);
 const x=rx.map((n,i)=>(2*vanish[0]/width-1)*w[i]+2*(n+(i===3?center[0]-vanish[0]:0))/width);
 const y=ry.map((n,i)=>(1-2*vanish[1]/height)*w[i]-2*(n+(i===3?center[1]-vanish[1]:0))/height);
 const z=rz.map(n=>-.54*n/lens);
 return new Float32Array(w.flatMap((n,i)=>[x[i],y[i],z[i],n]));
}

const vertexShader=`
attribute vec3 inPosition;
attribute vec4 inColor;
attribute vec2 inUV;
uniform mat4 perspective;
varying vec4 color;
varying vec2 uv;
void main() {
 gl_Position=perspective*vec4(inPosition,1.0);
 color=inColor;
 uv=inUV;
}
`;
const fragmentShader=`
precision mediump float;
varying vec4 color;
varying vec2 uv;
uniform sampler2D photo;
uniform bool hasPhoto;
void main() {
 vec4 shade=hasPhoto?texture2D(photo,uv)*color:color;
 if(shade.a<0.008)discard;
 gl_FragColor=shade;
}
`;
function programOf(gl){
 function compile(type,code){
  const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);
  if(gl.getShaderParameter(s,gl.COMPILE_STATUS))return s;
  const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error||'WebGL shader failed.');
 }
 const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertexShader),fs=compile(gl.FRAGMENT_SHADER,fragmentShader);
 gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
 if(gl.getProgramParameter(program,gl.LINK_STATUS))return program;
 const error=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw Error(error||'WebGL program failed.');
}

function webGLRendererFor(canvas){
 let gl,program;
 try{
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:true,powerPreference:'low-power'});
  if(!gl)return null;
  program=programOf(gl);
 }catch{return null}
 gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
 gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 const attrs=[['inPosition',3,0],['inColor',4,3],['inUV',2,7]].map(([name,size,offset])=>[gl.getAttribLocation(program,name),size,offset]);
 const perspective=gl.getUniformLocation(program,'perspective'),hasPhoto=gl.getUniformLocation(program,'hasPhoto');
 gl.uniform1i(gl.getUniformLocation(program,'photo'),0);
 const caches=new WeakMap(),buffers=new Set(),textures=new Map(),invalid=new Set();
 const pictureBuffer=gl.createBuffer(),quad=new Float32Array(6*stride);
 const white=gl.createTexture();
 gl.bindTexture(gl.TEXTURE_2D,white);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
 let disposed=false;

 function bind(buffer){
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  for(const [index,size,offset] of attrs){
   gl.enableVertexAttribArray(index);
   gl.vertexAttribPointer(index,size,gl.FLOAT,false,stride*4,offset*4);
  }
 }
 function imageTexture(img){
  const canvasSource=typeof img?.getContext==='function';
  if(canvasSource?!img.width||!img.height:!img?.complete||!img.naturalWidth)return null;
  const key=canvasSource?img:img.currentSrc||img.src;
  if(invalid.has(key))return null;
  const was=textures.get(key);if(was)return was;
  const texture=gl.createTexture();
  try{
   gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }catch{gl.deleteTexture(texture);invalid.add(key);return null}
  if(textures.size>=72){
   const oldest=textures.keys().next().value;gl.deleteTexture(textures.get(oldest));textures.delete(oldest);
  }
  textures.set(key,texture);return texture;
 }
 function geometryStream(mesh,which){
  const stream=mesh[which],data=stream.data;
  if(!data.length)return;
  let cached=caches.get(stream);
  if(!cached){const buffer=gl.createBuffer();buffers.add(buffer);cached={buffer,revision:-1};caches.set(stream,cached)}
  bind(cached.buffer);
  if(cached.revision!==mesh.revision){gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);cached.revision=mesh.revision}
  gl.drawArrays(gl.TRIANGLES,0,data.length/stride);
 }
 function textureFace(item){
  const {projection,points,color,uv}=item;
  const ids=[0,1,2,0,2,3];
  for(let i=0;i<6;i++){
   const at=i*stride,k=ids[i];quad.set(points[k],at);quad.set(color,at+3);quad.set(uv[k],at+7);
  }
  gl.bindTexture(gl.TEXTURE_2D,projection);
  gl.bufferData(gl.ARRAY_BUFFER,quad,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,6);
 }
 function render(matrix,meshes,clear=[0,0,0,0],floor,actor){
  if(disposed||gl.isContextLost())return false;
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clearColor(...clear);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(perspective,false,matrix);
  gl.bindTexture(gl.TEXTURE_2D,white);
  gl.uniform1i(hasPhoto,0);
  for(const mesh of meshes)geometryStream(mesh,'opaque');
  if(actor){
   gl.uniformMatrix4fv(perspective,false,actor.matrix);
   geometryStream(actor.mesh,'opaque');
   gl.uniformMatrix4fv(perspective,false,matrix);
  }
  gl.uniform1i(hasPhoto,1);bind(pictureBuffer);
  for(const mesh of meshes)for(const item of mesh.pictures)if(item.color[3]>=.995)textureFace(item);
  gl.depthMask(false);gl.uniform1i(hasPhoto,0);
  for(const mesh of meshes)geometryStream(mesh,'translucent');
  gl.uniform1i(hasPhoto,1);bind(pictureBuffer);
  for(const mesh of meshes)for(const item of mesh.pictures)if(item.color[3]<.995)textureFace(item);
  gl.depthMask(true);
  return true;
 }
 function dispose(releaseContext=false){
  if(disposed)return;disposed=true;
  buffers.forEach(b=>gl.deleteBuffer(b));gl.deleteBuffer(pictureBuffer);
  textures.forEach(t=>gl.deleteTexture(t));gl.deleteTexture(white);gl.deleteProgram(program);
  if(releaseContext&&!gl.isContextLost())gl.getExtension('WEBGL_lose_context')?.loseContext();
 }
 canvas.dataset.renderer='webgl';
 return {canvas,kind:'webgl',render,imageTexture,dispose};
}

export function rendererFor(canvas){
 return webGLRendererFor(canvas)||softwareRendererFor(canvas);
}
