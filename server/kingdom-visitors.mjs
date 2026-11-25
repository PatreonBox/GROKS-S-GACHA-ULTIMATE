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

export function discoveredVisitors(wallet){
 const {stars}=kingdomStats(wallet);
 return visitorSlots.filter(slot=>stars>=slot.stars).map(({slot})=>{
  const [id,name,channel,audience,cube]=creators[slot];
  return {slot,id,name,channel,audience,cube};
 });
}
