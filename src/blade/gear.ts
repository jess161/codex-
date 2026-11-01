import type { EnemyKind } from './config';

export const RUN_DURATION = 600;
export const SURVIVAL_DURATION = 540;
export const FINALE_DURATION = RUN_DURATION - SURVIVAL_DURATION;
export const GEAR_CAP = 5;
export const GEAR_CATEGORIES = {
  defense: {name: '防御类', color: '#dc83a6', tint: '#fff0f6'},
  attack: {name: '攻击类', color: '#a38ad8', tint: '#f3eeff'},
  footwear: {name: '足具类', color: '#62afa9', tint: '#e9fbf6'},
} as const;
export type GearCategory = keyof typeof GEAR_CATEGORIES;
export const GEAR = {
  jellyVest: {name: '果冻护心', category: 'defense', price: 30, effect: '生命上限 +20，立即恢复 20 生命', note: '每级额外增加 20 生命；四种武器都能更从容地承受碰撞。'},
  bubbleGuard: {name: '泡泡护甲', category: 'defense', price: 35, effect: '受到的伤害降低 6%', note: '每级再减伤 6%，最高 30%。对碰撞、弹丸、毒气和首领攻击都生效。'},
  honeyCharm: {name: '蜜露护符', category: 'defense', price: 28, effect: '每 5 秒恢复 2 生命', note: '每级增加 2 点恢复量，无需命中；满血时不储存额外治疗。'},
  sugarCore: {name: '星糖晶核', category: 'attack', price: 32, effect: '基础攻击伤害 +18%', note: '刀横扫、剑快斩、普通箭和矛的每个贯穿目标都获得完整加成。'},
  clockGrip: {name: '发条握柄', category: 'attack', price: 36, effect: '攻击间隔与出手动作缩短 8%', note: '每级按当前值缩短 8%；同时加快近战动作和拉弓，保持各武器原有节奏。'},
  clearLens: {name: '聚能透镜', category: 'attack', price: 30, effect: '攻击距离 +12%', note: '每级再增加 12%：延长刀剑斩距、箭矢射程和长矛刺距，不改变攻击方式。'},
  breezeBoots: {name: '疾风短靴', category: 'footwear', price: 28, effect: '移动速度 +7%', note: '每级再增加 7%，起步与转向同步改善，攻击时仍可移动。'},
  springBoots: {name: '弹簧步靴', category: 'footwear', price: 32, effect: '瞬步冷却缩短 0.4 秒', note: '最高缩短至 3 秒；购入时也缩短当前剩余冷却，移动方向与瞬步距离不变。'},
  pickupBoots: {name: '拾光长靴', category: 'footwear', price: 26, effect: '金币与经验吸取范围 +18%', note: '每级再增加 18%。仍需走近地面掉落，远处金币不会自动入账。'},
} as const;
export type GearId = keyof typeof GEAR;
export type GearInventory = Record<GearId, number>;
export const GEAR_IDS = Object.keys(GEAR) as GearId[];
export const isGearId = (value: unknown): value is GearId => typeof value === 'string' && Object.hasOwn(GEAR, value);
export const freshGear = (): GearInventory => Object.fromEntries(GEAR_IDS.map(id => [id, 0])) as GearInventory;
export const gearPrice = (id: GearId, currentRank: number) => GEAR[id].price + currentRank * 24;
export function gearSpent(gear: GearInventory) {
  return GEAR_IDS.reduce((sum, id) => sum + Array.from({length: gear[id]}, (_, rank) => gearPrice(id, rank)).reduce((a, b) => a + b, 0), 0);
}
export function gearDetail(id: GearId, rank: number) {
  switch (id) {
    case 'jellyVest': return `生命上限 +${rank * 20}，每次升级恢复 20 生命`;
    case 'bubbleGuard': return `所有受到的伤害降低 ${rank * 6}%`;
    case 'honeyCharm': return `每 5 秒恢复 ${rank * 2} 生命`;
    case 'sugarCore': return `基础攻击伤害 +${rank * 18}%`;
    case 'clockGrip': return `攻击间隔与动作合计缩短 ${Math.round((1 - .92 ** rank) * 100)}%`;
    case 'clearLens': return `刀剑斩距、箭矢射程、长矛刺距 +${rank * 12}%`;
    case 'breezeBoots': return `移动速度 +${rank * 7}%`;
    case 'springBoots': return `瞬步冷却 ${Math.max(3, 5 - rank * .4).toFixed(1)} 秒`;
    case 'pickupBoots': return `金币与经验吸取范围 +${rank * 18}%`;
  }
}
export const COIN_VALUES: Record<EnemyKind, number> = {
  blob: 1, swift: 2, armor: 4, shooter: 3, charger: 4, wisp: 4, splitter: 3,
  brood: 1, spiker: 5, poison: 4, bomber: 4, stalker: 5, elite: 25, boss: 100,
};
export interface EconomyState {wallet: number; earned: number; spent: number; gear: GearInventory; order: GearId[]; regen: number}
export const freshEconomy = (coins = 0): EconomyState => ({wallet: coins, earned: coins, spent: 0, gear: freshGear(), order: [], regen: 0});
export function validEconomy(value: unknown): value is EconomyState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const e = value as EconomyState;
  return [e.wallet, e.earned, e.spent].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1e9)
    && e.wallet + e.spent === e.earned
    && !!e.gear && Object.keys(e.gear).length === GEAR_IDS.length && GEAR_IDS.every(id => Number.isInteger(e.gear[id]) && e.gear[id] >= 0 && e.gear[id] <= GEAR_CAP)
    && e.spent === gearSpent(e.gear)
    && Array.isArray(e.order) && e.order.every(isGearId) && new Set(e.order).size === e.order.length
    && e.order.length === GEAR_IDS.filter(id => e.gear[id] > 0).length && e.order.every(id => e.gear[id] > 0)
    && Number.isFinite(e.regen) && e.regen >= 0 && e.regen < 5.000001;
}
