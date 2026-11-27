import {
 achievementBoostLabels,achievementBoosts,achievementById,achievementCount,achievementMaterial,achievementProgress,achievements
} from './progression-rules.js';
import {playerProgress} from './player-progression.js';
import {nextUnlocks} from './level-access.js';
import {dropAccessSummary} from './drop-access.js';
import {ico} from './icons.js';
import {gameRead} from './game-client.js';

const number=new Intl.NumberFormat('en-US');
const percent=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const groups=[...new Set(achievements.map(item=>item.group))];
const allStages=achievements.flatMap(item=>item.stages);
const difficultyFaces={Easy:'easy',Normal:'normal',Hard:'hard',Harder:'harder',Insane:'insane',Demon:'demon-extreme'};
const groupIcons={Cards:'pack',Battle:'battle',Training:'aim',Kingdom:'tower','Coin mine':'mine'};
const names={overview:'Overview',achievements:'Achievements'};
const materialFor=(item,stage)=>achievementMaterial(stage.stage,item.stages.length);
const materialAttr=material=>' data-achievement-material="'+material.toLowerCase()+'"';
const isEarned=(stage,earned)=>Object.hasOwn(earned,stage.id);

function badge(item,material,earned){
 let art=item.icon?'<img src="'+item.icon+'" alt="">':ico(item.symbol||'crown');
 if(art.startsWith('<svg')){
  const source=encodeURIComponent(art.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));
  art='<span class="achievement-glyph" style="--glyph:url(\'data:image/svg+xml,'+source+'\')"></span>';
 }
 return '<span class="achievement-badge"'+materialAttr(material)+' data-badge-earned="'+earned+'" aria-hidden="true">'+art+'</span>';
}
function difficulty(stage){
 const face=difficultyFaces[stage.difficulty];
 return '<span class="achievement-difficulty" data-difficulty="'+face+'"><img src="/assets/faces/'+face+'.webp" alt="">'+stage.difficulty+'</span>';
}
function boostLabel({key,percent:amount}){
 return '+'+percent.format(amount)+'% '+achievementBoostLabels[key];
}
function rewards(stage){
 return '<span class="achievement-rewards"><b>+'+number.format(stage.xp)+' XP</b><span>'+boostLabel(stage.boost)+'</span>'+
  keyReward(stage.keys)+'</span>';
}
function keyReward(keys){
 return keys?'<span class="achievement-keys">+'+number.format(keys)+' Demon '+(keys===1?'Key':'Keys')+'</span>':'';
}
function stageProgress(item,stage,count,earned){
 const value=isEarned(stage,earned)?stage.goal:Math.min(stage.goal,count);
 return '<div class="achievement-track"><progress max="'+stage.goal+'" value="'+value+'" aria-label="'+item.name+' stage '+stage.stage+' progress"></progress>'+
  '<span>'+number.format(value)+' / '+number.format(stage.goal)+'</span></div>';
}
function communityCount(stats,stage){
 const owners=stats.earned[stage.id]||0,share=stats.players?owners/stats.players*100:0;
 return number.format(owners)+' '+(owners===1?'player':'players')+' · '+(share>0&&share<.01?'&lt;0.01':percent.format(share))+'%';
}
function achievementTile(item,stage,progress,earned){
 const highest=item.stages.findLast(entry=>isEarned(entry,earned)),metal=materialFor(item,highest||item.stages[0]);
 const earnedCount=item.stages.filter(entry=>isEarned(entry,earned)).length;
 const count=achievementCount(item,progress),value=isEarned(stage,earned)?stage.goal:Math.min(stage.goal,count);
 const complete=earnedCount===item.stages.length;
 return '<button class="achievement-tile" type="button" data-achievement-badge="'+item.id+'"'+materialAttr(metal)+
  ' data-complete="'+complete+'" aria-haspopup="dialog" aria-label="'+item.name+', '+earnedCount+' of '+item.stages.length+' stages earned">'+
  badge(item,metal,Boolean(highest))+'<strong>'+item.name+'</strong><span class="achievement-tile-material">'+metal+'</span>'+
  '<span class="achievement-pips" aria-hidden="true">'+item.stages.map(entry=>'<i'+materialAttr(materialFor(item,entry))+
   ' data-earned="'+isEarned(entry,earned)+'"></i>').join('')+'</span>'+
  '<span class="achievement-tile-progress" style="--progress:'+(100*value/stage.goal)+'%" aria-hidden="true"></span></button>';
}
function achievementStage(item,stage,count,earned,next,stats){
 const complete=isEarned(stage,earned),metal=materialFor(item,stage);
 const state=complete?'earned':stage===next?'current':'upcoming';
 return '<li class="achievement-stage"'+materialAttr(metal)+' data-state="'+state+'">'+badge(item,metal,complete)+
  '<div><div class="achievement-stage-meta"><strong>'+metal+'</strong><span class="achievement-stage-number">Stage '+stage.stage+'</span>'+difficulty(stage)+'</div>'+
  '<p>'+stage.description+'</p>'+stageProgress(item,stage,count,earned)+rewards(stage)+'</div>'+
  '<div class="achievement-stage-status"><span class="achievement-'+(complete?'earned':'unearned')+'">'+
  (complete?ico('check')+' Earned':stage===next?'Next stage':'Upcoming')+'</span>'+
  (stats?'<span class="achievement-stage-community">'+communityCount(stats,stage)+'</span>':'')+'</div></li>';
}
function options(values,selected){
 return Object.entries(values).map(([value,label])=>'<option value="'+value+'"'+(value===selected?' selected':'')+'>'+label+'</option>').join('');
}
function filterSelect(key,label,values,selected){
 return '<label><span>'+label+'</span><select name="'+key+'">'+options(values,selected)+'</select></label>';
}

export function createProgression(root){
 let wallet,active=null,rootPanel,summary,shell,board,filters,result;
 let selection={category:'all',difficulty:'all',status:'all'};
 let openedBadge,opener,statistics,statisticsRequest,statisticsError,statisticsUpdated=0;
 const renderCache=new WeakMap();
 const dialog=document.createElement('dialog');
 dialog.className='achievement-dialog';
 dialog.setAttribute('aria-labelledby','achievementBadgeTitle');
 dialog.innerHTML='<div class="achievement-dialog-panel"><button type="button" class="iconbtn achievement-close" aria-label="Close badge" autofocus>'+ico('x')+'</button>'+
  '<div class="achievement-hero" data-badge-hero></div><div class="achievement-community" data-badge-community aria-live="polite"></div>'+
  '<div class="achievement-ladder-heading"><h3>Badge stages</h3><div><span data-badge-range></span><span data-badge-count></span></div></div>'+
  '<ol class="achievement-ladder" role="list" data-badge-ladder></ol></div>';
 document.body.append(dialog);
 const panel=dialog.querySelector('.achievement-dialog-panel');
 const closeBadge=dialog.querySelector('.achievement-close');
 const hero=dialog.querySelector('[data-badge-hero]'),community=dialog.querySelector('[data-badge-community]');
 const badgeRange=dialog.querySelector('[data-badge-range]'),badgeCount=dialog.querySelector('[data-badge-count]');
 const ladder=dialog.querySelector('[data-badge-ladder]');
 function fill(node,html){
  if(renderCache.get(node)===html)return false;
  node.innerHTML=html;renderCache.set(node,html);return true;
 }
 function renderBadge(){
  if(!openedBadge||!wallet)return;
  const item=openedBadge,earned=wallet.achievements||{};
  const count=achievementCount(item,achievementProgress(wallet));
  const won=item.stages.filter(stage=>isEarned(stage,earned));
  const highest=won.at(-1),next=item.stages.find(stage=>!isEarned(stage,earned));
  const metal=materialFor(item,highest||item.stages[0]);
  hero.dataset.achievementMaterial=metal.toLowerCase();
  fill(hero,badge(item,metal,Boolean(highest))+'<div><span class="achievement-hero-category">'+item.group+'</span>'+
   '<h2 id="achievementBadgeTitle">'+item.name+'</h2><p>'+(!highest?'First stage · '+metal:next?metal+' earned':'Completed · '+metal)+'</p></div>');
  fill(community,statistics?'<span>Players who earned this badge</span><strong>'+communityCount(statistics,item.stages[0])+'</strong>':
   statisticsError?'<span>Player counts unavailable</span><button type="button" class="outline" data-badge-retry>Retry</button>':
   '<span>Loading player counts…</span>');
  badgeRange.textContent=item.stages.length>1?materialFor(item,item.stages[0])+' → '+materialFor(item,item.stages.at(-1)):'';
  badgeCount.textContent=won.length+' / '+item.stages.length+' earned';
  fill(ladder,item.stages.map(stage=>achievementStage(item,stage,count,earned,next,statistics)).join(''));
 }
 function loadStatistics(){
  if(statisticsRequest||Date.now()-statisticsUpdated<30_000)return;
  statisticsError=false;
  statisticsRequest=gameRead('achievement-stats').then(data=>{
   statistics=data;statisticsUpdated=Date.now();
  }).catch(()=>{statisticsError=true;}).finally(()=>{
   statisticsRequest=null;
   if(dialog.open)renderBadge();
  });
 }
 root.addEventListener('click',event=>{
  if(!active||!wallet)return;
  const button=event.target.closest('[data-achievement-badge]');
  if(!button)return;
  const item=achievementById(button.dataset.achievementBadge);
  if(!item)return;
  openedBadge=item;opener=button;
  loadStatistics();renderBadge();dialog.showModal();panel.scrollTop=0;
 });
 closeBadge.onclick=()=>dialog.close();
 dialog.addEventListener('click',event=>{
  if(event.target===dialog)dialog.close();
  if(event.target.closest('[data-badge-retry]')){loadStatistics();renderBadge();closeBadge.focus({preventScroll:true});}
 });
 dialog.addEventListener('close',()=>{
  openedBadge=null;
  const id=opener?.dataset.achievementBadge;
  if(opener?.isConnected)opener.focus({preventScroll:true});
  else if(id)root.querySelector('[data-achievement-badge="'+CSS.escape(id)+'"]')?.focus({preventScroll:true});
  opener=null;
 });
 function show(view){
  if(!shell?.isConnected){
   root.innerHTML='<section class="progression-room"><div class="progression-title"><div><h1>Progression</h1></div><div data-achievement-overall></div></div>'+
    '<nav aria-label="Progression sections" class="progression-tabs">'+Object.entries(names).map(([key,name])=>'<a href="#progression'+(key==='overview'?'':'/'+key)+'" data-progress-view="'+key+'">'+name+'</a>').join('')+'</nav>'+
    '<div data-progress-content></div></section>';
   shell=root.querySelector('.progression-room');
   rootPanel=shell.querySelector('[data-progress-content]');
   summary=shell.querySelector('[data-achievement-overall]');
  }
  active=view;
  if(rootPanel.dataset.view!==view){
   rootPanel.dataset.view=view;renderCache.delete(rootPanel);
   if(view==='achievements')buildAchievementPane();
  }
  for(const link of shell.querySelectorAll('[data-progress-view]')){
   if(link.dataset.progressView===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
  render();
 }
 function buildAchievementPane(){
  rootPanel.innerHTML='<section class="achievement-library" aria-label="Achievements">'+
   '<div class="achievement-tools"><div class="achievement-tools-copy"><h2>Achievement badges</h2><p>Earn XP, Demon Keys and permanent boosts at each stage.</p></div>'+
   '<div class="achievement-filters" role="group" aria-label="Filter achievements">'+
   filterSelect('category','Category',{all:'All categories',...Object.fromEntries(groups.map(group=>[group,group]))},selection.category)+
   filterSelect('difficulty','Difficulty',{all:'All difficulties',...Object.fromEntries(Object.keys(difficultyFaces).map(label=>[label,label]))},selection.difficulty)+
   filterSelect('status','Stage status',{all:'Any status',open:'In progress',earned:'Earned'},selection.status)+
   '</div></div><p class="achievement-result" aria-live="polite"></p><div class="achievement-board"></div></section>';
  filters=rootPanel.querySelector('.achievement-filters');
  result=rootPanel.querySelector('.achievement-result');
  board=rootPanel.querySelector('.achievement-board');
  filters.addEventListener('change',event=>{
   if(event.target.matches('select'))selection={...selection,[event.target.name]:event.target.value};
   render();
  });
  board.addEventListener('click',event=>{
   if(!event.target.closest('[data-clear-achievement-filters]'))return;
   selection={category:'all',difficulty:'all',status:'all'};
   for(const select of filters.querySelectorAll('select'))select.value='all';
   render();filters.querySelector('select').focus();
  });
 }
 function renderAchievements(progress,earned){
  const {category,difficulty:rank,status}=selection;
  const sections=new Map();
  for(const item of achievements){
   if(category!=='all'&&item.group!==category)continue;
   const stages=item.stages.filter(stage=>(rank==='all'||stage.difficulty===rank)&&
    (status==='all'||isEarned(stage,earned)===(status==='earned')));
   if(!stages.length)continue;
   if(!sections.has(item.group))sections.set(item.group,[]);
   sections.get(item.group).push({item,stage:stages.find(stage=>!isEarned(stage,earned))??stages.at(-1)});
  }
  const count=[...sections.values()].reduce((total,entries)=>total+entries.length,0);
  const label=number.format(count)+' '+(count===1?'badge':'badges');
  if(result.textContent!==label)result.textContent=label;
  const prevFocus=board.contains(document.activeElement)?document.activeElement.dataset.achievementBadge:null;
  const html=count?[...sections].map(([group,entries])=>
   '<section class="achievement-group"><h3>'+ico(groupIcons[group]||'crown')+group+'</h3><div class="achievement-grid">'+
   entries.map(({item,stage})=>achievementTile(item,stage,progress,earned)).join('')+'</div></section>'
  ).join(''):'<div class="achievement-empty"><h3>No matching stages</h3><button type="button" class="outline" data-clear-achievement-filters>Clear filters</button></div>';
  if(fill(board,html)&&prevFocus)board.querySelector('[data-achievement-badge="'+CSS.escape(prevFocus)+'"]')?.focus({preventScroll:true});
 }
 function render(){
  if(!active||!shell?.isConnected||!wallet)return;
  const progress=achievementProgress(wallet),earned=wallet.achievements||{};
  const done=allStages.filter(stage=>Object.hasOwn(earned,stage.id));
  const badges=achievements.filter(item=>item.stages.every(stage=>Object.hasOwn(earned,stage.id))).length;
  if(dialog.open)renderBadge();
  fill(summary,ico('crown')+'<div><b>'+badges+' / '+achievements.length+'</b><span>Badges completed</span></div>'+
   '<progress max="'+allStages.length+'" value="'+done.length+'" aria-label="Total achievement stages"></progress>'+
   '<small>'+done.length+' of '+allStages.length+' stages earned</small>');
  if(active==='achievements'){renderAchievements(progress,earned);return;}
  const xp=playerProgress(wallet.playerXp),future=nextUnlocks(xp.level);
  const recent=done.toSorted((a,b)=>earned[b.id]-earned[a.id]).slice(0,3);
  const boosts=achievementBoosts(wallet),boostIcons={mine:'mine',battle:'battle',mana:'spark'};
  fill(rootPanel,'<div class="progression-overview"><section class="progression-player"><h2>Level '+number.format(xp.level)+'</h2>'+
   '<progress max="'+xp.goal+'" value="'+xp.xp+'" aria-label="Experience toward next level"></progress><p>'+number.format(xp.xp)+' / '+number.format(xp.goal)+' XP to Level '+number.format(xp.level+1)+'</p>'+
   '<p class="drop-access-note">'+dropAccessSummary(xp.level)+'</p>'+
   '<dl><div><dt>Arena wins</dt><dd>'+number.format(progress.battle)+'</dd></div><div><dt>Army trilogies</dt><dd>'+number.format(progress.army)+'</dd></div>'+
   '<div><dt>Training levels</dt><dd>'+number.format(progress.training)+'</dd></div></dl></section>'+
   '<section class="progression-boosts"><h2>Achievement boosts</h2><ul>'+Object.entries(achievementBoostLabels).map(([key,label])=>
   '<li>'+ico(boostIcons[key]||'spark')+'<span>'+label+'</span><b>+'+percent.format(boosts[key]||0)+'%</b></li>').join('')+'</ul></section>'+
   '<section class="progression-unlocks"><h2>Upcoming unlocks</h2>'+(future.length?'<ul>'+future.map(item=>'<li>'+ico(item.icon||'pack')+'<div><b>'+item.name+'</b><small>'+item.detail+'</small></div><span>Level '+item.level+'</span></li>').join('')+'</ul>':'<p>All game features are unlocked.</p>')+'</section></div>'+
   '<section class="progression-recent"><div><h2>Recent achievements</h2><a class="outline" href="#progression/achievements">All achievements</a></div>'+
   (recent.length?'<div class="progression-recent-grid">'+recent.map(stage=>{
    const item=achievementById(stage.id);
    const metal=materialFor(item,stage);
    return '<button type="button" data-achievement-badge="'+stage.id+'" aria-haspopup="dialog">'+badge(item,metal,true)+
     '<span><strong>'+item.name+'</strong><span class="achievement-stage-meta">'+difficulty(stage)+
     '<span class="achievement-stage-number">'+metal+' · Stage '+stage.stage+' of '+item.stageCount+'</span></span>'+rewards(stage)+'</span></button>';
   }).join('')+'</div>':'<p>Your first badge will appear here.</p>')+'</section>');
 }
 return {show,leave(){active=null;if(dialog.open)dialog.close();},setWallet(next){wallet=next;if(active)render();}};
}

export function setupAchievementBanners(sound,flights){
 const banner=document.createElement('a'),announcement=document.createElement('div');
 banner.className='achievement-toast';banner.href='#progression/achievements';banner.hidden=true;
 announcement.className='achievement-announcement';
 announcement.setAttribute('role','status');
 announcement.setAttribute('aria-atomic','true');
 if(typeof banner.showPopover==='function')banner.setAttribute('popover','manual');
 document.body.append(banner,announcement);
 const queue=[],reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let seen=null,revision=-1,timer=0,opening=false,current=null,paid=0;
 const keyTickets=[];
 function hide(){
  clearTimeout(timer);timer=0;
  if(banner.hidePopover&&banner.matches(':popover-open'))banner.hidePopover();
  banner.hidden=true;current=null;
 }
 function exit(){
  banner.dataset.phase='exit';
  timer=setTimeout(()=>{hide();show();},reduced.matches?90:230);
 }
 function scheduleExit(){
  if(!current||banner.dataset.phase==='exit')return;
  clearTimeout(timer);
  if(banner.matches(':hover, :focus-within'))return;
  const end=current.since+(queue.length||keyTickets.length?1900:3700);
  timer=setTimeout(exit,Math.max(160,end-performance.now()));
 }
 function show(){
  if(current||opening||(!queue.length&&!keyTickets.length)||document.hidden)return;
  const unlocked=queue.splice(0,keyTickets.length||queue.length>3?queue.length:1);
  const item=unlocked.reduce((best,stage)=>!best||stage.xp>best.xp?stage:best,null);
  const xp=unlocked.reduce((total,stage)=>total+stage.xp,0);
  const tickets=keyTickets.splice(0),keys=tickets.reduce((sum,ticket)=>sum+ticket.units/10,0);
  const many=unlocked.length>1,label=many?unlocked.length+' achievement stages earned':item?'Achievement stage earned':'Achievement rewards';
  const showing=current={since:performance.now()};
  const boost=item?(many?'Permanent boosts earned':boostLabel(item.boost)):'';
  const payout='<span class="achievement-rewards">'+(xp?'<b>+'+number.format(xp)+' XP</b>':'')+
   (boost?'<span>'+boost+'</span>':'')+keyReward(keys)+'</span>';
  const metal=item?materialFor(item,item):'Platinum';
  const medal=badge(item||{symbol:'demonKey'},metal,true);
  banner.innerHTML=medal+'<div><small>'+label+'</small><strong>'+(item?item.name:'Keys received')+'</strong>'+
   (item?'<span class="achievement-stage-meta">'+difficulty(item)+'<span class="achievement-stage-number">'+metal+' · Stage '+item.stage+' of '+item.stageCount+'</span></span>':'')+
   payout+'</div>'+ico('right');
  announcement.textContent=label+'. '+(item?item.name+', stage '+item.stage+'. ':'')+
   [xp?xp+' XP':'',keys?keys+' Demon '+(keys===1?'Key':'Keys'):''].filter(Boolean).join(' and ')+' earned.';
  banner.toggleAttribute('data-key-payout',keys>0);
  banner.dataset.phase='enter';banner.hidden=false;
  if(banner.hasAttribute('popover'))banner.showPopover();
  if(tickets.length){
   const origin=banner.querySelector('.achievement-keys')||banner;
   if(tickets.length===1)flights.launch(tickets[0],origin);
   else{
    for(const ticket of tickets)flights.settle(ticket);
    flights.launch(flights.reserve('demonKeys',keys),origin);
   }
  }
  sound.playGameReady('gdAchievement',{level:.88},()=>current===showing&&banner.dataset.phase==='enter');
  scheduleExit();
 }
 document.addEventListener('gdlb-achievements',event=>{
  const {earned,saveRevision,pending,keys,paid:totalPaid,initialKeys}=event.detail;
  if(!earned){
   seen=null;paid=0;revision=-1;queue.length=0;
   for(const ticket of keyTickets.splice(0))flights.settle(ticket);
   announcement.textContent='';hide();return;
  }
  if(saveRevision<revision)return;
  revision=saveRevision;opening=Boolean(pending);
  const credited=seen?Math.max(0,totalPaid-paid):initialKeys;
  paid=totalPaid;
  if(credited>0)keyTickets.push(flights.reserve('demonKeys',credited));
  flights.balance({demonKeys:keys});
  const now=new Set(Object.keys(earned));
  if(seen)for(const id of now){
   const item=achievementById(id);
   if(item&&!seen.has(id))queue.push(item);
  }
  seen=now;
  if(current&&(queue.length||keyTickets.length))scheduleExit();else show();
 });
 document.addEventListener('visibilitychange',show);
 document.addEventListener('close',event=>{if(event.target instanceof HTMLDialogElement)requestAnimationFrame(show);},true);
 for(const event of ['pointerenter','pointerleave','focusin','focusout'])banner.addEventListener(event,()=>requestAnimationFrame(scheduleExit));
 banner.addEventListener('click',()=>{hide();requestAnimationFrame(show);});
}
