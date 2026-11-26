import {cardGrowth} from './card-growth.js';
import {machineOwned,mineMachines,mineRate,mineSkills,settleMine,skillOwned} from './mine-economy.js';
import {forgePlan,housePlan,kingdomDefences,kingdomForges,kingdomHouses,kingdomStorage,landPlan,towerPlan} from './kingdom-rules.js';
import {spikeKind,spikePlan} from './kingdom-defences.js';
import {campaignStages,medalCount,stageCleared} from './campaign.js';
import {cubeCatalog,ownsCube} from './cube-catalog.js';
import {awardPlayerXp} from './player-progression.js';

export {achievementBoostLabels,achievementBoosts} from './achievement-boosts.js';
export const achievementVersion=2;
export const achievementXp={Easy:20,Normal:45,Hard:70,Harder:85,Insane:100,Demon:150};
const difficultyNames=Object.keys(achievementXp);
const boostPercents=[.1,.15,.2,.25,.35,.5];
const format=new Intl.NumberFormat('en-US');
const n=value=>format.format(value);
const plural=(count,singular,plural=singular+'s')=>count===1?singular:plural;

function achievement({id,group,name,stat,symbol,color,href,icon},boost,targets,describe,legacyStage=targets.length){
 const stages=targets.map(([goal,difficulty],i)=>({
  id:i+1===legacyStage?id:id+':'+(i+1),stage:i+1,goal,difficulty,xp:achievementXp[difficulty],
  boost:{key:boost,percent:boostPercents[difficultyNames.indexOf(difficulty)]},description:describe(goal)
 }));
 const last=stages.at(-1);
 return {id,group,name,stat,symbol,color,href,icon,stages,goal:last.goal,difficulty:last.difficulty,description:last.description};
}

const firstCards=[
 ['auto','Auto','Hands Off!','#f7dd78','Easy','Normal','Hard'],
 ['easy','Easy','First Steps','#7ecff5','Easy','Normal','Hard'],
 ['normal','Normal','Finding the Rhythm','#86e3ac','Easy','Normal','Hard'],
 ['hard','Hard','Certified Jumper','#f2bd71','Normal','Hard','Harder'],
 ['harder','Harder','One More Attempt','#f69879','Normal','Hard','Harder'],
 ['insane','Insane','Slightly Unhinged','#f18cb8','Normal','Hard','Harder'],
 ['demon-easy','Easy Demon','Hello, Demon','#c199ff','Hard','Harder','Insane'],
 ['demon-medium','Medium Demon','Halfway to Trouble','#ed92bd','Hard','Harder','Insane'],
 ['demon-hard','Hard Demon','No Easy Way Out','#ff897f','Harder','Insane','Demon'],
 ['demon-insane','Insane Demon','Against All Odds','#f494bf','Harder','Insane','Demon'],
 ['demon-extreme','Extreme Demon','Beyond the Red Line','#ffbd79','Insane','Demon','Demon']
];
const firstCardsByDifficulty=new Map(firstCards.map((row,i)=>[row[1],i]));
const achievementsForCards=firstCards.map(([face,difficulty,name,color,first,second,third],i)=>
 achievement({id:'card-'+face,group:'Cards',name,color,stat:'card'+i,icon:'/assets/faces/'+face+'.webp',href:'#gacha/index'},
  i<6?'mine':'battle',[[1,first],[4,second],[12,third]],goal=>goal===1?'Collect your first '+difficulty+' card.':
   'Discover '+n(goal)+' different '+difficulty+' cards.',1)
);

const tracks={
 Cards:{symbol:'pack',color:'#b3a1ff',href:'#gacha/index',boost:'mine'},
 Battle:{symbol:'battle',color:'#ffab9e',href:'#battle',boost:'battle'},
 Training:{symbol:'spark',color:'#81dfda',href:'#battle/training',boost:'battle'},
 Kingdom:{symbol:'tower',color:'#a1e5aa',href:'#kingdom',boost:'mana'},
 'Coin mine':{symbol:'mine',color:'#ffcc73',href:'#gacha/mine',boost:'mine'}
};
function track(group,id,name,stat,targets,describe,options={}){
 const defaults=tracks[group];
 return achievement({...defaults,id,group,name,stat,...options},options.boost||defaults.boost,targets,describe,options.legacyStage);
}
const mineRateGoal=goal=>'Reach '+n(goal)+' base coins per second from coin mine machines and skills.';
const battles=goal=>goal===1?'Win your first arena battle.':'Win '+n(goal)+' arena battles.';
const trilogies=goal=>goal===1?'Complete your first Army trilogy.':'Complete '+n(goal)+' different Army trilogies.';
const training=goal=>'Gain '+n(goal)+' training levels across your cards.';
const forgeGoals=goal=>goal===1?'Build a Mana Forge.':'Upgrade a Mana Forge to Level 2.';
const land=goal=>'Purchase '+n(goal)+' Kingdom '+plural(goal,'land expansion')+'.';

export const achievements=[
 ...achievementsForCards,
 track('Coin mine','mine-100','Pocket Change','mine',[[20,'Easy'],[50,'Easy'],[100,'Normal']],mineRateGoal),
 track('Coin mine','mine-10k','Clockwork Fortune','mine',[[500,'Normal'],[2500,'Normal'],[10000,'Hard']],mineRateGoal),
 track('Coin mine','mine-1m','Million a Second','mine',[[50000,'Hard'],[250000,'Harder'],[1000000,'Insane']],mineRateGoal),
 track('Battle','battle-first','First Victory','battle',[[1,'Easy'],[5,'Normal'],[10,'Normal']],battles,{legacyStage:1}),
 track('Battle','battle-20','Arena Regular','battle',[[15,'Hard'],[18,'Hard'],[20,'Harder']],battles),
 track('Battle','army-one','Three Acts','army',[[1,'Normal'],[2,'Hard']],trilogies,{legacyStage:1,href:'#battle/army',symbol:'guard'}),
 track('Battle','army-three','Commander of Three','army',[[3,'Harder'],[4,'Insane'],[5,'Insane']],trilogies,{legacyStage:1,href:'#battle/army',symbol:'crown'}),
 track('Training','training-25','Practice Pays','training',[[5,'Easy'],[15,'Normal'],[25,'Hard']],training),
 track('Training','training-100','Century of Practice','training',[[45,'Hard'],[75,'Harder'],[100,'Insane']],training),
 track('Kingdom','house-first','A Place to Call Home','houses',[[1,'Easy'],[2,'Normal'],[4,'Harder']],
  goal=>'Build '+n(goal)+' '+plural(goal,'house')+' in your Kingdom.',{legacyStage:1,symbol:'box'}),
 track('Kingdom','tower-3','Above the Treeline','tower',[[2,'Hard'],[3,'Insane']],goal=>'Finish upgrading your tower to Level '+goal+'.'),
 track('Kingdom','land-first','Room to Grow','land',[[1,'Normal'],[3,'Harder'],[5,'Demon']],land,{legacyStage:1,symbol:'grid'}),
 track('Battle','limbo','Green Means Go','limbo',[[50,'Normal'],[90,'Harder'],[100,'Demon']],
  goal=>goal===100?'Pick the green key after the LIMBO shuffle.':'Reach '+goal+'% in the LIMBO remix.',{href:'#battle/arcade',symbol:'aim'}),
 track('Cards','trade-first','A Fair Exchange','trades',[[1,'Normal'],[5,'Hard'],[15,'Harder']],
  goal=>'Complete '+n(goal)+' player '+plural(goal,'trade')+'.',{legacyStage:1,href:'#trading',symbol:'exchange'}),

 track('Cards','binder-milestones','Room in the Binder','unique',[[25,'Normal'],[125,'Hard'],[500,'Demon']],
  goal=>'Discover '+n(goal)+' different cards.',{symbol:'grid'}),
 track('Cards','demon-binder','Demon Index','demons',[[5,'Hard'],[30,'Harder'],[120,'Demon']],
  goal=>'Discover '+n(goal)+' different Demon cards.',{boost:'battle',symbol:'spark'}),
 track('Cards','holo-binder','Through the Foil','holos',[[1,'Normal'],[15,'Harder'],[60,'Insane']],
  goal=>'Find the Holo finish on '+n(goal)+' different '+plural(goal,'card')+'.',{symbol:'spark'}),
 track('Cards','antimatter-binder','Matter of Taste','antimatter',[[1,'Hard'],[5,'Insane'],[25,'Demon']],
  goal=>'Find the Antimatter finish on '+n(goal)+' different '+plural(goal,'card')+'.',{boost:'battle',symbol:'spark'}),
 track('Cards','index-claimed','A Gem of a Find','index',[[10,'Normal'],[100,'Harder'],[500,'Demon']],
  goal=>'Claim gem rewards from '+n(goal)+' different cards in the Card index.',{icon:'/assets/packs/gem.png'}),
 track('Cards','opened-packs','Seal Breaker','packs',[[10,'Normal'],[50,'Hard'],[250,'Insane']],
  goal=>'Open '+n(goal)+' packs.',{href:'#gacha'}),
 track('Cards','merged-pairs','Better Together','merges',[[3,'Normal'],[15,'Harder'],[60,'Demon']],
  goal=>'Merge '+n(goal)+' pairs of duplicate cards.',{href:'#gacha/merge',symbol:'grid'}),
 track('Cards','cube-wardrobe','A Different Look','cubes',[[3,'Normal'],[8,'Hard'],[16,'Insane']],
  goal=>'Own '+n(goal)+' different cubes.',{href:'#gacha/cubes',symbol:'box'}),

 track('Battle','campaign-clears','Road to the Crown','campaign',[[2,'Normal'],[6,'Harder'],[10,'Demon']],
  goal=>'Clear '+n(goal)+' of the '+campaignStages.length+' campaign stages.',{symbol:'crown'}),
 track('Battle','campaign-master','Three Stars Strong','masteries',[[1,'Normal'],[5,'Insane'],[10,'Demon']],
  goal=>'Earn all three medals on '+n(goal)+' campaign '+plural(goal,'stage')+'.',{icon:'/assets/gd-star.png'}),
 track('Battle','arcade-clears','Remix Royalty','remixes',[[1,'Normal'],[5,'Harder'],[12,'Demon']],
  goal=>'Reach 100% in '+n(goal)+' different featured arcade '+plural(goal,'level')+'.',{href:'#battle/arcade',symbol:'aim'}),
 track('Battle','demon-arena','Demon Rounds','demonWins',[[1,'Hard'],[15,'Insane'],[80,'Demon']],
  goal=>'Win '+n(goal)+' arena '+plural(goal,'battle')+' at Easy Demon difficulty or higher.'),
 track('Battle','arena-knockouts','Last One Standing','knockouts',[[20,'Normal'],[150,'Harder'],[600,'Insane']],
  goal=>'Knock out '+n(goal)+' enemies in arena battles.'),
 track('Battle','army-mastery','Field Marshal','army',[[6,'Harder'],[10,'Insane'],[15,'Demon']],
  trilogies,{href:'#battle/army',symbol:'guard'}),

 track('Training','trained-roster','Coaching Bench','trainedCards',[[3,'Normal'],[10,'Harder'],[25,'Insane']],
  goal=>'Train '+n(goal)+' different cards.'),
 track('Training','spike-focus','Point Taken','spike',[[5,'Normal'],[20,'Harder'],[40,'Demon']],
  goal=>'Reach Spike training Level '+goal+' on one card.'),
 track('Training','saw-focus','Saw It Coming','saw',[[5,'Normal'],[20,'Harder'],[40,'Demon']],
  goal=>'Reach Saw training Level '+goal+' on one card.'),
 track('Training','endurance-focus','Still Standing','endurance',[[5,'Normal'],[20,'Harder'],[40,'Demon']],
  goal=>'Reach Endurance training Level '+goal+' on one card.'),

 track('Coin mine','machine-count','Production Line','machines',[[12,'Easy'],[60,'Normal'],[175,'Harder']],
  goal=>'Own '+n(goal)+' coin mine machines.'),
 track('Coin mine','mine-skills','A Mind for Mining','skills',[[3,'Normal'],[12,'Hard'],[24,'Insane']],
  goal=>'Unlock '+n(goal)+' coin mine skills.'),
 track('Coin mine','mine-megaforge','Mint Condition','mine',[[10_000_000,'Insane'],[250_000_000,'Demon'],[1_000_000_000,'Demon']],
  mineRateGoal),
 track('Coin mine','mine-tap-count','Hands on the Job','taps',[[200,'Easy'],[1250,'Hard'],[6000,'Harder']],
  goal=>'Register '+n(goal)+' coin mine taps.'),

 track('Kingdom','forge-upgrade','Blue Flame','forgeLevel',[[1,'Normal'],[2,'Harder']],forgeGoals,{symbol:'spark'}),
 track('Kingdom','mana-collection','Reservoir Keeper','mana',[[250,'Normal'],[2500,'Harder'],[15000,'Insane']],
  goal=>'Collect '+n(goal)+' Mana from forges.',{symbol:'spark'}),
 track('Kingdom','tree-removal','Clear the Way','trees',[[3,'Normal'],[8,'Hard'],[16,'Harder']],
  goal=>'Clear '+n(goal)+' '+plural(goal,'tree')+' from your Kingdom.'),
 track('Kingdom','gem-prospecting','Buried Bright','gemMines',[[1,'Harder'],[2,'Insane'],[3,'Demon']],
  goal=>goal===1?'Build a Gem Mine.':goal===2?'Build a Gem Mine and collect your first gem.':'Collect 20 gems from your Gem Mine.',{icon:'/assets/packs/gem.png'}),
 track('Kingdom','gems-produced','Crystal Shift','minedGems',[[50,'Harder'],[175,'Insane'],[500,'Demon']],
  goal=>'Collect '+n(goal)+' gems from your Gem Mine.',{icon:'/assets/packs/gem.png'}),
 track('Kingdom','spike-upgrades','Keep off the Lawn','defenceLevel',[[2,'Normal'],[3,'Hard'],[4,'Insane']],
  goal=>'Upgrade a Spike Shooter to Level '+goal+'.',{symbol:'guard'}),
 track('Kingdom','house-upgrades','From Cottage to Manor','upgradedHomes',[[1,'Normal'],[3,'Hard'],[6,'Insane']],
  goal=>'Finish '+n(goal)+' '+plural(goal,'house upgrade')+'.',{symbol:'box'}),
 track('Kingdom','kingdom-visits','The Welcome Party','visitors',[[1,'Normal'],[2,'Harder'],[4,'Insane']],
  goal=>'Attract '+n(goal)+' different '+plural(goal,'visitor')+' to your Kingdom.')
];
const stagesById=new Map(achievements.flatMap(item=>item.stages.map(stage=>[stage.id,{...item,...stage,stageCount:item.stages.length}])));
export const achievementById=id=>stagesById.get(id);

export function trainingLevels(wallet){
 return Object.values(wallet.training||{}).reduce((count,card)=>{
  const drills=['spike','saw','endurance'].reduce((total,key)=>total+Math.max(0,Math.trunc(card[key]||0)),0);
  return count+cardGrowth(card).level-1+drills;
 },0);
}

function armyClears(wallet){
 return [...Object.values(wallet.armyTrilogy||{}),...Object.values(wallet.armySeries||{})].filter(mask=>(mask&7)===7).length;
}

export function achievementProgress(wallet,now=Date.now()){
 const progress=wallet.achievementProgress||{},kingdom=wallet.kingdom,storage=kingdomStorage(wallet);
 const homes=[...kingdomHouses(wallet),...storage.filter(building=>building.kind==='house')];
 const forges=[...kingdomForges(wallet),...storage.filter(building=>building.kind==='forge')];
 const defences=[...kingdomDefences(wallet),...storage.filter(building=>building.kind===spikeKind)];
 const training=Object.values(wallet.training||{});
 const campaign=campaignStages.map((_,i)=>wallet.campaign?.[i+1]);
 const gemMines=Boolean(kingdom?.gemMines?.length||storage.some(building=>building.kind==='gem-mine'));
 return {...progress,cardMask:progress.cardMask||0,mine:Math.max(progress.mine||0,mineRate(wallet.mine)),
  battle:progress.battle||0,army:armyClears(wallet),training:progress.training||0,
  houses:homes.length,tower:towerPlan(wallet,now).level,land:landPlan(wallet).level,
  limbo:wallet.limboKeysCleared?100:Math.min(99,wallet.remixBest?.[86084399]||0),trades:progress.trades||0,
  cubes:cubeCatalog.filter(cube=>ownsCube(wallet,cube.id)).length,
  campaign:campaignStages.filter((_,i)=>stageCleared(wallet,i+1)).length,
  masteries:campaign.filter(record=>medalCount(record)===3).length,
  remixes:Object.values(wallet.remixBest||{}).filter(score=>score===100).length,
  trainedCards:training.filter(card=>cardGrowth(card).level>1||['spike','saw','endurance'].some(key=>card[key]>0)).length,
  spike:Math.max(0,...training.map(card=>card.spike||0)),saw:Math.max(0,...training.map(card=>card.saw||0)),
  endurance:Math.max(0,...training.map(card=>card.endurance||0)),
  machines:mineMachines.reduce((total,machine)=>total+machineOwned(wallet.mine,machine.id),0),
  skills:mineSkills.filter(skill=>skillOwned(wallet.mine,skill.id)).length,
  forgeLevel:Math.max(0,...forges.map(forge=>forgePlan(forge,now).level)),
  defenceLevel:Math.max(0,...defences.map(defence=>spikePlan(defence,now).level)),
  trees:kingdom?.removedTrees?.length||0,
  gemMines:progress.minedGems>=20?3:progress.minedGems>0?2:Number(gemMines),
  upgradedHomes:homes.reduce((total,house)=>total+housePlan(house,now).level-1,0),
  visitors:Math.max(progress.visitors||0,wallet.discoveredVisitors?.length||0)};
}

export function achievementCount(definition,progress){
 if(!definition.stat.startsWith('card'))return progress[definition.stat]||0;
 const tier=Number(definition.stat.slice(4));
 return Math.max(progress.byDifficulty?.[tier]||0,Number(Boolean(progress.cardMask&(1<<tier))));
}

function updateCollection(state,records){
 const byDifficulty=Array(firstCards.length).fill(0);
 let unique=0,demons=0,holos=0,antimatter=0,index=0;
 for(const card of records){
  if(!Array.isArray(card?.row))continue;
  const difficulty=card.row[6],tier=firstCardsByDifficulty.get(difficulty);
  unique++;
  if(tier!==undefined){
   byDifficulty[tier]++;
   state.cardMask=(state.cardMask||0)|(1<<tier);
   if(tier>=6)demons++;
  }
  if(card.everHolo||card.holoCopies>0)holos++;
  if(card.everAntimatter||card.antimatterCopies>0)antimatter++;
  if(card.indexReward!==undefined)index++;
 }
 Object.assign(state,{byDifficulty,unique,demons,holos,antimatter,index});
}

export function updateAchievements(wallet,{records,changes,wins=0,traded=0,train=false,trained=0,events={},visitors}={},now=Date.now()){
 const state=wallet.achievementProgress??={};
 if(records){
  const owned=new Map(records.map(card=>[card.id,card]));
  for(const [id,card] of changes||[])owned.set(id,card);
  updateCollection(state,owned.values());
 }
 if(wins)state.battle=(state.battle||0)+wins;
 if(traded)state.trades=(state.trades||0)+traded;
 if(train)state.training=Math.max(state.training||0,trainingLevels(wallet));
 if(trained)state.training=(state.training||0)+trained;
 for(const [key,count] of Object.entries(events))if(count>0)state[key]=Math.min(Number.MAX_SAFE_INTEGER,(state[key]||0)+count);
 if(visitors>0)state.visitors=Math.max(state.visitors||0,visitors);
 state.mine=Math.max(state.mine||0,mineRate(wallet.mine));
 const progress=achievementProgress(wallet,now),earned=wallet.achievements??={},rewards=wallet.achievementRewards??={};
 const awarded=[];
 for(const item of achievements){
  const count=achievementCount(item,progress);
  let known=count;
  for(const stage of item.stages)if(Object.hasOwn(earned,stage.id))known=Math.max(known,stage.goal);
  for(const stage of item.stages){
   if(known<stage.goal)continue;
   earned[stage.id]??=now;
   if(!Object.hasOwn(rewards,stage.id))awarded.push(stage);
  }
 }
 if(!awarded.length)return awarded;
 // Settle time earned at the old rate before a new permanent income boost takes effect.
 if(awarded.some(stage=>stage.boost.key==='mine'))settleMine(wallet,now);
 const bonus=wallet.achievementBonusBp??={};
 let xp=0;
 for(const stage of awarded){
  rewards[stage.id]=now;
  bonus[stage.boost.key]=(bonus[stage.boost.key]||0)+Math.round(stage.boost.percent*100);
  xp+=stage.xp;
 }
 wallet.achievementRewardXp=(wallet.achievementRewardXp||0)+xp;
 awardPlayerXp(wallet,xp);
 return awarded;
}
