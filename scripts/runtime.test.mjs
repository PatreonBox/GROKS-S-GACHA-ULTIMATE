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
import {createDiscordAuth} from '../server/discord.mjs';
import {createBugReports} from '../server/bug-reports.mjs';
import {openGameDatabase} from '../server/sqlite.mjs';
import {cardCategories,createCardPool} from '../web/pack-engine.js';
import {newWallet} from '../web/game-rules.js';
import {playerXpAtLevel} from '../web/player-progression.js';
import worker from '../dist/server/index.js';

const publicOrigin='https://gd-fixture.up.railway.app';

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
   {coins:1500,gems:10,unique:2,copies:3,level:0,rank:1,privateRank:false,power:0,collectible:catalog.size,campaignClears:0,campaignTotal:10});
  assert.equal((await (await game(sessionCookie)).json()).wallet.coins,1500);
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
  assert.equal((await command(memberId,'admin.reset',{confirmation:'RESET'})).status,403);
  assert.equal((await command(adminId,'admin.adjust',{field:'luck',mode:'set',amount:501})).status,400);
  assert.equal((await command(adminId,'admin.adjust',{field:'gems',mode:'set',amount:12.55})).status,400);
  const requestId=crypto.randomUUID(),args={field:'coins',mode:'add',amount:700};
  for(const result of await Promise.all([command(adminId,'admin.adjust',args,requestId),command(adminId,'admin.adjust',args,requestId)])){
   assert.equal(result.status,200);
   assert.equal((await result.json()).wallet.coins,2200);
  }
  for(const [field,mode,amount,value] of [['luck','set',120,120],['luck','add',35,155],['gems','set',20.5,20.5]]){
   const response=await command(adminId,'admin.adjust',{field,mode,amount});
   assert.equal(response.status,200);
   assert.equal((await response.json()).wallet[field],value);
  }
  assert.deepEqual((await (await call(memberId,'/api/players',null,'')).json()).rows.map(row=>row.alias),['Fixture member']);
  assert.equal((await command(adminId,'pack.buy',{packId:'common',quantity:1})).status,200);
  assert.equal((await command(adminId,'admin.reset',{confirmation:'reset'})).status,400);
  const reset=await command(adminId,'admin.reset',{confirmation:'RESET'});
  assert.equal(reset.status,200);
  assert.equal((await reset.json()).wallet.coins,1500);
  assert.deepEqual((await (await call(adminId,'/api/game?view=cards')).json()).cards,[]);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM game_scores WHERE player_id=?').get(owner).count,0);
  assert.equal((await (await call(memberId)).json()).wallet.coins,1500);
 }finally{sqlite.close();}
});
async function unusedPort(){
 const probe=net.createServer().listen(0,'127.0.0.1');
 await once(probe,'listening');
 const {port}=probe.address();
 await new Promise(resolve=>probe.close(resolve));
 return port;
}
async function launch(port,volume,clientId=''){
 const child=spawn(process.execPath,['server/runtime.mjs'],{env:{...process.env,PORT:String(port),
  RAILWAY_ENVIRONMENT_ID:clientId?'runtime-test':'',RAILWAY_VOLUME_MOUNT_PATH:volume,
  GAME_PUBLIC_ORIGIN:publicOrigin,DISCORD_CLIENT_ID:clientId}});
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
  assert.equal((await bought.json()).wallet.coins,1400);
  await stop(child);
  child=await launch(port,volume);
  const save=await fetch(base+'/api/game',{headers:{cookie}});
  assert.equal((await save.json()).wallet.coins,1400);
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

test('Trading matches usernames, honors receive floors, and exchanges exact finishes once',async t=>{
 const f=tradeFixture(t),a=f.player('merchant'),b=f.player('dash_mina',16),c=f.player('lowlevel',14);
 const [easy]=await tradePool('Easy'),[extreme]=await tradePool('Extreme Demon');
 f.card(a,easy,2,1);f.card(b,extreme,1,0,1);
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
 const args={player:b.id,offered:[tradeLine(easy,'holo')],requested:[tradeLine(extreme,'antimatter')]};
 await f.send(a,'propose',args,409);
 await f.command(b,'trade.settings',{enabled:true,minimum:0});
 const collection=await f.read(a,'collection',{id:b.id,side:'get',q:String(extreme[0]),finish:'antimatter'});
 assert.equal(collection.cards.length,1);
 assert.equal(collection.cards[0].finish,'antimatter');
 assert.ok(collection.cards[0].hp>0&&collection.cards[0].attack>0&&collection.cards[0].signature);
 assert.deepEqual(collection.cards[0].market,{value:null,demand:0,samples:0});
 await f.send(a,'propose',{...args,offered:[tradeLine(easy,'holo',2)]},409);
 const requestId=crypto.randomUUID(),created=await f.send(a,'propose',args,200,requestId);
 assert.equal((await f.send(a,'propose',args,200,requestId)).trade.id,created.trade.id);
 const {id}=created.trade;
 assert.equal((await f.read(a,'outgoing')).trades.length,1);
 assert.equal((await f.read(b,'incoming')).trades[0].giveCount,1);
 assert.equal((await f.read(a,'quotes',{id:extreme[0]})).quotes.antimatter.demand,1);
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
 assert.equal(f.owned(a,extreme[0]).antimatterCopies,1);
 assert.equal(f.owned(b,extreme[0]).copies,0);
 assert.equal(f.owned(b,easy[0]).holoCopies,1);
 assert.equal((await f.json(a)).wallet.cardsRevision,1);
 assert.equal((await f.read(a,'history')).trades[0].id,id);
 assert.equal((await f.read(a,'detail',{id})).trade.give[0].finish,'holo');
 assert.equal((await f.read(a,'outgoing')).trades.length,0);
});

test('Competing offers cannot exchange the same copy twice and unresolved offers can close',async t=>{
 const f=tradeFixture(t),[give,get]=await tradePool('Normal');
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
 const [newCard]=await tradePool('Hard');f.card(loser,newCard,1);
 const fresh=(await f.send(sender,'propose',{player:loser.id,offered:[tradeLine(get)],requested:[tradeLine(newCard)]})).trade;
 assert.equal((await f.send(sender,'cancel',{id:fresh.id})).trade.status,'cancelled');
 const expired=(await f.send(sender,'propose',{player:loser.id,offered:[tradeLine(get)],requested:[tradeLine(newCard)]})).trade;
 f.sqlite.prepare('UPDATE game_trades SET expires_at=? WHERE trade_id=?').run(Date.now()-1,expired.id);
 await f.send(loser,'accept',{id:expired.id},409);
 assert.equal((await f.read(loser,'detail',{id:expired.id})).trade.status,'expired');
});

test('Market prices need three trading pairs, count demand once per player, and stay separate by finish',async t=>{
 const f=tradeFixture(t),sender=f.player('market_seller'),buyers=['alex','blair','casey'].map(name=>f.player(name));
 const [card]=await tradePool('Extreme Demon'),[offers]=await tradePool('Insane Demon');
 f.card(sender,card,4);for(const buyer of buyers)f.card(buyer,offers,2);
 const exchange=async buyer=>{
  const {trade}=await f.send(buyer,'propose',{player:sender.id,offered:[tradeLine(offers)],requested:[tradeLine(card)]});
  return (await f.send(sender,'accept',{id:trade.id})).trade;
 };
 const quote=()=>f.read(sender,'quotes',{id:card[0]}).then(result=>result.quotes);
 await exchange(buyers[0]);await exchange(buyers[0]);await exchange(buyers[1]);
 assert.deepEqual((await quote()).standard,{value:null,demand:2,samples:2});
 const receipt=await exchange(buyers[2]);
 assert.equal(receipt.give[0].market.value,null);
 const {standard,holo}=await quote();
 assert.ok(standard.value>0);
 assert.equal(standard.demand,3);
 assert.equal(standard.samples,3);
 assert.deepEqual(holo,{value:null,demand:0,samples:0});
 const search=await f.read(sender,'market',{q:card[0],finish:'standard'});
 assert.equal(search.cards[0].market.value,standard.value);
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
