import {limboKeyColors,limboPattern,limboRevealMs,limboShuffleMs} from './limbo-keys.js';

const keyShape='<svg viewBox="0 0 80 80" aria-hidden="true"><path d="m43 40 20 23 10-8-7-9-4 3-4-4 4-3-6-7-6 5m-11 1c-7 9-20 10-28 2s-7-21 1-29c8-7 20-7 27 1 7 7 7 19 0 26Z"/><path d="M22 23a8 8 0 1 0 11 11 8 8 0 0 0-11-11Z"/></svg>';

export function openLimboFinale(viewport,seed,sound,submit){
 const {starting,swaps,answer}=limboPattern(seed);
 const scene=document.createElement('section');
 scene.className='limbo-finale';
 scene.setAttribute('aria-label','LIMBO key challenge');
 scene.innerHTML='<div class="limbo-finale-heading"><div><p>MEMORY FINALE</p><h3>Track the green key</h3></div><b data-limbo-phase>Watch</b></div>'+
  '<div class="limbo-key-grid" aria-label="Eight keys"></div><p class="limbo-cue" aria-live="polite">Remember where the green key goes.</p>';
 viewport.append(scene);
 const grid=scene.querySelector('.limbo-key-grid'),status=scene.querySelector('[data-limbo-phase]'),cue=scene.querySelector('.limbo-cue');
 const slots=starting.slice(),keys=[],buttons=[];
 let timer=0,disposed=false,chosen=false,settled=false,choosing=false,finishTimer;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const listeners=new AbortController(),{signal}=listeners;
 const music=new Audio('/assets/audio/limbo-finale.mp3');
 music.volume=.60;
 const syncMusic=()=>{
  if(!chosen&&!disposed&&!document.hidden&&sound.enabled)music.play().catch(()=>{});
  else music.pause();
 };
 function arrange(){
  slots.forEach((id,slot)=>{keys[id].style.setProperty('--slot',slot);keys[id].style.setProperty('--column',slot%4);keys[id].style.setProperty('--row',Math.floor(slot/4));});
 }
 for(let i=0;i<8;i++){
  const key=document.createElement('span');
  key.className='limbo-key';
  key.innerHTML=keyShape;
  key.style.setProperty('--key-color',limboKeyColors[i]);
  if(i===0)key.classList.add('is-green');
  grid.append(key);keys.push(key);
  const button=document.createElement('button');
  button.type='button';button.disabled=true;button.className='limbo-choice';
  button.setAttribute('aria-label','Key '+(i+1));
  button.textContent=i+1;
  button.style.setProperty('--column',i%4);button.style.setProperty('--row',Math.floor(i/4));
  button.onclick=()=>pick(i);
  grid.append(button);buttons.push(button);
 }
 arrange();syncMusic();
 document.addEventListener('visibilitychange',syncMusic,{signal});
 function step(index){
  if(disposed)return;
  if(index===swaps.length){
   choosing=true;status.textContent='Choose';cue.textContent='Pick a slot, or press 1–8.';
   scene.dataset.phase='choose';
   for(const button of buttons)button.disabled=false;
   grid.tabIndex=0;grid.focus({preventScroll:true});
   return;
  }
  scene.dataset.phase='shuffle';status.textContent=(index+1)+' / '+swaps.length;
  if(index===0)cue.textContent='Follow the key through the swap.';
  const ms=limboShuffleMs[index];
  const previous=slots.slice();
  for(const [a,b] of swaps[index])[slots[a],slots[b]]=[slots[b],slots[a]];
  arrange();
  slots.forEach((id,position)=>{
   const start=previous.indexOf(id);
   if(position===start||reduced)return;
   const x=(start%4-position%4)*100,y=(Math.floor(start/4)-Math.floor(position/4))*100;
   const distance=Math.hypot(x,y);
   const sign=(id%2?1:-1)*Math.sign(x||y);
   const bend=Math.min(33,distance*.20)*sign;
   keys[id].animate([{translate:x+'% '+y+'%'},{translate:(x*.5+bend)+'% '+(y*.5-bend)+'%'},{translate:'0% 0%'}],
    {duration:ms*.91,easing:'cubic-bezier(.37,.05,.38,1)'});
  });
  timer=setTimeout(()=>step(index+1),ms);
 }
 async function pick(slot){
  if(!choosing||chosen||disposed)return;
  chosen=true;scene.dataset.phase='reveal';music.pause();
  for(const button of buttons)button.disabled=true;
  buttons[slot].dataset.picked='true';
  const won=slot===answer;
  buttons[answer].dataset.answer='true';
  status.textContent=won?'Correct':'Wrong key';
  cue.textContent=won?'That was the green key.':'The green key landed in slot '+(answer+1)+'.';
  finishTimer=setTimeout(()=>{if(!disposed&&!settled){settled=true;submit(slot,won);}},1050);
 }
 let held=null;
 function slotAt(event){
  const box=grid.getBoundingClientRect(),x=(event.clientX-box.left)/box.width,y=(event.clientY-box.top)/box.height;
  if(x<0||x>=1||y<0||y>=1)return -1;
  return Math.floor(y*2)*4+Math.floor(x*4);
 }
 function preview(event){const slot=slotAt(event);buttons.forEach((button,index)=>button.toggleAttribute('data-hover',index===slot));}
 grid.addEventListener('pointerdown',event=>{
  if(!choosing||chosen||held!==null||event.button!==0)return;
  held=event.pointerId;grid.setPointerCapture(held);preview(event);
 },{signal});
 grid.addEventListener('pointermove',event=>{if(event.pointerId===held)preview(event);},{signal});
 grid.addEventListener('pointerup',event=>{
  if(event.pointerId!==held)return;
  held=null;const slot=slotAt(event);
  buttons.forEach(button=>button.removeAttribute('data-hover'));
  if(slot>=0)pick(slot);
 },{signal});
 grid.addEventListener('pointercancel',()=>{held=null;buttons.forEach(button=>button.removeAttribute('data-hover'));},{signal});
 scene.addEventListener('keydown',event=>{
  if(choosing&&/^[1-8]$/.test(event.key)){event.preventDefault();pick(Number(event.key)-1);}
 },{signal});
 timer=setTimeout(()=>step(0),limboRevealMs);
 return ()=>{disposed=true;clearTimeout(timer);clearTimeout(finishTimer);listeners.abort();music.pause();music.removeAttribute('src');music.load();scene.remove();};
}
