import {addCardXP,cardGrowth,cardLevelCap,xpAt,feedXP,spareCopies} from './card-growth.js';
import {pickExtreme,extremeOdds,compareMergeStrength,mergeGems,extremeTable,gemTenths,rankOddsVersion} from './card-economy.js';
import {impossibleCategory,impossibleCount,impossibleTier,impossiblePercent} from './impossible-cards.js';
import {finishVersion,finishPercent,rollFinish,bestFinish,finishAt,finishOrder} from './card-finishes.js';
import {gameRead,gameCommand} from './game-client.js';
import {normalizeCoinWallet} from './coin-economy.js';
export {onOtherTab} from './game-client.js';

export const difficulties=['Auto','Easy','Normal','Hard','Harder','Insane','Easy Demon','Medium Demon','Hard Demon','Insane Demon','Extreme Demon'];
export const cardCategories=[...difficulties,impossibleCategory];
// Percentages follow the same Auto-to-Extreme order as difficulties.
export const packs=[
 {id:'common',name:'Common',price:10,color:'#82eddf',dark:'#144c58',
  base:[40,30,18,8,3,.88,.115,.005,0,0,0]},
 {id:'uncommon',name:'Uncommon',price:150,color:'#adf06a',dark:'#365730',
  base:[5,15,26,28,17,8.5,.47,.03,0,0,0]},
 {id:'rare',name:'Rare',price:2000,color:'#65baff',dark:'#1c477e',
  base:[.25,1.75,5,20,30,35,7,1,0,0,0]},
 {id:'super-rare',name:'Super Rare',price:25000,color:'#ef97ff',dark:'#603278',
  base:[0,0,0,0,2,8,58,31.95,.05,0,0]},
 {id:'epic',name:'Epic',price:200000,color:'#ffcb65',dark:'#805124',
  base:[0,0,0,0,0,1,7,57,34.95,.05,0]},
 {id:'legendary',name:'Legendary',price:1000000,color:'#b3ecff',dark:'#504389',
  base:[0,0,0,0,0,0,.5,5.5,63,30.95,.05]},
 {id:'mythic',name:'Mythic',price:20000000,color:'#ff97bc',dark:'#842954',
  base:[0,0,0,0,0,0,0,0,2,88,10]},
 {id:'godly',name:'Godly',price:300000000,color:'#ffedaa',dark:'#8a652e',
  base:[0,0,0,0,0,0,0,0,0,0,100]},
];

export const packOddsVersion=3;
export const mythicExtremeCap=15;
const priorMythicBase=[0,0,0,0,0,0,0,0,0,40,60];
// Older openings can still reconstruct odds if they predate stored per-card probabilities.
const legacyPackBases={
 'common':[40,30,18,8,3,.76,.18,.05,.008,.0018,.0002],
 'uncommon':[.4,.8,2,38.4,28.8,19.2,6.72,2.88,.6,.18,.02],
 'rare':[.12,.33,.65,1.5,3.3,38,27,18,8.5,2.5,.10],
 'super-rare':[.05,.1,.2,.45,1,2.2,38,29,20.75,7.5,.75],
 'epic':[.02,.04,.08,.16,.35,.85,3.5,40,33,19.75,2.25],
 'legendary':[.01,.02,.04,.08,.15,.4,1.3,3,54,35.5,5.5],
 'mythic':[.003,.006,.009,.012,.02,.05,.12,.78,7,32,60],
 'godly':[.0002,.0004,.0006,.0008,.001,.002,.005,.02,.1,.87,99],
};

const TICKETS=1000000;
export const packQuantities=[1,10,50];
export const upgrades={
 luck:{name:'Card luck',max:500},
 bonus:{name:'Extra card',max:90},
};
export const upgradeCost=level=>(20+5*level)/10;
const upgradeTenths=(level,count)=>count*(20+5*level)+5*count*(count-1)/2;
export function normalizeWallet(wallet){
 const cap=upgrades.bonus.max;
 if(wallet?.bonus>cap){
  // Refund the previous version's paid levels above the new cap.
  const retired=Math.min(wallet.bonus,100)-cap;
  wallet.gems=(gemTenths(wallet.gems||0)+upgradeTenths(cap,retired))/10;
  wallet.bonus=cap;
 }
 return normalizeCoinWallet(wallet);
}
export function quoteUpgrade(key,level,gems,mode=1){
 const max=upgrades[key]?.max||0,remaining=Math.max(0,max-level),budget=gemTenths(gems);
 if(![1,10,'max'].includes(mode))return {count:0,cost:0,affordable:false};
 let count=Math.min(remaining,mode==='max'?max:mode);
 if(mode==='max')while(count>0&&upgradeTenths(level,count)>budget)count--;
 const cost=upgradeTenths(level,count);
 return {count,cost:cost/10,affordable:count>0&&cost<=budget};
}
export function bonusChance(level){
 if(level<=0)return 0;
 if(level<=50)return Math.round((5+(level-1)*45/49)*100)/100;
 return Math.min(level,upgrades.bonus.max);
}

// Every 100% Luck adds a difficulty roll. Partial Luck adds one with that chance.
// The highest result wins. The 0–100% curve matches existing saved pack odds.
// Quantize the cumulative probabilities, keeping a ticket for each eligible difficulty.
// The UI and sampler use the same integer table, including at maximum luck.
export function oddsFor(pack,luckLevel=0,{secrets=true,version=packOddsVersion}={}){
 const base=version===1?legacyPackBases[pack.id]:version===2&&pack.id==='mythic'?priorMythicBase:pack.base;
 const extra=Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Number(luckLevel)||0))/100;
 const whole=Math.floor(extra),fraction=extra-whole;
 let baseCdf=0,prior=0,remaining=base.filter(pct=>pct>0).length;
 const odds=base.map((pct,index)=>{
  const category=difficulties[index];
  if(pct===0)return {category,weight:0,percent:0};
  remaining--;
  baseCdf+=Math.round(pct*TICKETS/100);
  const cdf=baseCdf/TICKETS;
  const adjusted=extra<=1?baseCdf-extra*baseCdf*(1-cdf):baseCdf*cdf**whole*(1-fraction*(1-cdf));
  const threshold=Math.min(TICKETS-remaining,Math.max(prior+1,Math.round(adjusted)));
  const weight=threshold-prior;
  prior=threshold;
  return {category,weight,percent:weight/10000};
 });
 if(version>=3&&pack.id==='mythic'){
  const insane=odds[9],extreme=odds[10],overflow=Math.max(0,extreme.weight-mythicExtremeCap*10000);
  insane.weight+=overflow;insane.percent=insane.weight/10000;
  extreme.weight-=overflow;extreme.percent=extreme.weight/10000;
 }
 if(secrets&&pack.id==='godly'){
  const tickets=Math.round(impossiblePercent*TICKETS/100),extreme=odds[10];
  extreme.weight-=tickets;extreme.percent=extreme.weight/10000;
  odds.push({category:impossibleCategory,weight:tickets,percent:impossiblePercent});
 }
 return odds;
}

export function godlyExtremeTickets(luck=0,options){return oddsFor(packs.at(-1),luck,options)[10].weight}
export const mostLikelyDifficulty=odds=>odds.reduce((best,tier)=>tier.weight>best.weight?tier:best);
// Probability of one exact level and finish, expressed as a percentage per dealt card.
export function cardDrawPercent(row,levels,tierPercent,{
 holo=false,finish=holo?'holo':'standard',hasFinishRoll=true,finishOddsVersion=finishVersion,version=rankOddsVersion,reference=godlyExtremeTickets()
}={}){
 const size=row[6]===impossibleCategory?impossibleCount:levels?.length;
 if(!size||!Number.isFinite(tierPercent))return null;
 const level=row[6]==='Extreme Demon'&&version>=2
  ?extremeOdds(row[10],extremeTable(levels,version),tierPercent,reference)
  :tierPercent/size;
 return level*finishPercent(finish,hasFinishRoll?finishOddsVersion:0)/100;
}
// Show the difficulty draw when every level in that difficulty has the same weight.
function rarityOdds(row,difficultyPercent,finish,exactPercent,finishOddsVersion){
 const category=row[6],finishRate=finishPercent(finish,finishOddsVersion)/100;
 const rank=exactPercent>0&&(category==='Extreme Demon'||category===impossibleCategory)?row[10]:null;
 const grouped=Number.isFinite(difficultyPercent)?difficultyPercent*(finish==='standard'?1:finishRate):null;
 // Standard cards describe the underlying pull across all finishes. A foil is an extra roll.
 const percent=rank?(finish==='standard'?exactPercent/finishRate:exactPercent):grouped;
 return {category,rank,finish,difficultyPercent,percent};
}

export function inventoryOdds(extremes,packId,luck=0){
 const reference=godlyExtremeTickets(luck),ranks=new Map(extremes.map(row=>[row[0],row]));
 const packSet=packId==='all'?packs:packs.filter(pack=>pack.id===packId);
 const rates=cardCategories.map(()=>0);
 for(const pack of packSet)oddsFor(pack,luck).forEach((tier,i)=>{rates[i]+=tier.percent/packSet.length});
 return card=>{
  const tier=cardCategories.indexOf(card.row[6]),finish=bestFinish(card);
  const row=tier===10?ranks.get(card.id):card.row;
  if(!row||!rates[tier])return rarityOdds(card.row,0,finish,null,finishVersion);
  const exact=tier>=10?cardDrawPercent(row,extremes,rates[tier],{finish,reference}):null;
  return rarityOdds(row,rates[tier],finish,exact,finishVersion);
 };
}
export function handFor(run,index){
 const sizes=run.sizes;
 const first=sizes?sizes.slice(0,index).reduce((sum,n)=>sum+n,0):index*5;
 return run.rows.slice(first,first+(sizes?.[index]??5));
}
async function readCatalog(path) {
 const response = await fetch(path);
 if (!response.ok) throw Error('Card catalog could not load.');
 return response.json();
}

export function createCardPool(read = readCatalog) {
 const pools = new Map();
 return async function getPool(category) {
  if (!cardCategories.includes(category)) throw Error('Unknown card difficulty.');
  if (!pools.has(category)) {
   const request = (async () => {
    if (category === impossibleCategory) {
     const rows = await read('/data/impossible.json');
     if (rows.length !== impossibleCount) throw Error('The Godly secret pool is incomplete.');
     return rows;
    }
    if (category === 'Extreme Demon') {
     const main = (await read('/data/demons.json')).filter(d=>d.status==='MainList')
      .sort((a,b)=>Number(a.twoPlayer)-Number(b.twoPlayer)||a.position-b.position);
     const levels = new Map();
     for (const d of main) {
      if (levels.has(d.id)) continue;
      const [player,downloads,likes,stars,length,coins]=d.stats||[0,null,null,10,'',0];
      levels.set(d.id,[d.id,d.name,d.publisher||'',player,downloads,likes,category,stars,length,coins,d.position]);
     }
     return [...levels.values()];
    }
    const [tier,kind] = category.toLowerCase().split(' ');
    return read('/data/' + (kind ? 'lists/' : 'stars/') + tier + '.json');
   })().catch(error => { pools.delete(category); throw error; });
   pools.set(category, request);
  }
  return pools.get(category);
 };
}
export const pool = createCardPool();

// Rejection sampling keeps every integer in the requested range equally likely.
export function randomBelow(limit){
 const ceiling=0x100000000-(0x100000000%limit);
 const word=new Uint32Array(1);
 do{crypto.getRandomValues(word)}while(word[0]>=ceiling);
 return word[0]%limit;
}
export function rollPacks(pack,quantity,wallet,pools,random=randomBelow){
 if(!packs.includes(pack)||!Number.isSafeInteger(quantity)||quantity<1||quantity>50)throw Error('Choose a valid pack quantity.');
 const odds=oddsFor(pack,wallet.luck),bonus=Math.round(bonusChance(wallet.bonus)*100);
 const referenceTickets=godlyExtremeTickets(wallet.luck);
 const rows=[],sizes=[],holos=[],antimatters=[],drawPercents=[];
 for(let i=0;i<quantity;i++){
  const size=bonus>0&&random(10000)<bonus?6:5;
  sizes.push(size);
  for(let j=0;j<size;j++){
   let ticket=random(TICKETS),index=0;
   while(ticket>=odds[index].weight){ticket-=odds[index].weight;index++}
   const levels=pools[index];
   const row=index===10?pickExtreme(levels,random,referenceTickets):levels[random(levels.length)];
   const finish=rollFinish(random(10000));
   rows.push(row);
   if(finish==='holo')holos.push(rows.length-1);
   if(finish==='antimatter')antimatters.push(rows.length-1);
   drawPercents.push(cardDrawPercent(row,levels,odds[index].percent,{finish,reference:referenceTickets}));
  }
 }
 return {packId:pack.id,quantity,rows,sizes,holos,antimatters,drawPercents,luckAtPurchase:wallet.luck,
  finishVersion,packOddsVersion,oddsVersion:rankOddsVersion};
}

export const readWallet = () => gameRead('wallet');
export const readIndex = () => gameRead('cards');
export async function readCollection(){return (await readIndex()).filter(c=>c.copies>0)}
const walletFrom = async (action,args,notice) => (await gameCommand(action,args,notice)).wallet;
const resultFrom = async (action,args,notice) => {
 const {wallet,result} = await gameCommand(action,args,notice);
 return {wallet,...result};
};
export const collectMineIncome = () => resultFrom('mine.collect',{},null);
export const mineCoin = count => resultFrom('mine.tap',{count},'mine');
export const purchaseMineMachine = (id,mode) => resultFrom('mine.machine',{id,mode},'mine');
export const purchaseMineSkill = id => walletFrom('mine.skill',{id},'mine');
export const redeemCoinCode = code => resultFrom('mine.code',{code});
export const buyPack = (pack,quantity) => walletFrom('pack.buy',{packId:pack.id,quantity});
export const purchaseUpgrade = (key,expectedLevel,mode=1) => walletFrom('upgrade.buy',{key,expectedLevel,mode});
export const advanceOpening = (id,opened) => walletFrom('pack.advance',{id,opened});
export const feedLevelCard = options => resultFrom('card.feed',options);
export const claimIndex = (tier,ids) => resultFrom('card.claim',{tier,ids});
export const mergeDuplicates = (options={}) => resultFrom('card.merge',options);

export function grantCoinCode(wallet,code){
 if(code.trim().toLowerCase()!=='john')throw Error('Unknown code.');
 if(wallet.redeemedCodes?.john)throw Error('You’ve already redeemed john.');
 const amount=Math.min(4_999_999,Math.max(1_000,Math.floor(wallet.coins/10)),Number.MAX_SAFE_INTEGER-wallet.coins);
 if(!amount)throw Error('Your coin balance is full.');
 wallet.redeemedCodes??={};wallet.redeemedCodes.john=true;
 wallet.coins+=amount;
 return amount;
}
// Keep the original draw index so sorting never moves a bonus or new badge onto another card.
export function orderedPull(run,packIndex=null,legacyExtremes){
 const pack=packs.find(p=>p.id===run.packId);
 const options={secrets:run.finishVersion>=2,version:run.packOddsVersion??1};
 const odds=pack?oddsFor(pack,run.luckAtPurchase,options):[];
 const finishOddsVersion=run.finishVersion??(Array.isArray(run.holos)?1:0),rankVersion=run.oddsVersion??1;
 const reference=godlyExtremeTickets(run.luckAtPurchase,options);
 let start=0;
 const holos=new Set(run.holos||[]),antimatters=new Set(run.antimatters||[]),bonuses=new Set(),newIds=new Set(run.newIds||[]);
 for(const size of run.sizes||[]){start+=size;if(size===6)bonuses.add(start-1)}
 let offset=0,count=run.rows.length;
 if(packIndex!==null){
  offset=run.sizes?run.sizes.slice(0,packIndex).reduce((a,b)=>a+b,0):5*packIndex;
  count=run.sizes?.[packIndex]??5;
 }
 const entries=[];
 run.rows.forEach((row,i)=>{
  const fresh=newIds.delete(row[0]);
  if(i<offset||i>=offset+count)return;
  const tier=cardCategories.indexOf(row[6]),holo=holos.has(i),finish=antimatters.has(i)?'antimatter':holo?'holo':'standard';
  const difficultyPercent=run.drawDifficultyPercents?.[i]??odds[tier]?.percent,usesRank=tier===11||(tier===10&&rankVersion>=2);
  const exact=usesRank?(run.drawPercents?.[i]??cardDrawPercent(row,legacyExtremes,difficultyPercent,{
   finish,finishOddsVersion,version:rankVersion,reference
  })):null;
  const drop=rarityOdds(row,difficultyPercent,finish,exact,finishOddsVersion);
  if(run.banner&&!usesRank&&Number.isFinite(run.drawRarityPercents?.[i]))drop.percent=run.drawRarityPercents[i]*(finish==='standard'?1:finishPercent(finish,finishOddsVersion)/100);
  entries.push({row,tier,drawIndex:i,bonus:bonuses.has(i),holo,fresh,...drop});
 });
 return entries.sort((a,b)=>{
  const rarity=(a.percent||Infinity)-(b.percent||Infinity);
  if(rarity)return rarity;
  if(a.tier!==b.tier)return b.tier-a.tier;
  if(a.tier>=10)return (a.row[10]||Infinity)-(b.row[10]||Infinity);
  return (b.row[7]-a.row[7])||((b.row[11]??-1)-(a.row[11]??-1))||((a.row[12]||Infinity)-(b.row[12]||Infinity));
 });
}

export function applyFeeding(w,records,{targetId,sourceId,count}){
 const target=records.find(card=>card.id===targetId&&card.copies>0);
 const source=records.find(card=>card.id===sourceId);
 if(!target||!source||!Number.isSafeInteger(count)||count<1||count>spareCopies(source))throw Error('Choose owned spare copies to feed.');
 w.training??={};
 const progress={...w.training[targetId]},growth=cardGrowth(progress);
 if(growth.maxed)throw Error('This card is at max level.');
 const perCopy=feedXP(cardCategories.indexOf(source.row[6]));
 const consumed=Math.min(count,Math.ceil((xpAt(cardLevelCap)-growth.xp)/perCopy));
 const xp=addCardXP(progress,consumed*perCopy);
 w.training[targetId]=progress;w.trainingRevision=(w.trainingRevision||0)+1;
 source.copies-=consumed;
 return {source,consumed,...xp};
}

export function mergeBlocked(card,w,now=Date.now()){
 if(card.row[6]===impossibleCategory)return true;
 if((w.injuries?.[card.id]||0)>now)return true;
 return w.battle?.status==='active'&&w.battle.allies.some(u=>u.id===card.id);
}
export const strongestMergeFirst=(a,b)=>compareMergeStrength(a.row,b.row,cardCategories);

function fusePair(w,source,dest,promoted,tier,now){
 const first=finishAt(source,0),finish=finishAt(source,1);
 source.copies-=2;
 source.holoCopies=(source.holoCopies||0)-Number(first==='holo')-Number(finish==='holo');
 source.antimatterCopies=(source.antimatterCopies||0)-Number(first==='antimatter')-Number(finish==='antimatter');
 source.everHolo=!!(source.everHolo||source.holoCopies||first==='holo'||finish==='holo');
 source.everAntimatter=!!(source.everAntimatter||source.antimatterCopies||finish==='antimatter');
 dest.copies++;
 dest.holoCopies=(dest.holoCopies||0)+Number(finish==='holo');
 dest.antimatterCopies=(dest.antimatterCopies||0)+Number(finish==='antimatter');
 dest.everHolo=!!(dest.everHolo||dest.holoCopies);dest.everAntimatter=!!(dest.everAntimatter||dest.antimatterCopies);dest.last=now;
 if(!source.copies&&w.squad?.includes(source.id)){
  w.squad=w.squad.includes(dest.id)?w.squad.filter(id=>id!==source.id):w.squad.map(id=>id===source.id?dest.id:id);
 }
 if(!source.copies&&w.drills){
  for(const [token,drill] of Object.entries(w.drills))if(drill.id===source.id)delete w.drills[token];
 }
 if(!source.copies&&w.training?.[source.id]){
  const progress=w.training[dest.id]||{};
  for(const k of ['spike','saw','endurance','xp'])progress[k]=Math.max(progress[k]||0,w.training[source.id][k]||0);
  w.training[dest.id]=progress;delete w.training[source.id];w.trainingRevision=(w.trainingRevision||0)+1;
 }
 return {from:source.row[1],source:source.row,row:dest.row,finish,holo:finish==='holo',promoted,
  gems:mergeGems(tier)+(promoted?mergeGems(tier+1):0)};
}

export function fuseCollection(w,records,plan,{id,expectedCopies,pairs}={},random=randomBelow,now=Date.now()){
 const collection=new Map(records.map(c=>[c.id,c])),changed=new Map(),outcomes=new Map();
 const selected=id==null?null:collection.get(id);
 if(id!=null&&(!selected||selected.copies!==expectedCopies||!Number.isInteger(pairs)||pairs<1||pairs*2>selected.copies)){
  throw Error('Your duplicates changed. Choose the pair count again.');
 }
 const ready=c=>c.copies>=2&&!mergeBlocked(c,w,now)&&plan(c.row).near.length;
 if(selected&&!ready(selected))throw Error('This pair cannot merge while it is recovering, in battle, or at the top of its group.');
 const queue=selected?[selected]:records.filter(ready).sort((a,b)=>strongestMergeFirst(b,a));
 const queued=new Set(queue.map(c=>c.id));
 function enqueue(card){
  if(queued.has(card.id)||!ready(card))return;
  let lo=0,hi=queue.length;
  while(lo<hi){
   const mid=(lo+hi)>>>1;
   if(strongestMergeFirst(card,queue[mid])<0)lo=mid+1;
   else hi=mid;
  }
  queue.splice(lo,0,card);queued.add(card.id);
 }
 let count=0,gems=0,promotions=0,best=null,preview;
 while(queue.length&&(!selected||count<pairs)){
  const source=queue.pop();queued.delete(source.id);
  const tier=difficulties.indexOf(source.row[6]),routes=plan(source.row);
  const promoted=routes.next.length>0&&random(100)<5,choices=promoted?routes.next:routes.near;
  const row=choices[random(choices.length)],dest=collection.get(row[0])||{id:row[0],row,copies:0,holoCopies:0};
  collection.set(dest.id,dest);
  const input={row:source.row,copies:source.copies,holoCopies:source.holoCopies,antimatterCopies:source.antimatterCopies};
  const result=fusePair(w,source,dest,promoted,tier,now);
  changed.set(source.id,source);changed.set(dest.id,dest);
  count++;gems+=result.gems;promotions+=Number(promoted);
  const key=row[0]+':'+result.finish,receipt=outcomes.get(key);
  if(receipt)receipt.count++;
  else outcomes.set(key,{row,finish:result.finish,holo:result.holo,count:1});
  const strength=best?compareMergeStrength(result.row,best.row,cardCategories):-1;
  if(strength<0||(strength===0&&finishOrder[result.finish]>finishOrder[best.finish])){
   best=result;preview=input;
  }
  enqueue(source);
  if(!selected)enqueue(dest);
 }
 if(!count)throw Error('There are no eligible duplicate pairs.');
 const highlights=[...outcomes.values()].sort((a,b)=>strongestMergeFirst(a,b)||finishOrder[b.finish]-finishOrder[a.finish]).slice(0,12);
 w.gems=(gemTenths(w.gems)+gemTenths(gems))/10;
 w.lastMerge={...best,gems,count,promotions,highlights};
 return {changed,preview};
}
