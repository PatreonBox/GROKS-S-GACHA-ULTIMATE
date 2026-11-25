export const campaignStages=[
 {name:'RETRY',team:[4454123,26618473,11945914,6508283],captain:'ReTraY',first:600,master:300,turns:10,hp:.62,power:.52,charge:2},
 {name:'Fire in the Hole',team:[11940,215705,28255647,26949498],captain:'Spooky Light',first:1500,master:600,turns:10,hp:.82,power:.76,shield:.18},
 {name:'Area confirmed',team:[28179535,20635816,28200611,27732941],captain:'OuterSpace',first:5400,master:1800,turns:11,hp:.90,power:.90,teamShield:.12},
 {name:'Rock on the Ground',team:[28225110,27483789,7485599,27448202],captain:'Magmatic Sanctuary',first:22000,master:7500,turns:11,hp:.96,power:.94,relay:2},
 {name:'Insane Classics',team:[11274262,3010126,1799065,12057578],captain:'Unity',first:72000,master:20000,turns:12,openCast:true},
 {name:'REVIVE MOON',team:[13519,55520,17235008,8660411],captain:'Death Moon',first:160000,master:55000,turns:12,shield:.2,allyShield:.14},
 {name:'C',team:[34085027,58270823,3264805,60887211],captain:'Ultra violence',first:450000,master:150000,turns:13,openCast:true,relay:2},
 {name:'eight circles',team:[6939821,40945673,44062068,4284013],captain:'Nine Circles',first:1100000,master:350000,turns:13,teamShield:.18,power:1.08},
 {name:'Water Bound',team:[7054561,4957691,5155022,4706930],captain:'Supersonic',first:3400000,master:1200000,turns:14,shield:.28,charge:3,power:1.10},
 {name:'Tie in a chess',team:[10565740,42584142,86407629,149992717],captain:'GRIEF',firstClear:300_000_000_000,master:12000000,turns:14,hp:1.16,power:1.12,shield:.25,openCast:true}
];
export const campaignFirstMultiplier=30;
export const campaignRepeatMultiplier=2;
export const campaignFirstCoins=stage=>stage.firstClear??stage.first*campaignFirstMultiplier;
export const campaignMasterCoins=(stage,first)=>stage.master*(first?campaignFirstMultiplier:campaignRepeatMultiplier);
export const stageFor=tier=>campaignStages[tier-1];
export const medalCount=record=>record?1+Number(record.tempo)+Number(record.squad):0;
export const stageCleared=(w,tier)=>Boolean(w.campaign?.[tier]);
export const stageUnlocked=(w,tier)=>Boolean(stageFor(tier))&&(tier===1||stageCleared(w,tier-1));

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
export function configureCampaignBattle(b){
 const stage=stageFor(b.tier);
 b.campaign=b.tier;b.charge=stage.charge||b.charge;
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
 const record={
  turns:Math.min(b.seq,prior?.turns??Infinity),survivors:Math.max(survivors,prior?.survivors||0),
  tempo:Boolean(prior?.tempo||b.seq<=stage.turns),squad:Boolean(prior?.squad||survivors>=3)
 };
 const earnedMedals=medalCount(record)-medalCount(prior);
 const first=!prior,mastered=medalCount(record)===3&&medalCount(prior)<3;
 const multiplier=first?campaignFirstMultiplier:campaignRepeatMultiplier;
 // Bank the first-clear increase on victory. Incomplete attempts earn the standard campaign bounty.
 const bounties=b.enemies.reduce((total,unit)=>total+(unit.hp?0:unit.bounty),0);
 const bountyBonus=Math.max(0,bounties*multiplier-b.earned);
 const clearPrize=first?campaignFirstCoins(stage):0;
 const masteryPrize=mastered?campaignMasterCoins(stage,first):0;
 if(masteryPrize)record.masteryPrize=masteryPrize;
 else if(prior?.masteryPrize!==undefined)record.masteryPrize=prior.masteryPrize;
 w.campaign[b.campaign]=record;
 const coins=Math.min(Number.MAX_SAFE_INTEGER-w.coins,clearPrize+masteryPrize+bountyBonus);
 w.coins+=coins;b.earned+=coins;
 b.campaignReceipt={first,mastered,earnedMedals,coins,clearPrize,masteryPrize,bountyBonus,survivors,tempo:b.seq<=stage.turns,medals:medalCount(record)};
}
