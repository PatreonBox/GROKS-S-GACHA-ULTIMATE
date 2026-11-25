import {drillSprites} from './drill-sprites.js';

// Move tiles in move-objects.webp, in reading order. The same palette lights the 3D meshes.
const artwork = [
 ['wave', '#6adfff', 194, 'wave'],
 ['bullet', '#9eff66', 107, 'projectile'],
 ['scythe', '#d79aff', 280, 'sweep'],
 ['crystal', '#f8a5ff', 291, 'shards'],
 ['saw', '#ffb86d', 32, 'gear'],
 ['eye', '#ff718b', 347, 'eye'],
 ['shield', '#85ffb9', 151, 'barrier'],
 ['pulse', '#8ef9ff', 178, 'pulse'],
 ['portal', '#ffdb82', 39, 'portal'],
 ['storm', '#9bbdff', 220, 'storm'],
 ['magma', '#ff8f69', 11, 'shards'],
 ['lunar', '#c7cdff', 241, 'sweep'],
 ['thorns', '#c6f477', 82, 'thorns'],
 ['gear', '#f3ac75', 28, 'gear'],
 ['comet', '#85e2ff', 201, 'projectile'],
 ['abyss', '#b29aff', 256, 'portal'],
 ['echo', '#f7a4d6', 325, 'pulse'],
 ['halo', '#ffe496', 47, 'barrier'],
 ['prism', '#a3eaff', 184, 'shards'],
 ['meteor', '#bbff79', 95, 'thorns']
];

export const moveArts = Object.fromEntries(artwork.map(([id,color,hue,shape],tile)=>[
 id,{color,hue,shape,tile}
]));
export const orbSprites=Array.from({length:6},(_,i)=>'/assets/battle/orbits/orb-'+i+'.webp');
moveArts.orb={color:'#ffcf76',hue:43,shape:'portal',src:orbSprites[1]};
moveArts.blood={...moveArts.scythe,color:'#ff6d8d',hue:347};
moveArts.chalk={...moveArts.echo,color:'#fff0da',hue:43};
moveArts.saw.src=drillSprites.saw;
moveArts.thorns.src=drillSprites.spike;
moveArts.portal.src=drillSprites.portals[1];
export const schoolArt = {
 shatter:'saw',lance:'prism',siphon:'eye',chain:'storm',
 ward:'shield',rupture:'thorns',surge:'wave',vortex:'abyss'
};

export function moveArt(id){
 const {tile,src}=moveArts[id]||moveArts.prism;
 if(src)return '<span class="move-art sprite-art" aria-hidden="true" style="--move-sprite:url('+src+')"></span>';
 const x=tile%5*25,y=Math.floor(tile/5)*100/3;
 return '<span class="move-art" aria-hidden="true" style="--art-x:'+x+'%;--art-y:'+y+'%"></span>';
}
