const jumpKeys=new Set(['Space','ArrowUp','KeyW']);

export function bindRunnerControls({surface,pad,dialog,isRunning,onPress,onHeld,onPause}){
 const keys=new Set(),listeners=new AbortController();
 const {signal}=listeners;
 let pointer=null,pointerTarget;

 function release(event){
  if(event.pointerId!==pointer)return;
  pointer=null;pointerTarget=undefined;
  if(!keys.size)onHeld(false);
 }
 function press(event){
  if(!isRunning()||event.button!==0||pointer!==null)return;
  event.preventDefault();surface.focus({preventScroll:true});
  pointer=event.pointerId;pointerTarget=event.currentTarget;
  pointerTarget.setPointerCapture(pointer);
  onPress();
 }
 function reset(){
  const captured=pointer,target=pointerTarget;
  keys.clear();pointer=null;pointerTarget=undefined;
  if(target?.hasPointerCapture(captured))target.releasePointerCapture(captured);
 }

 for(const target of [surface,pad].filter(Boolean)){
  target.addEventListener('pointerdown',press,{signal});
  target.addEventListener('lostpointercapture',release,{signal});
 }
 window.addEventListener('pointerup',release,{capture:true,signal});
 window.addEventListener('pointercancel',release,{capture:true,signal});
 dialog.addEventListener('keydown',event=>{
  if(!isRunning())return;
  if(event.code==='KeyP'&&onPause){event.preventDefault();onPause();return;}
  if(!jumpKeys.has(event.code)||event.target!==pad&&event.target.closest?.('button,a,input,select,textarea,[contenteditable]'))return;
  event.preventDefault();
  if(event.repeat||keys.has(event.code))return;
  keys.add(event.code);onPress();
 },{signal});
 window.addEventListener('keyup',event=>{
  if(keys.delete(event.code)&&pointer===null&&!keys.size)onHeld(false);
 },{signal});
 if(onPause)window.addEventListener('blur',onPause,{signal});
 return {reset,dispose(){reset();listeners.abort();}};
}
