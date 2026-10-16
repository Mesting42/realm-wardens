// Authored campaign encounters. Endless keeps its independent growth rules.
// Each row is a wave, each pair a small squad; the schedule separates lanes.
const squad = (...pairs) => pairs;
export const CAMPAIGN_WAVES = [
  [squad(['imp',4],['wolf',4]), squad(['imp',6],['wolf',4]), squad(['imp',5],['raider',3],['wolf',4]), squad(['raider',5],['imp',6],['wolf',3]), squad(['raider',5],['wolf',4],['imp',6])],
  [squad(['imp',6],['wolf',2]), squad(['imp',6],['wolf',4]), squad(['imp',6],['raider',4],['wolf',2]), squad(['raider',6],['wolf',4],['brood',2]), squad(['raider',6],['brood',3],['wolf',5])],
  [squad(['imp',4],['wolf',4]), squad(['wolf',5],['raider',3],['imp',2]), squad(['raider',5],['bat',3],['wolf',4]), squad(['raider',5],['shaman',1],['wolf',5],['bat',3]), squad(['raider',6],['shaman',2],['bat',5],['wolf',3]), squad(['raider',6],['bat',6],['shaman',2],['wolf',3])],
  [squad(['imp',6],['wolf',2]), squad(['imp',6],['raider',4]), squad(['raider',6],['brood',2],['imp',4]), squad(['raider',5],['shaman',1],['brood',3],['wolf',4]), squad(['armor',3],['raider',5],['shaman',2],['imp',6]), squad(['armor',4],['brood',3],['shaman',2],['raider',7]), squad(['armor',4],['raider',6],['shaman',2],['brood',3])],
  [squad(['imp',6],['wolf',2]), squad(['raider',6],['wolf',4]), squad(['armor',3],['raider',5],['wolf',4]), squad(['wisp',3],['raider',6],['wolf',5]), squad(['armor',5],['wisp',4],['raider',5],['wolf',2]), squad(['armor',5],['wisp',4],['raider',6])],
  [squad(['imp',6],['wolf',2]), squad(['raider',4],['wolf',6]), squad(['raider',6],['armor',2],['wolf',4]), squad(['armor',4],['bat',4],['wolf',6]), squad(['shield',2],['armor',4],['harpy',3],['wolf',5]), squad(['armor',4],['harpy',3],['shield',2],['wolf',6])],
  [squad(['imp',6],['wolf',2]), squad(['raider',6],['wolf',4]), squad(['raider',7],['shaman',1],['wolf',4]), squad(['shield',2],['raider',6],['bat',4],['shaman',2]), squad(['frostguard',2],['raider',6],['harpy',3],['shaman',2],['wolf',3]), squad(['frostguard',3],['shield',3],['harpy',4],['raider',6]), squad(['frostguard',3],['raider',6],['harpy',4],['shaman',2])],
  [squad(['imp',6],['wolf',2]), squad(['raider',6],['wolf',4]), squad(['armor',4],['raider',4],['wolf',4]), squad(['wisp',4],['raider',6],['bat',4]), squad(['shield',2],['armor',4],['harpy',3],['raider',5]), squad(['frostguard',3],['wisp',4],['raider',6],['harpy',3]), squad(['frostguard',4],['shield',3],['armor',5],['harpy',6]), squad(['armor',4],['wisp',4],['frostguard',3],['harpy',4])],
  [squad(['imp',6],['wolf',2]), squad(['raider',6],['wolf',4]), squad(['brood',3],['raider',5],['bat',4]), squad(['elite',2],['raider',6],['bat',4],['wolf',2]), squad(['siege',2],['brood',3],['raider',6],['bat',4]), squad(['warlock',2],['elite',3],['raider',5],['bat',5]), squad(['siege',2],['elite',3],['brood',3],['raider',6])],
  [squad(['imp',6],['wolf',2]), squad(['raider',6],['wolf',4]), squad(['raider',6],['armor',2],['bat',4]), squad(['shield',2],['elite',2],['raider',6],['bat',4]), squad(['elite',3],['harpy',3],['raider',7],['wolf',3]), squad(['siege',2],['warlock',2],['elite',3],['bat',5],['raider',4]), squad(['shield',2],['elite',3],['harpy',4],['raider',6])],
  [squad(['imp',6],['wolf',2]), squad(['raider',6],['wolf',4]), squad(['raider',6],['wisp',3],['wolf',3]), squad(['shaman',2],['raider',6],['armor',3],['bat',3]), squad(['warlock',2],['elite',2],['raider',6],['wolf',4]), squad(['siege',2],['wisp',4],['raider',6],['bat',4]), squad(['frostguard',3],['warlock',2],['elite',3],['raider',6],['wisp',4]), squad(['frostguard',3],['elite',3],['shaman',2],['raider',7])],
  [squad(['imp',6],['wolf',2]), squad(['raider',6],['wolf',4]), squad(['armor',3],['raider',5],['bat',4]), squad(['shield',2],['elite',2],['raider',6],['wolf',4]), squad(['warlock',2],['elite',2],['raider',6],['bat',5]), squad(['siege',2],['harpy',3],['raider',8],['wolf',3]), squad(['frostguard',3],['shield',2],['elite',3],['raider',5],['harpy',3]), squad(['siege',3],['warlock',2],['elite',4],['harpy',5],['raider',4]), squad(['frostguard',3],['elite',3],['shield',2],['harpy',4],['raider',4])]
];

// These are encounter profiles, not new asset IDs: reuse animated GLBs, with
// independently owned recolored materials and a crest in the model renderer.
export const BOSSES = [
  {id:'thornfang',kind:'wolf',name:'荆牙狼王',role:'溪谷首领',hp:720,speed:.86,armor:.08,resist:.05,damage:24,interval:1.6,reward:35,height:2.05,tint:'#d2bd78',crest:'#dfb95c',mechanic:'rage',desc:'半血时预告狂奔；短暂加速后疲惫并易伤。用寒冰塔与圣盾稳住它。'},
  {id:'ironbranch',kind:'raider',name:'铁枝督军',role:'交汇首领',hp:1050,speed:.80,armor:.22,resist:.06,damage:32,interval:1.5,reward:42,height:2.55,tint:'#ccb688',crest:'#dea74d',mechanic:'bulwark',desc:'半血时举起一次性护盾；魔法能穿透部分护盾，破盾后获得易伤窗口。'},
  {id:'galequeen',kind:'harpy',name:'风羽女王',role:'林冠首领 · 空中',hp:1200,speed:.95,armor:.1,resist:.12,damage:0,interval:1.5,reward:48,height:2.2,tint:'#b19be0',crest:'#ebc67d',mechanic:'gust',desc:'预告后掀起顺风，短暂加速附近飞行敌军；疲惫时易伤。保留对空火力。'},
  {id:'rootcrown',kind:'treant',name:'腐冠古树',role:'林地领主',hp:2300,speed:.57,armor:.24,resist:.15,damage:56,interval:1.8,reward:85,height:4.4,tint:'#a9cba1',crest:'#d4bd65',mechanic:'roots',desc:'70% 与 35% 生命时各召唤两名护卫；护卫存活时缓慢恢复，清理护卫切断恢复。'},
  {id:'rimecaptain',kind:'armor',name:'玄冰哨长',role:'隘口首领',hp:1850,speed:.75,armor:.42,resist:.08,damage:44,interval:1.7,reward:64,height:2.7,tint:'#96d5e3',crest:'#74d8ff',mechanic:'crystal',desc:'半血时生成冰盾；预告后冰盾碎裂并暴露弱点。魔法塔可以击穿重甲。'},
  {id:'twinfang',kind:'wolf',name:'霜牙双影',role:'冰桥首领',hp:2100,speed:.92,armor:.12,resist:.14,damage:42,interval:1.5,reward:70,height:2.35,tint:'#b0dbe9',crest:'#9ce9ff',mechanic:'pack',desc:'两次预告后在另一条岔路召唤两头普通狼；两条防线都需要对地火力。'},
  {id:'crystalmarshal',kind:'frostguard',name:'晶甲督军',role:'堡垒首领',hp:2700,speed:.72,armor:.34,resist:.2,damage:58,interval:1.7,reward:80,height:3.0,tint:'#9fbce4',crest:'#89b5ff',mechanic:'aegis',desc:'预告后为周围护卫施加有限护盾；施法结束时自身易伤，适合集中技能。'},
  {id:'winterking',kind:'iceking',name:'霜岩暴君',role:'冰原领主',hp:3900,speed:.52,armor:.4,resist:.2,damage:70,interval:1.7,reward:115,height:4.3,tint:'#b5e1ee',crest:'#a9efff',mechanic:'winter',desc:'冰甲减伤；提前 1.5 秒预告，冻结最近两座塔 2 秒，随后出现 6 秒碎甲窗口。'},
  {id:'forgebeast',kind:'siege',name:'熔铁破门者',role:'城门首领',hp:3500,speed:.67,armor:.35,resist:.12,damage:62,interval:1.8,reward:100,height:3.15,tint:'#dea16f',crest:'#ffae52',mechanic:'siege',desc:'蓄力冲撞后加速 3 秒，随后停顿并暴露弱点。控制与穿甲重弩能创造输出时间。'},
  {id:'obsidianweaver',kind:'warlock',name:'黑曜织门者',role:'回廊首领',hp:3900,speed:.69,armor:.16,resist:.34,damage:54,interval:1.7,reward:110,height:3.1,tint:'#b5a0df',crest:'#cda4ff',mechanic:'rift',desc:'半血与四分之一生命时预告跨门增援，每次两名轻兵；召唤后自身易伤。'},
  {id:'courtexecutioner',kind:'elite',name:'王庭执刑者',role:'王庭首领',hp:4500,speed:.68,armor:.28,resist:.2,damage:68,interval:1.7,reward:125,height:3.2,tint:'#d69992',crest:'#ff897b',mechanic:'cleave',desc:'半血后预告重击，击伤近身守卫；挥击后的 5 秒易伤窗口适合爆发技能。'},
  {id:'ashking',kind:'ashlord',name:'灰烬无冕王',role:'最终领主',hp:5200,speed:.55,armor:.3,resist:.24,damage:86,interval:1.6,reward:160,height:4.65,tint:'#e9b495',crest:'#ffaf62',mechanic:'legions',desc:'三阶段进攻；每次预告另一入口的两名增援，最终阶段全伤害提升。混合伤害与对空火力缺一不可。'}
];
export const bossProfile = id => BOSSES.find(b => b.id === id);

export function activeRoutes(map,wave=1){
  if(map.endless)return map.routes.map((_,i)=>i);
  const count=map.routes.length===3?(wave>= (map.id===12?6:5)?3:wave>=3?2:1):map.routes.length===2?(wave>=3?2:1):1;
  return Array.from({length:count},(_,i)=>i);
}
export function campaignBrief(map){
  if(map.endless)return '';
  const lanes=map.routes.length===3?`第 3 波增加第二路，第 ${map.id===12?6:5} 波增加第三路`:map.routes.length===2?'第 3 波增加第二路':'先轻兵，后逐步加入重兵与支援';
  return `200 金币 · 开场单路侦察 · ${lanes} · 末波首领：${bossProfile(map.bossId).name}`;
}
export function campaignPlan(map,wave){
  const squads=CAMPAIGN_WAVES[map.id-1]?.[wave-1];if(!squads)return [];
  const lanes=activeRoutes(map,wave),plan=[];let at=0,index=0,lastLane=0;
  const gap=wave===1?1.85:wave===2?1.65:Math.max(1.12,1.65-wave*.065);
  for(const [kind,count]of squads)for(let i=0;i<count;i++){
    // Three-unit packets avoid simultaneous multi-portal bursts. The shortest
    // eastern lane is only introduced once the player has several wave incomes.
    const lane=lanes[Math.floor(index/3)%lanes.length];if(lane!==lastLane)at+=2.2;
    plan.push({kind,route:lane,at});at+=gap;lastLane=lane;index++;
  }
  if(wave===map.waveCount){const b=bossProfile(map.bossId);plan.push({kind:b.kind,route:0,at:at+2.5,bossId:b.id});}
  return plan;
}
