import {buildingFootprint,campfireKind,houseEntry,insideFootprint,towerFootprint,towerPlot} from '../web/kingdom-rules.js';

const steps=[[1,0],[-1,0],[0,1],[0,-1]];
const within=({x,z},box)=>x>=box.left&&x<=box.right&&z>=box.back&&z<=box.front;
const boxAround=(x,z,r)=>({left:x-r,right:x+r,back:z-r,front:z+r});
const padded=(box,n)=>({left:box.left-n,right:box.right+n,back:box.back-n,front:box.front+n});
const gridSize=.5;

export function kingdomNavigation(bounds,buildings,trees,construction){
 const walkable=padded(bounds,4);
 const left=Math.floor(walkable.left),back=Math.floor(walkable.back);
 const width=Math.ceil((walkable.right-left)/gridSize)+1,depth=Math.ceil((walkable.front-back)/gridSize)+1;
 const treeSpots=trees.filter(([x,z])=>within({x,z},walkable));
 const obstacles=[padded(towerFootprint,construction?1.04:.66),
  ...buildings.map(item=>buildingFootprint(item,.70)),...treeSpots.map(([x,z])=>boxAround(x,z,.77))];
 const position=index=>({x:left+index%width*gridSize,z:back+Math.floor(index/width)*gridSize});
 const passable=point=>within(point,walkable)&&!obstacles.some(box=>insideFootprint(point,box));
 const blocked=new Uint8Array(width*depth);
 for(let i=0;i<blocked.length;i++){
  const point=position(i);
  blocked[i]=Number(!passable(point));
 }
 function index(x,z){
  const column=Math.round((x-left)/gridSize),row=Math.round((z-back)/gridSize);
  return column>=0&&column<width&&row>=0&&row<depth?row*width+column:-1;
 }
 function nearest({x,z},owned=false){
  const tied=index(x,z);
  if(tied>=0&&!blocked[tied]&&(!owned||within(position(tied),bounds)))return tied;
  let closest=-1,distance=Infinity;
  for(let dz=-8;dz<=8;dz++)for(let dx=-8;dx<=8;dx++){
   const cell=index(x+dx*gridSize,z+dz*gridSize);
   if(cell<0||blocked[cell]||dx*dx+dz*dz>=distance)continue;
   if(owned&&!within(position(cell),bounds))continue;
   closest=cell;distance=dx*dx+dz*dz;
  }
  return closest;
 }
 function clear(a,b){
  const count=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)*6));
  for(let i=0;i<=count;i++){
   const t=i/count;
   if(!passable({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}))return false;
  }
  return true;
 }
 function route(start,target,owned=false){
  if(clear(start,target))return {recovery:null,points:[target]};
  const first=nearest(start,owned),last=nearest(target,owned);
  if(first<0||last<0)return null;
  const begin=position(first),end=position(last);
  const recovery=passable(start)?null:begin;
  const exactEnd=passable(target)&&clear(end,target);
  if(clear(recovery||start,end))return {recovery,points:exactEnd?[end,target]:[end]};
  const parent=new Int32Array(blocked.length).fill(-1),queue=new Int32Array(blocked.length);
  let head=0,tail=1;
  parent[first]=first;queue[0]=first;
  while(head<tail&&parent[last]===-1){
   const here=queue[head++],point=position(here);
   for(const [x,z] of steps){
    const next=index(point.x+x*gridSize,point.z+z*gridSize);
    if(next<0||blocked[next]||parent[next]!==-1)continue;
    if(owned&&!within(position(next),bounds)||!clear(point,position(next)))continue;
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
   if(!clear(origin,trail[lastVisible]))return null;
   origin=trail[lastVisible];points.push(origin);step=lastVisible+1;
  }
  if(exactEnd)points.push(target);
  return {recovery,points};
 }
 const targets={
  trail:[],
  meadow:[{x:bounds.left*.63,z:bounds.front*.73},{x:bounds.right*.73,z:bounds.back*.54},{x:bounds.right*.7,z:bounds.front*.72}],
  tower:[{x:towerPlot.x-2.8,z:2.6,look:towerPlot},{x:towerPlot.x+2.8,z:-1.6,look:towerPlot}],
  tree:treeSpots.map(([x,z])=>{
   const inward=Math.max(1,Math.hypot(x,z));
   return {x:x-x*1.65/inward,z:z-z*1.65/inward,look:{x,z}};
  }),
  housing:[],production:[],campfire:[]
 };
 for(const building of buildings){
  if(building.kind===campfireKind){
   for(let i=0;i<6;i++){
    const angle=i*Math.PI/3,point={x:building.x+2.35*Math.cos(angle),z:building.z+2.35*Math.sin(angle),look:building};
    if(passable(point))targets.campfire.push(point);
   }
   continue;
  }
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
 function spawnPoint(point){
  const index=nearest(point,true);
  if(index>=0)return position(index);
  const open=blocked.indexOf(0);
  return open>=0?position(open):point;
 }
 return {route,homeRoute,targets,clear,passable,spawnPoint};
}
