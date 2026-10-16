import * as THREE from 'three';
import {assetScenery,assetCitizen} from './assets.js';
import {part,beam,compactStaticModel} from './models.js';
import {coatWithSnow,accumulateSnow,ChimneySmoke} from './weather.js';
import {townNavigation} from './town-navigation.js';

// Chimney openings in the authored GLB coordinate frames, verified against
// their stone atlas vertices; the tavern roof finial is not its chimney.
const CHIMNEYS={'home-a':[0,.945,-.35],'home-b':[.14,1.295,-.42],tavern:[-.14,1.41,-.07],blacksmith:[.21,.995,-.14]};

export function townPlan(map){
  const ends=map.routes.map(r=>r.at(r.length));
  // All authored routes end at the eastern wall. One compact town protects all gates.
  const gate=ends[0],z=ends.reduce((s,e)=>s+e.z,0)/ends.length-2;
  return {gate,gates:ends,center:{x:20.1,z},minX:14.7,maxX:26.1,minZ:z-7.5,maxZ:z+6.8};
}
function townWalls(buildings,plan){
  const left=15.35,right=plan.maxX,near=plan.maxZ,far=plan.minZ;
  const wall=(x1,z1,x2,z2)=>{
    const length=Math.hypot(x2-x1,z2-z1);if(length<.001)return;
    const chunks=Math.ceil(length/1.35),step=length/chunks,angle=Math.atan2(x2-x1,z2-z1);
    // Masonry blocks meet edge to edge; the cap joins adjacent sides at corners.
    for(let i=0;i<chunks;i++){
      const t=(i+.5)/chunks,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;
      part(buildings,'box','#91988a',x,.6,z,.32,1.15,step+.006,[0,angle,0]);
      part(buildings,'box','#d0c5a9',x,1.22,z,.43,.17,step+.025,[0,angle,0]);
    }
  };
  wall(left,far,right,far);wall(left,near,right,near);wall(right,far,right,near);
  // Leave only the authored castle entrances open, including maps with two gates.
  const openings=plan.gates.map(g=>[Math.max(far,g.z-1.9),Math.min(near,g.z+1.9)]).filter(([a,b])=>a<b).sort((a,b)=>a[0]-b[0]);
  let cursor=far;
  for(const [a,b]of openings){if(a>cursor)wall(left,cursor,left,a);cursor=Math.max(cursor,b);}
  if(cursor<near)wall(left,cursor,left,near);
}
export function createTown(map,{miniature=false}={}){
  const root=new THREE.Group(),buildings=new THREE.Group(),structures=[],residents=[],windmills=[],chimneys=[],footprints=[],plan=townPlan(map),z=plan.center.z;
  root.add(buildings);
  const paving=map.region===1?'#b0c6c8':map.region===2?'#978376':'#bfb394';
  part(buildings,'box',paving,20.2,.05,z,11.2,.08,2.2);
  part(buildings,'box',paving,20.9,.055,z,1.65,.09,12.8);
  for(const gate of plan.gates){const dx=2.1,dz=z-gate.z;part(buildings,'box',paving,15.15,.065,(gate.z+z)/2,1.18,.08,Math.hypot(dx,dz),[0,Math.atan2(dx,dz),0]);}
  for(let i=0;i<24;i++)for(const side of [-1,1])part(buildings,'box',i%2?'#a79f8e':'#c5bba0',15.2+i*.44,.1,z+side*.96,.35,.07,.17);
  const homes=[['home-a',16.8,z-3.25,3.1],['home-b',16.8,z+3.35,3.15],['tavern',20.4,z-4.45,3.5],['market',20.1,z+4.35,3.45],['blacksmith',24,z-3.25,3.35],['home-a',24,z+3.5,3.1],['windmill',24.8,z-6,2.6],['well',22.65,z+.4,1.2],['cart',18.3,z+1.45,1.2]];
  for(const [kind,x,d,width]of homes){
    const model=assetScenery(kind,width);model.position.set(x,.1,d);model.rotation.y=d<z&&kind!=='windmill'?Math.PI:0;root.add(model);model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model);footprints.push({minX:box.min.x+.12,maxX:box.max.x-.12,minZ:box.min.z+.12,maxZ:box.max.z-.12});
    structures.push({kind,root:model,x,z:d,width,box,destroyed:false});
    if(CHIMNEYS[kind]&&model.children[0])chimneys.push(model.children[0].localToWorld(new THREE.Vector3(...CHIMNEYS[kind])));
    const fan=kind==='windmill'?model.getObjectByName('building_windmill_top_fan_blue'):null;
    if(fan){root.attach(fan);fan.name='Windmill rotor';windmills.push(fan);if(map.region===1)coatWithSnow(fan,.4,0);}
    compactStaticModel(model);if(map.region===1)coatWithSnow(model,.58,0);
  }
  for(const x of [15.5,20.9,25.4])for(const side of [-1,1]){const lamp=assetScenery('lantern',.45);lamp.position.set(x,.15,z+side*1.25);buildings.add(lamp);}
  // A complete perimeter encloses the town; castle gateways remain accessible.
  townWalls(buildings,plan);
  for(const x of [17.5,23])for(const side of [-1,1])for(let i=0;i<5;i++){const d=z+side*6.25;beam(buildings,'#807352',[x+i*.23,.15,d],[x+i*.23,.75,d],.04);beam(buildings,'#a08d69',[x,.42,d],[x+1,.42,d],.025);}
  const navigation=townNavigation(plan,footprints);
  if(!miniature)for(let i=0;i<8;i++){
    const kind=['farmer','merchant','child'][i%3],model=assetCitizen(kind),lane=(i%2?-.42:.42),waypoints=[{x:16.2,z:z+lane},{x:20.9,z:z+lane},{x:20.9,z:z+(i%2?-2.3:2.3)},{x:24.5,z:z+lane}];
    const start=navigation.nearest(waypoints[i%waypoints.length]);model.position.set(start.x,.15,start.z);root.add(model);
    if(map.region===1)coatWithSnow(model,.2,.008);
    residents.push({id:i,kind,root:model,x:start.x,z:start.z,waypoints:waypoints.map(p=>navigation.nearest(p)),index:(i+1)%4,wait:i*.27,panic:false,speed:kind==='child'?.8:.65,path:[],goal:null,panicLeg:0,shoutTimer:0});
  }
  const smoke=miniature?null:new ChimneySmoke(root,chimneys,map.region);
  root.name='Sheltered town';return {root,buildings,structures,residents,windmills,chimneys,smoke,navigation,plan,alarm:0};
}
function escapeRoute(town,c,threats){
  const slots=[[18.8,-6.2],[18.8,5.8],[25.1,-1],[25.1,1.7],[21.1,-2],[21.1,2],[23.4,-6.2],[23.4,5.8]],slot=slots[(c.id+c.panicLeg*3)%slots.length],preferred={x:slot[0],z:town.plan.center.z+slot[1]};
  const distance=p=>threats.length?Math.min(...threats.map(e=>Math.hypot(e.x-p.x,e.z-p.z))):20;
  const goals=town.navigation.goals.filter(p=>Math.hypot(c.x-p.x,c.z-p.z)>1.3&&distance(p)>6&&!town.residents.some(other=>other!==c&&other.goal&&Math.hypot(p.x-other.goal.x,p.z-other.goal.z)<.65));
  goals.sort((a,b)=>(Math.hypot(a.x-preferred.x,a.z-preferred.z)-distance(a)*.16)-(Math.hypot(b.x-preferred.x,b.z-preferred.z)-distance(b)*.16));
  for(const goal of goals){const path=town.navigation.path(c,goal);if(path){c.goal=goal;c.path=path;c.panicLeg++;return;}}
  c.path=[];c.goal=null;c.wait=.4;
}
export function updateTown(town,game,dt){
  if(!town||dt<=0)return;
  for(const fan of town.windmills)fan.rotation.z-=dt*.7;
  town.alarm=Math.max(0,town.alarm-dt);const threats=(game.enemies||[]).filter(e=>e.alive&&town.plan.gates.some(g=>Math.hypot(e.x-g.x,e.z-g.z)<8)),threat=town.alarm>0||threats.length>0;
  for(const c of town.residents){
    if(c.defeatState==='fallen'||c.defeatState==='vanished')continue;
    if(c.panic!==threat){const actions=c.root.userData.actions||{},old=actions[c.panic?'Panic':'Walk'],next=actions[threat?'Panic':'Walk'];old?.fadeOut(.2);next?.reset().fadeIn(.2).play();c.panic=threat;c.path=[];c.goal=null;c.wait=threat?0:.35;c.shoutTimer=c.id*.17;if(threat)escapeRoute(town,c,threats);}
    if(threat){c.shoutTimer-=dt;if(c.shoutTimer<=0){if(game.mode==='battle'||game.mode==='defeat')game.event('citizen-panic',{kind:c.kind,x:c.x,z:c.z,resident:c.id});c.shoutTimer=4.8+c.id*.37;}}
    let moving=false;
    if(c.wait>0)c.wait-=dt;
    else{
      if(!c.path.length){if(threat)escapeRoute(town,c,threats);else{c.goal=c.waypoints[c.index];c.path=town.navigation.path(c,c.goal)||[];}}
      const to=c.path[0];if(to){const d=Math.hypot(to.x-c.x,to.z-c.z),step=Math.min(d,c.speed*(threat?2.9:1)*dt);if(d>0){c.x+=(to.x-c.x)/d*step;c.z+=(to.z-c.z)/d*step;c.root.rotation.y=Math.atan2(to.x-c.x,to.z-c.z);moving=true;}if(d<=step+.02){c.path.shift();if(!c.path.length){if(!threat)c.index=(c.index+1)%c.waypoints.length;c.wait=threat?.12+c.id*.025:.4+(c.index%2)*.7;}}}
    }
    c.root.position.set(c.x,.15,c.z);const mixer=c.root.userData.mixer;if(mixer){mixer.timeScale=moving?threat?1.6:.9:.05;mixer.update(dt);}accumulateSnow(c.root,dt);
  }
}

export function castleFlag(region){
  const root=new THREE.Group();beam(root,'#c9ad69',[0,3,0],[0,4.65,0],.035);part(root,'sphere','#f1d393',0,4.72,0,.075,.075,.075);
  const geo=new THREE.PlaneGeometry(1.15,.7,14,8);geo.translate(.59,4.13,0);
  const color=['#3c8968','#416e9d','#a55642'][region];
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{time:{value:0},tint:{value:new THREE.Color(color)}},vertexShader:'uniform float time; varying vec2 vUv; void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*6.-time*3.2)*.13*uv.x;p.y+=sin(p.x*5.-time*2.6)*.045*uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'uniform vec3 tint; varying vec2 vUv; void main(){float trim=step(vUv.y,.06)+step(.94,vUv.y);vec2 p=vUv-vec2(.47,.52);float shield=step(abs(p.x),.11)*step(abs(p.y),.22)*step(-.21,p.y-abs(p.x)*.55);float cross=step(abs(p.x),.025)*step(abs(p.y),.16)+step(abs(p.y-.035),.025)*step(abs(p.x),.085);vec3 col=mix(tint,vec3(.88,.74,.43),clamp(trim+shield*.8+cross,0.,1.));gl_FragColor=vec4(col,1.);}' });
  const flag=new THREE.Mesh(geo,mat);flag.userData.ownedGeometry=true;flag.userData.ownedMaterial=true;root.add(flag);root.userData.flag=flag;return root;
}
