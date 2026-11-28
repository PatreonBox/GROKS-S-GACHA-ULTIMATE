import {achievementById,achievementVersion,bannerAchievementStat,updateAchievements as applyAchievementRewards} from '../web/progression-rules.js';
import {normalizeWallet} from '../web/pack-engine.js';
import {needsCoinNormalization} from '../web/coin-economy.js';
import {discoveredVisitors} from './kingdom-visitors.mjs';
import {one,reject} from './game-http.mjs';
import {initDemonKeys,releaseAchievementKeys} from '../web/demon-keys.js';
import {discoveryDifficulties,discoveryIndexVersion} from '../dist/discovery-index.mjs';

export const needsAchievementSeed=wallet=>wallet.achievementProgress?.version!==achievementVersion||
 wallet.achievementProgress.discoveryIndexVersion!==discoveryIndexVersion;
export function updateAchievements(wallet,progress,now){
 return applyAchievementRewards(wallet,{...progress,discoveryDifficulties},now);
}
const olderBattleWins=wallet=>Object.keys(wallet.campaign||{}).length+Object.values(wallet.remixWins||{}).reduce((sum,wins)=>sum+wins,0);
const fullSquadWon=battle=>battle?.status==='won'&&battle.allies?.length===4&&battle.allies.every(ally=>ally.hp>0);
const statisticsCache=new WeakMap();

export function achievementStatistics(db,{adminOwner,discordOnly},now=Date.now()){
 const scope=adminOwner+'/'+Number(discordOnly),saved=statisticsCache.get(db);
 if(saved?.scope===scope&&now<saved.expires)return saved.result;
 const result=one(db,`WITH players AS (
  SELECT wallet FROM game_profiles
  WHERE banned_at IS NULL AND leaderboard_excluded=0 AND owner<>? AND (?=0 OR owner LIKE 'discord:%')
 ), stages AS (
  SELECT stage.key AS id,COUNT(*) AS owners FROM players, json_each(players.wallet,'$.achievements') AS stage
  WHERE typeof(stage.key)='text' GROUP BY stage.key
 ) SELECT (SELECT COUNT(*) FROM players) AS players,
  (SELECT json_group_object(id,owners) FROM stages) AS earned`,adminOwner,Number(discordOnly)).then(row=>({
   players:row.players,earned:Object.fromEntries(Object.entries(JSON.parse(row.earned)).filter(([id])=>achievementById(id)))
  })).catch(error=>{
   if(statisticsCache.get(db)?.result===result)statisticsCache.delete(db);
   throw error;
  });
 statisticsCache.set(db,{scope,result,expires:now+30_000});
 return result;
}

function revealedBannerChests(pull,from,to){
 if(!Object.hasOwn(bannerAchievementStat,pull?.banner)||to<=from)return {};
 return {[bannerAchievementStat[pull.banner]]:to-from,
  bannerGuarantees:(pull.guarantees||[]).filter(({draw})=>draw>=from&&draw<to).length};
}

export async function seedAchievements(db,player,wallet,now,records,deferDemonKeys){
 initDemonKeys(wallet,now);
 if(!needsAchievementSeed(wallet))return;
 const progress=wallet.achievementProgress??={};
 const cardRows=records??(await db.prepare('SELECT card FROM game_cards WHERE player_id=?').bind(player).all())
  .results.map(row=>JSON.parse(row.card));
 if((progress.version||0)<2){
  if(progress.trades===undefined)progress.trades=(await one(db,"SELECT COUNT(*) AS count FROM game_trades WHERE status='completed' AND (sender_id=? OR recipient_id=?)",player,player)).count;
  progress.battle=Math.max(progress.battle||0,olderBattleWins(wallet),Number(Boolean(wallet.arenaBest)));
  progress.demonWins=Math.max(progress.demonWins||0,Number(wallet.arenaBest?.tier>=6));
  progress.packs=Math.max(progress.packs||0,(wallet.lastPull?.opened||0)+(wallet.pending?.opened||0));
  progress.merges=Math.max(progress.merges||0,wallet.lastMerge?.count||0);
 }
 if(progress.foilTrades===undefined)progress.foilTrades=(await one(db,`SELECT COUNT(*) AS count FROM game_trades
  WHERE status='completed' AND (sender_id=? OR recipient_id=?)
  AND EXISTS (SELECT 1 FROM json_each(offered) WHERE json_extract(value,'$.finish') IN ('holo','antimatter'))
  AND EXISTS (SELECT 1 FROM json_each(requested) WHERE json_extract(value,'$.finish') IN ('holo','antimatter'))`,player,player)).count;
 const lastFoils=wallet.lastMerge?.foilCount??wallet.lastMerge?.highlights?.reduce((sum,item)=>
  sum+(item.finish==='holo'||item.finish==='antimatter'||item.holo===true?item.count||0:0),0)??0;
 progress.foilMerges=Math.max(progress.foilMerges||0,lastFoils);
 progress.fullSquadWins=Math.max(progress.fullSquadWins||0,Number(fullSquadWon(wallet.battle)));
 const recentChests={};
 for(const pull of [wallet.lastPull,wallet.pending])for(const [key,count] of Object.entries(revealedBannerChests(pull,0,pull?.opened||0))){
  recentChests[key]=(recentChests[key]||0)+count;
 }
 for(const [key,count] of Object.entries(recentChests))progress[key]=Math.max(progress[key]||0,count);
 progress.version=achievementVersion;
 progress.discoveryIndexVersion=discoveryIndexVersion;
 updateAchievements(wallet,{records:cardRows,train:true,visitors:discoveredVisitors(wallet,now).length,deferDemonKeys},now);
}

export async function refreshAchievementWallet(db,record,now=Date.now()){
 for(let attempt=0;attempt<4;attempt++){
  if(!record)reject('Reload the page to reconnect to your save.',401);
  if(record.banned_at!==null)reject('This account is banned from GD Kingdom.',403,{banned:true});
  const prior=JSON.parse(record.wallet),coinMigration=needsCoinNormalization(prior);
  const wallet=normalizeWallet(prior),seed=needsAchievementSeed(wallet);
  const keyMigration=initDemonKeys(wallet,now);
  const originalXp=wallet.achievementRewardXp||0;
  const priorKeys=wallet.achievementKeysPaid||0;
  let visitors=0;
  if(seed)await seedAchievements(db,record.player_id,wallet,now);
  else if(wallet.kingdom){
   visitors=discoveredVisitors(wallet,now).length;
   updateAchievements(wallet,{visitors},now);
  }
  releaseAchievementKeys(wallet,now);
  const achievementKeysReleased=(wallet.achievementKeysPaid||0)-priorKeys;
  const changed=(wallet.achievementRewardXp||0)!==originalXp||achievementKeysReleased>0;
  // Untouched brand-new profiles only need the migration the first time they play.
  if(!coinMigration&&!keyMigration&&!changed&&(!seed||record.revision===0))return {wallet,saveRevision:record.revision};
  const {meta}=await db.prepare(`UPDATE game_profiles SET wallet=?,revision=revision+1,updated_at=?,ranking_xp=?
   WHERE player_id=? AND owner=? AND revision=? AND banned_at IS NULL`)
   .bind(JSON.stringify(wallet),now,wallet.playerXp||0,record.player_id,record.owner,record.revision).run();
  if(meta.changes)return {wallet,saveRevision:record.revision+1,achievementKeysReleased};
  record=await one(db,'SELECT player_id,owner,revision,wallet,banned_at FROM game_profiles WHERE player_id=? AND owner=?',record.player_id,record.owner);
 }
 reject('Your save changed in another tab. Please try again.',409);
}

export function achievementActionEvents(wallet,action,result,before){
 switch(action){
  case 'arena.move': {
   if(!before.battleActive)return {};
   const battle=wallet.battle;
   return {knockouts:Math.max(0,(battle?.kills||0)-before.kills),demonWins:Number(battle?.status==='won'&&battle.tier>=6),
    fullSquadWins:Number(fullSquadWon(battle))};
  }
  case 'pack.advance': {
   if(before.opened===undefined)return {};
   const pull=wallet.pending||wallet.lastPull;
   return {packs:pull.opened-before.opened,...revealedBannerChests(pull,before.opened,pull.opened)};
  }
  case 'card.merge': return {merges:wallet.lastMerge?.count||0,foilMerges:wallet.lastMerge?.foilCount||0};
  case 'mine.tap': return {taps:result.accepted};
  case 'kingdom.collect': return {mana:result.earned};
  case 'kingdom.gem-mine.collect': return {minedGems:result.earned};
  default: return {};
 }
}
