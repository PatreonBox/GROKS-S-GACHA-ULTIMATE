import {gemTenths} from './card-economy.js';
import {campaignStages,stageCleared} from './campaign.js';

export const starterDemonKeys=30;
export const bannerUnlockDelay=24*60*60*1000;
export const demonKeyPrice=10;
export const demonKeyOffer={keys:50,gems:20};
export const keyLimit=Number.MAX_SAFE_INTEGER;
export const campaignKeyReward=10;
export const demonKeyDiscordBonus=15;

export function initDemonKeys(wallet,now=Date.now()){
 if(wallet.demonBanner)return false;
 const cleared=campaignStages.filter((_,i)=>stageCleared(wallet,i+1)).length;
 wallet.demonKeys=starterDemonKeys+cleared*campaignKeyReward;
 wallet.demonBanner={offerEndsAt:now+bannerUnlockDelay};
 return true;
}

export function rewardDemonKeys(wallet,count,now=Date.now()){
 initDemonKeys(wallet,now);
 const prior=wallet.demonKeys;
 wallet.demonKeys=prior+Math.min(keyLimit-prior,count);
 return wallet.demonKeys-prior;
}

export function releaseAchievementKeys(wallet,now=Date.now()){
 if(wallet.pending||!wallet.demonKeysToClaim)return 0;
 const keys=rewardDemonKeys(wallet,wallet.demonKeysToClaim,now);
 wallet.demonKeysToClaim-=keys;
 if(!wallet.demonKeysToClaim)delete wallet.demonKeysToClaim;
 wallet.achievementKeysPaid=(wallet.achievementKeysPaid||0)+keys;
 return keys;
}

export function claimDemonKeys(wallet,now=Date.now()){
 if(wallet.pending)throw Error('Finish your current opening to receive your achievement keys.');
 const keys=releaseAchievementKeys(wallet,now);
 if(!keys)throw Error('There are no achievement keys ready to add.');
 return {keys};
}

export function buyDemonKeys(wallet,{quantity,offer},now){
 initDemonKeys(wallet,now);
 if(offer===true){
  if(quantity!==undefined)throw Error('Choose one Demon Key purchase.');
  if(wallet.demonBanner.starterOfferBought||now>=wallet.demonBanner.offerEndsAt)throw Error('The starter Demon Key offer has ended.');
 }
 const count=offer===true?demonKeyOffer.keys:quantity;
 if(!Number.isSafeInteger(count)||count<1||count>1000)throw Error('Choose a valid Demon Key quantity.');
 const gems=offer===true?demonKeyOffer.gems:count*demonKeyPrice;
 const balance=gemTenths(wallet.gems),cost=gemTenths(gems);
 if(cost>balance)throw Error('You need '+gems.toLocaleString('en-US')+' gems for these Demon Keys.');
 if(count>keyLimit-wallet.demonKeys)throw Error('Your Demon Key balance is full.');
 wallet.gems=(balance-cost)/10;
 rewardDemonKeys(wallet,count,now);
 if(offer===true)wallet.demonBanner.starterOfferBought=true;
 return {keys:count,gems,offer:offer===true};
}
