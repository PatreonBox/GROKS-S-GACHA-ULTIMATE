import {demonKeyDiscordBonus,keyLimit,rewardDemonKeys,initDemonKeys} from '../web/demon-keys.js';
import {one,reject} from './game-http.mjs';

const pageSize=30;
const bonusRecord=(db,id)=>one(db,'SELECT redeemed_at FROM game_discord_key_bonus WHERE discord_id=?',id);

export async function grantDiscordKeyBonus(db,record,id,now=Date.now()){
 const bonus=await bonusRecord(db,id);
 if(!bonus||bonus.redeemed_at!==null)return {record,verified:Boolean(bonus),claimed:Boolean(bonus)};
 const owner='discord:'+id;
 for(let attempt=0;attempt<4&&record?.banned_at===null;attempt++){
  const wallet=JSON.parse(record.wallet);
  initDemonKeys(wallet,now);
  if(wallet.demonKeys>keyLimit-demonKeyDiscordBonus)return {record,verified:true,claimed:false};
  rewardDemonKeys(wallet,demonKeyDiscordBonus,now);
  const updated=JSON.stringify(wallet);
  const [credited]=await db.batch([
   db.prepare(`UPDATE game_profiles SET wallet=?,revision=revision+1,updated_at=?
    WHERE player_id=? AND owner=? AND revision=? AND banned_at IS NULL
     AND EXISTS(SELECT 1 FROM game_discord_key_bonus WHERE discord_id=? AND redeemed_at IS NULL)`)
    .bind(updated,now,record.player_id,owner,record.revision,id),
   db.prepare(`UPDATE game_discord_key_bonus SET redeemed_at=?
    WHERE discord_id=? AND redeemed_at IS NULL AND changes()=1`).bind(now,id)
  ]);
  if(credited.meta.changes){
   return {record:{...record,wallet:updated,revision:record.revision+1},verified:true,claimed:true,keyBonus:{keys:demonKeyDiscordBonus}};
  }
  const current=await one(db,'SELECT player_id,owner,wallet,revision,banned_at FROM game_profiles WHERE owner=?',owner);
  const receipt=await bonusRecord(db,id);
  if(receipt?.redeemed_at!=null)return {record:current,verified:true,claimed:true};
  record=current;
 }
 return {record,verified:true,claimed:false};
}

export async function playerNotifications(db,player,body){
 if(body){
  const {through,id}=body;
  const cutoff=Number.isSafeInteger(through)&&through>0&&id===undefined;
  const single=Number.isSafeInteger(id)&&id>0&&through===undefined;
  if(!cutoff&&!single)reject('Choose a notification to mark read.');
  await db.prepare(`UPDATE game_notifications SET read_at=? WHERE player_id=? AND read_at IS NULL AND id ${cutoff?'<=':'='} ?`)
   .bind(Date.now(),player,cutoff?through:id).run();
 }
 const {results}=await db.prepare(`WITH unread AS (
  SELECT COUNT(*) AS count FROM game_notifications WHERE player_id=? AND read_at IS NULL
 ) SELECT unread.count AS unread,n.id,n.kind,n.trade_id,n.created_at,n.read_at,
  COALESCE(NULLIF(d.display_name,''),NULLIF(d.username,''),s.alias) AS player_name
  FROM unread LEFT JOIN game_notifications n ON n.player_id=?
  LEFT JOIN game_trades t ON t.trade_id=n.trade_id
  LEFT JOIN game_profiles p ON p.player_id=CASE WHEN t.sender_id=n.player_id THEN t.recipient_id ELSE t.sender_id END
  LEFT JOIN game_discord_profiles d ON p.owner='discord:'||d.discord_id
  LEFT JOIN game_scores s ON p.player_id=s.player_id
  ORDER BY n.id DESC LIMIT ?`).bind(player,player,pageSize).all();
 return {unread:results[0]?.unread||0,list:results.filter(row=>row.id!==null).map(row=>({
  id:row.id,kind:row.kind,tradeId:row.trade_id,createdAt:row.created_at,read:row.read_at!==null,playerName:row.player_name
 }))};
}
