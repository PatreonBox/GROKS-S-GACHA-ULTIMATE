import {createRewardFlight,rewardOrigin} from './reward-flight.js';
import {cardStations} from './card-stations.js';
import {stat,extremeTable,extremeOdds,extremeBandOdds,bandNames,stageNames,extremeStage,compareMergeStrength} from './card-economy.js';
import {playerBoard} from './player-board.js';
import {packs,packQuantities,difficulties,cardCategories,oddsFor,mostLikelyDifficulty,mythicExtremeCap,godlyExtremeTickets,inventoryOdds,readWallet,readCollection,buyPack,collectMineIncome,redeemCoinCode,advanceOpening,onOtherTab,upgrades,quoteUpgrade,bonusChance,purchaseUpgrade,orderedPull,pool} from './pack-engine.js';
import {ico,ratingLabel} from './icons.js';
import {playRareReveal,revealTier} from './rare-reveal.js';
import {impossibleCategory,impossibleCover} from './impossible-cards.js';
import {antimatterPercent,holoPercent,bestFinish,finishClass,finishLabels} from './card-finishes.js';
import {findRemix} from './remixes.js';
import {createArmyRoom} from './army-room.js';
import {createBattleRoom} from './battle-room.js';
import {packArt,cardFace,wrapper,bindTurntable} from './pack-model.js';
import {revealSpacing} from './pack-sound.js';

import {skillsFor,trainingLabel} from './card-skills.js';
import {statsFor} from './battle-engine.js';
import {createCubeShop} from './cube-shop.js';
import {cubeCatalog,ownsCube} from './cube-catalog.js';
import {createCoinMine} from './coin-mine.js';
import {createKingdom} from './kingdom.js';
import {machineOwned,mineEarnings,mineMachineLock,mineMachines,mineSkillLock,mineSkills,skillOwned} from './mine-economy.js';
import {markGuide,newAreas,seenGuide} from './guide-progress.js';
import {gameCommand,gameRead} from './game-client.js';

const byId=id=>document.getElementById(id);
const enc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>value.toLocaleString('en-US');
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
const headerAmount=value=>value<10000?number(value):compact.format(value);
const prob=n=>n<.01?'1 in '+stat(Math.round(100/n)):n.toLocaleString('en-US',{maximumFractionDigits:2})+'%';
const oneIn=n=>Number.isFinite(n)&&n>0?'1 in '+number(Math.round(100/n)):null;
const pct=n=>n.toLocaleString('en-US',{maximumFractionDigits:4})+'%';
const rarityLabel=odds=>{
 const roll=odds.rank?(odds.category===impossibleCategory?'Vault #':'Rank #')+number(odds.rank):odds.category;
 return odds.finish==='standard'?roll+(odds.rank?'':' roll'):roll+' + '+finishLabels[odds.finish];
};
const rarityValue=odds=>odds.rank||odds.percent<.1?oneIn(odds.percent):pct(odds.percent);
const gem='<img class="gd-gem" src="/assets/packs/gem.png" alt="">';
const coin='<img class="gd-coin" src="/assets/packs/coin.png" alt="">';
const faceIcon=label=>'<img class="p-face" src="'+cardFace(label)+'" alt="">';
const colors=p=>'--foil:'+p.color+';--ink:'+p.dark;
const setText=(sel,text)=>{const el=byId(sel);if(el)el.textContent=text};
const tabLinks=[['shop','Pack shop','Shop','pack'],['collection','My cards','Cards','grid'],['index','Card index','Index','list'],['merge','Merge station','Merge','grid'],['mine','Coin mine','Mine','mine'],['upgrades','Upgrades','Upgrades','spark'],['cubes','Cube shop','Cubes','box']];
const tabVisit=key=>'gacha-tab-'+key+'-1';
const plural=n=>n===1?'pack':'packs';
const visiblePackLimit=10;
const mineCheckpointMs=20000;

export function createPackRoom({localCover,openLevel,announce,onGuide,sound}){
 const rewards=createRewardFlight(sound,headerAmount);
 const root=byId('arcade'),reveal=byId('packReveal'),code=byId('coinCode');
 let view=null,wallet=null,selected=packs[0],quantity=1,busy=false,version=0,upgrading=false;
 let cards=[],filter='',category='all',collectionPage=0,collectionSort='recent';
 let rarityPack='all',rankedPool=null,rarityLoading=null,rarityFailure=false;
 let run=null,packIndex=0,stage='closed',timers=[],animationId=0,activeRare=null;
 let walletError='',refreshId=0,displayedCoins=-1,savingMine=null;
 let activity=null,activityKey='',activityRequest=0,activityRetryAt=0,acknowledging=0;
 const stopTimers=(keepRare=false)=>{
  animationId++;timers.forEach(clearTimeout);timers=[];
  if(!keepRare){activeRare?.scene.close();activeRare=null;sound.stop()}
 };
 const later=(fn,ms)=>{const epoch=animationId;timers.push(setTimeout(()=>{if(epoch===animationId)fn()},ms))};
 for(const surface of [root,reveal]){
  for(const event of ['pointerdown','keydown','click'])surface.addEventListener(event,sound.unlock,true);
 }
 function speaker(id){
  return '<button '+(id?'id="packSound"':'data-reveal-sound')+' class="iconbtn" aria-label="Pack sounds" aria-pressed="'+sound.enabled+'" title="'+(sound.enabled?'Mute sound effects':'Enable sound effects')+'">'+ico(sound.enabled?'volume':'muted')+'</button>';
 }
 function toggleSound(){
  sound.toggle();
  for(const el of document.querySelectorAll('#packSound,[data-reveal-sound]')){
   el.setAttribute('aria-pressed',String(sound.enabled));el.title=sound.enabled?'Mute sound effects':'Enable sound effects';
   el.innerHTML=ico(sound.enabled?'volume':'muted');
  }
 }
 const directCovers=new Map(),previewLevels=new Map();
 const coverSource=id=>impossibleCover(id)||localCover(id)||directCovers.get(Number(id))||'/api/thumbnail/'+id+'/small';
 const battle=createBattleRoom({root:byId('battleRoom'),sound,rewards,coverSource,enc,applyWallet,announce,onGuide});
 const army=createArmyRoom({root:byId('armyRoom'),sound,coverSource,enc,getWallet:()=>wallet,applyWallet,rewards});
 const stations=cardStations({enc,faceIcon,gem,card,rewards,applyWallet,sound,openLevel,announce});
 const board=playerBoard({enc,faceIcon});
 const cubeRoot=document.createElement('section');
 cubeRoot.id='cubeShop';
 const cubes=createCubeShop({root:cubeRoot,applyWallet,sound,announce});
 const kingdom=createKingdom(byId('kingdomRoom'),sound);
 const coinMine=createCoinMine({sound,rewards,applyWallet,announce,onCode:openCode});
 const markKingdomNav=()=>{
  const badge=byId('kingdomNew'),visited=seenGuide(newAreas.kingdom);
  badge.hidden=visited;
  if(visited)badge.parentElement.removeAttribute('aria-describedby');
  else badge.parentElement.setAttribute('aria-describedby',badge.id);
 };
 markKingdomNav();
 const failure=e=>announce(e?.message||'Could not save this change. Please try again.');
 function applyWallet(w,{pans=[],credited=0}={}){
  const first=!wallet,oldLuck=wallet?.luck;wallet=w;walletError='';refreshId++;
  cubes.setWallet(w);
  kingdom.setWallet(w);
  if(view==='collection'&&collectionSort==='rarity'&&oldLuck!==w.luck&&byId('binderResults'))binder();
  if(first&&['merge','index','vault'].includes(view))stations.show(view,w);battle.setWallet(w);army.setWallet(w);
  coinMine.setWallet(w);
  refreshCoins(true,pans,credited);
  byId('gemLink').title=number(w.gems)+' gems';
  byId('gemLink').setAttribute('aria-label',number(w.gems)+' gems. Open upgrades');
  if(view==='upgrades')renderUpgrades();
  if(view==='results')resultsPage();
  refreshActivity();
 }
 function refreshCoins(force=false,pans=[],credited=0){
  if(!wallet)return;
  const coins=wallet.coins+mineEarnings(wallet).coins;
  if(!force&&coins===displayedCoins)return;
  const previous=displayedCoins<0?(credited?coins-credited:coins):displayedCoins;
  const gain=coins-previous;
  displayedCoins=coins;
  rewards.balance({coins,gems:wallet.gems});
  byId('walletLink').title=number(coins)+' coins';
  byId('walletLink').setAttribute('aria-label',number(coins)+' coins. Open the coin mine');
  coinMine.setCoins(coins,force?0:gain);
  kingdom.setCoins(coins);
  if(gain>0&&gain>previous*.5)sound.coinReward(true);
  else if(pans.length)sound.coinReward(false,pans);
  else if(gain>0&&view==='mine'&&(!force||credited))sound.coinReward(false);
  if(view==='shop')updatePurchase();
  updateSectionAlerts();
 }
 async function sync(){
  const epoch=++refreshId;
  try{const w=await readWallet();if(epoch===refreshId)applyWallet(w)}
  catch{walletError='Your game save could not load. Reopen the page to try again.';if(view)announce(walletError)}
 }
 function checkpointMine(returning=false){
  if(savingMine)return savingMine;
  const epoch=++refreshId;
  savingMine=collectMineIncome().then(({wallet:next,receipt})=>{
   const away=returning&&receipt.coins>0&&receipt.elapsed>=mineCheckpointMs&&!document.hidden;
   if(away){
    coinMine.reportAway(receipt);
    announce('While you were away · +'+number(receipt.coins)+' coins');
   }
   if(epoch!==refreshId)return;
   const ticket=away?rewards.reserve('coins',receipt.coins):null;
   applyWallet(next,{credited:away?receipt.coins:0});
   if(ticket)rewards.launch(ticket,rewardOrigin(byId('mineHit')||byId('walletLink')));
  }).catch(()=>{if(!wallet)sync()}).finally(()=>{savingMine=null});
  return savingMine;
 }
 onOtherTab(event=>{
  sync();
  if(event.data==='mine')return;
  if(view==='collection')loadCollection();
  if(['merge','index','vault'].includes(view))readWallet().then(w=>stations.show(view,w));
  if(['battle','training','arcade'].includes(view))battle.refreshCollection();
  if(view==='army')army.refreshCollection();
 });
 document.addEventListener('gdlb-admin-wallet',event=>applyWallet(event.detail));
 window.addEventListener('pageshow',()=>{if(!document.hidden)checkpointMine(true)});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden||wallet?.mine)checkpointMine(!document.hidden)});
 setInterval(()=>{
  if(document.hidden)return;
  refreshCoins();
  refreshActivity();
  if(wallet?.mine?.collectedAt&&Date.now()-wallet.mine.collectedAt>=mineCheckpointMs)checkpointMine();
 },1000);
 if(document.hidden)sync();else checkpointMine(true);
 function sectionAlerts(){
  if(!wallet)return {};
  const canBuyMachine=mineMachines.some(machine=>!machineOwned(wallet.mine,machine.id)&&
   !mineMachineLock(wallet.mine,machine.id)&&displayedCoins>=machine.price);
  const canBuySkill=mineSkills.some(skill=>!skillOwned(wallet.mine,skill.id)&&
   !mineSkillLock(wallet.mine,skill.id)&&displayedCoins>=skill.price);
  return {
   shop:wallet.pending?'Pack ready':'',
   collection:activity?.latest>(wallet.collectionSeenThrough||0)?'New cards':'',
   index:activity?.unclaimed?'Gems to claim':'',
   merge:activity?.mergeReady?'Merge ready':'',
   mine:canBuyMachine||canBuySkill?'Unlock ready':'',
   upgrades:Object.keys(upgrades).some(id=>quoteUpgrade(id,wallet[id]||0,wallet.gems).affordable)?'Upgrade ready':'',
   cubes:cubeCatalog.some(cube=>!ownsCube(wallet,cube.id)&&displayedCoins>=cube.price)?'Cube available':''
  };
 }
 function updateSectionAlerts(){
  const links=root.querySelectorAll('[data-gacha-tab]');
  if(!links.length)return;
  const alerts=sectionAlerts();
  for(const link of links){
   const key=link.dataset.gachaTab,unvisited=!seenGuide(tabVisit(key));
   const notice=unvisited?'New':alerts[key];
   const badge=link.querySelector('.gacha-tab-alert');
   const hidden=!notice||link.hasAttribute('aria-current');
   const nextTitle=hidden?'':notice;
   if(badge.title===nextTitle&&link.hasAttribute('aria-label'))continue;
   badge.hidden=hidden;
   badge.dataset.new=String(unvisited);
   badge.title=badge.hidden?'':notice;
   badge.textContent=badge.hidden?'':unvisited?'New':'Ready';
   const label=link.querySelector('.nav-label').textContent;
   link.setAttribute('aria-label',badge.hidden?label:label+' · '+notice);
  }
 }
 function refreshActivity(){
  if(!wallet||root.hidden||Date.now()<activityRetryAt||!root.querySelector('.arc-nav'))return;
  const battle=wallet.battle;
  const injured=Object.entries(wallet.injuries||{}).filter(([,until])=>until>Date.now()).map(([id])=>id);
  const key=[wallet.cardsRevision||0,battle?.status==='active'?battle.id:'',...injured].join('/');
  if(key===activityKey)return;
  activityKey=key;
  const request=++activityRequest;
  gameRead('gacha-activity').then(next=>{
   if(request!==activityRequest)return;
   activity=next;updateSectionAlerts();
  }).catch(()=>{if(request===activityRequest){activityKey='';activityRetryAt=Date.now()+15000;}});
 }
 function sectionNav(){
  return '<nav class="arc-nav" aria-label="Gacha sections">'+tabLinks.map(([key,name,short,icon])=>'<a data-gacha-tab="'+key+'" '+(view===key||view==='vault'&&key==='index'?'aria-current="page"':'')+' href="#gacha'+(key==='shop'?'':'/'+key)+'">'+ico(icon)+'<span class="nav-label">'+name+'</span><span class="nav-short" aria-hidden="true">'+short+'</span><small class="gacha-tab-alert" aria-hidden="true" hidden></small></a>').join('')+'</nav>';
 }
 function page(next){
  if(view!==next){stopTimers();rewards.clear()}
  stations.leave();board.leave();coinMine.leave();version++;view=next;const classic=['battle','training','arcade'].includes(next),combat=classic||next==='army';
  const home=next==='kingdom';
  root.hidden=!view||combat||home;battle.show(classic,next==='training',next==='arcade');army.show(next==='army');
  cubes.show(false);kingdom.show(home);
  if(home){markGuide(newAreas.kingdom);markKingdomNav()}
  if(reveal.open)reveal.close();
  if(!view||combat||home)return;
  sound.preload();
  const destination=next==='vault'?'index':next;
  if(tabLinks.some(([key])=>key===destination))markGuide(tabVisit(destination));
  root.innerHTML='<div class="arc-heading"><h1>Gacha</h1><div class="arc-nav-tools">'+sectionNav()+speaker(true)+'</div></div><div id="arcBody"></div>';
  if(view==='players'){root.innerHTML='<div id="arcBody"></div>';board.show();return}
  if(['index','merge','vault'].includes(view))stations.show(view,wallet);
  if(view==='results'){root.innerHTML='<div id="arcBody"></div>';resultsPage();window.scrollTo(0,0);bestSound()}
  if(view==='shop')shop();
  if(view==='mine'){coinMine.show(byId('arcBody'),wallet);if(wallet)coinMine.setCoins(displayedCoins)}
  if(view==='cubes'){byId('arcBody').append(cubeRoot);cubes.show(true)}
  if(view==='upgrades')renderUpgrades();
  if(view==='collection'){
   byId('arcBody').innerHTML='<div class="collection-head"><h2>My cards</h2><a class="outline" href="#gacha/merge">Merge duplicates</a><span id="ownedTotal"></span></div><div class="collection-tools"><input id="cardSearch" type="search" placeholder="Search your cards" aria-label="Search your cards" maxlength="80"><select id="cardCategory" aria-label="Card difficulty"><option value="all">All difficulties</option>'+cardCategories.map(d=>'<option>'+d+'</option>').join('')+'</select><select id="cardSort" aria-label="Sort your cards"><option value="recent">Recently pulled</option><option value="difficulty">Difficulty · hardest first</option><option value="rarity">Rarest first</option><option value="copies">Most copies</option></select><select id="rarityPack" aria-label="Pack used for rarity" hidden><option value="all">All packs equally</option>'+packs.map(p=>'<option value="'+p.id+'">'+p.name+' pack</option>').join('')+'</select></div><p id="rarityHint" class="rarity-hint" hidden>Odds use your current luck and rarest owned finish. All packs equally averages the odds across packs.</p><div id="binderResults"></div>';
   byId('cardSearch').value=filter;byId('cardCategory').value=category;byId('cardSort').value=collectionSort;
   byId('rarityPack').value=rarityPack;
   byId('rarityPack').onchange=e=>{rarityPack=e.target.value;collectionPage=0;binder()};
   byId('cardSearch').oninput=e=>{filter=e.target.value;collectionPage=0;binder()};
   byId('cardCategory').onchange=e=>{category=e.target.value;collectionPage=0;binder()};
   byId('cardSort').onchange=e=>{collectionSort=e.target.value;collectionPage=0;rarityFailure=false;binder()};
   loadCollection();
  }
  updateSectionAlerts();refreshActivity();
  sync();
 }
 function shop(){
  const pack=selected;
  const shelf=packs.map(p=>'<button class="pack-choice" data-choose="'+p.id+'" aria-pressed="'+(p===pack)+'" style="'+colors(p)+'"><img src="'+packArt(p)+'" alt=""><span><strong>'+p.name+'</strong><small>'+coin+number(p.price)+'</small></span></button>').join('');
  byId('arcBody').innerHTML='<div class="pack-shelf" role="group" aria-label="Choose a gacha pack">'+shelf+'</div>'+
   '<div class="shop-display" style="'+colors(pack)+'"><div class="foil-stage" id="foilStage"><div class="pack-scene-caption" id="packSceneCaption" hidden></div><div class="package-float" id="previewPile"></div><div class="turn-handle" role="group" tabindex="0"></div><div class="turn-tools"><span>Drag to rotate</span><button data-reset-view aria-label="Reset pack rotation">Reset view</button></div></div>'+
   '<div class="pack-info"><div class="pack-meta">'+ico('pack')+' BOOSTER PACK</div><h2>'+pack.name+' Gacha</h2><p class="pack-range" id="packPeak"></p><div class="quantity-label">Packs per pull</div><div class="qty-options" role="group" aria-label="Packs per pull">'+packQuantities.map(q=>'<button data-qty="'+q+'">'+q+' '+plural(q)+' <small data-pack-size="'+q+'">'+5*q+' cards</small></button>').join('')+'</div><button class="purchase" id="buyPack"></button><div class="buy-hint" id="buyHint" role="status"></div><div class="gem-return">'+holoPercent+'% Holo · '+antimatterPercent+'% Antimatter per card</div>'+(pack.id==='godly'?'<a class="vault-shop-link" href="#gacha/vault">??? Secret vault</a>':'')+'</div></div>'+
   '<section class="odds-panel" style="'+colors(pack)+'"><div class="odds-heading"><h3>Difficulty odds</h3>'+(pack.id==='godly'?'<span>Includes an exclusive ??? slot.</span>':pack.id==='mythic'?'<span>Extreme Demon chance caps at '+mythicExtremeCap+'%.</span>':'')+'<a id="luckStatus" class="luck-link" href="#gacha/upgrades"></a></div><p class="pull-odds-note">Each card rolls a difficulty, then a level and a finish.</p><div class="odds-groups" id="oddsTable"></div><details class="rank-odds"><summary>Extreme Demon rank odds per card</summary><div id="rankOdds"></div></details></section>';
  updatePurchase();bindTurntable(byId('foilStage'));
 }
 function previewArtwork(stage,odds,category){
  if(stage.dataset.sceneTier===category)return;
  stage.dataset.sceneTier=category;
  const key=selected.id+'/'+category;
  if(!previewLevels.has(key)){
   const tiers=odds.filter(o=>o.weight>0&&o.category!==impossibleCategory).sort((a,b)=>b.weight-a.weight);
   const search=async()=>{
    for(const tier of tiers){
     const choices=(await pool(tier.category)).filter(row=>localCover(row[0]));
     if(choices.length)return choices[Math.floor(Math.random()*choices.length)];
    }
    return null;
   };
   previewLevels.set(key,search().catch(()=>{previewLevels.delete(key);return null;}));
  }
  previewLevels.get(key).then(row=>{
   if(!row||!stage.isConnected||stage.dataset.sceneTier!==category)return;
   stage.style.setProperty('--pack-photo','url("'+localCover(row[0])+'")');
   const caption=stage.querySelector('#packSceneCaption');
   caption.textContent=row[1].trim();
   caption.hidden=false;
  });
 }
 function renderOdds(){
  const table=byId('oddsTable'),luck=wallet?.luck||0;
  if(table.dataset.luck===String(luck))return;
  table.dataset.luck=luck;
  const odds=oddsFor(selected,luck),peak=mostLikelyDifficulty(odds);
  table.dataset.peak=peak.category;
  previewArtwork(byId('foilStage'),odds,peak.category);
  const row=o=>'<div class="chance-row">'+faceIcon(o.category)+'<span>'+(o.category===impossibleCategory?'???':o.category)+'</span><i aria-hidden="true"><b style="width:'+o.percent+'%"></b></i><strong>'+pct(o.percent)+'</strong></div>';
  table.innerHTML='<div><h4>Star levels</h4>'+odds.slice(0,6).map(row).join('')+'</div><div><h4>Demons</h4>'+odds.slice(6).map(row).join('')+'<div class="odds-total">Total <b>'+pct(odds.reduce((sum,o)=>sum+o.weight,0)/10000)+'</b></div></div>';
  byId('packPeak').innerHTML='<span>Most likely</span> '+faceIcon(peak.category)+peak.category+' <b>'+pct(peak.percent)+'</b>';
  setText('luckStatus','Luck +'+luck+'%');
  const dest=byId('rankOdds');
  dest.closest('details').hidden=odds[10].weight===0;
  if(!odds[10].weight)return;
  const reference=godlyExtremeTickets(luck);
  pool('Extreme Demon').then(rows=>{
   if(!dest?.isConnected||table.dataset.luck!==String(luck))return;
   const ranks=extremeTable(rows),first=ranks.top[0];
   const firstOdds=first?'1 in '+number(Math.round(100/extremeOdds(1,ranks,odds[10].percent,reference))):'Unranked';
   dest.innerHTML='<p>Per card with your current luck, across all finishes.</p>'+(first?'<div><b>#1 '+enc(first[1])+'</b><strong>'+firstOdds+'</strong></div>':'')+bandNames.map((name,i)=>'<div><b>'+stageNames[i]+' · '+name+'</b><span>'+prob(extremeBandOdds(i,ranks,odds[10].percent,reference))+' across band</span></div>').join('');
  }).catch(()=>{if(dest?.isConnected)dest.textContent='Rank odds temporarily unavailable.'});

 }
 function renderUpgrades(){
  const body=byId('arcBody');if(!body)return;
  if(!wallet){body.innerHTML='<p>Loading upgrades…</p>';return}
  const effects={luck:n=>n,bonus:bonusChance};
  const details={luck:'Each 100% adds a difficulty roll. The hardest result wins.',bonus:'Each pack rolls independently for a sixth card, up to a 90% chance.'};
  const tiles=Object.entries(upgrades).map(([key,item])=>{
   const level=wallet[key]||0,maxed=level>=item.max,effect=effects[key];
   const buttons=[[1,'Upgrade'],[10,'Upgrade ×10'],['max','Upgrade Max']].map(([mode,label])=>{
    const {count,cost,affordable}=quoteUpgrade(key,level,wallet.gems,mode);
    const title=label+' · '+item.name+(count?' · '+count+' '+(count===1?'level':'levels')+' for '+number(cost)+' gems':'');
    return '<button type="button" class="upgrade-buy" data-upgrade="'+key+'" data-upgrade-mode="'+mode+'" aria-label="'+title+'" title="'+title+'" '+(!affordable||upgrading?'disabled':'')+'>'+label+(count?'<span>'+gem+number(cost)+'</span>':'')+'</button>';
   }).join('');
   return '<article class="upgrade-card upgrade-'+key+'"><div class="upgrade-title"><span class="up-icon">'+ico(key==='luck'?'spark':'pack')+'</span><span>Level '+level+' / '+item.max+'</span></div><h3>'+item.name+'</h3><p>'+details[key]+'</p><div class="up-effect"><b>'+pct(effect(level))+'</b><span>'+(maxed?'Max level reached':'Next level <strong>'+pct(effect(level+1))+'</strong>')+'</span></div><div class="upgrade-meter"><i style="width:'+100*level/item.max+'%"></i></div><div class="gem-buy-actions">'+buttons+'</div></article>';
  }).join('');
  body.innerHTML='<section class="upgrade-panel"><div class="upgrade-heading"><div><h2>Gem upgrades</h2><p>Earn gems from the <a href="#gacha/index">card index</a> and <a href="#gacha/merge">merges</a>. Each upgrade starts at 2 gems. The price rises by 0.5 gems per level.</p></div><strong class="gem-balance">'+gem+number(wallet.gems)+' gems</strong></div><div class="upgrade-grid">'+tiles+'</div></section>';
 }
 async function upgrade(key,mode){
  if(!wallet||upgrading)return;
  const expected=wallet[key]||0;upgrading=true;renderUpgrades();
  try{const w=await purchaseUpgrade(key,expected,mode);applyWallet(w);if(view==='upgrades'){sound.play(key==='luck'?'luck':'extra');sound.play(key==='luck'?'luckAccent':'extraAccent',{level:.45})}announce(upgrades[key].name+' reached level '+w[key])}
  catch(e){failure(e);await sync()}
  finally{upgrading=false;if(view==='upgrades')renderUpgrades()}
 }
 function updatePurchase(){
  const buy=byId('buyPack');if(!buy)return;
  renderOdds();
  const bonus=bonusChance(wallet?.bonus||0)>0;
  for(const label of root.querySelectorAll('[data-pack-size]')){
   const q=Number(label.dataset.packSize);
   label.textContent=5*q+(bonus?'–'+6*q:'')+' cards';
  }
  const cost=quantity*selected.price,pending=wallet?.pending;
  const preview=byId('previewPile');
  const peak=byId('oddsTable').dataset.peak,previewKey=quantity+'-'+peak;
  if(preview&&preview.dataset.size!==previewKey){
   preview.dataset.size=previewKey;
   const visible=Math.min(quantity,visiblePackLimit);
   preview.innerHTML=Array.from({length:visible},(_,i)=>'<span class="preview-layer" style="--i:'+i+';z-index:'+(visible-i)+'">'+wrapper(selected,5,peak)+'</span>').reverse().join('');
  }
  root.querySelectorAll('[data-qty]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.qty)===quantity)));
  buy.disabled=busy||!wallet||(!pending&&cost>displayedCoins);
  buy.innerHTML=busy?'Preparing cards…':pending?'Resume opening':('Pull '+quantity+' '+plural(quantity)+'<span>'+coin+number(cost)+'</span>');
  byId('buyHint').innerHTML=walletError?enc(walletError):!wallet?'Loading wallet…':pending?'Your purchased cards are saved.':cost>displayedCoins?'You need '+number(cost-displayedCoins)+' more coins. <a href="#gacha/mine">Visit the mine</a>':'';
 }
 async function purchase(){
  if(busy||!wallet)return;
  if(wallet.pending){begin(wallet.pending);sound.play('stack');return}
  busy=true;updatePurchase();
  try{const w=await buyPack(selected,quantity);applyWallet(w);if(view==='shop'){begin(w.pending);sound.play('buy')}}
  catch(e){failure(e);await sync()}
  finally{busy=false;updatePurchase()}
 }
 function openCode(){
  code.innerHTML='<form id="codeForm"><div class="code-head"><h2 id="codeTitle">Enter code</h2><button class="iconbtn" type="button" data-cancel aria-label="Close">'+ico('x')+'</button></div><label for="codeValue">Code</label><input id="codeValue" required type="text" autocomplete="off" autocapitalize="off" maxlength="32"><p id="codeFeedback" role="status"></p><button class="primary" type="submit">Redeem</button></form>';
  if(!code.open)code.showModal();
  byId('codeValue').focus();
  code.querySelector('[data-cancel]').onclick=()=>code.close();
  byId('codeForm').onsubmit=async e=>{
   e.preventDefault();
   const submit=e.currentTarget.querySelector('[type="submit"]');
   if(submit.disabled)return;
   submit.disabled=true;
   try{
    const {wallet:next,amount}=await redeemCoinCode(byId('codeValue').value);
    const ticket=rewards.reserve('coins',amount);
    const origin=submit.getBoundingClientRect().width?rewardOrigin(submit):rewardOrigin(byId('walletLink'));
    applyWallet(next);code.close();rewards.launch(ticket,origin,{front:true});sound.play('extraAccent',{level:.66});
    announce('Code redeemed · +'+number(amount)+' coins');
   }catch(error){if(submit.isConnected)setText('codeFeedback',error.message)}finally{submit.disabled=false}
  };
 }
 function card(row,{copies=0,index=0,deal=false,bonus=false,fresh=false,finish='standard',holoCopies=0,antimatterCopies=0,drawChance=null}={}){
  const [id,title,author]=row,diff=row[6],tier=cardCategories.indexOf(diff),secret=diff===impossibleCategory;
  const art=coverSource(id),shownFinish=copies?bestFinish({holoCopies,antimatterCopies}):finish;
  const special=findRemix(id),top=tier===10&&row[10]>0&&row[10]<=25;
  const trained=wallet?.training?.[id],combat=copies?statsFor(row,trained):null;
  const caption=copies?'<span class="binder-combat">'+enc(skillsFor(row).signatureName)+'<small>Lvl '+combat.level+' · '+stat(combat.maxHp)+' HP · '+stat(combat.attack)+' ATK</small>'+
   (trained?'<small>+'+stat(combat.hpGain)+' HP · +'+stat(combat.attackGain)+' ATK</small><small>'+trainingLabel(combat.training)+'</small>':'')+'</span>':'';
  const rank=secret?'ILL #'+row[10]:tier===10&&row[10]?extremeStage(row[10]).name+' · #'+number(row[10]):ratingLabel(row[7],row[8]==='Platformer');
  const commonColors=['#8ad5d3','#84d3ff','#a7e575','#f4cf6a','#ff9166','#f982bb','#ae9fff','#fa93ce','#ff8464','#f36e9e','#ffb146','#d6adff'];
  const holo=holoCopies>0||finish==='holo',antimatter=antimatterCopies>0||finish==='antimatter';
  const finishes=(holo||antimatter)?'<span class="finish-labels">'+
   (antimatter?'<span class="antimatter-label">◈ Antimatter'+(antimatterCopies?' ×'+antimatterCopies:'')+'</span>':'')+
   (holo?'<span class="holo-label">✧ Holo'+(holoCopies?' ×'+holoCopies:'')+'</span>':'')+'</span>':'';
  const byline=author?'by '+author:secret?'Impossible Levels List':'by Unknown';
  return '<button class="level-card '+finishClass(shownFinish)+(secret?' impossible-card':'')+(top?' pinnacle-card':'')+(bonus?' bonus-card':'')+(fresh?' new-pull':'')+'" data-card="'+id+'" style="--card-color:'+commonColors[tier]+';--order:'+index+'">'+
   '<span class="card-art"><img class="art-face" src="'+cardFace(diff)+'" alt=""><img class="scene-shot" loading="'+(deal?'eager':'lazy')+'" src="'+enc(art)+'" data-id="'+id+'" alt="">'+
   '<span class="card-stats">'+rank+'</span>'+finishes+(bonus?'<span class="bonus-tag">'+gem+'Bonus</span>':'')+(copies?'<span class="card-copies">×'+copies+'</span>':'')+'</span>'+
   '<span class="card-type">'+faceIcon(diff)+enc(diff)+'</span><strong>'+enc(title)+'</strong><small>'+enc(byline)+'</small>'+caption+
   (drawChance&&drawChance.percent!==null?'<small class="draw-chance">'+(drawChance.percent>0?
    '<span>'+enc(rarityLabel(drawChance))+'</span> <b>'+rarityValue(drawChance)+'</b>':
    drawChance.percent===0?'Unavailable from this pack':'')+'</small>':'')+
   (special?'<span class="remix-stamp">♫ '+enc(special.mark)+'</span>':'')+(fresh?'<span class="new-chip">✦ NEW</span>':'')+'</button>';
 }
 function observeArt(parent){
  for(const img of parent.querySelectorAll('img.scene-shot'))if(img.complete&&img.naturalWidth)img.classList.add('ready');
  parent.addEventListener('load',e=>{if(e.target.classList?.contains('scene-shot'))e.target.classList.add('ready')},true);
  parent.addEventListener('error',e=>{
   const el=e.target;if(!el.classList?.contains('scene-shot'))return;
   if(el.getAttribute('src').startsWith('/api/')){
    const direct='https://levelthumbs.prevter.me/thumbnail/'+el.dataset.id+'/small';
    directCovers.set(Number(el.dataset.id),direct);el.src=direct;
   }
   else el.hidden=true;
  },true);
 }
 observeArt(root);observeArt(reveal);observeArt(byId('battleRoom'));
 async function loadCollection(){
  const stamp=++version;
  try{
   const data=await readCollection();
   if(stamp!==version||view!=='collection')return;
   cards=data;binder();
   const through=cards.reduce((latest,card)=>Math.max(latest,card.last||0),0);
   if(through>Math.max(acknowledging,wallet?.collectionSeenThrough||0)){
    acknowledging=through;
    gameCommand('collection.seen',{through},null).then(({wallet:next})=>{
     if(wallet)wallet.collectionSeenThrough=Math.max(wallet.collectionSeenThrough||0,next.collectionSeenThrough);
     updateSectionAlerts();
    }).catch(()=>{}).finally(()=>{if(acknowledging===through)acknowledging=0;});
   }
  }catch(e){failure(e)}
 }
 function binder(){
  if(view!=='collection')return;
  const q=filter.trim().toLowerCase(),sorted=cards.filter(c=>(category==='all'||c.row[6]===category)&&(!q||String(c.id)===q||c.row[1].toLowerCase().includes(q)||(c.row[2]||'').toLowerCase().includes(q)));
  const rarity=collectionSort==='rarity';
  byId('rarityPack').hidden=!rarity;byId('rarityHint').hidden=!rarity;
  const chances=new Map();
  if(rarity&&sorted.length){
   if(!rankedPool){
    const result=byId('binderResults');
    if(rarityFailure){
     result.innerHTML='<p>Card odds could not load. <button class="outline" id="retryOdds">Try again</button></p>';
     byId('retryOdds').onclick=()=>{rarityFailure=false;binder()};return;
    }
    result.textContent='Loading card odds…';
    if(!rarityLoading)rarityLoading=pool('Extreme Demon')
     .then(rows=>{rankedPool=rows}).catch(()=>{rarityFailure=true})
     .finally(()=>{rarityLoading=null;if(view==='collection')binder()});
    return;
   }
   const chance=inventoryOdds(rankedPool,rarityPack,wallet?.luck||0);
   for(const c of sorted)chances.set(c.id,chance(c));
  }
  sorted.sort((a,b)=>(rarity?(chances.get(a.id).percent||Infinity)-(chances.get(b.id).percent||Infinity):collectionSort==='copies'?b.copies-a.copies:collectionSort==='difficulty'?compareMergeStrength(a.row,b.row,cardCategories):0)||b.last-a.last||a.id-b.id);
  const max=Math.max(0,Math.ceil(sorted.length/24)-1);collectionPage=Math.min(collectionPage,max);
  setText('ownedTotal',number(cards.length)+' unique · '+number(cards.reduce((n,c)=>n+c.copies,0))+' cards');
  byId('binderResults').innerHTML=sorted.length?'<div class="card-gallery">'+sorted.slice(collectionPage*24,collectionPage*24+24).map(c=>card(c.row,{copies:c.copies,holoCopies:c.holoCopies||0,antimatterCopies:c.antimatterCopies||0,drawChance:rarity?chances.get(c.id):null})).join('')+'</div>'+(max?'<div class="paging"><button data-binder="-1" '+(collectionPage===0?'disabled':'')+'>Previous</button> Page '+(collectionPage+1)+' of '+(max+1)+' <button data-binder="1" '+(collectionPage===max?'disabled':'')+'>Next</button></div>':''):'<div class="empty"><strong>'+(cards.length?'No matching cards':'Your collection is empty')+'</strong><p>'+(cards.length?'Try another name or difficulty.':'Open a pack to collect your first five level cards.')+'</p>'+(!cards.length?'<a class="primary" href="#gacha">Browse packs</a>':'')+'</div>';
 }
 function begin(pending){
  if(!pending)return;
  run=pending;preparePullOdds(pending);packIndex=pending.opened;stage='sealed';stopTimers();
  if(!reveal.open)reveal.showModal();drawReveal();
 }
 function preparePullOdds(pull){
  if(pull.drawPercents||(pull.oddsVersion??1)<2||rankedPool||!pull.rows.some(row=>row[6]==='Extreme Demon'))return Promise.resolve();
  return pool('Extreme Demon').then(rows=>{rankedPool=rows}).catch(()=>{});
 }
 function pullCards(pull,packIndex=null){return orderedPull(pull,packIndex,rankedPool)}
 function landPull(item,index,pan){
  sound.land(item.tier,index,pan,item.bonus,item.row[10],item.difficultyPercent,item.row[0],item.finish);
 }
 function bestSound(){
  const last=wallet?.lastPull;if(!last)return;
  const best=pullCards(last)[0];
  if(best.finish!=='standard'||best.tier>=9||best.difficultyPercent<=1||findRemix(best.row[0]))landPull(best,0,0);
  else sound.play('results');
 }
 function rarestHighlight(pull){
  return pullCards(pull).reduce((best,item)=>{
   return revealTier(item.percent)&&(!best||item.percent<best.percent)?item:best;
  },null);
 }
 function openRare(item,{hold=false,skipAll}={}){
  const tier=revealTier(item.percent);
  if(!tier)return null;
  activeRare?.scene.close();sound.stop();
  const scene=playRareReveal({
   tier,cardHTML:card(item.row,{deal:true,finish:item.finish}),
   title:item.row[1],odds:oneIn(item.percent),oddsLabel:rarityLabel(item),sound,toggleSound,observeArt,hold,skipAll
  });
  activeRare={scene,drawIndex:item.drawIndex};
  scene.done.then(()=>{if(activeRare?.scene===scene)activeRare=null});
  return scene;
 }
 function resultsPage(){
  const body=byId('arcBody');if(!body)return;
  const last=wallet?.lastPull;
  if(!last){body.innerHTML='<div class="bt-panel"><h2>Pull results</h2><p>'+(wallet?'Open a pack to see its cards here.':'Loading your pull…')+'</p><a class="outline" href="#gacha">Pack shop</a></div>';return}
  if(body.dataset.pull===last.id)return;body.dataset.pull=last.id;
  body.textContent='Loading pull results…';
  preparePullOdds(last).then(()=>{
   if(body.isConnected&&wallet?.lastPull?.id===last.id)renderResults(body,last);
  });
 }
 function renderResults(body,last){
  const entries=pullCards(last),best=entries[0],counts=new Map();
  for(const item of entries)counts.set(item.row[6],(counts.get(item.row[6])||0)+1);
  const p=packs.find(v=>v.id===last.packId),bonuses=entries.filter(x=>x.bonus).length;
  const bestRank=best.tier===10&&best.row[10]?'#'+number(best.row[10])+' ':best.tier>10?'ILL #'+best.row[10]+' ':'';
  const rare=entries.map((item,i)=>({item,i})).filter(x=>revealTier(x.item.percent));
  const replay=rare.length?'<div class="rare-replay">'+(rare.length>1?'<select id="rareReplayPick" aria-label="Choose a rare pull to replay">'+
   rare.map(({item,i})=>'<option value="'+i+'">'+enc(item.row[1]+' · '+rarityLabel(item)+' · '+rarityValue(item))+'</option>').join('')+'</select>':'')+
   '<button class="outline" data-rare-replay>'+ico('spark')+' Replay rare reveal</button></div>':
   '<button class="sound-replay" data-encore>'+ico('volume')+' Replay best pull sound</button>';
  body.innerHTML='<section class="result-sheet" style="'+colors(p)+'"><div class="result-hero"><div class="result-emblem"><img src="'+packArt(p)+'" alt=""></div><div><div class="pack-meta">'+p.name.toUpperCase()+' GACHA</div><h1>Opened '+last.quantity+' '+plural(last.quantity)+'</h1><p>Rarest pull <b>'+bestRank+enc(best.row[1])+'</b> · '+enc(best.row[6])+'</p>'+replay+'</div><div class="result-metrics"><b>'+last.rows.length+'</b><span>cards collected</span></div></div>'+
   '<div class="result-rewards">'+(Array.isArray(last.newIds)?'<strong>✦ '+last.newIds.length+' new levels</strong>':'')+(last.gemsEarned?'<span>'+gem+' +'+last.gemsEarned+' gems</span>':'')+(last.holos?.length?'<span>✧ '+last.holos.length+' holo</span>':'')+(last.antimatters?.length?'<span class="antimatter-label">◈ '+last.antimatters.length+' Antimatter</span>':'')+(bonuses?'<span>+'+bonuses+' bonus '+(bonuses===1?'card':'cards')+'</span>':'')+'</div>'+
   '<div class="result-counts">'+[...counts].map(([d,n])=>'<span>'+faceIcon(d)+enc(d)+' <b>×'+n+'</b></span>').join('')+'</div>'+
   '<p class="pull-odds-note">Per card at +'+(last.luckAtPurchase??0)+'% luck. Regular pulls use difficulty odds. Ranked Extremes and vault cards use individual odds. Holo and Antimatter also include the finish roll.</p><div class="result-card-grid">'+entries.map((item,i)=>card(item.row,{index:i,bonus:item.bonus,fresh:item.fresh,finish:item.finish,drawChance:item})).join('')+'</div>'+
   '<div class="result-actions"><a class="outline" href="#gacha/collection">My cards</a><a class="primary" href="#gacha">Continue</a></div></section>';
 }
 function lastHandShown(){return stage==='shown'&&packIndex+1===run.quantity}
 function revealActions(){
  if(lastHandShown())return '<button type="button" class="reveal-continue" data-next>Click anywhere to continue</button>';
  return (stage==='shown'?'<button class="primary" data-next>Next pack</button>':'')+
   '<button class="outline" data-skip title="Show the rarest qualifying pull before results">Skip opening</button>';
 }
 function drawReveal(){
  const p=packs.find(x=>x.id===run.packId),remaining=run.quantity-packIndex;
  reveal.style.setProperty('--foil',p.color);reveal.style.setProperty('--ink',p.dark);
  const showPack=stage==='sealed'||stage==='peeling';
  reveal.classList.toggle('hand-complete',lastHandShown());
  const hand=pullCards(run,packIndex);
  let content;
  if(showPack){
   const visible=Math.min(remaining,visiblePackLimit);
   const category=mostLikelyDifficulty(oddsFor(p,run.luckAtPurchase,{version:run.packOddsVersion??1})).category;
   const pile=Array.from({length:visible},(_,i)=>'<span class="pile-item" style="--offset:'+(i-(visible-1)/2)+';--i:'+i+';z-index:'+(visible-i)+'">'+wrapper(p,run.sizes?.[packIndex+i]??5,category)+'</span>').reverse().join('');
   content='<div class="opening-arena"><div class="tear-scene"><button class="tear-target" data-tear aria-label="Peel open pack '+(packIndex+1)+'">'+pile+'</button><span class="tear-caption">Tap the pack to peel it open</span></div></div>';
  }else{
   content='<div class="opening-arena"><div class="reveal-grid hand-grid" style="--hand:'+hand.length+'">'+hand.map((x,i)=>card(x.row,{index:i,deal:stage==='dealing',bonus:x.bonus,fresh:x.fresh,finish:x.finish,drawChance:x})).join('')+'</div></div>';
  }
  const sub='Pack '+(packIndex+1)+' of '+run.quantity+(!showPack?' · Rarest first':'');
  reveal.innerHTML='<div class="opening-theater"><div class="reveal-bar"><span>PACK OPENING</span><div class="reveal-tools">'+speaker(false)+'<button class="iconbtn" data-close-reveal aria-label="Close pack opening">'+ico('x')+'</button></div></div><h2 id="revealTitle">'+p.name+' Gacha</h2><p class="run-info">'+sub+'</p>'+content+'<div class="reveal-actions">'+revealActions()+'</div></div>';
  reveal.scrollTop=0;
  if(stage==='sealed')reveal.querySelector('[data-tear]')?.focus({preventScroll:true});
  if(stage==='shown'){
   if(lastHandShown())for(const card of reveal.querySelectorAll('.hand-grid .level-card'))card.tabIndex=-1;
   reveal.querySelector('[data-next]')?.focus({preventScroll:true});
  }
 }
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function peel(){
  if(stage!=='sealed')return;
  stopTimers();sound.play('tear');stage='peeling';
  const btn=reveal.querySelector('[data-tear]'),seal=btn.querySelector('.pile-item:last-child .foil-seal').getBoundingClientRect();
  const mouth={x:seal.left+seal.width/2,y:seal.bottom};
  btn.disabled=true;btn.classList.add('tearing');
  reveal.querySelector('.tear-caption').textContent='Opening…';
  const quick=reduced(),active=run,epoch=animationId;
  const current=()=>epoch===animationId&&run===active&&reveal.open;
  later(async ()=>{
   await preparePullOdds(active);
   if(!current())return;
   stage='dealing';drawReveal();
   const cards=[...reveal.querySelectorAll('.hand-grid .level-card')];
   const hand=pullCards(active,packIndex);
   function finishHand(){
    stage='shown';
    const final=lastHandShown();
    for(const el of cards){
     el.disabled=false;delete el.dataset.unseen;
     if(final)el.tabIndex=-1;
    }
    reveal.classList.toggle('hand-complete',final);
    const actions=reveal.querySelector('.reveal-actions');
    actions.innerHTML=revealActions();
    actions.querySelector('[data-next]').focus({preventScroll:true});
   }
   if(quick){if(hand[0])landPull(hand[0],0,0);finishHand();return}
   for(const el of cards){el.dataset.unseen='';el.disabled=true}
   function dealNext(i){
    if(!current())return;
    if(i===cards.length){finishHand();return}
    const item=hand[i],el=cards[i],scene=openRare(item,{skipAll:()=>progress(true)});
    const bringIntoView=()=>{if(reveal.clientWidth<=680)el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'})};
    if(scene){
     scene.done.then(()=>{
      if(!current())return;
      delete el.dataset.unseen;bringIntoView();
      el.animate([{opacity:0,transform:'scale(.91) rotateY(-10deg)'},{opacity:1,transform:'none'}],{duration:240,easing:'ease-out'});
      later(()=>dealNext(i+1),265);
     });
     return;
    }
    delete el.dataset.unseen;bringIntoView();
    const r=el.getBoundingClientRect(),dx=mouth.x-r.left-r.width/2,dy=mouth.y-r.top-r.height/2;
    const pan=Math.max(-.55,Math.min(.55,(r.left+r.width/2-mouth.x)/Math.max(160,reveal.clientWidth*.65)));
    el.animate([
     {transform:'translate('+dx+'px,'+dy+'px) scale(.14) rotateY(112deg)',opacity:0},
     {offset:.3,transform:'translate('+dx*.65+'px,'+(dy*.7-24)+'px) scale(.50) rotateY(80deg)',opacity:1},
     {offset:.77,transform:'translate('+dx*.03+'px,-6px) scale(1.025) rotateY(-8deg)',opacity:1},
     {transform:'none',opacity:1}
    ],{duration:540,easing:'cubic-bezier(.22,.7,.28,1)'});
    sound.sweep(i,pan);later(()=>landPull(item,i,pan),355);
    later(()=>dealNext(i+1),Math.max(520,355+revealSpacing(item.tier,item.row[10],item.difficultyPercent,item.row[0])));
   }
   dealNext(0);
  },quick?20:550);
 }
 async function progress(skip){
  if(!run||['saving','finale','summary'].includes(stage)||(!skip&&stage!=='shown'))return;
  const active=run,opened=skip?active.quantity:packIndex+1;
  // When that card is already on screen, let its scene finish without replaying it.
  const currentHighlight=skip&&activeRare&&activeRare.drawIndex===rarestHighlight(active)?.drawIndex?activeRare.scene:null;
  stopTimers(Boolean(currentHighlight));stage='saving';
  const nextButton=reveal.querySelector('[data-next]');
  if(nextButton)nextButton.disabled=true;
  const current=()=>reveal.open&&run===active;
  let w;
  try{w=await advanceOpening(active.id,opened)}
  catch(error){
   if(current()){stopTimers();stage=skip?'sealed':'shown';drawReveal()}
   failure(error);return;
  }
  applyWallet(w);
  if(!current())return;
  if(w.pending?.id===active.id){
   packIndex=w.pending.opened;stage='sealed';drawReveal();sound.play('stack');return;
  }
  if(skip&&w.lastPull?.id===active.id){
   stage='finale';
   try{
    if(currentHighlight){await currentHighlight.done}
    else{
     await preparePullOdds(active);
     if(!current())return;
     const best=rarestHighlight(active);
     if(best)await openRare(best)?.done;
    }
   }catch(error){failure(error)}
  }
  if(!current())return;
  stage='summary';reveal.close();location.hash='#gacha/results';
 }
 reveal.addEventListener('close',()=>{
  if(stage!=='summary')stopTimers();
  run=null;stage='closed';
  if(view==='shop')updatePurchase();
 });
 reveal.onclick=e=>{
  if(e.target.closest('[data-reveal-sound]')){toggleSound();return}
  if(e.target.closest('[data-close-reveal],[data-done],[data-collection]')){reveal.close();return}
  if(lastHandShown()){progress(false);return}
  if(e.target.closest('[data-skip]')){progress(true);return}
  if(e.target.closest('[data-tear]')){peel();return}
  if(e.target.closest('[data-next]')){progress(false);return}
  const btn=e.target.closest('[data-card]');if(btn&&stage!=='dealing'){const row=run?.rows.find(r=>r[0]===Number(btn.dataset.card));if(row){sound.play('inspect');openLevel(row)}}
 };
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='packSound'){toggleSound();return}
  if(b.hasAttribute('data-encore')){sound.stop();bestSound();return}
  if(b.dataset.upgrade){upgrade(b.dataset.upgrade,b.dataset.upgradeMode==='max'?'max':Number(b.dataset.upgradeMode));return}
  if(b.dataset.choose){if(selected.id!==b.dataset.choose){selected=packs.find(p=>p.id===b.dataset.choose);shop();}return}
  if(b.dataset.qty){if(quantity!==Number(b.dataset.qty))sound.play('stack');quantity=Number(b.dataset.qty);updatePurchase();return}
  if(b.id==='buyPack'){purchase();return}
  if('rareReplay'in b.dataset&&view==='results'&&wallet?.lastPull){
   const item=pullCards(wallet.lastPull)[Number(byId('rareReplayPick')?.value||0)];
   if(item)openRare(item,{hold:true});
   return;
  }
  if(b.dataset.binder){sound.play('select');collectionPage+=Number(b.dataset.binder);binder();return}
  if(b.dataset.card&&view!=='vault'){const id=Number(b.dataset.card),row=view==='results'?wallet?.lastPull?.rows.find(r=>r[0]===id):cards.find(c=>c.id===id)?.row;if(row){sound.play('inspect');openLevel(row)}}
 });
 return {page};
}
