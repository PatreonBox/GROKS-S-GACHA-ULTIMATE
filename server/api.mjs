const difficulties=['Unrated','Auto','Easy','Normal','Hard','Harder','Insane','Demon','Easy Demon','Medium Demon','Hard Demon','Insane Demon','Extreme Demon'];
const lengths=['Tiny','Short','Medium','Long','XL','Platformer'];
const size=20;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=120'};
function json(object,status=200){return new Response(JSON.stringify(object),{status,headers:status===200?headers:{'Content-Type':headers['Content-Type'],'Cache-Control':'no-store'}})}
async function source(url,timeout=14500){
 const response=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'GD-Lvl-battles/1.0 (Geometry Dash level browser)'},signal:AbortSignal.timeout(timeout),cf:{cacheTtl:150,cacheEverything:true}});
 if(!response.ok)throw Error('upstream');return response.json();
}
const row=x=>[x.online_id,x.cache_level_name,x.cache_username||'',x.cache_user_id??0,x.cache_downloads??null,x.cache_likes??null,difficulties[x.cache_filter_difficulty]??'Unrated',x.cache_stars??0,lengths[x.cache_length]??'',null,0];
export async function api(request){
 const {pathname,searchParams:p}=new URL(request.url);
 if(request.method!=='GET')return json({error:'GET required'},405);
 try{
  const thumb=pathname.match(/^\/api\/thumbnail\/(\d{1,12})\/(small|high)$/);
  if(thumb){
   const image=await fetch('https://levelthumbs.prevter.me/thumbnail/'+thumb[1]+'/'+thumb[2],{headers:{Accept:'image/webp,image/*','User-Agent':'GD-Lvl-battles/1.0'},signal:AbortSignal.timeout(11000),cf:{cacheTtl:86400,cacheEverything:true}});
   if(!image.ok||!/^image\//.test(image.headers.get('Content-Type')||''))return json({error:'No thumbnail'},404);
   return new Response(image.body,{headers:{'Content-Type':image.headers.get('Content-Type'),'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
  }
  if(pathname==='/api/demons'){
   const data=await source('https://api.aredl.net/v2/api/aredl/levels',11000);
   if(!Array.isArray(data)||!data.length)throw Error('data');
   return json(data.filter(x=>x.status==='MainList'||x.status==='Legacy').map(x=>({id:x.level_id,uuid:x.id,name:x.name,position:x.position,points:x.points,status:x.status,twoPlayer:!!x.two_player,tags:x.tags||[],publisherUuid:x.publisher_id})));
  }
  if(pathname!=='/api/levels')return json({error:'Unknown route'},404);
  const sort=p.get('sort')||'downloads',q=(p.get('q')||'').trim().slice(0,80),diff=p.get('difficulty')||'All';
  const field={downloads:'cache_downloads',likes:'cache_likes',newest:'online_id',tier:'cache_filter_difficulty'}[sort];
  if(!field||(!difficulties.includes(diff)&&diff!=='All'&&diff!=='All demons'))return json({error:'Invalid filter'},400);
  let filters=['is_deleted = false'];let query=q;
  if(/^\d+$/.test(q)){filters.push('online_id = '+Number(q));query=''}
  if(diff==='All demons')filters.push('cache_filter_difficulty >= 7');else if(diff!=='All')filters.push('cache_filter_difficulty = '+difficulties.indexOf(diff));
  const cursor=p.get('after');
  if(cursor){if(!/^-?\d{1,12},\d{1,12}$/.test(cursor))return json({error:'Invalid page'},400);
   const [value,id]=cursor.split(',').map(Number);
   filters.push(field==='online_id'?'online_id < '+id:'('+field+' < '+value+' OR ('+field+' = '+value+' AND online_id < '+id+'))');
  }
  const url=new URL('https://history.geometrydash.eu/api/v1/search/level/advanced/');
  url.search=new URLSearchParams({query,limit:String(size+1),sort:field+':desc'+(field==='online_id'?'':',online_id:desc'),filter:filters.join(' AND ')}).toString();
  const data=await source(url);
  if(!Array.isArray(data.hits))throw Error('data');
  const records=data.hits.slice(0,size).filter(x=>x.is_public!==false).map(row);
  const tail=data.hits[size-1];
  return json({rows:records,total:data.estimatedTotalHits??null,next:data.hits.length>size&&tail?tail[field]+','+tail.online_id:null});
 }catch{return json({error:'Archive temporarily unavailable'},503)}
}
