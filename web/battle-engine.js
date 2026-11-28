import {addCardXP,cardGrowth} from './card-growth.js';
import {difficulties} from './pack-engine.js';
import {gameCommand} from './game-client.js';

import {stageFor,settleCampaignClear,campaignBounty} from './campaign.js';
import {impossibleCategory,impossibleCount} from './impossible-cards.js';
import {extremeStage} from './card-economy.js';
import {keyTarget} from './remixes.js';

import {skillsFor,technique,hasOpening,signatureCost,remainingCooldown,trainingOf,trainingCapacity,drillTypes,legacyDrillCap,execution,mirroredSkill} from './card-skills.js';
import {allyEffects,castConditions,effectTargets} from './signature-rules.js';
import {changeCoins} from './coin-economy.js';

export const arenas=[
 [4,20],[32,64],[120,200],[600,1000],[2000,3600],
 [4000,8000],[14000,26000],[30000,50000],[120000,200000],[400000,3200000]
];
export const combatStatsVersion=2;
export function arenaPlayerXp(battle){
 if(!battle)return 0;
 const {tier,kills,status,campaignReceipt}=battle;
 const knockouts=kills*(3+2*tier);
 if(status!=='won')return knockouts;
 const victory=campaignReceipt?.first?55+14*tier:22+7*tier;
 const mastery=campaignReceipt?.mastered?24+7*tier:0;
 return knockouts+victory+mastery;
}
const titles=['Runner','Striker','Sentinel'];
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
const directHits=new Set(['strike','pulse','retaliate']);
const nextBasicStaggered=(u,seq)=>(u.staggerUntil||0)>seq;

export function statsFor(row,progress,version=combatStatsVersion){
 const secret=row[6]===impossibleCategory,tier=secret?10:Math.max(0,difficulties.indexOf(row[6])),id=Number(row[0]),role=id%3;
 const rank=Number(row[10])||0;
 const drillCap=trainingCapacity(row),training=trainingOf(progress,drillCap);
 const secretStrength=secret?Math.max(0,(impossibleCount-rank)/(impossibleCount-1)):0;
 const stage=secret?{name:'Impossible',hp:330_000_000+24_000_000*secretStrength,legacyStrength:1}:tier===10?extremeStage(rank):null;
 const modern=version>=combatStatsVersion,ranked=modern&&stage;
 const grade=clamp((Number(row[11])||0)/36,0,1),base=420*2**tier*(1+.10*grade);
 const rawHp=Math.round(ranked?stage.hp:secret?660000+40000*secretStrength:stage?550000*stage.legacyStrength:base*[1,.97,1.07][role]);
 const rawAttack=Math.round(ranked?stage.hp*.34:secret?226000+18000*secretStrength:stage?188000*stage.legacyStrength:base*.32*[1,1.07,.96][role]);
 const hpCap=ranked?Math.round(stage.hp*1.65):stage?Math.round(5000000*stage.legacyStrength):modern&&tier===9?475000:Infinity;
 const attackCap=ranked?Math.round(rawAttack*1.65):stage?Math.round(3000000*stage.legacyStrength):modern&&tier===9?155000:Infinity;
 // Both attack disciplines contribute to Extreme mastery.
 const mastery=p=>p*(.15+.85*p);
 const hpGain=stage?Math.round((hpCap-rawHp)*mastery(training.endurance/drillCap)):
  training.endurance*Math.max(1,Math.round(rawHp*.012));
 const attackProgress=(4*training.spike+3*training.saw)/(7*drillCap);
 const attackGain=stage?Math.round((attackCap-rawAttack)*mastery(attackProgress)):
  training.spike*Math.max(1,Math.round(rawAttack*.010))+training.saw*Math.max(1,Math.round(rawAttack*.0075));
 const growth=cardGrowth(progress),trainedHp=Math.min(hpCap,rawHp+hpGain),trainedAttack=Math.min(attackCap,rawAttack+attackGain);
 const maxHp=Math.min(hpCap,Math.round(trainedHp*(1+growth.hpBonus)));
 const attack=Math.min(attackCap,Math.round(trainedAttack*(1+growth.attackBonus)));
 return {tier,maxHp,attack,level:growth.level,levelHp:maxHp-trainedHp,levelAttack:attack-trainedAttack,
  role:titles[role],recovery:60+24*tier,drillCap,training,hpGain:trainedHp-rawHp,attackGain:trainedAttack-rawAttack,
  ...(stage?{stage:stage.name,hpCap,attackCap}:{})};
}
function fighter(row,enemy,training){
 const stats=statsFor(row,training),maxHp=enemy?Math.round(stats.maxHp*.96):stats.maxHp;
 return {id:row[0],name:row[1],creator:row[2],stars:row[7],platformer:row[8]==='Platformer',difficulty:row[6],rank:row[10]||0,...stats,maxHp,hp:maxHp};
}
function active(list,from){
 for(let i=0;i<list.length;i++){
  const index=(from+i)%list.length;
  if(list[index].hp>0)return index;
 }
 return -1;
}
export function payout(tier,unit,random){
 const [low,high]=arenas[tier-1];
 const grade=tier===10?clamp(1-((unit.rank||1630)-1)/1630,0,1):clamp((unit.rewardGrade??.5),0,1);
 const share=tier===10?.95*grade**1.55+.05*random():.65*grade+.35*random();
 return clamp(Math.round(low+(high-low)*share),low,high);
}
export function makeBattle(rows,enemies,tier,random=Math.random,training={}){
 const opponents=enemies.map(r=>fighter(r,true));
 opponents.forEach((u,i)=>{
  const r=enemies[i],grade=Number(r[11]),withinStars=tier<=5?(r[7]===5||r[7]===7||r[7]===9?.8:.35):.5;
  u.rewardGrade=r[12]>0?.85+.15*(1-Math.min(1,r[12]/150)):clamp(withinStars*.55+((grade>0?grade/(tier>=6?35:10):.5)*.45),0,1);
  u.bounty=payout(tier,u,random);
 });
 return {id:crypto.randomUUID(),seq:0,tier,allies:rows.map(r=>fighter(r,false,training[r[0]])),enemies:opponents,
  economyVersion:2,turn:0,enemyTurn:0,charge:1,earned:0,kills:0,status:'active',events:[],log:[]};
}
function mostHurt(units,exclude=-1){
 let chosen=-1;
 units.forEach((u,i)=>{if(i!==exclude&&u.hp>0&&(chosen<0||u.hp/u.maxHp<units[chosen].hp/units[chosen].maxHp))chosen=i});
 return chosen;
}
function strongestOther(units,exclude){
 let chosen=-1;
 units.forEach((u,i)=>{if(i!==exclude&&u.hp>0&&(chosen<0||u.attack>units[chosen].attack))chosen=i});
 return chosen;
}
export function enemyIntent(b){
 const index=active(b.enemies,b.enemyTurn);
 if(index<0||b.status!=='active')return null;
 const caster=b.enemies[index],kit=skillsFor(caster);
 const opensWithCast=b.seq===0&&stageFor(b.campaign)?.openCast;
 const charged=(opensWithCast||b.seq%3===1||b.seq%5===4)&&remainingCooldown(caster,b)===0;
 const focus=charged||(b.tier>=4&&(b.tier>=8||b.seq%2===0));
 const aim=focus?mostHurt(b.allies):active(b.allies,(b.seq+index)%4);
 const staggered=!charged&&nextBasicStaggered(caster,b.seq+1);
 return {index,aim,charged,staggered,school:charged?kit.signature:kit.basic,art:charged?kit.signatureArt:kit.basicArt,
  name:staggered?'Staggered':charged?kit.signatureName:kit.basicName};
}
export function tacticDescription(b,unit){
 const choice=b.techniques?.[unit.id]||0,kit=skillsFor(unit,choice);
 return {kit,cost:signatureCost(b,kit),wait:remainingCooldown(unit,b)};
}
// A normal hit leaves a jump orb for a different teammate's signature.
export const linkOrbs={
 Runner:{name:'Pink orb',color:'#ff9ed8',rule:'Refunds one charge',school:'siphon'},
 Striker:{name:'Gold orb',color:'#ffdb81',rule:'Splashes the next enemy for 35% ATK',school:'chain'},
 Sentinel:{name:'Aqua orb',color:'#85efdf',rule:'Shields the threatened ally for 45% ATK',school:'ward'}
};
export function liveOrb(unit,seq){
 const orb=unit?.linkOrb;
 return orb&&unit.hp>0&&seq<orb.expires&&Object.hasOwn(linkOrbs,orb.role)?orb:null;
}
export function riposteBonus(charged){return charged?.60:.35}
export function liveRiposte(unit,seq){
 const riposte=unit?.riposte;
 return unit?.hp>0&&riposte&&seq<riposte.expires?riposte:null;
}

export function playTurn(wallet,id,seq,move,target,now=Date.now(),random=Math.random,requestedActor){
 const b=wallet.battle;
 if(!b||b.id!==id||b.seq!==seq||b.status!=='active')throw Error('This turn has already been resolved.');
 if(!['strike','pulse','guard','break','retreat'].includes(move))throw Error('Choose a battle action.');
 const actorIndex=requestedActor??b.turn,actor=b.allies[actorIndex];
 const swap=actorIndex!==b.turn;
 if(!actor?.hp||(swap&&(b.relayAt||0)>seq))throw Error('That teammate cannot relay this turn.');
 const intent=enemyIntent(b),foeTarget=b.enemies[target],{kit,cost,wait}=tacticDescription(b,actor),key=b.remix===86084399?keyTarget(b):-1;
 if(move!=='retreat'&&!foeTarget?.hp)throw Error('Choose a standing enemy.');
 if(move==='pulse'&&(wait||b.charge<cost))throw Error(wait?'That signature is cooling down.':'Build more charge first.');
 if(move==='break'&&(!intent.charged||target!==intent.index||b.charge<1))throw Error('Disrupt needs one charge and must target the charging enemy.');
 if(!b.economyVersion){for(const u of b.enemies)if(u.hp>0)u.bounty=clamp(Math.round(u.bounty*.4),...arenas[b.tier-1]);b.economyVersion=2}
 b.events=[];b.seq++;
 if(move==='retreat'){b.status='retreated';b.log.unshift('Squad withdrew with all earned bounties.');return b}
 if(swap)b.relayAt=seq+(stageFor(b.campaign)?.relay||3);
 let interrupted=false;
 const emit=(kind,side,index,amount,extra={})=>b.events.push({kind,side,index,amount,...extra});
 const notes=[];
 function damage(side,index,raw,extra){
  const u=b[side][index];if(!u?.hp)return 0;
  const attackingSide=side==='enemies'?'allies':'enemies';
  if(u.evade&&directHits.has(extra.kind)){
   const blocked=u.evade===1;
   raw*=1-u.evade;delete u.evade;
   emit('status',side,index,0,{name:blocked?'Damage nullified':'Dodged',cue:blocked?'ward':'dodge'});
  }
  const incoming=Math.max(0,Math.round(raw)),shieldable=Math.round(incoming*(1-(extra.pierce||0)));
  const absorbed=Math.min(u.shield||0,shieldable);
  u.shield=(u.shield||0)-absorbed;
  const amount=Math.min(u.hp,incoming-absorbed);u.hp-=amount;
  emit(extra.kind,side,index,amount,{...extra,absorbed,shield:u.shield});
  const source=b[attackingSide][extra.from],credit=source?{sourceId:source.id,sourceName:source.name}:{};
  if(!u.hp){
   if(side==='enemies'){
    const bounty=b.campaign?campaignBounty(u.bounty,false,b.campaignRewardVersion??1):u.bounty;
    b.kills++;b.earned+=bounty;changeCoins(wallet,bounty);
    if(source){
     b.takedowns??={};b.takedowns[source.id]=(b.takedowns[source.id]||0)+1;
    }
    emit('knockout',side,index,bounty,credit);
    notes.push((source?source.name+' knocked out '+u.name:u.name+' KO')+' · +'+bounty.toLocaleString('en-US')+' coins.');
   }else{
    wallet.injuries??={};wallet.injuries[u.id]=now+u.recovery*1000;emit('injury',side,index,u.recovery,credit);notes.push(u.name+' entered recovery.');
   }
  }else if(amount>0&&u.hp*100<u.maxHp*execution.threshold){
   const stealer=b[attackingSide].findIndex(card=>card.hp>0&&Number(card.id)===execution.id);
   if(stealer>=0){
    const finisher=b[attackingSide][stealer];
    notes.push(finisher.name+(source&&source!==finisher?' stole the takedown on ':' executed ')+u.name+'.');
    damage(side,index,u.hp,{kind:'execute',from:stealer,school:'rupture',art:'scythe',name:execution.name,
     seed:execution.id,signature:true,cinematic:'execute',pierce:1});
   }
  }
  return amount;
 }
 function restore(side,index,raw,kind){
  const u=b[side][index];if(!u?.hp)return;
  if(kind==='shield'){
   const past=u.shield||0;u.shield=Math.min(Math.round(u.maxHp*.32),past+Math.round(raw));
   if(u.shield>past)emit('shield',side,index,u.shield-past,{shield:u.shield});
  }else{
   const gain=Math.min(u.maxHp-u.hp,Math.round(raw));u.hp+=gain;if(gain||kind==='guard')emit(kind,side,index,gain);
  }
 }
 function resolveEffects(profile,{side,other,from,to,attack,dealt,conditions,splash,castKey}){
  for(const [kind,target,amount,condition] of profile.effects){
   if(condition&&!conditions[condition])continue;
   const friendly=allyEffects.has(kind),team=friendly?side:other;
   const targets=effectTargets(target,b[team],friendly?from:to);
   for(const index of targets){
    const u=b[team][index];
    const status=(name,extra)=>emit('status',team,index,0,{name,art:profile.art,castKey,...extra});
    switch(kind){
     case 'hit':splash(index,amount);break;
     case 'heal':restore(team,index,attack*amount,'heal');break;
     case 'mend':restore(team,index,u.maxHp*amount,'heal');break;
     case 'drain':restore(team,index,dealt*amount,'heal');break;
     case 'shield':restore(team,index,attack*amount,'shield');break;
     case 'evade':{
      u.evade=Math.max(u.evade||0,amount);
      status(u.evade===1?'Nullify ready':'Dodge ready',{cue:u.evade===1?'ward':'dodge'});
      break;
     }
     case 'fury':u.fury=Math.max(u.fury||0,amount);status('Attack boosted',{cue:'charged'});break;
     case 'haste':{
      if(!(u.readyAt>b.seq))break;
      const ready=Math.max(b.seq,u.sealedUntil||0,u.readyAt-amount);
      if(ready<u.readyAt){u.readyAt=ready;status('Cooldown advanced',{cue:'charged'})}
      break;
     }
     case 'stagger':
      u.staggerUntil=Math.max(u.staggerUntil||0,b.seq+amount);
      status('Staggered',{cue:'interrupt'});break;
     case 'purge':
      if(u.marked||u.weak){u.marked=false;u.markValue=0;u.weak=false;u.weakValue=0;status('Cleansed')}
      break;
     case 'mark':
      u.markValue=Math.max(amount,u.marked?u.markValue||.25:0);u.marked=true;
      status('Marked');break;
     case 'weak':
      u.weakValue=Math.max(amount,u.weak?u.weakValue||.35:0);u.weak=true;
      status('Weakened');break;
     case 'strip':
      if(u.shield>0){u.shield=Math.round(u.shield*(1-amount));status('Shield stripped',{shield:u.shield})}
      break;
     case 'steal':{
      const caster=b[side][from],room=Math.max(0,Math.round(caster.maxHp*.32)-(caster.shield||0));
      const transfer=Math.min(room,Math.round((u.shield||0)*amount));
      if(transfer){u.shield-=transfer;status('Shield stolen',{shield:u.shield});restore(side,from,transfer,'shield')}
      break;
     }
     case 'lock':
      u.sealedUntil=Math.max(u.sealedUntil||0,b.seq+amount);
      u.readyAt=Math.max(u.readyAt||0,b.seq+amount);
      if(team==='enemies'&&index===intent.index&&intent.charged)interrupted=true;
      status('Signature sealed');break;
     case 'charge':
      // Hostile cards regain cooldown rather than drawing from the player's charge.
      if(side==='allies'){
       const gain=Math.min(3-b.charge,amount);b.charge+=gain;if(gain)status('+'+gain+' charge');
      }else if(u.readyAt>b.seq)u.readyAt=Math.max(b.seq,u.sealedUntil||0,u.readyAt-amount);
      break;
    }
   }
  }
 }
 function cast(side,from,to,signature,scale){
  const allied=side==='allies',other=allied?'enemies':'allies';
  const caster=b[side][from],victim=b[other][to],equipped=allied?tacticDescription(b,caster).kit:skillsFor(caster);
  const borrowed=signature&&mirroredSkill(equipped,victim),ability=borrowed||equipped;
  const native=signature?ability.native:null,rules=native&&!native.legacy?native:null;
  const school=signature?ability.signature:ability.basic,art=signature?ability.signatureArt:ability.basicArt;
  const strength=technique(ability,school).mult;
  const rider=signature?ability.rider:null,label=signature?ability.signatureName:ability.basicName;
  const name=label.startsWith(caster.name+' · ')?label.slice(caster.name.length+3):label;
  const kind=allied?(signature?'pulse':'strike'):'retaliate';
  const cinematic=rider==='tidal'?'tidal':rider==='green'?'railshot':null;
  const style=signature?ability.style:0,reversing=style===3&&caster.hp*2<caster.maxHp;
  const castKey=b.events.length,startHp=victim.hp;
  const pierce=rider==='green'?.65:rules?.pierce||0;
  const fx={kind,from,school,art,name,signature,cinematic,tier:caster.tier,style,seed:ability.seed,castKey,pierce,
   ...(native?{pose:native.pose,visual:native.visual,signatureRank:native.rank,native:true}:{}),
   ...(borrowed?{copiedFrom:victim.name}:{})};
  const wasMarked=victim.marked,wasWeak=victim.weak,hadShield=victim.shield>0;
  const conditions=rules?castConditions(caster,victim,allied?intent.charged&&to===intent.index:move==='pulse'&&to===actorIndex):null;
  let power=caster.attack*(signature?ability.power:ability.basicPower)*scale*(.97+.06*random());
  const riposte=allied&&!signature&&liveRiposte(victim,seq);
  if(riposte){
   power*=1+riposte.boost;delete victim.riposte;fx.riposte=true;
   notes.push(caster.name+' countered '+victim.name+' with a riposte.');
  }
  if(reversing)power*=1.28;
  if(signature&&hasOpening(ability.trigger,caster,victim,b[other]))power*=1.20;
  if(caster.weak){power*=1-(caster.weakValue||.35);caster.weak=false;caster.weakValue=0}
  if(caster.fury){power*=1+caster.fury;delete caster.fury}
  if(wasMarked){power*=(1+(victim.markValue||.25))*(!rules&&school==='lance'?1+strength:1);victim.marked=false;victim.markValue=0}
  if(!rules&&school==='shatter'&&hadShield){victim.shield=0;power*=1+strength}
  if(!rules&&school==='surge'&&victim.hp/victim.maxHp>.70)power*=1+strength;
  if((rider==='finisher'||rider==='encore')&&victim.hp/victim.maxHp<.4)power*=rider==='encore'?1.65:1.45;
  notes.push(caster.name+(borrowed?' copied '+victim.name+'’s '+name:' used '+name+' on '+victim.name)+'.');
  const dealt=damage(other,to,power,fx),help=mostHurt(b[side]);
  const splash=(i,mult)=>damage(other,i,mult*caster.attack*scale,{...fx,kind:'follow',cinematic:null});
  if(rules){
   conditions.knockout=dealt>=startHp;
   resolveEffects(rules,{side,other,from,to,attack:caster.attack*scale,dealt,conditions,splash,castKey});
   return;
  }
  const adjacent=active(b[other],to+1);
  if(school==='chain'&&adjacent>=0&&adjacent!==to)splash(adjacent,dealt/Math.max(1,caster.attack*scale)*strength);
  if(school==='siphon')restore(side,help,dealt*strength,'heal');
  if(reversing)restore(side,from,dealt*.18,'heal');
  if(school==='ward')restore(side,help,caster.attack*strength,'shield');
  if(victim.hp){
   if(school==='rupture'||rider==='expose'||rider==='watch'){victim.marked=true;victim.markValue=school==='rupture'?strength:.25}
   if(school==='vortex'||rider==='hive'){victim.weak=true;victim.weakValue=school==='vortex'?strength:.35}
   if(style===2){victim.weakValue=Math.max(victim.weak?victim.weakValue||.35:0,.20);victim.weak=true}
  }
  if(rider==='repair')restore(side,help,caster.attack*.40,'heal');
  if(rider==='blood'&&caster.hp<caster.maxHp*.50)restore(side,from,caster.attack*.55,'heal');
  if(rider==='checkpoint')restore(side,help,b[side][help].maxHp*.14,'heal');
  if(rider==='hive'||rider==='barrier')b[side].forEach((_,i)=>restore(side,i,caster.attack*.18,'shield'));
  if(rider==='ricochet'&&adjacent>=0&&adjacent!==to)splash(adjacent,.42);
  if(rider==='tidal'||rider==='collapse')b[other].forEach((u,i)=>{if(i!==to&&u.hp)splash(i,rider==='tidal'?.32:hadShield?.52:.26)});
  if(rider==='undertow'){const weak=mostHurt(b[other],to);if(weak>=0)splash(weak,.43)}
  if(rider==='bloom'||(signature&&ability.form==='backline')){
   const strong=strongestOther(b[other],to);if(strong>=0)splash(strong,rider==='bloom'?.40:.32);
  }
  if(signature&&ability.form==='crossfire')b[other].forEach((u,i)=>{if(i!==to&&u.hp)splash(i,.18)});
  if(rider==='harvest'&&!victim.hp)restore(side,from,caster.attack*.45,'heal');
  if(rider==='flurry'||rider==='rings'){for(let n=0;n<2&&victim.hp;n++)splash(to,rider==='rings'?.36:.23)}
  if(allied&&(rider==='refund'||rider==='checkpoint'||(rider==='key'&&to===intent.index)))b.charge=Math.min(3,b.charge+1);
  if(allied&&rider==='encore'&&!victim.hp)b.charge=Math.min(3,b.charge+2);
  if(allied&&victim.hp&&to===intent.index&&((intent.charged&&['interrupt','watch'].includes(rider))||rider==='key'||(rider==='night'&&wasWeak)))interrupted=true;
  if(!allied&&victim.hp&&['key','interrupt','watch','night'].includes(rider))victim.weak=true;
 }
 if(move==='guard'){
  b.charge=Math.min(3,b.charge+1);
  const cover=b.allies[intent.aim];
  restore('allies',intent.aim,cover.maxHp*(b.remix===10565740?.22:.12),'guard');
  notes.push(actor.name+' covered '+cover.name+'.');
 }else if(move==='break'){
  b.charge--;interrupted=true;
  damage('enemies',target,actor.attack*.52,{kind:'strike',from:actorIndex,school:'shatter',art:'saw',name:'Disrupt',seed:kit.seed});
  if(foeTarget.hp){
   const expires=Math.max(foeTarget.sealedUntil||0,b.seq+3);
   foeTarget.sealedUntil=expires;foeTarget.readyAt=Math.max(foeTarget.readyAt||0,expires);
   emit('status','enemies',target,0,{name:'Signature sealed',art:'saw'});
   notes.push(foeTarget.name+'’s signature was sealed.');
  }
 }else{
  const special=move==='pulse',chargeGain=b.remix===34085027&&b.seq%2===0?2:1;
  b.charge=clamp(b.charge+(special?-cost:chargeGain)+(target===key?1:0),0,3);
  if(special)actor.readyAt=seq+kit.cooldown;
  const arenaPower=!special&&b.remix===4284013&&b.seq%3===0?1.35:special&&b.remix===44062068&&foeTarget.hp/foeTarget.maxHp<.30?2:1;
  const orb=liveOrb(foeTarget,seq);
  cast('allies',actorIndex,target,special,arenaPower);
  if(!special&&foeTarget.hp){
   foeTarget.linkOrb={owner:actor.id,role:actor.role,expires:b.seq+2};
  }else if(special&&orb&&orb.owner!==actor.id){
   delete foeTarget.linkOrb;
   const effect=linkOrbs[orb.role],extra={kind:'follow',from:actorIndex,school:effect.school,name:effect.name,link:true,seed:kit.seed};
   emit('link','enemies',target,0,{name:effect.name,school:effect.school});
   damage('enemies',target,actor.attack*.35,extra);
   if(orb.role==='Runner')b.charge=Math.min(3,b.charge+1);
   if(orb.role==='Sentinel')restore('allies',intent.aim,actor.attack*.45,'shield');
   if(orb.role==='Striker'){
    const neighbor=active(b.enemies,target+1);
    if(neighbor>=0&&neighbor!==target)damage('enemies',neighbor,actor.attack*.35,extra);
   }
   notes.push(actor.name+' linked the '+effect.name.toLowerCase()+'.');
  }
 }
 const caster=b.enemies[intent.index];
 if(b.enemies.every(u=>!u.hp)){
  b.status='won';
  const record={tier:b.tier,turns:b.seq,survivors:b.allies.filter(u=>u.hp>0).length};
  record.score=record.tier*100000+record.survivors*1000+Math.max(0,999-record.turns);
  if(!wallet.arenaBest||record.score>wallet.arenaBest.score)wallet.arenaBest=record;
  if(b.campaign)settleCampaignClear(wallet,b,record.survivors);
  if(b.remix){wallet.remixWins??={};wallet.remixWins[b.remix]=(wallet.remixWins[b.remix]||0)+1}
 }else{
  if(caster.hp){
   const sleep=b.remix===13519&&b.seq===1||b.remix===89886591&&b.seq%3===0;
   const stagger=!intent.charged&&nextBasicStaggered(caster,b.seq);
   if(interrupted||sleep){
    emit('interrupt','enemies',intent.index,0,{name:sleep?'Missed cast':'Cast interrupted'});notes.push(caster.name+' lost the cast.');
   }else if(stagger){
    delete caster.staggerUntil;
    emit('interrupt','enemies',intent.index,0,{name:'Staggered'});notes.push(caster.name+' staggered and missed its attack.');
   }else{
    if(intent.charged)caster.readyAt=seq+skillsFor(caster).cooldown;
    const pressure=.72+.039*b.tier;
    let scale=pressure*(move==='guard'?.29:1);
    if(b.remix===86407629&&b.seq%3===0)scale*=.5;
    cast('enemies',intent.index,intent.aim,intent.charged,scale);
    if(move==='guard'&&b.allies[intent.aim].hp){
     const boost=riposteBonus(intent.charged),previous=liveRiposte(caster,b.seq);
     caster.riposte={boost:Math.max(boost,previous?.boost||0),expires:b.seq+3};
     emit('status','enemies',intent.index,0,{name:'Riposte ready',art:'echo'});
     notes.push(caster.name+' is open to a riposte for three turns.');
    }
   }
  }else notes.push('The caster went down before it could attack.');
  b.enemyTurn=active(b.enemies,intent.index+1);
  const next=active(b.allies,actorIndex+1);
  if(next<0)b.status='lost';else b.turn=next;
 }
 b.log.unshift(notes.join(' '));b.log=b.log.slice(0,12);return b;
}

// Resolve a copy at the midpoint damage roll. The preview uses the same shields,
// riders, knockouts and enemy targeting as the committed turn.
export function forecastMove(b,move,target,actor){
 const preview={coins:0,battle:structuredClone(b)};
 playTurn(preview,b.id,b.seq,move,target,0,()=>.5,actor);
 const events=preview.battle.events;
 const damage=events.filter(e=>['strike','pulse','follow','retaliate','execute'].includes(e.kind));
 return {
  dealt:damage.filter(e=>e.side==='enemies').reduce((n,e)=>n+e.amount,0),
  incoming:damage.filter(e=>e.side==='allies').reduce((n,e)=>n+e.amount,0),
  knockouts:events.filter(e=>e.kind==='knockout').length,
  stopsCast:!events.some(e=>e.kind==='retaliate'),
  injuries:events.filter(e=>e.kind==='injury').length
 };
}

const walletFrom = async (action,args) => (await gameCommand(action,args)).wallet;
export const saveSquad = ids => walletFrom('arena.squad',{ids});
export const enterArena = (ids,tier,remixId=null,{campaign=false}={}) => walletFrom('arena.begin',{ids,tier,remixId,campaign});
export const battleAction = (id,seq,move,target,actor) => walletFrom('arena.move',{id,seq,move,target,actor});
export const equipTechnique = (id,seq,actor,choice) => walletFrom('arena.technique',{id,seq,actor,choice});
export const leaveResults = id => walletFrom('arena.leave',{id});
export const startDrill = async (id,kind) => (await gameCommand('drill.begin',{id,kind},null)).result;
export function grantTraining(w,token,score,now=Date.now(),capacity){
 const drill=w.drills?.[token];
 const maximum=drill?.endless?Math.max(0,Math.floor((now-drill.start)/450)+2):8;
 if(!drill||!Number.isSafeInteger(score)||score<0||score>maximum)throw Error('This training result has already closed or is invalid.');
 const {id,kind}=drill,cap=capacity??drill.capacity??legacyDrillCap;
 delete w.drills[token];w.training??={};
 const previous=w.training[id],current=trainingOf(previous,cap),gained=Math.min(cap-current[kind],Math.floor(score/2));
 current[kind]+=gained;
 const growth=addCardXP(current,score*6);
 w.training[id]={...current};
 // A rank change can temporarily lower the usable cap without erasing earned levels.
 if(previous?.drillsVersion===1)for(const key of Object.keys(drillTypes)){
  w.training[id][key]=Math.max(current[key],previous[key]||0);
 }
 w.trainingRevision=(w.trainingRevision||0)+1;
 const newBest=drill.endless&&score>(w.drillBest?.[id]?.[kind]||0);
 if(newBest){
  w.drillBest??={};w.drillBest[id]??={};w.drillBest[id][kind]=score;
 }
 return {id,kind,gained,growth,progress:current,newBest};
}
export const checkpointDrill = (token,proof) => gameCommand('drill.checkpoint',{token,proof},null);
export async function finishDrill(token,proof){
 const {wallet,result} = await gameCommand('drill.finish',{token,proof});
 return {wallet,...result};
}
export const startRemix = async(id,mode='normal') => (await gameCommand('remix.begin',{id,mode},null)).result;
export const checkpointRemix = (token,proof) => gameCommand('remix.checkpoint',{token,proof});
export const startLimboFinale = async(token,proof) => (await gameCommand('remix.finale',{token,proof},null)).result;
export const recordRemix = (token,proof) => gameCommand('remix.finish',{token,proof});
