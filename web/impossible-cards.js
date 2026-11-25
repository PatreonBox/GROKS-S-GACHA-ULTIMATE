export const impossibleCategory='Impossible';
export const impossibleCount=10;
export const impossibleTier=11;
export const impossiblePercent=.01;
export const impossibleGems=60;
const firstId=2100000001;

export function impossibleCover(id){
 const slot=Number(id)-firstId;
 return Number.isInteger(slot)&&slot>=0&&slot<impossibleCount
  ?'/assets/impossible/'+(slot+1)+'.avif':null;
}
