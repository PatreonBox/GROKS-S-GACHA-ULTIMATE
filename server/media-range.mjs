export function mediaResponse(request,data,headers){
 const out=new Headers(headers),size=data.length,range=request.headers.get('Range');
 out.set('Accept-Ranges','bytes');
 let start=0,end=size-1,status=200;
 if(range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(match&&(match[1]||match[2])){
   if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]))}
   else start=Math.max(0,size-Number(match[2]));
   status=206;
  }
  if(status!==206||!Number.isSafeInteger(start)||start>=size||end<start){
   out.set('Content-Range','bytes */'+size);
   return new Response(null,{status:416,headers:out});
  }
  out.set('Content-Range','bytes '+start+'-'+end+'/'+size);
 }
 out.set('Content-Length',String(end-start+1));
 return new Response(request.method==='HEAD'?null:data.subarray(start,end+1),{status,headers:out});
}
