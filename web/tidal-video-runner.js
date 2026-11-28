import {ico} from './icons.js';
import {starterCube} from './cube-catalog.js';
import {bindRunnerControls} from './remix-controls.js';
import {drawWave,drawWaveTrail,keepWavePoint,waveAngle} from './remix-wave.js';
import {tidalCubeRadius,tidalPortalApproachX} from './tidal-cube-intro.js';
import {newTidalWave,stepTidalWave,tidalInput,tidalLength,tidalStep,tidalWidth,tidalHeight,tidalX,tidalVideoMode} from './tidal-video-rules.js';

const source='/arcade-video/tidal-wave.mp4';
const waveDuration=Math.ceil(tidalLength/tidalStep);
const introInstructions='Tap when your cube reaches each orb.';
const transitionInstruction='Hold as you enter the wave portal to climb.';
const cubeInstructions=[
 introInstructions,
 'Tap the first green orb to flip gravity.',
 'Tap the lower green orb to flip back.',
 'Tap each pink orb to jump.',
 'Tap the last pink orb.',
 transitionInstruction
];
const waveInstructions='Hold to climb. Release to dive. Stay between the floor and ceiling.';

function paintCube(ctx,cube,avatar,icon){
 const r=tidalCubeRadius;
 ctx.save();ctx.translate(tidalX,cube.y);ctx.rotate(cube.angle);
 ctx.scale(1,cube.gravity);
 ctx.shadowBlur=cube.orbContact?20:13;
 ctx.shadowColor=cube.orbContact==='green'?'#7fff70':cube.orbContact==='pink'?'#ff8cee':avatar.color;
 if(icon.naturalWidth)ctx.drawImage(icon,-r,-r,r*2,r*2);
 else{
  ctx.fillStyle=avatar.color;ctx.fillRect(-r,-r,r*2,r*2);
  ctx.fillStyle='#131b33';ctx.fillRect(-r*.6,-r*.6,r*1.2,r*1.2);
 }
 ctx.restore();
}

export function openTidalVideo(remix,{avatar=starterCube,sound,onStart,onResult}){
 const dialog=document.createElement('dialog');
 dialog.className='runner-modal tidal-video';
 dialog.setAttribute('aria-label',remix.name);
 dialog.style.setProperty('--remix',remix.color);
 dialog.innerHTML='<div class="runner-bar"><div class="runner-title"><div><span>MINI GAMES · NORMAL</span><h2>Tidal Wave</h2></div></div>'+
  '<div class="minigame-actions"><button type="button" data-tidal-audio aria-label="Video audio"></button>'+
  '<button type="button" data-tidal-close aria-label="Close level">×</button></div></div>'+
  '<div class="runner-frame tidal-stage"><video playsinline preload="auto" aria-hidden="true" src="'+source+'"></video>'+
  '<canvas width="'+tidalWidth+'" height="'+tidalHeight+'" tabindex="0" aria-label="Tidal Wave course. Use Space, mouse, or touch to tap the orbs. Hold to climb in wave form."></canvas>'+
  '<div class="runner-status"><span class="runner-attempt" data-size>CUBE</span><span class="runner-progress">0%</span></div></div>'+
  '<div class="runner-controls"><div class="runner-message" role="status"></div><button type="button" class="runner-touch game-touch" hidden>Hold to climb</button>'+
  '<div class="runner-buttons"><button type="button" data-tidal-action>Start</button></div></div>';
 const video=dialog.querySelector('video'),canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:true});
 const output=dialog.querySelector('.runner-message'),readout=dialog.querySelector('.runner-progress'),size=dialog.querySelector('[data-size]');
 const action=dialog.querySelector('[data-tidal-action]'),audio=dialog.querySelector('[data-tidal-audio]');
 const pad=dialog.querySelector('.runner-touch');
 const touch=matchMedia('(pointer:coarse)');
 const icon=new Image();icon.src=avatar.icon||starterCube.icon;
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
  if(run.form==='cube'||run.form==='transition'&&run.cube.x>=tidalPortalApproachX)paintCube(ctx,run.cube,avatar,icon);
  if(run.form==='wave'){
   const scroll=run.distance-tidalX;
   const points=trail.map(([x,y])=>[x-scroll,y]);
   drawWaveTrail(ctx,points,{skin:avatar,mini:run.mini});
   ctx.save();
   const age=time-lastPortal;
   if(age<.28){
    ctx.shadowBlur=18*(1-age/.28);
    ctx.shadowColor=run.mini?'#ff82e5':'#97ffc5';
   }
   drawWave(ctx,{x:tidalX,y:run.y,angle:run.distance?waveAngle(run.held,run.mini):0,mini:run.mini,skin:avatar});
   ctx.restore();
  }
  size.textContent=run.form==='cube'?'CUBE':run.form==='transition'?'GET READY':run.mini?'MINI WAVE':'WAVE';
  readout.textContent=(phase==='clear'?100:Math.min(99,Math.floor(time/tidalLength*100)))+'%';
 }
 function updateControls(){
  pad.textContent=run.form==='cube'?'Tap orb':'Hold to climb';
  pad.hidden=phase!=='running'||!touch.matches;
 }
 function instructions(){
  if(run.form==='wave')return waveInstructions;
  if(run.form==='transition')return transitionInstruction;
  if(run.cube.missedOrb)return 'Missed the '+run.cube.missedOrb+' orb.';
  return cubeInstructions[run.cube.nextOrb];
 }
 function show(next,message){
  phase=next;output.textContent=message;
  action.hidden=next==='running';
  updateControls();
  action.disabled=next==='loading';
  action.textContent=next==='loading'?'Loading…':next==='paused'?'Resume':next==='ready'?'Start':'Retry';
  paint();
 }
 function finish(result){
  if(phase!=='running')return;
  video.pause();stopFrame();
  const attempt=token;
  const reason=run.crashReason;
  const message=run.form==='wave'?'The wave hit the '+reason+'.':reason;
  show(result,result==='clear'?'Tidal Wave cleared!':message);
  if(result==='crash'&&!video.muted){
   sound.playGameReady?.('gdDeath',{level:.76},()=>!closed&&phase==='crash'&&token===attempt&&!video.muted);
  }
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
   while(trace[applied]?.[0]===run.tick){
    const [,kind,value]=trace[applied++];
    tidalInput(run,kind,value);
   }
   const before=run.portal,form=run.form,orb=run.cube.nextOrb,missed=run.cube.missedOrb;
   const status=stepTidalWave(run);
   if(run.cube.nextOrb!==orb){
    output.textContent=instructions();
    if(!video.muted)sound.playGame?.('orb',{level:.55});
   }
   if(run.cube.missedOrb!==missed)output.textContent=instructions();
   if(run.form!==form){
    updateControls();
    output.textContent=instructions();
    if(run.form==='wave'&&!video.muted)sound.playGame?.('portal',{level:.55});
   }
   if(run.portal!==before)lastPortal=run.tick*tidalStep;
   if(run.form==='wave')keepWavePoint(trail,run.distance,run.y,tidalX);
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
  show('paused','Paused.');
 }
 function play(){
  show('running',instructions());
  canvas.focus({preventScroll:true});
  video.play().then(scheduleFrame).catch(()=>{
   if(phase==='running')show('paused','Press Resume to play the recording.');
  });
 }
 const input=bindRunnerControls({surface:canvas,pad,dialog,isRunning:()=>phase==='running',onPress:()=>changeHeld(true),onHeld:changeHeld,onPause:pause});
 async function start(){
  if(phase==='paused'){play();return;}
  sound.prepareGame?.();
  sound.prepareGame?.('gdDeath');
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
 icon.addEventListener('load',()=>{if(!closed&&phase!=='running')paint();},{once:true});
 sound.stop();syncAudio();
 document.body.append(dialog);dialog.showModal();
 show('ready',introInstructions);
 return dialog;
}
