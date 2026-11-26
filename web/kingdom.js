import {cubeCatalog,cubeRarities,equippedCube} from './cube-catalog.js';
import {campaignStages} from './campaign.js';
import {ico} from './icons.js';
import {kingdomAmbience} from './kingdom-ambience.js';
import {gameCommand,gameRead} from './game-client.js';
import {buildingSpecs,buildingPlacementError,forgeMinimum,forgePlan,forgePrice,forgeStored,forgeUpgrade,forgeWelcomeMana,housePrice,houseUpgrade,kingdomDaylight,kingdomStats,lastLandLevel,manaIcon,towerSkipCost,visitorSlots} from './kingdom-rules.js';
import {playerProgress} from './player-progression.js';
import {towerPlayerLevel} from './level-access.js';
import {rewardOrigin} from './reward-flight.js';

const readout=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
const amount=n=>n>=1e8?compact.format(n):readout.format(n);
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const towerName='Starter tower',houseName=buildingSpecs.house.name,forgeName=buildingSpecs.forge.name;
const coin='<img src="/assets/packs/coin.png" alt="">';
const star='<img src="/assets/gd-star.png" alt="">';
const mana='<img src="'+manaIcon+'" alt="">';
const gem='<img src="/assets/packs/gem.png" alt="">';
const upgradeControl='<div class="kingdom-upgrade"><strong data-upgrade-name></strong>'+
 '<div><button type="button" class="outline" data-upgrade-object></button><small data-upgrade-cost></small></div>'+
 '<small data-upgrade-status></small><progress aria-label="Upgrade progress" hidden></progress>'+
 '<button type="button" class="outline" data-skip-tower hidden></button></div>';
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
  (guest.visiting?'<button type="button" class="outline" data-visit="'+escape(guest.id)+'" aria-label="Inspect '+escape(guest.name)+'">Visiting</button>':'<span class="visitor-away">Away</span>')+'</article>';
}

export function createKingdom(root,sound,applyWallet,rewards){
 let wallet,world,ui,coins=0,cube,selection='tower',visit=0,pan=false,keys;
 let plot=kingdomStats(),visitors=[],plotSignature='',snap=true,build=null,placing=false,upgrading=false;
 let buildingKind='house',expanding=false,editing=false,ambience,visitorDue,refreshingVisitors=false;
 let clockOffset=0,finishing=false,finishRetryAt=0;
 const collecting=new Set();
 const clock=()=>Date.now()+clockOffset;
 const timeLeft=site=>Math.max(0,Math.ceil((site.endsAt-clock())/1000));
 const duration=seconds=>Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
 const timerText=site=>duration(timeLeft(site));
 const guestFor=id=>visitors.find(guest=>guest.visiting&&id==='visitor:'+guest.id);
 const treeFor=id=>plot.trees.find(tree=>id===tree.id);
 const buildingKey=building=>(building.kind||'house')+':'+building.id;
 const buildingFor=id=>plot.buildings.find(building=>buildingKey(building)===id);
 function nameOf(id){
  if(id==='tower')return towerName;
  if(id==='cube')return cube.name;
  if(id?.startsWith('mana:')){
   const forge=plot.forges.find(item=>item.id===id.slice(5));
   return forge?'Collect '+readout.format(forgeStored(forge,clock()))+' mana':null;
  }
  const tree=treeFor(id);
  if(tree)return tree.price<=200?'Small tree':tree.price>=500?'Large tree':'Tree';
  const building=buildingFor(id);
  return building?buildingSpecs[building.kind||'house'].name:guestFor(id)?.name;
 }
 const priceFor=kind=>kind==='forge'?forgePrice:plot.houseCost;
 const placementError=spot=>buildingPlacementError(plot.buildings.filter(item=>item.id!==build?.id),spot,plot.land.bounds,plot.trees);

 function upgradeOption(id){
  if(id==='tower'){
   const {level,limit,next,construction}=plot.tower,required=towerPlayerLevel(level+1);
   const unmet=playerProgress(wallet?.playerXp).level<required?'Lvl '+required+'+':
    plot.houses.length<limit?'Fill all '+limit+' house lots to upgrade.':'';
   return {level,construction,unmet,next:next&&{coins:next.price,mana:next.mana,buildMs:next.buildMs,benefit:next.limit+' house lots'}};
  }
  const building=buildingFor(id);
  if(!building)return null;
  const level=building.level===2?2:1;
  if(building.kind==='forge')return {level,construction:building.upgrade,unmet:plot.tower.level<forgeUpgrade.towerLevel?'Requires Tower Level 2.':'',next:level===1?{...forgeUpgrade,benefit:'3 Mana/s · 1,200 capacity'}:null};
  return {level,construction:building.upgrade,next:level===1?{...houseUpgrade,benefit:'+0.02 stars'}:null};
 }
 function upgradeProblem(option){
  if(option.unmet)return option.unmet;
  const short=[];
  if(coins<(option.next.coins||0))short.push(readout.format(option.next.coins-coins)+' coins');
  if(plot.mana<option.next.mana)short.push(readout.format(option.next.mana-plot.mana)+' Mana');
  return short.length?'Need '+short.join(' and ')+' more.':'';
 }
 function paintUpgrade(row,id,label=''){
  const option=upgradeOption(id);
  row.hidden=!wallet||!option;
  if(row.hidden)return;
  const {level,next,construction}=option,button=row.querySelector('button');
  const heading=row.querySelector('[data-upgrade-name]'),meter=row.querySelector('progress');
  heading.hidden=!label;
  heading.textContent=label&&label+' · Level '+level;
  button.hidden=!next||Boolean(construction);
  const cost=row.querySelector('[data-upgrade-cost]');
  cost.hidden=button.hidden;
  meter.hidden=!construction;
  const skip=row.querySelector('[data-skip-tower]'),costGems=id==='tower'?towerSkipCost(construction,clock()):0;
  skip.hidden=!costGems;
  if(costGems){
   skip.disabled=upgrading||wallet.gems<costGems;
   if(skip.dataset.cost!==String(costGems)){
    skip.dataset.cost=costGems;skip.innerHTML=gem+'Finish now · '+costGems+(costGems===1?' gem':' gems');
   }
  }
  let status='Fully upgraded',unmet='';
  if(construction){
   meter.max=(construction.endsAt-construction.startedAt)/1000;
   meter.value=Math.max(0,meter.max-timeLeft(construction));
   status='Level '+(level+1)+' under construction · '+timerText(construction);
  }else if(next){
   unmet=upgradeProblem(option);
   button.dataset.upgradeObject=id;
   button.disabled=Boolean(unmet||upgrading||expanding||placing);
   button.textContent='Upgrade to Level '+(level+1);
   button.setAttribute('aria-label','Upgrade '+nameOf(id)+' to Level '+(level+1));
   const price=[next.coins,next.mana,next.buildMs].join('/');
   if(cost.dataset.price!==price){
    cost.dataset.price=price;
    cost.innerHTML=(next.coins?'<span>'+coin+readout.format(next.coins)+' coins</span>':'')+
     '<span>'+mana+readout.format(next.mana)+' Mana</span>'+(next.buildMs?'<span>'+next.buildMs/1000+' s</span>':'');
   }
   status=unmet?next.benefit+' · '+unmet:next.benefit;
  }
  const note=row.querySelector('[data-upgrade-status]');
  note.textContent=status;
  note.classList.toggle('upgrade-unmet',Boolean(unmet));
 }
 function paintForge(){
  const forge=buildingFor(selection);
  ui.collectMana.hidden=true;
  if(forge?.kind!=='forge')return;
  const {stored,capacity,rate}=forgePlan(forge,clock());
  ui.description.textContent=readout.format(stored)+' / '+readout.format(capacity)+' Mana stored · '+rate+' Mana/s'+
   (stored===capacity?' · Full':stored<forgeMinimum?' · Collect at '+forgeMinimum:'');
  ui.collectMana.hidden=stored<forgeMinimum;
  ui.collectMana.disabled=collecting.has(forge.id);
  ui.collectMana.textContent='Collect '+readout.format(stored)+' mana';
  ui.collectMana.dataset.forge=forge.id;
 }

 function paintSelection(){
  if(!ui)return;
  const {houses,forges}=plot;
  const guest=guestFor(selection),building=buildingFor(selection),forge=building?.kind==='forge';
  const tower=selection==='tower',tree=treeFor(selection);
  ui.tower.setAttribute('aria-pressed',String(tower));
  ui.resident.setAttribute('aria-pressed',String(selection==='cube'));
  ui.lastHouse.hidden=!houses.length;
  ui.lastHouse.dataset.object=houses.length?'house:'+houses.at(-1).id:'';
  ui.lastHouse.setAttribute('aria-pressed',String(Boolean(building&&!forge)));
  ui.lastForge.hidden=!forges.length;
  ui.lastForge.dataset.object=forges.length?'forge:'+forges.at(-1).id:'';
  ui.lastForge.setAttribute('aria-pressed',String(forge));
  ui.name.textContent=nameOf(selection);
  const option=upgradeOption(selection);
  ui.state.textContent=option?'Level '+option.level:guest?guest.rarity+' visitor':tree?'Landscape':cube.rarity+' cube';
  ui.description.textContent=tower?houses.length+' / '+plot.tower.limit+' house lots used.'+(plot.tower.next?' Upgrade the tower for more space.':''):
   building?'Worth '+readout.format(building.price??housePrice)+' coins · +'+readout.format(option.level===2?.30+houseUpgrade.stars:.30)+' stars':
   guest?'Visits Kingdoms rated '+guest.stars+' stars or higher.':tree?'Clear this tree to free up its space.':'Your equipped cube roams the grounds.';
  ui.changeCube.hidden=selection!=='cube';
  ui.manage.hidden=!building;
  ui.move.disabled=ui.store.disabled=Boolean(build||editing||building?.upgrade||!world);
  ui.clearTree.hidden=!tree;
  if(tree){
   ui.clearTree.disabled=Boolean(build||editing||plot.mana<tree.price);
   ui.clearTree.innerHTML=mana+'Remove tree · '+tree.price+' Mana';
  }
  paintForge();
  paintUpgrade(ui.inspectUpgrade,selection);
 }
 function paintConstruction(){
  const site=plot.tower.construction;
  ui.towerProgress.hidden=!site;
  if(!site)return;
  ui.towerProgress.querySelector('strong').textContent='Tower Level '+(site.level??2);
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
  const visiting=visitors.filter(guest=>guest.visiting);
  ui.visitors.textContent='Visitors '+visiting.length+' here';
  ui.guestHint.textContent=plot.houses.length?'Visitors arrive on their own schedule. More stars attract rarer guests.':'Build a home to invite the first visitor.';
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
  world?.setPlot(buildings,visiting,plot.tower.level,plot.land.level,plot.tower.construction,plot.removedTrees);
  paintSelection();
  paintConstruction();
 }
 function setWallet(next){
  wallet=next;
  const wasBuilding=Boolean(plot.tower.construction);
  const pendingHouses=new Set(plot.houses.filter(house=>house.upgrade).map(house=>house.id));
  const pendingForges=new Set(plot.forges.filter(forge=>forge.upgrade).map(forge=>forge.id));
  const serverTime=next.kingdomClock??next.towerClock;
  if(Number.isFinite(serverTime))clockOffset=serverTime-Date.now();
  const equipped=equippedCube(wallet),changed=cube?.id!==equipped.id;
  cube=equipped;
  if(changed&&ui){
   ui.avatar.src=cube.icon;ui.residentName.textContent=cube.name;
   world?.setCube(cube);
   paintSelection();
  }
  plot=kingdomStats(wallet,clock());
  visitors=visitorsFrom(wallet);visitorDue=wallet.visitorRefreshAt;
  const signature=[plot.tower.level,plot.tower.construction?.endsAt,plot.land.level,
   ...plot.buildings.map(building=>[building.id,building.x,building.z,building.rotation,building.level,building.upgrade?.endsAt,building.collectedAt,building.storedMana].join('@')),
   ...plot.storage.map(item=>item.id),...plot.removedTrees,...visitors.map(guest=>guest.id+':'+guest.visiting)].join('/');
  if(signature!==plotSignature){
   plotSignature=signature;
   if((selection.startsWith('house:')||selection.startsWith('forge:'))&&!buildingFor(selection))selection='tower';
   if(selection.startsWith('visitor:')&&!guestFor(selection)||selection.startsWith('tree-')&&!treeFor(selection))selection='tower';
   paintPlot();world?.select(selection);
   if(build?.spot)build.error=placementError(build.spot);
  }
  if(ui){
   const ready=plot.houses.filter(house=>house.level===2&&pendingHouses.has(house.id)).length;
   if(wasBuilding&&!plot.tower.construction){
    announce('Tower Level '+plot.tower.level+' complete · '+plot.tower.limit+' house lots');
    sound.play('bonus',{level:.61});
   }else if(plot.forges.some(forge=>forge.level===2&&pendingForges.has(forge.id))){
    announce('Mana Forge Level 2 complete · 3 Mana/s');
    sound.play('bonus',{level:.61});
   }else if(ready){
    announce(ready===1?'GD House Level 2 complete · +0.02 stars':ready+' houses upgraded to Level 2');
    sound.play('bonus',{level:.61});
   }
  }
  paintStats();paintBuild();
 }
 function setCoins(amount){
  coins=amount;
  paintStats();paintBuild();
 }
 function announce(message){
  ui.kingdomNotice.textContent=message;
  ui.buildNotice.dataset.notice=message;
 }
 async function finishConstruction(){
  finishing=true;
  try{
   const {wallet:next}=await gameCommand('kingdom.construction.finish');
   applyWallet(next);
  }catch{finishRetryAt=Date.now()+5000}
  finally{finishing=false}
 }
 function paintDaylight(){
  const {night,remaining}=kingdomDaylight(clock());
  ui.daylight.dataset.night=String(night);
  ambience?.setNight(night);
  ui.daylightName.textContent=night?'Night':'Day';
  ui.daylightTime.textContent=duration(Math.ceil(remaining/1000));
  ui.daylightTime.setAttribute('aria-label','Until '+(night?'daybreak':'nightfall')+' '+ui.daylightTime.textContent);
 }
 async function refreshVisitors(){
  refreshingVisitors=true;
  const epoch=visit,prior=wallet;
  try{
   const {clock:serverTime,discoveredVisitors,visitorRefreshAt}=await gameRead('kingdom-visitors');
   if(epoch===visit&&prior===wallet)setWallet({...wallet,kingdomClock:serverTime,discoveredVisitors,visitorRefreshAt});
  }catch{visitorDue=clock()+6000;}
  finally{refreshingVisitors=false;}
 }
 function tick(){
  if(!ui)return;
  paintDaylight();
  if(selection.startsWith('forge:'))paintForge();
  paintConstruction();
  paintUpgrade(ui.inspectUpgrade,selection);
  if(ui.buildDialog.open)paintBuildMenu();
  const now=clock(),tower=wallet?.kingdom?.towerConstruction;
  if(visitorDue&&visitorDue<=now&&!refreshingVisitors)refreshVisitors();
  if(finishing||Date.now()<finishRetryAt)return;
  if(tower?.endsAt<=now||plot.buildings.some(item=>item.upgrade?.endsAt<=now))finishConstruction();
 }
 async function collectMana(id,point){
  const forge=plot.forges.find(item=>item.id===id);
  if(!ui||!forge||collecting.has(id)||forgeStored(forge,clock())<forgeMinimum||build)return;
  select('forge:'+id);collecting.add(id);paintForge();
  const origin=point||world?.manaOrigin(id)||rewardOrigin(ui.collectMana);
  const epoch=visit;
  try{
   const {wallet:next,result}=await gameCommand('kingdom.collect',{id});
   const ticket=epoch===visit?rewards.reserve('mana',result.earned):null;
   applyWallet(next);
   if(epoch!==visit)return;
   world?.popMana(id);sound.coinReward(false,[0]);
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
  const {houses,forges,tower,land,houseLots,storage}=plot,free=Math.max(0,tower.limit-houseLots),full=free===0;
  const storedKey=storage.map(item=>item.id).join('/');
  if(ui.storage.dataset.items!==storedKey){
   ui.storage.dataset.items=storedKey;
   ui.storage.innerHTML=storage.length?storage.map(item=>{
    const spec=buildingSpecs[item.kind||'house'];
    return '<div><span>'+spec.name+' · Level '+(item.level||1)+'</span><button type="button" class="outline" data-restore-building="'+escape(item.id)+'">Place back</button></div>';
   }).join(''):'<p>No stored buildings.</p>';
  }
  ui.storageCount.textContent=storage.length?' ('+storage.length+')':'';
  const suggestions=[];
  if(!houses.length)suggestions.push('Place a house to attract your first visitor.');
  if(tower.construction)suggestions.push('Tower Level '+tower.construction.level+' is under construction.');
  else if(tower.next&&houses.length>=tower.limit)suggestions.push('Upgrade the tower to open more house lots.');
  if(!forges.length)suggestions.push('Build a Mana Forge to start producing Mana.');
  else if(tower.level>=2&&forges.some(forge=>!forge.upgrade&&forge.level!==2))suggestions.push('Upgrade a Mana Forge to triple production.');
  if(houses.some(house=>!house.upgrade&&house.level!==2))suggestions.push('Upgrade a house for +0.02 Kingdom stars.');
  if(land.nextPrice!==null)suggestions.push('Expand the plot to open more building space.');
  if(ui.suggestions.dataset.key!==suggestions.join('/')){
   ui.suggestions.dataset.key=suggestions.join('/');
   ui.suggestions.innerHTML=(suggestions.length?suggestions:['Your Kingdom upgrades are complete.']).map(line=>'<li>'+escape(line)+'</li>').join('');
  }
  const house=buildingKind==='house',price=priceFor(buildingKind);
  const required=towerPlayerLevel(tower.level+1),playerLevel=playerProgress(wallet?.playerXp).level;
  const short=Math.max(0,price-coins);
  ui.limits.textContent=houseLots+' / '+tower.limit+' claimed';
  ui.available.textContent=free+' available';
  ui.lotMeter.max=tower.limit;
  ui.lotMeter.value=houseLots;
  ui.forgeCount.textContent=forges.length+' built';
  ui.price.textContent=readout.format(price)+' coins';
  ui.priceLine.hidden=house&&full&&!tower.next;
  ui.choose.disabled=!world||!wallet||upgrading||expanding||house&&full||short>0;
  const rows=[['tower',towerName],...(house?houses:forges).map((item,i)=>[buildingKey(item),nameOf(buildingKey(item))+' '+(i+1)])];
  const key=rows.map(([id])=>id).join('/');
  if(ui.buildUpgrades.dataset.rows!==key){
   ui.buildUpgrades.dataset.rows=key;
   ui.buildUpgrades.innerHTML=upgradeControl.repeat(rows.length);
  }
  rows.forEach(([id,label],i)=>paintUpgrade(ui.buildUpgrades.children[i],id,label));
  ui.landLevel.textContent='Level '+land.level+' / '+lastLandLevel+' · '+Number(land.size.toFixed(2))+'× starting area';
  ui.landUpgrade.hidden=land.nextPrice===null;
  ui.landUpgrade.disabled=expanding||upgrading||!wallet||coins<(land.nextPrice??Infinity);
  ui.landPrice.textContent=land.nextPrice===null?'':readout.format(land.nextPrice);
  let hint='';
  if(house&&full)hint=houses.length<tower.limit?'Place your stored houses to unlock the next tower upgrade.':!tower.next?'All house lots are full.':playerLevel<required?'Reach player Level '+required+' to expand your tower.':
   'Upgrade your tower to open '+(tower.next.limit-tower.limit)+' more house lots.';
  else if(short)hint='Need '+readout.format(short)+' more coins.';
  else if(!world)hint='The 3D plot is unavailable.';
  const notice=upgrading?'Starting upgrade…':expanding?'Expanding your plot…':ui.buildNotice.dataset.notice||hint;
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
  const buying=build?.mode==='new',full=buying&&build.kind==='house'&&plot.houseLots>=plot.tower.limit;
  ui.toolbar.classList.toggle('is-building',Boolean(build));
  ui.openBuild.hidden=Boolean(build);
  ui.openBuild.disabled=!wallet||(!world&&!ui.controls.hidden);
  ui.editTools.hidden=!build;
  ui.place.hidden=!build?.locked;
  const short=build?Math.max(0,build.cost-coins):0,priceChanged=Boolean(buying&&build.cost!==priceFor(build.kind));
  ui.place.disabled=placing||Boolean(build?.error)||short>0||full||priceChanged;
  ui.cancel.disabled=placing;
  ui.rotate.disabled=placing;
  ui.snap.disabled=placing;
  ui.snap.setAttribute('aria-pressed',String(snap));
  ui.snap.textContent=snap?'Snap on':'Snap off';
  ui.canvas.dataset.locked=String(Boolean(build?.locked));
  if(build){
   ui.placementPrice.textContent=buying?readout.format(build.cost)+' coins':'Free placement';
   const problem=full?'The tower’s house lots are full.':priceChanged?'The price changed. Reopen Build Mode to review it.':build.error;
   const instruction=placing?'Placing building…':problem||(build.locked?
    (short?'Need '+readout.format(short)+' more coins.':'Position locked. Confirm to place.'):
    'Click or tap an open spot to lock the position.');
   if(ui.status.textContent!==instruction)ui.status.textContent=instruction;
   ui.status.classList.toggle('invalid',Boolean(problem||build.locked&&short));
  }
  if(ui.buildDialog.open)paintBuildMenu();
  paintUpgrade(ui.inspectUpgrade,selection);
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
 function startBuild(mode='new',item){
  const kind=item?(item.kind||'house'):buildingKind,cost=mode==='new'?priceFor(kind):0;
  if(!wallet||!world||placing||upgrading||expanding||editing||item?.upgrade||
    mode==='new'&&kind==='house'&&plot.houseLots>=plot.tower.limit||coins<cost)return;
  if(ui.buildDialog.open)ui.buildDialog.close();
  build={mode,id:item?.id,kind,cost,rotation:item?.rotation||0,point:null,spot:null,locked:false,error:''};
  ui.placementName.textContent=(mode==='move'?'Move ':mode==='restore'?'Place ':'')+buildingSpecs[kind].name;
  pan=false;setPan();paintBuild();
  ui.canvas.scrollIntoView({block:'nearest'});ui.canvas.focus({preventScroll:true});
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
  if(!build?.locked||build.error||placing)return;
  const {kind,mode,id,cost}=build,buying=mode==='new';
  if(buying&&(cost!==priceFor(kind)||coins<cost||kind==='house'&&plot.houseLots>=plot.tower.limit))return;
  const epoch=visit,spot={...build.spot,expectedPrice:cost,id,mode};
  placing=true;paintBuild();
  try{
   const {wallet:next,result}=await gameCommand(buying?'kingdom.'+kind:'kingdom.building.place',spot);
   applyWallet(next);
   if(epoch!==visit)return;
   build=null;placing=false;
   select(kind+':'+(buying?result[kind]:result.building).id);
   if(buying&&kind==='forge')announce('+'+forgeWelcomeMana+' mana from your new forge');
   else if(!buying)announce(mode==='move'?'Building moved.':'Stored building placed.');
   sound.play('buy',{level:.74});
  }catch(error){
   if(epoch!==visit)return;
   build.locked=false;build.error=error.message;
  }finally{if(epoch===visit){placing=false;paintBuild()}}
 }
 async function editPlot(action,id){
  if(!id||editing||build)return;
  const epoch=visit;
  editing=true;paintSelection();
  try{
   const {wallet:next}=await gameCommand(action,{id});
   applyWallet(next);
   if(epoch!==visit)return;
   select('tower');
   announce(action==='kingdom.tree.clear'?'Tree cleared.':'Building stored. You can place it again in Build Mode.');
   sound.play('buy',{level:.62});
  }catch(error){if(epoch===visit)announce(error.message);}
  finally{if(epoch===visit){editing=false;paintSelection();}}
 }
 async function finishTowerNow(){
  if(upgrading||!wallet)return;
  const maxGems=towerSkipCost(plot.tower.construction,clock());
  if(!maxGems||wallet.gems<maxGems)return;
  upgrading=true;paintBuild();
  const epoch=visit;
  try{
   const {wallet:next,result}=await gameCommand('kingdom.tower.skip',{maxGems});
   applyWallet(next);
   if(epoch===visit)announce('Tower Level '+result.tower.level+' complete'+(result.tower.gems?' · '+result.tower.gems+' gems used':''));
  }catch(error){if(epoch===visit)announce(error.message);}
  finally{if(epoch===visit){upgrading=false;paintBuild();}}
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
 async function improveBuilding(id){
  const option=upgradeOption(id);
  if(!wallet||upgrading||expanding||placing||!option?.next||option.construction||upgradeProblem(option))return;
  const kind=id==='tower'?'tower':buildingFor(id).kind||'house';
  const action=kind==='tower'?'kingdom.tower':'kingdom.'+kind+'.upgrade';
  delete ui.buildNotice.dataset.notice;
  upgrading=true;paintBuild();
  const epoch=visit;
  try{
   const {wallet:next,result}=await gameCommand(action,{id:buildingFor(id)?.id,level:option.level});
   applyWallet(next);
   if(epoch!==visit)return;
   select(id);sound.play('buy',{level:.74});
   const {level,construction}=result[kind];
   announce(nameOf(id)+' Level '+level+(construction?' construction started':' complete · '+option.next.benefit));
  }catch(error){
   if(epoch===visit)announce(error.message);
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
   '<div class="kingdom-plot-stats"><span>'+ico('tower')+'<b data-plot-buildings>1 building</b></span><span>'+ico('box')+'1 resident</span>'+
   '<span class="kingdom-daylight"><i aria-hidden="true"></i><b data-daylight-name>Day</b> <time>6:00</time></span></div>'+
   '<div class="tower-construction-meter" data-tower-progress hidden><div><strong>Tower Level 2</strong><b data-tower-countdown>1:00</b></div>'+
   '<progress aria-label="Tower construction progress" max="60" value="0"></progress></div>'+
   '<div class="kingdom-hover" aria-hidden="true" hidden></div>'+
   '<div class="kingdom-controls"><span id="kingdomControls">Drag to orbit · Scroll or pinch to zoom</span><div role="group" aria-label="Camera controls">'+
   cameraButton('pan','pan','Pan camera')+cameraButton('out','zoomOut','Zoom out')+cameraButton('in','zoomIn','Zoom in')+
   cameraButton('reset','aim','Reset camera')+cameraButton('ambient','volume','Kingdom ambience')+'</div></div></div>'+
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
   '<div class="kingdom-detail"><div><h2></h2><span data-plot-state></span></div><p></p>'+
   '<a href="#gacha/cubes" data-change-cube hidden>Change cube '+ico('right')+'</a>'+
   '<button class="outline mana-claim" type="button" data-collect-mana hidden></button>'+upgradeControl+
   '<div class="kingdom-manage" data-manage-building hidden><button class="outline" type="button" data-move-building>Move building</button>'+
   '<button class="outline" type="button" data-store-building>Store building</button></div>'+
   '<button class="outline" type="button" data-clear-tree hidden></button>'+
   '<p class="kingdom-notice" data-kingdom-notice role="status"></p></div></section>'+
   '<dl class="kingdom-stats" aria-label="Player stats"><div><dt>'+coin+'Coins</dt><dd data-plot-coins></dd></div>'+
   '<div><dt><img src="/assets/packs/gem.png" alt="">Gems</dt><dd data-plot-gems></dd></div>'+
   '<div><dt>'+ico('battle')+'Campaign clears</dt><dd data-plot-clears></dd></div></dl></div>'+
   '<dialog class="kingdom-guest-index" aria-labelledby="guestTitle"><div class="guest-index-heading"><h2 id="guestTitle">Visitor index</h2>'+
   '<button type="button" class="iconbtn" data-close-visitors aria-label="Close visitor index">'+ico('x')+'</button></div>'+
   '<div class="visitor-collection"><b data-visitor-count></b><progress aria-label="Visitors discovered" max="'+visitorSlots.length+'" value="0"></progress></div>'+
   '<p data-guest-hint></p><div class="visitor-list" data-visitor-rows></div></dialog>'+
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
   '<details class="build-storage"><summary>Stored buildings<span data-storage-count></span></summary><div data-build-storage></div></details>'+
   '<details class="build-storage"><summary>Suggested upgrades</summary><ul data-suggestions></ul></details>'+
   '<section class="build-upgrades" aria-labelledby="buildUpgradesTitle"><h3 id="buildUpgradesTitle">Building upgrades</h3><div data-build-upgrades></div></section>'+
   '<div class="land-expansion"><div><strong>Land expansion</strong><small data-land-level></small></div>'+
   '<button type="button" class="outline" data-expand-land>Expand +25% <span>'+coin+'<b data-land-price></b></span></button></div>'+
   '<div class="build-menu-footer"><p data-build-notice role="status"></p></div></dialog>';
  const get=selector=>root.querySelector(selector);
  ui={
   canvas:get('.kingdom-frame canvas'),loading:get('.kingdom-loading'),hover:get('.kingdom-hover'),
   controls:get('.kingdom-controls'),instructions:get('#kingdomControls'),
   towerProgress:get('[data-tower-progress]'),towerCountdown:get('[data-tower-countdown]'),towerMeter:get('[data-tower-progress] progress'),
   daylight:get('.kingdom-daylight'),daylightName:get('[data-daylight-name]'),daylightTime:get('.kingdom-daylight time'),
   ambient:get('[data-camera="ambient"]'),guestHint:get('[data-guest-hint]'),
   manage:get('[data-manage-building]'),move:get('[data-move-building]'),store:get('[data-store-building]'),clearTree:get('[data-clear-tree]'),
   storage:get('[data-build-storage]'),storageCount:get('[data-storage-count]'),suggestions:get('[data-suggestions]'),
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
   inspectUpgrade:get('.kingdom-detail .kingdom-upgrade'),buildUpgrades:get('[data-build-upgrades]'),
   openBuild:get('[data-build="start"]'),cancel:get('[data-build="cancel"]'),rotate:get('[data-build="rotate"]'),
   snap:get('[data-build="snap"]'),place:get('[data-build="place"]'),
   visitors:get('[data-visitor-index]'),guestDialog:get('.kingdom-guest-index'),guestRows:get('[data-visitor-rows]'),
   discoveries:get('[data-visitor-count]'),indexProgress:get('.visitor-collection progress')
  };
  ui.avatar.src=cube.icon;ui.residentName.textContent=cube.name;
  ambience=kingdomAmbience(sound,ui.canvas);ui.ambient.setAttribute('aria-pressed',String(!ambience.muted));
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
   if(button.dataset.restoreBuilding){startBuild('restore',plot.storage.find(item=>item.id===button.dataset.restoreBuilding));return}
   if(button===ui.move){startBuild('move',buildingFor(selection));return}
   if(button===ui.store){editPlot('kingdom.building.store',buildingFor(selection)?.id);return}
   if(button===ui.clearTree){editPlot('kingdom.tree.clear',treeFor(selection)?.id);return}
   if(button.hasAttribute('data-skip-tower')){finishTowerNow();return}
   if(button===ui.ambient){
    ambience.toggle();ui.ambient.setAttribute('aria-pressed',String(!ambience.muted));
    ui.ambient.innerHTML=ico(ambience.muted?'muted':'volume');return;
   }
   if(button.dataset.upgradeObject){improveBuilding(button.dataset.upgradeObject);return}
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
  pan=false;setPan();paintPlot();paintStats();paintBuild();paintDaylight();
 }
 async function show(on){
  if(!on){
   if(root.hidden)return;
   root.hidden=true;visit++;
   keys?.abort();ambience?.dispose();ambience=null;editing=false;world?.dispose();world=null;ui=null;build=null;placing=false;upgrading=false;expanding=false;root.replaceChildren();
   return;
  }
  if(!root.hidden)return;
  root.hidden=false;
  setUp();
  const route=++visit;
  try{
   const {createKingdomWorld}=await import('/kingdom-world.js');
   if(visit!==route)return;
   world=createKingdomWorld({canvas:ui.canvas,cube,clock,onSelect:id=>{
    select(id);
    if(upgradeOption(id)||treeFor(id))ui.name.scrollIntoView({block:'nearest'});
   },onHover:hover,onPlot:pointOnPlot,onCollect:collectMana});
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
