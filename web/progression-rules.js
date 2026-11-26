import {cardGrowth} from './card-growth.js';
import {mineRate} from './mine-economy.js';
import {towerPlan} from './kingdom-rules.js';

const firstCards=[
 ['auto','Auto','Hands Off!','#f7dd78'],
 ['easy','Easy','First Steps','#7ecff5'],
 ['normal','Normal','Finding the Rhythm','#86e3ac'],
 ['hard','Hard','Certified Jumper','#f2bd71'],
 ['harder','Harder','One More Attempt','#f69879'],
 ['insane','Insane','Slightly Unhinged','#f18cb8'],
 ['demon-easy','Easy Demon','Hello, Demon','#c199ff'],
 ['demon-medium','Medium Demon','Halfway to Trouble','#ed92bd'],
 ['demon-hard','Hard Demon','No Easy Way Out','#ff897f'],
 ['demon-insane','Insane Demon','Against All Odds','#f494bf'],
 ['demon-extreme','Extreme Demon','Beyond the Red Line','#ffbd79']
];
const achievementsForCards=firstCards.map(([face,difficulty,name,color],i)=>({
 id:'card-'+face,group:'Cards',icon:'/assets/faces/'+face+'.webp',name,color,description:'Collect your first '+difficulty+' card.',goal:1,stat:'card'+i
}));
const achievement=(id,group,name,description,goal,stat,symbol,color,href)=>({id,group,name,description,goal,stat,symbol,color,href});
export const achievements=[
 ...achievementsForCards,
 achievement('mine-100','Coin mine','Pocket Change','Reach 100 coins per second in the coin mine.',100,'mine','mine','#9be2ab','#gacha/mine'),
 achievement('mine-10k','Coin mine','Clockwork Fortune','Reach 10,000 coins per second in the coin mine.',10000,'mine','mine','#79d9de','#gacha/mine'),
 achievement('mine-1m','Coin mine','Million a Second','Reach 1,000,000 coins per second in the coin mine.',1000000,'mine','mine','#ffcf6e','#gacha/mine'),
 achievement('battle-first','Battle','First Victory','Win your first arena battle.',1,'battle','battle','#ffa078','#battle'),
 achievement('battle-20','Battle','Arena Regular','Win 20 arena battles.',20,'battle','battle','#ffadbc','#battle'),
 achievement('army-one','Battle','Three Acts','Complete all three chapters of an Army trilogy.',1,'army','guard','#8ed9fb','#battle/army'),
 achievement('army-three','Battle','Commander of Three','Complete three different Army trilogies.',3,'army','crown','#d0acff','#battle/army'),
 achievement('training-25','Training','Practice Pays','Gain 25 training levels across your cards.',25,'training','spark','#84e4dd','#battle/training'),
 achievement('training-100','Training','Century of Practice','Gain 100 training levels across your cards.',100,'training','spark','#bfabff','#battle/training'),
 achievement('house-first','Kingdom','A Place to Call Home','Build your first house.',1,'houses','box','#8adbab','#kingdom'),
 achievement('tower-3','Kingdom','Above the Treeline','Finish upgrading your tower to Level 3.',3,'tower','tower','#ffcf8b','#kingdom'),
 achievement('land-first','Kingdom','Room to Grow','Buy your first land expansion.',1,'land','grid','#9be394','#kingdom'),
 achievement('limbo','Battle','Green Means Go','Pick the green key after the LIMBO shuffle.',1,'limbo','aim','#b1ed8a','#battle/arcade'),
 achievement('trade-first','Cards','A Fair Exchange','Complete your first player trade.',1,'trades','exchange','#92d2ff','#trading')
];
const allAchievements=new Map(achievements.map(item=>[item.id,item]));
export const achievementById=id=>allAchievements.get(id);

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
 const progress=wallet.achievementProgress||{},kingdom=wallet.kingdom;
 return {cardMask:progress.cardMask||0,mine:Math.max(progress.mine||0,mineRate(wallet.mine)),
  battle:progress.battle||0,army:armyClears(wallet),training:progress.training||0,
  houses:(kingdom?.houses?.length||0)+(kingdom?.storage?.filter(building=>building.kind==='house').length||0),
  tower:towerPlan(wallet,now).level,land:kingdom?.landLevel||0,limbo:Number(Boolean(wallet.limboKeysCleared)),trades:progress.trades||0};
}

export function achievementCount(definition,progress){
 return definition.stat.startsWith('card')?Number(Boolean(progress.cardMask&(1<<Number(definition.stat.slice(4))))):(progress[definition.stat]||0);
}

export function updateAchievements(wallet,{cards=[],wins=0,traded=0,train=false,trained=0}={},now=Date.now()){
 const state=wallet.achievementProgress??={};
 for(const card of cards){
  const difficulty=typeof card==='string'?card:card?.row?.[6],tier=firstCards.findIndex(item=>item[1]===difficulty);
  if(tier>=0)state.cardMask=(state.cardMask||0)|(1<<tier);
 }
 if(wins)state.battle=(state.battle||0)+wins;
 if(traded)state.trades=(state.trades||0)+traded;
 if(train)state.training=Math.max(state.training||0,trainingLevels(wallet));
 if(trained)state.training=(state.training||0)+trained;
 state.mine=Math.max(state.mine||0,mineRate(wallet.mine));
 const progress=achievementProgress(wallet,now),earned=wallet.achievements??={};
 for(const definition of achievements){
  if(!earned[definition.id]&&achievementCount(definition,progress)>=definition.goal)earned[definition.id]=now;
 }
}
