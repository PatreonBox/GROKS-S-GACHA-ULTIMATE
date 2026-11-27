import {impossibleCategory} from './impossible-cards.js';

export const difficulties=Object.freeze(['Auto','Easy','Normal','Hard','Harder','Insane','Easy Demon','Medium Demon','Hard Demon','Insane Demon','Extreme Demon']);
const tierIndex=new Map(difficulties.map((category,index)=>[category,index]));
const steps=Object.freeze([
 {level:0,tier:4,rarity:1,name:'Harder'},
 {level:3,tier:6,rarity:2,name:'Easy Demon'},
 {level:6,tier:7,rarity:3,name:'Medium Demon'},
 {level:8,tier:8,rarity:3,name:'Hard Demon'},
 {level:10,tier:9,rarity:4,name:'Insane Demon'},
 {level:13,tier:10,rarity:7,name:'Extreme Demon',rankFloor:151},
 {level:15,tier:11,rarity:12,name:'Extreme Demon',fullList:true}
].map(Object.freeze));

export const dropUnlocks=steps.slice(1);
export const dropAccess=level=>steps.findLast(step=>level>=step.level)||steps[0];
export const nextDropAccess=level=>steps.find(step=>step.level>level);
export function dropEligible(row,access){
 if(row[6]===impossibleCategory)return access.fullList===true;
 const tier=tierIndex.get(row[6]);
 if(tier===undefined||tier>access.tier)return false;
 const rank=Number(row[10]);
 return tier!==10||!access.rankFloor||!(rank>0)||rank>=access.rankFloor;
}
export function dropAccessName(access){
 if(access.fullList)return 'Extreme Demon · full list';
 if(access.rankFloor)return 'Extreme Demon · ranks #'+access.rankFloor+'+';
 return access.name;
}
export function dropAccessSummary(level){
 const access=dropAccess(level),next=nextDropAccess(level);
 return 'Your rolls can reach '+dropAccessName(access)+(next?'. Level '+next.level+' unlocks '+dropAccessName(next):'')+'.';
}

export function proportionalWeights(weights,total){
 const source=weights.reduce((sum,weight)=>sum+weight,0);
 if(!source)return weights;
 let sum=0,prior=0,remaining=weights.filter(weight=>weight>0).length;
 return weights.map(weight=>{
  if(!weight)return 0;
  remaining--;sum+=weight;
  const next=Math.min(total-remaining,Math.max(prior+1,Math.round(sum*total/source)));
  const scaled=next-prior;prior=next;
  return scaled;
 });
}
