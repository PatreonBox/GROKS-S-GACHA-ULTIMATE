import {ico} from './icons.js';
import {starterCube} from './cube-catalog.js';
import {bindRunnerControls} from './remix-controls.js';
import {drawWave,drawWaveTrail,keepWavePoint,waveRise} from './remix-wave.js';
import {tidalCubeRadius,tidalCubeScene} from './tidal-cube-intro.js';
import {drawTidalHazards} from './tidal-video-hazards.js';
import {newTidalWave,stepTidalWave,tidalInput,tidalLength,tidalStart,tidalStep,tidalWidth,tidalHeight,tidalX,tidalVideoMode} from './tidal-video-rules.js';

const source='/arcade-video/tidal-wave.mp4';
const waveDuration=Math.ceil(tidalLength/tidalStep);
const introInstructions='Tap as your cube reaches each orb. Pink boosts you and green flips gravity.';
const waveInstructions='Hold to climb. Release to dive. Dodge the orange-outlined hazards.';
const portalLead=.36;

function paintCube(ctx,cube,avatar,icon,time){
 const {orbs,platforms,spikes}=tidalCubeScene(time);
 const sky=ctx.createLinearGradient(0,0,0,tidalHeight);
 sky.addColorStop(0,'#110f29');sky.addColorStop(.52,'#172649');sky.addColorStop(1,'#0b1428');
 ctx.fillStyle=sky;ctx.fillRect(0,0,tidalWidth,tidalHeight);
 ctx.strokeStyle='#829ce528';ctx.lineWidth=1;
 ctx.beginPath();
 for(let x=-(time*58)%44;x<tidalWidth;x+=44){ctx.moveTo(x,0);ctx.lineTo(x,tidalHeight);}
 for(let y=30;y<tidalHeight;y+=44){ctx.moveTo(0,y);ctx.lineTo(tidalWidth,y);}
 ctx.stroke();
 for(const {x,y,width,height} of platforms){
  ctx.fillStyle='#210f30';ctx.fillRect(x,y,width,height);
  ctx.strokeStyle='#b278df';ctx.strokeRect(x+.5,y+.5,width-1,height-1);
 }
 for(const points of spikes){
  ctx.beginPath();ctx.moveTo(...points[0]);
  for(const point of points.slice(1))ctx.lineTo(...point);
  ctx.closePath();ctx.fillStyle='#613348';ctx.fill();ctx.strokeStyle='#ff9dce';ctx.stroke();
 }
 orbs.forEach(({type,x,y,radius},index)=>{
  if(x<-radius*2||x>tidalWidth+radius*2)return;
  const color=type==='pink'?'#ff78d0':'#90ffad';
  const live=index===cube.nextOrb,spent=index<cube.nextOrb;
  const age=time-cube.hitAt;
  ctx.save();ctx.translate(x,y);ctx.globalAlpha=spent?.32:live?1:.66;
  ctx.fillStyle='#151832';ctx.strokeStyle=color;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.shadowColor=color;ctx.shadowBlur=live?15:4;
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,0,radius*.63,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#101a28';ctx.beginPath();ctx.moveTo(-5,2);ctx.lineTo(0,-4);ctx.lineTo(5,2);ctx.lineTo(3,4);ctx.lineTo(0,1);ctx.lineTo(-3,4);ctx.closePath();ctx.fill();
  if(live||index===cube.nextOrb-1&&age<.24){
   ctx.globalAlpha=live?.58+.23*Math.sin(time*12):1-age/.24;
   ctx.beginPath();ctx.arc(0,0,radius+(live?7:7+age*110),0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
 });
 const r=tidalCubeRadius;
 ctx.save();ctx.translate(tidalX,cube.y);ctx.rotate(cube.angle);
 ctx.shadowBlur=13;ctx.shadowColor=avatar.color;
 if(icon.naturalWidth)ctx.drawImage(icon,-r,-r,r*2,r*2);
 else{
  ctx.fillStyle=avatar.color;ctx.fillRect(-r,-r,r*2,r*2);
  ctx.fillStyle='#131b33';ctx.fillRect(-r*.6,-r*.6,r*1.2,r*1.2);
 }
 ctx.restore();
}

function paintWavePortal(ctx,time){
 if(time<tidalStart-portalLead)return;
 const entered=time>=tidalStart;
 const progress=entered?(time-tidalStart)/.19:1-(tidalStart-time)/portalLead;
 if(progress>=1&&entered)return;
 ctx.save();
 ctx.translate(tidalX+(entered?-progress*64:(1-progress)*128),tidalHeight/2);
 ctx.globalAlpha=entered?1-progress:progress;
 ctx.strokeStyle='#78eeff';ctx.shadowColor='#5ceaff';ctx.shadowBlur=19;
 ctx.fillStyle='#54dfff35';ctx.lineWidth=3;
 ctx.beginPath();ctx.ellipse(0,0,18,58,-.11,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.strokeStyle='#e4fdff';ctx.lineWidth=1;
 ctx.beginPath();ctx.ellipse(0,0,12,52,-.11,0,Math.PI*2);ctx.stroke();
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
 const video=dialog.querySelector('video'),canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d');
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
  if(run.form==='cube')paintCube(ctx,run.cube,avatar,icon,time);
  else{
   if(run.form==='wave')drawTidalHazards(ctx,run.distance,time,tidalX,tidalWidth);
   paintWavePortal(ctx,time);
  }
  if(run.form==='wave'){
   const scroll=run.distance-tidalX;
   const points=trail.map(([x,y])=>[x-scroll,y]);
   drawWaveTrail(ctx,points,{skin:avatar,mini:run.mini});
   drawWave(ctx,{x:tidalX,y:run.y,angle:Math.atan(waveRise(1,run.held,run.mini)),mini:run.mini,skin:avatar});
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
  size.textContent=run.form==='cube'?'CUBE':run.form==='transition'?'GET READY':run.mini?'MINI WAVE':'WAVE';
  readout.textContent=(phase==='clear'?100:Math.min(99,Math.floor(time/tidalLength*100)))+'%';
 }
 function updateControls(){
  pad.textContent=run.form==='cube'?'Tap orb':'Hold to climb';
  pad.hidden=phase!=='running'||run.form==='transition'||!touch.matches;
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
  const message=reason==='edge'?'The wave touched the edge of the screen.':reason==='hazard'?'The wave hit a hazard.':reason;
  if(result==='crash'&&!video.muted)sound.playGame?.('gdDeath',{level:.5});
  show(result,result==='clear'?'Tidal Wave cleared!':message);
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
   const before=run.portal,form=run.form,orb=run.cube.nextOrb;
   const status=stepTidalWave(run);
   if(run.cube.nextOrb!==orb&&!video.muted)sound.playGame?.('orb',{level:.55});
   if(run.form!==form){
    updateControls();
    output.textContent=run.form==='wave'?waveInstructions:'Get ready for the wave portal.';
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
  show('running',run.form==='cube'?introInstructions:run.form==='wave'?waveInstructions:'Get ready for the wave portal.');
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
 icon.addEventListener('load',()=>{if(!closed&&phase!=='running')paint();},{once:true});
 sound.stop();syncAudio();
 document.body.append(dialog);dialog.showModal();
 show('ready',introInstructions);
 return dialog;
}
