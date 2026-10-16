import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {Store} from '../src/store.js';
import {ENDLESS} from '../src/content.js';
const trials=[];
for(const map of ENDLESS)for(const [label,kinds]of [['rapid',['arrow']],['thunder',['thunder']],['mixed',['arrow','ballista','cannon','arcane','frost','thunder','nature','barracks']]]){
 const store=new Store({getItem:()=>null,setItem:()=>{}});store.progress.stars.fill(3);const g=new Game(store);g.start(map,'mage');g.scenery.forEach(o=>o.alive=false);g.gold=1e7;
 for(const cell of g.cells)if(g.placement(cell).ok){const t=g.build(cell.id,kinds[g.towers.length%kinds.length]);g.upgrade(t.id);g.upgrade(t.id);g.specialize(t.id,0);}
 g.wave=200;g.waveActive=true;g.speed=2;g.hero.hp=g.hero.maxHp=1e10;
 // Deliberately stationary durable enemies sustain attacks for the entire
 // endurance run, independently of leaks or a player's defense balance.
 for(let i=0;i<88;i++){const route=i%map.routes.length,e=g.spawn(['armor','harpy','shield'][i%3],route,3+(i%25)*.8,{noWarning:true});e.hp=e.maxHp=1e10;e.speed=0;}
 let attacks=0,maxProjectiles=0,maxLive=0;g.on(e=>{if(e.type==='attack'||e.type==='lightning')attacks++;});
 for(let i=0;i<7200;i++){
  g.advance(1/60);maxProjectiles=Math.max(maxProjectiles,g.projectiles.length);maxLive=Math.max(maxLive,g.enemies.length);
  if(i%120===0){assert.equal(g.mode,'battle');assert.ok(g.events.length<=220);assert.ok(g.accumulator<=.6);assert.ok(g.projectiles.length<1000);for(const e of [...g.towers,...g.enemies,...g.guards,g.hero])for(const key of ['x','z','hp','attackTimer'])if(e[key]!==undefined)assert.ok(Number.isFinite(e[key]),`${map.id} ${label} ${key}`);}
 }
 assert.ok(Math.abs(g.time-240)<1e-8);assert.ok(maxLive<=88);assert.ok(attacks>1000);trials.push({map:map.id,label,towers:g.towers.length,simulatedSeconds:g.time,attacks,maxProjectiles,maxLive});console.log(JSON.stringify(trials.at(-1)));
}
await writeFile('test-results/battle-endurance-report.json',JSON.stringify({status:'passed',scope:'Nine deterministic 240-simulated-second 2x CPU endurance fixtures, with full legal paid level-3 specialized defenses, 88 stationary high-HP enemies and high-HP hero to sustain load. No graphics, normal economy/progression or physical-device FPS claim.',trials},null,2));
