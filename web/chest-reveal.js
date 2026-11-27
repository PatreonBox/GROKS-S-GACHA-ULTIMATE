import {ico} from './icons.js';
import {cardRarities} from './card-rarity.js';
import {cardBackMark} from './pack-model.js';

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
const cardsPerPage=10;
const sceneLoadLimit=1450;
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
function cardFlight(origin,slot,index){
 const x=origin.x-slot.left-slot.width/2,y=origin.y-slot.top-slot.height/2;
 const rise=Math.max(60,Math.min(150,slot.height*.46));
 const spread=Math.max(-1,Math.min(1,-x/320));
 const pose=(dx,dy,pitch,yaw,roll,scale)=>
  `translate3d(${dx}px,${dy}px,0) rotateX(${pitch}deg) rotateY(${yaw}deg) rotateZ(${roll}deg) scale(${scale})`;
 const lean=spread||((index%2)*2-1)*.17;
 return [
  {offset:0,opacity:0,transform:pose(x,y+8,-58,lean*13,lean*8,.18),easing:'cubic-bezier(.18,.56,.4,.94)'},
  {offset:.23,opacity:1,transform:pose(x*.95,y-rise*.62,-24,lean*24,lean*12,.41),easing:'cubic-bezier(.22,.55,.35,1)'},
  {offset:.48,opacity:1,transform:pose(x*.63,y-rise,15,lean*34,lean*15,.71),easing:'cubic-bezier(.25,.55,.39,1)'},
  {offset:.81,opacity:1,transform:pose(x*.07,-11,5,lean*7,lean*3,1.015),easing:'cubic-bezier(.22,.7,.3,1)'},
  {offset:1,opacity:1,transform:pose(0,0,0,0,0,1)}
 ];
}
function sceneMarkup(config,step,total,bulkCount,hasOpenAll){
 return '<div class="chest-stage" aria-hidden="true"><canvas></canvas><div class="chest-fallback">'+
  '<div class="chest-fallback-glow"></div><div class="chest-fallback-box"><i></i><b></b></div>'+
  '<div class="chest-fallback-key"><b></b></div></div><div class="chest-shade"></div></div>'+
  '<header class="chest-head"><div><h2 id="chestRevealTitle">'+config.name+'</h2>'+
  (bulkCount>1?'<p>'+bulkCount+' chests opened together</p>':total>1?'<p>Draw '+step+' of '+total+'</p>':'')+
  '</div><button class="chest-close" type="button" data-chest-close aria-label="Close chest opening">'+ico('x')+'</button></header>'+
  '<section class="chest-content" hidden inert aria-label="Cards in this opening"><p class="chest-hint">Flip each card to reveal it</p>'+
  '<div class="chest-cards"></div><nav class="chest-pages" aria-label="Opening pages" hidden>'+
  '<button type="button" class="outline" data-chest-prev>Previous cards</button>'+
  '<span role="status"></span><button type="button" class="outline" data-chest-more>Next cards</button></nav></section>'+
  '<footer class="chest-actions"><span class="chest-count" hidden></span><div class="chest-buttons">'+
  '<button type="button" class="outline" data-chest-mute></button>'+
  (hasOpenAll?'<button type="button" class="outline" data-chest-open-all>Open all chests</button>':'')+
  '<button type="button" class="outline" data-chest-flip-all title="Reveal every card at once" hidden>Flip all</button>'+
  '<button type="button" class="outline" data-chest-skip>Skip opening</button>'+
  '<button type="button" class="primary" data-chest-next disabled hidden>Continue</button></div></footer>'+
  '<div class="chest-live" aria-live="polite" role="status"></div>';
}

function cardMarkup({html,difficulty},i,up){
 return (
   '<div class="chest-card"'+(up?' data-flipped':'')+'><div class="chest-card-shell">'+
   '<button class="chest-card-back gd-card-back" type="button" disabled aria-label="Flip card '+(i+1)+'" data-chest-card="'+i+'">'+
   cardBackMark(difficulty)+'</button>'+
   '<div class="chest-card-front"'+(up?'':' inert aria-hidden="true"')+'>'+html+'</div></div></div>');
}

export function openChestReveal({tier,cards,onCard,advance,onClose,onSkip,onOpenAll,onFlipAll,sound,toggleSound,observeArt,step=1,total=1,bulkCount=1,initialFlipped=[]}){
 const config=trims[tier]||trims.standard,rarity=highestRarity(cards),timePlan=timeline(rarity),still=reducedMotion();
 const bulk=bulkCount>1,finalHand=bulk||step>=total;
 const dialog=document.createElement('dialog'),prior=document.activeElement;
 dialog.className='chest-reveal';dialog.dataset.tier=tier;dialog.dataset.rarity=rarity;
 dialog.dataset.phase='cinematic';
 if(bulk)dialog.dataset.bulk='';
 dialog.style.setProperty('--chest-accent',config.accent);
 dialog.style.setProperty('--chest-drop',Math.round((timePlan.landing-timePlan.descent)*1000)+'ms');
 dialog.style.setProperty('--chest-fly',Math.round((timePlan.turnStart-timePlan.settle)*1000)+'ms');
 dialog.style.setProperty('--chest-turn',Math.round((timePlan.turnEnd-timePlan.turnStart)*1000)+'ms');
 dialog.style.setProperty('--chest-open',Math.round((timePlan.open-timePlan.turnEnd)*1000)+'ms');
 dialog.setAttribute('aria-labelledby','chestRevealTitle');
 dialog.innerHTML=sceneMarkup(config,step,total,bulkCount,Boolean(onOpenAll));
 const get=selector=>dialog.querySelector(selector);
 const canvas=get('canvas'),closeButton=get('[data-chest-close]'),skipButton=get('[data-chest-skip]');
 const mute=get('[data-chest-mute]'),next=get('[data-chest-next]'),content=get('.chest-content'),live=get('.chest-live'),count=get('.chest-count');
 const openAll=get('[data-chest-open-all]'),flipAll=get('[data-chest-flip-all]');
 const grid=get('.chest-cards'),pages=get('.chest-pages'),previousPage=get('[data-chest-prev]'),nextPage=get('[data-chest-more]');
 const pageSize=bulk?cardsPerPage:cards.length,pageCount=Math.ceil(cards.length/pageSize);
 const flipped=new Set(initialFlipped);
 const tasks=new Set(),flights=[];
 let closed=false,flipping=false,submitting=false,world,frame=0,resize,resolve,rarityStarted,start;
 let page=0,buttons=[],slots=[];
 const done=new Promise(r=>{resolve=r});
 function schedule(fn,milliseconds){
  const token=setTimeout(()=>{tasks.delete(token);if(!closed)fn()},milliseconds);
  tasks.add(token);
 }
 function stopWorld(showFallback=false){
  cancelAnimationFrame(frame);frame=0;
  resize?.disconnect();resize=null;
  world?.dispose();world=null;
  delete dialog.dataset.worldReady;
  if(showFallback)dialog.dataset.fallback='';
 }
 const lostContext=()=>stopWorld(true);
 function close(){
  if(closed)return;closed=true;
  tasks.forEach(clearTimeout);tasks.clear();
  flights.forEach(animation=>animation.cancel());
  canvas.removeEventListener('webglcontextlost',lostContext);
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
  const ready=dialog.dataset.phase==='cards',complete=flipped.size===cards.length&&!flipping;
  const finished=ready&&!bulk&&finalHand&&complete;
  dialog.toggleAttribute('data-complete',finished);
  count.textContent=flipped.size+' / '+cards.length+' revealed';
  count.hidden=!ready||finished;
  mute.hidden=finished;skipButton.hidden=finished||bulk&&complete;
  next.hidden=!ready;
  next.textContent=finished?'Click anywhere to continue':bulk?'See pull results':'Continue';
  for(const button of buttons)button.disabled=!ready||flipped.has(Number(button.dataset.chestCard))||flipping||submitting;
  if(openAll)openAll.disabled=flipping||submitting;
  flipAll.hidden=!ready||complete;
  flipAll.disabled=flipping||submitting;
  pages.hidden=!ready||pageCount<2;
  previousPage.disabled=flipping||submitting||page===0;
  nextPage.disabled=flipping||submitting||page+1===pageCount;
  next.disabled=!complete||submitting;
  skipButton.disabled=submitting||flipping;closeButton.disabled=submitting;
  get('.chest-hint').textContent=complete?(finished?'':'All cards revealed'):'Flip each card to reveal it';
 }
 function renderPage(){
  const offset=page*pageSize,visible=cards.slice(offset,offset+pageSize);
  grid.style.setProperty('--cards',String(bulk?Math.min(5,visible.length):visible.length));
  grid.innerHTML=visible.map((item,i)=>cardMarkup(item,offset+i,flipped.has(offset+i))).join('');
  for(const preview of grid.querySelectorAll('.chest-card-front>button')){
   const art=document.createElement('article');
   for(const {name,value} of preview.attributes)if(name!=='type')art.setAttribute(name,value);
   art.append(...preview.childNodes);preview.replaceWith(art);
  }
  buttons=[...grid.querySelectorAll('[data-chest-card]')];slots=[...grid.querySelectorAll('.chest-card')];
  pages.querySelector('span').textContent='Page '+(page+1)+' of '+pageCount;
  status();
 }
 function navigate(offset){
  page+=offset;renderPage();
  (buttons.find(button=>!button.disabled)||[nextPage,previousPage,next].find(button=>!button.disabled))?.focus({preventScroll:true});
 }
 function makeAvailable(){
  if(closed)return;
  dialog.dataset.phase='cards';content.hidden=false;content.inert=false;
  status();
  live.textContent=cards.length+' face-down cards ready to flip.';
  if(document.activeElement===closeButton||dialog.contains(document.activeElement)&&!document.activeElement.matches('[data-chest-mute], [data-chest-skip]')){
   (buttons.find(button=>!button.disabled)||next).focus({preventScroll:true});
  }
 }
 function dealCards(){
  if(!slots[0]?.animate){makeAvailable();return}
  dialog.dataset.phase='dealing';content.hidden=false;
  const destinations=slots.map(slot=>slot.getBoundingClientRect());
  playCue('sweep',.49);
  slots.forEach((slot,i)=>{
   const point=world?.getCardOrigin?.(i),surface=(point?canvas:get('.chest-fallback-box')).getBoundingClientRect();
   const origin={x:surface.left+surface.width*(point?.x??.5),y:surface.top+surface.height*(point?.y??.16)};
   flights.push(slot.animate(cardFlight(origin,destinations[i],i),{duration:970,delay:i*(bulk?45:76),fill:'backwards'}));
  });
  Promise.allSettled(flights.map(animation=>animation.finished)).then(makeAvailable);
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
 function playRarity(){
  rarityStarted=performance.now();
  sound.playChestRarity?.(rarity);
 }
 function draw(){
  frame=0;
  if(closed||!world)return;
  const now=Math.min((timePlan.open+.77)*1000,performance.now()-start);
  try{
   if(world.draw(now,timePlan,dialog.dataset.phase))dialog.dataset.worldReady='true';
  }catch{lostContext();return}
  if(now<(timePlan.open+.77)*1000)frame=requestAnimationFrame(draw);
 }
 function runStep(stage,time,fn){
  schedule(()=>{dialog.dataset.stage=stage;fn?.()},time*1000);
 }
 closeButton.onclick=abandon;
 skipButton.onclick=()=>submit(onSkip);
 next.onclick=()=>submit(advance);
 if(openAll)openAll.onclick=()=>submit(onOpenAll);
 previousPage.onclick=()=>navigate(-1);
 nextPage.onclick=()=>navigate(1);
 flipAll.onclick=()=>{
  if(flipping||submitting||dialog.dataset.phase!=='cards')return;
  for(const i of cards.keys())flipped.add(i);
  for(const slot of slots)revealFront(slot);
  playCue('sweep',.64);onFlipAll?.();status();
  live.textContent=cards.length+' cards revealed.';next.focus({preventScroll:true});
 };
 mute.onclick=()=>{
  if(toggleSound)toggleSound();else sound.toggle();
  if(!sound.enabled)sound.stopChestAudio?.();
  else if(rarityStarted!==undefined)sound.playChestRarity?.(rarity,(performance.now()-rarityStarted)/1000);
  else sound.prepareChestRarity?.(rarity);
  setMute();
 };
 canvas.addEventListener('webglcontextlost',lostContext,{once:true});
 dialog.addEventListener('cancel',event=>{event.preventDefault();abandon()});
 dialog.addEventListener('close',abandon);
 dialog.addEventListener('click',event=>{
  const button=event.target.closest('[data-chest-card]');
  if(button){flipOne(button);return}
  if(dialog.hasAttribute('data-complete')&&!event.target.closest('button, a, nav'))submit(advance);
 });
 window.addEventListener('pagehide',close);
 function revealFront(card){
  card.dataset.flipped='';
  const front=card.querySelector('.chest-card-front');
  front.inert=false;front.removeAttribute('aria-hidden');
 }
 function flipOne(button){
  const i=Number(button.dataset.chestCard);
  if(closed||dialog.dataset.phase!=='cards'||flipping||submitting||flipped.has(i))return;
  const card=button.closest('.chest-card'),item=cards[i];
  flipping=true;status();playCue('sweep',.64);
  if(item.cinematic&&!still)card.dataset.charging='';
  else if(!item.cinematic)card.dataset.flipped='';
  schedule(async()=>{
   if(closed)return;
   try{await onCard?.(i)}
   finally{
    if(!closed){
     if(item.cinematic)card.dataset.cinematicSeen='';
     delete card.dataset.charging;
     flipped.add(i);revealFront(card);flipping=false;status();
     live.textContent=item.title+(item.rarity?.label?' · '+item.rarity.label:'');
     if(!dialog.contains(document.activeElement)||document.activeElement===button||document.activeElement===dialog){
      (buttons.find(btn=>!btn.disabled)||next).focus({preventScroll:true});
     }
    }
   }
  },still?0:item.cinematic?430:285);
 }
 document.body.append(dialog);dialog.showModal();closeButton.focus({preventScroll:true});
 setMute();sound.unlock?.();sound.prepareChestRarity?.(rarity);
 renderPage();
 observeArt?.(dialog);
 if(still){
  if(rarity!=='common')playRarity();
  dialog.dataset.still='true';dialog.dataset.fallback='';dialog.dataset.stage='open';makeAvailable();
  return {close,done};
 }
 function startScene(module){
  if(closed||start!==undefined)return;
  dialog.dataset.stage=timePlan.descent?'descent':'drop';
  try{
   world=module?.createChestRevealWorld(canvas,tier,rarity,bulkCount);
   if(world&&!world.draw(0,timePlan,dialog.dataset.phase))lostContext();
   if(world){
    dialog.dataset.worldReady='true';
    resize=new ResizeObserver(()=>{if(!frame)draw()});
    resize.observe(canvas);
   }
  }catch{lostContext()}
  start=performance.now();
  if(world)frame=requestAnimationFrame(draw);
  if(!world)dialog.dataset.fallback='';
  runStep('drop',timePlan.descent,()=>{if(timePlan.descent)playCue('tear',.38)});
  if(rarity==='impossible')playRarity();
  runStep('landing',timePlan.landing,()=>{
   playCue('stack',.63);
   if(rarity!=='common'&&rarity!=='impossible')playRarity();
  });
  runStep('key',timePlan.settle,()=>playCue('sweep',.48));
  runStep('turn',timePlan.turnStart,()=>playCue('forge',.47));
  runStep('open',timePlan.turnEnd,()=>playCue('tear',.68));
  schedule(dealCards,timePlan.open*1000);
 }
 // Pick the renderer once. A late WebGL import never replaces a running fallback.
 schedule(()=>startScene(null),sceneLoadLimit);
 prepareChestReveal()?.then(startScene);
 return {close,done};
}
