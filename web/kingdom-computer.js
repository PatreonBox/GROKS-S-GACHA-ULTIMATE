import {changeCoins} from './coin-economy.js';
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
export function computerPlan(house,now=Date.now()){
 const pc=house?.computer;
 if(!pc)return null;
 const bonus=residentBonus(house.resident),base=pc.level===2?2:1,unitsPerMs=base*(100+bonus);
 const playing=Boolean(house.resident&&pc.playing&&Number.isFinite(pc.since));
 const elapsed=playing?Math.max(0,now-pc.since):0;
 const work=(pc.work||0)+elapsed*unitsPerMs;
 const remainder=work%workPerStar,stored=(pc.stored||0)+Math.floor(work/workPerStar);
 return {level:base,bonus,rate:unitsPerMs/100,playing,stored,remainder,progress:remainder/workPerStar,
  remainingMs:playing?Math.ceil((workPerStar-remainder)/unitsPerMs):null};
}
function settle(house,now){
 if(!house.computer)return;
 const {stored,remainder}=computerPlan(house,now);
 Object.assign(house.computer,{stored,work:remainder,since:now});
}
export function stopHouseSession(house,now){
 if(!house.computer)return;
 settle(house,now);
 house.computer.playing=false;
}
export function placeHouseComputer(wallet,{houseId,cell,rotation=0,sourceHouseId},now){
 const house=houseOnPlot(wallet,houseId),spot=cellPosition(cell,rotation);
 if(house.upgrade)throw Error('Finish the house upgrade before furnishing it.');
 const existing=computerHouse(wallet);
 if(sourceHouseId!==undefined){
  const source=houseOnPlot(wallet,sourceHouseId);
  if(!existing||existing!==source)throw Error('The computer moved. Reopen the house.');
  if(source!==house){
   if(house.computer)throw Error('This house already has a computer.');
   stopHouseSession(source,now);
   house.computer=source.computer;delete source.computer;
  }
  Object.assign(house.computer,spot);
 }else{
  if(existing)throw Error('Your Kingdom already owns its one computer.');
  pay(wallet,computerCost);
  house.computer={...spot,level:1,playing:false,since:now,work:0,stored:0};
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
  stopHouseSession(house,now);
  if(resident===null)delete house.resident;else house.resident=resident;
 }
 return {houseId,resident};
}
export function playHouseComputer(wallet,{houseId,playing,resident},now){
 const house=houseOnPlot(wallet,houseId),pc=installed(house);
 if(typeof playing!=='boolean')throw Error('Choose Play GD or Stop playing.');
 if(playing&&(!house.resident||house.resident!==resident||!arrived(wallet,resident,now)))
  throw Error('Assign an available resident to this house first.');
 settle(house,now);pc.playing=playing;
 return {houseId,playing};
}
export function upgradeHouseComputer(wallet,{houseId},now){
 const house=houseOnPlot(wallet,houseId),pc=installed(house);
 if(pc.level!==1)throw Error('This computer is already Level 2.');
 pay(wallet,computerUpgradeCost);settle(house,now);pc.level=2;
 return {houseId,level:2};
}
export function collectHouseStars(wallet,{houseId},now){
 const house=houseOnPlot(wallet,houseId),pc=installed(house),earned=computerPlan(house,now).stored;
 if(!earned)throw Error('The next Star is still in progress.');
 const kingdom=wallet.kingdom,balance=(kingdom.stars||0)+earned,total=(kingdom.earnedStars||0)+earned;
 if(!Number.isSafeInteger(balance)||!Number.isSafeInteger(total))throw Error('The Star balance is full.');
 settle(house,now);pc.stored=0;kingdom.stars=balance;kingdom.earnedStars=total;
 return {houseId,earned};
}
