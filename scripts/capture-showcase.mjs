import {chromium}from'playwright';import{mkdir,writeFile}from'node:fs/promises';
await mkdir('test-results/v3',{recursive:true});const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--no-sandbox']});const p=await b.newPage({viewport:{width:2560,height:1293}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5175/');await p.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});
const portrait=await p.evaluate(()=>window.__REALM_WARDENS__.renderer.thumbnail('enemy','wolf'));await writeFile('test-results/v3/wolf-model.webp',Buffer.from(portrait.split(',')[1],'base64'));
for(const map of[1,5]){
  // Presentation fixture: unlocked scene and finite 1200-gold showcase budget.
  await p.evaluate(map=>{const a=window.__REALM_WARDENS__,g=a.game;a.store.progress.stars.fill(3);g.start(a.content.allMaps.find(m=>m.id===map),map===5?'mage':'knight');g.gold=1200;for(const kind of['arrow','cannon','arcane','frost','nature','thunder','barracks']){const c=g.cells.filter(c=>g.placement(c).ok&&g.nearestRoad(c).distance<4).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];if(c)g.build(c.id,kind);}g.selected=null;g.changed();a.store.seenTip(String(map));document.getElementById('battle-guide').innerHTML='';g.beginWave();if(map===5){g.spawn('wolf',0,12);a.renderer.render(12);}},map);
  await p.waitForTimeout(1800);await p.screenshot({path:`test-results/v3/showcase-${map===5?'snow':'forest'}.png`});
}
await p.evaluate(()=>{const a=window.__REALM_WARDENS__;a.game.start(a.content.LEVELS[0],'knight');a.game.spawn('wolf',0,15);a.game.selected=null;a.ui.update(1);document.getElementById('battle-guide').innerHTML='';a.renderer.view={zoom:2.1,x:-3,z:-3};a.renderer.fitCamera();});
await p.waitForTimeout(150);await p.screenshot({path:'test-results/v3/wolf-step-a.png'});await p.waitForTimeout(350);await p.screenshot({path:'test-results/v3/wolf-step-b.png'});console.log(JSON.stringify({errors}));await b.close();
