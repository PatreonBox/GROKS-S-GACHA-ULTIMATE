import {stat} from './card-economy.js';

const full=n=>n.toLocaleString('en-US');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const avatar=row=>'<span class="rank-avatar">'+(row.avatar?'<img src="'+esc(row.avatar)+'" alt="" loading="lazy">':'')+'<b aria-hidden="true">'+esc(row.alias.slice(0,1).toUpperCase())+'</b></span>';
const power=row=>'<strong title="'+full(row.power)+' power">'+stat(row.power)+'</strong>';
const player=row=>esc(row.alias)+(row.mine?' <small class="rank-you">You</small>':'');
export function playerBoard(spotlight,standings){
 let view=null,revision=0;
 const panel=standings.querySelector('[data-player-rows]');
 standings.querySelector('[data-reload-ranks]').onclick=()=>load('full');
 function drawTop(rows){
  spotlight.innerHTML=rows.length?rows.slice(0,3).map(row=>'<div class="podrow rank-row"><span class="podrank">#'+row.place+'</span>'+avatar(row)+
   '<span class="podname"><strong>'+player(row)+'</strong><small>Level '+row.level+'</small></span>'+
   '<span class="rank-power">'+power(row)+'<small>Power</small></span></div>').join(''):
   '<p class="rank-empty">Player rankings will appear here as players start collecting cards.</p>';
 }
 function drawFull({rows,privateProfile,legacyProgress}){
  const message=privateProfile?'Your profile is private on player rankings.':legacyProgress?'Imported browser saves are private on player rankings.':'';
  panel.innerHTML=(message?'<p class="rank-private">'+message+'</p>':'')+
   (rows.length?'<table><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Level</th><th scope="col">Power</th></tr></thead><tbody>'+
    rows.map(row=>'<tr'+(row.mine?' class="mine"':'')+'><td>#'+row.place+'</td><td><span class="rank-player">'+avatar(row)+'<b>'+player(row)+'</b></span></td><td>'+full(row.level)+'</td><td>'+power(row)+'</td></tr>').join('')+'</tbody></table>':
    '<p class="rank-empty">Player rankings will appear here as players start collecting cards.</p>');
 }
 async function load(mode){
  const request=++revision,slot=mode==='full'?panel:spotlight;
  slot.setAttribute('aria-busy','true');
  try{
   const response=await fetch('/api/players',{cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('Player rankings are temporarily unavailable.');
   const data=await response.json();
   if(request!==revision)return;
   drawTop(data.rows);
   if(mode==='full')drawFull(data);
  }catch{
   if(request===revision)slot.textContent='Player rankings could not load.';
  }finally{slot.removeAttribute('aria-busy')}
 }
 return {show(mode){
  standings.hidden=mode!=='full';
  if(mode===view)return;
  view=mode;
  if(mode)load(mode);else revision++;
 }};
}
