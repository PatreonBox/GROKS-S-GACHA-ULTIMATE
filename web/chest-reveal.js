import {ico} from './icons.js';
import {cardRarities} from './card-rarity.js';

const trims={
 standard:{name:'Standard Chest',accent:'#92defd'},
 special:{name:'Special Chest',accent:'#ffcd6e'},
 pro:{name:'Pro Chest',accent:'#e4adff'}
};
const rarityOrder=cardRarities.map(({id})=>id);
const chestStrength={
 common:1,uncommon:1,rare:1,epic:1,legendary:1,mythic:.86,ancient:.89,exotic:.97,celestial:1.10,
 secret:1.13,divine:1.04,apex:1.13,impossible:1
};
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const highestRarity=cards=>cards.reduce((best,{rarity})=>
 rarityOrder.indexOf(rarity?.id)>rarityOrder.indexOf(best)?rarity.id:best,'common');
let worldPromise;
export function prepareChestReveal(){
 if(reducedMotion())return null;
 worldPromise??=import('/chest-reveal-world.js').catch(()=>{worldPromise=null;return null});
 return worldPromise;
}

function timeline(rarity){
 const scale=chestStrength[rarity]||1,descent=rarity==='impossible'?1.17:0;
 const mark=t=>descent+t*scale;
 return {descent,landing:mark(1.14),settle:mark(1.50),turnStart:mark(2.33),turnEnd:mark(2.93),open:mark(3.59)};
}
function sceneMarkup(config,cards,step,total){
 return '<div class="chest-stage" aria-hidden="true"><canvas></canvas><div class="chest-fallback">'+
  '<div class="chest-fallback-glow"></div><div class="chest-fallback-box"><i></i><b></b></div>'+
  '<div class="chest-fallback-key"><b></b></div></div><div class="chest-shade"></div></div>'+
  '<header class="chest-head"><div><h2 id="chestRevealTitle">'+config.name+'</h2>'+
  (total>1?'<p>Draw '+step+' of '+total+'</p>':'')+
  '</div><button class="chest-close" type="button" data-chest-close aria-label="Close chest opening">'+ico('x')+'</button></header>'+
  '<section class="chest-content" hidden aria-label="Cards in this chest"><p class="chest-hint">Flip each card to reveal it</p>'+
  '<div class="chest-cards" style="--cards:'+cards.length+'">'+cards.map(({html},i)=>
   '<div class="chest-card" style="--card-slot:'+i+'"><div class="chest-card-shell">'+
   '<button class="chest-card-back" type="button" aria-label="Flip card '+(i+1)+'" data-chest-card="'+i+'">'+
   '<span class="chest-card-rune" aria-hidden="true">'+ico('spark')+'</span><span class="chest-card-label">Flip card</span></button>'+
   '<div class="chest-card-front" inert aria-hidden="true">'+html+'</div></div></div>').join('')+'</div></section>'+
  '<footer class="chest-actions"><span class="chest-count" hidden></span><div class="chest-buttons">'+
  '<button type="button" class="outline" data-chest-mute></button>'+
  '<button type="button" class="outline" data-chest-skip>Skip opening</button>'+
  '<button type="button" class="primary" data-chest-next disabled hidden>Continue</button></div></footer>'+
  '<div class="chest-live" aria-live="polite" role="status"></div>';
}

export function openChestReveal({tier,cards,onCard,advance,onClose,onSkip,sound,toggleSound,observeArt,step=1,total=1}){
 const config=trims[tier]||trims.standard,rarity=highestRarity(cards),timePlan=timeline(rarity),still=reducedMotion();
 const dialog=document.createElement('dialog'),prior=document.activeElement;
 dialog.className='chest-reveal';dialog.dataset.tier=tier;dialog.dataset.rarity=rarity;
 dialog.dataset.phase='cinematic';dialog.dataset.stage=timePlan.descent?'descent':'drop';
 dialog.style.setProperty('--chest-accent',config.accent);
 dialog.style.setProperty('--chest-drop',Math.round((timePlan.landing-timePlan.descent)*1000)+'ms');
 dialog.style.setProperty('--chest-fly',Math.round((timePlan.turnStart-timePlan.settle)*1000)+'ms');
 dialog.style.setProperty('--chest-turn',Math.round((timePlan.turnEnd-timePlan.turnStart)*1000)+'ms');
 dialog.style.setProperty('--chest-open',Math.round((timePlan.open-timePlan.turnEnd)*1000)+'ms');
 dialog.setAttribute('aria-labelledby','chestRevealTitle');
 dialog.innerHTML=sceneMarkup(config,cards,step,total);
 const get=selector=>dialog.querySelector(selector);
 const canvas=get('canvas'),closeButton=get('[data-chest-close]'),skipButton=get('[data-chest-skip]');
 const mute=get('[data-chest-mute]'),next=get('[data-chest-next]'),content=get('.chest-content'),live=get('.chest-live'),count=get('.chest-count');
 const buttons=[...dialog.querySelectorAll('[data-chest-card]')];
 for(const preview of dialog.querySelectorAll('.chest-card-front>button')){
  const art=document.createElement('article');
  for(const {name,value} of preview.attributes)if(name!=='type')art.setAttribute(name,value);
  art.append(...preview.childNodes);preview.replaceWith(art);
 }
 const delay=still?0:285,flipped=new Set();
 const tasks=new Set();
 let closed=false,flipping=false,submitting=false,world,frame=0,resize,resolve;
 const done=new Promise(r=>{resolve=r});
 const start=performance.now();
 function schedule(fn,milliseconds){
  const token=setTimeout(()=>{tasks.delete(token);if(!closed)fn()},milliseconds);
  tasks.add(token);
 }
 function stopWorld(){
  cancelAnimationFrame(frame);frame=0;
  resize?.disconnect();resize=null;
  world?.dispose();world=null;
  delete dialog.dataset.worldReady;
 }
 function close(){
  if(closed)return;closed=true;
  tasks.forEach(clearTimeout);tasks.clear();
  canvas.removeEventListener('webglcontextlost',stopWorld);
  window.removeEventListener('pagehide',close);
  stopWorld();sound.stopChestAudio?.();
  if(dialog.open)dialog.close();
  dialog.remove();
  if(prior?.isConnected&&!document.querySelector('dialog[open]'))prior.focus({preventScroll:true});
  resolve();
 }
 function abandon(){if(closed||submitting)return;close();onClose?.()}
 function setMute(){
  mute.setAttribute('aria-pressed',String(sound.enabled));
  mute.setAttribute('aria-label','Pack audio');
  mute.title=sound.enabled?'Mute pack audio':'Enable pack audio';
  mute.innerHTML=ico(sound.enabled?'volume':'muted');
 }
 function status(){
  count.textContent=flipped.size+' / '+cards.length+' revealed';
  for(const [i,button] of buttons.entries())button.disabled=flipped.has(i)||flipping||submitting;
  next.disabled=flipping||submitting||flipped.size!==cards.length;
  skipButton.disabled=submitting||flipping;closeButton.disabled=submitting;
  if(flipped.size===cards.length)get('.chest-hint').textContent='All cards revealed';
 }
 function makeAvailable(){
  if(closed)return;
  dialog.dataset.phase='cards';content.hidden=false;
  count.hidden=next.hidden=false;
  sound.stopChestAudio?.();status();
  live.textContent=cards.length+' face-down cards ready to flip.';
  if(document.activeElement===closeButton||dialog.contains(document.activeElement)&&!document.activeElement.matches('[data-chest-mute], [data-chest-skip]')){
   buttons[0]?.focus({preventScroll:true});
  }
 }
 async function submit(action){
  if(submitting||flipping||closed||!action)return;
  submitting=true;status();sound.stopChestAudio?.();
  try{await action()}
  finally{
   if(!closed){submitting=false;status()}
  }
 }
 function playCue(name,level){sound.play?.(name,{level})}
 function draw(){
  frame=0;
  if(closed||!world)return;
  const now=Math.min((timePlan.open+.77)*1000,performance.now()-start);
  try{
   if(world.draw(now,timePlan,dialog.dataset.phase))dialog.dataset.worldReady='true';
  }catch{stopWorld();return}
  if(now<(timePlan.open+.77)*1000)frame=requestAnimationFrame(draw);
 }
 function runStep(stage,time,fn){
  schedule(()=>{dialog.dataset.stage=stage;fn?.()},time*1000);
 }
 closeButton.onclick=abandon;
 skipButton.onclick=()=>submit(onSkip);
 next.onclick=()=>submit(advance);
 mute.onclick=()=>{
  if(toggleSound)toggleSound();else sound.toggle();
  if(!sound.enabled)sound.stopChestAudio?.();
  else sound.prepareChestRarity?.(rarity);
  setMute();
 };
 canvas.addEventListener('webglcontextlost',stopWorld,{once:true});
 dialog.addEventListener('cancel',event=>{event.preventDefault();abandon()});
 dialog.addEventListener('close',abandon);
 window.addEventListener('pagehide',close);
 for(const [i,button] of buttons.entries())button.onclick=()=>{
  if(closed||flipping||submitting||flipped.has(i))return;
  const card=button.closest('.chest-card'),front=card.querySelector('.chest-card-front'),item=cards[i];
  flipping=true;flipped.add(i);status();
  card.dataset.flipped='';playCue('sweep',.64);
  schedule(async()=>{
   if(closed)return;
   front.inert=false;front.removeAttribute('aria-hidden');
   live.textContent=item.title+(item.rarity?.label?' · '+item.rarity.label:'');
   try{await onCard?.(i)}
   finally{
    if(!closed){
     flipping=false;status();
     if(!dialog.contains(document.activeElement)||document.activeElement===button){
      (buttons.find(btn=>!btn.disabled)||next).focus({preventScroll:true});
     }
    }
   }
  },delay);
 };
 document.body.append(dialog);dialog.showModal();closeButton.focus({preventScroll:true});
 setMute();sound.unlock?.();sound.prepareChestRarity?.(rarity);
 observeArt?.(dialog);
 if(still){
  dialog.dataset.still='true';dialog.dataset.stage='open';makeAvailable();
  return {close,done};
 }
 runStep('drop',timePlan.descent,()=>{if(timePlan.descent)playCue('tear',.38)});
 if(rarity==='impossible')sound.playChestRarity?.(rarity);
 runStep('landing',timePlan.landing,()=>{
  playCue('stack',.63);
  if(rarity!=='common'&&rarity!=='impossible')sound.playChestRarity?.(rarity);
 });
 runStep('key',timePlan.settle,()=>playCue('sweep',.48));
 runStep('turn',timePlan.turnStart,()=>playCue('forge',.47));
 runStep('open',timePlan.turnEnd,()=>playCue('tear',.68));
 schedule(makeAvailable,timePlan.open*1000);
 prepareChestReveal()?.then(module=>{
  if(closed||!module)return;
  try{
   world=module.createChestRevealWorld(canvas,tier,rarity);
   if(!world)return;
   resize=new ResizeObserver(()=>{if(!frame)draw()});
   resize.observe(canvas);frame=requestAnimationFrame(draw);
  }catch{stopWorld()}
 });
 return {close,done};
}
