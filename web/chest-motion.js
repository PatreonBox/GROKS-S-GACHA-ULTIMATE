const pacing={mythic:.92,ancient:.96,exotic:1.02,celestial:1.10,secret:1.13,divine:1.14,apex:1.19};
const bannerMetal={standard:'#69d9fb',special:'#f4c46d',pro:'#a8e971'};
const rarityMetal={
 uncommon:'#65dd9e',rare:'#76b7ff',epic:'#b69aff',legendary:'#f6cc64',mythic:'#ff7a7a',ancient:'#c88eeb',
 exotic:'#ff75ad',celestial:'#b0c3ff',secret:'#eb517c',divine:'#ffeb98',apex:'#f7a8ff',impossible:'#a580ff'
};

export const phaseProgress=(time,start,end)=>Math.min(1,Math.max(0,(time-start)/(end-start)));
const ease=t=>t*t*(3-2*t);
const overshoot=(t,amount)=>1+(amount+1)*(t-1)**3+amount*(t-1)**2;

export function chestKeyColor(tier,rarity){
 return rarityMetal[rarity]||bannerMetal[tier]||bannerMetal.standard;
}

export function chestTimeline(rarity){
 const scale=pacing[rarity]||1;
 const descent=rarity==='impossible'?1.17:0;
 const landing=descent+1.06*scale;
 // The landing clip has a second impact for the settling bounce.
 const rebound=landing+.34;
 const keyStart=rebound+.095;
 const align=keyStart+.64*scale;
 const latch=align+.15*scale;
 const turnStart=latch+.11*scale;
 const turnEnd=turnStart+.52*scale;
 const openStart=turnEnd+.13*scale;
 const open=openStart+.58*scale;
 return {descent,landing,rebound,keyStart,align,latch,turnStart,turnEnd,openStart,open};
}

export function chestDropMotion(time,{descent,landing,rebound,openStart,open}){
 const fall=phaseProgress(time,descent+.08,landing);
 const settle=phaseProgress(time,landing,rebound);
 const bump=4*settle*(1-settle);
 const impactAge=time-landing,secondImpactAge=time-rebound;
 const impact=impactAge<0?0:Math.exp(-impactAge*18);
 const secondImpact=secondImpactAge<0?0:Math.exp(-secondImpactAge*26);
 const lid=overshoot(phaseProgress(time,openStart,open),1.18);
 return {fall,bump,impact,secondImpact,lid};
}

export function chestKeyMotion(time,{keyStart,align,latch,turnStart,turnEnd,openStart}){
 const flight=ease(phaseProgress(time,keyStart,align));
 const arc=Math.sin(Math.PI*flight);
 const seat=ease(phaseProgress(time,align,latch));
 const catchAt=turnStart+(turnEnd-turnStart)*.24;
 const resistance=ease(phaseProgress(time,turnStart,catchAt));
 const drive=phaseProgress(time,catchAt,turnEnd);
 const turn=overshoot(drive,1.55)-.095*resistance*(1-ease(drive));
 const color=ease(phaseProgress(time,catchAt,turnEnd));
 const withdraw=ease(phaseProgress(time,openStart,openStart+.42));
 const opacity=ease(phaseProgress(time,keyStart,keyStart+.12))*(1-ease(phaseProgress(withdraw,.57,1)));
 return {flight,arc,seat,turn,color,withdraw,opacity};
}
