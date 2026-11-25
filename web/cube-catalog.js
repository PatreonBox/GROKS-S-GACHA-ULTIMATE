export const cubeRarities={
 Common:'#b6c9dc',Uncommon:'#6ff4ae',Rare:'#71c2ff',Epic:'#c19aff',Legendary:'#ffcd6a',Mythic:'#ff7bc9'
};

export const cubeCatalog=[
 ['01','Core Frame','Common',0,'#65f6e1'],
 ['02','Square One','Common',400,'#ffe683'],
 ['06','Crossbolt','Common',650,'#b1ff86'],
 ['13','Bone Block','Common',850,'#cfebff'],
 ['27','Shard Grid','Uncommon',1600,'#64ffc4'],
 ['39','Iron Grin','Uncommon',2400,'#ffbb80'],
 ['90','Jelly Chomp','Uncommon',4200,'#f993ef'],
 ['22','Star Circuit','Rare',12000,'#bdb5ff'],
 ['31','Singularity','Rare',18000,'#69ddff'],
 ['56','Glitch Mask','Rare',32000,'#ddff6e'],
 ['75','Broken Gear','Rare',55000,'#ffd397'],
 ['199','Sky Knot','Epic',135000,'#70b5ff'],
 ['217','Circuit Sentinel','Epic',280000,'#ff9774'],
 ['134','Shatterstorm','Epic',450000,'#d3a2ff'],
 ['321','Side Eye','Epic',650000,'#81ffe3'],
 ['305','Tempest Core','Legendary',2200000,'#ffde76'],
 ['402','Solar Orrery','Legendary',5500000,'#ffbc5b'],
 ['170','Void Maw','Mythic',18000000,'#ff779c'],
 ['462','Lunar Scarab','Mythic',42000000,'#b9a3ff'],
 ['classic','Classic','Mythic',100000000,'#58edf6']
].map(([id,name,rarity,price,color])=>({id,name,rarity,price,color,
 icon:id==='classic'?'/assets/player-cube.png':'/assets/cubes/'+id+'.webp'}));

const cubesById=new Map(cubeCatalog.map(cube=>[cube.id,cube]));
export const starterCube=cubeCatalog[0];
export const cubeCatalogVersion=1;
export function ownsCube(wallet,id){
 const legacyStarter=id==='classic'&&wallet&&!wallet.cubeCatalogVersion;
 return id===starterCube.id||!!legacyStarter||!!wallet?.ownedCubes?.includes(id);
}
export function equippedCube(wallet){
 const saved=cubesById.get(wallet?.equippedCube);
 return saved&&ownsCube(wallet,saved.id)?saved:starterCube;
}

export function claimCube(wallet,id){
 const cube=cubesById.get(id);
 if(!cube)throw Error('Choose a cube in the catalog.');
 if(!ownsCube(wallet,id)){
  if(wallet.coins<cube.price)throw Error('You need more coins for '+cube.name+'.');
  wallet.coins-=cube.price;
  wallet.ownedCubes=[...(wallet.ownedCubes||[]),id];
 }
 wallet.equippedCube=id;
 return cube;
}
