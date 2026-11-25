import {mainListMoves,extraLevelMoves,bonusMoves,classicCampaignMoves,previousBossMoves} from './main-list-moves.js';

const enemyLabels={
 target:'the target',allOthers:'all other enemies',allEnemies:'every enemy',neighbors:'enemies beside the target',
 next:'the next standing enemy',strongestOther:'the strongest other enemy',highestHpOther:'the other enemy with the most HP',
 lowestOther:'the most injured other enemy',markedOthers:'other marked enemies',
 shieldedOthers:'other shielded enemies',weakOthers:'other weakened enemies'
};
const allyLabels={
 self:'the caster',hurtAlly:'the most injured ally',otherHurtAlly:'the most injured teammate',
 allAllies:'every standing ally',sideAllies:'allies beside the caster'
};
const conditionLabels={
 marked:'the target was marked',shielded:'the target had a shield',full:'the target was at full HP',
 half:'the target started below half HP',selfHalf:'the caster was below half HP',
 charging:'the target was charging',knockout:'the opening hit scores a knockout'
};
const percent=amount=>Math.round(amount*100)+'%';

function effectText([kind,target,amount,condition]){
 const enemy=enemyLabels[target],ally=allyLabels[target],p=percent(amount);
 const label={
  hit:'Hits '+enemy+' for '+p+' ATK',
  mark:'Marks '+enemy+' for '+p+' extra damage from the next direct hit',
  weak:'Weakens '+enemy+' by '+p+' for their next attack',
  strip:'Removes '+p+' of remaining shields from '+enemy,
  lock:'Locks signatures for '+amount+(amount===1?' turn':' turns')+' on '+enemy,
  heal:'Heals '+ally+' for '+p+' ATK',
  mend:'Restores '+p+' of max HP to '+ally,
  drain:'Heals '+ally+' for '+p+' of the opening HP damage',
  shield:'Shields '+ally+' for '+p+' ATK',
  steal:'Steals up to '+p+' of the remaining shield from '+enemy,
  evade:amount===1?'Nullifies the next direct hit on '+ally:'Reduces the next direct hit on '+ally+' by '+p,
  fury:'Gives '+ally+' +'+p+' damage on their next attack',
  haste:'Shortens the signature cooldown of '+ally+' by '+amount+(amount===1?' turn':' turns'),
  stagger:'Staggers '+enemy+' for '+amount+' turns. Their next basic attack is skipped',
  purge:'Clears Mark and Weak from '+ally,
  charge:'Restores '+amount+' charge'
 }[kind];
 if(!condition)return label+'.';
 return 'If '+conditionLabels[condition]+', '+label[0].toLowerCase()+label.slice(1)+'.';
}
function profile([rank,id,name,art,pose,power,effects,opts={}]) {
 const fallback=' The mirror fallback hits for '+percent(power)+' ATK and marks all other enemies.';
 const detail=opts.copy?'Copies the target’s default signature at GRIEF’s ATK.'+fallback:
  'Hits the target for '+percent(power)+' ATK.'+
  (opts.pierce?' '+percent(opts.pierce)+' of the hit bypasses shields.':'')+
  (effects.length?' '+effects.map(effectText).join(' '):'')+
  (effects.some(([type])=>type==='lock')?' Locking an announced caster cancels its signature.':'');
 return {rank,id,name,art,pose,power,effects,detail,...opts};
}
export const levelSignatures=new Map([...mainListMoves,...extraLevelMoves].map(row=>[row[1],profile(row)]));
export const previousLevelSignatures=new Map(levelSignatures);
for(const [,id] of classicCampaignMoves)previousLevelSignatures.delete(id);
for(const row of previousBossMoves)previousLevelSignatures.set(row[1],profile(row));
export const bonusSignatures=bonusMoves.map(profile);

function leading(list,metric){
 let best=-1,score=-Infinity;
 for(const index of list){
  const n=metric(index);
  if(n>score){score=n;best=index}
 }
 return best<0?[]:[best];
}

// Recompute after each effect so a knockout redirects subsequent splashes to standing cards.
export function effectTargets(kind,units,origin){
 const standing=units.map((unit,i)=>unit.hp>0?i:-1).filter(i=>i>=0),other=standing.filter(i=>i!==origin);
 switch(kind){
  case 'target':case 'self':return standing.includes(origin)?[origin]:[];
  case 'neighbors':case 'sideAllies':return other.filter(i=>Math.abs(i-origin)===1);
  case 'allEnemies':case 'allAllies':return standing;
  case 'allOthers':return other;
  case 'next':return leading(other,i=>-((i-origin+units.length)%units.length));
  case 'strongestOther':return leading(other,i=>units[i].attack);
  case 'highestHpOther':return leading(other,i=>units[i].hp);
  case 'lowestOther':case 'otherHurtAlly':return leading(other,i=>-units[i].hp/units[i].maxHp);
  case 'hurtAlly':return leading(standing,i=>-units[i].hp/units[i].maxHp);
  case 'markedOthers':return other.filter(i=>units[i].marked);
  case 'shieldedOthers':return other.filter(i=>units[i].shield>0);
  case 'weakOthers':return other.filter(i=>units[i].weak);
  default:return [];
 }
}

export function castConditions(caster,victim,charging){
 return {
  marked:!!victim.marked,shielded:victim.shield>0,
  full:victim.hp===victim.maxHp,half:victim.hp*2<victim.maxHp,
  selfHalf:caster.hp*2<caster.maxHp,charging,knockout:false
 };
}

export const allyEffects=new Set(['heal','mend','drain','shield','purge','charge','evade','fury','haste']);
