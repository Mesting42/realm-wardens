import {distance} from './routes.js';

export const CELL_SIZE=2;
export const BATTLE_BOUNDS={x:14.7,z:10.8};
export const cellKey=(x,z)=>`cell:${x}:${z}`;
export function buildCells(map){
  const cells=[],ends=map.routes.flatMap(r=>[r.at(0),r.at(r.length)]);
  for(let z=-10;z<=10;z+=CELL_SIZE)for(let x=-14;x<=14;x+=CELL_SIZE){
    const p={x,z};
    if(map.routes.some(r=>r.nearest(p).distance<1.76)||ends.some(e=>distance(e,p)<2.5))continue;
    cells.push({...p,id:cellKey(x,z)});
  }
  return cells;
}
export function snapCell(p){
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z)||Math.abs(p.x)>BATTLE_BOUNDS.x||Math.abs(p.z)>BATTLE_BOUNDS.z)return null;
  const x=Math.round(p.x/CELL_SIZE)*CELL_SIZE,z=Math.round(p.z/CELL_SIZE)*CELL_SIZE;
  return {x,z,id:cellKey(x,z)};
}

// Deterministic scenery is shared by navigation and rendering.
export function terrainObjects(map){
  let seed=((typeof map.id==='number'?map.id:map.region+40)*7549)>>>0;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const objects=[];
  for(const [i,p]of buildCells(map).entries()){
    // Keep the old opening positions available, while the rest of the battlefield
    // is now governed by the same grid occupancy and clearing rules.
    if(map.sites.some(s=>distance(s,p)<2.4)||random()>.43)continue;
    const roll=random(),kind=roll<.47?'tree':roll<.79?'rock':roll<.93?'pillar':'chest';
    const hp={tree:130,rock:190,pillar:260,chest:95}[kind],reward={tree:20,rock:30,pillar:45,chest:65}[kind];
    objects.push({...p,id:`obstacle:${map.id}:${i}`,kind,variant:i,scale:.86+random()*.2,rotation:random()*6.28,r:.73,hp,maxHp:hp,reward,alive:true,hurtAt:-99});
  }
  return objects;
}
