import {combatStatsVersion,statsFor} from '../web/battle-engine.js';
import {playerProgress} from '../web/player-progression.js';

export function collectionPower(records,wallet,changes=new Map()){
 const owned=new Map(records.map(card=>[card.id,card]));
 for(const [id,card] of changes)owned.set(id,card);
 let power=0;
 for(const [id,card] of owned){
  if(!(card.copies>0)||!Array.isArray(card.row))continue;
  const stats=statsFor(card.row,wallet.training?.[id]);
  power+=stats.maxHp+3*stats.attack;
 }
 return Math.min(Number.MAX_SAFE_INTEGER,power);
}
export const powerIsCurrent=record=>record.power_version===combatStatsVersion&&record.collection_power!==null;
export const rankingVersion=combatStatsVersion;

const visibility=`
 p.leaderboard_excluded=0 AND p.owner<>? AND (?=0 OR p.owner LIKE 'discord:%')
 AND json_extract(p.wallet,'$.legacyTransfer.id') IS NULL`;

async function fillPlayerPower(db,adminOwner,discordOnly,inventory){
 const {results:players}=await db.prepare(`SELECT p.player_id,p.revision,p.wallet FROM game_profiles p
  WHERE ${visibility} AND (p.collection_power IS NULL OR p.power_version<>?)`).bind(adminOwner,discordOnly,rankingVersion).all();
 for(let i=0;i<players.length;i+=24){
  const changes=await Promise.all(players.slice(i,i+24).map(async row=>{
   const wallet=JSON.parse(row.wallet);
   const power=collectionPower(await inventory(db,row.player_id),wallet);
   return db.prepare('UPDATE game_profiles SET collection_power=?,power_version=?,ranking_xp=? WHERE player_id=? AND revision=?')
    .bind(power,rankingVersion,wallet.playerXp||0,row.player_id,row.revision);
  }));
  await db.batch(changes);
 }
}
function avatar(row){
 if(!/^\d{17,20}$/.test(row.discord_id||''))return null;
 if(/^(?:a_)?[a-f0-9]{32}$/.test(row.avatar_hash||''))return 'https://cdn.discordapp.com/avatars/'+row.discord_id+'/'+row.avatar_hash+'.webp?size=64';
 return 'https://cdn.discordapp.com/embed/avatars/'+(row.default_avatar_index??Number((BigInt(row.discord_id)>>22n)%6n))+'.png';
}

const rankingsQuery=`WITH ranked AS (
  SELECT p.player_id,p.collection_power AS power,p.ranking_xp AS xp,
   COALESCE(NULLIF(d.display_name,''),NULLIF(d.username,''),s.alias,'Player ' || substr(p.player_id,-4)) AS alias,
   d.discord_id,d.avatar_hash,d.default_avatar_index,
   ROW_NUMBER() OVER (ORDER BY p.collection_power DESC,p.ranking_xp DESC,p.player_id) AS place
  FROM game_profiles p
  LEFT JOIN game_discord_profiles d ON p.owner='discord:' || d.discord_id
  LEFT JOIN game_scores s ON p.player_id=s.player_id
  WHERE ${visibility} AND p.power_version=?
    AND (p.collection_power>0 OR p.ranking_xp>0 OR s.alias IS NOT NULL OR d.discord_id IS NOT NULL)
 )`;

export async function playerRank(db,{adminOwner,discordOnly,playerId,inventory}){
 await fillPlayerPower(db,adminOwner,discordOnly,inventory);
 const {results}=await db.prepare(rankingsQuery+' SELECT place FROM ranked WHERE player_id=?')
  .bind(adminOwner,discordOnly,rankingVersion,playerId).all();
 return results[0]?.place??null;
}

export async function playerStandings(db,{adminOwner,discordOnly,playerId,inventory}){
 await fillPlayerPower(db,adminOwner,discordOnly,inventory);
 const {results}=await db.prepare(rankingsQuery+' SELECT *,player_id=? AS mine FROM ranked WHERE place<=50 OR player_id=? ORDER BY place')
  .bind(adminOwner,discordOnly,rankingVersion,playerId,playerId).all();
 return results.map(row=>({place:row.place,alias:row.alias,level:playerProgress(row.xp).level,power:row.power,
  avatar:avatar(row),mine:Boolean(row.mine)}));
}
