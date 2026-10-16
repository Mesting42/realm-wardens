import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const errors=[],layouts=[],growth=[],states=[];
const click=async(p,action)=>p.locator('[data-action="'+action+'"]').last().click();
const capture=async(p,label)=>{
 const s=await p.evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const b=document.getElementById('boss-hud'),n=b.querySelector('.boss-name'),v=b.querySelector('.boss-vitals'),track=b.querySelector('[role="progressbar"]'),c=getComputedStyle(b),filters=[];
  for(let el=b;el;el=el.parentElement){const s=getComputedStyle(el);filters.push({backdrop:s.backdropFilter,webkitBackdrop:s.getPropertyValue('-webkit-backdrop-filter'),filter:s.filter});}
  return{width:innerWidth,height:innerHeight,compact:document.body.classList.contains('compact-battle'),boss:box(b),resources:box(document.querySelector('.battle-resources')),controls:box(document.querySelector('.battle-controls')),name:n.textContent,nameClipped:n.scrollWidth>n.clientWidth+1,background:c.backgroundColor,border:c.borderTopWidth,shadow:c.boxShadow,headerBackground:getComputedStyle(b.closest('header')).backgroundColor,filters,vitals:[...v.children].map(e=>({text:e.textContent,...box(e)})),vitalsBox:box(v),hp:+track.getAttribute('aria-valuenow'),maxHp:+track.getAttribute('aria-valuemax'),fill:track.firstElementChild.style.width,oldStatus:!!b.querySelector('.boss-name span'),overflow:document.documentElement.scrollWidth>innerWidth};
 });layouts.push({label,...s});
 assert.equal(s.background,'rgba(0, 0, 0, 0)');assert.equal(s.border,'0px');assert.equal(s.shadow,'none');assert.equal(s.oldStatus,false);assert.equal(s.nameClipped,false);assert.equal(s.overflow,false);assert.equal(s.boss.height,44);
 for(const f of s.filters){assert.ok(!f.backdrop||f.backdrop==='none');assert.ok(!f.webkitBackdrop||f.webkitBackdrop==='none');assert.equal(f.filter,'none');}if(s.compact)assert.equal(s.headerBackground,'rgba(0, 0, 0, 0)');
 for(const r of[s.resources,s.controls])assert.ok(Math.abs(s.boss.y+s.boss.height/2-r.y-r.height/2)<1,JSON.stringify(s));
 assert.ok(s.boss.x>=s.resources.right+8&&s.boss.right+8<=s.controls.x,JSON.stringify(s));
 for(const v of s.vitals){assert.ok(v.x>=s.boss.x-.5&&v.right<=s.boss.right+.5&&v.y>=s.boss.y-.5&&v.bottom<=s.boss.bottom+.5,JSON.stringify(s));}
 assert.equal(s.vitals[0].text,s.hp.toLocaleString());assert.equal(s.vitals[1].text,'/ '+s.maxHp.toLocaleString());assert.equal(s.fill,'65%');console.log('PASS '+label);
};
try{
 for(const touch of[true,false]){
  const context=await browser.newContext({viewport:{width:touch?844:1600,height:touch?390:1000},hasTouch:touch,isMobile:touch,deviceScaleFactor:1,...(touch?{userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'}:{})}),p=await context.newPage();
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto('http://127.0.0.1:5175/?safe=1');await p.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});
  if(await p.locator('#display-root').isVisible()){await p.locator('[data-display-enter]').click();if(await p.evaluate(()=>!!document.fullscreenElement))await p.evaluate(()=>document.exitFullscreen());}
  if(touch){
   for(const action of['modes','endless','detail:e1','heroes','launch'])await click(p,action);
   if(await p.locator('[data-action="dismiss-tip"]').count())await click(p,'dismiss-tip');
   for(let i=0;i<2;i++){
    if(!await p.locator('[data-action="grid"]').isVisible())await click(p,'view-tools');
    if(await p.locator('[data-action="grid"]').getAttribute('aria-pressed')!=='true')await click(p,'grid');
    const point=await p.evaluate(()=>{
     const a=window.__REALM_WARDENS__,g=a.game,scores=g.cells.filter(c=>g.placement(c).ok).map(c=>({...c,score:g.map.routes.reduce((sum,r)=>{for(let d=0;d<r.length;d+=1){const q=r.at(d);if(Math.hypot(q.x-c.x,q.z-c.z)<5.4)sum+=1+.5*d/r.length;}return sum;},0)})).sort((a,b)=>b.score-a.score);
     return a.renderer.project(scores[0].x,scores[0].z,.12);
    });
    await p.touchscreen.tap(point.x,point.y);await click(p,'build:arrow');await click(p,'cancel');
   }
   assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.gold),40);
   await click(p,'wave');await p.waitForFunction(()=>window.__REALM_WARDENS__.game.enemies.length>0);
   const opening=await p.evaluate(()=>{const g=window.__REALM_WARDENS__.game;return{wave:g.wave,gold:g.gold,towers:g.towers.map(t=>({kind:t.kind,level:t.level})),enemies:g.enemies.map(e=>({kind:e.kind,hp:e.maxHp,armor:e.armor,resist:e.resist,speed:e.speed}))};});assert.equal(opening.wave,1);assert.equal(opening.towers.length,2);states.push({normalUI:true,opening});
   await click(p,'pause');assert.equal(await p.evaluate(()=>window.__REALM_WARDENS__.game.paused),true);await click(p,'resume');
  }
  await p.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game;g.start(a.content.ENDLESS[1]);g.setPaused(true);g.wave=80;const e=g.spawn('iceking',0,12,{noWarning:true});e.hp=e.maxHp*.65;a.ui.update(1);a.renderer.render(0);});
  for(const [width,height]of(touch?[[568,320],[844,390],[1024,768],[1366,1024]]:[[1280,800],[1600,1000],[915,412]])){
   await p.setViewportSize({width,height});await p.waitForTimeout(120);await p.evaluate(()=>{const a=window.__REALM_WARDENS__;a.ui.update(1);a.renderer.render(0);});await capture(p,(touch?'touch-':'desktop-')+width);
   if(touch&&[844,1366].includes(width))await p.screenshot({path:'test-results/endless-growth-boss-'+width+'.png'});
   if(!touch&&width===1600)await p.screenshot({path:'test-results/endless-growth-boss-desktop.png'});
  }
  if(touch){
   await p.setViewportSize({width:568,height:320});await p.evaluate(()=>{document.body.style.setProperty('--hud-left','44px');document.body.style.setProperty('--hud-right','24px');const a=window.__REALM_WARDENS__;a.game.event('wave',{wave:80,automatic:true,routes:[0],newRoutes:[]});a.ui.update(1);});await p.waitForTimeout(120);await capture(p,'notch-wave-80');await p.screenshot({path:'test-results/endless-growth-boss-notch.png'});
   for(const wave of[80,81,85,100,200,100000]){
    const stats=await p.evaluate(wave=>{const a=window.__REALM_WARDENS__,g=a.game;g.enemies=[];g.warning=null;g.wave=wave;const normal=g.spawn('armor',0,0,{noWarning:true}),boss=g.spawn('iceking',0,12,{noWarning:true});boss.hp=boss.maxHp*.65;a.ui.waveMessageLeft=0;a.ui.update(1);return{wave,normal:{hp:normal.maxHp,armor:normal.armor,resist:normal.resist,speed:normal.speed},boss:{hp:boss.maxHp,armor:boss.armor,resist:boss.resist,speed:boss.speed}};},wave);growth.push(stats);await capture(p,'notch-late-wave-'+wave);
   }
   for(let i=1;i<growth.length;i++)for(const kind of['normal','boss'])for(const field of['hp','armor','resist','speed'])assert.ok(growth[i][kind][field]>growth[i-1][kind][field]);
   await p.evaluate(()=>{const a=window.__REALM_WARDENS__,e=a.game.enemies.find(e=>e.boss);e.hp=e.maxHp*.25;a.ui.update(1);});assert.equal(await p.locator('.boss-health-track i').evaluate(e=>e.style.width),'25%');states.push({fixture:true,state:'Current numeric HP and fill update from 65% to 25%'});
  }
  await p.evaluate(()=>{const a=window.__REALM_WARDENS__,e=a.game.enemies.find(e=>e.boss);a.game.kill(e);a.ui.update(1);});assert.equal(await p.locator('#boss-hud').isVisible(),false);
  await p.evaluate(()=>{const a=window.__REALM_WARDENS__;a.game.restart();a.ui.update(1);});assert.equal(await p.locator('#boss-hud').isVisible(),false);states.push({touch,state:'Boss defeat and restart hide name, bar and numbers'});
  await context.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile('test-results/endless-growth-browser-report.json',JSON.stringify({status:'passed',date:'2026-10-07',verification:'Forced SwiftShader. A fresh phone context uses real endless-menu clicks, touch placement, two paid arrow towers (200 to 40 gold), first-wave start and pause/resume. Late waves, boss spawns, HP fractions and notch insets are explicit fixtures. Dimensions, touch and UA are Chrome emulation; no physical-device or normal late-game progression claim.',layouts,growth,states,errors},null,2));console.log(JSON.stringify({status:'passed',layouts:layouts.length,growthSamples:growth.length,states:states.length,errors}));
}catch(error){await writeFile('test-results/endless-growth-browser-report.json',JSON.stringify({status:'failed',error:error.stack,layouts,growth,states,errors},null,2));throw error;}finally{await browser.close();}
