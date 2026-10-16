import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const download=url=>execFileSync('curl.exe',['-fLsS','--retry','2','--max-time','90',url],{maxBuffer:30000000});
const packs=[['adventurers','KayKit-Character-Pack-Adventures-1.0',['Knight','Mage','Rogue_Hooded','Barbarian']],['skeletons','KayKit-Character-Pack-Skeletons-1.0',['Skeleton_Mage','Skeleton_Minion','Skeleton_Rogue','Skeleton_Warrior']]];
const records=[];
for(const [key,repo,names]of packs){
  const api=`https://api.github.com/repos/KayKit-Game-Assets/${repo}/git/trees/main?recursive=1`,tree=JSON.parse(download(api).toString()),revision=tree.sha;
  const root=`art/sources/${key}`;await mkdir(root,{recursive:true});await mkdir('docs/licenses',{recursive:true});
  const blob=item=>Buffer.from(JSON.parse(download(`https://api.github.com/repos/KayKit-Game-Assets/${repo}/git/blobs/${item.sha}`).toString()).content.replaceAll('\n',''),'base64');
  const license=blob(tree.tree.find(t=>t.path==='LICENSE.txt')).toString();if(!/CC0|Creative Commons Zero/i.test(license))throw Error('Unexpected asset license');await writeFile(`docs/licenses/KayKit-${key}-CC0.txt`,license);
  const wanted=tree.tree.filter(t=>names.some(n=>t.path.endsWith(`/${n}.glb`)));
  for(const item of wanted){const url=`https://github.com/KayKit-Game-Assets/${repo}/blob/${revision}/${item.path}`,bytes=blob(item);if(bytes.toString('ascii',0,4)!=='glTF')throw Error('Invalid GLB');const file=`${root}/${item.path.split('/').at(-1)}`;await writeFile(file,bytes);records.push({pack:key,author:'Kay Lousberg',license:'CC0-1.0',repository:`https://github.com/KayKit-Game-Assets/${repo}`,revision,url,file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});console.log(`Downloaded ${file} (${bytes.length} bytes)`);}
}
await writeFile('art/sources/manifest.json',JSON.stringify({acquired:'2026-10-05',records},null,2));
