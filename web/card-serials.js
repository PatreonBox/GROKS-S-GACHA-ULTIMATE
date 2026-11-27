import {copiesByFinish} from './trade-rules.js';

export function cardSerials(card,finish){
 return card.serials?.[finish]||[];
}

function setSerials(card,finish,serials){
 card.serials={...card.serials};
 if(serials.length)card.serials[finish]=serials;
 else delete card.serials[finish];
 if(!Object.keys(card.serials).length)delete card.serials;
}

export function addCardSerials(card,finish,serials){
 if(serials.length)setSerials(card,finish,[...cardSerials(card,finish),...serials]);
}

// Spend unnumbered copies first, then the latest serials to preserve early editions.
export function serialsToSpend(card,finish,count){
 const serials=cardSerials(card,finish);
 const numbered=Math.max(0,count-(copiesByFinish(card)[finish]-serials.length));
 if(!numbered)return [];
 // Draft negative IDs are new within this transaction and are spent first.
 return [...serials].sort((a,b)=>a<0?(b<0?a-b:-1):b<0?1:b-a).slice(0,numbered);
}

export function removeCardSerials(card,finish,serials){
 if(!serials.length)return;
 const removing=new Set(serials);
 setSerials(card,finish,cardSerials(card,finish).filter(serial=>!removing.has(serial)));
}

export function spendCardSerials(card,finish,count){
 removeCardSerials(card,finish,serialsToSpend(card,finish,count));
}

export function serialBadge(value,finishLabel=''){
 const serials=(Array.isArray(value)?value:[value]).filter(n=>Number.isSafeInteger(n)&&n>0).sort((a,b)=>a-b);
 if(!serials.length)return '';
 const label=serials.slice(0,3).map(n=>'#'+n).join(', ');
 return '<small class="card-serial" title="Edition '+serials.map(n=>'#'+n).join(', ')+'">'+(finishLabel?finishLabel+' · ':'')+'Serial '+label+
  (serials.length>3?' +'+(serials.length-3):'')+'</small>';
}
