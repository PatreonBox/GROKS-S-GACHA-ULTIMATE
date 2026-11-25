import {cardGrowth} from './card-growth.js';
import {schoolArt} from './combat-arts.js';
import {levelMoves} from './level-moves.js';
import {levelSignatures,bonusSignatures} from './signature-rules.js';
import {drillSprites} from './drill-sprites.js';

export const schools={
 shatter:{name:'Breaker',basic:'Saw Cut',signature:'Blade Mill',color:'#ff995d',text:'Shreds shields for 30% extra damage.'},
 lance:{name:'Piercer',basic:'Spike Jab',signature:'Prism Lance',color:'#8ddfff',text:'Deals 40% extra damage to a marked target.'},
 siphon:{name:'Medic',basic:'Life Tap',signature:'Vital Circuit',color:'#ff8daf',text:'Heals the most injured ally for 34% of damage dealt.'},
 chain:{name:'Conductor',basic:'Arc Bolt',signature:'Chain Lightning',color:'#ffdc6b',text:'Arcs to another standing enemy for 45% damage.'},
 ward:{name:'Warden',basic:'Shield Bash',signature:'Portal Aegis',color:'#85f1cc',text:'Shields the most injured ally for 52% of ATK.'},
 rupture:{name:'Tracker',basic:'Fault Spike',signature:'Faultline',color:'#ff8179',text:'Marks its target. The next direct hit gains 25% damage.'},
 surge:{name:'Wave rider',basic:'Wave Dash',signature:'Crest Break',color:'#77e1ff',text:'Hits targets above 70% HP for 30% more damage.'},
 vortex:{name:'Controller',basic:'Gravity Hook',signature:'Gravity Well',color:'#c3a0ff',text:'Weakens the target’s next attack by 35%.'}
};
const keys=Object.keys(schools);
const riders={
 interrupt:'Interrupts a charged cast when aimed at its caster.',
 ricochet:'Adds a hit on a second enemy for 42% of ATK.',
 repair:'Heals the most injured ally for 40% of ATK.',
 barrier:'Gives every standing ally a shield worth 18% of ATK.',
 expose:'Leaves the target marked for the next direct hit.',
 finisher:'Hits 45% harder below 40% target HP.',
 refund:'Restores one charge on use.',
 flurry:'Follows up with two hits at 23% of ATK each.',
 tidal:'Washes across every other standing enemy for 32% of ATK.',
 undertow:'Pulls in the weakest other enemy for 43% of ATK.',
 green:'65% of the shot’s damage bypasses shields.',
 bloom:'Splits a second shot into the strongest other enemy for 40% of ATK.',
 harvest:'The caster recovers 45% of ATK if this hit takes out the target.'
};
const riderKeys=['interrupt','ricochet','repair','barrier','expose','finisher','refund','flurry'];
const triggers={
 opening:'at full target HP',comeback:'below half caster HP',exposed:'against a marked target',
 finish:'against the last enemy',shielded:'while the caster has a shield',chase:'against a weakened target'
};
const triggerKeys=Object.keys(triggers);
export function hasOpening(trigger,caster,target,opponents){
 switch(trigger){
  case 'opening':return target.hp===target.maxHp;
  case 'comeback':return caster.hp<caster.maxHp*.5;
  case 'exposed':return !!target.marked;
  case 'finish':return opponents.filter(u=>u.hp>0).length===1;
  case 'shielded':return caster.shield>0;
  case 'chase':return !!target.weak;
  default:return false;
 }
}
const editions=new Map([
 [86407629,['Foam Cutter','Shorebreak','lance','surge','tidal']],
 [142896409,['Green Tracer','Verdant Railshot','rupture','lance','green']],
 [138781722,['Sickle Feint','Claim the Last Breath','rupture','lance','finisher']],
 [10565740,['Riot Saw','Crimson Transfusion','shatter','siphon','blood','Below half health the caster also recovers 55% of ATK.']],
 [86084399,['Key Trace','False Key','rupture','lance','key','Hit the announced caster to cancel its cast and recover one charge.']],
 [4284013,['Ring Driver','Ninth Ring','lance','rupture','rings','After marking, sends two more rings into the target for 36% of ATK each.']],
 [44062068,['Offbeat Step','99% Encore','surge','lance','encore','Hits 65% harder below 40% HP. A knockout restores two charge.']],
 [34085027,['Stinger','Honeycomb Grid','lance','ward','hive','Shields the whole squad and weakens the target.']],
 [89886591,['Eye Contact','Unblinking Eye','rupture','vortex','watch','Marks the target and interrupts it if it is preparing a charged cast.']],
 [13519,['Sleep Needle','Lights Out','siphon','vortex','night','An already weakened target loses its next attack.']],
 [6508283,['Pixel Skip','Checkpoint Restore','chain','ward','checkpoint','Restores 14% max HP to the most injured ally and recovers one charge.']],
 [3979721,['Mini Wave','Core Collapse','surge','shatter','collapse','Sends a shockwave to the other enemies. Breaking a shield doubles the wave.']]
]);
const alternateEditions = new Map([
 [86407629,['vortex','undertow']],
 [142896409,['chain','bloom']],
 [138781722,['siphon','harvest']]
]);
const artKits={
 wave:['surge','chain','undertow'],bullet:['rupture','lance','ricochet'],scythe:['rupture','lance','finisher'],
 crystal:['rupture','shatter','expose'],saw:['surge','shatter','flurry'],eye:['rupture','vortex','watch'],
 shield:['shatter','ward','barrier'],pulse:['chain','surge','refund'],portal:['ward','vortex','interrupt'],
 storm:['lance','chain','ricochet'],magma:['shatter','surge','collapse'],lunar:['lance','vortex','undertow'],
 thorns:['lance','rupture','rings'],gear:['shatter','chain','ricochet'],comet:['surge','lance','bloom'],
 abyss:['rupture','vortex','night'],echo:['surge','chain','flurry'],halo:['siphon','ward','repair'],
 prism:['lance','rupture','expose'],meteor:['surge','shatter','collapse']
};
const artDetails={
 watch:'Interrupts the enemy’s charged cast when you hit its caster.',
 collapse:'Hits every other enemy for 26% of ATK, doubled if the primary target was shielded.',
 rings:'Follows up with two hits at 36% of ATK each.',
 night:'Cancels this target’s attack if it was already weakened.'
};
const forms=[
 ['Mill','shatter'],['Lance','lance'],['Circuit','siphon'],['Arc','chain'],['Aegis','ward'],
 ['Fault','rupture'],['Crest','surge'],['Well','vortex'],
 ['Crossfire','lance','Hits all other enemies for 18% of ATK.'],
 ['Backline','rupture','Hits the strongest other enemy for 32% of ATK.']
];
const augments=[
 ['Finisher','finisher',.98],['Counter','interrupt',.99],['Reserve','refund',.76],
 ['Bastion','barrier',.88],['Twin','flurry',.74]
];
const formCount=forms.length*augments.length;
export const techniqueStyles=['Standard','Quickdraw','Overdrive','Comeback'];
const styles=[
 {power:1,cost:2,wait:0,rule:''},
 {power:.74,cost:1,wait:2,rule:'Costs less charge and takes two extra turns to cool down.'},
 {power:1.24,cost:3,wait:1,rule:'Weakens a surviving target’s next attack by at least 20%.'},
 {power:.90,cost:2,wait:0,rule:'Below half HP, deals 28% more damage and heals the caster for 18% of damage dealt.'}
];
const bonusStart=formCount*styles.length+2;

export const execution={id:138781722,threshold:20,name:'Kill Steal',rule:'After your squad leaves a target below 20% HP, KILLSTEALER finishes it and takes kill credit.'};

export function validTechnique(unit,choice){
 if(!Number.isInteger(choice)||choice<0||choice>=bonusStart+bonusSignatures.length)return false;
 return choice!==1||levelMoves.has(Number(unit.id??unit[0]));
}

function withLevelSignature(kit,native){
 if(!native)return kit;
 if(native.legacy)return {...kit,native};
 return {...kit,native,signatureName:native.name,signatureArt:native.art,
  signature:native.school||kit.signature,cost:native.cost||2,cooldown:native.cooldown||5,
  power:native.power,trigger:null,rider:null,detail:native.detail};
}

function hash(id){let n=Number(id)>>>0;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return (n^(n>>>15))>>>0}
export function skillsFor(u,choice=0){
 const id=Number(u.id??u[0]),level=u.name??u[1],h=hash(id),authored=levelMoves.get(id);
 const art=authored?.[1];
 const named=editions.get(id)||(authored&&[...authored[0].slice(0,2),...artKits[art]]);
 const first=keys[h%8],second=keys[(h%8+1+((h>>>4)%7))%8];
 const [basicName,signatureName,basic,signature,rider,detail]=named||[level+' · '+schools[first].basic,level+' · '+schools[second].signature,first,second,riderKeys[(h>>>11)%8]];
 const cost=named?2:1+((h>>>17)%2),cooldown=named?5:4+((h>>>20)%4);
 const trigger=named?null:triggerKeys[(h>>>13)%triggerKeys.length];
 const tuning=h/0x100000000*.009;
 const kit={card:id,basic,signature,basicName,signatureName,rider,cost,cooldown,trigger,basicPower:tuning+.82+((h>>>8)%19)/100,
  basicArt:art||schoolArt[basic],signatureArt:art||schoolArt[signature],
  power:tuning+(cost===2?1.46:1.11)+((h>>>21)%25)/100,
  detail:detail||(riders[rider]||artDetails[rider])+(trigger?' +20% damage '+triggers[trigger]+'.':''),seed:h};
 if(!choice||!validTechnique(u,choice))return withLevelSignature(kit,levelSignatures.get(id));
 if(choice>=bonusStart)return {...withLevelSignature(kit,bonusSignatures[choice-bonusStart]),group:'Bonus moves'};
 if(choice===1){
  const [school,extra]=alternateEditions.get(id)||[second,riderKeys[(h>>>24)%8]];
  return {...kit,signature:school,signatureArt:alternateEditions.has(id)?art:schoolArt[school],
   signatureName:authored[0][2],rider:extra,power:1.31+tuning,detail:riders[extra],cooldown:4};
 }
 const styleIndex=Math.floor((choice-2)/formCount),style=styles[styleIndex];
 const index=(choice-2)%formCount,formIndex=Math.floor(index/augments.length);
 const [form,school,formDetail]=forms[formIndex], [augment,extra,scale]=augments[index%augments.length];
 const extraArt=formIndex===8?'comet':formIndex===9?'meteor':schoolArt[school];
 return {...kit,signature:school,signatureName:level+' · '+form+' '+augment+(styleIndex?' · '+techniqueStyles[styleIndex]:''),
  signatureArt:extraArt,form:formIndex===8?'crossfire':formIndex===9?'backline':null,
  rider:extra,power:(1.48+tuning+(h%11)/100)*scale*style.power*(formDetail?.88:1),
  cost:style.cost,cooldown:(extra==='refund'?5:4)+style.wait,trigger:null,
  group:form,style:styleIndex,detail:[formDetail,riders[extra],style.rule].filter(Boolean).join(' ')};
}

export function techniquesFor(u){
 const choices=Array.from({length:bonusStart+bonusSignatures.length},(_,i)=>i).filter(i=>validTechnique(u,i));
 return choices.map(choice=>({choice,...skillsFor(u,choice)}));
}

export function mirroredSkill(kit,target){
 if(!kit.native?.copy||!target)return null;
 const other=skillsFor(target);
 return other.native?.copy?null:other;
}

export function signatureDetail(kit){
 return kit.native&&!kit.native.legacy?kit.detail:technique(kit,kit.signature).text+' '+kit.detail;
}
const strengths={shatter:30,lance:40,siphon:34,chain:45,ward:52,rupture:25,surge:30,vortex:35};
export function technique(kit,school){
 const preset=editions.has(kit.card),base=strengths[school];
 const percent=preset?base:base+((kit.seed>>>(school===kit.signature?6:15))%23)-11;
 const descriptions={
  shatter:'Breaks the target’s shield and deals '+percent+'% extra damage.',
  lance:'Deals '+percent+'% extra damage when consuming a mark.',
  siphon:'Heals the most injured ally for '+percent+'% of damage dealt.',
  chain:'Arcs to a second enemy for '+percent+'% of damage dealt.',
  ward:'Shields the most injured ally for '+percent+'% of ATK.',
  rupture:'Marks the target. Its next direct hit takes '+percent+'% extra damage.',
  surge:'Hits targets above 70% HP for '+percent+'% more damage.',
  vortex:'Weakens the target’s next attack by '+percent+'%.'
 };
 return {mult:percent/100,text:descriptions[school]};
}
export const signatureCost=(b,kit)=>b.remix===3979721&&b.kills>=2?1:kit.cost;
export const remainingCooldown=(unit,b)=>Math.max(0,(unit.readyAt||0)-b.seq);
export const legacyDrillCap=24;
const drillCaps={Auto:2,Easy:3,Normal:5,Hard:10,Harder:15,Insane:20,
 'Easy Demon':25,'Medium Demon':32,'Hard Demon':40,'Insane Demon':45,'Extreme Demon':50,Impossible:100};
const rankedDrillCaps=[[5,100],[20,80],[75,75],[150,70],[300,65],[600,60],[1000,55]];
export function trainingCapacity(card){
 const difficulty=card.difficulty??card[6],rank=Number(card.rank??card[10]);
 if(difficulty==='Extreme Demon'&&rank>0){
  const bracket=rankedDrillCaps.find(([upper])=>rank<=upper);
  if(bracket)return bracket[1];
 }
 return drillCaps[difficulty]??legacyDrillCap;
}
export const drillTypes={
 spike:{name:'Spike Forge',reward:'spike',unit:'spikes',color:'#ffb176',icon:drillSprites.spike,goal:'Charge the hammer and smash each spike wall as it enters range.'},
 saw:{name:'Saw Slalom',reward:'saw',unit:'saws',color:'#77dffd',icon:drillSprites.saw,goal:'Steer through the gates as speed climbs and the openings tighten.'},
 endurance:{name:'Portal Endurance',reward:'endurance',unit:'seconds',color:'#c2a4ff',icon:drillSprites.portals[2],goal:'Switch lanes and thread the open portals as the track speeds up.'}
};
export function trainingOf(record,capacity=legacyDrillCap){
 const legacy=record?.drillsVersion!==1,oldExtreme=legacy&&capacity>=50;
 const drills={drillsVersion:1};
 for(const kind of Object.keys(drillTypes)){
  const level=Math.max(0,Math.floor(Number(record?.[kind])||0));
  // Carry the old percentage of Extreme mastery into the wider rank-based range.
  drills[kind]=oldExtreme?Math.ceil(Math.min(level,legacyDrillCap)*capacity/legacyDrillCap):Math.min(level,capacity);
 }
 const {xp}=cardGrowth(record);
 if(xp)drills.xp=xp;
 return drills;
}
export function trainingLabel(t){return t.spike+' spike'+(t.spike===1?'':'s')+' · '+t.saw+' saw'+(t.saw===1?'':'s')+' · '+(t.endurance/10).toFixed(1)+'s durability'}
