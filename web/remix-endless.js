import {rewardDemonKeys} from './demon-keys.js';
import {awardPlayerXp} from './player-progression.js';
import {STEP} from './remix-physics.js';

export const endlessKeyLimit=10;
export const endlessKeyResetHours=6;
const endlessKeyWindowMs=endlessKeyResetHours*60*60*1000;

export const endlessKeyInterval=remix=>30-Math.round(20*Math.max(0,Math.min(9,remix.tier-1))/9);
export const endlessSeconds=ticks=>Math.floor(ticks*STEP+1e-7);
export const endlessMilestones=(ticks,remix)=>Math.floor(endlessSeconds(ticks)/endlessKeyInterval(remix));

export function endlessKeyStatus(wallet,now=Date.now()){
 const tally=wallet.remixEndlessKeyWindow;
 if(!tally||tally.resetsAt<=now)return {keysRemaining:endlessKeyLimit,resetsAt:null};
 return {keysRemaining:Math.max(0,endlessKeyLimit-tally.keys),resetsAt:tally.resetsAt};
}

export function rewardEndlessRemix(wallet,run,remix,{ticks,status},now){
 const previous=run.checkedTicks||0;
 const survivedSeconds=endlessSeconds(ticks),previousSeconds=endlessSeconds(previous);
 const {keysRemaining,resetsAt}=endlessKeyStatus(wallet,now);
 const earned=endlessMilestones(ticks,remix)-endlessMilestones(previous,remix);
 const demonKeys=earned>0&&keysRemaining?rewardDemonKeys(wallet,Math.min(earned,keysRemaining),now):0;
 if(demonKeys)wallet.remixEndlessKeyWindow={
  keys:endlessKeyLimit-keysRemaining+demonKeys,resetsAt:resetsAt??now+endlessKeyWindowMs
 };
 const xp=seconds=>Math.floor(seconds*(4+remix.tier)/16);
 const playerXpEarned=xp(survivedSeconds)-xp(previousSeconds);
 if(playerXpEarned)awardPlayerXp(wallet,playerXpEarned);
 const best=wallet.remixEndlessBest?.[remix.id]||0;
 if(survivedSeconds>best)(wallet.remixEndlessBest??={})[remix.id]=survivedSeconds;
 run.checkedTicks=ticks;
 return {mode:'endless',verifiedTicks:ticks,survivedSeconds,demonKeys,playerXpEarned,...endlessKeyStatus(wallet,now),terminal:Boolean(status)};
}
