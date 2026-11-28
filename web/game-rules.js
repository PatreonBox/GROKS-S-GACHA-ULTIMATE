import {cardCategories,difficulties,packs,rollPacks,upgrades,quoteUpgrade,randomBelow,
 grantCoinCode,applyFeeding,fuseCollection} from './pack-engine.js';
import {createMergePlanner,extremeTable,gemTenths,levelRewardTenths} from './card-economy.js';
import {starterCube,cubeCatalogVersion,claimCube,ownsCube} from './cube-catalog.js';
import {settleMine,creditMineTaps,mineTapBatch,buyMineMachine,buyMineSkill,mineMachines} from './mine-economy.js';
import {changeCoins,coinEconomyVersion,startingCoins} from './coin-economy.js';
import {arenaPlayerXp,combatStatsVersion,makeBattle,playTurn,grantTraining} from './battle-engine.js';
import {stageFor,stageUnlocked,configureCampaignBattle} from './campaign.js';
import {trainingCapacity,drillTypes,validTechnique} from './card-skills.js';
import {limboChoiceAt,limboPattern} from './limbo-keys.js';
import {findRemix,remixKeyReward} from './remixes.js';
import {armyMaps,armyLimit,armyTacticsVersion} from './army-battle.js';
import {armyTrialIds,armySignatureVersion,armyRivals,findArmySeries,chapterUnlocked,seriesUnlocked,replayArmy,grantArmyLoot} from './army-trilogy.js';
import {replayDrill,replayRemix,replayEndlessRemix,replayTidalVideo} from './game-replay.js';
import {remixPhysicsVersion} from './remix-physics.js';
import {tidalVideoId} from './tidal-video-rules.js';
import {endlessKeyInterval,endlessKeyStatus,endlessMilestones,rewardEndlessRemix} from './remix-endless.js';
import {awardPackXp,awardPlayerXp,minePlayerXp,playerProgress} from './player-progression.js';
import {featureLevel,features,packLevels,towerPlayerLevel} from './level-access.js';
import {buildCampfire,buildForge,buildGemMine,buildHouse,buildSpikeShooter,clearKingdomTree,collectForge,collectGemMine,expandLand,placeKingdomBuilding,settleKingdomConstruction,skipTower,storeKingdomBuilding,towerExperience,towerPlan,updateKingdomTrail,upgradeForge,upgradeHouse,upgradeSpikeShooter,upgradeTower} from './kingdom-rules.js';
import {validTradeMinimum} from './trade-rules.js';
import {achievementBoost} from './achievement-boosts.js';
import {bannerPrice,demonBanners,maxBannerDraws,prepareDemonPull,rollDemonBanner} from './demon-banner.js';
import {buyDemonKeys,campaignKeyReward,claimDemonKeys,initDemonKeys,rewardDemonKeys} from './demon-keys.js';
import {packAvailability,packStockLimit,spendPackStock} from './pack-stock.js';
import {validRevealMinimum} from './rare-reveal-tiers.js';

export function newWallet() {
 return {coins:startingCoins,coinEconomyVersion,gems:10,luck:0,bonus:0,pending:null,playerXp:0,cubeCatalogVersion,equippedCube:starterCube.id};
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
 'cube.equip':'cubes','kingdom.house':'kingdom','kingdom.tower':'kingdom','kingdom.tower.finish':'kingdom',
 'kingdom.forge':'kingdom','kingdom.collect':'kingdom','kingdom.expand':'kingdom','kingdom.campfire':'kingdom','kingdom.trail':'kingdom',
 'kingdom.gem-mine':'kingdom','kingdom.gem-mine.collect':'kingdom',
 'kingdom.spike-shooter':'kingdom','kingdom.spike-shooter.upgrade':'kingdom',
 'kingdom.house.upgrade':'kingdom','kingdom.forge.upgrade':'kingdom','kingdom.construction.finish':'kingdom',
 'kingdom.tower.skip':'kingdom','kingdom.building.store':'kingdom','kingdom.building.place':'kingdom','kingdom.tree.clear':'kingdom',
 'trade.settings':'trading',
 'upgrade.buy':'upgrades','card.feed':'training','drill.begin':'training',
 'card.merge':'merge','remix.begin':'arcade','remix.finale':'arcade','remix.checkpoint':'arcade','army.begin':'army'
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
function awardPack(wallet,records,changes,pack,quantity,pools,now,mintSerial) {
 requireRule(!wallet.pending,'Finish your current opening first.');
 requireLevel(wallet,packLevels[pack.id],pack.name+' packs');
 if(quantity==='max'){
  const stock=packAvailability(wallet,now).quantity;
  requireRule(stock>0,'Shared pack stock is empty. It refills one pack per minute.');
  quantity=Math.min(stock,Math.floor(wallet.coins/pack.price));
  requireRule(quantity>0,'You need more coins for this pull.');
 }
 const price=quantity*pack.price;
 requireRule(wallet.coins>=price,'You need more coins for this pull.');
 spendPackStock(wallet,quantity,now);
 const pull=rollPacks(pack,quantity,wallet,pools);
 changeCoins(wallet,-price);
 saveOpening(wallet,records,changes,pull,now,mintSerial);
}

function awardDemonPull(wallet,records,changes,{banner,quantity},prepared,now,mintSerial){
 requireRule(!wallet.pending,'Finish your current opening first.');
 const definition=demonBanners[banner];
 requireLevel(wallet,definition.level,definition.name+' Demon banner');
 initDemonKeys(wallet,now);
 if(quantity==='max')quantity=maxBannerDraws(wallet,banner);
 requireRule([1,10,50].includes(quantity)||within(quantity,2,49),'You need more Demon Keys for this draw.');
 if(quantity===50)requireLevel(wallet,featureLevel('bulk'),'50-draw pulls');
 const keyCost=bannerPrice(banner,quantity);
 requireRule(wallet.demonKeys>=keyCost,'You need '+keyCost+' Demon Keys for these draws.');
 const pull=rollDemonBanner(banner,quantity,wallet,prepared);
 const pities=wallet.demonBanner.pity??={};
 pities[banner]=pull.pity;
 wallet.demonKeys-=keyCost;
 saveOpening(wallet,records,changes,pull,now,mintSerial);
}

function saveOpening(wallet,records,changes,pull,now,mintSerial){
 const owned=new Map(records.map(c=>[c.id,c]));
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
  const serial=mintSerial?.(entry,antimatter.has(index)?'antimatter':holo.has(index)?'holo':'standard');
  if(serial!==undefined)(pull.serials??={})[index]=serial;
  changes.set(id,entry);
 });
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
  const gain=creditMineTaps(w,accepted);
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
  const skill=buyMineSkill(w,args.id,now);
  awardPlayerXp(w,skill.purchaseXp);
 }},
 'mine.code':{run:({w,args})=>{requireRule(key(args.code),'Enter a valid code.');return {amount:grantCoinCode(w,args.code)};}},
 'cube.equip':{run:({w,args})=>{
  requireRule(key(args.id),'Choose a cube.');
  const buying=!ownsCube(w,args.id),cube=claimCube(w,args.id);
  if(buying)awardPlayerXp(w,cube.purchaseXp);
  return {cube};
 }},
 'kingdom.house':{run:({w,args,now})=>{
  const house=buildHouse(w,args,now);
  awardPlayerXp(w,55);
  return {house};
 }},
 'kingdom.forge':{run:({w,args,now})=>({forge:buildForge(w,args,now)})},
 'kingdom.campfire':{run:({w,args,now})=>({building:buildCampfire(w,args,now)})},
 'kingdom.trail':{run:({w,args})=>updateKingdomTrail(w,args)},
 'kingdom.gem-mine':{run:({w,args,now})=>({building:buildGemMine(w,args,now)})},
 'kingdom.spike-shooter':{run:({w,args,now})=>({building:buildSpikeShooter(w,args,now)})},
 'kingdom.house.upgrade':{run:({w,args,now})=>({house:upgradeHouse(w,args.id,args.level,now)})},
 'kingdom.forge.upgrade':{run:({w,args,now})=>({forge:upgradeForge(w,args.id,args.level,now)})},
 'kingdom.spike-shooter.upgrade':{run:({w,args,now})=>({'spike-shooter':upgradeSpikeShooter(w,args.id,args.level,now)})},
 'kingdom.collect':{run:({w,args,now})=>collectForge(w,args.id,now)},
 'kingdom.gem-mine.collect':{run:({w,args,now})=>collectGemMine(w,args.id,now)},
 'kingdom.expand':{run:({w,args})=>expandLand(w,args.level)},
 'kingdom.building.store':{run:({w,args,now})=>storeKingdomBuilding(w,args.id,now)},
 'kingdom.building.place':{run:({w,args,now})=>placeKingdomBuilding(w,args,now)},
 'kingdom.tree.clear':{run:({w,args,now})=>clearKingdomTree(w,args.id,now)},
 'kingdom.tower.skip':{run:({w,args,now,finishedTower})=>{
  if(finishedTower)return {tower:finishedTower};
  const tower=skipTower(w,args.maxGems,now);
  awardPlayerXp(w,towerExperience(tower.level));
  return {tower};
 }},
 'profile.privacy':{run:({w,args})=>{
  const setting={hidden:'profileHidden',shareKingdom:'shareKingdom',shareBestCard:'shareBestCard'};
  const entries=Object.entries(args);
  requireRule(entries.length&&entries.every(([key,value])=>Object.hasOwn(setting,key)&&typeof value==='boolean'),'Choose a profile visibility setting.');
  for(const [key,value] of entries)w[setting[key]]=value;
 }},
 'settings.rare-reveal':{run:({w,args})=>{
  requireRule(validRevealMinimum(args.minimum),'Choose a rare cutscene tier or Off.');
  w.rareRevealMinimum=args.minimum;
 }},
 'trade.settings':{run:({w,args})=>{
  requireRule(typeof args.enabled==='boolean'&&validTradeMinimum(args.minimum),'Choose valid Trade settings.');
  w.trade={enabled:args.enabled,minimum:args.minimum};
 }},
 'kingdom.tower':{run:({w,args,now})=>{
  const plan=towerPlan(w,now);
  if(plan.next)requireLevel(w,towerPlayerLevel(plan.level+1),'Tower Level '+(plan.level+1));
  const tower=upgradeTower(w,args.level,now);
  return {tower};
 }},
 'kingdom.tower.finish':{run:({w,finishedTower})=>{
  requireRule(!w.kingdom?.towerConstruction,'Your tower upgrade is still under construction.');
  return {tower:finishedTower};
 }},
 'kingdom.construction.finish':{run:({finishedTower,finishedHouses,finishedForges,finishedDefences})=>({tower:finishedTower,houses:finishedHouses,forges:finishedForges,defences:finishedDefences})},
 'pack.buy':{cards:true,prepare:async ({packId,quantity},getPool)=>{
  const pack=packs.find(item=>item.id===packId);
  requireRule(pack&&(quantity==='max'||within(quantity,1,packStockLimit)),'Choose between 1 and '+packStockLimit+' packs.');
  return {pack,pools:await allPools(getPool,pack.id==='godly'?cardCategories:difficulties)};
 },run:({w,records,changes,args,prepared,now,mintSerial})=>awardPack(w,records,changes,prepared.pack,args.quantity,prepared.pools,now,mintSerial)},
 'demon.keys.buy':{run:({w,args,now})=>buyDemonKeys(w,args,now)},
 'demon.keys.claim':{run:({w,now})=>claimDemonKeys(w,now)},
 'demon.pull':{cards:true,prepare:async (args,getPool)=>{
  requireRule(args.quantity==='max'||[1,10,50].includes(args.quantity),'Choose 1, 10, 50, or Max draws.');
  return prepareDemonPull(args,getPool);
 },run:({w,records,changes,args,prepared,now,mintSerial})=>awardDemonPull(w,records,changes,args,prepared,now,mintSerial)},
 'pack.advance':{run:({w,args,now})=>{
  requireRule(key(args.id)&&within(args.opened,0,packStockLimit),'Choose a valid opening step.');
  const run=w.pending;
  if(!run||run.id!==args.id)return;
  const previous=run.opened;
  run.opened=Math.max(run.opened,Math.min(run.quantity,args.opened));
  if(run.opened>previous){
   const {xp,capped}=awardPackXp(w,run.packId,run.opened-previous,now,demonBanners[run.banner]?.xp);
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
  const playerXpEarned=Math.min(35,result.consumed*3);
  awardPlayerXp(w,playerXpEarned);
  return {...result,playerXpEarned};
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
  run:({w,records,changes,args,prepared,now,mintSerial})=>{
   const {changed,preview}=fuseCollection(w,records,prepared,args,randomBelow,now,mintSerial);
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
  const hpBoost=achievementBoost(w,'battle');
  for(const ally of w.battle.allies)ally.hp=ally.maxHp+=Math.floor(ally.maxHp*hpBoost/100);
  if(campaign)configureCampaignBattle(w.battle);
  if(remix){
   w.battle.remix=remix.id;
   w.battle.charge=(remix.id===6508283?2:1)+Number(w.remixBest?.[remix.id]===100);
  }
  for(const [id,until] of Object.entries(w.injuries||{}))if(until<=now)delete w.injuries[id];
 }},
 'arena.move':{run:({w,args:{id,seq,move,target,actor},now})=>{
  requireRule(key(id)&&within(seq,0,100000)&&(within(target,0,3)||move==='retreat')&&(actor==null||within(actor,0,3)),'Choose a valid arena move.');
  const previousXp=arenaPlayerXp(w.battle);
  const battle=playTurn(w,id,seq,move,target,now,randomUnit,actor);
  if(battle.campaignReceipt?.first)battle.campaignReceipt.demonKeys=rewardDemonKeys(w,campaignKeyReward,now);
  awardPlayerXp(w,arenaPlayerXp(battle)-previousXp);
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
  const playerXpEarned=Math.min(36,score*2)+(result.newBest?8:0);
  awardPlayerXp(w,playerXpEarned);
  return {...result,playerXpEarned};
 }},
 'remix.begin':{run:({w,args:{id,mode:requestedMode},now})=>{
  const remix=levelId(id)&&findRemix(id);
  const video=id===tidalVideoId&&requestedMode==='video';
  const mode=video?'normal':requestedMode??'normal';
  requireRule(remix,'Choose a featured level.');
  requireRule(video||requestedMode===undefined||requestedMode==='normal'||requestedMode==='endless','Choose Normal or Endless mode.');
  const token=crypto.randomUUID();
  const version=requestedMode===undefined?1:mode==='endless'?2:remixPhysicsVersion;
  w.remixRun={id,token,start:now,mode,version,keyVersion:id===86084399?2:0};
  if(video)w.remixRun.video=true;
  if(mode==='endless'){
   const seed=randomBelow(0x100000000);
   w.remixRun.seed=seed;
   return {token,mode,seed,interval:endlessKeyInterval(remix),...endlessKeyStatus(w,now)};
  }
  return {token,mode};
 }},
 'remix.checkpoint':{run:({w,args:{token,proof},now})=>{
  const run=w.remixRun;
  requireRule(key(token)&&run?.token===token&&run.mode==='endless','Start a new Endless attempt.');
  const remix=findRemix(run.id);
  const previous=run.checkedTicks||0,ticks=proof?.ticks;
  requireRule(Number.isSafeInteger(ticks)&&(ticks===previous||endlessMilestones(ticks,remix)>endlessMilestones(previous,remix)),
   'Keep playing to reach the next Endless checkpoint.');
  return rewardEndlessRemix(w,run,remix,replayEndlessRemix(remix,run,proof,now),now);
 }},
 'remix.finale':{run:({w,args:{token,proof},now})=>{
  const run=w.remixRun;
  requireRule(run?.id===86084399&&run.token===token&&run.mode!=='endless','Start a new LIMBO attempt.');
  if(!run.finale){
   replayRemix(findRemix(run.id),run,proof,now,{finale:true});
   run.keyVersion=2;
   run.finale={seed:randomBelow(0x100000000),start:now};
  }
  return {seed:run.finale.seed};
 }},
 'remix.finish':{run:({w,args:{token,proof},now})=>{
  const run=w.remixRun;
  requireRule(key(token)&&run?.token===token,'Start a new Mini Games attempt.');
  const remix=findRemix(run.id);
  if(run.mode==='endless'){
   const receipt=rewardEndlessRemix(w,run,remix,replayEndlessRemix(remix,run,proof,now),now);
   delete w.remixRun;
   return {...receipt,terminal:true};
  }
  const limbo=remix.mark==='KEY',finale=limbo&&run.finale;
  let percent;
  if(finale){
   requireRule(within(proof?.key,0,7)&&now-finale.start>=limboChoiceAt-250,'Wait for the keys to finish shuffling.');
   percent=proof.key===limboPattern(finale.seed).answer?100:99;
  }else percent=run.video?replayTidalVideo(run,proof,now):Math.min(limbo?99:100,replayRemix(remix,run,proof,now));
  const cleared=percent===100;
  w.remixBest??={};
  const prior=w.remixBest[run.id]||0,playerXpEarned=finale&&cleared?100:Math.max(0,Math.floor((percent-prior)*.3));
  w.remixBest[run.id]=Math.max(prior,percent);
  if(finale&&cleared){
   if(!w.limboKeysCleared)w.limboClearMode=run.version>=3?'wave':'ship';
   w.limboKeysCleared=true;
  }
  let demonKeys=0;
  if(cleared&&!w.remixKeyRewards?.[run.id]){
   demonKeys=rewardDemonKeys(w,remixKeyReward(remix),now);
   if(demonKeys)(w.remixKeyRewards??={})[run.id]=demonKeys;
  }
  awardPlayerXp(w,playerXpEarned);
  delete w.remixRun;
  return {percent,playerXpEarned,cleared,demonKeys};
 }},
 'army.begin':{cards:true,prepare:armySetup,run:({w,records,args:{map,chapter,tier,ids},prepared,now})=>{
  const {series,rivals,starterRows}=prepared;
  requireRule(series?seriesUnlocked(w,series.key,chapter):chapterUnlocked(w,tier,chapter),'Clear the previous Army stage first.');
  const run={id:crypto.randomUUID(),map,chapter,tier,seriesKey:series?.key,started:now,seed:randomBelow(0x100000000),
   signatureVersion:armySignatureVersion,statsVersion:combatStatsVersion,tacticsVersion:armyTacticsVersion,rivals,players:armyPlayers(w,records,ids,starterRows,now)};
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
 return {cards:rule.cards,apply(w,records,changes,now,online,mintSerial){
  initDemonKeys(w,now);
  const {tower:finishedTower,houses:finishedHouses,forges:finishedForges,defences:finishedDefences}=settleKingdomConstruction(w,now);
  const feature=Object.hasOwn(gatedActions,name)?features[gatedActions[name]]:null;
  if(feature)requireLevel(w,feature.level,feature.name);
  const income=settleMine(w,now);
  return rule.run({w,records,changes,args,prepared,now,online,income,finishedTower,finishedHouses,finishedForges,finishedDefences,mintSerial})??null;
 }};
}
