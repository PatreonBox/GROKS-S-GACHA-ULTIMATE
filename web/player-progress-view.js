import {playerProgress} from './player-progression.js';

const format=new Intl.NumberFormat('en-US');
const percent=ratio=>ratio*100+'%';
let inline,toast,prior,revision=-1,timer=0,received=0,levelUp=false;

function readBar(bar){
 const find=selector=>bar.querySelector(selector),track=find('.xp-track');
 return {bar,track,fill:track.querySelector('i'),level:find('[data-xp-level]'),count:find('[data-xp-percent]'),gain:find('.xp-gain'),animations:[]};
}
function ensureToast(){
 if(toast)return toast;
 const frame=document.createElement('div');
 frame.className='player-level xp-notice';
 frame.setAttribute('aria-hidden','true');
 if(typeof frame.showPopover==='function')frame.setAttribute('popover','manual');
 frame.hidden=true;
 frame.innerHTML='<b data-xp-level></b><div class="xp-track"><i></i></div><strong data-xp-percent></strong><span class="xp-gain" hidden></span>';
 document.body.append(frame);
 toast=readBar(frame);
 return toast;
}
function draw(view,{level,xp,goal,ratio}){
 view.level.textContent='Level '+level;
 view.count.textContent=Math.floor(ratio*100)+'%';
 view.track.style.setProperty('--xp-fill',percent(ratio));
 if(view===inline){
  const label=format.format(xp)+' / '+format.format(goal)+' XP to Level '+(level+1);
  view.track.setAttribute('aria-valuemax',goal);
  view.track.setAttribute('aria-valuenow',xp);
  view.track.setAttribute('aria-valuetext',label);
  view.track.title=label;
 }
}
function stop(view){
 if(!view)return;
 for(const animation of view.animations)animation.cancel();
 view.animations=[];
}
const popoverOpen=frame=>frame.hasAttribute('popover')&&frame.matches(':popover-open');
function hideToast(){
 if(!toast)return;
 if(popoverOpen(toast.bar))toast.bar.hidePopover();
 toast.bar.hidden=true;
}
function dismiss(){
 received=0;levelUp=false;
 clearTimeout(timer);timer=0;
 if(inline)inline.gain.hidden=true;
 hideToast();
}
function flash(view,old,next,animate){
 const start=view.fill.getAnimations().some(animation=>animation.playState==='running')?getComputedStyle(view.fill).width:percent(old.ratio);
 stop(view);draw(view,next);
 view.gain.hidden=false;
 view.gain.textContent='+'+format.format(received)+' XP'+(levelUp?' · Level up!':'');
 if(!animate)return;
 const finish=percent(next.ratio);
 const segments=next.level>old.level?[{width:start,offset:0},{width:'100%',offset:.52},{width:'0%',offset:.53},{width:finish,offset:1}]:
  [{width:start},{width:finish}];
 view.animations.push(view.fill.animate(segments,{duration:next.level>old.level?680:420,easing:'ease-out'}),
  view.track.animate([
   {filter:'brightness(1.85)',boxShadow:'0 0 0 2px #effcff,0 0 18px #4acbfc'},
   {filter:'brightness(1)',boxShadow:'0 0 0 2px #05060a,inset 0 0 0 1px #050a18'}
  ],{duration:660,easing:'ease-out'}),
  view.gain.animate([{opacity:0,transform:'translateY(5px) scale(.91)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'}));
}

export function renderPlayerProgress(wallet,saveRevision=0){
 if(!wallet){prior=null;revision=-1;dismiss();return}
 if(saveRevision<revision)return;
 revision=saveRevision;
 inline??=readBar(document.getElementById('playerProgress'));
 const next=playerProgress(wallet.playerXp),old=prior;
 prior=next;
 if(next.total===old?.total)return;
 if(!old||next.total<=old.total||document.hidden){
  if(old&&next.level>old.level)document.dispatchEvent(new CustomEvent('gdlb-level-up',{detail:{from:old.level,to:next.level}}));
  dismiss();stop(inline);stop(toast);draw(inline,next);return;
 }
 received+=next.total-old.total;
 levelUp||=next.level>old.level;
 const bounds=inline.bar.getBoundingClientRect();
 const detached=!bounds.height||bounds.top<0||bounds.bottom>innerHeight||document.querySelector('dialog[open]');
 const animate=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 flash(inline,old,next,animate);
 if(detached){
  const notice=ensureToast();
  notice.bar.hidden=false;
  if(notice.bar.hasAttribute('popover')&&!popoverOpen(notice.bar))notice.bar.showPopover();
  flash(notice,old,next,animate);
 }else hideToast();
 clearTimeout(timer);
 timer=setTimeout(dismiss,levelUp?2150:1600);
 if(next.level>old.level)document.dispatchEvent(new CustomEvent('gdlb-level-up',{detail:{from:old.level,to:next.level}}));
}
