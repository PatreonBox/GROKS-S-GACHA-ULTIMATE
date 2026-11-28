import {createHash,randomBytes} from 'node:crypto';

const issuer='https://discord.com';
export const officialGuildId='1575128305231859732';
const callback='/api/auth/discord/callback';
const flowCookie='__Host-gdlb-discord-flow';
const sessionCookie='__Host-gdlb-discord-session';
const flowSeconds=600;
const sessionSeconds=30*24*60*60;
const secret=()=>randomBytes(32).toString('hex');
const hash=(value,encoding='hex')=>createHash('sha256').update(value).digest(encoding);
const snowflake=value=>typeof value==='string'&&/^\d{17,20}$/.test(value);
const displayText=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,80):'';
const defaultAvatar=(id,discriminator)=>/^[0-9]{4}$/.test(discriminator)?Number(discriminator)%5:Number((BigInt(id)>>22n)%6n);
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

export function createDiscordAuth(sqlite,{origin,clientId,guildId},send=fetch){
 if(!clientId)return null;
 if(!snowflake(clientId))throw Error('DISCORD_CLIENT_ID must be a Discord application ID.');
 if(guildId&&!snowflake(guildId))throw Error('The official Discord server must have a valid ID.');
 const redirectUri=origin+callback;
 const clearFlow=()=>cookie(flowCookie,'',0);
 const accountToken=request=>cookieValue(request,sessionCookie);
 const removeSession=token=>{
  if(token)sqlite.prepare('DELETE FROM game_discord_sessions WHERE token_hash=?').run(hash(token));
 };

 function begin(request,url,profileSessionHash=null,automatic=false,membershipCheck=false){
  const token=secret(),state=secret(),verifier=secret(),now=Date.now();
  const prior=cookieValue(request,flowCookie);
  sqlite.prepare('DELETE FROM game_discord_flows WHERE expires_at<=? OR token_hash=?').run(now,prior?hash(prior):'');
  sqlite.prepare(`INSERT INTO game_discord_flows(token_hash,state_hash,verifier,return_to,expires_at,profile_session_hash,membership_check)
   VALUES(?,?,?,?,?,?,?)`).run(hash(token),hash(state),verifier,destination(url.searchParams.get('return_to')),
   now+flowSeconds*1000,profileSessionHash,Number(membershipCheck));
  const target=new URL(issuer+'/oauth2/authorize');
  target.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',
   scope:membershipCheck?'identify guilds.members.read':'identify',state,code_challenge:hash(verifier,'base64url'),code_challenge_method:'S256'});
  if(automatic)target.searchParams.set('prompt','none');
  return redirect(target.toString(),[cookie(flowCookie,token,flowSeconds)]);
 }

 function beginProfileRefresh(request,url){
  if(request.headers.get('origin')!==origin)return new Response('Open the game to update your Discord profile.',{status:403});
  const active=account(request),automatic=url.searchParams.get('automatic')==='1';
  const next=origin+destination(url.searchParams.get('return_to'));
  if(!active||(automatic&&!active.profile.autoRefresh))return redirect(next);
  const sessionHash=hash(accountToken(request));
  const claimed=sqlite.prepare(`UPDATE game_discord_sessions SET profile_refresh_attempted=1
   WHERE token_hash=? AND profile_refresh_attempted=0`).run(sessionHash);
  if(automatic&&!claimed.changes)return redirect(next);
  return begin(request,url,sessionHash,automatic);
 }

 function beginMembershipCheck(request,url){
  if(request.headers.get('origin')!==origin)return new Response('Open the game to check Discord membership.',{status:403});
  const active=account(request);
  if(!active)return redirect(origin+destination(url.searchParams.get('return_to')));
  return begin(request,url,hash(accountToken(request)),url.searchParams.get('automatic')==='1',true);
 }

 async function checkMembership(id,accessToken){
  if(sqlite.prepare('SELECT 1 FROM game_discord_key_bonus WHERE discord_id=?').get(id))return 'verified';
  try{
   const response=await send(issuer+'/api/v10/users/@me/guilds/'+guildId+'/member',{
    headers:{Authorization:'Bearer '+accessToken},redirect:'error',signal:AbortSignal.timeout(3500)
   });
   if(response.status===404)return 'not-member';
   if(!response.ok)return 'unavailable';
   const member=await response.json();
   if(typeof member.joined_at!=='string'||(member.user&&member.user.id!==id))return 'unavailable';
   if(member.pending)return 'pending';
   sqlite.prepare('INSERT OR IGNORE INTO game_discord_key_bonus(discord_id,verified_at) VALUES(?,?)').run(id,Date.now());
   return 'verified';
  }catch{return 'unavailable';}
 }

 async function finish(request,url){
  const token=cookieValue(request,flowCookie),state=url.searchParams.get('state')||'';
  const flow=token&&/^[a-f0-9]{64}$/.test(state)&&sqlite.prepare(
   'DELETE FROM game_discord_flows WHERE token_hash=? AND state_hash=? AND expires_at>? RETURNING verifier,return_to,profile_session_hash,membership_check'
  ).get(hash(token),hash(state),Date.now());
  const next=new URL(flow?.return_to||'/#gacha',origin);
  const profileSession=flow?.profile_session_hash;
  const membershipOnly=Boolean(profileSession&&flow.membership_check);
  function failed(reason){
   next.searchParams.set(membershipOnly?'discord_membership':profileSession?'discord_profile':'discord',reason);
   return redirect(next.href,[clearFlow()]);
  }
  if(!flow||url.searchParams.getAll('iss').some(value=>value!==issuer))return failed('failed');
  const boundAccount=profileSession&&hash(accountToken(request)||'')===profileSession?account(request):null;
  if(profileSession&&!boundAccount)return failed('failed');
  const error=url.searchParams.get('error');
  if(['access_denied','consent_required','interaction_required','login_required'].includes(error))return failed('cancelled');
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
   const {id,username,global_name,avatar,discriminator}=await profile.json();
   const handle=displayText(username);
   if(!snowflake(id)||!handle)return failed('failed');
   if(boundAccount&&boundAccount.id!==id)return failed('mismatch');
   const membership=guildId&&flow.membership_check?await checkMembership(id,access_token):null;
   if(profileSession&&!account(request))return failed('failed');
   const avatarHash=typeof avatar==='string'&&/^(?:a_)?[a-f0-9]{32}$/.test(avatar)?avatar:null;
   sqlite.prepare(`INSERT INTO game_discord_profiles(discord_id,username,display_name,avatar_hash,default_avatar_index)
    VALUES(?,?,?,?,?) ON CONFLICT(discord_id) DO UPDATE SET username=excluded.username,
    display_name=excluded.display_name,avatar_hash=excluded.avatar_hash,default_avatar_index=excluded.default_avatar_index`)
    .run(id,handle,displayText(global_name)||handle,avatarHash,defaultAvatar(id,discriminator));
   if(profileSession){
    if(membershipOnly)next.searchParams.set('discord_membership',membership||'unavailable');
    return redirect(next.href,[clearFlow()]);
   }
   if(membership==='not-member')next.searchParams.set('discord_membership',membership);
   const session=secret(),now=Date.now();
   sqlite.prepare('DELETE FROM game_discord_sessions WHERE expires_at<=?').run(now);
   sqlite.prepare('INSERT INTO game_discord_sessions(token_hash,discord_id,expires_at) VALUES(?,?,?)').run(hash(session),id,now+sessionSeconds*1000);
   removeSession(accountToken(request));
   return redirect(next.href,[clearFlow(),cookie(sessionCookie,session,sessionSeconds)]);
  }catch{
   return failed('failed');
  }
 }

 function account(request){
  const token=accountToken(request);
  if(!token)return null;
  const row=sqlite.prepare(`SELECT s.discord_id,s.profile_refresh_attempted,p.username,p.display_name,p.avatar_hash,p.default_avatar_index
   FROM game_discord_sessions s
   LEFT JOIN game_discord_profiles p ON p.discord_id=s.discord_id WHERE s.token_hash=? AND s.expires_at>?`)
   .get(hash(token),Date.now());
  if(!row)return null;
  const avatarUrl=row.avatar_hash?`https://cdn.discordapp.com/avatars/${row.discord_id}/${row.avatar_hash}.webp?size=128`:
   `https://cdn.discordapp.com/embed/avatars/${row.default_avatar_index??defaultAvatar(row.discord_id)}.png`;
  return {id:row.discord_id,profile:{name:row.display_name||null,username:row.username||null,avatarUrl,
   ...(!row.username&&!row.profile_refresh_attempted?{autoRefresh:true}:{})}};
 }

 return {
  account,
  user:request=>account(request)?.id??null,
  handle(request,url){
   if(url.pathname==='/signin-with-discord'&&request.method==='GET')return begin(request,url,null,false,Boolean(guildId));
   if(url.pathname===callback&&request.method==='GET')return finish(request,url);
   if(url.pathname==='/api/auth/discord/profile'&&request.method==='POST')return beginProfileRefresh(request,url);
   if(url.pathname==='/api/auth/discord/membership'&&request.method==='POST'&&guildId)return beginMembershipCheck(request,url);
   if(url.pathname==='/api/auth/discord/logout'&&request.method==='POST'){
    if(request.headers.get('origin')!==origin)return new Response('Open the game to sign out.',{status:403});
    removeSession(accountToken(request));
    return redirect(origin+'/#gacha',[cookie(sessionCookie,'',0)]);
   }
   return null;
  }
 };
}
