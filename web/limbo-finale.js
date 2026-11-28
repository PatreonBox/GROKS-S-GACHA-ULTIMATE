import {limboPattern,limboRevealMs,limboShuffleMs} from './limbo-keys.js';

const keyArt='<svg viewBox="0 0 138 78" aria-hidden="true">'+
 '<path class="limbo-key-rim" fill-rule="evenodd" d="M7 34 23 14 41 8 59 19 65 30h47l10-5 10 9-9 17h-12v10H99V51H89v15H75V50H63L48 66l-21 5L9 56Zm18 2 10-12 12 5 6 11-11 12-13-1-7-8Z"/>'+
 '<path class="limbo-key-shadow" d="m12 46 17 14 17-3 15-16h17v17h8V43h16v11h6V43h13l4-8 3 1-8 12h-12v10H102V48H86v15h-8V47H62L46 63l-18 5-16-14Z"/>'+
 '<path class="limbo-key-enamel" fill-rule="evenodd" d="m12 35 14-16 14-6 16 9 6 13h50l10-5 5 5-6 11h-13v10h-6V46H85v15h-7V46H62L46 61l-17 4-15-13Zm10 0 3 14 14 6 16-15-8-13-12-6Z"/>'+
 '<path class="limbo-key-inlay" d="m33 15 7-2 16 9 6 13h50l10-5 3 3-12 7H59l-7-15Zm-14 32 9 11 9 2-7 1-12-9Z"/>'+
 '<path class="limbo-key-shine" d="m15 35 12-15 12-4-11 7-10 12Zm56 3h30v2H71Z"/></svg>';

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
