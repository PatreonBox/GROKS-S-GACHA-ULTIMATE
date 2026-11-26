import {stat} from './card-economy.js';

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
export function playerBoard(spotlight,standings){
 let view=null,revision=0,profileRevision=0;
 const panel=standings.querySelector('[data-player-rows]');
 const dialog=document.getElementById('rankedProfile'),profileBody=dialog.querySelector('[data-ranked-body]');
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
 async function trading(panel){
  panel.textContent='Loading players…';
  try{
   const {rows}=await getPlayers('?view=trading');
   if(panel.isConnected)panel.innerHTML=rows.length?table(rows):'<p class="rank-empty">Players will appear here when they reach Level 15.</p>';
  }catch(error){if(panel.isConnected)panel.textContent=error.message}
 }
 function drawProfile(row,stats){
  const statItems=[['Level',full(stats.level)],['Collection power',full(stats.power)],['Total cards',full(stats.copies)],
   ['Campaign clears',full(stats.campaignClears)+' / '+full(stats.campaignTotal)],['Coins',full(stats.coins)],['Gems',full(stats.gems)]];
  profileBody.innerHTML='<div class="ranked-profile-heading">'+avatar(row)+'<strong>'+esc(row.alias)+'</strong>'+
   '<span class="profile-rank" data-place="'+row.place+'"><small>Global rank</small><b>#'+full(row.place)+'</b></span></div>'+
   '<dl class="player-stats"><div class="player-collection-stat"><dt>Unique cards discovered</dt><dd>'+full(stats.unique)+' / '+full(stats.collectible)+
   '</dd><progress aria-label="Card collection progress" value="'+stats.unique+'" max="'+(stats.collectible||1)+'"></progress></div>'+
   statItems.map(([name,value])=>'<div><dt>'+name+'</dt><dd>'+value+'</dd></div>').join('')+'</dl>';
 }
 document.addEventListener('click',async event=>{
  const entry=event.target.closest('[data-ranked-profile]');
  if(!entry||dialog.open)return;
  const request=++profileRevision;
  profileBody.textContent='Loading player profile…';dialog.showModal();
  try{
   const {player,stats}=await getPlayers('?player='+encodeURIComponent(entry.dataset.rankedProfile));
   if(request===profileRevision&&dialog.open)drawProfile(player,stats);
  }catch(error){if(request===profileRevision&&dialog.open)profileBody.textContent=error.message}
 });
 dialog.querySelector('[data-close-ranked-profile]').onclick=()=>dialog.close();
 return {trading,show(mode){
  standings.hidden=mode!=='full';
  if(mode===view)return;
  view=mode;
  if(mode)load(mode);else revision++;
 }};
}
