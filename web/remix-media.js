import {ico} from './icons.js';

export const remixTracks={
 tidal:'Tidal Wave soundtrack excerpt',
 'speed-of-light':'At the Speed of Light · Dimrain47',
 'ricochet-love':'Ricochet Love · Waterflame',
 carnivores:'Carnivores · Creo',
 epilogue:'Epilogue · Creo',
 reverie:'Reverie · EspiDev'
};
export const griefPoster='/assets/arcade/grief-finish.webp';
export const remixTrackSource=track=>'/assets/audio/remix/'+track+'.mp3';

export function remixMusic(track,sound,button,isRunning){
 if(!track)return null;
 const player=new Audio(remixTrackSource(track));
 player.preload='auto';player.volume=.48;
 let enabled=true;
 try{enabled=localStorage.getItem('gdlb.arcadeMusic')!=='off'}catch{}
 function sync(){
  const audible=enabled&&sound.enabled;
  button.disabled=!sound.enabled;
  button.setAttribute('aria-pressed',String(audible));
  button.title=audible?'Mute level music':sound.enabled?'Enable level music':'Enable game sound to hear the level music';
  button.innerHTML=ico(audible?'volume':'muted');
 }
 function start(){
  if(enabled&&sound.enabled&&!document.hidden)player.play().catch(()=>{});
 }
 function pause(){player.pause()}
 button.onclick=()=>{
  enabled=!enabled;
  try{localStorage.setItem('gdlb.arcadeMusic',enabled?'on':'off')}catch{}
  if(enabled&&isRunning())start();else pause();
  sync();
 };
 sync();
 return {
  start,pause,
  reset(){pause();player.currentTime=0},
  close(){pause();player.removeAttribute('src');player.load()}
 };
}

export function watchGrief(sound){
 const dialog=document.createElement('dialog');
 dialog.className='grief-screen';
 dialog.setAttribute('aria-label','Grief verification clip');
 dialog.innerHTML='<header><div><h2>Grief</h2><p>Doggie’s verification finish</p></div><button type="button" class="outline" aria-label="Close clip">'+ico('x')+'</button></header>'+
  '<video controls playsinline preload="metadata" poster="'+griefPoster+'" src="/assets/arcade/grief-finish.mp4"></video>';
 const video=dialog.querySelector('video');
 video.muted=!sound.enabled;video.volume=.75;
 dialog.querySelector('button').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{video.pause();dialog.remove()},{once:true});
 sound.stop();
 document.body.append(dialog);dialog.showModal();
 return dialog;
}
