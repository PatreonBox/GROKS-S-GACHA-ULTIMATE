import {cubeCatalog,cubeRarities,equippedCube,ownsCube} from './cube-catalog.js';
import {gameCommand} from './game-client.js';
import {stat} from './card-economy.js';
import {formatCoins} from './coin-economy.js';

const coin='<img src="/assets/packs/coin.png" alt="">';
const cubeById=new Map(cubeCatalog.map(cube=>[cube.id,cube]));
export function createCubeShop({root,applyWallet,sound,announce}){
 let wallet,shown=false,ownedOnly=false,busy=false,signature;
 let renderer,loading=false,frame=0,unavailable=false;
 const portraits=new Map(),pending=new Set();
 const viewport=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  for(const {isIntersecting,target} of entries)if(isIntersecting){
   viewport.unobserve(target);
   if(root.contains(target))pending.add(target.dataset.cubePreview);
  }
  wake();
 },{rootMargin:'100px'}):null;

 function wake(){
  if(shown&&!frame&&!loading&&!unavailable&&pending.size)frame=requestAnimationFrame(drawPortrait);
 }
 async function drawPortrait(){
  frame=0;
  if(!shown||!pending.size)return;
  if(!renderer){
   loading=true;
   try{
    const {createCubePortraitRenderer}=await import('/kingdom-world.js');
    if(shown)renderer=createCubePortraitRenderer();
   }catch{unavailable=true}
   finally{loading=false;wake()}
   return;
  }
  const id=pending.values().next().value;
  pending.delete(id);
  if(!portraits.has(id)){
   let portrait;
   try{portrait=renderer.draw(cubeById.get(id))}catch{/* Keep the illustrated preview. */}
   if(portrait)portraits.set(id,portrait);
  }
  const portrait=portraits.get(id);
  if(portrait)for(const img of root.querySelectorAll('[data-cube-preview="'+id+'"]')){
   img.src=portrait;
   img.dataset.sculpt='';
  }
  wake();
 }
 function preview(cube,lazy=false){
  const src=portraits.get(cube.id);
  return '<img src="'+(src||cube.icon)+'" alt="" data-cube-preview="'+cube.id+'"'+(src?' data-sculpt':'')+
   (lazy?' loading="lazy"':'')+' decoding="async">';
 }
 function paint(){
  if(!shown)return;
  if(!wallet){root.innerHTML='<h1>Cube shop</h1><p>Loading your cubes…</p>';return}
  const equipped=equippedCube(wallet),owned=cubeCatalog.filter(c=>ownsCube(wallet,c.id));
  const list=ownedOnly?owned:cubeCatalog;
  const nextSignature=[equipped.id,owned.map(cube=>cube.id).join(','),wallet.coins,ownedOnly,busy].join('/');
  if(signature===nextSignature)return;
  signature=nextSignature;
  viewport?.disconnect();
  pending.clear();
  root.setAttribute('aria-busy',String(busy));
  const focused=root.contains(document.activeElement)?document.activeElement.dataset:null;
  root.innerHTML='<section class="cube-shop-hero" style="--cube:'+equipped.color+'">'+
   '<div><h2>Cube shop</h2><p>Pick your cube for your Kingdom, training, and the Meme Arcade.</p><div class="cube-shop-count">'+
   '<span>'+owned.length+' / '+cubeCatalog.length+' owned</span><span>'+coin+formatCoins(wallet.coins)+' coins</span></div></div>'+
   '<div class="cube-equipped">'+preview(equipped)+'<div><small>Equipped</small><strong>'+equipped.name+'</strong></div></div></section>'+
   '<div class="cube-catalog-head"><h2>Cube catalog</h2><div class="cube-filters" role="group" aria-label="Filter cubes"><button type="button" data-cube-filter="all" aria-pressed="'+!ownedOnly+'">All cubes</button><button type="button" data-cube-filter="owned" aria-pressed="'+ownedOnly+'">Owned</button></div></div>'+
   '<div class="cube-cards">'+list.map(cube=>{
    const active=equipped.id===cube.id,has=ownsCube(wallet,cube.id),affordable=wallet.coins>=cube.price;
    return '<article class="cube-card"'+(active?' data-equipped':'')+' style="--cube:'+cube.color+';--rarity:'+cubeRarities[cube.rarity]+'"><div class="cube-art">'+preview(cube,true)+'</div><div class="cube-card-copy"><span>'+cube.rarity+'</span><h3 tabindex="-1">'+cube.name+'</h3>'+
     '<button type="button" data-cube="'+cube.id+'" aria-label="'+(active?'Equipped '+cube.name:has?'Equip '+cube.name:'Buy and equip '+cube.name+' for '+cube.price.toLocaleString('en-US')+' coins')+'" '+(busy||active||!has&&!affordable?'disabled':'')+'>'+
     (active?'✓ Equipped':has?'Equip':coin+'<span>'+stat(cube.price)+'</span><em>'+(affordable?'Buy &amp; equip':'Need coins')+'</em>')+'</button></div></article>';
   }).join('')+'</div>';
  if(!unavailable){
   for(const img of root.querySelectorAll('[data-cube-preview]:not([data-sculpt])')){
    if(viewport)viewport.observe(img);
    else pending.add(img.dataset.cubePreview);
   }
   wake();
  }
  if(focused?.cubeFilter){
   root.querySelector('[data-cube-filter="'+focused.cubeFilter+'"]')?.focus({preventScroll:true});
  }else if(focused?.cube&&!busy){
   const button=root.querySelector('[data-cube="'+focused.cube+'"]');
   (button?.disabled?button.closest('article').querySelector('h3'):button)?.focus({preventScroll:true});
  }
 }
 root.onclick=async event=>{
  const button=event.target.closest('button');
  if(!button||!shown||busy)return;
  if(button.dataset.cubeFilter){ownedOnly=button.dataset.cubeFilter==='owned';paint();root.querySelector('[data-cube-filter][aria-pressed="true"]')?.focus({preventScroll:true});return}
  const id=button.dataset.cube;if(!id||button.disabled)return;
  const buying=!ownsCube(wallet,id);
  const restoreFocus=button===document.activeElement;
  busy=true;sound.unlock();paint();
  try{
   const {wallet:next,result:{cube}} = await gameCommand('cube.equip',{id});
   applyWallet(next);sound.play(buying?'buy':'select');announce(cube.name+(buying?' unlocked and equipped':' equipped'));
  }catch(error){announce(error.message)}
  finally{
   busy=false;paint();
   if(shown&&restoreFocus&&document.activeElement===document.body){
    const action=root.querySelector('[data-cube="'+id+'"]');
    (action?.disabled?action.closest('article').querySelector('h3'):action)?.focus({preventScroll:true});
   }
  }
 };
 return {show(on){
  root.hidden=!on;
  if(shown===on)return;
  shown=on;
  if(on){paint();return}
  viewport?.disconnect();
  pending.clear();signature=undefined;
  cancelAnimationFrame(frame);frame=0;
  renderer?.dispose();renderer=undefined;
 },setWallet(next){wallet=next;paint()}};
}
