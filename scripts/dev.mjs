import {restoreAssets} from './restore-assets.mjs';
import {createGameDatabase} from './game-preview-db.mjs';
import {gameRoutes} from '../server/game.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {api} from '../server/api.mjs';
import {mediaResponse} from '../server/media-range.mjs';
import {sceneBundles} from './scene-bundles.mjs';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
restoreAssets(new URL('../',import.meta.url));
const types={'.mp3':'audio/mpeg','.ogg':'audio/ogg','.mp4':'video/mp4','.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.png':'image/png','.woff2':'font/woff2'};
const flag=process.argv.indexOf('--port'),port=Number(process.env.PORT||(flag>=0&&process.argv[flag+1])||4173);
const {DB}=createGameDatabase();
const scenes=await sceneBundles();
const game=gameRoutes(
 path=>JSON.parse(fs.readFileSync('web'+path,'utf8')),
 id=>['webp','avif'].some(ext=>fs.existsSync('web/assets/shots/'+id+'.'+ext))
);
http.createServer(async(req,res)=>{
 try{
  const host=req.headers.host||('127.0.0.1:'+port);
  const u=new URL(req.url,'http://'+host);
  if(['/api/game','/api/game/transfer','/api/players','/api/trades','/api/admin/players'].includes(u.pathname)){
   const chunks=[];let size=0;
   for await(const chunk of req){
    size+=chunk.length;
    if(size>(u.pathname==='/api/game/transfer'?2500000:550000)){res.writeHead(413).end();return;}
    chunks.push(chunk);
   }
   const headers=new Headers(req.headers);
   headers.delete('oai-authenticated-user-id');
   const request=new Request(u,{method:req.method,headers,body:req.method==='POST'?Buffer.concat(chunks):undefined});
   const response=await game(request,{DB});
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(u.pathname.startsWith('/api/')){const r=await api(new Request(u));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return}
  if(scenes.has(u.pathname)){res.writeHead(200,{'Content-Type':'text/javascript'}).end(scenes.get(u.pathname));return}
  let p=path.resolve('web','.'+(u.pathname==='/'?'/index.html':u.pathname));
  if(!p.startsWith(path.resolve('web')+path.sep)){res.writeHead(404).end();return}
  if(p.endsWith('.webp')&&!fs.existsSync(p))p=p.slice(0,-5)+'.avif';
  if(/\/catalog-\d+\.json$/.test(p)){p=p.slice(0,-5)+'.gz';res.setHeader('Content-Encoding','gzip');res.setHeader('Content-Type','application/json')}else res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');
  if(!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404).end();return}
  if(/\.(mp3|ogg|mp4)$/.test(p)){
   const request=new Request(u,{method:req.method,headers:req.headers});
   const media=mediaResponse(request,fs.readFileSync(p),{'Content-Type':types[path.extname(p)]});
   res.writeHead(media.status,Object.fromEntries(media.headers));res.end(Buffer.from(await media.arrayBuffer()));return;
  }
  fs.createReadStream(p).pipe(res);
 }catch{res.writeHead(500).end()}
}).listen(port,'0.0.0.0',()=>console.log('GD Lvl battles preview on port '+port));
