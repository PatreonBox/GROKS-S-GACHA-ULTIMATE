import {enemyIntent,tacticDescription,forecastMove,liveOrb,linkOrbs,liveRiposte,riposteBonus} from './battle-engine.js';
import {technique,hasOpening,techniquesFor,techniqueStyles,signatureCost,signatureDetail,mirroredSkill,execution} from './card-skills.js';
import {moveArt,moveArts} from './combat-arts.js';
import {stat} from './card-economy.js';
import {ico} from './icons.js';

function commands(b,actor,target){
 const a=b.allies[actor],intent=enemyIntent(b),victim=b.enemies[target];
 const {kit,cost,wait}=tacticDescription(b,a),orb=liveOrb(victim,b.seq);
 const linked=orb&&orb.owner!==a.id,boost=hasOpening(kit.trigger,a,victim,b.enemies);
 const riposte=liveRiposte(victim,b.seq),ripostePct=riposte?Math.round(riposte.boost*100):0;
 const coverPct=Math.round(riposteBonus(intent.charged)*100);
 const enabledBreak=intent.charged&&b.charge>0;
 const title=name=>name.startsWith(a.name+' · ')?name.slice(a.name.length+3):name;
 const borrowed=mirroredSkill(kit,victim),signature=borrowed||kit;
 const details=borrowed?'Copies '+borrowed.signatureName+'. '+signatureDetail(borrowed):signatureDetail(kit);
 const moves=[
  {id:'strike',label:'Attack',name:title(kit.basicName),art:kit.basicArt,reason:'',bonus:!!riposte,note:riposte?'+'+ripostePct+'% riposte · +1 charge':'+1 charge',detail:technique(kit,kit.basic).text+' Primes the '+linkOrbs[a.role].name.toLowerCase()+' for two turns.'+(riposte?' Uses the open riposte for +'+ripostePct+'% damage.':'')},
  {id:'pulse',label:'Signature',name:title(kit.signatureName),art:signature.signatureArt,reason:wait?'Ready in '+wait+(wait===1?' turn':' turns'):b.charge<cost?'Needs '+cost+' charge':'',note:cost+' charge'+(linked?' · Orb link':borrowed?' · Copy':boost?' · +20% opening':''),detail:details+(linked?' Triggers '+linkOrbs[orb.role].name.toLowerCase()+'.':'')},
  {id:'break',label:'Disrupt',name:'Break cast',art:'saw',reason:enabledBreak?'':intent.charged?'Needs 1 charge':'No charged cast',note:'1 charge · 3T seal',detail:'Auto-aim at '+b.enemies[intent.index].name+', cancel its charged attack, and seal its signature for three turns.'},
  {id:'guard',label:'Cover',name:'Protect ally',art:'shield',reason:'',note:intent.staggered?'Heal · +1 charge':'Sets +'+coverPct+'% riposte',detail:'Restore '+(b.remix===10565740?'22':'12')+'% HP to '+b.allies[intent.aim].name+' and reduce incoming damage by 71%. Gain one charge. If the protected ally survives the cast, the next basic hit on its caster gains +'+coverPct+'% damage for three turns.'}
 ];
 for(const m of moves){
  m.color=moveArts[m.art].color;
  if(!m.reason)m.preview=forecastMove(b,m.id,m.id==='break'?intent.index:target,actor);
 }
 return moves;
}

export function lockCommands(command){
 command.classList.add('is-resolving');
 command.querySelectorAll('button:not([data-fast])').forEach(button=>button.disabled=true);
 command.querySelector('.command-foot').innerHTML='<button class="outline" data-fast>Finish animation</button>';
}

export function consoleView(b,actor,target,enc){
 const a=b.allies[actor],victim=b.enemies[target],moves=commands(b,actor,target);
 const orb=liveOrb(victim,b.seq),link=orb&&linkOrbs[orb.role];
 const orbLine=orb?(orb.owner===a.id?'Relay to link '+link.name.toLowerCase():'Signature links '+link.name.toLowerCase())+' · '+(orb.expires-b.seq)+'T':moves[0].name+' primes the '+linkOrbs[a.role].name.toLowerCase();
 const deck=moves.map((m,i)=>{
  const f=m.preview;
  const impact=m.reason||(m.id==='guard'?(f.incoming?'~'+stat(f.incoming)+' incoming':'Safe this turn'):'~'+stat(f.dealt)+' DMG'+(f.knockouts?' · KO':''));
  const answer=f?(f.stopsCast?'Stops the enemy cast':f.injuries?'An ally may fall':'Enemy reply ~'+stat(f.incoming)+' DMG'):'';
  const key=String(i+1);
  return '<button class="console-move'+(m.bonus?' has-riposte':'')+'" data-move="'+m.id+'" style="--move:'+m.color+'" '+(m.reason?'disabled ':'')+'title="'+enc(m.detail+(answer?' '+answer+'.':''))+'" aria-label="'+enc(m.label+' · '+m.name+'. '+impact+'. '+m.note+'. '+m.detail)+'">'+moveArt(m.art)+'<span class="move-key"><b>'+m.label+'</b><kbd>'+key+'</kbd></span><strong>'+enc(m.name)+'</strong><span class="move-math">'+enc(impact)+'</span><small>'+enc(m.note)+'</small></button>';
 }).join('');
 const charge='<span class="console-charge" aria-label="'+b.charge+' of 3 charge">'+[0,1,2].map(i=>'<i class="'+(i<b.charge?'full':'')+'"></i>').join('')+'<b>'+b.charge+'/3</b></span>';
 return '<section class="command live-console" aria-label="Turn controls"><div class="console-heading"><h2>Turn controls</h2>'+charge+'</div><div class="command-matchup"><span class="cmd-names"><b title="'+enc(a.name)+'">'+enc(a.name)+'</b><span class="aim-symbol" aria-hidden="true">›</span><strong title="'+enc(victim.name)+'">'+enc(victim.name)+'</strong></span><button class="outline move-library-button" data-move-library>'+ico('list')+' Moves</button></div><div class="command-rack">'+deck+'</div><div class="command-foot"><p class="link-readout" style="--orb:'+(link||linkOrbs[a.role]).color+'"><i class="mini-orb"></i>'+enc(orbLine)+'</p></div></section>';
}

export function intentView(b,actor,target,enc){
 const intent=enemyIntent(b),from=b.enemies[intent.index],to=b.allies[intent.aim];
 const f=forecastMove(b,'strike',target,actor);
 const reply=intent.staggered?'Misses this attack':f.stopsCast?'Attack stops this cast':f.injuries?'Ally at risk on attack':'After attack ~'+stat(f.incoming)+' squad damage';
 const brief=intent.staggered?'Misses attack':f.stopsCast?'Attack stops cast':f.injuries?'Ally at risk':'Reply ~'+stat(f.incoming);
 const name=intent.name.startsWith(from.name+' · ')?intent.name.slice(from.name.length+3):intent.name;
 return '<div class="live-intent '+(intent.charged?'is-charged':'')+'"><div class="intent-glyph">'+moveArt(intent.art)+'</div><div class="intent-copy"><small>'+(intent.charged?'Charged enemy cast':'Enemy intent')+'</small><strong>'+enc(name)+'</strong><span>'+enc(from.name)+(intent.staggered?' is recovering':' targets <b>'+enc(to.name)+'</b>')+'</span></div><div class="intent-answer"><span data-brief="'+enc(brief)+'">'+enc(reply)+'</span><button class="outline" data-aim-caster '+(target===intent.index?'disabled':'')+'>'+(target===intent.index?'Caster targeted':'Target caster')+'</button></div></div>';
}

export function ordersView(b,actor,target,enc){
 const moves=commands(b,actor,target),victim=b.enemies[target],ally=b.allies[actor],orb=liveOrb(victim,b.seq);
 const forecast=moves.map(m=>{
  const f=m.preview;
  const outcome=f?(f.stopsCast?'Enemy cast prevented.':'Enemy reply deals about '+stat(f.incoming)+' total HP damage.')+(f.injuries?' An ally may fall.':''):m.reason+'.';
  return '<li><b>'+m.label+' · '+enc(m.name)+'</b><span>'+enc(m.detail)+'</span><small>'+enc(outcome)+'</small></li>';
 }).join('');
 const rules=Object.values(linkOrbs).map(o=>'<li style="--orb:'+o.color+'"><i class="mini-orb"></i><b>'+o.name+'</b> '+o.rule+'.</li>').join('');
 const log=b.log.length?'<ol class="turn-history">'+b.log.map(x=>'<li>'+enc(x)+'</li>').join('')+'</ol>':'<p>No turns played yet.</p>';
 const passive=b.allies.some(u=>u.hp&&u.id===execution.id)?'<p class="steal-rule"><b>'+execution.name+'</b> '+enc(execution.rule)+'</p>':'';
 const warned=b.enemies.some(u=>u.hp&&u.id===execution.id)?'<p class="steal-rule"><b>Enemy Kill Steal</b> KILLSTEALER executes an ally left below 20% HP.</p>':'';
 return '<dialog class="orders-sheet" aria-label="Battle tactics"><div class="orders-head"><h2>Battle tactics</h2><button class="outline" data-close-orders>Close</button></div><p><b>'+enc(ally.name)+'</b> against <b>'+enc(victim.name)+'</b></p><ul class="move-details">'+forecast+'</ul>'+passive+warned+'<h3>Jump orb links</h3><p>Attack to prime an enemy for two turns. Land a different teammate’s signature on that enemy to add 35% ATK damage and trigger the orb. Another basic attack replaces the orb.</p><ul class="orb-rules">'+rules+'</ul><p>'+(orb?'Selected target holds the '+linkOrbs[orb.role].name.toLowerCase()+'. ':'')+'Tap a standing teammate to relay before committing. A relay takes three turns to recharge.</p><details><summary>Battle log · '+b.seq+' turns</summary>'+log+'</details><div class="orders-tools"><button class="outline" data-inspect-actor>Inspect ally</button><button class="outline" data-inspect-target>Inspect target</button><button class="outline" data-retreat>Retreat</button></div></dialog>';
}

export function techniqueView(b,actor,enc){
 const card=b.allies[actor],options=techniquesFor(card),base=options[0];
 const equipped=b.techniques?.[card.id]||0,activeStyle=options.find(m=>m.choice===equipped)?.style||0;
 const groupList=[...new Set(options.map(m=>m.group||'Level moves'))];
 const ordered=[...options.filter(m=>!m.group),...options.filter(m=>m.group==='Bonus moves'),...options.filter(m=>m.group&&m.group!=='Bonus moves')];
 const entries=ordered.map(m=>{
  const group=m.group||'Level moves',active=equipped===m.choice,style=m.style||0;
  const prefix=card.name+' · ',name=m.signatureName.startsWith(prefix)?m.signatureName.slice(prefix.length):m.signatureName;
  const ranked=!m.choice&&m.native?.rank;
  return '<article class="technique-card'+(ranked?' list-signature':'')+'" data-form="'+group+'" data-style="'+style+'" '+(style===activeStyle?'':'hidden ')+'style="--move:'+moveArts[m.signatureArt].color+'">'+
   moveArt(m.signatureArt)+'<div><small>'+enc(ranked?'Main List #'+ranked:m.group||(!m.choice?'Signature':'Alternate signature'))+' · '+signatureCost(b,m)+' charge</small>'+
   '<strong>'+enc(name)+'</strong><p>'+enc(signatureDetail(m))+'</p></div>'+
   '<button type="button" class="outline" data-technique-choice="'+m.choice+'" '+(active?'disabled':'')+' aria-label="'+enc((active?'Equipped ':'Equip ')+name)+'">'+(active?'Equipped':'Equip')+'</button></article>';
 }).join('');
 const basic=base.basicName.startsWith(card.name+' · ')?base.basicName.slice(card.name.length+3):base.basicName;
 const passive=card.id===execution.id?'<p class="steal-rule"><b>'+execution.name+'</b> '+enc(execution.rule)+'</p>':'';
 return '<dialog class="orders-sheet signature-library" aria-label="'+enc(card.name+' move library')+'"><div class="orders-head"><div><small>'+enc(card.name)+' · '+options.length+' signatures</small><h2>Move library</h2></div><button class="outline" data-close-orders>Close</button></div>'+
  '<div class="technique-summary">'+moveArt(base.basicArt)+'<div><small>Basic attack</small><b>'+enc(basic)+'</b></div>'+
  '<div class="technique-filters"><label>Style <select data-technique-style>'+
  techniqueStyles.map((n,i)=>'<option value="'+i+'" '+(i===activeStyle?'selected':'')+'>'+n+'</option>').join('')+'</select></label>'+
  '<label>Signature form <select data-technique-filter><option value="">All forms</option>'+
  groupList.map(n=>'<option '+(activeStyle&&['Level moves','Bonus moves'].includes(n)?'disabled':'')+'>'+n+'</option>').join('')+'</select></label></div></div>'+passive+
  '<div class="technique-grid">'+entries+'</div></dialog>';
}
