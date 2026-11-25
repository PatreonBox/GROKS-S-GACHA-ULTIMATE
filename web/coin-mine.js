import {ico} from './icons.js';
import {stat} from './card-economy.js';
import {mineCoin,purchaseMineMachine,purchaseMineSkill} from './pack-engine.js';
import {rewardOrigin} from './reward-flight.js';
import {
 mineMachines,mineSkills,mineMilestone,mineLevelCap,mineRateCap,mineRate,mineTapPower,machineOwned,skillOwned,
 mineMachineRate,mineMachineLock,mineSkillLock,mineSkill,quoteMachine
} from './mine-economy.js';

const coin='<img class="gd-coin" src="/assets/packs/coin.png" alt="">';
const cursor=mineMachines[0].art;
const number=n=>n.toLocaleString('en-US');
const modes=[1,10,'max'];
const modeTitle=mode=>mode==='max'?'Max':'×'+mode;
const text=(element,value)=>{if(element.textContent!==value)element.textContent=value};

function machineCard(machine){
 return '<article class="mine-machine" data-machine="'+machine.id+'" style="--machine:'+machine.color+'">'+
  '<div class="mine-machine-head"><i><img src="'+machine.art+'" alt=""></i><b data-owned>0</b></div>'+
  '<h3>'+machine.name+'</h3><p>'+machine.action+'</p><strong data-output></strong><small data-milestone></small>'+
  '<button type="button" data-buy-machine="'+machine.id+'" disabled></button></article>';
}
function nodeArt(skill){
 return skill.art?'<img src="/assets/mine/'+skill.art+'.webp" alt="">':ico(skill.icon);
}
function skillNode(skill){
 return '<button type="button" class="mine-node" data-select-skill="'+skill.id+'" style="--node:'+skill.color+';--node-x:'+skill.x+'%;--node-y:'+skill.y+'%">'+
  '<span class="mine-node-icon">'+nodeArt(skill)+'</span><span class="mine-node-label">'+skill.name+'</span></button>';
}
function drawBranches(canvas,mine,selection,upgrade){
 const width=canvas.clientWidth,height=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
 if(!width||!height)return;
 const w=Math.round(width*dpr),h=Math.round(height*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
 const graph=canvas.getContext('2d');graph.setTransform(dpr,0,0,dpr,0,0);
 graph.clearRect(0,0,width,height);graph.lineJoin=graph.lineCap='round';
 for(const skill of mineSkills){
  for(const parentId of skill.parents||[]){
   const parent=mineSkill(parentId),powered=skillOwned(mine,parentId),reached=skillOwned(mine,skill.id);
   const x=parent.x/100*width,y=parent.y/100*height,endX=skill.x/100*width,endY=skill.y/100*height,midY=y+(endY-y)*.56;
   graph.beginPath();graph.moveTo(x,y);graph.bezierCurveTo(x,midY,endX,midY,endX,endY);
   graph.lineWidth=reached?9:6;graph.strokeStyle=reached?skill.color+'34':'#09101d';graph.stroke();
   graph.lineWidth=reached||selection===skill.id?2.5:1.5;
   graph.strokeStyle=reached?skill.color:powered?skill.color+'a0':selection===skill.id?skill.color+'73':'#46516c';
   graph.stroke();
   if(upgrade&&(parentId===upgrade.id||skill.id===upgrade.id)){
    const alpha=1-upgrade.progress;
    graph.save();graph.globalAlpha=alpha;
    graph.strokeStyle='#fff8dc';graph.lineWidth=3.7;graph.setLineDash([18,19]);graph.lineDashOffset=-upgrade.progress*116;
    graph.shadowColor=skill.color;graph.shadowBlur=10;graph.stroke();graph.restore();
   }
  }
 }
}
function cursors(count){
 const shown=Math.min(24,count);
 return Array.from({length:shown},(_,i)=>{
  const ring=i>=12?1:0,angle=(i%12)*30-92+ring*15;
  return '<i style="--angle:'+angle+'deg;--ring:'+ring+';--delay:'+(-i*.119).toFixed(2)+'s"><img src="'+cursor+'" alt=""></i>';
 }).join('');
}
function timeLabel(elapsed){
 const minutes=Math.floor(elapsed/60000);
 if(!minutes)return Math.floor(elapsed/1000)+'s';
 const hours=Math.floor(minutes/60),rest=minutes%60;
 return hours?hours+'h'+(rest?' '+rest+'m':''):minutes+'m';
}
function setPrice(button,label,disabled,price,title){
 const key=[label,price,title].join('|');
 button.disabled=disabled;
 if(button.dataset.price===key)return;
 button.dataset.price=key;button.innerHTML=price?'<span>'+label+'</span><b>'+coin+stat(price)+'</b>':label;
 button.setAttribute('aria-label',title||label);
}

export function createCoinMine({sound,rewards,applyWallet,announce,onCode}){
 let root,wallet,coins=0,mode=1,buying=false,away=null,view,selected=mineSkills[0].id,resize;
 let gainTimer=0,tapTotal=0,coinPulse;
 let branchFrame=0,treeMark='';
 const active=()=>root?.isConnected;
 function paintPurchases(){
  if(!active()||!wallet)return;
  const mine=wallet.mine,estimated={...wallet,coins};
  for(const {machine,button} of view.machines){
   const level=machineOwned(mine,machine.id),lock=mineMachineLock(mine,machine.id);
   const {count,cost,affordable}=quoteMachine(estimated,machine.id,mode);
   if(lock||level>=mineLevelCap){setPrice(button,lock||'Max owned',true);continue}
   const label=mode==='max'&&!count?'Buy max':count>1?'Buy ×'+count:'Buy';
   const price=cost||quoteMachine(estimated,machine.id).cost;
   setPrice(button,label,buying||!affordable,price,label+' '+machine.name+' for '+number(price)+' coins');
  }
  const skill=mineSkill(selected);
  const owned=skillOwned(mine,skill.id),lock=mineSkillLock(mine,skill.id);
  text(view.requirement,owned?'Permanent boost active':lock||(coins<skill.price?'Need '+number(skill.price-coins)+' more coins':'Ready to unlock'));
  setPrice(view.skillBuy,owned?'Unlocked':lock?'Locked':'Unlock',owned||!!lock||buying||coins<skill.price,owned?0:skill.price,
   owned?skill.name+' unlocked':lock?skill.name+' locked':'Unlock '+skill.name+' for '+number(skill.price)+' coins');
 }
 function paintTree(){
  if(!active())return;
  const mine=wallet?.mine,chosen=mineSkill(selected);
  const mark=chosen.id+'|'+mineMachines.map(machine=>machineOwned(mine,machine.id)).join(',')+'|'+mineSkills.map(skill=>+skillOwned(mine,skill.id)).join('');
  if(treeMark===mark)return;
  treeMark=mark;
  view.skillBuy.dataset.buySkill=chosen.id;
  view.inspector.style.setProperty('--node',chosen.color);
  if(view.skillArt.dataset.skill!==chosen.id){
   view.skillArt.dataset.skill=chosen.id;
   view.skillArt.innerHTML=nodeArt(chosen);
  }
  text(view.skillName,chosen.name);
  text(view.skillEffect,chosen.description);
  let unlocked=0;
  for(const {skill,button} of view.nodes){
   const status=skillOwned(mine,skill.id)?'owned':mineSkillLock(mine,skill.id)?'locked':'available';
   if(status==='owned')unlocked++;
   button.dataset.state=status;
   button.setAttribute('aria-pressed',String(skill===chosen));
   button.setAttribute('aria-label',skill.name+' · '+(status==='owned'?'unlocked':status));
  }
  text(view.progress,unlocked+' / '+mineSkills.length+' unlocked');
  if(!branchFrame)drawBranches(view.branches,mine,selected);
 }
 function animateUnlock(id){
  if(!active()||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const node=view.nodes.find(item=>item.skill.id===id)?.button;
  node?.animate([{transform:'translate(-50%,-50%) scale(.87)'},{transform:'translate(-50%,-50%) scale(1.14)'},{transform:'translate(-50%,-50%) scale(1)'}],{duration:580,easing:'ease-out'});
  if(node){
   node.classList.remove('mine-node-unlock');
   requestAnimationFrame(()=>node.classList.add('mine-node-unlock'));
  }
  cancelAnimationFrame(branchFrame);
  const start=performance.now();
  const frame=now=>{
   if(!active()){branchFrame=0;return}
   const progress=Math.min(1,(now-start)/710);
   drawBranches(view.branches,wallet?.mine,selected,{id,progress});
   branchFrame=progress<1?requestAnimationFrame(frame):0;
  };
  branchFrame=requestAnimationFrame(frame);
 }
 function setCoins(value,increment=0){
  coins=value;
  if(!active())return;
  text(view.balance,number(coins));
  if(increment>0){
   view.income.hidden=false;
   text(view.income,'+'+number(increment)+' mined');
  }
  paintPurchases();
 }
 function setWallet(next){
  wallet=next;
  if(!active())return;
  const mine=next.mine,rate=mineRate(mine),tap=mineTapPower(mine);
  text(view.rate,stat(rate));
  view.rate.title=number(rate)+' coins per second';
  text(view.tap,'+'+number(tap)+' per tap');
  view.hit.setAttribute('aria-label','Mine '+number(tap)+' '+(tap===1?'coin':'coins'));
  const count=machineOwned(mine,'cursor');
  if(view.cursors.dataset.count!==String(count)){
   view.cursors.dataset.count=count;view.cursors.innerHTML=cursors(count);
  }
  text(view.workers,count?number(count)+' '+(count===1?'cursor':'cursors')+' tapping':'');
  view.workers.hidden=!count;
  view.scene.classList.toggle('mine-powered',rate>0);
  for(const {machine,element,owned,output,milestone} of view.machines){
   const level=machineOwned(mine,machine.id);
   element.classList.toggle('machine-locked',!!mineMachineLock(mine,machine.id));
   text(owned,number(level)+' owned');
   text(output,level?stat(mineMachineRate(mine,machine.id))+' coins/s':stat(machine.rate)+' coins/s each');
   text(milestone,level&&level<mineLevelCap?'2× output at '+(Math.floor(level/mineMilestone)+1)*mineMilestone+' owned':'');
  }
  paintTree();
  setCoins(next.coins);
 }
 function paintAway(){
  if(!active())return;
  view.away.hidden=!away;
  if(away)text(view.away.querySelector('strong'),'+'+number(away.coins)+' coins earned while away · '+timeLabel(away.elapsed));
 }
 function reportAway(receipt){away=receipt;paintAway()}
 function rollGain(amount){
  tapTotal+=amount;
  text(view.gain,'+'+number(tapTotal));
  view.gain.classList.add('counting');
  clearTimeout(gainTimer);
  gainTimer=setTimeout(()=>{tapTotal=0;view?.gain.classList.remove('counting')},760);
 }
 async function tapCoin(button){
  if(!wallet)return;
  sound.playGame('mintTap',{level:.45});
  const origin=rewardOrigin(button);
  if((!coinPulse||coinPulse.playState!=='running')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   coinPulse=button.querySelector('.mine-token').animate([{transform:'scale(1)'},{transform:'scale(.92) rotate(-3deg)'},{transform:'scale(1)'}],{duration:160});
  }
  try{
   const result=await mineCoin();
   const ticket=button.isConnected&&result.gain?rewards.reserve('coins',result.gain):null;
   applyWallet(result.wallet);
   if(ticket){rollGain(result.gain);rewards.streamCoins(ticket,origin)}
  }catch(e){announce(e.message)}
 }
 async function buy(button){
  if(buying||!wallet)return;
  const id=button.dataset.buyMachine,skill=button.dataset.buySkill;
  buying=true;paintPurchases();
  try{
   if(id){
    const {wallet:next,count}=await purchaseMineMachine(id,mode);
    applyWallet(next);
    announce('Purchased '+count+' × '+mineMachines.find(machine=>machine.id===id).name);
   }else{
    const next=await purchaseMineSkill(skill);
    applyWallet(next);
    announce(mineSkill(skill).name+' unlocked');
    animateUnlock(skill);
   }
   sound.playGame(id?'mintTap':'mintUnlock',{level:id?.64:.62});
   sound.play(id?'buy':'extraAccent',{level:.48});
   if(button.isConnected&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    button.closest(id?'article':'.mine-inspector').animate?.([{filter:'brightness(1.5)'},{filter:'brightness(1)'}],{duration:320});
   }
  }catch(error){announce(error.message)}
  finally{buying=false;paintPurchases()}
 }
 function show(body,next){
  root=body;
  treeMark='';
  sound.prepareGame('mint');
  root.innerHTML='<div class="mine-panel mine-foundry"><div class="mine-copy"><h2>Coin mine</h2>'+
   '<div class="mine-income">'+coin+'<b data-rate>0</b><span>coins per second</span></div>'+
   '<div class="mine-readout"><strong id="mineBalance">…</strong><span>coins</span><b class="mine-passive" data-mine-income hidden></b></div>'+
   '<p>Tap the coin or put your machines to work. Offline earnings build up for 5 hours.</p>'+
   '<div class="mine-links"><button class="outline" id="codeEntry">Enter code</button><button type="button" class="outline" data-tree-jump>'+ico('spark')+' Skill tree</button></div>'+
   '</div><div class="mine-scene"><div class="mine-rings"></div><div class="mine-platform"></div><div class="mine-cursors" data-cursors aria-hidden="true"></div>'+
   '<button type="button" class="mine-hit" id="mineHit" aria-label="Mine one coin"><span class="mine-token">'+coin+'</span></button>'+
   '<div class="mine-increment" data-mine-gain aria-hidden="true"></div>'+
   '<div class="mine-stage-label"><b data-tap>+1 per tap</b><span data-workers hidden></span></div></div></div>'+
   '<div class="mine-away" data-away hidden>'+coin+'<strong></strong><button type="button" data-dismiss-away aria-label="Dismiss offline earnings">'+ico('x')+'</button></div>'+
   '<section class="mine-machinery"><div class="mine-section-head"><div><h2>Machines</h2><p>Machine output doubles for every '+mineMilestone+' copies you own.</p></div>'+
   '<div class="mine-quantity" role="group" aria-label="Machine purchase quantity">'+modes.map(value=>'<button type="button" data-mine-mode="'+value+'" aria-pressed="'+(value===mode)+'">'+modeTitle(value)+'</button>').join('')+'</div></div>'+
   '<div class="mine-machine-grid">'+mineMachines.map(machineCard).join('')+'</div></section>'+
   '<section class="mine-tree" tabindex="-1"><div class="mine-section-head"><div><h2>Mine skill tree</h2><p>Choose a node to see its boost and requirements.</p></div>'+
   '<div class="mine-tree-stats"><strong data-mine-skills></strong><span>'+stat(mineRateCap)+'/s production cap</span></div></div>'+
   '<div class="mine-tree-layout"><div class="mine-map" role="group" aria-label="Mine skill branches"><canvas aria-hidden="true"></canvas>'+
   mineSkills.map(skillNode).join('')+'</div><div class="mine-inspector"><span class="mine-inspector-art"></span>'+
   '<h3></h3><b data-skill-effect></b><p data-requirement></p><button type="button" data-buy-skill disabled>Unlock</button></div></div></section>'+
   '<p class="mine-credit"><a href="https://www.gnome.org/">GNOME Project</a> Adwaita cursor, converted to PNG · <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a></p>';
  const by=selector=>body.querySelector(selector);
  view={
   rate:by('[data-rate]'),balance:by('#mineBalance'),income:by('[data-mine-income]'),gain:by('[data-mine-gain]'),tap:by('[data-tap]'),hit:by('#mineHit'),away:by('[data-away]'),
   cursors:by('[data-cursors]'),workers:by('[data-workers]'),scene:by('.mine-scene'),tree:by('.mine-tree'),
   machines:mineMachines.map(machine=>{
    const element=by('[data-machine="'+machine.id+'"]'),item=selector=>element.querySelector(selector);
    return {machine,element,button:item('button'),owned:item('[data-owned]'),output:item('[data-output]'),milestone:item('[data-milestone]')};
   }),
   branches:by('.mine-map canvas'),inspector:by('.mine-inspector'),skillArt:by('.mine-inspector-art'),skillName:by('.mine-inspector h3'),
   progress:by('[data-mine-skills]'),
   skillBuy:by('[data-buy-skill]'),skillEffect:by('[data-skill-effect]'),requirement:by('[data-requirement]'),
   nodes:mineSkills.map(skill=>({skill,button:by('[data-select-skill="'+skill.id+'"]')}))
  };
  resize=new ResizeObserver(()=>{if(active())drawBranches(view.branches,wallet?.mine,selected)});
  resize.observe(view.branches.parentElement);
  body.onclick=event=>{
   const button=event.target.closest('button');
   if(!button)return;
   if(button.id==='mineHit'){tapCoin(button);return}
   if(button.id==='codeEntry'){onCode();return}
   const data=button.dataset;
   if(data.buyMachine||data.buySkill){buy(button);return}
   if(data.selectSkill){
    selected=data.selectSkill;sound.play('select',{level:.63});paintTree();paintPurchases();return;
   }
   if(data.mineMode){
    mode=data.mineMode==='max'?'max':Number(data.mineMode);
    for(const item of body.querySelectorAll('[data-mine-mode]'))item.setAttribute('aria-pressed',String(item===button));
    sound.play('select',{level:.55});paintPurchases();return;
   }
   if('treeJump'in data){view.tree.focus({preventScroll:true});view.tree.scrollIntoView({block:'start'});return}
   if('dismissAway'in data){away=null;paintAway()}
  };
  paintAway();
  if(next)setWallet(next);else paintTree();
 }
 function leave(){
  clearTimeout(gainTimer);tapTotal=0;coinPulse?.cancel();coinPulse=null;
  cancelAnimationFrame(branchFrame);branchFrame=0;
  resize?.disconnect();root=null;view=null;
 }
 return {show,leave,setWallet,setCoins,reportAway};
}
