// These transparent portraits are baked from the same one-sided sculptures used in the Kingdom.
export function arcadeCubePortrait(cube,onReady){
 const image=new Image();
 image.decoding='async';
 image.onload=onReady||null;
 image.onerror=()=>{
  image.onerror=null;
  image.src=cube.icon;
 };
 image.src='/arcade-cubes/'+encodeURIComponent(cube.id)+'.webp';
 return image;
}
