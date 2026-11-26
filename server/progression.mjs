import {achievementVersion,updateAchievements} from '../web/progression-rules.js';
import {normalizeWallet} from '../web/pack-engine.js';
import {discoveredVisitors} from './kingdom-visitors.mjs';
import {one,reject} from './game-http.mjs';

export const needsAchievementSeed=wallet=>wallet.achievementProgress?.version!==achievementVersion;
const olderBattleWins=wallet=>Object.keys(wallet.campaign||{}).length+Object.values(wallet.remixWins||{}).reduce((sum,wins)=>sum+wins,0);

export async function seedAchievements(db,player,wallet,now,records){
 if(!needsAchievementSeed(wallet))return;
 const progress=wallet.achievementProgress??={};
 const cardRows=records??(await db.prepare('SELECT card FROM game_cards WHERE player_id=?').bind(player).all())
  .results.map(row=>JSON.parse(row.card));
 if(progress.trades===undefined)progress.trades=(await one(db,"SELECT COUNT(*) AS count FROM game_trades WHERE status='completed' AND (sender_id=? OR recipient_id=?)",player,player)).count;
 progress.battle=Math.max(progress.battle||0,olderBattleWins(wallet),Number(Boolean(wallet.arenaBest)));
 progress.demonWins=Math.max(progress.demonWins||0,Number(wallet.arenaBest?.tier>=6));
 progress.packs=Math.max(progress.packs||0,(wallet.lastPull?.opened||0)+(wallet.pending?.opened||0));
 progress.merges=Math.max(progress.merges||0,wallet.lastMerge?.count||0);
 progress.version=achievementVersion;
 updateAchievements(wallet,{records:cardRows,train:true,visitors:discoveredVisitors(wallet,now).length},now);
}

export async function refreshAchievementWallet(db,record,now=Date.now()){
 for(let attempt=0;attempt<4;attempt++){
  if(!record)reject('Reload the page to reconnect to your save.',401);
  if(record.banned_at!==null)reject('This account is banned from GD Kingdom.',403,{banned:true});
  const wallet=normalizeWallet(JSON.parse(record.wallet)),seed=needsAchievementSeed(wallet);
  const originalXp=wallet.achievementRewardXp||0;
  let visitors=0;
  if(seed)await seedAchievements(db,record.player_id,wallet,now);
  else if(wallet.kingdom){
   visitors=discoveredVisitors(wallet,now).length;
   updateAchievements(wallet,{visitors},now);
  }
  const changed=(wallet.achievementRewardXp||0)!==originalXp;
  // Untouched brand-new profiles only need the migration the first time they play.
  if(!changed&&(!seed||record.revision===0))return {wallet,saveRevision:record.revision};
  const {meta}=await db.prepare(`UPDATE game_profiles SET wallet=?,revision=revision+1,updated_at=?,ranking_xp=?
   WHERE player_id=? AND owner=? AND revision=? AND banned_at IS NULL`)
   .bind(JSON.stringify(wallet),now,wallet.playerXp||0,record.player_id,record.owner,record.revision).run();
  if(meta.changes)return {wallet,saveRevision:record.revision+1};
  record=await one(db,'SELECT player_id,owner,revision,wallet,banned_at FROM game_profiles WHERE player_id=? AND owner=?',record.player_id,record.owner);
 }
 reject('Your save changed in another tab. Please try again.',409);
}

export function achievementActionEvents(wallet,action,result,before){
 switch(action){
  case 'arena.move': {
   if(!before.battleActive)return {};
   const battle=wallet.battle;
   return {knockouts:Math.max(0,(battle?.kills||0)-before.kills),demonWins:Number(battle?.status==='won'&&battle.tier>=6)};
  }
  case 'pack.advance': {
   if(before.opened===undefined)return {};
   const pull=wallet.pending||wallet.lastPull;
   return {packs:pull.opened-before.opened};
  }
  case 'card.merge': return {merges:wallet.lastMerge?.count||0};
  case 'mine.tap': return {taps:result.accepted};
  case 'kingdom.collect': return {mana:result.earned};
  case 'kingdom.gem-mine.collect': return {minedGems:result.earned};
  default: return {};
 }
}
