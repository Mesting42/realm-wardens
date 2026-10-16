import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],layouts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5175/?safe=1');await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});
  const models=await page.evaluate(()=>{
    const a=window.__REALM_WARDENS__,g=a.game,r=a.renderer;g.store.progress.stars.fill(3);g.start(a.content.LEVELS[2]);
    const enemies=[g.spawn('harpy',0,12,{noWarning:true}),g.spawn('harpy',0,18,{bossId:'galequeen',noWarning:true})];r.render(.03);
    return enemies.map(e=>{const root=r.units.get(e.id).root;let wing;root.traverse(o=>{if(!wing&&o.isBone&&/^Wing1[._]?L$/i.test(o.name))wing=o;});
      root.userData.actions.Idle.stop();root.userData.actions.Walk.reset().setEffectiveWeight(1).play();root.userData.mixer.setTime(0);const first=wing.quaternion.clone();root.userData.mixer.update(.18);const delta=first.angleTo(wing.quaternion),tracks=root.userData.actions.Walk.getClip().tracks.length;
      return {kind:e.kind,bossId:e.bossId||null,wing:wing.name,angularChange:delta,tracks,animation:root.userData.animation,asset:root.userData.asset};
    });
  });
  for(const model of models){assert.equal(model.asset,true);assert.equal(model.tracks,4);assert.ok(model.angularChange>.1);}
  for(const [width,height]of [[1280,800],[844,390],[568,320]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>{const a=window.__REALM_WARDENS__;a.ui.update(1);a.game.event('boss-phase',{text:'风羽女王：1.5 秒后掀起顺风，随后会疲惫。'});});
    await page.waitForTimeout(200);
    const layout=await page.evaluate(()=>{const b=document.getElementById('boss-hud').getBoundingClientRect(),t=document.getElementById('toast').getBoundingClientRect();return {width:innerWidth,height:innerHeight,bossBottom:b.bottom,toastTop:t.top,toastBottom:t.bottom,footerTop:Math.min(...[...document.querySelectorAll('.hero-controls,.wave-controls')].map(e=>e.getBoundingClientRect().top))};});
    assert.ok(layout.bossBottom<=layout.toastTop,'The boss phase hint must not cover its name and health bar');assert.ok(layout.toastBottom<layout.footerTop);layouts.push(layout);
    await page.screenshot({path:`test-results/campaign-queen-flight-${width}.png`});
  }
  assert.deepEqual(errors,[]);
  await writeFile('test-results/flight-report.json',JSON.stringify({status:'passed',date:'2026-10-07',verification:'Forced SwiftShader. Explicit model fixture only: ordinary harpy and campaign queen use actual GLB wing joints; mixer advancement measures quaternion changes on the locomotion clip. Explicit phase event checks hint placement on desktop and two landscape phone sizes, without claiming campaign completion or physical-device validation.',checks:['Ordinary harpy and Windfeather Queen have independently looping four-joint flight actions with measured wing motion','Boss phase hint remains below the visible name and health bar on desktop and two landscape phone sizes'],models,layouts,errors},null,2));console.log(JSON.stringify({status:'passed',models,layouts,errors}));
}catch(error){await writeFile('test-results/flight-report.json',JSON.stringify({status:'failed',error:error.stack,errors},null,2));throw error;}finally{await browser.close();}
