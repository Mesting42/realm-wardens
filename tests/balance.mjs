import {Game} from '../src/game.js';
import {Store} from '../src/store.js';
import {LEVELS,ENDLESS} from '../src/content.js';
import {play} from './bot.mjs';
const storage={getItem:()=>null,setItem:()=>{}},store=new Store(storage);
for(const map of LEVELS){const g=new Game(store);g.start(map,map.id>=6?'ranger':'knight');const r=play(g);console.log(JSON.stringify({level:map.id,mode:r.mode,lives:r.lives,time:Math.round(r.time),wave:r.wave,gold:r.gold,kills:r.kills,bosses:r.bossIds,phases:r.phases,heroes:store.completed(),towers:r.towers.map(t=>`${t.kind}:${t.level}:${t.spec}`)}));if(r.mode!=='victory')break;}
for(const map of ENDLESS){const g=new Game(store);g.start(map,'knight');const r=play(g,{untilWave:11,maxTime:1500});console.log(JSON.stringify({endless:map.id,mode:r.mode,wave:r.wave,lives:r.lives,time:Math.round(r.time),bosses:r.bossKinds}));}
