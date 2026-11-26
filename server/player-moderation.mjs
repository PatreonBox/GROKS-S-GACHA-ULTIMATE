import {normalizeWallet} from '../web/pack-engine.js';
import {settleMine} from '../web/mine-economy.js';
import {maxPlayerLevel,playerProgress,playerXpAtLevel} from '../web/player-progression.js';
import {directoryPlayer,findPlayer,searchPlayers} from './player-directory.mjs';
import {isUuid,one,reject} from './game-http.mjs';

function managePlayer(record){
 const {coins}=JSON.parse(record.wallet);
 return {...directoryPlayer(record),coins,bannedAt:record.banned_at};
}

const byWrite='EXISTS(SELECT 1 FROM game_profiles WHERE player_id=? AND last_request=?)';

async function moderate(db,actor,body){
 const {id,action,amount,requestId}=body;
 if(!isUuid(id)||!isUuid(requestId)||id===actor.player_id)reject('Choose another player.');
 if(!['level','coins','ban','unban'].includes(action))reject('Choose a valid player action.');
 if(['level','coins'].includes(action)&&(!Number.isSafeInteger(amount)||amount<0))reject('Enter a valid whole number.');
 if(action==='level'&&(amount>maxPlayerLevel||!Number.isSafeInteger(playerXpAtLevel(amount))))reject('Enter a level within the game limit.');
 for(let attempt=0;attempt<4;attempt++){
  const record=await findPlayer(db,id);
  if(!record||!record.owner.startsWith('discord:'))reject('Player not found.',404);
  const previous=await one(db,'SELECT player_id,action FROM game_admin_player_actions WHERE admin_id=? AND request_id=?',actor.player_id,requestId);
  if(previous){
   if(previous.player_id!==id||previous.action!==action)reject('This request has already been used.',409);
   return managePlayer(await findPlayer(db,id));
  }
  const now=Date.now(),writeId=crypto.randomUUID(),wallet=normalizeWallet(JSON.parse(record.wallet));
  const result={previous:action==='coins'?wallet.coins:action==='level'?playerProgress(wallet.playerXp).level:record.banned_at};
  let banned=record.banned_at;
  if(action==='level')wallet.playerXp=playerXpAtLevel(amount);
  if(action==='coins'){settleMine(wallet,now);wallet.coins=amount;}
  if(action==='ban')banned=banned??now;
  if(action==='unban')banned=null;
  if(action==='level'||action==='coins')wallet.marketExcluded=true;
  result.value=action==='coins'||action==='level'?amount:banned;
  const writes=[db.prepare(`UPDATE game_profiles SET wallet=?,revision=revision+1,updated_at=?,last_request=?,ranking_xp=?,banned_at=?
    WHERE player_id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM game_admin_player_actions WHERE admin_id=? AND request_id=?)`)
   .bind(JSON.stringify(wallet),now,writeId,wallet.playerXp||0,banned,id,record.revision,actor.player_id,requestId),
  db.prepare(`INSERT INTO game_admin_player_actions(admin_id,request_id,player_id,action,result,created_at)
    SELECT ?,?,?,?,?,? WHERE ${byWrite}`).bind(actor.player_id,requestId,id,action,JSON.stringify(result),now,id,writeId)];
  if(action==='ban')writes.push(db.prepare(`UPDATE game_trades SET status='cancelled',resolved_at=?
    WHERE status='pending' AND expires_at>? AND (sender_id=? OR recipient_id=?) AND ${byWrite}`)
   .bind(now,now,id,id,id,writeId));
  const [updated]=await db.batch(writes);
  if(updated.meta.changes)return managePlayer(await findPlayer(db,id));
 }
 reject('This save changed. Refresh and try again.',409);
}

export async function playerModeration(db,actor,url,body){
 if(!actor)reject('Open the game before using admin tools.',401);
 if(body)return {player:await moderate(db,actor,body)};
 const term=(url.searchParams.get('q')||'').slice(0,80);
 const players=await searchPlayers(db,term,{exclude:actor.player_id,discordOnly:true,admin:true});
 return {players:players.map(managePlayer)};
}
