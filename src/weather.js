import * as THREE from 'three';

// Material clones share textures and a shader program, but own accumulation.
// World-space upward normals include skinning: snow follows backs and shoulders.
export function coatWithSnow(root,initial=.08,rate=.022){
  if(root.userData.snow)return;
  const coverage={value:initial},clones=new Map();root.userData.snow={coverage,rate};root.userData.snowMaterials=new Set();
  const coat=base=>{
    if(!base.isMeshStandardMaterial||base.userData.noSnow)return base;
    if(clones.has(base))return clones.get(base);
    const mat=base.clone();mat.customProgramCacheKey=()=> 'warden-snow-v1';
    mat.onBeforeCompile=shader=>{
      shader.uniforms.snowCoverage=coverage;
      shader.vertexShader='varying float vSnowUp; varying vec3 vSnowPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvSnowUp=inverseTransformDirection(transformedNormal, viewMatrix).y;');
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvSnowPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader='uniform float snowCoverage; varying float vSnowUp; varying vec3 vSnowPosition;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float patches=.88+.12*sin(vSnowPosition.x*2.3+sin(vSnowPosition.z*1.6))*sin(vSnowPosition.z*2.9);
        float snow=smoothstep(.2,.8,vSnowUp)*snowCoverage*patches;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.91,.97,1.),snow);`);
    };
    clones.set(base,mat);root.userData.snowMaterials.add(mat);return mat;
  };
  root.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(coat):coat(o.material);});
}
export function accumulateSnow(root,dt){const s=root.userData.snow;if(s)s.coverage.value=Math.min(.95,s.coverage.value+dt*s.rate);}

export class Snowfall{
  constructor(scene){
    this.scene=scene;this.time=0;this.count=1440;this.positions=new Float32Array(this.count*3);this.sizes=new Float32Array(this.count);this.seeds=[];
    for(let i=0;i<this.count;i++){this.seeds.push(Math.random()*6.28);this.positions.set([-26+Math.random()*62,.2+Math.random()*17,-21+Math.random()*44],i*3);this.sizes[i]=i%5===0?.3:.12+Math.random()*.07;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
    geo.setAttribute('aSize',new THREE.BufferAttribute(this.sizes,1));geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{scale:{value:35},ratio:{value:1}},vertexShader:'attribute float aSize; uniform float scale; uniform float ratio; void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(scale*aSize*(1.+position.y*.025),4.*ratio,16.*ratio);}',fragmentShader:`void main(){vec2 p=gl_PointCoord*2.-1.;float r=length(p),a=atan(p.y,p.x);float arms=pow(abs(cos(a*3.)),6.)*(1.-smoothstep(.3,.88,r));float core=1.-smoothstep(.1,.48,r);float shape=max(arms,core);float rim=max(arms,1.-smoothstep(.12,.67,r));float alpha=max(shape*.94,rim*.38);if(alpha<.035)discard;vec3 color=mix(vec3(.48,.64,.74),vec3(.98,1.,1.),smoothstep(.18,.7,shape));gl_FragColor=vec4(color,alpha);}`});
    this.points=new THREE.Points(geo,mat);this.points.frustumCulled=false;this.points.renderOrder=4;scene.add(this.points);
  }
  update(dt,height,span,effects,pixelRatio=1){
    this.time+=dt;const count=effects==='minimal'?320:effects==='standard'?900:this.count;
    this.points.geometry.setDrawRange(0,count);this.points.material.uniforms.scale.value=height/span*pixelRatio;this.points.material.uniforms.ratio.value=pixelRatio;
    if(dt>0){for(let i=0;i<this.count;i++){const k=i*3;this.positions[k]+=(.4+Math.sin(this.time*.8+this.seeds[i])*.42)*dt;this.positions[k+1]-=(1.05+(i%7)*.13)*dt;this.positions[k+2]+=(.12+Math.cos(this.time+this.seeds[i])*.16)*dt;if(this.positions[k+1]<.15||this.positions[k]>36){this.positions[k+1]=16+Math.random();this.positions[k]=-26+Math.random()*62;this.positions[k+2]=-21+Math.random()*44;}}this.points.geometry.attributes.position.needsUpdate=true;}
  }
  dispose(){this.scene.remove(this.points);this.points.geometry.dispose();this.points.material.dispose();}
}

export class ChimneySmoke{
  constructor(root,origins,region){
    this.origins=origins;this.time=0;this.count=origins.length*22;this.ages=new Float32Array(this.count);this.positions=new Float32Array(this.count*3);this.sizes=new Float32Array(this.count);this.alphas=new Float32Array(this.count);
    for(let i=0;i<this.count;i++)this.ages[i]=(i%22)/22*4.4;
    const geo=new THREE.BufferGeometry();for(const [name,array,size]of [['position',this.positions,3],['aSize',this.sizes,1],['aAlpha',this.alphas,1]])geo.setAttribute(name,new THREE.BufferAttribute(array,size).setUsage(THREE.DynamicDrawUsage));
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{scale:{value:35},tint:{value:new THREE.Color(region===1?'#8799a2':region===2?'#a29e96':'#b5b3a8')}},vertexShader:'attribute float aSize; attribute float aAlpha; uniform float scale; varying float vAlpha; void main(){vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=max(2.,aSize*scale);}',fragmentShader:`uniform vec3 tint; varying float vAlpha; void main(){vec2 p=gl_PointCoord*2.-1.;float r=length(p);float alpha=pow(max(0.,1.-r),1.3)*vAlpha;if(alpha<.008)discard;gl_FragColor=vec4(tint,alpha);
      #include <colorspace_fragment>
    }`});
    this.points=new THREE.Points(geo,mat);this.points.frustumCulled=false;this.points.renderOrder=2;this.points.userData.ownedGeometry=true;this.points.userData.ownedMaterial=true;root.add(this.points);this.update(0,1080,28.5);
  }
  update(dt,height,span,pixelRatio=1){
    this.time+=dt;this.points.material.uniforms.scale.value=height/span*pixelRatio;
    for(let i=0;i<this.count;i++){const age=this.ages[i]=(this.ages[i]+dt)%4.4,u=age/4.4,origin=this.origins[Math.floor(i/22)],seed=i*2.399;
      this.positions.set([origin.x+age*age*.07+Math.sin(age*2+seed)*age*.055,origin.y+age*.52,origin.z+age*.085+Math.cos(age*1.6+seed)*age*.035],i*3);
      this.sizes[i]=.22+age*.27;this.alphas[i]=Math.sin(Math.PI*u)*.28;
    }
    for(const name of ['position','aSize','aAlpha'])this.points.geometry.attributes[name].needsUpdate=true;
  }
}
