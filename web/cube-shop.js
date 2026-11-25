import {cubeCatalog,cubeRarities,equippedCube,ownsCube} from './cube-catalog.js';
import {gameCommand} from './game-client.js';
import {stat} from './card-economy.js';

const coin='<img src="/assets/packs/coin.png" alt="">';
export function createCubeShop({root,applyWallet,sound,announce}){
 let wallet,shown=false,ownedOnly=false,busy=false;
 function paint(){
  if(!shown)return;
  if(!wallet){root.innerHTML='<h1>Cube shop</h1><p>Loading your cubes…</p>';return}
  const equipped=equippedCube(wallet),owned=cubeCatalog.filter(c=>ownsCube(wallet,c.id));
  const list=ownedOnly?owned:cubeCatalog;
  root.innerHTML='<section class="cube-shop-hero" style="--cube:'+equipped.color+'">'+
   '<div><h2>Cube shop</h2><p>Pick your cube for your Kingdom, training, and the Meme Arcade.</p><div class="cube-shop-count">'+
   '<span>'+owned.length+' / '+cubeCatalog.length+' owned</span><span>'+coin+stat(wallet.coins)+' coins</span></div></div>'+
   '<div class="cube-equipped"><img src="'+equipped.icon+'" alt=""><div><small>Equipped</small><strong>'+equipped.name+'</strong></div></div></section>'+
   '<div class="cube-catalog-head"><h2>Cube catalog</h2><div class="cube-filters" role="group" aria-label="Filter cubes"><button type="button" data-cube-filter="all" aria-pressed="'+!ownedOnly+'">All cubes</button><button type="button" data-cube-filter="owned" aria-pressed="'+ownedOnly+'">Owned</button></div></div>'+
   '<div class="cube-cards">'+list.map(cube=>{
    const active=equipped.id===cube.id,has=ownsCube(wallet,cube.id),affordable=wallet.coins>=cube.price;
    return '<article class="cube-card"'+(active?' data-equipped':'')+' style="--cube:'+cube.color+';--rarity:'+cubeRarities[cube.rarity]+'"><div class="cube-art"><img src="'+cube.icon+'" alt="" loading="lazy"></div><div class="cube-card-copy"><span>'+cube.rarity+'</span><h3>'+cube.name+'</h3>'+
     '<button type="button" data-cube="'+cube.id+'" aria-label="'+(active?'Equipped '+cube.name:has?'Equip '+cube.name:'Buy and equip '+cube.name+' for '+cube.price.toLocaleString('en-US')+' coins')+'" '+(busy||active||!has&&!affordable?'disabled':'')+'>'+
     (active?'✓ Equipped':has?'Equip':coin+'<span>'+stat(cube.price)+'</span><em>'+(affordable?'Buy &amp; equip':'Need coins')+'</em>')+'</button></div></article>';
   }).join('')+'</div>';
 }
 root.onclick=async event=>{
  const button=event.target.closest('button');
  if(!button||!shown||busy)return;
  if(button.dataset.cubeFilter){ownedOnly=button.dataset.cubeFilter==='owned';paint();root.querySelector('[data-cube-filter][aria-pressed="true"]')?.focus({preventScroll:true});return}
  const id=button.dataset.cube;if(!id||button.disabled)return;
  const buying=!ownsCube(wallet,id);
  busy=true;sound.unlock();paint();
  try{
   const {wallet:next,result:{cube}} = await gameCommand('cube.equip',{id});
   applyWallet(next);sound.play(buying?'buy':'select');announce(cube.name+(buying?' unlocked and equipped':' equipped'));
  }catch(error){announce(error.message)}
  finally{busy=false;paint()}
 };
 return {show(on){shown=on;root.hidden=!on;if(on)paint()},setWallet(next){wallet=next;paint()}};
}
