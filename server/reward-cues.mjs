import {mineCheckpointMs} from '../web/mine-economy.js';

export function beforeReward(wallet) {
 return {
  achievementKeys:wallet.achievementKeysPaid||0,
  armyReceiptId:wallet.armyReceipt?.id,
  battleId:wallet.battle?.id,
  battleSeq:wallet.battle?.seq
 };
}

// A wallet read can include idle income or activity from another tab. Only
// report what this successful command actually awarded to the player.
export function commandReward(action,args,result,wallet,before) {
 let bonus=false, keys=(wallet.achievementKeysPaid||0)>before.achievementKeys;
 switch(action){
  case 'kingdom.computer.collect':
  case 'kingdom.collect':
  case 'kingdom.gem-mine.collect':
   bonus=result?.earned>0;
   break;
  case 'card.claim': bonus=result?.gems>0;break;
  case 'card.merge': bonus=wallet.lastMerge?.gems>0;break;
  case 'mine.code': bonus=result?.amount>0;break;
  case 'mine.collect':
   bonus=args.returning===true&&result?.receipt?.elapsed>=mineCheckpointMs&&result.receipt.coins>0;
   break;
  case 'demon.keys.claim':
  case 'demon.keys.buy':
   keys ||= result?.keys>0;
   break;
  case 'arena.move': {
   const battle=wallet.battle;
   if(!battle||battle.id!==before.battleId||battle.seq===before.battleSeq)break;
   bonus=battle.campaignReceipt?.coins>0||battle.events?.some(event=>event.kind==='knockout'&&event.amount>0);
   keys ||= battle.campaignReceipt?.demonKeys>0;
   break;
  }
  case 'army.finish':
   if(before.armyReceiptId===args.id)break;
   bonus=result?.coins>0||result?.gems>0;
   keys ||= result?.demonKeys>0;
   break;
  case 'drill.finish': bonus=result?.gained>0;break;
  case 'remix.finish':
   bonus=result?.cleared&&(result.playerXpEarned>0||result.demonKeys>0);
   keys ||= result?.demonKeys>0;
   break;
  case 'remix.checkpoint': keys ||= result?.demonKeys>0;break;
 }
 return bonus||keys?{bonus:Boolean(bonus),keys:Boolean(keys)}:undefined;
}
