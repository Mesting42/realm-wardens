import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'}),layouts=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5175/?safe=1');await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:60000});
  await page.locator('[data-display-enter]').click();await page.waitForFunction(()=>window.__REALM_WARDENS__.display.entered);if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());
  for(const action of ['modes','campaign','detail:1','heroes','launch'])await page.locator(`[data-action="${action}"]`).last().click();
  for(const [width,height]of [[568,320],[667,375],[800,360],[915,412]]){
    await page.setViewportSize({width,height});await page.waitForFunction(w=>window.__REALM_WARDENS__.renderer.width===w,width);
    const value=await page.evaluate(()=>({width:innerWidth,height:innerHeight,blocked:window.__REALM_WARDENS__.display.blocked,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('.battle-header button,.battle-bottom button,.view-controls button,.view-toggle')].filter(e=>e.offsetParent!==null).map(e=>{const r=e.getBoundingClientRect();return {action:e.dataset.action,height:r.height,inBounds:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};})}));
    assert.equal(value.blocked,false);assert.equal(value.overflow,false);assert.ok(value.buttons.every(b=>b.inBounds&&b.height>=44),JSON.stringify(value));layouts.push(value);
  }
  assert.deepEqual(errors,[]);await writeFile('test-results/compact-landscape-report.json',JSON.stringify({status:'passed',verification:'Chrome mobile viewport/touch emulation with software rendering; normal UI opens level one. No physical device verification.',layouts,errors},null,2));console.log(JSON.stringify({status:'passed',layouts:layouts.length,errors}));
}finally{await browser.close();}
