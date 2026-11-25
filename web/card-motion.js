export function impactImpulse(from,to,width,side,damageShare,heavy,blocked){
 const x=to.x-(from?.x??to.x),y=from?to.y-from.y:side==='enemies'?-1:1;
 const length=Math.hypot(x,y)||1;
 const force=blocked?.30:Math.min(1.25,.52+damageShare*.8+(heavy?.33:0));
 const reach=Math.min(51,width*.32)*force,twist=Math.abs(x)>.01?Math.sign(x):side==='enemies'?-1:1;
 return {x:x/length*reach,y:y/length*reach,force,twist,blocked};
}

export function recoilFrames(impact,rest){
 const {x,y,force,twist,blocked}=impact;
 const frames=Array.from({length:9},(_,index)=>{
  const t=index/8,spring=1.87*Math.exp(-4.3*t)*Math.sin(3.55*Math.PI*t);
  const bump=Math.max(0,spring),squash=bump*(blocked?.055:.15)*force;
  return {
   offset:t,
   transform:'translate3d('+x*spring+'px,'+y*spring+'px,'+bump*26*force+'px) '+
    rest+' rotateX('+(-y*spring*.65)+'deg) rotateZ('+twist*spring*(blocked?7:19)+'deg) scale('+(1+squash*.62)+','+(1-squash)+')'
  };
 });
 frames[0]={offset:0,transform:rest};
 frames[8]={offset:1,transform:rest};
 return frames;
}

export function tumbleFrames(impact,rest){
 const {x,y,twist,force}=impact;
 const t=(distance,lift,pitch,roll,sx,sy)=>
  'translate3d('+distance*x+'px,'+distance*y+'px,'+lift+'px) '+rest+
  ' rotateX('+pitch+'deg) rotateZ('+twist*roll+'deg) scale('+sx+','+sy+')';
 const kick=26+19*force;
 return [
  {transform:rest,opacity:1},
  {offset:.19,transform:t(.63,kick*.70,18,24,1.06,.90),opacity:1},
  {offset:.47,transform:t(1.15,kick,-128,69,.99,1),opacity:1},
  {offset:.68,transform:t(.78,4,-282,34,1.12,.77),opacity:.86},
  {offset:.82,transform:t(.37,18,-341,13,.94,1.10),opacity:.70},
  {transform:t(0,0,-360,0,1,1),opacity:.62}
 ];
}
