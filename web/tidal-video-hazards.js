const tau=Math.PI*2;
const sawPoints=Array.from({length:40},(_,i)=>{
 const angle=i*tau/40;
 const radius=[1,1,.72,.67][i%4];
 return [Math.cos(angle)*radius,Math.sin(angle)*radius];
});
const blockPoints=[[-.76,-1],[.76,-1],[1,-.64],[1,.64],[.76,1],[-.76,1],[-1,.64],[-1,-.64]];
const spikePoints=[[-1,1],[0,-1],[1,1]];

const block=(x,y,width,height)=>({x,y,kind:'block',points:blockPoints.map(([u,v])=>[u*width/2,v*height/2]),reach:width/2});
const spike=(x,y,width,height,down=false)=>({x,y,kind:'spike',points:spikePoints.map(([u,v])=>[u*width/2,v*height/2*(down?-1:1)]),reach:width/2});
const saw=(x,y,radius,swing=0)=>({x,y,kind:'saw',points:sawPoints.map(([u,v])=>[u*radius,v*radius]),reach:radius,swing});

// An independent course in world units. The camera only supplies the horizontal scroll.
export const tidalHazards=Object.freeze([
 spike(635,359,125,116),
 block(1180,145,144,118),
 saw(1740,346,51,25),
 block(2270,235,142,122),
 spike(2700,332,160,134),
 spike(3230,168,162,132,true),
 saw(3700,275,49,36),
 block(4335,124,192,138),block(4370,385,146,124),
 saw(4860,198,58,46),
 spike(5340,340,160,140),
 block(5870,242,174,118),
 spike(6350,164,174,144,true),
 saw(6900,339,61,36),
 block(7460,142,154,130),block(7460,386,164,106),
 spike(7990,286,176,130),
 saw(8500,148,55,24),
 block(9040,332,193,134),
 saw(9600,232,55,48),
 spike(10130,154,176,154,true),spike(10155,362,172,117),
 block(10660,295,185,115),
 saw(11110,144,46,35),
 saw(11550,338,50,28),
 spike(12110,232,169,134,true),
 block(12670,144,167,133),
 saw(13180,307,64,42),
 spike(13720,175,156,144,true),spike(13760,377,160,120),
 block(14280,266,174,112),
 saw(14780,143,52,33),
 spike(15255,347,171,143),
 saw(15785,259,58,41),
 block(16315,153,161,123),
 spike(16820,351,176,145),
 block(17355,238,182,132),
 saw(17870,366,48,28),saw(17870,125,48,25),
 spike(18405,184,178,151,true),
 saw(18970,276,63,42),
 block(19530,113,173,138),block(19555,393,153,118),
]);

function sway(hazard,time){
 return hazard.swing?Math.sin(time*3.1+hazard.x*.008)*hazard.swing:0;
}

function spin(hazard,time){
 return hazard.kind==='saw'?time*3.5+hazard.x*.013:0;
}

function circleHits(points,x,y,radius){
 const limit=radius*radius;
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [ax,ay]=points[j],[bx,by]=points[i];
  const dx=bx-ax,dy=by-ay;
  const projection=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
  if((x-ax-dx*projection)**2+(y-ay-dy*projection)**2<=limit)return true;
  if((ay>y)!==(by>y)&&x<ax+dx*(y-ay)/dy)inside=!inside;
 }
 return inside;
}

export function hitsTidalHazard(distance,time,runnerY,radius){
 for(const hazard of tidalHazards){
  const dx=distance-hazard.x;
  if(Math.abs(dx)>hazard.reach+radius)continue;
  const dy=runnerY-hazard.y-sway(hazard,time);
  if(hazard.kind!=='saw'){
   if(circleHits(hazard.points,dx,dy,radius))return true;
   continue;
  }
  if(dx*dx+dy*dy>(hazard.reach+radius)**2)continue;
  const angle=spin(hazard,time),cos=Math.cos(angle),sin=Math.sin(angle);
  if(circleHits(hazard.points,dx*cos+dy*sin,dy*cos-dx*sin,radius))return true;
 }
 return false;
}

function outline(ctx,points,scale=1){
 ctx.beginPath();ctx.moveTo(points[0][0]*scale,points[0][1]*scale);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0]*scale,points[i][1]*scale);
 ctx.closePath();
}

export function drawTidalHazards(ctx,distance,time,runnerX,width){
 for(const hazard of tidalHazards){
  const x=runnerX+hazard.x-distance;
  if(x<-hazard.reach-20||x>width+hazard.reach+20)continue;
  ctx.save();ctx.translate(x,hazard.y+sway(hazard,time));ctx.rotate(spin(hazard,time));
  const gradient=ctx.createLinearGradient(-hazard.reach,-hazard.reach,hazard.reach,hazard.reach);
  gradient.addColorStop(0,'#48234c');gradient.addColorStop(.48,'#231732');gradient.addColorStop(1,'#120e26');
  outline(ctx,hazard.points);
  ctx.fillStyle=gradient;ctx.shadowColor='#ff884e';ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;
  ctx.clip();
  ctx.strokeStyle='#ffbb83';ctx.lineWidth=5;ctx.stroke();
  outline(ctx,hazard.points,.78);ctx.strokeStyle='#c96a83';ctx.lineWidth=1.4;ctx.stroke();
  if(hazard.kind==='saw'){
   ctx.beginPath();ctx.arc(0,0,hazard.reach*.27,0,tau);ctx.fillStyle='#ffc896';ctx.fill();
   ctx.beginPath();ctx.arc(0,0,hazard.reach*.16,0,tau);ctx.fillStyle='#291a31';ctx.fill();
  }else{
   const length=hazard.reach*.2;
   outline(ctx,[[0,-length],[length,0],[0,length],[-length,0]]);
   ctx.fillStyle='#ff9c68';ctx.fill();
  }
  ctx.restore();
 }
}
