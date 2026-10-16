import * as THREE from 'three';
import { clamp } from './routes.js';

const PALETTES={rubble:['#b8aa93','#928475','#5b5551','#aca79d'],fire:['#fff2c4','#ffb55d','#cf7141','#857b70'],frost:['#f0ffff','#a1ddeb','#69abc1','#d6e5e6'],nature:['#edf2b0','#a6c279','#60936b','#c7d7a2'],arcane:['#eee0ff','#c2a7ea','#917abe','#c5b9d3'],sun:['#fff5cc','#e9c778','#c5a568','#eee6c8']};
const COLORS=Object.fromEntries(Object.entries(PALETTES).map(([kind,colors])=>[kind,colors.map(color=>new THREE.Color(color))]));
const disposeEffect=effect=>{effect.mesh.removeFromParent();effect.mesh.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});};
// Refill an existing tube instead of allocating and deleting WebGL buffers on
// every chain hit. UVs and indices are constant for all 16 x 4 tubes.
function updateTube(geometry,curve,frames,radius){
  geometry.parameters.path=curve;geometry.parameters.radius=radius;
  const positions=geometry.attributes.position,normals=geometry.attributes.normal,point=new THREE.Vector3();
  for(let i=0;i<=16;i++){
    curve.getPointAt(i/16,point);const n=frames.normals[i],b=frames.binormals[i];
    for(let j=0;j<=4;j++){const v=j/4*Math.PI*2,c=-Math.cos(v),s=Math.sin(v),x=c*n.x+s*b.x,y=c*n.y+s*b.y,z=c*n.z+s*b.z,index=i*5+j;normals.setXYZ(index,x,y,z);positions.setXYZ(index,point.x+radius*x,point.y+radius*y,point.z+radius*z);}
  }
  positions.needsUpdate=true;normals.needsUpdate=true;geometry.computeBoundingSphere();
}
export class Effects {
  constructor(scene){
    this.particles=[];this.particlePool=[];this.arcs=[];this.arcPool=[];this.bursts=[];this.burstPool=[];this.limit=750;this.settings={effects:'rich'};this.ambientTimer=0;
    const count=this.limit,g=new THREE.BufferGeometry();
    this.positions=new Float32Array(count*3);this.colors=new Float32Array(count*3);this.sizes=new Float32Array(count);this.alphas=new Float32Array(count);
    g.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize',new THREE.BufferAttribute(this.sizes,1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha',new THREE.BufferAttribute(this.alphas,1).setUsage(THREE.DynamicDrawUsage));
    this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uScale:{value:30}},vertexShader:'attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vColor; varying float vAlpha; void main(){vColor=aColor;vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.,aSize*uScale);}',fragmentShader:'varying vec3 vColor; varying float vAlpha; void main(){vec2 uv=gl_PointCoord*2.-1.;float d=length(uv);float a=pow(max(0.,1.-d),1.65)*vAlpha;if(a<.008)discard;gl_FragColor=vec4(vColor,a);}',blending:THREE.NormalBlending});
    this.points=new THREE.Points(g,this.material);this.points.frustumCulled=false;this.points.renderOrder=3;scene.add(this.points);this.scene=scene;
  }
  emit(p,kind='fire',n=18,size=1){
    const mult=this.settings.effects==='minimal'?.35:this.settings.effects==='standard'?.65:1;
    const palette=COLORS[kind]||COLORS.arcane;
    for(let i=0;i<Math.ceil(n*mult)&&this.particles.length<this.limit;i++){
      const angle=Math.random()*Math.PI*2,speed=(.5+Math.random()*2.6)*size,smoke=i%4===3;
      const particle=this.particlePool.pop()||{};Object.assign(particle,{x:p.x,y:p.y??.8,z:p.z,vx:Math.cos(angle)*speed,vy:smoke?.65:1.5+Math.random()*2.8,vz:Math.sin(angle)*speed,size:(smoke?.55:.22)*size,color:palette[i%4],life:smoke?1.35:.45+Math.random()*.45,age:0,smoke,gravity:smoke?0:3});this.particles.push(particle);
    }
  }
  arc(a,points){
    let prev={x:a.x,y:2.55,z:a.z};const limit=this.settings.effects==='minimal'?96:this.settings.effects==='standard'?192:384;
    for(const p of points){
      const vertices=[new THREE.Vector3(prev.x,prev.y,prev.z)],end=new THREE.Vector3(p.x,p.y??.95,p.z);
      for(let i=1;i<5;i++)vertices.push(new THREE.Vector3(prev.x,prev.y,prev.z).lerp(end,i/5).add(new THREE.Vector3((Math.random()-.5)*.3,(Math.random()-.5)*.4,(Math.random()-.5)*.3)));
      vertices.push(end);const curve=new THREE.CatmullRomCurve3(vertices),frames=curve.computeFrenetFrames(16,false);
      for(const [radius,color,opacity]of [[.045,'#b5d9ff',.36],[.017,'#faffff',1]]){
        while(this.arcs.length>=limit)this.releaseArc(this.arcs.shift());
        let arc=this.arcPool.pop();
        if(!arc){const geom=new THREE.TubeGeometry(curve,16,radius,4,false),mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});geom.attributes.position.setUsage(THREE.DynamicDrawUsage);geom.attributes.normal.setUsage(THREE.DynamicDrawUsage);arc={mesh:new THREE.Mesh(geom,mat)};}
        else updateTube(arc.mesh.geometry,curve,frames,radius);
        arc.life=.24;arc.opacity=opacity;arc.mesh.material.color.set(color);arc.mesh.material.opacity=opacity;this.scene.add(arc.mesh);this.arcs.push(arc);
      }prev={...p,y:p.y??.95};
    }
  }
  impact(p,kind=p.kind){
    const palette=kind==='cannon'?'fire':kind==='frost'?'frost':kind==='nature'?'nature':['arcane','thunder'].includes(kind)?'arcane':'sun';
    this.emit(p,palette,kind==='cannon'?46:kind==='ballista'?18:12,kind==='cannon'?1.25:.48);
    if(this.settings.effects==='minimal')return;
    if(this.bursts.length>=48)this.removeBurst(this.bursts.shift());
    const cached=this.burstPool.findIndex(b=>b.kind===kind);
    if(cached>=0){const b=this.burstPool.splice(cached,1)[0];b.life=b.total;b.mesh.position.set(p.x,kind==='cannon'?.35:p.y??.95,p.z);b.mesh.scale.setScalar(1);b.mesh.children[0].rotation.y=p.angle||0;b.mesh.traverse(o=>{if(o.isMesh){o.position.copy(o.userData.origin);o.material.opacity=o.userData.opacity;}});this.scene.add(b.mesh);this.bursts.push(b);return;}
    const colors={arrow:'#ffe9a2',ballista:'#fff5cb',cannon:'#ffa74f',arcane:'#bc8aff',frost:'#bcefff',nature:'#b3db81',thunder:'#d2faff',melee:'#fff6d8'};
    const group=new THREE.Group(),color=colors[kind]||colors.arcane;group.position.set(p.x,p.y??.95,p.z);
    const lifetime=kind==='cannon'?.65:kind==='nature'?.6:.38;
    const ring=new THREE.Mesh(new THREE.RingGeometry(kind==='melee'?.65:.24,kind==='melee'?.8:.29,kind==='frost'?6:32,1,kind==='melee'?-.4:0,kind==='melee'?2.2:Math.PI*2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.88,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    ring.rotation.set(kind==='cannon'?-Math.PI/2:.35,p.angle||0,kind==='melee'?-.5:0);group.add(ring);
    if(['arcane','frost','nature','cannon'].includes(kind)){
      const n=kind==='frost'?6:kind==='nature'?5:8;
      for(let i=0;i<n;i++){const a=i/n*Math.PI*2,geo=kind==='nature'?new THREE.SphereGeometry(.09,5,3):kind==='frost'?new THREE.OctahedronGeometry(.12):new THREE.SphereGeometry(.06,5,4),mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false});const m=new THREE.Mesh(geo,mat);m.position.set(Math.sin(a)*.32,Math.cos(a)*.32,0);if(kind==='nature')m.scale.set(.5,1.6,.6);m.userData.direction=new THREE.Vector3(Math.sin(a),Math.cos(a),.12*(i%2?1:-1));group.add(m);}
    }
    if(kind==='cannon'){const core=new THREE.Mesh(new THREE.SphereGeometry(.35,12,8),new THREE.MeshBasicMaterial({color:'#fff3bb',transparent:true,opacity:.85,depthWrite:false}));group.add(core);group.position.y=.35;}
    group.traverse(o=>{if(o.isMesh){o.userData.origin=o.position.clone();o.userData.opacity=o.material.opacity;}});
    this.scene.add(group);this.bursts.push({mesh:group,life:lifetime,total:lifetime,kind});
  }
  removeBurst(b){this.scene.remove(b.mesh);if(this.burstPool.length>=48)disposeEffect(this.burstPool.shift());this.burstPool.push(b);}
  releaseArc(arc){this.scene.remove(arc.mesh);if(this.arcPool.length>=128)disposeEffect(this.arcPool.shift());this.arcPool.push(arc);}
  ambient(region,dt){
    if(dt<=0||this.settings.effects==='minimal')return;
    this.ambientTimer-=dt;if(this.ambientTimer>0||this.particles.length>=this.limit-10)return;this.ambientTimer=.16;
    if(region===1)return;const snow=false,ember=region===2;
    this.particles.push({x:(Math.random()-.5)*(ember?26:29),y:snow?4+Math.random()*2:ember?.5:1+Math.random()*2,z:ember?-10.7+(Math.random()-.5)*.5:(Math.random()-.5)*21,vx:snow?.12:.04,vy:snow?-1.1:ember?.6:.12,vz:snow?.1:0,size:snow?.09:ember?.09:.07,color:new THREE.Color(snow?'#f0f6f1':ember?'#f0ba78':'#d6dd9e'),life:snow?4.6:3.2,age:0,smoke:false,gravity:0});
  }
  update(dt,height,span){
    this.material.uniforms.uScale.value=height/span;
    let count=0;
    for(const p of this.particles){p.age+=dt;if(p.age>=p.life){if(this.particlePool.length<this.limit)this.particlePool.push(p);continue;}p.vy-=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      const offset=count*3;this.positions[offset]=p.x;this.positions[offset+1]=p.y;this.positions[offset+2]=p.z;this.colors[offset]=p.color.r;this.colors[offset+1]=p.color.g;this.colors[offset+2]=p.color.b;this.particles[count]=p;
      this.sizes[count]=p.size*(p.smoke?1+p.age*1.4:1-.3*p.age/p.life);this.alphas[count]=clamp(1-p.age/p.life,0,1)*(p.smoke?.38:1);count++;
    }
    this.particles.length=count;this.points.geometry.setDrawRange(0,count);
    for(const key of ['position','aColor','aSize','aAlpha']){const attribute=this.points.geometry.attributes[key];attribute.clearUpdateRanges();if(count)attribute.addUpdateRange(0,count*attribute.itemSize);attribute.needsUpdate=true;}
    for(const arc of this.arcs){arc.life-=dt;arc.mesh.material.opacity=Math.max(0,arc.life/.24)*(arc.opacity??1);if(arc.life<=0)this.releaseArc(arc);}
    this.arcs=this.arcs.filter(a=>a.life>0);
    for(const b of this.bursts){b.life-=dt;const t=1-b.life/b.total;b.mesh.scale.setScalar(1+t*(b.kind==='cannon'?4:1.8));b.mesh.traverse(o=>{if(o.isMesh){o.material.opacity=Math.max(0,1-t)*.85;if(o.userData.direction)o.position.addScaledVector(o.userData.direction,dt*.55);}});if(b.life<=0)this.removeBurst(b);}
    this.bursts=this.bursts.filter(b=>b.life>0);
  }
  clear(){this.particles=[];this.particlePool=[];this.ambientTimer=0;for(const effect of [...this.arcs,...this.arcPool,...this.bursts,...this.burstPool])disposeEffect(effect);this.arcs=[];this.arcPool=[];this.bursts=[];this.burstPool=[];this.points.geometry.setDrawRange(0,0);}
}
