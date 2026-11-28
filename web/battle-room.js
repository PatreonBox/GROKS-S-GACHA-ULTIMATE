import {loadingMarkup} from './loading.js';
import {cardGrowth,cardLevelCap,feedXP,spareCopies,xpAt} from './card-growth.js';
import {stat} from './card-economy.js';
import {impossibleCategory} from './impossible-cards.js';
import {bestFinish,finishClass} from './card-finishes.js';
import {difficulties,cardCategories,readCollection,feedLevelCard} from './pack-engine.js';
import {arenas,arenaPlayerXp,statsFor,saveSquad,enterArena,battleAction,equipTechnique,leaveResults,startRemix,startLimboFinale,recordRemix,checkpointRemix,enemyIntent,liveOrb,linkOrbs,liveRiposte,tacticDescription,startDrill,checkpointDrill,finishDrill} from './battle-engine.js';
import {campaignStages,stageFor,stageCleared,stageUnlocked,stageRules} from './campaign.js';
import {campaignView,campaignOutcome} from './campaign-view.js';
import {arenaDeck,cardChassis,cameraTools,bindArenaCamera} from './arena-stage.js';
import {createArenaViewport} from './arena-world-view.js';
import {ico,ratingLabel} from './icons.js';
import {consoleView,intentView,lockCommands,ordersView,techniqueView} from './arena-console.js';

import {remixes,findRemix,keyTarget,remixKeyReward} from './remixes.js';
import {endlessKeyInterval,endlessKeyStatus,endlessKeyLimit,endlessKeyResetHours} from './remix-endless.js';
import {openRunner} from './remix-runner.js';
import {openTidalVideo} from './tidal-video-runner.js';
import {tidalVideoId} from './tidal-video-rules.js';
import {griefPoster,watchGrief} from './remix-media.js';
import {playCardTurn} from './card-combat.js';

import {skillsFor,technique,signatureDetail,execution,drillTypes,trainingOf,trainingCapacity,trainingLabel} from './card-skills.js';
import {moveArt} from './combat-arts.js';
import {openDrill} from './training-games.js';
import {equippedCube} from './cube-catalog.js';
import {markGuide,newAreas,newBadge} from './guide-progress.js';
import {drillGuideId,remixGuideId} from './minigame-guide.js';
import {playerProgress} from './player-progression.js';
import {arenaActivities,battleNavigation} from './battle-navigation.js';

const fmt=n=>n.toLocaleString('en-US');
const short=n=>Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
const clock=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const coin='<img src="/assets/packs/coin.png" class="battle-coin" alt="coins">';
const colors=['#88d9c8','#68d4ff','#a9e981','#ffcb65','#ff9166','#ff87ad','#b29bff','#f98fce','#ff8264','#f9669c','#ffb149'];
const arenaArt=[
 '/assets/arena/easy.webp','/assets/arena/normal.webp','/assets/arena/hard.webp','/assets/arena/harder.webp','/assets/arena/insane.webp',
 ...[13519,118509879,4284013,4706930,10565740].map(id=>'/assets/shots/'+id+'.webp')
];
const face=d=>d===impossibleCategory?'/assets/impossible/mark.webp':'/assets/faces/'+(d.includes(' Demon')?'demon-'+d.split(' ')[0].toLowerCase():d.toLowerCase())+'.webp';
const payoutRange=t=>arenas[t-1].map(short).join('–');
const nameplate=t=>'<img class="bt-face" src="'+face(difficulties[t])+'" alt="">'+difficulties[t];
export function createBattleRoom({root,sound,rewards,coverSource,enc,applyWallet,announce,onGuide}){
 let gym=false,arcadePage=false,trainee=0,trainQuery='',trainingGame=null,relay=null,seqSeen=-1;
 let visible=false,wallet=null,owned=[],loaded=false,loadId=0,tier=1,target=0,knownBattle='',draft=[],picker=false,search='',page=0;
 let collectionError=false,busy=false,feedback='',loop=null,lastInjured=0,clockVersion='';
 let battleView='battle',lastScreen='',campaignTier=0,selection=null,runner=null,inspection=null,playback=null,stopPlayback=null;
 let playerLevel=0;
 const bountyTickets=new Map(),camera={flat:true};
 let clearTicket=null,arenaViewport;
 const mutedBtn=()=>'<button type="button" data-bsound aria-label="Battle audio" title="'+(sound.enabled?'Mute battle audio':'Enable battle audio')+'" aria-pressed="'+sound.enabled+'" class="iconbtn">'+ico(sound.enabled?'volume':'muted')+'</button>';
 const until=id=>wallet?.injuries?.[id]||0;
 const healthy=id=>until(id)<=Date.now();
 const byId=id=>owned.find(c=>c.id===Number(id));
 const art=(id,diff,eager=false)=>{
  const src=coverSource(id);
  return '<span class="unit-art"><img class="unit-symbol" src="'+face(diff)+'" alt=""><img class="unit-cover scene-shot" data-id="'+id+'" src="'+enc(src)+'" alt="" loading="'+(eager?'eager':'lazy')+'"></span>';
 };
 for(const event of ['click','keydown','pointerdown'])root.addEventListener(event,sound.unlock,true);
 function finishPlayback(){
  for(const t of bountyTickets.values())rewards.settle(t);bountyTickets.clear();
  stopPlayback?.();stopPlayback=null;playback=null;busy=false;
  root.querySelector('.arena-view')?.classList.remove('camera-locked');
  if(visible)render();
  const ticket=clearTicket;clearTicket=null;
  if(ticket){
   const reward=root.querySelector('.campaign-clear-reward');
   if(visible&&!gym&&!arcadePage&&reward){sound.play('extraAccent',{level:.62});rewards.launch(ticket,reward,{front:true})}
   else rewards.settle(ticket);
  }
 }
 function timer(){
  if(!visible||document.hidden||!wallet)return;
  const recovering=Object.values(wallet.injuries||{}).filter(n=>n>Date.now()).length;
  if(recovering<lastInjured){sound.play('heal');feedback='Recovery complete. Your healed cards are ready.';if(!playback)render()}
  lastInjured=recovering;
  root.querySelectorAll('[data-until]').forEach(el=>{el.textContent=clock(Number(el.dataset.until)-Date.now())});
 }
 function setWallet(w){
  wallet=w;
  playerLevel=playerProgress(w.playerXp).level;
  if(!visible)return;
  if(playback&&(w.battle?.id!==playback.id||w.battle?.seq!==playback.seq+1))finishPlayback();
  if(w.battle?.seq!==seqSeen){seqSeen=w.battle?.seq;relay=null}
  if(!picker)draft=[...(w.squad||[])];
  if(w.battle?.id!==knownBattle){
   knownBattle=w.battle?.id||'';target=0;
   Object.assign(camera,{flat:true,yaw:undefined,pitch:undefined,zoom:1});
   if(w.battle?.campaign)campaignTier=w.battle.campaign;
   else if(w.battle?.remix)selection=findRemix(w.battle.remix);
   else if(w.battle)tier=w.battle.tier;
  }
  const stamp=[w.battle?.id,w.battle?.seq,w.battle?.status,JSON.stringify(w.battle?.techniques||{}),...(w.squad||[]),JSON.stringify(w.injuries||{}),w.trainingRevision||0,playerLevel].join('|');
  if(stamp!==clockVersion){clockVersion=stamp;if(!playback)render()}
 }
 async function refreshCollection(){
  const epoch=++loadId;
  collectionError=false;
  let list;
  try{list=await readCollection()}
  catch(e){
   if(epoch===loadId&&visible){collectionError=true;feedback=e.message;render()}
   return;
  }
  if(epoch!==loadId||!visible)return;
  owned=list.sort((a,b)=>{const x=ownedStats(a),y=ownedStats(b);return y.tier-x.tier||y.maxHp+y.attack-x.maxHp-x.attack||a.row[1].localeCompare(b.row[1])});
  loaded=true;if(!playback)render();
 }
 function show(on,next='battle'){
  const changed=battleView!==next;
  battleView=next;gym=next==='training';arcadePage=next==='arcade';
  if(on&&gym)markGuide(newAreas.training);
  if(on&&arcadePage){selection??=remixes[0];markGuide(newAreas.remix)}
  if(on&&visible&&changed){trainingGame?.close();inspection?.close();runner?.close();if(playback)finishPlayback();picker=false;feedback='';render()}
  if(visible===on)return;visible=on;root.hidden=!on;clearInterval(loop);if(!on){trainingGame?.close();runner?.close();inspection?.close();if(playback)finishPlayback()}
  if(!on){arenaViewport?.detach();root.querySelector('.orders-sheet[open]')?.close();picker=false;feedback='';lastScreen='';return}
  picker=false;draft=[...(wallet?.squad||[])];loaded=false;collectionError=false;clockVersion='';lastInjured=Object.values(wallet?.injuries||{}).filter(n=>n>Date.now()).length;
  sound.preload();render();refreshCollection();loop=setInterval(timer,1000);
 }
 function ownedStats(c){return statsFor(c.row,wallet?.training?.[c.id])}
 function trainingOptions(){
  const q=trainQuery.trim().toLowerCase();
  const matches=owned.filter(c=>!q||[c.row[1],c.row[6],c.id].join(' ').toLowerCase().includes(q)).slice(0,200);
  const selected=byId(trainee);
  if(selected&&!q&&!matches.some(c=>c.id===selected.id))matches.unshift(selected);
  return matches.map(c=>'<option value="'+c.id+'" '+(c.id===trainee?'selected':'')+'>'+enc(c.row[1])+' · '+c.row[6]+'</option>').join('');
 }
 function feedPanel(card,stats){
  const growth=cardGrowth(stats.training);
  const spare=owned.filter(c=>spareCopies(c)>0).sort((a,b)=>cardCategories.indexOf(a.row[6])-cardCategories.indexOf(b.row[6]));
  const title='<div class="feed-head"><div><h3>Card level <strong>'+growth.level+' / '+cardLevelCap+'</strong></h3>'+
   '<p>+'+stat(stats.levelHp)+' HP · +'+stat(stats.levelAttack)+' ATK from levels</p></div>'+
   '<span class="feed-next">'+(growth.maxed?'Max level':numberXP(growth.remaining)+' XP to level '+(growth.level+1))+'</span></div>'+
   '<div class="feed-meter" role="progressbar" aria-label="Card level progress" aria-valuenow="'+Math.round(growth.ratio*100)+'" aria-valuemin="0" aria-valuemax="100"><i style="--xp:'+growth.ratio+'"></i></div>';
  if(growth.maxed||!spare.length){
   return '<section class="feed-panel" aria-label="Card growth">'+title+
    (growth.maxed?'':'<p>Earn XP in drills or collect spare cards to feed.</p>')+'</section>';
  }
  const options=spare.map(c=>{
   const xp=feedXP(cardCategories.indexOf(c.row[6]));
   const max=Math.min(spareCopies(c),Math.ceil((xpAt(cardLevelCap)-growth.xp)/xp));
   return '<option value="'+c.id+'" data-xp="'+xp+'" data-max="'+max+'">'+enc(c.row[1])+' · '+spareCopies(c)+' spare · '+xp+' XP</option>';
  }).join('');
  const first=spare[0],xp=feedXP(cardCategories.indexOf(first.row[6]));
  const max=Math.min(spareCopies(first),Math.ceil((xpAt(cardLevelCap)-growth.xp)/xp));
  return '<section class="feed-panel" aria-label="Card growth">'+title+
   '<form class="feed-form" data-feed data-recipient="'+card.id+'"><label>Spare card<select name="source">'+options+'</select></label>'+
   '<label>Copies<span class="feed-quantity"><input type="number" name="copies" min="1" max="'+max+'" step="1" value="1" required>'+
   '<button type="button" class="outline" data-feed-max>Max</button></span></label>'+
   '<button class="bt-primary" data-feed-submit type="submit">Feed · +'+xp+' XP</button></form>'+
   '<p>Each level keeps a copy and all of its foil cards.</p></section>';
 }
 const numberXP=n=>n.toLocaleString('en-US');
 function feedInput(form){
  const source=form.elements.source.selectedOptions[0],copies=form.elements.copies;
  copies.max=source.dataset.max;
  if(Number(copies.value)>Number(copies.max))copies.value=copies.max;
  const button=form.querySelector('[data-feed-submit]');
  button.disabled=!copies.validity.valid;
  button.textContent='Feed · +'+numberXP(Number(source.dataset.xp)*(Number(copies.value)||0))+' XP';
 }
 async function feed(form){
  if(!gym||busy||!form.reportValidity())return;
  const card=byId(trainee);if(!card||card.id!==Number(form.dataset.recipient))return;
  busy=true;form.querySelector('[data-feed-submit]').disabled=true;
  try{
   const result=await feedLevelCard({targetId:card.id,sourceId:Number(form.elements.source.value),count:Number(form.elements.copies.value)});
   feedback=card.row[1]+' gained '+numberXP(result.xp)+' card XP'+(result.after>result.before?' and reached level '+result.after:'')+
    ' · +'+numberXP(result.playerXpEarned)+' player XP';
   sound.play(result.after>result.before?'trainWin':'perfect',{level:.78});
   applyWallet(result.wallet);
   if(visible){announce(feedback);await refreshCollection()}
  }catch(error){feedback=error.message;announce(feedback)}
  finally{busy=false;if(visible)render()}
 }
 function training(){
  if(!owned.length)return '<section class="bt-panel"><h2>Choose your first trainee</h2><p>Open a pack to take one of its level cards into the training zone.</p><a class="bt-primary" href="#gacha">Open packs</a></section>';
  const c=byId(trainee)||owned[0];trainee=c.id;const s=ownedStats(c),kit=skillsFor(c.row),t=s.training,cap=s.drillCap;
  const controls='<div class="trainee-picker"><label>Find a card<input data-trainee-search type="search" aria-label="Find a training card" placeholder="Search your levels" value="'+enc(trainQuery)+'"></label><label>Training card<select id="trainee" aria-label="Training card">'+trainingOptions()+'</select></label></div>';
  const drills=Object.entries(drillTypes).map(([id,drill])=>{
   const maxed=t[id]>=cap,mastered=maxed&&cardGrowth(t).maxed,injured=!healthy(c.id);
   const next=statsFor(c.row,{...t,[id]:Math.min(cap,t[id]+1)});
   const unit=id==='endurance'?'0.1s durability':'1 '+drill.reward;
   const points=id==='endurance'?next.maxHp-s.maxHp:next.attack-s.attack;
   const best=wallet.drillBest?.[c.id]?.[id]||0;
   const gain='+'+unit+(points?' · +'+stat(points)+(id==='endurance'?' HP':' ATK'):'');
   return '<article class="drill-choice" style="--drill:'+drill.color+'"><img class="drill-symbol" src="'+drill.icon+'" alt=""><small>'+t[id]+' / '+cap+' upgrades'+(best?' · Best '+fmt(best):'')+'</small><h3>'+drill.name+'</h3><p>'+drill.goal+'</p><b>'+(maxed?'Drill mastered':gain)+'</b><button class="outline drill-start" data-drill="'+id+'" '+(injured?'disabled':'')+'>'+(injured?'Recovering':mastered?'Play for best':maxed?'Train for XP':'Train '+(id==='endurance'?'durability':drill.reward+'s'))+newBadge(drillGuideId(id))+'</button></article>';
  }).join('');
  return '<section class="training-hero"><div class="training-thumb">'+art(c.id,c.row[6])+'</div><div><span class="gym-kicker training-tier"><img src="'+face(c.row[6])+'" alt="">'+enc(c.row[6])+(s.stage?' · '+s.stage:'')+' · Level '+s.level+'</span><h2>'+enc(c.row[1])+'</h2><p>'+enc(kit.signatureName)+'</p><div class="trained-stats"><b>'+stat(s.maxHp)+' HP</b><b>'+stat(s.attack)+' ATK</b><b>'+cap+' levels per drill</b></div><small>Training bonus +'+stat(s.hpGain)+' HP · +'+stat(s.attackGain)+' ATK</small><br><small>'+trainingLabel(t)+'</small></div>'+controls+'</section>'+feedPanel(c,s)+'<div class="drill-library">'+drills+'</div><p class="training-note">Each clear earns 6 XP. Every two clears earn one upgrade up to your card’s drill cap. Copies share training.</p>';
 }
 function drillsGame(kind){
  const card=byId(trainee);if(!card||trainingGame?.open)return;
  trainingGame=openDrill({kind,name:card.row[1],best:wallet.drillBest?.[card.id]?.[kind],sound,avatar:equippedCube(wallet),
   onStart:()=>startDrill(card.id,kind),onCheckpoint:checkpointDrill,
   onFinish:async(token,proof)=>{
    const result=await finishDrill(token,proof);applyWallet(result.wallet);
    const old=statsFor(card.row,{...result.progress,[kind]:result.progress[kind]-result.gained}),next=statsFor(card.row,result.progress);
    const growth=[result.growth.xp?'+'+result.growth.xp+' card XP':'',
     result.growth.after>result.growth.before?'Card Level '+result.growth.after:'',
     result.playerXpEarned?'+'+result.playerXpEarned+' player XP':''].filter(Boolean).join(' · ');
    if(!result.gained)return [result.newBest?'New personal best':'',growth].filter(Boolean).join(' · ')||'No upgrade this run';
    const delta=kind==='endurance'?'+'+(result.gained*.1).toFixed(1)+'s durability · +'+stat(next.maxHp-old.maxHp)+' HP':'+'+result.gained+' '+(kind==='spike'?'spike':'saw')+(result.gained===1?'':'s')+' · +'+stat(next.attack-old.attack)+' ATK';
    const gains=delta+(growth?' · '+growth:'');feedback=card.row[1]+' gained '+gains;return gains;
   },onClose:()=>{trainingGame=null;if(visible)render()}});
 }
 function activeActor(b){return relay!==null&&b.allies[relay]?.hp&&(b.relayAt||0)<=b.seq?relay:b.turn}
 function slot(c,i){
  if(!c)return '<button class="squad-slot empty-slot" data-edit><span>＋</span>Equip card '+(i+1)+'</button>';
  const r=c.row,s=ownedStats(c),rest=until(c.id);
  return '<button class="squad-slot" data-edit style="--unit:'+colors[s.tier]+'">'+art(c.id,r[6])+'<strong>'+enc(r[1])+'</strong><small>'+enc(r[6])+'</small><b>'+(healthy(c.id)?stat(s.maxHp)+' HP · '+stat(s.attack)+' ATK':'Healing <span data-until="'+rest+'">'+clock(rest-Date.now())+'</span>')+'</b></button>';
 }
 function rosterList(){
  const needle=search.trim().toLowerCase(),matches=owned.filter(c=>!needle||[c.row[1],c.row[6],c.id].join(' ').toLowerCase().includes(needle));
  const last=Math.max(0,Math.ceil(matches.length/16)-1);page=Math.min(page,last);
  const rows=matches.slice(page*16,page*16+16).map(c=>{
   const r=c.row,s=ownedStats(c),picked=draft.includes(c.id),alive=healthy(c.id);
   return '<button class="roster-choice" aria-pressed="'+picked+'" data-pick="'+c.id+'" '+(!alive&&!picked?'disabled':'')+' style="--unit:'+colors[s.tier]+'"><img src="'+face(r[6])+'" alt=""><span><b>'+enc(r[1])+'</b><small>'+enc(r[6])+' · '+stat(s.maxHp)+' HP · '+stat(s.attack)+' ATK</small></span><em>'+(picked?'✓':alive?'+':'<span data-until="'+until(c.id)+'">'+clock(until(c.id)-Date.now())+'</span>')+'</em></button>';
  }).join('');
  return (rows?'<div class="roster-list">'+rows+'</div>':'<p class="bt-muted">No cards match this search.</p>')+
   (last?'<div class="battle-pager"><button data-page="-1" '+(!page?'disabled':'')+'>Previous</button> '+(page+1)+' / '+(last+1)+' <button data-page="1" '+(page===last?'disabled':'')+'>Next</button></div>':'');
 }
 function equipment(){
  return '<section class="bt-panel edit-panel"><div class="bt-title"><div><small>SQUAD SELECTION</small><h2>Choose your four</h2></div><button class="outline" data-cancel-edit>Cancel</button></div><div class="squad-tools"><label><input type="search" data-search placeholder="Search level or difficulty" aria-label="Search owned battle cards" value="'+enc(search)+'"></label><button class="outline" data-auto>Equip best</button></div><div class="roster-picked">'+draft.map(id=>'<button data-pick="'+id+'" title="Remove from squad">'+enc(byId(id)?.row[1]||'Level')+' ×</button>').join('')+'</div><div id="rosterList">'+rosterList()+'</div><div class="bt-commit"><span>'+draft.length+' / 4 equipped</span><button class="bt-primary" data-save-team '+(draft.length!==4||draft.some(id=>!healthy(id))||busy?'disabled':'')+'>Save squad</button></div></section>';
 }
 function recovery(){
  const injured=owned.filter(c=>!healthy(c.id));if(!injured.length)return '';
  return '<aside class="medbay"><strong>Recovery bay</strong><span>Cards heal automatically.</span>'+injured.map(c=>'<b>'+enc(c.row[1])+' <time data-until="'+until(c.id)+'">'+clock(until(c.id)-Date.now())+'</time></b>').join('')+'</aside>';
 }
 function remixPicker(r,ready){
  const saved=wallet.remixBest?.[r.id]||0,win=wallet.remixWins?.[r.id]||0;
  const earned=wallet.remixKeyRewards?.[r.id]||0,keys=remixKeyReward(r);
  const clearReward=earned?earned+' Demon '+(earned===1?'Key':'Keys')+' earned':
   saved===100?'Clear again to earn '+keys+' Demon Keys':'+'+keys+' Demon Keys on a first clear';
  const bestTime=wallet.remixEndlessBest?.[r.id]||0,interval=endlessKeyInterval(r);
  const {keysRemaining,resetsAt}=endlessKeyStatus(wallet);
  const artwork=level=>enc(level.art||coverSource(level.id));
  const cards=remixes.map(level=>'<button type="button" data-remix-id="'+level.id+'" aria-pressed="'+(level.id===r.id)+'" style="--course-color:'+level.color+'">'+
   '<img class="scene-shot" data-id="'+level.id+'" src="'+artwork(level)+'" loading="lazy" alt=""><span><small>'+level.mode+'</small><strong>'+enc(level.level)+'</strong></span></button>').join('');
  return '<section class="remix-browser mini-game-browser" style="--remix:'+r.color+'"><div class="remix-preview"><img class="scene-shot" data-id="'+r.id+'" src="'+artwork(r)+'" alt="">'+
   '<div class="remix-poster-copy"><small>'+r.mode.toUpperCase()+' · '+difficulties[r.tier]+'</small><h2>'+enc(r.name)+'</h2><p>'+enc(r.hint)+'</p><small>Based on '+enc(r.level)+' by '+enc(r.creator)+'</small></div></div>'+
   '<div class="mini-mode-grid"><article><h3>Normal</h3><p>'+ico('demonKey')+' '+clearReward+' · Best '+saved+'%</p><button type="button" class="bt-primary remix-play" data-runner="normal">Play Normal'+newBadge(remixGuideId(r))+'</button></article>'+
   '<article><h3>Endless</h3><p>'+ico('demonKey')+' 1 key every '+interval+'s · Best '+clock(bestTime*1000)+'</p><button type="button" class="outline remix-play" data-runner="endless">Play Endless</button></article></div>'+
   '<p class="mini-reward-window">'+keysRemaining+' / '+endlessKeyLimit+' Endless keys available · '+(resetsAt?'Resets '+new Date(resetsAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'Resets '+endlessKeyResetHours+' hours after your first key')+'</p>'+
   '<h3 class="mini-course-label">Choose a course</h3><div class="mini-course-grid" aria-label="Mini Games courses">'+cards+'</div>'+
   '<details class="mini-remix-arena"><summary>Remix Arena · '+win+' wins</summary><p>'+enc(r.rule)+' '+(saved===100?'Your normal clear gives +1 starting charge.':'Clear Normal for +1 starting charge.')+'</p>'+
   (ready?'<button type="button" class="outline" data-start>Enter remix arena</button>':'<a class="outline" href="#battle">Set up your squad</a>')+' <button type="button" class="outline" data-preview-cue>Hear card sound</button></details></section>'+
   '<button type="button" class="grief-clip" data-watch-grief><img src="'+griefPoster+'" alt="" loading="lazy"><span><strong>Grief</strong><small>Doggie’s verification finish</small></span><b>▶ <span>Watch clip</span></b></button>';
 }
 function lobby(){
  if(picker)return equipment()+recovery();
  const team=wallet.squad||[],ready=team.length===4&&team.every(id=>healthy(id)&&byId(id));
  if(arcadePage)return remixPicker(selection,ready);
  const selector='<label class="arena-label" for="arenaChoice">Arena difficulty</label><select id="arenaChoice" aria-label="Arena difficulty">'+difficulties.slice(1).map((d,i)=>'<option value="'+(i+1)+'" '+(tier===i+1?'selected':'')+'>'+d+'</option>').join('')+'</select>';
  const campaign=battleView==='campaign';
  const poster='<section class="arena-poster'+(tier>=6?' demon-poster':'')+'" style="--arena:'+colors[tier]+'"><div class="arena-copy"><div class="battle-eyebrow">'+ico('battle')+' FOUR VS FOUR</div><h2>'+difficulties[tier]+' arena</h2>'+selector+'<div class="bounty">'+coin+'<b>'+payoutRange(tier)+'</b> coins per enemy</div></div><div class="arena-medal"><img src="'+face(difficulties[tier])+'" alt=""></div><img class="arena-banner-art" src="'+arenaArt[tier-1]+'" alt=""></section>';
  const action=owned.length<4?'<a href="#gacha" class="bt-primary">Open packs</a>':ready?
   '<button class="bt-primary" data-start '+(busy?'disabled':'')+'>'+(campaign?'Enter stage':'Enter battle')+'</button>':
   '<button class="bt-primary" data-edit>Choose squad</button>';
  const activeStage=campaignTier||Math.min(campaignStages.length,1+campaignStages.filter((_,i)=>stageCleared(wallet,i+1)).length);
  if(campaign)campaignTier=activeStage;
  const front=campaign?campaignView(wallet,activeStage,{action,coverSource,face,enc,colors}):poster;
  const squadStatus=ready?'4 / 4 ready':owned.length<4?'Collect four different cards to enter.':'Equip four cards that are ready to battle.';
  return front+'<section class="bt-panel"><div class="bt-title"><div><small>LOADOUT</small><h2>Your squad</h2></div>'+
   (owned.length?'<button class="outline" data-edit>Edit squad</button>':'')+'</div><div class="squad-grid">'+
   Array.from({length:4},(_,i)=>slot(byId(team[i]),i)).join('')+'</div><div class="bt-commit"><span>'+squadStatus+'</span>'+
   (campaign?'':action)+'</div></section>'+recovery();
 }
 function tile(u,index,side,b){
  const enemy=side==='enemies',picked=enemy&&index===target&&u.hp>0&&b.status==='active',turn=!enemy&&index===activeActor(b)&&b.status==='active',incoming=enemy&&index===b.enemyTurn&&b.status==='active';
  const label=enemy?'Target '+u.name+', '+stat(u.hp)+' of '+stat(u.maxHp)+' HP':u.name+', '+stat(u.hp)+' of '+stat(u.maxHp)+' HP';
  const key=enemy&&b.remix===86084399&&index===keyTarget(b),boss=enemy&&b.remix===u.id;
  const badge=!u.hp?(enemy?'DEFEATED':'INJURED'):key?'GREEN KEY':turn?'YOUR TURN':incoming?'UP NEXT':boss?'REMIX BOSS':u.captain?'CAPTAIN':'';
  const primed=enemy&&liveOrb(u,b.seq),orb=primed&&linkOrbs[primed.role];
  const threatened=!enemy&&b.status==='active'&&enemyIntent(b)?.aim===index;
  const finish=bestFinish(enemy?null:byId(u.id));
  const seal=(u.sealedUntil||0)-b.seq,riposte=enemy&&liveRiposte(u,b.seq);
  const flags=[seal>0?'Sealed '+seal+'T':'',u.marked?'Marked':'',u.weak?'Weak':'',u.shield?'Shield '+short(u.shield):'',
   u.staggerUntil>b.seq+1?'Staggered':'',u.evade===1?'Nullify ready':u.evade?'Dodge ready':'',u.fury?'Attack boosted':''].filter(Boolean);
  const rank=u.difficulty===impossibleCategory?'ILL #'+fmt(u.rank):u.rank?(u.stage?enc(u.stage)+' · ':'')+'#'+fmt(u.rank):ratingLabel(u.stars??(u.tier>=6?10:null),u.platformer);
  const shell='<div class="arena-slot" style="--unit:'+colors[u.tier]+'"><i class="arena-socket" aria-hidden="true"></i>'+
   '<div class="arena-card-body"'+(!u.hp?' data-fallen':'')+'>'+cardChassis;
  const state=(orb?'<span class="tile-orb" style="--orb:'+orb.color+'" title="'+orb.name+' · '+(primed.expires-b.seq)+' turns"><i class="mini-orb"></i><b>'+(primed.expires-b.seq)+'</b></span>':'')+
   (flags.length?'<span class="status-ribbon">'+flags.join(' · ')+'</span>':'')+
   (riposte?'<span class="riposte-flag" title="Riposte · +'+Math.round(riposte.boost*100)+'% attack · '+(riposte.expires-b.seq)+' turns">↶ +'+Math.round(riposte.boost*100)+'%</span>':'')+
   (badge?'<b class="combat-badge">'+badge+'</b>':'');
  return shell+'<button class="fighter full-card '+(finishClass(finish)+' ')+(picked?'targeted ':'')+(turn?'acting ':'')+(!u.hp?'down ':'')+(boss?'remix-boss ':'')+(threatened?'threatened':'')+'" data-unit="'+side+'-'+index+'" style="--unit:'+colors[u.tier]+';--hp:'+(100*u.hp/u.maxHp)+'%" '+(enemy?'data-target="'+index+'" aria-pressed="'+picked+'" '+(!u.hp||b.status!=='active'||playback?'disabled':''):'data-ally="'+index+'" aria-pressed="'+turn+'" '+(playback?'disabled':''))+' aria-label="'+enc((enemy?label:(u.hp?'Select teammate ':'Inspect ')+label)+(riposte?', riposte ready':''))+'"><div class="battle-card-top"><img src="'+face(u.difficulty)+'" alt=""><span>'+enc(u.difficulty)+'</span></div><div class="combat-art">'+art(u.id,u.difficulty,true)+'<small>'+rank+'</small></div><div class="fighter-data"><strong title="'+enc(u.name)+'">'+enc(u.name)+'</strong>'+(u.creator?'<span class="fighter-by">by '+enc(u.creator)+'</span>':'')+'<div class="hp"><i></i></div><span class="fighter-numbers"><small data-vital>'+stat(u.hp)+' / '+stat(u.maxHp)+' HP</small><small class="fighter-atk">'+stat(u.attack)+' ATK</small></span></div><span class="fighter-state">'+state+'</span></button></div></div>';

 }
 function inspect(u,side,i){
  if(!u||inspection?.open)return;
  const el=root.querySelector('[data-unit="'+side+'-'+i+'"] .unit-cover');
  const modal=document.createElement('dialog');inspection=modal;modal.className='battle-inspector';
  modal.style.setProperty('--unit',colors[u.tier]);modal.setAttribute('aria-label',u.name+' battle card');
  const img=el?.currentSrc||coverSource(u.id);
  modal.innerHTML='<button class="inspect-close" aria-label="Close card">×</button><article><div class="inspect-title">'+nameplate(u.tier)+'<b>'+(u.difficulty===impossibleCategory?'ILL #'+fmt(u.rank):u.rank?(u.stage?enc(u.stage)+' · ':'')+'AREDL #'+fmt(u.rank):u.stars?ratingLabel(u.stars,u.platformer):'')+'</b></div><img class="inspect-cover" src="'+enc(img)+'" alt=""><h2>'+enc(u.name)+'</h2>'+(u.creator?'<p>by '+enc(u.creator)+'</p>':'')+'<div class="inspect-stats"><span>Health <b>'+stat(u.hp)+' / '+stat(u.maxHp)+'</b></span><span>Attack <b>'+stat(u.attack)+'</b></span><span>Role <b>'+u.role+'</b></span></div></article>';
  const b=wallet?.battle,kit=side==='allies'&&b?tacticDescription(b,u).kit:skillsFor(u),train=trainingOf(u.training,trainingCapacity(u));
  const passive=u.id===execution.id?'<p class="steal-rule"><b>'+execution.name+'</b> '+enc(execution.rule)+'</p>':'';
  const credited=side==='allies'?(b?.takedowns?.[u.id]||0):0;
  modal.querySelector('article').insertAdjacentHTML('beforeend','<div class="inspect-kit"><div class="inspect-move">'+moveArt(kit.basicArt)+'<div><strong>'+enc(kit.basicName)+'</strong><p>'+enc(technique(kit,kit.basic).text)+'</p></div></div>'+
   '<div class="inspect-move">'+moveArt(kit.signatureArt)+'<div><strong>'+enc(kit.signatureName)+'</strong><p>'+enc(signatureDetail(kit))+'</p></div></div>'+passive+
   (credited?'<small>'+credited+(credited===1?' takedown':' takedowns')+' this battle</small>':'')+
   '<small>Training bonus +'+stat(u.hpGain)+' HP · +'+stat(u.attackGain)+' ATK</small><small>'+trainingLabel(train)+'</small></div>');
  document.body.append(modal);const card=modal.querySelector('article'),cover=modal.querySelector('.inspect-cover');
  cover.onerror=()=>{cover.onerror=null;cover.classList.add('placeholder');cover.src=face(u.difficulty)};
  modal.querySelector('button').onclick=()=>modal.close();modal.onclick=e=>{if(e.target===modal)modal.close()};
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
   card.onpointermove=e=>{const r=card.getBoundingClientRect();card.style.transform='rotateX('+((.5-(e.clientY-r.top)/r.height)*12)+'deg) rotateY('+(((e.clientX-r.left)/r.width-.5)*17)+'deg)'};
   card.onpointerleave=()=>{card.style.transform=''};
  }
  modal.addEventListener('close',()=>{inspection=null;modal.remove()},{once:true});modal.showModal();sound.play('inspect');
 }
 function arena(b){
  if(!b.enemies[target]?.hp)target=b.enemies.findIndex(e=>e.hp>0);
  const done=b.status!=='active',actor=activeActor(b),remix=findRemix(b.remix);
  const stage=stageFor(b.campaign);
  const title=stage?.name||remix?.name||difficulties[b.tier]+' arena';
  const mast='<div class="arena-mast"><a class="arena-home" href="#leaderboard" aria-label="Return to levels"><img class="brand-emblem" src="/assets/gd-kingdom-castle-icon.png" width="96" height="96" alt=""></a><div class="mast-title"><small>'+(stage?'CAMPAIGN · STAGE '+b.campaign:remix?'REMIX ARENA':'BATTLE MODE')+'</small><h1>'+enc(title)+'</h1></div><div class="mast-tools"><button type="button" class="iconbtn arena-help" data-section-help aria-label="Battle help" title="Battle help" aria-haspopup="dialog">?</button>'+mutedBtn()+arenaActivities(playerLevel)+'<a class="outline leave-field" href="#gacha">Packs</a></div></div>';
  const side=(units,key,title,tip)=>'<div class="battle-side"><h3><span>'+title+'</span><small>'+enc(tip)+'</small></h3><div class="formation">'+units.map((u,i)=>tile(u,i,key,b)).join('')+'</div></div>';
  const relayWait=Math.max(0,(b.relayAt||0)-b.seq);
  const center='<div class="versus" title="Drag to orbit, scroll to zoom, or double-click here to reset."><span data-cast aria-live="polite">'+(playback?'WINDUP':done?'ARENA CLOSED':'TURN '+(b.seq+1))+'</span></div>';
  const field='<div class="battlefield live-field" style="--arena:'+colors[b.tier]+'"><div class="battle-lanes arena-view"><div class="arena-world">'+arenaDeck+side(b.enemies,'enemies','Opposing squad',done?'':b.kills+' / 4 defeated · Tap a target')+center+side(b.allies,'allies','Your squad',done?'':relayWait?'Relay in '+relayWait+' turns':'Tap a teammate to relay')+'</div></div></div>';
  const earnings='<div class="arena-earnings" aria-label="Battle earnings" aria-live="polite">'+
   '<span class="arena-coins"><img src="/assets/packs/coin.png" alt=""><b>'+fmt(b.earned)+'</b> <span>coins earned</span></span>'+
   '<span class="arena-xp">'+ico('spark')+'<b>'+fmt(arenaPlayerXp(b))+'</b> <span>XP earned</span></span></div>';
  const next=b.status==='won'&&stage&&stageFor(b.campaign+1);
  const controls=done?'<section class="live-console outcome"><div><small>'+b.kills+' / 4 DEFEATED</small><h2>'+(b.status==='won'?'Victory':b.status==='lost'?'Squad defeated':'Retreated')+'</h2>'+campaignOutcome(b)+'</div><div class="outcome-actions">'+
   (next?'<button class="bt-primary" data-next-stage="'+(b.campaign+1)+'">Next stage</button>':'')+
   '<button class="'+(next?'outline':'bt-primary')+'" data-finish>'+(stage?'Return to campaign':'Return to arenas')+'</button></div></section>':consoleView(b,actor,target,enc);
  const intel=done?'<div class="arena-closed">Battle complete</div>':intentView(b,actor,target,enc);
  const tools='<div class="console-toolbar">'+cameraTools+(!done&&!playback?'<button class="outline" data-orders>'+ico('list')+' Tactics &amp; log</button>':'')+'</div>';
  return '<section class="live-arena" data-encounter="'+enc(b.id)+'" aria-label="Battle arena">'+mast+'<div class="arena-grid">'+intel+'<div class="arena-board">'+field+earnings+'</div>'+controls+tools+'</div></section>';
 }
 function syncArena(live,markup){
  const template=document.createElement('template');template.innerHTML=markup;
  const next=template.content;
  for(const selector of ['.live-intent,.arena-closed','.live-console']){
   live.querySelector(selector).replaceWith(next.querySelector(selector));
  }
  const earnings=live.querySelector('.arena-earnings');
  const amounts=next.querySelectorAll('.arena-earnings b');
  earnings.querySelectorAll('b').forEach((amount,i)=>{if(amount.textContent!==amounts[i].textContent)amount.textContent=amounts[i].textContent;});
  const oldOrders=live.querySelector('[data-orders]'),newOrders=next.querySelector('[data-orders]');
  if(!newOrders)oldOrders?.remove();
  else if(!oldOrders)live.querySelector('.console-toolbar').append(newOrders);
  live.querySelector('[data-cast]').textContent=next.querySelector('[data-cast]').textContent;
  const sideNotes=next.querySelectorAll('.battle-side h3 small');
  live.querySelectorAll('.battle-side h3 small').forEach((label,i)=>{label.textContent=sideNotes[i].textContent});
  for(const state of next.querySelectorAll('[data-unit]')){
   const card=live.querySelector('[data-unit="'+state.dataset.unit+'"]');
   const classes=state.className+(card.classList.contains('gpu-portrait')?' gpu-portrait':'');
   if(card.className!==classes)card.className=classes;
   card.style.setProperty('--hp',state.style.getPropertyValue('--hp'));
   card.setAttribute('aria-label',state.getAttribute('aria-label'));
   card.setAttribute('aria-pressed',state.getAttribute('aria-pressed'));
   card.disabled=state.disabled;
   card.querySelector('[data-vital]').textContent=state.querySelector('[data-vital]').textContent;
   card.querySelector('.fighter-state').replaceWith(state.querySelector('.fighter-state'));
   card.closest('.arena-card-body').toggleAttribute('data-fallen',card.classList.contains('down'));
  }
  arenaViewport?.refresh();
 }
 function render(){
  if(!visible)return;
  const live=!gym&&!arcadePage&&wallet?.battle&&loaded;
  if(!live)arenaViewport?.detach();
  const match=live&&(playback||wallet.battle),current=root.querySelector('.live-arena');
  if(!gym&&!arcadePage)onGuide?.((match?match.campaign:battleView==='campaign')?'battle-campaign':'battle-arenas');
  if(match&&current?.dataset.encounter===match.id){
   syncArena(current,arena(match));
   root.querySelector('.bt-feedback').textContent=feedback;
   return;
  }
  const screen=live?'arena':picker?'squad':loaded?battleView:'';
  const activeLink=root.contains(document.activeElement)?document.activeElement?.closest('.battle-navigation [data-battle-link]')?.dataset.battleLink:null;
  const heading=live?'':'<div class="bt-heading"><h1>'+(gym?'Training zone':arcadePage?'Mini Games':battleView==='campaign'?'Battle campaign':'Battle mode')+'</h1>'+mutedBtn()+'</div>'+
   battleNavigation(battleView,playerLevel);
  const content=collectionError&&!loaded?'<p>Your squad could not load. <button class="outline" data-retry-collection>Try again</button></p>':
   !wallet||!loaded?loadingMarkup('Loading your squad…'):gym?training():match?arena(match):lobby();
  root.innerHTML=heading+(live?content:'<div class="battle-content'+(screen&&lastScreen!==screen?' battle-enter':'')+'">'+content+'</div>')+
   '<div class="bt-feedback" role="status">'+enc(feedback)+'</div>';
  lastScreen=screen;
  if(activeLink)root.querySelector('.battle-navigation [data-battle-link="'+activeLink+'"]')?.focus({preventScroll:true});
  if(live){
   bindArenaCamera(root,camera);
   if(arenaViewport===undefined)arenaViewport=createArenaViewport();
   arenaViewport?.attach(root.querySelector('.arena-view'));
  }
 }
 function showOrders(b){
  const live=root.querySelector('.live-arena');
  live.querySelector('.orders-sheet')?.remove();
  live.insertAdjacentHTML('beforeend',ordersView(b,activeActor(b),target,enc));
  const sheet=live.querySelector('.orders-sheet');
  const stage=stageFor(b.campaign);
  if(stage)sheet.querySelector('.orders-head').insertAdjacentHTML('afterend',
   '<p><b>Stage objectives</b> · '+stage.turns+' turns or fewer · 3 allies standing</p><p>'+stageRules(stage).join(' · ')+'</p>');
  sheet.addEventListener('close',()=>sheet.remove(),{once:true});sheet.showModal();
 }
 function showMoveLibrary(b){
  const live=root.querySelector('.live-arena'),actor=activeActor(b);
  live.insertAdjacentHTML('beforeend',techniqueView(b,actor,enc));
  const sheet=live.querySelector('.signature-library');
  const style=sheet.querySelector('[data-technique-style]'),form=sheet.querySelector('[data-technique-filter]');
  const namedForms=Array.from(form.options).filter(option=>['Level moves','Bonus moves'].includes(option.value));
  sheet.addEventListener('change',()=>{
   for(const option of namedForms)option.disabled=style.value!=='0';
   if(form.selectedOptions[0]?.disabled)form.value='';
   for(const card of sheet.querySelectorAll('[data-form]'))card.hidden=card.dataset.style!==style.value||(!!form.value&&card.dataset.form!==form.value);
  });
  sheet.addEventListener('close',()=>sheet.remove(),{once:true});sheet.showModal();
 }
 async function commit(job,kind){
  if(busy)return;busy=true;feedback='';
  const before=kind==='turn'?wallet.battle:null;
  try{
   const w=await job();
   if(kind==='save')picker=false;
   if(kind==='start'||kind==='save')draft=[...w.squad];
   const animate=visible&&!gym&&!arcadePage&&before&&w.battle?.id===before.id&&w.battle.seq===before.seq+1&&w.battle.events.length&&w.battle.status!=='retreated'&&!document.hidden;
   if(animate){
    playback=before;
    if(w.battle.campaignReceipt?.coins)clearTicket=rewards.reserve('coins',w.battle.campaignReceipt.coins);
    for(const evt of w.battle.events)if(evt.kind==='knockout'&&evt.amount>0)bountyTickets.set(evt.index,rewards.reserve('coins',evt.amount));
   }
   applyWallet(w);
   if(animate){
    if(!root.querySelector('.command'))render();
    root.querySelector('.arena-view').classList.add('camera-locked');
    lockCommands(root.querySelector('.command'));
    root.querySelectorAll('.fighter,[data-orders],[data-aim-caster]').forEach(control=>control.disabled=true);
    stopPlayback=playCardTurn(root,before,w.battle,sound,finishPlayback,(index,element)=>{
     const ticket=bountyTickets.get(index);if(!ticket)return;
     bountyTickets.delete(index);rewards.launch(ticket,element,{front:true});
    });
   }else{busy=false;render()}
   if(visible&&(kind==='start'||kind==='save'))sound.play(kind==='start'?'charged':'select');
  }catch(e){feedback=e.message;finishPlayback();announce(e.message)}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playback)finishPlayback()});
 root.oninput=e=>{if(e.target.matches('[data-trainee-search]')){trainQuery=e.target.value;const box=root.querySelector('#trainee');box.innerHTML=trainingOptions();if(box.value){trainee=Number(box.value);render();const input=root.querySelector('[data-trainee-search]');input.focus();input.setSelectionRange(input.value.length,input.value.length)}else{box.innerHTML='<option disabled>No matches</option>';root.querySelectorAll('[data-drill]').forEach(el=>el.disabled=true)};return}if(e.target.matches('[data-search]')){search=e.target.value;page=0;root.querySelector('#rosterList').innerHTML=rosterList()}};
 root.onchange=e=>{if(e.target.id==='trainee'){trainee=Number(e.target.value);sound.play('select');render();return}if(e.target.id==='arenaChoice'){tier=Number(e.target.value);sound.play('select');render();root.querySelector('#arenaChoice')?.focus({preventScroll:true})}};
 root.addEventListener('input',e=>{if(e.target.form?.matches('[data-feed]'))feedInput(e.target.form)});
 root.addEventListener('change',e=>{if(e.target.form?.matches('[data-feed]'))feedInput(e.target.form)});
 root.addEventListener('submit',e=>{if(e.target.matches('[data-feed]')){e.preventDefault();feed(e.target)}});
 root.onclick=e=>{
  const el=e.target.closest('button');if(!el||!visible)return;
  const d=el.dataset;
  if('feedMax'in d){const form=el.form;form.elements.copies.value=form.elements.copies.max;feedInput(form);return}
  if('retryCollection'in d){feedback='';refreshCollection();render();return}
  if('bsound'in d){sound.toggle();el.setAttribute('aria-pressed',sound.enabled);el.title=sound.enabled?'Mute battle audio':'Enable battle audio';el.innerHTML=ico(sound.enabled?'volume':'muted');return}
  if('fast'in d&&playback){sound.stop();finishPlayback();return}
  if(busy||!wallet)return;
  if(d.drill){drillsGame(d.drill);return}
  if(d.stage&&stageUnlocked(wallet,Number(d.stage))){
   campaignTier=Number(d.stage);sound.play('select');render();
   root.querySelector('[data-stage="'+campaignTier+'"]')?.focus({preventScroll:true});return;
  }
  if('previewCue'in d&&selection){sound.stop();sound.play(selection.cue);return}
  if('watchGrief'in d){watchGrief(sound);return}
  if(d.remixId&&arcadePage){
   selection=findRemix(Number(d.remixId));sound.play('select');render();
   root.querySelector('[data-remix-id="'+selection.id+'"]')?.focus({preventScroll:true});
   if(e.detail)root.querySelector('.remix-preview')?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
   return;
  }
  if('runner'in d&&selection){
   if(runner?.open)return;
   const stage=selection;
   const settle=command=>async(token,proof)=>{
    const {wallet:next,result}=await command(token,proof);applyWallet(next);if(visible&&!playback)render();return result;
   };
   const open=stage.id===tidalVideoId&&d.runner==='normal'?openTidalVideo:openRunner;
   runner=open(stage,{sound,avatar:equippedCube(wallet),mode:d.runner,onStart:mode=>startRemix(stage.id,mode),onFinale:startLimboFinale,
    onCheckpoint:settle(checkpointRemix),onResult:settle(recordRemix)});
   runner.addEventListener('close',()=>{runner=null;if(visible&&!playback)render()},{once:true});return;
  }
  if('edit'in d){
   draft=[...(wallet.squad||[])];picker=true;search='';page=0;feedback='';render();
   const searchField=root.querySelector('[data-search]');
   searchField.closest('.edit-panel')?.scrollIntoView({block:'start'});
   if(matchMedia('(pointer:fine)').matches)searchField.focus({preventScroll:true});
   return;
  }
  if('cancelEdit'in d){picker=false;feedback='';render();root.querySelector('[data-edit]')?.focus();return}
  if('auto'in d){draft=owned.filter(c=>healthy(c.id)).slice(0,4).map(c=>c.id);sound.play('stack');render();return}
  if('pick'in d){
   const id=Number(d.pick);
   if(draft.includes(id))draft=draft.filter(v=>v!==id);
   else if(draft.length<4&&healthy(id))draft.push(id);
   else{feedback='Remove one equipped card to make room.';render();return}
   feedback='';sound.play('select');render();return;
  }
  if('page'in d){page+=Number(d.page);render();return}
  if('saveTeam'in d){commit(()=>saveSquad([...draft]),'save');return}
  if('start'in d){
   const campaign=battleView==='campaign',remix=arcadePage?selection:null;
   const difficulty=campaign?campaignTier:remix?.tier||tier;
   const fromArcade=arcadePage;
   commit(async()=>{const w=await enterArena([...(wallet.squad||[])],difficulty,remix?.id,{campaign});if(fromArcade&&location.hash==='#battle/arcade')location.hash='#battle';return w},'start');return;
  }
  const b=wallet.battle;if(!b)return;
  if('aimCaster'in d){target=enemyIntent(b).index;sound.play('telegraph');render();return}
  if('orders'in d){showOrders(b);return}
  if('moveLibrary'in d){showMoveLibrary(b);return}
  if('closeOrders'in d){el.closest('dialog').close();return}
  if('techniqueChoice'in d){
   const chosen=Number(d.techniqueChoice),actor=activeActor(b);
   el.closest('dialog').close();sound.play('select');
   commit(()=>equipTechnique(b.id,b.seq,actor,chosen),'equip-technique');
   return;
  }
  if('inspectActor'in d){inspect(b.allies[activeActor(b)],'allies',activeActor(b));return}
  if('ally'in d){
   const i=Number(d.ally);
   if(b.status!=='active'||!b.allies[i].hp||i===activeActor(b)||(b.relayAt||0)>b.seq){inspect(b.allies[i],'allies',i);return}
   relay=i;sound.play('select');render();return;
  }
  if('inspectTarget'in d){inspect(b.enemies[target],'enemies',target);return}
  if('target'in d){target=Number(d.target);sound.play('select');render();return}
  if('retreat'in d){
   const bar=el.parentElement;el.remove();
   bar.insertAdjacentHTML('beforeend','<b>Withdraw now?</b><button class="outline" data-withdraw>Confirm retreat</button><button class="outline" data-stay>Stay</button>');return;
  }
  if('stay'in d){showOrders(b);return}
  if('finish'in d||d.nextStage){
   if(d.nextStage&&stageUnlocked(wallet,Number(d.nextStage)))campaignTier=Number(d.nextStage);
   commit(async()=>{
    const next=await leaveResults(b.id);
    if(b.remix&&visible&&location.hash==='#battle')location.hash='#battle/arcade';
    return next;
   },'leave');return;
  }
  if('move'in d||'withdraw'in d){if(d.move==='break')target=enemyIntent(b).index;root.querySelector('.orders-sheet')?.close();commit(()=>battleAction(b.id,b.seq,d.move||'retreat',target,activeActor(b)),'turn')}
 };
 document.addEventListener('keydown',e=>{
  if(!visible||gym||arcadePage||!loaded||busy||e.repeat||e.defaultPrevented||e.altKey||e.metaKey||e.ctrlKey||e.shiftKey||wallet?.battle?.status!=='active'||document.querySelector('dialog[open]')||e.target.closest('input,select,textarea,[contenteditable="true"]'))return;
  const move=['strike','pulse','break','guard'][Number(e.key)-1];
  const button=move&&root.querySelector('[data-move="'+move+'"]');
  if(button&&!button.disabled){e.preventDefault();sound.unlock();button.click()}
 });
 return {show,setWallet,refreshCollection};
}
