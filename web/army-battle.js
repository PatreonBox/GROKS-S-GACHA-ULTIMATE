import {statsFor} from './battle-engine.js';
import {execution,hasOpening,mirroredSkill,skillsFor,technique} from './card-skills.js';
import {allyEffects,castConditions,effectTargets} from './signature-rules.js';
import {impossibleCategory} from './impossible-cards.js';
import {attackTiming} from './combat-scene.js';

export const armyLimit=10;
export const armySpeed=.8;
export const armyFrame=1/60;
export const armyMaps={
 harbor:{name:'Prism Harbor',backdrop:'ultraviolet-shoals',description:'Crystal causeway',depth:206},
 foundry:{name:'Ember Foundry',backdrop:'molten-circuit',description:'Obsidian forge',depth:168}
};
export const armyBackdrops={
 'ultraviolet-shoals':'Ultraviolet Shoals','molten-circuit':'Molten Circuit','blue-grid':'Classic Blue',
 'amethyst-cave':'Amethyst Cave','stormfall':'Stormfall','sunlit-surf':'Sunlit Surf','orbital-void':'Orbital Void',
 'golden-temple':'Golden Temple','purple-factory':'Purple Factory',
 'prism-harbor':'Crystal Skyline','ember-foundry':'Foundry Skyline'
};
const compactBackdrops=new Set(['prism-harbor','golden-temple','orbital-void','ultraviolet-shoals','ember-foundry','sunlit-surf']);
export const backdropSource=key=>'/assets/battle/army/'+key+(compactBackdrops.has(key)?'.avif':'.webp');
const limit=(value,low,high)=>Math.min(high,Math.max(low,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const ranged=new Set(['lance','chain','vortex','siphon']);
const meleeCards=new Set([4454123,11280109,138781722,10565740,148598469,61079355]);
const rangedCards=new Set([6508283,26618473,86407629,142896409,126242564]);
const contactArts=new Set(['scythe','saw','gear','lunar','thorns','magma']);
const unitStyle=(id,kit)=>meleeCards.has(id)||(!rangedCards.has(id)&&!ranged.has(kit.basic))?'Melee':'Ranged';
const casts=new Set(['interrupt','watch','key']);
const openings=new Set(['strike','slam','shot']);
const spawnX=388;

export function armyStats(row,training,kit=skillsFor(row)){
 const stats=statsFor(row,training),style=unitStyle(Number(row[0]),kit);
 const rank=Number(row[10])||0;
 const seed=row[6]===impossibleCategory?1.14:row[6]==='Extreme Demon'&&rank>0?(1+(rank-1)/365)**-1.32:0;
 // Trained stats use a compressed scale. High Extreme placements contribute an additional bonus.
 return {tier:stats.tier,role:stats.role,style,level:stats.level,
  maxHp:Math.round(160*(stats.maxHp/420)**.48*(style==='Melee'?1.18:1)*(1+.17*seed)),
  attack:Math.round(18*(stats.attack/134)**.48*(1+.25*seed))};
}

function fighter(card,side,index,map,count,random){
 const {row,training}=card,kit=skillsFor(row),stats=armyStats(row,training,kit),melee=stats.style==='Melee';
 const rowSize=count>5?Math.ceil(count/2):count;
 const rank=Math.floor(index/rowSize);
 const offset=index%rowSize-(Math.min(count-rank*rowSize,rowSize)-1)/2;
 return {id:Number(row[0]),name:row[1],difficulty:row[6],rank:stats.tier===10?Number(row[10])||0:0,...stats,kit,side,index,
  x:(spawnX+rank*78-(melee?38:0))*(side===0?-1:1),y:offset*(map.depth/2.45)+(rank?12:-12)*(side===0?1:-1),
  hp:stats.maxHp,shield:0,marked:false,weak:false,kills:0,downAt:0,vx:0,vy:0,lean:0,
  speed:(stats.role==='Runner'?155:stats.role==='Sentinel'?120:138)+(melee?24:0),
  reach:melee?66:198+(index%3)*9,next:random()*.22,
  ready:3.3+random()*1.3,locked:0,pending:null,hitAt:-1
 };
}

export function draftRivals(rows,count,tier,random=Math.random){
 // Spread through the ranked pool at low difficulties. Top Extreme matches favor the main list.
 const poolSize=Math.min(rows.length,tier===10?50:Math.max(240,Math.floor(rows.length*.7)));
 const sample=rows.slice(0,poolSize),rivals=[];
 while(rivals.length<count&&sample.length){
  const index=Math.floor(random()*sample.length);
  rivals.push({row:sample[index]});
  sample[index]=sample.at(-1);sample.pop();
 }
 return mixedSquad(rivals,rivals.length);
}

export function mixedSquad(cards,count){
 const squads={Melee:[],Ranged:[]};
 for(const card of cards)squads[unitStyle(Number(card.row[0]),skillsFor(card.row))].push(card);
 return Array.from({length:Math.min(cards.length,count)},(_,i)=>{
  const [first,second]=i%2?['Ranged','Melee']:['Melee','Ranged'];
  return squads[first].shift()||squads[second].shift();
 });
}

export function makeArmyBattle(players,rivals,key,tier,random=Math.random,{preview=false}={}){
 if((!players.length&&!preview)||!rivals.length||players.length>armyLimit||rivals.length>armyLimit)throw Error('Deploy between one and ten fighters per side.');
 const map=armyMaps[key]||armyMaps.harbor;
 return {map,tier,time:0,status:'fighting',teams:[players,rivals].map((team,side)=>
  team.map((card,index)=>fighter(card,side,index,map,team.length,random))),random};
}

function chooseTarget(unit,enemies,tier){
 let best=null,score=Infinity;
 for(const candidate of enemies){
  if(!candidate.hp)continue;
  const priority=distance(unit,candidate)*(1+(unit.side===1&&tier>=5?.32*(candidate.hp/candidate.maxHp):0));
  if(priority<score){score=priority;best=candidate}
 }
 return best;
}

function steer(unit,target,battle,dt){
 const gap=distance(unit,target);
 if(gap<1)return;
 const dx=(target.x-unit.x)/gap,dy=(target.y-unit.y)/gap,melee=unit.style==='Melee';
 const advance=gap>unit.reach;
 const retreat=!melee&&!advance&&gap<unit.reach*.56&&unit.next>battle.time+.12;
 const speed=unit.speed*(battle.time>24?1.14:1);
 const forward=advance?Math.min(gap-unit.reach*.91,speed*dt):retreat?-speed*.40*dt:0;
 const flank=advance?forward*.24*Math.sin(battle.time*2.8+unit.index*2.4):retreat?speed*.24*dt*(unit.index%2?1:-1):0;
 unit.x+=dx*forward-dy*flank;unit.y+=dy*forward+dx*flank;
}

function displace(unit,dt){
 unit.x+=unit.vx*dt;unit.y+=unit.vy*dt;
 const friction=Math.exp(-7*dt);
 unit.vx*=friction;unit.vy*=friction;
}
function lunge(cast,dt,time){
 if(!cast.event.melee||!cast.target.hp||time<cast.started+(cast.hit-cast.started)*.43)return;
 const {unit,target}=cast,gap=distance(unit,target);
 const step=Math.min(Math.max(0,gap-43),330*dt);
 if(!step)return;
 unit.x+=step*(target.x-unit.x)/gap;unit.y+=step*(target.y-unit.y)/gap;
}

function separate(units,map){
 for(let i=0;i<units.length;i++){
  const a=units[i];
  for(let j=i+1;j<units.length;j++){
   const b=units[j],d=distance(a,b),minimum=a.side===b.side?64:48;
   if(d>=minimum)continue;
   const push=(minimum-d)*.16,dx=d>.001?(a.x-b.x)/d:0,dy=d>.001?(a.y-b.y)/d:1;
   a.x+=dx*push;b.x-=dx*push;a.y+=dy*push;b.y-=dy*push;
  }
 }
 for(const unit of units){
  unit.x=limit(unit.x,-520,520);unit.y=limit(unit.y,-map.depth,map.depth);
 }
}

function plan(unit,target,battle,events){
 const signature=battle.time>=unit.ready&&battle.time>=unit.locked;
 const kit=signature?(mirroredSkill(unit.kit,target)||unit.kit):unit.kit;
 const native=signature?kit.native:null,rider=signature?kit.rider:null;
 const event={art:signature?kit.signatureArt:kit.basicArt,school:signature?kit.signature:kit.basic,
  name:signature?kit.signatureName:kit.basicName,signature,tier:unit.tier,seed:kit.seed+unit.index*997,
  cinematic:rider==='tidal'?'tidal':rider==='green'?'railshot':null,
  pose:native?.pose,visual:native?.visual,native:!!native,
  copiedFrom:kit!==unit.kit?target.name:null};
 event.melee=unit.style==='Melee'&&(!signature||contactArts.has(event.art)||native?.pose==='slam'||native?.pose==='sweep');
 const timing=attackTiming(event,false);
 const length=timing.duration/1000*(signature?.76:event.melee?.79:.72);
 const cast={unit,target,kit,event,started:battle.time,hit:battle.time+length*timing.at,length,timing};
 if(signature)unit.ready=battle.time+2.6+Math.max(4,kit.cooldown)*.50;
 unit.next=battle.time+length+(signature?.39:event.melee?.44:.60)+battle.random()*.23;
 unit.pending=cast;events.push({kind:'cast',cast});
}

function weaken(unit,amount){if(unit.hp){unit.weak=true;unit.weakValue=Math.max(unit.weakValue||0,amount)}}
function mark(unit,amount){if(unit.hp){unit.marked=true;unit.markValue=Math.max(unit.markValue||0,amount)}}
function seal(unit,amount,time){
 if(!unit.hp)return;
 unit.locked=Math.max(unit.locked,time+amount);
 if(unit.pending?.event.signature)unit.pending=null;
}
function shove(unit,target,force){
 const gap=distance(unit,target)||1,dx=(target.x-unit.x)/gap,dy=(target.y-unit.y)/gap;
 const push=force*(target.style==='Melee'?.78:1);
 target.vx=limit(target.vx+dx*push,-530,530);target.vy=limit(target.vy+dy*push,-410,410);
 target.lean=dx||1;
 return push;
}
function restore(unit,amount,shield,battle,events){
 if(!unit?.hp||amount<=0)return;
 const field=shield?'shield':'hp',before=unit[field];
 unit[field]=Math.min(shield?Math.round(unit.maxHp*.40):unit.maxHp,before+Math.max(1,Math.round(amount)));
 if(unit[field]>before)events.push({kind:shield?'shield':'heal',unit,amount:unit[field]-before});
}
function hit(unit,target,raw,pierce,battle,events,art,{impact='splash',cue,force=0}={}){
 if(!target.hp||raw<=0)return 0;
 if(target.evade&&openings.has(impact)){
  raw*=1-target.evade;force*=.55;delete target.evade;
  events.push({kind:'tactic',unit:target,name:'Dodge',cue:'armyEvade'});
 }
 const shield=Math.min(target.shield,Math.round(raw*(1-pierce)));
 target.shield-=shield;
 const amount=Math.min(target.hp,Math.max(0,Math.round(raw)-shield));
 target.hp-=amount;target.hitAt=battle.time;
 const push=force?shove(unit,target,force*(amount?1:.53)):0;
 events.push({kind:'hit',unit,target,amount,shield,art,impact,cue,force:push,x:target.x,y:target.y});
 if(!target.hp){
  target.downAt=battle.time;unit.kills++;events.push({kind:'ko',unit,target});
 }else if(impact!=='execute'&&amount&&target.hp*100<target.maxHp*execution.threshold){
  const thief=battle.teams[unit.side].find(ally=>ally.hp&&ally.id===execution.id);
  if(thief){
   events.push({kind:'execute',unit:thief,target,name:execution.name});
   hit(thief,target,Math.ceil(target.hp),1,battle,events,'scythe',{impact:'execute',force:420});
  }
 }
 return amount;
}

function resolve(cast,battle,events){
 const {unit,kit,event}=cast,allies=battle.teams[unit.side],foes=battle.teams[1-unit.side];
 const target=cast.target.hp?cast.target:null;
 if(!target)return;
 if(event.melee&&distance(unit,target)>106){
  events.push({kind:'miss',unit,target});return;
 }
 const {signature,school,art}=event,native=signature&&kit.native&&!kit.native.legacy?kit.native:null;
 const rider=signature?kit.rider:null,marked=target.marked,weak=target.weak,shielded=target.shield>0;
 const startHp=target.hp,conditions=castConditions(unit,target,!!target.pending?.event.signature);
 const strength=technique(kit,school).mult,pressure=1+Math.max(0,battle.time-27)*.056;
 const atk=unit.attack*pressure,care=unit.attack/pressure,time=battle.time;
 let power=atk*(signature?kit.power:kit.basicPower)*(.97+.06*battle.random());
 if(signature&&hasOpening(kit.trigger,unit,target,foes))power*=1.20;
 if(unit.weak){power*=1-unit.weakValue;unit.weak=false;unit.weakValue=0}
 if(unit.fury){power*=1+unit.fury;delete unit.fury}
 if(marked){power*=(1+target.markValue)*(!native&&school==='lance'?1+strength:1);target.marked=false;target.markValue=0}
 if(!native&&school==='shatter'&&shielded){target.shield=0;power*=1+strength}
 if(!native&&school==='surge'&&target.hp/target.maxHp>.70)power*=1+strength;
 if((rider==='finisher'||rider==='encore')&&target.hp/target.maxHp<.40)power*=rider==='encore'?1.65:1.45;
 const pierce=native?.pierce||(rider==='green'?.65:0);
 const impact=event.melee?(signature?'slam':'strike'):'shot';
 const force=event.cinematic==='tidal'?410:event.melee?(signature?390:250):signature?160:72;
 const dealt=hit(unit,target,power,pierce,battle,events,art,{impact,cue:cast.timing.impact||school,force});
 const targetIndex=target.index,allyTarget=key=>effectTargets(key,allies,unit.index).map(i=>allies[i]);
 const enemyTarget=key=>effectTargets(key,foes,targetIndex).map(i=>foes[i]);
 const splash=(other,mult)=>hit(unit,other,atk*mult,pierce,battle,events,art,{force:event.cinematic==='tidal'?270:signature?110:44});
 const help=allyTarget('hurtAlly')[0],heal=(friend,n)=>restore(friend,n,false,battle,events);
 const shield=(friend,n)=>restore(friend,n,true,battle,events);
 const recharge=(friend,n)=>{friend.ready=Math.max(time,friend.locked,friend.ready-n*.7)};
 const tag=(unit,name,cue)=>events.push({kind:'tactic',unit,name,cue});
 if(native){
  conditions.knockout=dealt>=startHp;
  for(const [kind,selector,amount,condition] of native.effects){
   if(condition&&!conditions[condition])continue;
   for(const victim of (allyEffects.has(kind)?allyTarget(selector):enemyTarget(selector))){
    switch(kind){
     case 'hit':splash(victim,amount);break;
     case 'heal':heal(victim,care*amount);break;
     case 'mend':heal(victim,victim.maxHp*amount/pressure);break;
     case 'drain':heal(victim,dealt*amount/pressure);break;
     case 'shield':shield(victim,care*amount);break;
     case 'evade':victim.evade=Math.max(victim.evade||0,amount);tag(victim,'Dodge ready','armyEvade');break;
     case 'fury':victim.fury=Math.max(victim.fury||0,amount);tag(victim,'Attack up','charged');break;
     case 'haste':{
      const before=victim.ready;recharge(victim,amount);
      if(victim.ready<before)tag(victim,'Cooldown advanced','charged');
      break;
     }
     case 'stagger':
      if(victim.pending&&!victim.pending.event.signature)victim.pending=null;
      victim.next=Math.max(victim.next,time+amount*.34);
      shove(unit,victim,215);tag(victim,'Stagger','armySlam');break;
     case 'purge':victim.weak=false;victim.marked=false;victim.markValue=0;victim.weakValue=0;break;
     case 'mark':mark(victim,amount);break;
     case 'weak':weaken(victim,amount);break;
     case 'strip':victim.shield=Math.round(victim.shield*(1-amount));break;
     case 'steal':{
      const transfer=Math.min(Math.max(0,Math.round(unit.maxHp*.40)-unit.shield),Math.round(victim.shield*amount));
      if(transfer){victim.shield-=transfer;shield(unit,transfer);tag(victim,'Shield stolen','stealCut')}
      break;
     }
     case 'lock':seal(victim,amount*.84,time);break;
     case 'charge':recharge(victim,amount);break;
    }
   }
  }
  return;
 }
 const next=enemyTarget('next')[0];
 if(school==='chain'&&next)splash(next,dealt/Math.max(1,atk)*strength);
 if(school==='siphon')heal(help,dealt*strength/pressure);
 if(school==='ward')shield(help,care*strength);
 if(school==='rupture'||rider==='expose'||rider==='watch')mark(target,school==='rupture'?strength:.25);
 if(school==='vortex'||rider==='hive')weaken(target,school==='vortex'?strength:.35);
 if(rider==='repair')heal(help,care*.40);
 if(rider==='blood'&&unit.hp<unit.maxHp/2)heal(unit,care*.55);
 if(rider==='checkpoint'&&help)heal(help,help.maxHp*.14/pressure);
 if(rider==='hive'||rider==='barrier')allies.forEach(friend=>shield(friend,care*.18));
 if(rider==='ricochet'&&next)splash(next,.42);
 if(rider==='tidal'||rider==='collapse')enemyTarget('allOthers').forEach(other=>splash(other,rider==='tidal'?.32:shielded?.52:.26));
 if(rider==='undertow')enemyTarget('lowestOther').forEach(other=>splash(other,.43));
 if(rider==='bloom')enemyTarget('strongestOther').forEach(other=>splash(other,.40));
 if(rider==='harvest'&&!target.hp)heal(unit,care*.45);
 if(rider==='rings'||rider==='flurry')for(let i=0;i<2&&target.hp;i++)splash(target,rider==='rings'?.36:.23);
 if(rider==='refund'||rider==='checkpoint'||rider==='key')recharge(unit,1);
 if(rider==='encore'&&!target.hp)recharge(unit,2);
 if(casts.has(rider)||rider==='night'&&weak)seal(target,1.1,time);
}

export function stepArmy(battle,dt){
 if(battle.status!=='fighting')return [];
 battle.time+=dt;
 battle.frames=(battle.frames||0)+1;
 const events=[],units=battle.teams.flat().filter(unit=>unit.hp);
 for(const unit of units){
  displace(unit,dt);
  if(unit.pending)lunge(unit.pending,dt,battle.time);
 }
 separate(units,battle.map);
 const pending=units.map(unit=>unit.pending).filter(cast=>cast&&cast.hit<=battle.time).sort((a,b)=>a.hit-b.hit);
 for(const cast of pending){
  if(!cast.unit.hp||cast.unit.pending!==cast)continue;
  cast.unit.pending=null;
  resolve(cast,battle,events);
 }
 const standing=units.filter(unit=>unit.hp);
 const teamCount=standing.filter(unit=>unit.side===0).length;
 if(!teamCount||teamCount===standing.length){
  battle.status=teamCount?'won':standing.length?'lost':'draw';
  events.push({kind:'result',status:battle.status});return events;
 }
 if(battle.time>=180){battle.status='draw';events.push({kind:'result',status:'draw'});return events}
 for(const unit of standing){
  if(unit.pending)continue;
  const target=chooseTarget(unit,battle.teams[1-unit.side],battle.tier);
  if(distance(unit,target)<=unit.reach&&battle.time>=unit.next)plan(unit,target,battle,events);
  else steer(unit,target,battle,dt);
 }
 separate(standing,battle.map);
 return events;
}
