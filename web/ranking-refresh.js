export function rankingRefresh(interval,isActive,refresh){
 let timer,lastCheck=-Infinity,pending=false;
 const visible=()=>!document.hidden&&isActive();

 function schedule(){
  clearTimeout(timer);
  if(!visible()||pending)return;
  timer=setTimeout(run,Math.max(0,interval-(performance.now()-lastCheck)));
 }
 async function run(){
  if(!visible()||pending)return;
  clearTimeout(timer);
  lastCheck=performance.now();pending=true;
  try{await refresh();}
  finally{pending=false;schedule();}
 }
 function checked(){
  lastCheck=performance.now();
  schedule();
 }
 document.addEventListener('visibilitychange',schedule);
 window.addEventListener('pageshow',schedule);
 return {run,schedule,checked};
}
