import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],checks=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const click=action=>page.locator(`[data-action="${action}"]`).click();
const read=()=>page.evaluate(()=>window.__REALM_WARDENS__.snapshot());
const canvasClick=async p=>{const box=await page.locator('#scene').boundingBox();await page.mouse.click(box.x+p.x,box.y+p.y);};
async function selectSite(site){
  if(await page.locator('[data-action="cancel"]').count())await click('cancel');
  const mode=await page.evaluate(id=>{const a=window.__REALM_WARDENS__;return {build:!a.game.towers.some(t=>t.site===id),grid:a.renderer.showGrid};},site);
  if(mode.build!==mode.grid)await click('grid');
  const p=await page.evaluate(id=>{const a=window.__REALM_WARDENS__,s=a.game.cells.find(s=>s.id===id),t=a.game.towers.find(t=>t.site===id);return a.renderer.project(s.x,s.z,t?1.45:.25);},site);
  await canvasClick(p);await page.waitForTimeout(80);
}
async function decision(){return page.evaluate(()=>{
  const a=window.__REALM_WARDENS__,g=a.game,T=a.content.TOWERS,stats=a.content.towerStats,dist=(x,y)=>Math.hypot(x.x-y.x,x.z-y.z);
  const ranked=g.cells.map(s=>{let score=0;for(const r of g.map.routes)for(let d=0;d<r.length;d+=.6)if(dist(s,r.at(d))<5.7)score+=.6*(.6+.6*d/r.length);return {...s,score};}).sort((a,b)=>b.score-a.score);
  const samples=[];for(const r of g.map.routes)for(let d=0;d<r.length-1.5;d+=.8){const p=r.at(d);let c=0;for(const t of g.towers)if(dist(p,t)<stats(t).range)c++;samples.push({...p,weight:(.5+.65*d/r.length)/(1+c*3)});}
  const next=g.cells.filter(s=>g.placement(s).ok).map(s=>({...s,value:samples.filter(p=>dist(p,s)<5.8).reduce((n,p)=>n+p.weight,0)})).sort((a,b)=>b.value-a.value)[0];
  const plan=['arcane','arrow','cannon','ballista','frost','nature','thunder','barracks','arrow'],filled=g.towers.length,k=plan[filled%plan.length];
  if(filled<4&&next&&g.gold>=T[k].cost)return {action:'build:'+k,site:next.id};
  const up=g.towers.filter(t=>t.level<3).sort((a,b)=>a.level-b.level||ranked.findIndex(s=>s.id===a.site)-ranked.findIndex(s=>s.id===b.site))[0];
  if(up&&g.gold>=T[up.kind].upgrades[up.level-1])return {action:'upgrade',site:up.site};
  const spec=g.towers.find(t=>t.level===3&&t.spec===null);if(spec&&g.gold>=T[spec.kind].specs[0].cost)return {action:'spec:0',site:spec.site};
  if(next&&g.gold>=T[k].cost)return {action:'build:'+k,site:next.id};
  return null;
});}
async function prepare(){
  if(await page.locator('[data-action="cancel"]').count())await click('cancel');
  for(let i=0;i<55;i++){const d=await decision();if(!d)break;await selectSite(d.site);const b=page.locator(`[data-action="${d.action}"]`);if(!await b.count())throw Error(`Missing ${d.action}`);await b.click();await page.waitForTimeout(55);}
  if(await page.locator('[data-action="cancel"]').count())await click('cancel');
  const p=await page.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game;const score=s=>g.map.routes.reduce((total,r)=>{for(let d=0;d<r.length;d+=.6)if(Math.hypot(s.x-r.at(d).x,s.z-r.at(d).z)<5.7)total+=.6*(.6+.6*d/r.length);return total;},0);const site=[...g.cells].sort((x,y)=>score(y)-score(x))[0],r=g.nearestRoad(site);return g.hero.alive&&Math.hypot(g.hero.x-r.x,g.hero.z-r.z)>2?a.renderer.project(r.x,r.z,.12):null;});
  if(p){await click('select-hero');await page.waitForTimeout(220);const point=await page.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game;const scores=g.cells.map(s=>{let score=0;for(const r of g.map.routes)for(let d=0;d<r.length;d+=.6){const p=r.at(d);if(Math.hypot(s.x-p.x,s.z-p.z)<5.7)score+=.6*(.6+.6*d/r.length);}return {...s,score};}).sort((x,y)=>y.score-x.score),r=g.nearestRoad(scores[0]);return a.renderer.project(r.x,r.z,.12);});await canvasClick(point);await page.waitForTimeout(50);if(await page.locator('[data-action="cancel"]').count())await click('cancel');}
}
async function skills(){
  const target=await page.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game,h=g.hero;if(!h.alive||!g.canAct())return null;const e=[...g.enemies].filter(e=>e.alive&&g.legalGround(e)).sort((a,b)=>b.maxHp-a.maxHp)[0];return {first:h.cooldowns[0]<=0&&g.enemies.some(e=>Math.hypot(e.x-h.x,e.z-h.z)<2.2),second:h.cooldowns[1]<=0&&!!e,point:e?{x:e.x,z:e.z}:null};});
  if(!target)return;if(target.first)await page.locator('#skill-0').click();if(target.second){await page.locator('#skill-1').click();await page.waitForTimeout(40);const p=await page.evaluate(p=>window.__REALM_WARDENS__.renderer.project(p.x,p.z,.12),target.point);await canvasClick(p);}
}
try{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:60000});await page.waitForTimeout(900);
  await click('modes');await click('campaign');await click('detail:1');await click('heroes');await click('launch');await click('speed');
  let savedCombat=false,bossSaved=false,bossPause=false;
  const count=Number(process.env.PLAY_LEVELS||4);
  for(let level=1;level<=count;level++){
    const started=Date.now();let preparedWave=-1;
    while(Date.now()-started<480000){
      const s=await read();
      if(s.mode==='victory'||s.mode==='defeat'){results.push(s);console.log(JSON.stringify({normalBrowserLevel:level,mode:s.mode,lives:s.lives,time:s.time,kills:s.kills}));await page.screenshot({path:`test-results/normal-level-${level}-result.png`});assert.equal(s.mode,'victory');break;}
      if(s.warning&&!bossSaved){await page.screenshot({path:'test-results/normal-boss-warning.png'});bossSaved=true;}
      if(s.warning&&!bossPause){await click('pause');const before=await read();await page.waitForTimeout(600);const after=await read();assert.equal(after.warning.remaining,before.warning.remaining);assert.equal(after.time,before.time);checks.push('Normal Boss warning freezes correctly while paused');await click('resume');bossPause=true;}
      if(!s.warning){if(s.wave!==preparedWave){await prepare();preparedWave=s.wave;}if(s.wave===0)await click('wave');else await skills();}
      if(!savedCombat&&s.enemies>=4){await page.screenshot({path:'test-results/normal-combat.png'});savedCombat=true;}
      await page.waitForTimeout(360);
    }
    assert.equal((await read()).mode,'victory','Normal UI run timed out');
    if(level<count){await click('next-level');await click('launch');await click('speed');}
  }
  const progress=await page.evaluate(()=>window.__REALM_WARDENS__.store.progress);
  await page.reload();await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:60000});await page.waitForTimeout(600);assert.deepEqual(await page.evaluate(()=>window.__REALM_WARDENS__.store.progress.stars),progress.stars);checks.push('Earned campaign stars and unlocks persist after reload');
  assert.deepEqual(errors,[]);
  await writeFile('test-results/normal-play-report.json',JSON.stringify({status:'passed',verification:'Normal browser play through UI; real 1×/2× clocks; no altered gold, invulnerability, skip, forced result or saved unlock injection',url:process.env.GAME_URL||'http://127.0.0.1:5175/',levels:results,checks,errors,progress},null,2));
  console.log(JSON.stringify({status:'passed',completedLevels:results.length,checks,errors}));
}catch(error){await page.screenshot({path:'test-results/normal-play-failure.png'}).catch(()=>{});await writeFile('test-results/normal-play-report.json',JSON.stringify({status:'failed',error:error.stack,levels:results,errors,snapshot:await read().catch(()=>null)},null,2));throw error;}
finally{await browser.close();}
