import {gameCommand} from './game-client.js';
import {armyFrame,armySpeed,armyTacticsVersion,draftRivals,makeArmyBattle,stepArmy} from './army-battle.js';
import {seededRandom} from './game-replay.js';
import {payout} from './battle-engine.js';
import {difficulties} from './pack-engine.js';
import {gemTenths} from './card-economy.js';
import {seriesData} from './army-series-data.js';
import {changeCoins} from './coin-economy.js';
import {rewardDemonKeys} from './demon-keys.js';

export const armySignatureVersion=2;
export const armyChapters=[
 {name:'Vanguard',count:4,hp:.76,power:.64,coins:.72,bonus:1,gems:1},
 {name:'Siege Line',count:7,hp:.92,power:.86,coins:.92,bonus:2,gems:2},
 {name:'Last Stand',count:10,hp:1.06,power:1.03,coins:1.15,bonus:3,gems:4}
];

export function chapterCleared(wallet,tier,chapter){
 return Boolean((wallet?.armyTrilogy?.[tier]||0)&(1<<chapter));
}
export function chapterUnlocked(wallet,tier,chapter){
 return Boolean(armyChapters[chapter])&&(chapter===0||chapterCleared(wallet,tier,chapter-1));
}
export const chapterGems=(tier,chapter)=>armyChapters[chapter].gems*(1+Math.floor((tier-1)/2));
export const trilogyStageKeys=(tier,chapter)=>1+Math.floor(tier/3)+chapter;

const tactics={
 rush:{name:'Rush line',description:'Rivals close the gap faster.',apply:u=>{u.speed*=1.24}},
 ward:{name:'Shield line',description:'Rivals deploy with a shield.',apply:u=>{u.shield=Math.round(u.maxHp*.20)}},
 volley:{name:'Long range',description:'Ranged rivals fire from farther back.',apply:u=>{if(u.style==='Ranged')u.reach*=1.23}},
 burst:{name:'Quick casts',description:'Rivals ready their first signatures sooner.',apply:u=>{u.ready*=.60}},
 heavy:{name:'Heavy guard',description:'Rivals trade speed for extra health.',apply:u=>{u.maxHp=Math.round(u.maxHp*1.14);u.speed*=.85}},
 captain:{name:'Captain’s guard',description:'The captain starts with a large shield and an early signature.',apply:u=>{if(u.captain){u.shield=Math.round(u.maxHp*.31);u.ready*=.55}}}
};
const tacticCycle=Object.values(tactics);
const themed={apocalyptic:['rush','burst','captain'],technology:['volley','ward','burst'],rgb:['burst','heavy','volley'],
 'rgb-ii':['heavy','ward','volley'],riot:['ward','rush','captain'],atomic:['volley','burst','captain'],
 frostbite:['ward','volley','heavy'],ocular:['volley','rush','captain'],crazy:['rush','heavy','burst'],
 altergame:['ward','rush','volley'],dorabaebasic:['rush','volley','ward'],xyz:['volley','ward','rush']};
export const armySeries=seriesData.map(([key,name,group,map,backdrop,rows],index)=>{
 const stages=rows.map(([id,title,creator,difficulty,stars,length,rank,grade,note],i)=>{
  const tier=Math.max(1,difficulties.indexOf(difficulty));
  return {row:[id,title,creator,0,null,null,difficulty,stars,length,0,rank,grade],name:title,tier,note,
   count:armyChapters[i].count,tactic:tactics[themed[key]?.[i]]||tacticCycle[(index*5+i)%tacticCycle.length]};
 });
 return {key,name,group,map,backdrop,stages,tier:Math.max(...stages.map(s=>s.tier))};
});
const seriesByKey=new Map(armySeries.map(series=>[series.key,series]));
export const findArmySeries=key=>seriesByKey.get(key);
export const seriesCleared=(wallet,key,chapter)=>Boolean((wallet?.armySeries?.[key]||0)&(1<<chapter));
export const seriesUnlocked=(wallet,key,chapter)=>Boolean(findArmySeries(key)?.stages[chapter])&&
 (chapter===0||seriesCleared(wallet,key,chapter-1));
export function seriesFinaleReward(series,tacticsVersion=armyTacticsVersion){
 const tier=series.tier,foe=series.stages[2].row;
 const factor=tacticsVersion>=armyTacticsVersion?2.1:3;
 return {coins:Math.round(payout(tier,{rank:foe[10],rewardGrade:.70},()=>.5)*factor),gems:2+Math.floor(tier*1.4),demonKeys:2+Math.floor(tier/3)};
}

export function configureTrilogy(battle,chapter,seriesKey){
 const stage=armyChapters[chapter],foes=battle.teams[1];
 const feature=findArmySeries(seriesKey)?.stages[chapter];
 if(foes.length!==stage.count||(seriesKey&&(!feature||foes.at(-1).id!==feature.row[0]||battle.tier!==feature.tier)))throw Error('The rival squad could not be prepared.');
 battle.chapter=chapter;
 if(feature)battle.seriesKey=seriesKey;
 for(const unit of foes){
  const captain=(feature||chapter===2)&&unit.index===foes.length-1;
  unit.captain=captain;
  unit.maxHp=Math.round(unit.maxHp*stage.hp*(captain?1.13:1));
  unit.attack=Math.round(unit.attack*stage.power*(captain?1.10:1));
  feature?.tactic.apply(unit);
  unit.hp=unit.maxHp;
  const factor=feature&&battle.tacticsVersion>=armyTacticsVersion?.64+chapter*.04:1;
  unit.bounty=Math.max(1,Math.round(payout(battle.tier,unit,()=>.5)*stage.coins*factor));
 }
 return battle;
}

export function armyLoot(battle){
 const foes=battle.teams[1],stage=armyChapters[battle.chapter];
 const defeated=foes.filter(unit=>!unit.hp);
 const total=foes.reduce((sum,unit)=>sum+unit.bounty,0);
 const clearBonus=Math.round(total/foes.length*stage.bonus);
 return {defeated:defeated.length,total:total+clearBonus,
  earned:defeated.reduce((sum,unit)=>sum+unit.bounty,0)+(battle.status==='won'?clearBonus:0)};
}

export function grantArmyLoot(wallet,battle){
 const {tier,chapter,status,seriesKey}=battle,stage=armyChapters[chapter];
 const series=findArmySeries(seriesKey),named=series?.stages[chapter];
 const unlocked=seriesKey?named&&named.tier===tier&&named.row[0]===battle.teams[1].at(-1)?.id&&seriesUnlocked(wallet,seriesKey,chapter):chapterUnlocked(wallet,tier,chapter);
 if(!stage||tier<1||tier>10||!unlocked||battle.teams[1].length!==stage.count||
    !['won','lost','draw','retreated'].includes(status)||
    (status==='won'&&battle.teams[1].some(unit=>unit.hp)))throw Error('This Army result cannot be credited.');
 const {earned,defeated}=armyLoot(battle);
 const first=status==='won'&&!(seriesKey?seriesCleared(wallet,seriesKey,chapter):chapterCleared(wallet,tier,chapter));
 const seriesComplete=Boolean(first&&series&&chapter===2);
 const prize=seriesComplete?seriesFinaleReward(series,battle.tacticsVersion):{coins:0,gems:0,demonKeys:0};
 const coins=changeCoins(wallet,earned+prize.coins),gems=first?chapterGems(tier,chapter)+prize.gems:0;
 const demonKeys=first&&series?rewardDemonKeys(wallet,trilogyStageKeys(tier,chapter)+prize.demonKeys):0;
 wallet.gems=(gemTenths(wallet.gems)+gemTenths(gems))/10;
 if(first&&series){
  wallet.armySeries??={};
  wallet.armySeries[seriesKey]=(wallet.armySeries[seriesKey]||0)|(1<<chapter);
 }else if(first){
  wallet.armyTrilogy??={};
  wallet.armyTrilogy[tier]=(wallet.armyTrilogy[tier]||0)|(1<<chapter);
 }
 return {coins,gems,demonKeys,defeated,first,seriesComplete};
}


export const armyTrialIds = [6508283,4454123,11280109,26618473,11630859,2867632,21923305,11945914,1729,13935609];

export function armyRivals(rows,tier,chapter,series,illustrated) {
 const count = armyChapters[chapter].count;
 const featured = series?.stages[chapter].row;
 const random = seededRandom(tier*3691+chapter*7727+(featured?.[0]||351));
 const rank = featured?.[10];
 const band = tier!==10 ? rows : rank ? rows.slice().sort((a,b)=>Math.abs(a[10]-rank)-Math.abs(b[10]-rank)).slice(0,135)
  : rows.filter(row=>chapter===0?row[10]>150:chapter===1?row[10]>=26&&row[10]<=150:row[10]<51);
 const candidates = band.length>=count ? band : rows;
 const captain = featured || (chapter===2&&tier===10 ? candidates.find(row=>row[10]===1) : null);
 const linked = series ? series.stages.slice(0,chapter).filter(s=>s.tier===tier).map(s=>s.row) : [];
 const reserved = new Set([captain?.[0],...linked.map(row=>row[0])]);
 const eligible = candidates.filter(row=>!reserved.has(row[0]));
 const withArt = eligible.filter(row=>illustrated(row[0]));
 const slots = count-Number(Boolean(captain))-linked.length;
 const rivals = [...draftRivals(withArt.length>=slots ? withArt : eligible,slots,tier,random),...linked.map(row=>({row}))];
 if (captain) rivals.push({row:captain});
 if (rivals.length!==count) throw Error('The rival squad is incomplete.');
 return rivals;
}

export function beginArmyRun(run) {
 const previousMoves=(run.signatureVersion??1)<armySignatureVersion;
 const statsVersion=run.statsVersion??1;
 const tacticsVersion=run.tacticsVersion??1;
 const battle=configureTrilogy(makeArmyBattle(run.players,run.rivals,run.map,run.tier,seededRandom(run.seed),{previousMoves,statsVersion,tacticsVersion}),run.chapter,run.seriesKey);
 battle.id=run.id;
 battle.frames=0;
 return battle;
}

export function replayArmy(run,frames,withdrawn,now) {
 if(!Number.isInteger(frames)||frames<0||frames>10801||typeof withdrawn!=='boolean'||
    frames*armyFrame/armySpeed*1000>now-run.started+500)throw Error('This Army result cannot be verified.');
 const battle=beginArmyRun(run);
 for(let frame=0;frame<frames&&battle.status==='fighting';frame++)stepArmy(battle,armyFrame);
 if(withdrawn&&battle.status==='fighting')battle.status='retreated';
 if(battle.status==='fighting')throw Error('Finish the Army battle before claiming rewards.');
 return battle;
}

export async function startArmyBattle(args) {
 return (await gameCommand('army.begin',args,null)).result;
}
export async function settleArmyBattle(battle) {
 const {wallet,result} = await gameCommand('army.finish',{id:battle.id,frames:battle.frames,withdrawn:battle.status==='retreated'});
 return {wallet,receipt:result};
}
