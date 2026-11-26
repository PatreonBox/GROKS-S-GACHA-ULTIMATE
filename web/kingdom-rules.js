export const housePrice=50_000;
export const houseSize={width:3.15,depth:2.72};
export const houseHeight=3.26;
export const houseEntry={front:1.16,width:1.24,height:1.43,floor:.164};
export const forgePrice=120_000,forgeWelcomeMana=100,forgeMinimum=5;
export const houseUpgrade={mana:30,buildMs:10_000,stars:.02};
export const forgeUpgrade={coins:1_000_000,mana:300};
export const towerUpgradeMana=500;
const forgeTiers=[{rate:1,capacity:300},{rate:3,capacity:1200}];
export const manaIcon='/assets/kingdom/mana-orbs.webp';
export const buildingSpecs={
 house:{name:'GD House',size:houseSize,height:houseHeight},
 forge:{name:'The Mana Forge',size:{width:3.20,depth:3.20},height:3.65}
};
export const plotBounds={left:-14,right:14,back:-13,front:14};
export const lastLandLevel=5;
const landCost=level=>10_000_000*10**level;
export function kingdomBounds(level=0){
 const scale=Math.sqrt(1.25**level);
 return Object.fromEntries(Object.entries(plotBounds).map(([edge,point])=>[edge,point*scale]));
}
export const towerPlot={x:-2.65,z:0};
export const trailCorners=[
 [-3.3,2.65],[-.8,4.2],[3.1,4.3],[6.5,2.1],[5.7,-2.7],
 [2.7,-4.3],[-3.4,-4.4],[-6.4,-1.2],[-6.1,1.3]
];
const trailClearance=.86;
export const visitorSlots=[
 ['Common',.3],['Common',.6],['Uncommon',.9],['Uncommon',1.2],['Uncommon',1.5],
 ['Rare',1.8],['Rare',2.4],['Epic',3],['Epic',3.6],['Legendary',4.5]
].map(([rarity,stars],slot)=>({slot,rarity,stars}));
const towerTiers=[
 {limit:2,price:0},{limit:6,price:500_000,buildMs:60_000},{limit:9,price:1_500_000},
 {limit:13,price:10_000_000},{limit:17,price:75_000_000}
];
export const kingdomHouses=wallet=>wallet?.kingdom?.houses||[];
export const kingdomForges=wallet=>wallet?.kingdom?.forges||[];
const phaseDuration=360_000;
export function kingdomDaylight(now){
 const cycle=now%(2*phaseDuration),night=cycle>=phaseDuration;
 const elapsed=cycle%phaseDuration;
 const edge=Math.min(1,elapsed/25_000,(phaseDuration-elapsed)/25_000);
 const light=edge*edge*(3-2*edge);
 return {night,remaining:phaseDuration-elapsed,light:night?.44*(1-light):.44+.56*light};
}
export function landPlan(wallet){
 const saved=wallet?.kingdom?.landLevel;
 const level=Number.isInteger(saved)&&saved>0&&saved<=lastLandLevel?saved:0;
 return {level,bounds:kingdomBounds(level),size:1.25**level,nextPrice:level<lastLandLevel?landCost(level):null};
}
export function towerPlan(wallet,now=Date.now()){
 const kingdom=wallet?.kingdom,saved=kingdom?.towerLevel;
 const built=Number.isInteger(saved)&&saved>=1&&saved<=towerTiers.length?saved:1;
 const schedule=built===1?kingdom?.towerConstruction:null;
 const construction=schedule&&now<schedule.endsAt?schedule:null;
 const level=schedule&&!construction?2:built;
 return {level,limit:towerTiers[level-1].limit,next:towerTiers[level],construction};
}
export function housePlan(house,now=Date.now()){
 const construction=house.upgrade&&now<house.upgrade.endsAt?house.upgrade:null;
 return {level:house.level===2||house.upgrade&&!construction?2:1,construction};
}
export function forgePlan(forge,now=Date.now()){
 const level=forge.level===2?2:1,{rate,capacity}=forgeTiers[level-1];
 const stored=Math.min(capacity,(forge.storedMana||0)+elapsedForgeSeconds(forge,now)*rate);
 return {level,rate,capacity,stored};
}
export function kingdomStats(wallet,now=Date.now()){
 const houses=kingdomHouses(wallet),forges=kingdomForges(wallet),tower=towerPlan(wallet,now),land=landPlan(wallet);
 const upgraded=houses.filter(house=>housePlan(house,now).level===2).length;
 const stars=Math.min(500,houses.length*30+upgraded*Math.round(houseUpgrade.stars*100))/100;
 const value=houses.reduce((sum,house)=>sum+(house.price??housePrice),0)+
  towerTiers.slice(0,tower.level).reduce((sum,tier)=>sum+tier.price,0)+
  (tower.construction?tower.next.price:0)+forges.reduce((sum,forge)=>sum+forgePrice+(forge.level===2?forgeUpgrade.coins:0),0)+
  Array.from({length:land.level},(_,i)=>landCost(i)).reduce((sum,price)=>sum+price,0);
 return {houses,forges,buildings:[...houses,...forges],tower,land,stars,value,mana:wallet?.kingdom?.mana||0,houseCost:housePrice*2**houses.length};
}

export function expandLand(wallet,expectedLevel){
 const {level,nextPrice}=landPlan(wallet);
 if(level!==expectedLevel)throw Error('Your land changed. Check the next expansion.');
 if(nextPrice===null)throw Error('Your land is fully expanded.');
 if(wallet.coins<nextPrice)throw Error('You need '+nextPrice.toLocaleString('en-US')+' coins to expand.');
 wallet.coins-=nextPrice;
 wallet.kingdom={...wallet.kingdom,landLevel:level+1};
 return {level:level+1,price:nextPrice};
}

export function settleTower(wallet,now){
 const kingdom=wallet.kingdom,construction=kingdom?.towerConstruction;
 if(!construction||now<construction.endsAt)return null;
 delete kingdom.towerConstruction;
 kingdom.towerLevel=2;
 return {level:2,limit:towerTiers[1].limit,price:towerTiers[1].price,completed:true};
}

export function settleHouseUpgrades(wallet,now){
 const completed=[];
 for(const house of kingdomHouses(wallet)){
  if(!house.upgrade||now<house.upgrade.endsAt)continue;
  delete house.upgrade;
  house.level=2;
  completed.push(house.id);
 }
 return completed;
}

function payUpgrade(wallet,mana,coins=0){
 if(wallet.coins<coins)throw Error('You need '+coins.toLocaleString('en-US')+' coins to upgrade.');
 const balance=wallet.kingdom?.mana||0;
 if(balance<mana)throw Error('You need '+mana.toLocaleString('en-US')+' Mana to upgrade.');
 wallet.coins-=coins;
 wallet.kingdom={...wallet.kingdom,mana:balance-mana};
}

export function upgradeTower(wallet,expectedLevel,now){
 const houses=kingdomHouses(wallet),{level,limit,next,construction}=towerPlan(wallet,now);
 if(construction)throw Error('Your tower upgrade is already under construction.');
 if(level!==expectedLevel)throw Error('Your tower level changed. Check its new upgrade.');
 if(!next)throw Error('Your tower is at its highest level.');
 if(houses.length<limit)throw Error('Fill the current house lots before upgrading.');
 payUpgrade(wallet,towerUpgradeMana,next.price);
 if(next.buildMs){
  const schedule={startedAt:now,endsAt:now+next.buildMs};
  wallet.kingdom={...wallet.kingdom,towerConstruction:schedule};
  return {level:level+1,limit:next.limit,price:next.price,construction:schedule};
 }
 wallet.kingdom={...wallet.kingdom,towerLevel:level+1};
 return {level:level+1,limit:next.limit,price:next.price};
}

export function upgradeHouse(wallet,id,expectedLevel,now){
 const house=kingdomHouses(wallet).find(item=>item.id===id);
 if(!house)throw Error('Choose one of your houses.');
 const {level,construction}=housePlan(house,now);
 if(construction)throw Error('This house is already under construction.');
 if(level!==expectedLevel||level===2)throw Error('This house is already Level 2.');
 payUpgrade(wallet,houseUpgrade.mana);
 house.upgrade={startedAt:now,endsAt:now+houseUpgrade.buildMs};
 return {id,level:2,construction:house.upgrade};
}

export function buildingFootprint({x,z,rotation,kind='house'},margin=0){
 const {width,depth}=buildingSpecs[kind].size;
 const wide=rotation%2===0;
 const halfWidth=(wide?width:depth)*.5+margin,halfDepth=(wide?depth:width)*.5+margin;
 return {left:x-halfWidth,right:x+halfWidth,back:z-halfDepth,front:z+halfDepth};
}
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.back<b.front&&a.front>b.back;
export const towerFootprint={left:towerPlot.x-1.67,right:towerPlot.x+1.67,back:-1.67,front:1.92};
// Retain the trail for resident and visitor traffic.
function crossesTrail(box){
 for(let i=0;i<trailCorners.length;i++){
  const [x,z]=trailCorners[i],[nextX,nextZ]=trailCorners[(i+1)%trailCorners.length];
  for(let j=0;j<=8;j++){
   const a=x+(nextX-x)*j/8,b=z+(nextZ-z)*j/8;
   if(a>box.left&&a<box.right&&b>box.back&&b<box.front)return true;
  }
 }
 return false;
}
export function buildingPlacementError(buildings,proposal,bounds=plotBounds){
 const {x,z,rotation}=proposal;
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isInteger(rotation)||rotation<0||rotation>3)return 'Choose a position on your plot.';
 const box=buildingFootprint(proposal,.06);
 if(box.left<bounds.left||box.right>bounds.right||box.back<bounds.back||box.front>bounds.front)return 'Keep the building inside your plot.';
 const space=buildingFootprint(proposal,.22);
 if(overlaps(space,towerFootprint)||buildings.some(building=>overlaps(space,buildingFootprint(building,.09))))return 'There’s already a building here.';
 if(crossesTrail(buildingFootprint(proposal,trailClearance)))return 'Leave the walking trail clear.';
 return '';
}
export const housePlacementError=(houses,proposal)=>buildingPlacementError(houses,proposal);

function buildAt(wallet,plot,args,kind,price){
 const {x,z,rotation,expectedPrice=price}=args;
 if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Choose a position on your plot.');
 const spot={x:Math.round(x*100)/100,z:Math.round(z*100)/100,rotation,kind};
 if(expectedPrice!==price)throw Error('The building price changed. Check its new cost.');
 const problem=buildingPlacementError(plot.buildings,spot,plot.land.bounds);
 if(problem)throw Error(problem);
 if(wallet.coins<price)throw Error('You need '+price.toLocaleString('en-US')+' coins to build.');
 wallet.coins-=price;
 return {id:crypto.randomUUID(),...spot,price};
}
export function buildHouse(wallet,args,now=Date.now()){
 const plot=kingdomStats(wallet,now),{houses,tower,houseCost}=plot;
 if(houses.length>=tower.limit)throw Error(tower.construction?'New house lots open when tower construction finishes.':
  tower.next?'Upgrade your tower to open more house lots.':'All your house lots are full.');
 const house=buildAt(wallet,plot,{...args,expectedPrice:args.expectedPrice??housePrice},'house',houseCost);
 wallet.kingdom={...wallet.kingdom,houses:[...houses,house]};
 return house;
}
export function buildForge(wallet,args,now){
 const plot=kingdomStats(wallet,now),forge=buildAt(wallet,plot,args,'forge',forgePrice);
 forge.collectedAt=now;
 wallet.kingdom={...wallet.kingdom,forges:[...plot.forges,forge],mana:plot.mana+forgeWelcomeMana};
 return forge;
}
function elapsedForgeSeconds(forge,now){
 return Math.max(0,Math.floor((now-(forge.collectedAt??now))/1000));
}
export const forgeStored=(forge,now=Date.now())=>forgePlan(forge,now).stored;
export function upgradeForge(wallet,id,expectedLevel,now){
 const forge=kingdomForges(wallet).find(item=>item.id===id);
 if(!forge)throw Error('Choose one of your Mana Forges.');
 const {level,stored}=forgePlan(forge,now);
 if(level!==expectedLevel||level===2)throw Error('This Mana Forge is already Level 2.');
 payUpgrade(wallet,forgeUpgrade.mana,forgeUpgrade.coins);
 Object.assign(forge,{level:2,collectedAt:now,storedMana:stored});
 return {id,...forgePlan(forge,now)};
}
export function collectForge(wallet,id,now){
 const forges=kingdomForges(wallet),forge=forges.find(building=>building.id===id);
 if(!forge)throw Error('Choose one of your Mana Forges.');
 const {stored:earned,capacity}=forgePlan(forge,now);
 if(earned<forgeMinimum)throw Error('Collect when this forge has at least '+forgeMinimum+' mana.');
 forge.collectedAt=earned===capacity?now:(forge.collectedAt??now)+elapsedForgeSeconds(forge,now)*1000;
 delete forge.storedMana;
 wallet.kingdom.mana=(wallet.kingdom.mana||0)+earned;
 return {id,earned};
}
