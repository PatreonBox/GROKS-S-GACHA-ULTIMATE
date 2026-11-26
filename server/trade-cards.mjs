import {statsFor} from '../web/battle-engine.js';
import {skillsFor} from '../web/card-skills.js';
import {finishOrder} from '../web/card-finishes.js';
import {impossibleTier} from '../web/impossible-cards.js';
import {cardCategories} from '../web/pack-engine.js';
import {copiesByFinish,tradeCardLimit,tradeKey} from '../web/trade-rules.js';
import {combatPower} from './player-rankings.mjs';
import {reject} from './game-http.mjs';

export const tradePageSize=12;
export const validFinish=value=>typeof value==='string'&&Object.hasOwn(finishOrder,value);
export const validCardId=value=>Number.isSafeInteger(value)&&value>0;

export function readBundle(bundle){
 if(!Array.isArray(bundle)||!bundle.length||bundle.length>tradeCardLimit){
  reject('Choose between 1 and '+tradeCardLimit+' cards on each side.');
 }
 const keys=new Set();
 let total=0;
 return bundle.map(item=>{
  const {id,finish,count}=item||{};
  const key=tradeKey({id,finish});
  if(!validCardId(id)||!validFinish(finish)||!Number.isSafeInteger(count)||count<1||count>tradeCardLimit||keys.has(key)){
   reject('Choose a valid quantity and finish for each card.');
  }
  total+=count;
  if(total>tradeCardLimit)reject('You can exchange up to '+tradeCardLimit+' cards per side.');
  keys.add(key);
  return {id,finish,count};
 });
}

function lockedForTrade(wallet,id,now){
 if((wallet.injuries?.[id]||0)>now)return 'Recovering';
 if(wallet.battle?.status==='active'&&wallet.battle.allies.some(unit=>unit.id===id))return 'In battle';
 return '';
}

export function tradeCard(row,finish,wallet){
 const id=row[0],difficulty=row[6],tier=cardCategories.indexOf(difficulty);
 const base=statsFor(row),progress=wallet?.training?.[id],stats=progress?statsFor(row,progress):base;
 const moves=skillsFor(row);
 return {id,title:row[1],creator:row[2]||'',difficulty,tier,finish,rank:tier>=10?row[10]||0:0,
  attack:stats.attack,hp:stats.maxHp,level:stats.level,role:stats.role,basePower:combatPower(base),
  basic:moves.basicName,signature:moves.signatureName,signatureDetail:moves.detail};
}

export function snapshotBundle(bundle,cards,wallet,minimum,now){
 return bundle.map(({id,finish,count})=>{
  const record=cards.get(id);
  if(!record||copiesByFinish(record)[finish]<count)reject('A card or finish is no longer available in this quantity.',409);
  const card=tradeCard(record.row,finish,wallet);
  if(card.tier<minimum)reject('Every card received must be '+cardCategories[minimum]+(minimum===cardCategories.length-1?'':'+')+'.',409);
  if(lockedForTrade(wallet,id,now))reject(card.title+' is in battle or recovering. Try again when it is available.',409);
  return {...card,count};
 });
}

export async function browseCollection(db,playerId,wallet,{term,minimum,difficulty,finish,page,now,secretIds}){
 const tier="CASE json_extract(card,'$.row[6]') "+cardCategories.map((name,i)=>"WHEN '"+name+"' THEN "+i).join(' ')+' ELSE -1 END';
 const copies="CAST(json_extract(card,'$.copies') AS INTEGER)",holo="COALESCE(json_extract(card,'$.holoCopies'),0)";
 const anti="COALESCE(json_extract(card,'$.antimatterCopies'),0)";
 const filters=[copies+'>0'];
 if(finish==='standard')filters.push(`${copies}>${holo}+${anti}`);
 if(finish==='holo')filters.push(holo+'>0');
 if(finish==='antimatter')filters.push(anti+'>0');
 const {results}=await db.prepare(`WITH owned AS (
  SELECT card,level_id,${tier} AS tier FROM game_cards WHERE player_id=? AND ${filters.join(' AND ')}
 ) SELECT card FROM owned WHERE tier>=? AND (? IS NULL OR tier=?)
  AND (tier<>? OR level_id IN (SELECT value FROM json_each(?))) AND (instr(lower(json_extract(card,'$.row[1]')),lower(?))>0
  OR instr(lower(json_extract(card,'$.row[2]')),lower(?))>0 OR CAST(level_id AS TEXT)=?)
 ORDER BY tier DESC,CASE WHEN tier>=10 THEN json_extract(card,'$.row[10]') END ASC,
  json_extract(card,'$.row[1]') COLLATE NOCASE,level_id LIMIT ? OFFSET ?`)
  .bind(playerId,minimum,difficulty,difficulty,impossibleTier,JSON.stringify(secretIds),term,term,term,tradePageSize+1,page*tradePageSize).all();
 const cards=results.slice(0,tradePageSize).flatMap(({card:saved})=>{
  const card=JSON.parse(saved),locked=lockedForTrade(wallet,card.id,now);
  return Object.entries(copiesByFinish(card)).filter(([type,count])=>count>0&&(!finish||type===finish)).map(([type,owned])=>
   ({...tradeCard(card.row,type,wallet),owned,locked}));
 });
 return {cards,more:results.length>tradePageSize};
}

export function exchangeCards(wallet,collection,give,receive,now){
 const changes=new Map();
 function change(item,offset){
  const old=changes.get(item.id)||collection.get(item.id);
  const card=old?{...old}:{id:item.id,row:item.row,copies:0,holoCopies:0,antimatterCopies:0};
  const counts=copiesByFinish(card);
  counts[item.finish]+=offset;
  const copies=counts.standard+counts.holo+counts.antimatter;
  if(!Number.isSafeInteger(copies))reject('One collection is at its copy limit.',409);
  Object.assign(card,{copies,holoCopies:counts.holo,antimatterCopies:counts.antimatter});
  if(offset>0){
   card.last=now;
   if(item.finish==='holo')card.everHolo=true;
   if(item.finish==='antimatter')card.everAntimatter=true;
  }
  changes.set(item.id,card);
 }
 for(const item of give)change(item,-item.count);
 for(const item of receive)change(item,item.count);
 const lost=new Set([...changes].filter(([,card])=>!card.copies).map(([id])=>id));
 if(lost.size){
  if(wallet.squad)wallet.squad=wallet.squad.filter(id=>!lost.has(id));
  for(const [token,drill] of Object.entries(wallet.drills||{}))if(lost.has(drill.id))delete wallet.drills[token];
 }
 return changes;
}
