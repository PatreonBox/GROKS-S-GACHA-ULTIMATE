import {cardCategories,difficulties,createCardPool,mergeBlocked,normalizeWallet} from '../web/pack-engine.js';
import {newWallet,prepareGameAction} from '../web/game-rules.js';
import {campaignStages,stageCleared} from '../web/campaign.js';
import {mineEarnings,settleMine} from '../web/mine-economy.js';
import {createMergePlanner,gemTenths} from '../web/card-economy.js';
import {applySaveTransfer,prepareSaveTransfer} from './save-transfer.mjs';
import {collectionPower,powerIsCurrent,playerRank,rankedPlayer,playerStandings,rankingVersion} from './player-rankings.mjs';
import {maxPlayerLevel,playerProgress,playerXpAtLevel} from '../web/player-progression.js';
import {featureLevel} from '../web/level-access.js';
import {tradeLevelNotice} from '../web/trade-rules.js';
import {kingdomVisitors,settleKingdomVisitors} from './kingdom-visitors.mjs';
import {kingdomDefences,kingdomForges,kingdomHouses,maxTowerLevel,settleKingdomConstruction} from '../web/kingdom-rules.js';
import {bestCardShowcase,kingdomShowcase} from './player-showcases.mjs';
import {GameRequestError,one,reject,uuid} from './game-http.mjs';
import {trading} from './trading.mjs';
import {trainingLevels,updateAchievements} from '../web/progression-rules.js';
import {seedAchievements} from './progression.mjs';
import {playerModeration} from './player-moderation.mjs';

const guestCookie='__Host-gdlb-save';
const cookieLifetime=60*60*24*365;
const receiptLifetime=10*60*1000;
const maxBody=550000;
const maxTransferBody=2500000;
const encoder=new TextEncoder();
const banMessage='This account is banned from GD Kingdom.';
const json=(body,status=200,cookie)=>{
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 if(cookie)headers['Set-Cookie']=cookie;
 return Response.json(body,{status,headers});
};
const hex=bytes=>Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
const guestOwner=async token=>'guest:'+hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token))));

function sameOrigin(request){
 const origin=request.headers.get('origin');
 if(origin!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')
  reject('Open the game on this site to play.',403);
}
async function readBody(request,limit=maxBody){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))reject('JSON required.',415);
 if(!request.body||Number(request.headers.get('content-length'))>limit)reject('This action is too large.',413);
 const stream=request.body.getReader(),decoder=new TextDecoder();
 let length=0,text='';
 while(true){
  const {done,value}=await stream.read();
  if(done)break;
  length+=value.byteLength;
  if(length>limit){await stream.cancel();reject('This action is too large.',413);}
  text+=decoder.decode(value,{stream:true});
 }
 let body;
 try{body=JSON.parse(text+decoder.decode());}catch{reject('Invalid JSON.');}
 if(!body||typeof body!=='object'||Array.isArray(body))reject('Choose a valid game action.');
 return body;
}

function cookieSpec(url){
 // The secure prefix is used on the hosted HTTPS site. Local development has its own cookie.
 const secure=new URL(url).protocol==='https:';
 return {name:secure?guestCookie:'gdlb-preview-save',attributes:'; Path=/; HttpOnly; SameSite=Lax'+(secure?'; Secure':'')};
}
async function identity(request,db,initial,owner){
 const {name,attributes}=cookieSpec(request.url);
 const prefix=name+'=';
 const value=(request.headers.get('cookie')||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(prefix))?.slice(prefix.length);
 const token=/^[a-f0-9]{64}$/.test(value||'')?value:null;
 const guest=token?await guestOwner(token):null;
 if(owner){
  let cookie;
  if(initial&&guest){
   const claimed=await db.prepare(`UPDATE game_profiles SET owner=?,revision=revision+1
    WHERE owner=? AND NOT EXISTS(SELECT 1 FROM game_profiles WHERE owner=?)`).bind(owner,guest,owner).run();
   if(claimed.meta.changes)cookie=prefix+'; Max-Age=0'+attributes;
  }
  return {owner,cookie,signedIn:true};
 }
 if(guest)return {owner:guest,signedIn:false};
 if(!initial){
  if(request.method==='GET'&&new URL(request.url).pathname==='/api/players')return {owner:null,signedIn:false};
  reject('Open the game again to restore your save.',401);
 }
 const secret=hex(crypto.getRandomValues(new Uint8Array(32)));
 return {owner:await guestOwner(secret),cookie:prefix+secret+'; Max-Age='+cookieLifetime+attributes,signedIn:false};
}

async function profile(db,owner,create){
 const query='SELECT player_id,owner,revision,wallet,banned_at,leaderboard_excluded,collection_power,power_version FROM game_profiles WHERE owner=?';
 let record=await one(db,query,owner);
 if(record||!create)return record;
 await db.prepare('INSERT OR IGNORE INTO game_profiles(player_id,owner,wallet,updated_at) VALUES(?,?,?,?)')
  .bind(crypto.randomUUID(),owner,JSON.stringify(newWallet()),Date.now()).run();
 record=await one(db,query,owner);
 return record;
}

function visibleWallet(wallet){
 const {tapLimit,minePlayerXp,drills,remixRun,armyRun,armyReceipt,...review}=wallet;
 const now=Date.now();
 return {...review,kingdomClock:now,...(wallet.kingdom?.towerConstruction?{towerClock:now}:{}),...kingdomVisitors(wallet,now)};
}
async function inventory(db,id){
 const {results}=await db.prepare('SELECT card FROM game_cards WHERE player_id=?').bind(id).all();
 return results.map(entry=>JSON.parse(entry.card));
}

async function profileStats(db,record,collectibleIds,{adminOwner,discordOnly,admin,knownRank}){
 const wallet=normalizeWallet(JSON.parse(record.wallet));
 const {results}=await db.prepare(`SELECT level_id,json_extract(card,'$.copies') AS copies
  FROM game_cards WHERE player_id=?`).bind(record.player_id).all();
 let unique=0,copies=0;
 for(const entry of results){
  if(collectibleIds.has(entry.level_id))unique++;
  copies+=Math.max(0,entry.copies||0);
 }
 const privateRank=Boolean(admin||record.leaderboard_excluded||wallet.legacyTransfer);
 const rank=privateRank?null:knownRank??await playerRank(db,{adminOwner,discordOnly:Number(discordOnly),playerId:record.player_id,inventory});
 return {coins:wallet.coins+mineEarnings(wallet).coins,gems:wallet.gems,unique,copies,
  level:playerProgress(wallet.playerXp).level,rank,privateRank,
  power:powerIsCurrent(record)?record.collection_power:collectionPower(await inventory(db,record.player_id),wallet),
  collectible:collectibleIds.size,campaignTotal:campaignStages.length,
  campaignClears:campaignStages.reduce((count,_,i)=>count+Number(stageCleared(wallet,i+1)),0)};
}

async function commit(db,{owner,record,wallet,changes,requestId,result,now,power,transferId,admin=false,reset=false}){
 const id=record.player_id,version=record.revision+1;
 // Concurrent retries share a request ID. Only the winning write may update cards.
 const writeId=crypto.randomUUID();
 const guard='EXISTS(SELECT 1 FROM game_profiles WHERE player_id=? AND revision=? AND last_request=?)';
 const transferGuard=transferId?` AND NOT EXISTS(
  SELECT 1 FROM game_profiles WHERE json_extract(wallet,'$.legacyTransfer.id')=?)`:'';
 if(changes.size||reset)wallet.cardsRevision=version;
 const statements=[db.prepare(`UPDATE game_profiles SET wallet=?, revision=?, last_request=?,updated_at=?,
  leaderboard_excluded=MAX(leaderboard_excluded,?),collection_power=?,power_version=?,ranking_xp=?
  WHERE player_id=? AND owner=? AND revision=? AND banned_at IS NULL`+transferGuard)
  .bind(JSON.stringify(wallet),version,writeId,now,Number(admin),power,rankingVersion,wallet.playerXp||0,
   id,owner,record.revision,...(transferId?[transferId]:[]))];
 if(reset)statements.push(
  db.prepare('DELETE FROM game_cards WHERE player_id=? AND '+guard).bind(id,id,version,writeId),
  db.prepare('DELETE FROM game_scores WHERE player_id=? AND '+guard).bind(id,id,version,writeId)
 );
 const cards=[...changes.values()];
 for(let i=0;i<cards.length;i+=250){
  const chunk=JSON.stringify(cards.slice(i,i+250));
  statements.push(db.prepare(`INSERT INTO game_cards(player_id,level_id,card)
   SELECT ?,json_extract(value,'$.id'),value FROM json_each(?) WHERE ${guard}
   ON CONFLICT(player_id,level_id) DO UPDATE SET card=excluded.card`).bind(id,chunk,id,version,writeId));
 }
 statements.push(
  db.prepare(`INSERT OR IGNORE INTO game_requests(player_id,request_id,result,created_at)
   SELECT ?,?,?,? WHERE ${guard}`).bind(id,requestId,JSON.stringify(result),now,id,version,writeId),
  db.prepare('DELETE FROM game_requests WHERE player_id=? AND created_at<?').bind(id,now-receiptLifetime)
 );
 const [change]=await db.batch(statements);
 return Number(change.meta.changes)===1;
}

function adjustAdminWallet(wallet,args){
 const {field,mode,amount}=args||{};
 if(!Number.isFinite(amount)||amount<0)reject('Enter a valid amount.');
 if(field==='luck'&&(mode==='set'||mode==='add')){
  const next=(mode==='add'?(wallet.luck||0):0)+amount;
  if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(next))reject('Enter a whole luck percentage within the save limit.');
  wallet.luck=next;
  return {field,value:next};
 }
 if(field==='coins'&&(mode==='set'||mode==='add')){
  const next=(mode==='add'?wallet.coins:0)+amount;
  if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(next)||mode==='add'&&!amount)reject('Enter a whole coin amount within the wallet limit.');
  wallet.coins=next;
 }else if(field==='gems'&&mode==='set'){
  if(!Number.isSafeInteger(gemTenths(amount))||gemTenths(amount)/10!==amount)reject('Use at most one decimal place, within the gem balance limit.');
  wallet.gems=amount;
 }else if(field==='level'&&mode==='set'){
  const xp=playerXpAtLevel(amount);
  if(!Number.isSafeInteger(amount)||amount>maxPlayerLevel||!Number.isSafeInteger(xp))reject('Enter a level within the game limit.');
  wallet.playerXp=xp;
  return {field,value:amount};
 }else if(field==='mana'&&mode==='set'){
  if(!Number.isSafeInteger(amount))reject('Enter a whole Mana amount within the wallet limit.');
  wallet.kingdom={...wallet.kingdom,mana:amount};
  return {field,value:amount};
 }else if(field==='tower'&&mode==='set'){
  if(!Number.isInteger(amount)||amount<1||amount>maxTowerLevel)reject('Choose a tower level from 1 to '+maxTowerLevel+'.');
  if(wallet.kingdom?.towerConstruction)reject('Finish the current tower construction first.');
  wallet.kingdom={...wallet.kingdom,towerLevel:amount};
  return {field,value:amount};
 }else reject('Choose a valid admin adjustment.');
 return {field,value:wallet[field]};
}

function finishAdminConstruction(wallet,now){
 const sites=[wallet.kingdom?.towerConstruction,...[...kingdomHouses(wallet),...kingdomForges(wallet),...kingdomDefences(wallet)].map(item=>item.upgrade)].filter(Boolean);
 if(!sites.length)reject('Start a Kingdom upgrade first.');
 for(const site of sites)site.endsAt=Math.min(site.endsAt,now);
 return settleKingdomConstruction(wallet,now);
}

async function play(db,session,{action,args,requestId},getPool,hasArt,administrator){
 const testing=action==='admin.kingdom.finish';
 const admin=action==='admin.adjust'||action==='admin.reset'||testing;
 const reset=action==='admin.reset';
 if(admin&&!administrator)reject('Admin tools are unavailable for this account.',403);
 if(reset&&args?.confirmation!=='RESET')reject('Type RESET to confirm this save reset.');
 if(!uuid.test(typeof requestId==='string'?requestId:''))reject('Invalid game request.');
 let prepared;
 for(let attempt=0;attempt<4;attempt++){
  const record=await profile(db,session.owner,false);
  if(!record)reject('Reload the page to reconnect to your save.',401);
  if(record.banned_at!==null)reject(banMessage,403,{banned:true});
  const previous=await one(db,'SELECT result FROM game_requests WHERE player_id=? AND request_id=?',record.player_id,requestId);
  let wallet=normalizeWallet(JSON.parse(record.wallet));
  if(previous){
   // The receipt may have committed after the profile read.
   const current=await profile(db,session.owner,false);
   if(!current)reject('Reload the page to reconnect to your save.',401);
   if(current.banned_at!==null)reject(banMessage,403,{banned:true});
   return {wallet:visibleWallet(await seedAchievements(db,current.player_id,JSON.parse(current.wallet),Date.now())),saveRevision:current.revision,result:JSON.parse(previous.result)};
  }
  const changes=new Map(),now=Date.now();
  const trainingVersion=wallet.trainingRevision,battleWasActive=wallet.battle?.status==='active',trainingAction=['card.feed','drill.finish'].includes(action);
  let result,records;
  if(reset){
   const legacyTransfer=wallet.legacyTransfer;
   wallet=newWallet();
   if(legacyTransfer)wallet.legacyTransfer=legacyTransfer;
   result={reset:true};
  }else if(admin){
   await seedAchievements(db,record.player_id,wallet,now);
   settleMine(wallet,now);
   settleKingdomVisitors(wallet,now);
   if(testing)result=finishAdminConstruction(wallet,now);
   else{
    settleKingdomConstruction(wallet,now);
    result=adjustAdminWallet(wallet,args);
   }
   settleKingdomVisitors(wallet,now,true);
   updateAchievements(wallet,{},now);
  }else{
   try{prepared??=await prepareGameAction(action,args,getPool,hasArt);}
   catch(error){reject(error instanceof TypeError?'Choose a valid game action.':error.message);}
   if(prepared.cards)records=await inventory(db,record.player_id);
   await seedAchievements(db,record.player_id,wallet,now,records);
   const lastTraining=trainingAction?trainingLevels(wallet):0;
   const kingdomAction=action.startsWith('kingdom.');
   if(kingdomAction)settleKingdomVisitors(wallet,now);
   try{result=prepared.apply(wallet,records||[],changes,now,true);}
   catch(error){reject(error instanceof TypeError?'Choose a valid game action.':error.message);}
   if(kingdomAction)settleKingdomVisitors(wallet,now,true);
   updateAchievements(wallet,{cards:changes.values(),wins:Number(action==='arena.move'&&battleWasActive&&wallet.battle?.status==='won'),
    trained:trainingAction?Math.max(0,trainingLevels(wallet)-lastTraining):0},now);
  }
  let power=record.collection_power;
  if(reset)power=0;
  else if(!powerIsCurrent(record)||changes.size||wallet.trainingRevision!==trainingVersion){
   power=collectionPower(records??await inventory(db,record.player_id),wallet,changes);
  }
  if(await commit(db,{owner:session.owner,record,wallet,changes,requestId,result,now,power,admin,reset})){
   return {wallet:visibleWallet(wallet),saveRevision:record.revision+1,result};
  }
 }
 reject('Your save changed in another tab. Please try again.',409);
}

async function transferSave(db,session,body,getPool){
 if(typeof body.id!=='string'||!uuid.test(body.id))reject('This browser save could not be identified.');
 const transferId=body.id.toLowerCase();
 let prepared;
 for(let attempt=0;attempt<4;attempt++){
  const record=await profile(db,session.owner,false);
  if(!record)reject('Reload the page to reconnect to your save.',401);
  if(record.banned_at!==null)reject(banMessage,403,{banned:true});
  const wallet=normalizeWallet(JSON.parse(record.wallet));
  if(wallet.legacyTransfer){
   if(wallet.legacyTransfer.id!==transferId)reject('This online save already has a browser transfer.',409);
   return {wallet:visibleWallet(wallet),saveRevision:record.revision,result:wallet.legacyTransfer};
  }
  if(await one(db,"SELECT 1 FROM game_profiles WHERE json_extract(wallet,'$.legacyTransfer.id')=?",transferId))
   reject('This browser save was already transferred to another online save.',409);
  try{prepared??=await prepareSaveTransfer(body,getPool);}
  catch(error){reject(error.message);}
  const records=await inventory(db,record.player_id),now=Date.now();
  await seedAchievements(db,record.player_id,wallet,now,records);
  const {changes,result}=applySaveTransfer(wallet,records,prepared,now);
  updateAchievements(wallet,{cards:changes.values(),train:true},now);
  wallet.legacyTransfer={id:transferId,...result};
  if(JSON.stringify(wallet).length>1700000)reject('This browser save is too large to transfer.',413);
  const power=collectionPower(records,wallet,changes);
  if(await commit(db,{owner:session.owner,record,wallet,changes,requestId:crypto.randomUUID(),result,now,power,transferId})){
   return {wallet:visibleWallet(wallet),saveRevision:record.revision+1,result:wallet.legacyTransfer};
  }
 }
 reject('Your save changed in another tab. Please try again.',409);
}

export function gameRoutes(readJson,hasArt){
 const getPool=createCardPool(readJson);
 let collectibleIds,mergePlanner;
 function getCollectibleIds(){
  collectibleIds??=Promise.all(cardCategories.map(getPool)).then(pools=>{
   const ids=new Set();
   for(const rows of pools)for(const row of rows)ids.add(row[0]);
   return ids;
  }).catch(error=>{collectibleIds=undefined;throw error;});
  return collectibleIds;
 }
 async function gachaActivity(db,record){
  const wallet=JSON.parse(record.wallet);
  const cards=await inventory(db,record.player_id);
  if(!cards.length)return {unclaimed:0,latest:0,mergeReady:false};
  const collectible=await getCollectibleIds();
  const unclaimed=cards.filter(card=>card.row[6]!=='Auto'&&card.indexReward===undefined&&collectible.has(card.id)).length;
  const latest=cards.reduce((date,card)=>card.copies>0?Math.max(date,card.last||0):date,0);
  const candidates=cards.filter(card=>card.copies>=2&&!mergeBlocked(card,wallet));
  if(candidates.length){
   mergePlanner??=Promise.all(difficulties.map(getPool)).then(pools=>createMergePlanner(pools,difficulties))
    .catch(error=>{mergePlanner=undefined;throw error;});
   const plan=await mergePlanner;
   return {unclaimed,latest,mergeReady:candidates.some(card=>plan(card.row).near.length>0)};
  }
  return {unclaimed,latest,mergeReady:false};
 }
 return async function handleGame(request,env){
  const db=env?.DB;
  if(!db)return json({error:'The online save is temporarily unavailable.'},503);
  const chatgpt=!env.guestOnly;
  const accountProvider=env.discordEnabled?'discord':chatgpt?'chatgpt':null;
  const requiresSignIn=Boolean(env.discordEnabled);
  try{
   const url=new URL(request.url);
   if(!['GET','POST'].includes(request.method))reject('Method not supported.',405);
   const isTransfer=url.pathname==='/api/game/transfer';
   const isReport=url.pathname==='/api/game/report';
   if((isTransfer||isReport)&&request.method!=='POST')reject('Method not supported.',405);
   if(request.method==='POST')sameOrigin(request);
   const view=url.searchParams.get('view')||'wallet';
   const initial=request.method==='GET'&&view==='wallet'&&url.pathname==='/api/game';
   const subject=chatgpt?request.headers.get('oai-authenticated-user-id'):null;
   const owner=env.discordUser?'discord:'+env.discordUser:subject?'account:'+subject:null;
   const adminOwner=/^\d{17,20}$/.test(env.adminDiscordId||'')?'discord:'+env.adminDiscordId:'';
   const admin=Boolean(adminOwner&&owner===adminOwner);
   const account={signedIn:Boolean(owner),accountSignIn:Boolean(accountProvider),accountProvider,requiresSignIn};
   if(admin)account.admin=true;
   if(env.discordProfile)account.playerProfile=env.discordProfile;
   if(requiresSignIn&&!env.discordUser){
    if(initial)return json(account);
    reject('Sign in with Discord to play.',401);
   }
   if(owner&&await one(db,'SELECT 1 FROM game_profiles WHERE owner=? AND banned_at IS NOT NULL',owner)){
    if(initial)return json({...account,banned:true,error:banMessage});
    reject(banMessage,403,{banned:true});
   }
   if(isReport){
    if(!env.discordUser)reject('Sign in to report a bug.',401);
    if(!env.submitBugReport)reject('Bug reports are temporarily unavailable.',503);
    const {body,status}=env.submitBugReport(env.discordUser,env.discordProfile,await readBody(request,16_000));
    return json(body,status);
   }
   const session=await identity(request,db,initial,owner);
   if(url.pathname==='/api/admin/players'){
    if(!admin)reject('Admin tools are unavailable for this account.',403);
    const record=await profile(db,session.owner,false);
    return json(await playerModeration(db,record,url,request.method==='POST'?await readBody(request,4096):null));
   }
   if(url.pathname==='/api/trades'){
    const record=await profile(db,session.owner,false);
    return json(await trading(db,record,url,request.method==='POST'?await readBody(request,16000):null,
     {inventory,getPool,adminOwner,discordOnly:requiresSignIn}));
   }
   if(url.pathname==='/api/players'){
    const target=url.searchParams.get('player');
    if(target!==null&&request.method==='GET'){
     if(!uuid.test(target))reject('This player profile is unavailable.',404);
     const viewer=await profile(db,session.owner,false);
     const options={adminOwner,discordOnly:Number(requiresSignIn),playerId:viewer?.player_id||'',inventory};
     const player=await rankedPlayer(db,options,target);
     if(!player)reject('This player profile is unavailable.',404);
     const record=await one(db,'SELECT wallet,player_id,owner,leaderboard_excluded,collection_power,power_version FROM game_profiles WHERE player_id=?',target);
     const saved=record&&JSON.parse(record.wallet);
     if(!saved||record.leaderboard_excluded||record.owner===adminOwner||saved.legacyTransfer)reject('This player profile is unavailable.',404);
     if(saved.profileHidden&&!player.mine)reject('This player keeps their profile private.',403);
     const shareKingdom=(player.mine||saved.shareKingdom!==false)&&playerProgress(saved.playerXp).level>=featureLevel('kingdom');
     const shareBestCard=player.mine||saved.shareBestCard!==false;
     if(view==='kingdom'){
      if(!shareKingdom)reject('This Kingdom is unavailable to visit.',404);
      return json({kingdom:kingdomShowcase(saved)});
     }
     if(view==='best-card'){
      if(!shareBestCard)reject('This best card showcase is unavailable.',404);
      return json({bestCard:bestCardShowcase(await inventory(db,target),saved)});
     }
     const stats=await profileStats(db,record,await getCollectibleIds(),{...options,knownRank:player.place});
     return json({player,stats,showcases:{kingdom:shareKingdom,bestCard:shareBestCard&&stats.copies>0}});
    }
    return await standings(request,db,session,chatgpt,adminOwner,requiresSignIn,request.method==='GET'&&view==='trading');
   }
   if(isTransfer)return json({...await transferSave(db,session,await readBody(request,maxTransferBody),getPool),...account});
   if(request.method==='POST')return json({...await play(db,session,await readBody(request),getPool,hasArt,admin),...account});
   const record=await profile(db,session.owner,initial);
   if(!record)reject('Open the game to start your save.',401);
   if(view==='wallet')return json({wallet:visibleWallet(await seedAchievements(db,record.player_id,normalizeWallet(JSON.parse(record.wallet)),Date.now())),saveRevision:record.revision,...account},200,session.cookie);
   if(view==='kingdom-visitors'){const clock=Date.now();return json({'kingdom-visitors':{clock,...kingdomVisitors(JSON.parse(record.wallet),clock)}});}
   if(view==='cards')return json({cards:await inventory(db,record.player_id)});
   if(view==='gacha-activity')return json({activity:await gachaActivity(db,record)});
   if(view==='profile')return json({profile:await profileStats(db,record,await getCollectibleIds(),{adminOwner,discordOnly:requiresSignIn,admin})});
   reject('Unknown save view.');
  }catch(error){
   if(error instanceof GameRequestError)return json({error:error.message,...error.details},error.status);
   console.error('Game API failed:',error.message);
   return json({error:'The game server could not save this change. Try again.'},503);
  }
 };
}

async function standings(request,db,session,accountSignIn,adminOwner,discordOnly,trading){
 const record=await profile(db,session.owner,false);
 const wallet=record&&JSON.parse(record.wallet);
 const legacyProgress=Boolean(wallet?.legacyTransfer);
 const privateProfile=Boolean(record?.leaderboard_excluded||(adminOwner&&session.owner===adminOwner));
 const canPost=Boolean(record&&!privateProfile&&!legacyProgress&&(session.signedIn||!accountSignIn));
 if(trading){
  const level=featureLevel('trading');
  if(playerProgress(wallet?.playerXp).level<level)reject(tradeLevelNotice,403);
  return json({rows:[],notice:tradeLevelNotice});
 }
 if(request.method==='POST'){
  if(privateProfile)reject('This profile is excluded from public player rankings.',403);
  if(legacyProgress)reject('Transferred browser progress is playable online. Public rankings use progress earned online.',403);
  if(!canPost)reject(accountSignIn?'Sign in to post a score.':'Open the game to start your save.',401);
  const {alias}=await readBody(request);
  if(typeof alias!=='string'||!/^[\p{L}\p{N}_ .-]{2,24}$/u.test(alias.trim()))reject('Enter a 2–24 character player name.');
  const best=wallet?.arenaBest;
  if(!best)reject('Win an online arena battle before posting a score.');
  await db.prepare(`INSERT INTO game_scores(player_id,alias,tier,survivors,turns,score,posted_at)
   SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM game_profiles WHERE player_id=? AND banned_at IS NULL)
   ON CONFLICT(player_id) DO UPDATE SET
   alias=excluded.alias,tier=excluded.tier,survivors=excluded.survivors,turns=excluded.turns,
   score=excluded.score,posted_at=CASE WHEN excluded.score>game_scores.score THEN excluded.posted_at ELSE game_scores.posted_at END
   WHERE excluded.score>=game_scores.score`).bind(record.player_id,alias.trim(),best.tier,best.survivors,best.turns,best.score,Date.now(),record.player_id).run();
 }
 const rows=await playerStandings(db,{adminOwner,discordOnly:Number(discordOnly),playerId:record?.player_id||'',inventory});
 return json({rows,signedIn:session.signedIn,canPost,legacyProgress,privateProfile});
}
