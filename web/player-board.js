import {localSave} from './game-client.js';
import {readWallet,difficulties} from './pack-engine.js';
export function playerBoard({enc,faceIcon}){
 let version=0;
 async function show(){
  const token=++version,el=document.getElementById('arcBody');
  el.innerHTML='<section class="station-heading"><div><h1>Player leaderboard</h1><p>Verified online arena results, ranked by difficulty, surviving cards, then fewest turns.</p></div><a href="#battle" class="outline">Battle mode</a></section><div id="playerStandings" aria-live="polite">Loading standings…</div>';
  const slot=el.querySelector('#playerStandings');const active=()=>version===token&&el.isConnected;
  try{
   const wallet=await readWallet();
   const response=await fetch('/api/players',{cache:'no-store'});let data=await response.json();if(!response.ok)throw Error(data.error);
   const best=localSave?null:wallet.arenaBest;
   function draw(msg=''){
    if(!active())return;
    const mine=data.rows.find(r=>r.mine);
    slot.innerHTML='<section class="score-submit"><h3>Your arena record</h3><p>'+(best?difficulties[best.tier]+' · '+best.survivors+'/4 standing · '+best.turns+' turns':(localSave?'Switch to the online save to post verified scores.':'Win an online arena battle to post your first score.'))+'</p>'+(best&&(data.canPost??data.signedIn)?'<form><label>Player name<input name="alias" required minlength="2" maxlength="24" autocomplete="off" value="'+enc(mine?.alias||'')+'" placeholder="Your GD name"></label><button class="primary">Post personal best</button></form>':'')+'<p role="status">'+enc(msg)+'</p></section><div class="score-table">'+(data.rows.length?'<table><thead><tr><th>Rank</th><th>Player</th><th>Arena</th><th>Standing</th><th>Turns</th></tr></thead><tbody>'+data.rows.map(r=>'<tr class="'+(r.mine?'mine':'')+'"><td>#'+r.place+'</td><td>'+enc(r.alias)+(r.mine?' · you':'')+'</td><td>'+faceIcon(difficulties[r.tier])+difficulties[r.tier]+'</td><td>'+r.survivors+'/4</td><td>'+r.turns+'</td></tr>').join('')+'</tbody></table>':'<p>No scores posted yet.</p>')+'</div>';
    const form=slot.querySelector('form');if(form)form.onsubmit=async e=>{
     e.preventDefault();form.querySelector('button').disabled=true;
     try{const response=await fetch('/api/players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({alias:form.elements.alias.value.trim()})});const result=await response.json();if(!response.ok)throw Error(result.error);data=result;draw('Personal best posted.')}
     catch(e){if(active()){form.querySelector('button').disabled=false;slot.querySelector('[role=status]').textContent=e.message}}
    };
   }draw();
  }catch(e){if(active()){slot.textContent=e.message+' ';const retry=document.createElement('button');retry.className='outline';retry.textContent='Retry';retry.onclick=show;slot.append(retry)}}
 }
 return {show,leave(){version++}};
}
