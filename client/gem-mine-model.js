import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function diamondGeometry(){
 const points=[],colors=[],sides=8;
 const table=[],girdle=[];
 for(let i=0;i<sides;i++){
  const angle=(i+.5)*Math.PI*2/sides,x=Math.cos(angle),z=Math.sin(angle);
  table.push([x*.65,.43,z*.65]);girdle.push([x,.13,z]);
 }
 const palette=['#a0f6ff','#57dcff','#2eb9ff','#2391f3','#155adb'].map(hex=>new THREE.Color(hex));
 function face(a,b,c,shade){
  points.push(...a,...b,...c);
  for(let i=0;i<3;i++)palette[shade].toArray(colors,colors.length);
 }
 for(let i=0;i<sides;i++){
  const j=(i+1)%sides;
  face([0,.43,0],table[j],table[i],0);
  face(table[i],table[j],girdle[i],1+i%2);
  face(girdle[i],table[j],girdle[j],i%2);
  face(girdle[i],girdle[j],[0,-.85,0],2+i%3);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();
 return geometry;
}

export function makeGemMine(){
 const model=new THREE.Group(),parts=new Map(),matrix=new THREE.Object3D();
 const finish=(color,other={})=>new THREE.MeshStandardMaterial({color,roughness:.82,flatShading:true,...other});
 const slate=finish('#394958'),rock=finish('#596271'),basalt=finish('#3c414f');
 const timber=finish('#956137'),iron=finish('#6f8998',{metalness:.45});
 const gold=finish('#d9984f',{metalness:.35});
 const glow=finish('#ffdb91',{emissive:'#ff992e',emissiveIntensity:.85});
 const crystal=finish('#ffffff',{vertexColors:true,roughness:.29,metalness:.12,emissive:'#0d6099',emissiveIntensity:.42});
 const mouth=new THREE.MeshBasicMaterial({color:'#0d1423'});
 function piece(geometry,material,x,y,z,{sx=1,sy=1,sz=1,rx=0,ry=0,rz=0}={}){
  matrix.position.set(x,y,z);matrix.rotation.set(rx,ry,rz);matrix.scale.set(sx,sy,sz);matrix.updateMatrix();
  const baked=geometry.index?geometry.toNonIndexed():geometry;
  if(baked!==geometry)geometry.dispose();
  if(!parts.has(material))parts.set(material,[]);
  parts.get(material).push(baked.applyMatrix4(matrix.matrix));
 }
 const beam=(material,x,y,z,w,h,d,rz=0)=>piece(new THREE.BoxGeometry(w,h,d),material,x,y,z,{rz});
 piece(new THREE.CylinderGeometry(.98,1,.24,8),slate,0,-.065,0,{sx:2.04,sz:1.77});
 piece(new THREE.CylinderGeometry(.96,.98,.12,8),basalt,0,.075,0,{sx:2.04,sz:1.77});
 for(const [x,y,z,sx,sy,sz,ry] of [
  [-1.2,.80,-.31,.72,1.11,1.03,.25],[1.11,.89,-.43,.78,1.22,1.03,1.30],
  [-.36,.90,-.72,1.16,1.05,.87,1.03],[.46,1.43,-.62,1.12,.98,.81,2.20],
  [-.54,1.94,-.35,.98,.64,.84,1.65],[1.33,.40,.58,.52,.51,.52,.42],
  [-1.36,.47,.64,.51,.59,.43,2.40],[.14,2.12,-.48,.69,.61,.71,2.95]
 ])piece(new THREE.DodecahedronGeometry(1,0),y>.8?rock:basalt,x,y,z,{sx,sy,sz,ry});

 const entrance=new THREE.Shape();
 entrance.moveTo(-.93,.13);entrance.lineTo(.93,.13);entrance.lineTo(.73,1.78);
 entrance.lineTo(.48,2.02);entrance.lineTo(-.48,2.02);entrance.lineTo(-.73,1.78);entrance.closePath();
 piece(new THREE.ShapeGeometry(entrance),mouth,0,0,.77);
 for(const side of [-1,1]){
  beam(timber,side*.86,1.01,.87,.23,1.84,.34,side*.15);
  beam(iron,side*.98,.25,.89,.30,.20,.38);
  beam(timber,side*.60,1.78,.89,.17,.49,.30,-side*.77);
  beam(gold,side*.69,1.96,1.10,.14,.16,.04);
  beam(iron,side*.24,.205,1.06,.052,.058,1.35);
  beam(iron,side*.76,.38,1.29,.085,.38,.085);
  beam(glow,side*.76,.51,1.29,.125,.15,.13);
 }
 beam(timber,0,1.99,.87,1.69,.24,.40);
 beam(iron,0,2.00,1.093,.38,.17,.067);
 beam(glow,0,2.00,1.138,.17,.094,.028);
 for(const z of [.56,.83,1.10,1.37,1.62])beam(timber,0,.16,z,.81,.052,.11);

 // A blue diamond marks the shaft, with smaller finds in the ore cart.
 piece(diamondGeometry(),crystal,-.34,2.94,-.24,{sx:.72,sy:.94,sz:.72,rz:-.20,ry:.32});
 piece(diamondGeometry(),crystal,1.29,1.65,-.22,{sx:.31,sy:.68,sz:.31,rx:.25,rz:.44});
 piece(diamondGeometry(),crystal,1.55,1.31,-.30,{sx:.23,sy:.47,sz:.24,rz:-.36});
 piece(diamondGeometry(),crystal,-1.48,.64,.65,{sx:.22,sy:.48,sz:.22,rz:.28});
 beam(iron,.83,.32,1.34,.66,.17,.57);
 for(const side of [-1,1]){
  beam(iron,.83+side*.30,.48,1.34,.095,.24,.59,-side*.25);
  beam(iron,.83,.48,1.34+side*.27,.64,.24,.095);
  for(const z of [1.14,1.55])piece(new THREE.CylinderGeometry(.105,.105,.08,8),slate,.83+side*.34,.24,z,{rz:Math.PI/2});
 }
 piece(diamondGeometry(),crystal,.83,.55,1.37,{sx:.23,sy:.30,sz:.23,rz:-.31});
 for(const [material,geometries] of parts){
  const mesh=new THREE.Mesh(mergeGeometries(geometries),material);
  mesh.castShadow=material!==mouth;mesh.receiveShadow=true;model.add(mesh);
  for(const geometry of geometries)geometry.dispose();
 }
 return model;
}
