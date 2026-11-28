import {limboPattern,limboRevealMs,limboShuffleMs} from './limbo-keys.js';

const keyArt='<svg viewBox="0 0 122 78" aria-hidden="true">'+
 '<path class="limbo-key-iron" fill-rule="evenodd" d="M7 23 29 8 48 11 64 28h50l4 12-8 9H99v11H86V49H64L49 68 26 71 7 56 3 39Zm22 5-9 9 5 14 15 3 11-12-9-14Z"/>'+
 '<path class="limbo-key-bevel" d="m11 27 19-14 16 3 14 17h50l2 5H57L43 23H28L16 34 13 45 9 39Z"/>'+
 '<path class="limbo-key-shadow" d="m10 48 17 14 19-3 14-16h27v11h7V43h15l-4 3H97v11H89V46H63L48 65l-21 3L11 55Z"/>'+
 '<path class="limbo-key-rune" d="m32 18 6 1 2 5-8 1-5-3ZM66 36h30v3H66Z"/></svg>';

export function openLimboFinale(viewport,seed,submit){
 const {starting,swaps,answer}=limboPattern(seed);
 const scene=document.createElement('section');
 scene.className='limbo-finale';scene.dataset.phase='watch';
 scene.setAttribute('aria-label','LIMBO key challenge');
 scene.innerHTML='<div class="limbo-finale-heading"><h3>Track the green key</h3><b data-limbo-phase>Watch</b></div>'+
  '<div class="limbo-key-grid" role="group" aria-label="Eight key slots"></div>'+
  '<p class="limbo-cue" aria-live="polite">Remember where the green key goes.</p>';
 viewport.append(scene);
 const grid=scene.querySelector('.limbo-key-grid'),status=scene.querySelector('[data-limbo-phase]'),cue=scene.querySelector('.limbo-cue');
 const slots=starting.slice(),keys=[],buttons=[];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduced)scene.dataset.reducedMotion='';
 const listeners=new AbortController(),{signal}=listeners;
 let timer=0,task,deadline=0,timeLeft=0,held=null,motions=[];

 function place(node,slot){
  node.style.setProperty('--column',slot%4);
  node.style.setProperty('--row',Math.floor(slot/4));
 }
 function arrange(){slots.forEach((id,slot)=>place(keys[id],slot))}
 for(let i=0;i<8;i++){
  const key=document.createElement('span'),button=document.createElement('button');
  key.className='limbo-key';key.innerHTML=keyArt;
  key.toggleAttribute('data-target-key',i===0);
  button.type='button';button.disabled=true;button.className='limbo-choice';
  button.setAttribute('aria-label','Key slot '+(i+1));
  button.textContent=i+1;
  place(button,i);
  button.onclick=()=>pick(i);
  grid.append(key,button);keys.push(key);buttons.push(button);
 }
 arrange();

 function arm(){
  if(!task||document.hidden)return;
  deadline=performance.now()+timeLeft;
  timer=setTimeout(()=>{
   timer=0;const callback=task;task=null;callback();
  },timeLeft);
 }
 function schedule(callback,ms){task=callback;timeLeft=ms;arm()}
 function visibilityChanged(){
  if(document.hidden){
   if(timer){clearTimeout(timer);timer=0;timeLeft=Math.max(0,deadline-performance.now())}
   for(const motion of motions)if(motion.playState==='running')motion.pause();
   return;
  }
  for(const motion of motions)if(motion.playState==='paused')motion.play();
  arm();
 }
 document.addEventListener('visibilitychange',visibilityChanged,{signal});

 function shuffle(index){
  for(const motion of motions)motion.cancel();
  motions=[];
  for(const key of keys)delete key.dataset.moving;
  if(index===swaps.length){
   scene.dataset.phase='choose';status.textContent='Choose';cue.textContent='Tap the final slot or press 1–8.';
   for(const button of buttons)button.disabled=false;
   grid.tabIndex=-1;grid.focus({preventScroll:true});
   return;
  }
  scene.dataset.phase='shuffle';status.textContent=(index+1)+' / '+swaps.length;
  const exchanges=swaps[index],ms=limboShuffleMs[index];
  if(reduced){
   exchanges.forEach(([a,b],pair)=>{keys[slots[a]].dataset.moving=keys[slots[b]].dataset.moving=pair+1});
   cue.textContent=exchanges.map(([a,b])=>(a+1)+' ↔ '+(b+1)).join(' and ');
   schedule(()=>{
    for(const [a,b] of exchanges)[slots[a],slots[b]]=[slots[b],slots[a]];
    arrange();shuffle(index+1);
   },Math.max(950,ms));
   return;
  }
  if(index===0)cue.textContent='Follow the key as the paths cross.';
  exchanges.forEach(([a,b],pair)=>{
   [slots[a],slots[b]]=[slots[b],slots[a]];
   for(const [from,to] of [[b,a],[a,b]]){
    const key=keys[slots[to]],side=from===a?1:-1;
    key.dataset.moving=pair+1;
    place(key,to);
    const x=(from%4-to%4)*100,y=(Math.floor(from/4)-Math.floor(to/4))*100;
    motions.push(key.animate([
     {translate:x+'% '+y+'%',rotate:'0deg',scale:'1'},
     {offset:.5,translate:(x*.5+y*.07*side)+'% '+(y*.5-x*.07*side)+'%',rotate:side*(pair?10:24)+'deg',scale:pair?'.82':'1.18'},
     {translate:'0% 0%',rotate:'0deg',scale:'1'}
    ],{duration:ms*.94,easing:'cubic-bezier(.3,.06,.24,1)'}));
   }
  });
  schedule(()=>shuffle(index+1),ms);
 }

 function pick(slot){
  if(scene.dataset.phase!=='choose')return;
  scene.dataset.phase='answer';
  for(const button of buttons)button.disabled=true;
  buttons[slot].dataset.picked='true';
  buttons[answer].dataset.answer='true';
  const won=slot===answer;
  status.textContent=won?'Correct':'Wrong key';
  cue.textContent=won?'You found the green key.':'The green key landed in slot '+(answer+1)+'.';
  schedule(()=>submit(slot,won),900);
 }
 function slotAt(event){
  const box=grid.getBoundingClientRect(),x=(event.clientX-box.left)/box.width,y=(event.clientY-box.top)/box.height;
  if(x<0||x>=1||y<0||y>=1)return -1;
  return Math.floor(y*2)*4+Math.floor(x*4);
 }
 function highlight(slot){buttons.forEach((button,index)=>button.toggleAttribute('data-hover',index===slot))}
 grid.addEventListener('pointerdown',event=>{
  if(scene.dataset.phase!=='choose'||held!==null||event.button!==0)return;
  held=event.pointerId;grid.setPointerCapture(held);highlight(slotAt(event));
 },{signal});
 grid.addEventListener('pointermove',event=>{if(event.pointerId===held)highlight(slotAt(event))},{signal});
 grid.addEventListener('pointerup',event=>{
  if(event.pointerId!==held)return;
  held=null;const slot=slotAt(event);highlight(-1);
  if(slot>=0)pick(slot);
 },{signal});
 grid.addEventListener('lostpointercapture',()=>{held=null;highlight(-1)},{signal});
 scene.addEventListener('keydown',event=>{
  if(scene.dataset.phase==='choose'&&/^[1-8]$/.test(event.key)){event.preventDefault();pick(Number(event.key)-1)}
 },{signal});
 schedule(()=>shuffle(0),limboRevealMs);
 return ()=>{clearTimeout(timer);listeners.abort();for(const motion of motions)motion.cancel();scene.remove()};
}
