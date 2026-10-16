import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {towerModel,unitModel} from '../src/models.js';
import {TOWERS} from '../src/content.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}};
await mkdir('art/sources/originals',{recursive:true});const exporter=new GLTFExporter();
async function save(name,model){model.traverse(o=>o.userData={});const bytes=await exporter.parseAsync(model,{binary:true,onlyVisible:false});await writeFile(`art/sources/originals/${name}.glb`,Buffer.from(bytes));console.log(`Exported ${name}: ${bytes.byteLength}`);}
for(const kind of Object.keys(TOWERS))for(const [level,spec]of [[1,null],[2,null],[3,null],[3,0],[3,1]])await save(`tower-${kind}-${level}-${spec??'base'}`,towerModel(kind,level,spec));
for(const kind of ['wolf','treant','tree'])await save(`enemy-${kind}`,unitModel(kind));
