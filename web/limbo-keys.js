const keys=[0,1,2,3,4,5,6,7];
export const limboTrackSeconds=18.18;
export const limboApproachSeconds=6.4;
export const limboShuffleMs=[950,890,835,790,740,710,665,620,585,545,510,475,445,420,410,390];
export const limboRevealMs=Math.round((limboTrackSeconds-limboApproachSeconds)*1000)
 -limboShuffleMs.reduce((total,ms)=>total+ms,0);
export const limboChoiceAt=limboRevealMs+limboShuffleMs.reduce((total,ms)=>total+ms,0);

export function limboPattern(seed){
 let state=seed>>>0;
 const random=cap=>{
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  return Math.floor(state/4294967296*cap);
 };
 const starting=keys.slice();
 for(let i=7;i>0;i--){
  const j=random(i+1);
  [starting[i],starting[j]]=[starting[j],starting[i]];
 }
 const final=starting.slice(),swaps=[];
 for(let i=0;i<limboShuffleMs.length;i++){
  const green=final.indexOf(0);
  const a=i%3===1?green:random(8);
  const b=(a+1+random(7))%8;
  const rest=keys.filter(slot=>slot!==a&&slot!==b);
  const c=rest.splice(random(rest.length),1)[0],d=rest[random(rest.length)];
  [final[a],final[b]]=[final[b],final[a]];
  [final[c],final[d]]=[final[d],final[c]];
  swaps.push([[a,b],[c,d]]);
 }
 return {starting,swaps,answer:final.indexOf(0)};
}
