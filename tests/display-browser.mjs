import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const url=process.env.GAME_URL||'http://127.0.0.1:5175/?safe=1';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--hide-scrollbars'],args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const checks=[],errors=[],evidence=[];
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
const phoneUA='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
async function open(options,init){
  const context=await browser.newContext(options);if(init)await context.addInitScript(init);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:60000});
  return {context,page};
}
const click=async(p,action)=>{const b=p.locator(`[data-action="${action}"]`).last();if(['grid','zoom-in','zoom-out','reset-view','fullscreen'].includes(action)&&!await b.isVisible())await p.locator('[data-action="view-tools"]').click();await b.click();};
const display=p=>p.evaluate(()=>window.__REALM_WARDENS__.display.snapshot());
const snap=p=>p.evaluate(()=>window.__REALM_WARDENS__.snapshot());
const screenShot=(p,name)=>p.screenshot({path:`test-results/display-${name}.png`});
async function launch(p){for(const action of ['modes','campaign','detail:1','heroes','launch'])await click(p,action);}
async function layout(p){return p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('.battle-header button,.battle-bottom button')].map(e=>{const b=e.getBoundingClientRect();return {action:e.dataset.action,inBounds:b.x>=0&&b.y>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1,height:b.height};})}));}
try{
  const desktop=await open({viewport:{width:1440,height:900}}),p=desktop.page;
  await check('Desktop retains window entry; software GPU and existing pixel budget remain active',async()=>{
    assert.equal((await display(p)).mobile,false);assert.equal((await display(p)).blocked,false);
    assert.equal(await p.locator('#display-root').isVisible(),false);
    await p.waitForFunction(()=>window.__REALM_WARDENS__.renderer.metrics().drawCalls>0);
    const renderer=await p.evaluate(()=>{const g=window.__REALM_WARDENS__.renderer.gpu.getContext(),ext=g.getExtension('WEBGL_debug_renderer_info');return ext&&g.getParameter(ext.UNMASKED_RENDERER_WEBGL);});
    assert.match(renderer,/SwiftShader/i);const pixels=await p.evaluate(()=>{const c=window.__REALM_WARDENS__.renderer.canvas;return c.width*c.height;});assert.ok(pixels<=3500000);evidence.push({renderer,pixels});
  });
  await check('Codex uses visible green thumb and deep green track; real scrolling still works',async()=>{
    await click(p,'codex');await p.waitForFunction(()=>document.querySelectorAll('.codex-model.ready').length===42,null,{timeout:60000});
    const value=await p.locator('.codex-sheet').evaluate(e=>{const style=getComputedStyle(e);e.scrollTop=260;return {color:style.scrollbarColor,width:style.scrollbarWidth,gutter:style.scrollbarGutter,scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,height:e.clientHeight};});
    assert.equal(value.color,'rgb(125, 166, 138) rgb(28, 53, 46)');assert.equal(value.width,'thin');assert.ok(value.scrollTop>0&&value.scrollHeight>value.height);
    await p.locator('.codex-sheet').evaluate(e=>e.scrollTop=0);await screenShot(p,'green-codex');evidence.push({codex:value});await click(p,'close-modal');
  });
  await check('Settings uses native fullscreen from a trusted click, reflects entry/exit, and respects browser Escape',async()=>{
    await click(p,'settings');assert.equal(await p.locator('#settings-fullscreen').textContent(),'进入全屏');
    await click(p,'fullscreen');await p.waitForFunction(()=>!!document.fullscreenElement);assert.equal(await p.locator('#settings-fullscreen').textContent(),'退出全屏');
    await click(p,'fullscreen');await p.waitForFunction(()=>!document.fullscreenElement);assert.equal(await p.locator('#settings-fullscreen').textContent(),'进入全屏');
    assert.equal((await display(p)).blocked,false);await click(p,'fullscreen');await p.waitForFunction(()=>!!document.fullscreenElement);
    // Browser API exit models the browser's independent Escape/back action.
    await p.evaluate(()=>document.exitFullscreen());await p.waitForFunction(()=>!document.fullscreenElement);
    await p.waitForFunction(()=>document.getElementById('settings-fullscreen').textContent==='进入全屏');assert.equal((await display(p)).blocked,false);await click(p,'close-modal');
  });
  await desktop.context.close();
  const phone=await open({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3,userAgent:phoneUA}),m=phone.page;
  await check('Phone first entry requires a real gesture; portrait gate blocks menus, canvas, keyboard and rendering',async()=>{
    assert.deepEqual([...(await m.evaluate(()=>['ui','world','modal-root'].map(id=>document.getElementById(id).inert)))],[true,true,true]);
    assert.equal((await display(m)).mobile,true);assert.equal((await display(m)).entered,false);
    const before=await snap(m),frame=await m.evaluate(()=>window.__REALM_WARDENS__.renderer.gpu.info.render.frame);
    await m.keyboard.press('H');await m.keyboard.press('1');await m.keyboard.press('Escape');await m.waitForTimeout(350);
    assert.equal((await snap(m)).time,before.time);assert.equal(await m.evaluate(()=>window.__REALM_WARDENS__.renderer.gpu.info.render.frame),frame);
    await screenShot(m,'phone-entry');await m.locator('[data-display-enter]').click();await m.waitForFunction(()=>window.__REALM_WARDENS__.display.entered);
    evidence.push({phoneNative:await display(m)});
    await m.setViewportSize({width:844,height:390});await m.waitForFunction(()=>!window.__REALM_WARDENS__.display.blocked);
    await m.waitForFunction(()=>window.__REALM_WARDENS__.renderer.metrics().drawCalls>0);
  });
  await check('Phone landscape normal UI flow, settings fullscreen exit and affordable placement work with touch coordinates',async()=>{
    await click(m,'settings');if((await display(m)).fullscreen)await click(m,'fullscreen');await m.waitForFunction(()=>!document.fullscreenElement);
    await click(m,'close-modal');await launch(m);assert.equal((await snap(m)).gold,200);
    await click(m,'grid');
    const point=await m.evaluate(()=>{const a=window.__REALM_WARDENS__;for(const cell of a.game.cells.filter(c=>a.game.placement(c).ok)){const p=a.renderer.project(cell.x,cell.z,.12);if(document.elementFromPoint(p.x,p.y)===a.renderer.canvas&&p.x>90&&p.y>125&&p.y<innerHeight-105)return p;}return null;});assert.ok(point);
    await m.touchscreen.tap(point.x,point.y);await click(m,'build:arrow');assert.equal((await snap(m)).gold,120);assert.equal((await snap(m)).towers.length,1);await click(m,'cancel');
    const l=await layout(m);assert.equal(l.overflow,false);assert.ok(l.buttons.every(b=>b.inBounds&&b.height>=44));evidence.push({phoneLayout:l});await screenShot(m,'phone-landscape');
  });
  await check('Mid-wave portrait rotation clears touch, freezes combat/audio, keeps gold/wave/units and requires explicit resume',async()=>{
    await click(m,'wave');await m.waitForFunction(()=>window.__REALM_WARDENS__.game.enemies.length>0);
    const cdp=await phone.context.newCDPSession(m);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:600,y:180,radiusX:2,radiusY:2}]});
    assert.equal(await m.evaluate(()=>window.__REALM_WARDENS__.input.pointers.size),1);
    await m.setViewportSize({width:390,height:844});await m.waitForFunction(()=>window.__REALM_WARDENS__.display.blocked);
    const before=await snap(m);assert.equal(before.paused,true);assert.equal(await m.evaluate(()=>window.__REALM_WARDENS__.input.pointers.size),0);
    await m.keyboard.press('Space');await m.keyboard.press('Escape');await m.waitForTimeout(450);
    const after=await snap(m);for(const key of ['time','gold','wave','kills'])assert.equal(after[key],before[key]);assert.deepEqual(after.enemies,before.enemies);
    assert.equal(await m.evaluate(()=>window.__REALM_WARDENS__.audio.paused),true);await screenShot(m,'phone-rotate-paused');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();
    await m.setViewportSize({width:844,height:390});await m.waitForFunction(()=>!window.__REALM_WARDENS__.display.blocked);
    assert.equal((await snap(m)).paused,true);assert.equal(await m.evaluate(()=>window.__REALM_WARDENS__.ui.modal),'pause');
    await click(m,'resume');await m.waitForFunction(t=>window.__REALM_WARDENS__.game.time>t,before.time);
    assert.equal((await snap(m)).gold,before.gold);assert.equal((await snap(m)).map,before.map);
  });
  await check('User pause and settings survive orientation changes without unexpectedly resuming or resetting a battle',async()=>{
    await click(m,'settings');const before=await snap(m);await m.setViewportSize({width:390,height:844});await m.waitForFunction(()=>window.__REALM_WARDENS__.display.blocked);
    await m.setViewportSize({width:844,height:390});await m.waitForFunction(()=>!window.__REALM_WARDENS__.display.blocked);
    assert.equal(await m.evaluate(()=>window.__REALM_WARDENS__.ui.modal),'settings');assert.equal((await snap(m)).time,before.time);
    assert.equal((await snap(m)).gold,before.gold);await click(m,'close-modal');assert.equal((await snap(m)).paused,false);
  });
  await phone.context.close();
  const tablet=await open({viewport:{width:768,height:1024},hasTouch:true,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'},()=>{
    // Explicit capability fixture: iPad desktop UA + unsupported fullscreen and
    // orientation locking. These are fallback checks, not physical Safari proof.
    Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'});
    Object.defineProperty(document,'fullscreenEnabled',{get:()=>false});
    Object.defineProperty(document,'webkitFullscreenEnabled',{get:()=>false});
    Object.defineProperty(screen.orientation,'lock',{value:undefined,configurable:true});
  }),t=tablet.page;
  await check('iPad desktop UA is detected; unavailable fullscreen/orientation use a manual landscape fallback',async()=>{
    assert.equal((await display(t)).mobile,true);await t.locator('[data-display-enter]').click();await t.waitForFunction(()=>window.__REALM_WARDENS__.display.entered);
    assert.equal((await display(t)).blocked,true);assert.equal((await display(t)).orientation,'unsupported');assert.match(await t.locator('#display-help').textContent(),/手动旋转/);
    await t.setViewportSize({width:1024,height:768});await t.waitForFunction(()=>!window.__REALM_WARDENS__.display.blocked);await launch(t);
    const l=await layout(t);assert.equal(l.overflow,false);assert.ok(l.buttons.every(b=>b.inBounds));await click(t,'settings');assert.equal(await t.locator('#settings-fullscreen').isDisabled(),true);
    await screenShot(t,'tablet-settings');evidence.push({tabletFallback:await display(t),layout:l});
  });
  await tablet.context.close();
  const locked=await open({viewport:{width:844,height:390},hasTouch:true,isMobile:true,userAgent:phoneUA},()=>{
    window.orientationCalls=[];
    Object.defineProperty(screen.orientation,'lock',{value:async direction=>{window.orientationCalls.push({direction,fullscreen:!!document.fullscreenElement});},configurable:true});
  }),l=locked.page;
  await check('Supported orientation capability requests landscape after actual native fullscreen (explicit lock fixture)',async()=>{
    await l.locator('[data-display-enter]').click();await l.waitForFunction(()=>window.__REALM_WARDENS__.display.entered);
    assert.deepEqual(await l.evaluate(()=>window.orientationCalls),[{direction:'landscape',fullscreen:true}]);assert.equal((await display(l)).orientation,'locked');
    await click(l,'settings');await click(l,'fullscreen');assert.equal((await display(l)).fullscreen,false);assert.equal((await display(l)).entered,true);
  });
  assert.deepEqual(errors,[]);
  await writeFile('test-results/display-report.json',JSON.stringify({status:'passed',url,verification:'Software SwiftShader only. Trusted clicks test actual Chrome Fullscreen API; phone/tablet are Playwright emulation. Unsupported Safari/iPad and supported orientation-lock branches use explicitly labelled capability fixtures; no physical-device or real Safari verification.',checks,evidence,errors},null,2));
  console.log(JSON.stringify({status:'passed',checks:checks.length,errors}));
}catch(error){await writeFile('test-results/display-report.json',JSON.stringify({status:'failed',error:error.stack,checks,evidence,errors},null,2));throw error;}
finally{await browser.close();}
