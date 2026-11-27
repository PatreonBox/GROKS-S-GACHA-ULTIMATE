import {cardRarities,cardRarity} from './card-rarity.js';
import {finishPercent,finishVersion,rollFinish} from './card-finishes.js';
import {bonusChance,cardCategories,packOddsVersion,randomBelow} from './pack-engine.js';
import {rankOddsVersion} from './card-economy.js';
import {playerProgress} from './player-progression.js';
import {featureLevel} from './level-access.js';

export {bannerUnlockDelay,demonKeyOffer,demonKeyPrice,keyLimit} from './demon-keys.js';

export const demonBanners={
 standard:{id:'standard',name:'Standard',level:0,cost:1,packId:'legendary',xp:12},
 special:{id:'special',name:'Special',level:featureLevel('demonSpecial'),cost:1,packId:'mythic',xp:22},
 pro:{id:'pro',name:'Pro',level:featureLevel('demonPro'),cost:5,packId:'godly',xp:44}
};
export const demonPity={legendary:150,mythic:600};
export const bannerPrice=(id,count)=>demonBanners[id]?.cost*count;
const legendaryIndex=4,mythicIndex=5,impossibleIndex=12;
const tickets=1_000_000;
// Each Pro Legendary-and-higher tier has exactly twenty times its Standard odds, at the same player level.
const baseWeights=[528000,285000,126000,42810,15000,2000,700,300,100,55,22,8,5];
const focusChance=.06;
export const keyBannerLevelCap=100;
export const proOddsMultiplier=20;
export const bannerLuckCap=500;

export function bannerOdds(id,level=0,{target=false,luck=0}={}){
 if(!Object.hasOwn(demonBanners,id))throw Error('Choose a Demon banner.');
 const levelBonus=Math.max(0,Math.min(keyBannerLevelCap,level))*.006;
 const luckBonus=Math.max(0,Math.min(bannerLuckCap,luck))*.001;
 const multiplier=(1+levelBonus)*(1+luckBonus);
 const weights=baseWeights.map((weight,i)=>i<legendaryIndex?weight:Math.round(weight*multiplier)*(id==='pro'?proOddsMultiplier:1));
 if(id==='pro'){
  const regular=weights.slice(0,legendaryIndex).reduce((sum,weight)=>sum+weight,0);
  const premium=weights.slice(legendaryIndex).reduce((sum,weight)=>sum+weight,0);
  for(let i=1;i<legendaryIndex;i++)weights[i]=Math.floor(weights[i]*(tickets-premium)/regular);
 }
 weights[0]=tickets-weights.slice(1).reduce((sum,weight)=>sum+weight,0);
 return cardRarities.map((rarity,i)=>({...rarity,weight:weights[i],percent:weights[i]/10_000,
  ...(id==='special'&&target?{focusPercent:focusChance*100}:{})}));
}

export function bannerPity(wallet,id){
 const pity=wallet?.demonBanner?.pity?.[id];
 return {legendary:pity?.legendary||0,mythic:pity?.mythic||0};
}

export function maxBannerDraws(wallet,id){
 if(!Object.hasOwn(demonBanners,id))return 0;
 const cap=playerProgress(wallet.playerXp).level>=featureLevel('bulk')?50:49;
 return Math.max(0,Math.min(cap,Math.floor((wallet.demonKeys||0)/demonBanners[id].cost)));
}

const catalogueCache=new WeakMap();
export function demonCatalogue(getPool){
 let load=catalogueCache.get(getPool);
 if(!load){
  load=Promise.all(cardCategories.map(getPool)).then(pools=>{
   const levels=new Map(),names=[];
   const groups=cardRarities.map(()=>[]),groupCounts=cardRarities.map(()=>({}));
   for(const row of pools.flat()){
    if(levels.has(row[0]))continue;
    levels.set(row[0],row);names.push({row,name:row[1].toLowerCase()});
    const index=cardRarity(row).index,category=row[6];
    groups[index].push(row);groupCounts[index][category]=(groupCounts[index][category]||0)+1;
   }
   if(groups.some(group=>!group.length))throw Error('The Demon banner catalog is incomplete.');
   return {groups,groupCounts,levels,names};
  }).catch(error=>{catalogueCache.delete(getPool);throw error;});
  catalogueCache.set(getPool,load);
 }
 return load;
}

export async function demonTargetSearch(getPool,query,{category,impossible=false}={}){
 const {levels,names,groups}=await demonCatalogue(getPool);
 const term=query.trim().toLowerCase().slice(0,80),exact=/^\d+$/.test(term);
 const qualifies=row=>row&&(impossible?row[6]==='Impossible':row[6]!=='Impossible')&&(!category||row[6]===category);
 if(exact){
  const row=levels.get(Number(term));
  return qualifies(row)?[row]:[];
 }
 if(impossible)return groups[impossibleIndex].filter(row=>qualifies(row)&&row[1].toLowerCase().includes(term));
 if(term.length<2)return [];
 const starts=[],other=[];
 for(const {row,name} of names){
  if(!qualifies(row)||!name.includes(term))continue;
  if(name.startsWith(term)){
   starts.push(row);
   if(starts.length===18)break;
  }else if(other.length<18)other.push(row);
 }
 return starts.concat(other).slice(0,18);
}

export async function prepareDemonPull({banner,targetId,category,levelId},getPool,{preview=false}={}){
 if(!Object.hasOwn(demonBanners,banner))throw Error('Choose a Demon banner.');
 const catalogue=await demonCatalogue(getPool),{levels}=catalogue;
 let target;
 if(targetId!==undefined){
  target=Number.isSafeInteger(targetId)&&levels.get(targetId);
  if(banner!=='special'||!target||cardRarity(target).index===impossibleIndex)throw Error('Choose a valid Special focus card.');
 }
 let force;
 if(preview&&levelId!==undefined){
  force=Number.isSafeInteger(levelId)&&levels.get(levelId);
  if(!force||category&&force[6]!==category)throw Error('Choose an exact level in that category.');
 }else if(preview&&category!==undefined){
  if(!cardCategories.includes(category))throw Error('Choose a card category.');
  force=[...levels.values()].filter(row=>row[6]===category);
  if(!force.length)throw Error('No cards in that category.');
 }
 return {catalogue,target,force};
}

export function rollDemonBanner(id,quantity,wallet,{catalogue,target,force},random=randomBelow){
 const {groups,groupCounts}=catalogue,banner=demonBanners[id],level=playerProgress(wallet.playerXp).level;
 const odds=bannerOdds(id,level,{luck:wallet.luck||0}),pity=bannerPity(wallet,id),focus=target&&cardRarity(target).index;
 const declaredWeights=Object.fromEntries(cardCategories.map(category=>[category,0]));
 for(const tier of odds){
  const group=groups[tier.index],fraction=tier.percent/group.length;
  for(const [category,count] of Object.entries(groupCounts[tier.index]))
   declaredWeights[category]+=count*fraction*(tier.index===focus?1-focusChance:1);
 }
 if(target)declaredWeights[target[6]]+=odds[focus].percent*focusChance;

 const rows=[],sizes=[],holos=[],antimatters=[],drawPercents=[],drawDifficultyPercents=[],drawRarityPercents=[],guarantees=[];
 const cumulative=odds.map((_,i)=>odds.slice(i).reduce((sum,tier)=>sum+tier.weight,0));
 const bonus=Math.round(bonusChance(wallet.bonus)*100),focusSlots=Math.round(focusChance*tickets);
 for(let draw=0;draw<quantity;draw++){
  const size=bonus>0&&random(10000)<bonus?6:5;
  let topIndex=0;
  const floor=pity.mythic+1>=demonPity.mythic?mythicIndex:pity.legendary+1>=demonPity.legendary?legendaryIndex:0;
  if(floor)guarantees.push({draw,tier:cardRarities[floor].id});
  sizes.push(size);
  for(let slot=0;slot<size;slot++){
   const first=slot===0,min=first?floor:0,total=cumulative[min];
   let ticket=random(total),tier=odds[min];
   for(const candidate of odds.slice(min)){
    tier=candidate;
    if(ticket<tier.weight)break;
    ticket-=tier.weight;
   }
   const i=tier.index,group=groups[i],focused=i===focus;
   let row=focused&&random(tickets)<focusSlots?target:group[random(group.length)];
   let rarityPercent=tier.weight*100/total;
   let chance=(focused?(1-focusChance)/group.length+Number(row===target)*focusChance:1/group.length)*rarityPercent;
   if(force&&draw===0&&first){
    row=Array.isArray(force[0])?force[random(force.length)]:force;
    const natural=cardRarity(row).index,groupSize=groups[natural].length;
    rarityPercent=odds[natural].percent;
    const focusedShare=natural===focus?(1-focusChance)/groupSize+Number(row===target)*focusChance:1/groupSize;
    chance=rarityPercent*focusedShare;
   }
   topIndex=Math.max(topIndex,cardRarity(row).index);
   const finish=rollFinish(random(10000));
   rows.push(row);
   if(finish==='holo')holos.push(rows.length-1);
   if(finish==='antimatter')antimatters.push(rows.length-1);
   drawPercents.push(chance*finishPercent(finish,finishVersion)/100);
   drawDifficultyPercents.push(declaredWeights[row[6]]);
   drawRarityPercents.push(rarityPercent);
  }
  pity.legendary=topIndex>=legendaryIndex?0:pity.legendary+1;
  pity.mythic=topIndex>=mythicIndex?0:pity.mythic+1;
 }
 return {packId:banner.packId,banner:id,quantity,rows,sizes,holos,antimatters,drawPercents,drawDifficultyPercents,drawRarityPercents,
  finishVersion,packOddsVersion,oddsVersion:rankOddsVersion,luckAtPurchase:wallet.luck,
  keyCost:bannerPrice(id,quantity),targetId:target?.[0],playerLevelAtPurchase:level,pity,guarantees};
}
