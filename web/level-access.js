export const features={
 progression:{level:1,name:'Progression',href:'#progression',icon:'crown',detail:'Track your player milestones and badges.'},
 mine:{level:3,name:'Coin mine',href:'#gacha/mine',icon:'mine',detail:'Tap for coins and build machines for steady income.'},
 training:{level:3,name:'Training zone',href:'#battle/training',icon:'spark',detail:'Run drills and strengthen your cards.'},
 arcade:{level:4,name:'Meme levels',href:'#battle/arcade',icon:'flame',detail:'Play short Geometry Dash challenges.'},
 merge:{level:5,name:'Merge station',href:'#gacha/merge',icon:'grid',detail:'Fuse duplicate cards and claim gems.'},
 demonSpecial:{level:5,name:'Special Demon banner',href:'#gacha/demon',icon:'spark',detail:'Choose a level to focus with Demon Keys.'},
 bulk:{level:7,name:'50-draw pulls',href:'#gacha/demon',icon:'pack',detail:'Open 50 Demon Key draws in one purchase.'},
 kingdom:{level:8,name:'Kingdom',href:'#kingdom',icon:'tower',detail:'Build a village and discover visiting creators.'},
 army:{level:8,name:'Army mode',href:'#battle/army',icon:'battle',detail:'Deploy a squad in real-time battles.'},
 cubes:{level:8,name:'Cube shop',href:'#gacha/cubes',icon:'box',detail:'Equip a new cube to roam your Kingdom.'},
 upgrades:{level:10,name:'Gem Upgrades',href:'#gacha/upgrades',icon:'spark',detail:'Upgrade Gacha Luck and your chance to draw an extra card.'},
 trading:{level:15,name:'Trading',href:'#trading',icon:'exchange',detail:'Find players and exchange cards at Level 15.'},
 towerExpansion:{level:15,name:'Tower Level 3',href:'#kingdom',icon:'tower',detail:'Upgrade the Kingdom tower and open a fourth housing lot.'},
 demonPro:{level:20,name:'Pro Demon banner',href:'#gacha/demon',icon:'pack',detail:'Spend five Demon Keys per draw for higher premium rarity odds.'}
};
export const packLevels={common:0,uncommon:0,rare:2,'super-rare':5,epic:8,legendary:14,mythic:20,godly:30};
const packTitles={rare:'Rare','super-rare':'Super Rare',epic:'Epic',legendary:'Legendary',mythic:'Mythic',godly:'Godly'};
const milestones=[
 ...Object.values(features),
 ...Object.entries(packTitles).map(([id,name])=>({
  level:packLevels[id],name:name+' pack',href:'#gacha/'+id,art:'/assets/packs/'+id+'.png',detail:'Available in the Pack shop.'
 }))
].sort((a,b)=>a.level-b.level);
export const featureLevel=id=>Object.hasOwn(features,id)?features[id].level:0;
export const nextUnlocks=(level,count=4)=>milestones.filter(item=>item.level>level).slice(0,count);
export const unlockedBetween=(from,to)=>milestones.filter(item=>item.level>from&&item.level<=to);
export const towerPlayerLevel=target=>target>=3?features.towerExpansion.level:features.kingdom.level;
export const levelCue=(from,to)=>Math.floor(to/5)>Math.floor(from/5)?'levelMilestone':to-from>1?'levelMulti':'levelSingle';
