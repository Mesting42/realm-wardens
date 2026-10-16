import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

await mkdir('test-results',{recursive:true});
const url=process.env.GAME_URL||'http://127.0.0.1:5175/';
// Verify application changes with software rendering while the physical driver is unstable.
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const context=await browser.newContext({viewport:{width:2560,height:1440},deviceScaleFactor:1.5}),page=await context.newPage(),checks=[],errors=[],evidence={};
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ready=async target=>{await page.goto(target);await page.waitForFunction(()=>window.__REALM_WARDENS__?.renderer.metrics().drawCalls>0,null,{timeout:90000});};
const read=()=>page.evaluate(()=>{
  const a=window.__REALM_WARDENS__,r=a.renderer,gl=r.gpu.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {settings:a.store.settings,graphics:r.metrics(),pixels:r.canvas.width*r.canvas.height,hudPixels:r.feedback.width*r.feedback.height,context:r.gpu.getContextAttributes(),programs:r.gpu.info.programs.length,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
});
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
try{
  await check('Fresh start uses balanced rendering, standard effects and browser-selected GPU with a bounded full-screen buffer',async()=>{
    await ready(url);const result=await read();assert.match(result.gpu,/SwiftShader/i);
    assert.equal(result.settings.quality,'balanced');assert.equal(result.settings.effects,'standard');assert.equal(result.context.powerPreference,'default');
    assert.ok(result.pixels<=3500000);assert.ok(result.hudPixels<=4500000);assert.equal(result.graphics.width,2560);assert.ok(result.graphics.drawCalls>0);assert.ok(result.programs>0);
    evidence.startup=result;await page.screenshot({path:'test-results/gpu-balanced-startup.png'});
  });
  await check('Main menu rendering is capped at 30 fps while its animated scene continues',async()=>{
    await page.evaluate(()=>{const r=window.__REALM_WARDENS__.renderer,original=r.render.bind(r);window.__renderTimes=[];r.render=dt=>{window.__renderTimes.push(performance.now());return original(dt);};});
    await page.waitForTimeout(1100);const times=await page.evaluate(()=>window.__renderTimes);
    assert.ok(times.length>0);const span=times.length>1?(times.at(-1)-times[0])/1000:1,fps=Math.max(0,times.length-1)/span;
    assert.ok(fps<=32,`menu fps ${fps}`);evidence.menu={frames:times.length,fps};
    // Feed the actual main-loop callback fast RAF clocks without drawing to the GPU.
    await page.evaluate(()=>{window.__frameQueue=[];window.requestAnimationFrame=cb=>{window.__frameQueue.push(cb);return window.__frameQueue.length;};});
    await page.waitForFunction(()=>window.__frameQueue.length>0);
    const rates=await page.evaluate(()=>{
      const a=window.__REALM_WARDENS__,out=[];let now=performance.now()+100,count=0;
      a.renderer.render=()=>count++;a.game.advance=()=>{};a.ui.update=()=>{};a.audio.update=()=>{};
      for(const hz of [60,120,144,240])for(const [mode,paused,limit]of [['menu',false,30],['battle',false,60],['battle',true,30]]){
        a.game.mode=mode;a.game.paused=paused;count=0;const start=now+200;
        for(let i=0;i<hz;i++){now=start+i*1000/hz;const callbacks=window.__frameQueue.splice(0);for(const callback of callbacks)callback(now);}
        out.push({hz,mode,paused,limit,draws:count});
      }
      return out;
    });
    for(const rate of rates){assert.ok(rate.draws>=rate.limit-1,JSON.stringify(rate));assert.ok(rate.draws<=rate.limit+1,JSON.stringify(rate));}
    evidence.menu.syntheticRefreshRates=rates;
  });
  await check('Safe preview overrides an existing high-quality profile for this visit and preserves stored settings and progress',async()=>{
    const before=await page.evaluate(()=>{
      const a=window.__REALM_WARDENS__,settings=JSON.stringify({...a.store.settings,quality:'high',effects:'rich'}),progress=JSON.stringify({...a.store.progress,stars:Array(12).fill(3)});
      localStorage.setItem('realm-wardens.settings.v1',settings);localStorage.setItem('realm-wardens.save.v1',progress);return {settings,progress};
    });
    await ready(url+'?safe=1');const safe=await read();assert.equal(safe.settings.quality,'balanced');assert.equal(safe.settings.effects,'standard');assert.ok(safe.pixels<=3500000);
    const after=await page.evaluate(()=>({settings:localStorage.getItem('realm-wardens.settings.v1'),progress:localStorage.getItem('realm-wardens.save.v1')}));assert.deepEqual(after,before);
    await ready(url);const normal=await read();assert.equal(normal.settings.quality,'high');assert.equal(normal.settings.effects,'rich');assert.ok(normal.pixels<=6500000);
    evidence.savedProfile={safe:safe.settings,normal:normal.settings,storedDataPreserved:true};
    await page.locator('[data-action="settings"]').click();await page.selectOption('[data-setting="quality"]','balanced');await page.selectOption('[data-setting="effects"]','standard');await page.locator('[data-action="close-modal"]').click();
    await ready(url);assert.equal((await read()).settings.quality,'balanced');
  });
  await check('A lost WebGL context freezes rendering and battle; native restoration and the real resume button recover the scene',async()=>{
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>{const a=window.__REALM_WARDENS__;a.game.start(a.content.LEVELS[0],'knight');a.game.beginWave();});
    await page.waitForTimeout(400);await page.evaluate(()=>window.__REALM_WARDENS__.renderer.gpu.forceContextLoss());
    await page.waitForFunction(()=>window.__REALM_WARDENS__.renderer.contextLost);
    const before=await page.evaluate(()=>{const a=window.__REALM_WARDENS__;return {time:a.game.time,paused:a.game.paused,frame:a.renderer.gpu.info.render.frame};});
    assert.equal(before.paused,true);await page.waitForTimeout(600);
    await page.evaluate(()=>{const image=document.createElement('img');image.id='lost-preview-fixture';image.dataset.modelMap='1';image.style.cssText='width:1px;height:1px;position:fixed';document.getElementById('ui').append(image);});
    await page.waitForTimeout(100);assert.equal(await page.locator('#lost-preview-fixture').getAttribute('src'),null);
    const frozen=await page.evaluate(()=>{const a=window.__REALM_WARDENS__;return {time:a.game.time,paused:a.game.paused,frame:a.renderer.gpu.info.render.frame};});assert.deepEqual(frozen,before);
    await page.evaluate(()=>window.__REALM_WARDENS__.renderer.gpu.forceContextRestore());
    await page.waitForFunction(()=>!window.__REALM_WARDENS__.renderer.contextLost,null,{timeout:10000});
    await page.waitForFunction(()=>document.getElementById('lost-preview-fixture')?.src.startsWith('data:'),null,{timeout:15000});
    await page.locator('#lost-preview-fixture').evaluate(image=>image.remove());
    await page.locator('[data-action="resume"]').click();await page.waitForTimeout(500);
    const after=await page.evaluate(()=>{const a=window.__REALM_WARDENS__;return {time:a.game.time,paused:a.game.paused,graphics:a.renderer.metrics()};});
    assert.equal(after.paused,false);assert.ok(after.time>before.time);assert.ok(after.graphics.drawCalls>0);assert.equal(after.graphics.contextLost,false);
    evidence.recovery={before,after};await page.screenshot({path:'test-results/gpu-context-recovered.png'});
  });
  await check('Hidden-page visibility fixture pauses battle and stops GPU draws; returning to the page can resume',async()=>{
    // Headless visibility is controlled explicitly; this does not reproduce a physical driver reset.
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForTimeout(100);const before=await page.evaluate(()=>{const a=window.__REALM_WARDENS__;return {time:a.game.time,frame:a.renderer.gpu.info.render.frame,paused:a.game.paused};});
    await page.waitForTimeout(400);const after=await page.evaluate(()=>{const a=window.__REALM_WARDENS__;return {time:a.game.time,frame:a.renderer.gpu.info.render.frame,paused:a.game.paused};});
    assert.equal(before.paused,true);assert.deepEqual(after,before);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.locator('[data-action="resume"]').click();await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>window.__REALM_WARDENS__.game.paused),false);evidence.hidden={before,after};
  });
  assert.deepEqual(errors,[]);
  await writeFile('test-results/graphics-startup-report.json',JSON.stringify({date:'2026-10-06',status:'passed',scope:'Explicit SwiftShader software renderer, emulated high DPR, synthetic 60/120/144/240-Hz RAF clocks without GPU draws, native WebGL loss/restore and controlled visibility; not a physical-GPU driver stability test.',checks,evidence,errors},null,2));
  console.log(JSON.stringify({status:'passed',checks:checks.length,evidence,errors}));
}finally{await browser.close();}
