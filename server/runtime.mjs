import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {statSync} from 'node:fs';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import worker from '../dist/server/index.js';
import {openGameDatabase} from './sqlite.mjs';
import {createDiscordAuth,officialGuildId} from './discord.mjs';
import {createBugReports} from './bug-reports.mjs';

const port=Number(process.env.PORT||8080);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be a valid port.');
const railway=Boolean(process.env.RAILWAY_ENVIRONMENT_ID);
if(railway&&!process.env.DISCORD_CLIENT_ID)throw Error('Set DISCORD_CLIENT_ID before starting GD Kingdom.');
const directory=process.env.RAILWAY_VOLUME_MOUNT_PATH||(railway?null:process.env.GAME_DATA_DIRECTORY);
if(!directory||!statSync(directory,{throwIfNoEntry:false})?.isDirectory()){
 throw Error('Mount a persistent game volume before starting the server.');
}
const railwayDomain=process.env.RAILWAY_PUBLIC_DOMAIN;
const location=process.env.GAME_PUBLIC_ORIGIN||(railwayDomain?'https://'+railwayDomain:railway?null:'http://localhost:'+port);
if(!location)throw Error('Set the public game domain before starting the service.');
const publicUrl=new URL(location);
if((railway&&publicUrl.protocol!=='https:')||!['http:','https:'].includes(publicUrl.protocol)||
   publicUrl.username||publicUrl.password||publicUrl.pathname!=='/'||publicUrl.search||publicUrl.hash){
 throw Error('GAME_PUBLIC_ORIGIN must be a valid origin.');
}
const {DB,sqlite}=openGameDatabase(join(directory,'gd-lvl-battles.sqlite'));
const discord=createDiscordAuth(sqlite,{origin:publicUrl.origin,clientId:process.env.DISCORD_CLIENT_ID,guildId:officialGuildId});
const reports=createBugReports(sqlite,{apiKey:process.env.RESEND_API_KEY,from:process.env.BUG_REPORT_FROM,to:process.env.BUG_REPORT_TO});
const reportTimer=reports.start();
const profileKey=process.env.GDK_PROFILE_API_KEY?.trim()||'';
const botAuthorization=/^[a-f0-9]{64}$/.test(profileKey)?Buffer.from('Bearer '+profileKey):null;
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,publicUrl);
  if(url.origin!==publicUrl.origin){res.writeHead(400).end();return;}
  if(url.pathname==='/health'&&['GET','HEAD'].includes(req.method)){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end(req.method==='HEAD'?undefined:JSON.stringify({status:'ok'}));
   return;
  }
  const headers=new Headers(req.headers);
  headers.delete('oai-authenticated-user-id');
  const botProfile=url.pathname==='/api/discord/profile';
  if(botProfile){
   const authorization=Buffer.from(headers.get('authorization')||'');
   if(!botAuthorization||authorization.length!==botAuthorization.length||!timingSafeEqual(authorization,botAuthorization)){
    const status=botAuthorization?401:503;
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'});
    res.end(JSON.stringify({error:status===401?'Bot authorization required.':'The bot profile connection is unavailable.'}));
    return;
   }
   headers.delete('authorization');
  }
  const hasBody=!['GET','HEAD'].includes(req.method);
  const request=new Request(url,{method:req.method,headers,...(hasBody?{body:Readable.toWeb(req),duplex:'half'}:{})});
  const account=discord?.account(request);
  const response=await discord?.handle(request,url)??await worker.fetch(request,{
   DB,guestOnly:true,discordEnabled:Boolean(discord),discordUser:account?.id,discordProfile:account?.profile,
   adminDiscordId:process.env.GAME_ADMIN_DISCORD_ID,discordBotProfileAuthorized:botProfile,
   submitBugReport:reports.submit
  });
  const outputHeaders=Object.fromEntries(response.headers);
  const cookies=response.headers.getSetCookie();
  if(cookies.length)outputHeaders['set-cookie']=cookies;
  res.writeHead(response.status,outputHeaders);
  if(response.body)await pipeline(Readable.fromWeb(response.body),res);
  else res.end();
 }catch(error){
  if(res.destroyed)return;
  console.error('Game request failed:',error.message);
  if(!res.headersSent)res.writeHead(500,{'Cache-Control':'no-store'});
  res.end();
 }
});
server.listen(port,'0.0.0.0',()=>console.log('GD Lvl battles is listening on port '+port));
for(const signal of ['SIGTERM','SIGINT']){
 process.once(signal,()=>{clearInterval(reportTimer);server.close(()=>sqlite.close());});
}
