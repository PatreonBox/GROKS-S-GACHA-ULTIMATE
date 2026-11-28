import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import net from 'node:net';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createDiscordAuth,officialGuildId} from '../server/discord.mjs';
import {createBugReports} from '../server/bug-reports.mjs';
import {openGameDatabase} from '../server/sqlite.mjs';
import {cardCategories,createCardPool} from '../web/pack-engine.js';
import {newWallet} from '../web/game-rules.js';
import {playerXpAtLevel} from '../web/player-progression.js';
import {tradeBalance,tradeSearchTerm} from '../web/trade-rules.js';
import {readRoute} from '../web/demon-tiers.js';
import {chestDropMotion,chestKeyMotion,chestTimeline} from '../web/chest-motion.js';
import {chestOpeningSound} from '../web/pack-sound.js';
import {newTidalWave,stepTidalWave,tidalInput,tidalHeight,tidalLength,tidalPortals,tidalScrollSpeed,tidalStart,tidalStep,tidalVideoVersion,tidalWaveCeiling,tidalWaveFloor} from '../web/tidal-video-rules.js';
import {replayTidalVideo} from '../web/game-replay.js';
import {keepWavePoint,waveVerticalOffsets} from '../web/remix-wave.js';
import worker from '../dist/server/index.js';

const publicOrigin='https://gd-fixture.up.railway.app';

test('Wave trail retains corners from beyond the left edge to the current position',()=>{
 const points=[],playerX=304;
 for(let x=0;x<=2000;x++){
  const distance=x%100;
  keepWavePoint(points,x,distance<=50?distance:100-distance,playerX);
 }
 const left=2000-playerX;
 assert.ok(points[0][0]<left-30);
 assert.ok(points[1][0]>=left-30);
 assert.deepEqual(points.filter(([x])=>x>=left),[
  [1700,0],[1750,50],[1800,0],[1850,50],[1900,0],[1950,50],[2000,0]
 ]);
});

test('Recorded wave follows the measured speed transition and replays through the ending',()=>{
 const run=newTidalWave(2),trace=[];
 assert.equal(tidalScrollSpeed(tidalStart-.01),0);
 assert.equal(tidalScrollSpeed(4),392);
 assert.equal(tidalScrollSpeed(4.60),902);
 let result;
 while(!result){
  const offset=run.mini?119:139;
  const held=run.y>tidalHeight/2+(run.held?-offset:offset);
  if(held!==run.held){trace.push([run.tick,'held',held]);run.held=held;}
  const distance=run.distance,y=run.y;
  result=stepTidalWave(run);
  assert.ok(Math.abs(run.distance-distance-tidalScrollSpeed(run.tick*tidalStep)*tidalStep)<1e-8);
  assert.ok(Math.abs(Math.abs(run.y-y)-(run.distance-distance)*(run.mini?2:1))<1e-8);
 }
 assert.equal(result,'clear');
 assert.equal(run.portal,tidalPortals.length);
 assert.equal(run.mini,false);
 const proof={ticks:run.tick,trace};
 const session={start:0,video:2};
 assert.equal(replayTidalVideo(session,proof,tidalLength*1000),100);
 assert.throws(()=>replayTidalVideo(session,proof,1000),/could not be verified/);
 const fall=newTidalWave(2);
 while(!stepTidalWave(fall)){}
 assert.ok(fall.y+17>tidalHeight);
 assert.ok(replayTidalVideo(session,{ticks:fall.tick,trace:[]},tidalLength*1000)<100);
 assert.throws(()=>replayTidalVideo({start:0,video:true},{ticks:487,trace:[]},tidalLength*1000),/expired/);
});

const introTaps=[51,78,106,134,161];
function tidalTraceInput(run,trace,held){
 trace.push([run.tick,'held',held]);
 tidalInput(run,'held',held);
}
function tapTidalOrb(run,trace){
 tidalTraceInput(run,trace,true);
 tidalTraceInput(run,trace,false);
}

test('The cube falls on missed pink taps and rises into the ceiling when only one green orb is hit',()=>{
 const session={start:0,video:tidalVideoVersion};
 for(const [count,missed,edge] of [[0,'pink','floor'],[1,'green','floor'],[2,'green','ceiling'],[3,'pink','floor'],[4,'pink','floor']]){
  const run=newTidalWave(),trace=[];
  const taps=introTaps.slice(0,count);
  let result,missY;
  while(!result){
   if(taps.includes(run.tick))tapTidalOrb(run,trace);
   result=stepTidalWave(run);
   if(run.cube.missedOrb)missY??=run.cube.y;
   assert.equal(run.form,'cube');
  }
  assert.equal(result,'crash');
  assert.equal(run.cube.nextOrb,count);
  assert.equal(run.cube.gravity,edge==='ceiling'?-1:1);
  assert.ok(edge==='ceiling'?run.cube.y<missY:run.cube.y>missY);
  assert.equal(run.crashReason,'You missed the '+missed+' orb and hit the '+edge+'.');
  assert.equal(replayTidalVideo(session,{ticks:run.tick,trace},30000),Math.floor(run.tick*tidalStep/tidalLength*100));
 }
});

test('Five separate orb taps bounce and flip the cube before the wave portal',()=>{
 const run=newTidalWave(),trace=[],orbVelocities=[];
 while(run.form==='cube'){
  const before=run.cube.nextOrb;
  if(introTaps.includes(run.tick))tapTidalOrb(run,trace);
  assert.equal(stepTidalWave(run),null);
  if(run.cube.nextOrb!==before)orbVelocities.push([run.cube.gravity,Math.sign(run.cube.vy)]);
 }
 assert.deepEqual(orbVelocities,[[1,-1],[-1,-1],[1,1],[1,-1],[1,-1]]);
 assert.equal(run.form,'transition');
 while(run.form==='transition')assert.equal(stepTidalWave(run),null);
 assert.equal(run.form,'wave');
 assert.equal(run.tick,Math.ceil(tidalStart/tidalStep));
});

test('The visible normal and mini wave stop at the ceiling or floor on contact',()=>{
 const takeoff=newTidalWave();
 Object.assign(takeoff,{form:'wave',tick:480,y:tidalWaveFloor});
 assert.equal(stepTidalWave(takeoff),null);
 assert.ok(takeoff.y>tidalWaveFloor);
 for(const mini of [false,true]){
  for(const held of [false,true]){
   const run=newTidalWave();
   Object.assign(run,{form:'wave',mini,held,tick:600});
   const [top,bottom]=waveVerticalOffsets(held,mini);
   const edge=held?'ceiling':'floor';
   const boundary=held?tidalWaveCeiling:tidalWaveFloor;
   const offset=held?top:bottom;
   run.y=boundary-offset+(held?1:-1);
   assert.equal(stepTidalWave(run),'crash');
   assert.equal(run.crashReason,edge);
   assert.ok(Math.abs(run.y+offset-boundary)<1e-9);
  }
 }
});

test('Updated Tidal Wave replays to the end and still verifies earlier overlay attempts',()=>{
 const run=newTidalWave(),trace=[];
 let result;
 while(!result){
  if(run.form==='cube'&&introTaps.includes(run.tick))tapTidalOrb(run,trace);
  if(run.form==='wave'){
   const center=(tidalWaveCeiling+tidalWaveFloor)/2;
   const held=run.y>center+(run.held?-95:95);
   if(run.held!==held)tidalTraceInput(run,trace,held);
  }
  result=stepTidalWave(run);
 }
 assert.equal(result,'clear');
 assert.equal(run.portal,tidalPortals.length);
 assert.equal(replayTidalVideo({start:0,video:tidalVideoVersion},{ticks:run.tick,trace},30000),100);
 assert.throws(()=>replayTidalVideo({start:0,video:3},{},5000),/expired/);
 const legacyTrace=[53,83].flatMap(tick=>[[tick,'held',true],[tick,'held',false]]);
 assert.equal(replayTidalVideo({start:0,video:4},{ticks:512,trace:legacyTrace},5000),15);
});

test('The versioned death cue serves the uploaded MP3 through the game media route',async()=>{
 const path='/assets/audio/gd-death.mp3',file=readFileSync(new URL('../web'+path,import.meta.url));
 const response=await worker.fetch(new Request(publicOrigin+path+'?v=2'));
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Content-Type'),'audio/mpeg');
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),file);
});

test('Demon chest openings select the uploaded sound at the correct rarity boundaries',async()=>{
 for(const [sound,rarities] of [
  ['chestOpen01',['common','rare','legendary','exotic']],['chest07',['celestial','secret']],
  ['chest08',['divine','apex','impossible']]
 ])for(const rarity of rarities)assert.equal(chestOpeningSound(rarity),sound);
 for(const name of ['chestLand','chestClick','chestOpen01','chest07','chest08']){
  const path='/reveal-media/chests/'+name+'.ogg',original=readFileSync(new URL('../web'+path,import.meta.url));
  const response=await worker.fetch(new Request(publicOrigin+path,{headers:{Range:'bytes=0-31'}}));
  assert.equal(response.status,206);
  assert.equal(response.headers.get('Content-Type'),'audio/ogg');
  assert.equal(response.headers.get('Content-Range'),`bytes 0-31/${original.length}`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),original.subarray(0,32));
 }
});

test('Demon chest contact, key turn, and lid opening use the same timeline',()=>{
 for(const rarity of ['common','celestial','divine','impossible']){
  const plan=chestTimeline(rarity);
  const {landing,rebound,keyStart,align,latch,turnStart,turnEnd,openStart}=plan;
  assert.equal(chestDropMotion(landing,plan).fall,1);
  assert.equal(chestDropMotion(landing,plan).impact,1);
  assert.equal(chestDropMotion(landing,plan).bump,0);
  assert.ok(chestDropMotion((landing+rebound)/2,plan).bump>.99);
  assert.equal(chestDropMotion(rebound,plan).secondImpact,1);
  assert.ok(rebound<keyStart&&keyStart<align&&align<latch&&latch<turnStart&&turnEnd<openStart);
  assert.equal(chestKeyMotion(latch,plan).seat,1);
  assert.equal(chestKeyMotion(turnStart,plan).color,0);
  assert.ok(chestKeyMotion(turnStart+(turnEnd-turnStart)*.20,plan).turn<0);
  assert.ok(chestKeyMotion(turnStart+(turnEnd-turnStart)*.8,plan).turn>1);
  assert.equal(chestKeyMotion(turnEnd,plan).color,1);
  assert.equal(chestKeyMotion(turnEnd,plan).turn,1);
  assert.equal(chestKeyMotion(turnEnd,plan).withdraw,0);
  assert.ok(Math.abs(chestDropMotion(openStart-.01,plan).lid)<1e-9);
  assert.ok(chestDropMotion(openStart+.1,plan).lid>.4);
 }
});

test('a thumbnail that times out during download returns a recoverable response',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({
  start(controller){controller.error(new DOMException('Thumbnail download timed out','TimeoutError'));}
 }),{headers:{'Content-Type':'image/webp'}}));
 const response=await worker.fetch(new Request(publicOrigin+'/api/thumbnail/1314/small'));
 assert.equal(response.status,503);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});

test('Discord PKCE sign-in claims the online guest save once',async()=>{
 const {DB,sqlite}=openGameDatabase(':memory:');
 const clientId='1570000000000000000',userId='1580000000000000000';
 const to=path=>new URL(path,publicOrigin);
 let authorization,exchanges=0;
 const auth=createDiscordAuth(sqlite,{origin:publicOrigin,clientId},async(url,options)=>{
  if(url.endsWith('/oauth2/token')){
   exchanges++;
   assert.equal(options.body.get('client_id'),clientId);
   assert.equal(options.body.get('redirect_uri'),authorization.searchParams.get('redirect_uri'));
   const verifier=options.body.get('code_verifier');
   assert.equal(createHash('sha256').update(verifier).digest('base64url'),authorization.searchParams.get('code_challenge'));
   return Response.json({access_token:'test-account-token'});
  }
  assert.equal(url,'https://discord.com/api/v10/users/@me');
  assert.equal(options.headers.Authorization,'Bearer test-account-token');
  return Response.json({id:userId,username:'fixture',global_name:'Fixture player',avatar:'a'.repeat(32)});
 });
 const configure=request=>{
  const account=auth.account(request);
  return {DB,guestOnly:true,discordEnabled:true,discordUser:account?.id,discordProfile:account?.profile};
 };
 const request=(path,cookie,method='GET',origin=publicOrigin)=>new Request(to(path),{
  method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{Origin:origin}:{})}
 });
 const call=async(path,cookie,method)=>{const req=request(path,cookie,method);return auth.handle(req,new URL(req.url));};
 const game=async(cookie)=>{const req=request('/api/game',cookie);return worker.fetch(req,configure(req));};
 try{
  const guest=await worker.fetch(request('/api/game'),{DB,guestOnly:true});
  const guestCookie=guest.headers.get('set-cookie').split(';')[0];
  const {player_id}=sqlite.prepare('SELECT player_id FROM game_profiles').get();
  const locked=await game(guestCookie);
  assert.deepEqual(await locked.json(),{signedIn:false,accountProvider:'discord',accountSignIn:true,requiresSignIn:true});
  assert.equal(locked.headers.get('set-cookie'),null);
  for(const [path,method] of [['/api/game?view=cards','GET'],['/api/players','GET'],
   ['/api/game','POST'],['/api/game/transfer','POST']]){
   const req=request(path,guestCookie,method);
   assert.equal((await worker.fetch(req,configure(req))).status,401,path);
  }
  const started=await call('/signin-with-discord?return_to=%2F%23gacha%2Fcollection',guestCookie);
  authorization=new URL(started.headers.get('location'));
  assert.equal(authorization.origin,'https://discord.com');
  assert.equal(authorization.searchParams.get('scope'),'identify');
  assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
  assert.equal(authorization.searchParams.get('redirect_uri'),publicOrigin+'/api/auth/discord/callback');
  const flow=started.headers.get('set-cookie').split(';')[0];
  const callback=to('/api/auth/discord/callback');
  callback.search=new URLSearchParams({state:authorization.searchParams.get('state'),code:'test-code',iss:'https://discord.com'});
  const complete=await call(callback,guestCookie+'; '+flow);
  assert.equal(complete.headers.get('location'),publicOrigin+'/#gacha/collection');
  const cookies=complete.headers.getSetCookie();
  assert.equal(cookies.length,2);
  const sessionCookie=cookies[1].split(';')[0];
  const linked=await game(guestCookie+'; '+sessionCookie);
  const signedIn=await linked.json();
  assert.equal(signedIn.signedIn,true);
  assert.deepEqual(signedIn.playerProfile,{name:'Fixture player',username:'fixture',avatarUrl:`https://cdn.discordapp.com/avatars/${userId}/${'a'.repeat(32)}.webp?size=128`});
  assert.equal(sqlite.prepare('SELECT owner FROM game_profiles WHERE player_id=?').get(player_id).owner,'discord:'+userId);
  const pool=createCardPool(path=>JSON.parse(readFileSync(new URL('../web'+path,import.meta.url),'utf8')));
  const catalog=new Set((await Promise.all(cardCategories.map(pool))).flatMap(rows=>rows.map(row=>row[0])));
  const insert=sqlite.prepare('INSERT INTO game_cards(player_id,level_id,card) VALUES(?,?,?)');
  insert.run(player_id,4454123,JSON.stringify({copies:3}));
  insert.run(player_id,6508283,JSON.stringify({copies:0}));
  const stats=request('/api/game?view=profile',sessionCookie);
  assert.deepEqual((await (await worker.fetch(stats,configure(stats))).json()).profile,
   {coins:150,gems:10,unique:2,copies:3,level:0,rank:1,privateRank:false,power:0,collectible:catalog.size,campaignClears:0,campaignTotal:10});
  assert.equal((await (await game(sessionCookie)).json()).wallet.coins,150);
  for(let i=0;i<2;i++){
   const guide=new Request(to('/api/game'),{method:'POST',headers:{Cookie:sessionCookie,
    Origin:publicOrigin,'Content-Type':'application/json'},
   body:JSON.stringify({action:'guide.seen',args:{id:'pack-shop'},requestId:crypto.randomUUID()})});
   const response=await worker.fetch(guide,configure(guide));
   assert.equal(response.status,200);
   assert.deepEqual((await response.json()).wallet.guideSeen,['pack-shop']);
  }
  assert.deepEqual((await (await game(sessionCookie)).json()).wallet.guideSeen,['pack-shop']);
  assert.ok((await call(callback,flow)).headers.get('location').includes('discord=failed'));
  assert.equal(exchanges,1);
  const badLogout=request('/api/auth/discord/logout',sessionCookie,'POST','https://elsewhere.example');
  assert.equal(auth.handle(badLogout,new URL(badLogout.url)).status,403);
  assert.equal((await call('/api/auth/discord/logout',sessionCookie,'POST')).status,303);
  assert.equal(auth.user(request('/api/game',sessionCookie)),null);
 }finally{sqlite.close();}
});

test('legacy Discord profiles refresh without signing the game session out or switching accounts',async()=>{
 const {sqlite}=openGameDatabase(':memory:');
 const clientId='1570000000000000000',userId='1580000000000000000';
 const token='f'.repeat(64);
 const session='__Host-gdlb-discord-session='+token;
 sqlite.prepare('INSERT INTO game_discord_sessions(token_hash,discord_id,expires_at) VALUES(?,?,?)')
  .run(createHash('sha256').update(token).digest('hex'),userId,Date.now()+600_000);
 let discordId=userId;
 const auth=createDiscordAuth(sqlite,{origin:publicOrigin,clientId},async url=>
  Response.json(url.endsWith('/oauth2/token')?{access_token:'fixture-token'}:
   {id:discordId,username:'legacy-fixture',global_name:'Legacy Fixture',avatar:null,discriminator:'1234'}));
 const account=()=>auth.account(new Request(publicOrigin,{headers:{Cookie:session}}));
 const params='return_to=%2F%23gacha%2Fcollection';
 const begin=(automatic=false,origin=publicOrigin)=>{
  const url=new URL('/api/auth/discord/profile?'+params+(automatic?'&automatic=1':''),publicOrigin);
  return auth.handle(new Request(url,{method:'POST',headers:{Origin:origin,Cookie:session}}),url);
 };
 const finish=async opened=>{
  const authorize=new URL(opened.headers.get('location'));
  const url=new URL('/api/auth/discord/callback',publicOrigin);
  url.search=new URLSearchParams({state:authorize.searchParams.get('state'),code:'fixture-code',iss:'https://discord.com'});
  return auth.handle(new Request(url,{headers:{Cookie:session+'; '+opened.headers.get('set-cookie').split(';')[0]}}),url);
 };
 try{
  assert.equal(account().profile.autoRefresh,true);
  assert.equal(begin(true,'https://elsewhere.example').status,403);
  const automatic=begin(true);
  assert.equal(new URL(automatic.headers.get('location')).searchParams.get('prompt'),'none');
  assert.equal(account().profile.autoRefresh,undefined);
  assert.equal(begin(true).headers.get('location'),publicOrigin+'/#gacha/collection');
  const updated=await finish(automatic);
  assert.equal(updated.headers.get('location'),publicOrigin+'/#gacha/collection');
  assert.equal(updated.headers.getSetCookie().length,1);
  assert.deepEqual(account().profile,{name:'Legacy Fixture',username:'legacy-fixture',
   avatarUrl:'https://cdn.discordapp.com/embed/avatars/4.png'});
  discordId='1580000000000000001';
  const wrongAccount=await finish(begin());
  assert.equal(new URL(wrongAccount.headers.get('location')).searchParams.get('discord_profile'),'mismatch');
  assert.equal(account().id,userId);
  assert.equal(account().profile.username,'legacy-fixture');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM game_discord_sessions').get().count,1);
 }finally{sqlite.close();}
});

test('the official Discord membership grants 15 keys once and adds an unread notice',async()=>{
 const {DB,sqlite}=openGameDatabase(':memory:');
 const clientId='1570000000000000000',userId='1580000000000000000';
 let accountId=userId,member=false,memberChecks=0;
 const auth=createDiscordAuth(sqlite,{origin:publicOrigin,clientId,guildId:officialGuildId},async(url,options)=>{
  if(url.endsWith('/oauth2/token'))return Response.json({access_token:'fixture-token'});
  assert.equal(options.headers.Authorization,'Bearer fixture-token');
  if(url==='https://discord.com/api/v10/users/@me')return Response.json({id:accountId,username:'fixture'});
  assert.equal(url,'https://discord.com/api/v10/users/@me/guilds/'+officialGuildId+'/member');
  memberChecks++;
  return member?Response.json({joined_at:'2026-11-27T12:00:00Z',pending:false,user:{id:accountId}}):new Response(null,{status:404});
 });
 const request=(path,cookie,method='GET',origin=publicOrigin)=>new Request(new URL(path,publicOrigin),{
  method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{Origin:origin}:{})}
 });
 const run=(req)=>auth.handle(req,new URL(req.url));
 async function finish(opened,session,iss){
  const authorization=new URL(opened.headers.get('location'));
  assert.equal(authorization.searchParams.get('scope'),'identify guilds.members.read');
  const callback=new URL('/api/auth/discord/callback',publicOrigin);
  callback.search=new URLSearchParams({state:authorization.searchParams.get('state'),code:'fixture-code'});
  if(iss)callback.searchParams.set('iss',iss);
  const flow=opened.headers.get('set-cookie').split(';')[0];
  return run(request(callback,session?session+'; '+flow:flow));
 }
 const read=async(path,session)=>{
  const req=request(path,session),account=auth.account(req);
  const result=await worker.fetch(req,{DB,guestOnly:true,discordEnabled:true,discordUser:account?.id,discordProfile:account?.profile});
  assert.equal(result.status,200);
  return result.json();
 };
 try{
  const initial=await finish(run(request('/signin-with-discord')));
  const session=initial.headers.getSetCookie()[1].split(';')[0];
  const start=await read('/api/game',session);
  assert.equal(start.wallet.demonKeys,30);
  assert.equal(start.discordKeyBonusClaimed,false);
  assert.equal(start.discordMembershipVerified,false);
  assert.equal(start.keyBonus,undefined);
  assert.equal(run(request('/api/auth/discord/membership',session,'POST','https://other.example')).status,403);
  member=true;
  const beginCheck=()=>run(request('/api/auth/discord/membership?automatic=1',session,'POST'));
  const wrongIssuer=await finish(beginCheck(),session,'https://other.example');
  assert.equal(new URL(wrongIssuer.headers.get('location')).searchParams.get('discord_membership'),'failed');
  const automatic=beginCheck();
  assert.equal(new URL(automatic.headers.get('location')).searchParams.get('prompt'),'none');
  const checked=await finish(automatic,session);
  assert.equal(new URL(checked.headers.get('location')).searchParams.get('discord_membership'),'verified');
  assert.equal(checked.headers.getSetCookie().length,1);
  const credited=await Promise.all([read('/api/game',session),read('/api/game',session)]);
  assert.ok(credited.every(data=>data.wallet.demonKeys===45&&data.discordMembershipVerified&&data.discordKeyBonusClaimed));
  assert.deepEqual(credited.flatMap(data=>data.keyBonus?[data.keyBonus]:[]),[{keys:15}]);
  const notices=await read('/api/game?view=notifications',session);
  assert.equal(notices.unread,1);
  assert.deepEqual(notices.list.map(notice=>notice.kind),['discord-key-bonus']);
  const loginAgain=await finish(run(request('/signin-with-discord')),undefined,'https://discord.com');
  const next=loginAgain.headers.getSetCookie()[1].split(';')[0];
  assert.equal((await read('/api/game',next)).wallet.demonKeys,45);
  assert.equal((await read('/api/game?view=notifications',next)).unread,1);
  assert.equal(memberChecks,2);
  accountId='1580000000000000001';
  const existingMember=await finish(run(request('/signin-with-discord')));
  const afterLogin=await read('/api/game',existingMember.headers.getSetCookie()[1].split(';')[0]);
  assert.ok(afterLogin.discordMembershipVerified);
  assert.equal(afterLogin.wallet.demonKeys,45);
  assert.deepEqual(afterLogin.keyBonus,{keys:15});
 }finally{sqlite.close();}
});

test('trade notifications persist, stay private, and count new events after marking read',async()=>{
 const {DB,sqlite}=openGameDatabase(':memory:');
 const buyer='1580000000000000001',seller='1580000000000000002';
 const call=(id,path,body,origin=publicOrigin)=>worker.fetch(new Request(new URL(path,publicOrigin),{
  method:body?'POST':'GET',...(body?{headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)}:{})
 }),{DB,guestOnly:true,discordEnabled:true,discordUser:id});
 const notices='/api/game?view=notifications';
 const read=id=>call(id,notices).then(response=>response.json());
 try{
  await Promise.all([call(buyer,'/api/game'),call(seller,'/api/game')]);
  const find=id=>sqlite.prepare('SELECT player_id FROM game_profiles WHERE owner=?').get('discord:'+id).player_id;
  const insert=sqlite.prepare(`INSERT INTO game_trades(trade_id,sender_id,recipient_id,offered,requested,created_at,expires_at,market_eligible)
   VALUES(?,?,?,'[]','[]',?,?,0)`);
  const now=Date.now(),first=crypto.randomUUID(),second=crypto.randomUUID();
  insert.run(first,find(buyer),find(seller),now,now+60_000);
  const received=await read(seller),id=received.list[0].id;
  assert.equal(received.unread,1);
  assert.equal(received.list[0].kind,'trade-request');
  assert.equal(received.list[0].tradeId,first);
  assert.equal((await call(seller,notices,{id},'https://other.example')).status,403);
  assert.deepEqual(await (await call(buyer,notices,{id})).json(),{unread:0,list:[]});
  assert.equal((await read(seller)).unread,1);
  insert.run(second,find(buyer),find(seller),now+1,now+60_000);
  const marked=await (await call(seller,notices,{through:id})).json();
  assert.equal(marked.unread,1);
  assert.deepEqual(marked.list.map(notice=>notice.read),[false,true]);
  const update=sqlite.prepare('UPDATE game_trades SET status=?,resolved_at=? WHERE trade_id=?');
  update.run('completed',now+2,first);
  update.run('completed',now+2,first);
  update.run('declined',now+3,second);
  const sent=await read(buyer);
  assert.equal(sent.unread,2);
  assert.deepEqual(sent.list.map(notice=>notice.kind),['trade-declined','trade-accepted']);
  assert.equal((await (await call(buyer,notices,{through:sent.list[0].id})).json()).unread,0);
  assert.equal((await call(null,notices)).status,401);
 }finally{sqlite.close();}
});

test('bug reports require sign-in and valid details and deliver once to the configured inbox',async()=>{
 const {DB,sqlite}=openGameDatabase(':memory:');
 const userId='1580000000000000001';
 const outbox=[];
 const {submit,deliver}=createBugReports(sqlite,{apiKey:'fixture',from:'reports@example.com',to:'owner@example.com'},
  async(url,request)=>{outbox.push({url,request});return Response.json({id:'accepted'});});
 const env={DB,discordEnabled:true,guestOnly:true,discordUser:userId,discordProfile:{name:'Fixture player'},submitBugReport:submit};
 const entry={reportId:crypto.randomUUID(),category:'combat',title:'Guard never expires',
  steps:'Open a campaign and use Guard.',actual:'The shield stays all game.',expected:'The shield should expire.',page:'#battle/campaign'};
 const send=(payload,session=env,origin=publicOrigin)=>worker.fetch(new Request(publicOrigin+'/api/game/report',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)}),session);
 try{
  assert.equal((await send(entry,{...env,discordUser:null})).status,401);
  assert.equal((await send(entry,env,'https://elsewhere.example')).status,403);
  assert.equal((await send({...entry,category:'unknown'})).status,400);
  assert.equal((await send({...entry,steps:'  '})).status,400);
  const accepted=await send(entry);
  assert.equal(accepted.status,202);
  const result=await accepted.json();
  assert.equal(result.reportId,entry.reportId);
  assert.deepEqual(result.receipt,{category:'Combat',title:entry.title,steps:entry.steps,actual:entry.actual,
   expected:entry.expected,page:entry.page,createdAt:result.receipt.createdAt});
  const spam={...entry,reportId:crypto.randomUUID()};
  const blocked=await send(spam);
  assert.equal(blocked.status,429);
  assert.deepEqual(await blocked.json(),{error:'An error occured'});
  const blockedUntil=sqlite.prepare('SELECT blocked_until FROM game_bug_report_cooldowns WHERE discord_id=?').get(userId).blocked_until;
  assert.ok(blockedUntil-result.receipt.createdAt>=86_400_000);
  assert.deepEqual(await (await send({...entry,title:'Changed after sending'})).json(),result);
  sqlite.prepare('UPDATE game_bug_reports SET created_at=?').run(Date.now()-3_600_000);
  assert.equal((await send(spam)).status,429);
  assert.equal(sqlite.prepare('SELECT blocked_until FROM game_bug_report_cooldowns WHERE discord_id=?').get(userId).blocked_until,blockedUntil);
  await deliver();
  await deliver();
  assert.equal(outbox.length,1);
  const [{url,request}]=outbox;
  assert.equal(url,'https://api.resend.com/emails');
  assert.equal(request.headers['Idempotency-Key'],'gd-bug/'+entry.reportId);
  const message=JSON.parse(request.body);
  assert.deepEqual(message.to,['owner@example.com']);
  assert.match(message.text,/#battle\/campaign/);
  assert.match(message.text,/Guard never expires/);
  assert.ok(sqlite.prepare('SELECT sent_at FROM game_bug_reports WHERE report_id=?').get(entry.reportId).sent_at);
  sqlite.prepare('UPDATE game_bug_report_cooldowns SET blocked_until=?').run(Date.now()-1);
  assert.equal((await send(spam)).status,202);
 }finally{sqlite.close();}
});

test('owner save adjustments are idempotent and private on player rankings',async()=>{
 const {DB,sqlite}=openGameDatabase(':memory:');
 const adminId='1580000000000000001',memberId='1580000000000000002';
 const call=(id,path='/api/game',body=null,adminDiscordId=adminId)=>worker.fetch(new Request(publicOrigin+path,{
  method:body?'POST':'GET',headers:body?{Origin:publicOrigin,'Content-Type':'application/json'}:undefined,
  body:body?JSON.stringify(body):undefined
 }),{DB,discordEnabled:true,guestOnly:true,discordUser:id,adminDiscordId});
 const command=(id,action,args,requestId=crypto.randomUUID())=>call(id,'/api/game',{action,args,requestId});
 try{
  const admin=await (await call(adminId)).json(),member=await (await call(memberId)).json();
  assert.equal(admin.admin,true);
  assert.equal(member.admin,undefined);
  const player=sqlite.prepare('SELECT player_id FROM game_profiles WHERE owner=?');
  const owner=player.get('discord:'+adminId).player_id,other=player.get('discord:'+memberId).player_id;
  const score=sqlite.prepare('INSERT INTO game_scores(player_id,alias,tier,survivors,turns,score,posted_at) VALUES(?,?,?,?,?,?,?)');
  score.run(owner,'Fixture owner',10,4,3,100,1);
  score.run(other,'Fixture member',2,4,1,25,2);
  assert.deepEqual((await (await call(memberId,'/api/players')).json()).rows.map(row=>[row.place,row.alias]),[[1,'Fixture member']]);
  const adminStats=(await (await call(adminId,'/api/game?view=profile')).json()).profile;
  assert.equal(adminStats.rank,null);
  assert.equal(adminStats.privateRank,true);
  assert.equal((await call(adminId,'/api/players',{alias:'Owner'})).status,403);
  assert.equal((await command(memberId,'admin.adjust',{field:'coins',mode:'add',amount:70})).status,403);
  assert.equal((await command(memberId,'admin.adjust',{field:'demonKeys',mode:'add',amount:8})).status,403);
  assert.equal((await command(memberId,'admin.reset',{confirmation:'RESET'})).status,403);
  assert.equal((await command(memberId,'admin.adjust',{field:'level',mode:'set',amount:15})).status,403);
  assert.equal((await command(memberId,'admin.kingdom.finish',{})).status,403);
  assert.equal((await command(adminId,'admin.adjust',{field:'luck',mode:'set',amount:Number.MAX_SAFE_INTEGER+1})).status,400);
  assert.equal((await command(adminId,'admin.adjust',{field:'gems',mode:'set',amount:12.55})).status,400);
  assert.equal((await command(adminId,'admin.adjust',{field:'coins',mode:'set',amount:12.55})).status,400);
  assert.equal((await command(adminId,'admin.adjust',{field:'demonKeys',mode:'add',amount:1.5})).status,400);
  assert.equal((await command(adminId,'admin.adjust',{field:'demonKeys',mode:'set',amount:15})).status,400);
  const requestId=crypto.randomUUID(),args={field:'coins',mode:'add',amount:700.7};
  for(const result of await Promise.all([command(adminId,'admin.adjust',args,requestId),command(adminId,'admin.adjust',args,requestId)])){
   assert.equal(result.status,200);
   assert.equal((await result.json()).wallet.coins,850.7);
  }
  const {wallet:{demonKeys:priorKeys}}=await (await call(adminId)).json();
  const grantId=crypto.randomUUID(),grant={field:'demonKeys',mode:'add',amount:8};
  for(const response of await Promise.all([command(adminId,'admin.adjust',grant,grantId),command(adminId,'admin.adjust',grant,grantId)])){
   assert.equal(response.status,200);
   assert.equal((await response.json()).wallet.demonKeys,priorKeys+8);
  }
  for(const [field,mode,amount,value] of [['luck','set',120,120],['luck','add',35,155],['gems','set',20.5,20.5]]){
   const response=await command(adminId,'admin.adjust',{field,mode,amount});
   assert.equal(response.status,200);
   assert.equal((await response.json()).wallet[field],value);
  }
  const level=15,luck=75_000_000_000;
  assert.equal((await (await command(adminId,'admin.adjust',{field:'level',mode:'set',amount:level})).json()).result.value,level);
  assert.equal((await (await call(adminId,'/api/game?view=profile')).json()).profile.level,level);
  assert.equal((await (await command(adminId,'admin.adjust',{field:'luck',mode:'set',amount:luck})).json()).wallet.luck,luck);
  const funded=await (await command(adminId,'admin.adjust',{field:'mana',mode:'set',amount:2600})).json();
  assert.equal(funded.wallet.kingdom.mana,2600);
  const staged=await (await command(adminId,'admin.adjust',{field:'tower',mode:'set',amount:2})).json();
  assert.equal(staged.wallet.kingdom.towerLevel,2);
  assert.equal((await command(adminId,'admin.adjust',{field:'tower',mode:'set',amount:4})).status,400);
  const state=staged.wallet,now=Date.now();
  state.kingdom.towerConstruction={level:3,startedAt:now,endsAt:now+180_000};
  sqlite.prepare('UPDATE game_profiles SET wallet=? WHERE player_id=?').run(JSON.stringify(state),owner);
  assert.equal((await command(adminId,'admin.adjust',{field:'tower',mode:'set',amount:1})).status,400);
  const finishId=crypto.randomUUID();
  for(const response of await Promise.all([command(adminId,'admin.kingdom.finish',{},finishId),command(adminId,'admin.kingdom.finish',{},finishId)])){
   assert.equal(response.status,200);
   const {wallet}=await response.json();
   assert.equal(wallet.kingdom.towerLevel,3);
   assert.equal(wallet.playerXp,state.playerXp+600+wallet.achievementRewardXp-state.achievementRewardXp);
  }
  assert.equal((await command(adminId,'admin.kingdom.finish',{})).status,400);
  assert.deepEqual((await (await call(memberId,'/api/players',null,'')).json()).rows.map(row=>row.alias),['Fixture member']);
  const pull=await command(adminId,'pack.buy',{packId:'common',quantity:1});
  assert.equal(pull.status,200);
  assert.equal((await pull.json()).wallet.pending.luckAtPurchase,luck);
  assert.equal((await command(adminId,'admin.reset',{confirmation:'reset'})).status,400);
  const reset=await command(adminId,'admin.reset',{confirmation:'RESET'});
  assert.equal(reset.status,200);
  assert.equal((await reset.json()).wallet.coins,150);
  assert.deepEqual((await (await call(adminId,'/api/game?view=cards')).json()).cards,[]);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM game_scores WHERE player_id=?').get(owner).count,0);
  assert.equal((await (await call(memberId)).json()).wallet.coins,150);
 }finally{sqlite.close();}
});
async function unusedPort(){
 const probe=net.createServer().listen(0,'127.0.0.1');
 await once(probe,'listening');
 const {port}=probe.address();
 await new Promise(resolve=>probe.close(resolve));
 return port;
}
async function launch(port,volume,clientId='',variables={}){
 const child=spawn(process.execPath,['server/runtime.mjs'],{env:{...process.env,PORT:String(port),
  RAILWAY_ENVIRONMENT_ID:clientId?'runtime-test':'',RAILWAY_VOLUME_MOUNT_PATH:volume,
  GAME_PUBLIC_ORIGIN:publicOrigin,DISCORD_CLIENT_ID:clientId,...variables}});
 let stderr='';
 child.stderr.on('data',data=>{stderr+=data.toString()});
 try{
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Server did not start. '+stderr)),10000);
   child.once('error',error=>{clearTimeout(timeout);reject(error)});
   child.once('exit',code=>{clearTimeout(timeout);reject(Error('Server exited '+code+'. '+stderr))});
   child.stdout.on('data',data=>{
    if(data.toString().includes('is listening')){clearTimeout(timeout);resolve();}
   });
  });
  return child;
 }catch(error){child.kill();throw error;}
}
async function stop(child){
 if(child&&child.exitCode===null&&child.signalCode===null){
  const done=once(child,'exit');child.kill();await done;
 }
}

test('Railway serves the welcome guide and requires Discord for gameplay',async()=>{
 const volume=await mkdtemp(join(tmpdir(),'gd-discord-gate-'));
 const base='http://127.0.0.1:'+await unusedPort();
 const clientId='1570000000000000000';
 let child;
 try{
  child=await launch(new URL(base).port,volume,clientId);
  const page=await (await fetch(base)).text();
  assert.match(page,/id="brandName">Geometry Dash Kingdom<\/strong>/);
  assert.doesNotMatch(page.match(/<header>[\s\S]*?<\/header>/)[0],/Made by Groksnfp/);
  assert.match(page,/<section class="account-gate"[\s\S]*?<small class="account-credit">Made by Groksnfp<\/small>\s*<\/section>/);
  assert.match(page,/id="accountGate"/);
  assert.match(page,/class="discord-signin"/);
  assert.match(page,/class="discord-symbol"/);
  assert.match(page,/<summary>How to log in with Discord<\/summary>/);
  assert.match(page,/<h1 id="gameGateTitle"><img src="\/assets\/gd-kingdom-castle\.webp"[^>]+alt="GD Kingdom"/);
  const logo=await fetch(base+'/assets/gd-kingdom-castle.webp');
  assert.equal(logo.status,200);
  assert.equal(logo.headers.get('content-type'),'image/webp');
  assert.match(page,/<main id="gameMain" hidden>/);
  const start=await fetch(base+'/api/game');
  assert.equal(start.headers.get('set-cookie'),null);
  assert.equal((await start.json()).requiresSignIn,true);
  const login=await fetch(base+'/signin-with-discord',{redirect:'manual'});
  assert.equal(login.status,303);
  const authorize=new URL(login.headers.get('location'));
  assert.equal(authorize.origin,'https://discord.com');
  assert.equal(authorize.searchParams.get('client_id'),clientId);
  assert.equal(authorize.searchParams.get('redirect_uri'),publicOrigin+'/api/auth/discord/callback');
 }finally{
  await stop(child);
  await rm(volume,{recursive:true,force:true});
 }
});

test('the HTTP server keeps the wallet and cards across a restart',async()=>{
 const volume=await mkdtemp(join(tmpdir(),'gd-game-volume-'));
 const port=await unusedPort();
 const base='http://127.0.0.1:'+port;
 let child;
 try{
  child=await launch(port,volume);
  const health=await fetch(base+'/health');
  assert.deepEqual(await health.json(),{status:'ok'});
  const page=await fetch(base);
  assert.match(await page.text(),/<title>Geometry Dash Kingdom<\/title>/i);
  const start=await fetch(base+'/api/game',{headers:{'oai-authenticated-user-id':'fixture'}});
  const account=await start.json();
  assert.equal(account.signedIn,false);
  assert.equal(account.accountSignIn,false);
  const header=start.headers.get('set-cookie');
  assert.match(header,/^__Host-gdlb-save=.*HttpOnly.*Secure/i);
  const cookie=header.split(';')[0];
  const body=JSON.stringify({action:'pack.buy',args:{packId:'common',quantity:1},requestId:crypto.randomUUID()});
  const headers={cookie,'Content-Type':'application/json',Origin:publicOrigin};
  const attempt=await fetch(base+'/api/game',{method:'POST',body,headers:{...headers,Origin:'https://other.example'}});
  assert.equal(attempt.status,403);
  const bought=await fetch(base+'/api/game',{method:'POST',body,headers});
  assert.equal(bought.status,200);
  assert.equal((await bought.json()).wallet.coins,135);
  await stop(child);
  child=await launch(port,volume);
  const save=await fetch(base+'/api/game',{headers:{cookie}});
  assert.equal((await save.json()).wallet.coins,135);
  const inventory=await fetch(base+'/api/game?view=cards',{headers:{cookie}});
  assert.equal((await inventory.json()).cards.reduce((sum,entry)=>sum+entry.copies,0),5);
  const ranks=await fetch(base+'/api/players',{headers:{cookie}});
  assert.equal((await ranks.json()).canPost,true);
 }finally{
  await stop(child);
  await rm(volume,{recursive:true,force:true});
 }
});

const tradePool=createCardPool(path=>JSON.parse(readFileSync(new URL('../web'+path,import.meta.url),'utf8')));

test('the Discord profile bridge requires its key and respects every showcase privacy setting',async()=>{
 const volume=await mkdtemp(join(tmpdir(),'gd-discord-profile-'));
 const {sqlite}=openGameDatabase(join(volume,'gd-lvl-battles.sqlite'));
 const discordId='1570000000000000100',adminId='1570000000000000200',unknownId='1570000000000000300';
 const token='ab'.repeat(32),port=await unusedPort(),base='http://127.0.0.1:'+port;
 const id=crypto.randomUUID(),now=Date.now();
 const [card]=await tradePool('Easy');
 const saved={...newWallet(),playerXp:playerXpAtLevel(8),kingdom:{towerLevel:2,landLevel:1}};
 const insert=sqlite.prepare('INSERT INTO game_profiles(player_id,owner,wallet,updated_at) VALUES(?,?,?,?)');
 insert.run(id,'discord:'+discordId,JSON.stringify(saved),now);
 insert.run(crypto.randomUUID(),'discord:'+adminId,JSON.stringify(saved),now);
 sqlite.prepare('INSERT INTO game_cards(player_id,level_id,card) VALUES(?,?,?)')
  .run(id,card[0],JSON.stringify({id:card[0],row:card,copies:2}));
 const settings=options=>sqlite.prepare('UPDATE game_profiles SET wallet=? WHERE player_id=?').run(JSON.stringify({...saved,...options}),id);
 let child;
 try{
  child=await launch(port,volume,'1570000000000000000',{GDK_PROFILE_API_KEY:token,GAME_ADMIN_DISCORD_ID:adminId});
  const api=(member=discordId,headers={Authorization:'Bearer '+token},method='GET')=>
   fetch(base+'/api/discord/profile?member='+encodeURIComponent(member),{headers,method});
  assert.equal((await api(discordId,{})).status,401);
  assert.equal((await api(discordId,{Authorization:'Bearer '+'00'.repeat(32)})).status,401);
  assert.equal((await api(discordId,{'oai-authenticated-user-id':discordId,'discord-bot-profile-authorized':'true'})).status,401);
  assert.equal((await api(discordId,undefined,'POST')).status,405);
  assert.equal((await api('Groks')).status,400);
  assert.equal((await api(adminId)).status,404);
  const missing=await (await api(unknownId)).json();
  assert.equal((await fetch(base+'/api/players?player='+id)).status,401);

  const response=await api(),profile=await response.json();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(Object.keys(profile).sort(),['bestCard','kingdom','stats']);
  assert.equal(profile.stats.level,8);
  assert.equal(profile.stats.unique,1);
  assert.equal(profile.stats.copies,2);
  assert.equal(profile.bestCard.title,card[1]);
  assert.ok(profile.bestCard.basic&&profile.bestCard.signature);
  assert.match(profile.bestCard.art,/^\/(?:assets\/|api\/thumbnail\/)/);
  assert.equal(profile.kingdom.towerLevel,2);
  assert.equal('wallet' in profile,false);

  settings({shareBestCard:false});
  const cardHidden=await (await api()).json();
  assert.equal('bestCard' in cardHidden,false);
  assert.equal(cardHidden.kingdom.towerLevel,2);
  settings({shareKingdom:false});
  const kingdomHidden=await (await api()).json();
  assert.equal('kingdom' in kingdomHidden,false);
  assert.equal(kingdomHidden.bestCard.title,card[1]);
  settings({profileHidden:true});
  const hidden=await api();
  assert.equal(hidden.status,404);
  assert.equal(hidden.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(await hidden.json(),missing);
  settings({});
  sqlite.prepare('UPDATE game_profiles SET banned_at=? WHERE player_id=?').run(now,id);
  assert.equal((await api()).status,404);
 }finally{
  await stop(child);
  sqlite.close();
  await rm(volume,{recursive:true,force:true});
 }
});

function tradeFixture(t){
 const {DB,sqlite}=openGameDatabase(':memory:');
 t.after(()=>sqlite.close());
 const adminDiscordId='1590000000000000000',insertPlayer=sqlite.prepare(
  'INSERT INTO game_profiles(player_id,owner,wallet,updated_at) VALUES(?,?,?,?)');
 const insertDiscord=sqlite.prepare('INSERT INTO game_discord_profiles(discord_id,username,display_name) VALUES(?,?,?)');
 const insertCard=sqlite.prepare('INSERT INTO game_cards(player_id,level_id,card) VALUES(?,?,?)');
 let players=0;
 const player=(username,level=15,{admin=false,wallet={}}={})=>{
  const account={id:crypto.randomUUID(),discord:admin?adminDiscordId:String(1590000000000000000n+BigInt(++players))};
  insertPlayer.run(account.id,'discord:'+account.discord,JSON.stringify({...newWallet(),playerXp:playerXpAtLevel(level),...wallet}),Date.now());
  insertDiscord.run(account.discord,username,username[0].toUpperCase()+username.slice(1));
  return account;
 };
 const call=(account,path='/api/game',body,origin=publicOrigin)=>worker.fetch(new Request(publicOrigin+path,{
  method:body?'POST':'GET',headers:body?{Origin:origin,'Content-Type':'application/json'}:undefined,
  body:body?JSON.stringify(body):undefined
 }),{DB,guestOnly:true,discordEnabled:true,discordUser:account?.discord,adminDiscordId});
 const json=async(account,path,body,status=200,origin)=>{
  const response=await call(account,path,body,origin),data=await response.json();
  assert.equal(response.status,status,JSON.stringify(data));
  return data;
 };
 const read=(account,view,params={},status)=>json(account,'/api/trades?'+new URLSearchParams({view,...params}),undefined,status);
 const send=(account,action,args,status,requestId=crypto.randomUUID())=>json(account,'/api/trades',{action,args,requestId},status);
 const command=(account,action,args,status)=>json(account,'/api/game',{action,args,requestId:crypto.randomUUID()},status);
 const card=(account,row,copies,holoCopies=0,antimatterCopies=0)=>insertCard.run(account.id,row[0],
  JSON.stringify({id:row[0],row,copies,holoCopies,antimatterCopies}));
 const owned=(account,id)=>JSON.parse(sqlite.prepare('SELECT card FROM game_cards WHERE player_id=? AND level_id=?').get(account.id,id).card);
 return {sqlite,player,call,json,read,send,command,card,owned};
}
const tradeLine=(row,finish='standard',count=1)=>({id:row[0],finish,count});

test('Achievement counts report saved stage ownership without revealing player profiles',async t=>{
 const now=Date.now();
 t.mock.timers.enable({apis:['Date'],now});
 const f=tradeFixture(t),path='/api/game?view=achievement-stats';
 const wood={'opened-packs:1':now};
 const a=f.player('reader',15,{wallet:{achievements:{...wood,'opened-packs:2':now,unknown:now}}});
 f.player('hidden',15,{wallet:{profileHidden:true,achievements:wood}});
 const c=f.player('newcomer');
 const banned=f.player('banned',15,{wallet:{achievements:wood}});
 f.sqlite.prepare('UPDATE game_profiles SET banned_at=? WHERE player_id=?').run(now,banned.id);
 f.player('owner',20,{admin:true,wallet:{achievements:{...wood,'opened-packs:2':now}}});
 f.sqlite.prepare('INSERT INTO game_profiles(player_id,owner,wallet,updated_at) VALUES(?,?,?,?)')
  .run(crypto.randomUUID(),'guest:fixture',JSON.stringify({achievements:wood}),now);
 const expected={players:3,earned:{'opened-packs:1':2,'opened-packs:2':1}};
 assert.deepEqual(await f.json(a,path),{'achievement-stats':expected});
 await f.json(null,path,undefined,401);
 await f.json(banned,path,undefined,403);
 f.sqlite.prepare('UPDATE game_profiles SET wallet=json_set(wallet,\'$.achievements\',json(?)) WHERE player_id=?')
  .run(JSON.stringify(wood),c.id);
 assert.deepEqual(await f.json(c,path),{'achievement-stats':expected});
 t.mock.timers.tick(30_001);
 assert.deepEqual(await f.json(c,path),{'achievement-stats':{players:3,earned:{...expected.earned,'opened-packs:1':3}}});
});

test('Trading matches usernames, honors receive floors, and exchanges exact finishes once',async t=>{
 const f=tradeFixture(t),a=f.player('merchant'),b=f.player('dash_mina',16),c=f.player('lowlevel',14);
 const [easy,elsewhere]=await tradePool('Easy');
 f.card(a,easy,4,3);f.card(b,elsewhere,1,0,1);
 assert.deepEqual((await f.read(a,'overview')).settings,{enabled:true,minimum:0});
 assert.equal((await f.read(c,'find',{q:'mina'},403)).error,'Only level 15+ people can trade.');
 assert.deepEqual((await f.read(a,'find',{q:'@DASH_MINA'})).players.map(p=>p.id),[b.id]);
 assert.deepEqual((await f.read(a,'find',{q:'lowlevel'})).players,[]);
 assert.deepEqual((await f.read(a,'find',{q:'merchant'})).players,[]);
 await f.command(b,'trade.settings',{enabled:false,minimum:0});
 assert.deepEqual((await f.read(a,'find',{q:'mina'})).players,[]);
 await f.read(a,'collection',{id:b.id,side:'get'},403);
 await f.command(b,'trade.settings',{enabled:true,minimum:10});
 assert.deepEqual((await f.read(a,'partner',{id:b.id})).minimum,{give:10,get:0});
 assert.deepEqual((await f.read(a,'collection',{id:b.id,side:'give'})).cards,[]);
 const args={player:b.id,offered:[tradeLine(easy,'holo',3)],requested:[tradeLine(elsewhere,'antimatter')]};
 await f.send(a,'propose',args,409);
 await f.command(b,'trade.settings',{enabled:true,minimum:0});
 const collection=await f.read(a,'collection',{id:b.id,side:'get',q:String(elsewhere[0]),finish:'antimatter'});
 assert.equal(collection.cards.length,1);
 assert.equal(collection.cards[0].finish,'antimatter');
 assert.ok(collection.cards[0].hp>0&&collection.cards[0].attack>0&&collection.cards[0].signature);
 assert.deepEqual(collection.cards[0].market,{value:null,demand:0,samples:0});
 await f.send(a,'propose',{...args,offered:[tradeLine(easy,'holo',4)]},409);
 const requestId=crypto.randomUUID(),created=await f.send(a,'propose',args,200,requestId);
 assert.equal((await f.send(a,'propose',args,200,requestId)).trade.id,created.trade.id);
 const {id}=created.trade;
 assert.equal((await f.read(a,'outgoing')).trades.length,1);
 assert.equal((await f.read(b,'incoming')).trades[0].giveCount,1);
 assert.equal((await f.read(a,'quotes',{id:elsewhere[0]})).quotes.antimatter.demand,1);
 await f.read(f.player('stranger'),'detail',{id},404);
 await f.send(a,'accept',{id},403);
 await f.command(b,'trade.settings',{enabled:false,minimum:0});
 await f.send(b,'accept',{id},403);
 await f.command(b,'trade.settings',{enabled:true,minimum:0});
 const receipts=await Promise.all([f.send(b,'accept',{id}),f.send(b,'accept',{id})]);
 assert.deepEqual(receipts[0],receipts[1]);
 assert.equal(receipts[0].trade.status,'completed');
 assert.equal(receipts[0].trade.give[0].finish,'antimatter');
 assert.equal(receipts[0].trade.get[0].finish,'holo');
 assert.equal(f.owned(a,easy[0]).copies,1);
 assert.equal(f.owned(a,easy[0]).holoCopies,0);
 assert.equal(f.owned(a,elsewhere[0]).antimatterCopies,1);
 assert.equal(f.owned(b,elsewhere[0]).copies,0);
 assert.equal(f.owned(b,easy[0]).holoCopies,3);
 assert.equal((await f.json(a)).wallet.cardsRevision,1);
 assert.equal((await f.read(a,'history')).trades[0].id,id);
 assert.equal((await f.read(a,'detail',{id})).trade.give[0].finish,'holo');
 assert.equal((await f.read(a,'outgoing')).trades.length,0);
});

test('Trade values block lopsided requests and recheck saved offers before any transfer',async t=>{
 const f=tradeFixture(t),a=f.player('balance_a'),b=f.player('balance_b');
 const [give,get]=await tradePool('Easy'),[rare]=await tradePool('Extreme Demon');
 f.card(a,give,2);f.card(b,get,1);f.card(b,rare,1,0,1);
 assert.equal(tradeBalance(85,100).allowed,true);
 assert.equal(tradeBalance(1000,849).allowed,false);
 assert.equal(tradeSearchTerm(' balance_b '),'@balance_b');
 assert.equal(tradeSearchTerm(b.discord),b.discord);
 assert.equal(tradeSearchTerm('<@!'+b.discord+'>'),b.discord);
 assert.equal(tradeSearchTerm('Some Display Name'),'Some Display Name');
 assert.deepEqual((await f.read(a,'find',{q:'balance_b'})).players.map(player=>player.id),[b.id]);
 const args={player:b.id,offered:[tradeLine(give)],requested:[tradeLine(get)]};
 const attempted=await f.send(a,'propose',{...args,requested:[{...tradeLine(rare,'antimatter'),basePower:0,market:{value:0}}]},409);
 assert.match(attempted.error,/within 15% in trade value/);
 const {trade}=await f.send(a,'propose',args);
 assert.equal(trade.expiresAt-trade.createdAt,48*86_400_000);
 assert.deepEqual(readRoute('#trading/trade/'+trade.id),{section:'trading',tier:'trading',trade:trade.id});
 const stale=[{...trade.get[0],id:rare[0],finish:'antimatter'}];
 f.sqlite.prepare('UPDATE game_trades SET requested=? WHERE trade_id=?').run(JSON.stringify(stale),trade.id);
 const rejected=await f.send(b,'accept',{id:trade.id},409);
 assert.match(rejected.error,/within 15% in trade value/);
 assert.equal(f.owned(a,give[0]).copies,2);
 assert.equal(f.owned(b,rare[0]).antimatterCopies,1);
 assert.equal((await f.read(b,'detail',{id:trade.id})).trade.status,'pending');
 f.sqlite.prepare('UPDATE game_trades SET expires_at=? WHERE trade_id=?').run(Date.now()-1,trade.id);
 assert.deepEqual((await f.read(b,'incoming')).trades,[]);
 assert.deepEqual((await f.read(a,'outgoing')).trades,[]);
 assert.equal((await f.read(b,'history')).trades[0].status,'expired');
 assert.match((await f.send(b,'accept',{id:trade.id},409)).error,/already expired/);
});

test('Competing offers cannot exchange the same copy twice and unresolved offers can close',async t=>{
 const f=tradeFixture(t),[give,get,newCard]=await tradePool('Normal');
 const sender=f.player('sender',15,{wallet:{squad:[give[0]],training:{[give[0]]:{xp:500}}}}),a=f.player('first'),b=f.player('second');
 f.card(sender,give,1);f.card(a,get,1);f.card(b,get,1);
 const proposal=async target=>(await f.send(sender,'propose',{player:target.id,offered:[tradeLine(give)],requested:[tradeLine(get)]})).trade;
 const [offerA,offerB]=await Promise.all([proposal(a),proposal(b)]);
 const accept=(account,id)=>f.call(account,'/api/trades',{action:'accept',args:{id},requestId:crypto.randomUUID()});
 const results=await Promise.all([accept(a,offerA.id),accept(b,offerB.id)]);
 assert.deepEqual(results.map(res=>res.status).sort(),[200,409]);
 const wallet=(await f.json(sender)).wallet;
 assert.deepEqual(wallet.squad,[]);
 assert.equal(wallet.training[give[0]].xp,500);
 assert.equal(f.owned(sender,give[0]).copies,0);
 assert.equal(f.owned(sender,get[0]).copies,1);
 assert.equal(Number(f.owned(a,get[0]).copies===0)+Number(f.owned(b,get[0]).copies===0),1);
 const open=results[0].ok?offerB:offerA,loser=results[0].ok?b:a;
 assert.equal((await f.send(loser,'decline',{id:open.id})).trade.status,'declined');
 const returned=await f.send(sender,'propose',{player:loser.id,offered:[tradeLine(get)],requested:[tradeLine(get,'holo')]},409);
 assert.match(returned.error,/no longer available/);
 f.card(loser,newCard,1);
 const fresh=(await f.send(sender,'propose',{player:loser.id,offered:[tradeLine(get)],requested:[tradeLine(newCard)]})).trade;
 assert.equal((await f.send(sender,'cancel',{id:fresh.id})).trade.status,'cancelled');
 const expired=(await f.send(sender,'propose',{player:loser.id,offered:[tradeLine(get)],requested:[tradeLine(newCard)]})).trade;
 f.sqlite.prepare('UPDATE game_trades SET expires_at=? WHERE trade_id=?').run(Date.now()-1,expired.id);
 await f.send(loser,'accept',{id:expired.id},409);
 assert.equal((await f.read(loser,'detail',{id:expired.id})).trade.status,'expired');
});

test('Market prices need five trading pairs, respond to overpayment, and stay separate by finish',async t=>{
 const f=tradeFixture(t),sender=f.player('market_seller'),buyers=['alex','blair','casey','dara','elliot','frank'].map(name=>f.player(name));
 const card=(await tradePool('Extreme Demon')).at(-1),[offers]=await tradePool('Medium Demon');
 f.card(sender,card,7);for(const buyer of buyers)f.card(buyer,offers,20);
 const exchange=async(buyer,count=9)=>{
  const {trade}=await f.send(buyer,'propose',{player:sender.id,offered:[tradeLine(offers,'standard',count)],requested:[tradeLine(card)]});
  return (await f.send(sender,'accept',{id:trade.id})).trade;
 };
 const quote=()=>f.read(sender,'quotes',{id:card[0]}).then(result=>result.quotes);
 await exchange(buyers[0]);await exchange(buyers[0]);await exchange(buyers[1]);
 assert.deepEqual((await quote()).standard,{value:null,demand:2,samples:2});
 await exchange(buyers[2]);await exchange(buyers[3]);
 assert.deepEqual((await quote()).standard,{value:null,demand:4,samples:4});
 const receipt=await exchange(buyers[4]);
 assert.equal(receipt.give[0].market.value,null);
 const {standard,holo}=await quote();
 assert.ok(standard.value>0);
 assert.equal(standard.demand,5);
 assert.equal(standard.samples,5);
 assert.deepEqual(holo,{value:null,demand:0,samples:0});
 const search=await f.read(sender,'market',{q:card[0],finish:'standard'});
 assert.equal(search.cards[0].market.value,standard.value);
 await exchange(buyers[5],10);
 assert.ok((await quote()).standard.value>standard.value);
 assert.ok((await f.json(sender)).wallet.achievements['trade-first']);
 f.sqlite.prepare("UPDATE game_trades SET resolved_at=? WHERE status='completed'").run(Date.now()-31*86_400_000);
 assert.deepEqual((await quote()).standard,{value:null,demand:0,samples:0});
 assert.equal((await f.read(sender,'detail',{id:receipt.id})).trade.give[0].market.value,null);
});

test('Only the configured owner can set another player’s level and coins or ban and unban them',async t=>{
 const f=tradeFixture(t),owner=f.player('owner',20,{admin:true}),a=f.player('player_a'),b=f.player('player_b');
 const path='/api/admin/players',change=(account,id,action,amount,status,requestId=crypto.randomUUID())=>
  f.json(account,path,{id,action,amount,requestId},status);
 await f.json(a,path+'?q=player',undefined,403);
 await change(a,b.id,'ban',undefined,403);
 await change(owner,owner.id,'ban',undefined,400);
 await f.json(owner,path,{id:a.id,action:'ban',requestId:crypto.randomUUID()},403,'https://other.example');
 assert.deepEqual((await f.json(owner,path+'?q=%40PLAYER_A')).players.map(p=>p.id),[a.id]);
 assert.equal((await change(owner,a.id,'level',32)).player.level,32);
 const requestId=crypto.randomUUID();
 await Promise.all([change(owner,a.id,'coins',7620,200,requestId),change(owner,a.id,'coins',7620,200,requestId)]);
 const {wallet}=await f.json(a);
 assert.equal(wallet.playerXp,playerXpAtLevel(32));
 assert.equal(wallet.coins,7620);
 const [give,get]=await tradePool('Harder');f.card(a,give,1);f.card(b,get,1);
 const {trade}=await f.send(a,'propose',{player:b.id,offered:[tradeLine(give)],requested:[tradeLine(get)]});
 assert.ok((await change(owner,a.id,'ban')).player.bannedAt>0);
 const account=await f.json(a);
 assert.equal(account.banned,true);
 assert.equal(account.wallet,undefined);
 await f.json(a,'/api/game?view=cards',undefined,403);
 await f.command(a,'pack.buy',{packId:'common',quantity:1},403);
 assert.deepEqual((await f.read(b,'find',{q:'player_a'})).players,[]);
 assert.equal((await f.read(b,'detail',{id:trade.id})).trade.status,'cancelled');
 const {rows}=await f.json(b,'/api/players');assert.ok(!rows.some(row=>row.id===a.id));
 assert.equal((await change(owner,a.id,'unban')).player.bannedAt,null);
 assert.equal((await f.json(a)).wallet.coins,7620);
 assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS count FROM game_admin_player_actions').get().count,4);
});

test('Trade search supports exact Discord IDs and hides each unowned Impossible card',async t=>{
 const f=tradeFixture(t),player=f.player('searcher'),partner=f.player('collector'),[one,two]=await tradePool('Impossible');
 const hash='1234567890abcdef1234567890abcdef';
 f.sqlite.prepare('UPDATE game_discord_profiles SET avatar_hash=? WHERE discord_id=?').run(hash,partner.discord);
 f.card(partner,one,1);f.card(partner,two,1);
 const results=await f.read(player,'find',{q:partner.discord});
 assert.equal(results.players[0].id,partner.id);
 assert.equal(results.players[0].avatar,'https://cdn.discordapp.com/avatars/'+partner.discord+'/'+hash+'.webp?size=64');
 assert.deepEqual(await f.read(player,'market',{tier:11}),{cards:[],more:false,hasSecrets:false});
 await f.read(player,'quotes',{id:one[0]},404);
 assert.deepEqual((await f.read(player,'collection',{id:partner.id,side:'get'})).cards,[]);
 f.card(player,one,1);
 const allowed=await f.read(player,'market',{tier:11});
 assert.deepEqual(allowed.cards.map(card=>card.id),[one[0]]);
 assert.deepEqual((await f.read(player,'collection',{id:partner.id,side:'get'})).cards.map(card=>card.id),[one[0]]);
 await f.read(player,'quotes',{id:one[0]});
 await f.read(player,'quotes',{id:two[0]},404);
});
