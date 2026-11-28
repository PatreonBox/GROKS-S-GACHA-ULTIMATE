import {ico} from './icons.js';

export const remixTracks={
 tidal:'Tidal Wave soundtrack excerpt',
 limbo:'LIMBO soundtrack excerpt',
 'speed-of-light':'At the Speed of Light · Dimrain47',
 'ricochet-love':'Ricochet Love · Waterflame',
 'golden-haze':'Golden Haze (Prev) · Detious',
 carnivores:'Carnivores · Creo',
 epilogue:'Epilogue · Creo',
 reverie:'Reverie · EspiDev'
};
const newgrounds=id=>'https://www.newgrounds.com/audio/listen/'+id;
const sourceIds={'speed-of-light':467339,'ricochet-love':233860,'golden-haze':557117,carnivores:690265,epilogue:723714,reverie:787986};
const originalSoundtracks={
 86084399:['Isolation · NightHawk22',newgrounds(76743)],
 4284013:['Nine Circles · Rukkus',newgrounds(533927)],
 44062068:['What’s a Future Funk? · LemKuuja','https://soundcloud.com/lemkuuja/whats-a-future-funk'],
 34085027:['Beep Beep · Schtiffles',newgrounds(715825)],
 89886591:['BIKE · Tanger',newgrounds(1191782)],
 13519:['Polargeist · Step',newgrounds(523561)]
};
export const griefPoster='/assets/arcade/grief-finish.webp';
export const remixTrackSource=track=>track==='golden-haze'?'/arcade-audio/golden-haze.mp3':
 track==='limbo'?'/assets/audio/limbo-finale.mp3':'/assets/audio/remix/'+track+'.mp3';

export function remixMusicCredit(track,levelId){
 const original=originalSoundtracks[levelId];
 const title=remixTracks[track];
 const id=sourceIds[track];
 const link=(href,label)=>'<a href="'+href+'" target="_blank" rel="noopener noreferrer">'+label+'</a>';
 if(!title)return original?'<p class="runner-track">Original soundtrack · '+link(original[1],original[0])+'</p>':'';
 const license=track==='golden-haze'||track==='ricochet-love'
  ?' · '+link('https://creativecommons.org/licenses/by-nc-sa/3.0/','CC BY-NC-SA 3.0'):
  ['speed-of-light','epilogue','carnivores'].includes(track)?' · '+link('https://creativecommons.org/licenses/by-nc/3.0/','CC BY-NC 3.0'):
   track==='reverie'?' · '+link('https://creativecommons.org/licenses/by/3.0/','CC BY 3.0'):'';
 const label=id?link(newgrounds(id),title)+' · Excerpt':track==='limbo'&&original?link(original[1],title):title;
 return '<p class="runner-track">♫ '+label+license+'</p>';
}

export function remixMusic(track,sound,button,isRunning,{loop=true}={}){
 if(!Object.hasOwn(remixTracks,track))return null;
 const player=new Audio(remixTrackSource(track));
 player.preload='auto';player.volume=.48;player.loop=loop;
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
 function applySound(){
  if(enabled&&sound.enabled&&isRunning())start();else pause();
  sync();
 }
 button.onclick=()=>{
  enabled=!enabled;
  try{localStorage.setItem('gdlb.arcadeMusic',enabled?'on':'off')}catch{}
  applySound();
 };
 document.addEventListener('gdlb-game-sound',applySound);
 sync();
 return {
  start,pause,
  reset(){pause();player.currentTime=0},
  close(){document.removeEventListener('gdlb-game-sound',applySound);pause();player.removeAttribute('src');player.load()}
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
