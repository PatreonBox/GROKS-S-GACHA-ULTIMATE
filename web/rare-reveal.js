import {ico} from './icons.js';

export const rareTiers=[
 {n:5000,name:'First light',effect:'slit',ink:'#9beaff',flare:'#147eef',hit:840,ms:2050},
 {n:20000,name:'Prism break',effect:'prism',ink:'#e9b1ff',flare:'#9151ff',hit:1060,ms:2400},
 {n:100000,name:'Starfall',effect:'starfall',ink:'#ffe5ac',flare:'#ef6faa',hit:1390,ms:2840},
 {n:500000,name:'Eclipse',effect:'eclipse',ink:'#ffa6bb',flare:'#f42682',hit:2000,ms:3600},
 {n:1000000,name:'Singularity',effect:'singularity',ink:'#a9f3ff',flare:'#6d5dff',hit:2500,ms:4350},
 {n:10000000,name:'Event horizon',effect:'horizon',ink:'#fff1b9',flare:'#7b69ff',hit:3140,ms:5440}
];
export function revealTier(percent){
 if(!(percent>0&&Number.isFinite(percent)))return null;
 for(let i=rareTiers.length-1;i>=0;i--)if(percent<=100/rareTiers[i].n)return rareTiers[i];
 return null;
}

const clamp=(n,lo=0,hi=1)=>Math.min(hi,Math.max(lo,n));
const tau=Math.PI*2;
const tint=(hex,alpha)=>hex+Math.round(clamp(alpha)*255).toString(16).padStart(2,'0');
const entrances=[
 [0,72,-160,12,180,0,.68],
 [-110,55,-230,27,218,-24,.64],
 [140,-120,-280,42,224,27,.70],
 [0,75,-480,67,192,0,.72],
 [-70,-24,-340,46,247,-23,.54],
 [0,5,-650,-64,253,71,.55]
];

function pose(x,y,z,rx,ry,rz,scale){
 return `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`;
}

function windowEffects(canvas,tier){
 const ctx=canvas.getContext('2d'),rank=rareTiers.indexOf(tier),stars=[];
 if(!ctx)return ()=>{};
 let seed=384077+rank;
 const next=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/0x100000000);
 for(let i=0;i<40+rank*24;i++)stars.push([next(),next(),next(),next()]);
 const size={w:0,h:0};
 function path(points,fill,stroke,width=1){
  ctx.beginPath();for(const [i,[x,y]] of points.entries()){if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)}
  if(fill){ctx.fillStyle=fill;ctx.fill()}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}
 }
 function oval(x,y,r,s,angle,color,width=1){
  ctx.beginPath();ctx.ellipse(x,y,Math.max(1,r),Math.max(1,s),angle,0,tau);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
 }
 function polygon(x,y,r,edges,rotation,ink){
  const pts=Array.from({length:edges+1},(_,i)=>{
   const a=i*tau/edges+rotation;
   return [x+Math.cos(a)*r,y+Math.sin(a)*r];
  });
  path(pts,null,ink);
 }
 return age=>{
  const {clientWidth:w,clientHeight:h}=canvas,dpr=Math.min(1.75,devicePixelRatio||1);
  if(!w||!h)return;
  if(size.w!==w||size.h!==h||size.dpr!==dpr){
   size.w=w;size.h=h;size.dpr=dpr;
   canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  ctx.clearRect(0,0,w,h);
  const x=w/2,y=h*.50,short=Math.min(w,h),p=clamp(age/tier.hit),after=Math.max(0,age-tier.hit);
  const pulse=after?Math.exp(-after/660):0,scale=1+after/2400;
  const glow=ctx.createRadialGradient(x,y,short*.015,x,y,short*.55);
  glow.addColorStop(0,tint(tier.flare,(p*.16+(.24+rank*.016)*pulse)));
  glow.addColorStop(.5,tint(tier.flare,(p*.075+.115*pulse)));
  glow.addColorStop(1,tint(tier.flare,0));
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  if(rank===0){
   const slit=short*(.01+.51*p**2)*scale;
   path([[x-slit,y],[x+slit,y]],null,tint(tier.ink,p*.70),1.6+pulse);
   path([[x,y-slit*.66],[x,y+slit*.66]],null,tint(tier.flare,p*.45),1);
  }else if(rank===1){
   for(let i=0;i<6;i++)polygon(x,y,short*(.06+i*.047)*p*scale,3,i*.55+age/1900,tint(i%2?tier.ink:tier.flare,p*(.60-i*.054)));
  }else if(rank===2){
   for(let i=0;i<11;i++){
    const a=i*tau/11+age/2900,r=short*(.07+p*.29)*scale;
    path([[x+Math.cos(a)*r,y+Math.sin(a)*r],[x+Math.cos(a+.25)*r*.81,y+Math.sin(a+.25)*r*.81],
     [x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.55]],null,tint(tier.ink,p*(.48+.39*pulse)),1.2);
   }
   polygon(x,y,short*(.19+p*.11)*scale,5,-age/3500,tint(tier.flare,.55*p));
  }else{
   const eclipse=short*(.1+.22*p)*scale;
   const count=rank===3?3:rank===4?7:11;
   ctx.fillStyle=tint('#000000',.83*p);
   ctx.beginPath();ctx.arc(x,y,eclipse*.55,0,tau);ctx.fill();
   for(let i=0;i<count;i++){
    const r=eclipse*(.73+i*.087),f=rank===3?.94:.36+(i%3)*.13;
    const slope=rank===3?0:((i%2)?-.62:.58)+age*(rank>=5?.00042:.00029);
    oval(x,y,r,r*f,slope,tint(i%2?tier.flare:tier.ink,p*(.57-i*.028)+pulse*.25),1.1+pulse*2);
   }
   if(after&&after<1200){
    const rings=rank-1;
    for(let i=0;i<rings;i++){
     const wave=clamp((after-i*95)/1000),alpha=Math.sin(wave*Math.PI)*(1-wave)*.49;
     if(alpha>0)oval(x,y,short*(.095+wave*.66),short*(.08+wave*.56),-.12,tint(tier.ink,alpha),1.4+pulse*3);
    }
   }
   if(rank===5){
    const stretch=short*.71*p*scale;
    path([[x-stretch,y+.36*stretch],[x,y],[x+stretch,y-.36*stretch]],null,tint(tier.ink,p*.69+pulse*.24),2+3*pulse);
    for(let i=0;i<9;i++)polygon(x,y,eclipse*(1.3+i*.085),4,i*.17-age/6500,tint(tier.flare,(.35-i*.024)*p));
   }
  }
  for(const [pos,size,feed,spin] of stars){
   const a=pos*tau+age*.00012*(rank+1)*(spin-.4),near=short*(.03+size*.53);
   const r=after?near*(.25+after/900*(.33+feed*.35)):near*(1.35-p*.83);
   const tail=rank>=2?(3+feed*13)*(p+pulse)*.8:2.25;
   const dx=Math.cos(a),dy=Math.sin(a);
   const cx=x+dx*r*(rank>=4?1.34:1.05),cy=y+dy*r;
   path([[cx,cy],[cx-dx*tail,cy-dy*tail]],null,tint(feed>.45?tier.ink:tier.flare,p*(.14+feed*.59)),.7+size*(rank/3));
  }
  if(after>0&&after<1300){
   const burst=after/1300,reach=1-(1-burst)**2,alpha=(1-burst)**2;
   const wave=short*(.14+reach*(.36+rank*.044));
   oval(x,y,wave*1.48,wave*.76,-.16,tint(tier.ink,alpha*.65),.8+alpha*2);
   for(let i=0;i<20+rank*12;i++){
    const [pos,size,feed,spin]=stars[i],angle=pos*tau;
    const dx=Math.cos(angle),dy=Math.sin(angle);
    const distance=short*(.05+reach*(.24+size*.58));
    const cx=x+dx*distance*1.46,cy=y+dy*distance+short*burst*burst*.19;
    const chip=(3+feed*(8+rank*1.7))*(1-burst*.64),tilt=angle+spin*burst*12;
    const c=Math.cos(tilt)*chip,s=Math.sin(tilt)*chip;
    path([[cx+c,cy+s],[cx-s*.47,cy+c*.47],[cx-c*.56,cy-s*.56],[cx+s*.52,cy-c*.52]],
     tint(feed>.47?tier.ink:tier.flare,alpha*(.55+size*.4)),null);
   }
  }
 };
}

export function playRareReveal({tier,cardHTML,title,odds,oddsLabel,sound,toggleSound,observeArt,hold=false,skipAll}){
 const effect=rareTiers.indexOf(tier),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const dialog=document.createElement('dialog'),prior=document.activeElement;
 dialog.className='rare-reveal';dialog.dataset.effect=tier.effect;
 dialog.setAttribute('aria-label','Rare card reveal');
 dialog.style.setProperty('--rarity',tier.ink);dialog.style.setProperty('--flare',tier.flare);
 dialog.style.setProperty('--charge',tier.hit+'ms');
 dialog.innerHTML='<div class="rare-sky" aria-hidden="true"><img alt="" class="rare-hero"></div><canvas aria-hidden="true"></canvas>'+
  '<div class="rare-head" aria-hidden="true"><span>'+tier.name+'</span><strong>'+odds+'</strong><small>'+oddsLabel+' · per card</small></div>'+
  '<div class="rare-stage" aria-hidden="true" inert><div class="rare-deck"><i class="rare-edge"></i><div class="rare-back">'+
  '<span class="rare-crest"><img src="/assets/player-cube.png" alt=""></span></div><div class="rare-front">'+cardHTML+'</div></div></div>'+
  '<p class="rare-live" role="status" aria-live="polite"></p><div class="rare-controls">'+
  (skipAll?'<button type="button" class="outline" data-rare-all>Skip opening</button>':'')+
  '<button type="button" class="outline" data-rare-mute aria-label="Pack sounds" aria-pressed="'+sound.enabled+'">'+ico(sound.enabled?'volume':'muted')+'</button>'+
  '<button type="button" class="primary" data-rare-close>'+ (reduce?'Continue':'Skip reveal') +'</button></div>';
 const deck=dialog.querySelector('.rare-deck'),button=dialog.querySelector('[data-rare-close]'),announce=dialog.querySelector('.rare-live');
 const art=deck.querySelector('.scene-shot'),hero=dialog.querySelector('.rare-hero');
 const setBackdrop=()=>{hero.src=art.currentSrc||art.src};
 hero.addEventListener('load',()=>hero.classList.add('ready'),{once:true});
 if(art?.complete&&art.naturalWidth)setBackdrop();
 else art?.addEventListener('load',setBackdrop,{once:true});
 const draw=windowEffects(dialog.querySelector('canvas'),tier);
 let frame=0,impact=0,end=0,closed=false,resolve;
 const done=new Promise(r=>{resolve=r});
 function close(){
  if(closed)return;closed=true;
  cancelAnimationFrame(frame);clearTimeout(impact);clearTimeout(end);sound.stopScore();
  document.removeEventListener('visibilitychange',hidden);
  if(dialog.open)dialog.close();
  dialog.remove();
  if(prior?.isConnected)prior.focus({preventScroll:true});
  resolve();
 }
 function hidden(){if(document.hidden)close()}
 function reveal(){
  if(closed||dialog.dataset.revealed)return;
  dialog.dataset.revealed='true';button.textContent='Continue';announce.textContent=title+' · '+odds;
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 dialog.addEventListener('close',close);
 dialog.querySelector('[data-rare-mute]').onclick=e=>{
  toggleSound();e.currentTarget.setAttribute('aria-pressed',String(sound.enabled));
  e.currentTarget.innerHTML=ico(sound.enabled?'volume':'muted');
 };
 button.onclick=close;
 const all=dialog.querySelector('[data-rare-all]');
 if(all)all.onclick=()=>{all.hidden=true;button.focus({preventScroll:true});skipAll()};
 observeArt?.(dialog);
 document.addEventListener('visibilitychange',hidden);
 document.body.append(dialog);dialog.showModal();button.focus({preventScroll:true});
 if(reduce||!deck.animate){
  deck.style.transform='none';draw(tier.hit+600);reveal();sound.play('results');
  if(!hold)end=setTimeout(close,1750);
  return {done,close};
 }
 const turnSpan=245+effect*27,tilt=effect%2?-1:1;
 deck.animate([
  {opacity:0,transform:pose(...entrances[effect]),easing:'cubic-bezier(.2,.72,.28,1)'},
  {offset:(tier.hit-200)/tier.ms,opacity:1,transform:pose(0,0,-35,8,170,tilt*6,.90),easing:'cubic-bezier(.56,0,.94,.55)'},
  {offset:tier.hit/tier.ms,opacity:1,transform:pose(0,0,26,-3,90,tilt*4,.97),easing:'cubic-bezier(.1,.78,.27,1)'},
  {offset:(tier.hit+turnSpan)/tier.ms,opacity:1,transform:pose(0,-5,34,-6,-tilt*11,-tilt*2,1.04),easing:'ease-out'},
  {offset:(tier.hit+turnSpan+400)/tier.ms,opacity:1,transform:pose(0,0,0,0,0,0,1)},
  {opacity:1,transform:pose(0,0,0,0,0,0,1)}
 ],{duration:tier.ms,fill:'forwards'});
 const start=performance.now();
 function loop(now){
  if(closed)return;
  const age=now-start;
  if(age>=tier.hit)reveal();
  draw(Math.min(age,tier.ms));
  if(age<tier.ms)frame=requestAnimationFrame(loop);
 }
 frame=requestAnimationFrame(loop);
 sound.score(effect,tier.hit,tier.ms);
 impact=setTimeout(reveal,tier.hit);
 if(!hold)end=setTimeout(close,tier.ms);
 return {done,close};
}
