import * as THREE from 'three';
import { REGIONS, TOWERS, ENEMIES, HEROES, LEVELS, towerStats } from './content.js';
import { clamp, distance, lerp } from './routes.js';
import { material, part, beam, compact, disposeModel, towerModel, castleModel, treeModel, unitModel, bossModel, projectileModel } from './models.js';
import { Effects } from './effects.js';
import { terrainObjects } from './terrain.js';
import {createMapLandscape} from './environment.js';
import {animateAsset} from './assets.js';
import {Snowfall,coatWithSnow,accumulateSnow} from './weather.js';
import {updateTown,townPlan} from './town.js';
import {DefeatSequence} from './defeat.js';

const vector=new THREE.Vector3(),dummy=new THREE.Object3D();
const PROJECTILE_MOUNTS={arrow:2.42,ballista:2.26,cannon:2.32,arcane:2.54,frost:2.62,thunder:2.84,nature:3.22};
const PROJECTILE_OFFSETS={arrow:.6,ballista:.8,cannon:.65};
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
// Triangle strips keep a visible width; WebGL line widths are usually one pixel.
function snowGridGeometry(cells){
  const vertices=[];
  const strip=(x1,z1,x2,z2)=>{vertices.push(x1,.18,z1,x2,.18,z1,x2,.18,z2,x1,.18,z1,x2,.18,z2,x1,.18,z2);};
  for(const {x,z} of cells)for(const sx of [-1,1])for(const sz of [-1,1]){
    const cx=x+sx*.84,cz=z+sz*.84;
    strip(Math.min(cx,cx-sx*.43),cz-.025,Math.max(cx,cx-sx*.43),cz+.025);
    strip(cx-.025,Math.min(cz,cz-sz*.43),cx+.025,Math.max(cz,cz-sz*.43));
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));return geometry;
}
export class Renderer {
  constructor(canvas,feedback,game,settings){
    this.canvas=canvas;this.feedback=feedback;this.ctx=feedback.getContext('2d');this.game=game;this.settings=settings;
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-20,20,15,-15,.1,160);
    this.contextLost=false;
    this.gpu=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'default'});
    this.gpu.outputColorSpace=THREE.SRGBColorSpace;this.gpu.toneMapping=THREE.ACESFilmicToneMapping;this.gpu.toneMappingExposure=1.08;
    this.gpu.shadowMap.enabled=true;this.gpu.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene.add(new THREE.HemisphereLight('#e2eff0','#647753',2.15));
    this.sun=new THREE.DirectionalLight('#fff0d4',3.2);this.sun.position.set(-12,25,12);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-24,right:24,top:22,bottom:-22,near:1,far:80});this.sun.shadow.bias=-.00035;this.sun.shadow.normalBias=.045;this.sun.shadow.radius=2.5;
    this.scene.add(this.sun);const fill=new THREE.DirectionalLight('#c7e4ec',1.0);fill.position.set(15,10,-18);this.scene.add(fill);
    this.world=new THREE.Group();this.scene.add(this.world);this.units=new Map();this.bullets=new Map();this.bulletPools=new Map();this.projectileTemplates=new Map();this.padMeshes=[];this.labels=[];this.floats=[];this.zoneMeshes=new Map();this.effects=new Effects(this.scene);
    this.portals=[];this.obstacleMeshes=new Map();this.previewCache=new Map();this.view={zoom:1,x:0,z:0};this.preview=null;this.lastMap=null;this.width=1;this.height=1;this.shake=0;this.wallTime=0;this.targetPoint=null;
    this.rangeRing=this.makeRing('#e8d694');this.scene.add(this.rangeRing);this.rangeRing.visible=false;
    this.heroRing=this.makeRing('#f4de92');this.scene.add(this.heroRing);this.heroRing.visible=false;
    this.targetRing=this.makeRing('#ebd3a0');this.scene.add(this.targetRing);this.targetRing.visible=false;
    this.dangerRing=this.makeRing('#98d8e7');this.scene.add(this.dangerRing);this.dangerRing.visible=false;
    this.commandRing=this.makeRing('#f8e9b8');this.scene.add(this.commandRing);this.commandRing.visible=false;this.commandLife=0;
    const markerGeo=new THREE.RingGeometry(.72*Math.SQRT2,.84*Math.SQRT2,4);markerGeo.rotateX(-Math.PI/2);markerGeo.rotateY(Math.PI/4);
    this.placementMarker=new THREE.Mesh(markerGeo,new THREE.MeshBasicMaterial({color:'#e5f3b0',transparent:true,opacity:.92,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));this.scene.add(this.placementMarker);this.placementMarker.visible=false;
    const fillGeo=new THREE.PlaneGeometry(1.68,1.68);fillGeo.rotateX(-Math.PI/2);
    this.placementFill=new THREE.Mesh(fillGeo,new THREE.MeshBasicMaterial({color:'#79c6e9',transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));this.scene.add(this.placementFill);this.placementFill.visible=false;
    this.clearRing=this.makeRing('#efb86d');this.scene.add(this.clearRing);this.clearRing.visible=false;this.showGrid=false;
    this.game.on(e=>this.handle(e));this.applySettings(settings);this.loadMap(LEVELS[0],true);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas.parentElement);this.resize();
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;this.game.setPaused(true);this.game.notify('图形显示暂时中断，已暂停战斗，正在等待恢复。');});
    canvas.addEventListener('webglcontextrestored',()=>{this.contextLost=false;this.resize();if(this.defeat?.active){this.game.setPaused(false);this.game.notify('图形显示已恢复，继续播放失守演出。');}else this.game.notify('图形显示已恢复，可以继续战斗。');});
  }
  makeRing(color){const geometry=new THREE.RingGeometry(.96,1,64);geometry.rotateX(-Math.PI/2);const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide});const m=new THREE.Mesh(geometry,mat);m.position.y=.19;return m;}
  applySettings(settings){
    this.settings=settings;this.effects.settings=settings;this.gpu.shadowMap.enabled=settings.quality!=='fast';
    const shadowSize=settings.quality==='high'?2048:1024;
    this.sun.shadow.mapSize.set(shadowSize,shadowSize);
    // Three uses mapSize for the shadow viewport but keeps an allocated target.
    // Resize both together or quality changes stretch shadows across the map.
    this.sun.shadow.map?.setSize(shadowSize,shadowSize);
    this.resize();
  }
  resize(){
    const rect=this.canvas.parentElement.getBoundingClientRect();if(!rect.width||!rect.height)return;
    this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);
    const max=this.settings.quality==='high'?3:this.settings.quality==='balanced'?1.75:1;
    const budget=this.settings.quality==='high'?6500000:this.settings.quality==='balanced'?3500000:1800000;
    const ratio=Math.min(window.devicePixelRatio||1,max,Math.sqrt(budget/(this.width*this.height)));
    this.gpu.setPixelRatio(ratio);this.gpu.setSize(this.width,this.height,false);
    const hudBudget=this.settings.quality==='high'?6500000:this.settings.quality==='balanced'?4500000:2500000;
    const hudRatio=Math.min(3,window.devicePixelRatio||1,Math.sqrt(hudBudget/(this.width*this.height)));
    this.feedback.width=Math.floor(this.width*hudRatio);this.feedback.height=Math.floor(this.height*hudRatio);this.feedback.style.width=`${this.width}px`;this.feedback.style.height=`${this.height}px`;this.ctx.setTransform(hudRatio,0,0,hudRatio,0,0);
    this.fitCamera();
  }
  fitCamera(){
    const aspect=this.width/this.height,menu=this.game.mode==='menu';
    let span=Math.max(menu?29:28.5,48/aspect)/this.view.zoom;
    if(!menu&&this.lastMap&&document.body.classList.contains('compact-battle')){
      // Frame the playable grid and the actual town together. Peripheral forest
      // remains continuous scenery; it is not a finite board to fit on screen.
      const town=townPlan(this.lastMap),bounds={minX:-15.9,maxX:town.maxX+1,minZ:Math.min(-11.5,town.minZ-.7),maxZ:Math.max(11.5,town.maxZ+.7),minY:0,maxY:5.2};
      const cx=(bounds.minX+bounds.maxX)/2+this.view.x,cz=(bounds.minZ+bounds.maxZ)/2+this.view.z,cy=2.6;
      this.camera.position.set(cx+5,cy+36,cz+24);this.camera.lookAt(cx,cy,cz);this.camera.updateMatrixWorld();
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(const x of [bounds.minX,bounds.maxX])for(const z of [bounds.minZ,bounds.maxZ])for(const y of [bounds.minY,bounds.maxY]){
        vector.set(x,y,z).applyMatrix4(this.camera.matrixWorldInverse);
        minX=Math.min(minX,vector.x);maxX=Math.max(maxX,vector.x);minY=Math.min(minY,vector.y);maxY=Math.max(maxY,vector.y);
      }
      const top=56,bottom=62,side=12,availableHeight=Math.max(100,this.height-top-bottom),availableWidth=Math.max(100,this.width-side*2);
      span=Math.max((maxY-minY)*this.height/availableHeight,(maxX-minX)*this.width/availableWidth/aspect)/this.view.zoom;
      const offset=span*(top-bottom)/(2*this.height);
      this.span=span;this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;this.camera.top=span/2+offset;this.camera.bottom=-span/2+offset;this.camera.updateProjectionMatrix();
      this.framing={...bounds,top,bottom,side};return;
    }
    this.framing=null;
    this.span=span;this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.updateProjectionMatrix();
    const cx=this.view.x+(menu?-1:3.5),cz=this.view.z+(menu?0:1.5);
    this.camera.position.set(cx+5,36,cz+24);this.camera.lookAt(cx,0,cz);this.camera.updateMatrixWorld();
  }
  zoom(delta){this.view.zoom=clamp(this.view.zoom*delta,document.body.classList.contains('compact-battle')?.65:.8,2.3);this.fitCamera();}
  pan(dx,dy){const sensitivity=this.settings.sensitivity;this.view.x=clamp(this.view.x-dx/this.width*(this.span*this.width/this.height)*sensitivity,-10,10);this.view.z=clamp(this.view.z-dy/this.height*this.span*sensitivity,-9,9);this.fitCamera();}
  resetView(){this.view={zoom:1,x:0,z:0};this.fitCamera();}
  project(x,z,y=.2){vector.set(x,y,z).project(this.camera);return {x:(vector.x*.5+.5)*this.width,y:(-.5*vector.y+.5)*this.height,visible:vector.z<1};}
  ground(screenX,screenY){
    const ndc=new THREE.Vector2(screenX/this.width*2-1,1-screenY/this.height*2),ray=new THREE.Raycaster();ray.setFromCamera(ndc,this.camera);
    const p=new THREE.Vector3();ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.12),p);return {x:p.x,z:p.z};
  }
  hit(screenX,screenY){
    if(!this.game.map)return null;
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(screenX/this.width*2-1,1-screenY/this.height*2),this.camera);
    const roots=[...this.units.values()].map(m=>m.root).filter(m=>m.userData.pick),objects=ray.intersectObjects([...roots,...this.obstacleMeshes.values()],true);
    for(const hit of objects){let o=hit.object;while(o){if(o.userData.pick)return o.userData.pick;o=o.parent;}}
    const p=this.ground(screenX,screenY),tower=this.game.towers.find(t=>distance(t,p)<.84);if(tower)return {type:'tower',id:tower.id};
    const obstacle=this.game.scenery.find(o=>o.alive&&distance(o,p)<.82);if(obstacle)return {type:'obstacle',id:obstacle.id};
    return null;
  }
  thumbnail(type,value){
    const key=`${type}:${value.id??value}`,cached=this.previewCache.get(key);if(cached)return cached;
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,180),width=type==='map'?720:400,height=type==='map'?460:400;
    scene.background=new THREE.Color(type==='map'?REGIONS[value.region].sky:'#263f3b');
    const lights=[];for(const original of this.scene.children.filter(o=>o.isLight)){const light=original.clone();light.castShadow=false;scene.add(light);lights.push(light);}
    let model;
    if(type==='map'){
      model=createMapLandscape(value,{miniature:true}).root;scene.add(model);const span=29.5,aspect=width/height;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.position.set(8,33,23);camera.lookAt(3.5,0,0);
    }else{
      model=type==='hero'?unitModel(value,true):type==='enemy'?(value.startsWith('boss:')?bossModel(LEVELS.find(m=>m.bossId===value.slice(5)).boss,value.slice(5)):unitModel(value,false)):towerModel(value,3,null);scene.add(model);model.rotation.y=-.32;
      const pedestal=type==='hero'?1.2:type==='enemy'?1:1.5;part(scene,'cylinder','#52634d',0,-.15,0,pedestal,.28,pedestal);
      model.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      const subjectHeight=type==='hero'?2.45:type==='enemy'?(model.userData.targetHeight||2):3.2,span=Math.max(subjectHeight+1.05,size.x*1.15+size.z*.45);camera.left=-span/2;camera.right=span/2;camera.top=span/2;camera.bottom=-span/2;camera.position.set(3,subjectHeight+.8,6);camera.lookAt(0,subjectHeight*.48,0);
    }
    camera.updateProjectionMatrix();const target=new THREE.WebGLRenderTarget(width,height);target.texture.colorSpace=THREE.SRGBColorSpace;
    const old=this.gpu.getRenderTarget(),pixels=new Uint8Array(width*height*4),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    try{this.gpu.setRenderTarget(target);this.gpu.clear();this.gpu.render(scene,camera);this.gpu.readRenderTargetPixels(target,0,0,width,height,pixels);
      const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(pixels.subarray(y*width*4,(y+1)*width*4),(height-y-1)*width*4);ctx.putImageData(data,0,0);
      const url=canvas.toDataURL('image/webp',.88);this.previewCache.set(key,url);return url;
    }finally{this.gpu.setRenderTarget(old);target.dispose();disposeModel(model);for(const light of lights)light.shadow?.map?.dispose();}
  }
  clearWorld(){
    this.defeat?.dispose();this.defeat=null;this.castles=[];
    this.snowfall?.dispose();this.snowfall=null;this.town=null;this.flags=[];
    for(const m of this.units.values()){this.scene.remove(m.root);disposeModel(m.root);}this.units.clear();
    for(const m of this.bullets.values())this.scene.remove(m);this.bullets.clear();this.bulletPools.clear();
    // Instances share the template's geometry/material; release owned geometry
    // once at map teardown, never every time an individual arrow lands.
    for(const template of this.projectileTemplates.values())disposeModel(template);this.projectileTemplates.clear();
    for(const m of this.zoneMeshes.values()){this.scene.remove(m);m.geometry.dispose();m.material.dispose();}this.zoneMeshes.clear();
    disposeModel(this.world);this.world.clear();this.effects.clear();this.floats=[];this.labels=[];this.padMeshes=[];
  }
  loadMap(map,preview=false){
    this.clearWorld();this.showGrid=false;this.lastMap=map;this.preview=preview;this.resetView();const r=REGIONS[map.region];
    this.scene.background=new THREE.Color(r.sky);this.scene.fog=new THREE.Fog(r.sky,75,145);
    const landscape=createMapLandscape(map);this.world.add(landscape.root);this.portals=landscape.portals;this.flags=landscape.flags;this.castles=landscape.castles;this.town=landscape.town;this.obstacleMeshes=landscape.obstacles;this.labels=landscape.labels;if(map.region===1)this.snowfall=new Snowfall(this.scene);
    if(map.region===1){
      this.buildGrid=new THREE.Mesh(snowGridGeometry(landscape.cells),new THREE.MeshBasicMaterial({color:'#39738b',transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
    }else{
      const lines=[];for(const cell of landscape.cells){for(const [a,b]of [[[-.84,-.84],[-.84,-.52]],[[-.84,-.84],[-.52,-.84]],[[.84,.84],[.84,.52]],[[.84,.84],[.52,.84]]])lines.push(cell.x+a[0],.18,cell.z+a[1],cell.x+b[0],.18,cell.z+b[1]);}
      const gridGeo=new THREE.BufferGeometry();gridGeo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));this.buildGrid=new THREE.LineSegments(gridGeo,new THREE.LineBasicMaterial({color:'#e8edbd',transparent:true,opacity:.2,depthWrite:false}));
    }
    this.buildGrid.userData.ownedGeometry=true;this.buildGrid.userData.ownedMaterial=true;this.world.add(this.buildGrid);
    if(preview){for(const [index,kind,level] of [[1,'arrow',3],[3,'arcane',2],[4,'cannon',2],[5,'barracks',2]]){const site=map.sites[index];if(site){const tower=towerModel(kind,level,null);tower.position.set(site.x,.16,site.z);this.world.add(tower);}}
      const p=map.routes[0].at(map.routes[0].length*.5),hero=unitModel('knight',true);hero.position.set(p.x,.18,p.z);this.world.add(hero);
    }this.fitCamera();
  }
  mergeEnvironment(group){
    const meshes=[];group.traverse(o=>{if(o.isMesh)meshes.push(o);});group.updateMatrixWorld(true);
    const flat=new THREE.Group();
    for(const m of meshes){const geo=m.geometry.clone().applyMatrix4(m.matrixWorld);const clone=new THREE.Mesh(geo,m.material);clone.userData.ownedGeometry=true;flat.add(clone);}
    disposeModel(group);group.clear();compact(flat);group.add(flat);
    // compact() cloned the temporary flat geometries; release the originals.
    for(const m of meshes)if(!m.userData.ownedGeometry){ /* shared primitive geometry is retained */ }
  }
  road(group,route,color){
    const vertices=[],normals=[],indices=[],points=route.points,w=.91;
    for(let i=0;i<points.length;i++){
      const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],angle=Math.atan2(b.z-a.z,b.x-a.x),nx=-Math.sin(angle)*w,nz=Math.cos(angle)*w,p=points[i];
      vertices.push(p.x+nx,.18,p.z+nz,p.x-nx,.18,p.z-nz);normals.push(0,1,0,0,1,0);
      if(i<points.length-1){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(points.length*4),2));g.setIndex(indices);
    const m=new THREE.Mesh(g,material(color));m.receiveShadow=true;m.userData.ownedGeometry=true;group.add(m);
    for(let d=1;d<route.length;d+=1.5){const p=route.at(d);for(const side of [-1,1]){const x=p.x+Math.cos(p.angle)*.99*side,z=p.z-Math.sin(p.angle)*.99*side;part(group,'box','#b7b09a',x,.2,z,.27,.1,.18,[0,p.angle,0]);}}
    for(let d=3;d<route.length-2;d+=8){const p=route.at(d);part(group,'box','#b4aa91',p.x,.184,p.z,.06,.02,.44,[0,p.angle,0]);}
  }
  handle(e){
    if(e.type==='start')this.loadMap(this.game.map,false);
    if(e.type==='leave')this.loadMap(LEVELS[0],true);
    if(e.type==='defeat'){this.defeat?.dispose();this.defeat=new DefeatSequence(this);}
    if(e.type==='command'){this.commandRing.position.set(e.x,.23,e.z);this.commandRing.scale.setScalar(.55);this.commandRing.visible=true;this.commandLife=.8;}
    if(['hit','friendly-hit','heal'].includes(e.type)){
      const old=this.floats.find(n=>n.id===e.id&&n.kind===e.type&&n.age<.09);
      if(old){old.hp+=e.hp||0;old.shield+=e.shield||0;}else this.floats.push({...e,age:0});
      if(this.floats.length>65)this.floats.shift();
    }
    if(e.type==='attack'){
      const a=Math.atan2(e.to.x-e.x,e.to.z-e.z),tower=this.game.towers.find(t=>t.id===e.source);
      const kind=e.kind==='cannon'?'fire':e.kind==='frost'?'frost':e.kind==='nature'?'nature':e.kind==='arcane'?'arcane':'sun';
      if(tower)this.effects.emit({x:e.x+Math.sin(a)*.68,z:e.z+Math.cos(a)*.68,y:2.4+(tower.level-1)*.14},kind,e.kind==='cannon'?12:5,.32);
    }
    if(e.type==='impact')this.effects.impact(e);
    if(e.type==='status')this.effects.emit({...e,y:.75},e.kind==='frost'?'frost':'nature',6,.3);
    if(e.type==='death')this.effects.emit({...e,y:1},e.kind==='treant'?'nature':'sun',e.boss?42:12,e.boss?1.6:.7);
    if(e.type==='friendly-death')this.effects.emit({...e,y:.7},'sun',18,.7);
    if(e.type==='revive')this.effects.emit({...e,y:.4},'nature',20,.8);
    if(e.type==='explosion'){this.effects.impact(e,'cannon');this.shake=.22*this.settings.shake;}
    if(e.type==='build'||e.type==='upgrade')this.effects.emit({...e,y:.35},'sun',20,.7);
    if(e.type==='lightning')this.effects.arc(e,e.points);
    if(e.type==='skill')this.effects.emit({...e,y:e.kind==='meteor'?2:.35},['stasis','frost'].includes(e.kind)?'frost':['heal','tree'].includes(e.kind)?'nature':e.kind==='meteor'?'arcane':'sun',48,Math.min(2,e.radius*.45));
    if(e.type==='leak'){this.shake=.18*this.settings.shake;if(this.town)this.town.alarm=4;}
    if(e.type==='obstacle-clear'){
      const model=this.obstacleMeshes.get(e.id);if(model){model.parent.remove(model);disposeModel(model);this.obstacleMeshes.delete(e.id);}
      this.effects.emit({...e,y:.6},e.kind==='tree'?'nature':'sun',28,.9);this.floats.push({id:e.id,...e,kind:'heal',hp:e.reward,age:0});
    }
    if(e.type==='spawn')this.effects.emit({...e,y:.9},'arcane',12,.5);
  }
  syncModel(entity,type,dt=0){
    // The cinematic has its own small set of invaders. Hide the frozen battle
    // army instead of drawing duplicate monsters or allocating unseen units.
    if(type==='enemy'&&this.defeat){const item=this.units.get(entity.id);if(item)item.root.visible=false;return item?.root;}
    const key=type==='tower'?`${entity.kind}:${entity.level}:${entity.spec}`:`${type}:${entity.kind}:${entity.bossId||''}`;
    let item=this.units.get(entity.id);
    if(item&&item.key!==key){this.scene.remove(item.root);disposeModel(item.root);this.units.delete(entity.id);item=null;}
    if(!item){const root=type==='tower'?towerModel(entity.kind,entity.level,entity.spec):entity.bossId?bossModel(entity.kind,entity.bossId):unitModel(entity.kind,type==='hero');if(this.lastMap.region===1)coatWithSnow(root,.06,type==='enemy'?.065:.028);item={key,root};this.units.set(entity.id,item);this.scene.add(root);}
    const {root}=item;root.visible=entity.alive!==false;
    root.userData.pick=type==='tower'?{type:'tower',id:entity.id}:type==='hero'&&entity.alive?{type:'hero',id:entity.id}:null;
    const baseY=type==='tower'?.17:(entity.air?1.45:.22);
    root.position.set(entity.x,baseY,entity.z);
    if(type==='tower'){
      const head=root.userData.head;if(head){head.rotation.y=entity.angle||0;const recoil=this.game.time-entity.attackAt<.12?.07:0;head.position.x=-Math.sin(entity.angle||0)*recoil;head.position.z=-Math.cos(entity.angle||0)*recoil;}
      if(entity.frozenUntil>this.game.time)root.position.y+=Math.sin(this.game.time*20)*.015;
    }else if(root.userData.asset){
      root.rotation.y=entity.angle||0;animateAsset(root,entity,type,this.game.time,dt);
      if(entity.air)root.position.y+=Math.sin(this.game.time*4+entity.id)*.08;
    }else{
      root.rotation.y=entity.angle||0;const walking=entity.path?.length||type==='enemy'&&!entity.blocker;
      root.position.y+=entity.air?Math.sin(this.game.time*4+entity.id)*.13:walking?Math.abs(Math.sin(this.game.time*7+entity.id))*.035:0;
      for(let i=0;i<(root.userData.legs?.length||0);i++)root.userData.legs[i].rotation.x=walking?Math.sin(this.game.time*8+i*Math.PI)*.38:0;
      for(let i=0;i<(root.userData.arms?.length||0);i++){
        const arm=root.userData.arms[i];if(entity.air)arm.rotation.z=Math.sin(this.game.time*8)*(i?-.5:.5);
        else arm.rotation.x=this.game.time-entity.attackAt<.22?-Math.sin((this.game.time-entity.attackAt)/.22*Math.PI)*1.15:walking?Math.sin(this.game.time*8+i*Math.PI)*.16:0;
      }
      root.rotation.z=this.game.time-entity.hurtAt<.12?.045:0;
    }accumulateSnow(root,dt);return root;
  }
  acquireBullet(kind){
    let pool=this.bulletPools.get(kind);if(!pool){pool=[];this.bulletPools.set(kind,pool);}
    let model=pool.pop();
    if(!model){let template=this.projectileTemplates.get(kind);if(!template){template=projectileModel(kind);this.projectileTemplates.set(kind,template);}model=template.clone(true);model.userData.projectileKind=kind;}
    model.rotation.set(0,0,0);return model;
  }
  releaseBullet(model){this.scene.remove(model);const pool=this.bulletPools.get(model.userData.projectileKind);if(pool&&pool.length<64)pool.push(model);}
  render(dt){
    this.wallTime+=dt;const g=this.game;
    if(g.map&&g.mode!=='menu'&&this.lastMap!==g.map)this.loadMap(g.map,false);
    const simDt=g.mode==='battle'&&!g.paused&&!g.warning?dt*g.speed:g.mode==='menu'?dt:0;
    const cinematicDt=this.defeat?.active&&!g.paused?dt:0;
    if(g.mode!=='menu'){
      const valid=new Set();
      for(const [entities,type] of [[g.towers,'tower'],[g.enemies,'enemy'],[g.guards,'guard'],[[g.hero],'hero']])for(const e of entities){if(!e)continue;valid.add(e.id);this.syncModel(e,type,simDt);}
      for(const [id,m] of this.units)if(!valid.has(id)){this.scene.remove(m.root);disposeModel(m.root);this.units.delete(id);}
      const active=new Set();
      for(const p of g.mode==='defeat'?[]:g.projectiles){if(p.kind==='melee')continue;active.add(p.id);let m=this.bullets.get(p.id);if(!m){m=this.acquireBullet(p.kind);this.bullets.set(p.id,m);this.scene.add(m);}
        const t=clamp(p.elapsed/p.duration,0,1),target=p.targetRef||(p.obstacle?g.scenery.find(e=>e.id===p.target):g.enemies.find(e=>e.id===p.target)),a=Math.atan2(p.to.x-p.from.x,p.to.z-p.from.z);
        const fromY=p.stats.level?(PROJECTILE_MOUNTS[p.kind]||2.25)+(p.stats.level-1)*.14:p.source===g.hero.id?1.2:1.1;
        const toY=target?.air?2.2:target?.boss?2.1:target?.kind==='siege'?1.05:.85;
        const offset=p.stats.level?(PROJECTILE_OFFSETS[p.kind]||0):.18,origin={x:p.from.x+Math.sin(a)*offset,z:p.from.z+Math.cos(a)*offset};
        const y=lerp(fromY,toY,t)+(p.kind==='cannon'?Math.sin(t*Math.PI)*3:0);
        m.position.set(lerp(origin.x,p.to.x,t),y,lerp(origin.z,p.to.z,t));m.rotation.y=a;
        m.rotation.x=p.kind==='cannon'?0:-Math.atan2(toY-fromY,Math.max(.01,distance(origin,p.to)));
        if(['arcane','nature','frost'].includes(p.kind))m.rotation.z=g.time*(p.kind==='nature'?5:3);
        if(this.settings.effects!=='minimal'&&simDt>0&&Math.random()<.65)this.effects.emit({x:m.position.x,y,z:m.position.z},p.kind==='cannon'?'fire':p.kind==='frost'?'frost':p.kind==='nature'?'nature':['arrow','ballista'].includes(p.kind)?'sun':'arcane',1,['arrow','ballista'].includes(p.kind)?.12:.23);
      }
      for(const [id,m] of this.bullets)if(!active.has(id)){this.releaseBullet(m);this.bullets.delete(id);}
      const zones=new Set();
      for(const z of g.mode==='defeat'?[]:g.zones){zones.add(z.id);let m=this.zoneMeshes.get(z.id);if(!m){m=this.makeRing(z.kind==='fire'?'#e8a566':z.kind==='trap'?'#82b66f':'#cdb79b');m.position.set(z.x,.23,z.z);m.scale.setScalar(z.radius);this.scene.add(m);this.zoneMeshes.set(z.id,m);}m.material.opacity=.48+.13*Math.sin(g.time*4);if(z.kind==='fire'&&simDt>0&&Math.random()<.32)this.effects.emit({x:z.x+(Math.random()-.5)*z.radius,y:.25,z:z.z+(Math.random()-.5)*z.radius},'fire',2,.55);}
      for(const [id,m]of this.zoneMeshes)if(!zones.has(id)){this.scene.remove(m);m.geometry.dispose();m.material.dispose();this.zoneMeshes.delete(id);}
    }
    const t=g.selected?.type==='tower'?g.towers.find(t=>t.id===g.selected.id):null;
    this.rangeRing.visible=!!t;if(t){this.rangeRing.position.set(t.x,.21,t.z);this.rangeRing.scale.setScalar(towerStats(t).range);}
    this.heroRing.visible=g.mode==='battle'&&g.hero.alive;if(this.heroRing.visible){this.heroRing.position.set(g.hero.x,.23,g.hero.z);this.heroRing.scale.setScalar(g.selected?.type==='hero'?.67:.43);}
    this.targetRing.visible=!!g.targeting&&!!this.targetPoint;if(this.targetRing.visible){this.targetRing.position.set(this.targetPoint.x,.23,this.targetPoint.z);this.targetRing.scale.setScalar(g.targeting.radius||.65);}
    const danger=g.mode==='battle'?g.enemies.find(e=>e.kind==='iceking'&&e.phaseWarn>g.time):null;
    this.dangerRing.visible=!!danger;if(danger){this.dangerRing.position.set(danger.x,.24,danger.z);this.dangerRing.scale.setScalar(6);this.dangerRing.material.opacity=.5+.3*Math.sin(g.time*12);}
    this.commandLife-=simDt;if(this.commandLife<=0)this.commandRing.visible=false;
    for(const portal of this.portals)portal.userData.core.material.uniforms.time.value+=simDt;
    for(const flag of this.flags)flag.userData.flag.material.uniforms.time.value+=simDt;
    if(this.defeat)this.defeat.update(cinematicDt);else updateTown(this.town,g,simDt);
    this.town?.smoke?.update(simDt,this.height,this.span,this.gpu.getPixelRatio());this.snowfall?.update(simDt||cinematicDt,this.height,this.span,this.settings.effects,this.gpu.getPixelRatio());
    for(const [id,m]of this.obstacleMeshes)m.userData.pick=g.mode==='battle'&&g.scenery.some(o=>o.id===id&&o.alive)?{type:'obstacle',id}:null;
    const snowMap=this.lastMap.region===1,buildMode=this.showGrid||g.selected?.type==='site';
    if(this.buildGrid){this.buildGrid.visible=g.mode==='battle';this.buildGrid.material.opacity=snowMap?(buildMode?.72:.14):(buildMode?.43:.12);}
    const selectedCell=g.selected?.type==='site'?(g.cells.find(s=>s.id===g.selected.id)||g.map.sites.find(s=>s.id===g.selected.id)):null,hoverCell=g.mode==='battle'&&!g.targeting&&this.targetPoint?g.cellAt(this.targetPoint):null;
    const marked=selectedCell||hoverCell;this.placementMarker.visible=!!marked&&!g.targeting&&g.selected?.type!=='hero'&&g.mode==='battle';this.placementFill.visible=this.placementMarker.visible&&snowMap;
    if(marked){const valid=g.placement(marked).ok;this.placementMarker.position.set(marked.x,.21,marked.z);this.placementMarker.material.color.set(valid?(snowMap?'#184b6b':'#e5f3b0'):'#c74d45');this.placementMarker.scale.setScalar(snowMap?1:.76);this.placementMarker.material.opacity=selectedCell?1:.88;
      this.placementFill.position.set(marked.x,.195,marked.z);this.placementFill.material.color.set(valid?'#79c6e9':'#ed8272');this.placementFill.material.opacity=selectedCell?.36:.2;
    }
    const clearing=g.scenery.find(o=>o.id===g.clearTarget&&o.alive);this.clearRing.visible=!!clearing&&g.mode==='battle';if(clearing){this.clearRing.position.set(clearing.x,.22,clearing.z);this.clearRing.scale.setScalar(.97);this.clearRing.material.opacity=.7+.2*Math.sin(g.time*5);}
    this.effects.ambient(this.lastMap.region,simDt);this.effects.update(simDt||cinematicDt,this.height,this.span);
    if(this.shake>0){this.shake=Math.max(0,this.shake-dt);this.camera.position.x+=(Math.random()-.5)*this.shake*.08;}
    this.gpu.render(this.scene,this.camera);this.drawFeedback(simDt);
  }
  drawFeedback(dt){
    const ctx=this.ctx,g=this.game;ctx.clearRect(0,0,this.width,this.height);ctx.textAlign='center';ctx.textBaseline='middle';
    if(g.mode==='battle'){
      for(const o of g.scenery)if(o.alive&&(o.id===g.clearTarget||g.time-o.hurtAt<2)){
        const p=this.project(o.x,o.z,o.kind==='tree'?3.1:o.kind==='pillar'?2.5:1.6);this.healthBar(p,38,o.hp/o.maxHp,'#c6a06b');
        if(o.id===g.clearTarget){ctx.font='600 10px sans-serif';ctx.fillStyle='#fff0bc';ctx.fillText('清除目标',p.x,p.y-13);}
      }
      for(const label of this.labels){const p=this.project(label.p.x,label.p.z,.15);const y=p.y+20;if(p.x<10||p.x>this.width-10)continue;ctx.font='600 10px "Microsoft YaHei",sans-serif';const w=ctx.measureText(label.text).width+14;ctx.fillStyle='#f4eadad9';ctx.beginPath();ctx.roundRect(p.x-w/2,y-9,w,18,4);ctx.fill();ctx.fillStyle=label.color;ctx.fillText(label.text,p.x,y);}
      for(const e of g.enemies){if(e.boss)continue;if(g.time-e.hurtAt>2.2&&!e.elite&&e.shield<=0)continue;const p=this.project(e.x,e.z,e.air?2.9:ENEMIES[e.kind].model==='siege'?1.8:1.95),w=e.elite?36:25;ctx.globalAlpha=e.elite||e.shield>0?1:clamp(2.2-(g.time-e.hurtAt),0,1);this.healthBar(p,w,e.hp/e.maxHp,e.shield>0?'#91b9ce':e.elite?'#aa6251':'#7b8e57');ctx.globalAlpha=1;if(e.shield>0){ctx.fillStyle='#aee6f0';ctx.fillRect(p.x-w/2,p.y+4,w*Math.min(1,e.shield/100),2);}if(e.stunUntil>g.time){ctx.fillStyle='#bfe2e9';ctx.fillText('冻',p.x,p.y-9);}else if(e.slowUntil>g.time){ctx.fillStyle='#eaf8fc';ctx.font='bold 9px sans-serif';ctx.fillText('缓',p.x,p.y-9);}else if(e.vulnerableUntil>g.time){ctx.fillStyle='#d4dc92';ctx.font='bold 9px sans-serif';ctx.fillText('易伤',p.x,p.y-9);}}
      for(const f of [g.hero,...g.guards])if(f.alive){const p=this.project(f.x,f.z,f===g.hero?2.12:f.kind==='tree'?3:1.88);this.healthBar(p,f===g.hero?35:22,f.hp/f.maxHp,'#8abb88');if(f.shield>0){ctx.fillStyle='#b8deed';ctx.fillRect(p.x-15,p.y+4,30*Math.min(1,f.shield/160),2);}}
      for(const t of g.towers)if(t.frozenUntil>g.time){const p=this.project(t.x,t.z,3);ctx.font='600 12px sans-serif';ctx.fillStyle='#edfaff';ctx.fillText(`冰封 ${Math.ceil(t.frozenUntil-g.time)}s`,p.x,p.y);}
    }
    for(const n of this.floats){n.age+=dt;if(n.age>1.05||!this.settings.numbers)continue;const p=this.project(n.x,n.z,n.air?2.7:1.5);ctx.globalAlpha=clamp((1.05-n.age)*2,0,1);ctx.font=`700 ${n.hp>90?16:13}px "Microsoft YaHei",sans-serif`;ctx.lineWidth=3;ctx.strokeStyle='#233c37';const text=n.kind==='heal'?`+${Math.round(n.hp)}`:n.shield>0?`${Math.round(n.hp)||''} ◇${Math.round(n.shield)}`:`${Math.max(1,Math.round(n.hp))}`;const y=p.y-n.age*28;ctx.strokeText(text,p.x,y);ctx.fillStyle=n.kind==='heal'?'#c4ecad':n.shield>0?'#bfeaf8':n.kind==='friendly-hit'?'#ffc2a2':'#fff1c3';ctx.fillText(text,p.x,y);ctx.globalAlpha=1;}
    this.floats=this.floats.filter(n=>n.age<=1.05);
  }
  healthBar(p,w,ratio,color){const c=this.ctx;c.fillStyle='#273e35';c.fillRect(p.x-w/2-1,p.y-3,w+2,6);c.fillStyle=color;c.fillRect(p.x-w/2,p.y-2,w*clamp(ratio,0,1),4);}
  metrics(){return {drawCalls:this.gpu.info.render.calls,triangles:this.gpu.info.render.triangles,geometries:this.gpu.info.memory.geometries,textures:this.gpu.info.memory.textures,units:this.units.size,particles:this.effects.particles.length,width:this.width,height:this.height,pixelRatio:this.gpu.getPixelRatio(),contextLost:this.contextLost,defeat:this.defeat?.snapshot()||null};}
}
