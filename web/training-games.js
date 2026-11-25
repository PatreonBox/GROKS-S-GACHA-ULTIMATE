import {createDrillViewport} from './drill-world-view.js';
import {drillTypes} from './card-skills.js';
import {starterCube} from './cube-catalog.js';
import {helpButton,installMinigameGuide,drillGuide} from './minigame-guide.js';
import {activeDrillGate,drillPace,drillStep,makeDrill,stepDrill,portalSlot} from './drill-physics.js';

import {seededRandom,drillInput} from './game-replay.js';

const laneNames=['Left','Center','Right'];
const portalNames=['Yellow','Green','Blue'];
const compact=n=>Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
const leftKeys=new Set(['ArrowLeft','KeyA']),rightKeys=new Set(['ArrowRight','KeyD']);
const instructions={
 spike:'Hold Space or Charge. Release at the gold notch when the wall enters range.',
 saw:'Use A/D or drag to steer through the opening between the saws.',
 endurance:'Use A/D or tap Left, Center or Right to cross through a lit portal.'
};
export function openDrill({kind,name,best=0,sound,onStart,onCheckpoint,onFinish,onClose,avatar=starterCube}){
 const drill=drillTypes[kind],forge=kind==='spike',saw=kind==='saw';
 const dialog=document.createElement('dialog');
 dialog.className='drill-modal';dialog.style.setProperty('--drill',drill.color);dialog.setAttribute('aria-label',drill.name);
 const labels=forge?['Hold to charge']:saw?['◀ Left','Right ▶']:laneNames;
 dialog.innerHTML='<div class="drill-rail"><div><span>ENDLESS TRAINING</span><h2>'+drill.name+'</h2><p class="drill-level"></p></div><div class="minigame-actions">'+helpButton+'<button type="button" data-exit aria-label="Close training">×</button></div></div>'+
  '<div class="drill-stage"><canvas tabindex="0" aria-label="'+drill.name+' 3D playfield"></canvas><div class="drill-readout"><b data-score>0 cleared</b><span data-speed></span><span data-best></span></div>'+
  '<div class="drill-banner" data-banner></div>'+
  (!forge&&!saw?'<div class="drill-gravity" data-gravity>↓ Normal gravity</div>':'')+
  (forge?'<div class="forge-charge"><span data-forge-state></span><div class="forge-meter"><i></i><b></b></div></div>':'')+'</div>'+
  '<div class="drill-touch game-touch" hidden>'+labels.map((text,i)=>'<button type="button" data-lane="'+i+'">'+text+'</button>').join('')+'</div>'+
  '<div class="drill-foot"><strong role="status"></strong><div class="drill-actions"></div></div>';
 document.body.append(dialog);
 const card=dialog.querySelector('.drill-level'),icon=document.createElement('img');
 icon.src=avatar.icon;icon.alt='';icon.title=avatar.name;
 card.append(icon,document.createTextNode(name));
 const field=dialog.querySelector('.drill-stage'),actions=dialog.querySelector('.drill-actions'),label=dialog.querySelector('.drill-foot strong');
 field.dataset.drill=kind;
 const pad=dialog.querySelector('.drill-touch'),banner=dialog.querySelector('[data-banner]'),score=dialog.querySelector('[data-score]'),speed=dialog.querySelector('[data-speed]'),record=dialog.querySelector('[data-best]');
 const meter=dialog.querySelector('.forge-charge'),meterLabel=dialog.querySelector('[data-forge-state]');
 const gravity=dialog.querySelector('[data-gravity]');
 const view=createDrillViewport(field.querySelector('canvas'),field,avatar);
 const canvas=view?.canvas;
 let run=makeDrill(kind),phase='ready',frame=0,last=0,carry=0,token=null,closeOnSaved=false,bankReason='',flashAt=-Infinity;
 const keys=new Set(),pointerDirs=new Map();
 let pointer=null,ticks=0,trace=[],recordedAxis=0,verified=0,checkpoint=null,pendingProof=null,retryAt=0;
 const guide=installMinigameGuide(dialog,drillGuide(kind,drill),pause);
 const update=(el,value)=>{if(el.textContent!==value)el.textContent=value};
 function render(force=false){
  view?.draw(run,force);
  const pace=drillPace(kind,run.time),gate=activeDrillGate(run);
  update(score,compact(run.score)+' cleared');
  update(speed,Math.round(pace.speed/drillPace(kind,0).speed*100)+'% speed');
  update(record,'Best '+compact(Math.max(best,run.score)));
  if(gravity){update(gravity,run.inverted?'↑ Reverse gravity · Controls swapped':'↓ Normal gravity');gravity.classList.toggle('inverted',run.inverted)}
  const inRange=(gate.distance-run.dist)/pace.speed<=pace.strike;
  if(forge){
   meter.style.setProperty('--power',run.charge);meter.style.setProperty('--notch',gate.charge);
   meter.style.setProperty('--window',pace.opening);
   meter.classList.toggle('can-strike',inRange);
   update(meterLabel,inRange?'STRIKE ZONE':'NEXT WALL');
  }
  const recent=run.time-flashAt<.45&&run.lastGate;
  if(phase==='done'||phase==='saving')update(banner,bankReason==='crash'?'RUN ENDED':'RUN BANKED');
  else if(recent)update(banner,run.lastGate.portal?run.lastGate.portal.toUpperCase()+' · '+(run.inverted?'FLIPPED':'UPRIGHT'):run.lastGate.quality==='perfect'?'PERFECT':'CLEAR');
  else if(!forge&&!saw&&gate)update(banner,gate.lanes.map(i=>laneNames[i]+' · '+portalNames[portalSlot(gate,i)]).join(' / '));
  else update(banner,'');
 }
 function button(title,fn){const item=document.createElement('button');item.type='button';item.textContent=title;item.onclick=fn;actions.append(item);return item}
 function control(kind,value=null){
  drillInput(run,kind,value);
  if(!token)return;
  const last=trace.at(-1);
  if(kind==='aim'&&last?.[0]===ticks&&last[1]==='aim')last[2]=value;
  else trace.push([ticks,kind,value]);
 }
 function clearInputs(){
  keys.clear();pointerDirs.clear();pointer=null;control('reset');
 }
 function pause(){
  if(phase!=='running')return;
  phase='paused';pad.hidden=true;clearInputs();cancelAnimationFrame(frame);actions.replaceChildren();
  label.textContent='Paused · '+instructions[kind];
  button('Resume',play).focus({preventScroll:true});button('Bank and exit',()=>bank('stopped',true));render();
 }
 function play(){
  phase='running';pad.hidden=false;last=0;carry=0;actions.replaceChildren();
  button('Pause',pause);label.textContent=instructions[kind];canvas.focus({preventScroll:true});frame=requestAnimationFrame(loop);
 }
 function saveCheckpoint(){
  if(checkpoint)return checkpoint;
  if(!pendingProof){
   const split=trace.findIndex(event=>event[0]>=ticks);
   const count=split<0?trace.length:split;
   pendingProof={from:verified,ticks,trace:trace.slice(0,count)};
  }
  const proof=pendingProof;
  checkpoint=onCheckpoint(token,proof).then(()=>{
   verified=proof.ticks;
   trace.splice(0,proof.trace.length);
   pendingProof=null;
  }).finally(()=>{checkpoint=null;});
  return checkpoint;
 }
 async function bank(reason,exit=false){
  if(phase==='saving')return;
  bankReason=reason;closeOnSaved=exit;phase='saving';pad.hidden=true;clearInputs();cancelAnimationFrame(frame);actions.replaceChildren();
  label.textContent='Saving run…';render();
  try{
   if(checkpoint||pendingProof)await saveCheckpoint();
   const outcome=await onFinish(token,{from:verified,ticks,trace});
   if(!dialog.open)return;
   token=null;
   if(closeOnSaved){dialog.close();return}
   phase='done';best=Math.max(best,run.score);
   label.textContent=compact(run.score)+' cleared · '+compact(run.perfect)+' perfect · '+outcome;
   if(run.score>=2)sound.play('trainWin',{level:.56});
   button('Run again',start).focus({preventScroll:true});button('Back to training',()=>dialog.close());render();
  }catch(e){
   if(dialog.open){
    phase='retry-save';label.textContent=e.message;
    button('Retry saving',()=>bank(reason,exit));button('Close',()=>dialog.close());
   }
  }
 }
 function loop(now){
  if(phase!=='running')return;
  const axis=Number([...keys].some(key=>rightKeys.has(key))||[...pointerDirs.values()].includes(1))-
   Number([...keys].some(key=>leftKeys.has(key))||[...pointerDirs.values()].includes(-1));
  carry+=last?Math.min(.12,(now-last)/1000):0;last=now;
  while(carry>=drillStep){
   if(axis!==recordedAxis){trace.push([ticks,'axis',axis]);recordedAxis=axis;}
   stepDrill(run,drillStep,axis);ticks++;carry-=drillStep;
   if(run.event?.quality==='miss'){
    sound.play('enemyHit',{level:.76,seed:run.score});bank('crash');return;
   }
   if(run.event){
    flashAt=run.time;
    if(run.event.portal)sound.playGame('portal',{rate:run.inverted?.92:1.13,level:.57});
    else if(forge&&run.event.quality==='hit')sound.playGame('forge',{level:.64});
    else sound.play(run.event.quality==='perfect'?'perfect':'spin',{level:.62,seed:run.score});
   }
  }
  if(ticks-verified>=3600&&ticks>=retryAt&&!checkpoint){
   retryAt=ticks+120;saveCheckpoint().catch(()=>{});
  }
  render();frame=requestAnimationFrame(loop);
 }
 async function start(){
  if(!canvas||!['ready','done'].includes(phase))return;
  phase='starting';actions.replaceChildren();sound.prepareGame();
  try{
   const started=await onStart();
   token=started.token;
   if(!dialog.open){await onFinish(token,{ticks:0,trace:[]});return}
   ticks=0;trace=[];recordedAxis=0;verified=0;checkpoint=null;pendingProof=null;retryAt=0;
   run=makeDrill(kind,seededRandom(started.seed));flashAt=-Infinity;render();sound.play('telegraph');play();
   if(guide.open)pause();
  }catch(e){if(dialog.open){phase='ready';label.textContent=e.message;button('Try again',start)}}
 }
 function keydown(e){
  if(phase!=='running')return;
  if(e.code==='KeyP'){e.preventDefault();pause();return}
  if(e.target!==canvas)return;
  if(forge&&e.code==='Space'){e.preventDefault();if(!e.repeat)control('press');return}
  const axis=leftKeys.has(e.code)?-1:rightKeys.has(e.code)?1:0;
  if(!axis||forge)return;
  e.preventDefault();
  if(saw)keys.add(e.code);
  else if(!e.repeat)control('shift',axis);
 }
 function keyup(e){
  if(phase==='running'&&forge&&e.code==='Space'){control('release');return}
  keys.delete(e.code);
 }
 function aimAt(e){
  const x=view.worldX(e.clientX);
  if(saw)control('aim',x);
  else if(!forge)control('lane',x<-76?0:x>76?2:1);
 }
 function exit(){
  if(phase==='saving'){closeOnSaved=true;return}
  if(phase==='running'||phase==='paused'){bank('stopped',true);return}
  dialog.close();
 }
 if(canvas){
  canvas.onpointerdown=e=>{
   if(phase!=='running'||e.button!==0||pointer!==null)return;
   e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointer=e.pointerId;
   if(forge)control('press');else aimAt(e);
  };
  canvas.onpointermove=e=>{if(phase==='running'&&saw&&(pointer===e.pointerId||e.pointerType==='mouse'))aimAt(e)};
  canvas.onpointerup=e=>{if(pointer===e.pointerId){if(forge)control('release');pointer=null}};
  canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(pointer===e.pointerId)pause()};
 }
 for(const control of pad.querySelectorAll('button')){
  const index=Number(control.dataset.lane);
  control.onpointerdown=e=>{
   if(phase!=='running'||e.button!==0)return;
   e.preventDefault();canvas.focus({preventScroll:true});control.setPointerCapture(e.pointerId);
   pointerDirs.set(e.pointerId,saw?index*2-1:0);
   if(forge)control('press');else if(!saw)control('lane',index);
  };
  control.onpointerup=control.onlostpointercapture=e=>{
   if(pointerDirs.delete(e.pointerId)&&forge)control('release');
  };
  control.onpointercancel=pause;
 }
 const hidden=()=>{if(document.hidden)pause()};
 const resize=new ResizeObserver(()=>{if(phase!=='running')render(true)});
 dialog.addEventListener('keydown',keydown);
 dialog.addEventListener('cancel',e=>{e.preventDefault();exit()});
 window.addEventListener('keyup',keyup);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',hidden);
 dialog.querySelector('[data-exit]').onclick=exit;
 dialog.addEventListener('close',()=>{
  phase='closed';resize.disconnect();cancelAnimationFrame(frame);view?.close();
  window.removeEventListener('keyup',keyup);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',hidden);
  sound.stop();dialog.remove();onClose();
 },{once:true});
 dialog.showModal();resize.observe(field);
 label.textContent=canvas?instructions[kind]+' One miss ends the run.':'The 3D playfield is unavailable in this browser.';
 if(canvas){button('Begin run',start).focus({preventScroll:true});render(true)}
 guide.welcome();
 return dialog;
}
