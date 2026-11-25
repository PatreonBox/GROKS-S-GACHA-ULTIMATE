import {cubeCatalog,cubeRarities,equippedCube} from './cube-catalog.js';
import {campaignStages} from './campaign.js';
import {ico} from './icons.js';
import {gameCommand} from './game-client.js';
import {housePrice,housePlacementError,kingdomStats,visitorSlots} from './kingdom-rules.js';
import {playerProgress} from './player-progression.js';
import {towerPlayerLevel} from './level-access.js';
import {setLevelLock} from './level-lock.js';

const readout=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
const amount=n=>n>=1e8?compact.format(n):readout.format(n);
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const towerName='Starter tower',houseName='GD House';
const coin='<img src="/assets/packs/coin.png" alt="">';
const star='<img src="/assets/gd-star.png" alt="">';
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

export function createKingdom(root,sound,applyWallet){
 let wallet,world,ui,coins=0,cube,selection='tower',visit=0,pan=false,keys;
 let plot=kingdomStats(),visitors=[],plotSignature='',snap=true,build=null,placing=false,upgrading=false;
 const guestFor=id=>visitors.find(guest=>id==='visitor:'+guest.id);
 const nameOf=id=>id==='tower'?towerName:id==='cube'?cube.name:id?.startsWith('house:')?houseName:guestFor(id)?.name;

 function paintSelection(){
  if(!ui)return;
  const {houses}=plot;
  const guest=guestFor(selection),house=houses.find(item=>selection==='house:'+item.id);
  const tower=selection==='tower';
  ui.tower.setAttribute('aria-pressed',String(tower));
  ui.resident.setAttribute('aria-pressed',String(selection==='cube'));
  ui.lastHouse.hidden=!houses.length;
  ui.lastHouse.dataset.object=houses.length?'house:'+houses.at(-1).id:'';
  ui.lastHouse.setAttribute('aria-pressed',String(Boolean(house)));
  ui.name.textContent=nameOf(selection);
  ui.state.textContent=tower?'Level '+plot.tower.level:house?'Home':guest?guest.rarity+' visitor':cube.rarity+' cube';
  ui.description.textContent=tower?houses.length+' / '+plot.tower.limit+' house lots used.'+(plot.tower.next?' Upgrade the tower for more space.':''):
   house?'Worth '+readout.format(house.price??housePrice)+' coins and adds 0.3 stars.':
   guest?'Visits Kingdoms rated '+guest.stars+' stars or higher.':'Your equipped cube roams the grounds.';
  ui.changeCube.hidden=selection!=='cube';
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
  ui.clears.textContent=wallet?Object.keys(wallet.campaign||{}).length+' / '+campaignStages.length:'…';
 }
 function paintPlot(){
  if(!ui)return;
  const {houses,stars,value}=plot;
  ui.value.textContent=amount(value);
  ui.value.title=readout.format(value)+' coins';
  ui.starValue.textContent=readout.format(stars)+' / 5';
  ui.stars.setAttribute('aria-label',stars+' out of 5 stars');
  ui.starFills.forEach((fill,i)=>fill.style.width=Math.max(0,Math.min(100,Math.round((stars-i)*100)))+'%');
  ui.buildings.textContent=(houses.length+1)+' '+(houses.length?'buildings':'building');
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
  world?.setPlot(houses,visitors,plot.tower.level);
  paintSelection();
 }
 function setWallet(next){
  wallet=next;
  const equipped=equippedCube(wallet),changed=cube?.id!==equipped.id;
  cube=equipped;
  if(changed&&ui){
   ui.avatar.src=cube.icon;ui.residentName.textContent=cube.name;
   world?.setCube(cube);
   paintSelection();
  }
  plot=kingdomStats(wallet);
  visitors=visitorsFrom(wallet);
  const signature=[plot.tower.level,...plot.houses.map(house=>house.id),...visitors.map(guest=>guest.id)].join('/');
  if(signature!==plotSignature){
   plotSignature=signature;
   if(selection.startsWith('house:')&&!plot.houses.some(house=>'house:'+house.id===selection))selection='tower';
   if(selection.startsWith('visitor:')&&!guestFor(selection))selection='tower';
   paintPlot();world?.select(selection);
   if(build?.spot)build.error=housePlacementError(plot.houses,build.spot);
  }
  paintStats();paintBuild();
 }
 function setCoins(amount){
  coins=amount;
  paintStats();paintBuild();
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
  const spot={x:Math.round(point.x*step)/step,z:Math.round(point.z*step)/step,rotation:build.rotation};
  build.spot=spot;
  build.error=housePlacementError(plot.houses,spot);
 }
 function paintBuildMenu(){
  const {houses,tower,houseCost}=plot,free=Math.max(0,tower.limit-houses.length),full=free===0;
  const required=towerPlayerLevel(tower.level+1),playerLevel=playerProgress(wallet?.playerXp).level;
  const short=Math.max(0,houseCost-coins);
  ui.limits.textContent=houses.length+' / '+tower.limit+' used';
  ui.available.textContent=free+' available';
  ui.lotMeter.max=tower.limit;
  ui.lotMeter.value=houses.length;
  ui.price.textContent=readout.format(houseCost)+' coins';
  ui.priceLine.hidden=full&&!tower.next;
  ui.choose.disabled=!world||!wallet||upgrading||full||short>0;
  ui.upgrade.hidden=!full||!tower.next;
  if(tower.next){
   setLevelLock(ui.upgrade,required,playerLevel);
   ui.upgrade.disabled=upgrading||!wallet||coins<tower.next.price;
   ui.towerGate.textContent='Lvl '+required+'+';
   ui.upgradePrice.textContent=readout.format(tower.next.price);
   ui.upgrade.title='Upgrade to Level '+(tower.level+1)+' for '+tower.next.limit+' house lots';
  }
  let hint='';
  if(full)hint=!tower.next?'All house lots are full.':playerLevel<required?'Reach player Level '+required+' to expand your tower.':
   'Upgrade your tower to open '+(tower.next.limit-tower.limit)+' more house lots.';
  else if(short)hint='Need '+readout.format(short)+' more coins.';
  else if(!world)hint='The 3D plot is unavailable.';
  const notice=upgrading?'Upgrading tower…':ui.buildNotice.dataset.notice||hint;
  if(ui.buildNotice.textContent!==notice)ui.buildNotice.textContent=notice;
 }
 function openBuildMenu(){
  if(!wallet||build||ui.buildDialog.open)return;
  delete ui.buildNotice.dataset.notice;
  ui.buildDialog.showModal();
  paintBuildMenu();
  ui.previewStatus.hidden=false;
  try{
   if(world){
    world.setHousePreview(ui.preview);
    ui.previewStatus.hidden=true;
   }
  }catch{
   ui.previewStatus.hidden=false;
  }
 }
 function paintBuild(){
  if(!ui)return;
  const {houses,tower,houseCost}=plot,full=houses.length>=tower.limit;
  ui.toolbar.classList.toggle('is-building',Boolean(build));
  ui.openBuild.hidden=Boolean(build);
  ui.openBuild.disabled=!wallet||(!world&&!ui.controls.hidden);
  ui.editTools.hidden=!build;
  ui.place.hidden=!build?.locked;
  const short=Math.max(0,(build?.cost??houseCost)-coins),priceChanged=Boolean(build&&build.cost!==houseCost);
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
   const instruction=placing?'Building your house…':problem||(build.locked?
    (short?'Need '+readout.format(short)+' more coins.':'Position locked. Confirm to build.'):
    'Click or tap an open spot to lock the house.');
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
  if(!wallet||!world||placing||upgrading||plot.houses.length>=plot.tower.limit||coins<plot.houseCost)return;
  ui.buildDialog.close();
  build={cost:plot.houseCost,rotation:0,point:null,spot:null,locked:false,error:''};
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
  if(!build?.locked||build.error||placing||build.cost!==plot.houseCost||coins<build.cost||plot.houses.length>=plot.tower.limit)return;
  const epoch=visit,spot={...build.spot,expectedPrice:build.cost};
  placing=true;paintBuild();
  try{
   const {wallet:next,result}=await gameCommand('kingdom.house',spot);
   applyWallet(next);
   if(epoch!==visit)return;
   build=null;placing=false;
   select('house:'+result.house.id);
   sound.play('buy',{level:.74});
  }catch(error){
   if(epoch!==visit)return;
   // Keep the house preview available so the player can adjust it.
   build.locked=false;
   build.error=error.message;
  }finally{
   if(epoch===visit){placing=false;paintBuild()}
  }
 }
 async function improveTower(){
  const {tower,houses}=plot;
  if(upgrading||!tower.next||houses.length<tower.limit||coins<tower.next.price||
   playerProgress(wallet?.playerXp).level<towerPlayerLevel(tower.level+1))return;
  delete ui.buildNotice.dataset.notice;
  upgrading=true;paintBuild();
  const epoch=visit;
  try{
   const {wallet:next,result}=await gameCommand('kingdom.tower',{level:tower.level});
   applyWallet(next);
   if(epoch!==visit)return;
   ui.buildNotice.dataset.notice='Tower Level '+result.tower.level+' · '+result.tower.limit+' house lots';
   select('tower');sound.play('buy',{level:.74});
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
   '</span><b data-plot-rating>0 / 5</b></span></div></div>'+
   '<div class="kingdom-frame" aria-label="Your 3D Kingdom"><canvas tabindex="0" aria-label="Kingdom plot" aria-describedby="kingdomControls"></canvas>'+
   '<p class="kingdom-loading" role="status">Loading your Kingdom…</p>'+
   '<div class="kingdom-plot-stats"><span>'+ico('tower')+'<b data-plot-buildings>1 building</b></span><span>'+ico('box')+'1 resident</span></div>'+
   '<div class="kingdom-hover" aria-hidden="true" hidden></div>'+
   '<div class="kingdom-controls"><span id="kingdomControls">Drag to orbit · Scroll or pinch to zoom</span><div role="group" aria-label="Camera controls">'+
   cameraButton('pan','pan','Pan camera')+cameraButton('out','zoomOut','Zoom out')+cameraButton('in','zoomIn','Zoom in')+
   cameraButton('reset','aim','Reset camera')+'</div></div></div>'+
   '<div class="kingdom-builder"><button type="button" class="primary" data-build="start" aria-haspopup="dialog" disabled>'+ico('tower')+'Build Mode</button>'+
   '<div data-build-tools hidden><div class="kingdom-placement-copy"><strong>'+houseName+'</strong>'+
   '<span>'+coin+'<b data-placement-price></b></span><p data-build-status role="status"></p></div>'+
   '<div class="kingdom-build-controls"><button type="button" class="outline" data-build="snap" aria-pressed="true">Snap on</button>'+
   '<button type="button" class="outline" data-build="rotate">Rotate <kbd>R</kbd></button>'+
   '<button type="button" class="outline" data-build="cancel">Cancel <kbd>Q</kbd></button>'+
   '<button type="button" class="primary" data-build="place" hidden>Place <kbd>E</kbd></button></div></div></div>'+
   '<div class="kingdom-dashboard"><section class="kingdom-inspector" aria-label="Inspect your plot"><div class="kingdom-objects" role="group" aria-label="Select an object">'+
   '<button type="button" data-object="tower">'+ico('tower')+towerName+'</button>'+
   '<button type="button" data-object="cube"><img alt="" data-resident-avatar><span data-resident-name></span></button>'+
   '<button type="button" data-last-house hidden>'+houseName+'</button>'+
   '<button type="button" data-visitor-index aria-haspopup="dialog">Visitors 0 / '+visitorSlots.length+'</button></div>'+
   '<div class="kingdom-detail" aria-live="polite"><div><h2></h2><span data-plot-state></span></div><p></p>'+
   '<a href="#gacha/cubes" data-change-cube hidden>Change cube '+ico('right')+'</a></div></section>'+
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
   '<article class="build-option"><div class="build-viewport"><canvas tabindex="0" aria-label="GD House 3D preview" aria-describedby="housePreviewControls"></canvas>'+
   '<p data-preview-status role="status" hidden>3D preview unavailable.</p>'+
   '<span id="housePreviewControls">Drag or use arrow keys to rotate</span></div>'+
   '<div class="build-option-info"><h3>'+houseName+'</h3><span class="build-rating">'+star+'+0.3 stars</span>'+
   '<small class="build-price" data-house-price-line>'+coin+'<b data-house-price></b></small>'+
   '<button class="primary" type="button" data-build="choose">Build GD House</button></div></article>'+
   '<div class="build-menu-footer"><p data-build-notice role="status"></p>'+
   '<button type="button" class="outline tower-upgrade" data-tower-upgrade hidden>Upgrade tower <span>'+coin+'<b data-tower-cost></b></span>'+
   '<small class="level-lock" data-level-badge hidden>'+ico('lock')+'<b data-tower-gate></b></small></button></div></dialog>';
  const get=selector=>root.querySelector(selector);
  ui={
   canvas:get('.kingdom-frame canvas'),loading:get('.kingdom-loading'),hover:get('.kingdom-hover'),
   controls:get('.kingdom-controls'),instructions:get('#kingdomControls'),
   pan:get('[data-camera="pan"]'),tower:get('[data-object="tower"]'),resident:get('[data-object="cube"]'),lastHouse:get('[data-last-house]'),
   avatar:get('[data-resident-avatar]'),residentName:get('[data-resident-name]'),
   name:get('.kingdom-detail h2'),state:get('[data-plot-state]'),description:get('.kingdom-detail p'),changeCube:get('[data-change-cube]'),
   coins:get('[data-plot-coins]'),gems:get('[data-plot-gems]'),clears:get('[data-plot-clears]'),
   value:get('[data-plot-value]'),buildings:get('[data-plot-buildings]'),starValue:get('[data-plot-rating]'),
   stars:get('.kingdom-stars'),starFills:[...root.querySelectorAll('.kingdom-stars i')],
   toolbar:get('.kingdom-builder'),status:get('[data-build-status]'),editTools:get('[data-build-tools]'),
   buildDialog:get('.kingdom-build-menu'),preview:get('.build-viewport canvas'),previewStatus:get('[data-preview-status]'),
   buildNotice:get('[data-build-notice]'),choose:get('[data-build="choose"]'),
   price:get('[data-house-price]'),priceLine:get('[data-house-price-line]'),placementPrice:get('[data-placement-price]'),
   limits:get('[data-house-lots]'),available:get('[data-lots-available]'),lotMeter:get('[data-lot-meter]'),
   upgrade:get('[data-tower-upgrade]'),upgradePrice:get('[data-tower-cost]'),towerGate:get('[data-tower-gate]'),
   openBuild:get('[data-build="start"]'),cancel:get('[data-build="cancel"]'),rotate:get('[data-build="rotate"]'),
   snap:get('[data-build="snap"]'),place:get('[data-build="place"]'),
   visitors:get('[data-visitor-index]'),guestDialog:get('.kingdom-guest-index'),guestRows:get('[data-visitor-rows]'),
   discoveries:get('[data-visitor-count]'),indexProgress:get('.visitor-collection progress')
  };
  ui.avatar.src=cube.icon;ui.residentName.textContent=cube.name;
  const buildMenu=ui.buildDialog;
  buildMenu.addEventListener('close',()=>{
   if(ui?.buildDialog===buildMenu&&!buildMenu.open)world?.setHousePreview(null);
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
   if(button===ui.choose){startBuild();return}
   if(button===ui.upgrade){improveTower();return}
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
   keys?.abort();world?.dispose();world=null;ui=null;build=null;placing=false;upgrading=false;root.replaceChildren();
   return;
  }
  if(!root.hidden)return;
  root.hidden=false;
  setUp();
  const route=++visit;
  try{
   const {createKingdomWorld}=await import('/kingdom-world.js');
   if(visit!==route)return;
   world=createKingdomWorld({canvas:ui.canvas,cube,onSelect:select,onHover:hover,onPlot:pointOnPlot});
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
 return {show,setWallet,setCoins};
}
