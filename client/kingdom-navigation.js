import {buildingFootprint,houseEntry,insideFootprint,towerFootprint,towerPlot,trailCorners} from '../web/kingdom-rules.js';

const steps=[[1,0],[-1,0],[0,1],[0,-1]];
const within=({x,z},box)=>x>=box.left&&x<=box.right&&z>=box.back&&z<=box.front;
const boxAround=(x,z,r)=>({left:x-r,right:x+r,back:z-r,front:z+r});
const padded=(box,n)=>({left:box.left-n,right:box.right+n,back:box.back-n,front:box.front+n});

export function kingdomNavigation(bounds,buildings,trees,construction){
 const walkable=padded(bounds,4);
 const left=Math.floor(walkable.left),back=Math.floor(walkable.back);
 const width=Math.ceil(walkable.right)-left+1,depth=Math.ceil(walkable.front)-back+1;
 const treeSpots=trees.filter(([x,z])=>within({x,z},walkable));
 const obstacles=[padded(towerFootprint,construction?1.04:.66),
  ...buildings.map(item=>buildingFootprint(item,.70)),...treeSpots.map(([x,z])=>boxAround(x,z,.77))];
 const position=index=>({x:left+index%width,z:back+Math.floor(index/width)});
 const blocked=new Uint8Array(width*depth);
 for(let i=0;i<blocked.length;i++){
  const point=position(i);
  blocked[i]=Number(obstacles.some(box=>insideFootprint(point,box)));
 }
 function index(x,z){
  const column=Math.round(x)-left,row=Math.round(z)-back;
  return column>=0&&column<width&&row>=0&&row<depth?row*width+column:-1;
 }
 function nearest({x,z}){
  const tied=index(x,z);
  if(tied>=0&&!blocked[tied])return tied;
  let closest=-1,distance=Infinity;
  for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){
   const cell=index(x+dx,z+dz);
   if(cell<0||blocked[cell]||dx*dx+dz*dz>=distance)continue;
   closest=cell;distance=dx*dx+dz*dz;
  }
  return closest;
 }
 function clear(a,b){
  const count=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)*3));
  for(let i=0;i<=count;i++){
   const t=i/count,cell=index(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t);
   if(cell<0||blocked[cell])return false;
  }
  return true;
 }
 function route(start,target){
  const first=nearest(start),last=nearest(target);
  if(first<0||last<0)return null;
  const begin=position(first),end=position(last);
  const recovery=index(start.x,start.z)!==first?begin:null;
  if(clear(recovery||start,end))return {recovery,points:[end]};
  const parent=new Int32Array(blocked.length).fill(-1),queue=new Int32Array(blocked.length);
  let head=0,tail=1;
  parent[first]=first;queue[0]=first;
  while(head<tail&&parent[last]===-1){
   const here=queue[head++],point=position(here);
   for(const [x,z] of steps){
    const next=index(point.x+x,point.z+z);
    if(next<0||blocked[next]||parent[next]!==-1)continue;
    parent[next]=here;queue[tail++]=next;
   }
  }
  if(parent[last]===-1)return null;
  const trail=[];
  for(let cell=last;cell!==first;cell=parent[cell])trail.push(position(cell));
  trail.push(begin);trail.reverse();
  const points=[];
  let origin=recovery||start,step=0;
  while(step<trail.length){
   let lastVisible=trail.length-1;
   while(lastVisible>step&&!clear(origin,trail[lastVisible]))lastVisible--;
   origin=trail[lastVisible];points.push(origin);step=lastVisible+1;
  }
  return {recovery,points};
 }
 const targets={
  trail:trailCorners.map(([x,z])=>({x,z,look:{x:0,z:0}})),
  meadow:[{x:bounds.left*.63,z:bounds.front*.73},{x:bounds.right*.73,z:bounds.back*.54},{x:bounds.right*.7,z:bounds.front*.72}],
  tower:[{x:towerPlot.x-2.8,z:2.6,look:towerPlot},{x:towerPlot.x+2.8,z:-1.6,look:towerPlot}],
  tree:treeSpots.map(([x,z])=>{
   const inward=Math.max(1,Math.hypot(x,z));
   return {x:x-x*1.65/inward,z:z-z*1.65/inward,look:{x,z}};
  }),
  housing:[],production:[]
 };
 for(const building of buildings){
  const front=building.rotation*Math.PI/2,category=(building.kind||'house')==='house'?'housing':'production';
  const dx=Math.sin(front),dz=Math.cos(front);
  const at=distance=>({x:building.x+dx*distance,z:building.z+dz*distance});
  const approach={...at(2.55),look:building};
  if(category==='housing'){
   approach.home={id:building.id,dx,dz,approach:at(2.55),threshold:at(houseEntry.front),inside:at(-.24),building};
  }
  targets[category].push(approach);
 }
 function homeRoute(start,target){
  const path=route(start,target);
  if(!path)return null;
  const {building,approach,inside,dx,dz}=target.home;
  const end=path.points.at(-1);
  if((end.x-building.x)*dx+(end.z-building.z)*dz<1.90)return null;
  const extra=[padded(towerFootprint,construction?.97:.48),
   ...buildings.filter(item=>item!==building).map(item=>buildingFootprint(item,.52)),
   ...treeSpots.map(([x,z])=>boxAround(x,z,.64))];
  for(const [a,b] of [[end,approach],[approach,inside]]){
   for(let i=0;i<=12;i++){
    const t=i/12,point={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
   if(extra.some(box=>insideFootprint(point,box)))return null;
   }
  }
  path.points.push(approach);
  return path;
 }
 return {route,homeRoute,targets,clear};
}
