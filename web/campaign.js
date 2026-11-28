import {changeCoins} from './coin-economy.js';

const chapters=[
 {name:'RETRY',team:[4454123,26618473,11945914,6508283],captain:'ReTraY',first:60,master:30,turns:10,hp:.62,power:.52,charge:2},
 {name:'Fire in the Hole',team:[11940,215705,28255647,26949498],captain:'Spooky Light',first:150,master:60,turns:10,hp:.82,power:.76,shield:.18},
 {name:'Area confirmed',team:[28179535,20635816,28200611,27732941],captain:'OuterSpace',first:540,master:180,turns:11,hp:.90,power:.90,teamShield:.12},
 {name:'Rock on the Ground',team:[28225110,27483789,7485599,27448202],captain:'Magmatic Sanctuary',first:2_200,master:750,turns:11,hp:.96,power:.94,relay:2},
 {name:'Insane Classics',team:[11274262,3010126,1799065,12057578],captain:'Unity',first:7_200,master:2_000,turns:12,openCast:true},
 {name:'REVIVE MOON',team:[13519,55520,17235008,8660411],captain:'Death Moon',first:16_000,master:5_500,turns:12,shield:.2,allyShield:.14},
 {name:'C',team:[34085027,58270823,3264805,60887211],captain:'Ultra violence',first:45_000,master:15_000,turns:13,openCast:true,relay:2},
 {name:'eight circles',team:[6939821,40945673,44062068,4284013],captain:'Nine Circles',first:110_000,master:35_000,turns:13,teamShield:.18,power:1.08},
 {name:'Water Bound',team:[7054561,4957691,5155022,4706930],captain:'Supersonic',first:340_000,master:120_000,turns:14,shield:.28,charge:3,power:1.10},
 {name:'Tie in a chess',team:[10565740,42584142,149992717,86407629],captain:'Tidal Wave',firstClear:30_000_000_000,master:1_200_000,turns:14,hp:1.16,power:1.12,shield:.25,openCast:true}
];
// Each chapter keeps its original encounter and introduces two different squads.
// The last slot is always the captain and supplies the stage artwork.
const chapterEncounters=[
 [
  {name:'Dream Signal',team:[23356701,21923305,2867632,11280109],captain:'Dark Paradise'},
  {name:'Rage Quit',team:[3945967,10970301,13935609,110044659],captain:'Rage Quit'}
 ],
 [
  {name:'Through Time',team:[1244147,1512012,31280642,27319926],captain:'through time'},
  {name:'Infernal Arena',team:[8477262,26095850,26248615,18533341],captain:'Infernal Arena'}
 ],
 [
  {name:'Ghost Town',team:[150245,29424929,25886024,27973097],captain:'GhostTown'},
  {name:'Mind Control',team:[1629780,28794068,5131543,40638411],captain:'Mind Control'}
 ],
 [
  {name:'Payload',team:[37269362,29416734,28127292,29394058],captain:'Payload'},
  {name:'Scarlet Surge',team:[28677296,4243988,43908596,4259126],captain:'Scarlet Surge'}
 ],
 [
  {name:'Lunar Abyss',team:[41736289,11698380,1566116,28806662],captain:'Lunar Abyss'},
  {name:'The Beyond',team:[44121158,11398172,128453511,116116117],captain:'The Beyond'}
 ],
 [
  {name:'Laser Room',team:[3543219,5098465,5904109,1777565],captain:'Laser Room'},
  {name:'DeCode',team:[7116121,90475473,89886591,2997354],captain:'DeCode'}
 ],
 [
  {name:'Mechanical Showdown',team:[839175,18834999,13785846,27786218],captain:'Mechanical Showdown'},
  {name:'HeLL',team:[764038,21761387,14975695,25706351],captain:'HeLL'}
 ],
 [
  {name:'Temple Run',team:[14880818,1864168,2891681,11402965],captain:'Forest Temple'},
  {name:'After the Circles',team:[17013102,4192768,6300721,5310094],captain:'Fairydust'}
 ],
 [
  {name:'Magma Bound',team:[9145341,4545425,2241592,56568010],captain:'Magma Bound'},
  {name:'Duelo Maestro',team:[73725400,59626284,8491232,23298409],captain:'Duelo Maestro'}
 ],
 [
  {name:'Amethyst',team:[4125776,142896409,126242564,119550490],captain:'Amethyst'},
  // GrenadeOfTacos's section belongs to GRIEF, whose card supplies the boss and cover.
  {name:'Tacos',team:[148598469,119544028,127323087,149992717],captain:'GRIEF'}
 ]
];
const variants=[
 {variant:'Easy',hpScale:1,powerScale:1},
 {variant:'Medium',hpScale:1.14,powerScale:1.10},
 {variant:'Hard',hpScale:1.30,powerScale:1.22}
];
export const campaignStages=chapters.flatMap((chapter,index)=>{
 const tier=index+1;
 return [chapter,...chapterEncounters[index]].map((encounter,slot)=>{
  const {variant,hpScale,powerScale}=variants[slot];
  return {...chapter,...encounter,tier,variant,chapterName:chapter.name,
   // Original IDs 1–10 keep their chapter progress, clears and medals.
   id:tier+slot*chapters.length,number:index*variants.length+slot+1,
   hp:(chapter.hp??1)*hpScale,power:(chapter.power??1)*powerScale,
   turns:chapter.turns-slot};
 });
});
const stagesById=new Map(campaignStages.map(stage=>[stage.id,stage]));

// Keep each battle's original rates. Integer ratios avoid losing whole coins to rounding.
export const campaignRewardVersion=4;
const rewardScales={1:[1,1],2:[2,5],3:[13,25],4:[13,30]};
function scaledReward(coins,version=campaignRewardVersion){
 const [numerator,denominator]=rewardScales[version===true?1:version]||rewardScales[campaignRewardVersion];
 return coins*numerator/denominator;
}
const legacyFirstMultiplier=30,legacyRepeatMultiplier=2;
export const campaignFirstMultiplier=scaledReward(legacyFirstMultiplier);
export const campaignRepeatMultiplier=scaledReward(legacyRepeatMultiplier);
export const campaignFirstCoins=(stage,version)=>Math.floor(scaledReward(stage.firstClear??stage.first*legacyFirstMultiplier,version));
export const campaignMasterCoins=(stage,first,version)=>campaignBounty(stage.master,first,version);
export const campaignBounty=(bounty,first,version)=>Math.floor(scaledReward(bounty*(first?legacyFirstMultiplier:legacyRepeatMultiplier),version));
export const stageFor=id=>stagesById.get(Number(id));
export const medalCount=record=>record?1+Number(Boolean(record.tempo))+Number(Boolean(record.squad)):0;
export const stageCleared=(w,id)=>Boolean(w.campaign?.[id]);
export function stageUnlocked(w,id){
 const stage=stageFor(id);
 if(!stage)return false;
 if(stage.number===1||stageCleared(w,id)||stageCleared(w,campaignStages[stage.number-2].id))return true;
 // Saves from before the 30-stage campaign (v3) unlocked a chapter per clear.
 const priorChapter=w.campaign?.[stage.tier-1];
 return stage.variant==='Easy'&&Boolean(priorChapter)&&(priorChapter.firstVersion??1)<3;
}

export function stageRules(stage){
 const rules=[];
 if(stage.charge)rules.push('Start with '+stage.charge+' charge');
 if(stage.teamShield)rules.push('Rivals start with '+Math.round(stage.teamShield*100)+'% shields');
 if(stage.shield)rules.push('Captain starts with a '+Math.round(stage.shield*100)+'% shield');
 if(stage.allyShield)rules.push('Your squad starts with '+Math.round(stage.allyShield*100)+'% shields');
 if(stage.relay)rules.push('Relay recharges in '+stage.relay+' turns');
 if(stage.openCast)rules.push('Captain charges an attack on turn one');
 return rules;
}
export function configureCampaignBattle(b,stageId=b.tier){
 const stage=stageFor(stageId);
 b.campaign=stage.id;b.campaignRewardVersion=campaignRewardVersion;b.charge=stage.charge||b.charge;
 const bossIndex=b.enemies.length-1;
 if(stage.openCast)b.enemyTurn=bossIndex;
 for(const [i,u] of b.enemies.entries()){
  const captain=i===bossIndex;
  u.maxHp=Math.round(u.maxHp*(stage.hp||1)*(captain?1.24:1));
  u.hp=u.maxHp;
  u.attack=Math.round(u.attack*(stage.power||1)*(captain?1.14:1));
  const shield=(stage.teamShield||0)+(captain?(stage.shield||0):0);
  if(shield)u.shield=Math.round(u.maxHp*shield);
  if(captain)u.captain=true;
 }
 if(stage.allyShield)for(const u of b.allies)u.shield=Math.round(u.maxHp*stage.allyShield);
}
export function settleCampaignClear(w,b,survivors){
 const stage=stageFor(b.campaign);
 w.campaign??={};
 const prior=w.campaign[b.campaign];
 const version=b.campaignRewardVersion??1;
 const record={
  firstVersion:prior?(prior.firstVersion??1):version,
  turns:Math.min(b.seq,prior?.turns??Infinity),survivors:Math.max(survivors,prior?.survivors||0),
  tempo:Boolean(prior?.tempo||b.seq<=stage.turns),squad:Boolean(prior?.squad||survivors>=3)
 };
 const earnedMedals=medalCount(record)-medalCount(prior);
 const first=!prior,mastered=medalCount(record)===3&&medalCount(prior)<3;
 // Award the first-clear multiplier and any rounding remainder when the player wins.
 const bounties=b.enemies.reduce((total,unit)=>total+(unit.hp?0:unit.bounty),0);
 const bountyBonus=Math.max(0,campaignBounty(bounties,first,version)-b.earned);
 const clearPrize=first?campaignFirstCoins(stage,version):0;
 const masteryPrize=mastered?campaignMasterCoins(stage,first,version):0;
 record.clearPrize=first?clearPrize:prior.clearPrize??campaignFirstCoins(stage,record.firstVersion);
 if(masteryPrize)record.masteryPrize=masteryPrize;
 else if(prior?.masteryPrize!==undefined)record.masteryPrize=prior.masteryPrize;
 w.campaign[b.campaign]=record;
 const coins=changeCoins(w,clearPrize+masteryPrize+bountyBonus);
 b.earned+=coins;
 b.campaignReceipt={first,mastered,earnedMedals,coins,clearPrize,masteryPrize,bountyBonus,survivors,tempo:b.seq<=stage.turns,medals:medalCount(record)};
}
