import {playerProgress,playerXpAtLevel} from '../web/player-progression.js';
import {cardCategories,normalizeWallet} from '../web/pack-engine.js';
import {impossibleCategory,impossibleCover,impossibleTier} from '../web/impossible-cards.js';
import {finishLabels} from '../web/card-finishes.js';
import {tradeKey,tradeLevel,tradeLevelNotice,tradePreferences,validTradeMinimum} from '../web/trade-rules.js';
import {isUuid,one,reject} from './game-http.mjs';
import {directoryPlayer,findPlayer,searchPlayers} from './player-directory.mjs';
import {collectionPower,discordAvatar,rankingVersion} from './player-rankings.mjs';
import {browseCollection,exchangeCards,readBundle,snapshotBundle,validCardId,validFinish} from './trade-cards.mjs';
import {updateAchievements} from '../web/progression-rules.js';
import {seedAchievements} from './progression.mjs';
import {addMarketQuotes,browseMarket,marketQuotes,tradeSamples} from './trade-market.mjs';

const week=7*86_400_000;
const offerLimit=25;
const listSize=16;
const getTrade=(db,id)=>one(db,'SELECT * FROM game_trades WHERE trade_id=?',id);
const currentProfile='EXISTS(SELECT 1 FROM game_profiles WHERE player_id=? AND revision=? AND banned_at IS NULL)';
const resolvedTrade='EXISTS(SELECT 1 FROM game_trades WHERE trade_id=? AND resolution_id=?)';
const payload=cards=>JSON.stringify(cards);
async function ownedSecrets(db,id){
 const {results}=await db.prepare(`SELECT level_id FROM game_cards WHERE player_id=?
  AND json_extract(card,'$.row[6]')=? AND json_extract(card,'$.copies')>0`).bind(id,impossibleCategory).all();
 return results.map(row=>row.level_id);
}
const marketTrusted=(record,wallet,adminOwner)=>record.owner!==adminOwner&&!record.leaderboard_excluded&&!wallet.legacyTransfer&&!wallet.marketExcluded;

function requireLevel(record){
 if(!record||record.banned_at!==null)reject('This player is unavailable for trading.',403);
 if(playerProgress(JSON.parse(record.wallet).playerXp).level<tradeLevel)reject(tradeLevelNotice,403);
}

function readyPair(viewer,other,discordOnly){
 requireLevel(viewer);
 if(!other||other.player_id===viewer.player_id||other.banned_at!==null||other.owner.startsWith('guest:')||
   (discordOnly&&!other.owner.startsWith('discord:')))reject('This player is unavailable for trading.',404);
 requireLevel(other);
 const mine=tradePreferences(JSON.parse(viewer.wallet)),theirs=tradePreferences(JSON.parse(other.wallet));
 if(!mine.enabled)reject('Enable trading in Trade settings first.',403);
 if(!theirs.enabled)reject('This player has disabled trades.',403);
 return {mine,theirs};
}

function statusAt(trade,now){return trade.status==='pending'&&trade.expires_at<=now?'expired':trade.status;}
function tradeSummary(row,viewer,now){
 const outgoing=row.sender_id===viewer;
 return {id:row.trade_id,direction:outgoing?'outgoing':'incoming',status:statusAt(row,now),createdAt:row.created_at,
  expiresAt:row.expires_at,resolvedAt:row.resolved_at??(row.expires_at<=now?row.expires_at:null)};
}

async function describeTrade(db,trade,viewer,now){
 const summary=tradeSummary(trade,viewer,now),outgoing=summary.direction==='outgoing';
 const other=await findPlayer(db,outgoing?trade.recipient_id:trade.sender_id);
 const offered=JSON.parse(trade.offered),requested=JSON.parse(trade.requested);
 return {...summary,player:directoryPlayer(other),give:outgoing?offered:requested,get:outgoing?requested:offered};
}

function ownedTrade(trade,viewer){
 if(!trade||![trade.sender_id,trade.recipient_id].includes(viewer))reject('Trade not found.',404);
 return trade;
}

async function listTrades(db,viewer,view,page,now){
 const filters={incoming:"t.recipient_id=? AND t.status='pending' AND t.expires_at>?",
  outgoing:"t.sender_id=? AND t.status='pending' AND t.expires_at>?",
  history:"(t.sender_id=? OR t.recipient_id=?) AND (t.status<>'pending' OR t.expires_at<=?)"};
 const {results}=await db.prepare(`WITH entries AS (
  SELECT t.*,CASE WHEN t.sender_id=? THEN t.recipient_id ELSE t.sender_id END AS other_id FROM game_trades t
  WHERE ${filters[view]} ORDER BY COALESCE(t.resolved_at,t.created_at) DESC,t.trade_id DESC LIMIT ? OFFSET ?
 ) SELECT t.*,COALESCE(NULLIF(d.display_name,''),NULLIF(d.username,''),s.alias,'Player '||substr(t.other_id,-4)) AS name,
  COALESCE(d.username,'') AS username,substr(p.owner,9) AS discord_id,d.avatar_hash,d.default_avatar_index FROM entries t JOIN game_profiles p ON p.player_id=t.other_id
  LEFT JOIN game_discord_profiles d ON p.owner='discord:'||d.discord_id LEFT JOIN game_scores s ON p.player_id=s.player_id
  ORDER BY COALESCE(t.resolved_at,t.created_at) DESC,t.trade_id DESC`)
  .bind(viewer,viewer,...(view==='history'?[viewer]:[]),now,listSize+1,page*listSize).all();
 const count=saved=>JSON.parse(saved).reduce((sum,card)=>sum+card.count,0);
 return {trades:results.slice(0,listSize).map(row=>{
  const summary=tradeSummary(row,viewer,now),outgoing=summary.direction==='outgoing';
  return {...summary,player:{id:row.other_id,name:row.name,username:row.username,avatar:discordAvatar(row)},
   giveCount:count(outgoing?row.offered:row.requested),getCount:count(outgoing?row.requested:row.offered)};
 }),more:results.length>listSize};
}

async function overview(db,viewer,now){
 const {incoming,outgoing}=await one(db,`SELECT
  (SELECT COUNT(*) FROM game_trades WHERE recipient_id=? AND status='pending' AND expires_at>?) AS incoming,
  (SELECT COUNT(*) FROM game_trades WHERE sender_id=? AND status='pending' AND expires_at>?) AS outgoing`,
 viewer.player_id,now,viewer.player_id,now);
 return {incoming,outgoing,settings:tradePreferences(JSON.parse(viewer.wallet)),hasSecrets:(await ownedSecrets(db,viewer.player_id)).length>0};
}

async function proposal(db,viewer,args,requestId,context){
 const {inventory,adminOwner,discordOnly}=context,{player}=args;
 if(!isUuid(player)||player===viewer.player_id)reject('Choose another player to trade with.');
 const offered=readBundle(args.offered),requested=readBundle(args.requested),keys=new Set(offered.map(tradeKey));
 if(requested.some(card=>keys.has(tradeKey(card))))reject('An identical card finish cannot be on both sides.');
 for(let attempt=0;attempt<4;attempt++){
  const previous=await getTrade(db,requestId);
  if(previous){
   if(previous.sender_id!==viewer.player_id||previous.recipient_id!==player)reject('This proposal is unavailable.',409);
   return describeTrade(db,previous,viewer.player_id,Date.now());
  }
  const [sender,recipient]=await Promise.all([findPlayer(db,viewer.player_id),findPlayer(db,player)]);
  const {mine,theirs}=readyPair(sender,recipient,discordOnly),now=Date.now();
  const a=JSON.parse(sender.wallet),b=JSON.parse(recipient.wallet);
  const [left,right]=await Promise.all([inventory(db,sender.player_id),inventory(db,recipient.player_id)]);
  const known=new Set(left.filter(card=>card.copies>0).map(card=>card.id));
  if(requested.some(card=>impossibleCover(card.id)&&!known.has(card.id)))reject('That card is unavailable.',404);
  const selections=[snapshotBundle(offered,new Map(left.map(card=>[card.id,card])),a,theirs.minimum,now),
   snapshotBundle(requested,new Map(right.map(card=>[card.id,card])),b,mine.minimum,now)];
  const quotes=await addMarketQuotes(db,selections.flat(),now),offer=quotes.slice(0,offered.length),want=quotes.slice(offered.length);
  const eligible=Number(marketTrusted(sender,a,adminOwner)&&marketTrusted(recipient,b,adminOwner));
  const items=[...offer.map(card=>({...card,side:'offered'})),...want.map(card=>({...card,side:'requested'}))];
  const [entry]=await db.batch([
   db.prepare(`INSERT INTO game_trades(trade_id,sender_id,recipient_id,offered,requested,created_at,expires_at,market_eligible)
    SELECT ?,?,?,?,?,?,?,? WHERE ${currentProfile} AND ${currentProfile}
     AND (SELECT COUNT(*) FROM game_trades WHERE sender_id=? AND status='pending' AND expires_at>?)<?
    ON CONFLICT(trade_id) DO NOTHING`)
    .bind(requestId,sender.player_id,player,payload(offer),payload(want),now,now+week,eligible,
     sender.player_id,sender.revision,player,recipient.revision,sender.player_id,now,offerLimit),
   db.prepare(`INSERT OR IGNORE INTO game_trade_items(trade_id,side,level_id,tier,finish)
    SELECT ?,json_extract(value,'$.side'),json_extract(value,'$.id'),json_extract(value,'$.tier'),json_extract(value,'$.finish')
    FROM json_each(?) WHERE changes()=1`).bind(requestId,payload(items))
  ]);
  if(entry.meta.changes)return describeTrade(db,await getTrade(db,requestId),viewer.player_id,now);
  if((await overview(db,sender,now)).outgoing>=offerLimit&&!await getTrade(db,requestId)){
   reject('Cancel an outgoing offer before sending another. You have '+offerLimit+' open offers.',409);
  }
 }
 reject('A collection changed while making this offer. Refresh and try again.',409);
}

function transferWrites(db,{record,wallet,records,changes},tradeId,writeId,now){
 const player=record.player_id,version=record.revision+1;
 wallet.cardsRevision=version;
 const power=collectionPower(records,wallet,changes);
 return [db.prepare(`UPDATE game_profiles SET wallet=?,revision=?,last_request=?,updated_at=?,
   collection_power=?,power_version=?,ranking_xp=? WHERE player_id=? AND ${resolvedTrade}`)
  .bind(payload(wallet),version,writeId,now,power,rankingVersion,wallet.playerXp||0,player,tradeId,writeId),
 db.prepare(`INSERT INTO game_cards(player_id,level_id,card)
   SELECT ?,json_extract(value,'$.id'),value FROM json_each(?) WHERE ${resolvedTrade}
   ON CONFLICT(player_id,level_id) DO UPDATE SET card=excluded.card`)
  .bind(player,payload([...changes.values()]),tradeId,writeId)];
}

async function acceptTrade(db,trade,context,now){
 const {inventory,adminOwner,discordOnly}=context,id=trade.trade_id;
 const [sender,recipient]=await Promise.all([findPlayer(db,trade.sender_id),findPlayer(db,trade.recipient_id)]);
 const {mine,theirs}=readyPair(sender,recipient,discordOnly);
 const a=normalizeWallet(JSON.parse(sender.wallet)),b=normalizeWallet(JSON.parse(recipient.wallet));
 const [left,right]=await Promise.all([inventory(db,sender.player_id),inventory(db,recipient.player_id)]);
 const leftCards=new Map(left.map(card=>[card.id,card])),rightCards=new Map(right.map(card=>[card.id,card]));
 const offered=JSON.parse(trade.offered),requested=JSON.parse(trade.requested);
 const gave=snapshotBundle(offered,leftCards,a,theirs.minimum,now),got=snapshotBundle(requested,rightCards,b,mine.minimum,now);
 const receipts=await addMarketQuotes(db,[...gave,...got],now),writeId=crypto.randomUUID();
 const withRows=(cards,collection)=>cards.map(card=>({...card,row:collection.get(card.id).row}));
 const aChanges=exchangeCards(a,leftCards,gave,withRows(got,rightCards),now);
 const bChanges=exchangeCards(b,rightCards,got,withRows(gave,leftCards),now);
 await Promise.all([seedAchievements(db,sender.player_id,a,now,left),seedAchievements(db,recipient.player_id,b,now,right)]);
 updateAchievements(a,{cards:aChanges.values(),traded:1},now);
 updateAchievements(b,{cards:bChanges.values(),traded:1},now);
 const eligible=Number(trade.market_eligible&&marketTrusted(sender,a,adminOwner)&&marketTrusted(recipient,b,adminOwner));
 const writes=[db.prepare(`UPDATE game_trades SET status='completed',resolved_at=?,resolution_id=?,offered=?,requested=?,market_eligible=?
   WHERE trade_id=? AND status='pending' AND expires_at>? AND ${currentProfile} AND ${currentProfile}`)
  .bind(now,writeId,payload(receipts.slice(0,gave.length)),payload(receipts.slice(gave.length)),eligible,id,now,
   sender.player_id,sender.revision,recipient.player_id,recipient.revision),
 ...transferWrites(db,{record:sender,wallet:a,records:left,changes:aChanges},id,writeId,now),
 ...transferWrites(db,{record:recipient,wallet:b,records:right,changes:bChanges},id,writeId,now)];
 if(eligible)writes.push(db.prepare(`UPDATE game_trade_items AS i SET sample=(
  SELECT json_extract(value,'$.sample') FROM json_each(?) WHERE json_extract(value,'$.side')=i.side
   AND json_extract(value,'$.id')=i.level_id AND json_extract(value,'$.finish')=i.finish
  ) WHERE i.trade_id=? AND ${resolvedTrade}`).bind(payload(tradeSamples(receipts.slice(0,gave.length),receipts.slice(gave.length))),id,id,writeId));
 const [change]=await db.batch(writes);
 return Boolean(change.meta.changes);
}

async function resolveTrade(db,viewer,id,action,context){
 if(!isUuid(id))reject('Trade not found.',404);
 const status={accept:'completed',decline:'declined',cancel:'cancelled'}[action];
 for(let attempt=0;attempt<4;attempt++){
  const trade=ownedTrade(await getTrade(db,id),viewer.player_id),now=Date.now();
  const permitted=action==='cancel'?trade.sender_id:trade.recipient_id;
  if(permitted!==viewer.player_id)reject('This action is unavailable for this trade.',403);
  const current=statusAt(trade,now);
  if(current===status)return describeTrade(db,trade,viewer.player_id,now);
  if(current!=='pending')reject('This offer is already '+current+'.',409);
  const updated=action==='accept'?await acceptTrade(db,trade,context,now):Boolean((await db.prepare(`UPDATE game_trades
   SET status=?,resolved_at=? WHERE trade_id=? AND status='pending' AND expires_at>?
    AND EXISTS(SELECT 1 FROM game_profiles WHERE player_id=? AND banned_at IS NULL)`)
   .bind(status,now,id,now,viewer.player_id).run()).meta.changes);
  if(updated)return describeTrade(db,await getTrade(db,id),viewer.player_id,now);
 }
 reject('This trade changed. Refresh and try again.',409);
}

export async function trading(db,viewer,url,body,context){
 if(!viewer||viewer.owner.startsWith('guest:'))reject('Sign in to open Trading.',401);
 const params=url.searchParams,view=params.get('view')||'overview',now=Date.now();
 if(!body&&view==='quotes'){
  const id=Number(params.get('id'));
  if(!validCardId(id))reject('Choose a card to look up.');
  if(impossibleCover(id)&&!(await ownedSecrets(db,viewer.player_id)).includes(id))reject('That card is unavailable.',404);
  const finishes=Object.keys(finishLabels),quotes=await marketQuotes(db,finishes.map(finish=>({id,finish})),now);
  return {quotes:Object.fromEntries(finishes.map(finish=>[finish,quotes.get(tradeKey({id,finish}))]))};
 }
 requireLevel(viewer);
 if(body){
  const {action,args,requestId}=body;
  if(!isUuid(requestId)||!args||typeof args!=='object'||Array.isArray(args))reject('Choose a valid trade action.');
  if(action==='propose')return {trade:await proposal(db,viewer,args,requestId,context)};
  if(['accept','decline','cancel'].includes(action))return {trade:await resolveTrade(db,viewer,args.id,action,context)};
  reject('Choose a valid trade action.');
 }
 const page=Number(params.get('page')||0),term=(params.get('q')||'').trim().slice(0,80),id=params.get('id')||'';
 const finish=params.get('finish')||'',difficulty=params.get('tier')==null?null:Number(params.get('tier'));
 if(!Number.isSafeInteger(page)||page<0||page>1_000_000||(finish&&!validFinish(finish))||(difficulty!==null&&!validTradeMinimum(difficulty)))reject('Choose a valid filter.');
 if(view==='overview')return overview(db,viewer,now);
 if(['incoming','outgoing','history'].includes(view))return listTrades(db,viewer.player_id,view,page,now);
 if(view==='detail')return {trade:await describeTrade(db,ownedTrade(isUuid(id)&&await getTrade(db,id),viewer.player_id),viewer.player_id,now)};
 if(view==='market'){
  const secretIds=await ownedSecrets(db,viewer.player_id);
  if(difficulty===impossibleTier&&!secretIds.length)return {cards:[],more:false,hasSecrets:false};
  return {...await browseMarket(db,context.getPool,{term,tier:difficulty,finish:finish||'standard',page,now,secretIds}),hasSecrets:secretIds.length>0};
 }
 if(view==='find'){
  if(!tradePreferences(JSON.parse(viewer.wallet)).enabled)reject('Enable trading in Trade settings first.',403);
  const rows=await searchPlayers(db,term,{exclude:viewer.player_id,discordOnly:context.discordOnly,
   minXp:playerXpAtLevel(tradeLevel),enabledOnly:true});
  return {players:rows.map(directoryPlayer)};
 }
 if(!['partner','collection'].includes(view))reject('Unknown trade view.');
 const other=isUuid(id)&&await findPlayer(db,id);
 const {mine,theirs}=readyPair(viewer,other,context.discordOnly);
 if(view==='partner')return {player:directoryPlayer(other),minimum:{give:theirs.minimum,get:mine.minimum}};
 const side=params.get('side');
 if(!['give','get'].includes(side))reject('Choose which collection to view.');
 const own=side==='give',record=own?viewer:other;
 const {cards,more}=await browseCollection(db,record.player_id,JSON.parse(record.wallet),
  {term,finish,page,now,difficulty,secretIds:await ownedSecrets(db,viewer.player_id),minimum:own?theirs.minimum:mine.minimum});
 return {cards:await addMarketQuotes(db,cards,now),more};
}
