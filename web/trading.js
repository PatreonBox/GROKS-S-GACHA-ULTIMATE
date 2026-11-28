import {loadingMarkup} from './loading.js';
import {cardCategories} from './pack-engine.js';
import {finishLabels} from './card-finishes.js';
import {gameCommand,tradeCommand,tradeRead} from './game-client.js';
import {ico} from './icons.js';
import {marketDays,marketMinPairs,tradeBalance,tradeBundleTotal,tradeCardLimit,tradeKey,tradeLevelNotice,tradeMaxGap,tradePreferences,tradeSearchTerm} from './trade-rules.js';
import {escapeTrade as esc,tradeCardHTML,tradeNumber,tradePoints} from './trade-card-view.js';

const tabs=[['find','Find player'],['incoming','Incoming'],['outgoing','Outgoing'],['history','History'],['market','Market']];
const statuses={pending:'Pending',completed:'Completed',declined:'Declined',cancelled:'Cancelled',expired:'Expired'};
const directions=['give','get'];
const date=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});
const total=cards=>cards.reduce((sum,card)=>sum+card.count,0);
const balanceLabel='Both sides must be within '+tradeMaxGap+'% in trade value.';
const balancePercent=gap=>tradeNumber(Math.ceil(gap*10)/10)+'%';
const time=ms=>'<time datetime="'+new Date(ms).toISOString()+'">'+esc(date.format(ms))+'</time>';
const textStatus=message=>'<p class="trade-empty">'+esc(message)+'</p>';
const avatar=person=>'<span class="trade-player-initial" aria-hidden="true">'+(person.avatar?'<img src="'+esc(person.avatar)+'" alt="" referrerpolicy="no-referrer">':'')+
 esc(Array.from(person.name)[0]?.toUpperCase()||'?')+'</span>';
const accountName=person=>person.username?'@'+person.username:'';
const playerHandle=person=>person.username?'<small>@'+esc(person.username)+'</small>':'';
const threshold=tier=>tier?cardCategories[tier]+(tier===cardCategories.length-1?' only':'+'):'Any difficulty';
const finishOptions=(empty=false)=>(empty?'<option value="">All finishes</option>':'')+
 Object.entries(finishLabels).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('');
const difficultyOptions=(mode,hasSecrets)=>'<option value="'+(mode==='setting'?'0':'')+'">Any difficulty</option>'+
 cardCategories.map((name,i)=>mode==='setting'&&!i||i===cardCategories.length-1&&!hasSecrets?'':'<option value="'+i+'">'+(mode==='setting'?threshold(i):name)+'</option>').join('');
const pagination=(page,more)=>page||more?'<div class="trade-pagination"><button type="button" class="outline" data-trade-page="-1" '+(page?'':'disabled')+'>Previous</button><span>Page '+(page+1)+'</span><button type="button" class="outline" data-trade-page="1" '+(more?'':'disabled')+'>Next</button></div>':'';

export function createTrading(root,{coverSource,syncWallet}){
 let active;
 return {show(locked,tradeId){
  active?.dispose();
  if(locked){
   active=null;
   root.innerHTML='<section class="trade-room" aria-labelledby="tradeTitle"><h1 id="tradeTitle">Trading</h1>'+
    '<div class="level-gate"><span class="level-gate-icon">'+ico('lock')+'</span><div><p>'+tradeLevelNotice+'</p>'+
    '<a class="primary" href="#gacha">Keep playing</a></div></div></section>';
   return;
  }
  root.innerHTML='<section class="trade-room" aria-labelledby="tradeTitle"><div class="trade-title"><div><h1 id="tradeTitle">Trading</h1><p>'+tradeLevelNotice+'</p></div>'+
   '<button class="outline trade-settings-button" type="button" data-trade-settings>'+ico('spark')+' Trade settings</button></div>'+
   '<nav class="trade-tabs" aria-label="Trading sections">'+tabs.map(([key,title])=>'<button type="button" data-trade-tab="'+key+'" aria-pressed="false">'+title+
    (key==='incoming'||key==='outgoing'?'<span data-trade-count="'+key+'" hidden></span>':'')+'</button>').join('')+'</nav>'+
    '<div class="trade-content" data-trade-content></div><dialog class="player-dialog trade-dialog" aria-labelledby="tradeDialogTitle">'+
    '<div class="player-dialog-head"><h2 id="tradeDialogTitle"></h2><button class="iconbtn" data-close-trade type="button" aria-label="Close">'+ico('x')+'</button></div><div class="player-dialog-body" data-trade-dialog></div></dialog></section>';
  active=createRoom(root.querySelector('.trade-room'),coverSource,syncWallet,tradeId);
 },leave(){active?.dispose();active=null;},refresh(){active?.refresh();}};
}

function createRoom(room,cover,syncWallet,tradeId){
 const content=room.querySelector('[data-trade-content]'),dialog=room.querySelector('dialog');
 const title=dialog.querySelector('h2'),body=dialog.querySelector('[data-trade-dialog]');
 const counts=Object.fromEntries(['incoming','outgoing'].map(key=>[key,room.querySelector('[data-trade-count="'+key+'"]')]));
 let section='find',isOpen=true,readVersion=0,modalVersion=0,refreshing=false;
 let settings=tradePreferences(),settingsVersion=0,recentCounts='',busy=false,viewPage=0,dialogState,nextExpiry=Infinity;
 let query='',found=null,marketTerm='',marketTier='',marketFinish='standard';
 let partner,draft,available=[],hasSecrets=false;
 let filterTimer=0;
 const current=request=>isOpen&&request===readVersion;
 const modalCurrent=request=>isOpen&&dialog.open&&request===modalVersion;
 const drawCards=(cards,controls=()=>'',moves=true,marketView=false)=>'<div class="trade-card-grid">'+cards.map(card=>tradeCardHTML(card,cover,controls(card),moves,marketView)).join('')+'</div>';
 const nav=()=>{
  for(const button of room.querySelectorAll('[data-trade-tab]'))button.setAttribute('aria-pressed',String(button.dataset.tradeTab===section));
 };
 function drawFind(){
  content.innerHTML='<section class="trade-panel trade-find"><h2>Find player</h2>'+
   (!settings.enabled?'<p class="trade-empty">Trading is disabled for your account. <button type="button" class="outline" data-trade-settings>Open Trade settings</button></p>':'<form class="trade-search" data-find-player><label>Discord username or ID'+
    '<input type="search" name="query" value="'+esc(query)+'" placeholder="Username, display name, or Discord ID" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="80" required></label>'+
    '<button type="submit" class="primary">Find player</button></form><div data-trade-results aria-live="polite"></div>')+'</section>';
  if(settings.enabled)drawPlayers();
 }
 function drawPlayers(){
  const list=content.querySelector('[data-trade-results]');
  if(!list||found===null)return;
  list.innerHTML=found.length?'<ul class="trade-list">'+found.map(player=>'<li><button class="trade-list-row" type="button" data-trade-player="'+player.id+'">'+
   avatar(player)+'<span class="trade-player-name"><strong>'+esc(player.name)+'</strong>'+playerHandle(player)+
   '</span><span class="trade-list-meta">Level '+player.level+'</span>'+ico('right')+'</button></li>').join('')+'</ul>':textStatus('No available players found.');
 }
 async function findPlayers(form){
  const input=form.elements.query;
  query=tradeSearchTerm(input.value);
  if(!query)return;
  input.value=query;
  const request=++readVersion,output=content.querySelector('[data-trade-results]');
  output.innerHTML=textStatus('Searching…');
  try{
   const {players}=await tradeRead('find',{q:query});
   if(current(request)){found=players;drawPlayers();}
  }catch(error){if(current(request))output.innerHTML=textStatus(error.message);}
 }
 async function choosePlayer(id){
  const request=++readVersion;
  const output=content.querySelector('[data-trade-results]');
  try{
   const match=await tradeRead('partner',{id});
   if(!current(request))return;
   partner=match;
   draft={give:new Map(),get:new Map()};
   drawComposer();
   content.querySelector('[data-add-from="give"]').focus();
  }catch(error){if(current(request)){partner=null;output.insertAdjacentHTML('afterbegin',textStatus(error.message));}}
 }
 function composeSide(side,label,button){
  return '<section class="trade-side trade-panel" data-trade-side="'+side+'"><div class="trade-side-heading"><div><h3>'+label+'</h3><small>'+esc(threshold(partner.minimum[side]))+'</small></div>'+
   '<button type="button" class="outline" data-add-from="'+side+'">'+button+'</button></div><div data-draft-cards></div><div class="trade-side-total">'+
   '<span data-side-count></span><span>Trade value <strong data-side-value></strong></span></div></section>';
 }
 function drawComposer(){
  const {player}=partner;
  content.innerHTML='<section class="trade-composer"><div class="trade-composer-head"><div><button class="outline trade-back" type="button" data-trade-back>'+ico('left')+' Find player</button>'+
   '<div class="trade-partner">'+avatar(player)+'<div><h2>Trade with '+esc(player.name)+'</h2><p>'+esc(accountName(player))+(player.username?' · ':'')+'Level '+player.level+'</p></div></div></div></div>'+
   '<div class="trade-columns">'+composeSide('give','You offer','Add your cards')+composeSide('get','You receive','Browse their cards')+'</div>'+
   '<div class="trade-send"><div><p class="trade-balance" data-trade-balance aria-live="polite"></p><p>Training stays with each player.</p><p class="trade-action-status" data-trade-status role="status"></p></div>'+
   '<button class="primary" type="button" data-propose>Send offer</button></div></section>';
  paintDraft();
 }
 function paintDraft(){
  if(!draft||!content.querySelector('[data-propose]'))return;
  const [give,get]=directions.map(side=>tradeBundleTotal([...draft[side].values()]));
  for(const [i,side] of directions.entries()){
   const panel=content.querySelector('[data-trade-side="'+side+'"]'),cards=[...draft[side].values()],count=total(cards);
   panel.querySelector('[data-side-count]').textContent=count+' / '+tradeCardLimit+' cards';
   panel.querySelector('[data-side-value]').textContent=tradePoints(i===0?give:get);
   panel.querySelector('[data-draft-cards]').innerHTML=cards.length?drawCards(cards,card=>{
    const key=tradeKey(card);
    return '<div class="trade-adjust"><button type="button" data-card-amount="-1" data-side="'+side+'" data-card-key="'+key+'" aria-label="Remove one '+esc(card.title)+'">−</button><b>'+card.count+'</b>'+
     '<button type="button" data-card-amount="1" data-side="'+side+'" data-card-key="'+key+'" aria-label="Add one '+esc(card.title)+'" '+(card.count>=card.owned||count>=tradeCardLimit?'disabled':'')+'>+</button></div>';
   },false):textStatus(side==='give'?'Choose the cards you’ll offer.':'Choose the cards you want in return.');
  }
  const hasBoth=draft.give.size>0&&draft.get.size>0,balance=tradeBalance(give,get);
  const label=content.querySelector('[data-trade-balance]');
  label.dataset.balanced=hasBoth?String(balance.allowed):'';
  label.textContent=!hasBoth?balanceLabel:balance.allowed?'Balanced · '+balancePercent(balance.gap)+' apart':
   'Add at least '+tradePoints(balance.shortfall)+' to '+(give<get?'your offer':'your request')+' to reach the '+tradeMaxGap+'% limit.';
  content.querySelector('[data-propose]').disabled=busy||!hasBoth||!balance.allowed;
 }
 function changeDraft(side,key,amount,card=draft[side].get(key)){
  if(!card)return;
  const prior=draft[side].get(key)?.count||0;
  if(amount>0&&(prior>=card.owned||total([...draft[side].values()])>=tradeCardLimit))return;
  if(prior+amount>0)draft[side].set(key,{...card,count:prior+amount});
  else draft[side].delete(key);
  paintDraft();
 }
 async function propose(){
  if(busy||!partner||!content.querySelector('[data-propose]:enabled'))return;
  busy=true;paintDraft();
  const status=content.querySelector('[data-trade-status]');
  status.textContent='Sending offer…';
  const simple=side=>[...draft[side].values()].map(({id,finish,count})=>({id,finish,count}));
  try{
   const {trade}=await tradeCommand('propose',{player:partner.player.id,offered:simple('give'),requested:simple('get')});
   if(!isOpen||!status.isConnected)return;
   activate('outgoing');
   openTrade(trade.id,trade);
   refresh();
  }catch(error){if(status.isConnected)status.textContent=error.message;}
  finally{busy=false;paintDraft();}
 }
 function openDialog(name){
  title.textContent=name;body.replaceChildren();
  if(!dialog.open)dialog.showModal();
  dialog.scrollTop=0;
  return ++modalVersion;
 }
 function picker(side){
  const {player}=partner;
  const heading=side==='give'?'Your collection':player.name+'’s collection';
  const request=openDialog(heading);
  dialogState={type:'picker',side,page:0,term:'',finish:'',difficulty:''};
  body.innerHTML='<form class="trade-search trade-card-search" data-pick-filter><label>Find a card<input name="query" type="search" placeholder="Name or level ID" maxlength="80"></label>'+
   '<label>Difficulty<select name="tier">'+difficultyOptions('market',hasSecrets)+'</select></label><label>Finish<select name="finish">'+finishOptions(true)+'</select></label><button type="submit" class="primary">Search</button></form>'+
   '<p class="trade-filter-note">'+esc(threshold(partner.minimum[side]))+' · <span data-picked-count></span></p><div data-picker-results></div>'+
   '<div class="trade-dialog-foot"><button class="primary" type="button" data-close-trade>Done</button></div>';
  body.querySelector('input').focus();
  loadPicker(request);
 }
 function paintPicker(cards){
  const {side,page,more}=dialogState,selected=draft[side],count=total([...selected.values()]);
  body.querySelector('[data-picked-count]').textContent=count+' / '+tradeCardLimit+' selected';
  body.querySelector('[data-picker-results]').innerHTML=(cards.length?drawCards(cards,card=>{
   const key=tradeKey(card),chosen=selected.get(key)?.count||0;
   const other=side==='give'?'get':'give',overlap=draft[other].has(key);
   const disabled=Boolean(card.locked||overlap||chosen>=card.owned||count>=tradeCardLimit);
   return '<button type="button" class="outline trade-card-add" data-pick-card="'+key+'" aria-label="Add '+esc(card.title)+' '+finishLabels[card.finish]+'" '+(disabled?'disabled':'')+'>'+
    (overlap?'On the other side':chosen?chosen+' selected'+(disabled?'':' · Add one'):'Add card')+'</button>';
  }):textStatus('No matching cards in this collection.'))+pagination(page,more);
 }
 async function loadPicker(request=++modalVersion){
  const state=dialogState;
  body.querySelector('[data-picker-results]').innerHTML=loadingMarkup('Loading cards…');
  try{
   const {cards,more}=await tradeRead('collection',{id:partner.player.id,side:state.side,q:state.term,finish:state.finish,page:state.page,...(state.difficulty?{tier:state.difficulty}:{})});
   if(modalCurrent(request)){available=cards;state.more=more;paintPicker(cards);}
  }catch(error){if(modalCurrent(request))body.querySelector('[data-picker-results]').innerHTML=textStatus(error.message);}
 }
 function drawList(){
  const name=tabs.find(([key])=>key===section)[1];
  content.innerHTML='<section class="trade-panel"><div class="trade-panel-heading"><h2>'+name+(section==='history'?'':' trades')+'</h2>'+
   '<button class="outline" type="button" data-reload-trades>Refresh</button></div><div data-trade-results></div></section>';
  loadList();
 }
 async function loadList(quiet=false){
  const request=++readVersion,view=section,output=content.querySelector('[data-trade-results]');
  if(!output)return;
  if(!quiet)output.innerHTML=loadingMarkup('Loading trades…');
  try{
   const {trades,more}=await tradeRead(view,{page:viewPage});
   if(!current(request))return;
   nextExpiry=Math.min(...trades.filter(trade=>trade.status==='pending').map(trade=>trade.expiresAt),Infinity);
   if(!trades.length&&viewPage>0){viewPage--;loadList();return;}
   const empty={incoming:'You have no incoming trades.',outgoing:'You have no outgoing trades.',history:'Your trade history is empty.'};
   const markup=(trades.length?'<ul class="trade-list">'+trades.map(trade=>'<li><button class="trade-list-row" type="button" data-trade-open="'+trade.id+'">'+
    avatar(trade.player)+'<span class="trade-player-name"><strong>'+esc(trade.player.name)+'</strong>'+
    '<small>'+trade.giveCount+(trade.status==='completed'?' given · ':' offered · ')+trade.getCount+(trade.status==='completed'?' received':' requested')+
    '</small></span><span class="trade-state" data-state="'+trade.status+'">'+statuses[trade.status]+'</span><span class="trade-list-meta">'+
    (trade.status==='pending'?'Expires '+time(trade.expiresAt):time(trade.resolvedAt||trade.createdAt))+'</span>'+ico('right')+'</button></li>').join('')+'</ul>':textStatus(empty[view]))+pagination(viewPage,more);
   const focused=output.contains(document.activeElement)&&document.activeElement.dataset.tradeOpen;
   output.innerHTML=markup;
   if(focused)output.querySelector('[data-trade-open="'+focused+'"]')?.focus({preventScroll:true});
  }catch(error){if(current(request)&&!quiet)output.innerHTML=textStatus(error.message);}
 }
 function receiptSide(label,cards){
  return '<section class="trade-panel trade-receipt-side"><div class="trade-side-heading"><div><h3>'+label+' <span>('+total(cards)+')</span></h3><small>Trade value '+tradePoints(tradeBundleTotal(cards))+'</small></div></div>'+
   drawCards(cards)+'</section>';
 }
 function drawTrade(trade){
  dialogState={type:'detail',trade};
  const {status,player,direction,createdAt,expiresAt,resolvedAt}=trade,done=status==='completed';
  title.textContent='Trade with '+player.name;
  const message=status==='pending'?(direction==='incoming'?'Offer received':'Offer sent'):'Trade '+status;
  const meta=status==='pending'?'Expires '+time(expiresAt):time(resolvedAt||createdAt);
  const labels=done?['You gave','You got']:status==='pending'?['You offer','You receive']:['You offered','You requested'];
  const balance=tradeBalance(tradeBundleTotal(trade.give),tradeBundleTotal(trade.get));
  const outsideLimit=Number.isFinite(balance.gap)&&!balance.allowed;
  body.innerHTML='<div class="trade-receipt-banner" data-state="'+status+'"><span>'+ico(done?'check':'exchange')+'</span><div><strong>'+message+'</strong><small>'+meta+'</small></div></div>'+
   '<div class="trade-receipt-reference">'+avatar(player)+'<div><b>'+esc(player.name)+'</b>'+playerHandle(player)+'</div><span>#'+trade.id.slice(0,8).toUpperCase()+'</span></div>'+
   '<div class="trade-columns">'+receiptSide(labels[0],trade.give)+receiptSide(labels[1],trade.get)+'</div>'+
   (status==='pending'?(outsideLimit?'<p class="trade-balance trade-receipt-balance" data-balanced="false">This offer is outside the '+tradeMaxGap+'% value limit.</p>':'')+
    '<div class="trade-dialog-foot"><p class="trade-action-status" data-resolve-status role="status"></p>'+(direction==='incoming'?'<button type="button" class="outline" data-resolve="decline">Decline</button>'+
    '<button type="button" class="primary" data-resolve="accept" '+(settings.enabled&&!outsideLimit?'':'disabled')+'>Accept trade</button>':'<button type="button" class="outline" data-resolve="cancel">Cancel offer</button>')+'</div>':'');
 }
 async function openTrade(id,cached,linked=false){
  const request=openDialog('Trade details');
  if(cached){drawTrade(cached);return;}
  dialogState=null;body.innerHTML=loadingMarkup('Loading trade…');
  try{
   const {trade}=await tradeRead('detail',{id});
   if(modalCurrent(request)){
    if(linked)activate(trade.status==='pending'?trade.direction:'history');
    drawTrade(trade);
   }
  }catch(error){if(modalCurrent(request))body.innerHTML=textStatus(error.message);}
 }
 async function resolve(action){
  if(busy||dialogState?.type!=='detail')return;
  const {trade}=dialogState,request=modalVersion;
  busy=true;
  const buttons=[...body.querySelectorAll('[data-resolve]:enabled')];
  for(const button of buttons)button.disabled=true;
  const status=body.querySelector('[data-resolve-status]');
  status.textContent=action==='accept'?'Exchanging cards…':'Saving…';
  try{
   const result=await tradeCommand(action,{id:trade.id});
   if(action==='accept')syncWallet();
   if(modalCurrent(request)){
    drawTrade(result.trade);
    dialog.scrollTop=0;
    dialog.querySelector('[data-close-trade]').focus({preventScroll:true});
   }
   if(isOpen){if(['incoming','outgoing','history'].includes(section))loadList(true);refresh();}
  }catch(error){if(modalCurrent(request))status.textContent=error.message;}
  finally{
   busy=false;
   for(const button of buttons)button.disabled=button.dataset.resolve==='accept'&&!settings.enabled;
  }
 }
 function drawMarket(){
  content.innerHTML='<section class="trade-panel"><div class="trade-panel-heading"><h2>Card market</h2></div>'+
   '<p class="trade-market-note">Market values use completed exchanges in the last '+marketDays+' days and appear after '+marketMinPairs+' different trading pairs. Trade offers use each card’s base strength and finish.</p>'+
   '<form class="trade-search trade-market-search" data-market-filter><label>Find a card<input type="search" name="query" placeholder="Name or level ID" maxlength="80" value="'+esc(marketTerm)+'"></label>'+
   '<label>Difficulty<select name="tier">'+difficultyOptions('market',hasSecrets)+'</select></label><label>Finish<select name="finish">'+finishOptions()+'</select></label><button type="submit" class="primary">Search</button></form>'+
   '<div data-trade-results></div></section>';
  const filters=content.querySelector('form').elements;
  filters.tier.value=marketTier;filters.finish.value=marketFinish;
  loadMarket();
 }
 async function loadMarket(){
  const request=++readVersion,output=content.querySelector('[data-trade-results]');
  output.innerHTML=loadingMarkup('Loading market…');
  try{
   const data=await tradeRead('market',{q:marketTerm,finish:marketFinish,page:viewPage,...(marketTier?{tier:marketTier}:{})});
   if(current(request)){
    setSecretAccess(data.hasSecrets);
    output.innerHTML=(data.cards.length?drawCards(data.cards,()=>'',false,true):textStatus('No matching cards.'))+pagination(viewPage,data.more);
   }
  }catch(error){if(current(request))output.innerHTML=textStatus(error.message);}
 }
 function openSettings(){
  openDialog('Trade settings');
  dialogState={type:'settings'};
  body.innerHTML='<form class="trade-settings" data-save-trade-settings><label class="profile-privacy"><span><b>Allow trades</b><small>Let players find you, browse your cards, and send offers.</small></span><input type="checkbox" name="enabled" '+(settings.enabled?'checked':'')+'></label>'+
   '<label class="trade-minimum">Minimum difficulty you receive<select name="minimum">'+difficultyOptions('setting',hasSecrets||settings.minimum===cardCategories.length-1)+'</select></label>'+
   '<div class="trade-dialog-foot"><p class="trade-action-status" data-settings-status role="status"></p><button class="primary" type="submit">Save settings</button></div></form>';
  body.querySelector('select').value=String(settings.minimum);
 }
 async function saveSettings(form){
  if(busy)return;
  const request=modalVersion,enabled=form.elements.enabled.checked,minimum=Number(form.elements.minimum.value);
  const status=form.querySelector('[data-settings-status]');
  busy=true;form.querySelector('button[type="submit"]').disabled=true;
  try{
   const {wallet}=await gameCommand('trade.settings',{enabled,minimum},'trade');
   settingsVersion++;
   settings=tradePreferences(wallet);
   if(modalCurrent(request))status.textContent='Settings saved.';
   if(isOpen&&section==='find'){found=null;partner=null;draft=null;drawFind();}
   refresh();
  }catch(error){if(modalCurrent(request))status.textContent=error.message;}
  finally{busy=false;form.querySelector('button[type="submit"]').disabled=false;}
 }
 function activate(view){
  clearTimeout(filterTimer);readVersion++;section=view;viewPage=0;nextExpiry=Infinity;partner=null;draft=null;nav();
  if(view==='find')drawFind();
  else if(view==='market')drawMarket();
  else drawList();
 }
 function setSecretAccess(allowed){
  if(typeof allowed!=='boolean'||hasSecrets===allowed)return;
  hasSecrets=allowed;
  const select=content.querySelector('[data-market-filter] select[name="tier"]');
  if(!select)return;
  select.innerHTML=difficultyOptions('market',hasSecrets);
  if(!hasSecrets&&Number(marketTier)===cardCategories.length-1)marketTier='';
  select.value=marketTier;
 }
 function marketFilter(form){
  clearTimeout(filterTimer);
  marketTerm=form.elements.query.value.trim();marketTier=form.elements.tier.value;marketFinish=form.elements.finish.value;viewPage=0;loadMarket();
 }
 function pickerFilter(form){
  clearTimeout(filterTimer);
  if(dialogState?.type!=='picker')return;
  Object.assign(dialogState,{page:0,term:form.elements.query.value.trim(),finish:form.elements.finish.value,difficulty:form.elements.tier.value});
  loadPicker();
 }
 async function refresh(){
  if(refreshing||!isOpen||document.hidden||room.closest('#gameMain')?.hidden)return;
  refreshing=true;
  const saved=settingsVersion;
  try{
   const latest=await tradeRead('overview');
   if(!isOpen)return;
   const old=settings;
   if(saved===settingsVersion)settings=latest.settings;
   setSecretAccess(latest.hasSecrets);
   if(old.enabled!==settings.enabled&&section==='find'){
    if(dialogState?.type==='picker')dialog.close();
    readVersion++;partner=null;draft=null;found=null;drawFind();
   }
   for(const [key,node] of Object.entries(counts)){
    node.textContent=tradeNumber(latest[key]);node.hidden=!latest[key];
   }
   const next=[latest.incoming,latest.outgoing].join(':'),now=Date.now();
   if((recentCounts&&next!==recentCounts||now>=nextExpiry)&&['incoming','outgoing','history'].includes(section)&&!busy)loadList(true);
   const open=dialogState?.trade;
   if(!busy&&open?.status==='pending'&&open.expiresAt<=now)openTrade(open.id);
   recentCounts=next;
  }catch{
   // The next refresh or a direct action can recover from a transient connection error.
  }finally{refreshing=false;}
 }
 room.addEventListener('error',event=>{
  if(event.target.matches?.('[data-trade-cover],.trade-player-initial img'))event.target.hidden=true;
 },true);
 room.addEventListener('submit',event=>{
  const form=event.target;
  event.preventDefault();
  if(form.matches('[data-find-player]'))findPlayers(form);
  if(form.matches('[data-market-filter]'))marketFilter(form);
  if(form.matches('[data-pick-filter]'))pickerFilter(form);
  if(form.matches('[data-save-trade-settings]'))saveSettings(form);
 });
 room.addEventListener('change',event=>{
  const form=event.target.form;
  if(!event.target.matches('select'))return;
  if(form?.matches('[data-market-filter]'))marketFilter(form);
  if(form?.matches('[data-pick-filter]'))pickerFilter(form);
 });
 room.addEventListener('input',event=>{
  const form=event.target.form;
  if(event.target.name!=='query'||!form?.matches('[data-market-filter],[data-pick-filter]'))return;
  clearTimeout(filterTimer);
  filterTimer=setTimeout(()=>{
   if(form.isConnected)(form.matches('[data-market-filter]')?marketFilter:pickerFilter)(form);
  },230);
 });
 room.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button)return;
  if(button.hasAttribute('data-close-trade')){dialog.close();return;}
  if(button.hasAttribute('data-trade-settings')){openSettings();return;}
  if(button.dataset.tradeTab){activate(button.dataset.tradeTab);return;}
  if(button.dataset.tradePlayer){choosePlayer(button.dataset.tradePlayer);return;}
  if(button.hasAttribute('data-trade-back')){activate('find');return;}
  if(button.dataset.addFrom){picker(button.dataset.addFrom);return;}
  if(button.hasAttribute('data-propose')){propose();return;}
  if(button.dataset.tradeOpen){openTrade(button.dataset.tradeOpen);return;}
  if(button.dataset.resolve){resolve(button.dataset.resolve);return;}
  if(button.hasAttribute('data-reload-trades')){loadList();refresh();return;}
  if(button.dataset.tradePage){
   const step=Number(button.dataset.tradePage);
   if(dialog.contains(button)){dialogState.page+=step;loadPicker();}
   else{viewPage+=step;if(section==='market')loadMarket();else loadList();}
   return;
  }
  if(button.dataset.pickCard){
   const key=button.dataset.pickCard,card=available.find(item=>tradeKey(item)===key);
   changeDraft(dialogState.side,key,1,card);
   paintPicker(available);
   (body.querySelector('[data-pick-card="'+key+'"]:enabled')||body.querySelector('.trade-dialog-foot button')).focus({preventScroll:true});
   return;
  }
  if(button.dataset.cardAmount){
   const {side,cardKey,cardAmount}=button.dataset;
   changeDraft(side,cardKey,Number(cardAmount));
   (content.querySelector('[data-card-key="'+cardKey+'"][data-side="'+side+'"][data-card-amount="'+cardAmount+'"]:enabled')||
    content.querySelector('[data-add-from="'+side+'"]')).focus({preventScroll:true});
  }
 });
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  clearTimeout(filterTimer);modalVersion++;dialogState=null;
  if(isOpen&&tradeId&&location.hash.toLowerCase()==='#trading/trade/'+tradeId)history.replaceState(history.state,'','#trading');
 });
 activate('find');refresh();
 if(tradeId)openTrade(tradeId,null,true);
 const timer=setInterval(refresh,12000);
 document.addEventListener('visibilitychange',refresh);
 return {dispose(){isOpen=false;clearInterval(timer);clearTimeout(filterTimer);document.removeEventListener('visibilitychange',refresh);if(dialog.open)dialog.close();},refresh};
}
