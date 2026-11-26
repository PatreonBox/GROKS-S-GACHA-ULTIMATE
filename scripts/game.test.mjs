import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {Group} from 'three';
import worker from '../dist/server/index.js';
import {createGameDatabase} from './game-preview-db.mjs';
import {createCardPool,difficulties,oddsFor,packs,rollPacks,packOddsVersion} from '../web/pack-engine.js';
import {armyFrame,makeArmyBattle,stepArmy} from '../web/army-battle.js';
import {armySignatureVersion,beginArmyRun} from '../web/army-trilogy.js';
import {makeBattle,playTurn,statsFor} from '../web/battle-engine.js';
import {attackTiming,paintArmyCast} from '../web/combat-scene.js';
import {classicCampaignMoves,previousBossMoves} from '../web/main-list-moves.js';
import {skillsFor} from '../web/card-skills.js';
import {drillStep,activeDrillGate,makeDrill,stepDrill} from '../web/drill-physics.js';
import {seededRandom,drillInput} from '../web/game-replay.js';
import {findRemix} from '../web/remixes.js';
import {STEP,makeCourse,newAttempt,advanceRunner,tunnelAt} from '../web/remix-physics.js';
import {stageFor,settleCampaignClear} from '../web/campaign.js';
import {extremeOdds,extremeStage,extremeTable,levelRewardTenths} from '../web/card-economy.js';
import {mineMachineRate,mineSkillRequirements,mineSkills} from '../web/mine-economy.js';
import {playerProgress,packPlayerXp,packXpAllowance} from '../web/player-progression.js';
import {featureLevel,levelCue,packLevels,unlockedBetween} from '../web/level-access.js';
import {buildingFootprint,forgePlan,gemMine,gemMinePlan,housePlacementError,insideFootprint,kingdomBounds,kingdomDaylight,kingdomStats,visitorSlots} from '../web/kingdom-rules.js';
import {kingdomSuggestions,kingdomSuggestionStatus,recommendedKingdomUpgrade} from '../web/kingdom-suggestions.js';
import {limboChoiceAt,limboPattern} from '../web/limbo-keys.js';
import {achievements,achievementProgress} from '../web/progression-rules.js';
import {kingdomVisitors} from '../server/kingdom-visitors.mjs';
import {kingdomNavigation} from '../client/kingdom-navigation.js';
import {createKingdomWalker,kingdomCubeAnimations} from '../client/kingdom-walkers.js';

const origin='https://game.example';
const pool=createCardPool(path=>JSON.parse(fs.readFileSync(new URL('../web'+path,import.meta.url),'utf8')));
const playerXpAt=level=>Array.from({length:level},(_,i)=>120+34*i+2*i*i).reduce((sum,xp)=>sum+xp,0);

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
 f.store(a.id,w=>{w.playerXp=playerXpAt(3)});
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
 f.store(session.id,w=>{w.playerXp=playerXpAt(3)});
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
 assert.deepEqual([6,7,8,9].map(tier=>levelRewardTenths(tier,0,0)),[25,40,80,120]);
 assert.deepEqual([1,51,101,0].map(rank=>levelRewardTenths(10,rank,101)),[300,215,130,130]);
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

test('player level starts at zero and pack experience credits each opening once',async()=>{
 const f=fixture(),player=await f.open();
 assert.deepEqual(playerProgress(0),{level:0,xp:0,goal:120,total:0,ratio:0});
 assert.equal(playerProgress(120).level,1);
 assert.equal(playerProgress(120).goal,156);
 const bought=await f.command(player,'pack.buy',{packId:'common',quantity:10}).then(r=>r.json());
 assert.equal(bought.wallet.playerXp,0);
 const id=bought.wallet.pending.id;
 for(const opened of [1,1,3,2,10,10])assert.equal((await f.command(player,'pack.advance',{id,opened})).status,200);
 const wallet=await f.wallet(player);
 assert.equal(wallet.playerXp,70);
 assert.equal(wallet.lastPull.playerXpEarned,70);
 assert.deepEqual(packs.map(pack=>packPlayerXp(pack.id)),[7,12,12,22,31,44,61,83]);
});

test('pack XP shares a rolling 50-opening cap without stopping card pulls',async t=>{
 const start=Date.now(),minute=60_000;
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),player=await f.open(),baseXp=playerXpAt(8);
 f.store(player.id,w=>{w.playerXp=baseXp;w.coins=3_000_000;});
 const command=async(action,args,requestId)=>{
  const response=await f.command(player,action,args,requestId);
  assert.equal(response.status,200);
  return (await response.json()).wallet;
 };
 const buy=async(packId,quantity)=>(await command('pack.buy',{packId,quantity})).pending.id;
 const open=(id,opened,requestId)=>command('pack.advance',{id,opened},requestId);
 const common=await buy('common',10);
 assert.equal((await open(common,4)).playerXp,baseXp+28);
 t.mock.timers.setTime(start+20*minute);
 assert.equal((await open(common,10)).playerXp,baseXp+70);
 const rare=await buy('rare',50),retry=crypto.randomUUID();
 const [credited,replayed]=await Promise.all([open(rare,50,retry),open(rare,50,retry)]);
 for(const wallet of [credited,replayed]){
  assert.equal(wallet.playerXp,baseXp+550);
  assert.equal(wallet.lastPull.playerXpEarned,480);
  assert.equal(wallet.lastPull.playerXpCappedPacks,10);
  assert.deepEqual(packXpAllowance(wallet),{remaining:0,nextAt:start+60*minute});
 }
 assert.equal((await open(rare,50)).playerXp,baseXp+550);
 const house=await command('kingdom.house',{x:-7.54,z:7.22,rotation:1});
 assert.equal(house.playerXp,baseXp+605);

 t.mock.timers.setTime(start+60*minute-1);
 const capped=await open(await buy('common',1),1);
 assert.equal(capped.playerXp,baseXp+605);
 assert.equal(capped.lastPull.playerXpCappedPacks,1);
 assert.equal(capped.lastPull.rows.length,5);
 t.mock.timers.setTime(start+60*minute);
 assert.deepEqual(packXpAllowance(await f.wallet(player)),{remaining:4,nextAt:start+80*minute});
 const mixed=await open(await buy('uncommon',10),10);
 assert.equal(mixed.playerXp,baseXp+653);
 assert.equal(mixed.lastPull.playerXpCappedPacks,6);
 t.mock.timers.setTime(start+80*minute);
 assert.equal(packXpAllowance(await f.wallet(player)).remaining,46);
});

test('power rankings backfill distinct owned cards and sort by trained card stats',async()=>{
 const f=fixture(),weak=await f.open('rank-weak'),strong=await f.open('rank-strong');
 const alpha=(await pool('Easy'))[0],beta=(await pool('Extreme Demon')).find(row=>row[10]===100);
 f.addCards(weak.id,[alpha]);
 f.addCards(strong.id,[alpha,beta]);
 f.store(strong.id,w=>{w.playerXp=120;w.training={[beta[0]]:{endurance:20,drillsVersion:1}}});
 const {rows}=await f.call('/api/players',strong).then(r=>r.json());
 const score=stats=>stats.maxHp+3*stats.attack;
 assert.equal(rows[0].power,score(statsFor(alpha))+score(statsFor(beta,{endurance:20,drillsVersion:1})));
 assert.equal(rows[0].level,1);
 assert.equal(rows[0].mine,true);
 assert.equal(rows[1].power,score(statsFor(alpha)));
 const privateStats=await f.call('/api/game?view=profile',weak).then(r=>r.json());
 assert.equal(privateStats.profile.rank,2);
 assert.equal(privateStats.profile.privateRank,false);
});

test('ranked profiles respect privacy and Trading is gated at Level 15',async()=>{
 const f=fixture(),viewer=await f.open('profile-viewer'),owner=await f.open('profile-owner');
 const [row]=await pool('Easy');
 f.addCards(owner.id,[row]);
 f.store(owner.id,w=>{w.playerXp=playerXpAt(15)});
 f.store(viewer.id,w=>{w.playerXp=playerXpAt(14)});
 const profile=who=>f.call('/api/players?player='+owner.id,who);
 const {player,stats}=await (await profile(viewer)).json();
 assert.equal(player.id,owner.id);
 assert.equal(player.place,1);
 assert.equal(stats.level,15);
 assert.equal(stats.copies,2);
 assert.equal((await f.call('/api/players?view=trading',viewer)).status,403);
 const oldTrading=await (await f.call('/api/players?view=trading',owner)).json();
 assert.deepEqual(oldTrading,{rows:[],notice:'Only level 15+ people can trade.'});
 assert.equal((await f.command(owner,'profile.privacy',{hidden:'yes'})).status,400);
 assert.equal((await f.command(owner,'profile.privacy',{hidden:true})).status,200);
 assert.equal((await profile(viewer)).status,403);
 assert.equal((await profile(owner)).status,200);
 const standings=await (await f.call('/api/players',viewer)).json();
 assert.equal(standings.rows[0].profileHidden,true);
 assert.equal((await f.command(owner,'profile.privacy',{hidden:false})).status,200);
 assert.equal((await profile(viewer)).status,200);
});

test('public showcases honor independent sharing settings and expose the saved plot and strongest card',async()=>{
 const f=fixture(),viewer=await f.open('visitor'),owner=await f.open('showcase-owner');
 const [easy]=await pool('Easy'),strong=(await pool('Extreme Demon')).find(row=>row[10]===1);
 f.addCards(owner.id,[easy,strong]);
 f.store(owner.id,w=>{
  w.playerXp=playerXpAt(8);
  w.kingdom={mana:400,towerLevel:2,landLevel:1,houses:[{id:'home',x:-8,z:7,rotation:1,price:50_000,level:2}],
   forges:[{id:'forge',kind:'forge',x:8,z:7,rotation:0,price:120_000,level:2,storedMana:20,collectedAt:Date.now()}]};
 });
 const read=(view='wallet',session=viewer)=>f.call('/api/players?player='+owner.id+'&view='+view,session);
 const summary=async()=>((await (await read()).json()).showcases);
 assert.deepEqual(await summary(),{kingdom:true,bestCard:true});
 const visit=await read('kingdom');
 assert.equal(visit.headers.get('cache-control'),'private, no-store');
 const {kingdom}=await visit.json();
 assert.equal(kingdom.towerLevel,2);
 assert.equal(kingdom.landLevel,1);
 assert.equal(kingdom.stars,.32);
 assert.deepEqual(kingdom.buildings[1],{id:'forge',x:8,z:7,rotation:0,kind:'forge',level:2});
 assert.equal('mana' in kingdom,false);
 const {bestCard}=await (await read('best-card')).json(),stats=statsFor(strong);
 assert.equal(bestCard.id,strong[0]);
 assert.equal(bestCard.power,stats.maxHp+3*stats.attack);
 assert.equal(bestCard.maxHp,300_000_000);
 assert.ok(bestCard.basic.name&&bestCard.signature.name&&bestCard.signature.detail);
 assert.equal((await f.command(owner,'profile.privacy',{shareKingdom:'off',shareBestCard:false})).status,400);
 assert.deepEqual(await summary(),{kingdom:true,bestCard:true});
 assert.equal((await f.command(owner,'profile.privacy',{shareKingdom:false})).status,200);
 assert.deepEqual(await summary(),{kingdom:false,bestCard:true});
 assert.equal((await read('kingdom')).status,404);
 assert.equal((await read('best-card')).status,200);
 assert.equal((await f.command(owner,'profile.privacy',{shareKingdom:true,shareBestCard:false})).status,200);
 assert.deepEqual(await summary(),{kingdom:true,bestCard:false});
 assert.equal((await read('best-card')).status,404);
 assert.equal((await read('kingdom')).status,200);
 assert.equal((await f.command(owner,'profile.privacy',{hidden:true})).status,200);
 assert.equal((await read('kingdom')).status,403);
 assert.equal((await read('best-card')).status,403);
 assert.equal((await read('best-card',owner)).status,200);
});

test('Extreme bands outrank the prior trained band and the highest pulls are rarer',async()=>{
 const rows=await pool('Extreme Demon');
 const grief=rows.find(row=>row[10]===1),thinking=rows.find(row=>row[0]===119544028);
 assert.equal(statsFor(grief).maxHp,300_000_000);
 assert.equal(extremeStage(1629).hp,500_000);
 const trained={endurance:100,spike:100,saw:100,xp:9000,drillsVersion:1};
 const insane=(await pool('Insane Demon'))[0];
 assert.ok(statsFor(insane,trained).maxHp<statsFor(rows.find(row=>row[10]===1629)).maxHp);
 assert.ok(statsFor(thinking).maxHp>100_000_000);
 for(const [upper,lower] of [[10,11],[50,51],[150,151],[500,501]]){
  assert.ok(statsFor(rows.find(row=>row[10]===upper)).maxHp>statsFor(rows.find(row=>row[10]===lower),trained).maxHp);
 }
 const current=extremeTable(rows),old=extremeTable(rows,4);
 for(const rank of [1,4,10,50]){
  assert.ok(extremeOdds(rank,current,99)<extremeOdds(rank,old,99));
 }
});

test('house lots unlock after the 500K coin and 500 Mana one-minute tower upgrade',async t=>{
 const start=Date.now();
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),player=await f.open();
 const args={x:-7.54,z:7.22,rotation:1};
 assert.equal((await f.command(player,'kingdom.house',args)).status,400);
 assert.deepEqual((await f.wallet(player)).discoveredVisitors,[]);
 f.store(player.id,w=>{w.coins=850_000;w.playerXp=playerXpAt(8)});
 for(const invalid of [{x:-2.65,z:0,rotation:0},{x:6.5,z:2.1,rotation:0},{x:30,z:7,rotation:0},{x:0,z:0,rotation:4}]){
  assert.equal((await f.command(player,'kingdom.house',invalid)).status,400);
 }
 const requestId=crypto.randomUUID();
 const results=await Promise.all([f.command(player,'kingdom.house',args,requestId),f.command(player,'kingdom.house',args,requestId)]);
 for(const response of results)assert.equal(response.status,200);
 assert.equal((await f.command(player,'kingdom.house',args)).status,400);
 const wallet=await f.wallet(player);
 const buildings=wallet.kingdom.houses;
 assert.equal(buildings.length,1);
 assert.equal(buildings[0].rotation,1);
 assert.equal(wallet.coins,800_000);
 assert.equal(wallet.playerXp,playerXpAt(8)+55);
 assert.deepEqual([kingdomStats(wallet).stars,kingdomStats(wallet).value,wallet.discoveredVisitors.length],[.3,50_000,0]);
 assert.ok(wallet.visitorRefreshAt>=start+60_000&&wallet.visitorRefreshAt<=start+180_000);
 const second={x:7.54,z:7.22,rotation:0,expectedPrice:100_000};
 assert.equal((await f.command(player,'kingdom.house',{...second,expectedPrice:50_000})).status,400);
 assert.equal((await f.command(player,'kingdom.tower',{level:1})).status,400);
 assert.equal((await f.command(player,'kingdom.house',second)).status,200);
 assert.equal((await f.command(player,'kingdom.house',{x:-8,z:-7,rotation:0,expectedPrice:200_000})).status,400);
 const full=await f.wallet(player);
 assert.equal(full.coins,700_000);
 assert.equal(kingdomStats(full).value,150_000);
 assert.deepEqual(full.discoveredVisitors,[]);
 const unfunded=await f.command(player,'kingdom.tower',{level:1});
 assert.equal(unfunded.status,400);
 assert.match((await unfunded.json()).error,/500 Mana/);
 f.store(player.id,w=>{w.kingdom.mana=521});
 const upgradeRequest=crypto.randomUUID();
 const starts=await Promise.all([f.command(player,'kingdom.tower',{level:1},upgradeRequest),f.command(player,'kingdom.tower',{level:1},upgradeRequest)]);
 for(const response of starts){
  assert.equal(response.status,200);
  const {wallet,result}=await response.json();
  assert.deepEqual(result.tower.construction,{level:2,startedAt:start,endsAt:start+60_000});
  assert.equal(wallet.coins,200_000);
  assert.equal(wallet.kingdom.mana,21);
  assert.equal(wallet.playerXp,playerXpAt(8)+110);
  assert.equal(kingdomStats(wallet).tower.limit,2);
 }
 const third={x:-8,z:-7,rotation:0,expectedPrice:200_000};
 assert.equal((await f.command(player,'kingdom.tower',{level:1})).status,400);
 t.mock.timers.setTime(start+59_999);
 assert.equal((await f.command(player,'kingdom.tower.finish')).status,400);
 assert.equal((await f.command(player,'kingdom.house',third)).status,400);
 t.mock.timers.setTime(start+60_000);
 assert.equal(kingdomStats(await f.wallet(player)).tower.limit,3);
 const finishRequest=crypto.randomUUID();
 const completions=await Promise.all([f.command(player,'kingdom.tower.finish',{},finishRequest),f.command(player,'kingdom.tower.finish',{},finishRequest)]);
 for(const response of completions){
  assert.equal(response.status,200);
  const {wallet,result}=await response.json();
  assert.equal(result.tower.completed,true);
  assert.equal(wallet.kingdom.towerLevel,2);
  assert.equal(wallet.kingdom.towerConstruction,undefined);
  assert.equal(wallet.playerXp,playerXpAt(8)+110+150);
  assert.equal(wallet.coins,200_000);
 }
 assert.equal((await f.command(player,'kingdom.house',third)).status,200);
});

test('cubes can detour around the tower and visit trees, houses and forges',()=>{
 const nav=kingdomNavigation(kingdomBounds(),[{x:7,z:7,rotation:0,kind:'forge'},{x:-7,z:7,rotation:1}],[[-16,3]],true);
 assert.equal(nav.targets.tree.length,1);
 assert.equal(nav.targets.housing.length,1);
 assert.equal(nav.targets.production.length,1);
 const route=nav.route({x:-8,z:0},{x:4,z:0});
 assert.ok(route.points.length>1);
 assert.ok(route.points.some(point=>Math.abs(point.z)>=2));
 assert.deepEqual(route.points.at(-1),{x:4,z:0});
 const poses=Object.values(kingdomCubeAnimations);
 assert.ok(poses.length>=11);
 assert.equal(new Set(poses.map(sample=>JSON.stringify(sample(.37)))).size,poses.length);
});

test('house upgrades spend 30 Mana once and add 0.02 stars after ten seconds',async t=>{
 const start=Date.now();
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),player=await f.open();
 const houses=[{id:'west',x:-7,z:7,rotation:1,price:50_000},{id:'east',x:7,z:7,rotation:0,price:100_000}];
 f.store(player.id,w=>{w.playerXp=playerXpAt(8);w.kingdom={houses,mana:60}});
 const target={id:'west',level:1},requestId=crypto.randomUUID();
 const started=await Promise.all([f.command(player,'kingdom.house.upgrade',target,requestId),f.command(player,'kingdom.house.upgrade',target,requestId)]);
 for(const response of started){
  assert.equal(response.status,200);
  const {wallet,result}=await response.json();
  assert.deepEqual(result.house.construction,{level:2,startedAt:start,endsAt:start+10000});
  assert.equal(wallet.kingdom.mana,30);
  assert.equal(kingdomStats(wallet).stars,.60);
 }
 assert.equal((await f.command(player,'kingdom.house.upgrade',target)).status,400);
 assert.equal((await f.command(player,'kingdom.house.upgrade',{id:'another-player',level:1})).status,400);
 t.mock.timers.setTime(start+9999);
 assert.equal(kingdomStats(await f.wallet(player)).stars,.60);
 const early=await (await f.command(player,'kingdom.construction.finish')).json();
 assert.deepEqual(early.result.houses,[]);
 t.mock.timers.setTime(start+10000);
 assert.equal(kingdomStats(await f.wallet(player)).stars,.62);
 const complete=await (await f.command(player,'kingdom.construction.finish')).json();
 assert.deepEqual(complete.result.houses,['west']);
 assert.equal(complete.wallet.kingdom.houses[0].level,2);
 assert.equal(complete.wallet.kingdom.houses[0].upgrade,undefined);
 assert.equal(complete.wallet.kingdom.houses[1].level,undefined);
 assert.equal(complete.wallet.kingdom.mana,30);
 assert.equal((await f.command(player,'kingdom.house.upgrade',target)).status,400);
});

test('the six-minute phases advance with the clock and cubes can use rotated house doors',()=>{
 assert.deepEqual(kingdomDaylight(360_000),{night:true,remaining:360_000,light:.44});
 assert.equal(kingdomDaylight(180_000).light,1);
 assert.equal(kingdomDaylight(540_000).light,0);
 assert.equal(kingdomDaylight(719_999).remaining,1);
 assert.deepEqual(kingdomDaylight(18*720_000),kingdomDaylight(0));
 const house={id:'home',x:-8,z:8,rotation:1},nav=kingdomNavigation(kingdomBounds(),[house],[],false);
 const model={resident:new Group(),body:new Group()},hit=new Group();
 const walker=createKingdomWalker(model,{x:-3,z:8},0);
 let door=false,inside=false,left=false;
 for(let i=0;i<800;i++){
  if(walker.update(nav,.04,()=>0,true,hit,true)==='home')door=true;
  if(!model.resident.visible){
   assert.ok(door&&hit.userData.inactive);
   assert.ok(Math.abs(model.resident.position.x-house.x)<.5);
   assert.equal(model.resident.position.z,house.z);
   inside=true;
  }else if(inside&&model.resident.position.x>=-5.46){left=true;break}
 }
 assert.ok(door&&inside&&left);
});

test('Mana Forges give a placement grant and collect server-timed mana while land expands five times',async t=>{
 const start=Date.now();
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),player=await f.open(),bank=112_000_000_000;
 const spot={x:-7.54,z:7.22,rotation:1,expectedPrice:120_000};
 assert.equal((await f.command(player,'kingdom.forge',spot)).status,400);
 f.store(player.id,w=>{w.coins=bank;w.playerXp=playerXpAt(8)});
 const requestId=crypto.randomUUID();
 const results=await Promise.all([f.command(player,'kingdom.forge',spot,requestId),f.command(player,'kingdom.forge',spot,requestId)]);
 for(const response of results)assert.equal(response.status,200);
 const {wallet,result}=await results[0].json(),id=result.forge.id;
 assert.equal(wallet.coins,bank-120_000);
 assert.equal(wallet.kingdom.mana,100);
 assert.equal(wallet.kingdom.forges.length,1);
 assert.equal((await f.command(player,'kingdom.house',{...spot,expectedPrice:50_000})).status,400);
 t.mock.timers.setTime(start+4999);
 assert.equal((await f.command(player,'kingdom.collect',{id})).status,400);
 t.mock.timers.setTime(start+5520);
 const claim=crypto.randomUUID(),collects=await Promise.all([f.command(player,'kingdom.collect',{id},claim),f.command(player,'kingdom.collect',{id},claim)]);
 for(const response of collects){
  assert.equal(response.status,200);
  const collection=await response.json();
  assert.equal(collection.result.earned,5);
  assert.equal(collection.wallet.kingdom.mana,105);
 }
 assert.equal((await f.command(player,'kingdom.collect',{id})).status,400);
 const outer={x:13,z:8,rotation:0,expectedPrice:120_000};
 assert.equal((await f.command(player,'kingdom.forge',outer)).status,400);
 let spent=120_000;
 for(let level=0;level<5;level++){
  const response=await f.command(player,'kingdom.expand',{level});
  assert.equal(response.status,200);
  const expanded=await response.json();
  spent+=10_000_000*10**level;
  assert.equal(expanded.wallet.coins,bank-spent);
  assert.equal(kingdomStats(expanded.wallet).land.size,1.25**(level+1));
 }
 assert.equal((await f.command(player,'kingdom.expand',{level:5})).status,400);
 const second=await f.command(player,'kingdom.forge',outer);
 assert.equal(second.status,200);
 assert.equal((await f.wallet(player)).kingdom.mana,205);
});

test('forge caps and carries over storage and produces three Mana per second after upgrade',async t=>{
 const start=Date.now();
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),player=await f.open(),id='forge',args={id,level:1};
 const legacy={id,x:7,z:7,rotation:0,kind:'forge',price:120_000,collectedAt:start-900_000};
 f.store(player.id,w=>{w.coins=1_000_000;w.playerXp=playerXpAt(8);w.kingdom={forges:[legacy],mana:0}});
 assert.deepEqual(forgePlan(legacy),{level:1,rate:1,capacity:300,stored:300,construction:null});
 assert.equal((await f.command(player,'kingdom.forge.upgrade',args)).status,400);
 const initial=await (await f.command(player,'kingdom.collect',{id})).json();
 assert.equal(initial.result.earned,300);
 assert.equal(initial.wallet.coins,1_000_000);
 assert.equal((await f.command(player,'kingdom.collect',{id})).status,400);
 t.mock.timers.setTime(start+8000);
 const locked=await f.command(player,'kingdom.forge.upgrade',args);
 assert.match((await locked.json()).error,/Tower.*Level 2|tower.*Level 2/);
 f.store(player.id,w=>{w.kingdom.towerLevel=2;});
 const upgraded=await (await f.command(player,'kingdom.forge.upgrade',args)).json();
 assert.deepEqual(upgraded.result.forge,{id,level:2,construction:{startedAt:start+8000,endsAt:start+38000}});
 assert.equal(upgraded.wallet.coins,0);
 assert.equal(upgraded.wallet.kingdom.mana,0);
 assert.equal((await f.command(player,'kingdom.forge.upgrade',args)).status,400);
 t.mock.timers.setTime(start+9999);
 assert.equal(forgePlan(upgraded.wallet.kingdom.forges[0]).stored,9);
 t.mock.timers.setTime(start+39_000);
 assert.deepEqual(forgePlan(upgraded.wallet.kingdom.forges[0]),{level:2,rate:3,capacity:1200,stored:41,construction:null});
 t.mock.timers.setTime(start+860001);
 const full=await (await f.command(player,'kingdom.collect',{id})).json();
 assert.equal(full.result.earned,1200);
 assert.equal(full.wallet.kingdom.mana,1200);
 assert.equal((await f.command(player,'kingdom.collect',{id})).status,400);
 t.mock.timers.setTime(start+862000);
 assert.equal((await f.command(player,'kingdom.collect',{id})).status,400);
 t.mock.timers.setTime(start+862001);
 const live=await (await f.command(player,'kingdom.collect',{id})).json();
 assert.equal(live.result.earned,6);
});

test('visitor ratings have ten anonymous slots and the lot geometry can reach five stars',()=>{
 const houses=[];
 for(let z=-9;z<=10;z++)for(let x=-10;x<=10;x++){
  const spot={x,z,rotation:0};
  if(!housePlacementError(houses,spot))houses.push(spot);
 }
 assert.deepEqual(visitorSlots.map(slot=>slot.rarity),['Common','Common','Uncommon','Uncommon','Uncommon','Rare','Rare','Epic','Epic','Legendary']);
 assert.deepEqual(visitorSlots.filter(slot=>slot.rarity==='Rare').map(slot=>slot.stars),[1.8,2.4]);
 assert(kingdomStats({kingdom:{houses:houses.slice(0,17),towerLevel:5}}).stars===5);
});

test('feature and pack gates derive from player XP and cannot be opened early',async()=>{
 const f=fixture(),player=await f.open();
 const command=(action,args)=>f.command(player,action,args);
 for(const [action,args,level] of [['mine.tap',{},3],['drill.begin',{id:1,kind:'saw'},3],
  ['remix.begin',{id:13519},4],['card.merge',{},5],['cube.equip',{id:'02'},8],['kingdom.house',{x:8,z:7,rotation:0},8],
  ['army.begin',{map:'harbor',chapter:0,tier:1,ids:[1]},8],['upgrade.buy',{key:'luck',expectedLevel:0},11]]){
  const resp=await command(action,args);
  assert.equal(resp.status,400);
  assert.match((await resp.json()).error,new RegExp('Level '+level));
 }
 for(const pack of packs.filter(pack=>packLevels[pack.id]>0)){
  const response=await command('pack.buy',{packId:pack.id,quantity:1});
  assert.equal(response.status,400);
  assert.match((await response.json()).error,new RegExp('Level '+packLevels[pack.id]));
 }
 assert.equal((await command('pack.buy',{packId:'common',quantity:50})).status,400);
 f.store(player.id,w=>{w.coins=20000;w.playerXp=playerXpAt(2)});
 assert.equal((await command('pack.buy',{packId:'rare',quantity:1})).status,200);
 const ready=await f.wallet(player);
 assert.equal((await command('pack.advance',{id:ready.pending.id,opened:1})).status,200);
 assert.deepEqual([2,4,5,7,8,11,14,20,30],[packLevels.rare,featureLevel('arcade'),featureLevel('merge'),featureLevel('bulk'),featureLevel('kingdom'),featureLevel('upgrades'),packLevels.legendary,packLevels.mythic,packLevels.godly]);
 assert.deepEqual(unlockedBetween(7,8).map(item=>item.name),['Kingdom','Army mode','Cube shop','Epic pack']);
 assert.deepEqual([levelCue(1,2),levelCue(1,3),levelCue(4,5),levelCue(3,6),levelCue(9,11)],
  ['levelSingle','levelMulti','levelMilestone','levelMilestone','levelMilestone']);
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
 const power=rows.reduce((sum,row)=>{
  const {maxHp,attack}=statsFor(row);
  return sum+maxHp+3*attack;
 },0);
 assert.equal(posted[0].power,power);
 assert.equal(posted[0].level,0);
 assert.equal((await f.wallet(player)).playerXp,49);
 assert.deepEqual(f.sqlite.prepare('SELECT tier,turns FROM game_scores WHERE player_id=?').get(player.id).turns,battle.seq);
});

test('minigame rewards are derived by replaying legal controls',async()=>{
 const f=fixture(),player=await f.open();
 f.store(player.id,w=>{w.playerXp=playerXpAt(4)});
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
 const training=await saved.json();
 assert.equal(training.wallet.drillBest[row[0]].saw,run.score);
 assert.equal(training.result.playerXpEarned,Math.min(36,run.score*2)+8);
 assert.equal(training.wallet.playerXp,playerXpAt(4)+training.result.playerXpEarned);
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
 f.store(player.id,w=>{w.playerXp=playerXpAt(8)});
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
  for(const foe of battle.enemies)foe.hp=foe.maxHp=Math.max(5_000_000,battle.allies[0].attack*40);
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

test('Level 3 tower requires Level 15 and the new costs, grants 600 XP once, and opens one lot',async t=>{
 const start=Date.now();
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),player=await f.open(),houses=[
  {id:'north',x:-8,z:-7,rotation:0},{id:'west',x:-8,z:7,rotation:1},{id:'east',x:8,z:7,rotation:0}
 ];
 f.store(player.id,w=>{w.playerXp=playerXpAt(14);w.coins=1_500_000;w.gems=12.5;w.kingdom={towerLevel:2,mana:2499,houses};});
 const command=(action,args,id)=>f.command(player,'kingdom.'+action,args,id);
 assert.match((await (await command('tower',{level:2})).json()).error,/Level 15/);
 f.store(player.id,w=>{w.playerXp=playerXpAt(15);});
 assert.match((await (await command('tower',{level:2})).json()).error,/2,500 Mana/);
 f.store(player.id,w=>{w.kingdom.mana=2600;});
 assert.equal((await command('house',{x:8,z:-7,rotation:0,expectedPrice:400_000})).status,400);
 const upgrade=await command('tower',{level:2}).then(r=>r.json());
 assert.deepEqual(upgrade.result.tower.construction,{level:3,startedAt:start,endsAt:start+180_000});
 assert.equal(upgrade.wallet.coins,500_000);
 assert.equal(upgrade.wallet.kingdom.mana,100);
 assert.equal((await command('tower.skip',{maxGems:11})).status,400);
 t.mock.timers.setTime(start+60_000);
 const requestId=crypto.randomUUID();
 for(const result of await Promise.all([command('tower.skip',{maxGems:8},requestId),command('tower.skip',{maxGems:8},requestId)])){
  const {wallet,result:receipt}=await result.json();
  assert.equal(receipt.tower.gems,8);
  assert.equal(wallet.gems,4.5);
  assert.equal(wallet.kingdom.towerLevel,3);
  assert.equal(wallet.playerXp,playerXpAt(15)+600);
  assert.ok(wallet.achievements['tower-3']);
  assert.equal(wallet.kingdom.houses.length,3);
 }
 assert.equal((await command('tower.skip',{maxGems:8})).status,400);
 assert.equal((await command('tower',{level:3})).status,400);
 const fourth=await command('house',{x:8,z:-7,rotation:.5,expectedPrice:400_000});
 assert.equal(fourth.status,200);
 assert.equal((await fourth.json()).result.house.rotation,.5);
 assert.equal((await command('house',{x:10,z:9,rotation:0,expectedPrice:800_000})).status,400);
 assert.equal(kingdomStats({kingdom:{towerLevel:2,houses:houses.concat(houses)}}).houses.length,6);
});

test('Level 3 houses wait for Tower Level 2, charge both resources once and keep diagonal doors usable',async t=>{
 const start=Date.now();
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),owner=await f.open('manor-owner'),viewer=await f.open('manor-visitor');
 const house={id:'home',x:-8,z:7,rotation:1,level:2,price:50_000};
 f.store(owner.id,w=>{
  w.playerXp=playerXpAt(8);w.coins=1_100_000;
  w.kingdom={towerLevel:1,houses:[house],mana:240};
 });
 const command=(action,args,receipt)=>f.command(owner,'kingdom.'+action,args,receipt);
 const target={id:house.id,level:2};
 assert.match((await (await command('house.upgrade',target)).json()).error,/Tower Level 2/);
 f.store(owner.id,w=>{w.kingdom.towerLevel=2;});
 const requestId=crypto.randomUUID();
 for(const response of await Promise.all([command('house.upgrade',target,requestId),command('house.upgrade',target,requestId)])){
  assert.equal(response.status,200);
  const {wallet,result}=await response.json();
  assert.deepEqual(result.house.construction,{level:3,startedAt:start,endsAt:start+30_000});
  assert.equal(wallet.coins,100_000);
  assert.equal(wallet.kingdom.mana,40);
  assert.equal(kingdomStats(wallet).stars,.32);
 }
 const readPlot=async()=>((await (await f.call('/api/players?player='+owner.id+'&view=kingdom',viewer)).json()).kingdom);
 assert.equal((await readPlot()).buildings[0].upgradeLevel,3);
 t.mock.timers.setTime(start+30_000);
 const complete=await (await command('construction.finish')).json();
 assert.deepEqual(complete.result.houses,[house.id]);
 assert.equal(kingdomStats(complete.wallet).stars,.35);
 assert.equal((await command('house.upgrade',{...target,level:3})).status,400);
 assert.equal((await command('building.place',{id:house.id,mode:'move',x:-8,z:7,rotation:.25})).status,400);
 const rotated=await (await command('building.place',{id:house.id,mode:'move',x:-8,z:7,rotation:.5})).json();
 assert.equal(rotated.result.building.rotation,.5);
 assert.equal(rotated.result.building.level,3);
 assert.equal((await readPlot()).buildings[0].level,3);
 const footprint=buildingFootprint(rotated.result.building);
 assert.ok(!insideFootprint({x:footprint.left+.03,z:footprint.front-.03},footprint));
 const nav=kingdomNavigation(kingdomBounds(),[rotated.result.building],[],false);
 assert.ok(nav.homeRoute({x:-2,z:9},nav.targets.housing[0]));
});

test('suggested Kingdom upgrades follow current gates, costs and construction time',()=>{
 const start=Date.now(),houses=Array.from({length:3},(_,i)=>({id:String(i),x:i*4,z:7,rotation:0,level:2}));
 const kingdom={towerLevel:2,houses,mana:2500,forges:[{id:'forge',kind:'forge',x:8,z:-7,rotation:0,level:2}]};
 const options=(at,coins,level)=>kingdomSuggestions(kingdomStats({kingdom},at),coins,level,at);
 const locked=options(start,120_000,14).find(item=>item.id==='tower:3');
 assert.equal(locked.ready,false);
 assert.match(kingdomSuggestionStatus(locked,start),/14 \/ 15 player level/);
 assert.match(kingdomSuggestionStatus(locked,start),/120,000 \/ 1,000,000 coins/);
 assert.equal(recommendedKingdomUpgrade(options(start,1_000_000,15)).id,'tower:3');
 kingdom.towerConstruction={level:3,startedAt:start,endsAt:start+180_000};
 const tracked=recommendedKingdomUpgrade(options(start+90_000,1_000_000,15));
 assert.equal(tracked.progress,.5);
 assert.match(kingdomSuggestionStatus(tracked,start+90_000),/1:30 left/);
 assert.equal(options(start+180_000,1_000_000,15).some(item=>item.id==='tower:3'),false);
});

test('Trees clear once and buildings move, store and restore without repurchasing',async t=>{
 const start=Date.now();
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),player=await f.open();
 f.store(player.id,w=>{
  w.playerXp=playerXpAt(8);w.coins=1_000_000;
  w.kingdom={mana:1000,towerLevel:2,forges:[{id:'forge',kind:'forge',rotation:0,level:2,x:8,z:7,collectedAt:start-5000}]};
 });
 const command=(action,args)=>f.command(player,'kingdom.'+action,args);
 const tree=kingdomStats(await f.wallet(player)).trees.find(item=>item.price===100);
 assert.ok(tree);
 assert.match((await command('house',{x:tree.x,z:tree.z,rotation:0}).then(r=>r.json())).error,/tree/i);
 const removed=await command('tree.clear',{id:tree.id}).then(r=>r.json());
 assert.equal(removed.wallet.kingdom.mana,900);
 assert.ok(!kingdomStats(removed.wallet).trees.some(item=>item.id===tree.id));
 assert.equal((await command('tree.clear',{id:tree.id})).status,400);
 const stored=await command('building.store',{id:'forge'}).then(r=>r.json());
 assert.equal(stored.wallet.kingdom.forges.length,0);
 assert.equal(stored.wallet.kingdom.storage[0].storedMana,15);
 t.mock.timers.setTime(start+50_000);
 const back=await command('building.place',{id:'forge',mode:'restore',x:-8,z:7,rotation:1}).then(r=>r.json());
 assert.equal(back.wallet.kingdom.storage.length,0);
 assert.equal(back.wallet.coins,1_000_000);
 assert.equal(forgePlan(back.wallet.kingdom.forges[0]).stored,15);
 const moved=await command('building.place',{id:'forge',mode:'move',x:8,z:7,rotation:3}).then(r=>r.json());
 assert.equal(moved.result.building.rotation,3);
 assert.equal(moved.result.building.level,2);
 assert.equal(moved.wallet.kingdom.mana,900);
});

test('Old Kingdom visiting windows become permanent arrivals',()=>{
 const start=1_795_000_000_000,house=id=>({id,x:0,z:7,rotation:0,builtAt:start});
 const first={kingdom:{houses:[house('first')]}};
 assert.equal(kingdomVisitors(first,start+59_999).discoveredVisitors.length,0);
 const arrival=kingdomVisitors(first,start).visitorRefreshAt;
 assert.ok(arrival>=start+60_000&&arrival<=start+180_000);
 const arrived=kingdomVisitors(first,arrival);
 assert.equal(arrived.discoveredVisitors[0].visiting,true);
 assert.equal(arrived.discoveredVisitors[0].arrivedAt,arrival);
 assert.equal(arrived.visitorRefreshAt,null);
 assert.deepEqual(kingdomVisitors(first,arrival+120_000),arrived);
 assert.deepEqual(kingdomVisitors(first,arrival+15*86_400_000),arrived);
 assert.ok(Array.from({length:20},(_,i)=>kingdomVisitors({kingdom:{houses:[house('plot-'+i),house('second')]}},start+179_999))
  .some(visit=>visit.discoveredVisitors.length===1));
});

test('A visitor stays across saves and a restored house starts a fresh wait before the first arrival',async t=>{
 const start=Date.now();
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),owner=await f.open('resident-owner'),viewer=await f.open('resident-viewer');
 f.store(owner.id,w=>{w.coins=50_000;w.playerXp=playerXpAt(8);});
 const command=(action,args)=>f.command(owner,'kingdom.'+action,args);
 const spot={x:-8,z:7,rotation:1};
 const built=await (await command('house',spot)).json(),id=built.result.house.id;
 assert.equal(built.wallet.discoveredVisitors.length,0);
 assert.ok(built.wallet.visitorRefreshAt>=start+60_000&&built.wallet.visitorRefreshAt<=start+180_000);
 t.mock.timers.setTime(start+59_999);
 assert.equal((await f.wallet(owner)).discoveredVisitors.length,0);
 assert.equal((await command('building.store',{id})).status,200);
 const later=start+6*60_000;
 t.mock.timers.setTime(later);
 assert.equal((await f.wallet(owner)).visitorRefreshAt,null);
 const restored=await (await command('building.place',{...spot,id,mode:'restore'})).json();
 const arrival=restored.wallet.visitorRefreshAt;
 assert.ok(arrival>=later+60_000&&arrival<=later+180_000);
 assert.equal(restored.wallet.discoveredVisitors.length,0);
 const readVisitors=async()=>((await (await f.call('/api/game?view=kingdom-visitors',owner)).json())['kingdom-visitors']);
 t.mock.timers.setTime(arrival-1);
 assert.deepEqual((await readVisitors()).discoveredVisitors,[]);
 t.mock.timers.setTime(arrival);
 const {discoveredVisitors}=await readVisitors();
 assert.equal(discoveredVisitors.length,1);
 assert.equal(discoveredVisitors[0].arrivedAt,arrival);
 assert.equal((await command('building.store',{id})).status,200);
 t.mock.timers.setTime(arrival+2*86_400_000);
 assert.deepEqual((await f.wallet(owner)).discoveredVisitors,discoveredVisitors);
 const {kingdom}=await (await f.call('/api/players?player='+owner.id+'&view=kingdom',viewer)).json();
 assert.equal(kingdom.stars,0);
 assert.equal(kingdom.visitors[0].id,discoveredVisitors[0].id);
});

test('An arriving cube walks in from the plot edge and waves on the trail',()=>{
 const nav=kingdomNavigation(kingdomBounds(),[],[],false);
 const model={resident:new Group(),body:new Group()},hit=new Group();
 const walker=createKingdomWalker(model,{x:0,z:16},1,.81,new Set(),{x:0,z:4,look:{x:0,z:16}});
 let furthest=16,welcomed=false;
 for(let i=0;i<160;i++){
  const {z:before}=walker.position;
  walker.update(nav,.04,()=>0,false,hit);
  const {z}=walker.position;
  assert.ok(Math.abs(before-z)<=.15);
  furthest=Math.min(z,furthest);
  if(z===4&&model.body.rotation.z>.27)welcomed=true;
 }
 assert.equal(furthest,4);
 assert.equal(welcomed,true);
});

test('A Gem Mine unlocks at Tower Level 2, banks offline production, and caps and collects exactly once',async t=>{
 const start=Date.now(),tick=gemMine.interval;
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),owner=await f.open('gem-miner'),viewer=await f.open('mine-viewer');
 const spot={x:8,z:7,rotation:0,expectedPrice:150_000},command=(action,args,receipt)=>f.command(owner,'kingdom.'+action,args,receipt);
 f.store(owner.id,w=>{w.playerXp=playerXpAt(8);w.coins=150_023;w.gems=2.5;});
 assert.match((await (await command('gem-mine',spot)).json()).error,/Tower Level 2/);
 f.store(owner.id,w=>{w.kingdom={towerLevel:2,mana:799};});
 assert.match((await (await command('gem-mine',spot)).json()).error,/800 Mana/);
 f.store(owner.id,w=>{w.kingdom.mana=800;});
 assert.equal((await command('gem-mine',{...spot,expectedPrice:0})).status,400);
 assert.equal((await command('gem-mine',{...spot,x:-2.65,z:0})).status,400);
 const builds=await Promise.all([command('gem-mine',spot),command('gem-mine',{...spot,x:-8})]);
 assert.deepEqual(builds.map(res=>res.status).sort(),[200,400]);
 const created=await builds.find(res=>res.ok).json(),mine=created.result.building,id=mine.id;
 assert.equal(created.wallet.coins,23);
 assert.equal(created.wallet.kingdom.mana,0);
 assert.equal(created.wallet.gems,2.5);
 assert.equal(kingdomStats(created.wallet).houseLots,0);
 assert.equal(kingdomStats(created.wallet).buildings[0].kind,'gem-mine');
 t.mock.timers.setTime(start+tick-1);
 assert.equal(gemMinePlan(mine).stored,0);
 assert.equal((await command('gem-mine.collect',{id})).status,400);
 t.mock.timers.setTime(start+tick+10_000);
 const first=await (await command('gem-mine.collect',{id})).json();
 assert.equal(first.result.earned,1);
 assert.equal(first.wallet.gems,3.5);
 assert.equal(gemMinePlan(first.wallet.kingdom.gemMines[0]).progress,10_000);
 t.mock.timers.setTime(start+2*tick+50_000);
 const stored=await (await command('building.store',{id})).json();
 assert.equal(stored.wallet.kingdom.storage[0].storedGems,1);
 assert.equal(kingdomStats(stored.wallet).houseLots,0);
 assert.equal((await command('gem-mine',spot)).status,400);
 assert.equal((await command('gem-mine.collect',{id})).status,400);
 const restoredAt=start+45*tick;
 t.mock.timers.setTime(restoredAt);
 const restored=await (await command('building.place',{...spot,id,mode:'restore'})).json();
 assert.deepEqual(gemMinePlan(restored.result.building),{stored:1,capacity:20,progress:50_000});
 const moved=await (await command('building.place',{...spot,x:-8,id,mode:'move'})).json();
 assert.equal(moved.result.building.collectedAt,restoredAt);
 const {kingdom}=await (await f.call('/api/players?player='+owner.id+'&view=kingdom',viewer)).json();
 assert.deepEqual(kingdom.buildings,[{id,x:-8,z:7,rotation:0,kind:'gem-mine',level:1}]);
 t.mock.timers.setTime(restoredAt+50*tick);
 assert.equal(gemMinePlan(moved.result.building).stored,20);
 assert.equal((await f.wallet(owner)).gems,3.5);
 const receipt=crypto.randomUUID(),takes=await Promise.all([command('gem-mine.collect',{id},receipt),command('gem-mine.collect',{id},receipt)]);
 for(const response of takes){
  assert.equal(response.status,200);
  const {wallet,result}=await response.json();
  assert.equal(wallet.gems,23.5);
  assert.equal(result.earned,20);
  assert.deepEqual(gemMinePlan(wallet.kingdom.gemMines[0]),{stored:0,capacity:20,progress:0});
 }
 assert.equal((await command('gem-mine.collect',{id})).status,400);
});

test('LIMBO unlocks a verified eight-key shuffle and pays 100 XP exactly once per clear',async t=>{
 const start=Date.now();
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=fixture(),player=await f.open();
 f.store(player.id,w=>{w.playerXp=playerXpAt(4);});
 const remix=findRemix(86084399),course=makeCourse(remix),runner=newAttempt(course),trace=[];
 let ticks=0,outcome;
 do{
  const {top,bottom}=tunnelAt(course,runner.x+48);
  const held=runner.vy>2.8*((top+bottom)/2-runner.y);
  if(held!==runner.held){runner.held=held;trace.push([ticks,'held',held]);}
  outcome=advanceRunner(runner,course,remix,STEP);ticks++;
 }while(outcome==='running');
 assert.equal(outcome,'clear');
 const {result:attempt}=await f.command(player,'remix.begin',{id:remix.id}).then(r=>r.json());
 assert.equal((await f.command(player,'remix.finale',{token:attempt.token,proof:{ticks:0,trace:[]}})).status,400);
 t.mock.timers.setTime(start+15_000);
 const {result:finale}=await f.command(player,'remix.finale',{token:attempt.token,proof:{ticks,trace}}).then(r=>r.json());
 const {answer,starting,swaps}=limboPattern(finale.seed);
 assert.equal(new Set(starting).size,8);
 assert.equal(swaps.length,16);
 assert.equal((await f.command(player,'remix.finish',{token:attempt.token,proof:{key:answer}})).status,400);
 t.mock.timers.setTime(start+15_000+limboChoiceAt);
 const requestId=crypto.randomUUID(),args={token:attempt.token,proof:{key:answer}};
 const wins=await Promise.all([f.command(player,'remix.finish',args,requestId),f.command(player,'remix.finish',args,requestId)]);
 for(const win of wins){
  const {wallet,result}=await win.json();
  assert.equal(result.playerXpEarned,100);
  assert.equal(wallet.playerXp,playerXpAt(4)+100);
  assert.ok(wallet.achievements.limbo);
 }
 assert.equal((await f.command(player,'remix.finish',args)).status,400);
});

test('All 25 achievements use server progress including legacy collections, training and trilogies',async()=>{
 assert.equal(achievements.length,25);
 assert.equal(new Set(achievements.map(item=>item.id)).size,25);
 const f=fixture(),player=await f.open();
 const picks=await Promise.all(difficulties.map(async difficulty=>(await pool(difficulty))[0]));
 f.addCards(player.id,picks);
 f.store(player.id,w=>{
  w.playerXp=playerXpAt(19);w.training={1:{xp:4750,spike:31,saw:28,endurance:22}};
  w.armyTrilogy={1:7,2:3,3:7};w.armySeries={fixture:7};w.remixWins={6508283:20};
 });
 const wallet=await f.wallet(player);
 assert.equal(Object.keys(wallet.achievements).filter(id=>id.startsWith('card-')).length,11);
 assert.ok(wallet.achievements['training-100']&&wallet.achievements['army-three']&&wallet.achievements['battle-20']);
 assert.equal(achievementProgress(wallet).training,100);
 assert.equal(featureLevel('progression'),1);
});
