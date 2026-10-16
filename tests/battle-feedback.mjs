import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {synthesizeSound,SOUND_RATE} from '../src/sounds.js';

await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),checks=[],errors=[],evidence={};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
const nextFrame=async()=>{const frame=await page.evaluate(()=>window.__REALM_WARDENS__.renderer.gpu.info.render.frame);await page.waitForFunction(frame=>window.__REALM_WARDENS__.renderer.gpu.info.render.frame>frame,frame,{timeout:20000});};
function wav(data){const buffer=Buffer.alloc(44+data.length*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(SOUND_RATE,24);buffer.writeUInt32LE(SOUND_RATE*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(data.length*2,40);for(let i=0;i<data.length;i++)buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,data[i]))*32767),44+i*2);return buffer;}
function medley(keys,gap=.4){const clips=keys.map(synthesizeSound),size=clips.reduce((n,c)=>n+c.length+Math.round(gap*SOUND_RATE),0),data=new Float32Array(size);let offset=0;for(const clip of clips){data.set(clip,offset);offset+=clip.length+Math.round(gap*SOUND_RATE);}return wav(data);}
try{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5175/?safe=1');await page.waitForFunction(()=>window.__REALM_WARDENS__?.renderer.metrics().drawCalls>0,null,{timeout:90000});
  await check('Snow construction mode has wide blue corner meshes, a dark selected border and blue fill; actual UI purchase spends normal gold',async()=>{
    const gpu=await page.evaluate(()=>{const r=window.__REALM_WARDENS__.renderer,gl=r.gpu.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);});assert.match(gpu,/SwiftShader/i);evidence.gpu=gpu;
    // Only unlock the snow map; economy, scenery and placement are unchanged.
    await page.evaluate(()=>{const a=window.__REALM_WARDENS__;a.store.progress.stars.fill(3);a.game.start(a.content.LEVELS[4],'mage');});
    await page.locator('[data-action="grid"]').click();
    const point=await page.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game,c=g.cells.filter(c=>g.placement(c).ok).sort((a,b)=>Math.hypot(a.x+8,a.z+4)-Math.hypot(b.x+8,b.z+4))[0];return {cell:c,point:a.renderer.project(c.x,c.z,.12)};});
    await page.mouse.click(point.point.x,point.point.y);await page.locator('[data-action="build:arrow"]').waitFor();await nextFrame();
    evidence.grid=await page.evaluate(()=>{const a=window.__REALM_WARDENS__,r=a.renderer;return {selected:a.game.selected,gold:a.game.gold,mesh:r.buildGrid.isMesh,opacity:r.buildGrid.material.opacity,border:r.placementMarker.material.color.getHexString(),fill:r.placementFill.material.color.getHexString(),fillVisible:r.placementFill.visible,position:r.placementMarker.position.toArray(),graphics:r.metrics()};});
    assert.equal(evidence.grid.selected.id,point.cell.id);assert.equal(evidence.grid.mesh,true);assert.equal(evidence.grid.opacity,.72);assert.equal(evidence.grid.border,'184b6b');assert.equal(evidence.grid.fill,'79c6e9');assert.equal(evidence.grid.fillVisible,true);assert.equal(evidence.grid.gold,200);
    await page.screenshot({path:'test-results/snow-build-grid.png'});
    const center=point.point;await page.screenshot({path:'test-results/snow-build-cell-close.png',clip:{x:Math.max(0,center.x-150),y:Math.max(0,center.y-100),width:300,height:200}});
    await page.locator('[data-action="build:arrow"]').click();assert.equal(await page.evaluate(()=>window.__REALM_WARDENS__.game.gold),120);assert.equal(await page.evaluate(()=>window.__REALM_WARDENS__.game.towers[0].site),point.cell.id);
    await page.locator('[data-action="cancel"]').click();
  });
  await check('A normal wave triggers a textured roar from the actual portal spawn event and resumes real Web Audio',async()=>{
    await page.evaluate(()=>{const a=window.__REALM_WARDENS__;window.feedbackVoices=[];const play=a.audio.play.bind(a.audio);a.audio.play=(key,e,gain,category)=>{const accepted=play(key,e,gain,category);window.feedbackVoices.push({key,accepted,category,portal:e.portal,route:e.route});return accepted;};});
    await page.locator('[data-action="wave"]').click();await page.waitForFunction(()=>window.feedbackVoices.some(v=>v.accepted&&v.key.startsWith('roar:')));
    evidence.normalRoar=await page.evaluate(()=>({state:window.__REALM_WARDENS__.audio.context.state,voices:window.feedbackVoices.filter(v=>v.key.startsWith('roar:'))}));assert.equal(evidence.normalRoar.state,'running');assert.ok(evidence.normalRoar.voices.some(v=>v.accepted&&v.portal));
  });
  await check('Seven attacking towers and barracks guards trigger their own real combat sounds, including lightning and melee',async()=>{
    evidence.attacks=[];
    for(const kind of ['arrow','ballista','cannon','arcane','frost','thunder','nature','barracks']){
      // Controlled coverage: ordinary build rules, stationary durable enemy,
      // remote hero, and accelerated simulation steps; not a normal wave run.
      const result=await page.evaluate(kind=>{
        const a=window.__REALM_WARDENS__,g=a.game;g.start(a.content.LEVELS[4],'mage');g.hero.x=13;g.hero.z=7;g.hero.anchor={x:13,z:7};g.gold=1000;
        const cell=g.cells.filter(c=>g.placement(c).ok).sort((a,b)=>Math.hypot(a.x+8,a.z+4)-Math.hypot(b.x+8,b.z+4))[0],tower=g.build(cell.id,kind),road=g.map.routes[0].nearest(tower),enemy=g.spawn('armor',0,road.d,{hp:100000,maxHp:100000,speed:0,noWarning:true});
        if(kind==='barracks')for(const guard of g.guards){guard.x=enemy.x+.5;guard.z=enemy.z;guard.anchor={x:guard.x,z:guard.z};guard.path=[];}
        window.feedbackVoices=[];for(let i=0;i<40;i++)g.step(1/30);
        return {kind,voices:window.feedbackVoices,events:g.events.filter(e=>['attack','lightning'].includes(e.type)).map(e=>({type:e.type,kind:e.kind})),buffers:[...a.audio.buffers.keys()]};
      },kind);
      const expected=kind==='barracks'?'melee':kind;assert.ok(result.voices.some(v=>v.accepted&&v.key===expected),JSON.stringify(result));assert.ok(result.events.length>0);evidence.attacks.push(result);
    }
  });
  await check('All 18 creatures have distinct non-silent roars; battlefield summons do not replay a portal roar',async()=>{
    const result=await page.evaluate(()=>{
      const a=window.__REALM_WARDENS__,g=a.game;g.start(a.content.LEVELS[4],'mage');const roars=[];
      for(const kind of Object.keys(a.content.ENEMIES)){a.audio.stopAll();window.feedbackVoices=[];g.spawn(kind,0,0,{noWarning:true});const voice=window.feedbackVoices.find(v=>v.key===`roar:${kind}`),buffer=a.audio.buffers.get(`roar:${kind}`);roars.push({kind,accepted:voice?.accepted,duration:buffer?.duration});}
      a.audio.stopAll();window.feedbackVoices=[];g.spawn('imp',0,12,{summoned:true});g.spawn('grub',0,0,{summoned:true});g.spawn('raider',0,0,{guardian:2});return {roars,summonVoices:window.feedbackVoices};
    });assert.equal(result.roars.length,18);assert.ok(result.roars.every(r=>r.accepted&&r.duration>=.4));assert.equal(result.summonVoices.length,0);evidence.roars=result;
    const kinds=result.roars.map(r=>`roar:${r.kind}`).concat(['arrow','ballista','cannon','arcane','frost','thunder','nature','melee','boom','woodHit','iceHit','magicHit']),hashes=new Set();evidence.signals=[];
    for(const key of kinds){const pcm=synthesizeSound(key);let peak=0,energy=0;for(const v of pcm){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));energy+=v*v;}const rms=Math.sqrt(energy/pcm.length),hash=createHash('sha256').update(new Uint8Array(pcm.buffer)).digest('hex');assert.ok(peak>.3&&peak<.9);assert.ok(rms>.035);assert.ok(!hashes.has(hash));hashes.add(hash);evidence.signals.push({key,duration:pcm.length/SOUND_RATE,peak,rms,sha256:hash});}
    await writeFile('test-results/monster-roars-preview.wav',medley(['roar:imp','roar:wolf','roar:armor','roar:bat','roar:treant','roar:iceking','roar:ashlord']));
    await writeFile('test-results/tower-sounds-preview.wav',medley(['arrow','ballista','cannon','arcane','frost','thunder','nature','melee']));
  });
  await check('Dense portal/tower bursts are bounded, different tower kinds remain audible and bosses retain a roar slot',async()=>{
    evidence.dense=await page.evaluate(()=>{const a=window.__REALM_WARDENS__,audio=a.audio;audio.stopAll();for(let i=0;i<80;i++)audio.sound({type:'spawn',kind:'imp',portal:true,route:i%3,id:i});const roarCount=[...audio.voices.values()].filter(v=>v==='roar').length;
      const kinds=['arrow','ballista','cannon','arcane','frost','thunder','nature','melee'],accepted=kinds.map(kind=>audio.play(kind,{id:2},.5));for(let i=0;i<150;i++)audio.play('arrow',{id:i},.5);const bounded=audio.voices.size;audio.sound({type:'spawn',kind:'ashlord',portal:true,boss:true,id:999});const boss=audio.buffers.has('roar:ashlord')&&[...audio.voices].some(([source])=>source.buffer===audio.buffers.get('roar:ashlord'));return {roarCount,accepted,bounded,boss,final:audio.voices.size};});
    assert.equal(evidence.dense.roarCount,3);assert.ok(evidence.dense.accepted.every(Boolean));assert.equal(evidence.dense.bounded,20);assert.equal(evidence.dense.boss,true);assert.ok(evidence.dense.final<=20);
  });
  await check('Mute and pause stop sound output, resume reuses one context and completed voices release their nodes',async()=>{
    await page.locator('[data-action="settings"]').click();
    for(const key of ['sfx','music'])await page.locator(`[data-setting="${key}"]`).evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(350);
    const muted=await page.evaluate(()=>{const audio=window.__REALM_WARDENS__.audio;audio.stopAll();for(const e of [{type:'spawn',kind:'wolf',portal:true},{type:'attack',kind:'arrow'},{type:'lightning'},{type:'explosion'}])audio.sound(e);return {nodes:audio.nodes.size,voices:audio.voices.size,gain:audio.sfxGain.gain.value,setting:audio.settings.sfx};});evidence.muted=muted;assert.equal(muted.setting,0);assert.equal(muted.nodes,0);assert.equal(muted.voices,0);assert.ok(muted.gain<.001);
    await page.locator('[data-action="defaults"]').click();await page.locator('[data-action="close-modal"]').click();await page.locator('[data-action="pause"]').click();assert.equal(await page.evaluate(()=>window.__REALM_WARDENS__.audio.nodes.size),0);
    await page.locator('[data-action="resume"]').click();await page.evaluate(()=>{const a=window.__REALM_WARDENS__;a.audio.apply({...a.store.settings,music:0});a.audio.stopAll();a.audio.sound({type:'spawn',kind:'wolf',portal:true});});await page.waitForTimeout(1500);
    const cleaned=await page.evaluate(()=>({nodes:window.__REALM_WARDENS__.audio.nodes.size,voices:window.__REALM_WARDENS__.audio.voices.size,state:window.__REALM_WARDENS__.audio.context.state}));assert.equal(cleaned.nodes,0);assert.equal(cleaned.voices,0);assert.equal(cleaned.state,'running');evidence.cleaned=cleaned;
  });
  await check('Every snow map uses the new grid, invalid cells remain red and the forest keeps its existing palette within the GPU budget',async()=>{
    evidence.maps=[];
    for(const id of [5,6,7,8,'e2',1]){
      await page.evaluate(id=>{const a=window.__REALM_WARDENS__;a.game.start(a.content.allMaps.find(m=>m.id===id),'knight');a.renderer.showGrid=true;a.ui.update(1);},id);await nextFrame();
      const info=await page.evaluate(()=>{const a=window.__REALM_WARDENS__,r=a.renderer;return {map:a.game.map.id,isMesh:!!r.buildGrid.isMesh,color:r.buildGrid.material.color.getHexString(),opacity:r.buildGrid.material.opacity,pixels:r.canvas.width*r.canvas.height,contextLost:r.contextLost};});assert.equal(info.isMesh,id!==1);assert.equal(info.color,id===1?'e8edbd':'39738b');assert.ok(info.pixels<=3500000&&!info.contextLost);evidence.maps.push(info);
    }
    await page.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game;g.start(a.content.LEVELS[4],'mage');const blocked=g.cells.find(c=>!g.placement(c).ok);a.renderer.showGrid=true;a.renderer.targetPoint=blocked;g.selected=null;});await nextFrame();assert.equal(await page.evaluate(()=>window.__REALM_WARDENS__.renderer.placementMarker.material.color.getHexString()),'c74d45');
    await page.setViewportSize({width:390,height:844});await nextFrame();await page.screenshot({path:'test-results/snow-grid-phone.png'});assert.ok(await page.locator('[data-action="grid"]').isVisible());
  });
  assert.deepEqual(errors,[]);await writeFile('test-results/battle-feedback-report.json',JSON.stringify({status:'passed',verification:'Explicit SwiftShader software rendering. Normal starting-gold snow-grid purchase and real wave spawn; later tower/monster coverage uses identified controlled combat fixtures and accelerated simulation. PCM checks and WAV medleys validate signal content, not physical speaker listening.',checks,evidence,errors},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length,errors}));
}catch(error){await writeFile('test-results/battle-feedback-report.json',JSON.stringify({status:'failed',error:error.stack,checks,evidence,errors},null,2));throw error;}finally{await browser.close();}
