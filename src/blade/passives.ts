import { isBow } from './bows';
import { TIERS, isBasicWeapon } from './config';

export type BladeId = typeof TIERS[number]['id'];
export const PASSIVES: Record<BladeId, { name: string; story: string; description: string }> = {
  knife: { name: '胡萝卜横扫', story: '鲜脆近战', description: '握住绿色叶柄，胡萝卜自动横扫前方多个敌人，覆盖宽扇形范围。' },
  sword: { name: '快斩', story: '高频近战', description: '自动连续快斩，出手与收势更快，覆盖角度较窄。' },
  bow: { name: '瓜子连射', story: '香蕉弓远程', description: '香蕉弓自动瞄准射程内可见敌人，每次射出一枚瓜子箭，命中首个敌人后消失。' },
  spear: { name: '直线贯穿', story: '长距离直刺', description: '自动向前直刺，贯穿窄直线上的所有敌人，不扫向侧面与身后。' },
  scrap: { name: '百炼初锋', story: '取意于无名小刀在实战中磨出锋芒。', description: '每击杀 5 名敌人，近战伤害 +6%，最多 3 层；本局保留。' },
  'dark-dagger': { name: '袖里藏锋', story: '取意于韦小宝的机敏与匕首破坚。', description: '瞬步后 3 秒内，下一次命中的近战伤害 +80%；近战对甲壳额外伤害 +30%。' },
  'well-moon': { name: '井中八法', story: '取意于寇仲临阵应变、八法相衔的刀道。', description: '每 8 次有效近战，额外放出三道金月刀气；各造成 80% 近战伤害，射程 220、穿透 2 人。' },
  'deer-cutter': { name: '逐鹿留痕', story: '取意于割鹿之名与逐鹿江湖的追猎意象。', description: '近战留下 4 秒逐鹿印，对已有印记的目标伤害 +30%；击杀带印目标返还 0.8 秒瞬步冷却，间隔 0.6 秒。' },
  'full-moon': { name: '魔刀归圆', story: '取意于丁鹏弯刀与圆月相合的锋芒。', description: '每 5 次有效近战，爆发身周月轮，对周围敌人造成 80% 近战伤害并击退。' },
  'dragon-slayer': { name: '狮吼震岳', story: '取意于谢逊的狮吼威势与屠龙重刃。', description: '近战命中引发狮吼，击退周围敌人；普通怪眩晕 0.8 秒，精英与首领减速 20% 持续 1.2 秒。冷却 6 秒。' },
  'snow-drinker': { name: '寒魄凝霜', story: '取意于雪饮寒锋与聂家冰心的清寒意象。', description: '近战与刀气叠加寒意，每层减速 15%、持续 2 秒；3 层冻结普通怪 0.8 秒，每目标间隔 4 秒。精英与首领最多减速 15%，不冻结。' },
  wado: { name: '不负约定', story: '取意于古伊娜与索隆永不放弃的约定。', description: '连续 6 秒未受伤，凝成一次护刃，抵挡下一次伤害；护刃破碎后冷却 12 秒。' },
  shusui: { name: '斩龙遗志', story: '取意于剑豪龙马斩龙的传说与黑刀坚骨。', description: '同一目标每承受 3 次近战，追加 120% 近战伤害；对精英与首领，追加伤害翻倍。' },
  enma: { name: '霸气索取', story: '取意于阎魔引出持有者霸气、考验驾驭者。', description: '每第 4 次有效近战伤害 +100%；生命高于 35% 时耗 4 生命，改为 +150%，本斩击杀则返还消耗。' },
  ryujin: { name: '万象焚尽', story: '取意于山本元柳斋重国斩魄刀的烈焰。', description: '近战与刀气附加 3 秒灼烧，每秒造成 30% 近战伤害；燃烧的敌人死亡后，引燃周围 80 范围内的敌人。灼烧不叠层。' },
  tensa: { name: '月牙天冲', story: '取意于黑崎一护的黑色月牙与卍解速度。', description: '瞬步结束斩出 180% 伤害月牙，射程 380、穿透 12 人；随后 2 秒移速 +15%、攻击间隔 −15%。' },
  'wind-bow': {name:'顺风连矢',story:'追风旅人的连箭，沿同一条风路破阵。',description:'自动发射穿透箭，每第四次射击追加两支风箭，各造成 45% 普攻伤害。'},
  'frost-bow': {name:'凝霜',story:'让月光凝成寒意，把怪潮留在身后。',description:'三箭散射附加寒意，三次不同轮次的命中冻结普通怪 0.65 秒；精英与首领只减速。'},
  'ember-bow': {name:'余烬',story:'流星散去之后，余火仍在燃烧。',description:'重箭命中爆炸，爆炸对周围敌人造成 65% 普攻伤害，并附加 2 秒灼烧。'},
};

export interface PassiveState {
  tier: number; hits: number; kills: number; stacks: number; empowered: number;
  cooldown: number; safeTime: number; shield: boolean; haste: number; tensaPending: boolean;
}
export const freshPassive = (tier = 0): PassiveState => ({ tier, hits: 0, kills: 0, stacks: 0, empowered: 0, cooldown: 0, safeTime: 0, shield: false, haste: 0, tensaPending: false });
export interface EnemyEffects {
  hunt: number; chill: number; chillStacks: number; freeze: number; freezeCooldown: number;
  stun: number; slow: number; slowTime: number; burnTime: number; burnTick: number; burnDamage: number; dragonHits: number;
  poisonTime:number; poisonTick:number; poisonDamage:number;
}
export const freshEnemyEffects = (): EnemyEffects => ({ hunt: 0, chill: 0, chillStacks: 0, freeze: 0, freezeCooldown: 0, stun: 0, slow: 0, slowTime: 0, burnTime: 0, burnTick: .5, burnDamage: 0, dragonHits: 0, poisonTime:0,poisonTick:.5,poisonDamage:0 });
// All routes use their own passive from the first second. Mastery strengthens that identity.
export function passiveRules(mastery = 0) {
  const m = Math.max(0, Math.min(4, mastery));
  return {
    scrapCap: 3 + m, scrapBonus: .06 + .015 * m,
    daggerTime: 3 + .5 * m, daggerBonus: .8 + .2 * m, armorBonus: .3 + .05 * m,
    moonCycle: 8 - m, moonCount: m >= 3 ? 5 : 3, moonDamage: .8 + .1 * m, moonRange: 220 + 40 * m, moonPierce: 2 + 2 * m,
    huntTime: 4 + .5 * m, huntBonus: .3 + .1 * m, huntRefund: .8 + .15 * m,
    ringCycle: 5 - Math.floor(m / 2), ringDamage: .8 + .15 * m, ringRadius: .95 + .1 * m,
    roarCooldown: 6 - .6 * m, roarStun: .8 + .1 * m, roarSlow: .2 + .025 * m, roarDamage: m >= 3 ? .35 + .15 * (m - 3) : 0,
    chillTime: 2 + .25 * m, chillSlow: .15 + .02 * m, freezeStacks: m >= 3 ? 2 : 3, freezeTime: .8 + .15 * m,
    guardSafe: 6 - .6 * m, guardCooldown: 12 - 1.5 * m, guardCounter: m >= 2 ? .4 + .2 * (m - 2) : 0,
    dragonCycle: m === 4 ? 2 : 3, dragonBonus: 1.2 + .3 * m,
    enmaCycle: m >= 2 ? 3 : 4, enmaCost: 4 - Math.floor(m / 2), enmaBonus: 1 + .2 * m, enmaPaidBonus: 1.5 + .25 * m,
    burnTime: 3 + .25 * m, burnTickDamage: .15 + .035 * m, burnSpread: 80 + 25 * m,
    getsugaDamage: 1.8 + .35 * m, getsugaRange: 380 + 45 * m, getsugaPierce: 12 + 3 * m, hasteTime: 2 + .25 * m, hasteBonus: .15 + .025 * m,
  };
}
const pct = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number) => Number(n.toFixed(2));
export function passiveForTier(tier: number, mastery = 0) {
  const base = PASSIVES[TIERS[tier].id], r = passiveRules(mastery);
  if (isBasicWeapon(tier)) return base;
  let description: string = base.description;
  switch (TIERS[tier].id) {
    case 'scrap': description = `每击杀 5 名敌人，近战伤害 +${pct(r.scrapBonus)}，最多 ${r.scrapCap} 层；本局保留，熟练后可继续叠层。`; break;
    case 'dark-dagger': description = `瞬步后 ${num(r.daggerTime)} 秒内，下一次命中的近战伤害 +${pct(r.daggerBonus)}；近战对甲壳额外伤害 +${pct(r.armorBonus)}。`; break;
    case 'well-moon': description = `每 ${r.moonCycle} 次有效近战，放出 ${r.moonCount} 道金月刀气；各造成 ${pct(r.moonDamage)} 近战伤害，基础射程 ${r.moonRange}、穿透 ${r.moonPierce} 人；刀气体型和射程随刀身成长。`; break;
    case 'deer-cutter': description = `近战留下 ${num(r.huntTime)} 秒逐鹿印，对已标记目标伤害 +${pct(r.huntBonus)}；击杀返还 ${num(r.huntRefund)} 秒瞬步冷却，间隔 0.6 秒。`; break;
    case 'full-moon': description = `每 ${r.ringCycle} 次有效近战，爆发基础半径为刀长 ${pct(r.ringRadius)} 的月轮，并随刀宽扩大，对周围敌人造成 ${pct(r.ringDamage)} 近战伤害并击退。`; break;
    case 'dragon-slayer': description = `近战触发狮吼，击退并眩晕普通怪 ${num(r.roarStun)} 秒；精英与首领减速 ${pct(r.roarSlow)} 持续 1.2 秒。冷却 ${num(r.roarCooldown)} 秒。${r.roarDamage ? `狮吼另造成 ${pct(r.roarDamage)} 范围伤害。` : ''}`; break;
    case 'snow-drinker': description = `近战与刀气叠加寒意，每层减速 ${pct(r.chillSlow)}、持续 ${num(r.chillTime)} 秒；${r.freezeStacks} 层冻结普通怪 ${num(r.freezeTime)} 秒，每目标间隔 4 秒。精英与首领最多减速 15%，不冻结。`; break;
    case 'wado': description = `连续 ${num(r.guardSafe)} 秒未受伤，凝成一次护刃，抵挡下一次伤害；破碎后冷却 ${num(r.guardCooldown)} 秒。${r.guardCounter ? `破碎时向身周回斩，造成 ${pct(r.guardCounter)} 近战伤害。` : ''}`; break;
    case 'shusui': description = `同一目标每承受 ${r.dragonCycle} 次近战，追加 ${pct(r.dragonBonus)} 近战伤害；对精英与首领，追加伤害翻倍。`; break;
    case 'enma': description = `每第 ${r.enmaCycle} 次有效近战伤害 +${pct(r.enmaBonus)}；生命高于 35% 时耗 ${r.enmaCost} 生命，改为 +${pct(r.enmaPaidBonus)}，本斩击杀则返还消耗。`; break;
    case 'ryujin': description = `近战与刀气附加 ${num(r.burnTime)} 秒灼烧，每秒造成 ${pct(r.burnTickDamage * 2)} 近战伤害；死亡传火的基础半径为 ${r.burnSpread}，随刀身尺寸扩大，灼烧不叠层。`; break;
    case 'wind-bow': description = `每第四次射击追加两支风箭，各造成 ${pct(.45+.05*mastery)} 普攻伤害；普攻穿透 ${2+Math.floor(mastery/2)} 名敌人。`; break;
    case 'frost-bow': description = `三箭散射附加 ${num(1.5+.2*mastery)} 秒寒意，减速 ${pct(.2+.02*mastery)}；三次不同轮次的命中冻结普通怪 ${num(.65+.1*mastery)} 秒，每目标间隔 4 秒。精英与首领最多减速 15%，不冻结。`; break;
    case 'ember-bow': description = `重箭命中爆炸，周围目标受到 65% 普攻伤害；直击与爆炸附加 ${num(2+.15*mastery)} 秒灼烧，每秒造成 15% 箭矢伤害，同次直击不重复结算爆炸。`; break;
    case 'tensa': description = `瞬步结束斩出 ${pct(r.getsugaDamage)} 伤害月牙，基础射程 ${r.getsugaRange}、穿透 ${r.getsugaPierce} 人，月牙体型和射程随刀身成长；随后 ${num(r.hasteTime)} 秒移速 +${pct(r.hasteBonus)}、攻击间隔 −${pct(r.hasteBonus)}。`; break;
  }
  return { ...base, description: `${description} ${isBow(tier)?'射程与箭体覆盖随道具成长。':'被动特效随刀身尺寸放大。'}` };
}
export function passiveGrowth(tier: number, mastery: number) {
  const r = passiveRules(mastery);
  if (isBasicWeapon(tier)) return '提升基础伤害与尺寸，保持原有攻击方式';
  if(tier===12)return `连矢 ${pct(.45+.05*mastery)} · 穿透 ${2+Math.floor(mastery/2)} 人`;
  if(tier===13)return `寒意 ${num(1.5+.2*mastery)}s · 冻结 ${num(.65+.1*mastery)}s`;
  if(tier===14)return `余烬 ${num(2+.15*mastery)}s · 爆炸范围成长`;
  return [
    `磨刃上限 ${r.scrapCap} 层 · 每层 +${pct(r.scrapBonus)}`,
    `藏锋 +${pct(r.daggerBonus)} · 窗口 ${num(r.daggerTime)}s`,
    `${r.moonCycle} 斩 / ${r.moonCount} 道金月 · 穿透 ${r.moonPierce}`,
    `印记增伤 ${pct(r.huntBonus)} · 瞬步返还 ${num(r.huntRefund)}s`,
    `${r.ringCycle} 斩归圆 · 月轮伤害 ${pct(r.ringDamage)}`,
    `狮吼冷却 ${num(r.roarCooldown)}s${r.roarDamage ? ' · 震岳回响造成范围伤害' : ` · 眩晕 ${num(r.roarStun)}s`}`,
    `${r.freezeStacks} 层凝霜 · 冻结 ${num(r.freezeTime)}s`,
    `凝刃 ${num(r.guardSafe)}s${r.guardCounter ? ' · 护刃破碎触发回斩' : ` · 冷却 ${num(r.guardCooldown)}s`}`,
    `${r.dragonCycle} 击斩龙 · 追加 ${pct(r.dragonBonus)}，对强敌翻倍`,
    `${r.enmaCycle} 斩爆发 · 耗血 ${r.enmaCost} · 增伤 ${pct(r.enmaPaidBonus)}`,
    `灼烧 ${num(r.burnTime)}s · 基础传火半径 ${r.burnSpread}，随刀身成长`,
    `月牙 ${pct(r.getsugaDamage)} · 穿透 ${r.getsugaPierce} · 疾行 ${num(r.hasteTime)}s`,
  ][tier];
}
export function passiveProgress(id: BladeId, p: PassiveState, dashCooldown: number, mastery = 0) {
  const r = passiveRules(mastery);
  switch (id) {
    case 'knife': return '胡萝卜横扫 · 前方清群';
    case 'sword': return '连续快斩 · 灵活走位';
    case 'bow': return '香蕉弓连射 · 一次一枚瓜子';
    case 'spear': return '前方直刺 · 沿线贯穿';
    case 'scrap': return p.stacks >= r.scrapCap ? `磨刃已满 · 近战 +${pct(p.stacks * r.scrapBonus)}` : `磨刃 ${p.stacks}/${r.scrapCap} · 击败 ${p.kills % 5}/5`;
    case 'dark-dagger': return p.empowered > 0 ? `藏锋就绪 ${p.empowered.toFixed(1)}s` : '瞬步后强化下一斩';
    case 'well-moon': return `八法蓄势 ${p.hits}/${r.moonCycle}`;
    case 'deer-cutter': return '留印追猎 · 击杀回瞬步';
    case 'full-moon': return `月轮蓄势 ${p.hits}/${r.ringCycle}`;
    case 'dragon-slayer': return p.cooldown > 0 ? `狮吼冷却 ${p.cooldown.toFixed(1)}s` : '狮吼就绪 · 命中发动';
    case 'snow-drinker': return `${r.freezeStacks} 层寒意 · 凝霜冻结`;
    case 'wado': return p.shield ? '护刃已凝成' : p.cooldown > 0 ? `护刃冷却 ${p.cooldown.toFixed(1)}s` : `凝刃 ${Math.max(0, r.guardSafe - p.safeTime).toFixed(1)}s`;
    case 'shusui': return `同一目标 ${r.dragonCycle} 击 · 斩龙`;
    case 'enma': return `霸气蓄势 ${p.hits}/${r.enmaCycle}`;
    case 'ryujin': return `灼烧 ${num(r.burnTime)} 秒 · 死亡传火`;
    case 'wind-bow': return '每四次射击 · 顺风连矢';
    case 'frost-bow': return '三轮凝霜 · 冻结普通怪';
    case 'ember-bow': return '爆炸清群 · 余烬灼烧';
    case 'tensa': return p.haste > 0 ? `卍解疾行 ${p.haste.toFixed(1)}s` : dashCooldown > 0 ? `月牙冷却 ${dashCooldown.toFixed(1)}s` : '瞬步就绪 · 月牙随行';
  }
}
