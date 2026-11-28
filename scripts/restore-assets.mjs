import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';

function expandStarLists(bundle,root) {
 const additions=JSON.parse(readFileSync(new URL('star-list-additions.json',bundle),'utf8'));
 const seedFile=new URL('web/data/start.json',root);
 const seed=JSON.parse(readFileSync(seedFile,'utf8'));
 for(const [tier,extraRows] of Object.entries(additions)){
  const file=new URL('web/data/stars/'+tier+'.json',root);
  const rows=JSON.parse(readFileSync(file,'utf8'));
  const ids=new Set(rows.map(row=>row[0]));
  for(const row of extraRows){
   if(ids.has(row[0]))continue;
   rows.push(row);
   ids.add(row[0]);
  }
  seed.starCounts[tier]=rows.length;
  writeFileSync(file,JSON.stringify(rows));
 }
 writeFileSync(seedFile,JSON.stringify(seed));
}

export function restoreAssets(root) {
 const bundle=new URL('media/',root);
 const checksum=new URL('sha256.txt',bundle);
 if(!existsSync(checksum))return;
 const parts=readdirSync(bundle).filter(name=>/^part-[0-9]{2}$/.test(name)).sort();
 const archive=Buffer.concat(parts.map(name=>readFileSync(new URL(name,bundle))));
 const actual=createHash('sha256').update(archive).digest('hex');
 if(actual!==readFileSync(checksum,'utf8').trim())throw Error('The game asset bundle is incomplete or corrupted.');
 const restored=spawnSync('tar',['-xzf','-','--no-same-owner'],{cwd:root,input:archive,stdio:['pipe','inherit','inherit']});
 if(restored.error)throw restored.error;
 if(restored.status!==0)throw Error('The game asset bundle could not be extracted.');
 const demons=new URL('demons.json.gz',bundle);
 if(existsSync(demons))writeFileSync(new URL('web/data/demons.json',root),gunzipSync(readFileSync(demons)));
 expandStarLists(bundle,root);
}
