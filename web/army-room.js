import {armyChapters,armySeries,findArmySeries,seriesCleared,seriesUnlocked,seriesFinaleReward,chapterCleared,chapterUnlocked,chapterGems,configureTrilogy,armyLoot,armyTrialIds,armyRivals,beginArmyRun,startArmyBattle,settleArmyBattle} from './army-trilogy.js';
import {stat} from './card-economy.js';
import {difficulties,readCollection,pool} from './pack-engine.js';
import {armyLimit,armySpeed,armyMaps,armyBackdrops,backdropSource,armyFrame,armyStats,mixedSquad,makeArmyBattle,stepArmy} from './army-battle.js';
import {createArmyWorld} from './army-world.js';
import {skillsFor} from './card-skills.js';
import {ico} from './icons.js';
import {battleNavigation} from './battle-navigation.js';
import {playerProgress} from './player-progression.js';

const fixed=armyFrame;
const resultText={won:'Victory',lost:'Army defeated',draw:'Draw',retreated:'Army withdrew'};
const currencies={coins:'coin',gems:'gem'};
const money=(kind,n)=>{
 const label=n===1?(kind==='gems'?'gem':'coin'):kind;
 return '<span class="army-money" data-currency="'+kind+'" title="'+n.toLocaleString('en-US')+' '+label+
  '"><img src="/assets/packs/'+currencies[kind]+'.png" alt="">'+stat(n)+' '+label+'</span>';
};
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const timeText=n=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');

export function createArmyRoom({root,sound,coverSource,enc,getWallet,applyWallet,rewards}){
 let open=false,world=null,frame=0,readId=0,poolId=0;
 let inventory=[],deployment=[],sample=[],arena='foundry',tier=1,chapter=0,query='',ready=false,loaded=false,poolError=false,collectionError=false;
 let trilogy=armySeries[0],lastTrilogy=trilogy,seriesQuery='',starterOnly=false,seriesBackdrop=null,skirmishTier=1;
 let battle=null,phase='setup',countdown=0,accumulator=0,clock=0,renderAt=-1,previous=0,angle=0,drag=null;
 let casts=[],bursts=[],recentMove='',nextMove=0,lastStats=-1,slotsStamp='',cueTime=new Map();
 let payoutState='',receipt=null,hovered=null,pinned=null,cursor=null,callouts=[];
 const view={zoom:1,x:0,y:0};
 const pointers=new Map();
 let pinch=null;
 const currentChapter=()=>trilogy?.stages[chapter]||armyChapters[chapter];
 const progress=(wallet,i)=>trilogy?seriesCleared(wallet,trilogy.key,i):chapterCleared(wallet,tier,i);
 const unlocked=(wallet,i)=>trilogy?seriesUnlocked(wallet,trilogy.key,i):chapterUnlocked(wallet,tier,i);
 let backdrops={};
 try{
  const saved=JSON.parse(localStorage.getItem('gdlb.armyBackdrops'));
  if(saved&&typeof saved==='object')backdrops=saved;
 }catch{}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const el=name=>root.querySelector('[data-army-'+name+']');
 const training=card=>card.trial?null:getWallet()?.training?.[card.row[0]];
 const ids=()=>deployment.map(c=>Number(c.row[0]));
 const active=id=>!(getWallet()?.injuries?.[id]>Date.now());
 const limit=card=>Math.max(0,(card.trial?1:card.copies)-ids().filter(id=>id===Number(card.row[0])).length);
 const portrait=(id,thumb=coverSource(id))=>'<img class="army-card-art" src="'+enc(thumb)+'" alt="" loading="lazy">';
 const action=(key,text,primary=false)=>'<button type="button" class="'+(primary?'bt-primary':'outline')+'" data-army-act="'+key+'">'+text+'</button>';
 function markup(){
  const skies=Object.entries(armyBackdrops).map(([key,name])=>'<option value="'+key+'">'+name+'</option>').join('');
  return '<div class="bt-heading army-heading"><div><h1>Army mode</h1><p>Deploy up to 10 cards in real-time battles.</p></div>'+
  '<button type="button" class="iconbtn" data-army-act="sound" aria-label="Battle audio"></button></div>'+
  '<div data-army-mode-links></div>'+
  '<section class="army-trilogy" aria-label="Army Trilogies"><div class="army-series-heading"><div><h2 data-army-mode-title>Army Trilogies</h2><span data-army-tier></span></div>'+
  '<div class="army-series-tabs" role="group" aria-label="Army challenge type"><button class="outline" data-army-act="series">Trilogies</button><button class="outline" data-army-act="skirmish">Skirmish</button></div></div>'+
  '<div class="army-series-controls" data-army-series-controls><label>Find a trilogy<input type="search" data-army-series-search placeholder="Try Bloodbath or CraZy" maxlength="80"></label>'+
  '<label>Choose a trilogy<select data-army-series-select></select></label><button class="outline" data-army-act="starters" aria-pressed="false" title="Show runs through Easy Demon">Starter trilogies</button></div>'+
  '<div class="army-series-info" data-army-series-info></div><div class="army-chapters" data-army-chapters role="group" aria-label="Trilogy levels"></div></section>'+
  '<div class="army-layout"><section class="army-stage" aria-label="Army battlefield">'+
  '<div class="army-field" data-army-field><div class="army-field-head"><div><small data-army-chapter-name></small><h2 data-army-mapname></h2></div><span class="army-timer" data-army-time>0:00</span></div>'+
  '<div class="army-floaters" data-army-floaters aria-hidden="true"></div>'+
  '<div class="army-inspect" data-army-inspect hidden></div>'+
  '<div class="army-score" data-army-score></div><div class="army-countdown" data-army-count aria-live="polite" hidden></div>'+
  '<div class="army-outcome" data-army-result role="status" hidden></div></div>'+
  '<div class="army-strip"><div class="army-feed" data-army-feed></div><div class="army-camera" role="group" aria-label="Army camera">'+
  '<button class="iconbtn" type="button" data-army-act="left" aria-label="Rotate camera left">'+ico('left')+'</button>'+
  '<button class="iconbtn" type="button" data-army-act="reset" aria-label="Reset camera">'+ico('camera')+'</button>'+
  '<button class="iconbtn" type="button" data-army-act="right" aria-label="Rotate camera right">'+ico('right')+'</button>'+
  '<button class="iconbtn" type="button" data-army-act="zoom-out" title="Zoom out" aria-label="Zoom out">'+ico('zoomOut')+'</button>'+
  '<output data-army-zoom aria-label="Camera zoom">100%</output>'+
  '<button class="iconbtn" type="button" data-army-act="zoom-in" title="Zoom in" aria-label="Zoom in">'+ico('zoomIn')+'</button></div></div>'+
  '<div class="army-command"><div class="army-spoils" data-army-spoils></div><div class="army-actions" data-army-command></div></div>'+
  '<p class="army-feedback" data-army-feedback role="status" hidden></p></section>'+
  '<aside class="army-panel" aria-label="Army deployment">'+
  '<div class="army-config" data-army-config><div class="army-panel-head"><h2>Deployment</h2><b data-army-total></b></div>'+
  '<div class="army-slots" data-army-slots aria-label="Deployed cards"></div>'+
  '<div class="army-settings"><label class="army-tier-setting" for="armyDifficulty">Rival difficulty<select id="armyDifficulty">'+
  difficulties.slice(1).map((d,i)=>'<option value="'+(i+1)+'">'+d+'</option>').join('')+'</select></label>'+
  '<fieldset class="army-maps"><legend>Battle map</legend>'+Object.entries(armyMaps).map(([key,m])=>
   '<button type="button" data-army-map="'+key+'" style="--preview:url('+backdropSource(m.backdrop)+')" aria-pressed="false"><span>'+m.name+'</span></button>').join('')+'</fieldset><label for="armyBackdrop">Backdrop</label><select id="armyBackdrop">'+skies+'</select></div>'+
  '<div class="army-picker"><div class="army-panel-head"><h3 data-army-library>Available cards</h3>'+action('clear','Clear')+'</div>'+
  '<input type="search" data-army-search aria-label="Search available cards" placeholder="Name, tier or style…" maxlength="80">'+
  '<div class="army-roster" data-army-roster></div></div></div>'+
  '<div class="army-stats" data-army-stats hidden><div class="army-panel-head"><h2>Field report</h2></div><div data-army-standing></div></div></aside></div>';
 }
 function speaker(){
  const button=root.querySelector('[data-army-act="sound"]');
  button.title=sound.enabled?'Mute battle audio':'Enable battle audio';
  button.setAttribute('aria-pressed',String(sound.enabled));button.innerHTML=ico(sound.enabled?'volume':'muted');
 }
 function message(text){
  const feedback=el('feedback');feedback.hidden=!text;feedback.textContent=text;
 }
 function patchControl(){
  const command=el('command');
  const next=phase==='setup'?(world&&deployment.length&&ready&&!poolError&&!collectionError?'ready':'wait'):phase;
  const stamp=[next,poolError||collectionError,payoutState,trilogy?.key,chapter,battle?.status].join('|');
  if(command.dataset.stamp===stamp)return;
  command.dataset.stamp=stamp;
  const controls={
   ready:action('start',ico('battle')+' Start battle',true),
   wait:poolError||collectionError?action('retry','Retry loading'):'<button type="button" class="bt-primary" disabled>'+ico('battle')+' Start battle</button>',
   countdown:action('edit','Cancel start'),
   live:action('pause','Pause'),
   paused:action('resume','Resume battle',true)+action('retreat','Withdraw'),
   done:payoutState==='saving'?'<span class="army-saving">Saving rewards…</span>':
    payoutState==='error'?action('retry-loot','Retry rewards',true):
    (battle?.status==='won'&&chapter<armyChapters.length-1?action('next','Next level',true):action('rematch','Rematch',true))+
    action('edit','Edit squad')
  };
  command.innerHTML=(phase==='setup'?'<button type="button" class="outline army-mobile-link" data-army-act="deployment">Deploy cards</button>':'')+controls[next];
 }
 function slots(){
  const stamp=ids().join(',');if(stamp===slotsStamp)return;slotsStamp=stamp;
  el('total').textContent=deployment.length+' / '+armyLimit;
  el('slots').innerHTML=Array.from({length:armyLimit},(_,i)=>{
   const c=deployment[i],n=String(i+1).padStart(2,'0');
   return c?'<button type="button" data-army-remove="'+i+'" title="Remove '+enc(c.row[1])+'" aria-label="Remove '+enc(c.row[1])+'">'+portrait(c.row[0])+'<span>'+n+'</span><i aria-hidden="true">×</i></button>'
    :'<span class="army-empty-slot" aria-label="Empty slot '+(i+1)+'">'+n+'</span>';
  }).join('');
 }
 function roster(){
  const list=el('roster');
  const filter=query.trim().toLowerCase(),usable=inventory.filter(c=>active(c.row[0]));
  const trial=inventory.length>0&&inventory.every(c=>c.trial);
  el('library').textContent=trial?'Trial cards':'Your cards';
  root.querySelector('[data-army-act="clear"]').disabled=!deployment.length;
  if(collectionError){list.innerHTML='<p>Could not load your cards.</p>';return}
  if(!loaded){list.innerHTML='<p>Loading cards…</p>';return}
  const filtered=usable.filter(c=>!filter||[c.row[1],c.row[6],c.row[0],armyStats(c.row).style].join(' ').toLowerCase().includes(filter));
  if(!filtered.length){list.innerHTML='<p>'+(filter?'No matching cards.':'Your cards are recovering.')+'</p>';return}
  list.innerHTML=filtered.slice(0,64).map(c=>{
   const id=c.row[0],name=enc(c.row[1]),canAdd=deployment.length<armyLimit&&limit(c)>0;
   const kit=skillsFor(c.row),detail=armyStats(c.row,training(c),kit),skill=enc(kit.signatureName);
   return '<button type="button" class="army-pick" data-army-add="'+id+'" '+(canAdd?'':'disabled')+
    ' aria-label="Deploy '+name+'" title="'+skill+' · '+detail.maxHp+' HP · '+detail.attack+' ATK">'+portrait(id)+
    '<span><b>'+name+'</b><small class="army-style" data-style="'+detail.style+'">'+detail.style+' · Lvl '+detail.level+' · '+enc(c.row[6])+
    '</small></span><span class="army-copy-count">'+'×'+limit(c)+'</span></button>';
  }).join('')+(filtered.length>64?'<p>Search to find more of your cards.</p>':'');
 }
 function listSeries(){
  const selector=el('series-select'),filter=seriesQuery.toLowerCase().trim();
  const results=armySeries.filter(s=>(!starterOnly||s.tier<=6)&&(!filter||[s.name,...s.stages.map(t=>t.name)].join(' ').toLowerCase().includes(filter)));
  selector.innerHTML='<option value="">'+(results.length?'Choose from '+results.length+' trilogies':'No matching trilogies')+'</option>'+
   results.map(series=>'<option value="'+series.key+'">'+enc(series.name)+'</option>').join('');
  selector.value=results.includes(trilogy)?trilogy.key:'';
 }
 function chooseSeries(next){
  trilogy=next;
  if(next)lastTrilogy=next;
  arena=next?.map||'harbor';seriesBackdrop=null;
  tier=next?.stages[0].tier||skirmishTier;
  chapter=[2,1,0].find(i=>unlocked(getWallet(),i)&&!progress(getWallet(),i))??2;
  if(next)tier=currentChapter().tier;
  listSeries();sound.play('select');chooseRivals();
 }
 function chapterControls(){
  const wallet=getWallet(),chips=el('chapters'),mark=trilogy?wallet?.armySeries?.[trilogy.key]||0:wallet?.armyTrilogy?.[tier]||0;
  const setup=phase==='setup',stamp=[trilogy?.key,tier,chapter,setup,mark].join('|');
  if(chips.dataset.stamp===stamp)return;chips.dataset.stamp=stamp;
  const stages=trilogy?.stages||armyChapters,clears=stages.filter((_,i)=>progress(wallet,i)).length,info=el('series-info');
  el('mode-title').textContent=trilogy?'Army Trilogies':'Army Skirmish';
  el('tier').textContent=trilogy?armySeries.length+' trios · '+clears+'/3 cleared':difficulties[tier]+' · '+clears+'/3 cleared';
  el('series-controls').hidden=!trilogy;
  el('series-search').disabled=el('series-select').disabled=!setup;
  for(const key of ['series','skirmish','starters'])root.querySelector('[data-army-act="'+key+'"]').disabled=!setup;
  root.querySelector('[data-army-act="series"]').setAttribute('aria-pressed',String(!!trilogy));
  root.querySelector('[data-army-act="skirmish"]').setAttribute('aria-pressed',String(!trilogy));
  const bonus=trilogy&&seriesFinaleReward(trilogy);
  info.hidden=!trilogy;
  info.innerHTML=trilogy?'<div><b>'+enc(trilogy.name)+'</b><small>'+(trilogy.group==='series'?'GD level series':'GD community trio')+'</small></div><div class="army-series-prize">'+
   (clears===3?'<b>'+ico('check')+' Trilogy cleared</b>':'<small>First trilogy clear</small>'+money('coins',bonus.coins)+money('gems',bonus.gems))+'</div>':'';
  chips.innerHTML=stages.map((stage,i)=>{
   const clear=progress(wallet,i),locked=!unlocked(wallet,i);
   const art=trilogy?portrait(stage.row[0]):'';
   const note=trilogy?(stage.note||stage.row[6])+' · '+stage.count+' rivals':stage.count+' rivals';
   return '<button type="button" data-army-chapter="'+i+'" aria-pressed="'+(i===chapter)+'" '+(locked||!setup?'disabled':'')+
    ' title="'+enc(locked?'Clear '+stages[i-1].name+' to unlock':stage.tactic?.description||stage.name)+'"><span class="army-chapter-icon">'+
    (clear?ico('check'):locked?ico('lock'):String(i+1))+'</span>'+art+'<span><b>'+enc(stage.name)+'</b><small>'+enc(note)+(clear?' · cleared':'')+'</small></span></button>';
  }).join('');
  el('chapter-name').textContent=trilogy?trilogy.name+' · '+(chapter+1)+'/3':'Skirmish · '+currentChapter().name;
 }
 function lootPreview(){
  const box=el('spoils');
  const first=!progress(getWallet(),chapter),prize=first&&chapter===2&&trilogy?seriesFinaleReward(trilogy):{coins:0,gems:0};
  box.innerHTML=phase==='setup'&&battle?'<small>On clear</small>'+money('coins',armyLoot(battle).total+prize.coins)+
   (first?'<span class="army-first-clear" title="First clear bonus">'+money('gems',chapterGems(tier,chapter)+prize.gems)+'</span>':''):'';
  box.hidden=!box.innerHTML;
 }
 function mapControls(){
  const map=armyMaps[arena],field=el('field');
  const key=trilogy?(seriesBackdrop||trilogy.backdrop):(Object.hasOwn(armyBackdrops,backdrops[arena])?backdrops[arena]:map.backdrop);
  field.style.setProperty('--sky','url('+backdropSource(key)+')');field.dataset.map=arena;
  root.querySelector('#armyBackdrop').value=key;
  el('mapname').textContent=trilogy?currentChapter().name:map.name;el('mapname').title=trilogy?currentChapter().tactic.description:map.description;
  root.querySelector('.army-tier-setting').hidden=Boolean(trilogy);
  root.querySelector('#armyDifficulty').value=tier;
  root.querySelectorAll('[data-army-map]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.armyMap===arena)));
 }
 function buildBattle(){
  const players=deployment.map(c=>({...c,training:training(c)}));
  battle=sample.length?configureTrilogy(makeArmyBattle(players,sample,arena,tier,Math.random,{preview:true}),chapter,trilogy?.key):null;
  if(battle)world?.prepare(battle.teams);
  casts=[];bursts=[];clock=0;renderAt=-1;recentMove='';lastStats=-1;nextMove=0;cueTime.clear();
  clearCallouts();hovered=pinned=null;showInspector(null);
 }
 function refreshSetup(){
  if(phase!=='setup')return;
  buildBattle();slots();roster();mapControls();chapterControls();lootPreview();patchControl();updateHud(true);
 }
 async function refreshCollection(){
  if(!open)return;
  const id=++readId;
  try{
   const records=await readCollection(),easy=records.length?null:await pool('Easy');
   if(id!==readId||!open)return;
   const old=inventory;
   const stats=new Map(records.map(card=>[card.id,armyStats(card.row,training(card))]));
   inventory=records.length?records.sort((a,b)=>{
    const x=stats.get(a.id),y=stats.get(b.id);
    return y.tier-x.tier||y.attack-x.attack||a.row[1].localeCompare(b.row[1]);
   }):armyTrialIds.map(id=>easy.find(r=>r[0]===id)).filter(Boolean).map(row=>({row,trial:true,copies:1}));
   const seen=new Map(),byId=new Map(inventory.map(c=>[Number(c.row[0]),c]));
   deployment=deployment.flatMap(c=>{
    const id=Number(c.row[0]),next=byId.get(id),count=(seen.get(id)||0)+1;
    if(!next||count>next.copies||!active(id))return [];
    seen.set(id,count);return [next];
   });
   if(!old.length||old.every(c=>c.trial)&&!inventory.some(c=>c.trial)&&!deployment.length)deployment=mixedSquad(inventory.filter(c=>active(c.row[0])),4);
   loaded=true;collectionError=false;refreshSetup();
  }catch{
   if(id!==readId||!open)return;
   collectionError=true;loaded=false;refreshSetup();if(phase==='setup')message('Your roster could not load. Try again.');
  }
 }
 async function chooseRivals(){
  if(trilogy)tier=currentChapter().tier;
  const id=++poolId;
  ready=false;poolError=false;sample=[];refreshSetup();
  try{
   const rows=await pool(difficulties[tier]);
   if(id!==poolId||!open)return;
   if(!rows.length)throw Error('No rival cards');
   sample=armyRivals(rows,tier,chapter,trilogy,id=>coverSource(id).startsWith('/assets/'));
   ready=true;refreshSetup();if(!collectionError&&world)message('');
  }catch{
   if(id!==poolId||!open)return;
   poolError=true;refreshSetup();message('Rival cards could not load. Try again.');
  }
 }
 function tally(units,side){
  const alive=units.filter(u=>u.hp>0).length,stat=units.reduce((n,u)=>n+u.hp,0)/Math.max(1,units.reduce((n,u)=>n+u.maxHp,0));
  return '<div class="army-team" data-side="'+side+'"><span>'+(side?'Rivals':'Your army')+'<b>'+alive+' / '+units.length+'</b></span><i style="--hp:'+stat+'"></i></div>';
 }
 function updateHud(force=false){
  const time=battle?.time||0,beats=Math.floor(time*5);
  if(!force&&beats===lastStats)return;
  lastStats=beats;
  const left=battle?.teams[0]||[],right=battle?.teams[1]||[];
  el('time').textContent=timeText(time/armySpeed);
  el('score').innerHTML=tally(left,0)+tally(right,1);
  const feed=recentMove||(phase==='setup'?(ready&&loaded?(currentChapter().tactic?.name||currentChapter().count+' rivals')+' · Battle speed 0.8×':'Preparing the arena…'):'Armies advancing');
  const feedEl=el('feed');if(feedEl.textContent!==feed)feedEl.textContent=feed;
  if(phase!=='setup'){
   const lists=[left,right].map((units,side)=>
    '<section data-side="'+side+'"><h3>'+(side?'Rivals':'Your army')+'</h3>'+units.map(u=>{
     const label=u.hp?Math.ceil(u.hp)+' HP'+(u.shield?' · '+Math.ceil(u.shield)+' shield':''):'KO';
     return '<div class="army-report-row '+(u.hp?'':'is-ko')+'"><b title="'+u.style+' · Level '+u.level+'">'+enc(u.name)+
      (u.captain?' '+ico('crown'):'')+'</b><small>'+label+'</small>'+
      '<span class="army-report-hp" style="--hp:'+u.hp/u.maxHp+'"></span></div>';
    }).join('')+'</section>').join('');
   el('standing').innerHTML=lists;
  }
 }
 function setPhase(next){
  phase=next;root.dataset.phase=next;
  el('config').hidden=next!=='setup';el('stats').hidden=next==='setup';el('count').hidden=next!=='countdown'&&next!=='paused';
  el('field').dataset.phase=next;el('result').hidden=next!=='done';
  chapterControls();lootPreview();patchControl();updateHud(true);
 }
 let startingBattle=false;
 async function start(){
  if(startingBattle||!world||!battle||!ready||!loaded||!deployment.length||!unlocked(getWallet(),chapter))return;
  const valid=deployment.filter(c=>active(c.row[0]));
  if(valid.length!==deployment.length){deployment=valid;refreshSetup();message('An injured card was removed from deployment.');return}
  startingBattle=true;
  const selected={map:arena,chapter,tier,seriesKey:trilogy?.key,ids:deployment.map(c=>c.row[0])};
  let run;
  try {run=await startArmyBattle(selected);}
  catch(error){if(open)message(error.message);return;}
  finally{startingBattle=false;}
  if(!open||phase!=='setup'||arena!==selected.map||chapter!==selected.chapter||tier!==selected.tier||trilogy?.key!==selected.seriesKey||
    deployment.map(c=>c.row[0]).join(',')!==selected.ids.join(','))return;
  buildBattle();battle=beginArmyRun(run);world.prepare(battle.teams);
  payoutState='';receipt=null;accumulator=0;countdown=2.65;message('');
  const count=el('count');count.textContent='3';setPhase('countdown');
  sound.play('telegraph',{level:.7});
  el('field').scrollIntoView({block:'nearest',behavior:reduced.matches?'instant':'smooth'});
 }
 function drawReceipt(){
  const box=el('result').querySelector('.army-result-loot');
  if(!box)return;
  if(payoutState==='saving'){box.textContent='Saving rewards…';return}
  if(payoutState==='error'){box.textContent='Rewards could not save. Try again below.';return}
  box.innerHTML=receipt?.coins||receipt?.gems?
   (receipt.seriesComplete?'<b class="army-trilogy-clear">Trilogy cleared!</b>':'')+(receipt.coins?money('coins',receipt.coins):'')+(receipt.gems?money('gems',receipt.gems):''):
   '<span>No rewards earned</span>';
 }
 async function credit(match){
  payoutState='saving';drawReceipt();patchControl();
  try{
   const {wallet,receipt:earned}=await settleArmyBattle(match);
   const animate=open&&match===battle&&phase==='done';
   const tickets=animate?Object.keys(currencies).flatMap(kind=>earned[kind]>0?[[kind,rewards.reserve(kind,earned[kind])]]:[]):[];
   applyWallet(wallet);
   if(match!==battle)return;
   payoutState='paid';receipt=earned;drawReceipt();patchControl();
   if(animate){
    for(const [kind,ticket] of tickets)rewards.launch(ticket,el('result').querySelector('[data-currency="'+kind+'"]'),{front:true});
    if(earned.gems)sound.play('extraAccent',{level:.65});
   }
  }catch(error){
   if(match===battle){payoutState='error';drawReceipt();patchControl()}
  }
 }
 function summary(status){
  const defeated=armyLoot(battle).defeated;
  el('result').dataset.result=status;
  el('result').innerHTML='<strong>'+resultText[status]+'</strong><small>'+defeated+' / '+currentChapter().count+
   ' rivals defeated · '+timeText(battle.time/armySpeed)+'</small><div class="army-result-loot"></div>';
  payoutState='saving';setPhase('done');
  sound.play(status==='won'?'victory':status==='lost'?'loss':'guard',{level:.85});
  credit(battle);
 }
 function play(cue,unit,level,duration=.10){
  const time=battle.time;
  if(time-(cueTime.get(cue)??-1)<duration)return;
  cueTime.set(cue,time);
  sound.play(cue,{level,pan:unit?Math.max(-.6,Math.min(.6,unit.x/740)):0,seed:unit?.kit.seed});
 }
 function collect(events){
  for(const event of events){
   const {kind,unit,target,cast}=event,at=battle.time;
   if(kind==='cast'){
    casts.push(cast);
    if(cast.event.melee)play('armyRush',cast.unit,cast.event.signature?.61:.41,.17);
    if(cast.event.signature){
     play(cast.timing.windup||'battleWind',cast.unit,.53,.24);
     if(at>=nextMove){
      recentMove=cast.unit.name+' · '+cast.event.name.replace(cast.unit.name+' · ','');
      nextMove=at+.75;
     }
    }
   }else if(kind==='hit'){
    const close=event.impact==='strike'||event.impact==='slam';
    if(event.shield>0)play('armyBlock',target,.56,.12);
    if(close||event.impact==='shot'){
     play(close?(event.impact==='slam'?'armySlam':'armyStrike'):event.cue,unit,
      event.impact==='slam'?.83:close?.61:.37,.15);
     if(event.impact==='slam'&&event.cue)play(event.cue,unit,.46,.22);
     bursts.push({unit:target,x:event.x,y:event.y,kind:close?'contact':'hit',art:event.art,force:event.force,at,life:close?.42:.31});
     addCallout(event);
     if(close&&at>=nextMove){
      recentMove=unit.name+(event.impact==='slam'?' · Heavy impact':' · Melee strike');
      nextMove=at+.72;
     }
    }
   }else if(kind==='miss'){
    play('armyEvade',target,.44,.19);
   }else if(kind==='tactic'){
    addCallout({...event,target:unit});play(event.cue,unit,.47,.19);
   }else if(kind==='result')summary(event.status);
   else {
    const actor=target||unit;
    if(kind==='ko')addCallout(event);
    bursts.push({unit:actor,kind,at,life:kind==='ko'?.78:.46});
    const cue={ko:'knockout',shield:'guard',heal:'heal',execute:'stealCut'}[kind];
    if(cue)play(cue,actor,kind==='execute'?.72:.42,.18);
    if(kind==='execute'){
     casts.push({unit,target,started:at-.17,length:.62,timing:{at:.26},
      event:{art:'scythe',school:'rupture',signature:true,seed:unit.kit.seed,cinematic:'execute'}});
     recentMove=unit.name+' · '+event.name;nextMove=at+.9;
    }
   }
  }
 }
 function showInspector(unit){
  const box=el('inspect'),field=el('field'),point=unit&&world?.locate(unit);
  if(!point||point.x<0||point.x>field.clientWidth||point.y<-25||point.y>field.clientHeight){
   box.hidden=true;return;
  }
  const stamp=[unit.side,unit.index,unit.name,unit.hp,unit.attack,unit.shield].join('|');
  if(box.dataset.stamp!==stamp){
   box.dataset.stamp=stamp;
   box.dataset.side=unit.side;
   box.innerHTML='<strong>'+enc(unit.name)+'</strong><small>'+unit.style+' · Lv. '+unit.level+
    (unit.rank?' · #'+unit.rank.toLocaleString('en-US'):'')+(unit.captain?' · Captain':'')+
    '</small><span>'+stat(unit.hp)+' / '+stat(unit.maxHp)+' HP <b>'+stat(unit.attack)+' ATK</b></span>'+
    '<small>'+enc(unit.kit.signatureName)+'</small>';
  }
  box.hidden=false;
  const width=Math.min(204,field.clientWidth-24),above=point.y>=175;
  box.style.left=clamp(point.x,width/2+8,field.clientWidth-width/2-8)+'px';
  box.style.top=(above?point.y-8:point.y+12)+'px';
  box.dataset.flip=above?'up':'down';
 }
 function pickAt(x,y,slop){
  const bounds=el('field').getBoundingClientRect();
  return world?.cardAt(x-bounds.left,y-bounds.top,slop)||null;
 }
 function peekAtCursor(){
  const unit=cursor?pickAt(cursor.x,cursor.y,2):null;
  hovered=unit;
  el('field').classList.toggle('has-card-hover',Boolean(unit));
 }
 function zoomTo(level,subject=null){
  view.zoom=clamp(level,.82,2.6);
  if(view.zoom<=1){
   view.x=view.y=0;
  }else if(subject?.hp){
   const share=1-1/view.zoom;
   view.x=subject.x*share;view.y=subject.y*share;
  }
  el('zoom').textContent=Math.round(view.zoom*100)+'%';
  root.querySelector('[data-army-act="zoom-out"]').disabled=view.zoom<=.82;
  root.querySelector('[data-army-act="zoom-in"]').disabled=view.zoom>=2.6;
  renderAt=-1;
 }
 function addCallout(event){
  if(reduced.matches)return;
  const text=event.kind==='tactic'?event.name:event.kind==='ko'?'KO':event.amount>0?'−'+stat(event.amount):'BLOCK';
  const node=document.createElement('span'),unit=event.target;
  node.className='army-hit-number'+(event.kind==='ko'?' is-ko':event.kind==='tactic'?' is-tactic':event.impact==='slam'?' heavy':'');
  node.dataset.side=unit.side;node.textContent=text;
  el('floaters').append(node);
  callouts.push({node,x:event.x??unit.x,y:event.y??unit.y,start:battle.time,life:event.kind==='ko'?.86:.64});
  if(callouts.length>20)callouts.shift().node.remove();
 }
 function clearCallouts(){
  for(const item of callouts)item.node.remove();
  callouts=[];
 }
 function drawCallouts(){
  callouts=callouts.filter(item=>{
   const q=(clock-item.start)/item.life;
   if(q>=1){item.node.remove();return false}
   const point=world.project([item.x,item.y,95+Math.max(0,q)*47]);
   if(point){
    item.node.style.transform='translate('+point.x+'px,'+point.y+'px) translate(-50%,-50%)';
    item.node.style.opacity=1-Math.max(0,q-.48)/.52;
   }
   return true;
  });
 }
 function tick(now){
  if(!open)return;
  frame=requestAnimationFrame(tick);
  const dt=previous?Math.min(.24,(now-previous)/1000):0;previous=now;
  if(document.hidden)return;
  if(phase!=='paused')clock+=dt;
  if(phase==='countdown'){
   countdown-=dt;
   const number=Math.ceil(countdown),count=el('count');
   if(countdown<=0){
    setPhase('live');sound.play('charged',{level:.82});
    recentMove='Fight!';
   }else if(count.textContent!==String(number)){
    count.textContent=number;sound.play('telegraph',{level:.58,rate:1.08+(.2*(3-number))});
   }
  }
  if(phase==='live'){
   accumulator+=dt*armySpeed;
   while(accumulator>=fixed&&phase==='live'){
    collect(stepArmy(battle,fixed));accumulator-=fixed;
   }
   casts=casts.filter(c=>battle.time-c.started<c.length);bursts=bursts.filter(f=>battle.time-f.at<f.life).slice(-26);
   clock=battle.time;updateHud();
  }
  const refresh=world?.software?phase==='live'?1/24:1/15:phase==='live'?1/60:1/27;
  if(world&&now/1000-renderAt>=refresh){
   renderAt=now/1000;
   world.render({key:arena,map:armyMaps[arena],teams:battle?.teams||[[],[]],time:clock,casts,bursts,angle,view,
    selected:pinned||hovered,reduced:reduced.matches});
   if(!drag&&!pinch)peekAtCursor();
   if(pinned&&!pinned.hp)pinned=null;
   showInspector(pinned||hovered);drawCallouts();
  }
 }
 function edit(){
  payoutState='';receipt=null;setPhase('setup');sound.stop();refreshSetup();
 }
 function bind(){
  const field=el('field');
  root.addEventListener('error',e=>{if(e.target.matches?.('.army-card-art:not([src="/assets/player-cube.png"])'))e.target.setAttribute('src','/assets/player-cube.png')},{capture:true});
  const span=()=>{
   const [a,b]=pointers.values();return Math.hypot(a.x-b.x,a.y-b.y);
  };
  field.addEventListener('wheel',e=>{
   const next=clamp(view.zoom*Math.exp(-e.deltaY*.002),.82,2.6);
   if(next===view.zoom)return;
   e.preventDefault();
   zoomTo(next,pinned||pickAt(e.clientX,e.clientY,2));
  },{passive:false});
  field.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   field.setPointerCapture(e.pointerId);
   if(pointers.size===2){pinch={distance:span(),zoom:view.zoom};drag=null;return}
   if(pointers.size>2)return;
   drag={id:e.pointerId,x:e.clientX,y:e.clientY,angle,viewX:view.x,viewY:view.y,moved:false};
  });
  field.addEventListener('pointermove',e=>{
   if(e.pointerType!=='touch')cursor={x:e.clientX,y:e.clientY};
   if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pinch&&pointers.size>=2){
    zoomTo(pinch.zoom*span()/Math.max(12,pinch.distance),pinned);return;
   }
   if(e.pointerId!==drag?.id){peekAtCursor();return}
   const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
   if(!drag.moved&&Math.hypot(dx,dy)<6)return;
   drag.moved=true;
   if(view.zoom>1.18){
    const speed=1240/Math.max(1,field.clientWidth*view.zoom);
    view.x=clamp(drag.viewX-dx*speed,-500,500);
    view.y=clamp(drag.viewY-dy*speed*1.3,-200,200);
   }else angle=clamp(drag.angle+dx*.002,-.37,.37);
   renderAt=-1;
  });
  function lift(e){
   const wasPinch=pinch;
   pointers.delete(e.pointerId);
   if(pointers.size<2)pinch=null;
   if(drag?.id!==e.pointerId)return;
   if(e.type==='pointerup'&&!wasPinch&&!drag.moved){
    const unit=pickAt(e.clientX,e.clientY,e.pointerType==='touch'?9:1);
    pinned=unit===pinned?null:unit;renderAt=-1;showInspector(pinned||hovered);
   }
   drag=null;
  }
  for(const event of ['pointerup','pointercancel','lostpointercapture'])field.addEventListener(event,lift);
  field.addEventListener('pointerleave',()=>{cursor=null;hovered=null;showInspector(pinned)});
  root.addEventListener('click',e=>{
   const button=e.target.closest('button');if(!button||!open)return;
   sound.unlock();
   if(button.dataset.armyChapter!==undefined&&phase==='setup'){
    const next=Number(button.dataset.armyChapter);
    if(unlocked(getWallet(),next)){chapter=next;sound.play('select');chooseRivals()}
    return;
   }
   if(button.dataset.armyMap&&phase==='setup'){
    arena=button.dataset.armyMap;sound.play('select');refreshSetup();return;
   }
   if(button.dataset.armyAdd&&phase==='setup'){
    const card=inventory.find(c=>Number(c.row[0])===Number(button.dataset.armyAdd));
    if(card&&active(card.row[0])&&deployment.length<armyLimit&&limit(card)>0){
     deployment.push(card);sound.play('stack',{level:.73});refreshSetup();
     const next=[...el('roster').querySelectorAll('button:enabled')].find(b=>b.dataset.armyAdd===button.dataset.armyAdd);
     (next||el('roster').querySelector('button:enabled')||root.querySelector('[data-army-act="start"]'))?.focus({preventScroll:true});
    }
    return;
   }
   if(button.dataset.armyRemove!==undefined&&phase==='setup'){
    const index=Number(button.dataset.armyRemove);deployment.splice(index,1);sound.play('select');refreshSetup();
    (el('slots').querySelector('[data-army-remove="'+Math.min(index,deployment.length-1)+'"]')||el('search')).focus({preventScroll:true});
    return;
   }
   switch(button.dataset.armyAct){
    case 'series':if(!trilogy&&phase==='setup')chooseSeries(lastTrilogy);break;
    case 'skirmish':if(trilogy&&phase==='setup')chooseSeries(null);break;
    case 'starters':
     starterOnly=!starterOnly;
     button.setAttribute('aria-pressed',String(starterOnly));listSeries();break;
    case 'sound':sound.toggle();speaker();break;
    case 'left':angle=clamp(angle-.13,-.37,.37);renderAt=-1;break;
    case 'right':angle=clamp(angle+.13,-.37,.37);renderAt=-1;break;
    case 'reset':angle=0;zoomTo(1);break;
    case 'zoom-in':zoomTo(view.zoom*1.23,hovered||pinned);break;
    case 'zoom-out':zoomTo(view.zoom/1.23);break;
    case 'start':start();break;
    case 'deployment':
     el('config').scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});
     (trilogy?el('search'):root.querySelector('#armyDifficulty')).focus({preventScroll:true});break;
    case 'rematch':edit();start();break;
    case 'next':
     if(unlocked(getWallet(),chapter+1)){chapter++;sample=[];setPhase('setup');chooseRivals()}
     break;
    case 'retry-loot':if(payoutState==='error')credit(battle);break;
    case 'retreat':if(phase==='paused'){battle.status='retreated';summary('retreated')}break;
    case 'edit':edit();break;
    case 'clear':deployment=[];sound.play('select');refreshSetup();el('search').focus();break;
    case 'pause':sound.stop();el('count').textContent='Paused';setPhase('paused');break;
    case 'resume':setPhase('live');break;
    case 'retry':message('');refreshCollection();chooseRivals();break;
   }
  });
  root.addEventListener('input',e=>{if(e.target===el('search')){query=e.target.value;roster()}
   else if(e.target===el('series-search')){seriesQuery=e.target.value;listSeries()}});
  root.addEventListener('change',e=>{if(e.target===el('series-select')&&phase==='setup'){
   const next=findArmySeries(e.target.value);
   if(next&&next!==trilogy)chooseSeries(next);
  }else if(e.target.id==='armyDifficulty'&&!trilogy){
   tier=skirmishTier=Number(e.target.value);
   chapter=chapterUnlocked(getWallet(),tier,2)?2:chapterUnlocked(getWallet(),tier,1)?1:0;
   sound.play('select');chooseRivals();
  }else if(e.target.id==='armyBackdrop'&&Object.hasOwn(armyBackdrops,e.target.value)){
   if(trilogy)seriesBackdrop=e.target.value;
   else{
    backdrops[arena]=e.target.value;
    try{localStorage.setItem('gdlb.armyBackdrops',JSON.stringify(backdrops))}catch{}
   }
   sound.play('select');mapControls();
  }});
  document.addEventListener('visibilitychange',()=>{previous=0});
 }
 let built=false;
 function show(on){
  if(open===on)return;
  open=on;root.hidden=!on;
  if(!on){
   cancelAnimationFrame(frame);clearCallouts();hovered=pinned=cursor=null;pointers.clear();pinch=drag=null;world?.dispose();world=null;readId++;poolId++;sound.stop();return;
  }
  if(!built){root.innerHTML=markup();bind();listSeries();built=true}
  el('mode-links').innerHTML=battleNavigation('army',playerProgress(getWallet()?.playerXp).level);
  sound.preload();speaker();world=createArmyWorld(el('field'),coverSource);
  if(world){
   previous=0;renderAt=-1;frame=requestAnimationFrame(tick);
  }else message('The 3D renderer could not start in this browser.');
  if(phase==='countdown'){phase='setup';battle=null}
  else if(phase==='live'){phase='paused';el('count').textContent='Paused'}
  setPhase(phase);zoomTo(view.zoom);
  if(phase==='setup'){slotsStamp='!';chooseRivals()}else if(battle)world?.prepare(battle.teams);
  refreshCollection();
 }
 return {show,refreshCollection,setWallet(){if(open){chapterControls();lootPreview()}}};
}
