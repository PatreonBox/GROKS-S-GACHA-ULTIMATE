import {stat} from './card-economy.js';
import {arenaPoint} from './arena-stage.js';
import {combatEffects} from './combat-fx.js';
import {moveArt,moveArts,schoolArt} from './combat-arts.js';
import {attackTiming,combatScene} from './combat-scene.js';
import {impactImpulse,recoilFrames,tumbleFrames} from './card-motion.js';

const reactions={
 hit:{text:'Ow!',color:'#ffe4a7'},
 angry:{face:'harder',text:'My turn next!',color:'#ffae80',cue:'cardAngry'},
 stunned:{face:'insane',text:'EXCUSE ME?',color:'#ffb2dc',cue:'cardBounce'},
 block:{face:'normal',text:'Nice try',color:'#a6f9ed',cue:'cardBlock'},
 healed:{face:'easy',text:'Still here!',color:'#baf7a5'},
 interrupt:{face:'insane',text:'Missed the orb!',color:'#ffcdaa',cue:'cardBounce'},
 riposte:{face:'harder',text:'My turn!',color:'#eec8ff',cue:'cardCounter'},
 knockdown:{text:'Back to 0%',color:'#ffd693',cue:'cardRetry'}
};

// The wallet has already committed. Each impact advances the visible board to that saved turn.
export function playCardTurn(root,before,after,sound,onFinish,onBounty){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const timers=[],animations=[],particles=[];
 let ended=false,offset=0;
 const later=(time,fn)=>timers.push(setTimeout(()=>{if(!ended)fn()},time));
 const unit=(side,index)=>root.querySelector('[data-unit="'+side+'-'+index+'"]');
 const field=root.querySelector('.battle-lanes'),world=field.querySelector('.arena-world');
 const effects=reduce?null:combatEffects(field);
 const stage=reduce?null:combatScene(field,world);
 const impacts=new WeakMap();
 const say=(str)=>{const v=root.querySelector('[data-cast]');if(v)v.textContent=str};
 const amount=n=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
 const rest='var(--card-rest)';
 function motion(el,frames,ms,easing='cubic-bezier(.27,.52,.38,1)'){
  if(!el||reduce)return;
  const body=el.closest('.arena-card-body')||el;
  const a=body.animate(frames,{duration:ms,easing});animations.push(a);return a;
 }
 function particle(type,host){
  const e=document.createElement('i');e.className=type;e.setAttribute('aria-hidden','true');host.append(e);particles.push(e);return e;
 }
 function title(evt,caster,timing){
  if(reduce||!evt.signature)return;
  const art=evt.art||schoolArt[evt.school],color=moveArts[art].color;
  const card=particle('cast-title'+(evt.cinematic||evt.visual||evt.copiedFrom?' is-major':''),field);
  card.style.setProperty('--cast-color',color);
  card.innerHTML=moveArt(art)+'<span><small></small><strong></strong></span>';
  card.querySelector('small').textContent=caster+(evt.copiedFrom?' · Copied from '+evt.copiedFrom:
   evt.signatureRank?' · Main List #'+evt.signatureRank:'');
  card.querySelector('strong').textContent=evt.name;
  field.classList.add('cinematic-active');field.style.setProperty('--cast-tone',color);
  const anim=card.animate([
   {opacity:0,transform:'translate(-50%,-8px) scale(.94)'},
   {offset:.12,opacity:1,transform:'translate(-50%,0) scale(1)'},
   {offset:.71,opacity:1,transform:'translate(-50%,0) scale(1)'},
   {opacity:0,transform:'translate(-50%,-5px) scale(.98)'}
  ],{duration:timing.duration,easing:'ease-out',fill:'both'});animations.push(anim);
 }
 function center(el){const r=el.getBoundingClientRect(),p=field.getBoundingClientRect();return {x:r.left+r.width/2-p.left,y:r.top+r.height/2-p.top}}
 function react(el,mood,seed){
  const {face,text,color,cue}=reactions[mood],point=center(el);
  const tag=particle('card-reaction'+(mood==='knockdown'?' is-tumbling':''),field);
  tag.dataset.reaction=mood;
  const style=tag.style;
  style.setProperty('--mood',color);
  style.top=Math.max(27,point.y-Math.min(44,el.offsetHeight*.34))+'px';
  const img=new Image();img.alt='';
  img.src=face?'/assets/faces/'+face+'.webp':el.querySelector('.battle-card-top img').src;
  tag.append(img,document.createTextNode(text));
  const half=tag.offsetWidth/2+3;
  style.left=Math.max(half,Math.min(field.clientWidth-half,point.x))+'px';
  if(cue)sound.play(cue,{level:.46,pan:Math.min(.7,Math.max(-.7,point.x/field.clientWidth-.5)),seed});
  if(reduce){later(340,()=>tag.remove());return}
  const tilt=mood==='knockdown'?-11:mood==='angry'?7:0;
  const drift=tilt?' rotate('+tilt+'deg)':'';
  const a=motion(tag,[
   {opacity:0,transform:'translate(-50%,-35%) scale(.62)'},
   {offset:.23,opacity:1,transform:'translate(-50%,-60%) scale(1.14)'+drift},
   {offset:.40,opacity:1,transform:'translate(-50%,-51%) scale(.97)'},
   {offset:.78,opacity:1,transform:'translate(-50%,-55%) scale(1)'},
   {opacity:0,transform:'translate(-50%,-83%) scale(.92)'+drift}
  ],mood==='knockdown'?660:545,'linear');
  a.onfinish=()=>tag.remove();
 }
 function burst(to,kind){
  if(reduce)return;
  const c=center(to);
  for(let i=0;i<(kind==='pulse'?10:6);i++){
   const bit=particle('hit-bit '+kind,field),angle=(i/(kind==='pulse'?10:6))*Math.PI*2;
   bit.style.left=c.x+'px';bit.style.top=c.y+'px';
   motion(bit,[{opacity:1,transform:'translate(0,0) rotate(45deg) scale(.4)'},{offset:.24,opacity:1},{opacity:0,transform:'translate('+Math.cos(angle)*39+'px,'+Math.sin(angle)*32+'px) rotate(150deg) scale(.6)'}],300);
  }
 }
 function hp(el,value,max){
  el.style.setProperty('--hp',Math.max(0,100*value/max)+'%');el.querySelector('[data-vital]').textContent=stat(value)+' / '+stat(max)+' HP';
 }
 const values={allies:before.allies.map(u=>u.hp),enemies:before.enemies.map(u=>u.hp)};
 function hit(evt,to,origin,impactSound){
  const {kind,side,index,amount:damage}=evt,defend=kind==='guard'||kind==='heal',u=before[side][index];
  const value=Math.max(0,Math.min(u.maxHp,values[side][index]+(defend?damage:-damage)));
  values[side][index]=value;hp(to,value,u.maxHp);
  sound.play(impactSound||evt.school||(defend?'guard':'attack'),{level:evt.signature?.97:.74,seed:evt.seed});
  const pop=particle('damage-tag '+(defend?'repair':kind==='execute'?'execution-tag':''),to);
  pop.textContent=kind==='execute'?'FINISHED · −'+amount(damage):defend?(damage?'+'+amount(damage)+' HP':'GUARD'):damage?'−'+amount(damage):evt.absorbed?'BLOCK':'MISS';
  burst(to,kind);
  if(defend){if(kind==='heal')react(to,'healed',u.id);return}
  const share=damage/u.maxHp,blocked=!damage&&evt.absorbed>0;
  if(evt.riposte&&origin){react(origin,'riposte',evt.seed);pop.classList.add('riposte-tag')}
  if(blocked)react(to,'block',u.id);
  else if(damage&&(kind!=='follow'||share>.25))react(to,share>=.48?'stunned':share>=.19||value<u.maxHp*.28?'angry':'hit',u.id);
  if(reduce||(!damage&&!blocked))return;
  const impact=impactImpulse(origin&&arenaPoint(origin,world),arenaPoint(to,world),to.offsetWidth,side,share,evt.signature,blocked);
  impacts.set(to,impact);
  const body=to.closest('.arena-card-body');body.classList.add('is-reeling');
  motion(to,recoilFrames(impact,rest),blocked?285:evt.signature?520:375,'linear').onfinish=()=>body.classList.remove('is-reeling');
 }
 for(const evt of after.events){
  const {kind,side,index,from}=evt,dest=unit(side,index);
  if(!dest)continue;
  const team=side==='enemies'?'allies':'enemies',origin=from===undefined?null:unit(team,from);
  const unitName=before[side][index].name;
  if(['shield','heal','follow','interrupt','link','status'].includes(kind)){
   later(offset,()=>{
    if(kind==='heal'||kind==='follow'){hit(evt,dest,origin);if(kind==='follow'&&origin)effects?.launch(center(origin),center(dest),evt,226);return}
    if(kind==='link'){
     const tag=particle('damage-tag payout',dest);tag.textContent=evt.name+' link';
     say(evt.name+' activated');sound.play('charged',{level:.72});
     effects?.launch(center(dest),center(dest),{school:evt.school,signature:true},290);
     return;
    }
    if(kind==='status'){
     const tag=particle('damage-tag tactic-tag',dest);tag.textContent=evt.name;
     if(evt.cue||evt.name==='Signature sealed')sound.play(evt.cue||'domainHit',{level:.37});
     return;
    }
    const tag=particle('damage-tag '+(kind==='shield'?'repair':'payout'),dest);
    tag.textContent=kind==='shield'?'+'+amount(evt.amount)+' shield':evt.name;
    sound.play(kind==='shield'?'ward':'interrupt',{level:.77});say(kind==='shield'?unitName+' · Barrier':evt.name);
    if(kind==='interrupt')react(dest,'interrupt',before[side][index].id);
    if(!reduce)effects?.launch(center(dest),center(dest),{school:kind==='shield'?'ward':'shatter',signature:false},210);
   });offset+=reduce?55:kind==='status'?72:115;continue;
  }
  if(kind==='injury'||kind==='knockout'){
   later(offset,()=>{
    sound.play(kind);dest.classList.add('finishing');
    dest.closest('.arena-card-body').classList.remove('is-reeling');
    if(kind==='knockout')onBounty?.(index,dest);
    if(kind==='knockout'&&before[side][index].id===before.remix){
     if(before.remix===86407629)sound.play('waveCut');
     if(before.remix===10565740)sound.play('bloodDrip');
    }
    const tag=particle('damage-tag payout',dest);tag.textContent=kind==='knockout'?'+'+amount(evt.amount)+' ◉':'INJURED';
    say(kind==='knockout'&&evt.sourceName?evt.sourceName+' defeated '+unitName:unitName+(kind==='knockout'?' defeated':' entered recovery'));
    react(dest,'knockdown',before[side][index].id);
    if(!reduce){
     const impact=impacts.get(dest)||impactImpulse(null,arenaPoint(dest,world),dest.offsetWidth,side,1,true,false);
     motion(dest,tumbleFrames(impact,rest),590);
    }
   });offset+=reduce?120:630;continue;
  }
  const timing=kind==='guard'?{duration:reduce?120:415,at:.30}:attackTiming(evt,reduce);
  if(!reduce&&!evt.signature&&kind!=='guard')timing.duration=Math.max(590,timing.duration);
  const {duration,windup,impact:impactSound}=timing,impact=Math.round(duration*timing.at);
  later(offset,()=>{
   if(kind==='guard'){
    say(unitName+' · Cover');const shell=particle('guard-shell',dest);
    react(dest,'block',before[side][index].id);
    motion(dest,[{transform:rest},{offset:.46,transform:'translate3d(0,0,54px) '+rest+' scale(1.065) rotateY(-10deg)'},{transform:rest}],duration);
    if(reduce)shell.style.animation='none';
   }else if(origin){
    const caster=before[team][from].name;
    say(evt.name||caster);
    origin.classList.add('casting');
    if(!reduce){
     const start=arenaPoint(origin,world),end=arenaPoint(dest,world);
     const arrivals=evt.native?[end,...after.events
      .filter(e=>e.kind==='follow'&&e.side===side&&e.castKey===evt.castKey)
      .map(e=>arenaPoint(unit(e.side,e.index),world))]:[];
     stage?.cast(start,end,evt,timing,arrivals);
     title(evt,caster,timing);
     const dx=end.x-start.x,dy=end.y-start.y,dir=side==='enemies'?-1:1;
     const reach=Math.max(1,Math.hypot(dx,dy)),nx=-dy/reach,ny=dx/reach;
     const style=evt.school||'lance',big=evt.signature?1.35:1;
     const step=(part,sideways,angle,scale,lift)=>
      'translate3d('+(dx*part+nx*sideways)+'px,'+(dy*part+ny*sideways)+'px,'+lift+'px) '+rest+
      ' rotateZ('+(angle*dir)+'deg) rotateY('+(angle*.66)+'deg) rotateX('+(-dir*(lift/6+part*16))+'deg) scale('+scale+')';
     const poses={
      shatter:[[-.08,9,-17,1.04,32],[.66,-10,15,1.12,91],[.45,7,-5,1.03,38]],
      lance:[[-.11,0,-2,1.03,24],[.75,0,2,1.09,74],[.64,0,-2,1.02,32]],
      siphon:[[-.08,-4,-6,1.09,27],[.08,14,7,1.13,94],[-.04,-8,-3,1.03,54]],
      chain:[[-.04,-11,-9,1.04,32],[.16,9,12,1.11,91],[-.07,-3,-6,1.02,47]],
      ward:[[.04,0,0,.94,24],[.25,0,0,1.14,64],[.15,0,0,1.06,38]],
      rupture:[[-.12,0,8,1.10,37],[.38,0,-3,.94,98],[.22,-6,4,1.03,21]],
      surge:[[-.03,-12,-10,1.02,31],[.63,23,12,1.08,91],[.42,-18,-13,1.04,40]],
      vortex:[[-.06,-10,-18,1.07,29],[.19,13,23,1.13,120],[.13,-9,-12,1.04,55]]
     }[style]||[[-.08,0,-8,1.06,38],[.34,5,12,1.12,82],[.12,-6,-5,1.02,46]];
     const shape=moveArts[evt.art]?.shape;
     if(shape==='wave')poses.splice(0,3,[-.08,0,-8,1.07,38],[.36,12,12,1.10,84],[.26,4,-6,1.02,49]);
     if(shape==='projectile')poses.splice(0,3,[-.11,0,4,1.08,43],[.09,0,-3,1.17,60],[-.07,0,7,1.04,24]);
     const personal={
      slam:[[-.08,0,11,1.08,86],[.58,3,-7,1.18,116],[.44,-8,8,1.07,35]],
      stream:[[-.06,-5,-3,1.04,38],[.30,5,6,1.12,76],[.18,-1,-3,1.07,47]],
      fan:[[-.04,-14,-15,1.05,39],[.32,9,11,1.15,90],[.15,12,-5,1.02,54]],
      spiral:[[-.11,4,20,1.04,46],[.27,-14,-25,1.12,103],[.15,12,7,1.05,61]],
      pulse:[[0,0,0,.95,35],[.18,3,1,1.17,87],[.07,0,-4,1.07,54]],
      sweep:[[-.09,9,-18,1.03,31],[.63,-15,25,1.16,95],[.41,10,-8,1.03,41]],
      orbit:[[-.04,12,-12,1.05,47],[.25,-15,17,1.17,98],[.12,9,-12,1.04,53]]
     }[evt.pose];
     if(personal&&!evt.cinematic)poses.splice(0,3,...personal);
     if(evt.cinematic==='execute')poses.splice(0,3,[-.06,-13,-23,1.05,42],[.77,17,27,1.12,104],[.53,-11,-16,1.02,38]);
     sound.play(windup||'sweep',{rate:evt.cinematic?1:evt.signature?1.06:1.08,level:windup?.76:.36,seed:evt.seed});
     const frames=[{transform:rest},...poses.map(([p,n,a,s,lift],i)=>({
      offset:[.24,timing.at-.045,Math.min(.88,timing.at+.13)][i],transform:step(p,n*big,a*big,1+(s-1)*big,lift*big)
     })),{transform:rest}];
     motion(origin,frames,duration);
    }
   }
  });
  later(offset+impact,()=>hit(evt,dest,origin,impactSound));
  if(origin)later(offset+duration,()=>{origin.classList.remove('casting');field.classList.remove('cinematic-active')});
  offset+=duration+15;
 }
 function stop(){
  if(ended)return;ended=true;effects?.stop();stage?.stop();timers.forEach(clearTimeout);animations.forEach(a=>a.cancel());particles.forEach(p=>p.remove());
  field.classList.remove('cinematic-active');
  world.querySelectorAll('.is-reeling,.casting,.finishing').forEach(el=>el.classList.remove('is-reeling','casting','finishing'));
 }
 later(offset+50,()=>{stop();if(after.status==='won'||after.status==='lost')sound.play(after.status==='won'?'victory':'loss');onFinish()});
 return stop;
}
