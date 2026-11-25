import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import worker from '../dist/server/index.js';
import {createGameDatabase} from './game-preview-db.mjs';
import {createCardPool,difficulties,oddsFor,packs,rollPacks,packOddsVersion} from '../web/pack-engine.js';
import {armyFrame,makeArmyBattle,stepArmy} from '../web/army-battle.js';
import {armySignatureVersion,beginArmyRun} from '../web/army-trilogy.js';
import {makeBattle,playTurn} from '../web/battle-engine.js';
import {attackTiming,paintArmyCast} from '../web/combat-scene.js';
import {classicCampaignMoves,previousBossMoves} from '../web/main-list-moves.js';
import {skillsFor} from '../web/card-skills.js';
import {drillStep,activeDrillGate,makeDrill,stepDrill} from '../web/drill-physics.js';
import {seededRandom,drillInput} from '../web/game-replay.js';
import {findRemix} from '../web/remixes.js';
import {STEP,makeCourse,newAttempt,advanceRunner} from '../web/remix-physics.js';
import {stageFor,settleCampaignClear} from '../web/campaign.js';
import {levelRewardTenths} from '../web/card-economy.js';
import {mineMachineRate,mineSkillRequirements,mineSkills} from '../web/mine-economy.js';

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

test('Gacha activity reports fresh cards, unclaimed gems, and eligible merges',async()=>{
 const f=fixture(),session=await f.open();
 const row=(await pool('Easy')).at(-1);
 f.addCards(session.id,[row]);
 const at=Date.now()-10;
 f.sqlite.prepare("UPDATE game_cards SET card=json_set(card,'$.last',?) WHERE player_id=?").run(at,session.id);
 const activity=async()=>{
  const response=await f.call('/api/game?view=gacha-activity',session);
  assert.equal(response.status,200);
  return (await response.json()).activity;
 };
 assert.deepEqual(await activity(),{unclaimed:1,latest:at,mergeReady:true});
 const seen=await f.command(session,'collection.seen',{through:at});
 assert.equal((await seen.json()).wallet.collectionSeenThrough,at);
 assert.equal((await f.command(session,'collection.seen',{through:Date.now()+100000})).status,400);
 f.store(session.id,wallet=>{wallet.injuries={[row[0]]:Date.now()+100000};});
 assert.deepEqual(await activity(),{unclaimed:1,latest:at,mergeReady:false});
 const claim=await f.command(session,'card.claim',{tier:1,ids:[row[0]]});
 assert.equal(claim.status,200);
 assert.deepEqual(await activity(),{unclaimed:0,latest:at,mergeReady:false});
});

test('browser transfer keeps existing progress and commits once across retries',async()=>{
 const f=fixture(),session=await f.open(),other=await f.open();
 const [row]=await pool('Easy');
 f.store(session.id,wallet=>{wallet.coins=20000;wallet.gems=12;});
 f.addCards(session.id,[row]);
 const saved={id:crypto.randomUUID(),wallet:{coins:10000,gems:24,training:{[row[0]]:{xp:100}},
  campaign:{1:{turns:12,survivors:3,tempo:true,squad:true}},arenaBest:{tier:10,score:9999999}},
  cards:[[row[0],3,1,0,1,0.2],[Number.MAX_SAFE_INTEGER,1,0,0,0]]};
 const [first,retry]=await Promise.all([f.call('/api/game/transfer',{...session,body:saved}),
  f.call('/api/game/transfer',{...session,body:saved})]);
 assert.equal(first.status,200);
 assert.equal(retry.status,200);
 assert.deepEqual((await first.json()).result,{id:saved.id,cards:1,skipped:1});
 assert.deepEqual((await retry.json()).result,{id:saved.id,cards:1,skipped:1});
 const wallet=await f.wallet(session);
 assert.equal(wallet.coins,20000);
 assert.equal(wallet.gems,24);
 assert.equal(wallet.training[row[0]].xp,100);
 assert.equal(wallet.campaign[1].turns,12);
 assert.equal(wallet.arenaBest,undefined);
 assert.equal(f.sqlite.prepare('SELECT revision FROM game_profiles WHERE player_id=?').get(session.id).revision,1);
 const {cards}=await (await f.call('/api/game?view=cards',session)).json();
 assert.equal(cards.length,1);
 assert.equal(cards[0].copies,3);
 assert.equal(cards[0].holoCopies,1);
 assert.deepEqual(cards[0].row,row);
 assert.equal((await f.call('/api/game/transfer',{...session,body:{...saved,id:crypto.randomUUID()}})).status,409);
 assert.equal((await f.call('/api/game/transfer',{...other,body:saved})).status,409);
 assert.equal((await f.call('/api/players',{...session,body:{alias:'Player'}})).status,403);
 assert.equal((await f.wallet(other)).coins,1500);
});

test('server-clock mine earnings and idempotent credits',async()=>{
 const f=fixture(),session=await f.open();
 const id=crypto.randomUUID();
 for(const response of await Promise.all([f.command(session,'mine.tap',{count:18},id),f.command(session,'mine.tap',{count:18},id)])){
  assert.equal(response.status,200);
  assert.equal((await response.json()).result.gain,18);
 }
 assert.equal((await f.wallet(session)).coins,1518);
 for(const count of [0,25,1.5])assert.equal((await f.command(session,'mine.tap',{count})).status,400);
 f.store(session.id,w=>{w.mine={collectedAt:Date.now()-6*60*60*1000,machines:{cursor:1},skills:{},remainder:0};});
 const receipt=await f.command(session,'mine.collect').then(res=>res.json()).then(data=>data.result.receipt);
 assert.equal(receipt.elapsed,5*60*60*1000);
 assert(receipt.coins>0);
});

test('mine milestones double at 20 and the extra branches have prerequisites',()=>{
 const mine={machines:{mint:19},skills:{}};
 assert.equal(mineMachineRate(mine,'mint'),19*130);
 mine.machines.mint=20;
 assert.equal(mineMachineRate(mine,'mint'),20*130*2);
 assert.equal(mineSkills.length,28);
 assert.deepEqual(mineSkillRequirements({machines:{mint:8}},'receipts'),['Unlock Mint Network','Own 12 Shopkeepers']);
 assert.deepEqual(mineSkillRequirements({machines:{mint:12},skills:{network:true}},'receipts'),[]);
});

test('demon index gems follow the new payouts and Extreme rank range',async()=>{
 assert.deepEqual([6,7,8,9].map(tier=>levelRewardTenths(tier,0,0)),[25,30,40,60]);
 assert.deepEqual([1,51,101,0].map(rank=>levelRewardTenths(10,rank,101)),[120,95,70,70]);
 const f=fixture(),player=await f.open();
 const rows=(await pool('Easy Demon')).slice(0,2);
 f.addCards(player.id,rows);
 const oldCard={id:rows[0][0],row:rows[0],copies:2,indexReward:3};
 f.sqlite.prepare('UPDATE game_cards SET card=? WHERE player_id=? AND level_id=?').run(JSON.stringify(oldCard),player.id,oldCard.id);
 const {wallet}=await f.command(player,'card.claim',{tier:6,ids:rows.map(row=>row[0])}).then(response=>response.json());
 assert.equal(wallet.gems,12.5);
 const {cards}=await f.call('/api/game?view=cards',player).then(response=>response.json());
 assert.equal(cards.find(card=>card.id===oldCard.id).indexReward,3);
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

test('the renamed campaign stages use four opponents from their own difficulty',async()=>{
 const names=['RETRY','Fire in the Hole','Area confirmed','Rock on the Ground','Insane Classics',
  'REVIVE MOON','C','eight circles','Water Bound','Tie in a chess'];
 for(let i=0;i<names.length;i++){
  const stage=stageFor(i+1),ids=new Set((await pool(difficulties[i+1])).map(row=>row[0]));
  assert.equal(stage.name,names[i]);
  assert.equal(new Set(stage.team).size,4);
  for(const id of stage.team)assert.ok(ids.has(id),stage.name+' · '+id);
 }
 for(const [,id,name] of classicCampaignMoves)assert.equal(skillsFor({id,name}).signatureName,name);
});

test('Mythic rolls mostly Insane Demons and caps Extreme Demon odds with luck',async()=>{
 const mythic=packs.find(pack=>pack.id==='mythic');
 assert.deepEqual(oddsFor(mythic).slice(8).map(tier=>tier.percent),[2,88,10]);
 assert.deepEqual(oddsFor(mythic,0,{version:2}).slice(8).map(tier=>tier.percent),[0,40,60]);
 for(let luck=0;luck<=500;luck++){
  const odds=oddsFor(mythic,luck);
  assert.equal(odds.reduce((sum,tier)=>sum+tier.weight,0),1_000_000);
  assert.ok(odds[10].percent<=15&&odds[9].percent>80&&odds[8].weight>0);
 }
 const pools=await Promise.all(difficulties.map(pool));
 const run=rollPacks(mythic,1,{luck:500,bonus:0},pools,n=>n===1_000_000?849_999:0);
 assert.equal(run.packOddsVersion,packOddsVersion);
 assert.ok(run.rows.every(row=>row[6]==='Insane Demon'));
});

test('named signature moves cast in both engines and draw finite 3D geometry',async()=>{
 const profiles=[
  [135661111,'Leviathan Breach','leviathan'],[89496627,'Inferno Breath','infernoBreath'],
  [73667628,'Obsidian Chomp','obsidianChomp'],[27690100,'Blood Ward','bloodWard'],
  [90477539,'Courtroom Chalk','courtroomChalk']
 ];
 const extreme=new Map((await pool('Extreme Demon')).map(row=>[row[0],row]));
 const rivals=(await pool('Easy')).slice(0,4);
 const rotation={depth:[0,0,1],right:[1,0,0],down:[0,1,0]},random=()=>.5;
 for(const [id,name,visual] of profiles){
  const row=extreme.get(id),battle=makeBattle([row,...rivals.slice(1)],rivals,10,random);
  battle.seq=1;battle.charge=3;
  battle.allies[0].hp=Math.round(battle.allies[0].maxHp*.42);
  for(const foe of battle.enemies)foe.hp=foe.maxHp=5_000_000;
  battle.enemies[0].shield=1_000_000;
  playTurn({battle,coins:0},battle.id,battle.seq,'pulse',0,0,random);
  assert.ok(battle.events.some(e=>e.kind==='pulse'&&e.visual===visual&&e.name===name),name);
  if(visual==='bloodWard'){
   assert.ok(battle.events.some(e=>e.name==='Damage nullified'&&e.side==='allies'));
   assert.ok(battle.events.some(e=>e.kind==='retaliate'&&e.side==='allies'&&e.amount===0));
  }
  if(visual==='obsidianChomp')assert.equal(battle.enemies[0].shield,0);

  const army=makeArmyBattle([{row}],[{row:rivals[0]}],'harbor',10,random);
  const [[unit],[target]]=army.teams;
  Object.assign(unit,{ready:0,next:0,x:-20,y:0});
  Object.assign(target,{next:10,x:20,y:0,hp:10_000,maxHp:10_000});
  const cast=stepArmy(army,armyFrame).find(event=>event.kind==='cast')?.cast;
  assert.equal(cast?.event.visual,visual);
  assert.equal(cast.event.name,name);
  assert.ok(attackTiming(cast.event,false).duration>=1800);
  let faces=0;
  const geometry={surface(points){assert.ok(points.flat().every(Number.isFinite));faces++;}};
  for(const q of [.35,.54,.70,.86])paintArmyCast(geometry,{imageTexture:()=>null},rotation,cast,q);
  assert.ok(faces>=25,name);
 }
 const players=previousBossMoves.map(([,id])=>({row:extreme.get(id)}));
 const run={players,rivals:rivals.map(row=>({row})),map:'harbor',chapter:0,tier:10,seed:485};
 assert.deepEqual(beginArmyRun(run).teams[0].map(u=>u.kit.signatureName),previousBossMoves.map(row=>row[2]));
 assert.deepEqual(beginArmyRun({...run,signatureVersion:armySignatureVersion}).teams[0].map(u=>u.kit.signatureName),profiles.map(row=>row[1]));
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
 assert.equal(first.battle.earned,first.base*12+(stageFor(1).first+stageFor(1).master)*12);
 assert.equal(first.battle.campaignReceipt.clearPrize,7_200);
 assert.equal(second.battle.earned,Math.floor(second.base*.8));
 assert.equal(second.battle.campaignReceipt.clearPrize,0);
});
test('the final campaign stage pays its scaled prize once and preserves active legacy battles',()=>{
 const w={coins:800};
 const battle={campaign:10,campaignRewardVersion:2,seq:15,earned:800,enemies:[{hp:0,bounty:1000}]};
 settleCampaignClear(w,battle,2);
 assert.equal(battle.campaignReceipt.clearPrize,120_000_000_000);
 assert.equal(w.coins,120_000_012_000);
 const replay={...battle,seq:14,earned:800};
 settleCampaignClear(w,replay,3);
 assert.equal(replay.campaignReceipt.clearPrize,0);
 assert.equal(replay.campaignReceipt.masteryPrize,9_600_000);
 assert.equal(replay.earned,9_600_800);
 const legacy={campaign:10,seq:15,earned:2000,enemies:[{hp:0,bounty:1000}]},oldWallet={coins:2000};
 settleCampaignClear(oldWallet,legacy,2);
 assert.equal(oldWallet.coins,300_000_030_000);
});
