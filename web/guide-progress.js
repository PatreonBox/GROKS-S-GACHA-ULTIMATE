const viewed=new Set();
const storageKey=id=>'gdlb.guide.seen.'+id;

export function seenGuide(id){
 if(viewed.has(id))return true;
 try{return localStorage.getItem(storageKey(id))==='1'}catch{return false}
}
export function markGuide(id){
 viewed.add(id);
 try{localStorage.setItem(storageKey(id),'1')}catch{}
}

export const newAreas={training:'training-portals-1',remix:'meme-arcade-soundtracks-3',cubes:'cube-shop-1'};
export function newBadge(id){return seenGuide(id)?'':'<span class="feature-new">New</span>'}
