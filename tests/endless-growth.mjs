import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {Store} from '../src/store.js';
import {ENDLESS,ENEMIES,enemyScale,wavePlan} from '../src/content.js';
import {act} from './bot.mjs';

const baseline=process.argv.includes('--baseline');
if(baseline){const existing=await readFile('test-results/endless-growth-before.json','utf8').catch(error=>{if(error.code!=='ENOENT')throw error;return null;});assert.equal(existing,null,'The pre-change baseline already exists; preserve its original evidence');}
const makeGame=map=>{const store=new Store({getItem:()=>null,setItem:()=>{}});store.progress.stars.fill(3);const game=new Game(store);assert.ok(game.start(map,'mage'));return game;};
const stats=(game,kind,wave)=>{game.enemies=[];game.wave=wave;const e=game.spawn(kind,0,0,{noWarning:true});return {hp:e.maxHp,armor:e.armor,resist:e.resist,speed:e.speed};};
const samples=[1,5,10,20,40,80,81,85,100,120,160,200,1000,100000].map(wave=>{const g=makeGame(ENDLESS[0]);return {wave,scale:enemyScale(g.map,wave),imp:stats(g,'imp',wave),armor:stats(g,'armor',wave),boss:stats(g,'iceking',wave)};});
const checks=[],battles=[];
if(!baseline){
  for(const map of ENDLESS){
    const g=makeGame(map),previous=new Map();
    for(const wave of [...Array.from({length:200},(_,i)=>i+1),1000,100000]){
      assert.ok(wavePlan(map,wave).length<=45);
      for(const kind of Object.keys(ENEMIES)){
        const current=stats(g,kind,wave),last=previous.get(kind);
        for(const value of Object.values(current))assert.ok(Number.isFinite(value)&&value>=0);
        assert.ok(current.armor<.85&&current.resist<.85,'Resistance must leave actual damage and penetration meaningful');
        if(last)for(const field of ['hp','armor','resist','speed'])assert.ok(current[field]>last[field],`${map.id} ${kind} wave ${wave}: ${field} stopped increasing`);
        previous.set(kind,current);
      }
    }
    let lastBoss=null;
    for(let wave=5;wave<=200;wave+=5){const kind=wavePlan(map,wave).find(e=>ENEMIES[e.kind].boss).kind,current=stats(g,kind,wave);if(lastBoss)for(const field of ['hp','armor','resist','speed'])assert.ok(current[field]>lastBoss[field],`A later scheduled Boss must not lose ${field} when its model rotates`);lastBoss=current;}
    g.enemies=[];for(let i=0;i<200;i++)g.spawn('imp',0,0,{noWarning:true});assert.equal(g.enemies.length,88);
  }
  checks.push('All 18 enemy/Boss templates on all 3 maps gain HP, armor, resistance and speed every wave through 200, plus finite high-wave samples at 1,000 and 100,000');
  checks.push('Scheduled Boss HP, armor, resistance and speed increase across every model rotation through wave 200; defenses stay below 85%, and wave/live-entity counts keep their 45/88 limits');
}

function saturatedBattle(map,wave,strategy){
  const g=makeGame(map),kinds=strategy==='mixed'?['arcane','ballista','thunder','frost','nature','cannon','arrow']:['ballista','ballista','arcane','arcane','thunder','nature','arrow','frost'];
  // Explicit late-game fixture: removed obstacles, unlocked mage, and enough
  // setup money. Every tower still uses legal paid build/upgrade/spec actions.
  g.scenery.forEach(o=>{o.alive=false;});g.cleared=g.scenery.length;g.gold=1e7;
  for(const cell of g.cells){if(!g.placement(cell).ok)continue;const tower=g.build(cell.id,kinds[g.towers.length%kinds.length]);assert.ok(tower);assert.ok(g.upgrade(tower.id));assert.ok(g.upgrade(tower.id));assert.ok(g.specialize(tower.id,0));}
  assert.equal(g.cells.filter(c=>g.placement(c).ok).length,0,'All currently legal cells must be filled');
  assert.ok(g.towers.every(t=>t.level===3&&t.spec!==null));
  const spawns=new Map(),killed=[],leaks=[];let complete=false,lastSkill=-1,maxLive=0;
  const off=g.on(event=>{
    if(event.type==='spawn'){const e=g.enemies.find(n=>n.id===event.id);spawns.set(e.id,{kind:e.kind,boss:e.boss,at:g.time,hp:e.maxHp,armor:e.armor,resist:e.resist,speed:e.speed});}
    if(event.type==='death'){const e=g.enemies.find(n=>n.id===event.id),start=spawns.get(event.id);killed.push({...start,lifetime:g.time-start.at,progress:e.d/g.map.routes[e.route].length});}
    if(event.type==='leak')leaks.push({kind:event.kind,at:g.time,damage:event.amount});
    if(event.type==='wave-clear'&&event.wave===wave)complete=true;
  });
  g.wave=wave-1;assert.ok(g.beginWave());
  for(let loops=0;loops<(baseline?6000:24000)&&g.mode==='battle'&&!complete;loops++){
    if(Math.floor(g.time)!==lastSkill){lastSkill=Math.floor(g.time);act(g);}
    g.advance(.1);maxLive=Math.max(maxLive,g.enemies.filter(e=>e.alive).length);
  }
  off();
  if(!baseline)assert.ok(complete||g.mode==='defeat',`Wave ${wave} fixture reached the time limit without a result`);
  const normal=killed.filter(e=>!e.boss),boss=killed.filter(e=>e.boss);
  return {map:map.id,wave,strategy,towers:g.towers.length,cells:g.cells.length,allLegalCellsFilled:true,complete,mode:g.mode,time:g.time,lives:g.lives,maxLive,spawned:spawns.size,killed:killed.length,ordinaryMeanLifetime:normal.reduce((s,e)=>s+e.lifetime,0)/(normal.length||1),ordinaryMaxProgress:Math.max(0,...normal.map(e=>e.progress)),bossKills:boss,leaks};
}

for(const map of ENDLESS)for(const strategy of ['mixed','piercing']){const battle=saturatedBattle(map,80,strategy);battles.push(battle);console.log(JSON.stringify({map:battle.map,strategy,wave:80,towers:battle.towers,complete:battle.complete,lives:battle.lives,meanLifetime:battle.ordinaryMeanLifetime,maxProgress:battle.ordinaryMaxProgress}));}
for(const wave of (baseline?[120,200]:[20,40,60,120,200]))battles.push(saturatedBattle(ENDLESS[0],wave,'piercing'));
if(!baseline){
  const before=JSON.parse(await readFile('test-results/endless-growth-before.json','utf8'));
  for(const current of battles.filter(b=>b.wave===80)){
    const old=before.battles.find(b=>b.map===current.map&&b.wave===80&&b.strategy===current.strategy);
    assert.ok(current.ordinaryMeanLifetime>old.ordinaryMeanLifetime*2,'Late enemies must survive appreciably longer against the same fully upgraded defense');
    assert.ok(current.ordinaryMaxProgress>old.ordinaryMaxProgress,'Late enemies must travel farther than the old capped enemies');
    assert.ok(current.maxLive<=88);
  }
  assert.ok(battles.some(b=>b.wave>=120&&b.mode==='defeat'),'The fixed full defense must eventually be overwhelmed');
  checks.push('All six wave-80 full-defense fixtures show more than twice the old enemy lifetime and farther travel; later fixed full defenses can be overwhelmed');
}
const result={status:baseline?'baseline':'passed',date:'2026-10-07',verification:'Deterministic game simulation. Late-game fixtures explicitly remove obstacles, unlock the mage, grant setup money and choose the starting wave. All buildings use paid legal actions and reach level 3 plus specialization; actual enemy spawning, combat, hero skills, leaks and result rules remain active. This is not normal progression from 200 gold, browser play or physical-device validation.',checks,samples,battles};
await writeFile(`test-results/endless-growth-${baseline?'before':'report'}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,checks:checks.length,battles:battles.length}));
