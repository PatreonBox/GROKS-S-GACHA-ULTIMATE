import {ico} from './icons.js';

export const lockBadge=(level,show=true)=>'<small class="level-lock" data-level-badge'+(show?'':' hidden')+'>'+ico('lock')+'Lvl '+level+'+</small>';
const role=' role="link" tabindex="-1"';
export function lockAttributes(required,level,href){
 const locked=level<required;
 const state=locked?' data-level-locked="'+required+'" aria-disabled="true"':'';
 if(href===undefined)return locked?state+' disabled':'';
 return locked?state+role+' data-level-href="'+href+'"':' href="'+href+'"';
}

export function setLevelLock(control,required,level){
 const locked=level<required;
 if(control.tagName==='BUTTON')control.disabled=locked;
 if(locked){
  control.dataset.levelLocked=required;
  control.setAttribute('aria-disabled','true');
  if(control.tagName==='A'){
   const href=control.getAttribute('href');
   if(href!==null)control.dataset.levelHref=href;
   control.removeAttribute('href');
   control.setAttribute('role','link');
   control.tabIndex=-1;
  }
 }else{
  delete control.dataset.levelLocked;
  control.removeAttribute('aria-disabled');
  if(Object.hasOwn(control.dataset,'levelHref')){
   control.setAttribute('href',control.dataset.levelHref);
   delete control.dataset.levelHref;
   control.removeAttribute('role');
   control.removeAttribute('tabindex');
  }
 }
 const badge=control.querySelector('[data-level-badge]');
 if(badge)badge.hidden=!locked;
}

export function lockedPage(feature,level,back){
 return '<section class="level-gate"><span class="level-gate-icon">'+ico('lock')+'</span><div><h2>'+feature.name+'</h2>'+
  '<p>Reach Level '+feature.level+' to unlock '+feature.name+'. You’re at Level '+level+'.</p>'+
  '<a class="primary" href="'+back+'">Keep playing</a></div></section>';
}
