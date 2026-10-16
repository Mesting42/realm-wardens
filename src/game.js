import { TOWERS, HEROES, ENEMIES, towerStats, wavePlan, enemyScale, bossProfile, activeRoutes } from './content.js';
import { updateCampaignBoss } from './campaign-combat.js';
import { clamp, distance, navigate } from './routes.js';
import { terrainObjects,buildCells,snapCell } from './terrain.js';

export const STEP = 1 / 30;
const pos = a => ({ x: a.x, z: a.z });
const live = a => a.alive && a.hp > 0;
const towerCombatCache=new WeakMap();

export class Game {
  constructor(store) { this.store=store; this.mode='menu'; this.listeners=new Set(); this.serial=0; this.events=[]; this.reset(); }
  reset() {
    this.time=0;this.wave=0;this.gold=0;this.lives=20;this.score=0;this.kills=0;this.leaked=0;
    this.towers=[];this.enemies=[];this.guards=[];this.projectiles=[];this.zones=[];this.queue=[];this.scenery=[];this.cells=[];this.clearTarget=null;this.cleared=0;
    this.warning=null;this.paused=false;this.speed=1;this.accumulator=0;this.waveActive=false;
    this.waveTime=0;this.intermission=0;this.selected=null;this.targeting=null;this.result=null;this.lastBreach=null;this.events=[];this.revision=0;
  }
  on(fn) { this.listeners.add(fn);return ()=>this.listeners.delete(fn); }
  event(type,data={}) { const e={type,time:this.time,id:++this.serial,...data};this.events.push(e);if(this.events.length>220)this.events.shift(); for(const fn of this.listeners)fn(e); }
  changed() {this.revision++;}
  notify(text) {this.event('notice',{text});return false;}
  start(map,kind='knight') {
    if(!map.endless&&!this.store.unlocked(map.id))return this.notify('先完成上一场战役。');
    if(!HEROES[kind]||this.store.completed()<HEROES[kind].unlock)return this.notify('这名英雄尚未解锁。');
    this.reset();this.map=map;this.scenery=terrainObjects(map);this.cells=buildCells(map);this.mode='battle';this.gold=map.gold;this.lives=map.lives;
    const p=map.routes[0].at(map.routes[0].length*.64),d=HEROES[kind];
    this.hero={id:++this.serial,kind,...pos(p),angle:p.angle,hp:d.hp,maxHp:d.hp,shield:0,shieldUntil:0,alive:true,cooldowns:[0,0],attackTimer:0,attackCount:0,path:[],anchor:pos(p),respawn:0,attackAt:-99,hurtAt:-99,armor:d.armor};
    this.event('start',{map:map.id});this.changed();return true;
  }
  restart(){return this.start(this.map,this.hero.kind);}
  leave(){this.reset();this.mode='menu';this.changed();this.event('leave');}
  setPaused(value) { this.paused=value;this.accumulator=0;this.targeting=null;this.changed();this.event('pause',{paused:value}); }
  beginWave(automatic=false) {
    if(this.mode!=='battle'||this.paused||this.warning||this.waveActive)return false;
    if(!this.map.endless&&this.wave>=this.map.waveCount)return false;
    this.wave++;this.queue=wavePlan(this.map,this.wave).map(e=>({...e}));this.waveTime=0;this.waveActive=true;this.intermission=0;
    this.event('wave',{wave:this.wave,automatic,routes:activeRoutes(this.map,this.wave),newRoutes:activeRoutes(this.map,this.wave).filter(r=>!activeRoutes(this.map,Math.max(1,this.wave-1)).includes(r))});this.changed();return true;
  }
  build(siteId,kind) {
    if(!this.canAct())return false;
    const site=this.cells.find(s=>s.id===siteId)||this.map.sites.find(s=>s.id===siteId),d=TOWERS[kind];
    if(!site||!d)return this.notify('请选择战场上的空地格子。');
    const placement=this.placement(site);if(!placement.ok)return this.notify(placement.reason);
    if(this.gold<d.cost)return this.notify(`金币不足，还需要 ${d.cost-this.gold} 金币。`);
    const t={id:++this.serial,site:siteId,kind,x:site.x,z:site.z,level:1,spec:null,spent:d.cost,priority:'first',attackTimer:.15,attackCount:0,attackAt:-99,angle:0,frozenUntil:0};
    this.gold-=d.cost;this.towers.push(t);this.selected={type:'tower',id:t.id};
    if(kind==='barracks') {t.rally=this.nearestRoad(t);this.populateGuards(t);}
    for(const f of [this.hero,...this.guards].filter(live))if(f.path?.length){const path=navigate(f,f.anchor,this.obstacles().filter(o=>distance(o,f)>o.r+.22));f.path=path||[];if(!path)f.anchor=pos(f);}
    this.event('build',{...pos(t),kind,level:t.level});this.changed();return t;
  }
  cellAt(p){const c=snapCell(p);return c?this.cells.find(s=>s.id===c.id)||null:null;}
  placement(p){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.abs(p.x)>14.7||Math.abs(p.z)>10.8)return {ok:false,reason:'请在战场范围内建造。'};
    if(this.map.routes.some(r=>r.nearest(p).distance<1.76))return {ok:false,reason:'道路需要留给敌军和守卫通行。'};
    if(this.map.routes.some(r=>distance(r.at(0),p)<2.2||distance(r.at(r.length),p)<2.5))return {ok:false,reason:'时空门与城堡周围需要保持通畅。'};
    if(this.towers.some(t=>distance(t,p)<1.79))return {ok:false,reason:'这里已有防御建筑，请选择其他空地。'};
    if(this.scenery.some(o=>o.alive&&distance(o,p)<o.r+.8))return {ok:false,reason:'先清除这里的障碍物，再建造防御塔。'};
    if([this.hero,...this.guards].some(f=>live(f)&&distance(f,p)<1.1))return {ok:false,reason:'这里有友军，请先移动友军。'};
    return {ok:true};
  }
  focusObstacle(id){
    if(!this.canAct())return false;const o=this.scenery.find(o=>o.id===id&&o.alive);if(!o)return false;
    this.clearTarget=id;this.selected={type:'obstacle',id};this.targeting=null;this.changed();return true;
  }
  damageObstacle(o,amount){
    if(!o?.alive||!Number.isFinite(amount)||amount<=0)return false;
    const hp=Math.min(o.hp,amount);o.hp-=hp;o.hurtAt=this.time;
    this.event('hit',{id:o.id,...pos(o),hp,shield:0,kind:'physical'});
    if(o.hp<=0){o.alive=false;this.gold=Math.min(1e7,this.gold+o.reward);this.cleared++;
      this.event('obstacle-clear',{id:o.id,...pos(o),kind:o.kind,reward:o.reward});
      if(this.clearTarget===o.id)this.clearTarget=null;
      if(this.selected?.id===o.id){const cell=this.cellAt(o);this.selected=cell?{type:'site',id:cell.id}:null;}
    }
    this.changed();return hp;
  }
  upgrade(id) {
    if(!this.canAct())return false;const t=this.towers.find(t=>t.id===id);if(!t||t.level>=3)return false;
    const cost=TOWERS[t.kind].upgrades[t.level-1];if(this.gold<cost)return this.notify(`金币不足，还需要 ${cost-this.gold} 金币。`);
    this.gold-=cost;t.spent+=cost;t.level++;if(t.kind==='barracks')this.populateGuards(t);
    this.event('upgrade',{...pos(t),kind:t.kind,level:t.level});this.changed();return true;
  }
  specialize(id,branch) {
    if(!this.canAct())return false;const t=this.towers.find(t=>t.id===id);if(!t||t.level!==3||t.spec!==null||![0,1].includes(branch))return false;
    const cost=TOWERS[t.kind].specs[branch].cost;if(this.gold<cost)return this.notify(`金币不足，还需要 ${cost-this.gold} 金币。`);
    this.gold-=cost;t.spent+=cost;t.spec=branch;if(t.kind==='barracks')this.populateGuards(t);
    this.event('upgrade',{...pos(t),kind:t.kind,level:4});this.changed();return true;
  }
  sell(id) {
    if(!this.canAct())return false;const t=this.towers.find(t=>t.id===id);if(!t)return false;
    const refund=Math.floor(t.spent*7/10);this.gold+=refund;this.towers=this.towers.filter(a=>a!==t);
    for(const g of this.guards.filter(g=>g.tower===id))this.releaseBlocks(g.id);
    this.guards=this.guards.filter(g=>g.tower!==id);this.selected=null;this.targeting=null;
    this.event('sell',{...pos(t),refund});this.changed();return refund;
  }
  canAct(){return this.mode==='battle'&&!this.paused&&!this.warning;}
  setPriority(id,p){const t=this.towers.find(t=>t.id===id);if(t&&['first','strong','near'].includes(p)){t.priority=p;this.changed();}}
  obstacles(){return this.towers.map(t=>({...pos(t),r:.83})).concat(this.map.routes.map(r=>({...pos(r.at(r.length)),r:1.35})),(this.scenery||[]).filter(o=>o.alive));}
  legalGround(p){return Number.isFinite(p?.x)&&Number.isFinite(p?.z)&&Math.abs(p.x)<14.7&&Math.abs(p.z)<10.8&&!this.obstacles().some(o=>distance(p,o)<o.r+.24);}
  nearestRoad(p){let best=null;for(let i=0;i<this.map.routes.length;i++){const q=this.map.routes[i].nearest(p);if(!best||q.distance<best.distance)best={...q,route:i};}return best;}
  rally(id,p){
    if(!this.canAct())return false;const t=this.towers.find(t=>t.id===id&&t.kind==='barracks');if(!t)return false;
    const q=this.nearestRoad(p);
    if(q.distance>1.15||distance(q,t)>towerStats(t).range||!this.legalGround(q))return this.notify('集结点须在兵营射程内的道路上。');
    t.rally=q;
    for(const g of this.guards.filter(g=>g.tower===id)) {this.releaseBlocks(g.id);g.path=navigate(g,q,this.obstacles().filter(o=>distance(o,g)>o.r+.22))||[];g.anchor=pos(q);}
    this.event('command',{...pos(q)});this.changed();return true;
  }
  moveHero(p){
    if(!this.canAct()||!live(this.hero))return this.notify('英雄暂时无法接受指令。');
    if(!this.legalGround(p))return this.notify('这里无法通行，请选择空地或道路。');
    const path=navigate(this.hero,p,this.obstacles());if(!path)return this.notify('没有可通行的路径。');
    this.releaseBlocks(this.hero.id);this.hero.path=path;this.hero.anchor=pos(p);this.selected={type:'hero',id:this.hero.id};this.targeting=null;
    this.event('command',{...pos(p)});this.changed();return true;
  }
  skill(index,p=null){
    if(!this.canAct()||!live(this.hero))return this.notify('英雄暂时无法施法。');
    const h=this.hero,d=HEROES[h.kind],s=d.skills[index];if(!s)return false;
    if(h.cooldowns[index]>0)return this.notify(`技能冷却中：${Math.ceil(h.cooldowns[index])} 秒。`);
    if(s.target&&!p){this.targeting={type:'skill',index,radius:s.radius};this.selected={type:'hero',id:h.id};this.changed();return 'target';}
    if(s.target&&!this.legalGround(p))return this.notify('请在可通行的战场区域释放技能。');
    h.cooldowns[index]=s.cd;h.castUntil=this.time+.9;this.targeting=null;const point=p||h;
    if(h.kind==='knight'&&index===0){for(const f of [h,...this.guards].filter(live))if(distance(f,h)<5.5){f.shield=Math.max(f.shield,160);f.shieldUntil=this.time+6;}h.tauntUntil=this.time+5;this.event('skill',{...pos(h),kind:'shield',radius:5.5});}
    if(h.kind==='knight'&&index===1){for(const e of this.inArea(point,s.radius)){this.damage(e,170,'physical');this.control(e,1.1);}this.event('skill',{...pos(point),kind:'sun',radius:s.radius});}
    if(h.kind==='ranger'&&index===0)this.zone(point,s.radius,8,28,'trap',h.id,{slow:.55});
    if(h.kind==='ranger'&&index===1)this.zone(point,s.radius,1.8,80,'arrows',h.id,{interval:.6,initial:true,type:'physical'});
    if(h.kind==='mage'&&index===0){for(const e of this.inArea(point,s.radius))this.damage(e,220,'magic');this.event('skill',{...pos(point),kind:'meteor',radius:s.radius});}
    if(h.kind==='mage'&&index===1){for(const e of this.inArea(point,s.radius)){this.control(e,1.6);this.slow(e,.5,5);}this.event('skill',{...pos(point),kind:'stasis',radius:s.radius});}
    if(h.kind==='druid'&&index===0){for(const f of [h,...this.guards].filter(live))if(distance(f,h)<6){this.heal(f,200);f.shield=Math.max(f.shield,80);f.shieldUntil=this.time+6;}this.event('skill',{...pos(h),kind:'heal',radius:6});}
    if(h.kind==='druid'&&index===1){this.makeGuard(null,0,point,true);this.event('skill',{...pos(point),kind:'tree',radius:s.radius});}
    this.changed();return true;
  }
  zone(p,radius,duration,damage,kind,source,opts={}){const z={id:++this.serial,...pos(p),radius,left:duration,damage,kind,source,timer:opts.initial?0:.5,...opts};this.zones.push(z);this.event('zone',{...z});return z;}
  makeGuard(t,index,p,tree=false){
    const stats=t?towerStats(t):null,lv=t?.level||1,scout=stats?.spec==='scouts',w=stats?.spec==='wardens';
    const separation=t?Math.max(.01,distance(t,p)):1,start=t?{x:t.x+(p.x-t.x)/separation*1.1,z:t.z+(p.z-t.z)/separation*1.1}:p;
    const g={id:++this.serial,tower:t?.id??null,kind:tree?'tree':scout?'scout':'guard',index,x:start.x,z:start.z,angle:0,hp:tree?550:(160+lv*70)*(w?1.7:1),maxHp:tree?550:(160+lv*70)*(w?1.7:1),shield:w?75:0,shieldUntil:Infinity,alive:true,armor:w?.4:.18,damage:tree?45:TOWERS.barracks.damage*[1,1.6,2.4][lv-1],range:scout?4.2:1.4,air:scout,speed:3.3,capacity:tree||w?2:1,attackTimer:.1,attackAt:-99,hurtAt:-99,respawn:0,expires:tree?this.time+18:Infinity,anchor:pos(p),path:[],type:'physical'};
    g.path=navigate(g,p,this.obstacles().filter(o=>distance(o,g)>.5))||[pos(p)];this.guards.push(g);return g;
  }
  populateGuards(t){
    const stats=towerStats(t),desired=stats.spec==='scouts'?3:2;
    const old=this.guards.filter(g=>g.tower===t.id);
    for(const g of old){this.releaseBlocks(g.id);}
    this.guards=this.guards.filter(g=>g.tower!==t.id);
    for(let i=0;i<desired;i++)this.makeGuard(t,i,t.rally);
  }
  releaseBlocks(id){for(const e of this.enemies)if(e.blocker===id){e.blocker=null;e.blockTime=0;}}
  spawn(kind,route=0,d=0,opts={}) {
    if(this.enemies.filter(live).length>=88)return null;
    const profile=bossProfile(opts.bossId),def=profile?{...ENEMIES[kind],...profile,boss:true,elite:false,leak:20}:ENEMIES[kind],scale=enemyScale(this.map,this.wave||1),p=this.map.routes[route].at(d);
    const endlessBoss=def.boss&&this.map.endless,hpBase=endlessBoss?Math.max(def.hp,scale.bossBaseHp):def.hp;
    const armorBase=endlessBoss?Math.max(def.armor,scale.bossBaseArmor):def.armor,resistBase=endlessBoss?Math.max(def.resist,scale.bossBaseResist):def.resist,speedBase=endlessBoss?Math.max(def.speed,scale.bossBaseSpeed):def.speed;
    const hp=hpBase*scale.hp*(endlessBoss?scale.bossHp:1),defense=this.map.endless?scale.defense:0;
    const e={id:++this.serial,kind,route,d,...pos(p),angle:p.angle,hp,maxHp:hp,shield:def.shield||0,alive:true,speed:speedBase*scale.speed,reward:Math.round(def.reward*scale.reward),armor:armorBase+(.84-armorBase)*defense,resist:resistBase+(.84-resistBase)*defense,air:!!def.air,boss:!!def.boss,elite:!!def.elite,attackTimer:0,supportTimer:2,summons:0,phase:0,phaseTimer:5,phaseWarn:0,slowUntil:0,slowFactor:0,stunUntil:0,immuneUntil:0,vulnerableUntil:0,vulnerable:0,dots:[],blocker:null,blockTime:0,hurtAt:-99,attackAt:-99,...opts};
    Object.assign(e,{name:def.name,damage:opts.damage??def.damage,interval:def.interval,leak:def.leak,bossStatus:profile?'迎击首领 · 留意技能预告':'',moveMultiplier:1});
    this.enemies.push(e);this.event('spawn',{id:e.id,kind,...pos(e),route,boss:e.boss,bossId:e.bossId,portal:opts.portal??(d===0&&!opts.summoned&&!opts.guardian)});
    if(e.boss&&!opts.noWarning){this.warning={id:e.id,name:def.name,remaining:2,original:2};this.accumulator=0;this.event('boss-warning',{kind,bossId:e.bossId,name:def.name});this.changed();}
    return e;
  }
  inArea(p,r,air=true){return this.enemies.filter(e=>live(e)&&(air||!e.air)&&distance(e,p)<=r);}
  targets(p,stats,priority='first'){
    const list=this.enemies.filter(e=>live(e)&&(stats.air||!e.air)&&distance(e,p)<=stats.range);
    list.sort((a,b)=>priority==='strong'?b.hp-a.hp:priority==='near'?distance(a,p)-distance(b,p):(this.map.routes[a.route].length-a.d)-(this.map.routes[b.route].length-b.d));
    return list;
  }
  target(p,stats,priority='first'){
    let best=null,score=Infinity;const range=stats.range*stats.range;
    for(const e of this.enemies){
      if(!live(e)||(!stats.air&&e.air))continue;
      const dx=e.x-p.x,dz=e.z-p.z,near=dx*dx+dz*dz;if(near>range)continue;
      const value=priority==='strong'?-e.hp:priority==='near'?near:this.map.routes[e.route].length-e.d;
      // Strict comparison preserves the stable order of the sorted API.
      if(value<score){score=value;best=e;}
    }return best;
  }
  slow(e,factor,duration){if(!live(e))return;factor=clamp(factor,0,e.boss?.32:.65);if(this.time>=e.slowUntil)e.slowFactor=factor;else e.slowFactor=Math.max(e.slowFactor,factor);e.slowUntil=Math.max(e.slowUntil,this.time+duration);}
  control(e,duration){
    if(!live(e)||this.time<e.immuneUntil)return false;
    const resistance=ENEMIES[e.kind].controlResist||0;duration=Math.min(e.boss?.45:1.8,duration*(1-resistance));
    e.stunUntil=this.time+duration;e.immuneUntil=e.stunUntil+2.2;this.event('status',{...pos(e),kind:'frost',id:e.id});return true;
  }
  dot(e,source,damage,duration){const old=e.dots.find(d=>d.source===source);if(old){old.damage=damage;old.until=this.time+duration;}else e.dots.push({source,damage,until:this.time+duration,timer:.5});}
  damage(e,amount,type='physical',opts={}) {
    if(!live(e)||!Number.isFinite(amount)||amount<=0)return {hp:0,shield:0};
    let armor=type==='physical'?e.armor*(1-(opts.penetration||0)):e.resist;
    if(type==='physical'&&e.weakenUntil>this.time)armor*=.8;
    if(type==='magic'&&opts.magicPierce)armor*=1-opts.magicPierce;
    let value=amount*(type==='true'?1:1-clamp(armor||0,0,.85));
    if(e.vulnerableUntil>this.time)value*=1+e.vulnerable;
    if(e.kind==='iceking'){value*=e.weakUntil>this.time?1.55:.72;}
    if(e.kind==='ashlord'&&e.phase===2)value*=1.3;
    const bypass=e.bossId&&bossProfile(e.bossId).mechanic==='bulwark'&&type==='magic'?value*.35:0;
    const shield=Math.min(e.shield,value-bypass);e.shield-=shield;value-=shield;
    const hp=Math.min(e.hp,value);e.hp=Math.max(0,e.hp-hp);e.hurtAt=this.time;
    this.event('hit',{id:e.id,...pos(e),hp,shield,kind:type,air:e.air});
    if(e.hp<=0)this.kill(e);
    return {hp,shield};
  }
  kill(e){
    if(!e.alive)return false;e.alive=false;e.blocker=null;
    this.gold=Math.min(1e7,this.gold+e.reward);this.score=Math.min(1e9,this.score+Math.round(e.maxHp*.6)+e.reward);this.kills++;
    this.event('death',{id:e.id,kind:e.kind,...pos(e),boss:e.boss});
    if(ENEMIES[e.kind].split)for(let i=0;i<2;i++)this.spawn('grub',e.route,Math.max(0,e.d-i*.65),{summoned:true});
    this.changed();return true;
  }
  heal(f,amount){if(!live(f))return;const v=Math.min(f.maxHp-f.hp,amount);f.hp+=v;if(v>=15)this.event('heal',{id:f.id,...pos(f),hp:v});}
  hurtFriend(f,amount){
    if(!live(f))return;let n=amount*(1-(f.armor||0));const shield=Math.min(n,f.shield);f.shield-=shield;n-=shield;
    const hp=Math.min(n,f.hp);f.hp-=hp;f.hurtAt=this.time;this.event('friendly-hit',{id:f.id,...pos(f),hp,shield});
    if(f.hp<=0){f.alive=false;f.path=[];f.respawn=f===this.hero?12:7;this.releaseBlocks(f.id);this.event('friendly-death',{id:f.id,...pos(f),hero:f===this.hero});this.changed();}
  }
  launch(actor,target,stats,kind,extra={}){
    const speed=kind==='cannon'?13:kind==='ballista'?24:kind==='arrow'?23:kind==='melee'?Infinity:17;
    const duration=kind==='melee'?.12:clamp(distance(actor,target)/speed,.04,1.6);
    const p={id:++this.serial,kind,source:actor.id,target:target.id,targetRef:target,from:pos(actor),to:pos(target),duration,elapsed:0,stats:{...stats},...extra};
    this.projectiles.push(p);actor.attackAt=this.time;actor.angle=Math.atan2(target.x-actor.x,target.z-actor.z);
    this.event('attack',{id:p.id,source:actor.id,kind,...pos(actor),to:pos(target)});
  }
  hitProjectile(p){
    if(p.obstacle){
      const o=p.targetRef||this.scenery.find(o=>o.id===p.target);
      if(p.kind==='cannon'){
        const center=o||p.to;for(const a of this.scenery)if(a.alive&&distance(a,center)<p.stats.splash)this.damageObstacle(a,p.stats.damage);
        for(const e of this.inArea(center,p.stats.splash,false))this.damage(e,p.stats.damage,'physical',{penetration:p.stats.penetration});
        this.event('explosion',{...pos(center),kind:'fire',radius:p.stats.splash});
      }else {if(o?.alive)this.event('impact',{...pos(o),kind:p.kind,y:.9,source:p.source});this.damageObstacle(o,p.stats.damage);}
      return;
    }
    const e=p.targetRef||this.enemies.find(e=>e.id===p.target),s=p.stats;
    if(p.kind==='cannon'){
      const center=e&&live(e)?e:p.to;
      for(const n of this.inArea(center,s.splash,false)){this.damage(n,s.damage,'physical',{penetration:s.penetration});if(s.spec==='quake')this.control(n,.5);}
      this.event('explosion',{...pos(center),radius:s.splash,kind:'fire'});
      if(s.spec==='fire')this.zone(center,s.splash,5,18,'fire',p.source,{groundOnly:true});return;
    }
    if(!e||!live(e))return;
    this.event('impact',{...pos(e),kind:p.kind,y:e.air?2.2:e.boss?2.1:.95,source:p.source,target:e.id,angle:p.from?Math.atan2(e.x-p.from.x,e.z-p.from.z):0});
    let damage=s.damage;
    if(s.spec==='hunter'&&(e.boss||e.elite||e.air))damage*=1.7;
    if(s.spec==='overload')damage*=2;
    if(s.spec==='shatter'&&e.slowUntil>this.time)damage*=1.9;
    this.damage(e,damage,s.type,{penetration:s.penetration,magicPierce:s.spec==='void'?.7:0});
    if(s.spec==='pierce'){const n=this.enemies.find(n=>live(n)&&n.id!==e.id&&n.route===e.route&&Math.abs(n.d-e.d)<3.2);if(n)this.damage(n,damage*.7,s.type);}
    if(s.spec==='resonance'||p.heroSplash){for(const n of this.inArea(e,p.heroSplash?1.6:1.9))if(n!==e)this.damage(n,damage*(p.heroSplash?.45:.55),s.type);}
    if(!live(e))return;
    if(p.kind==='frost'){this.slow(e,s.spec==='blizzard'?.55:.38,2.2);if(s.spec==='blizzard')for(const n of this.inArea(e,2)){this.slow(n,.55,2.2);if(n!==e)this.damage(n,damage*.5,'magic');}if(s.spec==='shatter'&&p.count%3===0)this.control(e,.55);}
    if(p.kind==='nature'){this.dot(e,p.source,13*(s.spec==='venom'?2:1)*(s.level||1),5);e.vulnerable=s.spec==='blessing'?.3:.15;e.vulnerableUntil=this.time+5;if(s.spec==='venom')e.weakenUntil=this.time+5;}
    if(s.spec==='breaker'&&!e.air){e.d=Math.max(0,e.d-.75);Object.assign(e,this.map.routes[e.route].at(e.d));}
  }
  lightning(t,target,s){
    const visited=new Set(),targets=[];let current=target,prev=t;
    for(let i=0;i<s.chains&&current;i++){
      visited.add(current.id);targets.push({...pos(current),y:current.air?2.2:current.boss?2.1:.95});this.event('impact',{...pos(current),kind:'thunder',y:current.air?2.2:current.boss?2.1:.95,target:current.id});this.damage(current,s.damage*Math.pow(.82,i)*(s.spec==='overload'?2:1),'magic');
      prev=current;current=null;let nearest=(s.spec==='network'?4.8:3.3)**2;
      for(const e of this.enemies){if(!live(e)||visited.has(e.id))continue;const dx=e.x-prev.x,dz=e.z-prev.z,d=dx*dx+dz*dz;if(d<nearest){nearest=d;current=e;}}
    }
    t.attackAt=this.time;t.angle=Math.atan2(target.x-t.x,target.z-t.z);this.event('lightning',{...pos(t),points:targets});
  }
  advance(dt){
    if(this.mode!=='battle'||this.paused)return;
    dt=clamp(dt,0,.25);
    if(this.warning){this.warning.remaining=Math.max(0,this.warning.remaining-dt);if(this.warning.remaining===0){this.warning=null;this.changed();this.event('boss-ready');}return;}
    this.accumulator=Math.min(.6,this.accumulator+dt*this.speed);
    while(this.accumulator+1e-10>=STEP&&this.mode==='battle'&&!this.warning&&!this.paused){this.step(STEP);this.accumulator=Math.max(0,this.accumulator-STEP);}
  }
  step(dt){
    if(this.mode!=='battle'||this.paused||this.warning)return;
    this.time+=dt;
    if(this.waveActive){this.waveTime+=dt;
      while(this.queue.length&&this.queue[0].at<=this.waveTime){const p=this.queue.shift();this.spawn(p.kind,p.route,0,{...(p.bossId?{bossId:p.bossId}:{})});if(this.warning)return;}
    }else this.intermission+=dt;
    this.updateFriends(dt);this.updateEnemies(dt);this.updateTowers(dt);
    for(const p of this.projectiles){p.elapsed+=dt;const e=p.obstacle?null:p.targetRef||this.enemies.find(e=>e.id===p.target);if(e&&live(e)){p.to.x=e.x;p.to.z=e.z;}if(p.elapsed>=p.duration&&!p.done){p.done=true;this.hitProjectile(p);}}
    this.projectiles=this.projectiles.filter(p=>!p.done);
    for(const z of this.zones){z.left-=dt;z.timer-=dt;
      if(z.timer<=0){z.timer+=z.interval||.5;for(const e of this.inArea(z,z.radius,!z.groundOnly)){this.damage(e,z.damage*(z.interval||.5),z.type||'magic');if(z.slow)this.slow(e,z.slow,1.1);}}
    }
    this.zones=this.zones.filter(z=>z.left>0);
    this.enemies=this.enemies.filter(e=>e.alive);
    this.guards=this.guards.filter(g=>g.expires>this.time);
    if(this.lives<=0){this.finish(false);return;}
    if(this.waveActive&&this.queue.length===0&&this.enemies.length===0){
      this.waveActive=false;const previousGold=this.gold;this.gold=Math.min(1e7,this.gold+65+Math.min(20,this.wave)*10);this.intermission=0;this.event('wave-clear',{wave:this.wave,reward:this.gold-previousGold});this.heal(this.hero,100);this.changed();
      if(!this.map.endless&&this.wave===this.map.waveCount){this.finish(true);return;}
      if(this.map.endless)this.store.record(this.map.id,this.wave,this.score);
      // The clear event grants supplies; the next wave starts in this same step.
      this.beginWave(true);
    }
  }
  updateFriends(dt){
    const h=this.hero,d=HEROES[h.kind];h.cooldowns=h.cooldowns.map(n=>Math.max(0,n-dt));
    for(const f of [h,...this.guards]){
      if(f.expires<=this.time){this.releaseBlocks(f.id);continue;}
      if(!live(f)){f.respawn-=dt;if(f.respawn<=0){f.alive=true;f.hp=f.maxHp;f.shield=0;const start=f===h?this.map.routes[0].at(this.map.routes[0].length*.72):this.towers.find(t=>t.id===f.tower);if(start){f.x=start.x;f.z=start.z;f.path=navigate(f,f.anchor,this.obstacles().filter(o=>distance(o,f)>.5))||[];}this.event('revive',{...pos(f),id:f.id});this.changed();}continue;}
      if(this.time>f.shieldUntil)f.shield=0;
      if(f===h&&h.kind==='knight')this.heal(f,4*dt);
      if(f===h&&h.kind==='druid')for(const n of [h,...this.guards].filter(live))if(distance(n,h)<4.8)this.heal(n,7*dt);
      f.attackTimer-=dt;
      if(f.path.length){
        this.releaseBlocks(f.id);const point=f.path[0],speed=f===h?d.speed:f.speed,dist=distance(f,point),n=speed*dt;
        f.angle=Math.atan2(point.x-f.x,point.z-f.z);
        if(dist<=n){f.x=point.x;f.z=point.z;f.path.shift();}else{f.x+=(point.x-f.x)/dist*n;f.z+=(point.z-f.z)/dist*n;}
        continue;
      }
      if(f.attackTimer>0)continue;
      const stats=f===h?d:f,priority=f===h?'near':this.towers.find(t=>t.id===f.tower)?.priority||'near',target=this.target(f,stats,priority);
      if(target&&f.attackTimer<=0){
        f.attackTimer+=stats.interval||.95;
        let damage=stats.damage;
        if(f===h){h.attackCount++;if(h.kind==='ranger'&&h.attackCount%3===0)damage*=1.8;}
        this.launch(f,target,{...stats,damage},stats.range>2?(f===h?(h.kind==='ranger'?'arrow':h.kind==='druid'?'nature':'arcane'):'arrow'):'melee',{heroSplash:f===h&&h.kind==='mage'});
      }
    }
  }
  updateEnemies(dt){
    const friends=[this.hero,...this.guards].filter(f=>live(f)&&(f.expires==null||f.expires>this.time));
    for(const e of [...this.enemies]){
      if(!live(e))continue;const def=ENEMIES[e.kind];
      for(const dot of e.dots){dot.timer-=dt;if(dot.until>this.time&&dot.timer<=0){dot.timer+=.5;this.damage(e,dot.damage*.5,'magic');}}
      e.dots=e.dots.filter(d=>d.until>this.time);if(!live(e))continue;
      e.supportTimer-=dt;e.attackTimer-=dt;
      if(e.supportTimer<=0){
        e.supportTimer=def.aura?5:3;
        if(!e.bossId&&def.heal)for(const ally of this.enemies.filter(live))if(distance(e,ally)<4)this.heal(ally,Math.min(ally.maxHp*.12,65));
        if(!e.bossId&&def.aura)for(const ally of this.enemies.filter(live))if(distance(e,ally)<3.8)ally.shield=Math.min(100,ally.shield+40);
        if(!e.bossId&&def.summon&&e.summons<3){e.supportTimer=7;e.summons++;for(let i=0;i<2;i++)this.spawn('imp',e.route,Math.max(0,e.d-i*.8),{summoned:true});}
      }
      if(e.boss)this.updateBoss(e,dt);
      if(e.stunUntil>this.time)continue;
      let blocker=friends.find(f=>f.id===e.blocker&&live(f)&&!f.path.length&&distance(e,f)<2.15);
      if(e.air)blocker=null;
      const h=this.hero;
      if(!e.air&&h.kind==='knight'&&live(h)&&h.tauntUntil>this.time&&!h.path.length&&distance(e,h)<1.65&&this.enemies.filter(n=>live(n)&&n.blocker===h.id&&n.id!==e.id).length<2)blocker=h;
      if(!blocker&&!e.air&&(!e.breakUntil||e.breakUntil<=this.time)){
        blocker=friends.find(f=>{
          if(f.path.length||distance(f,e)>1.25)return false;
          const capacity=f===this.hero?(f.kind==='knight'?2:0):f.capacity;
          return capacity>0&&this.enemies.filter(n=>live(n)&&n.blocker===f.id).length<capacity;
        });
      }
      if(blocker){
        e.blocker=blocker.id;e.blockTime+=dt;
        if(e.attackTimer<=0){e.attackTimer=e.interval;e.attackAt=this.time;this.hurtFriend(blocker,e.damage*(e.elite&&e.hp<e.maxHp*.5?1.35:1));this.event('enemy-attack',{...pos(e),to:pos(blocker)});}
        // Even with an immortal shield build, every enemy eventually breaks a block.
        if(e.blockTime<14)continue;e.blocker=null;e.blockTime=0;e.breakUntil=this.time+3;
      }else{e.blocker=null;e.blockTime=0;}
      const slow=e.slowUntil>this.time?1-e.slowFactor:1,rage=e.elite&&e.hp<e.maxHp*.5?1.2:1;
      e.d+=e.speed*slow*rage*(e.moveMultiplier??1)*(e.windUntil>this.time?1.15:1)*dt;const r=this.map.routes[e.route];Object.assign(e,r.at(e.d));
      if(e.d>=r.length){e.alive=false;e.blocker=null;this.lives=Math.max(0,this.lives-e.leak);this.leaked+=e.leak;this.lastBreach={kind:e.kind,route:e.route,...pos(e)};this.event('leak',{...this.lastBreach,amount:e.leak});this.changed();}
    }
  }
  updateBoss(e,dt){
    if(e.bossId){updateCampaignBoss(this,e,dt);return;}
    if(e.kind==='treant'){
      const phase=e.hp/e.maxHp<.35?2:e.hp/e.maxHp<.7?1:0;
      if(phase>e.phase){e.phase=phase;for(let i=0;i<3;i++)this.spawn('raider',e.route,Math.max(0,e.d-1.2-i*.8),{guardian:e.id});this.event('boss-phase',{text:'腐冠古树：护卫出现！清理护卫以切断恢复。',kind:e.kind});}
      if(this.enemies.some(n=>live(n)&&n.guardian===e.id))this.heal(e,Math.min(18,e.maxHp*.003)*dt);
    }
    if(e.kind==='iceking'){
      e.phaseTimer-=dt;
      if(e.phaseTimer<=0){e.phaseTimer=12;e.phaseWarn=this.time+1.5;this.event('boss-phase',{text:'霜岩暴君：冰封将至 · 1.5 秒后冻结附近塔',kind:e.kind});}
      if(e.phaseWarn&&this.time>=e.phaseWarn){e.phaseWarn=0;for(const t of this.towers)if(distance(t,e)<6)t.frozenUntil=this.time+3;e.weakUntil=this.time+6;this.event('skill',{...pos(e),kind:'stasis',radius:6});this.event('boss-phase',{text:'冰甲碎裂！接下来 6 秒是爆发窗口。',kind:e.kind});}
      e.phase=e.weakUntil>this.time?1:0;
    }
    if(e.kind==='ashlord'){
      const phase=e.hp/e.maxHp<.32?2:e.hp/e.maxHp<.68?1:0;
      if(phase>e.phase){e.phase=phase;e.phaseWarn=this.time+1.6;this.event('boss-phase',{text:phase===2?'无冕王：最终阶段！伤害窗口打开，东路增援将至。':'无冕王：第二军团 · 1.6 秒后从另一入口增援',kind:e.kind});}
      if(e.phaseWarn&&this.time>=e.phaseWarn){e.phaseWarn=0;const route=(e.route+1)%this.map.routes.length;for(let i=0;i<4;i++)this.spawn(i%2?'elite':'harpy',route,i*.6);}
    }
  }
  updateTowers(dt){
    for(const t of this.towers){
      if(t.frozenUntil>this.time)continue;
      if(t.kind==='barracks')continue;
      let cache=towerCombatCache.get(t);
      if(!cache||cache.kind!==t.kind||cache.level!==t.level||cache.branch!==t.spec){cache={kind:t.kind,level:t.level,branch:t.spec,value:{...towerStats(t),level:t.level}};towerCombatCache.set(t,cache);}
      const s=cache.value;t.attackTimer-=dt;
      if(t.kind==='nature'&&s.spec==='blessing')for(const f of [this.hero,...this.guards].filter(live))if(distance(f,t)<s.range)this.heal(f,9*dt);
      if(t.attackTimer>0)continue;
      const obstacle=this.clearTarget==null?null:this.scenery.find(o=>o.id===this.clearTarget&&o.alive&&distance(t,o)<=s.range);
      const e=obstacle||this.target(t,s,t.priority);if(!e)continue;
      t.attackTimer+=s.interval;t.attackCount++;
      if(t.kind==='thunder'){
        if(obstacle){this.damageObstacle(obstacle,s.damage*(s.spec==='overload'?2:1));t.attackAt=this.time;t.angle=Math.atan2(e.x-t.x,e.z-t.z);this.event('lightning',{...pos(t),points:[pos(e)]});}else this.lightning(t,e,s);
      }else{
        this.launch(t,e,s,t.kind,{count:t.attackCount,obstacle:!!obstacle});
        if(s.spec==='rapid'&&t.attackCount%4===0)this.launch(t,e,{...s,damage:s.damage*.8},t.kind,{obstacle:!!obstacle});
      }
    }
  }
  finish(win){
    if(this.mode!=='battle')return;this.mode=win?'victory':'defeat';this.waveActive=false;this.warning=null;this.targeting=null;this.paused=false;
    const stars=win?(this.lives===20?3:this.lives>=14?2:1):0;
    this.result={win,stars,lives:this.lives,wave:this.wave,completedWave:win?this.wave:Math.max(0,this.wave-1),score:Math.round(this.score),kills:this.kills,time:this.time,campaignClear:win&&this.map.id===12};
    if(win&&!this.map.endless)this.store.victory(this.map.id,stars);
    if(this.map.endless)this.store.record(this.map.id,this.result.completedWave,this.score);
    this.event(win?'victory':'defeat',{...this.result});this.changed();
  }
  snapshot(){return {mode:this.mode,map:this.map?.id,time:this.time,wave:this.wave,waveActive:this.waveActive,gold:this.gold,lives:this.lives,kills:this.kills,score:this.score,enemies:this.enemies.length,guards:this.guards.length,cleared:this.cleared,clearTarget:this.clearTarget,obstacles:this.scenery.filter(o=>o.alive).length,cells:this.cells.length,towers:this.towers.map(t=>({id:t.id,kind:t.kind,site:t.site,x:t.x,z:t.z,level:t.level,spec:t.spec})),hero:this.hero?{kind:this.hero.kind,hp:this.hero.hp,alive:this.hero.alive,respawn:this.hero.respawn,cooldowns:[...this.hero.cooldowns],x:this.hero.x,z:this.hero.z}:null,warning:this.warning,paused:this.paused,result:this.result};}
}
