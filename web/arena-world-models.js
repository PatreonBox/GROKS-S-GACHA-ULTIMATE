// Tournament geometry is in arena layout units. The card faces remain above this mesh.
const chassis = '#122038';
const plate = '#222e49';
const metal = '#354562';
const enemy = {panel:'#30223d', cobalt:'#49284a', seam:'#6e3a5a', lit:'#ff9369'};
const ally = {panel:'#192f41', cobalt:'#20465e', seam:'#326581', lit:'#63ede8'};
const clamp = (n,lo,hi) => Math.max(lo,Math.min(n,hi));

function paintFrame(g,w,h,m,accent){
 const cx=w/2,cy=h/2;
 g.box(cx,cy,-75,w+2*m,h+2*m,13,'#0b1427');
 g.box(cx,cy,-62,w+1.6*m,h+1.5*m,18,chassis);
 // The illuminated inset catches the light between the hull and its upper shell.
 g.box(cx,cy,-51,w+2*m,h+2*m,3,'#42557b');
 g.box(cx,cy,-45,w+2.2*m,h+2*m,10,metal);
 g.box(cx,cy,-38,w+2*m,h+2*m,8,plate);
 g.box(cx,cy,-34,w+1.2*m,h+1.3*m,1,'#63728e');
 for(const y of [-m,h+m]){
  const trim=y<0?'#ab5775':'#49becd';
  g.beam([m,y,-46],[w-m,y,-46],2.4,trim,{light:1});
  g.beam([w*.20,y,-65],[w*.80,y,-65],1.5,accent,{light:.8});
  // Small fins break up the outline as it rotates.
  for(const x of [w*.12,w*.36,w*.64,w*.88]){
   g.box(x,y,-58,Math.min(21,w*.033),m+5,10,'#283b5a');
   g.box(x,y,-55,Math.min(18,w*.027),m+6,1.4,trim,{light:.82});
  }
 }
 for(const x of [-m,w+m]){
  g.beam([x,3,-45],[x,h-3,-45],2.6,'#5b7194',{light:.86});
  g.beam([x,8,-55],[x,h-8,-55],1.5,accent,{light:.7});
 }
}

function floorZone(g,w,first,last,c,columns){
 const depth=last-first;
 if(depth<8)return;
 const dx=(w-12)/columns,dy=depth/2;
 g.box(w/2,(first+last)/2,-31,w+2,depth,3,c.panel);
 for(let row=0;row<2;row++){
  for(let i=0;i<columns;i++){
   const x=6+(i+.5)*dx,y=first+(row+.5)*dy;
   g.box(x,y,-29.4,dx-2.4,dy-2.4,.75,(row+i)%3===0?c.cobalt:c.panel);
   const edge=x-dx*.42;
   // Engraved circuit runs stay understated underneath the card text.
   g.beam([edge,y-dy*.36,-28.9],[edge,y+dy*.19,-28.9],.95,c.seam);
   g.beam([edge,y+dy*.19,-28.9],[edge+dx*.15,y+dy*.36,-28.9],.95,c.seam);
  }
 }
}

function pod(g,s,m){
 if(s.w<4||s.h<4)return;
 const c=s.team==='enemies'?enemy:ally,edge=s.selected?c.lit:c.seam;
 const width=s.w+m,depth=s.h+m,half=width/2,front=s.y+depth/2;
 const {x,y}=s;
 g.box(x,y,-29,width,depth,7,metal);
 g.box(x,y,-26,width-1.5,depth-1.5,2,c.cobalt);
 g.box(x,y,-24.8,width-6,depth-5,.9,s.down?'#1b2034':'#172039');
 g.beam([x-half+4,front,-25.5],[x+half-4,front,-25.5],s.selected?2.6:1.25,edge,{light:.95});
 for(const d of [-1,1]){
  const side=x+d*(half-2),tip=front-5;
  g.beam([side,tip-depth*.22,-24],[side,tip,-24],s.selected?2:1.1,edge,{light:.92});
  g.box(side,tip,-23.5,2.1,4,1.6,edge,{light:.95});
 }
}

function paintTowers(g,w,h,m){
 const wide=clamp(w*.023,8,17);
 for(const x of [m*.33,w-m*.33]){
  for(const y of [m*.42,h*.5,h-m*.42]){
   const yShift=y===h*.5?0:y<h*.5?-2:2;
   const c=y<h*.5?enemy:ally;
   g.box(x,y,-46,wide+5,wide+8,29,'#172840');
   g.box(x,y+yShift,-34,wide+2,wide+4,10,metal);
   g.pyramid(x,y+yShift,-25.8,wide+1,wide+3,7.6,c.lit,{light:.83});
   g.beam([x,y+wide*.44,-46],[x,y+wide*.44,-32],1.9,c.lit,{light:.95});
  }
 }
}

function paintGate(g,w,y,half,accent,time){
 const cx=w/2,radius=Math.min(45,w*.105,half*.94);
 const cold=ally.lit,hot=enemy.lit;
 g.box(cx,y,-29.7,w+3,half*2-3,4,'#1c2541');
 for(const dy of [-half,half]){
  const tone=dy<0?'#653b65':'#285776';
  g.beam([6,y+dy,-29],[w-6,y+dy,-29],1.8,tone,{light:.95});
 }
 g.ring(cx,y,-28,radius+3,radius*.78,4,'#4c5680',{segments:8,yaw:Math.PI/8});
 g.ring(cx,y,-25.7,radius,radius*.90,1.3,accent,{light:.90,segments:8,yaw:Math.PI/8});
 for(const side of [-1,1]){
  const x=cx+side*radius;
  const start=w/2+side*w*.47;
  g.beam([x,y,-26],[start,y,-26],1.8,'#556689',{light:.89});
  for(let i=0;i<4;i++){
   const x1=x+(start-x)*(i+1)/5;
   const light=.70+.30*(Math.cos(time*2-i*.9)+1)/2;
   g.box(x1,y,-24.6,clamp(w*.014,4,10),2.2,1.2,accent,{light});
  }
  g.box(start,y,-25,5,8,1.6,side<0?cold:hot,{yaw:Math.PI/4,light:.94});
 }
}

export function paintArenaWorld(g,{width,height,tint='#a8c9ff',clock=0,slots=[],gateY}){
 if(!(width>0&&height>0))return;
 const m=clamp(width*.012,4,11),columns=width>=620?8:6;
 const back=slots.filter(s=>s.team==='enemies');
 const front=slots.filter(s=>s.team==='allies');
 const start=back.length?Math.max(...back.map(s=>s.y+s.h*.5)):height*.37;
 const end=front.length?Math.min(...front.map(s=>s.y-s.h*.5)):height*.63;
 const center=gateY??(start+end)*.5;
 const half=clamp(Math.min(center-start,end-center),Math.min(12,height*.10),Math.min(42,height*.16));
 const time=Number.isFinite(clock)?clock:0;
 paintFrame(g,width,height,m,tint);
 floorZone(g,width,-2,center-half,enemy,columns);
 floorZone(g,width,center+half,height+2,ally,columns);
 paintGate(g,width,center,half,tint,time);
 for(const slot of slots)pod(g,slot,m*.66);
 paintTowers(g,width,height,m);
}

