import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {Store} from '../src/store.js';
import {LEVELS,HEROES,ENEMIES,BOSSES,bossProfile,activeRoutes,wavePlan,enemyScale} from '../src/content.js';
import {play,prepare,nextSite,act} from './bot.mjs';

await mkdir('test-results',{recursive:true});
const before=JSON.parse(await readFile('tests/fixtures/campaign-before-rebalance.json','utf8'));
const checks=[],runs=[],negative=[],mechanics=[],failures=[];
const scenario=(map,hero='knight')=>{const s=new Store({getItem:()=>null,setItem:()=>{}});s.progress.stars.fill(3);const g=new Game(s);assert.ok(g.start(map,hero));return g;};
const check=(name,fn)=>{try{fn();checks.push(name);console.log('PASS '+name);}catch(e){failures.push({name,error:e.stack});console.error('FAIL '+name+' '+e.message);}};
check('Every campaign begins with 200 gold and a single light scouting lane; multi-route pressure opens only after two wave incomes',()=>{
  for(const m of LEVELS){assert.equal(m.gold,200);for(const wave of [1,2])assert.deepEqual([...new Set(wavePlan(m,wave).map(e=>e.route))],[0]);const first=wavePlan(m,1);assert.equal(first.length,8);assert.ok(first.every(e=>['imp','wolf'].includes(e.kind)));assert.ok(first.reduce((n,e)=>n+ENEMIES[e.kind].hp*enemyScale(m,1).hp,0)<1400);assert.ok(first.every((e,i)=>!i||e.at-first[i-1].at>=1.8));if(m.routes.length>1)assert.deepEqual(activeRoutes(m,3),[0,1]);if(m.routes.length===3){const w=m.id===12?6:5;assert.deepEqual(activeRoutes(m,w-1),[0,1]);assert.deepEqual(activeRoutes(m,w),[0,1,2]);assert.ok(wavePlan(m,w).find(e=>e.route===2).at>=8);}}
});
check('All twelve final waves contain exactly one distinct named boss with a supported animated base model, after the escort schedule',()=>{
  assert.equal(new Set(BOSSES.map(b=>b.id)).size,12);assert.equal(new Set(BOSSES.map(b=>b.name)).size,12);assert.equal(new Set(BOSSES.map(b=>b.mechanic)).size,12);
  for(const m of LEVELS){for(let w=1;w<=m.waveCount;w++){const p=wavePlan(m,w),bosses=p.filter(e=>e.bossId||ENEMIES[e.kind].boss);assert.equal(bosses.length,w===m.waveCount?1:0);assert.ok(p.every(e=>e.route<m.routes.length&&Number.isFinite(e.at)));if(bosses.length){const b=bossProfile(bosses[0].bossId);assert.equal(b.id,m.bossId);assert.ok(ENEMIES[b.kind]);assert.equal(p.at(-1),bosses[0]);assert.ok(bosses[0].at-p.at(-2).at>=3);}}assert.deepEqual(wavePlan(m,m.waveCount+1),[]);}
});
check('The user two-arrow opening survives every first wave with 40 gold left, without extra purchases or opening clearance',()=>{
  for(const map of LEVELS){const g=scenario(map,map.id>=3?'ranger':'knight');for(let i=0;i<2;i++)assert.ok(g.build(nextSite(g).id,'arrow'));assert.equal(g.gold,40);const point=g.nearestRoad(g.towers[0]);g.moveHero(point);g.beginWave();let last=-1;while(g.mode==='battle'&&g.wave===1&&g.time<120){if(Math.floor(g.time/5)!==last){last=Math.floor(g.time/5);act(g);}g.advance(.1);}assert.equal(g.wave,2,`two-arrow first wave ${map.id}`);assert.equal(g.lives,20);assert.equal(g.cleared,0);assert.equal(g.towers.length,2);}
});
check('Twelve boss profiles execute their own telegraphs, shield, rage, summons, freeze or recovery rather than inheriting ordinary enemy support behavior',()=>{
  for(const m of LEVELS){const g=scenario(m),b=bossProfile(m.bossId),e=g.spawn(b.kind,0,10,{bossId:b.id,noWarning:true});assert.equal(e.boss,true);assert.equal(e.name,b.name);assert.equal(e.leak,20);assert.equal(e.damage,b.damage);assert.equal(e.elite,false);
    g.hero.x=e.x;g.hero.z=e.z;g.hero.path=[];e.hp=e.maxHp*.2;e.phaseTimer=0;
    g.updateBoss(e,.1);const warning=e.phaseWarn;g.time=4;g.updateBoss(e,.1);g.time=8;g.updateBoss(e,.1);
    if(b.mechanic==='roots')assert.equal(g.enemies.filter(n=>n.guardian===e.id).length,2);
    if(b.mechanic==='bulwark'){assert.ok(e.shield>0);const hp=e.hp;g.damage(e,30,'magic');assert.ok(e.hp<hp);e.shield=0;g.updateBoss(e,.1);assert.ok(e.vulnerableUntil>g.time);}
    if(b.mechanic==='rage'||b.mechanic==='siege'||b.mechanic==='gust')assert.ok(e.vulnerableUntil>g.time);
    if(b.mechanic==='crystal')assert.ok(e.phase===2&&e.shield===0&&e.vulnerableUntil>g.time);
    if(['pack','rift','legions'].includes(b.mechanic)){assert.ok(g.enemies.some(n=>n.guardian===e.id));assert.ok(g.enemies.length<=5);}
    if(b.mechanic==='winter'){assert.ok(e.weakUntil>4);assert.ok(warning>0);}
    if(b.mechanic==='aegis'||b.mechanic==='cleave')assert.ok(g.events.some(n=>n.type==='boss-phase'));
    const phases=g.events.filter(n=>n.type==='boss-phase').map(n=>n.text);assert.ok(phases.length>0);const gold=g.gold;g.kill(e);assert.equal(g.gold,gold+e.reward);assert.equal(g.kill(e),false);assert.equal(g.gold,gold+e.reward);mechanics.push({boss:b.id,name:b.name,phases,telegraph:warning});
  }
});
check('New boss entries pause on a correctly named two-second warning; queue spawning applies the profile and restart removes encounter state',()=>{
  for(const m of LEVELS){const g=scenario(m);g.wave=m.waveCount;g.waveActive=true;g.queue=[wavePlan(m,m.waveCount).at(-1)];g.waveTime=g.queue[0].at;g.step(1/30);const e=g.enemies.find(e=>e.boss);assert.ok(e);assert.equal(e.bossId,m.bossId);assert.equal(g.warning.name,bossProfile(m.bossId).name);const t=g.time,d=e.d;g.advance(.2);assert.equal(g.time,t);assert.equal(e.d,d);g.setPaused(true);const left=g.warning.remaining;g.advance(.2);assert.equal(g.warning.remaining,left);g.restart();assert.equal(g.gold,200);assert.equal(g.warning,null);assert.equal(g.enemies.length,0);}
});
check('Winter freezes at most the two nearest in-range towers for two seconds; the other towers retain fire and the boss becomes weaker',()=>{
  const map=LEVELS[7],g=scenario(map),b=bossProfile(map.bossId),e=g.spawn(b.kind,0,10,{bossId:b.id,noWarning:true});g.towers=[1,2,3,8].map((d,i)=>({id:100+i,x:e.x+d,z:e.z,frozenUntil:0}));e.phaseTimer=0;g.updateBoss(e,.1);assert.ok(g.towers.every(t=>t.frozenUntil===0));g.time=1.6;g.updateBoss(e,.1);assert.equal(g.towers.filter(t=>t.frozenUntil>g.time).length,2);assert.equal(g.towers[0].frozenUntil,3.6);assert.equal(g.towers[2].frozenUntil,0);const hp=e.hp;g.damage(e,100,'true');assert.ok(Math.abs((hp-e.hp)-155)<1e-8);
});
check('Cross-route reinforcements use a different route at both thresholds, stay bounded, and emit actual portal spawn events',()=>{
  for(const map of [LEVELS[5],LEVELS[9],LEVELS[11]]){const g=scenario(map),b=bossProfile(map.bossId),e=g.spawn(b.kind,0,10,{bossId:b.id,noWarning:true});e.hp=e.maxHp*.2;g.updateBoss(e,.1);g.time=2;g.updateBoss(e,.1);g.time=4;g.updateBoss(e,.1);const guards=g.enemies.filter(n=>n.guardian===e.id);assert.equal(guards.length,4);assert.ok(guards.every(n=>n.route!==e.route&&n.d===0));assert.equal(g.events.filter(n=>n.type==='spawn'&&n.portal).length,4);}
});
check('Every level is winnable with mixed and physical-led towers, one purchase per three seconds, earned gold and no opening clearance',()=>{
  for(const style of ['mixed','physical'])for(const map of LEVELS){const hero=map.id>=3?'ranger':'knight',g=scenario(map,hero),waves=[];g.on(e=>{if(e.type==='wave')waves.push({wave:e.wave,gold:g.gold,lives:g.lives,routes:e.routes});});const r=play(g,{style,cadence:3});assert.equal(r.mode,'victory',`${map.id} ${style}`);assert.equal(g.cleared,0);assert.deepEqual(r.bossIds,[map.bossId]);runs.push({level:map.id,hero,style,cadence:3,mode:r.mode,lives:r.lives,time:r.time,cleared:g.cleared,kills:r.kills,towers:r.towers,bossIds:r.bossIds,phases:r.phases,waves});}
});
check('All heroes available at each campaign stage have a viable path with slower five-second decisions and no preparation income',()=>{
  for(const map of LEVELS)for(const hero of Object.keys(HEROES).filter(k=>HEROES[k].unlock<map.id)){const g=scenario(map,hero),r=play(g,{cadence:5});assert.equal(r.mode,'victory',`${map.id} ${hero}`);assert.equal(g.cleared,0);runs.push({level:map.id,hero,style:'mixed',cadence:5,mode:r.mode,lives:r.lives,time:r.time,cleared:0,kills:r.kills,bossIds:r.bossIds});}
});
check('The late campaign still punishes an unchanged two-tower opening: neglecting reinvestment cannot defeat the final army',()=>{
  for(const id of [9,10,12]){const g=scenario(LEVELS[id-1],'ranger');prepare(g);assert.equal(g.towers.length,2);g.beginWave();while(g.mode==='battle'&&g.time<1200)g.advance(.1);assert.equal(g.mode,'defeat',`idle opening ${id}`);negative.push({level:id,mode:g.mode,wave:g.wave,time:g.time,lives:g.lives,towers:g.towers.length});}
});
const levels=LEVELS.map(m=>({id:m.id,name:m.name,boss:bossProfile(m.bossId).name,before:before.levels[m.id-1],waves:Array.from({length:m.waveCount},(_,i)=>{const w=i+1,p=wavePlan(m,w),scale=enemyScale(m,w);return {wave:w,routes:activeRoutes(m,w),count:p.length,spawnSpan:p.at(-1).at,hp:Math.round(p.reduce((n,e)=>n+(e.bossId?bossProfile(e.bossId):ENEMIES[e.kind]).hp*scale.hp,0)),enemies:Object.fromEntries([...new Set(p.map(e=>e.bossId||e.kind))].map(k=>[k,p.filter(e=>(e.bossId||e.kind)===k).length]))};})}));
await writeFile('test-results/campaign-balance-report.json',JSON.stringify({status:failures.length?'failed':'passed',date:'2026-10-06',verification:'Deterministic normal-rule simulation; campaign completion runs start with 200 earned-only gold, no obstacle clearance, no HP/currency/enemy mutation. Three/five second decisions limit investment to one action per decision after the opening, and hero repositioning to wave boundaries. Unlock fixtures select available heroes only. Boss mechanism checks are explicit unit fixtures, not browser playthroughs.',checks,failures,levels,runs,negative,mechanics},null,2));
console.log(JSON.stringify({status:failures.length?'failed':'passed',checks:checks.length,runs:runs.length,negative,failures:failures.map(f=>({name:f.name,error:f.error.split('\n')[0]}))}));if(failures.length)process.exitCode=1;
