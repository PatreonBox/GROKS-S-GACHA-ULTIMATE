import {computerCost,computerUpgradeCost,computerHouse,computerPlan,residentBonus,visitorResident,roomCells} from './kingdom-computer.js';
import {gameCommand} from './game-client.js';

const number=value=>value.toLocaleString('en-US',{maximumFractionDigits:2});
const coordinates=['back left','back center','back right','front left','front center','front right'];
const button=(action,label)=>'<button type="button" class="outline" data-furnish="'+action+'">'+label+'</button>';
const costText=cost=>number(cost.coins)+' coins + '+cost.mana+' Mana';

export const interiorControls='<section class="kingdom-room-panel" aria-label="House interior" hidden>'+
 '<div class="room-heading"><h2 data-room-title></h2>'+button('exit','Leave house')+'</div>'+
 '<div data-room-playback><label>Resident <select data-room-resident aria-label="Assigned resident"></select></label>'+
 '<section data-room-pc><h3 data-pc-name></h3><p data-room-rate></p>'+
 '<progress data-room-meter max="1" aria-label="Next Star progress"></progress><small data-room-time></small>'+
 '<div class="room-actions">'+button('play','Play GD')+button('collect','Collect Stars')+'</div></section>'+
 '<div class="room-actions">'+button('buy','Place computer')+button('position','Edit position')+
 button('upgrade','Upgrade computer')+button('relocate','Move to another house')+'</div></div>'+
 '<div data-room-placement hidden><p>Choose a spot on the floor.</p><div class="room-cells" role="group" aria-label="Desk floor position">'+
 coordinates.map((name,i)=>'<button class="outline" type="button" data-room-cell="'+i+'" aria-label="'+name+'">'+(i+1)+'</button>').join('')+
 '</div><div class="room-actions">'+button('rotate','Rotate 90°')+button('cancel','Cancel')+
 '<button type="button" class="primary" data-furnish="place">Place computer</button></div></div>'+
 '<p class="room-feedback" role="status" data-room-message></p></section>';
export const interiorChooser='<dialog class="kingdom-room-chooser" aria-label="Choose a house"><header><h2>Choose a GD House</h2>'+
 button('close-chooser','Close')+'</header><div data-room-houses></div></dialog>';

export function createRoomControls(root,{getState,applyWallet,select,clock}){
 const get=selector=>root.querySelector(selector),panel=get('.kingdom-room-panel'),dialog=get('.kingdom-room-chooser');
 const action=id=>panel.querySelector('[data-furnish="'+id+'"]');
 const residentInput=get('[data-room-resident]'),message=get('[data-room-message]'),frame=get('.kingdom-frame');
 let houseId=null,draft=null,moveSource,working=false,disposed=false;
 const state=()=>getState();
 const activeHouse=()=>state().plot.houses.find(h=>h.id===houseId);
 const label=house=>'GD House '+(state().plot.houses.findIndex(h=>h.id===house.id)+1);
 function residents(){
  const {cube,visitors}=state();
  return [{id:'cube',name:cube.name,skin:cube},...visitors.map(g=>({id:visitorResident(g.slot),name:g.name,skin:g.skin}))];
 }
 const occupant=house=>residents().find(r=>r.id===house?.resident);
 function preview(){
  const house=activeHouse();if(!house)return;
  const computer=house.computer,source=draft?.source&&state().plot.houses.find(h=>h.id===draft.source);
  state().world?.setInterior({house,cell:draft?.cell??computer?.cell??null,rotation:draft?.rotation??computer?.rotation??0,
   level:source?.computer?.level??computer?.level??1,skin:occupant(house)?.skin,playing:!draft&&Boolean(computer?.playing),placing:Boolean(draft)});
 }
 function tick(){
  const house=activeHouse();if(!house||draft||!house.computer)return;
  const plan=computerPlan(house,clock()),seconds=Math.ceil((plan.remainingMs??0)/1000);
  get('[data-room-rate]').textContent=number(plan.rate)+(plan.rate===1?' Star/min':' Stars/min')+' · '+(occupant(house)?.name??'Unassigned')+' · +'+plan.bonus+'% skill';
  get('[data-room-meter]').value=plan.progress;
  get('[data-room-time]').textContent=plan.playing?'Next Star in '+seconds+'s · '+number(plan.stored)+' ready':
   (house.resident?'Paused':'Assign a resident to play GD')+' · '+number(plan.stored)+' ready';
  action('collect').textContent='Collect '+number(plan.stored)+(plan.stored===1?' Star':' Stars');
  action('collect').disabled=working||plan.stored===0;
 }
 function refresh(){
  if(!houseId)return;
  const house=activeHouse();
  if(!house){close();return;}
  const {wallet,plot}=state(),computer=house.computer,owned=computerHouse(wallet),has=Boolean(computer);
  get('[data-room-title]').textContent=label(house)+' · Level '+(house.level||1);
  get('[data-room-playback]').hidden=Boolean(draft);get('[data-room-placement]').hidden=!draft;
  get('[data-room-pc]').hidden=!has;
  const options=[new Option('Unassigned',''),...residents().map(r=>{
   const taken=plot.houses.find(other=>other.id!==houseId&&other.resident===r.id);
   const opt=new Option(r.name+' · +'+residentBonus(r.id)+'%'+(taken?' · '+label(taken):''),r.id);
   opt.disabled=Boolean(taken);return opt;
  })];
  const key=options.map(o=>o.text+' '+o.disabled).join('|');
  if(residentInput.dataset.list!==key){residentInput.replaceChildren(...options);residentInput.dataset.list=key;}
  residentInput.value=house.resident||'';residentInput.disabled=working;
  action('buy').hidden=Boolean(owned);
  action('buy').textContent='Place computer · '+costText(computerCost);
  action('buy').disabled=working||Boolean(house.upgrade)||wallet.coins<computerCost.coins||plot.mana<computerCost.mana;
  action('position').hidden=!has;action('upgrade').hidden=!has||computer.level===2;
  action('upgrade').disabled=working||wallet.coins<computerUpgradeCost.coins||plot.mana<computerUpgradeCost.mana;
  action('upgrade').textContent='Upgrade to Level 2 · '+costText(computerUpgradeCost);
  action('relocate').hidden=!has||!plot.houses.some(h=>h.id!==house.id&&!h.computer&&!h.upgrade);
  if(has){
   get('[data-pc-name]').textContent=computer.level===2?'Computer · Level 2 · 60 Hz':'Computer · Level 1 (30 Hz)';
   action('play').textContent=computer.playing?'Stop playing':'Play GD';
   action('play').disabled=working||!house.resident;
  }
  if(draft){
   action('place').textContent=draft.source?'Save position':'Place · '+costText(computerCost);
   action('place').disabled=working||!draft.source&&(wallet.coins<computerCost.coins||plot.mana<computerCost.mana);
   for(const cell of panel.querySelectorAll('[data-room-cell]'))cell.setAttribute('aria-pressed',String(Number(cell.dataset.roomCell)===draft.cell));
  }
  for(const id of ['exit','cancel','rotate','position','relocate'])action(id).disabled=working;
  preview();tick();
 }
 function open(id,placing=false,source){
  const house=state().plot.houses.find(h=>h.id===id);
  if(!house)return;
  houseId=id;draft=placing?{source,cell:house.computer?.cell??1,rotation:house.computer?.rotation??0}:null;
  message.textContent='';panel.hidden=false;frame.classList.add('inside-house');refresh();
  (placing?action('place'):action('exit')).focus({preventScroll:true});
 }
 function close(){
  houseId=null;draft=null;panel.hidden=true;frame.classList.remove('inside-house');
  state().world?.setInterior(null);
 }
 function choose(source){
  moveSource=source;
  const {plot}=state(),rows=get('[data-room-houses]');
  const buttons=plot.houses.map(h=>{
   const el=document.createElement('button');el.type='button';el.className='outline';el.dataset.roomHouse=h.id;
   el.disabled=Boolean(h.computer||h.upgrade);
   const guest=occupant(h);
   el.textContent=label(h)+' · '+(h.computer?'Computer installed':h.upgrade?'Under construction':'Space for a computer')+(guest?' · '+guest.name:'');
   return el;
  });
  rows.replaceChildren(...buttons);
  if(!buttons.length)rows.textContent='Build a GD House to place a computer.';
  if(!dialog.open)dialog.showModal();
 }
 async function command(name,args,success,after){
  if(working||disposed)return;
  working=true;message.textContent='';refresh();
  try{
   const {wallet,result}=await gameCommand(name,args);applyWallet(wallet);
   if(disposed)return;
   if(after)after();refresh();
   message.textContent=typeof success==='function'?success(result):success;
  }catch(error){if(!disposed)message.textContent=error.message;}
  finally{working=false;if(!disposed)refresh();}
 }
 function handleClick(el){
  if(el.hasAttribute('data-room-house')){
   dialog.close();open(el.dataset.roomHouse,true,moveSource);return true;
  }
  if(el.hasAttribute('data-room-cell')&&draft){draft.cell=Number(el.dataset.roomCell);refresh();return true;}
  const key=el.dataset.furnish;if(!key)return false;
  if(key==='close-chooser'){dialog.close();return true;}
  if(key==='exit'){const id=houseId;close();if(id)select('house:'+id);return true;}
  if(working)return true;
  const house=activeHouse();if(!house)return true;
  if(key==='buy'||key==='position'){open(houseId,true,house.computer?houseId:undefined);return true;}
  if(key==='relocate'){choose(houseId);return true;}
  if(key==='rotate'&&draft){draft.rotation=(draft.rotation+1)%4;refresh();return true;}
  if(key==='cancel'){open(houseId);return true;}
  if(key==='place'&&draft){
   const args={houseId,cell:draft.cell,rotation:draft.rotation,...(draft.source?{sourceHouseId:draft.source}:{})};
   command('kingdom.computer.place',args,'Computer placed.',()=>{draft=null;});
  }
  if(key==='play')togglePlay(house);
  if(key==='upgrade')command('kingdom.computer.upgrade',{houseId},'Level 2 computer installed.');
  if(key==='collect')command('kingdom.computer.collect',{houseId},r=>'Collected '+number(r.earned)+(r.earned===1?' Star.':' Stars.'));
  return true;
 }
 function togglePlay(house){
  const playing=!house.computer.playing;
  command('kingdom.computer.play',{houseId:house.id,resident:house.resident,playing},playing?'Playing GD.':'Session paused.');
 }
 function pick(hit){
  if(!hit||working)return;
  if(draft&&hit.kind==='cell'&&Number.isInteger(hit.cell)&&hit.cell>=0&&hit.cell<roomCells){draft.cell=hit.cell;refresh();}
  if(!draft&&(hit.kind==='computer'||hit.kind==='resident')){
   action('play').focus({preventScroll:true});
   message.textContent=hit.kind==='resident'?(occupant(activeHouse())?.name??'Resident'):'Computer · Level '+activeHouse().computer.level;
  }
 }
 residentInput.onchange=()=>command('kingdom.house.assign',{houseId,resident:residentInput.value||null},'House assignment saved.');
 dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}};
 return {open,close,choose,refresh,tick,handleClick,pick,togglePlay,get active(){return Boolean(houseId);},dispose(){disposed=true;if(dialog.open)dialog.close();}};
}
