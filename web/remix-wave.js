const defaultColor='#65f6e1';
const accents=new Map();

function accent(color){
 if(!accents.has(color)){
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  const light=rgb[0]*.21+rgb[1]*.72+rgb[2]*.07>198?24:255;
  const value=rgb.map(channel=>Math.round(channel*.58+light*.42).toString(16).padStart(2,'0'));
  accents.set(color,'#'+value.join(''));
 }
 return accents.get(color);
}

export const waveRise=(speed,held,mini=false)=>(held?-1:1)*speed*(mini?2:1);

export function keepWavePoint(points,x,y,screenX){
 const tip=points.at(-1),corner=points.at(-2);
 if(tip?.[0]===x&&tip[1]===y)return;
 const straight=corner&&tip[0]>corner[0]&&x>tip[0]&&
  Math.abs((tip[1]-corner[1])*(x-tip[0])-(y-tip[1])*(tip[0]-corner[0]))<.00001;
 if(straight)points[points.length-1]=[x,y];
 else points.push([x,y]);
 // Keep the segment that crosses the left edge, including when it spans several frames.
 const offscreen=x-screenX-30;
 while(points.length>2&&points[1][0]<offscreen)points.shift();
}

function polygon(ctx,points,color){
 ctx.beginPath();ctx.moveTo(...points[0]);
 for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);
 ctx.closePath();ctx.fillStyle=color;ctx.fill();
}

export function drawWave(ctx,{x,y,angle=0,mini=false,skin,scale=1}){
 const primary=skin?.color??defaultColor,secondary=skin?.secondaryColor??accent(primary);
 const size=scale*(mini?.62:1);
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size,size);
 polygon(ctx,[[-5,-10],[-21,-12],[-16,0],[-21,12],[-5,10],[1,0]],'#071120');
 polygon(ctx,[[-7,-7],[-17,-8],[-13,0],[-17,8],[-7,7],[-2,0]],secondary);
 polygon(ctx,[[23,0],[-12,17],[-17,16],[-10,0],[-17,-16],[-12,-17]],'#071120');
 polygon(ctx,[[18,0],[-11,13],[-6,0],[-11,-13]],primary);
 polygon(ctx,[[18,0],[-11,-13],[-8,-7],[1,-3]],secondary);
 ctx.restore();
}

export function drawWaveTrail(ctx,points,{skin,mini=false,faded=false,scale=1}={}){
 if(points.length<2)return;
 const primary=skin?.color??defaultColor,secondary=skin?.secondaryColor??accent(primary);
 const width=scale*(mini?6:10);
 const start=points[0][0],length=points.at(-1)[0]-start;
 function ink(color){
  if(start<0||length<=0)return color;
  const fade=ctx.createLinearGradient(start,0,start+Math.min(52*scale,length*.62),0);
  fade.addColorStop(0,'transparent');fade.addColorStop(1,color);
  return fade;
 }
 ctx.save();ctx.globalAlpha*=faded?.42:1;
 ctx.lineCap='square';ctx.lineJoin='miter';ctx.miterLimit=3;
 ctx.beginPath();ctx.moveTo(...points[0]);
 for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);
 ctx.strokeStyle=ink(primary);ctx.lineWidth=width;ctx.stroke();
 ctx.strokeStyle=ink(secondary);ctx.lineWidth=width*.45;ctx.stroke();
 ctx.restore();
}
