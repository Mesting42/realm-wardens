import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const checks=[],failures=[],errors=[],layouts=[],frames=[];
const check=async(name,fn)=>{try{await fn();checks.push(name);console.log('PASS '+name);}catch(error){failures.push({name,error:error.stack});console.log('FAIL '+name+': '+error.message);}};
const click=async(p,action)=>{const b=p.locator(`[data-action="${action}"]`).last();if(['grid','zoom-in','zoom-out','reset-view','fullscreen'].includes(action)&&!await b.isVisible())await p.locator('[data-action="view-tools"]').click();await b.click();};
async function open(options){const context=await browser.newContext(options),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto(process.env.GAME_URL||'http://127.0.0.1:5175/?safe=1');await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});if(await page.locator('#display-root').isVisible()){await page.locator('[data-display-enter]').click();await page.waitForFunction(()=>window.__REALM_WARDENS__.display.entered);if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());}return {context,page};}
async function launch(p){for(const a of ['modes','campaign','detail:1','heroes','launch'])await click(p,a);if(await p.locator('[data-action="dismiss-tip"]').count())await click(p,'dismiss-tip');}
const screenshot=(p,name)=>p.screenshot({path:`test-results/mobile-hud-${name}.png`});
async function layout(p,label){return p.evaluate(label=>{
  const a=window.__REALM_WARDENS__,box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
  const groups=[...document.querySelectorAll('.battle-resources,.battle-controls,.hero-controls,.wave-controls,.view-toggle')].filter(e=>e.offsetParent!==null).map(box);
  return {label,width:innerWidth,height:innerHeight,compact:document.body.classList.contains('compact-battle'),header:getComputedStyle(document.querySelector('.battle-header')).display,footer:getComputedStyle(document.querySelector('.battle-bottom')).display,world:box(document.getElementById('world')),groups,hudAreaFraction:groups.reduce((sum,b)=>sum+b.width*b.height,0)/(innerWidth*innerHeight),overflow:document.documentElement.scrollWidth>innerWidth,pixels:a.renderer.canvas.width*a.renderer.canvas.height,buttons:[...document.querySelectorAll('.battle-header button,.battle-bottom button,.view-toggle,.view-controls button')].filter(e=>e.offsetParent!==null).map(e=>({action:e.dataset.action,...box(e)}))};
},label);}
function validateLayout(l){assert.equal(l.compact,true);assert.equal(l.header,'contents');assert.equal(l.footer,'contents');assert.equal(l.overflow,false);assert.equal(l.world.x,0);assert.equal(l.world.y,0);assert.equal(l.world.width,l.width);assert.equal(l.world.height,l.height);assert.ok(l.hudAreaFraction<.20);assert.ok(l.pixels<=3500000);for(const b of l.buttons){assert.ok(b.width>=44&&b.height>=44,JSON.stringify(b));assert.ok(b.x>=0&&b.y>=0&&b.right<=l.width+.5&&b.bottom<=l.height+.5,JSON.stringify(b));}}
async function frame(p,map){return p.evaluate(map=>{
  const a=window.__REALM_WARDENS__,r=a.renderer,g=a.game,plan=r.town.plan,points=g.map.routes.flatMap((route,i)=>route.points.map(q=>({x:q.x,z:q.z,y:.2,type:`route:${i}`})));
  for(const x of [plan.minX,plan.maxX])for(const z of [plan.minZ,plan.maxZ])points.push({x,z,y:.2,type:'town-wall'});
  for(const s of r.town.structures)for(const x of [s.box.min.x,s.box.max.x])for(const y of [s.box.min.y,s.box.max.y])for(const z of [s.box.min.z,s.box.max.z])points.push({x,y,z,type:s.kind});
  const misses=points.map(q=>({...q,screen:r.project(q.x,q.z,q.y)})).filter(q=>q.screen.x<4||q.screen.x>innerWidth-4||q.screen.y<4||q.screen.y>innerHeight-4);
  const obscured=points.filter(q=>q.type.startsWith('route')||q.type==='town-wall').map(q=>({...q,screen:r.project(q.x,q.z,q.y)})).filter(q=>document.elementFromPoint(q.screen.x,q.screen.y)!==r.canvas);
  return {map,width:innerWidth,height:innerHeight,zoom:r.view.zoom,pointCount:points.length,misses,obscured};
},map);}
try{
  const phone=await open({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'}),p=phone.page;
  await launch(p);
  await check('Phone enters a full-screen battlefield with five separated HUD groups and accessible thumb controls',async()=>{const l=await layout(p,'Phone 844×390');validateLayout(l);layouts.push(l);await screenshot(p,'phone-overview');assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.gold),200);});
  await check('Real map tool clicks, touch building, paid upgrade, hero command, skills, wave, pause and restart preserve normal rules',async()=>{
    await click(p,'view-tools');assert.equal(await p.locator('[data-action="view-tools"]').getAttribute('aria-expanded'),'true');assert.equal(await p.locator('.view-controls button:visible').count(),5);
    await screenshot(p,'phone-tools');await click(p,'zoom-in');assert.ok(await p.evaluate(()=>window.__REALM_WARDENS__.renderer.view.zoom>1));await click(p,'reset-view');assert.equal(await p.locator('[data-action="view-tools"]').getAttribute('aria-expanded'),'false');
    await click(p,'grid');const point=await p.evaluate(()=>{const a=window.__REALM_WARDENS__;for(const c of a.game.cells.filter(c=>a.game.placement(c).ok)){const q=a.renderer.project(c.x,c.z,.12);if(document.elementFromPoint(q.x,q.y)===a.renderer.canvas&&q.x>200&&q.x<innerWidth-300&&q.y>90&&q.y<innerHeight-80)return q;}return null;});assert.ok(point);await p.touchscreen.tap(point.x,point.y);await click(p,'build:arrow');assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.gold),120);await click(p,'upgrade');assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.gold),30);await screenshot(p,'phone-build');await click(p,'cancel');await click(p,'grid');
    await click(p,'select-hero');const before=await p.evaluate(()=>({x:window.__REALM_WARDENS__.game.hero.x,z:window.__REALM_WARDENS__.game.hero.z})),goal=await p.evaluate(()=>window.__REALM_WARDENS__.renderer.project(0,3,.12));await p.touchscreen.tap(goal.x,goal.y);await p.waitForFunction(b=>{const h=window.__REALM_WARDENS__.game.hero;return Math.hypot(h.x-b.x,h.z-b.z)>.5;},before,{timeout:20000});await click(p,'cancel');
    await p.locator('#skill-0').click();await p.locator('#skill-1').click();await p.touchscreen.tap(goal.x,goal.y);assert.ok(await p.evaluate(()=>window.__REALM_WARDENS__.game.hero.cooldowns.every(x=>x>0)));
    await click(p,'wave');await p.waitForFunction(()=>window.__REALM_WARDENS__.game.enemies.length>0,null,{timeout:20000});await click(p,'pause');const time=await p.evaluate(()=>window.__REALM_WARDENS__.game.time);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.time),time);await click(p,'restart');await click(p,'retry');assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.gold),200);assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.wave),0);
  });
  await check('Compact hero retains precise health in its panel and visible respawn seconds without enlarging the controls (explicit death fixture)',async()=>{
    await click(p,'select-hero');assert.match(await p.locator('#hero-panel-status').textContent(),/生命 620 \/ 620/);assert.match(await p.locator('[data-action="select-hero"]').getAttribute('aria-label'),/生命 620 \/ 620/);
    await p.evaluate(()=>{const a=window.__REALM_WARDENS__;a.game.setPaused(true);Object.assign(a.game.hero,{alive:false,hp:0,respawn:3.4});a.ui.update(1);});
    assert.equal(await p.locator('#hero-respawn').isVisible(),true);assert.equal(await p.locator('#hero-respawn').textContent(),'4s');assert.match(await p.locator('#hero-panel-status').textContent(),/4 秒后重生/);const box=await p.locator('[data-action="select-hero"]').boundingBox();assert.equal(box.height,52);assert.equal(box.width,52);
    await click(p,'pause');await click(p,'restart');await click(p,'retry');assert.equal(await p.locator('#hero-respawn').isVisible(),false);assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.gold),200);
  });
  await check('All 15 battlefields fit every road and the actual town buildings at five phone and tablet landscape sizes',async()=>{
    await p.evaluate(()=>{const a=window.__REALM_WARDENS__;a.store.progress.stars.fill(3);a.store.progress.tips=a.content.allMaps.map(m=>String(m.id));});
    for(const [width,height]of [[568,320],[844,390],[1024,768],[1366,1024],[1180,820]]){
      await p.setViewportSize({width,height});await p.waitForFunction(w=>window.__REALM_WARDENS__.renderer.width===w,width);
      for(const map of [...Array.from({length:12},(_,i)=>i+1),'e1','e2','e3']){
        const rendered=await p.evaluate(map=>{const a=window.__REALM_WARDENS__;a.game.start(a.content.allMaps.find(m=>m.id===map));a.game.setPaused(true);return a.renderer.gpu.info.render.frame;},map);
        await p.waitForFunction(n=>window.__REALM_WARDENS__.renderer.gpu.info.render.frame>n,rendered,{timeout:60000});frames.push(await frame(p,map));
        if(map===1){const l=await layout(p,`${width}×${height} landscape`);validateLayout(l);layouts.push(l);await screenshot(p,`overview-${width}`);}
        if(map===6&&width===1366)await screenshot(p,'tablet-snow');
      }
      console.log(`Measured 15 maps at ${width}×${height}`);
    }
    assert.ok(frames.every(f=>f.misses.length===0&&f.obscured.length===0),JSON.stringify(frames.filter(f=>f.misses.length||f.obscured.length).slice(0,3)));
  });
  await check('Pinch and pan remain live; returning to overview clears the offset and minimum zoom shows the full town',async()=>{
    await p.setViewportSize({width:844,height:390});await p.evaluate(()=>{const a=window.__REALM_WARDENS__;a.game.start(a.content.LEVELS[0]);});const cdp=await p.context().newCDPSession(p),before=await p.evaluate(()=>({...window.__REALM_WARDENS__.renderer.view}));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:350,y:180},{id:2,x:410,y:180}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:320,y:190},{id:2,x:460,y:190}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(await p.evaluate(b=>window.__REALM_WARDENS__.renderer.view.zoom>b.zoom,before));assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.input.pointers.size),0);assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.towers.length),0);await click(p,'reset-view');assert.deepEqual(await p.evaluate(()=>window.__REALM_WARDENS__.renderer.view),{zoom:1,x:0,z:0});await click(p,'view-tools');for(let i=0;i<5;i++)await click(p,'zoom-out');const f=await frame(p,1);assert.equal(f.misses.length,0);assert.equal(f.obscured.length,0);await click(p,'reset-view');await cdp.detach();
  });
  await check('Large notch and home-indicator insets keep thumb controls and the complete map clear (explicit inset fixture)',async()=>{
    await p.setViewportSize({width:568,height:320});await p.evaluate(()=>{const a=window.__REALM_WARDENS__;a.game.start(a.content.ENDLESS[2]);document.body.style.setProperty('--hud-left','44px');document.body.style.setProperty('--hud-right','24px');document.body.style.setProperty('--hud-bottom','24px');a.renderer.fitCamera();});const l=await layout(p,'Simulated notch');validateLayout(l);layouts.push(l);const f=await frame(p,'e3');frames.push({...f,insetFixture:true});assert.equal(f.misses.length,0);assert.equal(f.obscured.length,0,JSON.stringify(f.obscured));await screenshot(p,'notch');
  });
  await phone.context.close();
  const tablet=await open({viewport:{width:1366,height:1024},hasTouch:true,deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'}),t=tablet.page;
  await launch(t);
  await check('Tablet desktop user agent retains floating HUD and touch construction, with no camera jump when opening its panel',async()=>{
    const l=await layout(t,'Tablet desktop UA');validateLayout(l);layouts.push(l);await screenshot(t,'tablet-overview');await click(t,'grid');const point=await t.evaluate(()=>{const a=window.__REALM_WARDENS__,c=a.game.cells.find(c=>a.game.placement(c).ok),p=a.renderer.project(c.x,c.z,.12);return {p,view:{...a.renderer.view},width:a.renderer.width,height:a.renderer.height};});await t.touchscreen.tap(point.p.x,point.p.y);await click(t,'build:arrow');assert.equal(await t.evaluate(()=>window.__REALM_WARDENS__.game.gold),120);assert.deepEqual(await t.evaluate(()=>({...window.__REALM_WARDENS__.renderer.view})),point.view);assert.equal(await t.evaluate(()=>window.__REALM_WARDENS__.renderer.width),point.width);await screenshot(t,'tablet-build');await click(t,'cancel');
  });await tablet.context.close();
  const desktop=await open({viewport:{width:1440,height:900}}),d=desktop.page;await launch(d);
  await check('Fine-pointer desktop retains the existing command bars and camera while touch devices use the new layout',async()=>{const l=await layout(d,'Desktop');assert.equal(l.compact,false);assert.equal(l.header,'flex');assert.equal(l.footer,'flex');assert.equal(await d.locator('[data-action="view-tools"]').isVisible(),false);assert.equal(await d.locator('[data-action="grid"]').isVisible(),true);layouts.push(l);await screenshot(d,'desktop');});await desktop.context.close();
}catch(error){failures.push({name:'Harness',error:error.stack});}finally{await browser.close();}
if(errors.length)failures.push({name:'Runtime errors',errors});
await writeFile('test-results/mobile-hud-report.json',JSON.stringify({status:failures.length?'failed':'passed',date:'2026-10-07',verification:'Forced SwiftShader. Fresh phone UI uses real clicks/touch and normal 200-gold purchases, upgrade, movement, skills, wave, pause and restart. All-map framing uses explicit unlock/paused scene fixtures, checks actual road points and GLB town boxes. Notch is an explicit CSS inset fixture; hero death/respawn display is an explicit state fixture. Phone/tablet/desktop user agents and input are Chrome emulation, not physical-device validation or Safari execution.',checks,failures,layouts,frames,errors},null,2));
console.log(JSON.stringify({status:failures.length?'failed':'passed',checks:checks.length,failures,layouts:layouts.map(l=>({label:l.label,hudAreaFraction:l.hudAreaFraction})),frames:frames.length,errors}));
if(failures.length)process.exitCode=1;
