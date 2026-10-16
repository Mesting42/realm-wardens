import * as THREE from 'three';
import {REGIONS} from './content.js';
import {distance} from './routes.js';
import {terrainObjects,buildCells} from './terrain.js';
import {part,beam,compact,treeModel,castleModel,material} from './models.js';
import {createTown,townPlan,castleFlag} from './town.js';
import {coatWithSnow} from './weather.js';

const textures=new Map();
const randomFor=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function groundMaterial(region){
  if(textures.has(region))return textures.get(region);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d'),random=randomFor(367+region);
  c.fillStyle=['#87a85f','#c9dedb','#716b62'][region];c.fillRect(0,0,512,512);
  for(let i=0;i<5500;i++){const x=random()*512,y=random()*512;c.globalAlpha=.07+random()*.12;c.fillStyle=i%2?['#c5ce83','#f9ffff','#b39579'][region]:['#466d43','#74999f','#433f41'][region];c.beginPath();c.ellipse(x,y,1+random()*10,1+random()*4,random()*6.28,0,6.28);c.fill();}
  c.globalAlpha=.34;for(let i=0;i<750;i++){const x=random()*512,y=random()*512;c.strokeStyle=['#52784b','#ffffff','#9a8170'][region];c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(x+2,y-3-random()*3);c.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(28,20);texture.anisotropy=4;
  const mat=new THREE.MeshStandardMaterial({map:texture,roughness:.97});textures.set(region,mat);return mat;
}
const portalVertex='varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const portalFragment=`varying vec2 vUv;uniform float time;uniform vec3 tint;
  void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float spiral=sin(a*5.+r*18.-time*3.6);float ripples=sin(r*29.-time*4.+spiral*2.);float edge=smoothstep(1.,.82,r);vec3 col=mix(vec3(.025,.035,.16),tint,(spiral*.5+.5)*.45+.18);col+=tint*pow(max(0.,ripples),4.)*.6;col+=tint*(1.-smoothstep(.05,.95,r))*.4;gl_FragColor=vec4(col,edge*.92);}`;
export function portalModel(region){
  const root=new THREE.Group(),stone=['#71776b','#7d9cac','#66555e'][region],color=['#71ddd2','#80dcff','#f99466'][region];
  part(root,'cylinder',stone,0,.18,0,1.22,.28,1.22);part(root,'torus',color,0,.35,0,1.08,1.08,1.08,[Math.PI/2,0,0],.5);
  const arch=part(root,'torus',stone,0,1.55,0,1.16,1.28,1.16);arch.scale.z=.8;
  part(root,'torus','#bda983',0,1.55,.04,1.02,1.13,1.02,null,.08);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;part(root,'box',stone,Math.sin(a)*1.14,1.55+Math.cos(a)*1.26,0,.34,.25,.38,[0,0,-a]);part(root,'gem',color,Math.sin(a)*1.11,1.55+Math.cos(a)*1.23,.23,.05,.105,.035,[0,0,-a],.75);}
  for(const x of [-1.25,1.25]){part(root,'taper',stone,x,.65,0,.22,1.14,.23);part(root,'gem',color,x,1.28,0,.13,.3,.13,null,.6);}
  compact(root);
  const geo=new THREE.CircleGeometry(1,64),mat=new THREE.ShaderMaterial({vertexShader:portalVertex,fragmentShader:portalFragment,uniforms:{time:{value:0},tint:{value:new THREE.Color(color)}},side:THREE.DoubleSide,transparent:true,depthWrite:false});
  const core=new THREE.Mesh(geo,mat);core.scale.set(1,1.12,1);core.position.set(0,1.55,.07);core.userData.ownedGeometry=true;core.userData.ownedMaterial=true;root.add(core);root.userData.core=core;
  return root;
}
export function obstacleModel(o,region){
  const root=new THREE.Group(),stone=['#8e957b','#8da9b2','#6d6061'][region],gold='#d4b477';
  part(root,'cylinder',['#5f7c49','#a6c3c4','#5e5552'][region],0,.06,0,.83,.13,.83);
  if(o.kind==='tree'){
    const t=treeModel(region,o.variant);t.scale.setScalar(o.scale);root.add(t);
    for(let i=0;i<5;i++){const a=i*1.25;beam(root,'#6f5a3b',[0,.12,0],[Math.sin(a)*.58,.08,Math.cos(a)*.58],.06);}
    for(const x of [-.51,.51]){part(root,'cylinder','#dbccb0',x,.18,.4,.04,.23,.04);part(root,'sphere',region===1?'#a8d9e8':'#c67455',x,.32,.4,.13,.07,.13);}
  }else if(o.kind==='rock'){
    for(const [x,y,z,s]of [[-.27,.5,0,.58],[.35,.32,.2,.4],[.2,.75,-.25,.4],[-.38,.24,.4,.28]])part(root,'ico',stone,x,y,z,s,s*.72,s,[.25,x*2,.2]);
    for(let i=0;i<3;i++){const x=(i-1)*.2;part(root,'gem',region===2?'#de9d66':region===1?'#b6e6e8':'#a7bd7c',x,1.04-Math.abs(x),-.23,.09,.32,.1,[0,0,x],.12);}
    for(let i=0;i<4;i++)part(root,'ico',stone,Math.sin(i*2)*.68,.12,Math.cos(i*2)*.66,.12,.1,.14);
  }else if(o.kind==='pillar'){
    part(root,'box',stone,0,.2,0,1.2,.26,1.2);part(root,'cylinder','#a3a697',0,.82,0,.36,1.1,.36);part(root,'box',stone,0,1.46,0,.91,.22,.85);
    part(root,'box',gold,0,.78,.36,.17,.5,.02);part(root,'gem',REGIONS[region].accent,0,1.9,0,.18,.33,.18,null,.3);
    for(const x of [-.24,.24])part(root,'box','#728075',x,1.0,.32,.04,.7,.06);
    part(root,'box',stone,.56,.25,.46,.4,.4,.46,[0,.4,.22]);
  }else{
    part(root,'box','#765337',0,.46,0,1.05,.65,.7);part(root,'cylinder','#977042',0,.76,0,.52,1.03,.52,[0,0,Math.PI/2]);
    for(const x of [-.4,.4]){part(root,'box',gold,x,.46,.37,.095,.65,.06);part(root,'torus',gold,x,.74,0,.35,.35,.35,[0,Math.PI/2,0]);}
    part(root,'box',gold,0,.56,.41,.22,.26,.075);part(root,'gem','#8ddad0',0,.59,.46,.065,.08,.02,null,.3);
  }
  compact(root);return root;
}
function road(group,route,color){
  const vertices=[],indices=[],points=route.points,w=.92;
  for(let i=0;i<points.length;i++){
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],angle=Math.atan2(b.z-a.z,b.x-a.x),nx=-Math.sin(angle)*w,nz=Math.cos(angle)*w,p=points[i];
    vertices.push(p.x+nx,.16,p.z+nz,p.x-nx,.16,p.z-nz);if(i<points.length-1){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  const roadMat=material(color);roadMat.userData.noSnow=true;const mesh=new THREE.Mesh(geo,roadMat);mesh.receiveShadow=true;mesh.userData.ownedGeometry=true;group.add(mesh);
  for(let d=.4;d<route.length;d+=.9){const p=route.at(d);for(const side of [-1,1]){const x=p.x+Math.cos(p.angle)*1.02*side,z=p.z-Math.sin(p.angle)*1.02*side;part(group,'box','#b5ac8a',x,.2,z,.3,.1,.19,[0,p.angle,0]);}}
  for(let d=.7;d<route.length;d+=1.7){const p=route.at(d);part(group,'box','#c2b798',p.x,.167,p.z,.64,.018,.11,[0,p.angle+.3,0]);}
}
export function createMapLandscape(map,{miniature=false}={}){
  const root=new THREE.Group(),staticRoot=new THREE.Group(),r=REGIONS[map.region],random=randomFor((typeof map.id==='number'?map.id:40+map.region)*7549),portals=[],flags=[],castles=[],obstacles=new Map(),labels=[],plan=townPlan(map);
  root.add(staticRoot);
  const groundGeo=new THREE.PlaneGeometry(160,120,80,60);groundGeo.rotateX(-Math.PI/2);
  const p=groundGeo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),outside=Math.max(0,Math.abs(x)-19,Math.abs(z)-15);p.setY(i,outside?Math.min(4,outside*.09)*(Math.sin(x*.23)+Math.cos(z*.31)+1)*.6:-.015);}
  groundGeo.computeVertexNormals();const ground=new THREE.Mesh(groundGeo,groundMaterial(map.region));ground.receiveShadow=true;ground.userData.ownedGeometry=true;root.add(ground);
  // A continuous landscape replaces the old isolated square slab and flat void.
  for(let i=0;i<(miniature?75:165);i++){
    const x=(random()-.5)*100,z=(random()-.5)*74;if(Math.abs(x)<16.8&&Math.abs(z)<12.8||x>plan.minX-2&&x<plan.maxX+2&&z>plan.minZ-2&&z<plan.maxZ+2)continue;
    const t=treeModel(map.region,i);t.position.set(x,Math.max(0,Math.abs(x)-19,Math.abs(z)-15)*.02,z);t.scale.setScalar(1.05+random()*1.25);t.rotation.y=random()*6.28;staticRoot.add(t);
    if(i%4===0)part(staticRoot,'ico',r.edge,x+1.2,.45,z-.8,.7+random(),.6,1.0);
  }
  for(const route of map.routes)road(staticRoot,route,r.road);
  const ends=[];
  map.routes.forEach(route=>{
    const a=route.at(0),end=route.at(route.length),portal=portalModel(map.region);portal.position.set(a.x,.12,a.z);portal.rotation.y=a.angle;root.add(portal);portals.push(portal);labels.push({text:'时空之门',p:a,color:'#57619a'});
    if(!ends.some(e=>distance(e,end)<1)){ends.push(end);const castle=castleModel(map.region);castle.position.set(end.x,0,end.z);castle.rotation.y=end.angle+Math.PI;root.add(castle);castles.push(castle);if(map.region===1)coatWithSnow(castle,.58,0);const flag=castleFlag(map.region);flag.position.copy(castle.position);flag.rotation.y=.15;root.add(flag);flags.push(flag);labels.push({text:'守城之心',p:end,color:'#355e53'});}
  });
  for(const o of terrainObjects(map)){const m=obstacleModel(o,map.region);m.position.set(o.x,.16,o.z);if(o.kind==='tree')m.rotation.y=o.rotation;root.add(m);obstacles.set(o.id,m);}
  const waterColor=['#5ea9ab','#86bdcc','#d0734b'][map.region];
  part(staticRoot,'box',waterColor,0,.015,-13.1,66,.05,2.2,null,map.region===2?.15:0);
  for(let i=0;i<38;i++){const x=-31+i*1.7,z=-13.1+(i%4)*.17;part(staticRoot,'box',map.region===2?'#ffc278':'#c9e6dc',x,.047,z,.7,.012,.04,null,map.region===2?.3:0);}
  for(const x of [-18.7,28.7]){
    for(let j=0;j<6;j++)part(staticRoot,'ico',r.edge,x+(j%2)*.8,.8+(j%3)*.45,-6+j*2.2,1.3,.9,1.3);
    for(let i=0;i<4;i++){const z=5+i*1.5;part(staticRoot,'box',r.edge,x,.74,z,.6,1.45,.68);part(staticRoot,'box','#c5b98e',x,1.6,z,.83,.19,.87);}
  }
  const town=createTown(map,{miniature});root.add(town.root);
  // Roads, paving and walls stay batched; houses and castles retain independent
  // geometry so defeat can fracture the actual authored models.
  town.root.remove(town.buildings);staticRoot.add(town.buildings);
  // Small flowers, fern fronds, stony patches and snow keep open land readable.
  for(let i=0;i<220;i++){
    const x=(random()-.5)*30,z=(random()-.5)*22,q={x,z};if(map.routes.some(r=>r.nearest(q).distance<1.18)||ends.some(e=>distance(e,q)<2.6))continue;
    if(map.region===0){const a=random()*6.28;for(let j=0;j<3;j++)part(staticRoot,'cone',i%3?'#6c8b4e':'#91a955',x+j*.055,.12,z,.035,.24,.035,[0,a,.3]);if(i%6===0)part(staticRoot,'sphere',i%2?'#e0c473':'#d7cbd3',x,.23,z,.075,.04,.075);}
    else if(map.region===1)part(staticRoot,'sphere','#edf2e9',x,.04,z,.34,.035,.24);
    else if(i%3===0)part(staticRoot,'ico','#504b4b',x,.06,z,.18,.09,.14);
  }
  // Flatten and merge static scenery once; interactive obstacles stay separate.
  staticRoot.updateMatrixWorld(true);const flat=new THREE.Group(),meshes=[];staticRoot.traverse(m=>{if(m.isMesh)meshes.push(m);});
  for(const m of meshes){const geo=m.geometry.clone().applyMatrix4(m.matrixWorld),copy=new THREE.Mesh(geo,m.material);copy.userData.ownedGeometry=true;flat.add(copy);if(m.userData.ownedGeometry)m.geometry.dispose();}
  staticRoot.clear();compact(flat);staticRoot.add(flat);
  if(map.region===1){coatWithSnow(staticRoot,.58,0);for(const m of obstacles.values())coatWithSnow(m,.46,.008);for(const portal of portals)coatWithSnow(portal,.32,.008);}
  // compact owns merged geometries; its input clones are no longer used.
  for(const m of meshes){/* primitive geometry remains shared by model makers */}
  return {root,portals,flags,castles,town,obstacles,labels,cells:buildCells(map)};
}
