import type { EnemyKind } from './config';
export const RUN_DURATION = 600;
export const SURVIVAL_DURATION = 540;
export const FINALE_DURATION = 60;
export const GEAR_CAP = 3;
export const GEAR_SLOTS = 6;
export const GEAR_CATEGORIES = {
  defense: {name: '防御类', color: '#dc83a6', tint: '#fff0f6'},
  attack: {name: '攻击类', color: '#a38ad8', tint: '#f3eeff'},
  footwear: {name: '足具类', color: '#62afa9', tint: '#e9fbf6'},
} as const;
export type GearCategory = keyof typeof GEAR_CATEGORIES;
export const GEAR = {
  jellyVest: {name:'果冻巨心',category:'defense',price:55,effect:'生命 +35；放大生命相关装备的收益',note:'每级 +35 生命。熔糖灼烧与壁垒护盾按最大生命成长。'},
  bubbleGuard: {name:'泡泡壁垒',category:'defense',price:65,effect:'减伤 4%；低血时获得最大生命护盾',note:'受伤后低于 35% 生命，获得最大生命 16%/22%/28% 的护盾，持续 3 秒，冷却 16 秒。每级减伤 4%。'},
  honeyCharm: {name:'蜜露灵印',category:'defense',price:55,effect:'生命 +10；治疗与护盾效果 +20%',note:'每级 +10 生命、治疗与护盾 +20%，每 5 秒恢复 1 生命。可放大吸血、回血与壁垒。'},
  emberPlate: {name:'熔糖战甲',category:'defense',price:70,effect:'生命 +20；按最大生命持续灼烧身周敌人',note:'每级 +20 生命。每半秒灼烧身周敌人，造成最大生命 0.8%/1.6%/2.4% 的伤害，不触发普攻特效。'},
  thornArmor: {name:'荆糖棘甲',category:'defense',price:65,effect:'生命 +15；减伤 5%；受击向身周反伤',note:'每级 +15 生命、减伤 5%。受击反伤 = 本次减伤后的伤害 ×30%/60%/90% + 最大生命 ×2%/4%/6%，最多每 0.75 秒触发。'},
  sugarCore: {name:'糖晶战刃',category:'attack',price:60,effect:'攻击 +12%；暴击率 +15%',note:'每级攻击 +12%、暴击率 +15%。与碎星透镜的暴击伤害自然配合。'},
  clockGrip: {name:'狂热齿轮',category:'attack',price:55,effect:'攻速 +12%；有效普攻叠加热力攻速',note:'每级攻速 +12%。每次有效普攻增加一层热力，最多 4 层，每层再加 3%/6%/9% 攻速；两秒未命中清空。横扫与贯穿每轮只叠一层。'},
  clearLens: {name:'碎星透镜',category:'attack',price:65,effect:'攻击距离 +10%；暴击伤害 +20%',note:'每级距离 +10%、暴击倍率 +0.20。没有暴击率时不会凭空暴击，可搭配糖晶战刃。'},
  tideFang: {name:'破潮尖牙',category:'attack',price:70,effect:'攻击 +6%；普攻附加目标当前生命伤害',note:'每级攻击 +6%。普攻附加目标当前生命 3.75%/5%/6.25% 的伤害，单目标上限为本次基础攻击伤害的 50%/65%/80%。对首领同样生效。'},
  stormCoil: {name:'疾电线圈',category:'attack',price:65,effect:'攻速 +10%；每四次有效普攻连锁闪电',note:'每级攻速 +10%。每四次有效普攻释放连锁电击，最多 3 个目标，每目标造成 45%/55%/65% 普攻伤害。多目标命中不重复计数。'},
  bloodFang: {name:'血莓獠牙',category:'attack',price:60,effect:'攻击 +8%；普攻吸血 +6%',note:'每级攻击 +8%、普攻吸血 +6%。按实际造成的伤害回复；每秒最多恢复最大生命 5%，治疗增幅也提高此上限，防止横扫无限吸血。'},
  breezeBoots: {name:'轻云疾行靴',category:'footwear',price:45,effect:'移速 +9%；灵活走位',note:'每级移速 +9%，同步改善起步。与远距离、暴击或续航装备自由混搭。足具只能穿一件。'},
  springBoots: {name:'回响步靴',category:'footwear',price:50,effect:'瞬步冷却 −0.55 秒；瞬步强化下一次命中',note:'每级缩短瞬步冷却 0.55 秒；瞬步后 3 秒内，下一次普攻的首个命中额外造成 25%/50%/75% 伤害。足具只能穿一件。'},
  pickupBoots: {name:'逐风战靴',category:'footwear',price:50,effect:'攻速 +8%；金币经验吸取范围 +15%',note:'每级攻速 +8%、金币与经验吸取范围 +15%。适合攻速特效与吸血搭配。足具只能穿一件。'},
} as const;
export type GearId = keyof typeof GEAR;
export type GearInventory = Record<GearId, number>;
export const GEAR_IDS = Object.keys(GEAR) as GearId[];
export const isGearId = (value: unknown): value is GearId => typeof value === 'string' && Object.hasOwn(GEAR, value);
export const freshGear = (): GearInventory => Object.fromEntries(GEAR_IDS.map(id => [id, 0])) as GearInventory;
export const gearPrice = (id: GearId, currentRank: number) => GEAR[id].price + currentRank * 35;
export const gearInvestment = (id: GearId, rank: number) => rank * GEAR[id].price + rank * (rank-1) * 35 / 2;
export const gearSpent = (gear: GearInventory) => GEAR_IDS.reduce((sum,id) => sum + gearInvestment(id,gear[id]),0);
export const gearSellPrice = (id: GearId, rank: number) => Math.floor(gearInvestment(id,rank) * .75);
export const gearMaxHp = (g: GearInventory) => 35*g.jellyVest + 10*g.honeyCharm + 20*g.emberPlate + 15*g.thornArmor;
export function gearBlockReason(e: EconomyState, id: GearId): string {
  if (e.gear[id]>=GEAR_CAP) return '已满级';
  if (!e.gear[id] && e.order.length>=GEAR_SLOTS) return '六件已满';
  if (!e.gear[id] && GEAR[id].category==='footwear' && e.order.some(k=>GEAR[k].category==='footwear')) return '已有足具';
  if (e.wallet<gearPrice(id,e.gear[id])) return '金币不足';
  return '';
}
export function gearDetail(id: GearId, rank: number) {
  switch(id) {
    case 'jellyVest':return `生命 +${35*rank}；增强灼烧与护盾的生命收益`;
    case 'bubbleGuard':return `减伤 ${4*rank}%；低血护盾 ${10+6*rank}% 最大生命，16 秒冷却`;
    case 'honeyCharm':return `生命 +${10*rank}；治疗与护盾 +${20*rank}%；每 5 秒回血 ${rank}`;
    case 'emberPlate':return `生命 +${20*rank}；每半秒灼烧最大生命的 ${(rank*.8).toFixed(1)}%`;
    case 'thornArmor':return `生命 +${15*rank}；减伤 ${5*rank}%；反伤 ${30*rank}% 受击伤害 +${2*rank}% 最大生命`;
    case 'sugarCore':return `攻击 +${12*rank}%；暴击率 +${15*rank}%`;
    case 'clockGrip':return `攻速 +${12*rank}%；每层热力 +${3*rank}%，上限 4 层`;
    case 'clearLens':return `攻击距离 +${10*rank}%；暴击倍率 +${(.2*rank).toFixed(2)}`;
    case 'tideFang':return `攻击 +${6*rank}%；附加当前生命 ${(2.5+1.25*rank).toFixed(2)}% 伤害，上限 ${35+15*rank}% 基础攻击`;
    case 'stormCoil':return `攻速 +${10*rank}%；每四次有效普攻电击 3 人，各 ${35+10*rank}% 普攻伤害`;
    case 'bloodFang':return `攻击 +${8*rank}%；普攻吸血 ${6*rank}%，每秒上限 5% 最大生命，可被治疗增幅提高`;
    case 'breezeBoots':return `移速 +${9*rank}%；起步与转向同步改善`;
    case 'springBoots':return `瞬步冷却 ${(5-.55*rank).toFixed(2)} 秒；瞬步后首个命中 +${25*rank}% 伤害`;
    case 'pickupBoots':return `攻速 +${8*rank}%；金币经验吸取范围 +${15*rank}%`;
  }
}
export const COIN_VALUES: Record<EnemyKind, number> = {
  blob: 1, swift: 2, armor: 4, shooter: 3, charger: 4, wisp: 4, splitter: 3,
  brood: 1, spiker: 5, poison: 4, bomber: 4, stalker: 5, elite: 25, boss: 100,
};
export const NORMAL_COIN_DROP_CHANCE = .60;
export const coinDropChance = (kind: EnemyKind) => kind === 'elite' || kind === 'boss' ? 1 : NORMAL_COIN_DROP_CHANCE;
export interface EconomyState {wallet:number;earned:number;spent:number;refunded:number;gear:GearInventory;order:GearId[];regen:number}
export const freshEconomy = (coins=0):EconomyState => ({wallet:coins,earned:coins,spent:0,refunded:0,gear:freshGear(),order:[],regen:0});
export function validEconomy(value:unknown):value is EconomyState {
  if (!value || typeof value!=='object') return false;
  const e=value as EconomyState;
  return [e.wallet,e.earned,e.spent,e.refunded].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9)
    && e.wallet+e.spent===e.earned+e.refunded && !!e.gear && Object.keys(e.gear).length===GEAR_IDS.length
    && GEAR_IDS.every(id=>Number.isInteger(e.gear[id])&&e.gear[id]>=0&&e.gear[id]<=GEAR_CAP)
    && e.spent>=gearSpent(e.gear) && e.refunded<=Math.floor((e.spent-gearSpent(e.gear))*.75)
    && Array.isArray(e.order)&&e.order.length<=GEAR_SLOTS&&e.order.every(isGearId)&&new Set(e.order).size===e.order.length
    && e.order.length===GEAR_IDS.filter(id=>e.gear[id]>0).length&&e.order.every(id=>e.gear[id]>0)
    && e.order.filter(id=>GEAR[id].category==='footwear').length<=1
    && Number.isFinite(e.regen)&&e.regen>=0&&e.regen<5.000001;
}
