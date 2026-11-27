export const coinEconomyVersion=1;
export const coinDivisor=10;
export const startingCoins=150;
export const coinLimit=Number.MAX_SAFE_INTEGER;
export const roundCoins=value=>Number(value.toFixed(1));
export const validCoinAmount=value=>Number.isFinite(value)&&value>=0&&value<=coinLimit&&roundCoins(value)===value;
export const formatCoins=value=>value.toLocaleString('en-US',{maximumFractionDigits:1});

export function changeCoins(wallet,amount){
 const before=wallet.coins;
 wallet.coins=roundCoins(Math.min(coinLimit,before+amount));
 return roundCoins(wallet.coins-before);
}

export const oldCoinAmount=value=>Math.floor(Math.max(0,value)/coinDivisor);
const coinPriceMultiplier=1.5;
export const coinPrice=amount=>Math.ceil(amount*coinPriceMultiplier);
export const previousCoinPrice=amount=>Math.floor(amount/coinPriceMultiplier);

function rescale(record,fields){
 if(!record)return;
 for(const key of fields)if(Number.isFinite(record[key]))record[key]=oldCoinAmount(record[key]);
}

function rescaleLegacyWallet(wallet){
 rescale(wallet,['coins']);
 if(wallet.achievementProgress)rescale(wallet.achievementProgress,['mine']);
 for(const stage of Object.values(wallet.campaign||{}))rescale(stage,['clearPrize','masteryPrize']);
 rescale(wallet.armyReceipt?.result,['coins']);
 const kingdom=wallet.kingdom;
 for(const group of ['houses','forges','gemMines','defences','storage']){
  for(const building of kingdom?.[group]||[])rescale(building,['price']);
 }
 const battle=wallet.battle;
 if(battle){
  rescale(battle,['earned']);
  for(const enemy of battle.enemies||[])rescale(enemy,['bounty']);
  for(const event of battle.events||[]){
   if(event.kind==='knockout')rescale(event,['amount']);
  }
  if(Array.isArray(battle.log)){
   battle.log=battle.log.map(line=>line.replace(/ · \+([0-9,]+) coins\.$/u,(_,value)=>
    ' · +'+oldCoinAmount(Number(value.replaceAll(',',''))).toLocaleString('en-US')+' coins.'));
  }
  rescale(battle.campaignReceipt,['coins','clearPrize','masteryPrize','bountyBonus']);
 }
 // The legacy mine remainder was recorded in thousandths of an old coin.
 // Its integer also equals the new remainder in ten-thousandths of a coin.
 wallet.coinEconomyVersion=coinEconomyVersion;
}

export function needsCoinNormalization(wallet){
 return (wallet.coinEconomyVersion||0)<coinEconomyVersion||Object.hasOwn(wallet,'coinTapRemainder');
}

export function normalizeCoinWallet(wallet){
 if(!wallet)return wallet;
 if((wallet.coinEconomyVersion||0)<coinEconomyVersion)rescaleLegacyWallet(wallet);
 if(Object.hasOwn(wallet,'coinTapRemainder')){
  changeCoins(wallet,(wallet.coinTapRemainder||0)/coinDivisor);
  delete wallet.coinTapRemainder;
 }
 return wallet;
}

export function normalizeCoinReceipt(action,result){
 if(typeof action!=='string')return result;
 if(action==='mine.code')rescale(result,['amount']);
 if(action==='mine.tap')rescale(result,['gain']);
 if(action==='mine.machine')rescale(result,['cost']);
 if(action==='mine.collect')rescale(result?.receipt,['coins']);
 if(action==='army.finish')rescale(result,['coins']);
 if(action==='cube.equip')rescale(result?.cube,['price']);
 if(action==='admin.adjust'&&result?.field==='coins')rescale(result,['value']);
 if(action==='admin.kingdom.finish'||action.startsWith('kingdom.')){
  rescale(result,['price']);
  for(const key of ['tower','house','forge','building','spike-shooter'])rescale(result?.[key],['price']);
 }
 return result;
}
