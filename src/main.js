import './style.css';
import { Game } from './game.js';
import { Store } from './store.js';
import { Renderer } from './renderer.js';
import { AudioSystem } from './audio.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { DisplayMode } from './display.js';
import * as content from './content.js';
import {loadAssets,assetStatus} from './assets.js';

const store=new Store();
// A safe preview overrides only this session, including previously saved high quality.
if(new URLSearchParams(location.search).get('safe')==='1')store.settings={...store.settings,quality:'balanced',effects:'standard'};
const game=new Game(store),audio=new AudioSystem(store.settings);
const loading=document.getElementById('ui');loading.innerHTML='<div class="loading-screen"><span class="eyebrow">REALM WARDENS</span><h1>幻域守城</h1><p>正在准备王国与守望者</p><div class="loading-track"><i></i></div><small>0%</small></div>';
try{await loadAssets((done,total)=>{loading.querySelector('i').style.width=`${done/total*100}%`;loading.querySelector('small').textContent=`${Math.round(done/total*100)}%`;});}
catch(error){loading.innerHTML='<div class="fatal-error"><h1>战场资源未能完整载入</h1><p>请检查本地预览服务，并重新载入页面。</p><button onclick="location.reload()">重新载入</button></div>';throw error;}
let renderer;
try{
  renderer=new Renderer(document.getElementById('scene'),document.getElementById('feedback'),game,store.settings);
  loading.querySelector('p').textContent='正在准备战场光影';
  await renderer.gpu.compileAsync(renderer.scene,renderer.camera);
}
catch(error){document.getElementById('ui').innerHTML='<div class="fatal-error"><h1>暂时无法打开三维战场</h1><p>请使用支持 WebGL 2 的 Chrome、Edge 或 Safari，并开启浏览器硬件加速后重新载入。</p><button onclick="location.reload()">重新载入</button></div>';throw error;}
const ui=new UI(game,renderer,store,audio),input=new Input(renderer.canvas,game,renderer,ui,audio);
const display=new DisplayMode(game,ui,input,audio);
ui.display=display;input.display=display;
renderer.canvas.addEventListener('webglcontextlost',()=>{if(game.mode==='battle')ui.showPause();});
game.on(e=>audio.sound(e));
let previous=performance.now(),lastFrame=previous;
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden||renderer.contextLost||display.blocked){previous=lastFrame=now;return;}
  const interval=1000/(game.mode==='battle'&&!game.paused?60:30),elapsed=now-lastFrame;
  if(elapsed<interval-.5)return;
  lastFrame=elapsed<interval?now:now-elapsed%interval;
  const dt=Math.min(.1,(now-previous)/1000);previous=now;
  game.advance(dt);renderer.render(dt);ui.update(dt,true);audio.update(dt,game.mode==='battle');
}
requestAnimationFrame(frame);
// Readable inspection API for QA. No cheat buttons or modified combat rules.
window.__REALM_WARDENS__={game,renderer,ui,store,input,audio,display,content,assetStatus,snapshot:()=>({...game.snapshot(),graphics:renderer.metrics(),assets:assetStatus(),display:display.snapshot()})};
