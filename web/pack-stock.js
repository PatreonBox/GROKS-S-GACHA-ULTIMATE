export const packStockLimit=150;
export const packRestockMs=60_000;
const oldStockLimit=30;
const oldRestockMs=3*packRestockMs;

function restock(saved,limit,interval,now){
 if(!saved||!saved.nextAt||saved.quantity>=limit)return {quantity:limit,nextAt:0};
 const refills=now>=saved.nextAt?1+Math.floor((now-saved.nextAt)/interval):0;
 const quantity=Math.min(limit,saved.quantity+refills);
 return {quantity,nextAt:quantity===limit?0:saved.nextAt+refills*interval};
}

function sharedStockFromLegacy(stock,now){
 const entries=Object.values(stock).filter(entry=>entry?.nextAt&&entry.quantity<oldStockLimit).map(entry=>({
  quantity:entry.quantity,nextAt:entry.nextAt+(entry.interval===oldRestockMs?0:oldRestockMs-packRestockMs)
 }));
 if(!entries.length)return;
 // Combine the deficits at the latest saved refill checkpoint, then accrue at the shared rate even before the next login.
 const checkpoint=Math.min(now,Math.max(...entries.map(entry=>entry.nextAt-oldRestockMs)));
 const spent=entries.reduce((sum,entry)=>sum+oldStockLimit-restock(entry,oldStockLimit,oldRestockMs,checkpoint).quantity,0);
 return {quantity:Math.max(0,packStockLimit-spent),nextAt:checkpoint+packRestockMs};
}

export function packAvailability(wallet,now=Date.now()){
 const stock=wallet?.packStock;
 const saved=stock&&!Number.isInteger(stock.quantity)?sharedStockFromLegacy(stock,now):stock;
 return restock(saved,packStockLimit,packRestockMs,now);
}

export function spendPackStock(wallet,count,now){
 const {quantity,nextAt}=packAvailability(wallet,now);
 if(count>quantity)throw Error('Only '+quantity+' packs are in shared stock. Stock refills one pack per minute.');
 wallet.packStock={quantity:quantity-count,nextAt:nextAt||now+packRestockMs};
}
