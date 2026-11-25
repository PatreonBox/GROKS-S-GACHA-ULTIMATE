import {cardCategories,normalizeWallet,upgrades} from '../web/pack-engine.js';
import {armySeries} from '../web/army-trilogy.js';
import {campaignStages} from '../web/campaign.js';
import {cubeCatalog,ownsCube,starterCube} from '../web/cube-catalog.js';
import {drillTypes,trainingCapacity,trainingOf} from '../web/card-skills.js';
import {mineLevelCap,mineMachines,mineSkills,mineSkillLock,settleMine} from '../web/mine-economy.js';
import {findRemix} from '../web/remixes.js';

const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const count=(value,limit=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>0?Math.min(value,limit):0;
const copiesLimit=Math.floor(Number.MAX_SAFE_INTEGER/3);
const tierIds=campaignStages.map((_,index)=>index+1);
const drillKeys=Object.keys(drillTypes);

export async function prepareSaveTransfer(args,getPool){
 if(!args.wallet||Array.isArray(args.wallet)||typeof args.wallet!=='object'||
    !Array.isArray(args.cards)||args.cards.length>20000)throw Error('This browser save could not be read.');
 const catalog=new Map();
 if(args.cards.length){
  const pools=await Promise.all(cardCategories.map(getPool));
  for(const pool of pools)for(const row of pool)catalog.set(row[0],row);
 }
 const cards=new Map();
 let skipped=0;
 for(const entry of args.cards){
  if(!Array.isArray(entry))throw Error('This browser save has an unreadable card.');
  const [id,total,holo,antimatter,history,reward,last]=entry,row=catalog.get(id);
  if(!row){skipped++;continue;}
  if(cards.has(id))throw Error('This browser save contains duplicate card records.');
  const copies=count(total,copiesLimit),anti=count(antimatter,copies),foil=count(holo,copies-anti);
  const card={id,row,copies,holoCopies:foil,antimatterCopies:anti,
   everHolo:foil>0||Boolean(count(history,3)&1),everAntimatter:anti>0||Boolean(count(history,3)&2)};
  if(Number.isFinite(reward)&&reward>=0)card.indexReward=Math.min(reward,1000);
  if(count(last))card.last=count(last,Date.now());
  cards.set(id,card);
 }
 return {old:args.wallet,cards,skipped};
}

function combineCard(current,old){
 if(!current)return old;
 const anti=Math.max(current.antimatterCopies||0,old.antimatterCopies);
 const holo=Math.max(current.holoCopies||0,old.holoCopies);
 const plain=Math.max(current.copies-(current.holoCopies||0)-(current.antimatterCopies||0),
  old.copies-old.holoCopies-old.antimatterCopies);
 return {...current,copies:Math.min(Number.MAX_SAFE_INTEGER,plain+anti+holo),
  holoCopies:holo,antimatterCopies:anti,everHolo:Boolean(current.everHolo||old.everHolo),
  everAntimatter:Boolean(current.everAntimatter||old.everAntimatter),
  ...(current.indexReward===undefined&&old.indexReward!==undefined?{indexReward:old.indexReward}:{}),
  last:Math.max(current.last||0,old.last||0)};
}

function transferMine(wallet,old,now){
 if(!old.mine||typeof old.mine!=='object')return;
 const saved=old.mine,machines=record(saved.machines),skills=record(saved.skills);
 const mine={machines:{},skills:{},collectedAt:Math.min(now,count(saved.collectedAt)||now),remainder:0};
 for(const {id} of mineMachines)mine.machines[id]=count(machines[id],mineLevelCap);
 for(const {id} of mineSkills)if(skills[id]===true&&!mineSkillLock(mine,id))mine.skills[id]=true;
 const legacy={mine,coins:count(old.coins)};
 settleMine(legacy,now);
 wallet.coins=Math.max(wallet.coins,legacy.coins);
 const current=wallet.mine??{machines:{},skills:{},collectedAt:now,remainder:0};
 for(const {id} of mineMachines)current.machines[id]=Math.max(current.machines[id]||0,mine.machines[id]);
 for(const {id} of mineSkills)if(mine.skills[id])current.skills[id]=true;
 wallet.mine=current;
}

function transferTraining(wallet,old,cards){
 const training=record(old.training),bests=record(old.drillBest);
 for(const [id,card] of cards){
  const progress=record(training[id]),best=record(bests[id]);
  if(Object.keys(progress).length){
   const cap=trainingCapacity(card.row);
   const incoming={drillsVersion:progress.drillsVersion,xp:count(progress.xp)};
   for(const kind of drillKeys)incoming[kind]=count(progress[kind],100);
   const next=trainingOf(incoming,cap),current=wallet.training?.[id];
   const prior=trainingOf(current,cap);
   for(const kind of drillKeys)next[kind]=Math.max(next[kind],prior[kind],
    incoming.drillsVersion===1?incoming[kind]:0,current?.drillsVersion===1?current[kind]||0:0);
   next.xp=Math.max(next.xp||0,prior.xp||0);
   (wallet.training??={})[id]=next;
  }
  for(const kind of drillKeys)if(count(best[kind])){
   const scores=((wallet.drillBest??={})[id]??={});
   scores[kind]=Math.max(scores[kind]||0,best[kind]);
  }
 }
 if(wallet.training)wallet.trainingRevision=(wallet.trainingRevision||0)+1;
}

function transferCampaign(wallet,old){
 const stages=record(old.campaign);
 for(const tier of tierIds){
  const saved=stages[tier];
  if(!saved||typeof saved!=='object'||Array.isArray(saved))continue;
  const campaign=wallet.campaign??={},current=campaign[tier];
  const masteryPrize=Math.max(current?.masteryPrize||0,count(saved.masteryPrize));
  campaign[tier]={
   turns:Math.min(current?.turns??Infinity,count(saved.turns,100000)||current?.turns||100000),
   survivors:Math.max(current?.survivors||0,count(saved.survivors,4)),
   tempo:current?.tempo===true||saved.tempo===true,squad:current?.squad===true||saved.squad===true,
   ...(masteryPrize?{masteryPrize}:{})
  };
 }
 const chapters=record(old.armyTrilogy),series=record(old.armySeries);
 for(const tier of tierIds)if(count(chapters[tier],7)){
  const progress=wallet.armyTrilogy??={};
  progress[tier]=(progress[tier]||0)|count(chapters[tier],7);
 }
 for(const {key} of armySeries)if(count(series[key],7)){
  const progress=wallet.armySeries??={};
  progress[key]=(progress[key]||0)|count(series[key],7);
 }
 for(const key of ['remixBest','remixWins']){
  for(const [id,value] of Object.entries(record(old[key])))if(findRemix(Number(id))&&count(value)){
   const results=wallet[key]??={};
   results[id]=Math.max(results[id]||0,count(value,key==='remixBest'?100:Number.MAX_SAFE_INTEGER));
  }
 }
}

export function applySaveTransfer(wallet,records,{old,cards,skipped},now){
 settleMine(wallet,now);
 const prior=normalizeWallet({
  coins:count(old.coins),gems:Number.isFinite(old.gems)?Math.round(Math.min(Math.max(0,old.gems),1e12)*10)/10:0,
  luck:count(old.luck,upgrades.luck.max),bonus:count(old.bonus,100)
 });
 for(const field of ['coins','gems','luck','bonus'])wallet[field]=Math.max(wallet[field],prior[field]);
 if(old.redeemedCodes?.john===true)(wallet.redeemedCodes??={}).john=true;
 transferMine(wallet,old,now);
 const cubes={cubeCatalogVersion:old.cubeCatalogVersion,equippedCube:old.equippedCube,
  ownedCubes:Array.isArray(old.ownedCubes)?old.ownedCubes:[]};
 const owned=cubeCatalog.filter(({id})=>id!==starterCube.id&&(ownsCube(wallet,id)||ownsCube(cubes,id))).map(({id})=>id);
 if(owned.length)wallet.ownedCubes=owned;
 if((!wallet.equippedCube||wallet.equippedCube===starterCube.id)&&owned.includes(cubes.equippedCube))wallet.equippedCube=cubes.equippedCube;
 transferTraining(wallet,old,cards);
 transferCampaign(wallet,old);
 const existing=new Map(records.map(card=>[card.id,card]));
 const changes=new Map();
 for(const [id,card] of cards)changes.set(id,combineCard(existing.get(id),card));
 if(!wallet.squad&&Array.isArray(old.squad)&&old.squad.length===4&&new Set(old.squad).size===4&&
    old.squad.every(id=>(changes.get(id)||existing.get(id))?.copies>0))wallet.squad=old.squad;
 return {changes,result:{cards:cards.size,skipped}};
}
