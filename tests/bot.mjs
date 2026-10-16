import {TOWERS,towerStats,HEROES} from '../src/content.js';
import {distance} from '../src/routes.js';
import {buildCells} from '../src/terrain.js';
export function rankSites(map){
  return buildCells(map).map(site=>{
    let score=0;
    for(const r of map.routes)for(let d=0;d<r.length;d+=.6){const p=r.at(d);if(distance(site,p)<5.7)score+=.6*(.6+.6*d/r.length);}
    return {...site,score};
  }).sort((a,b)=>b.score-a.score);
}
export function nextSite(game){
  const samples=[];
  for(const route of game.map.routes)for(let d=0;d<route.length-1.5;d+=.8){const p=route.at(d);let coverage=0;for(const t of game.towers)if(distance(p,t)<towerStats(t).range)coverage++;samples.push({...p,weight:(.5+.65*d/route.length)/(1+coverage*3)});}
  return game.cells.filter(s=>game.placement(s).ok).map(s=>({...s,value:samples.filter(p=>distance(p,s)<5.8).reduce((n,p)=>n+p.weight,0)})).sort((a,b)=>b.value-a.value)[0];
}
export function prepare(game,style='mixed',limit=Infinity,move=true){
  const split=game.map.id===6;
  const plan=style==='physical'?['arrow','ballista','frost','arrow','ballista','barracks','cannon','nature','arcane']:split?['arcane','arrow','ballista','arcane','frost','arrow','thunder']:['arcane','arrow','cannon','ballista','frost','nature','thunder','barracks','arrow'];
  const ranked=rankSites(game.map);
  let changed=true,actions=0;
  while(changed&&actions++<limit){changed=false;
    const filled=game.towers.length;
    if(filled<Math.min(4,ranked.length)){
      const site=nextSite(game);let k=plan[filled];
      if(game.gold<TOWERS[k].cost)k=['arcane','arrow'].find(kind=>game.gold>=TOWERS[kind].cost)||k;
      if(site&&game.gold>=TOWERS[k].cost&&game.build(site.id,k)){changed=true;continue;}
    }
    const up=game.towers.filter(t=>t.level<3).sort((a,b)=>a.level-b.level||ranked.findIndex(s=>s.id===a.site)-ranked.findIndex(s=>s.id===b.site))[0];
    if(up&&game.gold>=TOWERS[up.kind].upgrades[up.level-1]){game.upgrade(up.id);changed=true;continue;}
    const spec=game.towers.find(t=>t.level===3&&t.spec===null);if(spec&&game.gold>=TOWERS[spec.kind].specs[0].cost){game.specialize(spec.id,0);changed=true;continue;}
    if(filled<ranked.length){const site=nextSite(game),k=plan[filled%plan.length];if(site&&game.gold>=TOWERS[k].cost&&game.build(site.id,k)){changed=true;}}
  }
  const central=ranked[0],near=game.nearestRoad(central);if(move&&game.hero.alive&&distance(game.hero,near)>2)game.moveHero(near);
}
export function act(game){
  if(!game.canAct())return;
  const enemies=game.enemies.filter(e=>e.alive),hero=game.hero;
  if(!hero.alive||!enemies.length)return;
  if(hero.cooldowns[0]<=0){
    const s=HEROES[hero.kind].skills[0];
    if(!s.target){if(hero.hp<hero.maxHp*.8||enemies.some(e=>distance(e,hero)<2.2))game.skill(0);}
    else{const p=enemies.find(e=>game.legalGround(e))||enemies[0];if(game.legalGround(p))game.skill(0,p);}
  }
  if(hero.cooldowns[1]<=0){const sorted=[...enemies].sort((a,b)=>b.maxHp-a.maxHp),p=sorted.find(e=>game.legalGround(e));if(p)game.skill(1,p);}
}
export function clearOpening(game,count=4){
  prepare(game);
  for(let i=0;i<count;i++){
    const target=game.scenery.filter(o=>o.alive&&game.towers.some(t=>distance(t,o)<towerStats(t).range)).sort((a,b)=>a.hp/a.reward-b.hp/b.reward)[0];
    if(!target||!game.focusObstacle(target.id))break;
    for(let step=0;step<1000&&target.alive;step++)game.advance(.1);
    if(target.alive)throw Error('Opening clearance did not finish');
    prepare(game);
  }
}
export function play(game,{style='mixed',maxTime=1600,untilWave=Infinity,cadence=1}={}){
  let last=-1,loops=0,lastWave=-1;const bossKinds=new Set(),bossIds=new Set(),phases=[];
  const off=game.on(e=>{if(e.type==='boss-warning'){bossKinds.add(e.kind);if(e.bossId)bossIds.add(e.bossId);}if(e.type==='boss-phase')phases.push(e.text);if(cadence<2&&e.type==='wave-clear'&&(game.map.endless||game.wave<game.map.waveCount))prepare(game,style);});
  while(game.mode==='battle'&&game.time<maxTime&&game.wave<untilWave){
    if(!game.waveActive&&!game.warning){prepare(game,style);game.beginWave();}
    if(Math.floor(game.time/cadence)!==last){last=Math.floor(game.time/cadence);act(game);prepare(game,style,cadence>=2?1:Infinity,game.wave!==lastWave);lastWave=game.wave;}
    game.advance(.1);if(++loops>200000)throw Error('Simulation did not terminate');
  }
  off();return {...game.snapshot(),bossKinds:[...bossKinds],bossIds:[...bossIds],phases,simulationLoops:loops};
}
