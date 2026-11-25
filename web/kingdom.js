import {equippedCube} from './cube-catalog.js';
import {campaignStages} from './campaign.js';
import {ico} from './icons.js';

const readout=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const towerName='Starter tower';
const cameraButton=(action,icon,label)=>'<button type="button" data-camera="'+action+'" title="'+label+'" aria-label="'+label+'">'+ico(icon)+'</button>';

export function createKingdom(root,sound){
 let wallet,world,ui,coins=0,cube,selection='tower',visit=0,pan=false;
 const nameOf=id=>id==='tower'?towerName:cube.name;

 function paintSelection(){
  if(!ui)return;
  const tower=selection==='tower';
  ui.tower.setAttribute('aria-pressed',String(tower));
  ui.resident.setAttribute('aria-pressed',String(!tower));
  ui.name.textContent=nameOf(selection);
  ui.state.textContent=tower?'Level 1':cube.rarity+' cube';
  ui.description.textContent=tower?'Your first building, ready from the moment you arrive.':'Your equipped cube roams the grounds.';
  ui.changeCube.hidden=tower;
 }
 function select(id){
  if(id!==selection){sound.play('inspect',{level:.44});selection=id}
  world?.select(id);
  paintSelection();
 }
 function hover(id,point){
  ui.hover.hidden=!id;
  if(!id)return;
  ui.hover.textContent=nameOf(id);
  ui.hover.style.left=Math.min(ui.canvas.clientWidth-64,Math.max(64,point.x))+'px';
  ui.hover.style.top=Math.max(34,point.y)+'px';
 }
 function paintStats(){
  if(!ui)return;
  ui.coins.textContent=wallet?readout.format(coins):'…';
  ui.gems.textContent=wallet?readout.format(wallet.gems):'…';
  ui.clears.textContent=wallet?Object.keys(wallet.campaign||{}).length+' / '+campaignStages.length:'…';
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
  paintStats();
 }
 function setCoins(amount){coins=amount;paintStats()}
 function reset(){
  world?.reset();
  pan=false;setPan();
 }
 function setPan(){
  ui.pan.setAttribute('aria-pressed',String(pan));
  ui.instructions.textContent=(pan?'Drag to pan':'Drag to orbit')+' · Scroll or pinch to zoom';
  world?.panMode(pan);
 }
 function setUp(){
  cube=equippedCube(wallet);
  root.innerHTML='<div class="kingdom-heading"><h1>Your Kingdom</h1></div>'+
   '<div class="kingdom-frame" aria-label="Your 3D Kingdom"><canvas tabindex="0" aria-label="Kingdom plot" aria-describedby="kingdomControls"></canvas>'+
   '<p class="kingdom-loading" role="status">Loading your Kingdom…</p>'+
   '<div class="kingdom-plot-stats"><span>'+ico('tower')+'1 building</span><span>'+ico('box')+'1 resident</span></div>'+
   '<div class="kingdom-hover" aria-hidden="true" hidden></div>'+
   '<div class="kingdom-controls"><span id="kingdomControls">Drag to orbit · Scroll or pinch to zoom</span><div role="group" aria-label="Camera controls">'+
   cameraButton('pan','pan','Pan camera')+cameraButton('out','zoomOut','Zoom out')+cameraButton('in','zoomIn','Zoom in')+
   cameraButton('reset','aim','Reset camera')+'</div></div></div>'+
   '<div class="kingdom-dashboard"><section class="kingdom-inspector" aria-label="Inspect your plot"><div class="kingdom-objects" role="group" aria-label="Select an object">'+
   '<button type="button" data-object="tower">'+ico('tower')+towerName+'</button>'+
   '<button type="button" data-object="cube"><img alt="" data-resident-avatar><span data-resident-name></span></button></div>'+
   '<div class="kingdom-detail" aria-live="polite"><div><h2></h2><span data-plot-state></span></div><p></p>'+
   '<a href="#gacha/cubes" data-change-cube hidden>Change cube '+ico('right')+'</a></div></section>'+
   '<dl class="kingdom-stats" aria-label="Player stats"><div><dt><img src="/assets/packs/coin.png" alt="">Coins</dt><dd data-plot-coins></dd></div>'+
   '<div><dt><img src="/assets/packs/gem.png" alt="">Gems</dt><dd data-plot-gems></dd></div>'+
   '<div><dt>'+ico('battle')+'Campaign clears</dt><dd data-plot-clears></dd></div></dl></div>';
  const get=selector=>root.querySelector(selector);
  ui={
   canvas:get('canvas'),loading:get('.kingdom-loading'),hover:get('.kingdom-hover'),
   controls:get('.kingdom-controls'),instructions:get('#kingdomControls'),
   pan:get('[data-camera="pan"]'),tower:get('[data-object="tower"]'),resident:get('[data-object="cube"]'),
   avatar:get('[data-resident-avatar]'),residentName:get('[data-resident-name]'),
   name:get('.kingdom-detail h2'),state:get('[data-plot-state]'),description:get('.kingdom-detail p'),changeCube:get('[data-change-cube]'),
   coins:get('[data-plot-coins]'),gems:get('[data-plot-gems]'),clears:get('[data-plot-clears]')
  };
  ui.avatar.src=cube.icon;ui.residentName.textContent=cube.name;
  root.onclick=event=>{
   const button=event.target.closest('button');
   if(!button)return;
   if(button.dataset.object){select(button.dataset.object);return}
   if(!world)return;
   const action=button.dataset.camera;
   if(action==='pan'){pan=!pan;setPan();return}
   if(action==='reset'){reset();return}
   if(action==='in'||action==='out')world.zoom(action==='in'?.79:1.26);
  };
  pan=false;setPan();paintSelection();paintStats();
 }
 async function show(on){
  if(!on){
   root.hidden=true;visit++;
   world?.dispose();world=null;ui=null;root.replaceChildren();
   return;
  }
  if(!root.hidden)return;
  root.hidden=false;
  setUp();
  const route=++visit;
  try{
   const {createKingdomWorld}=await import('/kingdom-world.js');
   if(visit!==route)return;
   world=createKingdomWorld({canvas:ui.canvas,cube,onSelect:select,onHover:hover});
   world.select(selection);
   ui.loading.hidden=true;
  }catch{
   if(visit!==route)return;
   ui.loading.textContent='The 3D view could not start. You can still inspect your tower and cube below.';
   ui.controls.hidden=true;
   ui.canvas.tabIndex=-1;
  }
 }
 return {show,setWallet,setCoins};
}
