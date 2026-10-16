import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const baseline=process.argv.includes('--baseline'),path='test-results/battle-performance-browser-before.json';
if(baseline)assert.equal(await readFile(path,'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return null;}),null,'Preserve the original baseline');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const errors=[],evidence={};
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}}),p=await context.newPage();
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto('http://127.0.0.1:5175/?safe=1');await p.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});
 if(await p.locator('#display-root').isVisible())await p.locator('[data-display-enter]').click();
 await p.evaluate(()=>{const a=window.__REALM_WARDENS__;a.game.start(a.content.ENDLESS[1]);a.game.setPaused(true);a.game.wave=23;a.game.selected={type:'site',id:a.game.cells.find(c=>a.game.placement(c).ok).id};a.ui.update(1);});
 await p.waitForFunction(()=>document.querySelectorAll('#selection-panel img.ready').length===8,null,{timeout:30000});
 evidence.icons=await p.evaluate(async()=>{
  const a=window.__REALM_WARDENS__,g=a.game,panel=document.getElementById('selection-panel'),original=[...panel.querySelectorAll('img')];g.gold=1000;g.speed=2;a.ui.update(1);
  const observer=new MutationObserver(()=>{});observer.observe(panel,{childList:true,subtree:true});
  const samples=[];
  for(let i=0;i<36;i++){
   // Real death/reward/revision events, one per RAF, reproduce the panel race
   // independently of renderer speed or a player's particular save file.
   await new Promise(requestAnimationFrame);g.enemies=[];const e=g.spawn('wolf',0,1,{noWarning:true});g.kill(e);a.ui.update(1/60);
   samples.push({replaced:[...panel.querySelectorAll('img')].some((n,i)=>n!==original[i]),ready:panel.querySelectorAll('img.ready').length});
  }
  const mutations=observer.takeRecords().filter(m=>[...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1)).length;observer.disconnect();
  g.setPaused(true);a.ui.update(1);await new Promise(r=>setTimeout(r,800));
  return{samples,mutations,pausedReady:panel.querySelectorAll('img.ready').length};
 });
 if(!baseline){assert.equal(evidence.icons.samples.some(s=>s.replaced),false);assert.equal(evidence.icons.samples.every(s=>s.ready===8),true);assert.equal(evidence.icons.mutations,0);}
 await p.screenshot({path:`test-results/build-icons-${baseline?'before':'after'}.png`});
 evidence.stress=[];
 for(const [label,kinds] of [['rapid',['arrow']],['thunder',['thunder']],['mixed',['arrow','ballista','cannon','arcane','frost','thunder','nature','barracks']]]){
  const sample=await p.evaluate(({label,kinds})=>{
   const a=window.__REALM_WARDENS__,g=a.game,r=a.renderer;g.start(a.content.ENDLESS[1],'knight');g.scenery.forEach(o=>o.alive=false);g.gold=1e7;
   for(const cell of g.cells)if(g.placement(cell).ok){const t=g.build(cell.id,kinds[g.towers.length%kinds.length]);g.upgrade(t.id);g.upgrade(t.id);g.specialize(t.id,t.kind==='thunder'?0:0);}
   g.wave=200;g.waveActive=true;g.speed=2;g.hero.hp=g.hero.maxHp=1e8;
   for(let i=0;i<88;i++){const route=i%g.map.routes.length,e=g.spawn(['armor','harpy','shield'][i%3],route,3+(i%25)*.8,{noWarning:true});e.hp=e.maxHp=1e8;}
   // Wait-free, synchronous frame loop prevents RAF from changing the fixture.
   r.render(0);for(let i=0;i<30;i++){g.advance(1/60);r.render(1/60);}
   const groups=[[g,['advance','updateTowers','updateFriends','targets','lightning']],[a.ui,['update','panel']],[r,['render','syncModel','drawFeedback']],[r.effects,['arc','impact','update']]],timed={},restore=[];
   for(const [object,names]of groups)for(const name of names){const key=(object===g?'game':object===a.ui?'ui':object===r?'renderer':'effects')+'.'+name,fn=object[name];timed[key]={ms:0,calls:0};object[name]=function(...args){const start=performance.now();try{return fn.apply(this,args);}finally{timed[key].ms+=performance.now()-start;timed[key].calls++;}};restore.push(()=>object[name]=fn);}
   const samples=[],resources=[];
   for(let i=0;i<120;i++){const start=performance.now();g.advance(1/60);r.render(1/60);a.ui.update(1/60,true);samples.push(performance.now()-start);if(i%30===0)resources.push({...r.metrics(),arcs:r.effects.arcs.length,bursts:r.effects.bursts.length,bullets:r.bullets.size,projectiles:g.projectiles.length,programs:r.gpu.info.programs.length});}
   restore.forEach(fn=>fn());samples.sort((a,b)=>a-b);g.setPaused(true);
   return{label,towers:g.towers.length,enemies:g.enemies.length,simulatedSeconds:g.time,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],timed,resources};
  },{label,kinds});evidence.stress.push(sample);console.log(JSON.stringify(sample));
 }
 assert.deepEqual(errors,[]);
 await writeFile(baseline?path:'test-results/battle-performance-browser-report.json',JSON.stringify({status:baseline?'baseline':'passed',scope:'Chrome SwiftShader at 1280x800, balanced/standard, explicit full legal build fixtures at wave 200 with 88 high-HP enemies to sustain load, 2x speed, 30 warmup + 120 measured frames. CPU submission timings include instrumentation; no physical GPU FPS claim.',evidence,errors},null,2));
}finally{await browser.close();}
