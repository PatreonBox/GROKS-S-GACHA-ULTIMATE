import {achievementById,achievementCount,achievementProgress,achievements} from './progression-rules.js';
import {playerProgress} from './player-progression.js';
import {nextUnlocks} from './level-access.js';
import {ico} from './icons.js';

const number=new Intl.NumberFormat('en-US');
const groups=['All','Cards','Battle','Training','Kingdom','Coin mine'];
const names={overview:'Overview',achievements:'Achievements'};
const badge=(definition,locked=false)=>'<span class="achievement-badge'+(locked?' locked':'')+'" style="--medal:'+definition.color+'">'+
 (locked?'<span class="achievement-lock">'+ico('lock')+'</span>':definition.icon?'<img src="'+definition.icon+'" alt="">':ico(definition.symbol))+'</span>';

function achievementCard(item,progress,done){
 const current=Math.min(item.goal,achievementCount(item,progress)),value=done?item.goal:current;
 return '<article class="achievement-card" data-earned="'+Boolean(done)+'">'+badge(item,!done)+'<div class="achievement-information">'+
  '<div><h3>'+item.name+'</h3><span>'+item.group+'</span></div><p>'+item.description+'</p>'+
  '<div class="achievement-track"><progress max="'+item.goal+'" value="'+value+'" aria-label="'+item.name+' progress"></progress>'+
  '<span>'+number.format(value)+' / '+number.format(item.goal)+'</span></div></div></article>';
}

export function createProgression(root){
 let wallet,active=null,filter='All';
 function show(view){
  const samePanel=active&&root.querySelector('.progression-room');
  active=view;
  if(!samePanel){
   root.innerHTML='<section class="progression-room"><div class="progression-title"><div><h1>Progression</h1><p>Player levels, rewards and achievement badges</p></div><div data-achievement-overall></div></div>'+
    '<nav aria-label="Progression sections" class="progression-tabs">'+Object.entries(names).map(([key,name])=>'<a href="#progression'+(key==='overview'?'':'/'+key)+'" data-progress-view="'+key+'">'+name+'</a>').join('')+'</nav>'+
    '<div data-progress-content></div></section>';
   root.querySelector('[data-progress-content]').addEventListener('click',event=>{
    const button=event.target.closest('[data-achievement-filter]');
    if(!button)return;
    filter=button.dataset.achievementFilter;render();
    root.querySelector('[data-achievement-filter][aria-pressed=true]')?.focus({preventScroll:true});
   });
  }
  render();
 }
 function render(){
  const room=root.querySelector('.progression-room');
  if(!active||!room||!wallet)return;
  const progress=achievementProgress(wallet),done=wallet.achievements||{},earned=achievements.filter(item=>done[item.id]);
  const panel=room.querySelector('[data-progress-content]');
  for(const link of room.querySelectorAll('[data-progress-view]')){
   if(link.dataset.progressView===active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
  room.querySelector('[data-achievement-overall]').innerHTML='<b>'+earned.length+' / '+achievements.length+'</b><span>Achievements</span><progress max="'+achievements.length+'" value="'+earned.length+'" aria-label="Total achievements"></progress>';
  if(active==='achievements'){
   const previous=panel.querySelector('[data-achievement-filter]:focus')?.dataset.achievementFilter;
   panel.innerHTML='<div class="achievement-filters" role="group" aria-label="Filter achievements">'+groups.map(group=>
    '<button class="outline" type="button" data-achievement-filter="'+group+'" aria-pressed="'+(group===filter)+'">'+group+'</button>').join('')+'</div>'+
    '<div class="achievement-grid">'+achievements.filter(item=>filter==='All'||filter===item.group)
    .map(item=>achievementCard(item,progress,done[item.id])).join('')+'</div>';
   if(previous)panel.querySelector('[data-achievement-filter][aria-pressed=true]')?.focus({preventScroll:true});
   return;
  }
  const xp=playerProgress(wallet.playerXp),future=nextUnlocks(xp.level),recent=earned.toSorted((a,b)=>done[b.id]-done[a.id]).slice(0,4);
  panel.innerHTML='<div class="progression-overview"><section class="progression-player"><span>Player level</span><h2>Level '+number.format(xp.level)+'</h2>'+
   '<progress max="'+xp.goal+'" value="'+xp.xp+'" aria-label="Experience toward next level"></progress><p>'+number.format(xp.xp)+' / '+number.format(xp.goal)+' XP to Level '+number.format(xp.level+1)+'</p>'+
   '<dl><div><dt>Arena wins</dt><dd>'+number.format(progress.battle)+'</dd></div><div><dt>Army trilogies</dt><dd>'+number.format(progress.army)+'</dd></div>'+
   '<div><dt>Training levels</dt><dd>'+number.format(progress.training)+'</dd></div></dl></section>'+
   '<section class="progression-unlocks"><h2>Upcoming unlocks</h2>'+(future.length?'<ul>'+future.map(item=>'<li>'+ico(item.icon||'pack')+'<div><b>'+item.name+'</b><small>'+item.detail+'</small></div><span>Level '+item.level+'</span></li>').join('')+'</ul>':'<p>All game features are unlocked.</p>')+'</section></div>'+
   '<section class="progression-recent"><div><h2>Recent achievements</h2><a class="outline" href="#progression/achievements">All achievements</a></div>'+
   (recent.length?'<div class="achievement-grid">'+recent.map(item=>achievementCard(item,progress,true)).join('')+'</div>':'<p>Your first badge will appear here.</p>')+'</section>';
 }
 return {show,leave(){active=null;},setWallet(next){wallet=next;if(active)render();}};
}

export function setupAchievementBanners(sound){
 const banner=document.createElement('a');
 banner.className='achievement-toast';banner.href='#progression/achievements';
 banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.hidden=true;
 if(typeof banner.showPopover==='function')banner.setAttribute('popover','manual');
 document.body.append(banner);
 const queue=[],reveal=document.getElementById('packReveal');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let seen=null,revision=-1,timer=0,opening=false,current=null;
 function hide(){
  clearTimeout(timer);timer=0;
  if(banner.matches(':popover-open'))banner.hidePopover();
  banner.hidden=true;
  current=null;
 }
 function exit(){
  banner.dataset.phase='exit';
  timer=setTimeout(()=>{hide();show();},reduced.matches?90:240);
 }
 function scheduleExit(){
  if(!current||banner.dataset.phase==='exit')return;
  clearTimeout(timer);
  const end=current.since+(queue.length?2080:3200);
  timer=setTimeout(exit,Math.max(0,end-performance.now()));
 }
 function show(){
  if(current||opening||reveal?.open||!queue.length||document.hidden)return;
  const item=queue.shift();
  const showing=current={since:performance.now()};
  banner.innerHTML=badge(item)+'<div><small>Achievement unlocked</small><strong>'+item.name+'</strong><span>'+item.description+'</span></div>';
  banner.dataset.phase='enter';
  banner.hidden=false;
  if(banner.hasAttribute('popover'))banner.showPopover();
  sound.playGameReady('gdAchievement',{level:.88},()=>current===showing&&banner.dataset.phase==='enter');
  scheduleExit();
 }
 document.addEventListener('gdlb-achievements',event=>{
  const {earned,saveRevision,pending}=event.detail;
  if(!earned){
   seen=null;revision=-1;queue.length=0;hide();return;
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
 reveal?.addEventListener('close',()=>requestAnimationFrame(show));
 banner.addEventListener('click',()=>{queue.length=0;hide();});
}
