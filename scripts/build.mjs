import {restoreAssets} from './restore-assets.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {brotliCompressSync,gzipSync,gunzipSync,constants} from 'node:zlib';
import {build} from 'esbuild';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
restoreAssets(new URL('../',import.meta.url));
const types={'.mp3':'audio/mpeg','.mp4':'video/mp4','.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.woff2':'font/woff2','.webp':'image/webp','.avif':'image/avif','.png':'image/png','.svg':'image/svg+xml'};
const assets={};
function encodeNumbers(values,increasing=false){
 let last=0;
 const bytes=[];
 for(const value of values){
  let n;
  if(increasing){n=value-last;last=value}
  else n=value===null?0:value>=0?value*2+1:-value*2;
  while(n>=128){bytes.push(128+n%128);n=Math.floor(n/128)}
  bytes.push(n);
 }
 return Buffer.from(bytes).toString('base64');
}
function encodeCatalog(rows){
 const width=rows[0].length;
 if(!rows.every(row=>row.length===width))throw Error('Inconsistent catalogue row width');
 rows.sort((a,b)=>a[0]-b[0]);
 const columns=Array.from({length:width},(_,col)=>rows.map(row=>row[col]));
 for(const index of [0,3,4,5]){
  const values=columns[index];
  if(values?.every(n=>Number.isSafeInteger(n)||n===null))columns[index]=encodeNumbers(values,index===0);
 }
 return {encoding:'numbers-v1',length:rows.length,columns};
}
function collect(dir){
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,item.name);if(item.isDirectory()){collect(file);continue}
  let route='/'+path.relative('web',file),data=fs.readFileSync(file);
  if(route.endsWith('.gz')){route=route.slice(0,-3)+'.json';data=gunzipSync(data)}
  if(route.startsWith('/data/catalog-')){
   data=Buffer.from(JSON.stringify(encodeCatalog(JSON.parse(data))));
  }
  const ext=path.extname(route),textual=['.js','.css','.html','.json','.svg'].includes(ext);
  const gameData=/^\/data\/(?:stars\/|lists\/|demons\.json$|impossible\.json$)/.test(route);
  if(gameData)data=gzipSync(data,{level:9});
  else if(textual)data=brotliCompressSync(data,{params:{[constants.BROTLI_PARAM_QUALITY]:route.startsWith('/data/catalog-')?11:ext==='.json'?9:6}});
  assets[route]=[types[ext],gameData?'gzip':textual?'br':null,data.toString('base64')];
 }
}
collect('web');
const entry=`
import {api} from './server/api.mjs';
import {mediaResponse} from './server/media-range.mjs';
import {gameRoutes} from './server/game.mjs';
const assets=__GD_ASSETS__;
function decode(value){
 if(typeof Uint8Array.fromBase64==='function')return Uint8Array.fromBase64(value);
 const str=atob(value),raw=new Uint8Array(str.length);
 for(let i=0;i<str.length;i++)raw[i]=str.charCodeAt(i);
 return raw;
}
const game=gameRoutes(async path=>{
 const data=assets[path];
 if(!data||data[1]!=='gzip')throw Error('Game catalog is unavailable.');
 const stream=new Blob([decode(data[2])]).stream().pipeThrough(new DecompressionStream('gzip'));
 return new Response(stream).json();
}, id=>Object.hasOwn(assets,'/assets/shots/'+id+'.webp')||Object.hasOwn(assets,'/assets/shots/'+id+'.avif'));
export default {async fetch(request,env){
 const u=new URL(request.url);
 if(u.pathname==='/api/game'||u.pathname==='/api/game/transfer'||u.pathname==='/api/players')return game(request,env);
 if(u.pathname.startsWith('/api/'))return api(request);
 const path=u.pathname==='/'?'/index.html':u.pathname;
 let key=path==='/assets/audio/arcade-v2.mp3'?'/assets/audio/arcade-v3.mp3':path.startsWith('/assets/faces/')&&path.endsWith('.png')?path.slice(0,-4)+'.webp':path;
 if(key.endsWith('.webp')&&!Object.hasOwn(assets,key))key=key.slice(0,-5)+'.avif';
 const data=Object.prototype.hasOwnProperty.call(assets,key)?assets[key]:null;
 if(!data)return new Response('Page not found',{status:404});
 const head={'Content-Type':data[0],'Cache-Control':key.startsWith('/assets/')||key.startsWith('/fonts/')?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff'};
 if(data[1])head['Content-Encoding']=data[1];
 const mediaAsset=key.endsWith('.mp3')||key.endsWith('.mp4');
 const raw=request.method!=='HEAD'||mediaAsset?decode(data[2]):null;
 if(mediaAsset)return mediaResponse(request,raw,head);
 return new Response(raw,{headers:head,encodeBody:'manual'});
}};
`;
const result=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'worker.mjs'},bundle:true,
 format:'esm',platform:'browser',target:'es2023',minify:true,write:false});
const worker=result.outputFiles[0].text.replace('__GD_ASSETS__',()=>JSON.stringify(assets));
fs.mkdirSync('dist/server',{recursive:true});
fs.writeFileSync('dist/server/index.js',worker);
console.log('Bundled '+Object.keys(assets).length+' routes.');
