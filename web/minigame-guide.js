import {seenGuide,markGuide} from './guide-progress.js';
import {drillSprites} from './drill-sprites.js';
import {orbSprites} from './combat-arts.js';

export const arcadeSprites={wave:'/assets/arcade/wave.webp',ship:'/assets/arcade/ship.webp'};
export const helpButton='<button type="button" class="minigame-help" data-minigame-help aria-haspopup="dialog"><b aria-hidden="true">?</b><span>How to Play</span></button>';
export const drillGuideId=kind=>'drill-'+kind+'-1';
export const remixGuideId=remix=>'remix-'+remix.id;

const drillGuides={
 spike:{keys:['Space'],touch:'Hold the playfield or Hold to charge.',tips:[
  ['Charge to the notch','Hold until the power meter reaches the gold notch.'],
  ['Release in range','Let go when Strike Zone lights up. Releasing too early, too late, or off the notch ends the run.']
 ]},
 saw:{keys:['A','D','←','→'],touch:'Drag the saw or hold a Left or Right button.',tips:[
  ['Steer early','Use the green opening and move toward its center before the wall reaches you. You can also steer with your mouse.'],
  ['Leave room for the teeth','Keep the whole blade inside the opening. The gaps get tighter and the track keeps speeding up.']
 ]},
 endurance:{keys:['A','D','←','→'],touch:'Use the lane buttons or tap the playfield.',tips:[
  ['Thread a lit portal','The lane hint tells you where the openings are. Press left or right once to move one lane.'],
  ['Watch your gravity','While upside down, Right moves you left and Left moves you right. The gravity label shows when controls are swapped.']
 ],portals:[['Yellow','Flip upside down'],['Green','Toggle gravity'],['Blue','Return upright']]}
};

const modes={
 cube:{touch:'Tap the playfield or Tap to jump.',basics:['Jump over spikes','Press to jump. Let go between jumps to control your timing.']},
 wave:{touch:'Hold the playfield or Hold to climb.',basics:['Fly the wave','Hold to climb diagonally. Release to dive. Use short pulses to stay between the sloped walls.']},
 ship:{touch:'Hold the playfield or Hold to climb.',basics:['Fly the ship','Hold for thrust and release to descend. Start changing height early to allow for momentum.']}
};
const remixTips={
 SURF:['Follow the surf','Look ahead to the next narrow bend. Stay inside the channel until the cut.'],
 DRAIN:['Clear the spike pairs','Jump just before the first spike in each pair. Land safely before the next jump.'],
 KEY:['Remember the lit shape','A green symbol appears near the start. Remember its shape and choose the matching key at the exit.'],
 RINGS:['Thread all nine rings','Use the numbered rings to line up the middle of each opening. Look ahead to the next slope.'],
 '99%':['Tap the pink orbs','Tap again as you enter each of the three orbs. The last tap is at 99%. Use Practice finale to repeat the ending.',orbSprites[0]],
 HIVE:['Aim through the honeycomb','Follow the honeycomb markers into the gaps. Short holds make it easier to stay centered.'],
 BLINK:['Watch the ground','Keep your eyes on the spikes and raised platforms when the giant eye flashes.'],
 SNOOZE:['Time the alarm spikes','Wait until you’re close to each spike before jumping. Let the cube land before tapping again.'],
 '8 BIT':['Jump one spike at a time','Start with a single tap just before each spike. Take a moment to land and line up the next one.'],
 MINI:['Adjust after the pink portal','The mini wave is smaller and changes height faster. Shorten your taps after crossing the portal.',drillSprites.mini],
 GEO:['Read the crystal edges','The purple slopes are the tunnel walls. Use quick taps to change direction through tight bends.'],
 CIRCUIT:['Carry your momentum','Start lowering before a passage dips and lift just before it rises.'],
 LIFT:['Jump from the rising ledges','Use the slope to line up your jump, then release before reaching the next ledge.'],
 DUSK:['Make small corrections','The ship keeps drifting after you let go. Use short taps through the night tunnel.']
};

export function drillGuide(kind,drill){
 return {...drillGuides[kind],id:drillGuideId(kind),name:drill.name,icon:drill.icon,color:drill.color,
  outcome:'Each clear earns 6 XP. Every two clears earn an upgrade up to your card’s cap.'};
}
export function remixGuide(remix,cubeIcon,{endless=false}={}){
 const mode=modes[remix.mode];
 const tip=endless?['Watch the next section','Endless keeps generating new obstacles. Pause if you need a break or choose Finish and save to bank your progress.']:remixTips[remix.mark];
 return {id:remixGuideId(remix),name:remix.name,color:remix.color,icon:arcadeSprites[remix.mode]||cubeIcon,
  keys:['Space','↑','W'],touch:mode.touch,tips:[mode.basics,tip],
  outcome:endless?'Survive for XP and Demon Keys. All courses share a 10-key limit per six-hour window.':
   'A full Normal clear gives your squad one extra starting charge in this level’s arena.'};
}

export function installMinigameGuide(owner,guide,pause){
 const trigger=owner.querySelector('[data-minigame-help]'),help=document.createElement('dialog');
 let returnFocus;
 help.className='help-sheet minigame-guide';help.style.setProperty('--guide',guide.color);
 help.setAttribute('aria-label','How to Play '+guide.name);
 const portals=guide.portals?'<div class="guide-portals">'+guide.portals.map(([color,rule],i)=>
  '<div><img src="'+drillSprites.portals[i]+'" alt=""><b>'+color+'</b><span>'+rule+'</span></div>').join('')+'</div>':'';
 help.innerHTML='<div class="help-header"><img class="help-game-icon" src="'+guide.icon+'" alt=""><div><p>How to Play</p><h2>'+guide.name+'</h2></div><button type="button" class="help-close" aria-label="Close tutorial">×</button></div>'+
  '<div class="help-body"><dl class="guide-controls"><div><dt>Keyboard</dt><dd>'+guide.keys.map(key=>'<kbd>'+key+'</kbd>').join('')+'</dd></div><div><dt>Touch</dt><dd>'+guide.touch+'</dd></div></dl>'+
  '<div class="guide-tips">'+guide.tips.map(([title,text,image])=>'<section>'+(image?'<img src="'+image+'" alt="">':'')+'<h3>'+title+'</h3><p>'+text+'</p></section>').join('')+'</div>'+portals+'</div>'+
  '<div class="help-footer"><p>'+guide.outcome+'</p><button type="button" class="guide-primary" autofocus>Got it</button></div>';
 owner.append(help);
 function show(){
  if(!owner.open||help.open)return;
  returnFocus=document.activeElement;
  pause();help.showModal();
 }
 for(const button of help.querySelectorAll('button'))button.onclick=()=>help.close();
 help.addEventListener('cancel',event=>{event.stopPropagation();event.preventDefault();help.close()});
 help.addEventListener('close',()=>{
  markGuide(guide.id);
  if(owner.open)(returnFocus?.isConnected?returnFocus:trigger).focus({preventScroll:true});
 });
 owner.addEventListener('close',()=>{if(help.open)help.close()},{once:true});
 trigger.onclick=show;
 return {get open(){return help.open},welcome(){if(!seenGuide(guide.id))show()}};
}
