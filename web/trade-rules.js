import {featureLevel} from './level-access.js';
import {impossibleTier} from './impossible-cards.js';

export const tradeLevel=featureLevel('trading');
export const tradeLevelNotice='Only level '+tradeLevel+'+ people can trade.';
export const tradeCardLimit=20;
export const tradeMaxGap=15;
export const marketDays=30;
export const marketMinPairs=5;
const finishPremium={standard:1,holo:3,antimatter:9};

// Training stays with the player and market quotes change with recent trades.
export const tradeUnits=card=>card.basePower*finishPremium[card.finish];
export const tradeBundleTotal=cards=>cards.reduce((sum,card)=>sum+tradeUnits(card)*card.count,0);
export function tradeBalance(give,get){
 const higher=Math.max(give,get),lower=Math.min(give,get);
 const difference=higher-lower;
 return {allowed:higher>0&&difference*100<=higher*tradeMaxGap,
  gap:difference/higher*100,shortfall:Math.max(0,Math.ceil(higher*(100-tradeMaxGap)/100)-lower)};
}

export function tradeSearchTerm(input){
 const query=input.trim(),mention=/^<@!?(\d{17,20})>$/.exec(query);
 if(mention)return mention[1];
 if(/^[a-z0-9_.]{2,32}$/i.test(query)&&!/^\d+$/.test(query)&&!query.includes('..'))return '@'+query;
 return query;
}

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
