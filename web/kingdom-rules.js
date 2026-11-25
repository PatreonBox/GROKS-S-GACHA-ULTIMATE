export const housePrice=50_000;
export const houseSize={width:3.15,depth:2.72};
export const houseHeight=3.26;
export const plotBounds={left:-12,right:12,back:-11,front:12};
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
 {limit:2,price:0},{limit:6,price:200_000},{limit:9,price:1_500_000},
 {limit:13,price:10_000_000},{limit:17,price:75_000_000}
];
export const kingdomHouses=wallet=>wallet?.kingdom?.houses||[];
export function towerPlan(wallet){
 const saved=wallet?.kingdom?.towerLevel;
 const level=Number.isInteger(saved)&&saved>=1&&saved<=towerTiers.length?saved:1;
 return {level,limit:towerTiers[level-1].limit,next:towerTiers[level]};
}
export function kingdomStats(wallet){
 const houses=kingdomHouses(wallet),tower=towerPlan(wallet);
 const stars=Math.min(50,houses.length*3)/10;
 const value=houses.reduce((sum,house)=>sum+(house.price??housePrice),0)+
  towerTiers.slice(0,tower.level).reduce((sum,tier)=>sum+tier.price,0);
 return {houses,tower,stars,value,houseCost:housePrice*2**houses.length};
}

export function upgradeTower(wallet,expectedLevel){
 const houses=kingdomHouses(wallet),{level,limit,next}=towerPlan(wallet);
 if(level!==expectedLevel)throw Error('Your tower level changed. Check its new upgrade.');
 if(!next)throw Error('Your tower is at its highest level.');
 if(houses.length<limit)throw Error('Fill the current house lots before upgrading.');
 if(wallet.coins<next.price)throw Error('You need '+next.price.toLocaleString('en-US')+' coins to upgrade.');
 wallet.coins-=next.price;
 wallet.kingdom={...wallet.kingdom,towerLevel:level+1};
 return {level:level+1,limit:next.limit,price:next.price};
}

export function houseFootprint({x,z,rotation},margin=0){
 const wide=rotation%2===0;
 const halfWidth=(wide?houseSize.width:houseSize.depth)*.5+margin,halfDepth=(wide?houseSize.depth:houseSize.width)*.5+margin;
 return {left:x-halfWidth,right:x+halfWidth,back:z-halfDepth,front:z+halfDepth};
}
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.back<b.front&&a.front>b.back;
const towerFoot={left:towerPlot.x-1.67,right:towerPlot.x+1.67,back:-1.67,front:1.92};
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
export function housePlacementError(houses,proposal){
 const {x,z,rotation}=proposal;
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isInteger(rotation)||rotation<0||rotation>3)return 'Choose a position on your plot.';
 const box=houseFootprint(proposal,.06);
 if(box.left<plotBounds.left||box.right>plotBounds.right||box.back<plotBounds.back||box.front>plotBounds.front)return 'Keep the house inside your plot.';
 const space=houseFootprint(proposal,.22);
 if(overlaps(space,towerFoot)||houses.some(house=>overlaps(space,houseFootprint(house,.09))))return 'There’s already a building here.';
 if(crossesTrail(houseFootprint(proposal,trailClearance)))return 'Leave the walking trail clear.';
 return '';
}

export function buildHouse(wallet,{x,z,rotation,expectedPrice=housePrice}){
 if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Choose a position on your plot.');
 const spot={x:Math.round(x*100)/100,z:Math.round(z*100)/100,rotation};
 const {houses,tower,houseCost}=kingdomStats(wallet);
 if(houses.length>=tower.limit)throw Error(tower.next?'Upgrade your tower to open more house lots.':'All your house lots are full.');
 if(expectedPrice!==houseCost)throw Error('The house price changed. Check its new cost.');
 const problem=housePlacementError(houses,spot);
 if(problem)throw Error(problem);
 if(wallet.coins<houseCost)throw Error('You need '+houseCost.toLocaleString('en-US')+' coins to build a GD House.');
 const house={id:crypto.randomUUID(),...spot,price:houseCost};
 wallet.kingdom={...wallet.kingdom,houses:[...houses,house]};
 wallet.coins-=houseCost;
 return house;
}
