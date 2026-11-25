import {ico} from './icons.js';

export const arenaDeck='<div class="arena-deck" aria-hidden="true">'+
 '<i class="deck-track deck-track-left"></i><i class="deck-track deck-track-right"></i>'+
 '<i class="deck-ring"></i><i class="deck-wall deck-wall-front"></i>'+
 '<i class="deck-wall deck-wall-left"></i><i class="deck-wall deck-wall-right"></i></div>';

export const cardChassis='<i class="arena-card-back" aria-hidden="true"></i>'+
 '<i class="card-edge card-edge-top" aria-hidden="true"></i><i class="card-edge card-edge-bottom" aria-hidden="true"></i>'+
 '<i class="card-edge card-edge-left" aria-hidden="true"></i><i class="card-edge card-edge-right" aria-hidden="true"></i>';

export const cameraTools='<div class="camera-tools" role="group" aria-label="Arena camera">'+
 '<button class="outline" data-camera="left" aria-label="Rotate camera left" title="Rotate left">'+ico('left')+'</button>'+
 '<button class="outline" data-camera="level" aria-label="Orbit view" aria-pressed="false" title="Switch between upright and orbit views">'+ico('camera')+'<span>3D</span></button>'+
 '<button class="outline" data-camera="right" aria-label="Rotate camera right" title="Rotate right">'+ico('right')+'</button></div>';

export function arenaPoint(card,world){
 const slot=card.closest('.arena-slot')||card;
 let x=slot.offsetWidth/2,y=slot.offsetHeight/2;
 for(let el=slot;el&&el!==world;el=el.offsetParent){x+=el.offsetLeft;y+=el.offsetTop}
 return {x,y};
}

const limit=(value,low,high)=>Math.min(high,Math.max(low,value));
export function bindArenaCamera(root,camera){
 const field=root.querySelector('.arena-view'),tools=root.querySelector('.camera-tools');
 if(!field||!tools)return;
 const narrow=field.clientWidth<620;
 const pitchAtRest=narrow?20:31;
 const yawRange=narrow?23:37;
 const home=()=>{camera.yaw=-9;camera.pitch=null;camera.zoom=1};
 function paint(){
  field.classList.toggle('is-overhead',camera.flat);
  field.style.setProperty('--look-x',(camera.flat?0:camera.pitch??pitchAtRest)+'deg');
  field.style.setProperty('--look-y',(camera.flat?0:camera.yaw??-9)+'deg');
  field.style.setProperty('--look-scale',camera.flat?1:camera.zoom??1);
  const toggle=tools.querySelector('[data-camera="level"]');
  toggle.setAttribute('aria-pressed',String(!camera.flat));
  toggle.querySelector('span').textContent=camera.flat?'Upright':'Orbit';
  for(const button of tools.querySelectorAll('[data-camera]:not([data-camera="level"])'))button.disabled=camera.flat;
 }
 const locked=()=>field.classList.contains('camera-locked');
 tools.addEventListener('click',event=>{
  const button=event.target.closest('[data-camera]');
  if(!button||locked())return;
  switch(button.dataset.camera){
   case 'left':camera.yaw=limit((camera.yaw??-9)-11,-yawRange,yawRange);break;
   case 'right':camera.yaw=limit((camera.yaw??-9)+11,-yawRange,yawRange);break;
   case 'level':camera.flat=!camera.flat;break;
  }
  paint();
 });
 let drag=null;
 field.addEventListener('pointerdown',e=>{
  if(camera.flat||locked()||e.button!==0||e.target.closest('button')||
     (e.pointerType==='touch'&&!e.target.closest('.versus')))return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,pitch:camera.pitch??pitchAtRest,yaw:camera.yaw??-9};
  field.setPointerCapture(e.pointerId);field.classList.add('is-orbiting');e.preventDefault();
 });
 field.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id||locked())return;
  camera.yaw=limit(drag.yaw+(e.clientX-drag.x)*.18,-yawRange,yawRange);
  camera.pitch=limit(drag.pitch-(e.clientY-drag.y)*.18,5,narrow?40:53);
  paint();
 });
 for(const event of ['lostpointercapture','pointerup','pointercancel']){
  field.addEventListener(event,e=>{
   if(drag?.id!==e.pointerId)return;
   drag=null;field.classList.remove('is-orbiting');
  });
 }
 field.addEventListener('dblclick',e=>{
  if(e.target.closest('.versus')&&!locked()){home();paint()}
 });
 field.addEventListener('wheel',e=>{
  if(camera.flat||locked()||e.ctrlKey)return;
  camera.zoom=limit((camera.zoom??1)-e.deltaY*.00065,.82,narrow?1.04:1.12);
  e.preventDefault();paint();
 },{passive:false});
 paint();
}
