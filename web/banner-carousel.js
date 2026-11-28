import {bannerSlideDifficulties} from './demon-banner.js';
import {ico} from './icons.js';
import {loadingMarkup} from './loading.js';
import {cardFace} from './pack-model.js';

const rotationDelay=5000;
const slotCount=bannerSlideDifficulties.length;

export function bannerCarouselMarkup(){
 return '<div class="banner-carousel" role="group" aria-roledescription="carousel" aria-label="Banner level previews">'+
  '<div class="banner-level-card"><div class="banner-frames">'+loadingMarkup('Loading level previews…')+'</div>'+
  '<button type="button" class="banner-arrow" data-banner-step="-1" aria-label="Previous level" disabled>'+ico('left')+'</button>'+
  '<button type="button" class="banner-arrow" data-banner-step="1" aria-label="Next level" disabled>'+ico('right')+'</button></div>'+
  '<div class="banner-carousel-controls"><div class="banner-dots" role="group" aria-label="Show a difficulty">'+
  bannerSlideDifficulties.map((difficulty,i)=>'<button type="button" data-banner-dot="'+i+'" aria-label="'+difficulty+'" title="'+difficulty+'" disabled></button>').join('')+
  '</div><button type="button" class="banner-rotation" data-banner-rotate aria-label="Pause slideshow" title="Pause slideshow" disabled>'+ico('pause')+'</button></div>'+
  '<span class="banner-carousel-status" role="status"></span></div>';
}

function pickLevel(pool,weight,previous){
 const candidates=pool.length>1?pool.filter(level=>level.id!==previous?.id):pool;
 let ticket=Math.random()*candidates.reduce((sum,level)=>sum+level[weight],0);
 for(const level of candidates){
  ticket-=level[weight];
  if(ticket<0)return level;
 }
 return candidates.at(-1);
}

export function createBannerCarousel({load,coverSource}){
 const decks=new Map();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const hoverable=matchMedia('(hover:hover) and (pointer:fine)');
 let levels,profile,request=0,pending=false,failed=false,mounted,timer;

 function prepareDeck(){
  const {banner}=mounted;
  let deck=decks.get(banner);
  if(!deck){
   deck={slot:0,cycle:0,furthest:0,slides:Array(slotCount),assigned:Array(slotCount).fill(0),paused:false};
   decks.set(banner,deck);
  }
  const weight=banner==='pro'?'proWeight':'standardWeight';
  const order=[];
  for(const [i,pool] of levels.entries()){
   if(!pool.length){deck.slides[i]=undefined;deck.assigned[i]=deck.furthest;continue;}
   order.push(i);
   if(!pool.some(level=>level.id===deck.slides[i]?.id))deck.slides[i]=pickLevel(pool,weight);
  }
  if(!order.includes(deck.slot))deck.slot=order[0];
  Object.assign(mounted,{deck,order,weight});
 }

 function schedule(){
  clearTimeout(timer);
  if(!mounted?.deck||mounted.order.length<2||mounted.deck.paused||document.hidden)return;
  timer=setTimeout(()=>{
   if(!mounted?.root.isConnected)return;
   const {root,gesture}=mounted;
   if(gesture||hoverable.matches&&root.matches(':hover')||
    root.querySelector(':focus-visible:not([data-banner-rotate])')||document.querySelector('dialog[open]'))schedule();
   else step(1,false);
  },rotationDelay);
 }

 function syncControls(){
  const {deck,arrows,dots,rotation}=mounted;
  arrows.forEach(button=>{button.disabled=mounted.order.length<2;});
  dots.forEach((button,i)=>{
   button.disabled=!deck.slides[i];
   button.title=bannerSlideDifficulties[i]+(button.disabled?' · no available previews':'');
   if(i===deck.slot)button.setAttribute('aria-current','true');
   else button.removeAttribute('aria-current');
  });
  const label=deck.paused?'Play slideshow':'Pause slideshow';
  rotation.disabled=mounted.order.length<2;
  rotation.setAttribute('aria-label',label);
  rotation.title=label;
  rotation.innerHTML=ico(deck.paused?'play':'pause');
 }

 function imageFor(id,className){
  const image=new Image();
  image.className=className;
  image.alt='';
  image.decoding='async';
  image.draggable=false;
  image.addEventListener('error',()=>{image.hidden=true;},{once:true});
  image.src=coverSource(id);
  return image;
 }

 function paintSlide(direction=0,manual=false){
  const {deck,frames,backdrop,status,order}=mounted;
  const {slot}=deck,level=deck.slides[slot];
  syncControls();
  if(!level){frames.textContent='No level previews available.';return;}
  const difficulty=bannerSlideDifficulties[slot];
  const previous=frames.querySelector('.banner-slide:last-child');
  const slide=document.createElement('figure');
  slide.className='banner-slide';
  slide.dataset.difficulty=difficulty;
  slide.dataset.level=level.id;
  const caption=document.createElement('figcaption');
  caption.innerHTML='<img class="banner-level-face" src="'+cardFace(difficulty)+'" width="36" height="36" alt=""><div><strong></strong><small></small></div>';
  caption.querySelector('strong').textContent=level.name;
  caption.querySelector('small').textContent=difficulty;
  slide.append(imageFor(level.id,'banner-level-shot'),caption);
  frames.replaceChildren(slide);
  if(previous&&direction&&!reduced.matches){
   previous.getAnimations().forEach(animation=>animation.cancel());
   previous.setAttribute('aria-hidden','true');
   frames.prepend(previous);
   const motion={duration:390,easing:'cubic-bezier(.2,.65,.3,1)',fill:'both'};
   previous.animate([{transform:'none',opacity:1},{transform:'translateX('+(-direction*22)+'%)',opacity:0}],motion)
    .finished.then(()=>previous.remove(),()=>{});
   slide.animate([{transform:'translateX('+(direction*24)+'%)',opacity:0},{transform:'none',opacity:1}],motion);
  }
  const art=imageFor(level.id,'banner-scenery');
  art.addEventListener('load',()=>{
   if(!slide.isConnected||frames.lastElementChild!==slide)return;
   backdrop.replaceChildren(art);
   if(direction&&!reduced.matches)art.animate([{opacity:0},{opacity:1}],{duration:550});
  },{once:true});
  if(manual)status.textContent=level.name+' · '+difficulty+' · '+(slot+1)+' of '+slotCount;
  const next=order[(order.indexOf(slot)+1)%order.length];
  if(next!==slot)new Image().src=coverSource(deck.slides[next].id);
 }

 function step(direction,manual=true){
  const {deck,order,weight}=mounted;
  if(!deck||order.length<2)return;
  const index=order.indexOf(deck.slot),to=index+direction;
  if(to<0||to===order.length)deck.cycle+=direction;
  deck.furthest=Math.max(deck.furthest,deck.cycle);
  const slot=order[(to+order.length)%order.length];
  // Keep each level until its difficulty is reached on a new forward pass.
  if(direction>0&&deck.cycle===deck.furthest&&deck.assigned[slot]<deck.cycle){
   deck.slides[slot]=pickLevel(levels[slot],weight,deck.slides[slot]);
   deck.assigned[slot]=deck.cycle;
  }
  deck.slot=slot;
  paintSlide(direction,manual);schedule();
 }

 function select(slot){
  const deck=mounted.deck;
  if(!deck?.slides[slot]||slot===deck.slot)return;
  const direction=Math.sign(slot-deck.slot);
  deck.slot=slot;
  paintSlide(direction,true);schedule();
 }

 function paint(){
  if(!mounted)return;
  if(levels){
   prepareDeck();paintSlide();schedule();
  }else if(failed){
   mounted.frames.innerHTML='<div class="banner-preview-error"><p>Level previews couldn’t load.</p>'+
    '<button type="button" class="outline" data-banner-retry>Retry</button></div>';
  }else{
   mounted.frames.innerHTML=loadingMarkup('Loading level previews…');
  }
 }

 function setProfile(key,force=false){
  if(!force&&key===profile&&(levels||pending))return;
  profile=key;levels=null;failed=false;pending=true;
  const ticket=++request;
  if(mounted){
   mounted.deck=null;
   [...mounted.arrows,...mounted.dots,mounted.rotation].forEach(control=>{
    control.disabled=true;
    control.removeAttribute('aria-current');
   });
   clearTimeout(timer);
  }
  paint();
  load().then(data=>{
   if(ticket!==request)return;
   levels=data;paint();
  }).catch(()=>{
   if(ticket!==request)return;
   failed=true;paint();
  }).finally(()=>{if(ticket===request)pending=false;});
 }

 function unmount(){
  clearTimeout(timer);
  mounted?.listeners.abort();
  mounted=null;
 }

 function mount(hero,banner){
  unmount();
  const root=hero.querySelector('.banner-carousel'),card=root.querySelector('.banner-level-card');
  const listeners=new AbortController(),{signal}=listeners;
  const frames=card.querySelector('.banner-frames'),dots=[...root.querySelectorAll('[data-banner-dot]')];
  const arrows=[...card.querySelectorAll('[data-banner-step]')],rotation=root.querySelector('[data-banner-rotate]');
  mounted={root,banner,frames,dots,arrows,rotation,listeners,backdrop:hero.querySelector('.demon-banner-art'),
   status:root.querySelector('.banner-carousel-status'),gesture:null,order:[]};
  root.addEventListener('click',event=>{
   const button=event.target.closest('button');
   if(!button||button.disabled)return;
   if(button.hasAttribute('data-banner-retry'))setProfile(profile,true);
   else if(button===rotation){
    mounted.deck.paused=!mounted.deck.paused;
    syncControls();schedule();
   }else if(button.dataset.bannerStep)step(Number(button.dataset.bannerStep));
   else if(button.hasAttribute('data-banner-dot'))select(Number(button.dataset.bannerDot));
  },{signal});
  root.addEventListener('keydown',event=>{
   if(!mounted.deck||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   if(event.key==='Home')select(mounted.order[0]);
   else if(event.key==='End')select(mounted.order.at(-1));
   else step(event.key==='ArrowLeft'?-1:1);
  },{signal});
  root.addEventListener('pointerleave',schedule,{signal});
  root.addEventListener('focusin',schedule,{signal});
  root.addEventListener('focusout',schedule,{signal});
  document.addEventListener('visibilitychange',schedule,{signal});
  document.addEventListener('close',schedule,{capture:true,signal});
  card.addEventListener('pointerdown',event=>{
   if(!event.isPrimary||event.button!==0||event.target.closest('button')||mounted.order.length<2)return;
   mounted.gesture={id:event.pointerId,x:event.clientX,y:event.clientY};
   card.setPointerCapture(event.pointerId);
   schedule();
  },{signal});
  card.addEventListener('pointermove',event=>{
   const drag=mounted.gesture;
   if(!drag||event.pointerId!==drag.id)return;
   const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
   if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){
    frames.style.setProperty('--banner-drag',Math.max(-32,Math.min(32,dx*.24))+'px');
    card.dataset.dragging='';
   }
  },{signal});
  function finishDrag(event){
   const drag=mounted.gesture;
   if(!drag||event.pointerId!==drag.id)return;
   mounted.gesture=null;
   delete card.dataset.dragging;
   frames.style.removeProperty('--banner-drag');
   const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
   if(event.type==='pointerup'&&Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.2)step(dx<0?1:-1);
   else schedule();
  }
  card.addEventListener('pointerup',finishDrag,{signal});
  card.addEventListener('pointercancel',finishDrag,{signal});
  card.addEventListener('lostpointercapture',finishDrag,{signal});
  paint();
 }

 return {mount,unmount,setProfile};
}
