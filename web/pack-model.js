import {impossibleCategory} from './impossible-cards.js';

export const packArt=pack=>'/assets/packs/'+pack.id+'.png';
export function cardFace(category){
 if(category===impossibleCategory)return '/assets/impossible/mark.webp';
 const file=category.endsWith(' Demon')?'demon-'+category.split(' ')[0]:category;
 return '/assets/faces/'+file.toLowerCase()+'.webp';
}

const haloEdges=Array.from({length:16},(_,index)=>{
 const angle=index*22.5;
 const highlight=(1+Math.cos((angle+32)*Math.PI/180))/2;
 const light=Math.round(41+highlight*35);
 return '<i class="halo-edge" style="--facet:'+angle+'deg;--gold:hsl(38 86% '+light+'%)"></i>';
}).join('');
const halo='<span class="pack-halo"><span class="halo-wheel"><i class="halo-face halo-top"></i><i class="halo-face halo-under"></i>'+haloEdges+'</span></span>';
export function wrapper(pack,numberOfCards=5,category='Auto'){
 const emblem=packArt(pack);
 const finish=pack.id==='mythic'?'<span class="ruby-spectrum"></span>':'';
 return '<span aria-hidden="true" class="foil-pack model-'+pack.id+'" style="--foil:'+pack.color+';--ink:'+pack.dark+'">'+
  '<span class="foil-side side-left"></span><span class="foil-side side-right"></span><span class="foil-end end-top"></span><span class="foil-end end-bottom"></span>'+
  '<span class="foil-back"><span class="back-brand">GD KINGDOM</span><span class="back-emblem"><img src="'+emblem+'" alt=""></span><b>'+pack.name+'</b><span class="back-rule"></span><span class="back-bars"></span></span>'+
  (pack.id==='godly'?halo:'')+
  '<span class="foil-front"><span class="foil-base">'+finish+'<span class="foil-brand">GD KINGDOM</span>'+
  '<span class="foil-graphic"><span class="foil-window"></span><span class="foil-ring"></span><img class="foil-emblem" src="'+cardFace(category)+'" alt=""></span>'+
  '<span class="foil-labels"><b class="foil-title">'+pack.name+'</b><small class="foil-count">'+numberOfCards+' Cards</small></span>'+
  '<span class="foil-bottom"></span></span><span class="foil-seal"></span></span></span>';
}

// The pack has a printable back and four folded edges, so a full turn stays visible.
export function bindTurntable(stage,item='pack'){
 const model=stage.querySelector('.package-float'),handle=stage.querySelector('.turn-handle');
 let yaw=-15,pitch=6,active=null,startX,startY,startYaw,startPitch;
 function rotate(horizontal,vertical){
  yaw=horizontal;pitch=Math.max(-85,Math.min(85,vertical));
  model.style.setProperty('--yaw',yaw+'deg');model.style.setProperty('--pitch',pitch+'deg');
  const angle=((Math.round(yaw)%360)+360)%360;
  const reflection=Math.sin((yaw+pitch*.55)*Math.PI/180);
  model.style.setProperty('--foil-reflection',(reflection*20).toFixed(1)+'%');
  handle.setAttribute('aria-label','Rotate '+item+'. Horizontal angle '+angle+' degrees. Use arrow keys or drag.');
 }
 function reset(){rotate(-15,6)}
 handle.onpointerdown=e=>{
  if(active!==null||e.button!==0)return;
  active=e.pointerId;startX=e.clientX;startY=e.clientY;startYaw=yaw;startPitch=pitch;
  handle.setPointerCapture(active);stage.classList.add('dragging');
 };
 handle.onpointermove=e=>{
  if(e.pointerId!==active)return;
  rotate(startYaw+(e.clientX-startX)*.75,startPitch-(e.clientY-startY)*.58);
 };
 handle.onlostpointercapture=()=>{active=null;stage.classList.remove('dragging')};
 handle.onpointerup=handle.onpointercancel=e=>{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId)};
 handle.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
  e.preventDefault();
  if(e.key==='Home')reset();
  else rotate(yaw+(e.key==='ArrowRight'?15:e.key==='ArrowLeft'?-15:0),pitch+(e.key==='ArrowDown'?-10:e.key==='ArrowUp'?10:0));
 };
 stage.querySelector('[data-reset-view]').onclick=reset;
 reset();
}
