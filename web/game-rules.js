import {cardCategories,difficulties,packs,packQuantities,rollPacks,upgrades,quoteUpgrade,randomBelow,
 grantCoinCode,applyFeeding,fuseCollection} from './pack-engine.js';
import {createMergePlanner,extremeTable,gemTenths,levelRewardTenths} from './card-economy.js';
import {starterCube,cubeCatalogVersion,claimCube,ownsCube} from './cube-catalog.js';
import {settleMine,mineTapPower,mineTapBatch,buyMineMachine,buyMineSkill,mineMachines,mineSkill} from './mine-economy.js';
import {combatStatsVersion,makeBattle,playTurn,grantTraining} from './battle-engine.js';
import {stageFor,stageUnlocked,configureCampaignBattle} from './campaign.js';
import {trainingCapacity,drillTypes,validTechnique} from './card-skills.js';
import {findRemix} from './remixes.js';
import {armyMaps,armyLimit} from './army-battle.js';
import {armyTrialIds,armySignatureVersion,armyRivals,findArmySeries,chapterUnlocked,seriesUnlocked,replayArmy,grantArmyLoot} from './army-trilogy.js';
import {replayDrill,replayRemix} from './game-replay.js';
import {awardPackXp,awardPlayerXp,minePlayerXp,playerProgress} from './player-progression.js';
import {featureLevel,features,packLevels,towerPlayerLevel} from './level-access.js';
import {buildHouse,towerPlan,upgradeTower} from './kingdom-rules.js';

export function newWallet() {
 return {coins:1500,gems:10,luck:0,bonus:0,pending:null,playerXp:0,cubeCatalogVersion,equippedCube:starterCube.id};
}
const levelId = value => Number.isSafeInteger(value)&&value>0;
const key = value => typeof value==='string'&&value.length>0&&value.length<=80;
const within = (value,min,max) => Number.isSafeInteger(value)&&value>=min&&value<=max;
function requireRule(valid,message) {if(!valid)throw Error(message);}
function requireLevel(wallet,level,name){
 requireRule(level===0||playerProgress(wallet.playerXp).level>=level,'Reach Level '+level+' to unlock '+name+'.');
}
const gatedActions={
 'mine.tap':'mine','mine.machine':'mine','mine.skill':'mine','mine.code':'mine',
 'cube.equip':'cubes','kingdom.house':'kingdom','kingdom.tower':'kingdom',
 'upgrade.buy':'upgrades','card.feed':'training','drill.begin':'training',
 'card.merge':'merge','remix.begin':'arcade','army.begin':'army'
};
const randomUnit = () => randomBelow(0x100000000)/0x100000000;
async function allPools(getPool,categories) {
 const rows = await Promise.all(categories.map(getPool));
 requireRule(rows.every(list=>list.length),'A required card list is unavailable.');
 return rows;
}
function ownedRows(records,ids) {
 requireRule(Array.isArray(ids)&&ids.length===4&&new Set(ids).size===4&&ids.every(levelId),'Equip four different level cards.');
 const owned=new Map(records.filter(c=>c.copies>0).map(c=>[c.id,c.row]));
 const rows=ids.map(id=>owned.get(id));
 requireRule(rows.every(Boolean),'Choose cards from your collection.');
 return rows;
}
function readySquad(wallet,ids,now) {
 requireRule(wallet.battle?.status!=='active','Finish the current battle first.');
 requireRule(ids.every(id=>(wallet.injuries?.[id]||0)<=now),'An equipped card is recovering.');
}
function awardPack(wallet,records,changes,pack,quantity,pools,now) {
 requireRule(!wallet.pending,'Finish your current opening first.');
 requireLevel(wallet,packLevels[pack.id],pack.name+' packs');
 if(quantity===50)requireLevel(wallet,featureLevel('bulk'),'50-pack pulls');
 const price=quantity*pack.price;
 requireRule(wallet.coins>=price,'You need more coins for this pull.');
 const pull=rollPacks(pack,quantity,wallet,pools),owned=new Map(records.map(c=>[c.id,c]));
 const holo=new Set(pull.holos),antimatter=new Set(pull.antimatters);
 const newIds=[];
 pull.rows.forEach((row,index)=>{
  const id=row[0];
  let entry=owned.get(id);
  if(!entry){entry={id,row,copies:0,holoCopies:0,antimatterCopies:0};owned.set(id,entry);newIds.push(id);}
  entry.row=row;
  entry.copies+=1;
  entry.holoCopies=(entry.holoCopies||0)+Number(holo.has(index));
  entry.antimatterCopies=(entry.antimatterCopies||0)+Number(antimatter.has(index));
  entry.everHolo=Boolean(entry.everHolo||entry.holoCopies);
  entry.everAntimatter=Boolean(entry.everAntimatter||entry.antimatterCopies);
  entry.last=now;
  changes.set(id,entry);
 });
 wallet.coins-=price;
 wallet.pending={...pull,id:crypto.randomUUID(),opened:0,gemsEarned:0,newIds};
}

async function arenaSetup({tier,remixId,campaign},getPool) {
 requireRule(within(tier,1,10)&&typeof campaign==='boolean','Choose a battle difficulty.');
 const remix=findRemix(remixId);
 requireRule(remixId==null||remix&&remix.tier===tier&&!campaign,'Choose a valid remix arena.');
 const byId=new Map((await getPool(difficulties[tier])).map(row=>[row[0],row]));
 if(campaign) return {enemies:stageFor(tier).team.map(id=>byId.get(id)),remix};
 const boss=remix&&byId.get(remix.id);
 requireRule(!remix||boss,'The featured level could not load.');
 if(boss)byId.delete(boss[0]);
 const draft=[...byId.values()],count=boss?3:4;
 requireRule(draft.length>=count,'The opposing squad could not load.');
 for(let i=0;i<count;i++){const j=i+randomBelow(draft.length-i);[draft[i],draft[j]]=[draft[j],draft[i]];}
 return {enemies:[...draft.slice(0,count),...(boss?[boss]:[])],remix};
}

async function armySetup({map,chapter,seriesKey,tier,ids},getPool,hasArt) {
 requireRule(Object.hasOwn(armyMaps,map)&&within(chapter,0,2)&&within(tier,1,10)&&
  Array.isArray(ids)&&ids.length>0&&ids.length<=armyLimit&&ids.every(levelId),'Choose a valid Army deployment.');
 const series=seriesKey==null?null:findArmySeries(seriesKey);
 requireRule(seriesKey==null||series?.stages[chapter]?.tier===tier,'Choose a valid trilogy stage.');
 const rows=await getPool(difficulties[tier]);
 const starterRows=await getPool('Easy');
 return {rivals:armyRivals(rows,tier,chapter,series,hasArt),starterRows,series};
}
function armyPlayers(wallet,records,ids,starterRows,now) {
 const owned=new Map(records.filter(c=>c.copies>0).map(c=>[c.id,c]));
 if(!owned.size)for(const row of starterRows)if(armyTrialIds.includes(row[0]))owned.set(row[0],{row,copies:1});
 const count=new Map();
 return ids.map(id=>{
  const card=owned.get(id),used=(count.get(id)||0)+1;
  requireRule(card&&card.copies>=used&&(wallet.injuries?.[id]||0)<=now,'Choose healthy, owned Army fighters.');
  count.set(id,used);
  return {row:card.row,training:wallet.training?.[id]};
 });
}

const rules={
 'collection.seen':{run:({w,now,args:{through}})=>{
  requireRule(within(through,0,now),'Collection timestamp is invalid.');
  w.collectionSeenThrough=Math.max(w.collectionSeenThrough||0,through);
 }},
 'guide.seen':{run:({w,args:{id}})=>{
  requireRule(typeof id==='string'&&/^[a-z0-9-]{1,80}$/.test(id),'Choose a guide.');
  const seen=w.guideSeen??=[];
  if(!seen.includes(id)&&seen.length<128)seen.push(id);
 }},
 'mine.collect':{run:({income})=>({receipt:income})},
 'mine.tap':{run:({w,args:{count=1},now,online})=>{
  requireRule(within(count,1,mineTapBatch),'Choose a valid number of taps.');
  let accepted=count,retryAfter=0;
  if(online){
   const burst=36,refill=.016;
   const old=w.tapLimit;
   const credit=Math.min(burst,old?old.credit+Math.max(0,now-old.at)*refill:burst);
   accepted=Math.min(count,Math.floor(credit));
   w.tapLimit={at:now,credit:credit-accepted};
   if(accepted<count)retryAfter=Math.ceil((Math.min(mineTapBatch,count-accepted)-w.tapLimit.credit)/refill);
  }
  const gain=Math.min(Number.MAX_SAFE_INTEGER-w.coins,accepted*mineTapPower(w.mine));
  w.coins+=gain;
  minePlayerXp(w,accepted,now);
  return {gain,accepted,retryAfter};
 }},
 'mine.machine':{run:({w,args,now})=>{
  const result=buyMineMachine(w,args.id,args.mode,now);
  awardPlayerXp(w,result.count*[2,4,7,12,20][mineMachines.findIndex(m=>m.id===args.id)]);
  return result;
 }},
 'mine.skill':{run:({w,args,now})=>{
  requireRule(key(args.id),'Choose a mine skill.');
  buyMineSkill(w,args.id,now);
  awardPlayerXp(w,10+Math.floor(6*Math.log10(mineSkill(args.id).price)));
 }},
 'mine.code':{run:({w,args})=>{requireRule(key(args.code),'Enter a valid code.');return {amount:grantCoinCode(w,args.code)};}},
 'cube.equip':{run:({w,args})=>{
  requireRule(key(args.id),'Choose a cube.');
  const buying=!ownsCube(w,args.id),cube=claimCube(w,args.id);
  if(buying)awardPlayerXp(w,6+Math.floor(4*Math.log10(cube.price)));
  return {cube};
 }},
 'kingdom.house':{run:({w,args})=>{
  const house=buildHouse(w,args);
  awardPlayerXp(w,55);
  return {house};
 }},
 'kingdom.tower':{run:({w,args})=>{
  const plan=towerPlan(w);
  if(plan.next)requireLevel(w,towerPlayerLevel(plan.level+1),'Tower Level '+(plan.level+1));
  const tower=upgradeTower(w,args.level);
  awardPlayerXp(w,30+20*tower.level);
  return {tower};
 }},
 'pack.buy':{cards:true,prepare:async ({packId,quantity},getPool)=>{
  const pack=packs.find(item=>item.id===packId);
  requireRule(pack&&packQuantities.includes(quantity),'Choose a valid pack and quantity.');
  return {pack,pools:await allPools(getPool,pack.id==='godly'?cardCategories:difficulties)};
 },run:({w,records,changes,args,prepared,now})=>awardPack(w,records,changes,prepared.pack,args.quantity,prepared.pools,now)},
 'pack.advance':{run:({w,args,now})=>{
  requireRule(key(args.id)&&within(args.opened,0,50),'Choose a valid opening step.');
  const run=w.pending;
  if(!run||run.id!==args.id)return;
  const previous=run.opened;
  run.opened=Math.max(run.opened,Math.min(run.quantity,args.opened));
  if(run.opened>previous){
   const {xp,capped}=awardPackXp(w,run.packId,run.opened-previous,now);
   run.playerXpEarned=(run.playerXpEarned||0)+xp;
   if(capped)run.playerXpCappedPacks=(run.playerXpCappedPacks||0)+capped;
  }
  if(run.opened===run.quantity){w.lastPull=run;w.pending=null;}
 }},
 'upgrade.buy':{run:({w,args:{key:id,expectedLevel,mode=1}})=>{
  requireRule(Object.hasOwn(upgrades,id),'Unknown upgrade.');
  const level=w[id]||0;
  requireRule(level<upgrades[id].max,'This upgrade is at its maximum.');
  requireRule(level===expectedLevel,'Your upgrade level changed. Check the new price.');
  const {count,cost,affordable}=quoteUpgrade(id,level,w.gems,mode);
  requireRule(affordable,'You need more gems.');
  w.gems=(gemTenths(w.gems)-gemTenths(cost))/10;
  w[id]=level+count;
  awardPlayerXp(w,4*count);
 }},
 'card.feed':{cards:true,run:({w,records,changes,args})=>{
  const result=applyFeeding(w,records,args);
  changes.set(result.source.id,result.source);
  awardPlayerXp(w,Math.min(35,result.consumed*3));
  return result;
 }},
 'card.claim':{cards:true,prepare:async ({tier,ids},getPool)=>{
  requireRule(within(tier,1,cardCategories.length-1)&&Array.isArray(ids)&&ids.length>0&&ids.length<=20000&&ids.every(levelId),
   'Choose a discovered level with a gem reward.');
  const rows=await getPool(cardCategories[tier]),wanted=new Set(ids),last=tier===10?extremeTable(rows).last:0;
  return new Map(rows.filter(row=>wanted.has(row[0])).map(row=>[row[0],levelRewardTenths(tier,row[10],last)]));
 },run:({w,records,changes,prepared})=>{
  let tenths=0,count=0;
  for(const card of records){
   if(card.indexReward!==undefined)continue;
   const amount=prepared.get(card.id);
   if(!amount)continue;
   card.indexReward=amount/10;changes.set(card.id,card);tenths+=amount;count++;
  }
  requireRule(count,'There are no unclaimed gems for those levels.');
  w.gems=(gemTenths(w.gems)+tenths)/10;
  awardPlayerXp(w,count);
  return {gems:tenths/10,count};
 }},
 'card.merge':{cards:true,prepare:async (_,getPool)=>createMergePlanner(await allPools(getPool,difficulties),difficulties),
  run:({w,records,changes,args,prepared,now})=>{
   const {changed,preview}=fuseCollection(w,records,prepared,args,randomBelow,now);
   for(const [id,card] of changed)changes.set(id,card);
   awardPlayerXp(w,w.lastMerge.count*3);
   return {preview};
 }},
 'arena.squad':{cards:true,run:({w,records,args:{ids},now})=>{ownedRows(records,ids);readySquad(w,ids,now);w.squad=[...ids];}},
 'arena.begin':{cards:true,prepare:arenaSetup,run:({w,records,args:{ids,tier,campaign},prepared:{enemies,remix},now})=>{
  if(remix)requireLevel(w,featureLevel('arcade'),features.arcade.name);
  const allies=ownedRows(records,ids);
  readySquad(w,ids,now);
  requireRule(!campaign||stageUnlocked(w,tier),'Clear the previous campaign stage first.');
  requireRule(enemies.length===4&&enemies.every(Boolean),'The opposing squad could not load.');
  w.squad=[...ids];
  w.battle=makeBattle(allies,enemies,tier,randomUnit,w.training||{});
  if(campaign)configureCampaignBattle(w.battle);
  if(remix){
   w.battle.remix=remix.id;
   w.battle.charge=(remix.id===6508283?2:1)+Number(w.remixBest?.[remix.id]===100);
  }
  for(const [id,until] of Object.entries(w.injuries||{}))if(until<=now)delete w.injuries[id];
 }},
 'arena.move':{run:({w,args:{id,seq,move,target,actor},now})=>{
  requireRule(key(id)&&within(seq,0,100000)&&(within(target,0,3)||move==='retreat')&&(actor==null||within(actor,0,3)),'Choose a valid arena move.');
  const previous=w.battle?.kills||0;
  const battle=playTurn(w,id,seq,move,target,now,randomUnit,actor);
  const {tier,campaignReceipt}=battle;
  let xp=(battle.kills-previous)*(3+2*tier);
  if(battle.status==='won'){
   xp+=campaignReceipt?.first?55+14*tier:22+7*tier;
   if(campaignReceipt?.mastered)xp+=24+7*tier;
  }
  awardPlayerXp(w,xp);
 }},
 'arena.technique':{run:({w,args:{id,seq,actor,choice}})=>{
  const battle=w.battle,unit=battle?.allies[actor];
  requireRule(key(id)&&within(seq,0,100000)&&within(actor,0,3)&&battle?.id===id&&battle.seq===seq&&battle.status==='active'&&unit?.hp,
   'This battle has moved on.');
  requireRule(validTechnique(unit,choice),'Choose one of this card’s moves.');
  battle.techniques??={};
  if(choice)battle.techniques[unit.id]=choice;else delete battle.techniques[unit.id];
 }},
 'arena.leave':{run:({w,args:{id}})=>{if(w.battle?.id===id&&w.battle?.status!=='active')w.battle=null;}},
 'drill.begin':{cards:true,run:({w,records,args:{id,kind},now})=>{
  const card=records.find(entry=>entry.id===id);
  requireRule(levelId(id)&&Object.hasOwn(drillTypes,kind)&&card?.copies>0,'Choose an owned card and a drill.');
  requireRule((w.injuries?.[id]||0)<=now,'This card is recovering.');
  const token=crypto.randomUUID(),seed=randomBelow(0x100000000);
  w.drills={[token]:{id,kind,seed,start:now,endless:true,capacity:trainingCapacity(card.row)}};
  return {token,seed};
 }},
 'drill.checkpoint':{run:({w,args:{token,proof},now})=>{
  const drill=key(token)&&Object.hasOwn(w.drills||{},token)&&w.drills[token];
  requireRule(drill&&Number.isInteger(drill.seed),'Start a new training run.');
  if(drill.checkpoint&&drill.checkpoint.ticks===proof?.ticks)return {ticks:proof.ticks};
  drill.checkpoint=replayDrill(drill,proof,now);
  return {ticks:drill.checkpoint.ticks};
 }},
 'drill.finish':{cards:true,run:({w,records,args:{token,proof},now})=>{
  const drill=key(token)&&Object.hasOwn(w.drills||{},token)&&w.drills[token];
  requireRule(drill&&Number.isInteger(drill.seed)&&records.some(c=>c.id===drill.id&&c.copies>0),'Start a new training run.');
  const score=replayDrill(drill,proof,now).run.score;
  const result=grantTraining(w,token,score,now,drill.capacity);
  awardPlayerXp(w,Math.min(36,score*2)+(result.newBest?8:0));
  return result;
 }},
 'remix.begin':{run:({w,args:{id},now})=>{
  requireRule(levelId(id)&&findRemix(id),'Choose a featured level.');
  const token=crypto.randomUUID(),keyIndex=randomBelow(3);
  w.remixRun={id,token,key:keyIndex,start:now};
  return {token,key:keyIndex};
 }},
 'remix.finish':{run:({w,args:{token,proof},now})=>{
  const run=w.remixRun;
  requireRule(key(token)&&run?.token===token,'Start a new arcade attempt.');
  const percent=replayRemix(findRemix(run.id),run,proof,now);
  w.remixBest??={};
  const prior=w.remixBest[run.id]||0;
  w.remixBest[run.id]=Math.max(prior,percent);
  if(percent>prior)awardPlayerXp(w,Math.floor((percent-prior)*.3)+(percent===100?25:0));
  delete w.remixRun;
  return {percent};
 }},
 'army.begin':{cards:true,prepare:armySetup,run:({w,records,args:{map,chapter,tier,ids},prepared,now})=>{
  const {series,rivals,starterRows}=prepared;
  requireRule(series?seriesUnlocked(w,series.key,chapter):chapterUnlocked(w,tier,chapter),'Clear the previous Army stage first.');
  const run={id:crypto.randomUUID(),map,chapter,tier,seriesKey:series?.key,started:now,seed:randomBelow(0x100000000),
   signatureVersion:armySignatureVersion,statsVersion:combatStatsVersion,rivals,players:armyPlayers(w,records,ids,starterRows,now)};
  w.armyRun=run;
  return run;
 }},
 'army.finish':{run:({w,args:{id,frames,withdrawn},now})=>{
  if(w.armyReceipt?.id===id)return w.armyReceipt.result;
  requireRule(key(id)&&w.armyRun?.id===id,'Start an Army battle before claiming rewards.');
  const battle=replayArmy(w.armyRun,frames,withdrawn,now),result=grantArmyLoot(w,battle);
  awardPlayerXp(w,result.defeated*(2+2*battle.tier)+(battle.status==='won'?21+5*battle.tier:0)+(result.first?26:0));
  w.armyReceipt={id,result};
  delete w.armyRun;
  return result;
 }}
};

export async function prepareGameAction(name,args,getPool,hasArt=()=>true){
 requireRule(typeof name==='string'&&Object.hasOwn(rules,name)&&args&&typeof args==='object'&&!Array.isArray(args),'Unknown game action.');
 const rule=rules[name];
 const prepared=await rule.prepare?.(args,getPool,hasArt);
 return {cards:rule.cards,apply(w,records,changes,now,online){
  const feature=Object.hasOwn(gatedActions,name)?features[gatedActions[name]]:null;
  if(feature)requireLevel(w,feature.level,feature.name);
  const income=settleMine(w,now);
  return rule.run({w,records,changes,args,prepared,now,online,income})??null;
 }};
}
