import {finishLabels} from './card-finishes.js';
import {cardFace} from './pack-model.js';
import {tradeRead} from './game-client.js';
import {cardRarity,displayCardRank,rarityBadge} from './card-rarity.js';
import {serialBadge} from './card-serials.js';
import {tradeUnits} from './trade-rules.js';

const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const points=new Intl.NumberFormat('en-US',{maximumFractionDigits:3});
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
export const tradeNumber=value=>number.format(value);
export const escapeTrade=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const tradeValue=value=>Number.isFinite(value)?number.format(value)+' pts':'--';
export const tradePoints=units=>Number.isFinite(units)?points.format(units/1000)+' pts':'--';
export function tradeDemand(count){
 if(!count)return 'No requests';
 const category=count>=6?'High':count>=3?'Medium':'Low';
 return category+' · '+count+(count===1?' player':' players');
}

export function tradeCardHTML(card,cover,controls='',showMoves=false,marketView=false){
 const {id,title,creator,finish,difficulty,hp,attack,level,role,market,count,owned,locked}=card;
 const rarity=cardRarity(card),rank=displayCardRank(card);
 return '<article class="trade-card" data-finish="'+escapeTrade(finish)+'" data-card-rarity="'+rarity.id+'">'+
  '<div class="trade-card-art"><img src="'+cardFace(difficulty)+'" alt="">'+
  '<img data-trade-cover src="'+escapeTrade(cover(id))+'" loading="lazy" alt="">'+
  (rank?'<span class="trade-rank">#'+number.format(rank)+'</span>':'')+
  (count?'<span class="trade-card-quantity">×'+count+'</span>':'')+'</div>'+
  '<div class="trade-card-main"><div class="trade-card-kind">'+rarityBadge(rarity)+'<b>'+finishLabels[finish]+'</b></div>'+
  '<h3 title="'+escapeTrade(title)+'">'+escapeTrade(title)+'</h3>'+serialBadge(card.serials)+(creator?'<small class="trade-creator" title="'+escapeTrade(creator)+'">by '+escapeTrade(creator)+'</small>':'')+
  '<small class="trade-card-role">'+escapeTrade(difficulty)+' · Level '+level+' · '+escapeTrade(role)+(owned?' · '+number.format(owned)+' owned':'')+'</small>'+
  '<dl><div><dt>HP</dt><dd title="'+number.format(hp)+'">'+compact.format(hp)+'</dd></div><div><dt>Attack</dt><dd title="'+number.format(attack)+'">'+compact.format(attack)+'</dd></div>'+
  '<div><dt>'+(marketView?'Market value':'Trade value')+'</dt><dd>'+(marketView?tradeValue(market?.value):tradePoints(tradeUnits(card)))+'</dd></div><div><dt>Demand</dt><dd>'+tradeDemand(market?.demand)+'</dd></div></dl>'+
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
