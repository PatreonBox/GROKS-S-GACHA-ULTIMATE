import {demonBanners,bannerOdds,bannerPity,demonPity,demonPityUnlock,demonKeyPrice,demonKeyOffer} from './demon-banner.js';
import {gameCommand} from './game-client.js';
import {cardCategories,difficulties} from './pack-engine.js';
import {cardFace} from './pack-model.js';
import {ico} from './icons.js';
import {featureLevel} from './level-access.js';
import {lockBadge} from './level-lock.js';
import {playerProgress} from './player-progression.js';
import {cardRarity,rarityBadge} from './card-rarity.js';
import {dropAccess,dropAccessSummary,dropEligible} from './drop-access.js';

export const demonKeyIcon=ico('demonKey');
const gem='<img class="gd-gem" src="/assets/packs/gem.png" alt="">';
const format=n=>(Number(n)||0).toLocaleString('en-US');
const percentage=n=>n.toLocaleString('en-US',{maximumFractionDigits:6})+'%';
const descriptions={
 standard:'Open a five-card chest for one Demon Key.',
 special:'Choose a featured level to improve your chance of pulling it.',
 pro:'Open a chest for five Demon Keys.'
};
const orderedBanners=['standard','special','pro'];
const bannerScenes={
 standard:{name:'Dark Paradise',difficulty:'Easy',cover:'/assets/shots/11280109.webp'},
 special:{name:'KOCMOC',difficulty:'Extreme Demon',cover:'/assets/shots/hero-87665224.avif'},
 pro:{name:'Flamewall',difficulty:'Extreme Demon',cover:'/assets/shots/126242564.webp'}
};
const displayName=id=>demonBanners[id]?.name||id;
const longTime=ms=>{
 const seconds=Math.ceil(Math.max(0,ms)/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);
 return [hours,minutes,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency=(icon,label)=>'<span class="banner-currency">'+icon+' <b>'+label+'</b></span>';
const levelShot=(src,kind,lazy=false)=>'<img class="'+kind+'" src="'+esc(src)+'" data-banner-level-shot alt=""'+(lazy?' loading="lazy"':'')+'>';
const levelFace=difficulty=>'<img class="banner-level-face" src="'+cardFace(difficulty)+'" width="36" height="36" alt="">';

function bindLevelShots(scope){
 for(const shot of scope.querySelectorAll('[data-banner-level-shot]')){
  if(shot.complete&&!shot.naturalWidth)shot.hidden=true;
  else shot.addEventListener('error',()=>{shot.hidden=true},{once:true});
 }
}

export function createDemonBannerRoom({sound,applyWallet,begin,preview,coverSource,onError}){
 let body,wallet,banner='standard',page='',target,dialog,operation=false,clockOffset=0,admin=false;
 let status='';
 const playerLevel=()=>playerProgress(wallet?.playerXp).level;
 const available=()=>Number(wallet?.demonKeys)||0;
 const now=()=>Date.now()+clockOffset;
 const config=()=>demonBanners[banner];
 const controller=()=>body?.querySelector('.banner-pull-controls');
 const canPull=()=>playerLevel()>=config().level;
 function count(quantity){
  const max=Math.floor(available()/config().cost);
  return quantity==='max'?Math.min(49,max):Number(quantity);
 }
 function renderControls(){
  const controls=controller();if(!controls)return;
  const pity=bannerPity(wallet,banner),level=playerLevel(),keys=available(),locked=!canPull(),max=Math.floor(keys/config().cost);
  const pending=Boolean(wallet?.pending);
  controls.querySelector('.banner-pity').innerHTML=[['legendary','Legendary+'],['mythic','Mythic+']].map(([key,label])=>{
   const used=Math.max(0,Number(pity[key])||0),limit=demonPity[key],next=Math.min(used,limit);
   const unlock=demonPityUnlock[key],available=level>=unlock;
   return '<div><b>'+label+'</b><span>'+(available?format(next)+' / '+format(limit)+' draws':'Starts at Level '+unlock)+'</span><progress max="'+limit+'" value="'+next+'" aria-label="'+label+' guarantee"></progress></div>';
  }).join('');
  const purchases=controls.querySelector('.banner-draw-actions'),buttons=pending?
   '<button type="button" class="primary banner-draw" data-banner-action="resume">Resume opening</button>':
   [1,10,50,...(max>=11&&max<=49?['max']:[])].map(value=>{
   const total=count(value),bulk=value===50&&level<featureLevel('bulk'),unavailable=locked||bulk||keys<total*config().cost;
    return '<button type="button" class="'+(value===1?'primary':'outline')+' banner-draw" data-banner-quantity="'+value+'" '+(operation||unavailable?'disabled':'')+'>'+
     '<span>'+(value==='max'?'Open Max · '+format(total):'Open '+value)+'</span>'+
     (bulk?lockBadge(featureLevel('bulk')):currency(demonKeyIcon,format(total*config().cost)))+'</button>';
   }).join('');
  if(purchases.innerHTML!==buttons)purchases.innerHTML=buttons;
  controls.querySelector('.banner-note').textContent=status||(locked?'Reach Level '+config().level+' to open this banner.':pending?'Finish your current opening before starting another.':keys<config().cost?'Get Demon Keys in the Key Shop.':'Each draw reveals five cards, plus a possible bonus.');
 }
 function poster(){
  const scene=banner==='special'&&target?{name:target[1],difficulty:target[6],cover:coverSource(target[0])}:bannerScenes[banner];
  return '<div class="demon-banner-art" aria-hidden="true">'+levelShot(scene.cover,'banner-scenery')+'</div>'+
   '<figure class="banner-level-card">'+levelShot(scene.cover,'banner-level-shot')+
   '<figcaption>'+levelFace(scene.difficulty)+'<div><strong>'+esc(scene.name)+'</strong><small>'+esc(scene.difficulty)+'</small></div></figcaption></figure>';
 }
 function featured(){
  if(banner!=='special')return '';
  const rarity=target&&cardRarity(target);
  return '<div class="banner-featured">'+(target?levelFace(target[6])+'<div><b>'+esc(target[1])+'</b>'+rarityBadge(rarity)+'</div>':
   '<div><b>Featured level</b><small>Pick a level to boost its individual odds.</small></div>')+
   '<button type="button" class="outline" data-banner-action="featured" '+(!canPull()?'disabled':'')+'>'+(target?'Change':'Choose level')+'</button></div>';
 }
 function bannerMarkup(){
  return '<div class="demon-gacha" data-demon-banner="'+banner+'">'+
   '<div class="demon-toolbar"><div class="demon-controls" role="group" aria-label="Demon banners">'+
   orderedBanners.map(key=>'<button type="button" data-select-banner="'+key+'" aria-pressed="'+(key===banner)+'"><span>'+displayName(key)+'</span>'+
    (playerLevel()<demonBanners[key].level?lockBadge(demonBanners[key].level):'')+'</button>').join('')+
   '</div><a class="outline demon-shop-link" href="#gacha/keys">'+demonKeyIcon+' Key Shop</a></div>'+
   '<section class="demon-hero" aria-label="'+displayName(banner)+' Demon Banner"><div class="demon-hero-copy"><h2>'+displayName(banner)+'</h2>'+
   '<p>'+descriptions[banner]+'</p>'+ (banner==='pro'?'<div class="banner-twenty"><strong>20×</strong> Legendary+ odds</div>':'')+
   featured()+'</div>'+poster()+'</section>'+
   '<section class="banner-pull-controls" aria-label="Opening controls"><div class="banner-pull-heading"><h3>Guaranteed pulls</h3>'+
   '<button type="button" class="outline" data-banner-action="odds">'+ico('info')+' Odds &amp; pity</button>'+
    (admin?'<button type="button" class="outline" data-banner-action="admin">'+ico('spark')+' Test opening</button>':'')+'</div>'+
   '<p class="drop-access-note">'+dropAccessSummary(playerLevel())+'</p><div class="banner-pity"></div><div class="banner-draw-actions"></div><p class="banner-note" role="status"></p></section></div>';
 }
 function shopMarkup(){
  return '<section class="demon-key-shop"><div class="demon-key-header"><div><h2>Key Shop</h2><p>Demon Keys open all three banners.</p></div>'+
   '<a class="outline" href="#gacha/banners">'+ico('left')+' Demon Banners</a></div>'+
   '<p class="banner-note" data-key-shop-achievements hidden></p>'+
   '<div data-key-shop-offer></div><article class="key-shop-regular"><div class="big-key">'+demonKeyIcon+'</div>'+
   '<div><h3>Demon Keys</h3><p>'+format(demonKeyPrice)+' gems per key</p></div>'+
   '<form data-key-purchase><label>Quantity<input name="quantity" type="number" min="1" step="1" inputmode="numeric" value="1" required></label>'+
   '<button class="primary" type="submit">Buy '+currency(gem,'<span data-key-total>'+format(demonKeyPrice)+'</span>')+'</button></form></article>'+
   '<p class="banner-note" role="status" data-key-shop-status></p></section>';
 }
 function renderShop(){
  const slot=body?.querySelector('[data-key-shop-offer]');if(!slot)return;
  const achievementNote=body.querySelector('[data-key-shop-achievements]'),queued=wallet?.demonKeysToClaim||0;
  achievementNote.hidden=!queued;
  if(queued)achievementNote.textContent=format(queued)+(queued===1?' achievement key':' achievement keys')+
   (wallet?.pending?' will be added automatically after this opening.':' will be added when there is room in your wallet.');
  const offer=wallet?.demonBanner||{},left=Number(offer.offerEndsAt)-now();
  const ends=slot.querySelector('[data-key-offer-countdown]');
  const active=Number.isFinite(left)&&left>0&&!offer.starterOfferBought;
  if(active){
   if(!ends)slot.innerHTML='<article class="key-shop-offer"><div class="big-key">'+demonKeyIcon+'</div><div><strong>Starter offer</strong><h3>'+format(demonKeyOffer.keys)+' Demon Keys</h3>'+
    '<p>One purchase per player · ends in <time data-key-offer-countdown></time></p></div>'+
    '<button type="button" class="primary" data-banner-action="offer">Buy '+currency(gem,format(demonKeyOffer.gems))+'</button></article>';
   slot.querySelector('[data-key-offer-countdown]').textContent=longTime(left);
   slot.querySelector('button').disabled=operation||Number(wallet?.gems||0)<demonKeyOffer.gems;
  } else slot.innerHTML=offer.starterOfferBought?'<aside class="key-offer-ended">'+ico('check')+' Starter offer purchased</aside>':
   Number.isFinite(left)?'<aside class="key-offer-ended">Starter offer expired</aside>':'';
  const form=body.querySelector('[data-key-purchase]'),input=form.elements.quantity;
  const max=Math.min(1000,Math.max(0,Math.floor((wallet?.gems||0)/demonKeyPrice)));
  input.max=Math.max(1,max);
  form.querySelector('[data-key-total]').textContent=format(Math.max(1,Number(input.value)||1)*demonKeyPrice);
  form.querySelector('button').disabled=operation||max<1||!input.validity.valid;
  body.querySelector('[data-key-shop-status]').textContent=status||(!max?'Earn gems from your Card Index or Gem Mine.':'');
 }
 function render(){
  if(!body)return;
  body.innerHTML=page==='keys'?shopMarkup():bannerMarkup();
  if(page==='keys')renderShop();
  else{renderControls();bindLevelShots(body)}
 }
 function closeDialog(){
  if(dialog?.open)dialog.close();
  dialog=null;
 }
 function modal(title,markup){
  closeDialog();
  const el=document.createElement('dialog'),previous=document.activeElement;
  el.className='banner-dialog';
  el.setAttribute('aria-labelledby','banner-dialog-title');
  el.innerHTML='<div class="banner-dialog-head"><h2 id="banner-dialog-title">'+title+'</h2><button type="button" class="iconbtn" data-close-banner-dialog aria-label="Close">'+ico('x')+'</button></div>'+markup;
  el.querySelector('[data-close-banner-dialog]').onclick=()=>el.close();
  el.addEventListener('close',()=>{el.remove();if(el===dialog)dialog=null;previous?.focus({preventScroll:true})},{once:true});
  document.body.append(el);dialog=el;el.showModal();
  return el;
 }
 function showOdds(){
  const rows=bannerOdds(banner,playerLevel(),{target:banner==='special'&&Boolean(target),luck:wallet?.luck||0}).filter(row=>row.id!=='impossible'&&row.weight);
  const html=rows.map(({id,label,color,percent})=>'<tr><th scope="row"><span style="--odds-color:'+color+'">'+esc(label)+'</span></th><td>'+percentage(percent)+(percent>0&&percent<.001?' · 1 in '+format(Math.round(100/percent)):'')+'</td></tr>').join('');
  modal(displayName(banner)+' banner odds','<p>'+dropAccessSummary(playerLevel())+' Listed odds are per card before guarantees.'+(banner==='special'&&target?' Your chosen card gets a 6% chance within its rarity group, plus its usual chance.':'')+'</p>'+
   '<table class="banner-odds"><thead><tr><th>Rarity</th><th>Per card</th></tr></thead><tbody>'+html+'</tbody></table>'+
   '<p>Legendary or better comes within '+format(demonPity.legendary)+' eligible draws from Level '+demonPityUnlock.legendary+'. Mythic or better comes within '+format(demonPity.mythic)+' eligible draws from Level '+demonPityUnlock.mythic+'.</p>');
 }
 function bindSearch({el,input,category,render}){
  let timer,request=0,controller;
  async function lookup(){
   const ticket=++request;
   controller?.abort();
   const q=input.value.trim(),chosen=category?.value||'';
   const impossible=chosen==='Impossible'&&admin;
   if(!impossible&&!/^\d+$/.test(q)&&q.length<2){render([],q?'Type at least two letters.':'Search by level name or exact ID.');return}
   controller=new AbortController();
   const params=new URLSearchParams({view:'demon-targets',q});
   if(chosen)params.set('category',chosen);
   if(impossible)params.set('impossible','1');
   render([], 'Searching…');
   try{
    const response=await fetch('/api/game?'+params,{signal:controller.signal,cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Could not search the level catalog.');
    if(ticket===request&&el.open)render(result.rows??[], 'No matching levels.');
   }catch(error){
    if(error.name!=='AbortError'&&ticket===request&&el.open)render([],error.message);
   }
  }
  function enqueue(){
   ++request;controller?.abort();clearTimeout(timer);timer=setTimeout(lookup,180);
  }
  input.addEventListener('input',enqueue);category?.addEventListener('change',lookup);
  el.addEventListener('close',()=>{clearTimeout(timer);controller?.abort()},{once:true});
  lookup();
 }
 function chooseFeatured(){
  const access=dropAccess(playerLevel());
  const el=modal('Choose a featured level','<div class="featured-filters"><label>Level name<input type="search" maxlength="80" placeholder="Search levels" data-featured-search autofocus></label>'+
   '<label>Difficulty<select data-featured-difficulty><option value="">All unlocked difficulties</option>'+difficulties.slice(0,access.tier+1).map(d=>'<option>'+esc(d)+'</option>').join('')+
   '</select></label></div><p class="featured-status" role="status"></p><div class="featured-results"></div>'+
   '<div class="featured-pagination" hidden><button class="outline" type="button" data-featured-previous>Previous</button>'+
   '<span data-featured-page></span><button class="outline" type="button" data-featured-next>Next</button></div>'+
   (target?'<button class="outline" type="button" data-remove-featured>Clear featured level</button>':''));
  el.classList.add('featured-dialog');
  const results=el.querySelector('.featured-results'),search=el.querySelector('[data-featured-search]'),category=el.querySelector('[data-featured-difficulty]');
  const status=el.querySelector('.featured-status'),pagination=el.querySelector('.featured-pagination');
  const previous=el.querySelector('[data-featured-previous]'),next=el.querySelector('[data-featured-next]'),pageLabel=el.querySelector('[data-featured-page]');
  let found=[],currentPage=1,controller,timer;
  function clearResults(){
   found=[];results.replaceChildren();results.setAttribute('aria-busy','true');
   previous.disabled=next.disabled=true;status.textContent='Loading levels…';
  }
  async function load(page){
   clearTimeout(timer);controller?.abort();clearResults();
   const request=new AbortController();controller=request;
   const params=new URLSearchParams({view:'demon-featured-levels',q:search.value.trim(),category:category.value,page});
   try{
    const response=await fetch('/api/game?'+params,{signal:request.signal,cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Could not load the level catalog.');
    if(request.signal.aborted||!el.open)return;
    found=data.rows;
    currentPage=data.page;
    results.innerHTML=found.map((row,index)=>'<button type="button" data-featured-index="'+index+'"'+(target?.[0]===row[0]?' aria-current="true"':'')+'>'+
     '<span class="featured-result-art">'+levelFace(row[6])+levelShot(coverSource(row[0]),'featured-result-shot',true)+'</span>'+
     '<span class="featured-result-name"><strong>'+esc(row[1])+'</strong><small>'+esc(row[6])+(row[2]?' · '+esc(row[2]):'')+'</small></span>'+
     rarityBadge(cardRarity(row))+'</button>').join('');
    bindLevelShots(results);results.scrollTop=0;
    status.textContent=found.length?format(data.start+1)+'–'+format(data.start+found.length)+' of '+format(data.total)+' levels':'No matching levels.';
    pagination.hidden=data.pages<2;
    pageLabel.textContent='Page '+format(currentPage)+' of '+format(data.pages);
    previous.disabled=currentPage<=1;
    next.disabled=currentPage>=data.pages;
   }catch(error){
    if(request.signal.aborted||!el.open)return;
    status.textContent=error.message;
    pagination.hidden=true;
   }finally{
    if(!request.signal.aborted)results.removeAttribute('aria-busy');
   }
  }
  search.addEventListener('input',()=>{
   controller?.abort();clearTimeout(timer);clearResults();
   timer=setTimeout(()=>load(1),180);
  });
  category.addEventListener('change',()=>load(1));
  previous.addEventListener('click',()=>load(currentPage-1));
  next.addEventListener('click',()=>load(currentPage+1));
  el.addEventListener('close',()=>{clearTimeout(timer);controller?.abort()},{once:true});
  results.addEventListener('click',e=>{
   const button=e.target.closest('[data-featured-index]');if(!button)return;
   target=found[Number(button.dataset.featuredIndex)];
   sound.play('select');
   el.close();render();body.querySelector('[data-banner-action="featured"]')?.focus();
  });
  el.querySelector('[data-remove-featured]')?.addEventListener('click',()=>{target=null;el.close();render();body.querySelector('[data-banner-action="featured"]')?.focus()});
  load(1);
 }
 function testDialog(category){
  const el=modal(category==='Impossible'?'Impossible list':'Test opening','<p>Choose a banner and a card. Test openings spend zero keys and give zero rewards.</p>'+
   '<form class="banner-test-form"><label>Banner<select name="banner">'+orderedBanners.map(id=>'<option value="'+id+'" '+(id===banner?'selected':'')+'>'+displayName(id)+'</option>').join('')+
   '</select></label><label>Card difficulty<select name="category"><option value="">Any</option>'+cardCategories.map(d=>'<option>'+esc(d)+'</option>').join('')+
   '</select></label><label>Find exact level<input name="search" type="search" placeholder="Level name or ID"></label>'+
   '<label>Exact level<select name="levelId"><option value="">Any matching card</option></select></label><button type="submit" class="primary">Run test</button>'+
   '<p role="status" data-test-status></p></form>');
  const form=el.querySelector('form'),select=form.elements.levelId;
  if(category)form.elements.category.value=category;
  bindSearch({el,input:form.elements.search,category:form.elements.category,render(rows,message){
   const impossible=form.elements.category.value==='Impossible';
   select.innerHTML='<option value="">'+(impossible?'Random Impossible level':'Any matching card')+'</option>'+rows.map(row=>
    '<option value="'+row[0]+'">'+esc(row[1])+' · #'+row[0]+'</option>').join('');
   form.querySelector('[data-test-status]').textContent=impossible&&rows.length?
    format(rows.length)+' Impossible '+(rows.length===1?'level':'levels'):rows.length?'':message;
  }});
  form.onsubmit=async e=>{
   e.preventDefault();
   const submit=form.querySelector('button');submit.disabled=true;
   const id=Number(select.value),category=form.elements.category.value;
   try{
    const {result}=await gameCommand('admin.demon.preview',{banner:form.elements.banner.value,quantity:1,...(id?{levelId:id}:category?{category}:{})},null);
    if(!el.open)return;
    el.close();preview(result.pull);
   }catch(error){
    form.querySelector('[data-test-status]').textContent=error.message;
    submit.disabled=false;
   }
  };
 }
 async function transact(action,args){
  if(operation)return;
  const requestHost=body;
  operation=true;status='';if(page==='keys')renderShop();else renderControls();
  try{
   const {wallet:next}=await gameCommand(action,args,action);
   applyWallet(next);
   if(action==='demon.keys.buy'||action==='demon.pull')sound.play('buy',{level:.70});
   if(requestHost===body){
    if(action==='demon.pull')begin(next.pending);
    else status='Keys added to your wallet.';
   }
  }catch(error){status=error.message;onError(error)}
  finally{
   operation=false;
   if(page==='keys')renderShop();else renderControls();
  }
 }
 function click(e){
  const tab=e.target.closest('[data-select-banner]');
  if(tab){
   banner=tab.dataset.selectBanner;status='';sound.play('select');render();body.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});return;
  }
  const button=e.target.closest('[data-banner-action],[data-banner-quantity]');if(!button||button.disabled)return;
  const action=button.dataset.bannerAction,quantity=button.dataset.bannerQuantity;
  if(quantity){
   transact('demon.pull',{banner,quantity:quantity==='max'?'max':Number(quantity),...(banner==='special'&&target?{targetId:target[0]}:{})});
  }else if(action==='odds')showOdds();
  else if(action==='featured')chooseFeatured();
  else if(action==='admin'&&admin)testDialog();
  else if(action==='offer')transact('demon.keys.buy',{offer:true});
  else if(action==='resume')begin(wallet.pending);
 }
 function submit(e){
  if(!e.target.matches('[data-key-purchase]'))return;
  e.preventDefault();
  const input=e.target.elements.quantity;if(!input.validity.valid)return;
  transact('demon.keys.buy',{quantity:input.valueAsNumber});
 }
 return {
  show(host,view,initial,owner){
   body=host;page=view;wallet=initial;admin=owner;status='';
   if(Number.isFinite(initial?.kingdomClock))clockOffset=initial.kingdomClock-Date.now();
   body.onclick=click;body.onsubmit=submit;body.oninput=()=>{if(page==='keys')renderShop()};
   render();
  },
  setWallet(next){
   if(!next)return;
   const before=playerLevel();wallet=next;
   if(target&&!dropEligible(target,dropAccess(playerLevel())))target=null;
   if(Number.isFinite(next.kingdomClock))clockOffset=next.kingdomClock-Date.now();
   if(!body)return;
   if(page==='keys')renderShop();
   else if(playerLevel()!==before)render();
   else renderControls();
  },
  openTest(category){if(body&&admin)testDialog(category)},
  tick(){if(page==='keys'&&body)renderShop()},
  leave(){closeDialog();body=null;page='';status=''}
 };
}
