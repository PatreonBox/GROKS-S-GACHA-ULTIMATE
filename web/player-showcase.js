import {bindTurntable,cardFace,cardBackMark} from './pack-model.js';
import {finishLabels} from './card-finishes.js';
import {impossibleCover} from './impossible-cards.js';
import {moveArt} from './combat-arts.js';
import {cubeCatalog,equippedCube} from './cube-catalog.js';
import {ico} from './icons.js';
import {buildingSpecs,forgePlan,gemMine,houseStars,kingdomDaylight} from './kingdom-rules.js';
import {spikeKind,spikePlan} from './kingdom-defences.js';
import {cardRarity,displayCardRank,rarityBadge} from './card-rarity.js';
import {serialBadge} from './card-serials.js';

const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const skins=new Map(cubeCatalog.map(cube=>[cube.id,cube]));
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const controls=[['pan','pan','Pan camera'],['out','zoomOut','Zoom out'],['in','zoomIn','Zoom in'],['reset','aim','Reset camera']];

export function showBestCard(root,card,localCover){
 if(!card){root.textContent='No cards to showcase yet.';return}
 const image=impossibleCover(card.id)||localCover(card.id)||'/api/thumbnail/'+card.id+'/small';
 const mode=Object.hasOwn(finishLabels,card.finish)?card.finish:'standard';
 const face=cardFace(card.difficulty),finish=finishLabels[mode],mark=mode==='holo'?'✧ ':mode==='antimatter'?'◈ ':'';
 const rarity=cardRarity(card),rank=displayCardRank(card);
 const move=(data,label)=>'<article class="profile-move">'+moveArt(data.art)+'<div><small>'+label+'</small><h4>'+escape(data.name)+'</h4>'+
  '<p>'+escape(data.detail)+'</p>'+(data.charge?'<small>'+data.charge+' charge · '+data.cooldown+' turns to recharge</small>':'')+'</div></article>';
 const stats=[['HP',card.maxHp],['ATK',card.attack],['Power',card.power]];
 root.innerHTML='<section class="profile-best-card" aria-label="Best card showcase" data-finish="'+mode+'" data-card-rarity="'+rarity.id+'">'+
  '<div class="profile-card-viewport"><div class="profile-card-figure package-float" aria-hidden="true">'+
  '<div class="profile-card-face"><span>'+rarityBadge(rarity)+'<b class="profile-card-finish">'+mark+finish+'</b></span><div class="profile-card-art"><img src="'+face+'" alt="">'+
  '<img class="profile-card-cover" src="'+escape(image)+'" alt=""></div><small>'+escape(card.difficulty)+(rank?' · #'+number.format(rank):'')+
  '</small><strong>'+escape(card.title)+'</strong><span>Level '+card.level+'</span></div>'+
  '<div class="profile-card-back gd-card-back">'+cardBackMark(card.difficulty)+'</div></div>'+
  '<div class="turn-handle" tabindex="0" role="group"></div><div class="turn-tools"><span>Drag to rotate</span>'+
  '<button type="button" data-reset-view>Reset view</button></div></div>'+
  '<div class="profile-card-details">'+rarityBadge(rarity)+'<h3>'+escape(card.title)+'</h3>'+serialBadge(card.serials)+'<p>'+escape(card.creator?card.creator+' · ':'')+
  escape(card.stage||card.difficulty)+' · '+escape(finish)+'</p><p>Level '+card.level+' · '+escape(card.role)+'</p>'+
  '<dl class="profile-card-stats">'+stats.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+number.format(value)+'</dd></div>').join('')+'</dl>'+
  '<div class="profile-card-moves">'+move(card.basic,'Basic attack')+move(card.signature,'Signature move')+'</div></div></section>';
 const cover=root.querySelector('.profile-card-cover');
 const fallback=()=>{cover.hidden=true};
 cover.addEventListener('error',fallback,{once:true});
 if(cover.complete&&!cover.naturalWidth)fallback();
 bindTurntable(root.querySelector('.profile-card-viewport'),'card');
}

export async function visitKingdom(root,plot,alias){
 const {createKingdomWorld}=await import('/kingdom-world.js');
 if(!root.isConnected||root.hidden)return;
 const scene=document.createElement('section');
 scene.className='profile-visit';
 scene.innerHTML='<div class="profile-visit-summary"><h3>'+escape(alias)+'’s Kingdom</h3>'+
  '<span><img src="/assets/gd-star.png" alt=""> <b data-visit-stars></b></span>'+
  '<span>'+number.format(plot.buildings.length+1)+' buildings</span><span>'+(plot.visitors.length+1)+(plot.visitors.length?' residents':' resident')+'</span></div>'+
  '<div class="kingdom-frame"><canvas tabindex="0" aria-label="Visit '+escape(alias)+'’s Kingdom"></canvas>'+
  '<div class="kingdom-plot-stats"><span class="kingdom-daylight"><i aria-hidden="true"></i><b></b></span></div>'+
  '<p class="profile-visit-selection" aria-live="polite"></p>'+
  '<div class="kingdom-hover" aria-hidden="true" hidden></div>'+
  '<div class="kingdom-controls"><span>Drag to orbit · Scroll or pinch to zoom</span><div role="group" aria-label="Camera controls">'+
  controls.map(([key,icon,label])=>'<button type="button" data-visit-camera="'+key+'" aria-label="'+label+'" title="'+label+'">'+ico(icon)+'</button>').join('')+
  '</div></div></div>';
 root.replaceChildren(scene);
 const canvas=scene.querySelector('canvas'),tooltip=scene.querySelector('.kingdom-hover'),daylight=scene.querySelector('.kingdom-daylight');
 const rating=scene.querySelector('[data-visit-stars]'),selection=scene.querySelector('.profile-visit-selection');
 const cube=skins.get(plot.cube)||equippedCube(),visitors=plot.visitors.map(guest=>({...guest,skin:skins.get(guest.cube)})).filter(guest=>guest.skin);
 const items=new Map(plot.buildings.map(building=>[building.kind+':'+building.id,{...building}]));
 const offset=plot.clock-Date.now(),clock=()=>Date.now()+offset;
 let towerLevel=plot.towerLevel,construction=plot.construction,stars=plot.stars,selected='tower',pan=false;
 function name(id){
  const building=items.get(id);
  if(building)return buildingSpecs[building.kind].name;
  if(id?.startsWith('tree-'))return 'Tree';
  if(id==='tower')return 'Starter tower';
  if(id==='cube')return cube.name+' · Resident';
  return visitors.find(guest=>'visitor:'+guest.id===id)?.name;
 }
 function inspect(id){
  selected=id;
  const building=items.get(id),tower=id==='tower';
  const upgrading=tower?construction:building?.upgradeEndsAt;
  const mine=building?.kind==='gem-mine';
  const extras=building?.kind==='forge'?' · '+forgePlan(building,clock()).rate+' Mana/s':
   mine?' · 1 gem every '+gemMine.interval/60_000+' min':building?.kind===spikeKind?' · '+spikePlan(building).damage+' damage per shot':'';
  const status=upgrading?' · Upgrading to Level '+(tower?(construction.level??2):(building.upgradeLevel??2)):'';
  selection.textContent=name(id)+(tower||building&&!mine?' · Level '+(tower?towerLevel:building.level):'')+extras+status;
  world.select(id);
 }
 const world=createKingdomWorld({canvas,cube,clock,onSelect:inspect,onHover(id,point){
  tooltip.hidden=!id;
  if(!id)return;
  tooltip.textContent=name(id);
  tooltip.style.left=Math.min(canvas.clientWidth-60,Math.max(60,point.x))+'px';
  tooltip.style.top=Math.max(33,point.y)+'px';
 }});
 function paint(){
  world.setPlot([...items.values()],visitors,towerLevel,plot.landLevel,construction,plot.removedTrees);
  rating.textContent=number.format(stars)+' / 5';
  inspect(selected);
 }
 function tick(){
  const now=clock(),{night}=kingdomDaylight(now);
  daylight.dataset.night=String(night);
  daylight.querySelector('b').textContent=night?'Night':'Day';
  let changed=false;
  if(construction&&now>=construction.endsAt){towerLevel=construction.level??2;construction=null;changed=true}
  for(const building of items.values()){
   if(!(building.upgradeEndsAt<=now))continue;
   const previous=building.level;
   building.level=building.upgradeLevel??2;
   delete building.upgradeEndsAt;
   delete building.upgradeLevel;
   if(building.kind==='house')stars=Math.min(5,Math.round((stars+houseStars(building.level)-houseStars(previous))*100)/100);
   changed=true;
  }
  if(changed)paint();
 }
 paint();tick();
 const timer=setInterval(tick,1000);
 const cameraTools=scene.querySelector('.kingdom-controls');
 const panButton=cameraTools.querySelector('[data-visit-camera="pan"]');
 function setPan(on){
  pan=on;world.panMode(pan);
  panButton.setAttribute('aria-pressed',String(pan));
  cameraTools.querySelector('span').textContent=(pan?'Drag to pan':'Drag to orbit')+' · Scroll or pinch to zoom';
 }
 cameraTools.onclick=event=>{
  const button=event.target.closest('[data-visit-camera]');
  if(!button)return;
  const action=button.dataset.visitCamera;
  if(action==='reset'){setPan(false);world.reset()}
  else if(action==='pan')setPan(!pan);
  else world.zoom(action==='in'?.79:1.26);
 };
 setPan(false);
 return ()=>{clearInterval(timer);world.dispose()};
}
