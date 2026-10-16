import * as THREE from 'three';
import {unitModel,disposeModel} from './models.js';
import {animateAsset} from './assets.js';
import {updateTown} from './town.js';
import {coatWithSnow,accumulateSnow} from './weather.js';

export const DEFEAT_DURATION=6;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>1-Math.pow(1-clamp(t),3);
const randomFor=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const fractureRotation=`mat3 fractureRotation(vec3 a){
  vec3 c=cos(a),s=sin(a);
  return mat3(c.y*c.z,c.y*s.z,-s.y,s.x*s.y*c.z-c.x*s.z,s.x*s.y*s.z+c.x*c.z,s.x*c.y,c.x*s.y*c.z+s.x*s.z,c.x*s.y*s.z-s.x*c.z,c.x*c.y);
}`;

// Fragment the real model by triangle clusters. Preserve its UVs and materials,
// then batch the moving pieces per material instead of creating hundreds of
// individual meshes, lights or physics bodies.
function fractureModel(model,parent,clock,settings,seed){
  model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),clusters=new Map(),geometries=[];
  const slices=settings.effects==='minimal'?[2,2,2]:[3,3,2];
  model.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.visible)return;
    const geo=(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);geometries.push(geo);
    const p=geo.attributes.position,materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(let i=0;i<p.count;i+=3){
      const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
      const cell=[x,y,z].map((v,k)=>Math.min(slices[k]-1,Math.floor(clamp((v-box.min.getComponent(k))/Math.max(.01,size.getComponent(k)))*slices[k]))).join(':');
      const group=geo.groups.find(g=>i>=g.start&&i<g.start+g.count),mat=materials[group?.materialIndex||0],key=mat.uuid+cell;
      if(!clusters.has(key))clusters.set(key,{mat,triangles:[],pivot:new THREE.Vector3(),vertices:0});
      const c=clusters.get(key);c.triangles.push({geo,i});c.pivot.add(new THREE.Vector3(x,y,z));c.vertices++;
    }
  });
  const random=randomFor(seed),batches=new Map();let pieces=0;
  for(const c of clusters.values()){
    c.pivot.divideScalar(c.vertices);pieces++;
    const angle=Math.atan2(c.pivot.x-center.x,c.pivot.z-center.z),speed=.35+random()*1.15;
    const velocity=[Math.sin(angle)*speed,1.7+random()*2.1,Math.cos(angle)*speed],spin=[(random()-.5)*2.1,(random()-.5)*2.8,(random()-.5)*2.2];
    const settle=(velocity[1]+Math.sqrt(velocity[1]**2+19.2*Math.max(0,c.pivot.y-.18)))/9.6;
    const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...spin.map(v=>v*settle),'ZYX'));let low=0;
    for(const {geo,i}of c.triangles)for(let k=i;k<i+3;k++){const vertex=new THREE.Vector3().fromBufferAttribute(geo.attributes.position,k).sub(c.pivot).applyMatrix4(rotation);low=Math.min(low,vertex.y);}
    // Debris settles into a low grounded pile instead of leaving tall roof
    // triangles suspended above the street. Each cluster remains one rigid piece.
    const floor=.12-low*.28;
    if(!batches.has(c.mat))batches.set(c.mat,{position:[],normal:[],uv:[],color:[],pivot:[],velocity:[],spin:[],start:[],floor:[],settle:[]});
    const b=batches.get(c.mat);
    for(const {geo,i}of c.triangles)for(let k=i;k<i+3;k++){
      const {position:p,normal:n,uv:u,color:color}=geo.attributes;
      b.position.push(p.getX(k),p.getY(k),p.getZ(k));b.normal.push(n?n.getX(k):0,n?n.getY(k):1,n?n.getZ(k):0);b.uv.push(u?.getX(k)||0,u?.getY(k)||0);
      b.color.push(color?color.getX(k):1,color?color.getY(k):1,color?color.getZ(k):1);
      b.pivot.push(...c.pivot.toArray());b.velocity.push(...velocity);b.spin.push(...spin);b.start.push(clock.value);b.floor.push(floor);b.settle.push(settle);
    }
  }
  for(const [base,b]of batches){
    const geo=new THREE.BufferGeometry();for(const [name,key,n]of [['position','position',3],['normal','normal',3],['uv','uv',2],['color','color',3],['aPivot','pivot',3],['aVelocity','velocity',3],['aSpin','spin',3],['aStart','start',1],['aFloor','floor',1],['aSettle','settle',1]])geo.setAttribute(name,new THREE.Float32BufferAttribute(b[key],n));
    const mat=base.clone();mat.color?.multiplyScalar(.78);mat.customProgramCacheKey=()=>base.customProgramCacheKey()+'-warden-fracture-v1';
    mat.onBeforeCompile=(shader,renderer)=>{
      base.onBeforeCompile(shader,renderer);
      shader.uniforms.fractureTime=clock;
      shader.vertexShader=`uniform float fractureTime;attribute vec3 aPivot;attribute vec3 aVelocity;attribute vec3 aSpin;attribute float aStart;attribute float aFloor;attribute float aSettle;${fractureRotation}\n`+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        float fragmentAge=max(0.,fractureTime-aStart);
        float flatten=mix(1.,.28,smoothstep(aSettle-.12,aSettle+.22,fragmentAge));
        mat3 fragmentRotation=fractureRotation(aSpin*min(fragmentAge,aSettle));objectNormal=fragmentRotation*objectNormal;objectNormal.y/=flatten;`);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 pivot=aPivot+vec3(aVelocity.x*min(fragmentAge,1.1),0.,aVelocity.z*min(fragmentAge,1.1));
        pivot.y=max(aFloor,aPivot.y+aVelocity.y*fragmentAge-4.8*fragmentAge*fragmentAge);
        vec3 fragmentLocal=fragmentRotation*(position-aPivot);fragmentLocal.y*=flatten;transformed=fragmentLocal+pivot;`);
    };
    const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.name='Fractured masonry and roof';mesh.userData.ownedGeometry=true;mesh.userData.ownedMaterial=true;parent.add(mesh);
  }
  for(const geo of geometries)geo.dispose();model.visible=false;
  return {pieces,batches:batches.size};
}

class CityFire {
  constructor(root,clock){
    this.clock=clock;this.origins=[];this.capacity=16;
    const flameMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:clock},vertexShader:'varying vec2 vUv;varying float vSeed;void main(){vUv=uv;vSeed=instanceMatrix[3].x*3.+instanceMatrix[3].z;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:`uniform float time;varying vec2 vUv;varying float vSeed;
      void main(){float y=vUv.y;float x=vUv.x-.5;float sway=(sin(y*11.-time*5.4+vSeed)*.07+sin(y*21.+time*3.1)*.04)*y;
        float width=.36*pow(max(0.,1.-y),.7)+.025;float shape=(1.-smoothstep(width-.035,width+.055,abs(x+sway)))*smoothstep(0.,.12,y)*(1.-smoothstep(.76,1.,y));
        float core=(1.-smoothstep(.02,.18,abs(x+sway)))*(1.-y);vec3 color=mix(vec3(1.,.13,.025),vec3(1.,.64,.10),1.-y);color=mix(color,vec3(1.,.94,.58),core*.88);
        float alpha=shape*.88;if(alpha<.015)discard;gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`});
    this.flames=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),flameMat,this.capacity);this.flames.count=0;this.flames.frustumCulled=false;this.flames.renderOrder=3;this.flames.userData.ownedGeometry=true;this.flames.userData.ownedMaterial=true;root.add(this.flames);
    const count=240;this.positions=new Float32Array(count*3);this.sizes=new Float32Array(count);this.alphas=new Float32Array(count);
    const geo=new THREE.BufferGeometry();for(const [name,array,n]of [['position',this.positions,3],['aSize',this.sizes,1],['aAlpha',this.alphas,1]])geo.setAttribute(name,new THREE.BufferAttribute(array,n).setUsage(THREE.DynamicDrawUsage));
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{scale:{value:30}},vertexShader:'attribute float aSize;attribute float aAlpha;uniform float scale;varying float vAlpha;void main(){vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=max(2.,aSize*scale);}',fragmentShader:`varying float vAlpha;void main(){vec2 p=gl_PointCoord*2.-1.;float a=pow(max(0.,1.-length(p)),1.5)*vAlpha;if(a<.008)discard;gl_FragColor=vec4(.16,.14,.12,a);
      #include <colorspace_fragment>
    }`});
    this.smoke=new THREE.Points(geo,mat);this.smoke.frustumCulled=false;this.smoke.renderOrder=4;this.smoke.userData.ownedGeometry=true;this.smoke.userData.ownedMaterial=true;root.add(this.smoke);this.smoke.geometry.setDrawRange(0,0);
    this.dummy=new THREE.Object3D();
  }
  ignite(p,width=1,height=2.5){if(this.origins.length<this.capacity)this.origins.push({...p,width,height,start:this.clock.value});}
  update(renderer){
    const time=this.clock.value;this.flames.count=this.origins.length;
    this.origins.forEach((p,i)=>{const grow=ease((time-p.start)/.55),h=p.height*grow*(.94+.06*Math.sin(time*9+i));this.dummy.position.set(p.x,p.y+h*.45,p.z);this.dummy.quaternion.copy(renderer.camera.quaternion);this.dummy.scale.set(p.width*grow,h,1);this.dummy.updateMatrix();this.flames.setMatrixAt(i,this.dummy.matrix);});this.flames.instanceMatrix.needsUpdate=true;
    const per=renderer.settings.effects==='minimal'?7:15,count=this.origins.length*per;
    for(let i=0;i<count;i++){const p=this.origins[Math.floor(i/per)],age=(Math.max(0,time-p.start)+i*.213)%2.7,visible=time-p.start>i%per*.035;
      this.positions.set([p.x+age*.32+Math.sin(i*2.4+age)*age*.1,p.y+1.1+age*1.4,p.z+Math.cos(i*2.4)*age*.14],i*3);this.sizes[i]=.38+age*.58;this.alphas[i]=visible?Math.sin(Math.PI*age/2.7)*.40:0;}
    this.smoke.geometry.setDrawRange(0,count);this.smoke.material.uniforms.scale.value=renderer.height/renderer.span*renderer.gpu.getPixelRatio();for(const name of ['position','aSize','aAlpha'])this.smoke.geometry.attributes[name].needsUpdate=true;
  }
}

export class DefeatSequence {
  constructor(renderer){
    this.renderer=renderer;this.game=renderer.game;this.town=renderer.town;this.clock={value:0};this.active=true;this.finished=false;this.castleBroken=false;this.destroyed=0;this.pieces=0;this.fragmentBatches=0;this.attackCount=0;
    this.root=new THREE.Group();this.root.name='City fall presentation';renderer.scene.add(this.root);this.fire=new CityFire(this.root,this.clock);this.startView={...renderer.view};
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const center=this.town?.plan.center||{x:20,z:0};this.endView={zoom:1.8,x:center.x-6.5,z:center.z-1.5};
    this.homes=(this.town?.structures||[]).filter(s=>['home-a','home-b','tavern','blacksmith','market'].includes(s.kind));
    const kinds=[this.game.lastBreach?.kind,...this.game.enemies.filter(e=>e.alive).map(e=>e.kind), 'raider','wolf','armor','siege'].filter(Boolean);
    this.actors=this.homes.slice(0,5).map((home,i)=>{
      const gate=this.town.plan.gates[i%this.town.plan.gates.length],root=unitModel(kinds[i%kinds.length]),entry=this.town.navigation.nearest({x:gate.x+1.6,z:gate.z});this.root.add(root);
      if(this.game.map.region===1)coatWithSnow(root,.26,.065);
      const goal=this.town.navigation.nearest({x:home.box.min.x-.55,z:home.z});
      const path=this.town.navigation.path(entry,goal)||[goal];
      return {id:i,kind:kinds[i%kinds.length],root,home,x:gate.x-.9,z:gate.z,start:.62+i*.1,path:[entry,...path],attackAt:-99,hitAt:Infinity,nextAttack:0,hits:0,arrived:false};
    });
    this.casualties=this.town?.residents.filter(c=>[0,4,5].includes(c.id)).map((c,i)=>({c,start:3.15+i*.36,scale:c.root.scale.clone(),fate:c.kind==='child'||i===1?'light':'fall',emitted:false}))||[];
    for(const c of this.town?.residents||[])c.shoutTimer=c.id*.17;
    renderer.labels=renderer.labels.filter(l=>l.text!=='守城之心');renderer.effects.clear();renderer.floats=[];renderer.showGrid=false;renderer.commandLife=0;renderer.commandRing.visible=false;renderer.targetPoint=null;
    this.applyCamera();
  }
  get elapsed(){return this.clock.value;}
  get phase(){return this.elapsed<.65?'城堡崩塌':this.elapsed<2?'怪物冲入城镇':this.elapsed<4.6?'房屋遭袭 · 居民逃散':'城镇陷入火海';}
  applyCamera(){
    const t=this.reducedMotion?1:ease(this.elapsed/1.1);for(const key of ['x','z','zoom'])this.renderer.view[key]=this.startView[key]+(this.endView[key]-this.startView[key])*t;this.renderer.fitCamera();
  }
  shatter(model,p,castle=false){
    const result=fractureModel(model,this.root,this.clock,this.renderer.settings,37+this.destroyed*91+(castle?300:0));this.pieces+=result.pieces;this.fragmentBatches+=result.batches;
    this.renderer.effects.emit({...p,y:.8},'rubble',castle?90:46,castle?1.5:1);
    this.fire.ignite({...p,y:.3},castle?1.5:1.3,castle?2.9:2.7);
    if(this.renderer.settings.effects!=='minimal')this.fire.ignite({x:p.x+.6,y:.35,z:p.z+.5},.9,1.9);
    this.game.event('city-collapse',{...p,castle});
    this.renderer.shake=(castle?.24:.12)*this.renderer.settings.shake;
  }
  update(dt){
    if(!this.active||dt<=0)return;
    this.clock.value=Math.min(DEFEAT_DURATION,this.elapsed+dt);this.applyCamera();
    if(!this.castleBroken&&this.elapsed>=.18){this.castleBroken=true;for(const c of this.renderer.castles)this.shatter(c,{x:c.position.x,z:c.position.z},true);}
    for(const flag of this.renderer.flags){const p=clamp((this.elapsed-.2)/.8);flag.position.y=-3.4*p;flag.rotation.z=p*.9;flag.visible=p<1;}
    if(this.town){this.town.alarm=10;updateTown(this.town,this.game,dt);}
    for(const a of this.actors){
      if(this.elapsed<a.start){a.root.visible=false;continue;}a.root.visible=true;
      if(!a.announced){a.announced=true;this.game.event('city-invasion',{kind:a.kind,x:a.x,z:a.z});}
      let moving=false;
      const to=a.path[0];if(to){const d=Math.hypot(to.x-a.x,to.z-a.z),step=Math.min(d,(6.2+a.id*.2)*dt);if(d>.001){a.x+=(to.x-a.x)/d*step;a.z+=(to.z-a.z)/d*step;a.root.rotation.y=Math.atan2(to.x-a.x,to.z-a.z);moving=true;}if(d<=step+.025)a.path.shift();}
      a.arrived=a.path.length===0;
      if(a.arrived){a.root.rotation.y=Math.atan2(a.home.x-a.x,a.home.z-a.z);
        if(this.elapsed>=a.nextAttack){a.attackAt=this.elapsed;a.hitAt=this.elapsed+.23;a.nextAttack=this.elapsed+.85;}
        if(this.elapsed>=a.hitAt){a.hitAt=Infinity;a.hits++;this.attackCount++;this.game.event('city-attack',{kind:a.kind,x:a.home.x,z:a.home.z});this.renderer.effects.impact({x:a.home.x,z:a.home.z,y:1.05},'melee');
          if(!a.home.destroyed){a.home.destroyed=true;this.destroyed++;this.shatter(a.home.root,{x:a.home.x,z:a.home.z});}}
      }
      a.root.position.set(a.x,['bat','harpy','wisp'].includes(a.kind)?1.45:.18,a.z);
      animateAsset(a.root,{alive:true,path:moving?[{}]:[],blocker:a.arrived?1:null,attackAt:a.attackAt},'enemy',this.elapsed,dt);
      accumulateSnow(a.root,dt);
      if(a.arrived)a.root.rotation.x=Math.sin(clamp((this.elapsed-a.attackAt)/.55)*Math.PI)*.10;
    }
    for(const f of this.casualties){const {c}=f;if(this.elapsed<f.start)continue;
      c.defeatState=f.fate==='fall'?'fallen':'vanished';c.path=[];c.root.userData.mixer?.stopAllAction();const p=ease((this.elapsed-f.start)/.8);
      if(f.fate==='fall'){c.root.rotation.z=-Math.PI/2*p;c.root.position.y=.15+.12*p;}
      else{c.root.scale.copy(f.scale).multiplyScalar(1-p);c.root.position.y=.15+p*.6;if(!f.emitted){f.emitted=true;this.renderer.effects.emit({x:c.x,z:c.z,y:1},'sun',28,.6);}if(p>=1)c.root.visible=false;}
    }
    this.fire.update(this.renderer);
    this.emberTimer=(this.emberTimer||0)-dt;if(this.emberTimer<=0){this.emberTimer=.18;for(const p of this.fire.origins)this.renderer.effects.emit({...p,y:.65},'fire',2,.35);}
    this.rumbleTimer=(this.rumbleTimer||0)-dt;if(this.fire.origins.length&&this.rumbleTimer<=0){this.rumbleTimer=.95;this.game.event('city-fire',{x:this.town?.plan.center.x||20,z:this.town?.plan.center.z||0});}
    if(this.elapsed>=DEFEAT_DURATION)this.finish(false);
  }
  finish(skipped=false){if(this.finished)return;this.active=false;this.finished=true;this.game.event('defeat-ready',{skipped,duration:this.elapsed});}
  dispose(){this.root.removeFromParent();disposeModel(this.root);this.root.clear();this.active=false;}
  snapshot(){return {active:this.active,elapsed:this.elapsed,duration:DEFEAT_DURATION,phase:this.phase,castleBroken:this.castleBroken,destroyed:this.destroyed,pieces:this.pieces,fragmentBatches:this.fragmentBatches,fires:this.fire.origins.length,smoke:this.fire.smoke.geometry.drawRange.count,attacks:this.attackCount,actors:this.actors.map(a=>({kind:a.kind,x:a.x,z:a.z,arrived:a.arrived,hits:a.hits,animation:a.root.userData.animation})),residents:this.town?.residents.map(c=>({id:c.id,x:c.x,z:c.z,state:c.defeatState||'escaping'}))||[]};}
}
