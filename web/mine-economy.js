import {achievementBoost} from './achievement-boosts.js';
import {coinDivisor} from './coin-economy.js';

export const mineRateCap=1_000_000_000;
export const mineAwayLimit=5*60*60*1000;
export const mineLevelCap=200;
export const mineMilestone=20;
export const mineTapBatch=24;

export const mineMachines=[
 {id:'cursor',name:'Auto Cursor',price:1.5,rate:0.1,color:'#8deef1',art:'/assets/mine/pointer.png',action:'Clicks the coin while you play.'},
 {id:'press',name:'Coin Press',plural:'Coin Presses',price:14,rate:1.2,color:'#ffca7e',art:'/assets/training/saw-1-9.webp',action:'Stamps fresh coins in the forge.',after:8},
 {id:'mint',name:'Shopkeeper',price:320,rate:13,color:'#bfa7ff',art:'/assets/mine/shopkeeper.webp',action:'More like a coin keeper instead! Get it?',after:6},
 {id:'reactor',name:'Crystal Reactor',price:12500,rate:290,color:'#7cf5c3',art:'/assets/mine/crystal-reactor.webp',action:'Powers several presses at once.',after:6},
 {id:'foundry',name:'Demon Foundry',plural:'Demon Foundries',price:1250000,rate:15000,color:'#ff9091',art:'/assets/faces/demon-extreme.webp',action:'Mints massive batches around the clock.',after:6}
];

const tap='#ffdb82',auto='#87eff7',forge='#c7adff',core='#ffa3dd';
const mineArt=name=>'/assets/mine/'+name+'.webp';
const icons={
 coin:'/assets/packs/coin.png',gem:'/assets/packs/gem.png',cursor:mineMachines[0].art,
 press:mineMachines[1].art,keeper:mineMachines[2].art,crystal:mineMachines[3].art,foundry:mineMachines[4].art,
 robot:mineArt('forge-robot'),wave:mineArt('quick-wave'),ship:mineArt('clockwork-ship'),
 orb:'/assets/battle/orbits/orb-2.webp',key:mineArt('gold-key'),core:mineArt('core')
};
export const mineSkills=[
 {id:'pick',name:'Prospector’s Pick',x:49,y:6,art:icons.coin,color:'#fff0ad',price:3,requires:['cursor',1],tap:0.1,description:'+0.1 coins per tap'},
 {id:'grip',name:'Weighted Tap',x:20,y:15,art:icons.cursor,color:tap,parents:['pick'],price:5,requires:['cursor',3],tap:0.4,description:'+0.4 coins per tap'},
 {id:'spring',name:'Spring Load',x:82,y:6,art:icons.wave,color:tap,parents:['pick'],price:14,requires:['cursor',4],tap:0.2,description:'+0.2 coins per tap'},
 {id:'clockwork',name:'Clockwork',x:49,y:15,art:icons.ship,color:auto,parents:['pick'],price:28,requires:['cursor',8],rate:25,description:'+25% passive income'},
 {id:'redial',name:'Turbo Cursor',x:34,y:15,art:icons.ship,color:auto,parents:['clockwork'],price:550,requires:['cursor',20],tap:0.8,rate:10,description:'+0.8 coins per tap and +10% passive income'},
 {id:'dies',name:'Reinforced Dies',x:82,y:15,art:icons.press,color:forge,parents:['pick'],price:450,requires:['press',10],doubles:['press'],description:'2× Coin Press output'},
 {id:'hammer',name:'Forge Hammer',x:13,y:27,art:icons.robot,color:tap,parents:['grip'],price:175,requires:['press',5],tap:1.5,description:'+1.5 coins per tap'},
 {id:'quickstrike',name:'Quick Strike',x:35,y:26,art:icons.wave,color:tap,parents:['grip'],price:220,requires:['cursor',15],tap:1.2,description:'+1.2 coins per tap'},
 {id:'shifts',name:'Extra Shift',x:53,y:28,art:icons.keeper,color:auto,parents:['clockwork'],price:1400,requires:['mint',5],rate:50,description:'+50% passive income'},
 {id:'relay',name:'Relay Switch',x:71,y:27,art:icons.orb,color:auto,parents:['clockwork','dies'],price:1200,requires:['press',15],rate:20,description:'+20% passive income'},
 {id:'network',name:'Mint Network',x:90,y:29,art:icons.keeper,color:forge,parents:['dies'],price:6600,requires:['mint',10],doubles:['mint'],description:'2× Shopkeeper output'},
 {id:'receipts',name:'Golden Receipts',x:66,y:39,art:icons.keeper,color:forge,parents:['network'],price:11000,requires:['mint',12],tap:4.5,rate:30,description:'+4.5 coins per tap and +30% passive income'},
 {id:'diamond',name:'Diamond Pick',x:24,y:40,art:icons.gem,color:tap,parents:['hammer'],price:9500,requires:['mint',8],tap:15,description:'+15 coins per tap'},
 {id:'overdrive',name:'Overdrive',x:50,y:41,art:icons.orb,color:auto,parents:['shifts'],price:180000,requires:['reactor',10],rate:125,description:'+125% passive income'},
 {id:'cooling',name:'Crystal Cooling',x:82,y:40,art:icons.crystal,color:forge,parents:['relay','network'],price:115000,requires:['reactor',6],doubles:['reactor'],description:'2× Crystal Reactor output'},
 {id:'resonance',name:'Crystal Resonance',x:72,y:49,art:icons.crystal,color:auto,parents:['cooling'],price:260000,requires:['reactor',12],tap:10,rate:35,description:'+10 coins per tap and +35% passive income'},
 {id:'titan',name:'Titan Hammer',x:17,y:50,art:icons.robot,color:tap,parents:['diamond','quickstrike'],price:380000,requires:['reactor',10],tap:90,description:'+90 coins per tap'},
 {id:'prismtap',name:'Prism Strike',x:11,y:60,art:icons.wave,color:tap,parents:['titan'],price:1150000,requires:['reactor',14],tap:35,description:'+35 coins per tap'},
 {id:'swarm',name:'Cursor Swarm',x:36,y:52,art:icons.cursor,color:auto,parents:['quickstrike','shifts'],price:780000,requires:['cursor',50],doubles:['cursor'],rate:40,description:'2× Auto Cursor output and +40% passive income'},
 {id:'nightshift',name:'Night Shift',x:56,y:53,art:icons.ship,color:auto,parents:['overdrive'],price:2900000,requires:['foundry',8],rate:100,description:'+100% passive income'},
 {id:'prismdies',name:'Prism Dies',x:89,y:52,art:icons.crystal,color:forge,parents:['cooling'],price:3600000,requires:['foundry',12],doubles:['press','mint'],description:'2× Coin Press and Shopkeeper output'},
 {id:'fusion',name:'Fusion Core',x:74,y:61,art:icons.core,color:core,parents:['network','overdrive'],price:4750000,requires:['foundry',4],doubles:['reactor','foundry'],description:'2× Reactor and Foundry output'},
 {id:'embercrew',name:'Ember Crew',x:89,y:63,art:icons.foundry,color:forge,parents:['fusion','prismdies'],price:16500000,requires:['foundry',18],rate:65,description:'+65% passive income'},
 {id:'pulsedriver',name:'Pulse Driver',x:22,y:69,art:icons.wave,color:tap,parents:['titan','swarm'],price:10500000,requires:['reactor',25],tap:400,description:'+400 coins per tap'},
 {id:'refraction',name:'Refraction',x:47,y:74,art:icons.crystal,color:auto,parents:['nightshift','fusion'],price:26500000,requires:['reactor',35],rate:150,description:'+150% passive income'},
 {id:'parallel',name:'Parallel Foundry',x:77,y:74,art:icons.foundry,color:forge,parents:['fusion','prismdies'],price:47500000,requires:['foundry',25],doubles:['foundry'],description:'2× Demon Foundry output'},
 {id:'archive',name:'Golden Archive',x:49,y:85,art:icons.key,color:core,parents:['pulsedriver','refraction','parallel'],price:250000000,requires:['foundry',45],tap:1000,rate:250,description:'+1,000 coins per tap and +250% passive income'},
 {id:'vaultseal',name:'Royal Reserve',x:49,y:95,art:icons.key,color:core,parents:['archive'],price:1200000000,requires:['foundry',60],tap:600,rate:200,description:'+600 coins per tap and +200% passive income'}
];

const skillsById=new Map(mineSkills.map(node=>[node.id,node]));
export const mineSkill=id=>skillsById.get(id);
const byId=new Map(mineMachines.map((machine,i)=>[machine.id,{...machine,parent:mineMachines[i-1]}]));
export const machineOwned=(mine,id)=>mine?.machines?.[id]||0;
export const skillOwned=(mine,id)=>mine?.skills?.[id]===true;
const boughtSkills=mine=>mineSkills.filter(skill=>skillOwned(mine,skill.id));
const tapTenths=mine=>1+boughtSkills(mine).reduce((sum,skill)=>sum+Math.round((skill.tap||0)*coinDivisor),0);
export const mineTapPower=mine=>tapTenths(mine)/coinDivisor;
export function creditMineTaps(wallet,count){
 const tenths=count*tapTenths(wallet.mine)+(wallet.coinTapRemainder||0);
 const coins=Math.min(Number.MAX_SAFE_INTEGER-wallet.coins,Math.floor(tenths/coinDivisor));
 wallet.coinTapRemainder=tenths%coinDivisor;
 wallet.coins+=coins;
 return coins;
}
const ownRequirement=(machine,count)=>'Own '+count+' '+(count===1?machine.name:machine.plural||machine.name+'s');

export function mineMachineRate(mine,id){
 const machine=byId.get(id);
 const count=machineOwned(mine,id);
 const doubles=boughtSkills(mine).filter(skill=>skill.doubles?.includes(id)).length;
 return machine.rate*count*2**(Math.floor(count/mineMilestone)+doubles);
}
export function mineRate(mine,boost=0){
 if(!mine)return 0;
 const baseTenths=mineMachines.reduce((sum,machine)=>sum+Math.round(mineMachineRate(mine,machine.id)*coinDivisor),0);
 const bonus=boughtSkills(mine).reduce((sum,skill)=>sum+(skill.rate||0),0);
 return Math.min(mineRateCap,Math.floor(baseTenths*(100+bonus)/100*(100+boost)/100)/coinDivisor);
}
export const mineWalletRate=wallet=>mineRate(wallet.mine,achievementBoost(wallet,'mine'));
export function mineMachineLock(mine,id){
 const machine=byId.get(id);
 if(machine.parent&&machineOwned(mine,machine.parent.id)<machine.after)return ownRequirement(machine.parent,machine.after);
 return '';
}
export function mineSkillRequirements(mine,id){
 const skill=skillsById.get(id), missing=[];
 const needed=skill.parents?.filter(parent=>!skillOwned(mine,parent)).map(parent=>skillsById.get(parent).name);
 if(needed?.length)missing.push('Unlock '+needed.join(' and '));
 const [machine,count]=skill.requires;
 if(machineOwned(mine,machine)<count)missing.push(ownRequirement(byId.get(machine),count));
 return missing;
}
export const mineSkillLock=(mine,id)=>mineSkillRequirements(mine,id)[0]||'';

// Divide the elapsed time before multiplying to stay exact at the rate cap.
export function mineEarnings(wallet,now=Date.now()){
 const mine=wallet.mine;
 if(!mine?.collectedAt)return {coins:0,elapsed:0,remainder:0};
 const elapsed=Math.min(mineAwayLimit,Math.max(0,now-mine.collectedAt));
 const rate=Math.round(mineWalletRate(wallet)*coinDivisor),seconds=Math.floor(elapsed/1000);
 const denominator=1000*coinDivisor;
 const partial=rate*(elapsed%1000)+(rate%coinDivisor)*seconds*1000+(mine.remainder||0);
 const whole=Math.floor(rate/coinDivisor)*seconds+Math.floor(partial/denominator);
 const coins=Math.min(Number.MAX_SAFE_INTEGER-wallet.coins,whole);
 return {coins,elapsed,remainder:partial%denominator};
}
export function settleMine(wallet,now=Date.now()){
 const receipt=mineEarnings(wallet,now);
 if(wallet.mine&&now>=(wallet.mine.collectedAt||0)){
  wallet.coins+=receipt.coins;
  wallet.mine.collectedAt=now;
  wallet.mine.remainder=receipt.remainder;
 }
 return receipt;
}
const mineState=(wallet,now)=>wallet.mine??={collectedAt:now,machines:{},skills:{},remainder:0};

export function quoteMachine(wallet,id,mode=1){
 const machine=byId.get(id),owned=machineOwned(wallet.mine,id);
 if(!machine||![1,10,'max'].includes(mode))return {count:0,cost:0,affordable:false};
 const limit=Math.min(mineLevelCap-owned,mode==='max'?mineLevelCap:mode);
 let count=0,cost=0;
 for(;count<limit;count++){
  const price=Math.ceil(machine.price*1.13**(owned+count));
  if(mode==='max'&&price>wallet.coins-cost)break;
  cost+=price;
 }
 return {count,cost,affordable:count>0&&cost<=wallet.coins};
}

export function buyMineMachine(wallet,id,mode,now=Date.now()){
 if(!byId.has(id))throw Error('Choose a mine machine.');
 const lock=mineMachineLock(wallet.mine,id);
 if(lock)throw Error(lock+' to unlock this machine.');
 const {count,cost,affordable}=quoteMachine(wallet,id,mode);
 if(!affordable)throw Error(machineOwned(wallet.mine,id)>=mineLevelCap?'This machine is at its limit.':'You need more coins.');
 const mine=mineState(wallet,now);
 mine.machines[id]=machineOwned(mine,id)+count;
 wallet.coins-=cost;
 return {count,cost};
}

export function buyMineSkill(wallet,id,now=Date.now()){
 const skill=skillsById.get(id);
 if(!skill)throw Error('Choose a mine skill.');
 if(skillOwned(wallet.mine,id))throw Error('You already unlocked '+skill.name+'.');
 const lock=mineSkillLock(wallet.mine,id);
 if(lock)throw Error(lock+' first.');
 if(wallet.coins<skill.price)throw Error('You need more coins.');
 const mine=mineState(wallet,now);
 mine.skills[id]=true;wallet.coins-=skill.price;
 return skill;
}
