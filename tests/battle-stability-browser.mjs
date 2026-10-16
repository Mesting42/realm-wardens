import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const errors=[],checks=[],evidence={};
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto('http://127.0.0.1:5175/?safe=1');await p.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});if(await p.locator('#display-root').isVisible())await p.locator('[data-display-enter]').click();
 await p.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game;g.start(a.content.ENDLESS[1]);g.gold=79;g.selected={type:'site',id:g.cells.find(c=>g.placement(c).ok).id};a.ui.update(1);});
 await p.waitForFunction(()=>document.querySelectorAll('#selection-panel img.ready').length===8,null,{timeout:30000});assert.equal(await p.locator('[data-action="build:arrow"]').isDisabled(),true);
 evidence.gold=await p.evaluate(()=>{
  const a=window.__REALM_WARDENS__,g=a.game,panel=document.getElementById('selection-panel'),images=[...panel.querySelectorAll('img')],button=panel.querySelector('[data-action="build:arrow"]');panel.scrollTop=32;const scroll=panel.scrollTop;
  const e=g.spawn('wolf',0,0,{noWarning:true});g.kill(e);a.ui.update(1);const rewardEnabled=!button.disabled;
  for(let i=0;i<120;i++){g.gold=i%2?79:80;g.changed();a.ui.update(1/60);if(button.disabled!==(g.gold<80))throw Error('Affordability is stale');}
  g.gold=200;a.ui.update(1);return{rewardEnabled,sameButton:button===panel.querySelector('[data-action="build:arrow"]'),sameImages:images.every((n,i)=>n===panel.querySelectorAll('img')[i]),scrollStable:panel.scrollTop===scroll};
 });assert.deepEqual(evidence.gold,{rewardEnabled:true,sameButton:true,sameImages:true,scrollStable:true});
 await p.locator('[data-action="build:arrow"]').click();assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.towers.length),1);await p.locator('[data-action="upgrade"]').click();
 await p.locator('#tower-priority').selectOption('near');await p.locator('#tower-priority').focus();
 evidence.focus=await p.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game,node=document.getElementById('tower-priority');for(let i=0;i<100;i++){g.gold=i%2?0:1000;g.changed();a.ui.update(1/60);}return{same:node===document.getElementById('tower-priority'),focused:document.activeElement===node,priority:g.towers[0].priority,upgradeEnabled:!document.querySelector('[data-action="upgrade"]').disabled};});
 assert.deepEqual(evidence.focus,{same:true,focused:true,priority:'near',upgradeEnabled:false});
 await p.evaluate(()=>{const a=window.__REALM_WARDENS__;a.game.gold=1000;a.ui.update(1);});await p.locator('[data-action="upgrade"]').click();await p.locator('[data-action="spec:0"]').click();
 assert.deepEqual(await p.evaluate(()=>{const t=window.__REALM_WARDENS__.game.towers[0];return[t.level,t.spec];}),[3,0]);checks.push('Gold thresholds update all build/upgrade affordances without replacing icons or a focused priority selector; real build, upgrade and specialization clicks work');
 evidence.obstacle=await p.evaluate(()=>{
  const a=window.__REALM_WARDENS__,g=a.game,o=g.scenery.find(o=>o.alive);g.selected={type:'obstacle',id:o.id};a.ui.update(1);const track=document.querySelector('.obstacle-health'),action=document.querySelector('[data-clear-action]');g.focusObstacle(o.id);g.damageObstacle(o,1);a.ui.update(1);
  return{same:track===document.querySelector('.obstacle-health'),text:track.textContent.trim(),expected:`${Math.ceil(o.hp)} / ${o.maxHp}`,action:action.dataset.action};
 });assert.equal(evidence.obstacle.same,true);assert.equal(evidence.obstacle.text,evidence.obstacle.expected);assert.equal(evidence.obstacle.action,'stop-clear');checks.push('Obstacle HP and clear action update in place');
 await p.locator('[data-action="pause"]').click();assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.paused),true);await p.locator('[data-action="resume"]').click();assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.paused),false);
 // Pool stress changes only the rendering submission, with real GPU renders
 // at the measured checkpoints. A small fixture isolates resource lifetimes.
 evidence.pools=await p.evaluate(()=>{
  const a=window.__REALM_WARDENS__,g=a.game,r=a.renderer;g.start(a.content.ENDLESS[0]);g.setPaused(true);g.scenery.forEach(o=>o.alive=false);g.gold=10000;const cell=g.cells.find(c=>g.placement(c).ok),tower=g.build(cell.id,'arrow');
  // Building is disallowed while paused, so create through the real action.
  g.setPaused(false);const t=tower||g.build(cell.id,'arrow');g.upgrade(t.id);g.upgrade(t.id);g.specialize(t.id,0);g.setPaused(true);g.wave=80;const e=g.spawn('armor',0,6,{noWarning:true}),stats={...a.content.towerStats(t),level:t.level};r.render(0);
  const samples=[],original=r.gpu.render;r.gpu.render=()=>{};
  try{for(let cycle=0;cycle<12;cycle++){
   for(let i=0;i<100;i++)g.launch(t,e,stats,'arrow');r.render(0);
   const geometries=new Set([...r.bullets.values()].flatMap(m=>m.children.filter(o=>o.isMesh).map(o=>o.geometry.uuid)));if(geometries.size!==r.projectileTemplates.get('arrow').children.length)throw Error('Per-shot geometry was allocated');
   if(cycle%4===0){original.call(r.gpu,r.scene,r.camera);samples.push({cycle,geometries:r.gpu.info.memory.geometries,bullets:r.bullets.size,uniqueProjectileGeometries:geometries.size});}
   g.projectiles=[];r.render(0);if(r.bullets.size||r.bulletPools.get('arrow').length>64)throw Error('Bullet pool exceeded its cap');
  }}finally{r.gpu.render=original;}
  const resources=[];for(const template of r.projectileTemplates.values())template.traverse(m=>{if(m.userData.ownedGeometry)resources.push(m.geometry);});let disposed=0;resources.forEach(geometry=>geometry.addEventListener('dispose',()=>disposed++));g.restart();r.render(0);
  return{samples,templateGeometries:resources.length,disposed,bulletsAfterRestart:r.bullets.size,poolsAfterRestart:r.bulletPools.size,templatesAfterRestart:r.projectileTemplates.size,effectsAfterRestart:r.effects.arcs.length+r.effects.arcPool.length+r.effects.bursts.length+r.effects.burstPool.length};
 });
 assert.equal(new Set(evidence.pools.samples.map(s=>s.geometries)).size,1);assert.equal(evidence.pools.disposed,evidence.pools.templateGeometries);for(const key of ['bulletsAfterRestart','poolsAfterRestart','templatesAfterRestart','effectsAfterRestart'])assert.equal(evidence.pools[key],0);checks.push('1,200 shots share geometry, repeated live GPU checkpoints plateau, bounded pools and all projectile/effect resources reset on restart');
 await p.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game,cell=g.cells.find(c=>g.placement(c).ok),t=g.build(cell.id,'arrow'),e=g.spawn('armor',0,6,{noWarning:true});for(let i=0;i<32;i++)g.launch(t,e,{...a.content.towerStats(t),level:t.level},'arrow');a.renderer.effects.arc(t,[{x:e.x,y:1,z:e.z}]);a.renderer.render(0);a.renderer.gpu.forceContextLoss();});await p.waitForFunction(()=>window.__REALM_WARDENS__.renderer.contextLost);assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.paused),true);
 const before=await p.evaluate(()=>window.__REALM_WARDENS__.game.time);await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.time),before);await p.evaluate(()=>window.__REALM_WARDENS__.renderer.gpu.forceContextRestore());await p.waitForFunction(()=>!window.__REALM_WARDENS__.renderer.contextLost,null,{timeout:15000});await p.locator('[data-action="resume"]').click();
 await p.waitForFunction(before=>window.__REALM_WARDENS__.game.time>before,before,{timeout:30000}).catch(async error=>{console.error(await p.evaluate(()=>{const a=window.__REALM_WARDENS__;return{time:a.game.time,paused:a.game.paused,mode:a.game.mode,display:a.display.snapshot(),graphics:a.renderer.metrics(),hidden:document.hidden};}));throw error;});
 evidence.recovery=await p.evaluate(()=>{const a=window.__REALM_WARDENS__;return{paused:a.game.paused,time:a.game.time,graphics:a.renderer.metrics(),templates:a.renderer.projectileTemplates.size};});assert.equal(evidence.recovery.paused,false);assert.ok(evidence.recovery.time>before);assert.equal(evidence.recovery.graphics.contextLost,false);assert.ok(evidence.recovery.graphics.drawCalls>0);assert.ok(evidence.recovery.templates>0);checks.push('Actual pause/resume and native WebGL loss/restore recover combat, pooled projectiles and rendering without advancing combat while lost');
 await p.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game;g.setPaused(true);g.selected={type:'site',id:g.cells.find(c=>g.placement(c).ok).id};a.ui.update(1);});await p.waitForFunction(()=>document.querySelectorAll('#selection-panel img.ready').length===8,null,{timeout:30000});await p.screenshot({path:'test-results/build-icons-stable-desktop.png'});
 await p.setViewportSize({width:844,height:390});await p.screenshot({path:'test-results/build-icons-stable-compact.png'});assert.deepEqual(errors,[]);
 await writeFile('test-results/battle-stability-browser-report.json',JSON.stringify({status:'passed',scope:'Chrome SwiftShader; controlled fixtures with normal build/upgrade/spec actions, repeated real GPU resource checkpoints, native context loss/restore. Resource stress suppresses only intermediate GPU submissions; this is not a physical-driver endurance/FPS test.',checks,evidence,errors},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length,evidence,errors}));
}finally{await browser.close();}
