import {stopHouseSession,computerCost,computerUpgradeCost} from './kingdom-computer.js';
export {visitorSlots} from './kingdom-visitor-catalog.js';
import {kingdomForest,treeWithin} from './kingdom-forest.js';
import {achievementBoost} from './achievement-boosts.js';
import {changeCoins,coinPrice,previousCoinPrice} from './coin-economy.js';

import {gemTenths} from './card-economy.js';
import {awardPlayerXp} from './player-progression.js';
import {spikeInvestment,spikeKind,spikePlan,spikePrice} from './kingdom-defences.js';

export const housePrice=coinPrice(5_000);
export const houseSize={width:3.15,depth:2.72};
export const houseHeight=3.26,manorHeight=3.86;
export const houseEntry={front:1.16,width:1.24,height:1.43,floor:.164};
export const forgePrice=coinPrice(12_000),forgeWelcomeMana=100,forgeMinimum=5;
export const gemMine={towerLevel:2,coins:coinPrice(15_000),mana:800,interval:300_000,capacity:20};
export const visitorWelcomeMs=20_000;
export const houseUpgrades=[{mana:30,buildMs:10_000,stars:.02},
 {coins:coinPrice(100_000),mana:200,buildMs:30_000,stars:.03,towerLevel:2}];
const houseHp=[150,220,310];
export const houseStars=level=>(30+houseUpgrades.slice(0,level-1).reduce((sum,tier)=>sum+Math.round(tier.stars*100),0))/100;
export const forgeUpgrade={coins:coinPrice(100_000),mana:300,buildMs:30_000,towerLevel:2};
export const towerUpgradeMana=500;
const forgeTiers=[{rate:1,capacity:300},{rate:3,capacity:1200}];
export const manaIcon='/assets/kingdom/mana-orbs.webp';
export const campfireKind='campfire',campfirePrice=2500;
export const buildingSpecs={
 house:{name:'GD House',size:houseSize,height:houseHeight,price:housePrice},
 forge:{name:'The Mana Forge',size:{width:3.20,depth:3.20},height:3.65,price:forgePrice},
 'gem-mine':{name:'Gem Mine',size:{width:4.15,depth:3.60},height:3.55,price:gemMine.coins},
 [spikeKind]:{name:'Spike Shooter',size:{width:2.55,depth:2.65},height:1.86,price:spikePrice},
 [campfireKind]:{name:'Campfire',size:{width:1.65,depth:1.65},height:1.07,price:campfirePrice}
};
export const plotBounds={left:-14,right:14,back:-13,front:14};
export const lastLandLevel=5;
const landCost=level=>coinPrice(1_000_000*10**level);
export function kingdomBounds(level=0){
 const scale=Math.sqrt(1.25**level);
 return Object.fromEntries(Object.entries(plotBounds).map(([edge,point])=>[edge,point*scale]));
}
export const towerPlot={x:-2.65,z:0};
export const trailCorners=[
 [-3.3,2.65],[-.8,4.2],[3.1,4.3],[6.5,2.1],[5.7,-2.7],
 [2.7,-4.3],[-3.4,-4.4],[-6.4,-1.2],[-6.1,1.3]
];
export const maxTrailPoints=96;
export function kingdomTrail(wallet){
 const saved=wallet?.kingdom?.trail;
 return {points:saved?.points??trailCorners,closed:saved?.closed??true,follow:saved?.follow??true,custom:Boolean(saved?.points)};
}
export function updateKingdomTrail(wallet,{points,follow}){
 if(follow!==undefined&&typeof follow!=='boolean')throw Error('Choose whether residents follow the trail.');
 const kingdom=wallet.kingdom??={},trail={...kingdom.trail};
 if(points===null){delete trail.points;delete trail.closed;}
 else if(points!==undefined){
  const bounds=landPlan(wallet).bounds;
  if(!Array.isArray(points)||points.length<2||points.length>maxTrailPoints||
   points.some(point=>!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||
    !treeWithin({x:point[0],z:point[1]},bounds)))throw Error('Draw a trail on your plot.');
  const rounded=points.map(point=>point.map(value=>Math.round(value*100)/100));
  trail.points=rounded.filter(([x,z],i)=>!i||Math.hypot(x-rounded[i-1][0],z-rounded[i-1][1])>=.1);
  if(trail.points.length<2)throw Error('Draw a longer trail.');
  const [firstX,firstZ]=trail.points[0],[lastX,lastZ]=trail.points.at(-1);
  trail.closed=trail.points.length>3&&Math.hypot(firstX-lastX,firstZ-lastZ)<1;
  if(trail.closed&&Math.hypot(firstX-lastX,firstZ-lastZ)<.3)trail.points.pop();
 }
 if(follow!==undefined)trail.follow=follow;
 kingdom.trail=trail;
 return {trail:kingdomTrail(wallet)};
}
export const maxTowerLevel=3;
const towerTiers=[
 {limit:2,price:0,hp:1000},{limit:3,price:coinPrice(50_000),mana:towerUpgradeMana,buildMs:60_000,xp:150,hp:1500},
 {limit:4,price:coinPrice(100_000),mana:2_500,buildMs:180_000,xp:600,hp:2200},
 {limit:13,price:coinPrice(1_000_000),mana:towerUpgradeMana,hp:3000},{limit:17,price:coinPrice(7_500_000),mana:towerUpgradeMana,hp:4000}
];
export const towerExperience=level=>towerTiers[level-1]?.xp||0;
export const kingdomHouses=wallet=>wallet?.kingdom?.houses||[];
export const kingdomForges=wallet=>wallet?.kingdom?.forges||[];
export const kingdomDefences=wallet=>wallet?.kingdom?.defences||[];
const kingdomCampfires=wallet=>wallet?.kingdom?.campfires||[];
const kingdomGemMines=wallet=>wallet?.kingdom?.gemMines||[];
export const kingdomStorage=wallet=>wallet?.kingdom?.storage||[];
export const kingdomPhaseDuration=360_000;
export function kingdomDaylight(now){
 const phaseDuration=kingdomPhaseDuration;
 const cycle=now%(2*phaseDuration),night=cycle>=phaseDuration;
 const elapsed=cycle%phaseDuration;
 const edge=Math.min(1,elapsed/25_000,(phaseDuration-elapsed)/25_000);
 const light=edge*edge*(3-2*edge);
 const minutesPerDay=24*60;
 const minutes=(6*60+Math.floor(cycle*minutesPerDay/(2*phaseDuration)))%minutesPerDay;
 const time=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
 return {night,time,remaining:phaseDuration-elapsed,light:night?.44*(1-light):.44+.56*light};
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
 const {limit,hp}=towerTiers[level-1];
 return {level,limit,hp,defenceLimit:Math.min(level,maxTowerLevel),next:level<maxTowerLevel?towerTiers[level]:null,construction};
}
export function housePlan(house,now=Date.now()){
 const built=house.level===3?3:house.level===2?2:1;
 const site=house.upgrade,target=site?.level??2;
 const valid=site&&target===built+1&&houseUpgrades[built-1];
 const construction=valid&&now<site.endsAt?{...site,level:target}:null;
 const level=valid&&!construction?target:built;
 return {level,hp:houseHp[level-1],construction,next:houseUpgrades[level-1]??null};
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
export function kingdomRating(houses,now){
 return Math.min(500,houses.reduce((sum,house)=>sum+Math.round(houseStars(housePlan(house,now).level)*100),0))/100;
}
const towerInvestment=(kingdom,level)=>kingdom?.towerInvestment??towerTiers.slice(0,level).reduce((sum,tier)=>sum+previousCoinPrice(tier.price),0);
const landInvestment=(kingdom,level)=>kingdom?.landInvestment??Array.from({length:level},(_,i)=>previousCoinPrice(landCost(i))).reduce((sum,price)=>sum+price,0);
export function kingdomStats(wallet,now=Date.now()){
 const houses=kingdomHouses(wallet),forges=kingdomForges(wallet),gemMines=kingdomGemMines(wallet),defences=kingdomDefences(wallet),storage=kingdomStorage(wallet);
 const campfires=kingdomCampfires(wallet);
 const buildings=[...houses,...forges,...gemMines,...defences,...campfires],removedTrees=wallet?.kingdom?.removedTrees||[];
 const tower=towerPlan(wallet,now),land=landPlan(wallet);
 const houseLots=houses.length+storage.filter(item=>(item.kind||'house')==='house').length;
 const defenceLots=defences.length+storage.filter(item=>item.kind===spikeKind).length;
 const stars=kingdomRating(houses,now);
 const value=[...buildings,...storage].reduce((sum,building)=>{
  const kind=building.kind||'house';
  const base=building.price??previousCoinPrice(buildingSpecs[kind].price);
  const upgrade=kind===spikeKind?spikeInvestment(building):building.upgradeCoinInvestment??(
   (kind==='forge'&&(building.level===2||building.upgrade)?previousCoinPrice(forgeUpgrade.coins):0)+
   (kind==='house'&&(building.level===3||building.upgrade?.level===3)?previousCoinPrice(houseUpgrades[1].coins):0));
  const furniture=building.computer?computerCost.coins+(building.computer.level===2?computerUpgradeCost.coins:0):0;
  return sum+base+upgrade+furniture;
 },0)+towerInvestment(wallet?.kingdom,tower.construction?.level??tower.level)+landInvestment(wallet?.kingdom,land.level);
 return {houses,forges,gemMines,defences,campfires,storage,buildings,tower,land,stars,value,houseLots,defenceLots,removedTrees,trail:kingdomTrail(wallet),
  trees:plotTrees(buildings,removedTrees,land.bounds),mana:wallet?.kingdom?.mana||0,houseCost:housePrice*2**houseLots};
}

export function expandLand(wallet,expectedLevel){
 const {level,nextPrice}=landPlan(wallet);
 if(level!==expectedLevel)throw Error('Your land changed. Check the next expansion.');
 if(nextPrice===null)throw Error('Your land is fully expanded.');
 if(wallet.coins<nextPrice)throw Error('You need '+nextPrice.toLocaleString('en-US')+' coins to expand.');
 changeCoins(wallet,-nextPrice);
 wallet.kingdom={...wallet.kingdom,landLevel:level+1,landInvestment:landInvestment(wallet.kingdom,level)+nextPrice};
 return {level:level+1,price:nextPrice};
}

export function settleTower(wallet,now){
 const kingdom=wallet.kingdom,construction=kingdom?.towerConstruction;
 if(!construction||now<construction.endsAt)return null;
 delete kingdom.towerConstruction;
 const level=construction.level??2,tier=towerTiers[level-1];
 kingdom.towerLevel=level;
 const price=kingdom.towerInvestment===undefined?previousCoinPrice(tier.price):tier.price;
 return {level,limit:tier.limit,price,completed:true};
}

export function settleHouseUpgrades(wallet,now){
 const completed=[];
 for(const house of kingdomHouses(wallet)){
  if(!house.upgrade||now<house.upgrade.endsAt)continue;
  house.level=house.upgrade.level??2;
  delete house.upgrade;
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
export function settleKingdomConstruction(wallet,now){
 const tower=settleTower(wallet,now),houses=settleHouseUpgrades(wallet,now),forges=settleForgeUpgrades(wallet,now);
 const defences=[];
 for(const defence of kingdomDefences(wallet)){
  if(!defence.upgrade||now<defence.upgrade.endsAt)continue;
  defence.level=defence.upgrade.level;
  delete defence.upgrade;
  defences.push(defence.id);
 }
 if(tower)awardPlayerXp(wallet,towerExperience(tower.level));
 return {tower,houses,forges,defences};
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
 changeCoins(wallet,-coins);
 wallet.kingdom={...wallet.kingdom,mana:balance-mana};
}

export function upgradeTower(wallet,expectedLevel,now){
 const houses=kingdomHouses(wallet),{level,limit,next,construction}=towerPlan(wallet,now);
 if(construction)throw Error('Your tower upgrade is already under construction.');
 if(level!==expectedLevel)throw Error('Your tower level changed. Check its new upgrade.');
 if(!next)throw Error('Your tower is at its highest level.');
 if(houses.length<limit)throw Error('Fill the current house lots before upgrading.');
 payUpgrade(wallet,next.mana,next.price);
 wallet.kingdom.towerInvestment=towerInvestment(wallet.kingdom,level)+next.price;
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
 const {level,construction,next}=housePlan(house,now);
 if(construction)throw Error('This house is already under construction.');
 if(!next)throw Error('This house is at its highest level.');
 if(level!==expectedLevel)throw Error('Your house level changed. Check its new upgrade.');
 if(next.towerLevel&&towerPlan(wallet,now).level<next.towerLevel)throw Error('Requires Tower Level '+next.towerLevel+'.');
 payUpgrade(wallet,next.mana,next.coins);
 if(next.coins)house.upgradeCoinInvestment=next.coins;
 house.upgrade={level:level+1,startedAt:now,endsAt:now+next.buildMs};
 return {id,level:level+1,construction:house.upgrade};
}

export function buildingFootprint({x,z,rotation=0,kind='house'},margin=0){
 const {width,depth}=buildingSpecs[kind].size;
 const angle=rotation*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),w=width/2+margin,d=depth/2+margin;
 const dx=Math.abs(c)*w+Math.abs(s)*d,dz=Math.abs(s)*w+Math.abs(c)*d;
 return {x,z,c,s,w,d,left:x-dx,right:x+dx,back:z-dz,front:z+dz};
}
export function insideFootprint({x,z},box){
 if(box.c===undefined)return treeWithin({x,z},box);
 const dx=x-box.x,dz=z-box.z;
 return Math.abs(dx*box.c-dz*box.s)<=box.w&&Math.abs(dx*box.s+dz*box.c)<=box.d;
}
function projectsInto(a,b){
 const dx=b.x-a.x,dz=b.z-a.z;
 const aligned=Math.abs(a.c*b.c+a.s*b.s),cross=Math.abs(a.c*b.s-a.s*b.c);
 return Math.abs(dx*a.c-dz*a.s)<a.w+aligned*b.w+cross*b.d&&
  Math.abs(dx*a.s+dz*a.c)<a.d+cross*b.w+aligned*b.d;
}
export const towerFootprint={left:towerPlot.x-1.67,right:towerPlot.x+1.67,back:-1.67,front:1.92};
const towerArea={x:towerPlot.x,z:(towerFootprint.back+towerFootprint.front)/2,w:1.67,d:(towerFootprint.front-towerFootprint.back)/2,c:1,s:0};
const overlaps=(a,b)=>projectsInto(a,b)&&projectsInto(b,a);
export function plotTrees(buildings,removed=[],bounds=null){
 const gone=new Set(removed),footprints=buildings.map(building=>buildingFootprint(building,.14));
 return kingdomForest.filter(tree=>!gone.has(tree.id)&&(!bounds||treeWithin(tree,bounds))&&!footprints.some(box=>insideFootprint(tree,box)));
}

export function buildingPlacementError(buildings,proposal,bounds=plotBounds,trees=[]){
 const {x,z,rotation}=proposal;
 if(!Number.isFinite(x)||!Number.isFinite(z)||typeof rotation!=='number'||!Number.isInteger(rotation*2)||rotation<0||rotation>=4)return 'Choose a position on your plot.';
 const box=buildingFootprint(proposal,.02);
 if(box.left<bounds.left||box.right>bounds.right||box.back<bounds.back||box.front>bounds.front)return 'Keep the building inside your plot.';
 const space=buildingFootprint(proposal,.06);
 if(overlaps(space,towerArea)||buildings.some(building=>overlaps(space,buildingFootprint(building,.025))))return 'There’s already a building here.';
 if(trees.some(tree=>insideFootprint(tree,buildingFootprint(proposal,tree.radius+.03))))return 'Clear the tree before placing here.';
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
 changeCoins(wallet,-price);
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
export function buildCampfire(wallet,args,now){
 const plot=kingdomStats(wallet,now),building=buildAt(wallet,plot,args,campfireKind,campfirePrice);
 wallet.kingdom={...wallet.kingdom,campfires:[...plot.campfires,building]};
 return building;
}
export function buildSpikeShooter(wallet,args,now){
 const plot=kingdomStats(wallet,now);
 if(plot.defenceLots>=plot.tower.defenceLimit)throw Error('All your defence slots are claimed.');
 const building={...buildAt(wallet,plot,args,spikeKind,spikePrice),level:1};
 wallet.kingdom={...wallet.kingdom,defences:[...plot.defences,building]};
 return building;
}
export function upgradeSpikeShooter(wallet,id,expectedLevel,now){
 const defence=kingdomDefences(wallet).find(item=>item.id===id);
 if(!defence)throw Error('Choose one of your Spike Shooters.');
 const {level,construction,next}=spikePlan(defence,now);
 if(construction)throw Error('This Spike Shooter is already under construction.');
 if(!next)throw Error('This Spike Shooter is at its highest level.');
 if(level!==expectedLevel)throw Error('Your Spike Shooter level changed. Review its next upgrade.');
 if(towerPlan(wallet,now).level<next.towerLevel)throw Error('Requires Tower Level '+next.towerLevel+'.');
 payUpgrade(wallet,next.mana,next.coins);
 if(next.coins)defence.upgradeCoinInvestment=spikeInvestment(defence)+next.coins;
 defence.upgrade={level:level+1,startedAt:now,endsAt:now+next.buildMs};
 return {id,level:level+1,construction:defence.upgrade};
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
 forge.upgradeCoinInvestment=forgeUpgrade.coins;
 forge.upgrade={startedAt:now,endsAt:now+forgeUpgrade.buildMs};
 return {id,level:2,construction:forge.upgrade};
}
export function collectForge(wallet,id,now){
 const forges=kingdomForges(wallet),forge=forges.find(building=>building.id===id);
 if(!forge)throw Error('Choose one of your Mana Forges.');
 if(forge.upgrade&&now>=forge.upgrade.endsAt){
  Object.assign(forge,promoteForge(forge,forge.upgrade.endsAt));delete forge.upgrade;
 }
 const {stored,capacity}=forgePlan(forge,now);
 if(stored<forgeMinimum)throw Error('Collect when this forge has at least '+forgeMinimum+' mana.');
 forge.collectedAt=stored===capacity?now:(forge.collectedAt??now)+elapsedForgeSeconds(forge,now)*1000;
 delete forge.storedMana;
 const bonusBp=Math.round(achievementBoost(wallet,'mana')*100);
 const bonus=stored*bonusBp+(wallet.kingdom.achievementManaRemainder||0);
 if(bonus>0)wallet.kingdom.achievementManaRemainder=bonus%10_000;
 const earned=stored+Math.floor(bonus/10_000);
 wallet.kingdom.mana=(wallet.kingdom.mana||0)+earned;
 return {id,earned};
}

export function gemMineBuildError({tower,gemMines,storage}){
 if(tower.level<gemMine.towerLevel)return 'Requires Tower Level '+gemMine.towerLevel+'.';
 if(gemMines.length)return 'Your Kingdom already has a Gem Mine.';
 if(storage.some(item=>item.kind==='gem-mine'))return 'Place your Gem Mine back from storage.';
 return '';
}
export function buildGemMine(wallet,args,now){
 const plot=kingdomStats(wallet,now),problem=gemMineBuildError(plot);
 if(problem)throw Error(problem);
 if(plot.mana<gemMine.mana)throw Error('You need '+gemMine.mana+' Mana to build a Gem Mine.');
 const kind='gem-mine',mine={...buildAt(wallet,plot,args,kind,buildingSpecs[kind].price),collectedAt:now};
 wallet.kingdom={...wallet.kingdom,gemMines:[mine],mana:plot.mana-gemMine.mana};
 return mine;
}
export function gemMinePlan(mine,now=Date.now()){
 const {interval,capacity}=gemMine;
 const elapsed=Math.max(0,now-(mine.collectedAt??now))+(mine.productionMs||0);
 const stored=Math.min(capacity,(mine.storedGems||0)+Math.floor(elapsed/interval));
 return {stored,capacity,progress:stored===capacity?0:elapsed%interval};
}
export function collectGemMine(wallet,id,now){
 const mine=kingdomGemMines(wallet).find(building=>building.id===id);
 if(!mine)throw Error('Choose the Gem Mine on your plot.');
 const {stored:earned,progress}=gemMinePlan(mine,now);
 if(!earned)throw Error('Your Gem Mine is still producing its next gem.');
 const balance=gemTenths(wallet.gems)+earned*10;
 if(!Number.isSafeInteger(balance))throw Error('Your gem balance is full.');
 mine.collectedAt=now;
 mine.productionMs=progress;
 delete mine.storedGems;
 wallet.gems=balance/10;
 return {id,earned};
}

function buildingRecords(kingdom,kind){
 if(kind==='forge')return kingdom.forges??=[];
 if(kind==='gem-mine')return kingdom.gemMines??=[];
 if(kind===spikeKind)return kingdom.defences??=[];
 if(kind===campfireKind)return kingdom.campfires??=[];
 return kingdom.houses??=[];
}
export function storeKingdomBuilding(wallet,id,now){
 const plot=kingdomStats(wallet,now),item=plot.buildings.find(building=>building.id===id);
 if(!item)throw Error('Choose a building on your plot.');
 if(item.upgrade)throw Error('Finish construction before storing this building.');
 const kind=item.kind||'house';
 if(kind==='house'){stopHouseSession(item,now);delete item.resident;}
 const stored={...item,kind};
 if(kind==='forge')Object.assign(stored,{storedMana:forgeStored(item,now),collectedAt:now});
 if(kind==='gem-mine'){
  const plan=gemMinePlan(item,now);
  Object.assign(stored,{storedGems:plan.stored,productionMs:plan.progress,collectedAt:now});
 }
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
 if(mode==='restore'&&(kind==='forge'||kind==='gem-mine'))building.collectedAt=now;
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
