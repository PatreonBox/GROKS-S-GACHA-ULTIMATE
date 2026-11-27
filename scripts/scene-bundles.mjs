import {build} from 'esbuild';
import {relative,resolve,sep} from 'node:path';

export async function sceneBundles(minify=false){
 const outdir=resolve('dist/scenes');
 const bundle=await build({
  entryPoints:{'kingdom-world':'client/kingdom-world.js','rare-reveal-world':'client/rare-reveal-world.js','chest-reveal-world':'client/chest-reveal-world.js'},
  outdir,chunkNames:'chunks/[name]-[hash]',bundle:true,splitting:true,write:false,minify,format:'esm',
  platform:'browser',target:'es2022',legalComments:'eof'
 });
 return new Map(bundle.outputFiles.map(({path,contents})=>['/'+relative(outdir,path).split(sep).join('/'),Buffer.from(contents)]));
}
