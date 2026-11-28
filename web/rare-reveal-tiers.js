export const rareTiers=[
 {n:5000,name:'First Light',effect:'slit',ink:'#9beaff',flare:'#147eef',hit:840,ms:2050},
 {n:20000,name:'Prism Break',effect:'prism',ink:'#e9b1ff',flare:'#9151ff',hit:1060,ms:2400},
 {n:100000,name:'Starfall',effect:'starfall',ink:'#ffe5ac',flare:'#ef6faa',hit:1390,ms:2840},
 {n:500000,name:'Eclipse',effect:'eclipse',ink:'#ffa6bb',flare:'#f42682',hit:2000,ms:3600},
 {n:1000000,name:'Singularity',effect:'singularity',ink:'#a9f3ff',flare:'#6d5dff',hit:2500,ms:4350},
 {n:10000000,name:'Event Horizon',effect:'horizon',ink:'#fff1b9',flare:'#7b69ff',hit:3140,ms:5440}
];

export const defaultRevealMinimum=rareTiers[0].effect;
export const validRevealMinimum=value=>value==='off'||rareTiers.some(tier=>tier.effect===value);

export function revealTier(percent,minimum=defaultRevealMinimum){
 if(minimum==='off'||!(percent>0&&Number.isFinite(percent)))return null;
 const floor=Math.max(0,rareTiers.findIndex(tier=>tier.effect===minimum));
 for(let i=rareTiers.length-1;i>=floor;i--)if(percent<=100/rareTiers[i].n)return rareTiers[i];
 return null;
}
