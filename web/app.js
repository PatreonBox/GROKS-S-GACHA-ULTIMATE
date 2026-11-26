import {impossibleCategory,impossibleCover} from './impossible-cards.js';
import {readWallet,pool as cardPool,difficulties as cardTiers} from './pack-engine.js';
import {statsFor} from './battle-engine.js';
import {stat as cardNum} from './card-economy.js';
import {ico,ratingLabel,ratingIcon} from './icons.js';
import {createPackRoom} from './pack-room.js';
import {createPackSound} from './pack-sound.js';
import {tierNames, starTiers, readRoute, loadTier, browseTier} from './demon-tiers.js';
import {gameSession,gameCommand} from './game-client.js';
import {createSectionGuides} from './game-introduction.js';
import {setGuideProgress} from './guide-progress.js';
import {playerBoard} from './player-board.js';
import {sectionGuideId} from './section-guides.js';
import {setupLevelUps} from './level-up.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>n==null?'—':Number(n).toLocaleString('en-US');
const small=n=>n==null?'—':Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
const faces={'Auto':'auto','Easy':'easy','Normal':'normal','Hard':'hard','Harder':'harder','Insane':'insane','Easy Demon':'demon-easy','Medium Demon':'demon-medium','Hard Demon':'demon-hard','Insane Demon':'demon-insane','Extreme Demon':'demon-extreme','Demon':'demon','Unrated':'unrated'};
const badge=d=>'<span class="badge"><img class="face" alt="" src="/assets/faces/'+(faces[d]||'unrated')+'.webp">'+esc(d||'Unrated')+'</span>';
const author=r=>r[2]||(+r[3]>0?'Player '+r[3]:'Creator unlisted');
function stored(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const raw=stored('gdlb.bookmarks',[]),saved=new Map((Array.isArray(raw)?raw:[]).filter(r=>Array.isArray(r)&&Number.isSafeInteger(r[0])).map(r=>[r[0],r]));
let activeTier='extreme';
const playerRanks=()=>section==='leaderboard'&&activeTier==='players';
const isStarList=()=>section==='stars';
const isExtremeList=()=>section==='demons'&&activeTier==='extreme';
const isTierList=()=>section==='demons'&&activeTier!=='extreme';
let section='leaderboard',layout=stored('gdlb.view','list'),page=0,focusSlide=0,serial=0,timer,toastTimer,queryAbort,localWorker,offline=false,nextPage=null,cursors=[null],liveTotal=null;
let seed,localImages=new Set(),initialRows=[],rankRows=new Map(),demonRecords=[],demonLoading=null,liveDemonTime=0,current=[],currentDetails=null,statusMode='archive';
const pageSize=20, rowMap=new Map(),sourceDate='22 Nov 2026';
let arcade,guides;
const ranks=playerBoard($('podrows'),$('playersPage'));
const sound=createPackSound();
sound.listenForUiTaps();
setupLevelUps($('levelUp'),sound);
document.querySelectorAll('[data-icon]').forEach(i=>i.innerHTML=ico(i.dataset.icon));
function storeRows(rows){for(const r of rows)if(!r[15])rowMap.set(r[0],r)}
function announce(s){const t=document.querySelector('.toast');t.textContent=s;t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),1600)}
function cover(id,hero=false){const src=hero&&seed.featured.some(x=>x.row[0]===id)?'/assets/shots/hero-'+id+'.avif':localImages.has(id)?'/assets/shots/'+id+'.webp':'/api/thumbnail/'+id+(hero?'/high':'/small');return '<span class="cover"><img alt="" loading="'+(hero?'eager':'lazy')+'" data-shot="'+id+'" src="'+src+'"></span>'}
document.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||!img.dataset.shot)return;const id=Number(img.dataset.shot);if(!img.dataset.direct&&img.getAttribute('src')?.startsWith('/api/thumbnail/')){img.dataset.direct='yes';img.src='https://levelthumbs.prevter.me/thumbnail/'+id+'/small';return}if(!img.dataset.tried&&(rankRows.has(id)||demonRecords.some(d=>d.id===id))){img.dataset.tried='1';img.src='https://raw.githubusercontent.com/All-Rated-Extreme-Demon-List/Thumbnails/main/levels/full/'+id+'.webp';return}const video=currentDetails?.[0]===id&&currentDetails[13]||current.find(r=>r[0]===id)?.[13]||rowMap.get(id)?.[13];if(video&&!img.dataset.video){img.dataset.video='yes';img.src='https://i.ytimg.com/vi/'+video+'/hqdefault.jpg';return}const slot=img.parentElement;if(slot?.classList.contains('cover')){slot.classList.add('missing');slot.textContent='No thumbnail'}},true);
function savedBtn(id){const yes=saved.has(id);return '<button class="bookmark '+(yes?'set':'')+'" data-save="'+id+'" aria-label="'+(yes?'Remove saved level':'Save level')+'" aria-pressed="'+yes+'" title="'+(yes?'Remove saved level':'Save level')+'">'+ico('bookmark')+'</button>'}
function refreshSaves(){const n=saved.size;$('saveCount').textContent=n?String(n):'';document.querySelectorAll('[data-save]').forEach(b=>{let yes=saved.has(Number(b.dataset.save));if(b.classList.contains('bookmark')){b.classList.toggle('set',yes);b.title=b.ariaLabel=yes?'Remove saved level':'Save level';b.setAttribute('aria-pressed',yes)}else b.innerHTML=ico(yes?'check':'bookmark')+(yes?'Saved':'Save level')})}
function toggle(id){const row=current.find(r=>r[0]===id)||rowMap.get(id)||saved.get(id);const r=row?.[15]?row.slice(0,11):row;if(!r)return;if(saved.has(id)){saved.delete(id);announce('Removed from saved levels')}else{saved.set(id,r);announce('Level saved')}write('gdlb.bookmarks',[...saved.values()]);refreshSaves();if(section==='saved')loadPage()}
function featured(delta=0){focusSlide=(focusSlide+delta+seed.featured.length)%seed.featured.length;const s=seed.featured[focusSlide],r=s.row;$('featureArt').style.backgroundImage='url(/assets/shots/hero-'+r[0]+'.avif)';$('featureName').textContent=r[1];$('featureCreator').textContent='by '+author(r);$('featureDifficulty').innerHTML=badge(r[6]);$('slideDots').innerHTML=seed.featured.map((_,i)=>'<b class="'+(i===focusSlide?'on':'')+'"></b>').join('');$('featureOpen').dataset.id=r[0]}
function fromDemon(d){const old=rowMap.get(d.id)||saved.get(d.id);const [player,downloads,likes,stars,length,coins]=d.stats||[0,null,null,10,'',null];return old||[d.id,d.name,d.publisher||'',player,downloads,likes,'Extreme Demon',stars,length,coins,d.status==='MainList'?d.position:0]}
async function demons(live=false){
 if(!demonLoading)demonLoading=(async()=>{const r=await fetch('/data/demons.json');if(!r.ok)throw Error('Demon list unavailable');demonRecords=await r.json();indexDemons()})().catch(e=>{demonLoading=null;throw e});
 await demonLoading;
 if(!live||Date.now()-liveDemonTime<180000)return;
 liveDemonTime=Date.now();
 try{const r=await fetch('/api/demons',{signal:AbortSignal.timeout(12500)});if(!r.ok)return;const fresh=await r.json();if(!Array.isArray(fresh)||!fresh.length)return;const old=new Map(demonRecords.map(d=>[d.uuid,d]));demonRecords=fresh.map(d=>({...old.get(d.uuid),...d}));indexDemons();if(isExtremeList())loadPage()}catch{}
}
function indexDemons(){demonRecords.sort((a,b)=>(a.status==='MainList'?0:1)-(b.status==='MainList'?0:1)||(a.position??1e9)-(b.position??1e9));rankRows.clear();for(const d of demonRecords){if(!rankRows.has(d.id)||(!d.twoPlayer&&d.status==='MainList'))rankRows.set(d.id,d)}}
const selectOpts=(a)=>a.map(([v,l])=>'<option value="'+esc(v)+'">'+esc(l)+'</option>').join('');
function drawTierNav() {
 const starNav=$('starNav');starNav.hidden=playerRanks()||section!=='leaderboard'&&!isStarList();
 if(!starNav.hidden){
  starNav.innerHTML=Object.entries(starTiers).map(([slug,tier])=>{
   const active=isStarList()&&activeTier===slug;
   const range=tier.stars.join('–');
   return '<a class="tier-link standard-'+slug+(active?' selected':'')+'" href="#stars/'+slug+'" '+(active?'aria-current="page"':'')+'><img src="/assets/faces/'+slug+'.webp" alt=""><span><strong>'+tier.name+'</strong><small>'+range+' '+(range==='1'?'star':'stars')+'</small></span></a>';
  }).join('');
 }
 const nav=$('tierNav');nav.hidden=playerRanks()||['saved','gacha','battle','kingdom','trading'].includes(section)||isStarList();
 if(nav.hidden)return;
 nav.innerHTML=Object.entries(tierNames).map(([slug, label])=>{
  const meta=seed.demonTiers?.[slug],active=section==='demons'&&activeTier===slug;
  return '<a class="tier-link '+slug+(active?' selected':'')+'" href="#demons/'+slug+'" '+(active?'aria-current="page"':'')+'><img src="/assets/faces/demon-'+slug+'.webp" alt=""><span><strong>'+label+' Demons</strong><small>'+num(meta?.count)+(slug==='extreme'?' ranked':' levels')+'</small></span></a>';
 }).join('');
}
const baseSorts=[['downloads','Most downloaded'],['likes','Most liked'],['newest','Newest ID'],['tier','Difficulty tier']];
function setSection(route){
 const selected=readRoute(route);
 if(section!==selected.section||activeTier!==selected.tier)$('results').replaceChildren();
 section=selected.section;activeTier=selected.tier;
 clearTimeout(timer);
 document.querySelectorAll('.tab').forEach(b=>{b.classList.toggle('active',b.dataset.tab===section);if(b.dataset.tab===section)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 $('showcase').hidden=section!=='leaderboard'||playerRanks();drawTierNav();
 ranks.show(section==='leaderboard'?(playerRanks()?'full':'spotlight'):null);
 const inArcade=['gacha','battle','kingdom','trading'].includes(section);
 document.querySelector('.board').hidden=inArcade||playerRanks();
 const blocked=arcade.page(section==='battle'?(activeTier==='easy'?'battle':activeTier):inArcade?activeTier:null,selected.pack);
 guides.select(blocked||section==='trading'?false:sectionGuideId(section,activeTier));
 if(inArcade||playerRanks()){serial++;queryAbort?.abort();return}
 $('sectiontag').textContent=isStarList()?'STAR LEVELS':section==='demons'?'DEMON LISTS':section==='saved'?'YOUR COLLECTION':'GEOMETRY DASH';
 $('boardTitle').textContent=isStarList()?starTiers[activeTier].name+' levels':section==='demons'?tierNames[activeTier]+' Demons':section==='saved'?'Saved levels':'Level leaderboard';
 $('search').value='';
 $('search').placeholder=section==='demons'?'Search '+activeTier+' demons or paste an ID…':'Search levels or paste an ID…';
 let filters,sorts,filterLabel;
 if(isStarList()){
  const stars=starTiers[activeTier].stars;
  filters=[['all','All star ratings'],...stars.map(n=>[String(n),n+(n===1?' star':' stars')])];
  filterLabel='Star rating';
  sorts=[['challenge','Community difficulty'],['downloads','Most downloaded'],['likes','Most liked'],['newest','Newest ID'],['name','Name A–Z']];
  if(seed.starSources[activeTier])sorts.splice(1,0,['star-list',activeTier==='insane'?'Hardest Insanes list':'Hardest Harders list']);
 }else if(isExtremeList()){
  filters=[['main','Main list'],['legacy','Legacy list']];filterLabel='List category';
  sorts=[['rank','AREDL rank'],['name','Name A–Z']];
 }else if(isTierList()){
  const meta=seed.demonTiers[activeTier];
  filters=[['all','All formats'],['classic','Classic'],['platformer','Platformer']];filterLabel='Level format';
  sorts=[['rating','GDDL difficulty'],['downloads','Most downloaded'],['likes','Most liked'],['name','Name A–Z'],['newest','Newest ID']];
  if(meta.ranked)sorts.splice(1,0,['placement',meta.rankSource+' placements']);
 }else{
  filters=[['All','All difficulties'],['All demons','All demons'],...Object.keys(faces).filter(x=>x!=='Demon').map(x=>[x,x])];
  sorts=baseSorts;filterLabel='Difficulty';
 }
 $('difficultyBox').hidden=isStarList()&&starTiers[activeTier].stars.length===1;
 $('difficulty').innerHTML=selectOpts(filters);$('difficulty').setAttribute('aria-label',filterLabel);
 $('sort').innerHTML=selectOpts(sorts);
 restart();
 if(isExtremeList())demons(true).catch(()=>{});
}
function restart(){page=0;cursors=[null];liveTotal=null;nextPage=null;offline=false;loadPage()}
function sourceLabel(t){$('sourceLabel').innerHTML=ico('database')+'<span>'+esc(t)+'</span>'}
function searching(v){if(v){$('pageJump').hidden=true;$('pageNum').hidden=false}$('results').setAttribute('aria-busy',String(v));$('nextPage').disabled=v||!nextPage;$('prevPage').disabled=v||page===0}
function metric(key,value){return '<span class="metric" title="'+esc(num(value))+'">'+ico(key)+small(value)+'</span>'}
function isStandardRating(row){return row[7]>0&&Object.hasOwn(starTiers,String(row[6]).toLowerCase())}
function rewardBadge(row){
 const count=row[7],moon=row[8]==='Platformer';
 const label=count+' '+(moon?'moon':'star')+(count===1?'':'s');
 return '<span class="reward '+(moon?'moons':'stars')+'" aria-label="'+label+'" title="'+label+'">'+ratingIcon(moon)+' '+count+'</span>';
}
function difficultyWithReward(row){
 return '<span class="difficulty-reward">'+badge(row[6])+(isStandardRating(row)?rewardBadge(row):'')+'</span>';
}
function rowTitle(r){
 const note=isStarList()&&$('sort').value==='challenge'?(r[11]?' · Community tier '+r[11]:' · Unranked'):isTierList()?(r[8]==='Platformer'?' · Platformer':layout==='grid'&&r[11]!=null?' · Tier '+formatRating(r[11]):''):'';
 const mobile=layout==='list'&&isStandardRating(r)?'<span class="mobile-rating">'+(isStarList()?badge(r[6]):difficultyWithReward(r))+'</span>':'';
 return '<span class="words"><span class="name">'+esc(r[1])+'</span><span class="author">by '+esc(author(r))+note+'</span>'+mobile+'</span>';
}
function formatRating(rating){return Number.isFinite(rating)?Number(rating.toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2}):'—'}
function render(rows,total,next,mode,extra='',ranks=[]){
 current=rows;storeRows(rows);statusMode=mode;nextPage=next;$('pageNum').textContent='Page '+num(page+1);searching(false);refreshSaves();
 const demon=isExtremeList(),tierList=isTierList(),isArchive=mode==='archive',isCached=mode==='index';$('retry').hidden=!isCached;
 sourceLabel(isStarList()?($('sort').value==='challenge'?'Community tiers':$('sort').value==='star-list'?'Community list':'GDHistory'):demon?'AREDL rankings':tierList?'GDHistory + GDDL':section==='saved'?'Saved on this device':isArchive?'GDHistory archive':'Bundled index');
 const jump=(section==='demons'||isStarList())&&total>pageSize;
 $('pageJump').hidden=!jump;$('pageNum').hidden=jump;
 if(jump){const pages=Math.ceil(total/pageSize);$('jumpNumber').max=pages;$('jumpNumber').value=page+1;$('pageTotal').textContent='of '+num(pages)}
 const label=total===null?'Browse levels':(isArchive?'≈ ':'')+num(total)+(section==='demons'?(total===1?' demon':' demons'):section==='saved'?' saved':total===1?' level':' levels');
 $('resultMeta').textContent=label+' · '+(extra|| (demon?($('sort').value==='rank'?'AREDL order':'Name order'):($('sort').value==='likes'?'Ranked by likes':$('sort').value==='newest'?'Newest ID first':$('sort').value==='tier'?'Hardest tier first · newest ID breaks ties':'Ranked by downloads')))+(isCached?' · Offline snapshot':'');
 $('results').className='';if(!rows.length){$('results').innerHTML='<div class="empty"><strong>'+(section==='saved'&&!saved.size?'No saved levels yet':'No matching levels')+'</strong><p>'+(section==='saved'&&!saved.size?'Bookmark a level to keep its thumbnail and stats here.':'Try another name, level ID, or difficulty.')+'</p><button class="outline" id="emptyAction">'+(section==='saved'&&!saved.size?'Browse levels':'Clear filters')+'</button></div>';$('emptyAction').onclick=()=>section==='saved'&&!saved.size?navigate('leaderboard'):setSection(section==='demons'||isStarList()?section+'/'+activeTier:section);return}
 function rank(r,i){if(isStarList()&&$('sort').value==='challenge'&&!r[11])return '—';if(isStarList()&&$('sort').value==='star-list')return '#'+num(r[12]);if(tierList&&$('sort').value==='rating'&&r[11]==null)return '—';if(tierList&&$('sort').value==='placement')return '#'+num(r[12]);if(tierList||isStarList())return '#'+num(ranks[i]);return demon?(currentDemonRows[i]?.status==='MainList'?'#'+num(currentDemonRows[i].position):'—'):'#'+num(page*pageSize+i+1)}
 function levelAttrs(r,i){return 'data-open="'+r[0]+'"'+(demon&&currentDemonRows[i]?' data-uuid="'+esc(currentDemonRows[i].uuid)+'"':'')}
 if(layout==='grid'){
  $('results').innerHTML='<div class="cards">'+rows.map((r,i)=>'<article class="gridcard"><button class="levelbtn" '+levelAttrs(r,i)+'>'+cover(r[0])+'<span class="cardrank">'+rank(r,i)+'</span>'+rowTitle(r)+'</button><div class="cardmeta">'+difficultyWithReward(r)+savedBtn(r[0])+'</div></article>').join('')+'</div>';return
 }
 const standard=isStarList();
 const columns=['Rank','Level','Difficulty',standard?'Stars':tierList?'GDDL tier':demon?'Points':'Downloads',standard||tierList?'Downloads':demon?'Mode':'Likes',''];
 const headers=columns.map(k=>'<th scope="col">'+k+'</th>').join('');
 const body=rows.map((row,i)=>{
  const record=demon?currentDemonRows[i]:null;
  const position=rank(row,i);
  const rating=standard?badge(row[6]):difficultyWithReward(row);
  const firstStat=standard?rewardBadge(row):tierList?formatRating(row[11]):record?num(record.points):metric('downloads',row[4]);
  const secondStat=standard||tierList?metric('downloads',row[4]):record?(record.twoPlayer?'2-player':'Solo'):metric('likes',row[5]);
  return '<tr><td><span class="rank r'+position.slice(1)+'">'+position+'</span></td><td><button class="levelbtn" '+levelAttrs(row,i)+'>'+cover(row[0])+rowTitle(row)+'</button></td><td>'+rating+'</td><td>'+firstStat+'</td><td>'+secondStat+'</td><td>'+savedBtn(row[0])+'</td></tr>';
 }).join('');
 $('results').innerHTML='<div class="tablewrap"><table class="leveltable"><thead><tr>'+headers+'</tr></thead><tbody>'+body+'</tbody></table></div>';

}
let currentDemonRows=[],workCounter=0;const waiting=new Map();
function indexed(q,diff,sort,p){
 if(!q&&diff==='All'&&sort==='downloads'&&p===0)return Promise.resolve({rows:initialRows.slice(0,20),total:seed.indexed,next:seed.indexed>20});
 if(!localWorker){localWorker=new Worker('/index-worker.js');localWorker.onmessage=({data})=>{const job=waiting.get(data.id);if(job){waiting.delete(data.id);data.error?job.reject():job.resolve(data)}};localWorker.onerror=()=>{for(const j of waiting.values())j.reject();waiting.clear();localWorker.terminate();localWorker=null}}
 return new Promise((resolve,reject)=>{const id=++workCounter;waiting.set(id,{resolve,reject});localWorker.postMessage({id,q,diff,sort,page:p})})
}
async function loadPage(){
 if(!seed)return;const n=++serial;queryAbort?.abort();queryAbort=new AbortController();const abort=queryAbort,q=$('search').value.trim(),diff=$('difficulty').value,s=$('sort').value;
 searching(true);$('resultMeta').textContent='Searching…';$('retry').hidden=true;
 try{
  if(isStarList()){
   const rows=await loadTier(activeTier,'stars');
   if(n!==serial)return;
   const data=browseTier(rows,{query:q,stars:diff==='all'?null:Number(diff),sort:s,page,size:pageSize});
   const sorted={challenge:'Highest community tier first · same tier shares a rank', 'star-list':'Published list order',downloads:'Ranked by downloads',likes:'Ranked by likes',newest:'Newest ID first',name:'Name A–Z'}[s];
   const range=starTiers[activeTier].stars.join('–');
   const unit=diff==='all'?range:diff;
   render(data.rows,data.total,data.next,'stars',unit+(unit==='1'?' star':' stars')+' · '+sorted+' · '+seed.starDate,data.ranks);return;
  }
  if(isTierList()){
   const tier=activeTier,rows=await loadTier(tier);
   if(n!==serial)return;
   const meta=seed.demonTiers[tier];
   const pool=s==='placement'&&meta.placementExtras?.length?rows.concat(meta.placementExtras):rows;
   const data=browseTier(pool,{query:q,format:diff,sort:s,page,size:pageSize});
   const summary={rating:'Highest GDDL tier first',placement:meta.rankSource+' placements',downloads:'Ranked by downloads',likes:'Ranked by likes',newest:'Newest ID first',name:'Name A–Z'}[s];
   render(data.rows,data.total,data.next,'tier',summary+' · '+seed.demonTierDate,data.ranks);return;
  }
  if(isExtremeList()){await demons();if(n!==serial)return;let ds=demonRecords.filter(d=>(diff==='legacy'?d.status==='Legacy':d.status==='MainList')&&(!q||(/^\d+$/.test(q)?d.id===Number(q):(d.name+' '+(d.publisher||'')).toLowerCase().includes(q.toLowerCase()))));if(s==='name')ds.sort((a,b)=>a.name.localeCompare(b.name));currentDemonRows=ds.slice(page*20,page*20+20);render(currentDemonRows.map(fromDemon),ds.length,(page+1)*20<ds.length,'demons');return}
  if(section==='saved'){let arr=[...saved.values()].filter(r=>(diff==='All'||(diff==='All demons'?r[6].endsWith('Demon'):r[6]===diff))&&(!q||(/^\d+$/.test(q)?r[0]===Number(q):(r[1]+' '+author(r)).toLowerCase().includes(q.toLowerCase()))));const k=s==='downloads'?4:s==='likes'?5:0;const order=['Unrated','Auto','Easy','Normal','Hard','Harder','Insane','Demon','Easy Demon','Medium Demon','Hard Demon','Insane Demon','Extreme Demon'];arr.sort((a,b)=>s==='tier'?order.indexOf(b[6])-order.indexOf(a[6])||b[0]-a[0]:(b[k]??-Infinity)-(a[k]??-Infinity));page=Math.min(page,Math.max(0,Math.ceil(arr.length/20)-1));render(arr.slice(page*20,page*20+20),arr.length,(page+1)*20<arr.length,'saved');return}
  if(!offline){
   try{const params=new URLSearchParams({q,difficulty:diff,sort:s});if(cursors[page])params.set('after',cursors[page]);const res=await fetch('/api/levels?'+params,{signal:abort.signal});if(!res.ok)throw Error('archive');const data=await res.json();if(!Array.isArray(data.rows))throw Error('archive');if(n!==serial)return;if(!page)liveTotal=data.total;render(data.rows,liveTotal,data.next,'archive');return}
   catch{if(n!==serial||abort.signal.aborted)return;offline=true;if(page){page=0;cursors=[null]}}
  }
  const data=await indexed(q,diff,s,page);if(n===serial)render(data.rows,data.total,data.next,'index')
 }catch{if(n!==serial)return;nextPage=null;searching(false);$('resultMeta').textContent='Levels could not load.';$('results').innerHTML='<div class="empty"><p>Could not load this list.</p><button class="outline" id="reload">Try again</button></div>';$('reload').onclick=restart}
}
function navigate(section){const hash='#'+section;if(location.hash===hash){setSection(section)}else location.hash=hash}
const dlg=$('dialog');function openModal(){if(!dlg.open)dlg.showModal();dlg.scrollTop=0}
function showDetails(id,uuid){
 const d=(uuid&&demonRecords.find(x=>x.uuid===uuid))||rankRows.get(id)||seed.podium.find(x=>x.id===id)||seed.featured.find(x=>x.row[0]===id)?.rank;
 const r=(isTierList()&&current.find(row=>row[0]===id&&row[15]))||rowMap.get(id)||saved.get(id)||(d&&fromDemon(d));if(!r)return;storeRows([r]);currentDetails=r;
 if(r[6]===impossibleCategory){showSecretDetails(r);return}
 const demonSlug=String(r[6]).toLowerCase().split(' ')[0];
 const tierLevel=r[6]===tierNames[demonSlug]+' Demon'&&demonSlug!=='extreme';
 const meta=r[15]?seed.demonTiers[r[15]]:tierLevel?seed.demonTiers[demonSlug]:null;
 if(tierLevel&&r.length<13){
  loadTier(demonSlug).then(rows=>{
   if(!dlg.open||currentDetails!==r)return;
   const match=rows.find(item=>item[0]===id);
   if(match){rowMap.set(id,[...r.slice(0,11),...match.slice(11)]);showDetails(id,uuid)}
  }).catch(()=>{});
 }
 const stats=[['Downloads',num(r[4])],['Likes',num(r[5])],[r[8]==='Platformer'?'Moons':'Stars',num(r[7])],['Length',r[8]||'—'],['Level ID',r[0]]];
 if(isStandardRating(r)&&r.length>=13){
  stats.push(['Community tier',r[11]?'Tier '+r[11]:'Unranked']);
  if(r[12])stats.push([r[6]==='Insane'?'Hardest Insanes':'Hardest Harders','#'+num(r[12])]);
 }
 if(r[6]==='Extreme Demon'&&!r[15])stats.push(['AREDL',d?.status==='MainList'?'#'+num(d.position):d?.status==='Legacy'?'Legacy':'—']);
 else if(tierLevel||r[15])stats.push(['GDDL tier',r[11]!=null?formatRating(r[11]):'Unscored']);
 if(meta?.rankSource&&r[12]>0)stats.push([meta.rankSource+' rank','#'+num(r[12])]);
 $('detail').innerHTML='<div class="detail-cover">'+cover(id,true)+'</div><div class="modalbody"><div class="sectionline"><span></span>LEVEL DETAILS</div><h2 id="modalTitle">'+esc(r[1])+'</h2><div class="modalmeta">'+badge(r[6])+'<span>by '+esc(author(r))+'</span></div>'+(r[14]?'<p class="rank-note">'+esc(r[14])+'</p>':'')+'<div class="stats">'+stats.map(([k,v])=>'<div class="stat"><small>'+k+'</small><strong>'+(k==='Stars'||k==='Moons'?ratingLabel(r[7],k==='Moons'):esc(v))+'</strong></div>').join('')+'</div>'+(d?.tags?.length?'<div class="tags">'+d.tags.slice(0,8).map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':'')+'<div class="detailactions"><button class="primary" id="copyId">'+ico('copy')+'Copy level ID</button><button class="outline" data-save="'+id+'"></button><a class="outline" href="https://history.geometrydash.eu/level/'+id+'" target="_blank" rel="noopener">GDHistory '+ico('external')+'</a>'+(meta?.rankUrl&&r[12]>0?'<a class="outline" href="'+esc(meta.rankUrl)+'" target="_blank" rel="noopener">'+esc(meta.rankSource)+' '+ico('external')+'</a>':'')+(r[13]?'<a class="outline" href="https://www.youtube.com/watch?v='+esc(r[13])+'" target="_blank" rel="noopener">Watch verification '+ico('external')+'</a>':'')+'</div></div>';refreshSaves();openModal();
 if(cardTiers.includes(r[6]))Promise.all([readWallet(),r[6]==='Extreme Demon'?cardPool(r[6]).catch(()=>[]):[]]).then(([w,extremes])=>{
  if(!dlg.open||currentDetails!==r)return;
  const row=extremes.find(x=>x[0]===id)||r;
  const base=statsFor(row),s=statsFor(row,w.training?.[id]),el=document.createElement('section');el.className='level-combat-stats';
  el.innerHTML='<h3>Battle stats'+(s.stage&&row[10]?' · '+s.stage:'')+'</h3><div><span>HP <b>'+cardNum(s.maxHp)+'</b><small>'+cardNum(base.maxHp)+' base · +'+cardNum(s.hpGain)+' trained</small></span><span>Attack <b>'+cardNum(s.attack)+'</b><small>'+cardNum(base.attack)+' base · +'+cardNum(s.attackGain)+' trained</small></span></div>'+(s.stage?'<p class="stat-ceiling">Fully trained · '+cardNum(s.hpCap)+' HP · '+cardNum(s.attackCap)+' ATK</p>':'');
  $('detail').querySelector('.detailactions')?.before(el);
 }).catch(()=>{});
 $('copyId').onclick=async()=>{try{await navigator.clipboard.writeText(String(id));$('copyId').innerHTML=ico('check')+'Copied'}catch{$('copyId').textContent='Level ID '+id}}
}
function showSecretDetails(row){
 const id=row[0],gdId=row[16],stats=statsFor(row);
 $('detail').innerHTML='<div class="detail-cover"><img class="shot" src="'+impossibleCover(id)+'" alt=""></div><div class="modalbody secret-detail">'+
  '<div class="sectionline"><span></span>SECRET VAULT · ILL #'+row[10]+'</div><h2 id="modalTitle">'+esc(row[1])+'</h2>'+
  '<div class="modalmeta"><img class="face" src="/assets/impossible/mark.webp" alt="">Impossible'+(row[2]?'<span>by '+esc(row[2])+'</span>':'')+'</div>'+
  '<section class="level-combat-stats"><h3>Battle stats</h3><div><span>HP <b data-secret-hp>'+cardNum(stats.maxHp)+'</b></span><span>Attack <b data-secret-atk>'+cardNum(stats.attack)+'</b></span></div></section>'+
  '<div class="detailactions"><a class="outline" href="https://impossiblelevels.com/" target="_blank" rel="noopener">Impossible Levels List '+ico('external')+'</a>'+
  (gdId?'<a class="outline" href="https://history.geometrydash.eu/level/'+gdId+'" target="_blank" rel="noopener">Level ID '+gdId+' '+ico('external')+'</a>':'')+'</div></div>';
 openModal();
 readWallet().then(w=>{
  if(!dlg.open||currentDetails!==row)return;
  const trained=statsFor(row,w.training?.[id]);
  $('detail').querySelector('[data-secret-hp]').textContent=cardNum(trained.maxHp);
  $('detail').querySelector('[data-secret-atk]').textContent=cardNum(trained.attack);
 }).catch(()=>{});
}
function about(){currentDetails=null;$('detail').innerHTML='<div class="modalbody aboutbody"><h2 id="modalTitle">About the rankings</h2><h3>Level leaderboard</h3><p>The live board searches GDHistory’s archive across all difficulties. Deleted entries are filtered out. A rank is the position in your current sort and filters. Downloads and likes are counts observed by the archive.</p><h3>Star levels</h3><p>Each of the six lists holds 600 classic rated levels. The default order uses play-tested tiers from the <a class="sourcelink" href="'+esc(seed.starSources.tiers)+'" target="_blank" rel="noopener">Underrated Non-Demons List</a>. Higher tiers come first. Levels in the same tier share a rank and appear alphabetically. Unranked levels follow. The selection prioritizes documented levels and includes popular levels at each star value. Hard through Insane each include 300 levels per star value.</p><p>The <a class="sourcelink" href="'+esc(seed.starSources.harder)+'" target="_blank" rel="noopener">Hardest Harders</a> and <a class="sourcelink" href="'+esc(seed.starSources.insane)+'" target="_blank" rel="noopener">Hardest Insanes</a> sorts show published positions for matching versions. Checked on '+seed.starDate+'.</p><h3>Demon lists</h3><p>Easy, Medium, Hard and Insane each have a full catalogue, including classic and platformer levels. The GDDL difficulty sort uses community average tiers, highest first. Entries awaiting a score follow the scored levels. Choose a community list under the sort menu for its top 150. A level’s in-game difficulty can differ from the list that ranks it. The four catalogues were checked on '+seed.demonTierDate+'.</p><h3>Extreme Demons</h3><p>AREDL ranks rated Extreme Demons by difficulty. Main-list ranks are preserved when filtering. Two-player variants have separate list entries.</p><h3>Thumbnails and availability</h3><p>Images come from the Level Thumbnails community, AREDL, and linked verification videos. A level without a submitted image shows “No thumbnail.”</p><h3>Gacha</h3><p>Each card rolls its difficulty first and draws a level within it. Higher-ranked Extreme Demons have lower individual odds. All eight packs can draw any difficulty. The odds in the shop include your luck upgrade. At maximum luck each card gets the better of two difficulty rolls. The card index and merge station award gems. Every drawn card has an independent 2% holo chance. Online saves keep your coins, gems, upgrades and cards on the server. A browser with an older local save offers a one-time transfer. The pack room uses edited paper, coin and arcade recordings from <a class="sourcelink" href="https://mixkit.co/free-sound-effects/" target="_blank" rel="noopener">Mixkit</a> under its <a class="sourcelink" href="https://mixkit.co/license/modal/sfxFree/" target="_blank" rel="noopener">Sound Effects Free License</a>. Pack icons, the gem and the gold secret coin use Geometry Dash artwork from <a class="sourcelink" href="https://github.com/tzt345/GDBrowser" target="_blank" rel="noopener">GDBrowser</a>.</p><h3>Backup index</h3><p>If the archive is unavailable, you can browse '+num(seed.indexed)+' indexed levels. This collection combines 2024–2026 releases with records refreshed on '+sourceDate+'. Saved levels stay in this browser.</p><p><a class="sourcelink" target="_blank" rel="noopener" href="https://history.geometrydash.eu/">GDHistory</a> · <a class="sourcelink" target="_blank" rel="noopener" href="https://aredl.net/">AREDL</a> · <a class="sourcelink" target="_blank" rel="noopener" href="https://gdladder.com/">GD Demon Ladder</a> · <a class="sourcelink" target="_blank" rel="noopener" href="https://levelthumbs.prevter.me/">Level Thumbnails</a> · <a class="sourcelink" target="_blank" rel="noopener" href="https://huggingface.co/datasets/yusp48/geometry-dash-levels">Level dataset</a> · <a class="sourcelink" target="_blank" rel="noopener" href="https://github.com/jozsefsallai/GDBrowser">Difficulty icons</a></p></div>';openModal()}
$('close').onclick=()=>dlg.close();dlg.addEventListener('click',e=>{if(e.target===dlg){const r=dlg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dlg.close()}});
document.addEventListener('click',e=>{
 const locked=e.target.closest('[data-level-locked]');
 if(!locked)return;
 e.preventDefault();e.stopPropagation();
 announce('Available at Level '+locked.dataset.levelLocked+'.');
},true);
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!seed)return;if(b.dataset.save){toggle(Number(b.dataset.save));return}if(b.dataset.open){showDetails(Number(b.dataset.open),b.dataset.uuid);return}if(b.dataset.tab)navigate(b.dataset.tab)});
$('sources').onclick=$('footerSources').onclick=()=>seed&&about();$('featureOpen').onclick=()=>showDetails(Number($('featureOpen').dataset.id));
$('prevFeature').onclick=()=>featured(-1);$('nextFeature').onclick=()=>featured(1);
$('search').addEventListener('input',()=>{clearTimeout(timer);serial++;queryAbort?.abort();searching(true);timer=setTimeout(restart,260)});$('sort').onchange=$('retry').onclick=restart;
$('difficulty').onchange=()=>{
 if(isTierList()){
  const meta=seed.demonTiers[activeTier],platformer=$('difficulty').value==='platformer';
  for(const option of $('sort').options){
   option.disabled=platformer&&((option.value==='rating'&&!meta.platformerScored)||(option.value==='placement'&&!meta.platformerRanked));
  }
  if($('sort').selectedOptions[0]?.disabled)$('sort').value='downloads';
 }
 restart();
};
function changeLayout(l){layout=l;write('gdlb.view',l);for(const x of ['list','grid']){const sel=l===x,b=$(x+'View');b.classList.toggle('on',sel);b.setAttribute('aria-pressed',sel)}if(seed&&current.length)loadPage()}
$('listView').onclick=()=>changeLayout('list');$('gridView').onclick=()=>changeLayout('grid');
$('pageJump').onsubmit=event=>{
 event.preventDefault();
 if(!(section==='demons'||isStarList())||!$('pageJump').reportValidity())return;
 const target=$('jumpNumber').valueAsNumber;
 if(!Number.isInteger(target)||target<1||target>Number($('jumpNumber').max))return;
 page=target-1;loadPage();document.querySelector('.board').scrollIntoView({block:'start'});
};
function changePage(delta){if(delta>0&&!nextPage||page+delta<0)return;if(section==='leaderboard'&&!offline&&delta>0)cursors[page+1]=nextPage;page+=delta;loadPage();if(document.querySelector('.board').getBoundingClientRect().top<0)document.querySelector('.board').scrollIntoView({block:'start'})}
$('nextPage').onclick=()=>changePage(1);$('prevPage').onclick=()=>changePage(-1);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!playerRanks()&&!['gacha','battle','kingdom'].includes(section)&&!document.querySelector('dialog[open]')&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('search').focus()}});
window.addEventListener('hashchange',()=>seed&&setSection(location.hash.slice(1)));
async function init(){try{const r=await fetch('/data/start.json');if(!r.ok)throw Error('init');seed=await r.json();localImages=new Set(seed.images);initialRows=seed.top;storeRows(initialRows);storeRows(seed.featured.map(x=>x.row));storeRows([...saved.values()].filter(r=>!rowMap.has(r[0])));featured();refreshSaves();changeLayout(layout==='grid'?'grid':'list');if(!location.hash||location.hash==='#leaderboard'){render(initialRows.slice(0,20),seed.indexed,true,'index');$('retry').hidden=true}setSection(location.hash.slice(1));demons().catch(()=>{})}catch{$('resultMeta').textContent='Could not open the index.';$('results').innerHTML='<button class="outline" id="retryInit">Retry</button>';$('retryInit').onclick=init}}
async function start(){
 $('gameAuthRetry').hidden=true;
 $('gameGateLoading').hidden=false;
 try{
  const session=await gameSession();
  if(session.requiresSignIn&&!session.signedIn)return;
  setGuideProgress(session.wallet.guideSeen,id=>gameCommand('guide.seen',{id},null).catch(()=>{}));
  guides=createSectionGuides($('gameGuide'));
  arcade=createPackRoom({
   sound,initialWallet:session.wallet,
   localCover:id=>localImages.has(id)?'/assets/shots/'+id+'.webp':'',
   openLevel:row=>{storeRows([row]);showDetails(row[0])},
   announce,onGuide:guides.select,showTrading:ranks.trading,
  });
  init();
 }catch(error){
  $('gameGateLoading').hidden=true;
  $('gameAuthError').textContent=error.message;
  $('gameAuthRetry').hidden=false;
 }
}
$('gameAuthRetry').onclick=start;
start();
