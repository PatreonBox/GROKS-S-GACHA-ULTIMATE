import {finishLabels} from './card-finishes.js';
import {cardFace} from './pack-model.js';
import {tradeRead} from './game-client.js';

const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
export const tradeNumber=value=>number.format(value);
export const escapeTrade=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const tradeValue=value=>Number.isFinite(value)?number.format(value)+' pts':'--';
export function tradeDemand(count){
 if(!count)return 'No requests';
 const category=count>=6?'High':count>=3?'Medium':'Low';
 return category+' · '+count+(count===1?' player':' players');
}

export function tradeCardHTML(card,cover,controls='',showMoves=false){
 const {id,title,creator,finish,difficulty,rank,tier,hp,attack,level,role,market,count,owned,locked}=card;
 return '<article class="trade-card" data-finish="'+escapeTrade(finish)+'" data-tier="'+tier+'">'+
  '<div class="trade-card-art"><img src="'+cardFace(difficulty)+'" alt="">'+
  '<img data-trade-cover src="'+escapeTrade(cover(id))+'" loading="lazy" alt="">'+
  (rank?'<span class="trade-rank">#'+number.format(rank)+'</span>':'')+
  (count?'<span class="trade-card-quantity">×'+count+'</span>':'')+'</div>'+
  '<div class="trade-card-main"><div class="trade-card-kind"><span>'+escapeTrade(difficulty)+'</span><b>'+finishLabels[finish]+'</b></div>'+
  '<h3 title="'+escapeTrade(title)+'">'+escapeTrade(title)+'</h3>'+(creator?'<small class="trade-creator" title="'+escapeTrade(creator)+'">by '+escapeTrade(creator)+'</small>':'')+
  '<small class="trade-card-role">Level '+level+' · '+escapeTrade(role)+(owned?' · '+number.format(owned)+' owned':'')+'</small>'+
  '<dl><div><dt>HP</dt><dd title="'+number.format(hp)+'">'+compact.format(hp)+'</dd></div><div><dt>Attack</dt><dd title="'+number.format(attack)+'">'+compact.format(attack)+'</dd></div>'+
  '<div><dt>Value</dt><dd>'+tradeValue(market?.value)+'</dd></div><div><dt>Demand</dt><dd>'+tradeDemand(market?.demand)+'</dd></div></dl>'+
  (locked?'<p class="trade-card-lock">'+escapeTrade(locked)+'</p>':'')+
  (showMoves?'<details class="trade-moves"><summary>Moves</summary><small>Basic attack</small><b>'+escapeTrade(card.basic)+'</b>'+
   '<small>Signature</small><b>'+escapeTrade(card.signature)+'</b><p>'+escapeTrade(card.signatureDetail)+'</p></details>':'')+
  controls+'</div></article>';
}

export function levelMarketDetails(root,id){
 const actions=root.querySelector('.detailactions');
 if(!actions)return;
 const section=document.createElement('section');
 section.className='level-market-stats';
 section.innerHTML='<h3>Trade market</h3><p role="status">Loading market data…</p>';
 actions.before(section);
 tradeRead('quotes',{id}).then(({quotes})=>{
  if(!section.isConnected)return;
  section.innerHTML='<h3>Trade market</h3><div>'+Object.entries(finishLabels).map(([finish,label])=>{
   const quote=quotes[finish];
   return '<dl><dt>'+label+'</dt><dd><b>'+tradeValue(quote.value)+'</b><small>'+tradeDemand(quote.demand)+'</small></dd></dl>';
  }).join('')+'</div>';
 }).catch(()=>{if(section.isConnected)section.querySelector('p').textContent='Market data is temporarily unavailable.';});
}
