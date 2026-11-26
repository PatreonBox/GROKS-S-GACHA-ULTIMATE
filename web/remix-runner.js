import {VIEW_WIDTH as WIDTH,VIEW_HEIGHT as HEIGHT,STEP,makeCourse,newAttempt,advanceRunner} from './remix-physics.js';
import {openLimboFinale} from './limbo-finale.js';
import {createRemixArt} from './remix-art.js';
import {helpButton,installMinigameGuide,remixGuide} from './minigame-guide.js';
import {starterCube} from './cube-catalog.js';
import {remixMusic,remixTracks} from './remix-media.js';

export {makeCourse,newAttempt,advanceRunner} from './remix-physics.js';

import {runnerInput} from './game-replay.js';

const controls=['Space','ArrowUp','KeyW'];
const launchTime=.56;
export function openRunner(remix,{sound,onStart,onFinale,onResult,avatar=starterCube}){
 const course=makeCourse(remix),dialog=document.createElement('dialog');
 dialog.className='runner-modal';dialog.setAttribute('aria-label',remix.name);dialog.style.setProperty('--remix',remix.color);
 const instruction=course.mode==='cube'?'Tap or press Space to jump.':remix.mode==='wave'?'Hold to climb. Release to dive.':'Hold for thrust. Release to descend.';
 const orbHint=course.finale?' Tap again inside each pink orb.':'';
 dialog.innerHTML='<div class="runner-bar"><div class="runner-title"><img class="runner-avatar" src="'+avatar.icon+'" title="'+avatar.name+'" alt=""><div><span>MEME ARCADE · '+remix.mode.toUpperCase()+'</span><h2>'+remix.name+'</h2>'+
  (remix.music?'<p class="runner-track">♫ '+remixTracks[remix.music]+'</p>':'')+'</div></div><div class="minigame-actions">'+
  (remix.music?'<button type="button" class="runner-music" data-music aria-label="Level music"></button>':'')+helpButton+'<button type="button" data-close aria-label="Close level">×</button></div></div>'+
  '<div class="runner-frame"><canvas tabindex="0" aria-label="'+remix.mode+' course. Use Space, Up, or touch."></canvas><div class="runner-status"><span class="runner-attempt">READY</span><span class="runner-progress">0%</span></div></div>'+
  '<div class="runner-controls"><div class="runner-message" aria-live="polite"></div><button type="button" class="runner-touch game-touch" hidden>'+(course.mode==='cube'?'Tap to jump':'Hold to climb')+'</button><div class="runner-buttons"></div></div>';
 document.body.append(dialog);dialog.showModal();
 const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),message=dialog.querySelector('.runner-message'),buttons=dialog.querySelector('.runner-buttons');
 const pad=dialog.querySelector('.runner-touch');
 const readout=dialog.querySelector('.runner-progress'),attemptLabel=dialog.querySelector('.runner-attempt');
 const viewport=dialog.querySelector('.runner-frame');
 let viewWidth=WIDTH,viewHeight=HEIGHT,scale=1;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const particles=[],keys=new Set();
 let s=newAttempt(course),phase='ready',frame=0,last=0,carry=0,attempt=0,closed=false,lastPercent=-1,highWater=0,practice=false,pointer=null;
 let launch=0,ticks=0,trace=[],token=null,closeFinale;
 const music=remixMusic(remix.music,sound,dialog.querySelector('[data-music]'),()=>phase==='running');
 const paint=createRemixArt(ctx,remix,course,()=>{if(!closed&&phase!=='running')draw()},avatar);
 const guide=installMinigameGuide(dialog,remixGuide(remix,avatar.icon),pause);
 function resize(){
  if(closed)return;
  const {clientWidth:width,clientHeight:height}=viewport;
  if(!width||!height)return;
  const dpr=Math.min(2,devicePixelRatio||1);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  scale=Math.min(width/(width<520?392:644),height/HEIGHT);
  viewWidth=width/scale;viewHeight=height/scale;
  ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);
  draw();
 }
 function draw(){
  const state=phase==='running'&&!launch&&carry?{...s,x:s.x+carry*course.speed,y:s.y+carry*s.vy}:s;
  canvas.parentElement.style.setProperty('--runner-progress',Math.min(1,s.x/course.end));
  paint(state,{phase,particles,reduced,width:viewWidth,height:viewHeight});
 }
 function action(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;buttons.append(b);return b}
 function displayed(){return Math.min(remix.finish?remix.finish-1:99,Math.floor((remix.finish||100)*s.x/course.end))}
 function persist(value,key=null){
  if(practice||!token||key==null&&value<=highWater)return;
  highWater=value;
  const attemptToken=token;
  return Promise.resolve(onResult(token,key==null?{ticks,trace:trace.slice()}:{key})).then(result=>{
   if(!closed&&attemptToken===token&&remix.mark==='KEY'&&result?.percent===100)message.textContent=remix.quote+' · +'+result.playerXpEarned+' XP';
  }).catch(()=>{
   if(attemptToken!==token)return;
   highWater=0;if(!closed)message.textContent='Your record could not be saved.';
  });
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
 function resetInput(){keys.clear();pointer=null;control('reset');}
 function finish(won,key=null){
  music?.pause();closeFinale?.();closeFinale=null;
  phase=won?'won':'lost';pad.hidden=true;resetInput();buttons.replaceChildren();
  if(won){
   persist(100,key);readout.textContent=remix.finish?remix.finish+'% · CUT!':'100%';
   message.textContent=practice?'Finale cleared in practice.':remix.quote;
   burst(s.x,s.y,26,remix.color);sound.play(remix.cue);
  }else{
   const n=displayed(),wrong=remix.mark==='KEY'&&s.x>=course.end;
   readout.textContent=n+'%';persist(n,key);burst(s.x,s.y,24,remix.color);
   message.textContent=(practice?'Practice':'Attempt '+attempt)+' · '+n+'%. '+(wrong?'Wrong key.':s.x>=course.end&&course.finale?'Tap all three pink orbs.':'Try again.');
   sound.playGame('gdDeath',{level:.62});
  }
  action(won?'Replay level':'Retry',()=>start(practice)).focus({preventScroll:true});
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
  music?.pause();
  if(remix.mark!=='KEY'){finish(true);return;}
  phase='key';pad.hidden=true;resetInput();
  message.textContent='Opening the key chamber…';buttons.replaceChildren();draw();
  const attemptToken=token;
  try{
   const {seed}=await onFinale(token,{ticks,trace:trace.slice()});
   if(closed||attemptToken!==token)return;
   closeFinale=openLimboFinale(viewport,seed,sound,(slot,won)=>finish(won,slot));
   message.textContent='Watch the green key, then choose where it lands.';
  }catch(error){
   if(closed||attemptToken!==token)return;
   message.textContent=error.message;
   action('Retry key chamber',onClear).focus({preventScroll:true});
  }
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
   const passed=s.passed,status=advanceRunner(s,course,remix,STEP);
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
    burst(s.x,s.y,21,'#d8ff7c');sound.playGame('portal',{level:.69});
   }
   if(Math.floor(s.time*64)!==Math.floor((s.time-STEP)*64)){
    s.trace.push([s.x,s.y]);if(s.trace.length>(reduced?5:23))s.trace.shift();
   }
   if(status==='crash'){finish(false);return}
   if(status==='clear'){onClear();return}
  }
  draw();const n=displayed();
  if(n!==lastPercent){readout.textContent=n+'%';lastPercent=n}
  frame=requestAnimationFrame(tick);
 }
 function running(){
  phase='running';pad.hidden=false;buttons.replaceChildren();message.textContent=(launch?'Get ready. ':'')+instruction+orbHint;action('Pause',pause);
  music?.start();
  canvas.focus({preventScroll:true});last=0;carry=0;frame=requestAnimationFrame(tick);
 }
 async function start(isPractice=false){
  cancelAnimationFrame(frame);closeFinale?.();closeFinale=null;
  phase='starting';message.textContent='Preparing attempt…';buttons.replaceChildren();
  try {
   const session=isPractice?null:await onStart();
   if(closed)return;
   token=session?.token||null;
   ticks=0;trace=[];particles.length=0;practice=isPractice;s=newAttempt(course,practice?course.finale:0);resetInput();
   music?.reset();
   attempt++;launch=launchTime;attemptLabel.textContent='GET READY';
   lastPercent=-1;sound.prepareGame();sound.prepareGame('gdDeath');sound.playGame('gdPlay',{level:.62});draw();running();
  } catch(error){
   if(closed)return;
   phase='ready';message.textContent=error.message;action('Try again',()=>start(isPractice)).focus({preventScroll:true});
  }
 }
 function pause(){
  if(phase!=='running')return;
  music?.pause();
  phase='paused';pad.hidden=true;resetInput();cancelAnimationFrame(frame);message.textContent='Paused · '+instruction;
  buttons.replaceChildren();action('Resume',running).focus({preventScroll:true});
 }
 function key(e){
  if(controls.includes(e.code)&&phase==='running'&&(e.target===pad||!e.target.closest('button'))){
   e.preventDefault();
   if(!e.repeat&&!keys.has(e.code)){keys.add(e.code);sound.unlock();control('press')}
  }else if(e.code==='KeyP'&&phase==='running'){e.preventDefault();pause()}
 }
 function keyup(e){
  if(controls.includes(e.code)){keys.delete(e.code);control('held',keys.size>0||pointer!==null)}
 }
 function hidden(){if(document.hidden)pause()}
 function release(e){
  if(pointer!==e.pointerId)return;
  pointer=null;control('held',keys.size>0);
 }
 function press(e){
  if(phase!=='running'||pointer!==null||e.button!==0)return;
  e.preventDefault();canvas.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);
  pointer=e.pointerId;sound.unlock();control('press');
 }
 for(const target of [canvas,pad]){
  target.onpointerdown=press;target.onpointerup=release;target.onpointercancel=release;target.onlostpointercapture=release;
 }
 dialog.addEventListener('keydown',key);window.addEventListener('keyup',keyup);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',hidden);
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 const observer=new ResizeObserver(resize);observer.observe(viewport);
 dialog.addEventListener('close',()=>{
  closed=true;closeFinale?.();music?.close();observer.disconnect();cancelAnimationFrame(frame);sound.stop();window.removeEventListener('keyup',keyup);
  window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',hidden);dialog.remove();
 },{once:true});
 resize();message.textContent=remix.hint+' '+instruction;
 action('Start level',()=>start()).focus({preventScroll:true});
 if(course.finale)action('Practice finale',()=>start(true));
 guide.welcome();
 return dialog;
}
