import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {synthesizeSound,SOUND_RATE} from '../src/sounds.js';

await mkdir('test-results',{recursive:true});
const checks=[],errors=[],evidence={};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
let page;
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
const shot=name=>page.screenshot({path:`test-results/${name}.png`});
const click=action=>page.locator(`[data-action="${action}"]`).last().click();
const api=fn=>page.evaluate(fn);
async function open(options){
  page=await browser.newPage(options);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5175/?safe=1');await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});
  if(await page.locator('#display-root').isVisible()){await page.locator('[data-display-enter]').click();await page.waitForFunction(()=>window.__REALM_WARDENS__.display.entered);if(await api(()=>!!document.fullscreenElement))await api(()=>document.exitFullscreen());}
  await page.waitForFunction(()=>window.__REALM_WARDENS__.renderer.metrics().drawCalls>0);
}
async function start(id=1){
  await page.evaluate(id=>{const a=window.__REALM_WARDENS__;a.store.progress.stars.fill(3);a.game.start(a.content.allMaps.find(m=>m.id===id),'knight');a.__city=[];a.__voices=[];a.__recordCalls=0;
    if(!a.__defeatAudit){a.__defeatAudit=true;const play=a.audio.play.bind(a.audio);a.audio.play=(key,e,gain,category)=>{const accepted=play(key,e,gain,category);a.__voices.push({key,accepted,category});return accepted;};
      const record=a.store.record.bind(a.store);a.store.record=(...args)=>{a.__recordCalls++;return record(...args);};
      a.game.on(e=>{if(e.type.startsWith('city-')||['defeat','defeat-ready','citizen-panic'].includes(e.type))a.__city.push({type:e.type,x:e.x,z:e.z,kind:e.kind,castle:e.castle,elapsed:a.renderer.defeat?.elapsed||0,duration:e.duration,skipped:e.skipped,homes:a.renderer.town.structures.filter(s=>s.destroyed).map(s=>[s.x,s.z])});});}
  },id);
  assert.equal(await api(()=>window.__REALM_WARDENS__.game.map.id),id);assert.equal(await api(()=>window.__REALM_WARDENS__.game.mode),'battle');
  await page.waitForFunction(()=>window.__REALM_WARDENS__.renderer.units.size>0);
}
// Place five ordinary siege enemies immediately before the real route exit.
// Their unmodified leak damage depletes all 20 castle lives in Game.step.
async function breach({freeze=false}={}){
  return page.evaluate(freeze=>{const a=window.__REALM_WARDENS__,g=a.game;g.hero.x=-13;g.hero.z=-10;g.hero.anchor={x:-13,z:-10};g.hero.path=[];g.queue=[];
    for(let i=0;i<5;i++)g.spawn('siege',i%g.map.routes.length,g.map.routes[i%g.map.routes.length].length-.005,{noWarning:true});
    g.step(1/30);if(freeze)g.setPaused(true);
    return {result:{...g.result},gold:g.gold,score:g.score,kills:g.kills,wave:g.wave,time:g.time,lives:g.lives,ready:a.__city.filter(e=>e.type==='defeat-ready').length,modal:a.ui.modal,screen:a.ui.screen,mode:g.mode};
  },freeze);
}
const sequence=()=>api(()=>window.__REALM_WARDENS__.renderer.defeat?.snapshot());
async function stepPresentation(to){const frame=await page.evaluate(to=>{const r=window.__REALM_WARDENS__.renderer,s=r.defeat;while(s.active&&s.elapsed<to)s.update(Math.min(.05,to-s.elapsed));return r.gpu.info.render.frame;},to);await page.waitForFunction(f=>window.__REALM_WARDENS__.renderer.gpu.info.render.frame>f,frame,{timeout:60000});}
const finances=()=>api(()=>{const g=window.__REALM_WARDENS__.game;return {gold:g.gold,score:g.score,kills:g.kills,wave:g.wave,time:g.time,lives:g.lives,result:{...g.result}};});
function sameFinances(a,b){for(const k of ['gold','score','kills','wave','time','lives','result'])assert.deepEqual(a[k],b[k],k+' changed during presentation');}
try{
  await open({viewport:{width:1440,height:900}});
  await check('Real siege leak triggers a six-second presentation before settlement, locks the result and blocks combat commands',async()=>{
    evidence.renderer=await api(()=>{const gl=window.__REALM_WARDENS__.renderer.gpu.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);});assert.match(evidence.renderer,/SwiftShader/);
    await start();await click('speed');await click('wave');evidence.locked=await breach();evidence.started=Date.now();
    assert.equal(evidence.locked.mode,'defeat');assert.equal(evidence.locked.lives,0);assert.equal(evidence.locked.screen,'defeat-cinematic');assert.equal(evidence.locked.modal,null);assert.equal(evidence.locked.ready,0);
    assert.equal(await page.locator('[data-action="skip-defeat"]').count(),1);assert.equal(await page.locator('.battle-header').count(),0);
    const command=await api(()=>{const a=window.__REALM_WARDENS__,g=a.game,site=g.cells.find(c=>g.placement(c).ok);return {canAct:g.canAct(),build:g.build(site?.id,'arrow'),wave:g.beginWave(),hero:g.moveHero({x:0,z:0})};});assert.equal(command.canAct,false);assert.equal(command.build,false);
    await page.waitForFunction(()=>window.__REALM_WARDENS__.renderer.defeat.elapsed>1.4,null,{timeout:60000});evidence.invasion=await sequence();assert.ok(evidence.invasion.castleBroken);assert.ok(evidence.invasion.pieces>12);assert.ok(evidence.invasion.actors.some(a=>a.animation==='Walk'));assert.equal(await api(()=>window.__REALM_WARDENS__.renderer.castles.every(c=>!c.visible)),true);
    evidence.camera=await api(()=>({...window.__REALM_WARDENS__.renderer.view}));assert.ok(evidence.camera.x>8);await shot('defeat-invasion');
  });
  await check('Real rendered frames animate invading monsters, fracture attacked houses, create bounded fire/smoke and scatter residents',async()=>{
    await page.waitForFunction(()=>window.__REALM_WARDENS__.renderer.defeat.elapsed>4.8,null,{timeout:60000});
    evidence.aftermath=await sequence();assert.ok(evidence.aftermath.destroyed>=4,JSON.stringify(evidence.aftermath));assert.ok(evidence.aftermath.attacks>=4);assert.ok(evidence.aftermath.fires>=8&&evidence.aftermath.fires<=16);assert.ok(evidence.aftermath.smoke<=240);
    const details=await api(()=>{const a=window.__REALM_WARDENS__,s=a.renderer.defeat;return {homes:s.homes.map(h=>({kind:h.kind,destroyed:h.destroyed,visible:h.root.visible})),residents:s.town.residents.map(c=>({id:c.id,x:c.x,z:c.z,goal:c.goal,state:c.defeatState,visible:c.root.visible,rotation:c.root.rotation.z})),events:a.__city,voices:a.__voices,particles:a.renderer.effects.particles.length,pixels:a.renderer.canvas.width*a.renderer.canvas.height};});
    assert.ok(details.homes.filter(h=>h.destroyed).every(h=>!h.visible));assert.ok(details.residents.some(c=>c.state==='fallen'&&Math.abs(c.rotation)>1.5));assert.ok(details.residents.filter(c=>c.state==='vanished').every(c=>!c.visible));assert.equal(details.residents.filter(c=>!c.state).length,5);
    assert.ok(new Set(details.residents.filter(c=>c.goal).map(c=>`${c.goal.x},${c.goal.z}`)).size>=4);assert.ok(details.events.some(e=>e.type==='citizen-panic'));assert.ok(details.voices.some(v=>v.key==='crumble'&&v.accepted));assert.ok(details.voices.some(v=>v.category==='citizen'&&v.accepted));assert.ok(details.particles<=750);assert.ok(details.pixels<=3500000);
    for(const collapse of details.events.filter(e=>e.type==='city-collapse'&&!e.castle))assert.ok(details.events.some(e=>e.type==='city-attack'&&e.x===collapse.x&&e.z===collapse.z&&e.elapsed<=collapse.elapsed));
    evidence.details=details;await shot('defeat-town-fire');
    await page.waitForFunction(()=>window.__REALM_WARDENS__.ui.modal==='result',null,{timeout:60000});
    const ended=await sequence();assert.equal(ended.elapsed,6);assert.equal(ended.active,false);assert.equal(await page.locator('[data-action="skip-defeat"]').count(),0);sameFinances(evidence.locked,await finances());
    assert.equal(await api(()=>window.__REALM_WARDENS__.__city.filter(e=>e.type==='defeat-ready').length),1);assert.equal(await api(()=>window.__REALM_WARDENS__.__city.find(e=>e.type==='defeat-ready').skipped),false);evidence.fullPlaybackWallSeconds=(Date.now()-evidence.started)/1000;
    await page.keyboard.press('Escape');assert.equal(await api(()=>window.__REALM_WARDENS__.ui.modal),'result');await shot('defeat-settlement');
  });
  await check('Retry restores all houses, castle, citizens, camera and funds; skipping immediately emits only one settlement',async()=>{
    await click('retry');await page.waitForTimeout(250);
    const restored=await api(()=>{const a=window.__REALM_WARDENS__,r=a.renderer;return {mode:a.game.mode,gold:a.game.gold,lives:a.game.lives,defeat:!!r.defeat,homes:r.town.structures.map(s=>s.root.visible&&!s.destroyed),castles:r.castles.every(c=>c.visible),residents:r.town.residents.map(c=>c.root.visible&&!c.defeatState&&c.root.rotation.z===0),view:r.view,voices:a.audio.voices.size};});
    assert.equal(restored.mode,'battle');assert.equal(restored.gold,200);assert.equal(restored.lives,20);assert.equal(restored.defeat,false);assert.ok(restored.homes.every(Boolean)&&restored.residents.every(Boolean)&&restored.castles);assert.deepEqual(restored.view,{zoom:1,x:0,z:0});assert.equal(restored.voices,0);evidence.restored=restored;
    await start(5);const locked=await breach();const before=Date.now();await click('skip-defeat');assert.equal(await api(()=>window.__REALM_WARDENS__.ui.modal),'result');assert.ok((await sequence()).elapsed<6);assert.ok(Date.now()-before<3000);
    await api(()=>window.__REALM_WARDENS__.renderer.defeat.finish(true));assert.equal(await api(()=>window.__REALM_WARDENS__.__city.filter(e=>e.type==='defeat-ready').length),1);sameFinances(locked,await finances());
  });
  await check('A surviving battle army is hidden during invasion; frozen projectiles and zones cannot linger in the cinematic',async()=>{
    await start();const initial=await api(()=>{const a=window.__REALM_WARDENS__,g=a.game;for(let i=0;i<20;i++)g.spawn('imp',0,0,{speed:0,hp:1000,maxHp:1000});g.launch(g.hero,g.enemies[0],{damage:18,type:'physical',air:true},'arrow');g.zones.push({id:++g.serial,kind:'fire',x:0,z:0,left:2,radius:2,timer:1,damage:0});a.renderer.render(0);return {units:a.renderer.units.size,bullets:a.renderer.bullets.size,zones:a.renderer.zoneMeshes.size};});
    assert.ok(initial.units>=21);assert.equal(initial.bullets,1);assert.equal(initial.zones,1);const locked=await breach({freeze:true});await stepPresentation(.4);
    const hidden=await api(()=>{const a=window.__REALM_WARDENS__,g=a.game,r=a.renderer;return {enemies:g.enemies.length,hidden:g.enemies.every(e=>!r.units.get(e.id)?.root.visible),bullets:r.bullets.size,zones:r.zoneMeshes.size,gameProjectiles:g.projectiles.length,gameZones:g.zones.length,actors:r.defeat.actors.length};});assert.equal(hidden.enemies,20);assert.ok(hidden.hidden);assert.equal(hidden.bullets,0);assert.equal(hidden.zones,0);assert.equal(hidden.gameProjectiles,1);assert.equal(hidden.gameZones,1);assert.equal(hidden.actors,5);sameFinances(locked,await finances());evidence.denseArmy={initial,hidden};await click('skip-defeat');await click('retry');
  });
  await check('Forest, snowy and ash towns support destruction, while fire particles and cloned model resources are disposed on retry',async()=>{
    evidence.cycles=[];
    for(const id of [1,5,6,9,1,5,9]){
      await start(id);const baseline=await api(()=>window.__REALM_WARDENS__.renderer.metrics());await breach({freeze:true});await stepPresentation(5.2);
      const before=await api(()=>{const a=window.__REALM_WARDENS__,s=a.renderer.defeat;let geometries=0,materials=0,boneTextures=0;s.root.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.addEventListener('dispose',()=>geometries++);if(o.userData.ownedMaterial)o.material.addEventListener('dispose',()=>materials++);if(o.isSkinnedMesh&&o.skeleton.boneTexture)o.skeleton.boneTexture.addEventListener('dispose',()=>boneTextures++);});a.__dispose=()=>({geometries,materials,boneTextures});return {snapshot:s.snapshot(),metrics:a.renderer.metrics(),castles:a.renderer.castles.length,flagsHidden:a.renderer.flags.every(f=>!f.visible),instances:s.root.children.length};});
      const actorMeshCost=await api(()=>{let meshes=0;for(const a of window.__REALM_WARDENS__.renderer.defeat.actors)a.root.traverse(o=>{if(o.isMesh)meshes++;});return meshes*2;});
      if([5,6].includes(id))assert.equal(await api(()=>window.__REALM_WARDENS__.renderer.defeat.actors.every(a=>a.root.userData.snow?.coverage.value>.4)),true);
      assert.ok(before.snapshot.destroyed>=4);assert.ok(before.flagsHidden);assert.ok(before.snapshot.fragmentBatches<40);assert.ok(before.metrics.drawCalls<=baseline.drawCalls+actorMeshCost+before.snapshot.fragmentBatches+10,JSON.stringify({baseline,after:before.metrics,actorMeshCost}));assert.ok(before.snapshot.smoke<=240);if(id===6)assert.equal(before.castles,2);await shot(`defeat-region-${id}`);
      await click('skip-defeat');await click('retry');await page.waitForTimeout(200);const after=await api(()=>{const a=window.__REALM_WARDENS__;return {...a.__dispose(),metrics:a.renderer.metrics(),sequence:!!a.renderer.defeat,residents:a.renderer.town.residents.length};});assert.ok(after.geometries>=before.snapshot.fragmentBatches+2);assert.ok(after.materials>=before.snapshot.fragmentBatches+2);assert.ok(after.boneTextures>=5);assert.equal(after.sequence,false);assert.equal(after.residents,8);evidence.cycles.push({id,baseline,actorMeshCost,before,after});
    }
    for(const id of [1,5,9]){const samples=evidence.cycles.filter(c=>c.id===id).map(c=>c.after.metrics);assert.ok(samples[1].geometries<=samples[0].geometries+1);assert.ok(samples[1].textures<=samples[0].textures+1);}
  });
  await check('Ending an endless game records once; cinematic actors and skip never change score or count additional waves',async()=>{
    await start('e1');const locked=await breach({freeze:true});assert.equal(await api(()=>window.__REALM_WARDENS__.__recordCalls),1);await stepPresentation(6);sameFinances(locked,await finances());assert.equal(await api(()=>window.__REALM_WARDENS__.__recordCalls),1);
  });
  await check('Victory keeps its immediate settlement and never creates defeat debris or invading actors',async()=>{
    await start();await api(()=>window.__REALM_WARDENS__.game.finish(true));assert.equal(await api(()=>window.__REALM_WARDENS__.ui.modal),'result');assert.equal(await sequence(),undefined);assert.equal(await page.locator('[data-action="skip-defeat"]').count(),0);
  });
  await check('Collapse and fire have distinct finite PCM; sound limits and mute apply during the cutscene',async()=>{
    evidence.pcm=['crumble','crackle'].map(key=>{const pcm=synthesizeSound(key);let energy=0,peak=0;for(const v of pcm){assert.ok(Number.isFinite(v));energy+=v*v;peak=Math.max(peak,Math.abs(v));}return {key,seconds:pcm.length/SOUND_RATE,rms:Math.sqrt(energy/pcm.length),peak};});assert.ok(evidence.pcm.every(s=>s.rms>.025&&s.peak<1));
    await start();await breach({freeze:true});await stepPresentation(2.8);
    const muted=await api(()=>{const a=window.__REALM_WARDENS__,audio=a.audio;audio.pause(false);audio.apply({...a.store.settings,sfx:0,music:0});return {accepted:audio.play('crumble',{},1,'impact'),voices:audio.voices.size,nodes:audio.nodes.size};});assert.equal(muted.accepted,false);await page.waitForTimeout(100);assert.equal(await api(()=>window.__REALM_WARDENS__.audio.sfxGain.gain.value),0);assert.ok(muted.voices<=20&&muted.nodes<=48);await click('skip-defeat');await click('result-leave');assert.equal(await api(()=>window.__REALM_WARDENS__.audio.nodes.size),0);
  });
  await page.close();
  await open({viewport:{width:844,height:390},hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'});
  await check('Phone portrait freezes the defeat clock and audio; returning to landscape resumes the scene and keeps Skip usable',async()=>{
    await start(5);await breach({freeze:true});await stepPresentation(2);await api(()=>window.__REALM_WARDENS__.game.setPaused(false));await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>window.__REALM_WARDENS__.display.blocked);const frozen=await sequence();await page.waitForTimeout(700);assert.equal((await sequence()).elapsed,frozen.elapsed);assert.equal(await api(()=>window.__REALM_WARDENS__.audio.paused),true);assert.match(await page.locator('#display-description').textContent(),/失守演出已暂停/);
    await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>!window.__REALM_WARDENS__.display.blocked);await page.waitForFunction(t=>window.__REALM_WARDENS__.renderer.defeat.elapsed>t+.15,frozen.elapsed);const rect=await page.locator('[data-action="skip-defeat"]').boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=844&&rect.y+rect.height<=390&&rect.height>=44);await shot('defeat-phone-landscape');await click('skip-defeat');assert.equal(await api(()=>window.__REALM_WARDENS__.ui.modal),'result');
  });
  await check('Controlled context-loss events freeze the scene; restored events resume it without reproducing a physical GPU failure',async()=>{
    await start();await breach();await api(()=>window.__REALM_WARDENS__.renderer.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));const frozen=await sequence();await page.waitForTimeout(500);assert.equal((await sequence()).elapsed,frozen.elapsed);assert.equal(await api(()=>window.__REALM_WARDENS__.audio.nodes.size),0);await api(()=>window.__REALM_WARDENS__.renderer.canvas.dispatchEvent(new Event('webglcontextrestored')));await page.waitForFunction(t=>window.__REALM_WARDENS__.renderer.defeat.elapsed>t+.1,frozen.elapsed);await click('skip-defeat');
    await page.setViewportSize({width:568,height:320});await start();await breach({freeze:true});await stepPresentation(4.7);const rect=await page.locator('[data-action="skip-defeat"]').boundingBox();assert.ok(rect.x+rect.width<=568&&rect.y+rect.height<=320&&rect.height>=44);await shot('defeat-phone-compact');await click('skip-defeat');await click('result-leave');assert.equal(await api(()=>!!window.__REALM_WARDENS__.renderer.defeat),false);
  });
  assert.deepEqual(errors,[]);await writeFile('test-results/defeat-report.json',JSON.stringify({status:'passed',date:'2026-10-06',verification:'Forced SwiftShader only. Castle failure uses five normal siege leaks placed near a route exit; full six-second playback is observed through actual animation frames. Region, cleanup and interruption checks advance the visual clock explicitly while the game is frozen. Audio PCM and nodes are checked, not speaker listening. Context loss uses synthetic browser events, not physical driver reset.',checks,errors,evidence},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length,errors}));
}catch(error){await shot('defeat-failure').catch(()=>{});await writeFile('test-results/defeat-report.json',JSON.stringify({status:'failed',checks,errors,error:error.stack,evidence},null,2));throw error;}finally{await browser.close();}
