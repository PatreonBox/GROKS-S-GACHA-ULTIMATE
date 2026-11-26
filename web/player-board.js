import {stat} from './card-economy.js';
import {showBestCard,visitKingdom} from './player-showcase.js';

const full=n=>n.toLocaleString('en-US');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const avatar=row=>'<span class="rank-avatar">'+(row.avatar?'<img src="'+esc(row.avatar)+'" alt="" loading="lazy">':'')+'<b aria-hidden="true">'+esc(row.alias.slice(0,1).toUpperCase())+'</b></span>';
const power=row=>'<strong title="'+full(row.power)+' power">'+stat(row.power)+'</strong>';
const player=row=>esc(row.alias)+(row.mine?' <small class="rank-you">You</small>':'');
const entry=row=>' type="button" data-ranked-profile="'+esc(row.id)+'" aria-haspopup="dialog" aria-label="View '+esc(row.alias)+'’s profile"';
const emptyRanks='<p class="rank-empty">Player rankings will appear here as players start collecting cards.</p>';
function table(rows){
 return '<table><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Level</th><th scope="col">Power</th></tr></thead><tbody>'+
  rows.map(row=>'<tr'+(row.mine?' class="mine"':'')+'><td class="rank-place" data-place="'+row.place+'">#'+full(row.place)+
   '</td><td><button class="rank-player ranked-entry"'+entry(row)+'>'+avatar(row)+'<b>'+player(row)+'</b></button></td><td>'+full(row.level)+'</td><td>'+power(row)+'</td></tr>').join('')+
  '</tbody></table>';
}
async function getPlayers(query=''){
 const response=await fetch('/api/players'+query,{cache:'no-store',signal:AbortSignal.timeout(12000)});
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result)throw Error(result?.error||'Player profiles are temporarily unavailable.');
 return result;
}
export function playerBoard(spotlight,standings,localCover){
 let view=null,revision=0,profileRevision=0,showcaseRevision=0,profile,disposeVisit;
 const panel=standings.querySelector('[data-player-rows]');
 const dialog=document.getElementById('rankedProfile'),profileBody=dialog.querySelector('[data-ranked-body]');
 document.addEventListener('error',event=>{
  if(event.target.matches?.('.rank-avatar img'))event.target.hidden=true;
 },true);
 standings.querySelector('[data-reload-ranks]').onclick=()=>load('full');
 function drawTop(rows){
  spotlight.innerHTML=rows.length?rows.slice(0,3).map(row=>'<button class="podrow rank-row ranked-entry"'+entry(row)+'><span class="rank-place" data-place="'+row.place+'">#'+row.place+'</span>'+avatar(row)+
   '<span class="podname"><strong>'+player(row)+'</strong><small>Level '+row.level+'</small></span>'+
   '<span class="rank-power">'+power(row)+'<small>Power</small></span></button>').join(''):emptyRanks;
 }
 function drawFull({rows,privateProfile,legacyProgress}){
  const message=privateProfile?'Your profile is private on player rankings.':legacyProgress?'Imported browser saves are private on player rankings.':'';
  panel.innerHTML=(message?'<p class="rank-private">'+message+'</p>':'')+(rows.length?table(rows):emptyRanks);
 }
 async function load(mode){
  const request=++revision,slot=mode==='full'?panel:spotlight;
  slot.setAttribute('aria-busy','true');
  try{
   const data=await getPlayers();
   if(request!==revision)return;
   drawTop(data.rows);
   if(mode==='full')drawFull(data);
  }catch{
   if(request===revision)slot.textContent='Player rankings could not load.';
  }finally{slot.removeAttribute('aria-busy')}
 }
 function drawProfile(row,stats,showcases){
  profile=row;
  const tabs=[['stats','Stats'],...(showcases.kingdom?[['kingdom','Visit Kingdom']]:[]),
   ...(showcases.bestCard?[['best-card','Best card']]:[])];
  const statItems=[['Level',full(stats.level)],['Collection power',full(stats.power)],['Total cards',full(stats.copies)],
   ['Campaign clears',full(stats.campaignClears)+' / '+full(stats.campaignTotal)],['Coins',full(stats.coins)],['Gems',full(stats.gems)]];
  profileBody.innerHTML='<div class="ranked-profile-heading">'+avatar(row)+'<strong>'+esc(row.alias)+'</strong>'+
   '<span class="profile-rank" data-place="'+row.place+'"><small>Global rank</small><b>#'+full(row.place)+'</b></span></div>'+
   (tabs.length>1?'<div class="profile-showcase-nav" role="group" aria-label="Profile views">'+tabs.map(([id,title])=>
    '<button type="button" class="outline" data-profile-view="'+id+'" aria-pressed="'+(id==='stats')+'">'+title+'</button>').join('')+'</div>':'')+
   '<dl class="player-stats" data-profile-summary><div class="player-collection-stat"><dt>Unique cards discovered</dt><dd>'+full(stats.unique)+' / '+full(stats.collectible)+
   '</dd><progress aria-label="Card collection progress" value="'+stats.unique+'" max="'+(stats.collectible||1)+'"></progress></div>'+
   statItems.map(([name,value])=>'<div><dt>'+name+'</dt><dd>'+value+'</dd></div>').join('')+'</dl>'+
   '<div data-profile-showcase hidden></div>';
 }
 function clearVisit(){
  disposeVisit?.();
  disposeVisit=null;
 }
 async function openShowcase(section,{retry=false}={}){
  if(!profile||!retry&&section===dialog.dataset.profileView)return;
  const request=++showcaseRevision,person=profile;
  clearVisit();
  dialog.dataset.profileView=section;
  const panel=profileBody.querySelector('[data-profile-showcase]');
  const summary=profileBody.querySelector('[data-profile-summary]');
  for(const button of profileBody.querySelectorAll('[data-profile-view]')){
   button.setAttribute('aria-pressed',String(button.dataset.profileView===section));
  }
  summary.hidden=section!=='stats';panel.hidden=section==='stats';panel.replaceChildren();
  if(panel.hidden)return;
  const mount=document.createElement('div');
  mount.setAttribute('aria-busy','true');
  mount.textContent=section==='kingdom'?'Loading Kingdom…':'Loading best card…';
  panel.append(mount);
  const current=()=>request===showcaseRevision&&dialog.open&&mount.isConnected;
  try{
   const result=await getPlayers('?player='+encodeURIComponent(person.id)+'&view='+section);
   if(!current())return;
   if(section==='best-card')showBestCard(mount,result.bestCard,localCover);
   else{
    const dispose=await visitKingdom(mount,result.kingdom,person.alias);
    if(current())disposeVisit=dispose;else dispose?.();
   }
  }catch(error){
   if(current()){
    const message=document.createElement('p');
    message.className='rank-empty';
    message.textContent=error.message;
    const retryButton=document.createElement('button');
    retryButton.className='outline';
    retryButton.type='button';
    retryButton.textContent='Try again';
    retryButton.onclick=()=>openShowcase(section,{retry:true});
    mount.replaceChildren(message,retryButton);
   }
  }finally{
   mount.removeAttribute('aria-busy');
  }
 }
 dialog.addEventListener('click',event=>{
  const button=event.target.closest('[data-profile-view]');
  if(button)openShowcase(button.dataset.profileView);
 });
 dialog.addEventListener('close',()=>{
  profileRevision++;showcaseRevision++;
  clearVisit();profile=null;
  delete dialog.dataset.profileView;
  profileBody.replaceChildren();
 });
 document.addEventListener('click',async event=>{
  const entry=event.target.closest('[data-ranked-profile]');
  if(!entry||dialog.open)return;
  const request=++profileRevision;
  profileBody.textContent='Loading player profile…';dialog.showModal();
  try{
   const {player,stats,showcases}=await getPlayers('?player='+encodeURIComponent(entry.dataset.rankedProfile));
   if(request===profileRevision&&dialog.open)drawProfile(player,stats,showcases);
  }catch(error){if(request===profileRevision&&dialog.open)profileBody.textContent=error.message}
 });
 dialog.querySelector('[data-close-ranked-profile]').onclick=()=>dialog.close();
 return {show(mode){
  standings.hidden=mode!=='full';
  if(mode===view)return;
  view=mode;
  if(mode)load(mode);else revision++;
 }};
}
