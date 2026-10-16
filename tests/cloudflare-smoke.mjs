import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const target=new URL(process.argv[2]||'https://mest-rw.pages.dev/');
assert.equal(target.protocol,'https:');
assert.match(target.hostname,/^[a-z0-9.-]+\.pages\.dev$/);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const errors=[],models=[],assets=[],pending=[],checks=[];
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
try{
  const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('requestfailed',request=>errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response',response=>{
    const url=new URL(response.url());
    if(url.origin!==target.origin||!/^\/(models|assets)\//.test(url.pathname))return;
    pending.push((async()=>{
      assert.equal(response.status(),200,url.pathname);
      const bytes=await response.body(),local=await readFile(`dist${url.pathname}`);
      assert.equal(hash(bytes),hash(local),url.pathname);
      const result={file:url.pathname,status:response.status(),bytes:bytes.length,sha256:hash(bytes),cacheControl:response.headers()['cache-control']};
      if(url.pathname.startsWith('/models/')){assert.equal(bytes.toString('ascii',0,4),'glTF');models.push(result);}
      else{assert.match(result.cacheControl,/immutable/);assets.push(result);}
    })().catch(error=>errors.push(error.message)));
  });
  const response=await page.goto(new URL('?safe=1',target).href,{waitUntil:'domcontentloaded',timeout:90000});
  assert.equal(response.status(),200);
  assert.equal((await response.text()).trim(),(await readFile('dist/index.html','utf8')).trim());
  checks.push({name:'HTTPS homepage matches current production index',status:response.status(),server:response.headers().server});
  await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:180000});
  await Promise.all(pending);
  assert.equal(models.length,77);assert.equal(assets.length,3);
  const assetStatus=await page.evaluate(()=>window.__REALM_WARDENS__.assetStatus());
  assert.equal(assetStatus.loaded,77);assert.equal(assetStatus.expected,77);
  checks.push({name:'All 77 deployed models and 3 built bundles match local SHA256',models:models.length,assets:assets.length});
  if(await page.locator('#display-root').isVisible()){
    await page.locator('[data-display-enter]').click();
    if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());
  }
  await page.screenshot({path:'test-results/cloudflare-mobile-home.png'});
  const click=async action=>page.locator(`[data-action="${action}"]`).last().click();
  for(const action of['modes','endless','detail:e1','heroes','launch'])await click(action);
  if(await page.locator('[data-action="dismiss-tip"]').count())await click('dismiss-tip');
  for(let i=0;i<2;i++){
    if(!await page.locator('[data-action="grid"]').isVisible())await click('view-tools');
    if(await page.locator('[data-action="grid"]').getAttribute('aria-pressed')!=='true')await click('grid');
    const point=await page.evaluate(()=>{
      const a=window.__REALM_WARDENS__,g=a.game;
      const cells=g.cells.filter(c=>g.placement(c).ok).map(c=>({...c,score:g.map.routes.reduce((sum,r)=>{for(let d=0;d<r.length;d++){const p=r.at(d);if(Math.hypot(p.x-c.x,p.z-c.z)<5.4)sum+=1+.5*d/r.length;}return sum;},0)})).sort((a,b)=>b.score-a.score);
      return a.renderer.project(cells[0].x,cells[0].z,.12);
    });
    await page.touchscreen.tap(point.x,point.y);await click('build:arrow');await click('cancel');
  }
  assert.equal(await page.evaluate(()=>window.__REALM_WARDENS__.game.gold),40);
  await click('wave');await page.waitForFunction(()=>window.__REALM_WARDENS__.game.enemies.length>0);
  const opening=await page.evaluate(()=>{const g=window.__REALM_WARDENS__.game;return{wave:g.wave,gold:g.gold,towers:g.towers.length,enemies:g.enemies.length,time:g.time};});
  assert.equal(opening.wave,1);assert.equal(opening.towers,2);
  await click('pause');assert.equal(await page.evaluate(()=>window.__REALM_WARDENS__.game.paused),true);
  await click('resume');await page.waitForFunction(t=>window.__REALM_WARDENS__.game.time>t,opening.time);
  await page.screenshot({path:'test-results/cloudflare-mobile-battle.png'});
  checks.push({name:'Fresh public mobile menu, two paid towers (200 to 40), first wave and pause/resume',opening});
  assert.deepEqual(errors,[]);
  await writeFile('test-results/cloudflare-smoke-report.json',JSON.stringify({status:'passed',date:'2026-10-07',url:target.href,scope:'Public HTTPS deployment, fresh Chrome touch/UA emulation at 844x390, forced SwiftShader. Real menu/touch purchases and first-wave simulation. SHA256 checked against local dist for every loaded model and bundle. No physical-device or Safari claim.',checks,models,assets,errors},null,2));
  console.log(JSON.stringify({status:'passed',url:target.href,checks:checks.length,models:models.length,assets:assets.length,errors}));
}catch(error){
  await writeFile('test-results/cloudflare-smoke-report.json',JSON.stringify({status:'failed',url:target.href,error:error.stack,checks,models,assets,errors},null,2));throw error;
}finally{await browser.close();}
