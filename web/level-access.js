export const features={
 mine:{level:3,name:'Coin mine',href:'#gacha/mine',icon:'mine',detail:'Tap for coins and build machines for steady income.'},
 training:{level:3,name:'Training zone',href:'#battle/training',icon:'spark',detail:'Run drills and strengthen your cards.'},
 arcade:{level:4,name:'Meme levels',href:'#battle/arcade',icon:'flame',detail:'Play short Geometry Dash challenges.'},
 merge:{level:5,name:'Merge station',href:'#gacha/merge',icon:'grid',detail:'Fuse duplicate cards and claim gems.'},
 bulk:{level:7,name:'50-pack pulls',href:'#gacha',icon:'pack',detail:'Open up to 50 packs in one purchase.'},
 kingdom:{level:8,name:'Kingdom',href:'#kingdom',icon:'tower',detail:'Build a village and discover visiting creators.'},
 army:{level:8,name:'Army mode',href:'#battle/army',icon:'battle',detail:'Deploy a squad in real-time battles.'},
 cubes:{level:8,name:'Cube shop',href:'#gacha/cubes',icon:'box',detail:'Equip a new cube to roam your Kingdom.'},
 towerExpansion:{level:10,name:'Tower expansion',href:'#kingdom',icon:'tower',detail:'Expand your tower to Levels 3 and 4 as you fill its lots.'},
 upgrades:{level:11,name:'Gem Upgrades',href:'#gacha/upgrades',icon:'spark',detail:'Improve your card luck and bonus card chance.'},
 trading:{level:15,name:'Trading',href:'#trading',icon:'exchange',detail:'Find players and exchange cards at Level 15.'},
 towerFinale:{level:15,name:'Tower Level 5',href:'#kingdom',icon:'tower',detail:'Open the last house lots and attract the Legendary visitor.'}
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
export const unlockedBetween=(from,to)=>milestones.filter(item=>item.level>from&&item.level<=to);
export const towerPlayerLevel=target=>target===5?features.towerFinale.level:target>=3?features.towerExpansion.level:features.kingdom.level;
export const levelCue=(from,to)=>Math.floor(to/5)>Math.floor(from/5)?'levelMilestone':to-from>1?'levelMulti':'levelSingle';
