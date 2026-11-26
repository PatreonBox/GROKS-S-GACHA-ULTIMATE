import {playerProgress} from '../web/player-progression.js';
import {discordAvatar} from './player-rankings.mjs';
import {one} from './game-http.mjs';

const directory=`SELECT p.player_id,p.owner,p.wallet,p.revision,p.banned_at,p.leaderboard_excluded,
 d.username,d.display_name,d.avatar_hash,d.default_avatar_index,substr(p.owner,9) AS discord_id,s.alias
 FROM game_profiles p
 LEFT JOIN game_discord_profiles d ON p.owner='discord:' || d.discord_id
 LEFT JOIN game_scores s ON p.player_id=s.player_id`;

export function directoryPlayer(record){
 const wallet=JSON.parse(record.wallet);
 return {id:record.player_id,name:record.display_name||record.username||record.alias||'Player '+record.player_id.slice(-4),
  username:record.username||'',avatar:discordAvatar(record),level:playerProgress(wallet.playerXp).level};
}

export function findPlayer(db,playerId){return one(db,directory+' WHERE p.player_id=?',playerId);}

export async function searchPlayers(db,term,{exclude,discordOnly,minXp,enabledOnly=false,admin=false}){
 const query=term.trim().replace(/^@/,'');
 if(!query)return [];
 const byDiscordId=/^\d{17,20}$/.test(query);
 const nameMatch=`(instr(lower(d.username),lower(?))>0 OR instr(lower(d.display_name),lower(?))>0
  OR instr(lower(s.alias),lower(?))>0${byDiscordId?" OR p.owner='discord:' || ?":''}${admin?' OR p.player_id=?':''})`;
 const filters=[nameMatch,"p.owner NOT LIKE 'guest:%'",'p.player_id<>?'];
 const args=[query,query,query,...(byDiscordId?[query]:[]),...(admin?[query]:[]),exclude];
 if(discordOnly)filters.push("p.owner LIKE 'discord:%'");
 if(!admin)filters.push('p.banned_at IS NULL');
 if(Number.isFinite(minXp)){
  filters.push("json_extract(p.wallet,'$.playerXp')>=?");
  args.push(minXp);
 }
 if(enabledOnly)filters.push("COALESCE(json_extract(p.wallet,'$.trade.enabled'),1)<>0");
 const {results}=await db.prepare(directory+' WHERE '+filters.join(' AND ')+`
  ORDER BY CASE WHEN lower(d.username)=lower(?) THEN 0 WHEN lower(d.display_name)=lower(?) THEN 1 ELSE 2 END,
   COALESCE(d.username,d.display_name,s.alias),p.player_id LIMIT 20`)
  .bind(...args,query,query).all();
 return results;
}
