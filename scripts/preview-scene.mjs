import {chromium}from'playwright';import{mkdir,writeFile}from'node:fs/promises';
await mkdir('test-results/v3',{recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--no-sandbox']});const p=await b.newPage({viewport:{width:1920,height:1080}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.goto('http://127.0.0.1:5175/');await p.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});
for(const map of[1,5,6,9]){await p.evaluate(map=>{const a=window.__REALM_WARDENS__;a.store.progress.stars.fill(3);a.game.start(a.content.allMaps.find(m=>m.id===map),'mage');},map);await p.waitForTimeout(1500);await p.screenshot({path:`test-results/v3/scene-${map}.png`});}
await p.evaluate(()=>{const a=window.__REALM_WARDENS__;a.game.start(a.content.LEVELS[0],'knight');a.game.spawn('wolf',0,12);});await p.waitForTimeout(500);await p.screenshot({path:'test-results/v3/wolf-scene.png'});
console.log(JSON.stringify({errors,metrics:await p.evaluate(()=>window.__REALM_WARDENS__.renderer.metrics())}));await writeFile('test-results/v3/preview-errors.json',JSON.stringify(errors));await b.close();
