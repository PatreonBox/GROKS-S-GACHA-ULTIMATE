import {ico} from './icons.js';
import {levelCue,unlockedBetween} from './level-access.js';

export function setupLevelUps(dialog,sound){
 let pending,active,timer=0,countFrame=0;
 function continueTo(href){
  if(!active)return;
  const target=href||active.primary?.href;
  active=null;cancelAnimationFrame(countFrame);
  if(!pending)delete document.documentElement.dataset.levelUpPending;
  dialog.close();
  if(target&&target!==location.hash){location.hash=target;window.scrollTo({top:0,behavior:'instant'})}
  schedule();
 }
 function show(){
  timer=0;
  if(!pending||active||document.hidden||document.body.dataset.account!=='ready')return;
  if(document.querySelector('dialog[open]')){schedule(140);return}
  const {from,to}=pending;
  pending=null;
  const items=unlockedBetween(from,to);
  const newest=items.at(-1)?.level;
  const primary=items.find(item=>item.level===newest);
  const cue=levelCue(from,to);
  const celebration={primary};
  active=celebration;
  dialog.dataset.milestone=String(cue==='levelMilestone');
  dialog.dataset.multi=String(to-from>1);
  dialog.innerHTML='<div class="level-up-panel"><div class="level-light" aria-hidden="true"></div>'+
   '<span class="level-wing level-wing-left" aria-hidden="true"></span><span class="level-wing level-wing-right" aria-hidden="true"></span>'+
   '<div class="level-up-emblem" aria-hidden="true"><img src="/assets/gd-star.png" alt=""></div>'+
   '<h2 id="levelUpTitle">Level up!</h2><strong class="level-up-number" aria-label="Level '+to+'">'+to+'</strong>'+
   (items.length?'<h3>Unlocked</h3><div class="level-rewards">'+items.map((item,i)=>
    '<button type="button" class="level-reward" data-reward="'+i+'" data-open-section="'+item.href+'">'+
    (item.art?'<img src="'+item.art+'" alt="">':ico(item.icon))+'<span><b>'+item.name+'</b><small>'+item.detail+'</small></span>'+ico('right')+'</button>'
   ).join('')+'</div>':'')+
   '<button class="level-up-continue" type="button" data-continue-level>Click anywhere to continue</button></div>';
  dialog.showModal();
  dialog.querySelector('[data-continue-level]').focus({preventScroll:true});
  const generation=sound.generation,loading=sound.prepareGame(cue);
  const play=()=>{if(active===celebration&&generation===sound.generation)sound.playGame(cue,{level:.79})};
  if(loading)loading.then(play);else play();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const target=dialog.querySelector('.level-up-number'),start=performance.now();
  function count(now){
   const ratio=Math.min(1,(now-start)/540);
   target.textContent=Math.min(to,from+Math.round((to-from)*(1-(1-ratio)**3)));
   if(ratio<1&&active)countFrame=requestAnimationFrame(count);
  }
  countFrame=requestAnimationFrame(count);
 }
 function schedule(delay=240){
  if(timer||!pending||active)return;
  timer=setTimeout(show,delay);
 }
 document.addEventListener('gdlb-level-up',event=>{
  const {from,to}=event.detail;
  pending=pending?{from:Math.min(pending.from,from),to:Math.max(pending.to,to)}:{from,to};
  document.documentElement.dataset.levelUpPending='true';
  schedule();
 });
 document.addEventListener('visibilitychange',()=>schedule());
 dialog.addEventListener('click',event=>continueTo(event.target.closest('[data-open-section]')?.dataset.openSection));
 dialog.addEventListener('cancel',event=>{event.preventDefault();continueTo()});
 dialog.addEventListener('close',()=>{
  active=null;cancelAnimationFrame(countFrame);
  if(!pending)delete document.documentElement.dataset.levelUpPending;
  schedule();
 });
}
