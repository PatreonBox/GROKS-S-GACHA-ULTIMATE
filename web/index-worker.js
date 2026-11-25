const tiers=['Unrated','Auto','Easy','Normal','Hard','Harder','Insane','Demon','Easy Demon','Medium Demon','Hard Demon','Insane Demon','Extreme Demon'];
let loading;
function unpackNumbers(encoded,length,increasing){
 const bytes=atob(encoded),values=Array(length);
 let n=0,shift=1,at=0,last=0;
 for(let i=0;i<bytes.length;i++){
  const byte=bytes.charCodeAt(i);
  n+=(byte&127)*shift;
  if(byte>=128){shift*=128;continue}
  values[at++]=increasing?(last+=n):n===0?null:n%2?(n-1)/2:-n/2;
  n=0;shift=1;
 }
 if(at!==length||shift!==1)throw Error('Incomplete catalogue numbers');
 return values;
}
async function load(){
 if(!loading)loading=(async()=>{
  const start=await (await fetch('/data/start.json')).json(),arr=[];
  for(let i=0;i<start.shards;i++){
   const r=await fetch('/data/catalog-'+i+'.json');if(!r.ok)throw Error('Index unavailable');
   const shard=await r.json();
   if(Array.isArray(shard)){arr.push(...shard);continue}
   const cols=shard.encoding==='numbers-v1'
    ?shard.columns.map((col,index)=>typeof col==='string'?unpackNumbers(col,shard.length,index===0):col)
    :shard.columns;
   for(let j=0;j<cols[0].length;j++)arr.push(cols.map(col=>col[j]));
  }
  const demonFiles=Object.keys(start.demonTiers).filter(tier=>tier!=='extreme').map(tier=>'/data/lists/'+tier+'.json');
  const starFiles=Object.keys(start.starCounts).map(tier=>'/data/stars/'+tier+'.json');
  const catalogues=await Promise.all([...demonFiles,...starFiles].map(async file=>{
   const response=await fetch(file);
   if(!response.ok)throw Error('Tier index unavailable');
   return response.json();
  }));
  for(const rows of catalogues)arr.push(...rows);
  arr.sort((a,b)=>(b[4]??-1)-(a[4]??-1)||b[0]-a[0]);
  return arr;
 })().catch(e=>{loading=null;throw e});
 return loading;
}
self.onmessage=async({data})=>{
 const {id,q,diff,sort,page}=data;
 try{
  const all=await load(),term=q.trim().toLowerCase(),exact=/^\d+$/.test(term);
  let selected=all;
  if(term||diff!=='All')selected=all.filter(r=>(diff==='All'||(diff==='All demons'?r[6].endsWith('Demon'):r[6]===diff))&&(!term||(exact?r[0]===Number(term):r[1].toLowerCase().includes(term)||(r[2]||'').toLowerCase().includes(term))));
  if(sort!=='downloads'){if(selected===all)selected=all.slice();const idx=sort==='likes'?5:0;selected.sort((a,b)=>sort==='tier'?tiers.indexOf(b[6])-tiers.indexOf(a[6])||b[0]-a[0]:(b[idx]??-Infinity)-(a[idx]??-Infinity)||b[0]-a[0])}
  self.postMessage({id,rows:selected.slice(page*20,(page+1)*20),total:selected.length,next:(page+1)*20<selected.length});
 }catch{self.postMessage({id,error:true})}
};
