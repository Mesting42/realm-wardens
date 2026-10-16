import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results/v2',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__REALM_WARDENS__,{timeout:60000});
const shot=async name=>{await page.waitForFunction(()=>[...document.querySelectorAll('img[data-model-map],img[data-model-hero],img[data-model-tower]')].every(i=>i.complete&&i.naturalWidth>0),{timeout:20000});await page.waitForTimeout(350);await page.screenshot({path:`test-results/v2/${name}.png`});};
await shot('home');await page.locator('[data-action="modes"]').click();await page.locator('[data-action="campaign"]').click();await shot('campaign-forest');
for(const chapter of [1,2]){await page.locator(`[data-action="chapter:${chapter}"]`).click();await shot('campaign-'+chapter);}
await page.locator('[data-action="chapter:0"]').click();await page.locator('[data-action="detail:1"]').click();await shot('detail');await page.locator('[data-action="heroes"]').click();await shot('heroes');await page.locator('[data-action="launch"]').click();await shot('battle');
const model=await page.evaluate(()=>{const a=window.__REALM_WARDENS__;return {assets:a.assetStatus(),snapshot:a.snapshot(),obstacles:a.game.scenery.length,cells:a.game.cells.length,heroModel:a.renderer.units.get(a.game.hero.id)?.root.name};});
console.log(JSON.stringify({errors,model}));await writeFile('test-results/v2/initial-inspection.json',JSON.stringify({errors,model},null,2));await browser.close();
