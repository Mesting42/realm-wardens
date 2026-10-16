import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
// Inspect the local atlas and vertex heights to locate actual chimney mouths.
for(const kind of ['home-a','home-b','tavern','blacksmith']){
  const file=readFileSync(`public/models/town-${kind}.glb`),length=file.readUInt32LE(12),gltf=JSON.parse(file.toString('utf8',20,20+length)),bin=28+length;
  const view=gltf.bufferViews[gltf.images[0].bufferView],png=file.subarray(bin+(view.byteOffset||0),bin+(view.byteOffset||0)+view.byteLength),parts=[];let width,height,depth,type,palette;
  for(let offset=8;offset<png.length;){const size=png.readUInt32BE(offset),tag=png.toString('ascii',offset+4,offset+8),data=png.subarray(offset+8,offset+8+size);if(tag==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];type=data[9];}if(tag==='IDAT')parts.push(data);if(tag==='PLTE')palette=data;offset+=size+12;}
  if(depth!==8||![2,3,6].includes(type))throw Error(`Unsupported local atlas ${depth}/${type}`);
  const channels=type===6?4:type===2?3:1,stride=width*channels,raw=inflateSync(Buffer.concat(parts)),pixels=Buffer.alloc(height*stride);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++)for(let x=0;x<stride;x++){const filter=raw[y*(stride+1)],left=x>=channels?pixels[y*stride+x-channels]:0,up=y?pixels[(y-1)*stride+x]:0,diag=y&&x>=channels?pixels[(y-1)*stride+x-channels]:0;pixels[y*stride+x]=(raw[y*(stride+1)+1+x]+[0,left,up,Math.floor((left+up)/2),paeth(left,up,diag)][filter])&255;}
  const values=(index,components)=>{const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView],offset=bin+(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||components*4;return Array.from({length:a.count},(_,i)=>Array.from({length:components},(_,k)=>file.readFloatLE(offset+i*stride+k*4)));};
  const p=gltf.meshes[0].primitives[0],positions=values(p.attributes.POSITION,3),uvs=values(p.attributes.TEXCOORD_0,2),groups=new Map();
  for(let i=0;i<positions.length;i++){const [u,v]=uvs[i],x=Math.min(width-1,Math.max(0,Math.floor(u*width))),y=Math.min(height-1,Math.max(0,Math.floor(v*height))),offset=(y*width+x)*channels,rgb=type===3?[...palette.subarray(pixels[offset]*3,pixels[offset]*3+3)]:[...pixels.subarray(offset,offset+3)],key=rgb.join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(positions[i]);}
  console.log(kind,JSON.stringify([...groups].map(([rgb,points])=>{const max=Math.max(...points.map(p=>p[1])),top=points.filter(p=>p[1]>max-.015);return {rgb,height:max,mouth:[0,1,2].map(k=>top.reduce((n,p)=>n+p[k],0)/top.length)};}).filter(p=>p.height>.7&&Math.max(...p.rgb.split(',').map(Number))-Math.min(...p.rgb.split(',').map(Number))<20)));
}
