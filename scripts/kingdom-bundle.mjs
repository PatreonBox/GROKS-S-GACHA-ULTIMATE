import {build} from 'esbuild';

export async function kingdomBundle(minify=false){
 const bundle=await build({
  entryPoints:['client/kingdom-world.js'],bundle:true,write:false,minify,format:'esm',
  platform:'browser',target:'es2022',legalComments:'eof'
 });
 return Buffer.from(bundle.outputFiles[0].contents);
}
