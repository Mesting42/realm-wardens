import { makeRoute } from './routes.js';
import { CAMPAIGN_WAVES, BOSSES, campaignPlan, campaignBrief } from './campaign.js';
export { BOSSES, bossProfile, activeRoutes, campaignBrief } from './campaign.js';

export const REGIONS = [
  { id: 'forest', name: '翡翠林地', en: 'THE EMERALD WILD', tagline: '古树苏醒，边境的第一道防线。', ground: '#789b55', road: '#d6c4a0', edge: '#7c7158', foliage: ['#306d50', '#528346', '#87a955'], sky: '#b6ced1', accent: '#70b68a' },
  { id: 'frost', name: '霜岩边境', en: 'THE FROSTBOUND REACH', tagline: '穿过雪与石，守住北境的誓言。', ground: '#d3e1dc', road: '#a4b9b8', edge: '#637f89', foliage: ['#426871', '#6c9296', '#d7e7e5'], sky: '#b8cedd', accent: '#85ccdb' },
  { id: 'ash', name: '灰烬王庭', en: 'THE ASHEN CROWN', tagline: '旧王已坠，最后的火仍在燃烧。', ground: '#776b66', road: '#b6a18b', edge: '#433f43', foliage: ['#554952', '#715c56', '#b27c58'], sky: '#c6aba0', accent: '#e89c63' }
];

export const TOWERS = {
  arrow: { name: '箭塔', en: 'RANGER', role: '轻甲 · 对空', color: '#6d9e62', cost: 80, upgrades: [90, 145], range: 5.4, interval: .55, damage: 18, type: 'physical', air: true, desc: '迅速射出实体箭矢。适合轻型敌人和飞行单位。', specs: [
    { name: '疾风连射', cost: 175, desc: '攻速提高 65%，每第四箭双重射击。', mode: 'rapid' },
    { name: '穿林游侠', cost: 175, desc: '射程 +2，穿透同路线上的第二个敌人。', mode: 'pierce' }] },
  ballista: { name: '重弩塔', en: 'SIEGEBOW', role: '重甲 · 远射', color: '#ba9764', cost: 120, upgrades: [125, 185], range: 7.1, interval: 1.65, damage: 76, type: 'physical', air: true, penetration: .55, desc: '远距离重击，忽略目标 55% 的物理护甲。', specs: [
    { name: '破城弩', cost: 210, desc: '完全忽略护甲，额外击退地面目标。', mode: 'breaker' },
    { name: '猎龙弩', cost: 210, desc: '对精英、飞行和 Boss 造成 70% 额外伤害。', mode: 'hunter' }] },
  cannon: { name: '火炮塔', en: 'BOMBARD', role: '地面 · 群伤', color: '#d68c55', cost: 135, upgrades: [145, 200], range: 5.9, interval: 1.85, damage: 66, splash: 2.25, type: 'physical', air: false, desc: '抛射炮弹，爆炸覆盖地面敌群。无法攻击飞行单位。', specs: [
    { name: '燃烧弹', cost: 220, desc: '爆炸留下 5 秒火场，每秒造成 18 魔法伤害。', mode: 'fire' },
    { name: '震地炮', cost: 220, desc: '范围扩大 35%，震晕非 Boss 目标 0.5 秒。', mode: 'quake' }] },
  arcane: { name: '奥术塔', en: 'ARCANUM', role: '魔法 · 破甲', color: '#a894dc', cost: 110, upgrades: [120, 175], range: 5.6, interval: 1.05, damage: 43, type: 'magic', air: true, desc: '凝聚奥术能量，穿过物理护甲。提防魔法抗性。', specs: [
    { name: '虚空棱镜', cost: 200, desc: '忽略 70% 魔抗，伤害提高 25%。', mode: 'void' },
    { name: '星界共鸣', cost: 200, desc: '击中时溅射 1.9 范围内的敌人，伤害为 55%。', mode: 'resonance' }] },
  frost: { name: '寒冰塔', en: 'FROSTSPIRE', role: '减速 · 控制', color: '#72bfd6', cost: 95, upgrades: [100, 160], range: 5.2, interval: 1.2, damage: 23, type: 'magic', air: true, desc: '冰晶使命中目标减速 38%，持续 2.2 秒。', specs: [
    { name: '极寒领域', cost: 185, desc: '范围 2 的冰爆；减速强化至 55%。', mode: 'blizzard' },
    { name: '碎冰之牙', cost: 185, desc: '对减速目标额外伤害 90%，每三次攻击短暂冻结。', mode: 'shatter' }] },
  thunder: { name: '雷霆塔', en: 'STORMCALL', role: '连锁 · 群伤', color: '#c5b558', cost: 145, upgrades: [145, 200], range: 5.5, interval: 1.4, damage: 45, chains: 3, type: 'magic', air: true, desc: '电弧最多连接三个不同目标，每次跳跃衰减 18%。', specs: [
    { name: '雷暴网络', cost: 220, desc: '最多连接六个目标，跳跃范围提高 1.5。', mode: 'network' },
    { name: '过载电极', cost: 220, desc: '只连接两个目标，首击伤害提高 100%。', mode: 'overload' }] },
  nature: { name: '自然塔', en: 'WILDBLOOM', role: '持续 · 易伤', color: '#82ad65', cost: 100, upgrades: [110, 165], range: 5.5, interval: 1.35, damage: 16, type: 'magic', air: true, desc: '孢子在 5 秒内持续造成伤害，并使敌人易伤 15%。', specs: [
    { name: '荆棘剧毒', cost: 190, desc: '持续伤害翻倍，削弱目标 20% 物理护甲。', mode: 'venom' },
    { name: '古树祝福', cost: 190, desc: '易伤提高至 30%，持续治疗附近友军。', mode: 'blessing' }] },
  barracks: { name: '兵营塔', en: 'GARRISON', role: '守卫 · 阻挡', color: '#799bb0', cost: 100, upgrades: [105, 160], range: 5.2, interval: .95, damage: 15, type: 'physical', air: false, desc: '派出两名守卫，集结于附近道路。每人最多阻挡一名地面敌人。', specs: [
    { name: '钢铁卫队', cost: 190, desc: '守卫生命 +70%，每人阻挡两名敌人，获得护盾。', mode: 'wardens' },
    { name: '游击斥候', cost: 190, desc: '三名守卫，远程射击并能对空；每人仍阻挡一名。', mode: 'scouts' }] }
};
export const towerStats = t => {
  const def = TOWERS[t.kind], spec = t.spec == null ? null : def.specs[t.spec].mode;
  return { ...def, spec, damage: def.damage * [1, 1.55, 2.3][t.level - 1] * (spec === 'void' ? 1.25 : 1), range: def.range + (t.level - 1) * .35 + (spec === 'pierce' ? 2 : 0), interval: def.interval / (1 + (t.level - 1) * .12) / (spec === 'rapid' ? 1.65 : 1), splash: (def.splash || 0) * (spec === 'quake' ? 1.35 : 1), chains: spec === 'network' ? 6 : spec === 'overload' ? 2 : def.chains, penetration: spec === 'breaker' ? 1 : def.penetration || 0 };
};

export const HEROES = {
  knight: { name: '圣盾骑士', title: '黎明之誓 · 伊莱恩', color: '#e0be73', hp: 620, damage: 32, interval: .85, range: 1.6, speed: 3.6, type: 'physical', armor: .28, air: false, unlock: 0, passive: '坚守：每秒恢复 4 生命，最多阻挡两名地面敌人。', skills: [
    { name: '圣盾庇护', icon: 'shield', cd: 18, target: false, desc: '附近友军获得 160 护盾，骑士嘲讽附近敌人 5 秒。' },
    { name: '黎明震击', icon: 'sun', cd: 22, target: true, radius: 3.3, desc: '指定地点造成 170 物理伤害，震晕 1.1 秒。' }] },
  ranger: { name: '游林猎手', title: '风中的箭 · 瑟芙', color: '#81b775', hp: 370, damage: 43, interval: .65, range: 5.8, speed: 4.1, type: 'physical', armor: .08, air: true, unlock: 2, passive: '鹰眼：每第三箭造成 80% 额外伤害，无需追击。', skills: [
    { name: '荆棘陷阱', icon: 'leaf', cd: 16, target: true, radius: 2.7, desc: '设置 8 秒陷阱；减速 55%，每秒造成 28 伤害。' },
    { name: '穿云箭雨', icon: 'arrow', cd: 23, target: true, radius: 3.6, desc: '三轮箭雨，每轮 80 物理伤害，能够对空。' }] },
  mage: { name: '星纹法师', title: '星海的回声 · 阿斯特', color: '#b19dd6', hp: 340, damage: 50, interval: 1.05, range: 5.1, speed: 3.4, type: 'magic', armor: .05, air: true, unlock: 4, passive: '星屑：普攻溅射 1.6 范围内敌人，伤害为 45%。', skills: [
    { name: '星陨爆发', icon: 'star', cd: 19, target: true, radius: 3.2, desc: '星陨对指定区域造成 220 魔法伤害。' },
    { name: '时空凝滞', icon: 'frost', cd: 24, target: true, radius: 3.8, desc: '冻结目标 1.6 秒，并持续减速 5 秒。Boss 冻结更短。' }] },
  druid: { name: '森灵祭司', title: '万物的低语 · 莉萝', color: '#98cba0', hp: 410, damage: 30, interval: 1.15, range: 4.7, speed: 3.5, type: 'magic', armor: .1, air: true, unlock: 7, passive: '回春：每秒恢复附近友军 7 生命。', skills: [
    { name: '生命潮汐', icon: 'heart', cd: 17, target: false, desc: '恢复附近友军 200 生命，获得 80 护盾。' },
    { name: '古木守护', icon: 'tree', cd: 25, target: true, radius: 2.5, desc: '在合法地面召唤树灵守护 18 秒，可阻挡两名敌人。' }] }
};

export const ENEMIES = {
  imp: { name: '棘背小鬼', role: '轻型步兵', hp: 94, speed: 1.65, armor: 0, resist: .05, reward: 10, damage: 11, interval: 1.1, leak: 1, color: '#bb755f', model: 'imp', desc: '成群推进，箭塔和范围攻击能快速清理。' },
  wolf: { name: '裂牙奔狼', role: '快速突袭', hp: 120, speed: 2.5, armor: .05, resist: 0, reward: 12, damage: 17, interval: .85, leak: 1, color: '#967960', model: 'wolf', desc: '速度快；用寒冰减速、兵营或英雄拦截。' },
  raider: { name: '荒原掠夺者', role: '普通步兵', hp: 202, speed: 1.35, armor: .16, resist: .05, reward: 14, damage: 22, interval: 1.15, leak: 1, color: '#718365', model: 'raider', desc: '持斧近战，比小鬼更强壮。' },
  armor: { name: '黑铁重卫', role: '重甲', hp: 377, speed: .98, armor: .6, resist: .08, reward: 22, damage: 29, interval: 1.4, leak: 2, color: '#70808a', model: 'armor', desc: '高物理护甲；奥术塔和破甲重弩最有效。' },
  wisp: { name: '幽光灵体', role: '魔法抗性', hp: 208, speed: 1.6, armor: 0, resist: .65, reward: 16, damage: 14, interval: 1, leak: 1, color: '#a9c9aa', model: 'wisp', desc: '魔法抗性高，物理箭矢可以克制。' },
  bat: { name: '夜翼蝠', role: '飞行', hp: 130, speed: 2.05, armor: .03, resist: .1, reward: 13, damage: 0, interval: 1, leak: 1, air: true, color: '#927baf', model: 'bat', desc: '不被地面守卫阻挡，火炮无法攻击。' },
  harpy: { name: '霜羽鹰妖', role: '装甲飞行', hp: 273, speed: 1.8, armor: .25, resist: .18, reward: 20, damage: 0, interval: 1, leak: 2, air: true, color: '#83a8c4', model: 'harpy', desc: '飞行中的坚韧目标，需要稳定对空火力。' },
  shaman: { name: '骨杖巫医', role: '治疗支援', hp: 241, speed: 1.1, armor: .08, resist: .25, reward: 20, damage: 19, interval: 1.4, leak: 1, color: '#c3aa86', model: 'shaman', heal: true, desc: '每 3 秒为附近友军恢复生命，优先处理。' },
  shield: { name: '晶甲祭卫', role: '护盾支援', hp: 273, speed: 1.05, armor: .2, resist: .25, reward: 21, damage: 24, interval: 1.35, leak: 2, color: '#8aafc4', model: 'shield', shield: 70, aura: true, desc: '每 5 秒给附近友军补充护盾；连续火力打破护盾。' },
  brood: { name: '孢囊母虫', role: '分裂', hp: 306, speed: 1.05, armor: .1, resist: .12, reward: 19, damage: 20, interval: 1.3, leak: 2, color: '#a5a566', model: 'brood', split: true, desc: '被击败后分裂为两只小虫；火炮负责后续清理。' },
  grub: { name: '尖刺幼虫', role: '召唤物', hp: 59, speed: 1.8, armor: 0, resist: 0, reward: 3, damage: 8, interval: .9, leak: 1, color: '#c5b97f', model: 'grub', desc: '弱小但数量较多，留意分裂造成的路线压力。' },
  siege: { name: '熔铁攻城兽', role: '攻城', hp: 806, speed: .78, armor: .4, resist: .15, reward: 36, damage: 62, interval: 1.8, leak: 4, color: '#937968', model: 'siege', desc: '巨大耐久，突破会造成四点基地损失；重弩和自然易伤很有效。' },
  elite: { name: '血誓先锋', role: '精英', hp: 611, speed: 1.35, armor: .3, resist: .23, reward: 31, damage: 36, interval: 1, leak: 3, elite: true, color: '#9f5352', model: 'elite', desc: '低于半血时狂怒，伤害提高，速度增幅有上限。' },
  warlock: { name: '灰烬召唤师', role: '召唤支援', hp: 403, speed: 1.0, armor: .08, resist: .45, reward: 27, damage: 28, interval: 1.3, leak: 2, color: '#956b8a', model: 'warlock', summon: true, desc: '每 7 秒召唤小鬼，最多召唤三轮；尽早击败。' },
  frostguard: { name: '霜铠巨人', role: '控制抗性 · 精英', hp: 715, speed: .98, armor: .4, resist: .35, reward: 34, damage: 46, interval: 1.5, leak: 3, elite: true, controlResist: .45, color: '#83a8b0', model: 'frostguard', desc: '厚重冰甲，控制效果缩短；混合伤害可以击穿。' },
  treant: { name: '腐冠古树', role: '林地领主', hp: 3380, speed: .55, armor: .24, resist: .15, reward: 154, damage: 66, interval: 1.8, leak: 20, boss: true, color: '#648665', model: 'treant', desc: '70% / 35% 生命时召唤护卫；护卫存活期间缓慢恢复。优先清理护卫。' },
  iceking: { name: '霜岩暴君', role: '冰原领主', hp: 5720, speed: .52, armor: .5, resist: .26, reward: 210, damage: 86, interval: 1.7, leak: 20, boss: true, controlResist: .65, color: '#7dabbc', model: 'iceking', desc: '冰甲阶段减伤；预告后冰封附近防御塔。冰甲碎裂的 6 秒内全伤害提升。' },
  ashlord: { name: '灰烬无冕王', role: '王庭领主', hp: 8580, speed: .6, armor: .35, resist: .32, reward: 315, damage: 108, interval: 1.6, leak: 20, boss: true, color: '#bc7859', model: 'ashlord', desc: '三阶段进攻；预告后从另一入口增援。最终阶段施加易伤，火力窗口同时打开。' }
};

export const STARTING_GOLD = 200;
const stage = (id, region, name, subtitle, paths, sites, roster, waves, extras = {}) => ({
  id, region, name, subtitle, paths, routes: paths.map(makeRoute), sites: sites.map(([x, z], i) => ({ id: i, x, z })), roster, waveCount: waves, lives: 20, ...extras, gold: STARTING_GOLD
});
export const LEVELS = [
  stage(1, 0, '溪谷哨站', '沿溪谷建立第一道防线。弯道两侧的箭塔能够覆盖多段道路。', [[[-14,-6],[-8,-6],[-8,1],[1,1],[1,7],[13,7]]], [[-11,-3],[-5,-3],[-5,4],[-1,-2],[4,4],[8,4],[10,9]], ['imp','wolf','raider'], 5, { tip: '点击空地格子建塔。点击英雄，再点地面移动。准备好后开始第一波。' }),
  stage(2, 0, '双流交汇', '两路敌军在古树前汇合。把火力集中在交汇处，留意两侧入口。', [[[-14,-7],[-6,-7],[-6,0],[2,0],[2,6],[13,6]],[[-14,7],[-9,7],[-9,0],[2,0],[2,6],[13,6]]], [[-11,-4],[-11,3],[-3,-3],[-3,3],[5,2],[6,8],[10,3]], ['imp','wolf','raider','brood'], 5, { tip: '双入口：道路上的两座时空门对应两条进攻路线。分配火力，或者集中防守汇流点。' }),
  stage(3, 0, '风语林径', '夜翼从林冠下袭来。火炮和守卫无法处理空中威胁。', [[[-14,-8],[-4,-8],[-4,-2],[6,-2],[6,6],[13,6]]], [[-10,-5],[-7,-1],[-1,-5],[2,1],[9,1],[3,7],[10,8]], ['wolf','raider','bat','shaman'], 6, { tip: '飞行敌人不受兵营阻挡。箭塔、重弩和魔法塔可以对空。游林猎手现已可以选择。' }),
  stage(4, 0, '古树圣所', '腐冠古树正走向圣所。击败它的护卫，切断自然恢复。', [[[-14,-6],[-7,-6],[-7,5],[0,5],[0,-4],[7,-4],[7,6],[13,6]]], [[-11,-2],[-4,-2],[-3,8],[3,1],[4,-7],[10,0],[10,8]], ['imp','raider','brood','shaman','armor'], 7, { boss: 'treant', tip: '领主战：最后一波有腐冠古树。自然塔的易伤配合重弩可以持续处理强敌。' }),
  stage(5, 1, '雪落隘口', '狭窄的北境峡口，建造位置有限。装甲军团迫近。', [[[-14,-7],[-3,-7],[-3,3],[5,3],[5,7],[13,7]]], [[-8,-4],[0,-3],[0,6],[8,0],[10,5]], ['raider','armor','wisp','wolf'], 6, { tip: '护甲与魔抗：黑铁重卫怕魔法，幽光灵体怕物理攻击。星纹法师已经解锁。' }),
  stage(6, 1, '冰桥岔路', '两条道路绕过冰封遗迹。出口分离，英雄需要支援薄弱防线。', [[[-14,0],[-8,0],[-8,-7],[5,-7],[5,-2],[13,-2]],[[-14,0],[-8,0],[-8,7],[5,7],[5,3],[13,3]]], [[-11,-3],[-5,-4],[-5,4],[1,-4],[1,4],[8,-5],[8,7]], ['armor','harpy','wolf','shield'], 6),
  stage(7, 1, '白霜堡垒', '巫医和晶甲祭卫掩护霜铠巨人。聚焦支援单位，维持混合火力。', [[[-14,-7],[-7,-7],[-7,1],[2,1],[2,-6],[9,-6],[9,6],[13,6]],[[-14,8],[-2,8],[-2,1],[2,1],[2,-6],[9,-6],[9,6],[13,6]]], [[-10,-3],[-4,-3],[-5,5],[5,-3],[6,3],[11,-2],[4,7]], ['raider','shaman','shield','frostguard','harpy'], 7),
  stage(8, 1, '永冬王座', '霜岩暴君拥有厚重冰甲。观察碎甲窗口，避开冰封预警。', [[[-14,-5],[-9,-5],[-9,5],[-2,5],[-2,-5],[5,-5],[5,5],[13,5]]], [[-12,0],[-6,0],[-5,8],[1,0],[2,-8],[8,0],[10,8]], ['armor','wisp','shield','frostguard','harpy'], 8, { boss: 'iceking', tip: '暴君会提前标记即将冰封的防御塔。冰甲碎裂时释放爆发技能。森灵祭司已经解锁。' }),
  stage(9, 2, '余火城门', '熔铁攻城兽穿过旧城门。炮塔清理小队，重弩处理攻城目标。', [[[-14,-7],[-5,-7],[-5,0],[6,0],[6,7],[13,7]]], [[-10,-4],[-8,3],[-2,-3],[1,3],[9,3],[3,8]], ['elite','siege','brood','bat','warlock'], 7),
  stage(10, 2, '黑曜回廊', '东西两面同时遭袭。三条入口迫使你建立完整的交叉防线。', [[[-14,-8],[-5,-8],[-5,0],[6,0],[6,7],[13,7]],[[-14,8],[-5,8],[-5,0],[6,0],[6,7],[13,7]],[[14,-8],[6,-8],[6,0],[6,7],[13,7]]], [[-10,-4],[-10,4],[-2,-4],[-2,4],[3,-6],[9,-3],[9,4],[9,10]], ['elite','harpy','warlock','shield','siege'], 7),
  stage(11, 2, '破碎王庭', '两条路线各自折返。召唤师不断增援，让兵营与控制塔创造输出时间。', [[[-14,-8],[-8,-8],[-8,2],[-1,2],[-1,-5],[7,-5],[7,6],[13,6]],[[-14,8],[-5,8],[-5,-2],[3,-2],[3,6],[13,6]]], [[-11,-3],[-11,5],[-5,-5],[-3.1,.1],[0,5],[3,-7],[10,0],[10,9]], ['warlock','shaman','frostguard','siege','wisp','elite'], 8),
  stage(12, 2, '无冕之战', '灰烬无冕王统领最后一支军团。跨越双路压力，守住王国的黎明。', [[[-14,-7],[-7,-7],[-7,4],[0,4],[0,-4],[7,-4],[7,6],[13,6]],[[-14,8],[-3,8],[-3,4],[0,4],[0,-4],[7,-4],[7,6],[13,6]],[[14,-9],[7,-9],[7,-4],[7,6],[13,6]]], [[-11,-3],[-4,-3],[-6,6],[3,1],[3,-7],[10,-4],[10,2],[10,9]], ['elite','siege','warlock','shield','harpy','frostguard'], 9, { boss: 'ashlord', tip: '决战：无冕王每阶段都会预告增援路线。保持对空火力，集中技能处理最终阶段。' })
];
// The roster shown in the mission sheet must describe the authored encounters.
for(const map of LEVELS){
  map.bossId=BOSSES[map.id-1].id;map.boss=BOSSES[map.id-1].kind;
  map.roster=[...new Set(CAMPAIGN_WAVES[map.id-1].flat().map(([kind])=>kind))];
  map.tip=`${campaignBrief(map)}。${map.tip||'集中弯道与汇流处的火力，战斗中用击杀收入继续建造和升级。'}`;
}
export const ENDLESS = [
  stage('e1',0,'翡翠环城','双路围绕古树交错，建立适合长久防守的中央火力。',[[[-14,-8],[-8,-8],[-8,7],[0,7],[0,-5],[7,-5],[7,6],[13,6]],[[-14,3],[-3,3],[-3,-5],[7,-5],[7,6],[13,6]]],[[-11,-3],[-5,-3],[-5,5],[3,2],[3,-8],[10,0],[10,8],[0,10]],['imp','wolf','raider','brood','shaman','bat'],Infinity),
  stage('e2',1,'北境长夜','两侧冰谷汇聚，交叉射程与空中防线同样重要。',[[[-14,-8],[-6,-8],[-6,1],[3,1],[3,7],[13,7]],[[14,-8],[6,-8],[6,1],[3,1],[3,7],[13,7]],[[-14,8],[-6,8],[-6,1],[3,1],[3,7],[13,7]]],[[-10,-4],[-3,-4],[-9,4],[-3,5],[3,-4],[9,-4],[7,4],[10,10]],['armor','wisp','harpy','shield','frostguard','wolf'],Infinity),
  stage('e3',2,'余烬永垒','三路在废墟中折返，晚期增援考验完整的防线。',[[[-14,-8],[-7,-8],[-7,1],[0,1],[0,7],[13,7]],[[-14,8],[-7,8],[-7,1],[0,1],[0,-6],[7,-6],[7,7],[13,7]],[[14,-9],[7,-9],[7,-6],[7,7],[13,7]]],[[-11,-3],[-11,5],[-4,-3],[-4,5],[3,-3],[3,4],[10,-2],[10,4],[10,10]],['elite','siege','warlock','shield','harpy','brood'],Infinity)
].map(m=>({...m,endless:true}));
export const allMaps = [...LEVELS,...ENDLESS];

const ENDLESS_BOSSES = ['treant','iceking','ashlord'];

export function wavePlan(map, wave) {
  if(!map.endless)return campaignPlan(map,wave);
  const roster = [...map.roster];
  if (wave > 5) roster.push('armor','harpy','shaman');
  if (wave > 10) roster.push('elite','shield','warlock','siege','frostguard');
  const count = Math.min(44, 8 + wave * 2);
  const plan = [], interval = Math.max(.46, 1.08 - wave * .045);
  for (let i = 0; i < count; i++) {
    let kind = roster[(i + wave * 2 + Math.floor(i / 4)) % roster.length];
    // Regular support troops join the endless army from its fourth wave.
    if (wave >= 4 && i % 7 === 0 && roster.includes('shaman')) kind = 'shaman';
    plan.push({ kind, route: i % map.routes.length, at: i * interval });
  }
  const boss = wave % 5 === 0 ? ENDLESS_BOSSES[Math.floor((wave / 5 - 1) / 2) % 3] : null;
  if (boss) plan.push({ kind: boss, route: 0, at: 1.8 });
  return plan.sort((a,b)=>a.at-b.at);
}
export function enemyScale(map, wave) {
  if(!map.endless)return { hp: 1 + (map.id-1)*.045 + (wave-1)*.045, speed: 1 + (map.id-1)*.009, reward: 1 + (map.id-1)*.018 };
  const n=Math.max(0,wave-1),late=Math.max(0,n-10);
  const bossTier=Math.min(2,Math.max(0,Math.floor((wave-5)/10))),bosses=ENDLESS_BOSSES.slice(0,bossTier+1).map(kind=>ENEMIES[kind]);
  return {
    // Preserve the opening HP slope, then continuously increase late durability.
    hp:1+n*.095+late*late*.018,
    // Logarithmic movement growth avoids an abrupt speed ceiling or runaway rush.
    speed:1+Math.min(n,10)*.007+Math.log1p(late/20)*.3,
    // Each template approaches 84% mitigation without hitting the damage clamp.
    defense:n/(n+100),
    bossHp:1+Math.max(1,wave)*.022,
    // A later model rotation keeps the strongest base stats already introduced.
    bossBaseHp:Math.max(...bosses.map(b=>b.hp)),
    bossBaseArmor:Math.max(...bosses.map(b=>b.armor)),
    bossBaseResist:Math.max(...bosses.map(b=>b.resist)),
    bossBaseSpeed:Math.max(...bosses.map(b=>b.speed)),
    reward:Math.min(1.8,1+wave*.025)
  };
}
