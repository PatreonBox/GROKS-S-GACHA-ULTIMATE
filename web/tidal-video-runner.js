import {ico} from './icons.js';
import {bindRunnerControls} from './remix-controls.js';
import {drawWave,drawWaveTrail,keepWavePoint,waveRise} from './remix-wave.js';
import {newTidalWave,stepTidalWave,tidalLength,tidalStart,tidalStep,tidalWidth,tidalHeight,tidalX,tidalVideoMode} from './tidal-video-rules.js';

const source='/arcade-video/tidal-wave.mp4';
const waveDuration=Math.ceil(tidalLength/tidalStep);

export function openTidalVideo(remix,{avatar,sound,onStart,onResult}){
 const dialog=document.createElement('dialog');
 dialog.className='runner-modal tidal-video';
 dialog.setAttribute('aria-label',remix.name);
 dialog.style.setProperty('--remix',remix.color);
 dialog.innerHTML='<div class="runner-bar"><div class="runner-title"><div><span>MINI GAMES · NORMAL · WAVE</span><h2>Tidal Wave</h2></div></div>'+
  '<div class="minigame-actions"><button type="button" data-tidal-audio aria-label="Video audio"></button>'+
  '<button type="button" data-tidal-close aria-label="Close level">×</button></div></div>'+
  '<div class="runner-frame tidal-stage"><video playsinline preload="auto" aria-hidden="true" src="'+source+'"></video>'+
  '<canvas width="'+tidalWidth+'" height="'+tidalHeight+'" tabindex="0" aria-label="Wave course. Hold Space, mouse, or touch to climb. Release to dive."></canvas>'+
  '<div class="runner-status"><span class="runner-attempt" data-size>WAVE</span><span class="runner-progress">0%</span></div></div>'+
  '<div class="runner-controls"><div class="runner-message" role="status"></div><button type="button" class="runner-touch game-touch" hidden>Hold to climb</button>'+
  '<div class="runner-buttons"><button type="button" data-tidal-action>Start</button></div></div>';
 const video=dialog.querySelector('video'),canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d');
 const output=dialog.querySelector('.runner-message'),readout=dialog.querySelector('.runner-progress'),size=dialog.querySelector('[data-size]');
 const action=dialog.querySelector('[data-tidal-action]'),audio=dialog.querySelector('[data-tidal-audio]');
 const pad=dialog.querySelector('.runner-touch');
 const touch=matchMedia('(pointer:coarse)');
 let phase='ready',run=newTidalWave(),trace=[],trail=[],token,frame=null,lastPortal=-Infinity;
 let quiet=false,closed=false,terminal=false,held=false,applied=0;
 const frameByVideo=typeof video.requestVideoFrameCallback==='function';
 function syncAudio(){
  video.muted=quiet||!sound.enabled;
  audio.innerHTML=ico(video.muted?'muted':'volume');
  audio.setAttribute('aria-pressed',String(!video.muted));
 }
 function paint(){
  const time=run.tick*tidalStep;
  ctx.clearRect(0,0,tidalWidth,tidalHeight);
  if(phase!=='ready'){
   const scroll=run.distance-tidalX;
   const points=trail.map(([x,y])=>[x-scroll,y]);
   drawWaveTrail(ctx,points,{skin:avatar,mini:run.mini});
   drawWave(ctx,{x:tidalX,y:run.y,angle:time<tidalStart?0:Math.atan(waveRise(1,run.held,run.mini)),mini:run.mini,skin:avatar});
  }
  const age=time-lastPortal;
  if(age<.37){
   ctx.save();
   ctx.translate(tidalX,run.y);ctx.globalAlpha=1-age/.37;
   ctx.strokeStyle=run.mini?'#ff82e5':'#97ffc5';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=13;ctx.lineWidth=2.2;
   const reach=16+age*145;
   for(let i=0;i<6;i++){
    ctx.save();ctx.rotate(i*Math.PI/3+age*2);ctx.beginPath();
    ctx.moveTo(reach*.28,0);ctx.lineTo(reach*.48,reach*.16);ctx.lineTo(reach*.65,-reach*.08);ctx.lineTo(reach,reach*.1);ctx.stroke();ctx.restore();
   }
   ctx.restore();
  }
  size.textContent=time<tidalStart&&phase==='running'?'GET READY':run.mini?'MINI WAVE':'WAVE';
  readout.textContent=(phase==='clear'?100:Math.min(99,Math.floor(time/tidalLength*100)))+'%';
 }
 function show(next,message){
  phase=next;output.textContent=message;
  action.hidden=next==='running';
  pad.hidden=next!=='running'||!touch.matches;
  action.disabled=next==='loading';
  action.textContent=next==='loading'?'Loading…':next==='paused'?'Resume':next==='ready'?'Start':'Retry';
  paint();
 }
 function finish(result){
  if(phase!=='running')return;
  video.pause();stopFrame();
  const attempt=token;
  show(result,result==='clear'?'Tidal Wave cleared!':'The wave touched the edge of the screen.');
  action.focus({preventScroll:true});
  onResult(attempt,{ticks:run.tick,trace:trace.slice(0,applied)}).then(receipt=>{
   if(closed||token!==attempt||!receipt?.cleared)return;
   const prizes=[];
   if(receipt.demonKeys)prizes.push('+'+receipt.demonKeys+' Demon Keys');
   if(receipt.playerXpEarned)prizes.push('+'+receipt.playerXpEarned+' XP');
   if(prizes.length)output.textContent='Tidal Wave cleared! '+prizes.join(' · ');
  }).catch(()=>{if(!closed&&token===attempt)output.textContent+=' Your record could not be saved.'});
 }
 function advance(target){
  while(phase==='running'&&!terminal&&run.tick<target){
   while(trace[applied]?.[0]===run.tick)run.held=trace[applied++][2];
   const before=run.portal,status=stepTidalWave(run);
   if(run.portal!==before)lastPortal=run.tick*tidalStep;
   if(run.tick*tidalStep>=tidalStart)keepWavePoint(trail,run.distance,run.y,tidalX);
   if(status==='crash')finish(status);
   if(status==='clear')terminal=true;
  }
 }
 function scheduleFrame(){
  if(phase!=='running'||frame!==null)return;
  frame=frameByVideo?video.requestVideoFrameCallback((_,{mediaTime})=>draw(mediaTime)):
   requestAnimationFrame(()=>draw(video.currentTime));
 }
 function stopFrame(){
  if(frame===null)return;
  if(frameByVideo)video.cancelVideoFrameCallback(frame);
  else cancelAnimationFrame(frame);
  frame=null;
 }
 const ticksAt=time=>Math.min(waveDuration,Math.floor(time/tidalStep+1e-7));
 function draw(time){
  frame=null;
  if(phase!=='running')return;
  advance(ticksAt(time));
  paint();
  scheduleFrame();
 }
 function changeHeld(next){
  if(phase!=='running'||terminal||next===held)return;
  held=next;
  const tick=Math.max(run.tick,ticksAt(video.currentTime),trace.at(-1)?.[0]??0);
  trace.push([tick,'held',next]);
 }
 function pause(){
  if(phase!=='running')return;
  changeHeld(false);
  input.reset();video.pause();stopFrame();
  show('paused','Paused. Hold Space, click, or touch to climb.');
 }
 function play(){
  show('running','Hold to climb. Release to dive. Keep the wave inside the frame.');
  canvas.focus({preventScroll:true});
  video.play().then(scheduleFrame).catch(()=>{if(phase==='running')pause()});
 }
 const input=bindRunnerControls({surface:canvas,pad,dialog,isRunning:()=>phase==='running',onPress:()=>changeHeld(true),onHeld:changeHeld,onPause:pause});
 async function start(){
  if(phase==='paused'){play();return;}
  input.reset();run=newTidalWave();trace=[];trail=[];token=undefined;lastPortal=-Infinity;terminal=false;held=false;applied=0;
  show('loading','Preparing the recorded flight…');
  if(video.error)video.load();
  video.currentTime=0;
  try{
   ({token}=await onStart(tidalVideoMode));
   if(!closed)play();
  }catch(error){if(!closed)show('ready',error.message);}
 }
 function visibilityChanged(){if(document.hidden)pause();}
 video.addEventListener('ended',()=>{
  if(phase!=='running')return;
  advance(waveDuration);
  if(terminal)finish('clear');
 });
 video.addEventListener('error',()=>{if(!closed){video.pause();stopFrame();show('error','The recording could not load. Try again.')}});
 audio.onclick=()=>{quiet=!quiet;syncAudio();};
 action.onclick=start;
 dialog.querySelector('[data-tidal-close]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{
  closed=true;stopFrame();input.dispose();
  document.removeEventListener('gdlb-game-sound',syncAudio);
  document.removeEventListener('visibilitychange',visibilityChanged);
  video.pause();video.removeAttribute('src');video.load();dialog.remove();
 },{once:true});
 document.addEventListener('gdlb-game-sound',syncAudio);
 document.addEventListener('visibilitychange',visibilityChanged);
 sound.stop();syncAudio();
 document.body.append(dialog);dialog.showModal();
 show('ready','Hold Space, mouse, or touch to climb. Release to dive.');
 return dialog;
}
