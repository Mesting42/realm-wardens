import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const repo='KayKit-Medieval-Hexagon-Pack-1.0',tree=JSON.parse(await readFile('art/town-tree.json','utf8')),records=[];
const root='art/sources/town/kaykit';await mkdir(root,{recursive:true});
const download=item=>Buffer.from(JSON.parse(execFileSync('curl.exe',['-fLsS','--retry','2','--max-time','60',`https://api.github.com/repos/KayKit-Game-Assets/${repo}/git/blobs/${item.sha}`],{maxBuffer:30000000}).toString()).content.replaceAll('\n',''),'base64');
const done=new Set();
async function get(remote){
  if(done.has(remote))return;done.add(remote);const item=tree.tree.find(t=>t.path===remote);if(!item)throw Error('Missing '+remote);
  const bytes=download(item),file=`${root}/${path.posix.basename(remote)}`;await writeFile(file,bytes);
  records.push({author:'Kay Lousberg',license:'CC0-1.0',repository:`https://github.com/KayKit-Game-Assets/${repo}`,revision:tree.sha,file,url:`https://github.com/KayKit-Game-Assets/${repo}/blob/${tree.sha}/${remote}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  if(remote.endsWith('.gltf')){const gltf=JSON.parse(bytes);for(const dependency of [...gltf.buffers,...gltf.images])if(dependency.uri&&!dependency.uri.startsWith('data:'))await get(path.posix.normalize(path.posix.join(path.posix.dirname(remote),dependency.uri)));}
}
for(const kind of ['home_A','home_B','tavern','market','blacksmith','windmill','well'])await get(`addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/blue/building_${kind}_blue.gltf`);
const license=download(tree.tree.find(t=>t.path==='LICENSE.txt'));if(!/CC0/i.test(license.toString()))throw Error('Unexpected town license');await writeFile('docs/licenses/KayKit-medieval-CC0.txt',license);
for(const name of ['cart','lantern']){const file=`art/sources/town/kenney/Models/GLB format/${name}.glb`,bytes=await readFile(file);records.push({author:'Kenney',license:'CC0-1.0',source:'https://kenney.nl/assets/fantasy-town-kit',version:'2.0',file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await writeFile('docs/licenses/Kenney-fantasy-town-CC0.txt',await readFile('art/sources/town/kenney/License.txt'));
await writeFile('art/sources/town/manifest.json',JSON.stringify({acquired:'2026-10-06',records},null,2));console.log(JSON.stringify({downloaded:records.length,revision:tree.sha}));
