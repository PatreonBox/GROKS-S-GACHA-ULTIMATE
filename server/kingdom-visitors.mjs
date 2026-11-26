import {kingdomStats,visitorSlots} from '../web/kingdom-rules.js';

// Names and skins are only sent to players whose Kingdom meets the slot's rating.
const creators=[
 ['gamer-vibes','Gamer Vibes','Gamer_vibes-p1r','215','06'],
 ['jfrozy','JFrozy Creator [GD]','JFrozyGD0','230','56'],
 ['unbreakable','Unbreakable','unbreakable5205','983','39'],
 ['trqp-kun','Trqp_kun','trqp_kun','1K','22'],
 ['flamewall','Flamewall','FlamewallGeometryDash','1.02K','90'],
 ['wootdog','Wootdog23','Wootdog23','4.7K','199'],
 ['jesse-gaming','JesseGaming GD','JesseGamingGD','5.08K','75'],
 ['bgram','BGram','BGram','31.5K','134'],
 ['quasar','Quasar','GDQuasar','35.5K','170'],
 ['serponge','Serponge','SerpongeDash','67.4K','402']
];

const visitWindow=300_000,visitLength=120_000;
function hash(value){
 let result=2166136261;
 for(const char of value)result=Math.imul(result^char.charCodeAt(0),16777619);
 return result>>>0;
}

export function kingdomVisitors(wallet,now=Date.now()){
 const {stars,houses}=kingdomStats(wallet,now);
 const residences=houses.toSorted((a,b)=>(a.builtAt||0)-(b.builtAt||0));
 const seed=residences[0]?.id||'kingdom';
 const visitors=[];
 let nextAt=null;
 const schedule=at=>{if(at>now&&(nextAt===null||at<nextAt))nextAt=at;};
 for(const {slot,stars:required} of visitorSlots){
  if(stars<required)continue;
  const home=residences[Math.min(residences.length-1,Math.ceil(required/.30-1e-6)-1)];
  const origin=home?.builtAt||0,window=Math.max(0,Math.floor((now-origin)/visitWindow));
  const visit=cycle=>{
   const key=seed+':'+slot+':'+cycle;
   const arrival=origin+cycle*visitWindow+60_000+hash(key+':time')%120_001;
   return {arrival,leaves:arrival+visitLength,chosen:(slot===0&&cycle===0)||cycle===5||hash(key)%100<55};
  };
  // The initial streak discovers visitors eventually even if a later window is empty.
  const fixed=visit(window),upcoming=visit(window+1);
  if(fixed.chosen){schedule(fixed.arrival);schedule(fixed.leaves);}
  schedule(upcoming.chosen?upcoming.arrival:origin+(window+2)*visitWindow);
  const visiting=fixed.chosen&&now>=fixed.arrival&&now<fixed.leaves;
  let discovered=visiting||!home?.builtAt;
  for(let i=0;!discovered&&i<=Math.min(window,16);i++){
   const prior=visit(i);discovered=prior.chosen&&now>=prior.arrival;
  }
  if(!discovered)continue;
  const [id,name,channel,audience,cube]=creators[slot];
  visitors.push({slot,id,name,channel,audience,cube,visiting});
 }
 return {discoveredVisitors:visitors,visitorRefreshAt:nextAt};
}

export const discoveredVisitors=(wallet,now)=>kingdomVisitors(wallet,now).discoveredVisitors;
