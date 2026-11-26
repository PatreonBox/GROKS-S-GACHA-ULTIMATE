import {featureLevel} from './level-access.js';
import {impossibleTier} from './impossible-cards.js';

export const tradeLevel=featureLevel('trading');
export const tradeLevelNotice='Only level '+tradeLevel+'+ people can trade.';
export const tradeCardLimit=20;
export const marketDays=30;
export const marketMinPairs=5;

export const validTradeMinimum=value=>Number.isInteger(value)&&value>=0&&value<=impossibleTier;
export function tradePreferences(wallet){
 const prefs=wallet?.trade;
 return {enabled:prefs?.enabled!==false,minimum:validTradeMinimum(prefs?.minimum)?prefs.minimum:0};
}

export const tradeKey=({id,finish})=>id+':'+finish;

export function copiesByFinish(card){
 const copies=card?.copies||0;
 const antimatter=Math.min(copies,card?.antimatterCopies||0);
 const holo=Math.min(copies-antimatter,card?.holoCopies||0);
 return {standard:copies-antimatter-holo,holo,antimatter};
}
