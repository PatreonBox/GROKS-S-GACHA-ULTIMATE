export const cardLevelCap=20;
export const xpAt=level=>25*(level-1)*level/2;
const xpCap=xpAt(cardLevelCap);
const fuel=[10,15,25,40,65,100,155,240,360,550,825,1200];

export function cardGrowth(progress){
 const xp=Math.min(xpCap,Math.max(0,Math.floor(Number(progress?.xp)||0)));
 const level=Math.min(cardLevelCap,Math.floor((1+Math.sqrt(1+8*xp/25))/2));
 const remaining=xpAt(level+1)-xp,span=xpAt(level+1)-xpAt(level);
 return {xp,level,maxed:level===cardLevelCap,remaining,ratio:level===cardLevelCap?1:1-remaining/span,
  hpBonus:(level-1)*.028,attackBonus:(level-1)*.034};
}

export const feedXP=tier=>fuel[tier]||fuel[0];
// Spare standard copies can go into training. A level keeps a copy and all foil finishes.
export function spareCopies(record){
 return Math.max(0,record.copies-Math.max(1,(record.holoCopies||0)+(record.antimatterCopies||0)));
}

export function addCardXP(progress,amount){
 const prior=cardGrowth(progress),xp=Math.min(xpCap,prior.xp+amount);
 progress.xp=xp;
 return {before:prior.level,after:cardGrowth(progress).level,xp:xp-prior.xp};
}
