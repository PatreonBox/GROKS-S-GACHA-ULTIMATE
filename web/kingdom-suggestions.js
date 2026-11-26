import {buildingSpecs,forgePlan,forgeUpgrade,gemMine,housePlan} from './kingdom-rules.js';
import {towerPlayerLevel} from './level-access.js';
import {spikeKind,spikePlan,spikePrice} from './kingdom-defences.js';

const need=(value,goal,unit)=>({value,goal,unit});
const number=new Intl.NumberFormat('en-US');

export function kingdomSuggestions(plot,coins,playerLevel,now){
 const {houses,forges,gemMines,defences,storage,tower,land,houseLots}=plot,rows=[];
 const budget=(price,mana)=>[
  ...(price?[need(coins,price,'coins')]:[]),...(mana?[need(plot.mana,mana,'Mana')]:[])
 ];
 function add(id,title,action,requirements=[],site=null){
  const ready=!site&&requirements.every(step=>step.value>=step.goal);
  const progress=site?(now-site.startedAt)/Math.max(1,site.endsAt-site.startedAt):
   requirements.length?requirements.reduce((sum,step)=>sum+Math.min(1,step.value/step.goal),0)/requirements.length:1;
  rows.push({id,title,action,requirements,site,ready,progress:Math.min(1,Math.max(0,progress))});
 }
 function build(kind,price,mana=0){
  const item=storage.find(item=>item.kind===kind||kind==='house'&&!item.kind);
  const name=buildingSpecs[kind].name;
  if(item){add('restore:'+item.id,'Place '+name+' back',{kind,id:item.id,mode:'restore'});return;}
  add('build:'+kind,'Build '+(kind==='forge'?'a Mana Forge':name),{kind,mode:'new'},budget(price,mana));
 }
 const fillHousing=houses.length<tower.limit&&(houseLots<tower.limit||storage.some(item=>(item.kind||'house')==='house'));
 if(!houses.length&&fillHousing)build('house',plot.houseCost);
 if(!forges.length)build('forge',buildingSpecs.forge.price);
 if(houses.length&&fillHousing)build('house',plot.houseCost);
 if(tower.next){
  const target=tower.level+1,level=towerPlayerLevel(target);
  add('tower:'+target,'Upgrade tower to Lv. '+target,{object:'tower'},[
   need(playerLevel,level,'player level'),need(houses.length,tower.limit,'houses'),
   ...budget(tower.next.price,tower.next.mana)
  ],tower.construction);
 }
 if(tower.level>=gemMine.towerLevel&&!gemMines.length)build('gem-mine',gemMine.coins,gemMine.mana);
 const home=houses.find(item=>housePlan(item,now).construction)||houses.find(item=>housePlan(item,now).next);
 if(home){
  const {level,construction,next}=housePlan(home,now),target=level+1;
  add('house:'+home.id+':'+target,'Upgrade GD House to Lv. '+target,{object:'house:'+home.id},[
   ...(next.towerLevel?[need(tower.level,next.towerLevel,'tower level')]:[]),...budget(next.coins,next.mana)
  ],construction);
 }
 const forge=forges.find(item=>forgePlan(item,now).level===1);
 if(forge){
  add('forge:'+forge.id,'Upgrade Mana Forge to Lv. 2',{object:'forge:'+forge.id},[
   need(tower.level,forgeUpgrade.towerLevel,'tower level'),...budget(forgeUpgrade.coins,forgeUpgrade.mana)
  ],forgePlan(forge,now).construction);
 }
 if(!defences.length)build(spikeKind,spikePrice);
 const shooter=defences.find(item=>spikePlan(item,now).construction)||defences.find(item=>spikePlan(item,now).next);
 if(shooter){
  const {level,next,construction}=spikePlan(shooter,now),target=level+1;
  add('spike:'+shooter.id+':'+target,'Upgrade Spike Shooter to Lv. '+target,{object:spikeKind+':'+shooter.id},[
   need(tower.level,next.towerLevel,'tower level'),...budget(next.coins,next.mana)
  ],construction);
 }
 if(land.nextPrice!==null)add('land:'+land.level,'Expand your land',{mode:'expand'},budget(land.nextPrice));
 return rows;
}

export const recommendedKingdomUpgrade=rows=>rows.find(row=>row.site)||rows.find(row=>row.ready)||rows[0];

export function kingdomSuggestionStatus(row,now){
 if(row.site){
  const seconds=Math.max(0,Math.ceil((row.site.endsAt-now)/1000));
  return 'Under construction · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' left';
 }
 const missing=row.requirements.filter(step=>step.value<step.goal);
 return missing.length?missing.map(step=>number.format(Math.floor(step.value))+' / '+number.format(step.goal)+' '+step.unit).join(' · '):
  row.requirements.length?'Ready · '+row.requirements.filter(step=>step.unit==='coins'||step.unit==='Mana')
   .map(step=>number.format(step.goal)+' '+step.unit).join(' + '):'Ready to place';
}
