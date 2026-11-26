import {cubeCatalog,cubeRarities,equippedCube} from './cube-catalog.js';
import {campaignStages} from './campaign.js';
import {ico} from './icons.js';
import {gameCommand} from './game-client.js';
import {buildingSpecs,buildingPlacementError,forgeMinimum,forgePrice,forgeStored,forgeWelcomeMana,housePrice,kingdomStats,lastLandLevel,manaIcon,visitorSlots} from './kingdom-rules.js';
import {playerProgress} from './player-progression.js';
import {towerPlayerLevel} from './level-access.js';
import {setLevelLock} from './level-lock.js';
import {rewardOrigin} from './reward-flight.js';

const readout=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
const amount=n=>n>=1e8?compact.format(n):readout.format(n);
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const towerName='Starter tower',houseName=buildingSpecs.house.name,forgeName=buildingSpecs.forge.name;
const coin='<img src="/assets/packs/coin.png" alt="">';
const star='<img src="/assets/gd-star.png" alt="">';
const mana='<img src="'+manaIcon+'" alt="">';
const cameraButton=(action,icon,label)=>'<button type="button" data-camera="'+action+'" title="'+label+'" aria-label="'+label+'">'+ico(icon)+'</button>';
const skins=new Map(cubeCatalog.map(cube=>[cube.id,cube]));
const rarities=[...new Set(visitorSlots.map(slot=>slot.rarity))];
const visitorsFrom=wallet=>(wallet.discoveredVisitors||[]).map(guest=>({...guest,...visitorSlots[guest.slot],skin:skins.get(guest.cube)}));

function visitorCard(slot,guest){
 if(!guest)return '<article class="visitor-card visitor-mystery"><div class="visitor-unknown" aria-hidden="true">?</div>'+
  '<div class="visitor-name"><strong>???</strong><small>Undiscovered</small></div>'+
  '<span class="visitor-locked" aria-label="Unlocks at '+slot.stars+' stars">'+ico('lock')+slot.stars+' '+star+'</span></article>';
 const channel='https://www.youtube.com/@'+encodeURIComponent(guest.channel);
 return '<article class="visitor-card"><img class="visitor-skin" src="'+guest.skin.icon+'" alt="" title="Preview cube">'+
  '<div class="visitor-name"><a href="'+channel+'" target="_blank" rel="noopener">'+escape(guest.name)+' '+ico('external')+'</a>'+
  '<small>'+escape(guest.audience)+' subscribers</small></div>'+
  '<button type="button" class="outline" data-visit="'+escape(guest.id)+'" aria-label="Inspect '+escape(guest.name)+'">Visiting</button></article>';
}

export function createKingdom(root,sound,applyWallet,rewards){
 let wallet,world,ui,coins=0,cube,selection='tower',visit=0,pan=false,keys;
 let plot=kingdomStats(),visitors=[],plotSignature='',snap=true,build=null,placing=false,upgrading=false;
 let buildingKind='house',expanding=false;
 let towerClockOffset=0,finishingTower=false,towerRetryAt=0;
 const collecting=new Set();
 const towerNow=()=>Date.now()+towerClockOffset;
 const timeLeft=site=>Math.max(0,Math.ceil((site.endsAt-towerNow())/1000));
 function timerText(site){
  const seconds=timeLeft(site);
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
 }
 const guestFor=id=>visitors.find(guest=>id==='visitor:'+guest.id);
 const buildingKey=building=>(building.kind||'house')+':'+building.id;
 const buildingFor=id=>plot.buildings.find(building=>buildingKey(building)===id);
 function nameOf(id){
  if(id==='tower')return towerName;
  if(id==='cube')return cube.name;
  if(id?.startsWith('mana:')){
   const forge=plot.forges.find(item=>item.id===id.slice(5));
   return forge?'Collect '+readout.format(forgeStored(forge))+' mana':null;
  }
  const building=buildingFor(id);
  return building?buildingSpecs[building.kind||'house'].name:guestFor(id)?.name;
 }
 const priceFor=kind=>kind==='forge'?forgePrice:plot.houseCost;
 const placementError=spot=>buildingPlacementError(plot.buildings,spot,plot.land.bounds);

 function paintForge(){
  const forge=buildingFor(selection);
  ui.collectMana.hidden=forge?.kind!=='forge'||forgeStored(forge)<forgeMinimum;
  if(forge?.kind!=='forge')return;
  const stored=forgeStored(forge);
  ui.description.textContent=readout.format(stored)+' mana stored · +1 mana per second'+(stored<forgeMinimum?' · Collect at '+forgeMinimum:'');
  ui.collectMana.disabled=collecting.has(forge.id);
  ui.collectMana.textContent='Collect '+readout.format(stored)+' mana';
  ui.collectMana.dataset.forge=forge.id;
 }

 function paintSelection(){
  if(!ui)return;
  const {houses,forges}=plot;
  const guest=guestFor(selection),building=buildingFor(selection),forge=building?.kind==='forge';
  const tower=selection==='tower';
  ui.tower.setAttribute('aria-pressed',String(tower));
  ui.resident.setAttribute('aria-pressed',String(selection==='cube'));
  ui.lastHouse.hidden=!houses.length;
  ui.lastHouse.dataset.object=houses.length?'house:'+houses.at(-1).id:'';
  ui.lastHouse.setAttribute('aria-pressed',String(Boolean(building&&!forge)));
  ui.lastForge.hidden=!forges.length;
  ui.lastForge.dataset.object=forges.length?'forge:'+forges.at(-1).id:'';
  ui.lastForge.setAttribute('aria-pressed',String(forge));
  ui.name.textContent=nameOf(selection);
  ui.state.textContent=tower?(plot.tower.construction?'Upgrading to Level 2':'Level '+plot.tower.level):
   forge?'Mana production':building?'Home':guest?guest.rarity+' visitor':cube.rarity+' cube';
  ui.description.textContent=tower?houses.length+' / '+plot.tower.limit+' house lots used.'+(plot.tower.next?' Upgrade the tower for more space.':''):
   building?'Worth '+readout.format(building.price??housePrice)+' coins and adds 0.3 stars.':
   guest?'Visits Kingdoms rated '+guest.stars+' stars or higher.':'Your equipped cube roams the grounds.';
  ui.changeCube.hidden=selection!=='cube';
  paintForge();
 }
 function paintConstruction(){
  const site=plot.tower.construction;
  ui.towerProgress.hidden=!site;
  if(!site)return;
  ui.towerCountdown.textContent=timeLeft(site)?timerText(site):'Finishing…';
  ui.towerMeter.max=(site.endsAt-site.startedAt)/1000;
  ui.towerMeter.value=Math.max(0,ui.towerMeter.max-timeLeft(site));
 }
 function select(id){
  if(!nameOf(id))return;
  if(id!==selection){sound.play('inspect',{level:.44});selection=id}
  world?.select(id);
  paintSelection();
 }
 function hover(id,point){
  const name=nameOf(id);
  ui.hover.hidden=!name;
  if(!name)return;
  ui.hover.textContent=name;
  ui.hover.style.left=Math.min(ui.canvas.clientWidth-64,Math.max(64,point.x))+'px';
  ui.hover.style.top=Math.max(34,point.y)+'px';
 }
 function paintStats(){
  if(!ui)return;
  ui.coins.textContent=wallet?amount(coins):'…';
  if(wallet)ui.coins.title=readout.format(coins)+' coins';
  ui.gems.textContent=wallet?readout.format(wallet.gems):'…';
  rewards.paint('mana');
  ui.clears.textContent=wallet?Object.keys(wallet.campaign||{}).length+' / '+campaignStages.length:'…';
 }
 function paintPlot(){
  if(!ui)return;
  const {buildings,stars,value}=plot;
  ui.value.textContent=amount(value);
  ui.value.title=readout.format(value)+' coins';
  ui.starValue.textContent=readout.format(stars)+' / 5';
  ui.stars.setAttribute('aria-label',stars+' out of 5 stars');
  ui.starFills.forEach((fill,i)=>fill.style.width=Math.max(0,Math.min(100,Math.round((stars-i)*100)))+'%');
  ui.buildings.textContent=(buildings.length+1)+' '+(buildings.length?'buildings':'building');
  ui.visitors.textContent='Visitors '+visitors.length+' / '+visitorSlots.length;
  ui.discoveries.textContent=visitors.length+' / '+visitorSlots.length+' discovered';
  ui.indexProgress.value=visitors.length;
  const discovered=new Map(visitors.map(guest=>[guest.slot,guest]));
  const focused=document.activeElement?.dataset?.visit;
  ui.guestRows.innerHTML=rarities.map(rarity=>{
   const slots=visitorSlots.filter(slot=>slot.rarity===rarity);
   const found=slots.filter(slot=>discovered.has(slot.slot)).length;
   return '<section class="visitor-tier" style="--rarity:'+cubeRarities[rarity]+'"><h3>'+rarity+
    '<small>'+found+' / '+slots.length+'</small></h3>'+slots.map(slot=>visitorCard(slot,discovered.get(slot.slot))).join('')+'</section>';
  }).join('');
  if(focused)[...ui.guestRows.querySelectorAll('[data-visit]')].find(node=>node.dataset.visit===focused)?.focus({preventScroll:true});
  world?.setPlot(buildings,visitors,plot.tower.level,plot.land.level,plot.tower.construction,towerClockOffset);
  paintSelection();
  paintConstruction();
 }
 function setWallet(next){
  wallet=next;
  const wasBuilding=Boolean(plot.tower.construction);
  const priorClock=towerClockOffset;
  towerClockOffset=Number.isFinite(next.towerClock)?next.towerClock-Date.now():0;
  const equipped=equippedCube(wallet),changed=cube?.id!==equipped.id;
  cube=equipped;
  if(changed&&ui){
   ui.avatar.src=cube.icon;ui.residentName.textContent=cube.name;
   world?.setCube(cube);
   paintSelection();
  }
  plot=kingdomStats(wallet,towerNow());
  visitors=visitorsFrom(wallet);
  const signature=[plot.tower.level,plot.tower.construction?.endsAt,plot.land.level,...plot.buildings.map(building=>building.id+'@'+(building.collectedAt??'')),...visitors.map(guest=>guest.id)].join('/');
  if(signature!==plotSignature){
   plotSignature=signature;
   if((selection.startsWith('house:')||selection.startsWith('forge:'))&&!buildingFor(selection))selection='tower';
   if(selection.startsWith('visitor:')&&!guestFor(selection))selection='tower';
   paintPlot();world?.select(selection);
   if(build?.spot)build.error=placementError(build.spot);
  }else if(plot.tower.construction&&priorClock!==towerClockOffset){
   world?.setPlot(plot.buildings,visitors,plot.tower.level,plot.land.level,plot.tower.construction,towerClockOffset);
   paintConstruction();
  }
  if(ui&&wasBuilding&&!plot.tower.construction&&plot.tower.level===2){
   const line='Tower Level 2 complete · '+plot.tower.limit+' house lots';
   ui.kingdomNotice.textContent=line;ui.buildNotice.dataset.notice=line;
   sound.play('bonus',{level:.61});
  }
  paintStats();paintBuild();
 }
 function setCoins(amount){
  coins=amount;
  paintStats();paintBuild();
 }
 async function finishTower(){
  finishingTower=true;
  try{
   const {wallet:next}=await gameCommand('kingdom.tower.finish');
   applyWallet(next);
  }catch{towerRetryAt=Date.now()+5000}
  finally{finishingTower=false}
 }
 function tick(){
  if(!ui)return;
  if(selection.startsWith('forge:'))paintForge();
  const site=wallet?.kingdom?.towerConstruction;
  if(!site)return;
  paintConstruction();
  if(ui.buildDialog.open)paintBuildMenu();
  if(!timeLeft(site)&&!finishingTower&&Date.now()>=towerRetryAt)finishTower();
 }
 async function collectMana(id,point){
  const forge=plot.forges.find(item=>item.id===id);
  if(!ui||!forge||collecting.has(id)||forgeStored(forge)<forgeMinimum||build)return;
  select('forge:'+id);collecting.add(id);paintForge();
  const origin=point||world?.manaOrigin(id)||rewardOrigin(ui.collectMana);
  const epoch=visit;
  try{
   const {wallet:next,result}=await gameCommand('kingdom.collect',{id});
   const ticket=epoch===visit?rewards.reserve('mana',result.earned):null;
   applyWallet(next);
   if(epoch!==visit)return;
   world?.popMana(id);sound.play('extraAccent',{level:.64});
   rewards.launch(ticket,origin);
   ui.kingdomNotice.textContent='+'+readout.format(result.earned)+' mana collected';
  }catch(error){if(epoch===visit)ui.kingdomNotice.textContent=error.message}
  finally{collecting.delete(id);if(epoch===visit)paintForge()}
 }
 function reset(){
  world?.reset();
  pan=false;setPan();
 }
 function setPan(){
  ui.pan.setAttribute('aria-pressed',String(pan));
  ui.instructions.textContent=(pan?'Drag to pan':'Drag to orbit')+' · Scroll or pinch to zoom';
  world?.panMode(pan);
 }
 function updatePreview(){
  if(!build?.point)return;
  const step=snap&&!build.locked?1:100,point=build.locked?build.spot:build.point;
  const spot={x:Math.round(point.x*step)/step,z:Math.round(point.z*step)/step,rotation:build.rotation,kind:build.kind};
  build.spot=spot;
  build.error=placementError(spot);
 }
 function paintBuildMenu(){
  const {houses,forges,tower,land}=plot,free=Math.max(0,tower.limit-houses.length),full=free===0;
  const house=buildingKind==='house',price=priceFor(buildingKind);
  const required=towerPlayerLevel(tower.level+1),playerLevel=playerProgress(wallet?.playerXp).level;
  const short=Math.max(0,price-coins);
  ui.limits.textContent=houses.length+' / '+tower.limit+' used';
  ui.available.textContent=free+' available';
  ui.lotMeter.max=tower.limit;
  ui.lotMeter.value=houses.length;
  ui.forgeCount.textContent=forges.length+' built';
  ui.price.textContent=readout.format(price)+' coins';
  ui.priceLine.hidden=house&&full&&!tower.next;
  ui.choose.disabled=!world||!wallet||upgrading||expanding||house&&full||short>0;
  ui.upgrade.hidden=!house||!full||!tower.next||Boolean(tower.construction);
  if(tower.next){
   setLevelLock(ui.upgrade,required,playerLevel);
   ui.upgrade.disabled=upgrading||expanding||!wallet||coins<tower.next.price;
   ui.towerGate.textContent='Lvl '+required+'+';
   ui.upgradePrice.textContent=readout.format(tower.next.price);
   ui.upgradeTime.hidden=!tower.next.buildMs;
   ui.upgrade.title='Upgrade to Level '+(tower.level+1)+' for '+tower.next.limit+' house lots'+(tower.next.buildMs?' in one minute':'');
  }
  ui.landLevel.textContent='Level '+land.level+' / '+lastLandLevel+' · '+Number(land.size.toFixed(2))+'× starting area';
  ui.landUpgrade.hidden=land.nextPrice===null;
  ui.landUpgrade.disabled=expanding||upgrading||!wallet||coins<(land.nextPrice??Infinity);
  ui.landPrice.textContent=land.nextPrice===null?'':readout.format(land.nextPrice);
  let hint='';
  if(house&&full)hint=!tower.next?'All house lots are full.':playerLevel<required?'Reach player Level '+required+' to expand your tower.':
   'Upgrade your tower to open '+(tower.next.limit-tower.limit)+' more house lots.';
  else if(short)hint='Need '+readout.format(short)+' more coins.';
  else if(!world)hint='The 3D plot is unavailable.';
  const notice=upgrading?'Starting tower upgrade…':expanding?'Expanding your plot…':tower.construction?
   'Tower Level 2 under construction · '+timerText(tower.construction):ui.buildNotice.dataset.notice||hint;
  if(ui.buildNotice.textContent!==notice)ui.buildNotice.textContent=notice;
 }
 function previewBuilding(){
  const spec=buildingSpecs[buildingKind];
  ui.optionName.textContent=spec.name;
  ui.preview.setAttribute('aria-label',spec.name+' 3D preview');
  ui.buildEffect.innerHTML=buildingKind==='forge'?mana+'1 mana/s · +'+forgeWelcomeMana+' on placement':star+'+0.3 stars';
  ui.choose.textContent=buildingKind==='forge'?'Build Mana Forge':'Build GD House';
  for(const button of ui.kindButtons)button.setAttribute('aria-pressed',String(button.dataset.buildKind===buildingKind));
  ui.previewStatus.hidden=false;
  try{
   if(world){
    world.setBuildingPreview(ui.preview,buildingKind);
    ui.previewStatus.hidden=true;
   }
  }catch{
   ui.previewStatus.hidden=false;
  }
 }
 function openBuildMenu(){
  if(!wallet||build||ui.buildDialog.open)return;
  delete ui.buildNotice.dataset.notice;
  ui.buildDialog.showModal();
  paintBuildMenu();previewBuilding();
 }
 function paintBuild(){
  if(!ui)return;
  const full=build?.kind==='house'&&plot.houses.length>=plot.tower.limit;
  ui.toolbar.classList.toggle('is-building',Boolean(build));
  ui.openBuild.hidden=Boolean(build);
  ui.openBuild.disabled=!wallet||(!world&&!ui.controls.hidden);
  ui.editTools.hidden=!build;
  ui.place.hidden=!build?.locked;
  const short=build?Math.max(0,build.cost-coins):0,priceChanged=Boolean(build&&build.cost!==priceFor(build.kind));
  ui.place.disabled=placing||Boolean(build?.error)||short>0||full||priceChanged;
  ui.cancel.disabled=placing;
  ui.rotate.disabled=placing;
  ui.snap.disabled=placing;
  ui.snap.setAttribute('aria-pressed',String(snap));
  ui.snap.textContent=snap?'Snap on':'Snap off';
  ui.canvas.dataset.locked=String(Boolean(build?.locked));
  if(build){
   ui.placementPrice.textContent=readout.format(build.cost)+' coins';
   const problem=full?'The tower’s house lots are full.':priceChanged?'The price changed. Reopen Build Mode to review it.':build.error;
   const instruction=placing?'Placing building…':problem||(build.locked?
    (short?'Need '+readout.format(short)+' more coins.':'Position locked. Confirm to build.'):
    'Click or tap an open spot to lock the position.');
   if(ui.status.textContent!==instruction)ui.status.textContent=instruction;
   ui.status.classList.toggle('invalid',Boolean(problem||build.locked&&short));
  }
  if(ui.buildDialog.open)paintBuildMenu();
  world?.setBuild(build?{...build,snap}:null);
 }
 function pointOnPlot(point,lock){
  if(!build||build.locked||placing)return;
  build.point=point;
  if(point)updatePreview();
  else{build.spot=null;build.error=''}
  if(lock&&build.spot&&!build.error){
   build.locked=true;
   sound.play('inspect',{level:.48});
  }
  paintBuild();
 }
 function startBuild(){
  const kind=buildingKind,cost=priceFor(kind);
  if(!wallet||!world||placing||upgrading||expanding||kind==='house'&&plot.houses.length>=plot.tower.limit||coins<cost)return;
  ui.buildDialog.close();
  build={kind,cost,rotation:0,point:null,spot:null,locked:false,error:''};
  ui.placementName.textContent=buildingSpecs[kind].name;
  pan=false;setPan();paintBuild();
  ui.canvas.focus({preventScroll:true});
 }
 function cancelBuild(){
  if(!build||placing)return;
  build=null;paintBuild();ui.openBuild.focus({preventScroll:true});
 }
 function rotate(){
  if(!build||placing)return;
  build.rotation=(build.rotation+1)%4;
  updatePreview();paintBuild();
 }
 async function place(){
  if(!build?.locked||build.error||placing||build.cost!==priceFor(build.kind)||coins<build.cost||
   build.kind==='house'&&plot.houses.length>=plot.tower.limit)return;
  const epoch=visit,kind=build.kind,spot={...build.spot,expectedPrice:build.cost};
  placing=true;paintBuild();
  try{
   const {wallet:next,result}=await gameCommand('kingdom.'+kind,spot);
   applyWallet(next);
   if(epoch!==visit)return;
   build=null;placing=false;
   select(kind+':'+result[kind].id);
   if(kind==='forge')ui.kingdomNotice.textContent='+'+forgeWelcomeMana+' mana from your new forge';
   else ui.kingdomNotice.textContent='';
   sound.play('buy',{level:.74});
  }catch(error){
   if(epoch!==visit)return;
   // Keep the placement preview available so the player can adjust it.
   build.locked=false;
   build.error=error.message;
  }finally{
   if(epoch===visit){placing=false;paintBuild()}
  }
 }
 async function expand(){
  const {level,nextPrice}=plot.land;
  if(expanding||upgrading||nextPrice===null||coins<nextPrice)return;
  expanding=true;delete ui.buildNotice.dataset.notice;paintBuild();
  const epoch=visit;
  try{
   const {wallet:next,result}=await gameCommand('kingdom.expand',{level});
   applyWallet(next);
   if(epoch!==visit)return;
   ui.buildNotice.dataset.notice='Land Level '+result.level+' · 25% more area';
   sound.play('buy',{level:.74});
  }catch(error){if(epoch===visit)ui.buildNotice.dataset.notice=error.message}
  finally{if(epoch===visit){expanding=false;paintBuild()}}
 }
 async function improveTower(){
  const {tower,houses}=plot;
  if(upgrading||tower.construction||!tower.next||houses.length<tower.limit||coins<tower.next.price||
   expanding||playerProgress(wallet?.playerXp).level<towerPlayerLevel(tower.level+1))return;
  delete ui.buildNotice.dataset.notice;
  upgrading=true;paintBuild();
  const epoch=visit;
  try{
   const {wallet:next,result}=await gameCommand('kingdom.tower',{level:tower.level});
   applyWallet(next);
   if(epoch!==visit)return;
   select('tower');sound.play('buy',{level:.74});
   if(result.tower.construction){
    ui.buildDialog.close();reset();
    ui.canvas.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   }else ui.buildNotice.dataset.notice='Tower Level '+result.tower.level+' · '+result.tower.limit+' house lots';
  }catch(error){
   if(epoch===visit)ui.buildNotice.dataset.notice=error.message;
  }finally{
   if(epoch===visit){upgrading=false;paintBuild()}
  }
 }
 function setUp(){
  cube=equippedCube(wallet);
  root.innerHTML='<div class="kingdom-heading"><h1>Your Kingdom</h1><div class="kingdom-summary">'+
   '<span class="kingdom-value">'+coin+'<span>Kingdom value <b data-plot-value>0</b></span></span>'+
   '<span class="kingdom-quality"><span class="kingdom-stars" role="img" aria-label="0 out of 5 stars">'+
   Array.from({length:5},()=>'<span>'+star+'<i>'+star+'</i></span>').join('')+
   '</span><b data-plot-rating>0 / 5</b></span>'+
   '<span class="kingdom-mana" id="kingdomManaBadge">'+mana+'<span>Mana <b data-plot-mana id="kingdomManaCount">0</b></span></span></div></div>'+
   '<div class="kingdom-frame" aria-label="Your 3D Kingdom"><canvas tabindex="0" aria-label="Kingdom plot" aria-describedby="kingdomControls"></canvas>'+
   '<p class="kingdom-loading" role="status">Loading your Kingdom…</p>'+
   '<div class="kingdom-plot-stats"><span>'+ico('tower')+'<b data-plot-buildings>1 building</b></span><span>'+ico('box')+'1 resident</span></div>'+
   '<div class="tower-construction-meter" data-tower-progress hidden><div><strong>Tower Level 2</strong><b data-tower-countdown>1:00</b></div>'+
   '<progress aria-label="Tower construction progress" max="60" value="0"></progress></div>'+
   '<div class="kingdom-hover" aria-hidden="true" hidden></div>'+
   '<div class="kingdom-controls"><span id="kingdomControls">Drag to orbit · Scroll or pinch to zoom</span><div role="group" aria-label="Camera controls">'+
   cameraButton('pan','pan','Pan camera')+cameraButton('out','zoomOut','Zoom out')+cameraButton('in','zoomIn','Zoom in')+
   cameraButton('reset','aim','Reset camera')+'</div></div></div>'+
   '<div class="kingdom-builder"><button type="button" class="primary" data-build="start" aria-haspopup="dialog" disabled>'+ico('tower')+'Build Mode</button>'+
   '<div data-build-tools hidden><div class="kingdom-placement-copy"><strong data-placement-name></strong>'+
   '<span>'+coin+'<b data-placement-price></b></span><p data-build-status role="status"></p></div>'+
   '<div class="kingdom-build-controls"><button type="button" class="outline" data-build="snap" aria-pressed="true">Snap on</button>'+
   '<button type="button" class="outline" data-build="rotate">Rotate <kbd>R</kbd></button>'+
   '<button type="button" class="outline" data-build="cancel">Cancel <kbd>Q</kbd></button>'+
   '<button type="button" class="primary" data-build="place" hidden>Place <kbd>E</kbd></button></div></div></div>'+
   '<div class="kingdom-dashboard"><section class="kingdom-inspector" aria-label="Inspect your plot"><div class="kingdom-objects" role="group" aria-label="Select an object">'+
   '<button type="button" data-object="tower">'+ico('tower')+towerName+'</button>'+
   '<button type="button" data-object="cube"><img alt="" data-resident-avatar><span data-resident-name></span></button>'+
   '<button type="button" data-last-house hidden>'+houseName+'</button>'+
   '<button type="button" data-last-forge hidden>'+mana+forgeName+'</button>'+
   '<button type="button" data-visitor-index aria-haspopup="dialog">Visitors 0 / '+visitorSlots.length+'</button></div>'+
   '<div class="kingdom-detail" aria-live="polite"><div><h2></h2><span data-plot-state></span></div><p></p>'+
   '<a href="#gacha/cubes" data-change-cube hidden>Change cube '+ico('right')+'</a>'+
   '<button class="outline mana-claim" type="button" data-collect-mana hidden></button><p class="kingdom-notice" data-kingdom-notice role="status"></p></div></section>'+
   '<dl class="kingdom-stats" aria-label="Player stats"><div><dt>'+coin+'Coins</dt><dd data-plot-coins></dd></div>'+
   '<div><dt><img src="/assets/packs/gem.png" alt="">Gems</dt><dd data-plot-gems></dd></div>'+
   '<div><dt>'+ico('battle')+'Campaign clears</dt><dd data-plot-clears></dd></div></dl></div>'+
   '<dialog class="kingdom-guest-index" aria-labelledby="guestTitle"><div class="guest-index-heading"><h2 id="guestTitle">Visitor index</h2>'+
   '<button type="button" class="iconbtn" data-close-visitors aria-label="Close visitor index">'+ico('x')+'</button></div>'+
   '<div class="visitor-collection"><b data-visitor-count></b><progress aria-label="Visitors discovered" max="'+visitorSlots.length+'" value="0"></progress></div>'+
   '<p>Develop your Kingdom to discover more visitors.</p><div class="visitor-list" data-visitor-rows></div></dialog>'+
   '<dialog class="kingdom-build-menu" aria-labelledby="buildModeTitle"><div class="build-menu-header">'+
   '<h2 id="buildModeTitle">Build Mode</h2><button type="button" class="iconbtn" data-build="close" aria-label="Close Build Mode">'+ico('x')+'</button></div>'+
   '<div class="build-capacity"><div><b>House lots</b><span data-house-lots></span></div><strong data-lots-available></strong>'+
   '<progress aria-label="House lots used" data-lot-meter max="2" value="0"></progress></div>'+
   '<div class="build-catalog" role="group" aria-label="Building categories"><button type="button" class="outline" data-build-kind="house" aria-pressed="true">Housing</button>'+
   '<button type="button" class="outline" data-build-kind="forge" aria-pressed="false">'+mana+'Production<small data-forge-count></small></button></div>'+
   '<article class="build-option"><div class="build-viewport"><canvas tabindex="0" aria-label="GD House 3D preview" aria-describedby="housePreviewControls"></canvas>'+
   '<p data-preview-status role="status" hidden>3D preview unavailable.</p>'+
   '<span id="housePreviewControls">Drag or use arrow keys to rotate</span></div>'+
   '<div class="build-option-info"><h3 data-build-name>'+houseName+'</h3><span class="build-rating" data-build-effect>'+star+'+0.3 stars</span>'+
   '<small class="build-price" data-house-price-line>'+coin+'<b data-house-price></b></small>'+
   '<button class="primary" type="button" data-build="choose">Build GD House</button></div></article>'+
   '<div class="land-expansion"><div><strong>Land expansion</strong><small data-land-level></small></div>'+
   '<button type="button" class="outline" data-expand-land>Expand +25% <span>'+coin+'<b data-land-price></b></span></button></div>'+
   '<div class="build-menu-footer"><p data-build-notice role="status"></p>'+
   '<button type="button" class="outline tower-upgrade" data-tower-upgrade hidden>Upgrade tower <span>'+coin+'<b data-tower-cost></b></span><small data-tower-time hidden>1 min</small>'+
   '<small class="level-lock" data-level-badge hidden>'+ico('lock')+'<b data-tower-gate></b></small></button></div></dialog>';
  const get=selector=>root.querySelector(selector);
  ui={
   canvas:get('.kingdom-frame canvas'),loading:get('.kingdom-loading'),hover:get('.kingdom-hover'),
   controls:get('.kingdom-controls'),instructions:get('#kingdomControls'),
   towerProgress:get('[data-tower-progress]'),towerCountdown:get('[data-tower-countdown]'),towerMeter:get('[data-tower-progress] progress'),
   pan:get('[data-camera="pan"]'),tower:get('[data-object="tower"]'),resident:get('[data-object="cube"]'),lastHouse:get('[data-last-house]'),lastForge:get('[data-last-forge]'),
   avatar:get('[data-resident-avatar]'),residentName:get('[data-resident-name]'),
   name:get('.kingdom-detail h2'),state:get('[data-plot-state]'),description:get('.kingdom-detail p'),changeCube:get('[data-change-cube]'),
   coins:get('[data-plot-coins]'),gems:get('[data-plot-gems]'),clears:get('[data-plot-clears]'),
   collectMana:get('[data-collect-mana]'),kingdomNotice:get('[data-kingdom-notice]'),
   value:get('[data-plot-value]'),buildings:get('[data-plot-buildings]'),starValue:get('[data-plot-rating]'),
   stars:get('.kingdom-stars'),starFills:[...root.querySelectorAll('.kingdom-stars i')],
   toolbar:get('.kingdom-builder'),status:get('[data-build-status]'),editTools:get('[data-build-tools]'),
   buildDialog:get('.kingdom-build-menu'),preview:get('.build-viewport canvas'),previewStatus:get('[data-preview-status]'),
   buildNotice:get('[data-build-notice]'),choose:get('[data-build="choose"]'),
   optionName:get('[data-build-name]'),buildEffect:get('[data-build-effect]'),kindButtons:root.querySelectorAll('[data-build-kind]'),forgeCount:get('[data-forge-count]'),
   landLevel:get('[data-land-level]'),landUpgrade:get('[data-expand-land]'),landPrice:get('[data-land-price]'),
   price:get('[data-house-price]'),priceLine:get('[data-house-price-line]'),placementPrice:get('[data-placement-price]'),placementName:get('[data-placement-name]'),
   limits:get('[data-house-lots]'),available:get('[data-lots-available]'),lotMeter:get('[data-lot-meter]'),
   upgrade:get('[data-tower-upgrade]'),upgradePrice:get('[data-tower-cost]'),upgradeTime:get('[data-tower-time]'),towerGate:get('[data-tower-gate]'),
   openBuild:get('[data-build="start"]'),cancel:get('[data-build="cancel"]'),rotate:get('[data-build="rotate"]'),
   snap:get('[data-build="snap"]'),place:get('[data-build="place"]'),
   visitors:get('[data-visitor-index]'),guestDialog:get('.kingdom-guest-index'),guestRows:get('[data-visitor-rows]'),
   discoveries:get('[data-visitor-count]'),indexProgress:get('.visitor-collection progress')
  };
  ui.avatar.src=cube.icon;ui.residentName.textContent=cube.name;
  const buildMenu=ui.buildDialog;
  buildMenu.addEventListener('close',()=>{
   if(ui?.buildDialog===buildMenu&&!buildMenu.open)world?.setBuildingPreview(null);
  });
  root.onclick=event=>{
   if(event.target===ui.guestDialog){ui.guestDialog.close();return}
   if(event.target===ui.buildDialog){
    const box=ui.buildDialog.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)ui.buildDialog.close();
    return;
   }
   const button=event.target.closest('button');
   if(!button)return;
   if(button.dataset.object){select(button.dataset.object);return}
   if(button===ui.visitors){ui.guestDialog.showModal();return}
   if(button.matches('[data-close-visitors]')){ui.guestDialog.close();return}
   if(button.dataset.visit){ui.guestDialog.close();select('visitor:'+button.dataset.visit);return}
   if(button===ui.openBuild){openBuildMenu();return}
   if(button.dataset.build==='close'){ui.buildDialog.close();return}
   if(button.dataset.buildKind){buildingKind=button.dataset.buildKind;delete ui.buildNotice.dataset.notice;paintBuildMenu();previewBuilding();return}
   if(button===ui.choose){startBuild();return}
   if(button===ui.upgrade){improveTower();return}
   if(button===ui.landUpgrade){expand();return}
   if(button===ui.collectMana){collectMana(button.dataset.forge);return}
   if(!world)return;
   const action=button.dataset.camera;
   if(action==='pan'){pan=!pan;setPan();return}
   if(action==='reset'){reset();return}
   if(action==='in'||action==='out'){world.zoom(action==='in'?.79:1.26);return}
   if(button===ui.cancel)cancelBuild();
   if(button===ui.rotate)rotate();
   if(button===ui.place)place();
   if(button===ui.snap){snap=!snap;updatePreview();paintBuild()}
  };
  keys=new AbortController();
  document.addEventListener('keydown',event=>{
   if(!build||event.repeat||event.ctrlKey||event.altKey||event.metaKey||
    document.querySelector('dialog[open]')||event.target.closest?.('input,textarea,select,[contenteditable]'))return;
   const key=event.key.toLowerCase();
   if(!['q','e','r'].includes(key))return;
   event.preventDefault();
   if(key==='q')cancelBuild();
   if(key==='e')place();
   if(key==='r')rotate();
  },{signal:keys.signal});
  pan=false;setPan();paintPlot();paintStats();paintBuild();
 }
 async function show(on){
  if(!on){
   if(root.hidden)return;
   root.hidden=true;visit++;
   keys?.abort();world?.dispose();world=null;ui=null;build=null;placing=false;upgrading=false;expanding=false;root.replaceChildren();
   return;
  }
  if(!root.hidden)return;
  root.hidden=false;
  setUp();
  const route=++visit;
  try{
   const {createKingdomWorld}=await import('/kingdom-world.js');
   if(visit!==route)return;
   world=createKingdomWorld({canvas:ui.canvas,cube,onSelect:select,onHover:hover,onPlot:pointOnPlot,onCollect:collectMana});
   world.select(selection);paintPlot();paintBuild();
   ui.loading.hidden=true;
  }catch{
   if(visit!==route)return;
   ui.loading.textContent='The 3D view could not start. You can still check your Kingdom and visitors below.';
   ui.controls.hidden=true;
   ui.canvas.tabIndex=-1;
   paintBuild();
  }
 }
 return {show,setWallet,setCoins,tick};
}
