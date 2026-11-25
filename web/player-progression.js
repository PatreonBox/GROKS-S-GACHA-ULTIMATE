const perPack={common:7,uncommon:12,rare:12,'super-rare':22,epic:31,legendary:44,mythic:61,godly:83};
export const packPlayerXp=id=>perPack[id]||0;
export const packXpLimit=50;
const packXpWindowMs=60*60*1000;
const recentPackOpenings=(wallet,now)=>(wallet?.packXpOpenings||[]).filter(at=>at>now-packXpWindowMs);

export function packXpAllowance(wallet,now=Date.now()){
 const recent=recentPackOpenings(wallet,now);
 return {
  remaining:packXpLimit-recent.length,
  nextAt:recent.length?Math.min(...recent)+packXpWindowMs:0
 };
}

export function awardPackXp(wallet,packId,count,now){
 const recent=recentPackOpenings(wallet,now);
 const packs=Math.min(count,packXpLimit-recent.length);
 const xp=packs*packPlayerXp(packId);
 if(xp>0){
  wallet.packXpOpenings=recent.concat(Array(packs).fill(now));
  awardPlayerXp(wallet,xp);
 }
 return {xp,capped:count-packs};
}

const levelStart=level=>120*level+17*level*(level-1)+level*(level-1)*(2*level-1)/3;
export function playerProgress(totalXp){
 const total=Number.isSafeInteger(totalXp)&&totalXp>0?totalXp:0;
 let low=0,high=1;
 while(levelStart(high)<=total)high*=2;
 while(high-low>1){
  const mid=Math.floor((low+high)/2);
  if(levelStart(mid)<=total)low=mid;else high=mid;
 }
 const xp=total-levelStart(low),goal=levelStart(low+1)-levelStart(low);
 return {level:low,xp,goal,total,ratio:xp/goal};
}

export function awardPlayerXp(wallet,amount){
 if(amount>0)wallet.playerXp=Math.min(Number.MAX_SAFE_INTEGER,(wallet.playerXp||0)+Math.floor(amount));
}

export function minePlayerXp(wallet,taps,now){
 if(!taps)return;
 const day=Math.floor(now/86_400_000),previous=wallet.minePlayerXp;
 const state=previous?.day===day?previous:{day,taps:0};
 const prior=Math.floor(state.taps/32);
 state.taps=Math.min(36*32,state.taps+taps);
 wallet.minePlayerXp=state;
 awardPlayerXp(wallet,Math.floor(state.taps/32)-prior);
}
