import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('test-results/v3',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],scenes=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5175/');
  await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});
  for(const map of [1,5,6,9]){
    // Visual fixture: unlock each region; use the normal starting gold and no enemies.
    const scene=await page.evaluate(map=>{
      const a=window.__REALM_WARDENS__;a.store.progress.stars.fill(3);
      a.game.start(a.content.allMaps.find(m=>m.id===map),'knight');
      a.game.selected=null;a.game.changed();document.getElementById('battle-guide').innerHTML='';
      return {map,region:a.game.map.region,plan:a.renderer.town.plan,residents:a.renderer.town.residents.length};
    },map);
    await page.waitForTimeout(400);
    scene.screenshot=`test-results/v3/town-walls-map-${map}.png`;
    await page.screenshot({path:scene.screenshot});
    scenes.push(scene);
    if(map===5){
      // Same actual scene, centered on the town to make masonry joins visible.
      await page.evaluate(()=>{
        const r=window.__REALM_WARDENS__.renderer,c=r.town.plan.center;
        r.view={zoom:1.7,x:c.x-3.5,z:c.z-1.5};r.fitCamera();
      });
      await page.waitForTimeout(200);
      await page.screenshot({path:'test-results/v3/town-walls-snow-close.png'});
    }
  }
  assert.deepEqual(errors,[]);
  const report={date:'2026-10-06',status:'passed',scope:'Visual fixtures for three regions and a two-gate town; screenshots require visual inspection.',scenes,errors};
  await writeFile('test-results/v3/town-walls-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}finally{await browser.close();}
