const viewed=new Set();
const storageKey=id=>'gdlb.guide.seen.'+id;
let saveProgress;

export function setGuideProgress(ids,persist){
 viewed.clear();
 for(const id of ids||[])viewed.add(id);
 saveProgress=persist;
}

export function seenGuide(id){
 if(viewed.has(id))return true;
 if(saveProgress)return false;
 try{return localStorage.getItem(storageKey(id))==='1'}catch{return false}
}
export function markGuide(id){
 if(seenGuide(id))return;
 viewed.add(id);
 if(saveProgress){saveProgress(id);return;}
 try{localStorage.setItem(storageKey(id),'1')}catch{}
}

export const newAreas={training:'training-portals-1',remix:'meme-arcade-soundtracks-3',kingdom:'kingdom-starter-1'};
export function newBadge(id){return seenGuide(id)?'':'<span class="feature-new">New</span>'}
