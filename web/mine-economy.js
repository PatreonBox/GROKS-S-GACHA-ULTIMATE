export const mineRateCap=10_000_000_000;
export const mineAwayLimit=5*60*60*1000;
export const mineLevelCap=200;
export const mineMilestone=25;

export const mineMachines=[
 {id:'cursor',name:'Auto Cursor',price:15,rate:1,color:'#8deef1',art:'/assets/mine/pointer.png',action:'Clicks the coin while you play.'},
 {id:'press',name:'Coin Press',plural:'Coin Presses',price:140,rate:12,color:'#ffca7e',art:'/assets/training/saw-1-9.webp',action:'Stamps fresh coins in the forge.',after:8},
 {id:'mint',name:'Mint Bot',price:3200,rate:130,color:'#bfa7ff',art:'/assets/cubes/217.webp',action:'Runs its own coin production line.',after:6},
 {id:'reactor',name:'Crystal Reactor',price:125000,rate:2900,color:'#7cf5c3',art:'/assets/battle/orbits/orb-2.webp',action:'Powers several presses at once.',after:6},
 {id:'foundry',name:'Demon Foundry',plural:'Demon Foundries',price:12500000,rate:150000,color:'#ff9091',art:'/assets/faces/demon-extreme.webp',action:'Mints massive batches around the clock.',after:6}
];

const tap='#ffdb82',auto='#87eff7',forge='#c7adff',core='#ffa3dd';
export const mineSkills=[
 {id:'pick',name:'Prospector’s Pick',x:49,y:7,icon:'mine',art:'gold-key',color:'#fff0ad',price:30,requires:['cursor',1],tap:1,description:'+1 coin per tap'},
 {id:'grip',name:'Weighted Tap',x:17,y:18,icon:'aim',color:tap,parents:['pick'],price:50,requires:['cursor',3],tap:4,description:'+4 coins per tap'},
 {id:'clockwork',name:'Clockwork',x:49,y:20,icon:'spark',color:auto,parents:['pick'],price:280,requires:['cursor',8],rate:25,description:'+25% passive income'},
 {id:'dies',name:'Reinforced Dies',x:83,y:18,icon:'guard',color:forge,parents:['pick'],price:4500,requires:['press',10],doubles:['press'],description:'2× Coin Press output'},
 {id:'hammer',name:'Forge Hammer',x:12,y:31,icon:'battle',color:tap,parents:['grip'],price:1750,requires:['press',5],tap:15,description:'+15 coins per tap'},
 {id:'quickstrike',name:'Quick Strike',x:32,y:32,icon:'right',color:tap,parents:['grip'],price:2200,requires:['cursor',15],tap:12,description:'+12 coins per tap'},
 {id:'shifts',name:'Extra Shift',x:52,y:34,icon:'downloads',color:auto,parents:['clockwork'],price:14000,requires:['mint',5],rate:50,description:'+50% passive income'},
 {id:'relay',name:'Relay Switch',x:70,y:30,icon:'spark',color:auto,parents:['clockwork','dies'],price:12000,requires:['press',15],rate:20,description:'+20% passive income'},
 {id:'network',name:'Mint Network',x:90,y:34,icon:'grid',color:forge,parents:['dies'],price:66000,requires:['mint',10],doubles:['mint'],description:'2× Mint Bot output'},
 {id:'diamond',name:'Diamond Pick',x:22,y:45,icon:'pack',color:tap,parents:['hammer'],price:95000,requires:['mint',8],tap:150,description:'+150 coins per tap'},
 {id:'overdrive',name:'Overdrive',x:50,y:47,icon:'flame',color:auto,parents:['shifts'],price:1800000,requires:['reactor',10],rate:125,description:'+125% passive income'},
 {id:'cooling',name:'Crystal Cooling',x:82,y:46,icon:'guard',color:forge,parents:['relay','network'],price:1150000,requires:['reactor',6],doubles:['reactor'],description:'2× Crystal Reactor output'},
 {id:'titan',name:'Titan Hammer',x:16,y:59,icon:'battle',color:tap,parents:['diamond','quickstrike'],price:3800000,requires:['reactor',10],tap:900,description:'+900 coins per tap'},
 {id:'swarm',name:'Cursor Swarm',x:37,y:61,icon:'aim',color:auto,parents:['quickstrike','shifts'],price:7800000,requires:['cursor',50],doubles:['cursor'],rate:40,description:'2× Auto Cursor output and +40% passive income'},
 {id:'nightshift',name:'Night Shift',x:58,y:60,icon:'spark',color:auto,parents:['overdrive'],price:29000000,requires:['foundry',8],rate:100,description:'+100% passive income'},
 {id:'prismdies',name:'Prism Dies',x:90,y:60,icon:'pack',color:forge,parents:['cooling'],price:36000000,requires:['foundry',12],doubles:['press','mint'],description:'2× Coin Press and Mint Bot output'},
 {id:'fusion',name:'Fusion Core',x:75,y:69,icon:'crown',art:'core',color:core,parents:['network','overdrive'],price:47500000,requires:['foundry',4],doubles:['reactor','foundry'],description:'2× Reactor and Foundry output'},
 {id:'pulsedriver',name:'Pulse Driver',x:21,y:76,icon:'flame',color:tap,parents:['titan','swarm'],price:105000000,requires:['reactor',25],tap:4000,description:'+4,000 coins per tap'},
 {id:'refraction',name:'Refraction',x:46,y:81,icon:'grid',color:auto,parents:['nightshift','fusion'],price:265000000,requires:['reactor',35],rate:150,description:'+150% passive income'},
 {id:'parallel',name:'Parallel Foundry',x:78,y:83,icon:'board',color:forge,parents:['fusion','prismdies'],price:475000000,requires:['foundry',25],doubles:['foundry'],description:'2× Demon Foundry output'},
 {id:'archive',name:'Golden Archive',x:49,y:93,icon:'crown',art:'gold-key',color:core,parents:['pulsedriver','refraction','parallel'],price:2500000000,requires:['foundry',45],tap:10000,rate:250,description:'+10,000 coins per tap and +250% passive income'}
];

const skillsById=new Map(mineSkills.map(node=>[node.id,node]));
export const mineSkill=id=>skillsById.get(id);
const byId=new Map(mineMachines.map((machine,i)=>[machine.id,{...machine,parent:mineMachines[i-1]}]));
export const machineOwned=(mine,id)=>mine?.machines?.[id]||0;
export const skillOwned=(mine,id)=>mine?.skills?.[id]===true;
const boughtSkills=mine=>mineSkills.filter(skill=>skillOwned(mine,skill.id));
export const mineTapPower=mine=>1+boughtSkills(mine).reduce((sum,skill)=>sum+(skill.tap||0),0);
const ownRequirement=(machine,count)=>'Own '+count+' '+(count===1?machine.name:machine.plural||machine.name+'s');

export function mineMachineRate(mine,id){
 const machine=byId.get(id);
 const count=machineOwned(mine,id);
 const doubles=boughtSkills(mine).filter(skill=>skill.doubles?.includes(id)).length;
 return machine.rate*count*2**(Math.floor(count/mineMilestone)+doubles);
}
export function mineRate(mine){
 if(!mine)return 0;
 const base=mineMachines.reduce((sum,machine)=>sum+mineMachineRate(mine,machine.id),0);
 const bonus=boughtSkills(mine).reduce((sum,skill)=>sum+(skill.rate||0),0);
 return Math.min(mineRateCap,Math.floor(base*(100+bonus)/100));
}
export function mineMachineLock(mine,id){
 const machine=byId.get(id);
 if(machine.parent&&machineOwned(mine,machine.parent.id)<machine.after)return ownRequirement(machine.parent,machine.after);
 return '';
}
export function mineSkillLock(mine,id){
 const skill=skillsById.get(id);
 const needed=skill.parents?.filter(parent=>!skillOwned(mine,parent)).map(parent=>skillsById.get(parent).name);
 if(needed?.length)return 'Unlock '+needed.join(' and ');
 const [machine,count]=skill.requires;
 if(machineOwned(mine,machine)<count)return ownRequirement(byId.get(machine),count);
 return '';
}

// Divide the elapsed time before multiplying to stay exact at the rate cap.
export function mineEarnings(wallet,now=Date.now()){
 const mine=wallet.mine;
 if(!mine?.collectedAt)return {coins:0,elapsed:0,remainder:0};
 const elapsed=Math.min(mineAwayLimit,Math.max(0,now-mine.collectedAt));
 const rate=mineRate(mine),partial=rate*(elapsed%1000)+(mine.remainder||0);
 const coins=Math.min(Number.MAX_SAFE_INTEGER-wallet.coins,rate*Math.floor(elapsed/1000)+Math.floor(partial/1000));
 return {coins,elapsed,remainder:partial%1000};
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
