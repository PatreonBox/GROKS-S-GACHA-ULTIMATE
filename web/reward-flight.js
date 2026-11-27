import {roundCoins} from './coin-economy.js';

// Receipts are already saved. Only the displayed balance waits for the sprites to arrive.
const currencies={
 gems:{file:'gem',label:'Gems',badge:'gemLink',count:'gemCount',tint:'#9ae8ff'},
 coins:{file:'coin',label:'Coins',badge:'walletLink',count:'walletCount',tint:'#ffdf7e'},
 demonKeys:{src:'/assets/ui/demon-key.svg',label:'Demon Keys',badge:'demonKeyLink',count:'demonKeyCount',tint:'#a9dafa'},
 mana:{src:'/assets/kingdom/mana-orbs.webp',label:'Mana',badge:'kingdomManaBadge',count:'kingdomManaCount',tint:'#79ecff'}
};
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const ease=t=>t*t*(3-2*t);
const money=n=>n.toLocaleString('en-US',{maximumFractionDigits:1});
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
export const headerAmount=value=>value<10000?money(value):compact.format(value);
const spriteLimit=15;
const coinCadence=125;
export function rewardSpriteCount(kind,amount){
 if(!Number.isFinite(amount)||amount<=0)return 0;
 if(kind==='mana')return Math.min(9,3+Math.floor(Math.log2(Math.max(1,amount))));
 if(kind==='demonKeys')return Math.min(11,Math.ceil(amount));
 const quantity=kind==='gems'?Math.ceil(amount):1+Math.floor(Math.log2(Math.max(1,amount)));
 return Math.min(spriteLimit,quantity);
}
export function rewardOrigin(element){
 if(!element)return null;
 const r=element.getBoundingClientRect();
 return {x:clamp(r.left+r.width/2,20,innerWidth-20),y:clamp(r.top+r.height/2,18,innerHeight-22)};
}

export function createRewardFlight(sound,format=headerAmount){
 const totals={coins:0,gems:0,mana:0,demonKeys:0},owed={coins:0,gems:0,mana:0,demonKeys:0},images={};
 const tickets=new Set(),bursts=[];
 let layer,canvas,ctx,meter,coveringDialog,raf=0,removeTimer=0,lastChime=0,width=0,height=0;
 let nextCoin=0,queuedCoin=null,lastCoinPulse=-Infinity;
 function visual(kind){
  return Math.max(0,kind==='mana'?totals.mana-Math.round(owed.mana/10):roundCoins(totals[kind]-owed[kind]/10));
 }
 function paint(kind){
  const el=document.getElementById(currencies[kind].count);
  const value=visual(kind);
  if(el){const label=kind==='mana'?money(value):format(value);if(el.textContent!==label)el.textContent=label}
  if(meter?.dataset.kind===kind){
   const counter=meter.querySelector('b'),label=money(value);
   if(counter.textContent!==label)counter.textContent=label;
  }
 }
 function balance(wallet){for(const kind of Object.keys(totals))if(Object.hasOwn(wallet,kind)){totals[kind]=wallet[kind]??0;paint(kind)}}
 function settle(ticket){
  if(!tickets.delete(ticket))return;
  owed[ticket.kind]-=ticket.units-ticket.landed;ticket.landed=ticket.units;paint(ticket.kind);
 }
 function reserve(kind,amount){
  const t={kind,units:Math.round(amount*10),landed:0};
  tickets.add(t);owed[kind]+=t.units;return t;
 }
 function setup(){
  clearTimeout(removeTimer);if(layer)return;
  layer=document.createElement('div');layer.className='reward-layer';layer.setAttribute('aria-hidden','true');
  canvas=document.createElement('canvas');meter=document.createElement('div');meter.className='reward-meter';meter.hidden=true;
  meter.innerHTML='<img alt=""><b></b>';layer.append(canvas,meter);document.body.append(layer);
  ctx=canvas.getContext('2d');
 }
 function topLayer(){
  if(typeof layer.showPopover!=='function')return;
  if(layer.matches(':popover-open'))layer.hidePopover();
  layer.setAttribute('popover','manual');layer.showPopover();
 }
 function destination(kind,forced){
  const badge=document.getElementById(currencies[kind].badge);
  const rect=badge?.getBoundingClientRect();
  const onScreen=rect?.width&&rect.top>=3&&rect.left>=0&&rect.bottom<=innerHeight&&rect.right<=innerWidth;
  if(!forced&&onScreen){
   meter.hidden=true;return {point:rewardOrigin(badge.querySelector('img')||badge),badge};
  }
  if(meter.dataset.kind!==kind){meter.dataset.kind=kind;meter.querySelector('img').src=images[kind].src}
  if(kind==='demonKeys'&&onScreen){
   meter.style.top=rect.top+'px';meter.style.right=Math.max(8,innerWidth-rect.right)+'px';
  }else{meter.style.removeProperty('top');meter.style.removeProperty('right')}
  meter.hidden=false;paint(kind);
  return {point:rewardOrigin(meter.querySelector('img')),badge:meter};
 }
 function star(x,y,r,opacity){
  if(r<=0||opacity<=0)return;
  ctx.globalAlpha=opacity;ctx.fillStyle='#fffcea';ctx.beginPath();
  for(let j=0;j<8;j++){const a=j*Math.PI/4,k=j%2?r*.24:r;const px=x+Math.cos(a)*k,py=y+Math.sin(a)*k;if(j)ctx.lineTo(px,py);else ctx.moveTo(px,py)}
  ctx.closePath();ctx.fill();ctx.globalAlpha=1;
 }
 function hit(b,badge){
  if(!b.paid){settle(b.ticket);b.paid=true}
  if(b.pulsed)return;b.pulsed=true;
  if(b.streamed){
   const now=performance.now();
   if(now-lastCoinPulse<205)return;
   lastCoinPulse=now;
  }
  badge?.animate?.([{filter:'brightness(1.9)',scale:b.reduce?'1':'1.12'},{filter:'brightness(1)',scale:'1'}],{duration:b.reduce?120:260,easing:'ease-out'});
  if(b.kind==='demonKeys'){sound.keyReward();return}
  if(!b.quiet&&performance.now()-lastChime>105){lastChime=performance.now();sound.play(b.kind==='coins'?'mineAccent':'bonus',{rate:1.2,level:.41})}
 }
 function frame(now){
  if(queuedCoin&&now>=nextCoin){
   const {ticket,origin}=queuedCoin;queuedCoin=null;nextCoin=now+coinCadence;
   launch(ticket,origin,{streamed:true,quiet:true});
  }
  const w=innerWidth,h=innerHeight;
  if(w!==width||h!==height){
   width=w;height=h;const d=Math.min(2,devicePixelRatio||1);
   canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx?.setTransform(d,0,0,d,0,0);
  }
  ctx?.clearRect(0,0,w,h);
  if(bursts.some(b=>b.kind==='demonKeys')){
   const dialog=Array.from(document.querySelectorAll('dialog[open]')).at(-1);
   if(dialog&&dialog!==coveringDialog)topLayer();
   coveringDialog=dialog;
  }
  for(let i=bursts.length-1;i>=0;i--){
   const b=bursts[i],age=now-b.at,{point:to,badge}=destination(b.kind,b.force||(b.kind==='demonKeys'?coveringDialog:document.querySelector('.fusion-show,[data-fusion-overlay]')));
   const {x,y}=b.from,tint=currencies[b.kind].tint;
   if(!ctx||!to||b.reduce){
    if(age>100||!ctx||!to){hit(b,badge);bursts.splice(i,1)}
    continue;
   }
   const sx=clamp(x,18,w-18),sy=clamp(y,20,h-28);
   const mana=b.kind==='mana',burstEnd=mana ? .27 : .46;
   const total=mana?850:b.streamed?550:b.small?660:1060;
   if(!b.streamed&&age<total*.58){
    const k=age/(total*.58);
    const glow=ctx.createRadialGradient(sx,sy,0,sx,sy,Math.max(1,22+32*k));
    glow.addColorStop(0,tint+'9a');glow.addColorStop(1,tint+'00');
    ctx.globalAlpha=(1-k)*.65;ctx.fillStyle=glow;ctx.fillRect(sx-60,sy-60,120,120);ctx.globalAlpha=1;
    if(mana){
     ctx.beginPath();ctx.arc(sx,sy,10+47*k,0,Math.PI*2);
     ctx.strokeStyle=tint;ctx.lineWidth=2.8*(1-k)+.4;ctx.globalAlpha=(1-k)**1.55;ctx.stroke();ctx.globalAlpha=1;
    }
   }
   let last=0,lifted=0;
   for(const p of b.sprites){
    const t=clamp((age-p.delay)/total,0,1);
    last+=t===1?1:0;
    if(b.streamed)lifted=ease(clamp((t-.73)/.27,0,1));
    if(t<=0||t>=1)continue;
    const low=clamp(sy+(mana?-p.drop:p.drop),20,h-18),side=clamp(sx+p.dx,14,w-14);
    let a,px,py,size;
    if(b.streamed){
     a=ease(t);const inv=1-a,midX=clamp((sx+to.x)*.5+p.dx,8,w-8),midY=Math.max(10,Math.min(sy,to.y)-p.lift);
     px=inv*inv*sx+2*inv*a*midX+a*a*to.x;py=inv*inv*sy+2*inv*a*midY+a*a*to.y;
     size=p.size*(.9-.40*a+.27*Math.sin(Math.PI*a));
    }else if(t<burstEnd){
     a=t/burstEnd;px=sx+(side-sx)*Math.sin(a*Math.PI/2);py=sy+(low-sy)*a*a-p.kick*4*a*(1-a);size=p.size*(.6+.55*Math.min(1,a*3));
    }else{
     a=ease((t-burstEnd)/(1-burstEnd));const inv=1-a;
     const cy=Math.max(10,Math.min(low,to.y)-p.lift),cx=clamp(side+p.dx*.75,8,w-8);
     px=inv*inv*side+2*inv*a*cx+a*a*to.x;py=inv*inv*low+2*inv*a*cy+a*a*to.y;
     size=p.size*(1.14-.65*a);
     ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+(side-px)*.05,py+(low-py)*.06);ctx.strokeStyle=tint;ctx.lineWidth=Math.max(1,size*.12);ctx.globalAlpha=.40;ctx.stroke();ctx.globalAlpha=1;
    }
    const im=images[b.kind];
    if(im?.complete&&im.naturalWidth){ctx.save();ctx.translate(px,py);ctx.rotate(p.twist*Math.sin(t*Math.PI));ctx.shadowColor=tint;ctx.shadowBlur=b.small?3:7;const ratio=im.naturalWidth/im.naturalHeight;ctx.drawImage(im,-size*ratio/2,-size/2,size*ratio,size);ctx.restore()}
    star(px+size*.24,py-size*.28,size*.22,(.5+.5*Math.sin(14*t+p.phase))*.95);
   }
   if(!b.small&&!b.streamed&&age<780){
    const f=clamp(age/780,0,1);ctx.save();ctx.font='800 '+Math.round(23+4*Math.sin(f*Math.PI))+'px Barlow, sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#1c1832';ctx.fillStyle=tint;ctx.globalAlpha=Math.min(1,(1-f)*4,f*15);const text='+'+money(b.ticket.units/10),labelY=clamp(sy-27-25*f,24,h-12);ctx.strokeText(text,sx,labelY);ctx.fillText(text,sx,labelY);ctx.restore();
   }
   const landed=Math.floor(b.ticket.units*(b.streamed?lifted:last/b.sprites.length));
   if(landed>b.ticket.landed){owed[b.kind]-=landed-b.ticket.landed;b.ticket.landed=landed;paint(b.kind)}
   if(last===b.sprites.length){hit(b,badge);bursts.splice(i,1)}
  }
  if(bursts.length||queuedCoin)raf=requestAnimationFrame(frame);
  else {raf=0;removeTimer=setTimeout(cleanup,meter?.hidden?80:650)}
 }
 function cleanup(){
  clearTimeout(removeTimer);cancelAnimationFrame(raf);raf=0;layer?.remove();layer=null;meter=null;canvas=null;ctx=null;coveringDialog=null;width=height=0;
 }
 function clear({keepKeys=false}={}){
  queuedCoin=null;nextCoin=0;
  for(let i=bursts.length-1;i>=0;i--)if(!keepKeys||bursts[i].kind!=='demonKeys')bursts.splice(i,1);
  for(const ticket of tickets)if(!keepKeys||ticket.kind!=='demonKeys')settle(ticket);
  if(!bursts.length)cleanup();
 }
 function streamCoins(ticket,origin){
  if(!tickets.has(ticket))return;
  if(!ticket.units||document.hidden||!origin){settle(ticket);return}
  if(queuedCoin){
   queuedCoin.ticket.units+=ticket.units;
   tickets.delete(ticket);
  }else queuedCoin={ticket,origin};
  setup();
  if(!raf)raf=requestAnimationFrame(frame);
 }
 function launch(ticket,origin,{small=false,front=false,quiet=false,streamed=false}={}){
  if(!tickets.has(ticket))return;
  const amount=ticket.units/10,count=streamed?1:rewardSpriteCount(ticket.kind,amount);
  if(!count||document.hidden||!origin){settle(ticket);return}
  setup();
  if(ticket.kind==='demonKeys')topLayer();
  if(!images[ticket.kind]){
   const img=new Image(),currency=currencies[ticket.kind];
   img.src=currency.src||('/assets/packs/'+currency.file+'.png');images[ticket.kind]=img;
  }
  const from=origin.getBoundingClientRect?rewardOrigin(origin):origin;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spread=Math.min(26+count*5,innerWidth*.15);
  const size=streamed?18:amount<1?13+5*amount:18+Math.min(6,Math.log2(amount+1));
  const sprites=Array.from({length:count},(_,i)=>({
   dx:(count>1?(i/(count-1)-.5)*spread*2:0)+(Math.random()-.5)*18,
   drop:12+Math.random()*26,kick:24+Math.random()*44,lift:24+Math.random()*88,
   size:size*(.89+.22*Math.random()),twist:(Math.random()-.5)*1.6,phase:Math.random()*6,delay:i*15+Math.random()*22
  }));
  // Settle the oldest flights when overlapping claims fill the screen.
  if(!streamed){
   let occupied=bursts.reduce((n,b)=>n+(b.kind===ticket.kind&&!b.streamed?b.sprites.length:0),0);
   for(let i=0;i<bursts.length&&occupied+count>spriteLimit;){
    const old=bursts[i];
    if(old.kind!==ticket.kind||old.streamed){i++;continue}
    occupied-=old.sprites.length;settle(old.ticket);bursts.splice(i,1);
   }
  }
  bursts.push({ticket,kind:ticket.kind,small,quiet,streamed,force:front,from,sprites,reduce,at:performance.now()});
  if(!raf)raf=requestAnimationFrame(frame);
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
 return {balance,paint,reserve,launch,streamCoins,settle,clear};
}
