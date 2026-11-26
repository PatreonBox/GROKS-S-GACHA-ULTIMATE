export function kingdomAmbience(sound,canvas){
 let muted=false,opened=false,current,frame=0,tracks;
 try{muted=localStorage.getItem('gdlb.kingdomAmbience')==='off';}catch{}
 const listeners=new AbortController(),{signal}=listeners;
 function stop(){
  if(frame)cancelAnimationFrame(frame);
  frame=0;current=null;
  tracks?.forEach(track=>track.pause());
 }
 function update(night){
  if(muted||!sound.enabled||!opened||document.hidden){stop();return;}
  tracks??=['day','night'].map(name=>{
   const audio=new Audio('/assets/audio/kingdom-'+name+'.mp3');
   audio.loop=true;audio.preload='none';audio.volume=0;
   return audio;
  });
  const target=tracks[Number(night)];
  if(current===target)return;
  current=target;
  target.play().catch(()=>{if(current===target){current=null;opened=false;}});
  cancelAnimationFrame(frame);
  const old=tracks[1-Number(night)],starts=[target.volume,old.volume],start=performance.now();
  function blend(now){
   const t=Math.min(1,(now-start)/1300);
   target.volume=starts[0]+(.30-starts[0])*t;old.volume=starts[1]*(1-t);
   if(t===1){old.pause();frame=0;}else frame=requestAnimationFrame(blend);
  }
  frame=requestAnimationFrame(blend);
 }
 let night=false;
 function unlock(){
  if(opened||muted||!sound.enabled)return;
  opened=true;update(night);
 }
 canvas.addEventListener('pointerdown',unlock,{signal});
 document.addEventListener('pointerdown',unlock,{signal});
 document.addEventListener('keydown',unlock,{signal});
 document.addEventListener('visibilitychange',()=>update(night),{signal});
 return {get muted(){return muted;},setNight(next){night=next;update(night);},toggle(){
  muted=!muted;
  try{localStorage.setItem('gdlb.kingdomAmbience',muted?'off':'on');}catch{}
  if(muted)stop();else{opened=true;update(night);}
 },dispose(){listeners.abort();stop();tracks?.forEach(track=>{track.removeAttribute('src');track.load();});}};
}
