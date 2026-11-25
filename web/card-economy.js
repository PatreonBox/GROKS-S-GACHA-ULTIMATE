const statsFormat=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
export const stat=n=>statsFormat.format(Number(n)||0);
export {holoPercent} from './card-finishes.js';
import {impossibleTier,impossibleGems} from './impossible-cards.js';
export const bandFor=rank=>rank<=10?0:rank<=50?1:rank<=150?2:rank<=500?3:4;
export const bandNames=['#1–10','#11–50','#51–150','#151–500','#501+'];
export const stageNames=['Stage V','Stage IV','Stage III','Stage II','Stage I'];
export const rankOddsVersion=4;
const tablesByVersion=new Map();
const baseGodlyExtremeTickets=990000;
// A million difficulty tickets and a 1/15,000 target simplify to 200/(3 × Godly Extreme tickets).
const topTickets=200;

export function extremeStage(rank){
 const place=rank>0?rank:Infinity,band=bandFor(place),first=[1,11,51,151,501][band],last=[10,50,150,500][band];
 const within=last?(last-place)/(last-first):501/place;
 const strength=.84+.16*(4-band+.70*within)/4.70;
 return {name:stageNames[band],range:bandNames[band],strength};
}
function rankWeight(rank,last,version){
 const place=Math.max(0,Math.min(1,((rank||last)-1)/Math.max(1,last-1)));
 if(version===2)return 450000+Math.round(550000*Math.pow(place,.57));
 const base=410000+Math.round(590000*Math.pow(place,.60));
 if(version===3)return base;
 // Ease the first few dozen positions into the standard rank curve.
 return Math.round(base*(1-.79*Math.exp(-((rank||last)-1)/24)));
}
export function extremeTable(rows,version=rankOddsVersion){
 let cache=tablesByVersion.get(version);
 if(!cache){cache=new WeakMap();tablesByVersion.set(version,cache)}
 if(cache.has(rows))return cache.get(rows);
 const last=rows.reduce((n,r)=>Math.max(n,r[10]||0),1);
 const top=[],weighted=[],ends=[],bands=[0,0,0,0,0];
 let total=0;
 for(const row of rows){
  if(version>=4&&row[10]===1){top.push(row);continue}
  const weight=rankWeight(row[10],last,version);
  total+=weight;ends.push(total);weighted.push(row);bands[bandFor(row[10]||Infinity)]+=weight;
 }
 const table={weighted,top,ends,total,bands,last,version};cache.set(rows,table);return table;
}
function topShare(table,referenceTickets){
 if(!table.top.length)return 0;
 if(!table.total)return 1;
 return table.top.length*topTickets/(3*referenceTickets);
}
export function pickExtreme(rows,random,referenceTickets=baseGodlyExtremeTickets){
 const {weighted,top,ends,total}=extremeTable(rows);
 if(!weighted.length)return top[random(top.length)];
 if(top.length){
  const ticket=random(3*referenceTickets);
  if(ticket<top.length*topTickets)return top[Math.floor(ticket/topTickets)];
 }
 const ticket=random(total);
 let lo=0,hi=weighted.length-1;
 while(lo<hi){const mid=(lo+hi)>>>1;if(ticket<ends[mid])hi=mid;else lo=mid+1}
 return weighted[lo];
}
export function extremeOdds(rank,table,tierPercent,referenceTickets=baseGodlyExtremeTickets){
 const share=topShare(table,referenceTickets);
 if(table.version>=4&&rank===1)return table.top.length?tierPercent*share/table.top.length:0;
 return table.total?tierPercent*(1-share)*rankWeight(rank,table.last,table.version)/table.total:0;
}
export function extremeBandOdds(index,table,tierPercent,referenceTickets){
 const share=topShare(table,referenceTickets);
 return tierPercent*((index===0?share:0)+(table.total?(1-share)*table.bands[index]/table.total:0));
}
// The ledger uses tenths for every price and credit; balances stay compatible with existing saves.
export const gemTenths=amount=>Math.round(amount*10);
export const indexBaseTenths=[0,2,5,10,15,20,30,50,80,120,250];
export function levelRewardTenths(tier,rank,lastRank){
 if(tier===impossibleTier)return impossibleGems*10;
 if(tier!==10||!(rank>0)||!(lastRank>1))return indexBaseTenths[tier]??0;
 const standing=Math.max(0,Math.min(1,(lastRank-rank)/(lastRank-1)));
 return 250+Math.round(250*standing);
}
export const mergeGems=tier=>[1,1,2,2,3,4,6,8,11,15,22][tier];
const duration={Tiny:0,Short:1,Medium:2,Long:3,XL:4,Platformer:2};
// Listed placements take priority. Untied community ratings follow, then a stable game order.
export function compareChallenge(a,b){
 const rank=row=>row[6]==='Extreme Demon'||row[6]==='Impossible'?row[10]:row[12];
 const ra=rank(a),rb=rank(b);
 return ((ra||Infinity)-(rb||Infinity))||((b[11]??-1)-(a[11]??-1))||((duration[b[8]]??0)-(duration[a[8]]??0))||b[0]-a[0];
}
export function compareMergeStrength(a,b,diffs){
 const tier=diffs.indexOf(a[6]),other=diffs.indexOf(b[6]);
 return other-tier||(tier<6?b[7]-a[7]:0)||compareChallenge(a,b);
}

// A batch reuses sorted groups and promotion pools for every pair it processes.
export function createMergePlanner(pools,diffs){
 const groups=pools.map((rows,tier)=>{
  const byStars=new Map();
  for(const row of rows){
   const key=tier<6?row[7]:0;
   if(!byStars.has(key))byStars.set(key,[]);
   byStars.get(key).push(row);
  }
  return byStars;
 });
 const positions=new Map();
 groups.forEach(byStars=>byStars.forEach(group=>{
  group.sort(compareChallenge);
  group.forEach((row,index)=>positions.set(row[0],{group,index}));
 }));
 const promotions=pools.map(rows=>rows.toSorted((a,b)=>b[7]-a[7]||compareChallenge(a,b))
  .slice(-Math.max(5,Math.ceil(rows.length*.05))));
 const ranks=new Map();
 for(const row of pools[10]){
  if(!ranks.has(row[10]))ranks.set(row[10],[]);
  ranks.get(row[10]).push(row);
 }
 const cache=new Map();
 return row=>{
  if(cache.has(row[0]))return cache.get(row[0]);
  const tier=diffs.indexOf(row[6]),place=positions.get(row[0]);
  if(tier<0||!place)return {near:[],next:[],position:0};
  const {group,index}=place,rank=group[index][10];
  const near=tier===10?Array.from({length:5},(_,i)=>ranks.get(rank-5+i)||[]).flat()
   :group.slice(Math.max(0,index-5),index);
  const routes={near,next:promotions[tier+1]||[],position:tier===10?rank:index+1,total:group.length};
  cache.set(row[0],routes);
  return routes;
 };
}

const planners=new WeakMap();
export function mergeRoutes(row,pools,diffs){
 if(!planners.has(pools))planners.set(pools,createMergePlanner(pools,diffs));
 return planners.get(pools)(row);
}
