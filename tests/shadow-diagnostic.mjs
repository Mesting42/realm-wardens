import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan','--no-sandbox']});
try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'});
  await page.goto('http://127.0.0.1:5175/?safe=1');await page.waitForFunction(()=>window.__REALM_WARDENS__,null,{timeout:90000});
  await page.locator('[data-display-enter]').click();await page.waitForFunction(()=>window.__REALM_WARDENS__.display.entered);if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());
  for(const action of ['modes','campaign','detail:1','heroes','launch'])await page.locator(`[data-action="${action}"]`).last().click();
  if(await page.locator('[data-action="dismiss-tip"]').count())await page.locator('[data-action="dismiss-tip"]').click();
  await page.locator('[data-action="settings"]').click();await page.locator('[data-setting="quality"]').selectOption('high');await page.locator('[data-action="close-modal"]').click();
  const result=await page.evaluate(()=>{
    const a=window.__REALM_WARDENS__,g=a.game,r=a.renderer;
    for(const site of g.cells.filter(c=>g.placement(c).ok).filter(c=>Math.abs(c.x)<6&&Math.abs(c.z)<5).slice(0,2))g.build(site.id,'arrow');
    g.setPaused(true);g.selected=null;const enemy=g.spawn('wolf',0,5,{noWarning:true});r.render(0);const roots=[...g.towers.map(t=>r.units.get(t.id).root),r.units.get(enemy.id).root],flags=[];r.scene.traverse(o=>{if(o.isMesh){flags.push([o,o.castShadow]);o.castShadow=false;}});
    const width=r.canvas.width,height=r.canvas.height,c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d',{willReadFrequently:true});
    const capture=()=>{r.render(0);ctx.drawImage(r.canvas,0,0);return ctx.getImageData(0,0,width,height).data;};
    const base=capture(),cases=[];
    for(const root of roots){
      root.traverse(o=>{if(o.isMesh)o.castShadow=true;});const shaded=capture(),points=[];
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){const k=(y*width+x)*4,b=base[k]+base[k+1]+base[k+2],s=shaded[k]+shaded[k+1]+shaded[k+2];if(b-s>35)points.push([x/width*r.width,y/height*r.height]);}
      const bounds=root.children[0].geometry?.boundingBox;let mesh;root.traverse(o=>{if(!mesh&&o.isMesh)mesh=o;});const p=r.project(root.position.x,root.position.z,root.position.y);
      cases.push({name:root.name,position:root.position.toArray(),screen:p,changedPixels:points.length,shadowBounds:points.length?{minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1])),centerX:points.reduce((n,p)=>n+p[0],0)/points.length,centerY:points.reduce((n,p)=>n+p[1],0)/points.length}:null,localMeshPosition:mesh.position.toArray(),geometryBounds:mesh.geometry.boundingBox});root.traverse(o=>{if(o.isMesh)o.castShadow=false;});
    }
    for(const [o,cast]of flags)o.castShadow=cast;r.render(0);
    return {quality:r.settings.quality,shadowMapSize:r.sun.shadow.mapSize.toArray(),allocatedShadow:[r.sun.shadow.map.width,r.sun.shadow.map.height],sun:r.sun.position.toArray(),target:r.sun.target.position.toArray(),shadowCamera:r.sun.shadow.camera.matrixWorld.toArray(),shadowMatrix:r.sun.shadow.matrix.toArray(),cases};
  });
  // Preserve the pre-fix evidence; a later manual diagnosis writes a fresh file.
  await page.screenshot({path:'test-results/shadow-diagnostic-current.png'});await writeFile('test-results/shadow-diagnostic-current.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
