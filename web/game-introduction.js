import {markGuide,seenGuide} from './guide-progress.js';
import {sectionGuides} from './section-guides.js';

export function createSectionGuides(trigger){
 const dialog=document.createElement('dialog');
 dialog.className='help-sheet section-guide';
 dialog.setAttribute('aria-labelledby','sectionGuideTitle');
 document.body.append(dialog);
 let current,opened,opener,frame;

 function show(button){
  if(!current||document.querySelector('dialog[open]'))return;
  const guide=sectionGuides[current];
  opened=current;
  opener=button||document.activeElement;
  dialog.innerHTML='<div class="help-header"><img class="help-game-icon" src="'+guide.art+'" alt="">'+
   '<h2 id="sectionGuideTitle">'+guide.title+'</h2><button type="button" class="help-close" aria-label="Close help">×</button></div>'+
   '<ol class="section-guide-steps">'+guide.steps.map(([title,instruction])=>'<li><strong>'+title+'</strong><p>'+instruction+'</p></li>').join('')+'</ol>'+
   '<div class="help-footer"><button type="button" class="guide-primary" autofocus>Got it</button></div>';
  for(const button of dialog.querySelectorAll('button'))button.onclick=()=>dialog.close();
  dialog.showModal();
 }
 function offer(){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   if(document.body.dataset.account==='ready'&&current&&!seenGuide(current))show();
  });
 }
 function select(id){
  if(!sectionGuides[id]||id===current)return;
  current=id;
  const label='Help for '+sectionGuides[id].title;
  trigger.setAttribute('aria-label',label);
  trigger.title=label;
  if(dialog.open)dialog.close();
  offer();
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-section-help]');
  if(button)show(button);
 });
 dialog.addEventListener('close',()=>{
  if(opened)markGuide(opened);
  opened=null;
  if(opener?.isConnected)opener.focus({preventScroll:true});
  offer();
 });
 document.addEventListener('close',event=>{
  if(event.target!==dialog)offer();
 },true);
 return {select};
}
