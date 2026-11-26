import {remixTracks,remixTrackSource} from './remix-media.js';

// The same excerpt can cover multiple levels whose in-game song matches.
const attribution='https://creativecommons.org/licenses/';
const attributionOnly=attribution+'by/3.0/';
const noncommercial=attribution+'by-nc/3.0/';
const shareAlike=attribution+'by-nc-sa/3.0/';
const newgrounds=song=>'https://www.newgrounds.com/audio/listen/'+song;
function bundled(key,song,license){
 return {title:remixTracks[key],href:newgrounds(song),src:remixTrackSource(key),license};
}
function excerpt(file,title,song,license){
 return {title,href:newgrounds(song),src:'/reveal-media/tracks/'+file+'.mp3',license};
}
const speedOfLight=bundled('speed-of-light',467339,noncommercial);
const carnivores=bundled('carnivores',690265,noncommercial);
const epilogue=bundled('epilogue',723714,noncommercial);
const reverie=bundled('reverie',787986,attributionOnly);
// Kayoszx grants reuse with credit in the author's note on the original track.
const stalemate=excerpt('stalemate','Stalemate · Kayoszx',482872,newgrounds(482872));

const soundtrackByLevel=new Map([
 [3979721,speedOfLight],   // Cataclysm
 [10565740,speedOfLight],  // Bloodbath
 [14070792,speedOfLight],  // DoomsDay
 [25610878,speedOfLight],  // aftermath
 [42584142,speedOfLight],  // Bloodlust
 [47171509,speedOfLight],  // Solarion
 [86917672,speedOfLight],  // Place
 [113443235,{...speedOfLight,title:speedOfLight.title+' (original mix)'}], // Apocalyptic Trilogy song replacement
 [37456092,carnivores],    // Digital Descent
 [58150142,carnivores],    // Akashic Records
 [118664383,carnivores],   // Disconnected Descent
 [61079355,epilogue],      // Acu
 [75867791,reverie],       // poocu
 [119550490,bundled('ricochet-love',233860,shareAlike)], // Amethyst
 [4545425,stalemate],      // Stalemate
 [26539891,stalemate],     // Phantoms Manor
 [37398911,stalemate],     // Stalemate Redux
 [149992717,stalemate],    // GRIEF
 [95999072,excerpt('dreamy','Dreamy · EspiDev',761839,attributionOnly)], // poocu4ever
 [85133223,excerpt('parfait','Parfait · EspiDev',763176,attributionOnly)], // poocubed
 [107805281,excerpt('menace','Menace · TheRealMannyHeffley',1304920,attributionOnly)],
 [114283297,excerpt('omnipresent','omnipresent · WakerLink',1216127,shareAlike)], // andromeda
 [145709435,excerpt('nightmare-forest','Nightmare Forest · Waterflame',1485273,shareAlike)], // FOREST OF SPIKES
 [138781722,excerpt('killstealer','Killstealer · Waterflame',433359,shareAlike)],
 [110534288,excerpt('base-after-base','Base After Base · DJVI',404997,shareAlike)], // Based After Based
 [144560194,excerpt('control-crowd','Control: Crowd · Waterflame',114645,shareAlike)] // METROPOLIS
]);

export function rareLevelTrack(levelId){
 const id=Number(levelId);
 return Number.isSafeInteger(id)&&id>0?soundtrackByLevel.get(id)??null:null;
}
