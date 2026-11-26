const tau=Math.PI*2;
const initialBounds={left:-14,right:14,back:-13,front:14};
let state=2011;
const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
const woods=Array.from({length:56},(_,i)=>{
 const angle=i/56*tau+(random()-.5)*.21,dx=Math.cos(angle),dz=Math.sin(angle);
 const edge=Math.min((dx<0?-initialBounds.left:initialBounds.right)/Math.abs(dx),(dz<0?-initialBounds.back:initialBounds.front)/Math.abs(dz));
 const radius=edge+2.3+random()*23;
 return [dx*radius,dz*radius,2.7+random()*3.80,Math.floor(random()*4)];
});
woods.push(
 [-16,-5.1,5,0],[10,-15.1,5.3,1],[-11.9,-16,5.7,2],[16,-4.6,4.3,3],[16.3,6.4,3.9,0],[-16.4,8.8,4.45,1],
 [-11.8,-4.6,3.1,0],[11.9,2.3,3.5,1],[2.1,-10.8,4.1,2],[.9,11.7,2.9,3],[-10.9,10.8,5.7,0],[11.4,-10.7,6.2,2]
);
export const kingdomForest=woods.map(([x,z,height,shade],i)=>({
 id:'tree-'+(i+1),x,z,height,shade,radius:.29+height*.045,
 price:100*Math.max(1,Math.min(6,1+Math.round((height-3)*1.55)))
}));
export const treeWithin=(tree,box)=>tree.x>=box.left&&tree.x<=box.right&&tree.z>=box.back&&tree.z<=box.front;
