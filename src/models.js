import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { REGIONS, TOWERS, ENEMIES, HEROES, bossProfile } from './content.js';
import {assetTower,assetUnit} from './assets.js';

const geometries=new Map(),materials=new Map();
export const material=(color,emissive=0)=>{
  const k=`${color}:${emissive}`;
  if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.07,emissive:color,emissiveIntensity:emissive}));
  return materials.get(k);
};
const geometry=kind=>{
  if(!geometries.has(kind)){
    const g=kind==='box'?new THREE.BoxGeometry(1,1,1):kind==='sphere'?new THREE.SphereGeometry(1,12,8):kind==='ico'?new THREE.IcosahedronGeometry(1,1):kind==='gem'?new THREE.OctahedronGeometry(1):kind==='cone'?new THREE.ConeGeometry(1,1,8):kind==='pyramid'?new THREE.ConeGeometry(1,1,4):kind==='cylinder'?new THREE.CylinderGeometry(1,1,1,12):kind==='torus'?new THREE.TorusGeometry(1,.1,6,24):new THREE.CylinderGeometry(1,.75,1,10);
    geometries.set(kind,g);
  }return geometries.get(kind);
};
export function part(parent,kind,color,x,y,z,sx,sy,sz,rot=null,emissive=0){
  const m=new THREE.Mesh(geometry(kind),material(color,emissive));m.position.set(x,y,z);m.scale.set(sx,sy,sz);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
export function beam(parent,color,a,b,r=.05){
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);
  const m=part(parent,'cylinder',color,...av.clone().add(bv).multiplyScalar(.5).toArray(),r,delta.length(),r);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
}
export function compact(group){
  const buckets=new Map();group.updateMatrixWorld(true);
  for(const child of [...group.children]){
    if(!child.isMesh)continue;child.updateMatrix();
    const g=(child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone()).applyMatrix4(child.matrix),k=child.material.uuid;
    if(!buckets.has(k))buckets.set(k,{mat:child.material,geos:[]});buckets.get(k).geos.push(g);group.remove(child);if(child.userData.ownedGeometry)child.geometry.dispose();
  }
  for(const {mat,geos} of buckets.values()){
    const g=mergeGeometries(geos);for(const geo of geos)geo.dispose();
    const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;m.userData.ownedGeometry=true;group.add(m);
  }return group;
}
// Preserve a static model's placement and UVs while merging its nested meshes
// by material. Dynamic parts (e.g. a windmill rotor) must be detached first.
export function compactStaticModel(root){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),flat=new THREE.Group(),meshes=[];
  root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  for(const m of meshes){const geo=m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,m.matrixWorld)),copy=new THREE.Mesh(geo,m.material);copy.userData.ownedGeometry=true;flat.add(copy);if(m.userData.ownedGeometry)m.geometry.dispose();}
  root.clear();compact(flat);root.add(...[...flat.children]);return root;
}
export function disposeModel(root){
  root.userData.mixer?.stopAllAction();if(root.userData.mixer)root.userData.mixer.uncacheRoot(root.userData.mixer.getRoot());
  const skeletons=new Set(),snowMaterials=new Set();root.traverse(o=>{if(o.userData.mixer&&o!==root){o.userData.mixer.stopAllAction();o.userData.mixer.uncacheRoot(o.userData.mixer.getRoot());}if(o.userData.snowMaterials)for(const m of o.userData.snowMaterials)snowMaterials.add(m);if(o.isSkinnedMesh)skeletons.add(o.skeleton);if(o.userData.ownedGeometry)o.geometry?.dispose();if(o.userData.ownedMaterial)o.material?.dispose();});
  // SkeletonUtils clones own their bone textures even when mesh/material assets
  // are shared. Release those textures when this particular instance leaves.
  for(const skeleton of skeletons)skeleton.dispose();
  for(const m of root.userData.bossMaterials||[])snowMaterials.add(m);
  for(const m of snowMaterials)m.dispose();
}
const banner=(root,color,x,y,z,scale=1)=>{
  beam(root,'#73583e',[x,y-1.5*scale,z],[x,y+.3*scale,z],.035*scale);
  part(root,'box',color,x+.22*scale,y-.12*scale,z,.43*scale,.66*scale,.035);
  part(root,'box','#e6ce89',x+.23*scale,y-.1*scale,z+.03,.08*scale,.24*scale,.02);
};
const battlements=(root,color,y,r=1,n=8)=>{
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;part(root,'box',color,Math.sin(a)*r,y,Math.cos(a)*r,.29,.38,.29);}
};

export function towerModel(kind,level=1,spec=null){
  const loaded=assetTower(kind,level,spec);if(loaded)return loaded;
  const root=new THREE.Group(),d=TOWERS[kind],stone='#c4bfac',trim='#e4c781',wood='#755439',metal='#4e6670',lv=level-1;
  part(root,'cylinder',stone,0,.16,0,.84,.32,.84);
  part(root,'cylinder','#8d9487',0,.38,0,.69,.15,.69);
  const base=new THREE.Group();base.name='Foundation';root.add(base);
  const head=new THREE.Group();head.name='Turret';head.position.y=1.55+lv*.14;root.add(head);root.userData.head=head;
  if(kind==='arrow'){
    part(base,'box',stone,0,.95,0,1.05,1.0+lv*.17,1.05);
    for(const x of [-.48,.48])for(const z of [-.48,.48])part(base,'box',wood,x,1.02,z,.14,1.28,.14);
    part(head,'box',wood,0,.04,0,1.4,.18,1.4);
    for(const x of [-.61,.61])part(head,'box',wood,x,.28,0,.1,.4,1.4);
    for(const z of [-.61,.61])part(head,'box',wood,0,.28,z,1.4,.4,.1);
    part(head,'box',d.color,0,.52,-.2,.48,.55,.42);
    part(head,'sphere','#d5b68e',0,.94,-.2,.18,.18,.18);
    beam(head,wood,[-.55,.7,.25],[.55,.7,.25],.055);
    beam(head,trim,[-.48,.7,.3],[0,.7,.65],.016);beam(head,trim,[.48,.7,.3],[0,.7,.65],.016);
    beam(head,metal,[0,.7,-.1],[0,.7,.85],.025);
    if(level>=2){part(head,'pyramid',d.color,0,1.55,-.23,.76,.58,.75,[0,Math.PI/4,0]);for(const x of [-.62,.62])beam(head,wood,[x,.6,-.55],[x,1.25,-.55],.04);}
  }else if(kind==='ballista'){
    part(base,'box',stone,0,.83,0,1.15,.95,1.15);battlements(base,stone,1.42,.67,6);
    part(head,'cylinder',wood,0,.1,0,.63,.26,.63);
    part(head,'box',wood,0,.42,0,.2,.2,1.3);
    beam(head,wood,[-.9,.52,.35],[0,.52,.55],.075);beam(head,wood,[.9,.52,.35],[0,.52,.55],.075);
    beam(head,trim,[-.9,.52,.35],[0,.52,-.45],.018);beam(head,trim,[.9,.52,.35],[0,.52,-.45],.018);
    beam(head,metal,[0,.54,-.65],[0,.54,.9],.035);part(head,'cone',metal,0,.54,.99,.1,.28,.1,[Math.PI/2,0,0]);
    for(const x of [-.55,.55])part(head,'torus',metal,x,.14,-.35,.23,.23,.23,[0,Math.PI/2,0]);
  }else if(kind==='cannon'){
    part(base,'cylinder',stone,0,.8,0,.75,.85,.75);battlements(base,stone,1.26,.73,7);
    part(head,'box',wood,0,.08,0,1.1,.24,.9);
    const barrel=part(head,'cylinder',metal,0,.4,.05,.25,1.25,.25,[Math.PI/2-.33,0,0]);root.userData.barrel=barrel;
    part(head,'torus','#d6b468',0,.6,.6,.26,.26,.26,[Math.PI/2-.33,0,0]);
    part(head,'cylinder','#252e32',0,.61,.65,.18,.03,.18,[Math.PI/2-.33,0,0]);
    for(const x of [-.54,.54])part(head,'torus',wood,x,.06,0,.35,.35,.35,[0,Math.PI/2,0]);
    for(let i=0;i<3;i++)part(base,'sphere',metal,.5+(i%2)*.23,.54,-.8+Math.floor(i/2)*.2,.12,.12,.12);
  }else if(kind==='barracks'){
    head.visible=false;part(base,'box',stone,0,.85,0,1.55,1.1,1.32);
    part(base,'box','#514638',0,.61,.68,.55,.74,.035);
    for(const x of [-.42,.42])part(base,'box','#cfc5aa',x,.8,.7,.2,1.0,.14);
    part(base,'pyramid',d.color,0,1.9,0,1.25,.85,1.1,[0,Math.PI/4,0]);
    part(base,'box',trim,0,1.12,.76,.3,.11,.1);
    banner(base,spec===1?'#77a874':d.color,.9,2.6,-.35,.9);
    for(const x of [-.68,.68])part(base,'cylinder',metal,x,.38,.8,.14,.38,.14);
    if(level>=2)for(const x of [-.85,.85]){part(base,'box',stone,x,.98,-.45,.4,1.2,.5);part(base,'pyramid',d.color,x,1.8,-.45,.4,.5,.5,[0,Math.PI/4,0]);}
  }else{
    const tone=kind==='nature'?'#786d4f':stone;
    part(base,'taper',tone,0,1.04,0,.56,1.33+lv*.2,.56);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;part(base,'box',trim,Math.sin(a)*.55,.98,Math.cos(a)*.55,.1,1.05,.1);}
    part(head,'cylinder',tone,0,.13,0,.7,.22,.7);
    if(kind==='arcane'){
      part(head,'gem',d.color,0,.82,0,.38,.65,.38,null,.3);
      part(head,'torus',trim,0,.63,0,.62,.62,.62,[Math.PI/2,.25,0]);
      for(const x of [-.6,.6])part(head,'cone',trim,x,.56,0,.1,.64,.1,[0,0,-x*.45]);
      part(head,'torus',d.color,0,1.02,0,.47,.47,.47,[.4,0,Math.PI/2]);
    }else if(kind==='frost'){
      for(const [x,z,y] of [[0,0,.9],[-.36,.05,.54],[.34,.16,.6],[.03,-.38,.42]])part(head,'gem',x===0?'#c7f2f5':d.color,x,y,z,.16,.6,.17,[0,0,-x*.4],.18);
      part(head,'torus','#d1ecea',0,.2,0,.56,.56,.56,[Math.PI/2,0,0]);
    }else if(kind==='thunder'){
      for(const x of [-.43,.43]){part(head,'cylinder',metal,x,.6,0,.07,.92,.07);part(head,'sphere',trim,x,1.12,0,.19,.19,.19,null,.35);}
      part(head,'gem','#eadd90',0,.6,0,.24,.34,.24,null,.4);
      for(let i=0;i<3;i++)part(head,'torus',metal,0,.37+i*.15,0,.28,.28,.28,[Math.PI/2,0,0]);
    }else{
      beam(head,'#6c553d',[0,.15,0],[0,1.3,0],.17);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;beam(head,'#786047',[0,.45,0],[Math.sin(a)*.5,.9,Math.cos(a)*.5],.09);part(head,'sphere',i%2?d.color:'#547e52',Math.sin(a)*.48,1.05,Math.cos(a)*.48,.34,.35,.34);}
      part(head,'gem','#dce6a0',0,1.5,0,.2,.32,.2,null,.25);
    }
  }
  if(level>=2)for(let i=0;i<level;i++){const a=i/level*Math.PI*2;part(base,'box',trim,Math.sin(a)*.6,.63,Math.cos(a)*.6,.15,.13,.08,[0,a,0]);}
  if(spec!==null){part(base,'torus',d.color,0,.45,0,.78,.78,.78,[Math.PI/2,0,0]);banner(base,spec===0?d.color:'#e7c86e',-.83,2.9,-.54,.62);if(kind!=='barracks')part(head,'gem',spec===0?d.color:trim,.58,.9,-.25,.15,.22,.15,null,.15);}
  // Masonry courses, engraved trims, stairs, lanterns and functional mechanisms.
  for(let row=0;row<3;row++)for(let i=0;i<8;i++){const a=(i+(row%2)*.5)/8*Math.PI*2;part(base,'box',row%2?'#aaa996':'#d3cbb5',Math.sin(a)*.62,.54+row*.23,Math.cos(a)*.62,.035,.14,.15,[0,a,0]);}
  part(base,'torus',trim,0,.29,0,.77,.77,.77,[Math.PI/2,0,0]);
  for(let i=0;i<3;i++)part(base,'box',i%2?'#9d9d8b':stone,0,.07+i*.055,.85-i*.1,.63,.11,.27);
  for(const x of [-.39,.39]){part(base,'box',wood,x,.76,.58,.09,.41,.035);part(base,'box','#425451',x,.8,.61,.055,.21,.02);}
  for(const x of [-.59,.59]){beam(base,metal,[x,.78,.6],[x,.94,.75],.025);part(base,'box',metal,x,.74,.78,.14,.2,.14);part(base,'gem','#ffda94',x,.75,.8,.062,.09,.067,null,.5);}
  if(level>=2)for(const x of [-.59,.59])for(const z of [-.59,.59]){part(base,'taper',stone,x,.88,z,.15,1.3,.15);part(base,'cone',trim,x,1.57,z,.115,.2,.115);}
  if(level===3){part(base,'torus',trim,0,1.22,0,.64,.64,.64,[Math.PI/2,0,0]);for(const x of [-.68,.68])banner(base,d.color,x,1.67,.23,.27);}
  if(kind==='arrow'){
    for(let i=0;i<7;i++)part(head,'box','#967143',-.54+i*.18,.15,0,.1,.05,1.18);
    for(const x of [-.54,.54])for(const z of [-.54,.54])part(head,'sphere',trim,x,.26,z,.037,.037,.037);
    for(let i=0;i<3;i++){beam(head,wood,[.33+i*.07,.46,-.4],[.33+i*.07,.81,-.4],.017);part(head,'cone','#bacfc6',.33+i*.07,.85,-.4,.04,.1,.04);}
    if(level>=2)for(let i=0;i<5;i++)for(const side of [-1,1])part(head,'box',i%2?'#658553':d.color,side*(.12+i*.1),1.55-i*.07,-.23,.14,.055,1.0,[0,0,-side*.48]);
  }
  if(kind==='ballista'){
    for(const x of [-.54,.54]){part(head,'torus',trim,x,.14,-.35,.14,.14,.14,[0,Math.PI/2,0]);for(let i=0;i<6;i++){const a=i*Math.PI/3;beam(head,metal,[x,.14,-.35],[x,.14+Math.sin(a)*.2,-.35+Math.cos(a)*.2],.018);}}
    part(head,'box',metal,0,.34,-.5,.24,.21,.24);part(head,'torus',trim,0,.34,-.51,.12,.12,.12);
  }
  if(kind==='cannon'){
    for(const z of [-.24,.13,.45])part(head,'torus',trim,0,.4+z*.34,z,.26,.26,.26,[Math.PI/2-.33,0,0]);
    part(base,'box',wood,-.54,.46,-.53,.39,.25,.45);for(let i=0;i<4;i++)part(base,'sphere',metal,.24+(i%2)*.23,.48+Math.floor(i/2)*.2,-.66,.11,.11,.11);
    if(spec===1)for(const x of [-.43,.43])part(head,'cylinder',metal,x,.43,.1,.13,.75,.13,[Math.PI/2-.2,0,0]);
  }
  if(['arcane','frost','thunder','nature'].includes(kind)){
    for(let i=0;i<8;i++){const a=i*Math.PI/4;part(base,'gem',d.color,Math.sin(a)*.6,.48,Math.cos(a)*.6,.045,.085,.03,[0,a,0],.16);}
    if(level>=2)part(head,'torus',trim,0,.4,0,.76,.76,.76,[Math.PI/2,.2,0]);
    if(level===3)for(let i=0;i<3;i++){const a=i*Math.PI*2/3;part(head,'gem',d.color,Math.sin(a)*.62,.84,Math.cos(a)*.62,.12,.32,.12,[0,a,.15],.2);}
  }
  if(kind==='barracks'){
    for(let i=0;i<5;i++)part(base,'box','#917958',-.36+i*.18,.6,.71,.045,.57,.03);
    for(const x of [-.33,.33])part(base,'box',trim,x,.62,.75,.065,.68,.06);
    for(const z of [-.57,-.25,.07,.39])part(base,'box',d.color,0,1.9,z,1.48,.055,.12,[0,0,0]);
    part(base,'torus',trim,0,1.31,.71,.18,.18,.18);part(base,'box',metal,.65,.53,.91,.29,.4,.3);
  }
  root.name=`${kind}-L${level}-${spec??'base'}`;compact(base);compact(head);return root;
}

export function castleModel(region=0){
  const root=new THREE.Group(),stone=region===2?'#a49786':'#d9d0b3',roof=['#3c807c','#568296','#986057'][region];
  part(root,'box',stone,0,.87,0,2.45,1.7,1.7);
  part(root,'box','#525c51',0,.57,1.0,.61,1.13,.05);
  part(root,'pyramid',roof,0,2.5,-.22,1.8,1.3,1.35,[0,Math.PI/4,0]);
  for(const x of [-1.35,1.35]){part(root,'cylinder',stone,x,1.18,.35,.54,2.25,.54);part(root,'cone',roof,x,2.7,.35,.72,1.12,.72);part(root,'sphere','#e3c776',x,3.28,.35,.08,.1,.08);}
  for(const x of [-.8,-.4,0,.4,.8])part(root,'box',stone,x,1.84,.89,.25,.35,.28);
  banner(root,'#b8cd9a',.65,3.2,-.55,.8);
  part(root,'box','#dac995',0,1.56,1.05,.32,.23,.06);
  return compact(root);
}

export function treeModel(region=0,seed=0){
  const r=REGIONS[region],root=new THREE.Group(),fir=region===1||seed%3===0;
  part(root,'cylinder',region===2?'#584c45':'#776247',0,.65,0,.17,1.3,.17);
  if(region===2&&seed%3!==0){
    for(const [x,y,z] of [[-.55,1.7,.1],[.45,2,-.2],[.17,2.45,.1]])beam(root,'#594c46',[0,.75,0],[x,y,z],.065);
    if(seed%2)part(root,'ico',r.foliage[1],.1,1.7,0,.54,.27,.45);
  }else if(fir){
    for(let i=0;i<3;i++){part(root,'cone',r.foliage[i%3],0,1.05+i*.53,0,.82-i*.17,1.2,.82-i*.17);if(region===1)part(root,'cone','#edf1e8',0,1.36+i*.53,0,.56-i*.12,.6,.56-i*.12);}
  }else{
    for(const [x,y,z,s] of [[-.43,1.7,0,.7],[.36,1.88,.17,.75],[.1,2.45,-.1,.68]])part(root,'ico',r.foliage[(seed+Math.round(y))%3],x,y,z,s,s*.9,s);
    beam(root,'#786346',[0,.75,0],[-.55,1.6,0],.075);
  }return compact(root);
}

export function bossModel(kind,bossId){
  const profile=bossProfile(bossId),model=unitModel(kind),root=new THREE.Group();
  root.userData={...model.userData,bossId,bossMaterials:[],targetHeight:profile.height};
  model.userData.mixer=null;
  model.scale.multiplyScalar(profile.height/(model.userData.targetHeight||2));root.add(model);
  const materials=new Map(),tint=new THREE.Color(profile.tint);
  model.traverse(o=>{if(!o.isMesh)return;const recolor=mat=>{if(!materials.has(mat)){const copy=mat.clone();copy.color?.lerp(tint,.28);materials.set(mat,copy);root.userData.bossMaterials.push(copy);}return materials.get(mat);};o.material=Array.isArray(o.material)?o.material.map(recolor):recolor(o.material);});
  const crest=new THREE.Group(),y=profile.height+.1;
  part(crest,'torus',profile.crest,0,y,0,.32,.32,.32,[Math.PI/2,0,0],.18);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;part(crest,'gem',profile.crest,Math.sin(a)*.28,y+.16,Math.cos(a)*.28,.07,.16,.07,null,.18);}
  root.add(compact(crest));root.name=`boss-${bossId}`;return root;
}

export function unitModel(kind,hero=false){
  const loaded=assetUnit(kind,hero);if(loaded)return loaded;
  const root=new THREE.Group(),d=hero?HEROES[kind]:ENEMIES[kind]||{color:'#8499a4',model:kind},color=d.color,model=hero?kind:d.model;
  const body=new THREE.Group();root.add(body);root.userData.body=body;
  const legs=[],arms=[];root.userData.legs=legs;root.userData.arms=arms;
  const flesh=hero?'#e0bb91':model==='imp'?'#be7a62':'#a49b7a',steel='#9faeae',dark='#47565d',wood='#796348',gold='#e0c878';
  if(['wolf','siege','brood','grub'].includes(model)){
    const big=model==='siege',bug=['brood','grub'].includes(model);
    part(body,bug?'ico':'sphere',color,0,big?.85:.52,0,big?.68:.32,big?.55:.28,big?1.0:.58);
    part(body,'sphere',big?'#584d45':flesh,0,big?.92:.54,.57,big?.47:.26,big?.42:.23,big?.55:.33);
    if(!bug){part(body,'box','#d6cfac',0,big?.85:.48,.93,big?.33:.17,big?.16:.09,big?.22:.15);for(const x of [-.18,.18])part(body,'cone',color,x,big?1.3:.84,.5,.13,.3,.14);}
    for(let i=0;i<(bug?6:4);i++){const side=i%2?1:-1,z=(Math.floor(i/2)-(bug?1:.5))*.38,g=new THREE.Group();g.position.set(side*(big?.52:.25),big?.61:.37,z);root.add(g);legs.push(g);part(g,'box',color,0,-.2,0,big?.18:.085,big?.55:.35,big?.22:.1);compact(g);}
    if(model==='siege'){part(body,'box',dark,0,1.32,-.1,1.0,.25,1.4);for(const x of [-.42,.42])for(const z of [-.5,.3])part(body,'cone',gold,x,1.59,z,.09,.44,.1);}
    if(model==='brood')for(let i=0;i<5;i++)part(body,'sphere','#ccd091',Math.sin(i*2)*.25,.78,Math.cos(i*2)*.27,.17,.2,.17);
    if(model==='wolf')beam(body,color,[0,.55,-.45],[0,.85,-.94],.1);
  }else if(['bat','harpy','wisp'].includes(model)){
    part(body,'sphere',color,0,.8,0,.25,.35,.25);
    if(model==='wisp'){part(body,'gem','#e2f3d5',0,1.16,0,.18,.34,.18,null,.4);for(let i=0;i<3;i++)part(body,'torus',color,0,.5+i*.25,0,.27,.27,.27,[Math.PI/2,.3,0]);}
    else{
      part(body,'sphere',flesh,0,1.1,.14,.16,.17,.17);
      for(const side of [-1,1]){const wing=new THREE.Group();wing.position.set(side*.2,.9,0);root.add(wing);arms.push(wing);part(wing,'sphere',color,side*.45,0,-.06,.6,.065,.32,[0,0,side*.18]);part(wing,'cone',color,side*.68,-.08,-.15,.16,.53,.1,[0,0,side*1.5]);compact(wing);}
      if(model==='harpy')part(body,'cone','#d5e2e5',0,1.41,.1,.15,.4,.16);
    }
  }else if(['treant','iceking','ashlord','tree'].includes(model)){
    const bark=model==='treant'||model==='tree',ice=model==='iceking';
    const scale=model==='tree'?.68:1;
    part(body,bark?'taper':'box',bark?'#716147':color,0,1.75,0,.72,1.65,.53);
    part(body,ice?'gem':'sphere',bark?'#849a59':color,0,2.8,.08,.52,.55,.5);
    for(const x of [-.7,.7]){const arm=new THREE.Group();arm.position.set(x,2.0,0);root.add(arm);arms.push(arm);part(arm,bark?'cylinder':'box',bark?'#736346':dark,0,-.22,0,.22,.92,.22,[0,0,-x*.25]);part(arm,'sphere',color,0,-.78,.1,.25,.25,.25);compact(arm);}
    for(const x of [-.35,.35]){const leg=new THREE.Group();leg.position.set(x,.97,0);root.add(leg);legs.push(leg);part(leg,'box',bark?'#716147':dark,0,-.4,0,.3,.83,.42);compact(leg);}
    if(bark){for(const x of [-.5,0,.5]){beam(body,'#78654d',[x*.5,2.9,0],[x,3.7,0],.09);part(body,'ico','#526e43',x,3.5,0,.51,.36,.4);}part(body,'box','#e7db95',-.17,2.9,.54,.12,.08,.03,null,.35);part(body,'box','#e7db95',.17,2.9,.54,.12,.08,.03,null,.35);}
    else if(ice){for(const x of [-.58,-.28,0,.28,.58])part(body,'gem','#bfdfeb',x,3.53-Math.abs(x)*.4,0,.11,.43,.13,null,.17);part(body,'box','#9ac7d7',0,1.97,.59,.76,.81,.13);beam(body,'#7aa9b8',[.92,.35,0],[.92,3.7,0],.1);part(body,'gem','#e3f5f5',.92,3.7,0,.36,.6,.3);}
    else{part(body,'box','#664c51',0,1.85,-.55,1.3,1.6,.16);for(const x of [-.4,0,.4])part(body,'cone',gold,x,3.44,0,.12,.57,.12);part(body,'gem','#ffc382',0,1.96,.64,.24,.38,.15,null,.5);beam(body,dark,[.92,.25,.2],[.92,2.9,.2],.1);part(body,'box','#cdab74',.92,2.9,.2,.22,.95,.09,[0,0,.2]);}
    root.scale.setScalar(scale);
  }else{
    const chunky=['armor','frostguard','elite'].includes(model),robe=['mage','druid','shaman','warlock','shield'].includes(model);
    part(body,robe?'taper':'box',color,0,.8,0,chunky?.58:.45,robe?.91:.6,chunky?.39:.31);
    part(body,'sphere',flesh,0,1.38,.02,.22,.24,.21);
    part(body,'box','#273b3d',0,1.4,.205,.21,.055,.025);
    for(const x of [-.15,.15]){const leg=new THREE.Group();leg.position.set(x,.56,0);root.add(leg);legs.push(leg);part(leg,'box',dark,0,-.25,0,.14,.5,.2);part(leg,'box',wood,0,-.48,.045,.16,.13,.27);compact(leg);}
    for(const x of [-.32,.32]){const arm=new THREE.Group();arm.position.set(x,1.03,0);root.add(arm);arms.push(arm);part(arm,'box',color,0,-.2,0,.17,.42,.2);part(arm,'sphere',flesh,0,-.4,.08,.09,.1,.1);compact(arm);}
    if(chunky||model==='knight'||model==='guard'){
      part(body,'sphere',steel,0,1.53,0,.25,.19,.24);part(body,'box',dark,0,1.43,.235,.27,.07,.045);
      for(const x of [-.34,.34])part(body,'sphere',chunky?dark:steel,x,1.16,0,.25,.15,.25);
      part(body,'box',gold,0,.78,.19,.13,.13,.06);
      part(body,'box',model==='knight'?'#e5cb8e':steel,-.45,.88,.24,.4,.59,.1,[0,0,-.12]);
      part(body,'box',color,-.45,.88,.3,.17,.32,.035);beam(body,steel,[.38,.46,.15],[.38,1.31,.26],.035);
      if(model==='elite'||model==='knight')part(body,'cone',color,0,1.84,0,.1,.45,.12);
      if(model==='frostguard')for(const x of [-.4,.4])part(body,'gem','#c4e5e7',x,1.4,0,.14,.26,.14);
    }else if(model==='ranger'||model==='scout'){
      part(body,'cone',color,0,1.64,-.03,.34,.35,.3,[0,0,-.17]);
      beam(body,wood,[.4,.43,.28],[.4,1.34,.28],.035);beam(body,gold,[.4,.43,.28],[.4,.85,.55],.012);beam(body,gold,[.4,1.34,.28],[.4,.85,.55],.012);
      part(body,'box','#526a4c',0,.96,-.22,.32,.76,.14,[0,0,.2]);
    }else if(robe){
      beam(body,wood,[.38,.12,.06],[.38,1.89,.06],.042);
      part(body,'gem',model==='mage'?'#d7bbf0':model==='druid'?'#bfe6aa':color,.38,1.94,.06,.15,.27,.15,null,.3);
      part(body,'cone',color,0,1.84,0,.33,.58,.3,[0,0,.08]);part(body,'torus',gold,0,1.55,0,.25,.25,.25,[Math.PI/2,0,0]);
      if(model==='shield')part(body,'gem','#c5e7f4',-.39,.9,.2,.26,.43,.1,null,.2);
    }else if(model==='imp'){
      for(const x of [-.17,.17])part(body,'cone','#e4cb9e',x,1.66,0,.065,.27,.07,[0,0,-x*1.3]);beam(body,wood,[.35,.35,.1],[.35,1.3,.1],.03);part(body,'gem',dark,.35,1.35,.1,.13,.2,.12);
    }else{
      beam(body,wood,[.37,.32,0],[.37,1.5,0],.04);part(body,'box',steel,.42,1.4,0,.32,.24,.1);
    }
    if(hero){part(body,'box',color,0,.84,-.23,.47,.83,.06,[.12,0,0]);part(body,'torus',gold,0,.54,0,.3,.3,.3,[Math.PI/2,0,0]);root.scale.setScalar(1.17);}
  }
  if(['wolf','siege'].includes(model)){
    for(const x of [-.17,.17]){part(body,'sphere','#202e30',x,model==='siege'?1.03:.66,.77,.04,.05,.045);part(body,'sphere','#e8d7a3',x,model==='siege'?1.05:.67,.795,.016,.017,.015);}
    part(body,'sphere','#2c3231',0,model==='siege'?.87:.51,model==='siege'?1.4:.91,.1,.065,.055);
    for(const x of [-.13,.13])part(body,'cone','#efe2bb',x,model==='siege'?.71:.4,model==='siege'?1.24:.82,.028,.1,.035,[Math.PI,0,0]);
    for(let i=0;i<6;i++){const z=-.38+i*.12;part(body,'cone',model==='wolf'?'#6c7664':gold,0,model==='wolf'?.89:1.47,z,.095,.24,.1,[.3,0,0]);}
  }
  if(['treant','tree'].includes(model)){
    for(let i=0;i<9;i++){const a=i*2.4;beam(body,'#9c8158',[Math.sin(a)*.5,1.12,Math.cos(a)*.42],[Math.sin(a)*.51,2.2,Math.cos(a)*.44],.025);}
    for(let i=0;i<9;i++){const a=i*.7;part(body,'ico',i%2?'#73a45e':'#a2bc69',Math.sin(a)*.59,2.35+(i%3)*.45,Math.cos(a)*.55,.29,.2,.29);}
    part(body,'gem','#bde5a0',0,1.76,.55,.18,.31,.09,null,.38);
    for(const x of [-.3,.3]){part(body,'torus','#504d3a',x,2.87,.54,.16,.12,.07);part(body,'gem','#ede7a3',x,2.87,.58,.06,.045,.02,null,.4);}
    for(let i=0;i<4;i++)part(body,'cone','#a5956b',(i-1.5)*.12,2.57,.51,.035,.11,.035,[Math.PI,0,0]);
  }
  body.name='Body';for(const [i,g]of arms.entries())g.name=`Arm${i}`;for(const [i,g]of legs.entries())g.name=`Leg${i}`;root.name=kind;
  compact(body);return root;
}

export function projectileModel(kind){
  const root=new THREE.Group(),d=TOWERS[kind];
  if(kind==='arrow'||kind==='ballista'){
    const big=kind==='ballista',len=big?1.25:.86;
    beam(root,big?'#795f41':'#c6a773',[0,0,-len*.5],[0,0,len*.5],big?.045:.025);
    part(root,'cone','#c1d3ce',0,0,len*.55,big?.1:.06,.18,.06,[Math.PI/2,0,0]);
    for(const r of [0,Math.PI/2])part(root,'box',big?'#daa949':'#eee3c7',0,0,-len*.4,big?.24:.15,.025,.24,[0,0,r]);
    if(big){for(const z of [-.3,0,.3])part(root,'torus','#e3bf6e',0,0,z,.073,.073,.073);for(const x of [-.08,.08])part(root,'cone','#d5e1dc',x,0,.51,.065,.28,.065,[Math.PI/2,0,x*2]);}
  }else if(kind==='cannon'){part(root,'sphere','#394950',0,0,0,.22,.22,.22);for(const a of [0,Math.PI/2])part(root,'torus','#9ea6a0',0,0,0,.213,.213,.213,[a,0,0]);beam(root,'#9b7743',[0,.12,-.13],[0,.29,-.19],.03);part(root,'sphere','#ffdf97',0,.29,-.19,.065,.065,.065,null,1);}
  else if(kind==='frost'){part(root,'gem','#ddffff',0,0,.05,.14,.14,.48,[Math.PI/2,0,0],.4);for(let i=0;i<4;i++){const a=i*Math.PI/2;part(root,'gem','#8adce9',Math.sin(a)*.18,Math.cos(a)*.18,-.17,.055,.055,.25,[Math.PI/2,0,a],.35);}}
  else if(kind==='nature'){part(root,'sphere','#bdd67d',0,0,0,.17,.17,.17,null,.45);for(let i=0;i<3;i++){const a=i*2.094;part(root,'sphere','#679755',Math.sin(a)*.18,Math.cos(a)*.18,-.08,.14,.04,.2,[0,0,-a]);part(root,'cone','#dbec9a',Math.sin(a)*.17,Math.cos(a)*.17,.11,.04,.18,.04,[Math.PI/2,0,a]);}}
  else{part(root,'gem',d?.color||'#b7a3e0',0,0,0,.18,.18,.31,[Math.PI/2,0,0],.8);for(let i=0;i<3;i++)part(root,'torus',i%2?'#a87be4':'#efe0ff',0,0,0,.25,.25,.25,[i*.8,.7*i,0],.65);}
  return compact(root);
}
