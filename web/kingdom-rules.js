import {kingdomForest,treeWithin} from './kingdom-forest.js';
import {gemTenths} from './card-economy.js';

export const housePrice=50_000;
export const houseSize={width:3.15,depth:2.72};
export const houseHeight=3.26;
export const houseEntry={front:1.16,width:1.24,height:1.43,floor:.164};
export const forgePrice=120_000,forgeWelcomeMana=100,forgeMinimum=5;
export const houseUpgrade={mana:30,buildMs:10_000,stars:.02};
export const forgeUpgrade={coins:1_000_000,mana:300,buildMs:30_000,towerLevel:2};
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
 {limit:2,price:0},{limit:3,price:500_000,mana:towerUpgradeMana,buildMs:60_000},
 {limit:9,price:4_000_000,mana:1_000,buildMs:180_000},
 {limit:13,price:10_000_000,mana:towerUpgradeMana},{limit:17,price:75_000_000,mana:towerUpgradeMana}
];
export const kingdomHouses=wallet=>wallet?.kingdom?.houses||[];
export const kingdomForges=wallet=>wallet?.kingdom?.forges||[];
export const kingdomStorage=wallet=>wallet?.kingdom?.storage||[];
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
 const schedule=kingdom?.towerConstruction;
 const target=schedule?.level??2;
 const valid=schedule&&target===built+1&&towerTiers[built];
 const construction=valid&&now<schedule.endsAt?{...schedule,level:target}:null;
 const level=valid&&!construction?target:built;
 return {level,limit:towerTiers[level-1].limit,next:towerTiers[level],construction};
}
export function housePlan(house,now=Date.now()){
 const construction=house.upgrade&&now<house.upgrade.endsAt?house.upgrade:null;
 return {level:house.level===2||house.upgrade&&!construction?2:1,construction};
}
function forgeStoredAt(forge,until,rate,capacity){
 return Math.min(capacity,(forge.storedMana||0)+elapsedForgeSeconds(forge,until)*rate);
}
export function forgePlan(forge,now=Date.now()){
 const construction=forge.level!==2&&forge.upgrade||null;
 if(construction&&now>=construction.endsAt){
  const upgraded=promoteForge(forge,construction.endsAt);
  return forgePlan(upgraded,now);
 }
 const level=forge.level===2?2:1,{rate,capacity}=forgeTiers[level-1];
 return {level,rate,capacity,stored:forgeStoredAt(forge,now,rate,capacity),construction};
}
function promoteForge(forge,at){
 const {rate,capacity}=forgeTiers[0];
 const upgraded={...forge,level:2,collectedAt:at,storedMana:forgeStoredAt(forge,at,rate,capacity)};
 delete upgraded.upgrade;
 return upgraded;
}
export function kingdomStats(wallet,now=Date.now()){
 const houses=kingdomHouses(wallet),forges=kingdomForges(wallet),storage=kingdomStorage(wallet);
 const buildings=[...houses,...forges],removedTrees=wallet?.kingdom?.removedTrees||[];
 const tower=towerPlan(wallet,now),land=landPlan(wallet);
 const houseLots=houses.length+storage.filter(item=>item.kind!=='forge').length;
 const upgraded=houses.filter(house=>housePlan(house,now).level===2).length;
 const stars=Math.min(500,houses.length*30+upgraded*Math.round(houseUpgrade.stars*100))/100;
 const value=[...buildings,...storage].reduce((sum,building)=>{
  const kind=building.kind||'house';
  return sum+(building.price??(kind==='house'?housePrice:forgePrice))+
   (kind==='forge'&&(building.level===2||building.upgrade)?forgeUpgrade.coins:0);
 },0)+towerTiers.slice(0,tower.level).reduce((sum,tier)=>sum+tier.price,0)+
  (tower.construction?tower.next.price:0)+Array.from({length:land.level},(_,i)=>landCost(i)).reduce((sum,price)=>sum+price,0);
 return {houses,forges,storage,buildings,tower,land,stars,value,houseLots,removedTrees,
  trees:plotTrees(buildings,removedTrees,land.bounds),mana:wallet?.kingdom?.mana||0,houseCost:housePrice*2**houseLots};
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
 const level=construction.level??2,tier=towerTiers[level-1];
 kingdom.towerLevel=level;
 return {level,limit:tier.limit,price:tier.price,completed:true};
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

export function settleForgeUpgrades(wallet,now){
 const completed=[];
 const forges=kingdomForges(wallet);
 for(let i=0;i<forges.length;i++){
  const forge=forges[i];
  if(!forge.upgrade||now<forge.upgrade.endsAt)continue;
  forges[i]=promoteForge(forge,forge.upgrade.endsAt);
  completed.push(forge.id);
 }
 return completed;
}

export const towerSkipCost=(site,now=Date.now())=>site?Math.max(0,Math.ceil((site.endsAt-now)/15_000)):0;
export function skipTower(wallet,maxGems,now){
 const site=wallet.kingdom?.towerConstruction,cost=towerSkipCost(site,now);
 if(!site||!cost)throw Error('There is no tower upgrade to finish.');
 if(!Number.isSafeInteger(maxGems)||cost>maxGems)throw Error('The skip price changed. Check the new quote.');
 if(gemTenths(wallet.gems)<cost*10)throw Error('You need '+cost+' gems to finish this tower.');
 wallet.gems=(gemTenths(wallet.gems)-cost*10)/10;
 site.endsAt=now;
 return {...settleTower(wallet,now),gems:cost};
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
 payUpgrade(wallet,next.mana,next.price);
 if(next.buildMs){
  const schedule={level:level+1,startedAt:now,endsAt:now+next.buildMs};
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
export function plotTrees(buildings,removed=[],bounds=null){
 const gone=new Set(removed),footprints=buildings.map(building=>buildingFootprint(building,.14));
 return kingdomForest.filter(tree=>!gone.has(tree.id)&&(!bounds||treeWithin(tree,bounds))&&!footprints.some(box=>treeWithin(tree,box)));
}

export function buildingPlacementError(buildings,proposal,bounds=plotBounds,trees=[]){
 const {x,z,rotation}=proposal;
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isInteger(rotation)||rotation<0||rotation>3)return 'Choose a position on your plot.';
 const box=buildingFootprint(proposal,.06);
 if(box.left<bounds.left||box.right>bounds.right||box.back<bounds.back||box.front>bounds.front)return 'Keep the building inside your plot.';
 const space=buildingFootprint(proposal,.22);
 if(overlaps(space,towerFootprint)||buildings.some(building=>overlaps(space,buildingFootprint(building,.09))))return 'There’s already a building here.';
 if(trees.some(tree=>treeWithin(tree,buildingFootprint(proposal,tree.radius+.10))))return 'Clear the tree before placing here.';
 if(crossesTrail(buildingFootprint(proposal,trailClearance)))return 'Leave the walking trail clear.';
 return '';
}
export const housePlacementError=(houses,proposal)=>buildingPlacementError(houses,proposal);

function buildAt(wallet,plot,args,kind,price){
 const {x,z,rotation,expectedPrice=price}=args;
 if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Choose a position on your plot.');
 const spot={x:Math.round(x*100)/100,z:Math.round(z*100)/100,rotation,kind};
 if(expectedPrice!==price)throw Error('The building price changed. Check its new cost.');
 const problem=buildingPlacementError(plot.buildings,spot,plot.land.bounds,plot.trees);
 if(problem)throw Error(problem);
 if(wallet.coins<price)throw Error('You need '+price.toLocaleString('en-US')+' coins to build.');
 wallet.coins-=price;
 return {id:crypto.randomUUID(),...spot,price};
}
export function buildHouse(wallet,args,now=Date.now()){
 const plot=kingdomStats(wallet,now),{houses,tower,houseCost,houseLots}=plot;
 if(houseLots>=tower.limit)throw Error(tower.construction?'New house lots open when tower construction finishes.':
  tower.next?'Upgrade your tower to open more house lots.':'All your house lots are full.');
 const house={...buildAt(wallet,plot,{...args,expectedPrice:args.expectedPrice??housePrice},'house',houseCost),builtAt:now};
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
 const {level,construction}=forgePlan(forge,now);
 if(construction)throw Error('This Mana Forge is already under construction.');
 if(level!==expectedLevel||level===2)throw Error('This Mana Forge is already Level 2.');
 if(towerPlan(wallet,now).level<forgeUpgrade.towerLevel)throw Error('Upgrade your tower to Level 2 first.');
 payUpgrade(wallet,forgeUpgrade.mana,forgeUpgrade.coins);
 forge.upgrade={startedAt:now,endsAt:now+forgeUpgrade.buildMs};
 return {id,level:2,construction:forge.upgrade};
}
export function collectForge(wallet,id,now){
 const forges=kingdomForges(wallet),forge=forges.find(building=>building.id===id);
 if(!forge)throw Error('Choose one of your Mana Forges.');
 if(forge.upgrade&&now>=forge.upgrade.endsAt){
  Object.assign(forge,promoteForge(forge,forge.upgrade.endsAt));delete forge.upgrade;
 }
 const {stored:earned,capacity}=forgePlan(forge,now);
 if(earned<forgeMinimum)throw Error('Collect when this forge has at least '+forgeMinimum+' mana.');
 forge.collectedAt=earned===capacity?now:(forge.collectedAt??now)+elapsedForgeSeconds(forge,now)*1000;
 delete forge.storedMana;
 wallet.kingdom.mana=(wallet.kingdom.mana||0)+earned;
 return {id,earned};
}


function buildingRecords(kingdom,kind){
 return kind==='forge'?(kingdom.forges??=[]):(kingdom.houses??=[]);
}
export function storeKingdomBuilding(wallet,id,now){
 const plot=kingdomStats(wallet,now),item=plot.buildings.find(building=>building.id===id);
 if(!item)throw Error('Choose a building on your plot.');
 if(item.upgrade)throw Error('Finish construction before storing this building.');
 const kind=item.kind||'house',stored={...item,kind};
 if(kind==='forge')Object.assign(stored,{storedMana:forgeStored(item,now),collectedAt:now});
 const kingdom=wallet.kingdom,records=buildingRecords(kingdom,kind);
 records.splice(records.indexOf(item),1);
 (kingdom.storage??=[]).push(stored);
 return {building:stored};
}

export function placeKingdomBuilding(wallet,args,now){
 const plot=kingdomStats(wallet,now),{id,mode,x,z,rotation}=args;
 if(!['move','restore'].includes(mode))throw Error('Choose how to place your building.');
 const source=mode==='move'?plot.buildings:plot.storage,item=source.find(building=>building.id===id);
 if(!item)throw Error('This building is no longer available.');
 if(item.upgrade)throw Error('Finish construction before moving this building.');
 const kind=item.kind||'house',spot={x:Math.round(x*100)/100,z:Math.round(z*100)/100,rotation,kind};
 if(typeof x!=='number'||typeof z!=='number')throw Error('Choose a position on your plot.');
 const problem=buildingPlacementError(plot.buildings.filter(entry=>entry.id!==id),spot,plot.land.bounds,plot.trees);
 if(problem)throw Error(problem);
 const building={...item,...spot};
 if(mode==='restore'&&kind==='forge')building.collectedAt=now;
 const kingdom=wallet.kingdom,records=buildingRecords(kingdom,kind);
 if(mode==='restore'){
  kingdom.storage=plot.storage.filter(entry=>entry.id!==id);
  records.push(building);
 }else records[records.indexOf(item)]=building;
 return {building};
}

export function clearKingdomTree(wallet,id,now){
 const plot=kingdomStats(wallet,now),tree=plot.trees.find(item=>item.id===id);
 if(!tree)throw Error('Choose a standing tree inside your plot.');
 if(plot.mana<tree.price)throw Error('You need '+tree.price+' Mana to clear this tree.');
 wallet.kingdom.mana=plot.mana-tree.price;
 wallet.kingdom.removedTrees=[...plot.removedTrees,id];
 return {id,mana:tree.price};
}
