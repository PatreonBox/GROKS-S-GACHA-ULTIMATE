import {kingdomHouses,kingdomRating,visitorSlots} from '../web/kingdom-rules.js';

import {kingdomCreators} from './kingdom-creator-catalog.mjs';
import {visitorEligible} from '../web/kingdom-visitor-catalog.js';

const visitWindow=300_000;
function hash(value){
 let result=2166136261;
 for(const char of value)result=Math.imul(result^char.charCodeAt(0),16777619);
 return result>>>0;
}

function firstArrival(seed,slot,start){
 for(let cycle=0;cycle<=5;cycle++){
  const key=seed+':'+slot+':'+cycle;
  if((slot===0&&cycle===0)||cycle===5||hash(key)%100<55)
   return start+cycle*visitWindow+60_000+hash(key+':time')%120_001;
 }
}

function arrivalSchedule(wallet,now,newEligibility){
 const houses=kingdomHouses(wallet),prior=wallet.kingdom?.visitorSchedule;
 const schedule=prior?.slice()??[],stars=kingdomRating(houses,now);
 const residences=houses.toSorted((a,b)=>(a.builtAt||0)-(b.builtAt||0));
 const seed=residences[0]?.id||'kingdom';
 for(const spec of visitorSlots){
  const {slot,stars:required}=spec;
  const eligible=visitorEligible(spec,stars,wallet.kingdom?.earnedStars||0);
  const known=schedule[slot];
  // A completed arrival remains in the save even if a house is later stored.
  if(known!=null&&(known<=now||eligible))continue;
  if(!eligible){
   if(known!=null)schedule[slot]=null;
   continue;
  }
  if(prior||newEligibility||spec.earnedStars&&stars<(spec.legacyStars??Infinity)){schedule[slot]=firstArrival(seed,slot,now);continue;}
  // Carry over arrivals from the old visiting windows for existing Kingdoms.
  const home=residences[Math.min(residences.length-1,Math.ceil((spec.legacyStars??required)/.30-1e-6)-1)];
  schedule[slot]=home.builtAt?firstArrival(seed,slot,home.builtAt):0;
 }
 return schedule;
}

export function settleKingdomVisitors(wallet,now,newEligibility=false){
 if(wallet.kingdom)wallet.kingdom.visitorSchedule=arrivalSchedule(wallet,now,newEligibility);
}

export function kingdomVisitors(wallet,now=Date.now()){
 const schedule=arrivalSchedule(wallet,now,false),visitors=[];
 let nextAt=null;
 for(const {slot} of visitorSlots){
  const arrivedAt=schedule[slot];
  if(arrivedAt==null)continue;
  if(arrivedAt>now){
   if(nextAt===null||arrivedAt<nextAt)nextAt=arrivedAt;
   continue;
  }
  visitors.push({...kingdomCreators[slot],slot,skillBonus:visitorSlots[slot].skillBonus,arrivedAt,visiting:true});
 }
 return {discoveredVisitors:visitors,visitorRefreshAt:nextAt};
}

export const discoveredVisitors=(wallet,now)=>kingdomVisitors(wallet,now).discoveredVisitors;
