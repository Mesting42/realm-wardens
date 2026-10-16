import {bossProfile} from './campaign.js';
import {distance} from './routes.js';

const alive=e=>e.alive&&e.hp>0;
export function updateCampaignBoss(game,e,dt){
  const b=bossProfile(e.bossId),hp=e.hp/e.maxHp,now=game.time;
  const say=text=>game.event('boss-phase',{kind:e.kind,bossId:b.id,text:`${b.name}：${text}`});
  const weak=(seconds,amount=.3)=>{e.vulnerableUntil=now+seconds;e.vulnerable=amount;e.bossStatus=`破绽 · ${seconds} 秒爆发窗口`;};
  const warn=(text,seconds=1.5)=>{e.phaseWarn=now+seconds;e.bossStatus='蓄力 · 即将发动';say(text);};
  const summon=(kind,count,route=e.route)=>{for(let i=0;i<count;i++)game.spawn(kind,route,route===e.route?Math.max(0,e.d-1-i*.8):0,{guardian:e.id,summoned:route===e.route,portal:route!==e.route});};
  e.phaseTimer-=dt;e.moveMultiplier=1;
  if(b.mechanic==='roots'){
    const phase=hp<.35?2:hp<.7?1:0;
    if(phase>e.phase){e.phase=phase;summon('raider',2);say('根系护卫出现！清理护卫，切断恢复。');}
    const guardians=game.enemies.some(n=>alive(n)&&n.guardian===e.id);
    e.bossStatus=guardians?'护卫存活 · 缓慢恢复':'护卫已清 · 集中火力';if(guardians)game.heal(e,Math.min(12,e.maxHp*.002)*dt);return;
  }
  if(b.mechanic==='bulwark'&&hp<.55&&e.phase===0){e.phase=1;e.shield+=150;e.bossStatus='铁枝护盾 · 魔法部分穿透';say('举盾！用魔法击穿护盾。');}
  if(b.mechanic==='bulwark'){if(e.phase===1&&e.shield<=0){e.phase=2;weak(6);say('护盾击破！6 秒易伤。');}return;}
  if(b.mechanic==='rage'){
    if(hp<.5&&e.phase===0){e.phase=1;warn('1.5 秒后狂奔，随后会疲惫。');}
    if(e.phaseWarn&&now>=e.phaseWarn){e.phaseWarn=0;e.rushUntil=now+3;e.bossStatus='狂奔 · 减速或阻挡';say('狂奔 3 秒！');}
    if(e.rushUntil>now)e.moveMultiplier=1.25;
    else if(e.rushUntil&&e.phase===1){e.phase=2;weak(6);say('狂奔结束！6 秒易伤。');}return;
  }
  if(b.mechanic==='pack'||b.mechanic==='rift'||b.mechanic==='legions'){
    const thresholds=b.mechanic==='pack'?[.65,.3]:b.mechanic==='rift'?[.55,.25]:[.68,.32];
    const phase=hp<thresholds[1]?2:hp<thresholds[0]?1:0;
    // Resolve a pending wave before arming the next threshold; a burst of damage
    // cannot overwrite the warning and silently skip a reinforcement phase.
    if(e.phaseWarn&&now>=e.phaseWarn){
      e.phaseWarn=0;const route=game.map.routes.length>1?(e.route+1+(e.phase-1)%(game.map.routes.length-1))%game.map.routes.length:e.route;
      if(b.mechanic==='pack')summon('wolf',2,route);
      if(b.mechanic==='rift'){summon('raider',1,route);summon('bat',1,route);}
      if(b.mechanic==='legions'){summon(e.phase===2?'elite':'raider',1,route);summon(e.phase===2?'harpy':'bat',1,route);}
      weak(5);say('增援已到，首领露出破绽！');
    }
    if(phase>e.phase&&!e.phaseWarn){e.phase++;warn('1.5 秒后从另一条路线召来两名增援。');}
    return;
  }
  if(b.mechanic==='crystal'){
    if(hp<.55&&e.phase===0){e.phase=1;e.shield+=180;warn('冰盾凝结，3 秒后碎裂。',3);}
    if(e.phaseWarn&&now>=e.phaseWarn){e.phaseWarn=0;e.shield=0;e.phase=2;weak(7,.4);game.event('skill',{x:e.x,z:e.z,kind:'stasis',radius:2});say('冰盾碎裂！7 秒易伤。');}return;
  }
  if(b.mechanic==='gust'||b.mechanic==='aegis'||b.mechanic==='winter'||b.mechanic==='siege'||b.mechanic==='cleave'){
    if(e.phaseTimer<=0&&!e.phaseWarn&&(b.mechanic!=='cleave'||hp<.5)){
      e.phaseTimer=b.mechanic==='winter'?14:12;
      warn({gust:'1.5 秒后掀起顺风，随后会疲惫。',aegis:'1.5 秒后为附近护卫施加护盾。',winter:'1.5 秒后冻结最近两座塔，随后冰甲碎裂。',siege:'1.5 秒后冲撞，随后停顿并易伤。',cleave:'1.5 秒后重击近身守卫，随后露出破绽。'}[b.mechanic]);
    }
    if(e.phaseWarn&&now>=e.phaseWarn){
      e.phaseWarn=0;e.phase++;e.phaseTimer=12;
      if(b.mechanic==='gust'){for(const n of game.enemies.filter(n=>alive(n)&&n!==e&&n.air&&distance(n,e)<4)){n.windUntil=now+2.5;}e.rushUntil=now+2.5;e.bossStatus='顺风 · 空中敌军短暂加速';}
      if(b.mechanic==='aegis'){for(const n of game.enemies.filter(n=>alive(n)&&n!==e&&distance(n,e)<4))n.shield=Math.min(120,n.shield+65);weak(5);}
      if(b.mechanic==='winter'){const towers=game.towers.filter(t=>distance(t,e)<6).sort((a,b)=>distance(a,e)-distance(b,e)).slice(0,2);for(const t of towers)t.frozenUntil=now+2;e.weakUntil=now+6;e.bossStatus='碎甲 · 6 秒爆发窗口';game.event('skill',{x:e.x,z:e.z,kind:'stasis',radius:6});say('冰甲碎裂！6 秒爆发窗口。');}
      if(b.mechanic==='siege'){e.rushUntil=now+3;e.bossStatus='冲撞 · 减速争取时间';}
      if(b.mechanic==='cleave'){for(const f of [game.hero,...game.guards])if(alive(f)&&distance(f,e)<2.5)game.hurtFriend(f,65);weak(5,.4);game.event('skill',{x:e.x,z:e.z,kind:'sun',radius:2.5});say('重击结束！5 秒易伤。');}
    }
    if((b.mechanic==='gust'||b.mechanic==='siege')&&e.rushUntil){
      if(e.rushUntil>now)e.moveMultiplier=b.mechanic==='siege'?1.25:1.15;
      else{e.rushUntil=0;if(b.mechanic==='siege')e.restUntil=now+1.5;weak(5);say('疲惫！5 秒易伤。');}
    }
    if(e.restUntil>now)e.moveMultiplier=0;
    if(b.mechanic==='winter'&&!e.phaseWarn&&!(e.weakUntil>now))e.bossStatus='冰甲 · 减伤阶段';
  }
  if(e.vulnerableUntil<=now&&!e.phaseWarn&&!(e.rushUntil>now)&&b.mechanic!=='winter')e.bossStatus='迎击首领 · 准备下一次技能';
}
