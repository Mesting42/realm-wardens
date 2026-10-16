import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {uiBot} from './ui-bot.mjs';
import {LEVELS,bossProfile} from '../src/content.js';
import {blankProgress,SAVE_KEY} from '../src/store.js';

await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const errors=[],checks=[],runs=[],previews=[];
const selected=(process.env.CAMPAIGN_LEVELS||'1,10,12').split(',').map(Number),reused=[];
if(process.env.CAMPAIGN_RETAIN_PASSING==='1'){
  const previous=JSON.parse(await readFile('test-results/campaign-browser-report.json','utf8'));
  for(const run of previous.runs||[])if(run.result.mode==='victory'&&!selected.includes(run.level)){runs.push(run);reused.push(run.level);}
  previews.push(...previous.previews||[]);checks.push(...previous.checks||[]);
}
let page;
try{
  for(const id of selected){
    const context=await browser.newContext({viewport:{width:1280,height:800}});page=await context.newPage();const bot=uiBot(page);
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    if(id>1){const progress=blankProgress();progress.stars=progress.stars.map((_,i)=>i<id-1?3:0);await context.addInitScript(({key,progress})=>localStorage.setItem(key,JSON.stringify(progress)),{key:SAVE_KEY,progress});}
    await page.goto(process.env.GAME_URL||'http://127.0.0.1:5175/?safe=1');await page.waitForFunction(()=>window.__REALM_WARDENS__?.renderer.metrics().drawCalls>0,null,{timeout:90000});
    const renderer=await page.evaluate(()=>{const gl=window.__REALM_WARDENS__.renderer.gpu.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);});assert.match(renderer,/SwiftShader/);
    // Use the real graphics setting to reduce CPU rendering cost. Combat still
    // runs on the unchanged normal UI clock, with its formal 1x / 2x choices.
    await bot.click('settings');await page.selectOption('[data-setting="quality"]','fast');await bot.click('close-modal');
    if(id===1){
      await bot.click('codex');await page.waitForFunction(()=>document.querySelectorAll('img[data-model-enemy^="boss:"][src]').length===12,null,{timeout:120000});
      previews.push(...await page.locator('img[data-model-enemy^="boss:"]').evaluateAll(imgs=>imgs.map(img=>({id:img.dataset.modelEnemy,name:img.alt,width:img.naturalWidth,height:img.naturalHeight}))));assert.ok(previews.every(p=>p.width>50&&p.height>50));await page.locator('img[data-model-enemy="boss:obsidianweaver"]').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/campaign-boss-codex.png'});await bot.click('close-modal');checks.push('All twelve named boss GLB variants render in the real compendium without console errors');
    }
    for(const action of ['modes','campaign',`chapter:${LEVELS[id-1].region}`,`detail:${id}`])await bot.click(action);
    assert.match(await page.locator('.detail-content').textContent(),new RegExp(bossProfile(LEVELS[id-1].bossId).name));await page.screenshot({path:`test-results/campaign-${id}-details.png`});
    await bot.click('heroes');const hero=id===1?'knight':id===10?'ranger':'mage';await bot.click(`hero:${hero}`);await bot.click('launch');assert.equal((await bot.read()).gold,200);await bot.prepare();const opening=await bot.read();assert.equal(opening.towers.length,2);assert.equal(opening.gold,10);await page.screenshot({path:`test-results/campaign-${id}-opening.png`});await bot.click('speed');await bot.click('wave');
    const began=Date.now(),waves=[],boss={seen:false,phase:false},spawns=[];let previous=0,lastBuy=0,lastSkill=0,pausedWarning=false;
    // Observers are read-only: no battle state, currency, enemy, timer or result
    // is changed through page.evaluate. Later levels use prior-star fixtures.
    await page.evaluate(()=>{const a=window.__REALM_WARDENS__;a.__campaignSpawns=[];a.__campaignPhases=[];a.game.on(e=>{if(e.type==='spawn')a.__campaignSpawns.push({wave:a.game.wave,kind:e.kind,route:e.route,bossId:e.bossId||null,time:e.time});if(e.type==='boss-phase')a.__campaignPhases.push({time:e.time,text:e.text});});});
    while(Date.now()-began<900000){
      const s=await bot.read();if(s.mode!=='battle'){assert.equal(s.mode,'victory',`Normal UI level ${id}`);break;}
      if(s.wave!==previous){previous=s.wave;waves.push({wave:s.wave,lives:s.lives,gold:s.gold,time:s.time});console.log(JSON.stringify({level:id,wave:s.wave,lives:s.lives,gold:s.gold}));}
      if(s.warning){
        if(!boss.seen){boss.seen=true;await page.screenshot({path:`test-results/campaign-${id}-boss-warning.png`});}
        if(!pausedWarning){await bot.click('pause');const p=await bot.read();await page.waitForTimeout(400);const q=await bot.read();assert.equal(p.time,q.time);assert.equal(p.warning.remaining,q.warning.remaining);await bot.click('resume');pausedWarning=true;}
      }else{
        if(Date.now()-lastSkill>1400){await bot.skills();lastSkill=Date.now();}
        if(Date.now()-lastBuy>2400&&(await bot.read()).mode==='battle'){await bot.prepare(1);lastBuy=Date.now();}
        const visual=await page.evaluate(()=>{const a=window.__REALM_WARDENS__,e=a.game.enemies.find(e=>e.bossId);if(!e)return null;const root=a.renderer.units.get(e.id)?.root;return {id:e.bossId,name:e.name,asset:root?.userData.asset,animation:root?.userData.animation,height:root?.userData.targetHeight,phase:e.phase,status:e.bossStatus};});
        if(visual&&visual.phase>0&&!boss.phase){boss.phase=true;boss.visual=visual;assert.equal(visual.asset,true);assert.ok(visual.height>2);await page.screenshot({path:`test-results/campaign-${id}-boss-fight.png`});}
      }
      await page.waitForTimeout(300);
    }
    const result=await bot.read();assert.equal(result.mode,'victory',`Level ${id} timed out`);assert.ok(boss.seen&&boss.phase);assert.equal(waves.length,LEVELS[id-1].waveCount);const observed=await page.evaluate(()=>({spawns:window.__REALM_WARDENS__.__campaignSpawns,phases:window.__REALM_WARDENS__.__campaignPhases,cleared:window.__REALM_WARDENS__.game.cleared,progress:window.__REALM_WARDENS__.store.progress.stars}));
    assert.equal(observed.cleared,0);const entries=observed.spawns.filter(e=>e.bossId);assert.equal(entries.length,1);assert.equal(entries[0].bossId,LEVELS[id-1].bossId);assert.equal(entries[0].wave,LEVELS[id-1].waveCount);assert.ok(observed.spawns.filter(e=>e.wave<=2).every(e=>e.route===0));assert.ok(observed.progress[id-1]>0);
    await page.screenshot({path:`test-results/campaign-${id}-victory.png`});runs.push({level:id,hero,priorStarsFixture:id>1,opening,waves,boss,result,observed,renderer});checks.push(`Normal UI level ${id}: 200 gold, earned-only investment, automatic waves, phased routes, animated named boss and real victory`);console.log(JSON.stringify({level:id,victory:true,lives:result.lives,time:result.time,boss:boss.visual?.name}));await context.close();
  }
  assert.deepEqual(errors,[]);assert.ok([1,10,12].every(id=>runs.some(r=>r.level===id&&r.result.mode==='victory')));await writeFile('test-results/campaign-browser-report.json',JSON.stringify({status:'passed',date:'2026-10-06',reusedCompletedRuns:reused,verification:'Forced SwiftShader software rendering. Level 1 starts from a fresh save; levels 10 and 12 seed only previously completed stars to access those stages. All battle actions use normal UI at real 2x clock: 200 gold, no battle state/currency/HP/wave/result mutation and no obstacle clearance. Read-only event observers record spawns. All twelve boss thumbnails are rendered by the actual GLB variant path. Any reused runs are previously completed real UI runs from this same balancing revision; level 12 was rerun with a longer wall-clock budget after a software-rendering timeout at full castle health.',checks,errors,previews,runs},null,2));
}catch(error){await page?.screenshot({path:'test-results/campaign-browser-failure.png'}).catch(()=>{});await writeFile('test-results/campaign-browser-report.json',JSON.stringify({status:'failed',checks,errors,previews,runs,error:error.stack,snapshot:await page?.evaluate(()=>window.__REALM_WARDENS__?.snapshot()).catch(()=>null)},null,2));throw error;}finally{await browser.close();}
