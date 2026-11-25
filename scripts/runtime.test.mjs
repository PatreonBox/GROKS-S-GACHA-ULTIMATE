import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import net from 'node:net';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const publicOrigin='https://gd-fixture.up.railway.app';
async function unusedPort(){
 const probe=net.createServer().listen(0,'127.0.0.1');
 await once(probe,'listening');
 const {port}=probe.address();
 await new Promise(resolve=>probe.close(resolve));
 return port;
}
async function launch(port,volume){
 const child=spawn(process.execPath,['server/runtime.mjs'],{env:{...process.env,PORT:String(port),
  RAILWAY_ENVIRONMENT_ID:'runtime-test',RAILWAY_VOLUME_MOUNT_PATH:volume,GAME_PUBLIC_ORIGIN:publicOrigin}});
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

test('the production HTTP server keeps the wallet and cards across a restart',async()=>{
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
