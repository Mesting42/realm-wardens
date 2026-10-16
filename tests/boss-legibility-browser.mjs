import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const baseline=process.argv.includes('--baseline'),file=`test-results/boss-legibility-${baseline?'before':'report'}.json`;
if(baseline)assert.equal(await readFile(file,'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return null;}),null,'Keep original style evidence');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
const errors=[],samples=[];
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'}),p=await context.newPage();
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto('http://127.0.0.1:5175/?safe=1');await p.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});
 if(await p.locator('#display-root').isVisible()){await p.locator('[data-display-enter]').click();if(await p.evaluate(()=>!!document.fullscreenElement))await p.evaluate(()=>document.exitFullscreen());}
 for(const [device,width,height]of [['phone',844,390],['tablet',1366,1024]]){
  await p.setViewportSize({width,height});
  for(const region of[1,0,2]){
   await p.evaluate(region=>{const a=window.__REALM_WARDENS__,g=a.game;g.start(a.content.ENDLESS[region]);g.setPaused(true);g.wave=35;const e=g.spawn('treant',0,6,{noWarning:true});e.hp=e.maxHp*.95;a.ui.update(1);a.renderer.render(0);},region);
   // Simulate a browser ignoring paint-order on HTML text: the old 2px
   // WebKit stroke must not be able to cover the character interiors.
   await p.addStyleTag({content:'.boss-name b,.boss-vitals{paint-order:normal!important}'});
   const sample=await p.evaluate(()=>{
    const b=document.getElementById('boss-hud'),name=b.querySelector('.boss-name b'),vitals=b.querySelector('.boss-vitals'),n=getComputedStyle(name),v=getComputedStyle(vitals),ancestors=[];
    for(let el=b;el;el=el.parentElement){const s=getComputedStyle(el);ancestors.push({selector:el.id||el.className||el.tagName,backdrop:s.backdropFilter,webkitBackdrop:s.getPropertyValue('-webkit-backdrop-filter'),filter:s.filter,background:s.backgroundColor});}
    return{ancestors,name:{color:n.color,stroke:n.webkitTextStrokeWidth,fontSize:n.fontSize,shadow:n.textShadow},vitals:{color:v.color,stroke:v.webkitTextStrokeWidth,fontSize:v.fontSize,shadow:v.textShadow},transparent:getComputedStyle(b).backgroundColor==='rgba(0, 0, 0, 0)',height:b.getBoundingClientRect().height,text:vitals.textContent,loadedFonts:document.fonts.status};
   });samples.push({device,region,paintOrderFallback:true,...sample});
   if(!baseline){assert.equal(sample.transparent,true);assert.equal(sample.height,44);for(const ancestor of sample.ancestors){assert.ok(!ancestor.backdrop||ancestor.backdrop==='none');assert.ok(!ancestor.webkitBackdrop||ancestor.webkitBackdrop==='none');assert.equal(ancestor.filter,'none');}for(const type of['name','vitals']){assert.equal(sample[type].stroke,'0px');assert.equal(sample[type].color,'rgb(23, 61, 51)');assert.notEqual(sample[type].shadow,'none');}}
   if(region===1||device==='phone')await p.locator('.battle-header').screenshot({path:`test-results/boss-legibility-${baseline?'before':'after'}-${device}-${region}.png`});
  }
 }
 if(baseline){assert.ok(samples.every(s=>s.ancestors.some(a=>a.backdrop==='blur(10px)')));assert.ok(samples.every(s=>s.name.stroke==='2px'&&s.vitals.stroke==='2px'));}
 assert.deepEqual(errors,[]);await writeFile(file,JSON.stringify({status:baseline?'baseline':'passed',date:'2026-10-07',scope:'Chrome SwiftShader, 2x DPR touch emulation at phone/tablet sizes on all three maps. Paused wave-35 Boss fixtures. Explicit paint-order:normal reproduces browsers without HTML text paint-order support; not a real Safari/device claim.',samples,errors},null,2));console.log(JSON.stringify({status:baseline?'baseline':'passed',samples:samples.length,errors}));
}finally{await browser.close();}
