import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

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
}
