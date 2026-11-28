import {statsFor} from '../web/battle-engine.js';
import {bestFinish} from '../web/card-finishes.js';
import {cardSerials} from '../web/card-serials.js';
import {schools,skillsFor} from '../web/card-skills.js';
import {equippedCube} from '../web/cube-catalog.js';
import {campfirePlan,forgePlan,housePlan,kingdomStats} from '../web/kingdom-rules.js';
import {spikeKind,spikePlan} from '../web/kingdom-defences.js';
import {discoveredVisitors} from './kingdom-visitors.mjs';
import {combatPower} from './player-rankings.mjs';

export function kingdomShowcase(wallet,clock=Date.now()){
 const plot=kingdomStats(wallet,clock);
 return {
  clock,cube:equippedCube(wallet).id,stars:plot.stars,landLevel:plot.land.level,
  towerLevel:plot.tower.level,construction:plot.tower.construction,removedTrees:plot.removedTrees,trail:plot.trail,
  buildings:plot.buildings.map(({id,x,z,rotation,kind='house',...details})=>({
   id,x,z,rotation,kind,level:kind==='house'?housePlan(details,clock).level:
    kind==='campfire'?campfirePlan(details,clock).level:kind==='forge'?forgePlan(details,clock).level:kind===spikeKind?spikePlan(details,clock).level:1,
   ...(details.resident?{resident:details.resident,...(details.computer?.playing?{computer:{playing:true}}:{})}:{}),
   ...(details.upgrade?.endsAt>clock?{upgrade:{startedAt:details.upgrade.startedAt,endsAt:details.upgrade.endsAt,level:details.upgrade.level??2},upgradeEndsAt:details.upgrade.endsAt,upgradeLevel:details.upgrade.level??2}:{})
  })),
  visitors:discoveredVisitors(wallet,clock).map(({id,slot,cube,name,arrivedAt})=>({id,slot,cube,name,arrivedAt}))
 };
}

export function bestCardShowcase(records,wallet){
 let best=null;
 for(const card of records){
  if(!(card.copies>0)||!Array.isArray(card.row))continue;
  const stats=statsFor(card.row,wallet.training?.[card.id]),power=combatPower(stats);
  if(!best||power>best.power||power===best.power&&card.id<best.card.id)best={card,stats,power};
 }
 if(!best)return null;
 const {card,power,stats:{attack,maxHp,level,stage,role}}=best;
 const [id,title,creator]=card.row,kit=skillsFor(card.row),finish=bestFinish(card);
 const serials=cardSerials(card,finish);
 return {
  id,title,creator,difficulty:card.row[6],rank:card.row[10]||0,finish,power,attack,maxHp,level,stage,role,...(serials.length?{serials}:{}),
  basic:{name:kit.basicName,art:kit.basicArt,detail:schools[kit.basic].text},
  signature:{name:kit.signatureName,art:kit.signatureArt,detail:kit.detail,charge:kit.cost,cooldown:kit.cooldown}
 };
}
