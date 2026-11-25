import {createHash,randomBytes} from 'node:crypto';

const issuer='https://discord.com';
const callback='/api/auth/discord/callback';
const flowCookie='__Host-gdlb-discord-flow';
const sessionCookie='__Host-gdlb-discord-session';
const flowSeconds=600;
const sessionSeconds=30*24*60*60;
const secret=()=>randomBytes(32).toString('hex');
const hash=(value,encoding='hex')=>createHash('sha256').update(value).digest(encoding);
const snowflake=value=>typeof value==='string'&&/^\d{17,20}$/.test(value);
const cookie=(name,value,maxAge)=>name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;
const destination=value=>typeof value==='string'&&/^\/(?:#[-/\w=&]{1,160})?$/.test(value)?value:'/#gacha';

function cookieValue(request,name){
 const prefix=name+'=';
 const value=request.headers.get('cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(prefix))?.slice(prefix.length);
 return /^[a-f0-9]{64}$/.test(value||'')?value:null;
}
function redirect(location,cookies=[]){
 const headers=new Headers({Location:location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 for(const value of cookies)headers.append('Set-Cookie',value);
 return new Response(null,{status:303,headers});
}

export function createDiscordAuth(sqlite,{origin,clientId},send=fetch){
 if(!clientId)return null;
 if(!snowflake(clientId))throw Error('DISCORD_CLIENT_ID must be a Discord application ID.');
 const redirectUri=origin+callback;
 const clearFlow=()=>cookie(flowCookie,'',0);
 const accountToken=request=>cookieValue(request,sessionCookie);
 const removeSession=token=>{
  if(token)sqlite.prepare('DELETE FROM game_discord_sessions WHERE token_hash=?').run(hash(token));
 };

 function begin(request,url){
  const token=secret(),state=secret(),verifier=secret(),now=Date.now();
  const prior=cookieValue(request,flowCookie);
  sqlite.prepare('DELETE FROM game_discord_flows WHERE expires_at<=? OR token_hash=?').run(now,prior?hash(prior):'');
  sqlite.prepare('INSERT INTO game_discord_flows VALUES(?,?,?,?,?)').run(
   hash(token),hash(state),verifier,destination(url.searchParams.get('return_to')),now+flowSeconds*1000);
  const target=new URL(issuer+'/oauth2/authorize');
  target.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',
   scope:'identify',state,code_challenge:hash(verifier,'base64url'),code_challenge_method:'S256'});
  return redirect(target.toString(),[cookie(flowCookie,token,flowSeconds)]);
 }

 async function finish(request,url){
  const token=cookieValue(request,flowCookie),state=url.searchParams.get('state')||'';
  const flow=token&&/^[a-f0-9]{64}$/.test(state)&&sqlite.prepare(
   'DELETE FROM game_discord_flows WHERE token_hash=? AND state_hash=? AND expires_at>? RETURNING verifier,return_to'
  ).get(hash(token),hash(state),Date.now());
  const next=new URL(flow?.return_to||'/#gacha',origin);
  function failed(reason){
   next.searchParams.set('discord',reason);
   return redirect(next.href,[clearFlow()]);
  }
  if(!flow||url.searchParams.get('iss')!==issuer)return failed('failed');
  if(url.searchParams.get('error')==='access_denied')return failed('cancelled');
  const code=url.searchParams.get('code');
  if(!code||code.length>512)return failed('failed');
  try{
   // PKCE proves this server created the auth request. The verifier never leaves the server
   // except for the authorization-code exchange with Discord.
   const exchange=await send(issuer+'/api/oauth2/token',{method:'POST',redirect:'error',
    body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,redirect_uri:redirectUri,
     code,code_verifier:flow.verifier}),signal:AbortSignal.timeout(8000)});
   if(!exchange.ok)return failed('failed');
   const {access_token}=await exchange.json();
   if(typeof access_token!=='string'||!/^[\w.-]{1,4096}$/.test(access_token))return failed('failed');
   const profile=await send(issuer+'/api/v10/users/@me',{headers:{Authorization:'Bearer '+access_token},
    redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!profile.ok)return failed('failed');
   const {id}=await profile.json();
   if(!snowflake(id))return failed('failed');
   const session=secret(),now=Date.now();
   sqlite.prepare('DELETE FROM game_discord_sessions WHERE expires_at<=?').run(now);
   sqlite.prepare('INSERT INTO game_discord_sessions VALUES(?,?,?)').run(hash(session),id,now+sessionSeconds*1000);
   removeSession(accountToken(request));
   return redirect(next.href,[clearFlow(),cookie(sessionCookie,session,sessionSeconds)]);
  }catch{
   return failed('failed');
  }
 }

 return {
  user(request){
   const token=accountToken(request);
   if(!token)return null;
   return sqlite.prepare('SELECT discord_id FROM game_discord_sessions WHERE token_hash=? AND expires_at>?')
    .get(hash(token),Date.now())?.discord_id??null;
  },
  handle(request,url){
   if(url.pathname==='/signin-with-discord'&&request.method==='GET')return begin(request,url);
   if(url.pathname===callback&&request.method==='GET')return finish(request,url);
   if(url.pathname==='/api/auth/discord/logout'&&request.method==='POST'){
    if(request.headers.get('origin')!==origin)return new Response('Open the game to sign out.',{status:403});
    removeSession(accountToken(request));
    return redirect(origin+'/#gacha',[cookie(sessionCookie,'',0)]);
   }
   return null;
  }
 };
}
