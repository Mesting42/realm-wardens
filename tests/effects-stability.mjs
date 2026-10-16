import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {Effects} from '../src/effects.js';
const scene=new THREE.Scene(),fx=new Effects(scene),checks=[],measurements=[];
const reset=()=>{fx.clear();assert.equal(scene.children.length,1);assert.equal(fx.points.geometry.drawRange.count,0);assert.equal(fx.arcPool.length+fx.burstPool.length+fx.particlePool.length,0);};
// Expired impacts are reused with their original transforms and opacity.
for(const kind of ['arrow','ballista','cannon','arcane','frost','nature','thunder','melee']){
 fx.impact({x:1,z:2,y:1.2,angle:.7,kind});const old=fx.bursts[0],origin=old.mesh.children.map(m=>m.position.clone());fx.update(.2,800,29);fx.update(1,800,29);assert.equal(fx.bursts.length,0);
 fx.impact({x:3,z:4,y:2.2,angle:1.1,kind});assert.equal(fx.bursts[0],old);assert.equal(old.mesh.position.y,kind==='cannon'?.35:2.2);assert.equal(old.mesh.children[0].rotation.y,1.1);assert.equal(old.mesh.scale.x,1);
 old.mesh.children.forEach((m,i)=>assert.ok(m.position.equals(origin[i])));reset();
}
checks.push('All eight impact kinds reuse geometry and restore position, ring direction, scale and child offsets');
// Reused tubes must match a fresh Three.js TubeGeometry, not a distorted path.
fx.arc({x:0,z:0},[{x:3,y:2,z:1}]);const tubes=fx.arcs.map(a=>a.mesh.geometry);fx.update(1,800,29);fx.arc({x:2,z:1},[{x:-1,y:.9,z:4}]);
assert.ok(fx.arcs.every(a=>tubes.includes(a.mesh.geometry)));
for(const a of fx.arcs){const geometry=a.mesh.geometry;assert.ok([...geometry.attributes.position.array].every(Number.isFinite));const sphere=geometry.boundingSphere;assert.ok(Number.isFinite(sphere.radius)&&sphere.radius>0);const expected=new THREE.TubeGeometry(geometry.parameters.path,16,geometry.parameters.radius,4,false);for(const name of ['position','normal'])geometry.attributes[name].array.forEach((value,i)=>assert.ok(Math.abs(value-expected.attributes[name].array[i])<1e-6));expected.dispose();}
checks.push('Lightning reuses tube buffers, matches fresh Three.js tube vertices/normals and refreshes culling bounds');reset();
for(const [effects,limit]of [['rich',384],['standard',192],['minimal',96]]){
 fx.settings.effects=effects;
 for(let cycle=0;cycle<80;cycle++){
  for(let i=0;i<8;i++){fx.arc({x:0,z:0},Array.from({length:6},(_,j)=>({x:1+j*.5,y:1,z:2})));fx.impact({x:1,z:1,kind:['cannon','arrow','frost','nature'][i%4]});fx.emit({x:0,z:0},'arcane',100);}
  fx.update(1/30,800,29);
  assert.ok(fx.arcs.length<=limit&&fx.arcPool.length<=128&&fx.bursts.length<=48&&fx.burstPool.length<=48&&fx.particles.length<=750&&fx.particlePool.length<=750);
 }
 measurements.push({effects,arcs:fx.arcs.length,arcPool:fx.arcPool.length,bursts:fx.bursts.length,burstPool:fx.burstPool.length,particles:fx.particles.length});
}
checks.push('Changing effect quality under a sustained 6-link lightning / impact storm respects all active and pooled object caps');
// Every owned effect buffer/material must be disposed once at map teardown.
const disposed=new Map(),watched=new Set();for(const e of [...fx.arcs,...fx.arcPool,...fx.bursts,...fx.burstPool])e.mesh.traverse(m=>{if(m.isMesh)for(const resource of [m.geometry,m.material])if(!watched.has(resource)){watched.add(resource);disposed.set(resource,0);resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));}});
reset();for(const count of disposed.values())assert.equal(count,1);checks.push('Map teardown releases every active/pooled effect geometry and material exactly once, leaving only the reusable particle system');
await writeFile('test-results/effects-stability-report.json',JSON.stringify({status:'passed',checks,measurements,disposedResources:disposed.size},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length,measurements,disposedResources:disposed.size}));
