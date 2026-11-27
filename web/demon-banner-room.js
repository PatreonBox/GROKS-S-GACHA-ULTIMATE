import {demonBanners,bannerOdds,bannerPity,demonPity,demonKeyPrice,demonKeyOffer} from './demon-banner.js';
import {gameCommand} from './game-client.js';
import {cardCategories} from './pack-engine.js';
import {ico} from './icons.js';
import {featureLevel} from './level-access.js';
import {lockBadge} from './level-lock.js';
import {playerProgress} from './player-progression.js';
import {cardRarity,rarityBadge} from './card-rarity.js';

export const demonKeyIcon='<span class="demon-key-icon" aria-hidden="true"><svg viewBox="0 0 26 26" fill="none"><path d="M11 15l-8 7H1v-3l4-4 2 1 3-3m1 2a7 7 0 1 0-3-5l3 5Z" fill="#9fceec" stroke="#d0fff4" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 6l1 3M20 6l-1 3" stroke="#102a55" stroke-width="1.5" stroke-linecap="round"/><path d="M13 12l2 1 3-1" stroke="#214267" stroke-width="1.15" stroke-linecap="round"/></svg></span>';
const gem='<img class="gd-gem" src="/assets/packs/gem.png" alt="">';
const format=n=>(Number(n)||0).toLocaleString('en-US');
const percentage=n=>n.toLocaleString('en-US',{maximumFractionDigits:6})+'%';
const descriptions={
 standard:'Every rarity is in reach, including the hidden Impossible tier.',
 special:'Choose a featured level to improve your chance of pulling it.',
 pro:'Spend five keys per draw for the strongest banner odds.'
};
const orderedBanners=['standard','special','pro'];
const bannerFaces={
 standard:['normal','hard','harder'],special:['demon-easy','demon-hard','demon-medium'],
 pro:['demon-hard','demon-extreme','demon-insane']
};
const displayName=id=>demonBanners[id]?.name||id;
const longTime=ms=>{
 const seconds=Math.ceil(Math.max(0,ms)/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);
 return [hours,minutes,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency=(icon,label)=>'<span class="banner-currency">'+icon+' <b>'+label+'</b></span>';

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
   return '<div><b>'+label+'</b><span>'+format(next)+' / '+format(limit)+' draws</span><progress max="'+limit+'" value="'+next+'" aria-label="'+label+' guarantee"></progress></div>';
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
  const [left,center,right]=bannerFaces[banner],face=id=>'<img src="/assets/faces/'+id+'.webp" width="52" height="52" alt="">';
  return '<div class="demon-banner-art" aria-hidden="true"><div class="banner-orbits"></div><div class="banner-glint"></div>'+
   '<div class="banner-card-silhouette banner-card-left">'+face(left)+'</div><div class="banner-card-silhouette banner-card-right">'+face(right)+'</div>'+
   '<div class="banner-core"><div class="banner-core-face">'+face(center)+'</div></div></div>';
 }
 function featured(){
  if(banner!=='special')return '';
  const rarity=target&&cardRarity(target);
  return '<div class="banner-featured">'+(target?'<img src="'+esc(coverSource(target[0]))+'" alt="" loading="lazy"><div><b>'+esc(target[1])+'</b>'+rarityBadge(rarity)+'</div>':
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
   '<div class="banner-pity"></div><div class="banner-draw-actions"></div><p class="banner-note" role="status"></p></section></div>';
 }
 function shopMarkup(){
  return '<section class="demon-key-shop"><div class="demon-key-header"><div><h2>Key Shop</h2><p>Demon Keys open all three banners.</p></div>'+
   '<a class="outline" href="#gacha/banners">'+ico('left')+' Demon Banners</a></div>'+
   '<div data-key-shop-offer></div><article class="key-shop-regular"><div class="big-key">'+demonKeyIcon+'</div>'+
   '<div><h3>Demon Keys</h3><p>'+format(demonKeyPrice)+' gems per key</p></div>'+
   '<form data-key-purchase><label>Quantity<input name="quantity" type="number" min="1" step="1" inputmode="numeric" value="1" required></label>'+
   '<button class="primary" type="submit">Buy '+currency(gem,'<span data-key-total>'+format(demonKeyPrice)+'</span>')+'</button></form></article>'+
   '<p class="banner-note" role="status" data-key-shop-status></p></section>';
 }
 function renderShop(){
  const slot=body?.querySelector('[data-key-shop-offer]');if(!slot)return;
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
  if(page==='keys')renderShop();else renderControls();
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
  const rows=bannerOdds(banner,playerLevel(),{target:banner==='special'&&Boolean(target),luck:wallet?.luck||0});
  const html=rows.map(({id,label,color,percent})=>'<tr><th scope="row"><span style="--odds-color:'+color+'">'+esc(label)+'</span></th><td>'+percentage(percent)+(percent>0&&percent<.001?' · 1 in '+format(Math.round(100/percent)):'')+'</td></tr>').join('');
  modal(displayName(banner)+' banner odds','<p>Each draw starts with five cards. Listed odds are per card before guarantees.'+(banner==='special'&&target?' Your chosen card gets a 6% chance within its rarity group, plus its usual chance.':'')+'</p>'+
   '<table class="banner-odds"><thead><tr><th>Rarity</th><th>Per card</th></tr></thead><tbody>'+html+'</tbody></table>'+
   '<p>Each banner tracks its own guarantees. Legendary or better comes within '+format(demonPity.legendary)+' draws and Mythic or better within '+format(demonPity.mythic)+' draws.</p>');
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
  const el=modal('Choose a featured level','<label class="banner-search">Find a level<input type="search" maxlength="80" placeholder="Level name or ID" data-featured-search autofocus></label>'+
   '<div class="featured-results" aria-live="polite"></div>'+(target?'<button class="outline" type="button" data-remove-featured>Clear featured level</button>':''));
  const results=el.querySelector('.featured-results'),search=el.querySelector('[data-featured-search]');
  let found=[];
  bindSearch({el,input:search,render(rows,message){
   found=rows.filter(row=>row[6]!=='Impossible');
   results.innerHTML=found.map(row=>'<button type="button" data-featured-id="'+row[0]+'"><span><strong>'+esc(row[1])+'</strong><small>'+
    esc(row[6])+' · #'+row[0]+'</small></span>'+rarityBadge(cardRarity(row))+'</button>').join('')||'<p>'+esc(message)+'</p>';
  }});
  results.addEventListener('click',e=>{
   const button=e.target.closest('[data-featured-id]');if(!button)return;
   target=found.find(row=>row[0]===Number(button.dataset.featuredId));
   el.close();render();body.querySelector('[data-banner-action="featured"]')?.focus();
  });
  el.querySelector('[data-remove-featured]')?.addEventListener('click',()=>{target=null;el.close();render();body.querySelector('[data-banner-action="featured"]')?.focus()});
 }
 function testDialog(){
  const el=modal('Test opening','<p>Choose a banner and a card. Test openings spend zero keys and give zero rewards.</p>'+
   '<form class="banner-test-form"><label>Banner<select name="banner">'+orderedBanners.map(id=>'<option value="'+id+'" '+(id===banner?'selected':'')+'>'+displayName(id)+'</option>').join('')+
   '</select></label><label>Card difficulty<select name="category"><option value="">Any</option>'+cardCategories.map(d=>'<option>'+esc(d)+'</option>').join('')+
   '</select></label><label>Find exact level<input name="search" type="search" placeholder="Level name or ID"></label>'+
   '<label>Exact level<select name="levelId"><option value="">Any matching card</option></select></label><button type="submit" class="primary">Run test</button>'+
   '<p role="status" data-test-status></p></form>');
  const form=el.querySelector('form'),select=form.elements.levelId;
  bindSearch({el,input:form.elements.search,category:form.elements.category,render(rows,message){
   select.innerHTML='<option value="">Any matching card</option>'+rows.map(row=>
    '<option value="'+row[0]+'">'+esc(row[1])+' · #'+row[0]+'</option>').join('');
   form.querySelector('[data-test-status]').textContent=rows.length?'':message;
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
   if(Number.isFinite(next.kingdomClock))clockOffset=next.kingdomClock-Date.now();
   if(!body)return;
   if(page==='keys')renderShop();
   else if(playerLevel()!==before)render();
   else renderControls();
  },
  openTest(){if(body&&admin)testDialog()},
  tick(){if(page==='keys'&&body)renderShop()},
  leave(){closeDialog();body=null;page='';status=''}
 };
}
