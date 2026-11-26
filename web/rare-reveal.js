import {ico} from './icons.js';
import {remixTracks,remixTrackSource} from './remix-media.js';

export const rareTiers=[
 {n:5000,name:'First Light',effect:'slit',ink:'#9beaff',flare:'#147eef',hit:840,ms:2050},
 {n:20000,name:'Prism Break',effect:'prism',ink:'#e9b1ff',flare:'#9151ff',hit:1060,ms:2400},
 {n:100000,name:'Starfall',effect:'starfall',ink:'#ffe5ac',flare:'#ef6faa',hit:1390,ms:2840},
 {n:500000,name:'Eclipse',effect:'eclipse',ink:'#ffa6bb',flare:'#f42682',hit:2000,ms:3600},
 {n:1000000,name:'Singularity',effect:'singularity',ink:'#a9f3ff',flare:'#6d5dff',hit:2500,ms:4350},
 {n:10000000,name:'Event Horizon',effect:'horizon',ink:'#fff1b9',flare:'#7b69ff',hit:3140,ms:5440}
];
export function revealTier(percent){
 if(!(percent>0&&Number.isFinite(percent)))return null;
 for(let i=rareTiers.length-1;i>=0;i--)if(percent<=100/rareTiers[i].n)return rareTiers[i];
 return null;
}

const newgroundsSongs={'speed-of-light':467339,epilogue:723714,carnivores:690265,reverie:787986};
const songsByLevel={
 3979721:'speed-of-light',    // Cataclysm
 10565740:'speed-of-light',   // Bloodbath
 25610878:'speed-of-light',   // aftermath
 42584142:'speed-of-light',   // Bloodlust
 61079355:'epilogue',         // Acu
 37456092:'carnivores',       // Digital Descent
 75867791:'reverie'           // poocu
};
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let worldRequest;
function loadWorld(){
 if(!worldRequest)worldRequest=import('/rare-reveal-world.js').catch(()=>{worldRequest=null;return null});
 return worldRequest;
}
export function prepareRareReveal(items,sound){
 const rare=items.filter(item=>revealTier(item.percent));
 if(!rare.length)return;
 if(!reducedMotion())loadWorld();
 if(!sound.enabled)return;
 const tracks=new Set(rare.map(item=>songsByLevel[item.row[0]]).filter(Boolean));
 for(const clip of tracks)sound.prepareRevealTrack(remixTrackSource(clip));
}

const motions={
 slit:[[0,74,-164,17,180,3,.72],[0,7,-20,7,164,1,.94],[0,-4,16,-3,-7,-1,1.03]],
 prism:[[-138,30,-180,10,-224,-26,.67],[-16,-3,-25,8,-161,7,.90],[5,0,27,-4,11,-4,1.04]],
 starfall:[[115,-156,-258,-30,193,31,.63],[6,13,-42,16,152,8,.93],[0,-7,32,-8,-12,-3,1.045]],
 eclipse:[[-30,105,-342,44,-178,-11,.61],[-8,5,-33,19,-151,-7,.93],[2,-4,28,-6,9,-1,1.035]],
 singularity:[[-111,-48,-416,-27,242,-45,.59],[-12,-8,-45,-15,151,-9,.90],[0,4,34,8,-13,2,1.06]],
 horizon:[[0,15,-602,38,-208,50,.51],[2,2,-57,8,-147,4,.87],[0,-6,44,-5,12,0,1.065]]
};
function pose([x,y,z,rx,ry,rz,scale]){
 return 'translate3d('+x+'px,'+y+'px,'+z+'px) rotateX('+rx+'deg) rotateY('+ry+'deg) rotateZ('+rz+'deg) scale('+scale+')';
}
function turnCard(deck,tier){
 const [entry,ready,landed]=motions[tier.effect];
 const direction=Math.sign(ready[4]),turn=.17*tier.hit+135;
 return deck.animate([
  {opacity:0,transform:pose(entry),easing:'cubic-bezier(.18,.68,.31,1)'},
  {offset:(tier.hit-turn)/tier.ms,opacity:1,transform:pose(ready),easing:'cubic-bezier(.52,.03,.79,.52)'},
  {offset:tier.hit/tier.ms,opacity:1,transform:pose([0,0,9,2,90*direction,0,.98]),easing:'cubic-bezier(.10,.71,.27,1)'},
  {offset:(tier.hit+turn)/tier.ms,opacity:1,transform:pose(landed),easing:'cubic-bezier(.23,.67,.37,1)'},
  {offset:(tier.hit+turn+475)/tier.ms,opacity:1,transform:pose([0,0,0,0,0,0,1])},
  {opacity:1,transform:pose([0,0,0,0,0,0,1])}
 ],{duration:tier.ms,fill:'forwards'});
}

export function playRareReveal({tier,levelId,cardHTML,title,odds,oddsLabel,sound,toggleSound,observeArt,hold=false,skipAll}){
 const effect=rareTiers.indexOf(tier),reduce=reducedMotion()||!Element.prototype.animate;
 const clip=songsByLevel[levelId],song=newgroundsSongs[clip],src=song&&remixTrackSource(clip);
 const dialog=document.createElement('dialog'),prior=document.activeElement;
 dialog.className='rare-reveal';dialog.dataset.effect=tier.effect;
 dialog.setAttribute('aria-label','Rare card reveal');
 dialog.style.setProperty('--rarity',tier.ink);dialog.style.setProperty('--flare',tier.flare);
 dialog.style.setProperty('--charge',tier.hit+'ms');
 dialog.innerHTML='<div class="rare-sky" aria-hidden="true"><img alt="" class="rare-hero"></div>'+
  '<div class="rare-environment" aria-hidden="true"></div><canvas aria-hidden="true"></canvas>'+
  '<div class="rare-impact" aria-hidden="true"></div>'+
  '<div class="rare-head" aria-hidden="true"><span>'+tier.name+'</span><strong>'+odds+'</strong><small>'+oddsLabel+' · per card</small></div>'+
  '<div class="rare-stage" aria-hidden="true" inert><div class="rare-deck"><i class="rare-edge"></i>'+
  '<div class="rare-back"><span class="rare-crest"><img src="/assets/player-cube.png" alt=""></span></div>'+
  '<div class="rare-front">'+cardHTML+'</div></div></div>'+
  '<p class="rare-live" role="status" aria-live="polite"></p><div class="rare-footer">'+
  (song?'<a class="rare-track" href="https://www.newgrounds.com/audio/listen/'+song+'" target="_blank" rel="noopener noreferrer" tabindex="-1">'+
   '<span>'+remixTracks[clip]+'</span>'+ico('external')+'</a>':'')+
  '<div class="rare-controls">'+
  (skipAll?'<button type="button" class="outline" data-rare-all>Skip opening</button>':'')+
  '<button type="button" class="outline" data-rare-mute></button>'+
  '<button type="button" class="primary" data-rare-close>'+(reduce?'Continue':'Skip reveal')+'</button></div></div>';
 const deck=dialog.querySelector('.rare-deck'),button=dialog.querySelector('[data-rare-close]'),announce=dialog.querySelector('.rare-live');
 const mute=dialog.querySelector('[data-rare-mute]'),credit=dialog.querySelector('.rare-track'),canvas=dialog.querySelector('canvas');
 const art=deck.querySelector('.scene-shot'),hero=dialog.querySelector('.rare-hero');
 function setBackdrop(){hero.src=art.currentSrc||art.src}
 hero.addEventListener('load',()=>hero.classList.add('ready'),{once:true});
 if(art?.complete&&art.naturalWidth)setBackdrop();
 else art?.addEventListener('load',setBackdrop,{once:true});
 let frame=0,impact=0,end=0,endAt=0,shownAt,closed=false,resolve;
 let world,watchSize,animation,musicRequest=0,motionMs=tier.ms;
 const done=new Promise(r=>{resolve=r});
 const clipTime=hold?10.5:4.2;
 function disposeWorld(){
  cancelAnimationFrame(frame);watchSize?.disconnect();
  world?.dispose();world=null;delete dialog.dataset.worldReady;
 }
 function close(){
  if(closed)return;closed=true;musicRequest++;
  clearTimeout(impact);clearTimeout(end);animation?.cancel();sound.stopScore();
  canvas.removeEventListener('webglcontextlost',disposeWorld);disposeWorld();
  document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',close);
  if(dialog.open)dialog.close();
  dialog.remove();
  if(prior?.isConnected)prior.focus({preventScroll:true});
  resolve();
 }
 function hidden(){if(document.hidden)close()}
 function setEnd(at){
  if(hold||at<=endAt)return;
  endAt=at;clearTimeout(end);end=setTimeout(close,Math.max(0,at-performance.now()));
 }
 function syncMute(){
  mute.setAttribute('aria-label','Pack audio');
  mute.setAttribute('aria-pressed',String(sound.enabled));
  mute.title=sound.enabled?'Mute pack audio':'Enable pack audio';
  mute.innerHTML=ico(sound.enabled?'volume':'muted');
 }
 function playTrack(){
  const request=++musicRequest;
  if(!src||!sound.enabled)return;
  const tryPlay=()=>{
   if(closed||musicRequest!==request)return;
   const elapsed=Math.max(0,(performance.now()-shownAt)/1000);
   if(!hold&&elapsed>1.1)return;
   if(sound.playRevealTrack(src,elapsed,clipTime-elapsed)){
    const finish=shownAt+clipTime*1000;
    setEnd(finish);
    motionMs=Math.max(motionMs,finish-start);
    if(world&&!frame)frame=requestAnimationFrame(draw);
   }
  };
  const loading=sound.prepareRevealTrack(src);
  if(loading)loading.then(tryPlay);else tryPlay();
 }
 function reveal(){
  if(closed||shownAt!==undefined)return;
  shownAt=performance.now();
  dialog.dataset.revealed='true';button.textContent='Continue';announce.textContent=tier.name+' · '+title+' · '+odds;
  credit?.removeAttribute('tabindex');
  playTrack();
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 dialog.addEventListener('close',close);
 mute.onclick=()=>{
  toggleSound();syncMute();
  if(shownAt!==undefined)playTrack();
  else if(src&&sound.enabled)sound.prepareRevealTrack(src);
 };
 button.onclick=close;
 const all=dialog.querySelector('[data-rare-all]');
 if(all)all.onclick=()=>{all.hidden=true;button.focus({preventScroll:true});skipAll()};
 syncMute();observeArt?.(dialog);
 document.addEventListener('visibilitychange',hidden);
 window.addEventListener('pagehide',close);
 document.body.append(dialog);dialog.showModal();button.focus({preventScroll:true});
 if(src&&sound.enabled)sound.prepareRevealTrack(src);
 const start=performance.now();
 setEnd(start+(reduce?1750:tier.ms));
 if(reduce){
  dialog.dataset.still='true';
  deck.style.transform='none';
  sound.play('results');
  reveal();
  return {done,close};
 }
 animation=turnCard(deck,tier);
 sound.score(effect,tier.hit,tier.ms);
 impact=setTimeout(reveal,tier.hit);
 function draw(now){
  frame=0;
  if(closed||!world)return;
  const age=Math.min(motionMs,Math.max(0,now-start));
  try{
   if(world.draw(age))dialog.dataset.worldReady='true';
  }catch{disposeWorld();return}
  if(age<motionMs)frame=requestAnimationFrame(draw);
 }
 loadWorld().then(module=>{
  if(closed||!module)return;
  try{
   world=module.createRareRevealWorld(canvas,tier);
   if(!world)return;
   canvas.addEventListener('webglcontextlost',disposeWorld,{once:true});
   watchSize=new ResizeObserver(()=>{if(!frame)draw(performance.now())});
   watchSize.observe(canvas);
   frame=requestAnimationFrame(draw);
  }catch{disposeWorld()}
 });
 return {done,close};
}
