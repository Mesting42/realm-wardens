import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {Game} from '../src/game.js';
import {Store} from '../src/store.js';
import {ENDLESS,towerStats} from '../src/content.js';

const baseline=process.argv.includes('--baseline'),path='test-results/battle-performance-before.json';
if(baseline)assert.equal(await readFile(path,'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return null;}),null,'Preserve the original baseline');
const make=(kinds,map=ENDLESS[1])=>{
 const store=new Store({getItem:()=>null,setItem:()=>{}});store.progress.stars.fill(3);
 const g=new Game(store);g.start(map,'mage');g.scenery.forEach(o=>o.alive=false);g.gold=1e7;
 for(const c of g.cells)if(g.placement(c).ok){const t=g.build(c.id,kinds[g.towers.length%kinds.length]);g.upgrade(t.id);g.upgrade(t.id);g.specialize(t.id,g.towers.length%2);t.priority=['first','strong','near'][g.towers.length%3];}
 g.wave=80;g.waveActive=true;
 for(let i=0;i<88;i++){const r=i%g.map.routes.length;g.spawn(['armor','harpy','shield','frostguard','wolf','shaman','warlock'][i%7],r,3+(i%27)*.9,{noWarning:true});}
 return g;
};
const suites=[['mixed',['arrow','ballista','cannon','arcane','frost','thunder','nature','barracks']],['rapid',['arrow']],['thunder',['thunder']]],samples=[];
for(const [label,kinds] of suites){
 // Identical initial state, inputs and simulation time compare actual combat
 // before/after. The hash includes every event and entity/attack state.
 const g=make(kinds),hash=createHash('sha256'),timings=[],timed={};
 g.on(e=>hash.update(JSON.stringify(e)));
 for(const name of ['updateTowers','updateEnemies','updateFriends','targets','lightning','hitProjectile']){const original=g[name];timed[name]={ms:0,calls:0};g[name]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{timed[name].ms+=performance.now()-start;timed[name].calls++;}};}
 for(let i=0;i<900&&g.mode==='battle';i++){const start=performance.now();g.advance(1/30);timings.push(performance.now()-start);if(i%30===0)hash.update(JSON.stringify({snapshot:g.snapshot(),enemies:g.enemies,guards:g.guards,shots:g.projectiles.map(({targetRef,...p})=>p),towers:g.towers}));}
 timings.sort((a,b)=>a-b);
 samples.push({label,towers:g.towers.length,simulatedSeconds:g.time,eventAndStateHash:hash.digest('hex'),meanMs:timings.reduce((a,b)=>a+b,0)/timings.length,p95Ms:timings[Math.floor(timings.length*.95)],timed});
 console.log(JSON.stringify(samples.at(-1)));
}
if(!baseline){
 const old=JSON.parse(await readFile(path,'utf8'));
 for(const s of samples)assert.equal(s.eventAndStateHash,old.samples.find(x=>x.label===s.label).eventAndStateHash,s.label+' gameplay changed');
 // Single-target lookup must match the public sorted list, including stable
 // ties, exact range boundaries, dead units and ground/air restrictions.
 const g=make(['arrow']);
 for(const t of g.towers)for(const priority of ['first','near','strong'])for(const air of [false,true])assert.equal(g.target(t,{...towerStats(t),air},priority)?.id,g.targets(t,{...towerStats(t),air},priority)[0]?.id);
 const e=g.enemies[0];g.enemies=[{...e,id:1,x:3,z:4,hp:30,alive:true,air:false},{...e,id:2,x:3,z:4,hp:30,alive:true,air:false},{...e,id:3,x:0,z:0,hp:100,alive:false}];
 for(const priority of ['first','near','strong'])assert.equal(g.target({x:0,z:0},{range:5,air:true},priority)?.id,1);
 assert.equal(g.target({x:0,z:0},{range:4.999,air:true}),null);
  const dynamic=new Game(new Store({getItem:()=>null,setItem:()=>{}}));dynamic.start(ENDLESS[0]);dynamic.gold=10000;const cell=dynamic.cells.find(c=>dynamic.placement(c).ok),tower=dynamic.build(cell.id,'arcane'),enemy=dynamic.spawn('armor',0,0,{noWarning:true});enemy.x=tower.x+1;enemy.z=tower.z;
  const fire=()=>{tower.attackTimer=0;dynamic.updateTowers(1/30);const p=dynamic.projectiles.at(-1);assert.equal(p.stats.damage,towerStats(tower).damage);assert.equal(p.stats.level,tower.level);assert.equal(p.stats.spec,towerStats(tower).spec);return p;};
  const first=fire(),originalDamage=first.stats.damage;dynamic.upgrade(tower.id);fire();dynamic.upgrade(tower.id);fire();dynamic.specialize(tower.id,0);fire();assert.equal(first.stats.damage,originalDamage,'In-flight shots must retain launch stats when a tower is upgraded');
// Two wall-clock speeds must produce the same fixed-step state and events.
 const run=speed=>{const g=make(['arrow','barracks','thunder']);g.speed=speed;const events=[];g.on(e=>events.push(e));for(let i=0;i<300/speed;i++)g.advance(1/30);return{snapshot:g.snapshot(),events,towers:g.towers,enemies:g.enemies};};
 const a=run(1),b=run(2);assert.deepEqual(b,a,'2x must keep identical fixed-step combat');
}
await writeFile(baseline?path:'test-results/battle-performance-report.json',JSON.stringify({status:baseline?'baseline':'passed',scope:'Node CPU timings with instrumentation; explicit full level-3 specialized tower fixtures and 88 spawned enemies. Up to 30 simulated seconds or defeat (these dense mid-route fixtures lose at 6.7-9.2 seconds). Gameplay hashes compare all events and sampled states against pre-optimization code. Not normal economy or physical GPU FPS.',samples},null,2));
