import {
 achievementBoostLabels,achievementBoosts,achievementById,achievementCount,achievementProgress,achievements
} from './progression-rules.js';
import {playerProgress} from './player-progression.js';
import {nextUnlocks} from './level-access.js';
import {ico} from './icons.js';

const number=new Intl.NumberFormat('en-US');
const percent=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const groups=[...new Set(achievements.map(item=>item.group))];
const allStages=achievements.flatMap(item=>item.stages);
const difficultyFaces={Easy:'easy',Normal:'normal',Hard:'hard',Harder:'harder',Insane:'insane',Demon:'demon-extreme'};
const groupIcons={Cards:'pack',Battle:'battle',Training:'aim',Kingdom:'tower','Coin mine':'mine',Trading:'exchange'};
const names={overview:'Overview',achievements:'Achievements'};

function badge(item,earned=false){
 const art=item.icon?'<img src="'+item.icon+'" alt="">':ico(item.symbol||'crown');
 return '<span class="achievement-badge" data-badge-earned="'+earned+'" style="--medal:'+item.color+'" aria-hidden="true">'+art+'</span>';
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
function stageState(stage,earned){
 return Object.hasOwn(earned,stage.id)?'<span class="achievement-earned">'+ico('check')+' Earned</span>':'<span class="achievement-unearned">In progress</span>';
}
function stageProgress(item,stage,count,earned){
 const value=Object.hasOwn(earned,stage.id)?stage.goal:Math.min(stage.goal,count);
 return '<div class="achievement-track"><progress max="'+stage.goal+'" value="'+value+'" aria-label="'+item.name+' stage '+stage.stage+' progress"></progress>'+
  '<span>'+number.format(value)+' / '+number.format(stage.goal)+'</span></div>';
}
function stageDetails(item,count,earned,expanded){
 if(item.stages.length===1)return '';
 return '<details class="achievement-stages" data-badge-stages="'+item.id+'"'+(expanded?' open':'')+'><summary>All '+item.stages.length+' stages <span class="achievement-announcement">for '+item.name+'</span>'+ico('down')+'</summary>'+
  '<ol>'+item.stages.map(stage=>'<li><span class="achievement-stage-index" aria-hidden="true">'+stage.stage+'</span>'+
   '<div><div class="achievement-stage-meta"><b>Stage '+stage.stage+'</b>'+difficulty(stage)+stageState(stage,earned)+'</div>'+
   '<p>'+stage.description+'</p>'+rewards(stage)+stageProgress(item,stage,count,earned)+'</div></li>').join('')+'</ol></details>';
}
function achievementCard(item,stage,progress,earned,expanded=false){
 const count=achievementCount(item,progress);
 const complete=item.stages.every(entry=>Object.hasOwn(earned,entry.id));
 return '<article class="achievement-card" data-earned="'+complete+'">'+
  '<div class="achievement-card-body">'+badge(item,Object.hasOwn(earned,stage.id))+'<div class="achievement-information">'+
  '<div class="achievement-stage-meta">'+difficulty(stage)+'<span class="achievement-stage-number">Stage '+stage.stage+' of '+item.stages.length+'</span></div>'+
  '<h4>'+item.name+'</h4><p>'+stage.description+'</p>'+stageProgress(item,stage,count,earned)+
  '<div class="achievement-payoff">'+rewards(stage)+stageState(stage,earned)+'</div></div></div>'+
  stageDetails(item,count,earned,expanded)+'</article>';
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
 const renderCache=new WeakMap();
 const expanded=new Set();
 function fill(node,html){
  if(renderCache.get(node)===html)return false;
  node.innerHTML=html;renderCache.set(node,html);return true;
 }
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
  board.addEventListener('toggle',event=>{
   const details=event.target;
   const id=details.dataset?.badgeStages;
   if(id){if(details.open)expanded.add(id);else expanded.delete(id);}
  },true);
 }
 function renderAchievements(progress,earned){
  const {category,difficulty:rank,status}=selection;
  const sections=new Map();
  for(const item of achievements){
   if(category!=='all'&&item.group!==category)continue;
   const stages=item.stages.filter(stage=>(rank==='all'||stage.difficulty===rank)&&
    (status==='all'||Object.hasOwn(earned,stage.id)===(status==='earned')));
   if(!stages.length)continue;
   if(!sections.has(item.group))sections.set(item.group,[]);
   sections.get(item.group).push({item,stage:stages.find(stage=>!Object.hasOwn(earned,stage.id))??stages.at(-1)});
  }
  const count=[...sections.values()].reduce((total,entries)=>total+entries.length,0);
  const label=number.format(count)+' '+(count===1?'badge':'badges');
  if(result.textContent!==label)result.textContent=label;
  const prevFocus=board.contains(document.activeElement)?document.activeElement.closest('[data-badge-stages]')?.dataset.badgeStages:null;
  const html=count?[...sections].map(([group,entries])=>
   '<section class="achievement-group"><h3>'+ico(groupIcons[group]||'crown')+group+'</h3><div class="achievement-grid">'+
   entries.map(({item,stage})=>achievementCard(item,stage,progress,earned,expanded.has(item.id))).join('')+'</div></section>'
  ).join(''):'<div class="achievement-empty"><h3>No matching stages</h3><button type="button" class="outline" data-clear-achievement-filters>Clear filters</button></div>';
  if(fill(board,html)&&prevFocus)board.querySelector('[data-badge-stages="'+CSS.escape(prevFocus)+'"] summary')?.focus({preventScroll:true});
 }
 function render(){
  if(!active||!shell?.isConnected||!wallet)return;
  const progress=achievementProgress(wallet),earned=wallet.achievements||{};
  const done=allStages.filter(stage=>Object.hasOwn(earned,stage.id));
  const badges=achievements.filter(item=>item.stages.every(stage=>Object.hasOwn(earned,stage.id))).length;
  fill(summary,ico('crown')+'<div><b>'+badges+' / '+achievements.length+'</b><span>Badges completed</span></div>'+
   '<progress max="'+allStages.length+'" value="'+done.length+'" aria-label="Total achievement stages"></progress>'+
   '<small>'+done.length+' of '+allStages.length+' stages earned</small>');
  if(active==='achievements'){renderAchievements(progress,earned);return;}
  const xp=playerProgress(wallet.playerXp),future=nextUnlocks(xp.level);
  const recent=done.toSorted((a,b)=>earned[b.id]-earned[a.id]).slice(0,3);
  const boosts=achievementBoosts(wallet),boostIcons={mine:'mine',battle:'battle',mana:'spark'};
  fill(rootPanel,'<div class="progression-overview"><section class="progression-player"><h2>Level '+number.format(xp.level)+'</h2>'+
   '<progress max="'+xp.goal+'" value="'+xp.xp+'" aria-label="Experience toward next level"></progress><p>'+number.format(xp.xp)+' / '+number.format(xp.goal)+' XP to Level '+number.format(xp.level+1)+'</p>'+
   '<dl><div><dt>Arena wins</dt><dd>'+number.format(progress.battle)+'</dd></div><div><dt>Army trilogies</dt><dd>'+number.format(progress.army)+'</dd></div>'+
   '<div><dt>Training levels</dt><dd>'+number.format(progress.training)+'</dd></div></dl></section>'+
   '<section class="progression-boosts"><h2>Achievement boosts</h2><ul>'+Object.entries(achievementBoostLabels).map(([key,label])=>
   '<li>'+ico(boostIcons[key]||'spark')+'<span>'+label+'</span><b>+'+percent.format(boosts[key]||0)+'%</b></li>').join('')+'</ul></section>'+
   '<section class="progression-unlocks"><h2>Upcoming unlocks</h2>'+(future.length?'<ul>'+future.map(item=>'<li>'+ico(item.icon||'pack')+'<div><b>'+item.name+'</b><small>'+item.detail+'</small></div><span>Level '+item.level+'</span></li>').join('')+'</ul>':'<p>All game features are unlocked.</p>')+'</section></div>'+
   '<section class="progression-recent"><div><h2>Recent achievements</h2><a class="outline" href="#progression/achievements">All achievements</a></div>'+
   (recent.length?'<div class="progression-recent-grid">'+recent.map(stage=>{
    const item=achievementById(stage.id);
    return '<article>'+badge(item,true)+'<div><h3>'+item.name+'</h3><div class="achievement-stage-meta">'+difficulty(stage)+
     '<span class="achievement-stage-number">Stage '+stage.stage+' of '+item.stageCount+'</span></div>'+rewards(stage)+'</div></article>';
   }).join('')+'</div>':'<p>Your first badge will appear here.</p>')+'</section>');
 }
 return {show,leave(){active=null;},setWallet(next){wallet=next;if(active)render();}};
}

export function setupAchievementBanners(sound){
 const banner=document.createElement('a'),announcement=document.createElement('div');
 banner.className='achievement-toast';banner.href='#progression/achievements';banner.hidden=true;
 announcement.className='achievement-announcement';
 announcement.setAttribute('role','status');
 announcement.setAttribute('aria-atomic','true');
 if(typeof banner.showPopover==='function')banner.setAttribute('popover','manual');
 document.body.append(banner,announcement);
 const queue=[],reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let seen=null,revision=-1,timer=0,opening=false,current=null;
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
  const end=current.since+(queue.length?2300:3700);
  timer=setTimeout(exit,Math.max(160,end-performance.now()));
 }
 function show(){
  if(current||opening||document.documentElement.dataset.levelUpPending||
   document.querySelector('dialog[open]')||!queue.length||document.hidden)return;
  const unlocked=queue.splice(0,queue.length>3?queue.length:1);
  const item=unlocked.reduce((best,stage)=>stage.xp>best.xp?stage:best,unlocked[0]);
  const xp=unlocked.reduce((total,stage)=>total+stage.xp,0);
  const keys=unlocked.reduce((total,stage)=>total+(stage.keys||0),0);
  const many=unlocked.length>1,label=many?unlocked.length+' achievement stages earned':'Achievement stage earned';
  const showing=current={since:performance.now()};
  const payout=many?'<span class="achievement-rewards"><b>+'+number.format(xp)+' XP</b><span>Permanent boosts earned</span>'+keyReward(keys)+'</span>':rewards(item);
  banner.innerHTML=badge(item,true)+'<div><small>'+label+'</small><strong>'+item.name+'</strong>'+
   '<span class="achievement-stage-meta">'+difficulty(item)+'<span class="achievement-stage-number">Stage '+item.stage+' of '+item.stageCount+'</span></span>'+
   payout+'</div>'+ico('right');
  announcement.textContent=label+'. '+item.name+', stage '+item.stage+'. '+xp+' XP'+(keys?' and '+keys+' Demon '+(keys===1?'Key':'Keys'):'')+' earned.';
  banner.dataset.phase='enter';banner.hidden=false;
  if(banner.hasAttribute('popover'))banner.showPopover();
  sound.playGameReady('gdAchievement',{level:.88},()=>current===showing&&banner.dataset.phase==='enter');
  scheduleExit();
 }
 document.addEventListener('gdlb-achievements',event=>{
  const {earned,saveRevision,pending}=event.detail;
  if(!earned){
   seen=null;revision=-1;queue.length=0;announcement.textContent='';hide();return;
  }
  if(saveRevision<revision)return;
  revision=saveRevision;opening=Boolean(pending);
  const now=new Set(Object.keys(earned));
  if(seen)for(const id of now){
   const item=achievementById(id);
   if(item&&!seen.has(id))queue.push(item);
  }
  seen=now;
  if(current&&queue.length)scheduleExit();else show();
 });
 document.addEventListener('visibilitychange',show);
 document.addEventListener('close',event=>{if(event.target instanceof HTMLDialogElement)requestAnimationFrame(show);},true);
 for(const event of ['pointerenter','pointerleave','focusin','focusout'])banner.addEventListener(event,()=>requestAnimationFrame(scheduleExit));
 banner.addEventListener('click',()=>{queue.length=0;hide();});
}
