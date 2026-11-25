import {markGuide,seenGuide} from './guide-progress.js';

const introId='new-player-1';
const pages=[
 {name:'Open your first pack',art:'/assets/packs/common.png',alt:'Common pack',
  copy:'You start with 1,500 coins and 10 gems. A Common pack costs 100 coins and gives you at least five level cards.',
  tip:'Visit the Coin mine if you need a few more coins. Find your pulls under My cards.'},
 {name:'Build a squad',art:'/assets/faces/demon-extreme.webp',alt:'Extreme Demon difficulty face',
  copy:'Equip four different cards in Battle mode. Use basic attacks to build charge, then spend it on a signature move.',
  tip:'Start with the first campaign stage. Enemy knockouts pay coins, and injured cards recover over time.'},
 {name:'Train and explore',art:'/assets/training/portal-cyan.webp',alt:'Blue gravity portal',
  copy:'Train your cards in three endless drills to earn XP and stat upgrades. Play a meme level for an extra starting charge in its arena.',
  tip:'Visit the Cube shop to equip a look for your character. Each mini game has its own How to Play button.'}
];

export function createIntroduction(trigger){
 const dialog=document.createElement('dialog');let step=0;
 dialog.className='help-sheet game-intro';dialog.setAttribute('aria-label','GD Lvl Battles beginner guide');
 document.body.append(dialog);
 function display(){
  const page=pages[step],last=step===pages.length-1;
  dialog.innerHTML='<div class="help-header"><div><p>Getting started</p><h2>'+page.name+'</h2></div><button class="help-close" type="button" data-intro-exit aria-label="Close beginner guide">×</button></div>'+
   '<div class="intro-body"><div class="intro-art"><img src="'+page.art+'" alt="'+page.alt+'"></div><div class="intro-copy"><p>'+page.copy+'</p><p>'+page.tip+'</p></div></div>'+
   '<div class="help-footer intro-footer"><div class="intro-steps" aria-label="Guide step '+(step+1)+' of '+pages.length+'">'+pages.map((p,i)=>'<button type="button" data-intro-step="'+i+'" title="'+p.name+'" aria-label="'+p.name+'" '+(i===step?'aria-current="step"':'')+'></button>').join('')+'</div>'+
   '<div class="intro-buttons">'+(step?'<button class="outline" type="button" data-intro-step="'+(step-1)+'">Back</button>':'<button class="outline" type="button" data-intro-exit>Skip</button>')+
   (last?'<a class="guide-primary" href="#gacha" data-intro-exit>Open pack shop</a>':'<button class="guide-primary" type="button" data-intro-step="'+(step+1)+'">Next</button>')+'</div></div>';
  if(dialog.open)dialog.querySelector('.guide-primary').focus({preventScroll:true});
 }
 function show(){
  if(dialog.open||document.querySelector('dialog[open]'))return;
  step=0;display();dialog.showModal();dialog.querySelector('.guide-primary').focus({preventScroll:true});
 }
 dialog.onclick=event=>{
  const action=event.target.closest('button,a');if(!action)return;
  if(action.hasAttribute('data-intro-exit'))dialog.close();
  else if(action.hasAttribute('data-intro-step')){step=Number(action.dataset.introStep);display()}
 };
 dialog.addEventListener('close',()=>markGuide(introId));
 trigger.onclick=show;
 return {welcome(){if(!seenGuide(introId))show()}};
}
