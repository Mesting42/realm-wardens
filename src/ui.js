import { REGIONS, LEVELS, ENDLESS, TOWERS, HEROES, ENEMIES, BOSSES, bossProfile, campaignBrief, towerStats, wavePlan } from './content.js';
import { DEFAULT_SETTINGS } from './store.js';
import { icon, miniMap } from './icons.js';

const $=id=>document.getElementById(id);
const setText=(node,value)=>{const text=String(value);if(node&&node.textContent!==text)node.textContent=text;};
const setAttr=(node,name,value)=>{const text=String(value);if(node&&node.getAttribute(name)!==text)node.setAttribute(name,text);};
const setWidth=(node,value)=>{if(node&&node.style.width!==value)node.style.width=value;};
const btn=(action,label,cls='',attrs='')=>`<button type="button" data-action="${action}" class="${cls}" ${attrs}>${label}</button>`;
const stars=(count=0)=>`<span class="stars" aria-label="${count} 星">${[0,1,2].map(i=>`<span class="${i<count?'earned':''}">${icon('star',18)}</span>`).join('')}</span>`;
export class UI {
  constructor(game,renderer,store,audio){
    this.game=game;this.renderer=renderer;this.store=store;this.audio=audio;this.root=$('ui');this.modalRoot=$('modal-root');this.screen='home';this.modal=null;this.chapter=0;this.chosenMap=null;this.chosenHero='knight';this.lastRevision=-1;this.lastTick=0;this.lastPanel='';
    this.root.addEventListener('click',e=>this.click(e));this.modalRoot.addEventListener('click',e=>this.click(e));
    this.modalRoot.addEventListener('change',e=>this.setting(e));this.modalRoot.addEventListener('input',e=>this.setting(e));
    this.previewObserver=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('img[data-model-map],img[data-model-hero],img[data-model-tower],img[data-model-enemy]')||n.querySelector('img[data-model-map],img[data-model-hero],img[data-model-tower],img[data-model-enemy]')))))this.schedulePreviews();});this.previewObserver.observe(this.root,{childList:true,subtree:true});this.previewObserver.observe(this.modalRoot,{childList:true,subtree:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.schedulePreviews();});
    renderer.canvas.addEventListener('webglcontextrestored',()=>this.schedulePreviews());
    game.on(e=>{if(e.type==='notice')this.toast(e.text);if(e.type==='pause')audio.pause(e.paused||this.display?.blocked);if(e.type==='start'){this.screen='battle';this.modal=null;this.modalRoot.innerHTML='';this.renderBattle();this.audio.pause(false);}
      if(e.type==='victory'){this.waveMessageLeft=0;this.showResult();}if(e.type==='defeat'){this.waveMessageLeft=0;this.showDefeat();}if(e.type==='defeat-ready'&&game.mode==='defeat')this.showResult();if(e.type==='boss-phase')this.toast(e.text,5200);if(e.type==='wave-clear')this.waveSupply=e.reward;
      if(e.type==='wave'){
        this.waveMessageLeft=2.2;const title=$('wave-arrival-title'),detail=$('wave-arrival-detail'),brief=$('wave-brief'),finalWave=!this.game.map.endless&&e.wave===this.game.map.waveCount;
        if(title)title.textContent=`第 ${e.wave} 波来袭${e.newRoutes?.length?' · 新路线开启':''}`;
        if(detail)detail.textContent=`${e.automatic?`${this.waveSupply||0} 金币补给已到账 · `:''}${e.routes.length} 路进攻${e.newRoutes?.length?' · 留意新时空之门':''}${finalWave?` · ${bossProfile(this.game.map.bossId).name}即将现身`:''}`;
        if(brief){brief.textContent=e.newRoutes?.length?`第 ${e.wave} 波 · 新路线开启`:finalWave?`第 ${e.wave} 波 · 首领来袭`:`第 ${e.wave} 波来袭`;brief.setAttribute('aria-label',`${title?.textContent||brief.textContent}，${detail?.textContent||''}`);}
      }
      if(e.type==='start'){this.waveMessageLeft=0;this.waveSupply=0;}
    });
    this.renderHome();
  }
  schedulePreviews(){
    if(this.previewScheduled)return;this.previewScheduled=true;
    requestAnimationFrame(()=>{this.previewScheduled=false;if(document.hidden||this.renderer.contextLost)return;const image=document.querySelector('img[data-model-map]:not([src]),img[data-model-hero]:not([src]),img[data-model-tower]:not([src]),img[data-model-enemy]:not([src])');if(!image)return;
      const type=image.dataset.modelMap?'map':image.dataset.modelHero?'hero':image.dataset.modelEnemy?'enemy':'tower',value=type==='map'?[...LEVELS,...ENDLESS].find(m=>String(m.id)===image.dataset.modelMap):image.dataset.modelHero||image.dataset.modelTower||image.dataset.modelEnemy;
      if(value){image.src=this.renderer.thumbnail(type,value);image.classList.add('ready');}this.schedulePreviews();
    });
  }
  toast(text,duration=2800){const t=$('toast');t.textContent=text;t.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>t.classList.remove('visible'),duration);}
  closeViewTools(){
    this.root.querySelector('.view-controls')?.classList.remove('expanded');
    this.root.querySelector('[data-action="view-tools"]')?.setAttribute('aria-expanded','false');
  }
  header(title,subtitle='',back='home'){return `<header class="menu-header">${btn(back,`${icon('return',24)}<span>返回</span>`,'quiet')}<div class="page-title"><span class="eyebrow">REALM WARDENS</span><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div>${btn('settings',icon('settings',24),'icon-button','aria-label="游戏设置"')}</header>`;}
  setScreen(name){this.screen=name;document.body.classList.remove('in-battle','in-menu','has-selection');document.body.classList.add(name==='battle'?'in-battle':'in-menu');this.game.selected=null;this.game.targeting=null;this.renderer.resetView();}
  renderHome(){
    this.setScreen('home');this.root.innerHTML=`<section class="home-screen"><div class="home-content"><div class="wordmark">${icon('shield',46)}<span>REALM WARDENS<small>THE KINGDOM CALLS</small></span></div><div class="home-title"><span class="eyebrow">一场属于你的守城之战</span><h1>幻域<span>守城</span></h1><p>十二道防线，守住一个王国。</p><div class="title-rule"><i></i>${icon('star',18)}<i></i></div></div><nav class="home-actions" aria-label="主菜单">${btn('modes',`${icon('flag',30)}<span>开始征途<small>战役与无尽守城</small></span>${icon('chevron',22)}`,'primary home-play')}
      <div class="home-secondary">${btn('codex',`${icon('book',23)}王国图鉴`,'secondary')}${btn('settings',`${icon('settings',23)}游戏设置`,'secondary')}</div></nav><div class="campaign-progress"><span>战役进度</span><b>${this.store.completed()} / 12</b><div><i style="width:${this.store.completed()/12*100}%"></i></div></div><p class="home-note">建造防线 · 指挥英雄 · 迎战领主</p></div><div class="scene-caption"><span>翡翠林地</span><small>THE EMERALD WILD</small><i></i></div><footer class="home-footer"><span>原创奇幻策略塔防</span><span>本地进度自动保存 ${this.store.available?'●':'○'}</span></footer></section>`;
  }
  renderModes(){
    this.setScreen('modes');this.root.innerHTML=`<section class="menu-surface mode-screen">${this.header('选择征途','每一次守望，都是新的故事。')}<div class="mode-options">${btn('campaign',`<span class="mode-art">${icon('flag',90)}</span><span class="eyebrow">THE CAMPAIGN</span><h2>王国战役</h2><p>跨越林地、霜岩与王庭。<br>逐步解锁十二道防线和四名英雄。</p><span class="mode-bottom">${this.store.completed()} / 12 已完成 ${icon('chevron',22)}</span>`,'mode-option campaign-option')}${btn('endless',`<span class="mode-art">${icon('endless',94)}</span><span class="eyebrow">THE LAST STAND</span><h2>无尽守城</h2><p>三张独立战场，持续变化的敌军。<br>守住更远的一波，刷新自己的纪录。</p><span class="mode-bottom">三座永垒 ${icon('chevron',22)}</span>`,'mode-option endless-option')}</div></section>`;
  }
  renderCampaign(){
    this.setScreen('campaign');const r=REGIONS[this.chapter];
    this.root.innerHTML=`<section class="menu-surface atlas">${this.header('王国战役','完成上一关，解锁下一道防线。','modes')}<nav class="region-tabs" aria-label="战役区域">${REGIONS.map((r,i)=>btn(`chapter:${i}`,`<span class="region-dot region-${i}"></span>${r.name}<small>${i*4+1}–${i*4+4}</small>`,i===this.chapter?'active':'')).join('')}</nav><div class="region-heading"><div><span class="eyebrow">${r.en}</span><h2>${r.name}</h2><p>${r.tagline}</p></div><span class="region-completion">${this.store.progress.stars.slice(this.chapter*4,this.chapter*4+4).filter(Boolean).length} / 4 已守住</span></div><div class="level-grid">${LEVELS.filter(m=>m.region===this.chapter).map(m=>{
      const unlocked=this.store.unlocked(m.id);return btn(`detail:${m.id}`,`${miniMap(m)}<div class="level-copy"><span class="level-index">${String(m.id).padStart(2,'0')} ${m.boss?'· 领主之战':''}</span><h3>${m.name}</h3><p>${m.subtitle}</p><div class="level-status">${stars(this.store.progress.stars[m.id-1])}<span>${unlocked?(this.store.progress.stars[m.id-1]?'重访战场':'准备出征'):'完成前一关解锁'} ${icon('chevron',16)}</span></div></div>`, `level-card ${unlocked?'':'locked'}`);
    }).join('')}</div><p class="rules-note">三星：基地保持 20 生命；二星：至少 14 生命；一星：成功守住。最高星级会自动保存。</p></section>`;
  }
  renderEndless(){
    this.setScreen('endless');this.root.innerHTML=`<section class="menu-surface atlas">${this.header('无尽守城','敌军会更聪明地进攻。你的防线，能守到第几波？','modes')}<div class="endless-grid">${ENDLESS.map(m=>btn(`detail:${m.id}`,`${miniMap(m)}<div class="level-copy"><span class="eyebrow">${REGIONS[m.region].en}</span><h2>${m.name}</h2><p>${m.subtitle}</p><div class="record-line"><span>最高波数 <b>${this.store.progress.endless[m.id].wave}</b></span><span>最高得分 <b>${this.store.progress.endless[m.id].score.toLocaleString()}</b></span></div><span class="mode-bottom">选择英雄 ${icon('chevron',20)}</span></div>`,'level-card endless-card')).join('')}</div><p class="rules-note">每五波出现一位领主。晚期增加支援组合与多路压力，生命、防御与移速持续成长，敌军数量保持上限。</p></section>`;
  }
  mapDetail(map){
    this.chosenMap=map;const unlocked=map.endless||this.store.unlocked(map.id),roster=[...new Set(map.roster)],boss=map.bossId?bossProfile(map.bossId):null;
    this.openModal('detail',`<div class="detail-map">${miniMap(map)}<span class="map-stamp">${map.endless?'无尽守城':`战役 ${String(map.id).padStart(2,'0')}`}</span></div><div class="detail-content"><span class="eyebrow">${REGIONS[map.region].name}</span><h2>${map.name}</h2><p>${map.subtitle}</p><div class="mission-facts"><span>${icon('coin',24)}初始金币 <b>${map.gold}</b></span><span>${icon('heart',24)}基地生命 <b>${map.lives}</b></span><span>${icon('wave',24)}${map.endless?'无限波次':`${map.waveCount} 波敌军`}</span></div><h3>即将面对</h3><div class="enemy-tags">${roster.map(k=>`<span>${ENEMIES[k].name}</span>`).join('')}</div>${boss?`<h3>末波首领 · ${boss.name}</h3><p>${boss.desc}</p><p class="fineprint">${campaignBrief(map)}</p>`:""}<p class="fineprint">${map.endless?'纪录保存最高已守住波数与累计得分。':'评价：20 生命为三星，14–19 为二星，1–13 为一星。'}</p>${btn('heroes',`${unlocked?'选择英雄':'完成上一关后解锁'} ${icon('chevron',20)}`,'primary',unlocked?'':'disabled')}</div>`,'detail-sheet');
  }
  renderHeroes(){
    this.closeModal(false);this.setScreen('heroes');const m=this.chosenMap;
    if(this.store.completed()<HEROES[this.chosenHero].unlock)this.chosenHero='knight';
    this.root.innerHTML=`<section class="menu-surface hero-screen">${this.header('选择守望者',`${m.name} · 每场战斗携带一名英雄`,m.endless?'endless':'campaign')}<div class="heroes-grid">${Object.entries(HEROES).map(([k,h])=>{
      const unlocked=this.store.completed()>=h.unlock;return btn(`hero:${k}`,`<div class="hero-portrait ${k}"><img data-model-hero="${k}" alt="${h.name}三维形象"><span>${unlocked?'':`完成第 ${h.unlock} 关解锁`}</span></div><div class="hero-copy"><span class="eyebrow">${h.title}</span><h2>${h.name}</h2><p>${h.passive}</p><div class="hero-skills">${h.skills.map(s=>`<span>${icon(s.icon,24)}${s.name}</span>`).join('')}</div><span class="hero-select-indicator">${k===this.chosenHero?'已选择':unlocked?'选择英雄':'尚未解锁'}</span></div>`,`hero-card ${k===this.chosenHero?'chosen':''} ${unlocked?'':'locked'}`,unlocked?'':'disabled');}).join('')}</div><div class="hero-detail-row" id="hero-description"></div><div class="embark-row"><span>${icon('coin',25)}${m.gold} 初始金币 · ${m.endless?'守望无尽':`${m.waveCount} 波敌军`}</span>${btn('launch',`进入战场 ${icon('chevron',22)}`,'primary')}</div></section>`;this.updateHeroDescription();
  }
  updateHeroDescription(){const h=HEROES[this.chosenHero];$('hero-description').innerHTML=h.skills.map(s=>`<div>${icon(s.icon,32)}<span><b>${s.name}</b><small>${s.desc} · ${s.cd} 秒冷却</small></span></div>`).join('');}
  renderBattle(){
    this.setScreen('battle');this.lastPanel='';this.lastRevision=-1;this.waveMessageLeft=0;this.nextWaveKey='';
    this.root.innerHTML=`<section class="battle-ui"><header class="battle-header"><div class="battle-brand">${icon('shield',32)}<span id="battle-name">${this.game.map.name}</span></div><div class="battle-resources"><span title="基地生命">${icon('heart',23)}<b id="hud-life"></b><small>/20</small></span><span title="金币">${icon('coin',24)}<b id="hud-gold"></b></span><span title="波次">${icon('wave',24)}<b id="hud-wave"></b></span></div><div class="battle-controls">${btn('speed','1×','speed-button','aria-label="切换战斗速度" id="speed-button"')}${btn('pause',icon('pause',24),'icon-button','aria-label="暂停游戏"')}${btn('settings',icon('settings',23),'icon-button','aria-label="游戏设置"')}</div></header><div class="boss-hud" id="boss-hud" hidden></div><div class="boss-warning" id="boss-warning" hidden></div><div class="battle-guide" id="battle-guide"></div><aside id="selection-panel" class="selection-panel" aria-label="当前选择"></aside><footer class="battle-bottom"><div class="hero-controls"><button type="button" class="hero-hud" data-action="select-hero">${icon(this.game.hero.kind,48)}<span><b>${HEROES[this.game.hero.kind].name}</b><span class="hero-hp-track"><i id="hero-hp-fill"></i></span><small id="hero-status"></small></span></button><div class="skill-buttons">${HEROES[this.game.hero.kind].skills.map((s,i)=>btn(`skill:${i}`,`${icon(s.icon,28)}<span>${s.name}</span><b class="cooldown" id="skill-cd-${i}"></b>`,'skill-button',`id="skill-${i}" title="${s.desc}" aria-label="${s.name}"`)).join('')}</div></div><div class="wave-controls"><div class="next-wave"><span id="next-label"></span><b id="next-content"></b></div>${btn('wave',`${icon('play',25)}<span id="wave-button-label">开始第一波</span>`,'primary wave-button','id="wave-button"')}</div></footer><div class="view-controls">${btn('zoom-in','+','view-button','aria-label="放大地图"')}${btn('zoom-out','−','view-button','aria-label="缩小地图"')}${btn('reset-view',icon('return',18),'view-button','aria-label="恢复地图视角"')}${btn('grid','▦','view-button','aria-label="显示建造格子" aria-pressed="false"')}${btn('fullscreen','⛶','view-button','aria-label="切换全屏"')}</div></section>`;
    this.root.querySelector('.battle-controls').before($('boss-hud'));
    this.root.querySelector('.view-controls').id='map-view-tools';
    this.root.querySelector('[data-action="select-hero"]').insertAdjacentHTML('beforeend','<b class="hero-respawn" id="hero-respawn" hidden></b>');
    this.root.querySelector('.battle-resources').insertAdjacentHTML('beforeend','<span class="wave-brief" id="wave-brief" role="status" aria-live="polite" hidden></span>');
    this.root.querySelector('[data-action="grid"]').innerHTML=icon('grid',23);
    this.root.querySelector('[data-action="fullscreen"]').innerHTML=icon('expand',23);
    this.root.firstElementChild.insertAdjacentHTML('beforeend',btn('view-tools',icon('map',25),'view-toggle','aria-label="地图工具" aria-controls="map-view-tools" aria-expanded="false"'));
    this.root.firstElementChild.insertAdjacentHTML('beforeend',`<div class="wave-arrival" id="wave-arrival" role="status" aria-live="polite" hidden>${icon('wave',36)}<div><small>时空之门已开启</small><b id="wave-arrival-title"></b><span id="wave-arrival-detail"></span></div></div>`);
    this.update(1);this.display?.updateControls();
    const tip=this.game.map.tip,key=String(this.game.map.id);
    if(tip&&!this.store.progress.tips.includes(key)){$('battle-guide').innerHTML=`${icon('book',24)}<span>${tip}</span>${btn('dismiss-tip',icon('close',20),'icon-button','aria-label="关闭提示"')}`;}
  }
  panel(){
    const g=this.game,sel=g.selected,panel=$('selection-panel');if(!panel)return;
    const tower=sel?.type==='tower'?g.towers.find(t=>t.id===sel.id):null,obstacle=sel?.type==='obstacle'?g.scenery.find(o=>o.id===sel.id&&o.alive):null;
    // Gold, HP and priority change during combat. Keep those values separate
    // from panel structure so images, scroll and keyboard focus survive kills.
    const key=sel?.type==='site'?'site':tower?`tower:${tower.id}:${tower.level}:${tower.spec}`:obstacle?`obstacle:${obstacle.id}`:sel?.type==='hero'?`hero:${g.hero.kind}`:'none';
    if(key!==this.lastPanel){let html='';
    if(sel?.type==='site'){
      html=`<div class="panel-title"><div><span class="eyebrow">BUILD YOUR DEFENSE</span><h2>建立防线</h2></div>${btn('cancel',icon('close',22),'icon-button','aria-label="关闭建造面板"')}</div><p class="panel-help">空地格子自由建造 · 出售返还总投入的 70%</p><div class="build-grid">${Object.entries(TOWERS).map(([k,t])=>btn(`build:${k}`,`<img class="build-model" data-model-tower="${k}" alt="${t.name}模型"><span><b>${t.name}</b><small>${t.role}</small></span><span class="price">${t.cost}</span>`,'build-option',`title="${t.desc}" data-cost="${t.cost}" ${g.gold<t.cost?'disabled':''}`)).join('')}</div>`;
    }
    if(sel?.type==='tower'){
      const t=tower;if(t){const s=towerStats(t),d=TOWERS[t.kind];
        html=`<div class="panel-title"><div class="tower-title">${icon(t.kind,42)}<div><span class="eyebrow">${d.en} · ${'◆'.repeat(t.level)}</span><h2>${d.name}</h2></div></div>${btn('cancel',icon('close',22),'icon-button','aria-label="关闭塔面板"')}</div><p class="panel-help">${t.spec===null?d.desc:d.specs[t.spec].desc}</p><dl class="tower-facts"><div><dt>伤害</dt><dd>${Math.round(s.damage)} <small>${s.type==='physical'?'物理':'魔法'}</small></dd></div><div><dt>射程</dt><dd>${s.range.toFixed(1)}</dd></div><div><dt>攻击间隔</dt><dd>${s.interval.toFixed(2)}s</dd></div><div><dt>目标</dt><dd>${s.air?'地面 / 空中':'仅地面'}</dd></div></dl>`;
        if(t.level<3){const cost=d.upgrades[t.level-1];html+=btn('upgrade',`${icon('star',25)}升级至 ${t.level+1} 级<span class="button-price">${icon('coin',18)}${cost}</span>`,'primary upgrade-button',`data-cost="${cost}" ${g.gold<cost?'disabled':''}`);}
        else if(t.spec===null)html+=`<div class="specializations"><h3>选择互斥专精</h3>${d.specs.map((sp,i)=>btn(`spec:${i}`,`<span><b>${sp.name}</b><small>${sp.desc}</small></span><em>${sp.cost}</em>`,'spec-option',`data-cost="${sp.cost}" ${g.gold<sp.cost?'disabled':''}`)).join('')}</div>`;
        else html+=`<div class="specialized">${icon('star',23)}已专精 · ${d.specs[t.spec].name}</div>`;
        if(t.kind==='barracks')html+=btn('rally',`${icon('flag',23)}调整集结点`,'secondary full-width');
        html+=`<label class="priority-label" for="tower-priority">目标优先级</label><select id="tower-priority" data-priority="${t.id}">${[['first','最接近终点'],['strong','生命最高'],['near','最靠近塔']].map(([k,n])=>`<option value="${k}" ${t.priority===k?'selected':''}>${n}</option>`).join('')}</select>${btn('sell',`出售防御塔<span>返还 ${Math.floor(t.spent*.7)} 金币</span>`,'sell-button')}`;
      }
    }
    if(sel?.type==='obstacle'){
      if(obstacle){const names={tree:'古木与树丛',rock:'晶矿岩堆',pillar:'残破符文柱',chest:'遗落宝箱'};
        html=`<div class="panel-title"><div><span class="eyebrow">RECLAIM THE REALM</span><h2>${names[obstacle.kind]}</h2></div>${btn('cancel',icon('close',22),'icon-button','aria-label="关闭障碍面板"')}</div><p class="panel-help">指挥射程内的炮塔清除障碍，获得金币，并腾出新的建造格子。</p><div class="obstacle-health"><span></span><i></i></div><div class="clear-reward">${icon('coin',26)}清除奖励 <b>${obstacle.reward} 金币</b></div><p class="panel-help" data-obstacle-near></p>${btn('focus-clear','集中清除','primary full-width','data-clear-action')}`;
      }
    }
    if(sel?.type==='hero'){
      const h=g.hero,d=HEROES[h.kind];
      html=`<div class="panel-title"><div class="tower-title">${icon(h.kind,44)}<div><span class="eyebrow">${d.title}</span><h2>${d.name}</h2></div></div>${btn('cancel',icon('close',22),'icon-button','aria-label="关闭英雄面板"')}</div><p class="hero-vitals" id="hero-panel-status"></p><p class="panel-help">点击道路或空地下达移动指令。英雄会绕行建筑，抵达后自动作战。</p><p class="hero-passive">${d.passive}</p><div class="hero-panel-skills">${d.skills.map((s,i)=>btn(`skill:${i}`,`${icon(s.icon,30)}<span><b>${s.name}</b><small>${s.desc}</small></span>`,'secondary')).join('')}</div>`;
    }
    this.lastPanel=key;panel.innerHTML=html;panel.classList.toggle('visible',!!html);document.body.classList.toggle('has-selection',!!html);panel.querySelector('select')?.addEventListener('change',e=>{g.setPriority(Number(e.target.dataset.priority),e.target.value);});
    // Cached previews can be restored immediately when selecting another cell.
    for(const image of panel.querySelectorAll('img[data-model-tower]')){const cached=this.renderer.previewCache.get(`tower:${image.dataset.modelTower}`);if(cached){image.src=cached;image.classList.add('ready');}}
    }
    for(const button of panel.querySelectorAll('[data-cost]'))button.disabled=g.gold<Number(button.dataset.cost);
    const priority=panel.querySelector('select');if(tower&&priority&&priority.value!==tower.priority)priority.value=tower.priority;
    if(obstacle){
      const near=g.towers.filter(t=>t.kind!=='barracks'&&Math.hypot(t.x-obstacle.x,t.z-obstacle.z)<=towerStats(t).range).length,clearing=g.clearTarget===obstacle.id;
      setText(panel.querySelector('.obstacle-health span'),`${Math.ceil(obstacle.hp)} / ${obstacle.maxHp}`);setWidth(panel.querySelector('.obstacle-health i'),`${obstacle.hp/obstacle.maxHp*100}%`);
      setText(panel.querySelector('[data-obstacle-near]'),near?`${near} 座炮塔可以攻击这里。集中清障期间，这些炮塔会优先攻击障碍。`:'附近尚无输出炮塔。先在相邻空地建造，再点击此障碍。');
      const action=panel.querySelector('[data-clear-action]');action.dataset.action=clearing?'stop-clear':'focus-clear';setText(action,clearing?'停止集中清障':'集中清除');
    }
  }
  update(dt,advanceAnimations=false){
    if(this.screen==='defeat-cinematic'){const phase=$('defeat-phase'),label=this.renderer.defeat?.phase||'城门失守';if(phase&&phase.textContent!==label)phase.textContent=label;return;}
    if(this.screen!=='battle')return;if(advanceAnimations&&this.game.mode==='battle'&&!this.game.paused&&!this.game.warning)this.waveMessageLeft=Math.max(0,(this.waveMessageLeft||0)-dt);
    const compact=document.body.classList.contains('compact-battle'),showWave=this.waveMessageLeft>0&&this.game.mode==='battle'&&!this.game.warning,arrival=$('wave-arrival'),brief=$('wave-brief');
    if(arrival)arrival.hidden=compact||!showWave;if(brief)brief.hidden=!compact||!showWave;
    this.lastTick+=dt;if(this.lastTick<.1&&this.lastRevision===this.game.revision)return;this.lastTick=0;this.lastRevision=this.game.revision;
    const g=this.game,h=g.hero;if(!h)return;
    setText($('hud-life'),g.lives);setText($('hud-gold'),Math.floor(g.gold).toLocaleString());setText($('hud-wave'),g.map.endless?g.wave:`${g.wave}/${g.map.waveCount}`);setText($('speed-button'),`${g.speed}×`);
    setWidth($('hero-hp-fill'),`${h.hp/h.maxHp*100}%`);setText($('hero-status'),h.alive?`${Math.ceil(h.hp)} / ${h.maxHp}${h.shield>0?` · 护盾 ${Math.ceil(h.shield)}`:''}${g.selected?.type==='hero'?' · 点地面移动':' · 点击移动'}`:`${Math.ceil(h.respawn)}s 后重生`);
    const heroVitals=h.alive?`生命 ${Math.ceil(h.hp)} / ${h.maxHp}${h.shield>0?` · 护盾 ${Math.ceil(h.shield)}`:''}`:`${Math.ceil(h.respawn)} 秒后重生`,heroButton=document.querySelector('[data-action="select-hero"]');
    $('hero-respawn').hidden=h.alive;setText($('hero-respawn'),`${Math.ceil(h.respawn)}s`);
    setAttr(heroButton,'aria-pressed',g.selected?.type==='hero');setAttr(heroButton,'aria-label',`${HEROES[h.kind].name}，${heroVitals}：选择后点击地面移动，鼠标右键可直接移动`);setAttr(heroButton,'title',`${HEROES[h.kind].name} · ${heroVitals}`);setAttr(document.querySelector('[data-action="grid"]'),'aria-pressed',this.renderer.showGrid);
    HEROES[h.kind].skills.forEach((s,i)=>{const n=h.cooldowns[i];setText($('skill-cd-'+i),n>.05?Math.ceil(n):'');$('skill-'+i).classList.toggle('on-cooldown',n>.05||!h.alive);$('skill-'+i).classList.toggle('targeting',g.targeting?.type==='skill'&&g.targeting.index===i);});
    const nextKey=`${g.map.id}:${g.wave}`;if(this.nextWaveKey!==nextKey){const counts={};for(const e of wavePlan(g.map,g.wave+1))counts[e.kind]=(counts[e.kind]||0)+1;this.nextWaveKey=nextKey;this.nextWaveText=Object.entries(counts).slice(0,3).map(([k,n])=>`${ENEMIES[k].name} ×${n}`).join(' · ');}
    const boss=g.enemies.find(e=>e.boss&&e.alive),b=$('boss-hud');b.hidden=!boss;
    if(boss){
      const name=boss.name||ENEMIES[boss.kind].name,key=`${boss.id}:${name}:${boss.maxHp}`,hp=Math.max(0,Math.ceil(boss.hp));
      if(b.dataset.boss!==key){b.dataset.boss=key;b.innerHTML=`<div class="boss-name"><b>${name}</b></div><div class="boss-health-track" role="progressbar" aria-label="${name}生命" aria-valuemin="0" aria-valuemax="${Math.ceil(boss.maxHp)}"><i></i></div><div class="boss-vitals" aria-hidden="true"><span></span><span>/ ${Math.ceil(boss.maxHp).toLocaleString()}</span></div>`;}
      setAttr(b.querySelector('[role="progressbar"]'),'aria-valuenow',hp);setWidth(b.querySelector('i'),`${Math.max(0,Math.min(100,boss.hp/boss.maxHp*100))}%`);setText(b.querySelector('.boss-vitals span'),hp.toLocaleString());
    }
    const w=$('boss-warning');w.hidden=!g.warning;if(g.warning){const key=`${g.warning.name}:${Math.ceil(g.warning.remaining)}`;if(w.dataset.warning!==key){w.dataset.warning=key;w.innerHTML=`<span class="eyebrow">DANGER · 领主来袭</span><b>${g.warning.name}</b><small>战场将在 ${Math.ceil(g.warning.remaining)} 秒后恢复</small>`;}}
    const active=g.waveActive;setText($('next-label'),active?`第 ${g.wave} 波进行中`:'下一波');setText($('next-content'),active?`剩余 ${g.enemies.length+g.queue.length} 名敌军${g.map.endless?` · 得分 ${Math.round(g.score)}`:''}`:this.nextWaveText);
    const remaining=g.enemies.length+g.queue.length;
    $('wave-button').disabled=active||g.paused||!!g.warning;
    setText($('wave-button-label'),active?(compact?`剩余 ${remaining} 名敌军`:'自动续波中'):g.wave===0?'开始第一波':'继续迎战');
    setAttr($('wave-button'),'aria-label',active?`第 ${g.wave} 波进行中，剩余 ${remaining} 名敌军，清波后自动续波`:'开始第一波');
    this.panel();
    setText($('hero-panel-status'),heroVitals);
    const guide=$('battle-guide'),target=g.targeting?`${g.targeting.type}:${g.targeting.index??g.targeting.id??''}`:'';
    if(target&&guide.dataset.target!==target){guide.innerHTML=`${icon(g.targeting.type==='rally'?'flag':'star',24)}<span>${g.targeting.type==='rally'?'点击兵营射程内的道路设定集结点。':'点击合法地面释放技能；移动指针可以预览范围。'}</span>${btn('cancel-target','取消','secondary small')}`;}
    else if(!target&&guide.dataset.target){guide.innerHTML='';}
    guide.dataset.target=target;
  }
  openModal(type,html,cls=''){
    this.modal=type;this.modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal-sheet ${cls}" role="dialog" aria-modal="true" aria-label="${type==='settings'?'游戏设置':type==='pause'?'暂停游戏':'游戏面板'}" tabindex="-1"><button class="modal-close icon-button" type="button" data-action="close-modal" aria-label="关闭面板">${icon('close',25)}</button>${html}</section></div>`;
    if(type==='settings')this.displaySettings();
    this.focusBefore=document.activeElement;this.modalRoot.querySelector('section').focus();
    this.modalRoot.onkeydown=e=>{if(e.key!=='Tab')return;const list=[...this.modalRoot.querySelectorAll('button:not(:disabled),input,select')].filter(e=>e.offsetParent!==null);if(!list.length)return;const i=list.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();list.at(-1).focus();}else if(!e.shiftKey&&i===list.length-1){e.preventDefault();list[0].focus();}};
  }
  closeModal(resume=true){
    const old=this.modal;if(resume&&old==='result')return;
    this.modal=null;this.modalRoot.innerHTML='';this.modalRoot.onkeydown=null;this.focusBefore?.focus?.();
    if(resume&&['settings','pause','codex'].includes(old)&&this.game.mode==='battle'&&this.resumeAfterModal){this.game.setPaused(false);this.resumeAfterModal=false;this.audio.pause(false);}
    if(resume&&this.game.mode==='battle'&&this.game.paused)this.showPause();
  }
  showPause(){
    this.resumeAfterModal=true;this.openModal('pause',`<span class="eyebrow">THE WATCH CONTINUES</span><h2>暂时休整</h2><p>防线已暂停。准备好后，继续这场守望。</p><div class="pause-actions">${btn('resume',`${icon('play',24)}继续战斗`,'primary')}${btn('settings',`${icon('settings',24)}游戏设置`,'secondary')}${btn('codex',`${icon('book',24)}查看图鉴`,'secondary')}${btn('restart',`${icon('return',24)}重新开始本关`,'secondary')}${btn('leave',`返回${this.game.map.endless?'地图':'战役'}选择`,'quiet')}</div>`,'pause-sheet');
  }
  showSettings(){
    if(this.game.mode==='battle'){if(!this.game.paused)this.resumeAfterModal=true;this.game.setPaused(true);}
    const s=this.store.settings;this.openModal('settings',`<span class="eyebrow">YOUR WATCH, YOUR WAY</span><h2>游戏设置</h2><p class="modal-intro">修改立即生效，自动保存到当前浏览器。</p><div class="settings-list"><label><span>画面质量<small>均衡启动，高清可随时切换</small></span><select data-setting="quality">${[['high','高清'],['balanced','均衡'],['fast','流畅']].map(([k,n])=>`<option value="${k}" ${s.quality===k?'selected':''}>${n}</option>`).join('')}</select></label><label><span>特效丰富度<small>精简仍保留技能与危险提示</small></span><select data-setting="effects">${[['minimal','精简'],['standard','标准'],['rich','丰富']].map(([k,n])=>`<option value="${k}" ${s.effects===k?'selected':''}>${n}</option>`).join('')}</select></label>${[['shake','镜头震动',0,1,.05],['sensitivity','地图操作灵敏度',.5,2,.05],['music','音乐音量',0,1,.05],['sfx','音效音量',0,1,.05]].map(([k,n,min,max,step])=>`<label><span>${n}<small data-setting-value="${k}">${k==='sensitivity'?s[k].toFixed(2)+'×':Math.round(s[k]*100)+'%'}</small></span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-setting="${k}" aria-label="${n}"></label>`).join('')}<label><span>显示伤害数字</span><input type="checkbox" data-setting="numbers" ${s.numbers?'checked':''} aria-label="显示伤害数字"></label></div><div class="settings-actions">${btn('defaults','恢复默认设置','secondary')}${btn('reset-progress','重置游戏进度','quiet danger-text')}</div><p class="fineprint">${this.store.available?'存档保存在本机浏览器，刷新页面不会丢失。':'浏览器存储当前不可用，本次仍可游玩和调整设置。'}</p>`,'settings-sheet');
  }
  displaySettings(){
    const list=this.modalRoot.querySelector('.settings-list');if(!list||!this.display)return;
    list.insertAdjacentHTML('beforeend',`<div class="settings-display"><span>游戏显示<small id="display-state"></small></span>${btn('fullscreen','进入全屏','secondary','id="settings-fullscreen" aria-pressed="false"')}</div><p class="display-setting-note">${this.display.mobile?'手机和平板仅支持横屏游玩，转回竖屏会暂停战斗。':'可随时在全屏与窗口之间切换。'}</p>`);
    this.display.updateControls();
  }
  setting(e){const key=e.target.dataset.setting;if(!key)return;const value=e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?Number(e.target.value):e.target.value;this.store.saveSettings({...this.store.settings,[key]:value});this.renderer.applySettings(this.store.settings);this.audio.apply(this.store.settings);const label=this.modalRoot.querySelector(`[data-setting-value="${key}"]`);if(label)label.textContent=key==='sensitivity'?Number(value).toFixed(2)+'×':Math.round(value*100)+'%';}
  showCodex(){
    if(this.game.mode==='battle'){if(!this.game.paused)this.resumeAfterModal=true;this.game.setPaused(true);}
    const section=(label,rows)=>`<h3 class="codex-heading">${label}</h3><div class="codex-grid">${rows.join('')}</div>`;
    this.openModal('codex',`<span class="eyebrow">THE FIELD COMPENDIUM</span><h2>王国图鉴</h2><p class="modal-intro">了解职责与弱点，才能建立更好的防线。</p>${section('八种防御塔',Object.entries(TOWERS).map(([k,d])=>`<article><img class="codex-model" data-model-tower="${k}" alt="${d.name}模型"><div><h4>${d.name}<small>${d.role}</small></h4><p>${d.desc}</p><small>建造 ${d.cost} · 升级 ${d.upgrades.join(' / ')} · 三级专精 ${d.specs.map(s=>s.name).join(' / ')}</small></div></article>`))}${section('四名守望者',Object.entries(HEROES).map(([k,d])=>`<article><img class="codex-model" data-model-hero="${k}" alt="${d.name}模型"><div><h4>${d.name}</h4><p>${d.passive}</p><small>${d.skills.map(s=>s.name).join(' / ')} · ${d.unlock===0?'初始可用':`完成第 ${d.unlock} 关解锁`}</small></div></article>`))}${section('敌军与无尽领主',Object.entries(ENEMIES).map(([k,d])=>`<article><img class="codex-model" data-model-enemy="${k}" alt="${d.name}模型"><div><h4>${d.name}<small>${d.role}${d.boss?" · 无尽模式":""}</small></h4><p>${d.desc}</p><small>基础生命 ${d.hp} · 近战攻击 ${d.damage} · 基础击杀 ${d.reward} 金币 · 护甲 ${Math.round(d.armor*100)}% · 魔抗 ${Math.round(d.resist*100)}%${d.air?' · 空中单位':''}</small></div></article>`))}${section("十二位战役首领",BOSSES.map((b,i)=>`<article><img class="codex-model" data-model-enemy="boss:${b.id}" alt="${b.name}模型"><div><h4>${b.name}<small>第 ${i+1} 关 · ${b.role}</small></h4><p>${b.desc}</p><small>基础生命 ${b.hp} · 击杀 ${b.reward} 金币 · 末波现身</small></div></article>`))}<div class="codex-controls"><h3>操作与战术</h3><p>点击空地格子建塔，点击塔升级或专精。点击树木、岩石或宝箱让炮塔集中清障，清除后获得金币与新建造位置。选择英雄后点击地面移动；技能按钮进入瞄准，点击地点释放，取消或 Esc 撤销。</p><p>单指拖动平移，双指平移和缩放；鼠标拖动平移，滚轮缩放。空格开始第一波 / 暂停，后续波次清完立即自动续上，H 选择英雄，1 / 2 使用技能，F 切换速度，R 还原视角。</p><p>兵营仅阻挡地面单位。集结点必须在兵营射程内的道路上。物理护甲和魔抗分别减少对应伤害；护盾先于生命消耗。控制后有短暂免控窗口，Boss 控制效果更短。</p></div>`,'codex-sheet');
  }
  showDefeat(){
    this.closeModal(false);this.screen='defeat-cinematic';this.game.selected=null;this.game.targeting=null;document.body.classList.remove('has-selection');this.audio.pause(false);
    clearTimeout(this.toastTimer);$('toast').classList.remove('visible');
    this.root.innerHTML=`<section class="defeat-ui" aria-label="城镇失守演出"><div class="defeat-caption"><h2>城门失守</h2><p id="defeat-phase" role="status" aria-live="polite">城堡崩塌</p></div>${btn('skip-defeat','跳过演出','secondary defeat-skip','aria-label="跳过失败演出并查看结算"')}</section>`;
  }
  showResult(){
    if(this.screen==='defeat-cinematic')this.root.replaceChildren();
    this.screen='result';this.game.selected=null;document.body.classList.remove('has-selection');const g=this.game,r=g.result,win=r.win,clear=r.campaignClear;
    this.openModal('result',`<div class="result-emblem">${icon(win?'trophy':'shield',78)}</div><span class="eyebrow">${clear?'THE REALM ENDURES':win?'A STAND TO REMEMBER':'THE WATCH WILL RETURN'}</span><h2>${clear?'王国的黎明':win?'防线已守住':'此刻，城门失守'}</h2><p>${clear?'十二道防线全部完成。你的守望，让王国迎来新的黎明。':g.map.endless?`你在${g.map.name}守住了 ${r.completedWave} 波敌军。`:win?`${g.map.name}重归安宁。下一道防线正在等你。`:'调整塔的组合与英雄的位置，再一次迎战。'}</p>${win&&!g.map.endless?`<div class="result-stars">${stars(r.stars)}</div>`:''}<div class="result-facts"><span><b>${r.kills}</b>击败敌军</span><span><b>${r.lives}</b>基地生命</span><span><b>${r.score.toLocaleString()}</b>守城得分</span></div>${win&&!g.map.endless&&[2,4,7].includes(g.map.id)?`<p class="unlock-note">${icon('star',24)}新英雄已解锁：${Object.values(HEROES).find(h=>h.unlock===g.map.id)?.name}</p>`:''}${g.map.endless?`<p class="unlock-note">本图纪录：${this.store.progress.endless[g.map.id].wave} 波 · ${this.store.progress.endless[g.map.id].score.toLocaleString()} 分</p>`:''}<div class="result-actions">${win&&!g.map.endless&&g.map.id<12?btn('next-level','前往下一关','primary'):btn('retry','再次挑战','primary')}${btn('result-leave',g.map.endless?'返回无尽地图':'返回战役地图','secondary')}${clear?btn('endless-from-result','挑战无尽守城','secondary'):''}</div>`,'result-sheet');
  }
  confirmReset(){this.openModal('reset',`<span class="eyebrow">RESET PROGRESS</span><h2>重置全部进度？</h2><p>将删除关卡星级、英雄解锁、无尽纪录与已读提示。这个操作无法撤销，画面和声音设置会保留。</p><div class="confirm-actions">${btn('settings','保留进度','secondary')}${btn('confirm-reset','确认删除进度','danger-button')}</div>`,'pause-sheet');}
  async click(e){
    const el=e.target.closest('[data-action]');if(!el||el.disabled||this.display?.blocked)return;const [action,value]=el.dataset.action.split(':'),g=this.game;
    if(['grid','reset-view','fullscreen','select-hero','skill','wave','pause','settings','cancel'].includes(action))this.closeViewTools();
    if(action==='fullscreen'){this.audio.unlock();await this.display.toggle();return;}
    if(this.screen==='defeat-cinematic'&&action!=='skip-defeat')return;
    await this.audio.unlock();if(g.mode==='menu')this.audio.pause(false);
    if(action==='skip-defeat'){this.renderer.defeat?.finish(true);return;}
    if(action==='home'){if(g.mode!=='menu')g.leave();this.closeModal(false);this.renderHome();}
    if(action==='modes')this.renderModes();if(action==='campaign')this.renderCampaign();if(action==='endless')this.renderEndless();
    if(action==='chapter'){this.chapter=Number(value);this.renderCampaign();}
    if(action==='detail'){const map=[...LEVELS,...ENDLESS].find(m=>String(m.id)===value);if(map)this.mapDetail(map);}
    if(action==='heroes')this.renderHeroes();
    if(action==='hero'){this.chosenHero=value;this.renderHeroes();}
    if(action==='launch'){g.start(this.chosenMap,this.chosenHero);}
    if(action==='settings')this.showSettings();if(action==='codex')this.showCodex();
    if(action==='close-modal'){if(this.modal==='result')return;this.closeModal();}
    if(action==='pause'){g.setPaused(true);this.showPause();}
    if(action==='resume'){this.closeModal(false);g.setPaused(false);this.resumeAfterModal=false;this.audio.pause(false);}
    if(action==='speed'){g.speed=g.speed===1?2:1;g.changed();}
    if(action==='wave')g.beginWave();
    if(action==='view-tools'){const tools=this.root.querySelector('.view-controls');tools?.classList.toggle('expanded');el.setAttribute('aria-expanded',String(tools?.classList.contains('expanded')));}
    if(action==='build')g.build(g.selected?.id,value);
    if(action==='stop-clear'){g.clearTarget=null;g.changed();}
    if(action==='focus-clear')g.focusObstacle(g.selected?.id);
    if(action==='grid'){this.renderer.showGrid=!this.renderer.showGrid;el.setAttribute('aria-pressed',String(this.renderer.showGrid));if(this.renderer.showGrid){g.selected=null;g.targeting=null;g.changed();this.toast('建造模式：点击空地格子建塔。再次点击网格按钮退出。');}}
    if(action==='upgrade')g.upgrade(g.selected?.id);
    if(action==='spec')g.specialize(g.selected?.id,Number(value));
    if(action==='sell')g.sell(g.selected?.id);
    if(action==='rally'){g.targeting={type:'rally',id:g.selected?.id,radius:towerStats(g.towers.find(t=>t.id===g.selected?.id)).range};g.changed();}
    if(action==='select-hero'){this.renderer.showGrid=false;g.targeting=null;g.selected={type:'hero',id:g.hero.id};g.changed();}
    if(action==='skill')g.skill(Number(value));
    if(action==='cancel'){g.selected=null;g.targeting=null;g.changed();}
    if(action==='cancel-target'){g.targeting=null;g.changed();}
    if(action==='dismiss-tip'){this.store.seenTip(String(g.map.id));$('battle-guide').innerHTML='';}
    if(action==='zoom-in')this.renderer.zoom(1.18);if(action==='zoom-out')this.renderer.zoom(1/1.18);if(action==='reset-view')this.renderer.resetView();
    if(action==='defaults'){this.store.saveSettings({...DEFAULT_SETTINGS});this.renderer.applySettings(this.store.settings);this.audio.apply(this.store.settings);this.showSettings();}
    if(action==='reset-progress')this.confirmReset();if(action==='confirm-reset'){this.store.reset();this.toast('游戏进度已重置。');if(g.mode!=='menu'){g.leave();this.closeModal(false);this.renderHome();}else this.showSettings();}
    if(action==='restart'){this.openModal('restart',`<h2>重新开始本关？</h2><p>本场的防线和金币将重置，已保存的战役星级不受影响。</p><div class="confirm-actions">${btn('pause','继续休整','secondary')}${btn('retry','重新开始','primary')}</div>`,'pause-sheet');}
    if(action==='retry'){this.closeModal(false);g.restart();}
    if(action==='leave'||action==='result-leave'){const endless=g.map.endless;this.closeModal(false);g.leave();if(endless)this.renderEndless();else{this.chapter=g.map.region;this.renderCampaign();}this.audio.pause(false);}
    if(action==='next-level'){const next=LEVELS[g.map.id];this.closeModal(false);g.leave();this.chosenMap=next;this.renderHeroes();}
    if(action==='endless-from-result'){this.closeModal(false);g.leave();this.renderEndless();}
    // Reflect a completed command immediately, even when GPU frames are slow.
    if(g.revision!==this.lastRevision)this.update(1);
  }
}
