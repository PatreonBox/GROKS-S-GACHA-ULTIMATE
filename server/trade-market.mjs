import {cardCategories} from '../web/pack-engine.js';
import {marketDays,marketMinPairs,tradeKey} from '../web/trade-rules.js';
import {tradeCard,tradePageSize} from './trade-cards.mjs';

const day=86_400_000;
const finishPremium={standard:1,holo:3,antimatter:9};
const valueAnchor=card=>card.basePower/1000*finishPremium[card.finish];
const marketRows=`FROM game_trade_items i JOIN game_trades t ON t.trade_id=i.trade_id`;
const matches=`JOIN wanted w ON i.level_id=w.level_id AND i.finish=w.finish`;
const demandActivity=`t.market_eligible=1 AND (t.status='completed' AND t.resolved_at>=?
 OR t.status='pending' AND t.expires_at>? AND i.side='requested')`;
const interested=`CASE WHEN i.side='offered' THEN t.recipient_id ELSE t.sender_id END`;

export function tradeSamples(offered,requested){
 const total=cards=>cards.reduce((sum,card)=>sum+valueAnchor(card)*card.count,0);
 const ratio=total(requested)/total(offered);
 const estimate=(cards,side,exchangeRate)=>cards.map(card=>{
  const anchor=valueAnchor(card);
  return {side,id:card.id,finish:card.finish,sample:anchor*Math.min(5,Math.max(.2,exchangeRate))};
 });
 return [...estimate(offered,'offered',ratio),...estimate(requested,'requested',1/ratio)];
}

function marketAverage(samples,now){
 if(samples.length<marketMinPairs)return null;
 const sorted=samples.map(row=>row.sample).sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
 const median=sorted.length%2?sorted[middle]:(sorted[middle]+sorted[middle-1])/2;
 let total=0,weights=0;
 for(const {sample,resolved_at} of samples){
  const weight=2**(-(now-resolved_at)/(10*day));
  total+=Math.min(median*2,Math.max(median/2,sample))*weight;
  weights+=weight;
 }
 return Math.round(total/weights*10)/10;
}

export async function marketQuotes(db,cards,now){
 if(!cards.length)return new Map();
 const keys=[...new Map(cards.map(card=>[tradeKey(card),{id:card.id,finish:card.finish}])).values()];
 const args=JSON.stringify(keys),since=now-marketDays*day;
 const wanted=`wanted AS (SELECT json_extract(value,'$.id') AS level_id,json_extract(value,'$.finish') AS finish FROM json_each(?))`;
 const [demand,observations]=await Promise.all([
  db.prepare(`WITH ${wanted} SELECT i.level_id,i.finish,COUNT(DISTINCT ${interested}) AS demand
   ${marketRows} ${matches} WHERE ${demandActivity} GROUP BY i.level_id,i.finish`).bind(args,since,now).all(),
  db.prepare(`WITH ${wanted}, by_pair AS (
    SELECT i.level_id,i.finish,i.sample,t.resolved_at,ROW_NUMBER() OVER (
     PARTITION BY i.level_id,i.finish,MIN(t.sender_id,t.recipient_id),MAX(t.sender_id,t.recipient_id)
     ORDER BY t.resolved_at DESC,t.trade_id DESC) AS position
    ${marketRows} ${matches} WHERE t.market_eligible=1 AND t.status='completed' AND t.resolved_at>=? AND i.sample IS NOT NULL
   ), recent AS (
    SELECT *,ROW_NUMBER() OVER (PARTITION BY level_id,finish ORDER BY resolved_at DESC) AS recent_position
    FROM by_pair WHERE position=1
   ) SELECT level_id,finish,sample,resolved_at FROM recent WHERE recent_position<=64`).bind(args,since).all()
 ]);
 const key=row=>tradeKey({id:row.level_id,finish:row.finish});
 const interest=new Map(demand.results.map(row=>[key(row),row.demand]));
 const samples=new Map();
 for(const row of observations.results){
  const id=key(row);
  if(!samples.has(id))samples.set(id,[]);
  samples.get(id).push(row);
 }
 return new Map(keys.map(card=>{
  const id=tradeKey(card),sales=samples.get(id)||[];
  return [id,{value:marketAverage(sales,now),demand:interest.get(id)||0,samples:sales.length}];
 }));
}

export async function addMarketQuotes(db,cards,now){
 const quotes=await marketQuotes(db,cards,now);
 return cards.map(card=>({...card,market:quotes.get(tradeKey(card))}));
}

export async function browseMarket(db,getPool,{term,tier,finish,page,now}){
 const categories=tier==null?cardCategories:[cardCategories[tier]];
 if(!term&&tier==null&&page===0){
  const {results}=await db.prepare(`SELECT i.level_id,MAX(i.tier) AS tier ${marketRows}
   WHERE i.finish=? AND ${demandActivity} GROUP BY i.level_id ORDER BY COUNT(DISTINCT ${interested}) DESC,i.level_id LIMIT ?`)
   .bind(finish,now-marketDays*day,now,tradePageSize).all();
  const groups=new Map(await Promise.all([...new Set(results.map(item=>item.tier))].map(async i=>
   [i,new Map((await getPool(cardCategories[i])).map(row=>[row[0],row]))])));
  const trending=results.map(item=>groups.get(item.tier).get(item.level_id)).filter(Boolean);
  if(trending.length)return {cards:await addMarketQuotes(db,trending.map(row=>tradeCard(row,finish)),now),more:false};
  const list=await getPool('Extreme Demon');
  return {cards:await addMarketQuotes(db,list.slice(0,tradePageSize).map(row=>tradeCard(row,finish)),now),more:false};
 }
 const lists=await Promise.all(categories.map(getPool)),q=term.toLowerCase();
 const found=lists.flat().filter(row=>!q||String(row[0])===q||row[1].toLowerCase().includes(q));
 const end=(page+1)*tradePageSize;
 return {cards:await addMarketQuotes(db,found.slice(end-tradePageSize,end).map(row=>tradeCard(row,finish)),now),more:found.length>end};
}
