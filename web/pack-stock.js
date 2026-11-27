export const packStockLimit=20;
export const packRestockMs=60_000;

export function packAvailability(wallet,packId,now=Date.now()){
 const saved=wallet?.packStock?.[packId];
 if(!saved||saved.quantity>=packStockLimit)return {quantity:packStockLimit,nextAt:0};
 const refills=now>=saved.nextAt?1+Math.floor((now-saved.nextAt)/packRestockMs):0;
 const quantity=Math.min(packStockLimit,saved.quantity+refills);
 return {quantity,nextAt:quantity===packStockLimit?0:saved.nextAt+refills*packRestockMs};
}

export function spendPackStock(wallet,packId,count,now){
 const {quantity,nextAt}=packAvailability(wallet,packId,now);
 if(count>quantity)throw Error('Only '+quantity+' packs are in stock. Stock refills one pack per minute.');
 const stock=wallet.packStock??={};
 stock[packId]={quantity:quantity-count,nextAt:nextAt||now+packRestockMs};
}
