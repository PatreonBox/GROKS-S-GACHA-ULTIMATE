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

function polygon(ctx,points,color){
 ctx.beginPath();ctx.moveTo(...points[0]);
 for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);
 ctx.closePath();ctx.fillStyle=color;ctx.fill();
}

export function drawWave(ctx,{x,y,angle=0,mini=false,skin,scale=1}){
 const primary=skin?.color??defaultColor,secondary=skin?.secondaryColor??accent(primary);
 const size=scale*(mini?.62:1);
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size,size);
 polygon(ctx,[[16,0],[1,11],[-6,11],[-4,6],[-14,7],[-10,0],[-14,-7],[-4,-6],[-6,-11],[1,-11]],'#0a1729');
 polygon(ctx,[[12,0],[0,8],[-2,8],[0,4],[-10,5],[-7,0],[-10,-5],[0,-4],[-2,-8],[0,-8]],primary);
 polygon(ctx,[[9,0],[0,4],[2,0],[0,-4]],secondary);
 polygon(ctx,[[-3,0],[-5,2],[-7,0],[-5,-2]],secondary);
 ctx.restore();
}

export function drawWaveTrail(ctx,points,{skin,mini=false,faded=false,scale=1}={}){
 if(points.length<2)return;
 const primary=skin?.color??defaultColor,secondary=skin?.secondaryColor??accent(primary);
 const width=scale*(mini?5.5:9);
 ctx.save();ctx.globalAlpha*=faded?.42:1;
 ctx.lineCap='square';ctx.lineJoin='miter';ctx.miterLimit=3;
 ctx.beginPath();ctx.moveTo(...points[0]);
 for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);
 ctx.strokeStyle=primary;ctx.lineWidth=width;ctx.stroke();
 ctx.strokeStyle=secondary;ctx.lineWidth=width*.45;ctx.stroke();
 ctx.restore();
}
