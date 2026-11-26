import {housePlan,kingdomStats,maxTowerLevel} from './kingdom-rules.js';
import {kingdomSuggestions,kingdomSuggestionStatus,recommendedKingdomUpgrade} from './kingdom-suggestions.js';
import {maxPlayerLevel,playerProgress} from './player-progression.js';
import {mineEarnings} from './mine-economy.js';

const shortcut='9090889';
const format=new Intl.NumberFormat(undefined,{maximumFractionDigits:2});
const amountRules={luck:{min:0,max:Number.MAX_SAFE_INTEGER,step:1},coins:{min:0,max:Number.MAX_SAFE_INTEGER,step:1},
 level:{min:0,max:maxPlayerLevel,step:1},
 gems:{min:0,max:Math.floor(Number.MAX_SAFE_INTEGER/10),step:.1}};

export function setupAdminTools({canOpen,loadWallet,run,searchPlayers,moderate}){
 const panel=document.getElementById('adminTools');
 if(!panel)return;
 const status=document.getElementById('adminToolsStatus');
 const adjustment=document.getElementById('adminAdjustment'),reset=document.getElementById('adminReset');
 const amount=adjustment.elements.amount,action=adjustment.elements.adjustment;
 const buttons=panel.querySelectorAll('button[type="submit"],#adminPlayerBan,#confirmAdminBan');
 const search=document.getElementById('adminPlayerSearch'),results=document.getElementById('adminPlayerResults');
 const target=document.getElementById('adminTarget'),edit=document.getElementById('adminPlayerAdjustment');
 const ban=document.getElementById('adminPlayerBan'),confirm=document.getElementById('adminBanConfirmation');
 const confirmBan=document.getElementById('confirmAdminBan');
 const kingdomEdit=document.getElementById('adminKingdomAdjustment'),kingdomFinish=document.getElementById('adminKingdomFinish');
 const kingdomProgress=document.getElementById('adminKingdomProgress');
 const kingdomStatsFields=[...panel.querySelectorAll('[data-admin-kingdom]')];
 let digits='',lastKey=0,busy=false,selected,players=[],currentWallet,clockOffset=0;

 function paintKingdom(){
  if(!currentWallet)return;
  const now=Date.now()+clockOffset,plot=kingdomStats(currentWallet,now);
  const levels=plot.houses.map(house=>housePlan(house,now).level);
  const values={tower:plot.tower.level,lots:plot.houseLots+' / '+plot.tower.limit,
   houses:levels.length?[...new Set(levels)].sort().map(level=>'Lv. '+level+' ×'+levels.filter(value=>value===level).length).join(' · '):'0 houses',
   mana:format.format(plot.mana),stars:format.format(plot.stars)+' / 5'};
  for(const entry of kingdomStatsFields)entry.textContent=values[entry.dataset.adminKingdom];
  const level=playerProgress(currentWallet.playerXp).level;
  const next=recommendedKingdomUpgrade(kingdomSuggestions(plot,currentWallet.coins+mineEarnings(currentWallet,now).coins,level,now));
  kingdomProgress.hidden=!next;
  if(next){
   kingdomProgress.querySelector('strong').textContent=next.title;
   kingdomProgress.querySelector('small').textContent=kingdomSuggestionStatus(next,now);
   kingdomProgress.querySelector('progress').value=next.progress;
  }
  kingdomFinish.disabled=busy||!(currentWallet.kingdom?.towerConstruction||plot.buildings.some(item=>item.upgrade));
 }

 function showBalances(wallet){
  currentWallet=wallet;
  if(Number.isFinite(wallet.kingdomClock))clockOffset=wallet.kingdomClock-Date.now();
  for(const entry of panel.querySelectorAll('[data-admin-balance]')){
   const field=entry.dataset.adminBalance;
   entry.textContent=format.format(field==='level'?playerProgress(wallet.playerXp).level:wallet[field]||0)+(field==='luck'?'%':'');
  }
  paintKingdom();
 }
 function showStatus(message,error=false){status.textContent=message;status.dataset.error=String(error);}
 function setBusy(value){busy=value;for(const button of buttons)button.disabled=value;paintKingdom();}
 function selectPane(name){
  for(const tab of panel.querySelectorAll('[data-admin-tab]'))tab.setAttribute('aria-pressed',String(tab.dataset.adminTab===name));
  for(const pane of panel.querySelectorAll('[data-admin-pane]'))pane.hidden=pane.dataset.adminPane!==name;
 }
 function showTarget(player){
  selected=player;target.hidden=!player;confirm.hidden=true;
  if(!player)return;
  target.querySelector('[data-admin-target-name]').textContent=player.name+(player.username?' · @'+player.username:'');
  target.querySelector('[data-admin-target-meta]').textContent='Level '+format.format(player.level)+' · '+format.format(player.coins)+' coins'+(player.bannedAt?' · Banned':'');
  ban.textContent=player.bannedAt?'Unban player':'Ban player';
  edit.elements.amount.value=player[edit.elements.field.value];
 }
 function showResults(){
  results.replaceChildren(...players.map(player=>{
   const row=document.createElement('li'),button=document.createElement('button');
   const name=document.createElement('strong'),description=document.createElement('small');
   button.type='button';
   name.textContent=player.name;
   description.textContent=(player.username?'@'+player.username+' · ':'')+'Level '+player.level+(player.bannedAt?' · Banned':'');
   button.append(name,description);
   button.onclick=()=>{if(!busy){showTarget(player);showStatus('');}};
   row.append(button);
   return row;
  }));
 }
 async function changePlayer(operation,value){
  if(!selected||busy)return;
  const {id}=selected;
  setBusy(true);
  try{
   const {player}=await moderate(id,operation,value);
   players=players.map(item=>item.id===id?player:item);
   showResults();showTarget(player);
   showStatus(operation==='ban'?player.name+' was banned.':operation==='unban'?player.name+' was unbanned.':'Changes saved for '+player.name+'.');
  }catch(error){showStatus(error.message,true);}
  finally{setBusy(false);}
 }
 function amountLimits(){
  const [field,mode]=action.value.split(':'),rules={...amountRules[field]};
  if(field==='coins'&&mode==='add')rules.min=1;
  Object.assign(amount,rules,{inputMode:field==='gems'?'decimal':'numeric'});
  amount.value='';
 }
 action.addEventListener('change',amountLimits);
 amountLimits();
 function kingdomAmountLimits(){
  const editTower=kingdomEdit.elements.adjustment.value==='tower',input=kingdomEdit.elements.amount;
  Object.assign(input,{min:editTower?1:0,max:editTower?maxTowerLevel:Number.MAX_SAFE_INTEGER});
  input.value='';
 }
 kingdomEdit.elements.adjustment.addEventListener('change',kingdomAmountLimits);
 kingdomAmountLimits();
 panel.querySelector('[data-admin-open-kingdom]').addEventListener('click',()=>panel.close());
 panel.querySelector('[data-close-admin]').addEventListener('click',()=>panel.close());
 async function open(pane){
  if(!canOpen()||panel.open)return;
  selectPane(pane);
  showStatus('');
  panel.showModal();
  if(pane==='players'){search.elements.query.focus();return;}
  await loadBalances();
 }
 async function loadBalances(){
  setBusy(true);
  try{showBalances(await loadWallet());}
  catch(error){showStatus(error.message,true);}
  finally{setBusy(false);}
 }
 const menuButton=document.getElementById('openAdminTools');
 menuButton.addEventListener('click',()=>{
  menuButton.closest('details').open=false;
  open('players');
 });
 for(const tab of panel.querySelectorAll('[data-admin-tab]'))tab.addEventListener('click',()=>{
  if(busy)return;
  selectPane(tab.dataset.adminTab);
  showStatus('');
  if(tab.dataset.adminTab!=='players')loadBalances();
 });
 setInterval(()=>{if(panel.open&&!kingdomEdit.closest('section').hidden)paintKingdom();},1000);
 window.addEventListener('keydown',event=>{
  if(!canOpen()||event.repeat||event.ctrlKey||event.metaKey||event.altKey||
    event.target.closest?.('input,textarea,select,[contenteditable]')||document.querySelector('dialog[open]'))return;
  if(!/^\d$/.test(event.key)){digits='';return;}
  if(performance.now()-lastKey>1500)digits='';
  lastKey=performance.now();
  digits=(digits+event.key).slice(-shortcut.length);
  if(digits!==shortcut)return;
  digits='';
  open('mine');
 });
 search.addEventListener('submit',async event=>{
  event.preventDefault();
  const term=search.elements.query.value.trim();
  if(!term||busy)return;
  setBusy(true);showStatus('Searching…');showTarget(null);
  players=[];showResults();
  try{
   const data=await searchPlayers(term);
   players=data.players;showResults();
   showStatus(players.length?'':'No matching player.');
  }catch(error){showStatus(error.message,true);}
  finally{setBusy(false);}
 });
 edit.elements.field.addEventListener('change',()=>{if(selected)edit.elements.amount.value=selected[edit.elements.field.value];});
 edit.addEventListener('submit',event=>{
  event.preventDefault();
  changePlayer(edit.elements.field.value,edit.elements.amount.valueAsNumber);
 });
 ban.addEventListener('click',()=>{
  if(!selected||busy)return;
  const label=selected.bannedAt?'Unban':'Ban';
  confirm.hidden=false;
  confirm.querySelector('[data-admin-ban-prompt]').textContent=selected.bannedAt?'Restore access for '+selected.name+'?':
   'Ban '+selected.name+' from GD Kingdom and cancel their open trades?';
  confirmBan.textContent=label+' '+selected.name;
  document.getElementById('cancelAdminBan').focus();
 });
 document.getElementById('cancelAdminBan').addEventListener('click',()=>{confirm.hidden=true;ban.focus();});
 confirmBan.addEventListener('click',()=>{if(selected)changePlayer(selected.bannedAt?'unban':'ban');});
 adjustment.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy)return;
  const [field,mode]=action.value.split(':');
  setBusy(true);
  try{
   const {wallet}=await run('admin.adjust',{field,mode,amount:amount.valueAsNumber});
   showBalances(wallet);
   amount.value='';
   showStatus('Saved.');
  }catch(error){showStatus(error.message,true);}
  finally{setBusy(false);}
 });
 kingdomEdit.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy)return;
  setBusy(true);
  try{
   const {wallet}=await run('admin.adjust',{field:kingdomEdit.elements.adjustment.value,mode:'set',amount:kingdomEdit.elements.amount.valueAsNumber});
   showBalances(wallet);kingdomEdit.elements.amount.value='';
   showStatus('Kingdom testing change saved.');
  }catch(error){showStatus(error.message,true);}
  finally{setBusy(false);}
 });
 kingdomFinish.addEventListener('click',async()=>{
  if(busy)return;
  setBusy(true);
  try{
   const {wallet}=await run('admin.kingdom.finish',{});
   showBalances(wallet);showStatus('Construction complete.');
  }catch(error){showStatus(error.message,true);}
  finally{setBusy(false);}
 });
 reset.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy)return;
  setBusy(true);
  try{
   await run('admin.reset',{confirmation:reset.elements.confirmation.value});
   location.reload();
  }catch(error){showStatus(error.message,true);setBusy(false);}
 });
}
