import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createCardPool,difficulties} from '../web/pack-engine.js';

export async function prepareDiscoveryIndex(root){
 const pool=createCardPool(path=>JSON.parse(readFileSync(new URL('web'+path,root),'utf8')));
 const lists=await Promise.all(difficulties.map(pool));
 const ids=lists.map(rows=>new Set(rows.map(([id])=>id)));
 const totals=Object.fromEntries(difficulties.map((difficulty,tier)=>[difficulty,ids[tier].size]));
 const entries=ids.flatMap((levels,tier)=>Array.from(levels,id=>[id,tier])).sort(([a],[b])=>a-b);
 const index=JSON.stringify(entries);
 const fingerprint=createHash('sha256').update(index).digest('hex').slice(0,16);
 writeFileSync(new URL('web/data/discovery-index.js',root),'export const discoveryTotals='+JSON.stringify(totals)+';\n');
 mkdirSync(new URL('dist/',root),{recursive:true});
 writeFileSync(new URL('dist/discovery-index.mjs',root),
  'export const discoveryIndexVersion='+JSON.stringify(fingerprint)+';\nexport const discoveryDifficulties=new Map('+index+');\n');
}
