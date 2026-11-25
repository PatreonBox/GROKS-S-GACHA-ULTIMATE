const mergeDuration=1320;
let activeShow=null;

// The shop supplies already escaped card markup. Here the cards are display pieces
// so keyboard focus and clicks stay with the merge controls.
function cardPrint(markup){
 return markup.trim()
  .replace(/^<button\b/, '<article')
  .replace(/\sdata-card="[^"]*"/, '')
  .replace(/<\/button>$/, '</article>')
  .replace('loading="lazy"', 'loading="eager"');
}

export function fusionPairHTML(leftHTML,rightHTML){
 return '<div class="fusion-pair-stage" aria-label="Duplicate cards to merge">'+
  '<div class="fusion-pair-print fusion-pair-left">'+cardPrint(leftHTML)+'</div>'+
  '<span class="fusion-pair-joint" aria-hidden="true">+</span>'+
  '<div class="fusion-pair-print fusion-pair-right">'+cardPrint(rightHTML)+'</div></div>';
}

function watchCovers(stage){
 for(const img of stage.querySelectorAll('.scene-shot')){
  function ready(){if(img.naturalWidth)img.classList.add('ready')}
  function failed(){
   const url=img.getAttribute('src')||'';
   if(url.startsWith('/api/')&&/^\d+$/.test(img.dataset.id)){
    img.src='https://levelthumbs.prevter.me/thumbnail/'+img.dataset.id+'/small';
   }else img.hidden=true;
  }
  img.addEventListener('load',ready);
  img.addEventListener('error',failed);
  if(img.complete){if(img.naturalWidth)ready();else failed()}
 }
}

const glitter=Array.from({length:16},(_,i)=>{
 const angle=i*Math.PI/8+.25,reach=.65+.35*((i*5)%11)/10;
 const x=Math.cos(angle)*reach,y=Math.sin(angle)*reach;
 return '<i style="--spark-x:'+x.toFixed(3)+';--spark-y:'+y.toFixed(3)+';--spark-d:'+(i%4)*24+'ms;--spark-r:'+(i*57)+'deg"></i>';
}).join('');

export function playFusion({leftHTML,rightHTML,resultHTML,resultName,promoted,finish='standard',gems,count=1,sound,onReward}){
 activeShow?.close();
 const route=location.href,previousFocus=document.activeElement;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const root=document.createElement('section');
 root.className='fusion-show'+(promoted?' fusion-promoted':'')+(finish==='standard'?'':' fusion-'+finish);
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Card merge');
 root.innerHTML='<div class="fusion-cabinet"><div class="fusion-title"><h2>Merging cards</h2></div>'+
  '<div class="fusion-theatre" aria-hidden="true"><div class="fusion-floor"></div>'+
  '<div class="fusion-port"><i></i><i></i><i></i></div><div class="fusion-seam"></div>'+
  '<div class="fusion-feed fusion-feed-left">'+cardPrint(leftHTML)+'</div>'+
  '<div class="fusion-feed fusion-feed-right">'+cardPrint(rightHTML)+'</div>'+
  '<div class="fusion-impact"></div><div class="fusion-shards">'+glitter+'</div>'+
  '<div class="fusion-prize">'+cardPrint(resultHTML)+'</div></div>'+
  '<div class="fusion-footer"><div class="fusion-receipt" aria-live="polite" aria-atomic="true"><strong class="fusion-result-name"></strong>'+
  '<span class="fusion-gem-receipt"><img src="/assets/packs/gem.png" alt=""><b></b></span></div>'+
  '<button class="outline fusion-next" type="button">Skip animation</button></div></div>';
 const title=root.querySelector('h2'),action=root.querySelector('.fusion-next');
 const label=root.querySelector('.fusion-result-name'),reward=root.querySelector('.fusion-gem-receipt');
 reward.querySelector('b').textContent='+'+gems+' '+(gems===1?'gem':'gems');
 const timers=new Set();
 let closed=false,revealed=false,resolve;
 const done=new Promise(r=>{resolve=r});
 function delay(callback,ms){
  const timer=setTimeout(()=>{timers.delete(timer);callback()},ms);timers.add(timer);
 }
 function cancelTimers(){for(const timer of timers)clearTimeout(timer);timers.clear()}
 function reveal(skip=false){
  if(closed||revealed)return;
  if(!root.isConnected||location.href!==route){close();return}
  revealed=true;cancelTimers();
  root.classList.toggle('fusion-skipped',skip||reduce);
  root.classList.add('fusion-revealed');
  title.textContent=count>1?count.toLocaleString('en-US')+' pairs merged':promoted?'Difficulty promoted':finish==='antimatter'?'Antimatter fusion':finish==='holo'?'Holo fusion':'Merge complete';
  label.textContent=count>1?'Best result · '+resultName:resultName;
  action.textContent='Continue';action.className='primary fusion-next';
  sound?.play(promoted||finish!=='standard'?'elite':'results',{level:.6,rate:promoted?1.04:1});
  onReward?.(reward);
 }
 function close(){
  if(closed)return;closed=true;cancelTimers();
  window.removeEventListener('hashchange',close);window.removeEventListener('pagehide',close);
  document.removeEventListener('focusin',keepFocus);
  root.remove();if(activeShow?.close===close)activeShow=null;
  if(previousFocus?.isConnected&&location.href===route)previousFocus.focus({preventScroll:true});
  resolve();
 }
 function keepFocus(event){if(!closed&&!root.contains(event.target))action.focus({preventScroll:true})}
 root.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   event.preventDefault();event.stopPropagation();reveal(true);close();
  }else if(event.key==='Tab'){
   event.preventDefault();action.focus({preventScroll:true});
  }
 });
 action.onclick=()=>{if(revealed)close();else reveal(true)};
 window.addEventListener('hashchange',close);window.addEventListener('pagehide',close);
 document.body.append(root);watchCovers(root);action.focus({preventScroll:true});
 document.addEventListener('focusin',keepFocus);
 activeShow={done,close};
 if(reduce)delay(()=>reveal(true),0);
 else{
  sound?.play('stack',{level:.6});
  delay(()=>sound?.play('sweep',{level:.62,rate:.9}),710);
  delay(()=>reveal(),mergeDuration);
 }
 return activeShow;
}
