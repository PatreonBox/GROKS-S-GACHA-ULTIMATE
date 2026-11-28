import {ico} from './icons.js';
import {bindRunnerControls} from './remix-controls.js';
import {drawWave,drawWaveTrail,waveRise} from './remix-wave.js';
import {newTidalWave,stepTidalWave,tidalChannel,tidalLength,tidalStart,tidalStep,tidalWidth,tidalHeight,tidalX,tidalSpeed} from './tidal-video-rules.js';

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
 let phase='ready',run=newTidalWave(),trace=[],trail=[],token,frame=0,lastPortal=-Infinity;
 let quiet=false,closed=false,terminal=false;
 function syncAudio(){
  video.muted=quiet||!sound.enabled;
  audio.innerHTML=ico(video.muted?'muted':'volume');
  audio.setAttribute('aria-pressed',String(!video.muted));
 }
 function paint(){
  const time=run.tick*tidalStep;
  ctx.clearRect(0,0,tidalWidth,tidalHeight);
  if(time>=tidalStart){
   const channel=Array.from({length:51},(_,i)=>[i*16,...tidalChannel(time+(i*16-tidalX)/tidalSpeed)]);
   for(const [side,bound] of [[1,0],[2,tidalHeight]]){
    ctx.beginPath();ctx.moveTo(0,bound);
    for(const point of channel)ctx.lineTo(point[0],point[side]);
    ctx.lineTo(tidalWidth,bound);ctx.closePath();
    ctx.fillStyle='rgba(1,9,23,.29)';ctx.fill();
    ctx.beginPath();
    for(const point of channel)ctx.lineTo(point[0],point[side]);
    ctx.lineWidth=3;ctx.strokeStyle='rgba(0,12,28,.74)';ctx.stroke();
    ctx.lineWidth=1.5;ctx.strokeStyle='rgba(166,241,255,.82)';ctx.stroke();
   }
  }
  if(phase!=='ready'){
   const points=trail.map(([tick,y])=>[tidalX-(run.tick-tick)*tidalStep*tidalSpeed,y]);
   drawWaveTrail(ctx,points,{skin:avatar,mini:run.mini});
   drawWave(ctx,{x:tidalX,y:run.y,angle:time<tidalStart?0:Math.atan2(waveRise(tidalSpeed,run.held,run.mini),tidalSpeed),mini:run.mini,skin:avatar});
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
  video.pause();
  const attempt=token;
  show(result,result==='clear'?'Tidal Wave cleared!':'The wave touched the flight boundary.');
  action.focus({preventScroll:true});
  onResult(attempt,{ticks:run.tick,trace}).then(receipt=>{
   if(closed||token!==attempt||!receipt?.cleared)return;
   const prizes=[];
   if(receipt.demonKeys)prizes.push('+'+receipt.demonKeys+' Demon Keys');
   if(receipt.playerXpEarned)prizes.push('+'+receipt.playerXpEarned+' XP');
   if(prizes.length)output.textContent='Tidal Wave cleared! '+prizes.join(' · ');
  }).catch(()=>{if(!closed&&token===attempt)output.textContent+=' Your record could not be saved.'});
 }
 function advance(target){
  while(phase==='running'&&!terminal&&run.tick<target){
   const before=run.portal,status=stepTidalWave(run);
   if(run.portal!==before)lastPortal=run.tick*tidalStep;
   if(run.tick*tidalStep>=tidalStart){
    trail.push([run.tick,run.y]);
    if(trail.length>54)trail.shift();
   }
   if(status==='crash')finish(status);
   if(status==='clear')terminal=true;
  }
 }
 function draw(){
  frame=0;
  if(phase!=='running')return;
  advance(Math.min(waveDuration,Math.floor(video.currentTime/tidalStep)));
  paint();
  if(phase==='running')frame=requestAnimationFrame(draw);
 }
 function changeHeld(held){
  advance(Math.min(waveDuration,Math.floor(video.currentTime/tidalStep)));
  if(phase!=='running'||terminal||held===run.held)return;
  trace.push([run.tick,'held',held]);run.held=held;
 }
 function pause(){
  if(phase!=='running')return;
  changeHeld(false);
  if(phase!=='running')return;
  input.reset();video.pause();cancelAnimationFrame(frame);frame=0;
  show('paused','Paused. Hold Space, click, or touch to climb.');
 }
 function play(){
  show('running','Hold to climb. Release to dive. Stay between the two flight boundaries.');
  canvas.focus({preventScroll:true});
  video.play().then(()=>{
   if(phase==='running'&&!frame)frame=requestAnimationFrame(draw);
  }).catch(()=>{if(phase==='running')pause()});
 }
 const input=bindRunnerControls({surface:canvas,pad,dialog,isRunning:()=>phase==='running',onPress:()=>changeHeld(true),onHeld:changeHeld,onPause:pause});
 async function start(){
  if(phase==='paused'){play();return;}
  input.reset();run=newTidalWave();trace=[];trail=[];lastPortal=-Infinity;terminal=false;
  show('loading','Preparing the recorded flight…');
  if(video.error)video.load();
  video.currentTime=0;
  try{
   ({token}=await onStart('video'));
   if(!closed)play();
  }catch(error){if(!closed)show('ready',error.message);}
 }
 function visibilityChanged(){if(document.hidden)pause();}
 video.addEventListener('ended',()=>{
  if(phase!=='running')return;
  advance(waveDuration);
  if(terminal)finish('clear');
 });
 video.addEventListener('error',()=>{if(!closed){video.pause();show('error','The recording could not load. Try again.')}});
 audio.onclick=()=>{quiet=!quiet;syncAudio();};
 action.onclick=start;
 dialog.querySelector('[data-tidal-close]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{
  closed=true;cancelAnimationFrame(frame);input.dispose();
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
