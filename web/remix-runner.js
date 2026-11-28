import {VIEW_WIDTH as WIDTH,VIEW_HEIGHT as HEIGHT,STEP,makeCourse,createEndlessCourse,newAttempt,advanceRunner} from './remix-physics.js';
import {openLimboFinale} from './limbo-finale.js';
import {keepWavePoint} from './remix-wave.js';
import {createRemixArt,maxRunnerPlayerX} from './remix-art.js';
import {helpButton,installMinigameGuide,remixGuide} from './minigame-guide.js';
import {starterCube} from './cube-catalog.js';
import {remixMusic,remixMusicCredit} from './remix-media.js';
import {bindRunnerControls} from './remix-controls.js';
import {breakwaterCourse,breakwaterColor,breakwaterMode,stepBreakwaterWave} from './breakwater-course.js';
import {createBreakwaterArt} from './breakwater-art.js';

export {makeCourse,newAttempt,advanceRunner} from './remix-physics.js';

import {runnerInput} from './game-replay.js';

const launchTime=.56;
const clock=s=>Math.floor(s/60)+':'+String(Math.floor(s)%60).padStart(2,'0');
export function openRunner(remix,{sound,onStart,onFinale,onResult,onCheckpoint,mode='normal',avatar=starterCube}){
 const breakwater=mode===breakwaterMode,endless=mode==='endless',limbo=!breakwater&&!endless&&remix.mark==='KEY';
 const name=breakwater?'Breakwater':remix.name,musicTrack=breakwater?null:remix.music;
 const color=breakwater?breakwaterColor:remix.color,finishPercent=breakwater?100:remix.finish||100;
 let course=breakwater?breakwaterCourse:endless?createEndlessCourse(remix,remix.id):makeCourse(remix);
 const dialog=document.createElement('dialog');
 dialog.className='runner-modal';dialog.setAttribute('aria-label',name);dialog.style.setProperty('--remix',color);
 const instruction=course.mode==='cube'?'Tap or press Space to jump.':course.mode==='wave'?'Hold Space, click, or touch to climb. Release to dive.':'Hold for thrust. Release to descend.';
 const orbHint=course.finale?' Tap again inside each pink orb.':'';
 dialog.innerHTML='<div class="runner-bar"><div class="runner-title"><img class="runner-avatar" src="'+avatar.icon+'" title="'+avatar.name+'" alt=""><div><span>MINI GAMES · '+(breakwater?'PRACTICE':mode.toUpperCase())+' · '+course.mode.toUpperCase()+'</span><h2>'+name+'</h2>'+
  remixMusicCredit(musicTrack,remix.id)+'</div></div><div class="minigame-actions">'+
  (musicTrack?'<button type="button" class="runner-music" data-music aria-label="Level music"></button>':'')+
  (breakwater?'<button type="button" class="runner-hitboxes" data-hitboxes aria-pressed="false">Hitboxes</button>':'')+
  helpButton+'<button type="button" data-close aria-label="Close level">×</button></div></div>'+
  '<div class="runner-frame"><canvas tabindex="0" aria-label="'+course.mode+' course. Use Space, Up, the mouse, or touch."></canvas><div class="runner-status"><span class="runner-attempt">READY</span><span class="runner-progress">'+(endless?'0:00':'0%')+'</span></div></div>'+
  '<div class="runner-controls"><div class="runner-message" aria-live="polite"></div><button type="button" class="runner-touch game-touch" hidden>'+(course.mode==='cube'?'Tap to jump':'Hold to climb')+'</button><div class="runner-buttons"></div></div>';
 document.body.append(dialog);dialog.showModal();
 const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),message=dialog.querySelector('.runner-message'),buttons=dialog.querySelector('.runner-buttons');
 const pad=dialog.querySelector('.runner-touch');
 const readout=dialog.querySelector('.runner-progress'),attemptLabel=dialog.querySelector('.runner-attempt');
 const viewport=dialog.querySelector('.runner-frame');
 const courseHeight=course.height??HEIGHT;
 let viewWidth=WIDTH,viewHeight=courseHeight,hitboxes=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const particles=[];
 let s=newAttempt(course),phase='ready',frame=0,last=0,carry=0,attempt=0,closed=false,lastPercent=-1,highWater=0,practice=false;
 let launch=0,ticks=0,trace=[],traceStart=0,token=null,closeFinale,finalSave;
 let interval=0,keysRemaining=0,nextCheckpoint=Infinity,keysEarned=0,xpEarned=0;
 const music=remixMusic(musicTrack,sound,dialog.querySelector('[data-music]'),()=>phase==='running'||limbo&&phase==='key',
  {loop:!limbo,continuous:limbo});
 const makeArt=()=>breakwater?createBreakwaterArt(ctx,avatar,maxRunnerPlayerX):
  createRemixArt(ctx,remix,course,()=>{if(!closed&&phase!=='running')draw()},avatar);
 let paint=makeArt();
 const guideInfo=remixGuide({...remix,mode:course.mode},avatar.icon,{endless});
 if(breakwater)Object.assign(guideInfo,{id:breakwaterMode,name,color,
  tips:[guideInfo.tips[0],['Check the collision edges','The bright ramp edges and saw rings show where you can hit. Turn on Hitboxes to see those outlines and your wave’s collision circle.']],
  outcome:'Breakwater is a practice course.'});
 const guide=installMinigameGuide(dialog,guideInfo,pause);
 function resize(){
  if(closed)return;
  const {clientWidth:width,clientHeight:height}=viewport;
  if(!width||!height)return;
  const dpr=Math.min(2,devicePixelRatio||1);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  const scale=Math.min(width/(width<520?378:700),height/(courseHeight+18));
  viewWidth=width/scale;viewHeight=height/scale;
  ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);
  draw();
 }
 function draw(){
  let state=s;
  if(phase==='running'&&!launch&&carry){
   state={...s};
   if(breakwater)stepBreakwaterWave(state,carry);
   else{state.x+=carry*course.speed;state.y+=carry*s.vy}
  }
  const progress=endless?(interval?(ticks*STEP%interval)/interval:0):s.x/course.end;
  canvas.parentElement.style.setProperty('--runner-progress',Math.min(1,progress));
  paint(state,{phase,particles,reduced,width:viewWidth,height:viewHeight,hitboxes});
 }
 function action(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;buttons.append(b);return b}
 function displayed(){return Math.min(finishPercent-1,Math.floor(finishPercent*s.x/course.end))}
 function persist(value,key=null){
  if(practice||!token||key==null&&value<=highWater)return;
  highWater=value;
  const attemptToken=token;
  return Promise.resolve(onResult(token,key==null?{ticks,trace:trace.slice()}:{key})).then(result=>{
   if(closed||attemptToken!==token||phase!=='won'||!result?.cleared)return;
   const {demonKeys,playerXpEarned}=result,rewards=[remix.quote];
   if(playerXpEarned)rewards.push('+'+playerXpEarned+' XP');
   if(demonKeys)rewards.push('+'+demonKeys+' Demon '+(demonKeys===1?'Key':'Keys'));
   message.textContent=rewards.join(' · ');
  }).catch(()=>{
   if(attemptToken!==token)return;
   highWater=0;if(!closed)message.textContent='Your record could not be saved.';
  });
 }
 function proof(){return {ticks,trace:trace.slice(),from:traceStart}}
 function endlessProgress(){
  const elapsed=ticks*STEP;
  return clock(elapsed)+(keysRemaining>0?' · Key in '+Math.max(0,Math.ceil(nextCheckpoint-elapsed))+'s':' · Key limit reached');
 }
 function updateEndlessReceipt(result){
  if(!result)return;
  keysEarned+=result.demonKeys||0;
  xpEarned+=result.playerXpEarned||0;
  keysRemaining=result.keysRemaining??keysRemaining;
 }
 function collectCheckpoint(){
  if(!endless||!token||ticks*STEP+1e-7<nextCheckpoint)return;
  nextCheckpoint+=interval;
  const run=token,snapshot=proof();
  Promise.resolve(onCheckpoint?.(run,snapshot)).then(result=>{
   if(token!==run||closed)return;
   const verified=result?.verifiedTicks??0;
   if(verified>traceStart){traceStart=verified;trace=trace.filter(input=>input[0]>=traceStart)}
   updateEndlessReceipt(result);
   if(phase==='running'&&result?.demonKeys)message.textContent='+'+result.demonKeys+' Demon '+(result.demonKeys===1?'Key':'Keys')+' · '+keysRemaining+' left in this six-hour window';
  }).catch(()=>{});
 }
 function sendEndlessResult(){
  if(!token||finalSave||!ticks)return finalSave;
  const run=token;
  finalSave=Promise.resolve(onResult(run,proof())).then(result=>{
   if(token!==run||closed)return;
   updateEndlessReceipt(result);
   message.textContent='Survived '+clock(result.survivedSeconds??ticks*STEP)+' · +'+keysEarned+' Demon '+(keysEarned===1?'Key':'Keys')+' · +'+xpEarned+' XP';
  }).catch(()=>{if(!closed&&token===run)message.textContent='Your endless result could not be saved.'});
  return finalSave;
 }
 function burst(x,y,count,color){
  if(reduced)return;
  for(let i=0;i<count;i++){
   const a=i*2.399+Math.random()*.45,force=44+Math.random()*148,max=.20+Math.random()*.35;
   particles.push({x,y,vx:Math.cos(a)*force,vy:Math.sin(a)*force,life:max,max,color,size:1.5+Math.random()*3.8});
  }
 }
 function stepParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
   const p=particles[i];p.life-=dt;
   if(p.life<=0){particles.splice(i,1);continue}
   p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=240*dt;
  }
 }
 function control(kind,value=null){
  runnerInput(s,kind,value);
  if(token&&!practice)trace.push([ticks,kind,value]);
 }
 function resetInput(){input.reset();control('reset');}
 function finish(won,key=null){
  const died=!won&&phase!=='paused';
  music?.pause();closeFinale?.();closeFinale=null;
  phase=won?'won':'lost';pad.hidden=true;resetInput();buttons.replaceChildren();
  if(died){
   const lostAttempt=s;
   sound.playGameReady('gdDeath',{level:.76},()=>!closed&&phase==='lost'&&s===lostAttempt);
  }
  if(endless){
   readout.textContent=clock(ticks*STEP);
   message.textContent='Saving your endless run…';
   sendEndlessResult();
   burst(s.x,s.y,won?26:18,remix.color);
   if(won)sound.play(remix.cue);
  }else if(won){
   persist(100,key);readout.textContent=breakwater||!remix.finish?'100%':remix.finish+'% · CUT!';
   message.textContent=breakwater?'Breakwater cleared.':practice?'Finale cleared in practice.':remix.quote;
   burst(s.x,s.y,26,color);sound.play(breakwater?'victory':remix.cue);
  }else{
   const n=displayed(),wrong=remix.mark==='KEY'&&s.x>=course.end;
   readout.textContent=n+'%';persist(n,key);burst(s.x,s.y,24,color);
   const retryHint=breakwater?'Hit '+(s.contact==='ramp'?'a ramp.':s.contact==='saw'?'a saw.':'the '+s.contact+'.'):
    wrong?'Wrong key.':s.x>=course.end&&course.finale?'Tap all three pink orbs.':'Try again.';
   message.textContent=(practice?'Practice':'Attempt '+attempt)+' · '+n+'%. '+retryHint;
  }
  action(endless?'Try endless again':won?'Replay level':'Retry',()=>start(practice)).focus({preventScroll:true});
  if(course.finale)action(practice?'Start full level':'Practice finale',()=>start(!practice));
  action('Back to levels',()=>dialog.close());
  let at=performance.now();
  function settle(now){
   if(closed||phase==='running')return;
   stepParticles(Math.min(.05,(now-at)/1000));at=now;draw();
   if(particles.length)frame=requestAnimationFrame(settle);
  }
  draw();if(particles.length)frame=requestAnimationFrame(settle);
 }
 async function onClear(){
  if(!limbo){finish(true);return;}
  phase='key';pad.hidden=true;resetInput();
  message.textContent='Opening the key chamber…';buttons.replaceChildren();draw();
  const attemptToken=token;
  try{
   const {seed}=await onFinale(token,{ticks,trace:trace.slice()});
   if(closed||attemptToken!==token)return;
   closeFinale=openLimboFinale(viewport,seed,(slot,won)=>finish(won,slot));
   message.textContent='Watch the green key, then choose where it lands.';
  }catch(error){
   if(closed||attemptToken!==token)return;
   message.textContent=error.message;
   action('Retry key chamber',onClear).focus({preventScroll:true});
  }
 }
 function noteTrail(x,y){
  const tip=s.trace.at(-1);
  if(tip?.[0]===x&&tip[1]===y)return;
  s.trace.push([x,y]);if(s.trace.length>(reduced?5:23))s.trace.shift();
 }
 function tick(now){
  if(phase!=='running'||closed)return;
  const elapsed=last?Math.min(.075,(now-last)/1000):0;
  last=now;
  if(launch){
   launch=Math.max(0,launch-elapsed);
   if(!launch){
    attemptLabel.textContent=practice?'FINALE PRACTICE':'ATTEMPT '+attempt;
    message.textContent=instruction+orbHint;
   }
   frame=requestAnimationFrame(tick);return;
  }
  carry+=elapsed;
  while(carry>=STEP&&phase==='running'){
   const {passed,x,y}=s,status=breakwater?stepBreakwaterWave(s,STEP):advanceRunner(s,course,remix,STEP);
   ticks++;carry-=STEP;stepParticles(STEP);
   if(s.passed!==passed){
    if(course.mode!=='cube')burst(s.x-10,s.y,5,avatar.color);
    sound.play('select',{rate:1+s.passed*.027,level:.29});
   }
   if(s.event==='orb'){
    burst(s.lastOrb.x,s.lastOrb.y,15,'#ff9ed8');sound.playGame('orb',{rate:1.05+.18*s.orbs.size,level:.55});
   }else if(s.event==='jump'){
    burst(s.x,s.y+9,6,avatar.color);sound.playGame('jump',{rate:1.17,level:.57});
   }else if(s.event==='mini'){
    burst(s.x,s.y,21,'#ffa0fc');sound.playGame('portal',{level:.69});
   }
   if(course.mode==='wave'){
    if(!s.trace.length)keepWavePoint(s.trace,x,y,maxRunnerPlayerX);
    keepWavePoint(s.trace,s.x,s.y,maxRunnerPlayerX);
   }else if(Math.floor(s.time*64)!==Math.floor((s.time-STEP)*64))noteTrail(s.x,s.y);
   if(status==='crash'){finish(false);return}
   if(status==='clear'){onClear();return}
   collectCheckpoint();
  }
  draw();const progress=endless?endlessProgress():displayed()+'%';
  if(progress!==lastPercent){readout.textContent=progress;lastPercent=progress}
  frame=requestAnimationFrame(tick);
 }
 function running(rewindMusic=false){
  phase='running';pad.hidden=false;buttons.replaceChildren();message.textContent=(launch?'Get ready. ':'')+instruction+orbHint;action('Pause',pause);
  music?.start({rewind:rewindMusic});
  canvas.focus({preventScroll:true});last=0;carry=0;frame=requestAnimationFrame(tick);
  if(document.hidden)pause();
 }
 async function start(isPractice=false){
  cancelAnimationFrame(frame);closeFinale?.();closeFinale=null;
  phase='starting';message.textContent='Preparing attempt…';buttons.replaceChildren();
  sound.prepareGame('gdDeath');
  if(limbo)music?.prime();
  try {
   if(finalSave)await finalSave;
   const session=breakwater||isPractice?null:await onStart(mode);
   if(closed)return;
   token=session?.token||null;
   ticks=0;trace=[];traceStart=0;particles.length=0;
   finalSave=null;keysEarned=0;xpEarned=0;highWater=0;
   if(endless){
    course=createEndlessCourse(remix,session.seed);paint=makeArt();
    interval=session.interval;keysRemaining=session.keysRemaining;nextCheckpoint=interval;
    readout.textContent=endlessProgress();
   }else readout.textContent='0%';
   practice=isPractice;s=newAttempt(course,practice?course.finale:0);resetInput();
   if(!limbo)music?.reset();
   attempt++;launch=limbo?0:launchTime;attemptLabel.textContent=limbo?'ATTEMPT '+attempt:'GET READY';
   lastPercent=-1;sound.prepareGame();sound.playGame('gdPlay',{level:.62});draw();running(limbo);
  } catch(error){
   if(closed)return;
   music?.pause();
   phase='ready';message.textContent=error.message;action('Try again',()=>start(isPractice)).focus({preventScroll:true});
  }
 }
 function pause(){
  if(phase!=='running')return;
  music?.pause();
  phase='paused';pad.hidden=true;resetInput();cancelAnimationFrame(frame);message.textContent='Paused · '+instruction;
  buttons.replaceChildren();action('Resume',()=>running()).focus({preventScroll:true});
  if(endless)action('Finish and save',()=>finish(false));
 }
 function hidden(){
  if(limbo&&phase==='key'){
   if(document.hidden)music?.pause();else music?.start();
  }else if(document.hidden){
   if(phase==='starting')music?.pause();else pause();
  }
 }
 const input=bindRunnerControls({surface:canvas,pad,dialog,isRunning:()=>phase==='running',
  onPress:()=>{sound.unlock();control('press');},onHeld:held=>control('held',held),onPause:pause});
 document.addEventListener('visibilitychange',hidden);
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 const hitboxButton=dialog.querySelector('[data-hitboxes]');
 if(hitboxButton)hitboxButton.onclick=()=>{
  hitboxes=!hitboxes;hitboxButton.setAttribute('aria-pressed',String(hitboxes));
  if(phase==='running')canvas.focus({preventScroll:true});
  draw();
 };
 const observer=new ResizeObserver(resize);observer.observe(viewport);
 dialog.addEventListener('close',()=>{
  closed=true;
  if(endless)sendEndlessResult();
  closeFinale?.();music?.close();input.dispose();observer.disconnect();cancelAnimationFrame(frame);sound.stop();
  document.removeEventListener('visibilitychange',hidden);dialog.remove();
 },{once:true});
 resize();message.textContent=breakwater?instruction:
  (endless?'Survive as long as you can. Keys are shared across all courses and reset every six hours.':remix.hint)+' '+instruction;
 action(endless?'Start endless':'Start level',()=>start()).focus({preventScroll:true});
 if(course.finale)action('Practice finale',()=>start(true));
 guide.welcome();
 return dialog;
}
