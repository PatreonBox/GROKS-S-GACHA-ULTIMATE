import {computerCost,computerUpgradeCost,computerBuildMs,computerHouse,computerPlan,residentBonus,residentRage,repairCost,visitorResident,roomCells} from './kingdom-computer.js';
import {housePlan,houseStars,towerSkipCost} from './kingdom-rules.js';
import {cubeCatalog} from './cube-catalog.js';
import {gameCommand} from './game-client.js';

const number=value=>value.toLocaleString('en-US',{maximumFractionDigits:2});
const coordinates=['Back left','Back center','Back right','Front left','Front center','Front right'];
const button=(action,label)=>'<button type="button" class="outline" data-furnish="'+action+'">'+label+'</button>';
const costText=cost=>number(cost.coins)+' coins + '+cost.mana+' Mana';
const rageLabel=value=>value<25?'Calm':value<50?'Focused':value<75?'Frustrated':value<95?'Fuming':'Furious';
export const interiorControls='<section class="kingdom-room-panel" aria-label="House interior" hidden>'+
 '<div class="room-heading"><h2 data-room-title></h2>'+button('exit','Leave house')+'</div>'+
 '<nav class="room-inspectors" aria-label="Inspect">'+button('house','House')+button('resident','Resident')+button('computer','Computer')+'</nav>'+
 '<section data-pane="house"><p data-room-occupancy></p><p data-room-house-stats></p><label>Assigned resident<select data-room-resident></select></label>'+
 '<div class="room-actions">'+button('buy','Place computer')+'</div></section>'+
 '<section data-pane="resident" hidden><h3 data-resident-name></h3><p data-resident-stats></p><label><span data-mood-label></span>'+
 '<progress data-mood max="100" aria-label="Resident rage"></progress></label><div class="room-actions">'+button('resident-play','Play GD')+'</div></section>'+
 '<section data-pane="computer" hidden><h3 data-pc-name></h3><p data-pc-condition></p><p data-room-rate></p>'+
 '<progress data-room-meter max="1" aria-label="Production progress"></progress><small data-room-time></small>'+
 '<div class="room-actions">'+button('play','Play GD')+button('collect','Collect Stars')+button('skip','Finish now')+button('replay','Watch the smash')+
 button('repair','Repair computer')+button('position','Move desk')+button('upgrade','Upgrade computer')+button('relocate','Move to another house')+'</div></section>'+
 '<section data-pane="placement" hidden><p>Choose a spot on the floor.</p><div class="room-cells" role="group" aria-label="Desk position">'+
 coordinates.map((name,i)=>'<button class="outline" type="button" data-room-cell="'+i+'" aria-label="'+name+'">'+name+'</button>').join('')+
 '</div><div class="room-actions">'+button('rotate','Rotate 90°')+button('cancel','Cancel')+button('place','Place computer')+'</div></section>'+
 '<p class="room-feedback" role="status" data-room-message></p></section>'+
 '<div class="room-camera" aria-label="Room camera">'+button('pan','Pan')+button('in','＋')+button('out','−')+button('reset','Reset view')+'</div>';
export const interiorChooser='<dialog class="kingdom-room-chooser" aria-label="Choose a house"><header><h2>Choose a GD House</h2>'+
 button('close-chooser','Close')+'</header><div data-room-houses></div></dialog>';

export function createRoomControls(root,{getState,applyWallet,select,clock,sound}){
 const get=selector=>root.querySelector(selector),panel=get('.kingdom-room-panel'),dialog=get('.kingdom-room-chooser');
 const action=id=>root.querySelector('[data-furnish="'+id+'"]');
 const residentInput=get('[data-room-resident]'),message=get('[data-room-message]'),frame=get('.kingdom-frame');
 let houseId=null,pane='house',draft=null,moveSource,working=false,disposed=false,pan=false,replay=null,lastDamage,lastDrawnRage;
 const state=()=>getState();
 const activeHouse=()=>state().plot.houses.find(h=>h.id===houseId);
 const label=house=>'GD House '+(state().plot.houses.findIndex(h=>h.id===house.id)+1);
 function residents(){
  const {cube,visitors}=state();
  return [{id:'cube',name:cube.name,skin:cube,rarity:cube.rarity},...visitors.map(g=>({id:visitorResident(g.slot),name:g.name,skin:g.skin,rarity:g.rarity}))];
 }
 const findResident=id=>residents().find(r=>r.id===id);
 function present(house){
  if(house.computer?.playing)return house.resident;
  return state().world?.insideHouse(house.id)||null;
 }
 function replayActor(event){
  if(event?.actor?.startsWith('cube:'))return cubeCatalog.find(s=>s.id===event.actor.slice(5));
  return findResident(event?.resident)?.skin;
 }
 function startReplay(event){
  if(!event)return;
  replay={...event,skin:replayActor(event),startedAt:Date.now()};
 }
 function preview(){
  const house=activeHouse();if(!house)return;
  const pc=house.computer,source=draft?.source&&state().plot.houses.find(h=>h.id===draft.source);
  const who=present(house),skin=findResident(who)?.skin;
  lastDrawnRage=residentRage(state().wallet,who,clock());
  state().world?.setInterior({house,cell:draft?.cell??pc?.cell??null,rotation:draft?.rotation??pc?.rotation??0,
   level:source?.computer?.level??pc?.construction?.level??pc?.level??1,skin:replay?.skin??skin,
   inside:Boolean(who),playing:!draft&&Boolean(pc?.playing),placing:Boolean(draft),construction:!draft&&pc?.construction,
   broken:!draft&&pc?.broken,replay:!draft&&replay,rage:lastDrawnRage});
 }
 function tick(){
  const house=activeHouse();if(!house)return;
  const pc=house.computer,now=clock(),id=present(house)||house.resident,resident=findResident(id);
  if(pc?.playing&&residentRage(state().wallet,house.resident,now)!==lastDrawnRage)preview();
  if(replay&&Date.now()-replay.startedAt>=3800){replay=null;preview();}
  if(pane==='resident'&&resident){
   const rage=residentRage(state().wallet,id,now);
   get('[data-mood-label]').textContent='Rage '+rage+'% · '+rageLabel(rage);get('[data-mood]').value=rage;
  }
  if(pane!=='computer'||!pc||draft)return;
  const plan=computerPlan(house,now),who=findResident(house.resident),site=pc.construction;
  const rage=who?residentRage(state().wallet,who.id,now):0;
  get('[data-room-rate]').textContent=number(plan.rate)+(plan.rate===1?' Star/min':' Stars/min')+(who?' · '+who.name+' · Rage '+rage+'%':' · Unassigned');
  const meter=get('[data-room-meter]'),time=get('[data-room-time]');
  if(site){
   const seconds=Math.max(0,Math.ceil((site.endsAt-now)/1000)),gems=towerSkipCost(site,now);
   meter.value=Math.max(0,(now-site.startedAt)/Math.max(1,site.endsAt-site.startedAt));
   time.textContent='Builders working · '+seconds+'s remaining';
   action('skip').textContent='Finish now · '+gems+(gems===1?' gem':' gems');
   action('skip').disabled=working||!gems||state().wallet.gems<gems;
  }else{
   meter.value=plan.progress;
   time.textContent=(plan.playing?'Next Star in '+Math.ceil(plan.remainingMs/1000)+'s':pc.broken?'Production stopped':house.resident?'Paused':'Assign a resident to play GD')+' · '+number(plan.stored)+' ready';
  }
  action('collect').textContent='Collect '+number(plan.stored)+(plan.stored===1?' Star':' Stars');
  action('collect').disabled=working||!plan.stored;
 }
 function refresh(){
  if(!houseId)return;
  const house=activeHouse();if(!house){close();return;}
  const {wallet,plot}=state(),pc=house.computer,owned=computerHouse(wallet),who=present(house),resident=findResident(who||house.resident);
  if(pc?.broken&&pc.broken.at!==lastDamage&&clock()-pc.broken.at<8000)startReplay(pc.broken);
  lastDamage=pc?.broken?.at;
  if(pane==='computer'&&!pc||pane==='resident'&&!resident)pane='house';
  get('[data-room-title]').textContent=label(house)+' · Level '+(house.level||1);
  for(const area of panel.querySelectorAll('[data-pane]'))area.hidden=area.dataset.pane!==(draft?'placement':pane);
  panel.querySelector('nav').hidden=Boolean(draft);
  for(const id of ['house','resident','computer'])action(id).setAttribute('aria-pressed',String(id===pane));
  action('resident').disabled=!resident;action('computer').disabled=!pc;
  const options=[new Option('Unassigned',''),...residents().map(r=>{
   const taken=plot.houses.find(other=>other.id!==houseId&&other.resident===r.id);
   const opt=new Option(r.name+' · +'+residentBonus(r.id)+'%'+(taken?' · '+label(taken):''),r.id);
   opt.disabled=Boolean(taken);return opt;
  })];
  const list=options.map(o=>o.text+' '+o.disabled).join('|');
  if(residentInput.dataset.list!==list){residentInput.replaceChildren(...options);residentInput.dataset.list=list;}
  residentInput.value=house.resident||'';residentInput.disabled=working;
  const inside=findResident(who);
  get('[data-room-occupancy]').textContent=inside?inside.name+(pc?.playing?' is playing GD.':' is inside.'):house.resident?(findResident(house.resident)?.name||'Your resident')+' is out in the Kingdom.':'Empty. The first cube to come inside moves in.';
  const hp=housePlan(house,clock());
  get('[data-room-house-stats]').textContent=hp.hp+' HP · +'+houseStars(hp.level)+' Kingdom rating';
  action('buy').hidden=Boolean(owned);action('buy').textContent='Place computer · '+costText(computerCost);
  const canPay=cost=>wallet.coins>=cost.coins&&plot.mana>=cost.mana;
  action('buy').disabled=working||Boolean(house.upgrade)||!canPay(computerCost);
  if(resident){
   get('[data-resident-name]').textContent=resident.name;
   get('[data-resident-stats]').textContent=resident.rarity+' · +'+residentBonus(resident.id)+'% Stars · '+(pc?.playing?'Playing GD':who?'At home':'Out in the Kingdom');
   action('resident-play').hidden=!pc||resident.id!==house.resident;
   action('resident-play').textContent=pc?.playing?'Stop playing':'Play GD';
   action('resident-play').disabled=working||Boolean(pc?.broken||pc?.construction);
  }
  if(pc){
   const busy=Boolean(pc.construction),broken=pc.broken,price=repairCost(pc.level);
   get('[data-pc-name]').textContent='Computer · Level '+pc.level+' ('+(pc.level===2?60:30)+' Hz)';
   get('[data-pc-condition]').textContent=busy?(pc.construction.level===1?'Installing the workstation':'Upgrading the workstation'):broken?
    (broken.damage==='screen'?'Screen smashed':'Keyboard smashed')+' · '+((broken.resident==='cube'?replayActor(broken)?.name:findResident(broken.resident)?.name)||'Resident'):'Working · 0.1% smash chance per minute played';
   action('play').hidden=busy||Boolean(broken);action('play').textContent=pc.playing?'Stop playing':'Play GD';
   action('play').disabled=working||!house.resident;action('skip').hidden=!busy;
   action('replay').hidden=action('repair').hidden=!broken;
   action('repair').textContent='Repair · '+costText(price);action('repair').disabled=working||!canPay(price);
   action('upgrade').hidden=busy||Boolean(broken)||pc.level===2;
   action('upgrade').disabled=working||Boolean(house.upgrade)||!canPay(computerUpgradeCost);
   action('upgrade').textContent='Upgrade to Level 2 · '+costText(computerUpgradeCost)+' · '+computerBuildMs[1]/1000+'s';
   action('position').hidden=busy;action('relocate').hidden=busy||!plot.houses.some(h=>h.id!==house.id&&!h.computer&&!h.upgrade);
  }
  if(draft){
   action('place').textContent=draft.source?'Save position':'Build · '+costText(computerCost)+' · '+computerBuildMs[0]/1000+'s';
   action('place').disabled=working||!draft.source&&!canPay(computerCost);
   for(const cell of panel.querySelectorAll('[data-room-cell]'))cell.setAttribute('aria-pressed',String(+cell.dataset.roomCell===draft.cell));
  }
  for(const id of ['exit','cancel','rotate','position','relocate'])action(id).disabled=working;
  preview();tick();
 }
 function open(id,placing=false,source,focus='house'){
  const house=state().plot.houses.find(h=>h.id===id);if(!house)return;
  if(houseId!==id){pan=false;replay=null;lastDamage=house.computer?.broken?.at;}
  houseId=id;pane=focus;draft=placing?{source,cell:house.computer?.cell??1,rotation:house.computer?.rotation??0}:null;
  message.textContent='';panel.hidden=false;frame.classList.add('inside-house');
  action('pan').setAttribute('aria-pressed',String(pan));refresh();state().world?.panMode(pan);
  (placing?action('place'):action('exit')).focus({preventScroll:true});
 }
 function close(){
  houseId=null;draft=null;replay=null;panel.hidden=true;frame.classList.remove('inside-house');
  state().world?.setInterior(null);
 }
 function choose(source){
  moveSource=source;
  const {plot}=state(),rows=get('[data-room-houses]');
  const buttons=plot.houses.map(h=>{
   const el=document.createElement('button');el.type='button';el.className='outline';el.dataset.roomHouse=h.id;
   el.disabled=Boolean(h.computer||h.upgrade);
   const guest=findResident(h.resident);
   el.textContent=label(h)+' · '+(h.computer?'Computer installed':h.upgrade?'Under construction':'Space for a computer')+(guest?' · '+guest.name:'');
   return el;
  });
  rows.replaceChildren(...buttons);if(!buttons.length)rows.textContent='Build a GD House to place a computer.';
  if(!dialog.open)dialog.showModal();
 }
 async function command(name,args,success,after){
  if(working||disposed)return;
  working=true;message.textContent='';refresh();
  try{
   const {wallet,result}=await gameCommand(name,args);applyWallet(wallet);if(disposed)return;
   if(after)after();message.textContent=typeof success==='function'?success(result):success;
  }catch(error){if(!disposed)message.textContent=error.message;}
  finally{working=false;if(!disposed)refresh();}
 }
 function handleClick(el){
  if(el.hasAttribute('data-room-house')){dialog.close();open(el.dataset.roomHouse,true,moveSource);return true;}
  if(el.hasAttribute('data-room-cell')&&draft){draft.cell=Number(el.dataset.roomCell);refresh();return true;}
  const key=el.dataset.furnish;if(!key)return false;
  if(key==='close-chooser'){dialog.close();return true;}
  if(key==='exit'){const id=houseId;close();if(id)select('house:'+id);sound?.playGameReady('gdQuit',{},()=>!disposed);return true;}
  const house=activeHouse();if(!house)return true;
  if(['in','out','reset','pan'].includes(key)){
   const world=state().world;
   if(key==='in'||key==='out')world?.zoom(key==='in'?.79:1.26);
   if(key==='reset')world?.reset();
   if(key==='pan'){pan=!pan;world?.panMode(pan);action('pan').setAttribute('aria-pressed',String(pan));}
   return true;
  }
  if(working)return true;
  if(['house','resident','computer'].includes(key)){pane=key;message.textContent='';refresh();return true;}
  if(key==='buy'||key==='position'){open(houseId,true,house.computer?houseId:undefined);return true;}
  if(key==='relocate'){choose(houseId);return true;}
  if(key==='rotate'&&draft){draft.rotation=(draft.rotation+1)%4;refresh();return true;}
  if(key==='cancel'){open(houseId,false,null,house.computer?'computer':'house');return true;}
  if(key==='place'&&draft){
   const args={houseId,cell:draft.cell,rotation:draft.rotation,...(draft.source?{sourceHouseId:draft.source}:{})};
   command('kingdom.computer.place',args,draft.source?'Desk moved.':'The builders are installing your computer.',()=>{draft=null;pane='computer';});
  }
  if(key==='play'||key==='resident-play')togglePlay(house);
  if(key==='upgrade')command('kingdom.computer.upgrade',{houseId},'Computer upgrade started.');
  if(key==='repair')command('kingdom.computer.repair',{houseId,at:house.computer.broken.at},'Computer repaired.',()=>{replay=null;});
  if(key==='replay'){startReplay(house.computer.broken);preview();}
  if(key==='skip'){
   const site=house.computer.construction;
   if(site)command('kingdom.building.skip',{kind:'computer',id:houseId,startedAt:site.startedAt,maxGems:towerSkipCost(site,clock())},'Your computer is ready.');
  }
  if(key==='collect')command('kingdom.computer.collect',{houseId},r=>'Collected '+number(r.earned)+(r.earned===1?' Star.':' Stars.'));
  return true;
 }
 function togglePlay(house){
  const playing=!house.computer?.playing;
  command('kingdom.computer.play',{houseId:house.id,resident:house.resident,playing},playing?'Playing GD.':'Session paused.');
 }
 function pick(hit){
  if(working)return;
  if(draft){if(hit?.kind==='cell'&&Number.isInteger(hit.cell)&&hit.cell>=0&&hit.cell<roomCells){draft.cell=hit.cell;refresh();}return;}
  pane=hit?.kind==='resident'?'resident':hit?.kind==='computer'?'computer':'house';message.textContent='';refresh();
 }
 residentInput.onchange=()=>command('kingdom.house.assign',{houseId,resident:residentInput.value||null},'House assignment saved.');
 return {open,close,choose,refresh,tick,handleClick,pick,togglePlay,get active(){return Boolean(houseId);},dispose(){disposed=true;if(dialog.open)dialog.close();}};
}
