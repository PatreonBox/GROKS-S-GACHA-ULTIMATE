import {startRareScore} from './rare-scores.js';
import {synthCue} from './tactical-audio.js';
import {packCues} from './pack-cues.js';

import {battleCues,difficultyCueNames} from './battle-cues.js';
import {findRemix} from './remixes.js';
import {legendCues,memeCues} from './legend-cues.js';
const cues={...packCues,...battleCues,...legendCues,...memeCues};
export function extremeCue(rank){
 if(rank===1)return 'rank1';
 if(rank>0){for(const ceiling of [10,25,100,250])if(rank<=ceiling)return 'top'+ceiling}
 return 'listedExtreme';
}
function landingDuration(tier,rank,odds){
 if(tier>=10)return legendCues[extremeCue(tier>10?1:rank)][1];
 return odds<=1?.43:battleCues[difficultyCueNames[tier]][1];
}
export function revealSpacing(tier,rank,odds,id){
 const remix=findRemix(id),length=landingDuration(tier,rank,odds);
 return Math.max(280,Math.round((length+(remix?memeCues[remix.cue][1]+.06:0)+.04)*1000));
}
const asset='/assets/audio/arcade-v3.mp3';
const gameSamples={gdPlay:'/assets/audio/gd-play.mp3',gdDeath:'/assets/audio/gd-death.mp3',gdAchievement:'/assets/audio/gd-achievement.mp3',arcade:'/assets/audio/gd-minigames.mp3',mint:'/assets/audio/gd-mint.mp3',ui:'/assets/audio/soft-ui-tap.mp3',
 coin:'/assets/audio/mine-coin.mp3',coinDrop:'/assets/audio/coin-drop.mp3',
 levelSingle:'/assets/audio/player-level-up.mp3',levelMulti:'/assets/audio/player-level-multi.mp3',levelMilestone:'/assets/audio/player-level-milestone.mp3'};
const gameCues={
 gdPlay:[[0,1.02],'stack','gamePortal','gdPlay'],
 gdDeath:[[0,1.83],'injury','impact','gdDeath'],
 gdAchievement:[[0,1.82],'victory','achievement','gdAchievement'],
 jump:[[.05,.26],'sweep','gameMove'],
 orb:[[.55,.36],'charged','gameMove'],
 portal:[[1.05,.76],'miniPortal','gamePortal'],
 forge:[[2.05,.42],'forge','gameMove'],
 mintTap:[[.025,.198],'mine','coin','mint'],
 mintUnlock:[[.445,.46],'extraAccent','coin','mint'],
 coin:[[0,.39],'mine','coinTap','coin'],
 coinDrop:[[0,.95],'extraAccent','coinDrop','coinDrop'],
 levelSingle:[[0,.91],'extraAccent','level','levelSingle'],
 levelMulti:[[0,.82],'results','level','levelMulti'],
 levelMilestone:[[0,1.38],'victory','level','levelMilestone'],
 uiTap:[[0,.13],'select','ui','ui']
};
const slideRates=[.94,.99,1.04,1.10,1.16,1.23];
const chestMixes=new Set(['legendary','mythic','ancient','exotic','celestial','secret','divine','apex','impossible']);
const chestSource=rarity=>'/reveal-media/chests/'+rarity+'.mp3';
const chestAccents={uncommon:['star',.18],rare:['star',.36],epic:['elite',.48]};

const channels={
 select:'menu',inspect:'menu',stack:'menu',buy:'pack',tear:'pack',sweep:'paper',
 star:'land',demon:'land',elite:'accent',extreme:'accent',bonus:'bonus',
 results:'reward',luck:'reward',extra:'reward',mine:'coin',
 ...Object.fromEntries(difficultyCueNames.map((n,i)=>[n,i>8?'accent':'land'])),
 ...Object.fromEntries(Object.keys(legendCues).map(n=>[n,'stinger'])),
 ...Object.fromEntries(Object.keys(memeCues).map(n=>[n,'meme'])),
 attack:'attack',charged:'attack',guard:'attack',enemyHit:'impact',knockout:'bonus',injury:'impact',victory:'reward',loss:'reward',heal:'reward',mineAccent:'coin',luckAccent:'bonus',extraAccent:'bonus'
};
const limits={menu:1,pack:1,paper:2,land:2,accent:2,bonus:2,reward:1,achievement:1,coin:2,coinTap:5,coinDrop:1,level:1,attack:2,impact:2,stinger:1,meme:1,gameMove:2,gamePortal:1,ui:1,rareMusic:1,rareBed:1,chest:1};

export function createPackSound(){
 let enabled=true,ctx=null,master=null,buffer=null,bytes=null,decoding=null,resuming=null;
 const gameBuffers=new Map(),gameLoading=new Map(),gameFiles=new Map();
 let stopRare=null,chestVersion=0;
 let mineCount=0,generation=0,lastMine=-Infinity,lastMint=-Infinity,failedAt=-Infinity,cueSerial=0;
 const synths=new Set(),voices=new Set(),waiting=new Map(),accents=new Set();
 try{enabled=localStorage.getItem('gdlb.packSound')!=='off'}catch{}

 function preload(){
  if(!enabled||buffer||performance.now()-failedAt<1500)return;
  if(!bytes)bytes=fetch(asset).then(response=>{
   if(!response.ok)throw Error('Audio unavailable');
   return response.arrayBuffer();
  }).catch(()=>{bytes=null;failedAt=performance.now();return null});
 }
 function unlock(){
  if(!enabled||document.hidden)return;
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!Audio)return;
   if(!ctx){
    ctx=new Audio({latencyHint:'interactive'});
    master=ctx.createDynamicsCompressor();
    master.threshold.value=-12;master.knee.value=10;master.ratio.value=3.5;
    master.attack.value=.003;master.release.value=.085;
    master.connect(ctx.destination);
   }
   if(ctx.state!=='running'&&!resuming)resuming=ctx.resume().catch(()=>{}).finally(()=>{resuming=null});
   preload();
   if(bytes&&!decoding&&!buffer)decoding=bytes.then(data=>data?ctx.decodeAudioData(data.slice(0)):null)
    .then(decoded=>{buffer=decoded;if(decoded)bytes=null})
    .catch(()=>{bytes=null;failedAt=performance.now()}).finally(()=>{decoding=null});
  }catch{/* Audio support is optional for gameplay. */}
 }
 function fadeOut(voice){
  if(voice.stopping)return;
  voice.stopping=true;
  const now=ctx.currentTime,end=now+(['rareMusic','rareBed','chest'].includes(voice.lane)?.095:.014);
  const level=voice.gain.gain;
  if(typeof level.cancelAndHoldAtTime==='function')level.cancelAndHoldAtTime(now);
  else{level.cancelScheduledValues(now);level.setValueAtTime(level.value,now)}
  level.linearRampToValueAtTime(0,end);voice.source.stop(end+.002);
 }
 function stopSynthScore(){
  stopRare?.();stopRare=null;
 }
 function stopScore(){
  stopSynthScore();
  for(const voice of voices)if(voice.lane==='rareMusic'||voice.lane==='rareBed')fadeOut(voice);
 }
 function score(tier,impact,duration){
  stopScore();
  if(enabled&&ctx&&!document.hidden)stopRare=startRareScore(ctx,master,tier,impact,duration);
 }
 function silence(keepAchievement=false){
  stopScore();
  chestVersion++;
  accents.forEach(clearTimeout);accents.clear();waiting.clear();
  for(const v of synths)v.stop();
  synths.clear();for(const voice of voices)if(!keepAchievement||voice.lane!=='achievement')fadeOut(voice);
 }
 function stop(){generation++;silence(true)}
 function stopAll(){generation++;silence()}
 function emitClip(track,[offset,length],lane,rate,pan,level){
  const active=[...voices].filter(v=>v.lane===lane&&!v.stopping);
  if(active.length>=limits[lane])fadeOut(active[0]);
  const source=ctx.createBufferSource(),gain=ctx.createGain();
  source.buffer=track;source.playbackRate.value=rate;gain.gain.value=level;
  const start=ctx.currentTime;
  if(lane==='rareMusic'||lane==='rareBed'){
   gain.gain.setValueAtTime(.0001,start);
   gain.gain.linearRampToValueAtTime(level,start+.07);
   gain.gain.setValueAtTime(level,start+length-.20);
   gain.gain.linearRampToValueAtTime(.0001,start+length);
  }
  const stereo=ctx.createStereoPanner?.();
  const duck=lane==='rareBed'?ctx.createGain():null;
  source.connect(gain);
  if(duck)gain.connect(duck);
  const output=duck||gain;
  if(stereo){stereo.pan.value=pan;output.connect(stereo);stereo.connect(master)}
  else output.connect(master);
  const voice={source,gain,lane,duck,stopping:false};
  voices.add(voice);
  source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();duck?.disconnect();stereo?.disconnect()};
  source.start(start,offset,length);
 }
 function emit(name,rate,pan,level){emitClip(buffer,cues[name],channels[name],rate,pan,level)}
 function preloadGame(bank,src=gameSamples[bank]){
  if(!enabled||!src||gameBuffers.has(bank))return;
  if(!gameFiles.has(bank)){
   const file=fetch(src).then(response=>{
    if(!response.ok)throw Error('Extra audio unavailable');
    return response.arrayBuffer();
   }).catch(()=>{gameFiles.delete(bank);return null});
   gameFiles.set(bank,file);
  }
  return gameFiles.get(bank);
 }
 function prepareGame(bank='arcade',src=gameSamples[bank]){
  unlock();
  if(!enabled||!ctx||!src||gameBuffers.has(bank))return;
  if(!gameLoading.has(bank)){
   const loading=preloadGame(bank,src).then(data=>data&&ctx.decodeAudioData(data))
    .then(decoded=>{if(decoded)gameBuffers.set(bank,decoded)})
    .catch(()=>{}).finally(()=>{gameLoading.delete(bank);gameFiles.delete(bank)});
   gameLoading.set(bank,loading);
  }
  return gameLoading.get(bank);
 }
 function prepareRevealTrack(src){
  const loading=prepareGame(src,src);
  if(loading||resuming)return Promise.all([loading,resuming]);
 }
 function playRevealClip(src,offset,seconds,lane,volume){
  const track=gameBuffers.get(src),length=Math.min(seconds,(track?.duration??0)-offset);
  if(!enabled||ctx?.state!=='running'||document.hidden||length<.35)return false;
  stopSynthScore();
  if(lane==='rareMusic')for(const voice of voices){
   if(voice.duck&&!voice.stopping)voice.duck.gain.setTargetAtTime(.18,ctx.currentTime,.046);
  }
  emitClip(track,[offset,length],lane,1,0,volume);
  return true;
 }
 const playRevealTrack=(src,offset,seconds)=>playRevealClip(src,offset,seconds,'rareMusic',.58);
 const playRevealBed=(src,offset,seconds)=>playRevealClip(src,offset,seconds,'rareBed',.66);
 function stopChestAudio(){
  chestVersion++;
  for(const voice of voices)if(voice.lane==='chest')fadeOut(voice);
 }
 function prepareChestRarity(rarity){
  const id=String(rarity).toLowerCase();
  if(chestMixes.has(id))return prepareRevealTrack(chestSource(id));
 }
 function playChestRarity(rarity,elapsedSeconds=0){
  const id=String(rarity).toLowerCase();
  if(!enabled||document.hidden)return;
  stopChestAudio();
  if(!chestMixes.has(id)){
   if(elapsedSeconds===0&&Object.hasOwn(chestAccents,id)){
    const [cue,level]=chestAccents[id];
    play(cue,{level});
   }
   return;
  }
  const src=chestSource(id),version=chestVersion,started=performance.now();
  const ready=()=>{
   const delay=(performance.now()-started)/1000,offset=elapsedSeconds+delay,track=gameBuffers.get(src);
   if(!enabled||document.hidden||version!==chestVersion||ctx?.state!=='running')return;
   if(elapsedSeconds===0&&delay>.55){play('extreme',{level:.43});return}
   if(track&&track.duration>offset)emitClip(track,[offset,track.duration-offset],'chest',1,0,.77);
   else if(!track&&elapsedSeconds===0)play('extreme',{level:.43});
  };
  const loading=prepareRevealTrack(src);
  if(loading)loading.then(ready);else ready();
 }
 function playGame(name,{rate=1,pan=0,level=1}={}){
  if(!enabled||!ctx||document.hidden||!Object.hasOwn(gameCues,name))return;
  const [clip,fallback,lane,bank='arcade']=gameCues[name];
  const gameBuffer=gameBuffers.get(bank);
  if(name==='mintTap'){
   const now=performance.now();
   if(now-lastMint<57)return;
   lastMint=now;rate*=.97+Math.random()*.12;
  }
  if(gameBuffer&&ctx.state==='running'){cueSerial++;emitClip(gameBuffer,clip,lane,rate,pan,level);}
  else play(fallback,{rate,pan,level});
 }
 function playGameReady(name,options,isCurrent){
  if(!enabled)return;
  const loading=prepareGame(gameCues[name][3]);
  const playReady=()=>{if(isCurrent())playGame(name,options);};
  if(loading||resuming)Promise.all([loading,resuming]).then(playReady);
  else playReady();
 }
 function coinReward(large,pans=[0]){
  if(!enabled||document.hidden)return;
  const cue=large?'coinDrop':'coin',epoch=generation;
  const loading=prepareGame(cue);
  function receive(){
   if(!enabled||document.hidden||epoch!==generation)return;
   if(large){playGame(cue,{level:.85});return}
   pans.forEach((pan,i)=>{
    const clip=()=>playGame(cue,{pan,rate:.96+Math.random()*.14,level:.50});
    if(i===0){clip();return}
    const timer=setTimeout(()=>{accents.delete(timer);clip()},i*36);
    accents.add(timer);
   });
  }
  if(loading)loading.then(receive);else receive();
 }
 function play(name,{rate=1,pan=0,level=1,seed=0}={}){
  if(!enabled||!ctx||document.hidden)return;
  cueSerial++;
  if(!Object.hasOwn(cues,name)){
   if(synths.size>=8){const first=synths.values().next().value;first.stop();synths.delete(first)}
   const voice=synthCue(ctx,master,name,{rate,pan,level,seed,onended:()=>synths.delete(voice)});
   if(voice)synths.add(voice);return;
  }
  const at=performance.now();
  if(name==='mine'){
   if(at-lastMine<42)return;
   lastMine=at;if(++mineCount%5===0)name='mineAccent';
   rate=.95+Math.random()*.12;pan=(Math.random()-.5)*.18;
  }
  const lane=channels[name];
  waiting.delete(lane);
  if(buffer&&ctx.state==='running'){emit(name,rate,pan,level);return}
  if(!decoding&&!resuming)return;
  const ticket={},epoch=generation;
  waiting.set(lane,ticket);
  Promise.all([decoding,resuming]).then(()=>{
   if(waiting.get(lane)!==ticket)return;
   waiting.delete(lane);
   if(enabled&&!document.hidden&&epoch===generation&&buffer&&ctx.state==='running'&&performance.now()-at<160)emit(name,rate,pan,level);
  });
 }
 function sweep(index,pan){play('sweep',{rate:slideRates[index],pan,level:.75})}
 function land(tier,index,pan,bonus,rank=0,odds=100,id=null,finish='standard'){
  if(!enabled||!ctx||document.hidden)return;
  if(tier>=10)play(extremeCue(tier>10?1:rank),{pan,level:.93});
  else{
   play(difficultyCueNames[tier],{pan,rate:1+index*.014,level:bonus ? .85 : 1});
   if(odds<=1)play('elite',{pan:-pan,level:.46,rate:1.15});
  }
  if(bonus)play('bonus',{pan:pan*.65,level:.59});
  if(finish==='holo')play('extraAccent',{pan:-pan*.5,level:.66,rate:.93});
  if(finish==='antimatter')play('extraAccent',{pan:-pan*.5,level:.78,rate:.67});
  const remix=findRemix(id);
  if(remix){
   const ticket=setTimeout(()=>{accents.delete(ticket);play(remix.cue,{pan:pan*.5,level:.87})},Math.ceil(landingDuration(tier,rank,odds)*1000)+25);
   accents.add(ticket);
  }
 }
 function toggle(){
  enabled=!enabled;
  try{localStorage.setItem('gdlb.packSound',enabled?'on':'off')}catch{}
  if(enabled){unlock();play('select')}else silence();
 }
 function listenForUiTaps(){
  const controls='button:not(:disabled),a[href],summary,select:not(:disabled),input[type=checkbox]:not(:disabled),input[type=radio]:not(:disabled)';
  const uiControl=target=>target.closest?.(controls)&&!target.closest('#mineHit,.turn-handle,[data-tear]');
  const primeAchievement=()=>{if(!gameBuffers.has('gdAchievement'))prepareGame('gdAchievement');};
  preloadGame('gdAchievement');
  document.addEventListener('keydown',primeAchievement,true);
  document.addEventListener('pointerup',event=>{if(event.pointerType!=='mouse')primeAchievement();},true);
  document.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;
   if(uiControl(event.target))prepareGame('ui');
   if(!gameBuffers.has('coinDrop'))prepareGame('coinDrop');
   if(!gameBuffers.has('gdPlay'))prepareGame('gdPlay');
   primeAchievement();
  },true);
  document.addEventListener('click',event=>{
   primeAchievement();
   if(!enabled||!uiControl(event.target))return;
   const at=performance.now(),serial=cueSerial,loading=prepareGame('ui');
   window.setTimeout(async()=>{
    if(loading)await loading;
    if(serial===cueSerial&&performance.now()-at<180)playGame('uiTap',{level:.46});
   },0);
  },true);
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll()});
 window.addEventListener('pagehide',stopAll);
 return {get enabled(){return enabled},get generation(){return generation},preload,unlock,stop,toggle,play,prepareGame,playGame,playGameReady,coinReward,listenForUiTaps,sweep,land,score,stopScore,prepareRevealTrack,playRevealTrack,playRevealBed,prepareChestRarity,playChestRarity,stopChestAudio};
}
