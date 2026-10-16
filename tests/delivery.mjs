import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
await mkdir('test-results',{recursive:true});
const reportNames=['logic-report.json','browser-report.json','normal-play-report.json','normal-endless-report.json','device-audio-report.json','v2/upgrade-report.json','v3/scene-report.json','graphics-startup-report.json','battle-feedback-report.json','living-world-report.json','economy-report.json','display-report.json','compact-landscape-report.json','defeat-report.json','campaign-balance-report.json','campaign-browser-report.json','flight-report.json','mobile-hud-report.json','shadow-wave-report.json'];
const reports=[];
for(const name of reportNames){const r=JSON.parse(await readFile('test-results/'+name,'utf8'));assert.equal(r.status,'passed',name);reports.push({name,status:r.status,checks:r.checks?.length,layouts:r.layouts?.length,normalLevels:r.levels?.length,normalEndlessMaps:r.runs?.filter(n=>n.record)?.length,errors:r.errors?.length||0});}
const files=(await readdir('src')).map(f=>'src/'+f).concat(['index.html','package.json','package-lock.json','vite.config.js','Start-Game.ps1']);
const hashes={};for(const file of files)hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const index=await readFile('dist/index.html','utf8'),assets=(await readdir('dist/assets')).filter(f=>/\.(js|css)$/.test(f)),network=[];
for(const url of ['http://127.0.0.1:5175/',process.env.LAN_GAME_URL||'http://127.0.0.1:5175/']){
  const response=await fetch(url),body=await response.text();assert.equal(response.status,200);assert.ok(body.includes('REALM WARDENS'));assert.equal(body.trim(),index.trim());network.push({url,status:response.status});
}
for(const file of assets){const response=await fetch('http://127.0.0.1:5175/assets/'+file);assert.equal(response.status,200);}
const models=JSON.parse(await readFile('art/model-report-all.json','utf8'));assert.equal(models.length,77);let modelBytes=0;
for(const model of models){const file='public/'+model.file,bytes=await readFile(file),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(hash,model.sha256,file);assert.equal(bytes.length,model.bytes);const response=await fetch('http://127.0.0.1:5175/'+model.file);assert.equal(response.status,200);assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),hash);hashes[file]=hash;modelBytes+=bytes.length;}
const licenses=(await readdir('docs/licenses')).filter(f=>f.endsWith('.txt'));for(const name of licenses){const file='docs/licenses/'+name;assert.match(await readFile(file,'utf8'),/CC0|public domain/i);hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');}
const sourceManifest=JSON.parse(await readFile('art/sources/manifest.json','utf8'));for(const source of sourceManifest.records)assert.equal(createHash('sha256').update(await readFile(source.file)).digest('hex'),source.sha256);
const monsterManifest=JSON.parse((await readFile('art/sources/quaternius/manifest.json','utf8')).replace(/^\uFEFF/,''));for(const source of monsterManifest)assert.equal(createHash('sha256').update(await readFile(source.File)).digest('hex'),source.SHA256);
const sceneSources=[];for(const name of ['town','animals']){const manifest=JSON.parse(await readFile(`art/sources/${name}/manifest.json`,'utf8'));for(const source of manifest.records){assert.equal(createHash('sha256').update(await readFile(source.file)).digest('hex'),source.sha256);sceneSources.push(source);}}
const artifacts=(await readdir('test-results')).filter(f=>f.endsWith('.png'));
await writeFile('test-results/delivery-manifest.json',JSON.stringify({date:'2026-10-07',timezone:'Asia/Shanghai',status:'passed',verification:'Live preview/resource integrity and latest available passed reports. Reading reports does not rerun suites. Current mobile HUD checks and historical gameplay scope are distinguished in TESTING.md.',project:process.cwd(),network,assets,reports,modelCount:models.length,modelBytes,sourceModels:sourceManifest.records.length+monsterManifest.length+sceneSources.length,licenses,sourceSHA256:hashes,screenshots:artifacts,upgradeScreenshots:(await readdir('test-results/v2')).filter(f=>f.endsWith('.png')),sceneScreenshots:(await readdir('test-results/v3')).filter(f=>f.endsWith('.png'))},null,2));
console.log(JSON.stringify({status:'passed',reports,network,assets,modelCount:models.length,modelBytes,licenses,screenshotCount:artifacts.length}));
