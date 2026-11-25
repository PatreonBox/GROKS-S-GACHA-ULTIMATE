export const holoPercent=2;
export const antimatterPercent=.1;
export const finishVersion=2;
export const finishLabels={standard:'Standard',holo:'Holo',antimatter:'Antimatter'};
export const finishClass=finish=>finish==='standard'?'':finish+'-card';
export const finishOrder={standard:0,holo:1,antimatter:2};

export function rollFinish(ticket){
 if(ticket<holoPercent*100)return 'holo';
 if(ticket<(holoPercent+antimatterPercent)*100)return 'antimatter';
 return 'standard';
}
export function finishPercent(finish,version=finishVersion){
 const holo=version>=1?holoPercent:0,antimatter=version>=2?antimatterPercent:0;
 if(finish==='holo')return holo;
 if(finish==='antimatter')return antimatter;
 return 100-holo-antimatter;
}
export function bestFinish(card){
 return card?.antimatterCopies>0?'antimatter':card?.holoCopies>0?'holo':'standard';
}
// Fusion spends standard copies first, then holo, then antimatter.
export function finishAt(card,index){
 const antimatter=card.antimatterCopies||0,holo=card.holoCopies||0;
 if(index>=card.copies-antimatter)return 'antimatter';
 if(index>=card.copies-antimatter-holo)return 'holo';
 return 'standard';
}
export function savedFinish(record){
 return record.finish||(record.holo?'holo':'standard');
}
