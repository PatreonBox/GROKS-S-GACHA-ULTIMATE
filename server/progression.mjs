import {updateAchievements} from '../web/progression-rules.js';
import {one} from './game-http.mjs';

export async function seedAchievements(db,player,wallet,now,records){
 if(wallet.achievementProgress)return wallet;
 const tradeCount=one(db,"SELECT COUNT(*) AS count FROM game_trades WHERE status='completed' AND (sender_id=? OR recipient_id=?)",player,player);
 const names=records??(await db.prepare("SELECT DISTINCT json_extract(card,'$.row[6]') AS difficulty FROM game_cards WHERE player_id=?")
  .bind(player).all()).results.map(row=>row.difficulty);
 const eraWins=Object.keys(wallet.campaign||{}).length+Object.values(wallet.remixWins||{}).reduce((sum,wins)=>sum+wins,0);
 updateAchievements(wallet,{cards:names,wins:Math.max(eraWins,Number(Boolean(wallet.arenaBest))),traded:(await tradeCount).count,train:true},now);
 return wallet;
}
