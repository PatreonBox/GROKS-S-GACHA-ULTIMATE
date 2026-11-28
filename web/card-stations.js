import {ratingLabel} from './icons.js';
import {impossibleCategory,impossibleCount,impossibleTier,impossiblePercent} from './impossible-cards.js';
import {finishAt,finishClass,finishLabels,savedFinish} from './card-finishes.js';
import {difficulties,readIndex,pool,claimIndex,mergeDuplicates,mergeBlocked,strongestMergeFirst} from './pack-engine.js';
import {levelRewardTenths,extremeTable,mergeRoutes,mergeGems} from './card-economy.js';

import {rewardOrigin} from './reward-flight.js';
import {fusionPairHTML,playFusion} from './fusion-show.js';
import {cardRarity,displayCardRank,rarityBadge} from './card-rarity.js';
import {serialBadge} from './card-serials.js';
import {loadingMarkup} from './loading.js';

export function cardStations({enc,faceIcon,gem,card,rewards,applyWallet,sound,openLevel,announce}){
 let current=null,all=[],pools=[],wallet=null,revision=0,category=0,filter='',status='all',page=0,selected=0,busy=false;
 const own=new Map();
 let visit=0,fusion=null,pairCount=1;
 const gems=n=>(n/10).toLocaleString('en-US',{maximumFractionDigits:1});
 function valueFor(t,row){return levelRewardTenths(t,row[10],t===10?extremeTable(pools[t]).last:0)}
 function pending(t){
  const rows=t===impossibleTier?all.filter(c=>c.row[6]===impossibleCategory).map(c=>c.row):pools[t];
  return rows.filter(row=>{const c=own.get(row[0]);return c&&c.indexReward===undefined&&valueFor(t,row)>0});
 }
 function pairCards(c){
  return [card(c.row,{deal:true,finish:finishAt(c,0)}),card(c.row,{deal:true,finish:finishAt(c,1)})];
 }

 function body(){return document.getElementById('arcBody')}
 async function show(view,w){
  current=view;wallet=w;const token=++revision;if(!['index','merge','vault'].includes(view))return;
  const area=body();if(!area)return;
  if(!area.firstElementChild)area.innerHTML=loadingMarkup('Loading cards…');
  try{
   const [records,lists]=await Promise.all([readIndex(),view==='vault'?pools:Promise.all(difficulties.map(pool))]);
   if(token!==revision||body()!==area)return;all=records;pools=lists;own.clear();records.forEach(c=>own.set(c.id,c));render();
  }catch(e){if(token===revision)area.textContent=e.message}
 }
 function render(){
  const area=body();if(!area||!wallet)return;
  area.innerHTML=current==='vault'?vault():current==='index'?index():merge();
  area.oninput=e=>{
   if(e.target.id==='indexTerm'){filter=e.target.value;page=0;area.querySelector('.discovered-list').innerHTML=entries();return}
   if(e.target.id==='fuseCount'){
    const input=e.target,button=area.querySelector('[data-fuse="selected"]');
    pairCount=Number(input.value);button.disabled=busy||!input.checkValidity();
    button.textContent=pairCount>1?'Fuse '+pairCount+' pairs':'Fuse 2 copies';
   }
  };
  area.onchange=e=>{if(e.target.id==='indexShow'){status=e.target.value;page=0;render()}if(e.target.id==='mergeSource'){selected=+e.target.value;pairCount=1;render();area.querySelector('#mergeSource').focus()}};
  area.onclick=async e=>{
   const el=e.target.closest('button');if(!el||busy)return;
   if(el.dataset.category!==undefined){category=+el.dataset.category;page=0;render();return}
   if(el.dataset.leaf){page+=+el.dataset.leaf;area.querySelector('.discovered-list').innerHTML=entries();return}
   if(el.dataset.card&&current==='vault'){
    const owned=own.get(Number(el.dataset.card));if(owned)openLevel(owned.row);return;
   }
   if(el.dataset.inspectLevel){
    const id=Number(el.dataset.inspectLevel),r=own.get(id)?.row||pools[category].find(x=>x[0]===id);
    if(r)openLevel(r);
    return;
   }
   if(el.hasAttribute('data-fill-pairs')){
    const input=area.querySelector('#fuseCount');
    input.value=input.max;input.dispatchEvent(new Event('input',{bubbles:true}));return;
   }
   if(el.dataset.fuse==='all'){area.querySelector('.merge-confirm').showModal();return}
   if(!el.hasAttribute('data-claim')&&!el.hasAttribute('data-fuse'))return;
   if(el.dataset.fuse==='selected'&&!area.querySelector('#fuseCount').checkValidity())return;
   const mode=current,stamp=visit,origin=rewardOrigin(el);
   busy=true;el.disabled=true;
   let ticket=null;
   try{
    if(mode!=='merge'){
     const tier=mode==='vault'?impossibleTier:category;
     const ids=el.dataset.claim==='category'?pending(tier).map(r=>r[0]):[Number(el.dataset.claim)];
     const result=await claimIndex(tier,ids);
     wallet=result.wallet;
     if(stamp===visit)ticket=rewards.reserve('gems',result.gems);
     applyWallet(wallet);
     if(ticket){sound.play('extraAccent',{level:.65});rewards.launch(ticket,origin);announce('Claimed '+result.gems+' gems from '+result.count+(result.count===1?' level':' levels'))}
    }else{
     const bulk=el.dataset.fuse==='confirm',source=own.get(selected);
     if(bulk)el.closest('dialog').close();
     const options=bulk?{}:{id:source.id,expectedCopies:source.copies,pairs:pairCount};
     const {wallet:w,preview}=await mergeDuplicates(options),result=w.lastMerge;
     const [leftHTML,rightHTML]=pairCards(preview);
     wallet=w;pairCount=1;
     if(stamp===visit)ticket=rewards.reserve('gems',result.gems);
     applyWallet(w);
     if(ticket){
      const scene=playFusion({leftHTML,rightHTML,resultHTML:card(result.row,{deal:true,finish:savedFinish(result),serial:result.serial}),resultName:result.row[1],
       promoted:result.promoted,finish:savedFinish(result),gems:result.gems,count:result.count,sound,
       onReward:anchor=>{if(visit===stamp)rewards.launch(ticket,anchor,{front:true});else rewards.settle(ticket)}
      });
      fusion=scene;await scene.done;if(fusion===scene)fusion=null;
     }
    }
   }catch(e){if(ticket)rewards.settle(ticket);announce(e.message)}
   finally{busy=false;if(current===mode)await show(mode,wallet)}
  };
 }
 function entries(){
  const q=filter.trim().toLowerCase(),t=category,records=pools[t].filter(r=>{
   const c=own.get(r[0]);return(!q||r[1].toLowerCase().includes(q)||String(r[0])===q)&&(status==='all'||(status==='found'&&c)||(status==='missing'&&!c)||(status==='holo'&&c?.everHolo)||(status==='antimatter'&&c?.everAntimatter)||(status==='ready'&&c&&c.indexReward===undefined&&valueFor(t,r)>0));
  });
  const priority=r=>{const c=own.get(r[0]);return c?(c.indexReward===undefined?0:1):2};
  records.sort((a,b)=>priority(a)-priority(b));
  const pages=Math.max(1,Math.ceil(records.length/24));page=Math.min(page,pages-1);
  return '<div class="index-list">'+records.slice(page*24,page*24+24).map(row=>{
   const id=row[0],c=own.get(id),claimed=c?.indexReward!==undefined,units=valueFor(t,row),value=claimed?c.indexReward:gems(units);
   const reward=c&&!claimed&&units?'<button class="level-claim" data-claim="'+id+'" aria-label="Claim '+value+' gems for '+enc(row[1])+'">'+gem+'Claim '+value+'</button>':'<span class="level-yield">'+gem+value+(claimed?' · Claimed':units?' gems':' gems')+'</span>';
   return '<article class="index-entry '+(c?'found':'missing')+'"><button class="index-name" data-inspect-level="'+id+'"><b>'+enc(row[1])+'</b><small>'+(t===10?'#'+row[10]:ratingLabel(row[7],row[8]==='Platformer'))+' · '+(c?(c.everAntimatter?'◈ Antimatter found':c.everHolo?'✧ Holo found':'Discovered'):'Undiscovered')+'</small>'+rarityBadge(cardRarity(row))+'</button>'+reward+'</article>';
  }).join('')+'</div>'+(records.length?'':'<p>No matching levels.</p>')+(pages>1?'<div class="station-paging"><button class="outline" data-leaf="-1" '+(!page?'disabled':'')+'>Previous</button> '+(page+1)+' / '+pages+' <button class="outline" data-leaf="1" '+(page+1>=pages?'disabled':'')+'>Next</button></div>':'');
 }
 function index(){
  const t=category,d=difficulties[t],ready=pending(t),total=ready.reduce((sum,r)=>sum+valueFor(t,r),0);
  const progress=pools.map(rows=>rows.reduce((acc,r)=>{if(own.has(r[0]))acc++;return acc},0));
  const perLevel=t===10?gems(levelRewardTenths(10,0,0))+'–'+gems(levelRewardTenths(10,1,extremeTable(pools[t]).last))+
   ' gems per level by AREDL rank':gems(valueFor(t,pools[t][0]))+' gems per level';
  return '<section class="station-heading"><div><h2>Card index</h2><p>Each discovered level has its own one-time reward.</p></div><span>'+all.length.toLocaleString()+' discovered</span></section>'+vaultEntry()+'<div class="index-categories">'+difficulties.map((diff,i)=>{
   const available=i>0&&pools[i].some(r=>own.has(r[0])&&own.get(r[0]).indexReward===undefined);
   return '<button data-category="'+i+'" aria-pressed="'+(i===t)+'">'+faceIcon(diff)+'<span>'+diff+'<small>'+progress[i]+' / '+pools[i].length+'</small></span>'+(available?'<i title="Unclaimed gems">◆</i>':'')+'</button>';
  }).join('')+'</div><div class="milestone"><div><h3>'+d+'</h3><p>'+perLevel+' · '+progress[t]+' discovered</p><progress value="'+progress[t]+'" max="'+pools[t].length+'"></progress></div>'+(t?'<div class="index-payout"><small>'+ready.length+' unclaimed '+(ready.length===1?'level':'levels')+'</small><button class="primary" data-claim="category" '+(!total||busy?'disabled':'')+'>'+gem+'Claim all · '+gems(total)+'</button></div>':'')+'</div><div class="collection-tools"><input id="indexTerm" aria-label="Search index" placeholder="Search this category" value="'+enc(filter)+'"><select id="indexShow" aria-label="Index filter">'+[['all','All levels'],['ready','Ready to claim'],['found','Discovered'],['missing','Undiscovered'],['holo','Holo discoveries'],['antimatter','Antimatter discoveries']].map(([v,n])=>'<option value="'+v+'" '+(v===status?'selected':'')+'>'+n+'</option>').join('')+'</select></div><div class="discovered-list">'+entries()+'</div>';
 }
 function vaultEntry(){
  const found=all.filter(c=>c.row[6]===impossibleCategory).length;
  return '<a class="vault-entry" href="#gacha/vault"><span class="vault-sigil" aria-hidden="true">?</span>'+
   '<span><strong>??? Secret vault</strong><small>Godly pack exclusive · '+found+' / '+impossibleCount+' discovered</small></span></a>';
 }
 function vault(){
  const discovered=all.filter(c=>c.row[6]===impossibleCategory),slots=new Map(discovered.map(c=>[c.row[10],c]));
  const claimable=pending(impossibleTier);
  const perCard=levelRewardTenths(impossibleTier,0,0),reward=gems(perCard);
  return '<section class="vault" aria-label="Secret vault">'+
   '<div class="vault-head"><div><a class="outline" href="#gacha/index">Card index</a><h2>???</h2><p>Secret vault</p></div>'+
   '<div class="vault-progress"><b>'+discovered.length+' / '+impossibleCount+' discovered</b><span>Godly packs · '+impossiblePercent+'% per card for a secret</span>'+
   (claimable.length?'<button class="primary" data-claim="category">'+gem+'Claim '+gems(claimable.length*perCard)+'</button>':'')+'</div></div>'+
   '<div class="vault-grid">'+Array.from({length:impossibleCount},(_,i)=>{
    const slot=i+1,c=slots.get(slot);
    if(!c)return '<article class="vault-shell" aria-label="Undiscovered card '+slot+'"><span class="vault-ordinal" aria-hidden="true">'+String(slot).padStart(2,'0')+'</span><span class="vault-mark" aria-hidden="true">?</span>'+
     '<span class="vault-caption" aria-hidden="true">???</span></article>';
    return '<article class="vault-unlocked">'+card(c.row,{copies:c.copies,holoCopies:c.holoCopies,antimatterCopies:c.antimatterCopies,serials:c.serials})+
     (c.indexReward===undefined?'<button class="level-claim" data-claim="'+c.id+'" aria-label="Claim '+reward+' gems for '+enc(c.row[1])+'">'+gem+'Claim '+reward+'</button>':'<div class="vault-paid">'+gem+gems(c.indexReward*10)+' claimed</div>')+'</article>';
   }).join('')+'</div></section>';
 }
 function mergeReceipt(previous){
  if(!previous)return '';
  const count=previous.count||1,highlight=previous.highlights||[],finish=savedFinish(previous);
  const rarity=cardRarity(previous.row),rank=displayCardRank(previous.row);
  return '<section class="merge-result '+finishClass(finish)+'" data-card-rarity="'+rarity.id+'"><small>'+
   (count>1?count.toLocaleString('en-US')+' PAIRS MERGED':'LAST MERGE')+'</small><h3>'+enc(previous.row[1])+'</h3>'+
   '<p>'+enc(previous.from)+' → '+enc(previous.row[1])+' · '+enc(previous.row[6])+
   (rank?' #'+rank:'')+(finish==='standard'?'':' · '+finishLabels[finish])+'</p>'+rarityBadge(rarity)+serialBadge(previous.serial)+
   '<strong class="merge-gems">'+gem+'+'+previous.gems.toLocaleString('en-US')+' '+(previous.gems===1?'gem':'gems')+'</strong>'+
   (count>1?'<details><summary>Best results'+(previous.promotions?' · '+previous.promotions+' promoted':'')+'</summary><ul>'+
    highlight.map(item=>'<li>'+faceIcon(item.row[6])+'<span>'+enc(item.row[1])+(savedFinish(item)==='standard'?'':' · '+finishLabels[savedFinish(item)])+'</span>'+rarityBadge(cardRarity(item.row))+'<b>×'+item.count+'</b></li>').join('')+'</ul></details>':'')+'</section>';
 }
 function merge(){
  const duplicates=all.filter(x=>x.copies>=2&&x.row[6]!==impossibleCategory).sort(strongestMergeFirst);
  const route=card=>mergeRoutes(card.row,pools,difficulties);
  const ready=duplicates.filter(c=>!mergeBlocked(c,wallet)&&route(c).near.length);
  const total=ready.reduce((n,c)=>n+Math.floor(c.copies/2),0);
  const c=duplicates.find(x=>x.id===selected)||ready[0]||duplicates[0];selected=c?.id||0;
  const outcome=mergeReceipt(wallet.lastMerge);
  const header='<section class="station-heading"><div><h2>Merge station</h2><p>Fuse identical cards into harder levels and earn gems.</p></div><a class="outline" href="#gacha/collection">My cards</a></section>';
  if(!c)return header+'<div class="merge-rig"><h3>No duplicate pairs yet</h3><p>Cards with at least two copies appear here.</p><a class="primary" href="#gacha">Open packs</a></div>'+outcome;
  const t=difficulties.indexOf(c.row[6]),r=route(c),lock=mergeBlocked(c,wallet),available=Math.floor(c.copies/2);
  pairCount=Math.max(1,Math.min(available,pairCount||1));
  const blocked=lock||!r.near.length||busy;
  const promos=t===10?'One to five AREDL places higher.':'95% same '+(t<6?c.row[7]+'-star group':'difficulty')+' · 5% promotion to '+difficulties[t+1]+'.';
  const bulk='<div class="merge-bulk"><span><b>'+total.toLocaleString('en-US')+'</b> '+(total===1?'pair':'pairs')+' ready · strongest first</span>'+
   '<button type="button" class="outline" data-fuse="all" '+(total&&!busy?'':'disabled')+'>Merge all</button></div>'+
   '<dialog class="merge-confirm"><h3>Merge all eligible pairs?</h3><p>Fuses the strongest cards first, including new pairs created during the merge. Each fusion uses two copies. Standard copies are used first, then Holo, then Antimatter.</p>'+
   '<form method="dialog"><button class="outline" value="cancel">Cancel</button><button type="button" class="primary" data-fuse="confirm">Merge all pairs</button></form></dialog>';
  return header+bulk+'<section class="merge-rig"><label>Duplicate cards <select id="mergeSource">'+duplicates.map(x=>'<option value="'+x.id+'" '+(x.id===c.id?'selected':'')+'>'+enc(x.row[1])+' ×'+x.copies+'</option>').join('')+'</select></label>'+
   fusionPairHTML(...pairCards(c))+'<div class="fusion-info"><div><h3>'+enc(c.row[1])+'</h3><p>'+enc(c.row[6])+' · '+
   (t===10?'AREDL #'+c.row[10]:ratingLabel(c.row[7],c.row[8]==='Platformer')+' · merge position #'+r.position)+' · '+c.copies+' copies</p></div></div><p>'+promos+'</p><p class="merge-note">'+
   (r.near.length?'Possible upgrades include '+r.near.slice(-3).reverse().map(a=>enc(a[1])).join(', ')+'.':'This is the highest card in its group.')+'</p><p>'+gem+' '+mergeGems(t)+' gems per pair'+
   (t<10?' · '+(mergeGems(t)+mergeGems(t+1))+' on promotion':'')+'. '+'Fusing keeps the rarest finish used.'+'</p>'+
   '<div class="merge-quantity"><label for="fuseCount">Pairs <input id="fuseCount" type="number" inputmode="numeric" min="1" max="'+available+'" step="1" value="'+pairCount+'" required '+(blocked?'disabled':'')+'></label>'+
   '<button class="primary" data-fuse="selected" '+(blocked?'disabled':'')+'>'+(lock?'Card is in battle or recovering':pairCount>1?'Fuse '+pairCount+' pairs':'Fuse 2 copies')+'</button>'+
   (available>1?'<button type="button" class="outline" data-fill-pairs '+(blocked?'disabled':'')+'>Use all '+available+'</button>':'')+'</div></section>'+outcome;
 }
 return {show,leave(){current=null;revision++;visit++;fusion?.close();fusion=null}};
}
