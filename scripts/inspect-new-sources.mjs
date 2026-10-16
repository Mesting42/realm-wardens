import {readFile} from 'node:fs/promises';
const html=await readFile('art/sources/animals/gltf-folder.html','utf8');
console.log(JSON.stringify([...html.matchAll(/data-id="([^"]+)"[\s\S]{0,1800}?aria-label="([^"]+)"/g)].map(m=>({id:m[1],name:m[2]})).filter(x=>/wolf|atlas|texture|license/i.test(x.name))));
const tree=JSON.parse(await readFile('art/town-tree.json','utf8'));
console.log(tree.tree.filter(x=>/gltf\/buildings\/blue/.test(x.path)).map(x=>x.path).join('\n'));
