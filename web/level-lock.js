import {ico} from './icons.js';

export const lockBadge=(level,show=true)=>'<small class="level-lock" data-level-badge'+(show?'':' hidden')+'>'+ico('lock')+'Lvl '+level+'+</small>';
export const lockAttributes=(required,level)=>level<required?' data-level-locked="'+required+'" aria-disabled="true"':'';

export function setLevelLock(control,required,level){
 if(level<required){
  control.dataset.levelLocked=required;
  control.setAttribute('aria-disabled','true');
 }else{
  delete control.dataset.levelLocked;
  control.removeAttribute('aria-disabled');
 }
 const badge=control.querySelector('[data-level-badge]');
 if(badge)badge.hidden=level>=required;
}

export function lockedPage(feature,level,back){
 return '<section class="level-gate"><span class="level-gate-icon">'+ico('lock')+'</span><div><h2>'+feature.name+'</h2>'+
  '<p>Reach Level '+feature.level+' to unlock '+feature.name+'. You’re at Level '+level+'.</p>'+
  '<a class="primary" href="'+back+'">Keep playing</a></div></section>';
}
