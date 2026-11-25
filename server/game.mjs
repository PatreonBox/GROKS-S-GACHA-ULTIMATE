import {createCardPool,normalizeWallet} from '../web/pack-engine.js';
import {newWallet,prepareGameAction} from '../web/game-rules.js';

const guestCookie='__Host-gdlb-save';
const cookieLifetime=60*60*24*365;
const receiptLifetime=10*60*1000;
const maxBody=550000;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const encoder=new TextEncoder();

class GameRequestError extends Error {
 constructor(message,status){super(message);this.status=status;}
}
const reject=(message,status=400)=>{throw new GameRequestError(message,status);};
const json=(body,status=200,cookie)=>{
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 if(cookie)headers['Set-Cookie']=cookie;
 return Response.json(body,{status,headers});
};
const one=async (db,query,...args)=>(await db.prepare(query).bind(...args).all()).results[0];
const hex=bytes=>Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
const guestOwner=async token=>'guest:'+hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token))));

function sameOrigin(request){
 const origin=request.headers.get('origin');
 if(origin!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')
  reject('Open the game on this site to play.',403);
}
async function readBody(request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))reject('JSON required.',415);
 if(!request.body||Number(request.headers.get('content-length'))>maxBody)reject('This action is too large.',413);
 const stream=request.body.getReader(),decoder=new TextDecoder();
 let length=0,text='';
 while(true){
  const {done,value}=await stream.read();
  if(done)break;
  length+=value.byteLength;
  if(length>maxBody){await stream.cancel();reject('This action is too large.',413);}
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
async function identity(request,db,initial,accountSignIn){
 const signed=accountSignIn?request.headers.get('oai-authenticated-user-id'):null;
 const {name,attributes}=cookieSpec(request.url);
 const prefix=name+'=';
 const value=(request.headers.get('cookie')||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(prefix))?.slice(prefix.length);
 const token=/^[a-f0-9]{64}$/.test(value||'')?value:null;
 const guest=token?await guestOwner(token):null;
 if(signed){
  const owner='account:'+signed;
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
 let record=await one(db,'SELECT player_id, revision, wallet FROM game_profiles WHERE owner=?',owner);
 if(record||!create)return record;
 await db.prepare('INSERT OR IGNORE INTO game_profiles(player_id,owner,wallet,updated_at) VALUES(?,?,?,?)')
  .bind(crypto.randomUUID(),owner,JSON.stringify(newWallet()),Date.now()).run();
 record=await one(db,'SELECT player_id, revision, wallet FROM game_profiles WHERE owner=?',owner);
 return record;
}

function visibleWallet(wallet){
 const {tapLimit,drills,remixRun,armyRun,armyReceipt,...review}=wallet;
 return review;
}
async function inventory(db,id){
 const {results}=await db.prepare('SELECT card FROM game_cards WHERE player_id=?').bind(id).all();
 return results.map(entry=>JSON.parse(entry.card));
}

async function commit(db,{owner,record,wallet,changes,requestId,result,now}){
 const id=record.player_id,version=record.revision+1;
 // Concurrent retries share a request ID. Only the winning write may update cards.
 const writeId=crypto.randomUUID();
 const guard='EXISTS(SELECT 1 FROM game_profiles WHERE player_id=? AND revision=? AND last_request=?)';
 const statements=[db.prepare(`UPDATE game_profiles SET wallet=?, revision=?, last_request=?,updated_at=?
  WHERE player_id=? AND owner=? AND revision=?`).bind(JSON.stringify(wallet),version,writeId,now,id,owner,record.revision)];
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

async function play(db,session,{action,args,requestId},getPool,hasArt){
 if(!uuid.test(typeof requestId==='string'?requestId:''))reject('Invalid game request.');
 let prepared;
 for(let attempt=0;attempt<4;attempt++){
  const record=await profile(db,session.owner,false);
  if(!record)reject('Reload the page to reconnect to your save.',401);
  const previous=await one(db,'SELECT result FROM game_requests WHERE player_id=? AND request_id=?',record.player_id,requestId);
  const wallet=normalizeWallet(JSON.parse(record.wallet));
  if(previous){
   // The receipt may have committed after the profile read.
   const current=await profile(db,session.owner,false);
   if(!current)reject('Reload the page to reconnect to your save.',401);
   return {wallet:visibleWallet(JSON.parse(current.wallet)),result:JSON.parse(previous.result)};
  }
  try{prepared??=await prepareGameAction(action,args,getPool,hasArt);}
  catch(error){reject(error instanceof TypeError?'Choose a valid game action.':error.message);}
  const records=prepared.cards?await inventory(db,record.player_id):[];
  const changes=new Map(),now=Date.now();
  let result;
  try{result=prepared.apply(wallet,records,changes,now,true);}
  catch(error){reject(error instanceof TypeError?'Choose a valid game action.':error.message);}
  if(await commit(db,{owner:session.owner,record,wallet,changes,requestId,result,now})){
   return {wallet:visibleWallet(wallet),result};
  }
 }
 reject('Your save changed in another tab. Please try again.',409);
}

export function gameRoutes(readJson,hasArt){
 const getPool=createCardPool(readJson);
 return async function handleGame(request,env){
  const db=env?.DB;
  if(!db)return json({error:'The online save is temporarily unavailable.'},503);
  const accountSignIn=!env.guestOnly;
  try{
   const url=new URL(request.url);
   if(!['GET','POST'].includes(request.method))reject('Method not supported.',405);
   if(request.method==='POST')sameOrigin(request);
   const view=url.searchParams.get('view')||'wallet';
   const initial=request.method==='GET'&&view==='wallet'&&url.pathname==='/api/game';
   const session=await identity(request,db,initial,accountSignIn);
   if(url.pathname==='/api/players')return await standings(request,db,session,accountSignIn);
   const account={signedIn:session.signedIn,accountSignIn};
   if(request.method==='POST')return json({...await play(db,session,await readBody(request),getPool,hasArt),...account});
   const record=await profile(db,session.owner,initial);
   if(!record)reject('Open the game to start your save.',401);
   if(view==='wallet')return json({wallet:visibleWallet(normalizeWallet(JSON.parse(record.wallet))),...account},200,session.cookie);
   if(view==='cards')return json({cards:await inventory(db,record.player_id)});
   reject('Unknown save view.');
  }catch(error){
   if(error instanceof GameRequestError)return json({error:error.message},error.status);
   console.error('Game API failed:',error.message);
   return json({error:'The game server could not save this change. Try again.'},503);
  }
 };
}

async function standings(request,db,session,accountSignIn){
 const record=await profile(db,session.owner,false);
 const canPost=Boolean(record&&(session.signedIn||!accountSignIn));
 if(request.method==='POST'){
  if(!canPost)reject(accountSignIn?'Sign in to post a score.':'Open the game to start your save.',401);
  const {alias}=await readBody(request);
  if(typeof alias!=='string'||!/^[\p{L}\p{N}_ .-]{2,24}$/u.test(alias.trim()))reject('Enter a 2–24 character player name.');
  const best=record&&JSON.parse(record.wallet).arenaBest;
  if(!best)reject('Win an online arena battle before posting a score.');
  await db.prepare(`INSERT INTO game_scores(player_id,alias,tier,survivors,turns,score,posted_at)
   VALUES(?,?,?,?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET
   alias=excluded.alias,tier=excluded.tier,survivors=excluded.survivors,turns=excluded.turns,
   score=excluded.score,posted_at=CASE WHEN excluded.score>game_scores.score THEN excluded.posted_at ELSE game_scores.posted_at END
   WHERE excluded.score>=game_scores.score`).bind(record.player_id,alias.trim(),best.tier,best.survivors,best.turns,best.score,Date.now()).run();
 }
 const {results}=await db.prepare(`WITH ranked AS (SELECT player_id,alias,tier,survivors,turns,
  ROW_NUMBER() OVER (ORDER BY score DESC,turns,posted_at,player_id) AS place FROM game_scores)
  SELECT place,alias,tier,survivors,turns,player_id=? AS mine FROM ranked WHERE place<=50 OR player_id=? ORDER BY place`)
  .bind(record?.player_id||'',record?.player_id||'').all();
 return json({rows:results,signedIn:session.signedIn,canPost});
}
