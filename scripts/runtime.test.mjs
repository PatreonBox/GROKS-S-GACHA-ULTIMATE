import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import net from 'node:net';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createDiscordAuth} from '../server/discord.mjs';
import {openGameDatabase} from '../server/sqlite.mjs';
import worker from '../dist/server/index.js';

const publicOrigin='https://gd-fixture.up.railway.app';

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
  return Response.json({id:userId});
 });
 const configure=request=>({DB,guestOnly:true,discordEnabled:true,discordUser:auth.user(request)});
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
  assert.equal((await linked.json()).signedIn,true);
  assert.equal(sqlite.prepare('SELECT owner FROM game_profiles WHERE player_id=?').get(player_id).owner,'discord:'+userId);
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
  assert.match(page,/id="accountGate"/);
  assert.match(page,/class="discord-signin"/);
  assert.match(page,/class="discord-symbol"/);
  assert.match(page,/<summary>How to play<\/summary>/);
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
  assert.match(await page.text(),/<title>GD Kingdom<\/title>/i);
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
