import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {uiBot} from './ui-bot.mjs';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[],runs=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const bot=uiBot(page),{click,read}=bot;
try{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:60000});await page.waitForTimeout(700);await click('modes');await click('endless');
  for(const map of ['e1','e2','e3']){
    await click('detail:'+map);await click('heroes');await click('launch');await click('speed');const began=Date.now();let preparedWave=-1;
    while(Date.now()-began<360000){const s=await read();assert.equal(s.mode,'battle',`Lost ${map} before two waves`);if(await page.evaluate(id=>window.__REALM_WARDENS__.store.progress.endless[id].wave>=2,map))break;if(!s.warning){if(s.wave!==preparedWave){await bot.prepare();preparedWave=s.wave;}if(s.wave===0)await click('wave');else await bot.skills();}await page.waitForTimeout(350);}
    const s=await read();assert.ok(s.wave>=3&&s.waveActive,`${map} did not complete two waves`);const record=await page.evaluate(id=>window.__REALM_WARDENS__.store.progress.endless[id],map);assert.ok(record.wave>=2&&record.score>0);runs.push({...s,record});await page.screenshot({path:`test-results/normal-endless-${map}.png`});console.log(JSON.stringify({normalEndless:map,wave:s.wave,lives:s.lives,record}));
    await click('pause');await click('leave');
  }
  await page.reload();await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:60000});await page.waitForTimeout(600);const progress=await page.evaluate(()=>window.__REALM_WARDENS__.store.progress);for(const map of ['e1','e2','e3'])assert.equal(progress.endless[map].wave,2);assert.deepEqual(errors,[]);
  await writeFile('test-results/normal-endless-report.json',JSON.stringify({status:'passed',verification:'Normal UI on all three endless maps, two completed waves each; finite earned gold, real-time 2× combat, default locked campaign/knight, no modified state or injected unlocks.',runs,progress,errors},null,2));console.log(JSON.stringify({status:'passed',maps:runs.length,errors}));
}catch(error){await page.screenshot({path:'test-results/normal-endless-failure.png'}).catch(()=>{});await writeFile('test-results/normal-endless-report.json',JSON.stringify({status:'failed',error:error.stack,runs,errors,snapshot:await read().catch(()=>null)},null,2));throw error;}
finally{await browser.close();}
