import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import worker from '../dist/server/index.js';
import {createGameDatabase} from './game-preview-db.mjs';
import {createCardPool} from '../web/pack-engine.js';
import {armyFrame,stepArmy} from '../web/army-battle.js';
import {beginArmyRun} from '../web/army-trilogy.js';
import {drillStep,activeDrillGate,makeDrill,stepDrill} from '../web/drill-physics.js';
import {seededRandom,drillInput} from '../web/game-replay.js';
import {findRemix} from '../web/remixes.js';
import {STEP,makeCourse,newAttempt,advanceRunner} from '../web/remix-physics.js';
import {stageFor,settleCampaignClear} from '../web/campaign.js';

const origin='https://game.example';
const pool=createCardPool(path=>JSON.parse(fs.readFileSync(new URL('../web'+path,import.meta.url),'utf8')));

function fixture() {
 const {DB,sqlite}=createGameDatabase();
 function call(path='/api/game',{cookie,subject,body,from=origin}={}){
  const headers=new Headers();
  if(cookie)headers.set('Cookie',cookie);
  if(subject)headers.set('oai-authenticated-user-id',subject);
  if(body){
   headers.set('Content-Type','application/json');
   headers.set('Origin',from);
  }
  return worker.fetch(new Request(origin+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),{DB});
 }
 async function open(subject){
  const response=await call('/api/game',{subject});
  assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie');
  const id=sqlite.prepare('SELECT player_id FROM game_profiles ORDER BY rowid DESC LIMIT 1').get().player_id;
  return {cookie:cookie?.split(';')[0],subject,id};
 }
 const command=(session,action,args={},requestId=crypto.randomUUID())=>call('/api/game',{...session,body:{action,args,requestId}});
 const wallet=session=>call('/api/game',{...session}).then(r=>r.json()).then(data=>data.wallet);
 const store=(id,update)=>{
  const {wallet}=sqlite.prepare('SELECT wallet FROM game_profiles WHERE player_id=?').get(id);
  const state=JSON.parse(wallet);update(state);
  sqlite.prepare('UPDATE game_profiles SET wallet=? WHERE player_id=?').run(JSON.stringify(state),id);
 };
 const addCards=(id,rows)=>{
  const add=sqlite.prepare('INSERT INTO game_cards(player_id,level_id,card) VALUES(?,?,?)');
  for(const row of rows)add.run(id,row[0],JSON.stringify({id:row[0],row,copies:2,holoCopies:0,antimatterCopies:0}));
 };
 return {call,open,command,wallet,store,addCards,sqlite};
}

test('guest profiles stay isolated and actions require the game origin',async()=>{
 const f=fixture(),a=await f.open(),b=await f.open();
 assert.notEqual(a.cookie,b.cookie);
 assert.match(a.cookie,/^__Host-gdlb-save=[a-f0-9]{64}$/);
 assert.equal((await f.command({},'mine.tap')).status,401);
 assert.equal((await f.call('/api/game',{...a,from:'https://elsewhere.example',
  body:{action:'mine.tap',args:{},requestId:crypto.randomUUID()}})).status,403);
 assert.equal((await f.command(a,'wallet.set',{coins:9000000})).status,400);
 assert.equal((await f.command(a,'mine.code',{code:'john'})).status,200);
 assert.equal((await f.wallet(a)).coins,11500);
 assert.equal((await f.wallet(b)).coins,1500);
});

test('pack purchase commits the debit, cards, and receipt together',async()=>{
 const f=fixture(),session=await f.open(),id=crypto.randomUUID();
 const requests=await Promise.all([f.command(session,'pack.buy',{packId:'common',quantity:1},id),
  f.command(session,'pack.buy',{packId:'common',quantity:1},id)]);
 const pulls=await Promise.all(requests.map(async res=>{assert.equal(res.status,200);return (await res.json()).wallet.pending;}));
 assert.equal(pulls[0].id,pulls[1].id);
 assert.equal((await f.wallet(session)).coins,1400);
 const {cards}=await (await f.call('/api/game?view=cards',session)).json();
 assert.equal(cards.reduce((sum,entry)=>sum+entry.copies,0),5);
 assert.equal((await f.command(session,'pack.buy',{packId:'common',quantity:1})).status,400);
 assert.equal((await f.command(session,'pack.advance',{id:pulls[0].id,opened:1})).status,200);
 assert.equal((await f.wallet(session)).pending,null);
});

test('server-clock mine earnings and idempotent credits',async()=>{
 const f=fixture(),session=await f.open();
 const id=crypto.randomUUID();
 for(const response of await Promise.all([f.command(session,'mine.tap',{},id),f.command(session,'mine.tap',{},id)]))assert.equal(response.status,200);
 assert.equal((await f.wallet(session)).coins,1501);
 f.store(session.id,w=>{w.mine={collectedAt:Date.now()-6*60*60*1000,machines:{cursor:1},skills:{},remainder:0};});
 const receipt=await f.command(session,'mine.collect').then(res=>res.json()).then(data=>data.result.receipt);
 assert.equal(receipt.elapsed,5*60*60*1000);
 assert(receipt.coins>0);
});

test('sign-in claims a verified guest save and preserves its cards',async()=>{
 const f=fixture(),guest=await f.open();
 await f.command(guest,'pack.buy',{packId:'common',quantity:1});
 const signIn=await f.call('/api/game',{...guest,subject:'fixture-account'});
 assert.equal(signIn.status,200);
 assert((await signIn.json()).signedIn);
 assert.match(signIn.headers.get('set-cookie'),/Max-Age=0/);
 const synced=await f.wallet({subject:'fixture-account'});
 assert.equal(synced.coins,1400);
 const {cards}=await f.call('/api/game?view=cards',{subject:'fixture-account'}).then(res=>res.json());
 assert.equal(cards.reduce((sum,card)=>sum+card.copies,0),5);
});

test('arena scores use server-owned turns and reject client-only records',async()=>{
 const f=fixture(),player=await f.open('arena-tester');
 assert.equal((await f.call('/api/players',{...player,body:{alias:'Fixture',tier:10,turns:1,survivors:4}})).status,400);
 const rows=(await pool('Extreme Demon')).slice(0,4),ids=rows.map(row=>row[0]);
 assert.equal((await f.command(player,'arena.begin',{ids,tier:1,remixId:null,campaign:false})).status,400);
 f.addCards(player.id,rows);
 let response=await f.command(player,'arena.begin',{ids,tier:1,remixId:null,campaign:false});
 assert.equal(response.status,200);
 let {battle}= (await response.json()).wallet;
 for(let turn=0;battle.status==='active'&&turn<15;turn++){
  const target=battle.enemies.findIndex(u=>u.hp>0);
  response=await f.command(player,'arena.move',{id:battle.id,seq:battle.seq,move:'strike',target,actor:battle.turn});
  assert.equal(response.status,200);
  battle=(await response.json()).wallet.battle;
 }
 assert.equal(battle.status,'won');
 const board=await f.call('/api/players',{...player,body:{alias:'Fixture',tier:10,turns:1,survivors:4}});
 assert.equal(board.status,200);
 const {rows:posted}=await board.json();
 assert.equal(posted[0].tier,1);
 assert.equal(posted[0].turns,battle.seq);
});

test('minigame rewards are derived by replaying legal controls',async()=>{
 const f=fixture(),player=await f.open();
 const row=(await pool('Easy'))[0];
 f.addCards(player.id,[row]);
 const drill=await f.command(player,'drill.begin',{id:row[0],kind:'saw'}).then(res=>res.json()).then(data=>data.result);
 assert.equal((await f.command(player,'drill.finish',{token:drill.token,proof:99})).status,400);
 const run=makeDrill('saw',seededRandom(drill.seed)),aim=activeDrillGate(run).x;
 drillInput(run,'aim',aim);
 const ticks=300;
 for(let i=0;i<ticks;i++)stepDrill(run,drillStep);
 assert(run.score>=1&&!run.failed);
 f.store(player.id,w=>{w.drills[drill.token].start-=4000;});
 const partial=await f.command(player,'drill.checkpoint',{token:drill.token,proof:{from:0,ticks:140,trace:[[0,'aim',aim]]}});
 assert.equal(partial.status,200);
 const saved=await f.command(player,'drill.finish',{token:drill.token,proof:{from:140,ticks,trace:[]}});
 assert.equal(saved.status,200);
 assert.equal((await saved.json()).wallet.drillBest[row[0]].saw,run.score);
 assert.equal((await f.command(player,'drill.finish',{token:drill.token,proof:{ticks,trace:[]}})).status,400);
 const remix=findRemix(6508283),course=makeCourse(remix),runner=newAttempt(course);
 const attempt=await f.command(player,'remix.begin',{id:remix.id}).then(res=>res.json()).then(data=>data.result);
 let frames=0;
 do{frames++;}while(advanceRunner(runner,course,remix,STEP)==='running');
 f.store(player.id,w=>{w.remixRun.start-=frames*STEP*1000+1000;});
 const record=await f.command(player,'remix.finish',{token:attempt.token,proof:{ticks:frames,trace:[],key:null}});
 assert.equal(record.status,200);
 assert((await record.json()).result.percent<100);
});

test('Army rewards are replayed from a server-issued deployment and paid once',async()=>{
 const f=fixture(),player=await f.open();
 const rows=(await pool('Extreme Demon')).slice(0,4);
 f.addCards(player.id,rows);
 const request=await f.command(player,'army.begin',{map:'harbor',chapter:0,tier:1,ids:rows.map(row=>row[0])});
 assert.equal(request.status,200);
 const {result:run}=await request.json();
 assert.equal((await f.command(player,'army.finish',{id:run.id,frames:0,withdrawn:false})).status,400);
 const battle=beginArmyRun(run);
 while(battle.status==='fighting')stepArmy(battle,armyFrame);
 assert.equal(battle.status,'won');
 f.store(player.id,w=>{w.armyRun.started-=300000;});
 const complete=await f.command(player,'army.finish',{id:run.id,frames:battle.frames,withdrawn:false});
 assert.equal(complete.status,200);
 const {wallet,result}=await complete.json();
 assert(result.coins>0&&result.gems>0);
 const replay=await f.command(player,'army.finish',{id:run.id,frames:battle.frames,withdrawn:false}).then(r=>r.json());
 assert.equal(replay.wallet.coins,wallet.coins);
 assert.equal(replay.wallet.gems,wallet.gems);
});

test('campaign first clears and replays award different bounties once',async()=>{
 const f=fixture(),player=await f.open();
 const rows=(await pool('Extreme Demon')).slice(0,4);
 f.addCards(player.id,rows);
 const args={ids:rows.map(row=>row[0]),tier:1,remixId:null,campaign:true};
 async function clear(){
  const start=await f.command(player,'arena.begin',args);
  assert.equal(start.status,200);
  let {battle}=(await start.json()).wallet;
  const base=battle.enemies.reduce((sum,unit)=>sum+unit.bounty,0);
  for(let i=0;battle.status==='active'&&i<12;i++){
   const move=await f.command(player,'arena.move',{id:battle.id,seq:battle.seq,move:'strike',
    target:battle.enemies.findIndex(u=>u.hp>0),actor:battle.turn});
   assert.equal(move.status,200);
   battle=(await move.json()).wallet.battle;
  }
  assert.equal(battle.status,'won');
  return {base,battle};
 }
 const first=await clear(),second=await clear();
 assert.equal(first.battle.earned,first.base*30+(stageFor(1).first+stageFor(1).master)*30);
 assert.equal(first.battle.campaignReceipt.clearPrize,18_000);
 assert.equal(second.battle.earned,second.base*2);
 assert.equal(second.battle.campaignReceipt.clearPrize,0);
});
test('The Last Gate pays its 300 billion first-clear prize only once',()=>{
 const w={coins:2000};
 const battle={campaign:10,seq:15,earned:2000,enemies:[{hp:0,bounty:1000}]};
 settleCampaignClear(w,battle,2);
 assert.equal(battle.campaignReceipt.clearPrize,300_000_000_000);
 assert.equal(w.coins,300_000_030_000);
 const replay={campaign:10,seq:14,earned:2000,enemies:[{hp:0,bounty:1000}]};
 settleCampaignClear(w,replay,3);
 assert.equal(replay.campaignReceipt.clearPrize,0);
 assert.equal(replay.campaignReceipt.masteryPrize,24_000_000);
 assert.equal(replay.earned,24_002_000);
});
