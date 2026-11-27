export const packStockLimit=30;
export const packRestockMinutes=3;
export const packRestockMs=packRestockMinutes*60_000;
const legacyRestockMs=60_000;

export function packAvailability(wallet,packId,now=Date.now()){
 const saved=wallet?.packStock?.[packId];
 if(!saved||!saved.nextAt||saved.quantity>=packStockLimit)return {quantity:packStockLimit,nextAt:0};
 // Keep the elapsed time that was already applied to the next legacy refill.
 const due=saved.interval===packRestockMs?saved.nextAt:saved.nextAt+packRestockMs-legacyRestockMs;
 const refills=now>=due?1+Math.floor((now-due)/packRestockMs):0;
 const quantity=Math.min(packStockLimit,saved.quantity+refills);
 return {quantity,nextAt:quantity===packStockLimit?0:due+refills*packRestockMs};
}

export function spendPackStock(wallet,packId,count,now){
 const {quantity,nextAt}=packAvailability(wallet,packId,now);
 if(count>quantity)throw Error('Only '+quantity+' packs are in stock. Stock refills one pack every '+packRestockMinutes+' minutes.');
 const stock=wallet.packStock??={};
 stock[packId]={quantity:quantity-count,nextAt:nextAt||now+packRestockMs,interval:packRestockMs};
}
