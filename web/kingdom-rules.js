export const housePrice=50_000;
export const houseSize={width:3.15,depth:2.72};
export const plotBounds={left:-12,right:12,back:-11,front:12};
export const towerPlot={x:-2.65,z:0};
export const trailCorners=[
 [-3.3,2.65],[-.8,4.2],[3.1,4.3],[6.5,2.1],[5.7,-2.7],
 [2.7,-4.3],[-3.4,-4.4],[-6.4,-1.2],[-6.1,1.3]
];
const trailClearance=.86;
export const kingdomVisitors=[
 {id:'gamer-vibes',name:'Gamer Vibes',channel:'Gamer_vibes-p1r',audience:'215',rarity:'Common',stars:.3,cube:'06'},
 {id:'jfrozy',name:'JFrozy Creator [GD]',channel:'JFrozyGD0',audience:'230',rarity:'Common',stars:.6,cube:'56'},
 {id:'unbreakable',name:'Unbreakable',channel:'unbreakable5205',audience:'983',rarity:'Uncommon',stars:1.5,cube:'39'},
 {id:'trqp-kun',name:'Trqp_kun',channel:'trqp_kun',audience:'1K',rarity:'Uncommon',stars:2.7,cube:'22'},
 {id:'wootdog',name:'Wootdog23',channel:'Wootdog23',audience:'4.7K',rarity:'Rare',stars:4.2,cube:'199'}
];
export const kingdomHouses=wallet=>wallet?.kingdom?.houses||[];
export function kingdomStats(houses){
 const stars=Math.min(50,houses.length*3)/10;
 return {stars,value:houses.length*housePrice,visitors:kingdomVisitors.filter(guest=>stars>=guest.stars)};
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

export function buildHouse(wallet,{x,z,rotation}){
 if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Choose a position on your plot.');
 const spot={x:Math.round(x*100)/100,z:Math.round(z*100)/100,rotation};
 const houses=kingdomHouses(wallet),problem=housePlacementError(houses,spot);
 if(problem)throw Error(problem);
 if(wallet.coins<housePrice)throw Error('You need 50,000 coins to build a GD House.');
 const house={id:crypto.randomUUID(),...spot};
 wallet.kingdom={houses:[...houses,house]};
 wallet.coins-=housePrice;
 return house;
}
