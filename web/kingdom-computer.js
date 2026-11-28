import {changeCoins} from './coin-economy.js';
import {equippedCube} from './cube-catalog.js';
import {visitorSlots} from './kingdom-visitor-catalog.js';

export const computerCost={coins:30_000,mana:60};
export const computerUpgradeCost={coins:45_000,mana:90};
export const roomCells=6;
const workPerStar=60_000*100;
const housesOf=wallet=>wallet?.kingdom?.houses??[];
const allHouses=wallet=>[...housesOf(wallet),...(wallet?.kingdom?.storage??[]).filter(b=>(b.kind||'house')==='house')];
export const computerHouse=wallet=>allHouses(wallet).find(house=>house.computer);
export const visitorResident=slot=>'visitor:'+slot;

function residentSlot(resident){
 return typeof resident==='string'&&resident.startsWith('visitor:')?
  visitorSlots.find(slot=>resident===visitorResident(slot.slot)):undefined;
}
export function residentBonus(resident){return residentSlot(resident)?.skillBonus??0}
function arrived(wallet,resident,now){
 if(resident==='cube')return true;
 const slot=residentSlot(resident);
 const at=slot&&wallet.kingdom?.visitorSchedule?.[slot.slot];
 return typeof at==='number'&&at<=now;
}
function houseOnPlot(wallet,id){
 const house=housesOf(wallet).find(item=>item.id===id);
 if(!house)throw Error('Choose a GD House on your plot.');
 return house;
}
function installed(house){
 if(!house.computer)throw Error('There is no computer in this house.');
 return house.computer;
}
function pay(wallet,cost){
 if(wallet.coins<cost.coins||wallet.kingdom.mana<cost.mana||wallet.kingdom.mana==null)
  throw Error('You need '+cost.coins.toLocaleString('en-US')+' coins and '+cost.mana+' Mana.');
 changeCoins(wallet,-cost.coins);
 wallet.kingdom.mana-=cost.mana;
}
function cellPosition(cell,rotation){
 if(!Number.isInteger(cell)||cell<0||cell>=roomCells||!Number.isInteger(rotation)||rotation<0||rotation>3)
  throw Error('Choose a cell and a quarter-turn on the house floor.');
 return {cell,rotation};
}
export const computerBuildMs=[10_000,20_000];
export const smashChance=.001;
export function repairCost(level){
 const cost=level===2?computerUpgradeCost:computerCost;
 return {coins:cost.coins/5,mana:cost.mana/5};
}
const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/2**32;
// Sampling the first successful minute once preserves the odds across reloads, pauses and offline play.
function newDamageClock(pc){
 pc.safeMs=(1+Math.floor(Math.log1p(-random())/Math.log1p(-smashChance)))*60_000;
}
const actorKey=(wallet,resident)=>resident==='cube'?'cube:'+equippedCube(wallet).id:resident;
const cool=(mood,now)=>Math.max(0,(mood?.value||0)-Math.max(0,now-(mood?.at??now))/18_000);
function sessionRage(pc,now){
 const seconds=Math.max(0,now-pc.sessionStart)/1000;
 const phase=(pc.sessionSeed||0)%23;
 const wave=t=>34+22*Math.sin(t/18+phase)+12*Math.sin(t/6+phase);
 return Math.round(Math.min(99,Math.max(0,wave(seconds)+(pc.startRage-wave(0))*Math.exp(-seconds/40))));
}
export function residentRage(wallet,resident,now=Date.now()){
 if(!resident)return 0;
 const key=actorKey(wallet,resident),house=computerHouse(wallet),pc=house?.computer;
 if(pc?.playing&&pc.actor===key&&Number.isFinite(pc.sessionStart)){
  const brokenAt=pc.since+pc.safeMs;
  if(now>=brokenAt)return Math.round(cool({value:100,at:brokenAt},now));
  return sessionRage(pc,now);
 }
 return Math.round(cool(wallet?.kingdom?.residentMoods?.[key],now));
}
function startSession(wallet,house,now){
 const pc=house.computer,key=actorKey(wallet,house.resident);
 pc.actor=key;pc.startRage=cool(wallet.kingdom.residentMoods?.[key],now);
 pc.sessionStart=now;pc.sessionSeed=Math.floor(random()*2**30);pc.playing=true;pc.since=now;
}
export function computerPlan(house,now=Date.now()){
 const pc=house?.computer;
 if(!pc)return null;
 const bonus=residentBonus(house.resident),base=pc.level===2?2:1,unitsPerMs=base*(100+bonus);
 const active=Boolean(house.resident&&pc.playing&&!pc.construction&&!pc.broken&&Number.isFinite(pc.since));
 const safe=pc.safeMs??Infinity,elapsed=active?Math.min(safe,Math.max(0,now-pc.since)):0;
 const playing=active&&elapsed<safe;
 const work=(pc.work||0)+elapsed*unitsPerMs;
 const remainder=work%workPerStar,stored=(pc.stored||0)+Math.floor(work/workPerStar);
 return {level:base,bonus,rate:unitsPerMs/100,playing,stored,remainder,progress:remainder/workPerStar,
  remainingMs:playing?Math.ceil((workPerStar-remainder)/unitsPerMs):null};
}
function bank(wallet,house,now){
 const pc=house.computer;
 const {stored,remainder}=computerPlan(house,now);
 if(pc.playing&&Number.isFinite(pc.safeMs)){
  const at=pc.since+pc.safeMs;
  pc.safeMs=Math.max(0,at-now);
  if(!pc.safeMs){
   const seed=Math.floor(random()*2**30);
   pc.broken={at,seed,damage:seed%2?'screen':'keyboard',resident:house.resident,actor:pc.actor,level:pc.level};
   (wallet.kingdom.residentMoods??={})[pc.actor]={value:100,at};
   pc.playing=false;
  }
 }
 Object.assign(pc,{stored,work:remainder,since:now});
}
export function stopHouseSession(house,now,wallet){
 if(!house.computer?.playing)return;
 bank(wallet,house,now);
 const pc=house.computer;
 if(pc.playing&&pc.actor)(wallet.kingdom.residentMoods??={})[pc.actor]={at:now,value:sessionRage(pc,now)};
 pc.playing=false;
}
export function settleHouseComputers(wallet,now){
 const changed=[];
 for(const house of housesOf(wallet)){
  const pc=house.computer;
  if(!pc)continue;
  if(!Number.isFinite(pc.safeMs)){
   bank(wallet,house,now);newDamageClock(pc);
   if(pc.playing&&house.resident)startSession(wallet,house,now);
   changed.push(house.id);
  }
  if(pc.construction?.endsAt<=now){
   pc.level=pc.construction.level;delete pc.construction;
   changed.push(house.id);
  }
  if(pc.playing&&pc.since+pc.safeMs<=now){bank(wallet,house,now);changed.push(house.id);}
 }
 return changed;
}
function ready(pc){
 if(pc.construction)throw Error('The builders are still working on this computer.');
 if(pc.broken)throw Error('Repair the damaged computer first.');
}
export function placeHouseComputer(wallet,{houseId,cell,rotation=0,sourceHouseId},now){
 const house=houseOnPlot(wallet,houseId),spot=cellPosition(cell,rotation);
 if(house.upgrade)throw Error('Finish the house upgrade before furnishing it.');
 const existing=computerHouse(wallet);
 if(sourceHouseId!==undefined){
  const source=houseOnPlot(wallet,sourceHouseId);
  if(!existing||existing!==source)throw Error('The computer moved. Reopen the house.');
  if(source.computer.construction)throw Error('Finish construction before moving the computer.');
  if(source!==house){
   if(house.computer)throw Error('This house already has a computer.');
   stopHouseSession(source,now,wallet);
   house.computer=source.computer;delete source.computer;
  }
  Object.assign(house.computer,spot);
 }else{
  if(existing)throw Error('Your Kingdom already owns its one computer.');
  pay(wallet,computerCost);
  house.computer={...spot,level:1,playing:false,since:now,work:0,stored:0,construction:{level:1,startedAt:now,endsAt:now+computerBuildMs[0]}};
  newDamageClock(house.computer);
 }
 return {houseId,cell,level:house.computer.level};
}
export function assignHouseResident(wallet,{houseId,resident},now){
 const house=houseOnPlot(wallet,houseId);
 if(resident!==null){
  if(!arrived(wallet,resident,now))throw Error('Choose a resident who has moved into your Kingdom.');
  if(allHouses(wallet).some(other=>other!==house&&other.resident===resident))
   throw Error('That resident is already assigned to a different house.');
 }
 if((house.resident??null)!==resident){
  stopHouseSession(house,now,wallet);
  if(resident===null)delete house.resident;else house.resident=resident;
 }
 return {houseId,resident};
}
export function enterHouse(wallet,{houseId,resident},now){
 const house=houseOnPlot(wallet,houseId);
 if(house.resident||allHouses(wallet).some(h=>h.resident===resident))return {houseId,resident:house.resident||null,claimed:false};
 if(!resident||!arrived(wallet,resident,now))throw Error('This resident is not in your Kingdom.');
 house.resident=resident;
 return {houseId,resident,claimed:true};
}
export function playHouseComputer(wallet,{houseId,playing,resident},now){
 const house=houseOnPlot(wallet,houseId),pc=installed(house);
 if(typeof playing!=='boolean')throw Error('Choose Play GD or Stop playing.');
 if(playing&&(!house.resident||house.resident!==resident||!arrived(wallet,resident,now)))
  throw Error('Assign an available resident to this house first.');
 if(playing){
  ready(pc);
  if(!pc.playing)startSession(wallet,house,now);
 }else stopHouseSession(house,now,wallet);
 return {houseId,playing};
}
export function upgradeHouseComputer(wallet,{houseId},now){
 const house=houseOnPlot(wallet,houseId),pc=installed(house);
 ready(pc);
 if(house.upgrade)throw Error('Finish the house upgrade before starting this one.');
 if(pc.level!==1)throw Error('This computer is already Level 2.');
 pay(wallet,computerUpgradeCost);stopHouseSession(house,now,wallet);
 pc.construction={level:2,startedAt:now,endsAt:now+computerBuildMs[1]};
 return {houseId,level:2};
}
export function repairHouseComputer(wallet,{houseId,at},now){
 const pc=installed(houseOnPlot(wallet,houseId));
 if(!pc.broken||pc.broken.at!==at)throw Error('This repair has already been handled. Reopen the computer.');
 pay(wallet,repairCost(pc.level));delete pc.broken;
 pc.since=now;pc.playing=false;newDamageClock(pc);
 return {houseId,level:pc.level};
}
export function collectHouseStars(wallet,{houseId},now){
 const house=houseOnPlot(wallet,houseId),pc=installed(house),earned=computerPlan(house,now).stored;
 if(!earned)throw Error('The next Star is still in progress.');
 const kingdom=wallet.kingdom,balance=(kingdom.stars||0)+earned,total=(kingdom.earnedStars||0)+earned;
 if(!Number.isSafeInteger(balance)||!Number.isSafeInteger(total))throw Error('The Star balance is full.');
 bank(wallet,house,now);pc.stored=0;kingdom.stars=balance;kingdom.earnedStars=total;
 return {houseId,earned};
}
