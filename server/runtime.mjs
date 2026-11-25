import http from 'node:http';
import {statSync} from 'node:fs';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import worker from '../dist/server/index.js';
import {openGameDatabase} from './sqlite.mjs';

const port=Number(process.env.PORT||8080);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be a valid port.');
const railway=Boolean(process.env.RAILWAY_ENVIRONMENT_ID);
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
  const hasBody=!['GET','HEAD'].includes(req.method);
  const request=new Request(url,{method:req.method,headers,...(hasBody?{body:Readable.toWeb(req),duplex:'half'}:{})});
  const response=await worker.fetch(request,{DB,guestOnly:true});
  res.writeHead(response.status,Object.fromEntries(response.headers));
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
 process.once(signal,()=>server.close(()=>sqlite.close()));
}
